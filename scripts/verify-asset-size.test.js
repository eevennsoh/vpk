const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { evaluateAssetSize, formatFailure, listAssetFiles, readAssetEntries, shrinkBaseline } = require("./verify-asset-size");

const CAP = 1000;

function baseline(files = {}) {
	return { version: 1, capBytes: CAP, files };
}

test("files at or under the cap pass without a baseline entry", () => {
	const failures = evaluateAssetSize([{ filePath: "public/a.png", bytes: CAP }], baseline());
	assert.deepEqual(failures, []);
});

test("a new file over the cap fails, and the message says to re-encode rather than baseline", () => {
	const failures = evaluateAssetSize([{ filePath: "public/big.png", bytes: CAP + 1 }], baseline());
	assert.deepEqual(failures.map((failure) => failure.type), ["new-oversized-asset"]);
	assert.match(formatFailure(failures[0]), /Resize or re-encode/u);
});

test("a baselined file may shrink but not grow", () => {
	const recorded = baseline({ "public/video.mp4": 5000 });
	assert.deepEqual(evaluateAssetSize([{ filePath: "public/video.mp4", bytes: 4000 }], recorded), []);
	assert.deepEqual(
		evaluateAssetSize([{ filePath: "public/video.mp4", bytes: 5001 }], recorded).map((failure) => failure.type),
		["baselined-asset-grew"],
	);
});

test("an entry whose file is gone or back under the cap is reported, so the ledger shrinks", () => {
	const failures = evaluateAssetSize(
		[{ filePath: "public/small-now.png", bytes: 10 }],
		baseline({ "public/gone.wav": 9000, "public/small-now.png": 9000 }),
	);
	assert.deepEqual(failures.map((failure) => [failure.type, failure.filePath]), [
		["stale-baseline-entry", "public/gone.wav"],
		["baseline-entry-under-cap", "public/small-now.png"],
	]);
});

test("--update only lowers and removes entries; it never adds an oversized file", () => {
	const updated = shrinkBaseline(
		[
			{ filePath: "public/kept.mp4", bytes: 3000 },
			{ filePath: "public/shrunk.png", bytes: 1500 },
			{ filePath: "public/under.png", bytes: 20 },
			{ filePath: "public/new-big.wav", bytes: 99999 },
		],
		baseline({ "public/kept.mp4": 3000, "public/shrunk.png": 4000, "public/under.png": 4000, "public/gone.mp3": 4000 }),
	);
	assert.deepEqual(updated, baseline({ "public/kept.mp4": 3000, "public/shrunk.png": 1500 }));
});

test("readAssetEntries reads regular files and skips missing paths and symlinks", (t) => {
	const root = mkdtempSync(path.join(os.tmpdir(), "asset-size-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(path.join(root, "public"));
	writeFileSync(path.join(root, "public", "a.bin"), Buffer.alloc(42));
	symlinkSync("a.bin", path.join(root, "public", "link.bin"));
	const entries = readAssetEntries(["public/a.bin", "public/link.bin", "public/missing.bin"], { cwd: root });
	assert.deepEqual(entries, [{ filePath: "public/a.bin", bytes: 42 }]);
});

test("a file whose name Git would quote (non-ASCII, quotes) is still measured", (t) => {
	const root = mkdtempSync(path.join(os.tmpdir(), "asset-size-git-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
	assert.equal(git("init", "-q").status, 0);
	mkdirSync(path.join(root, "public"));
	writeFileSync(path.join(root, "public", "café.png"), Buffer.alloc(CAP + 1));
	writeFileSync(path.join(root, "public", 'say "hi".png'), Buffer.alloc(10));
	assert.equal(git("add", "public/café.png").status, 0);

	const files = listAssetFiles({ cwd: root }).sort();
	assert.deepEqual(files, ["public/café.png", 'public/say "hi".png']);
	const failures = evaluateAssetSize(readAssetEntries(files, { cwd: root }), baseline());
	assert.deepEqual(failures.map((failure) => [failure.type, failure.filePath]), [["new-oversized-asset", "public/café.png"]]);
});
