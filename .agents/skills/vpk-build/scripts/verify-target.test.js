const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function verify(t, args = [], options = {}) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-verify-target-modes-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const target = path.join(root, "target with spaces");
	const bin = path.join(root, "bin");
	fs.mkdirSync(path.join(target, "scripts"), { recursive: true });
	fs.mkdirSync(bin);
	fs.copyFileSync(path.resolve(__dirname, "../../../../scripts/prepare-static-export.mjs"), path.join(target, "scripts/prepare-static-export.mjs"));
	fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ scripts: {
		build: "fixture", typecheck: "fixture",
		...(args.includes("--export") ? { "build:export": "fixture" } : {}),
	} }));
	const calls = path.join(root, "calls.log");
	fs.writeFileSync(calls, "");
	fs.writeFileSync(path.join(bin, "pnpm"), `#!/bin/bash
printf '%s\\n' "$*" >> "$VERIFY_CALLS"
if [ "$*" = "$VERIFY_FAIL" ]; then exit 7; fi
case "$*" in
"run build"|"run build:export")
	if [ "$VERIFY_OUTPUT" = yes ]; then
		mkdir -p out
		printf '%s' "$VERIFY_HTML" > out/index.html
	fi
;;
esac
`);
	fs.chmodSync(path.join(bin, "pnpm"), 0o755);
	const result = spawnSync("bash", [path.join(__dirname, "verify-target.sh"), target, ...args], {
		encoding: "utf8",
		env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, VERIFY_CALLS: calls, VERIFY_FAIL: options.fail || "", VERIFY_OUTPUT: options.output === false ? "no" : "yes",
			VERIFY_HTML: options.missingAsset ? '<html><script src="/_next/static/missing.js"></script></html>' : "<html></html>",
		},
	});
	return { ...result, target, calls: fs.readFileSync(calls, "utf8").trim().split("\n").filter(Boolean) };
}

test("normal verification retains install, typecheck, and one build", (t) => {
	const result = verify(t);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(result.calls, ["install", "run typecheck", "run build"]);
	assert.ok(fs.existsSync(path.join(result.target, "output/export-inventory.json")));
});

test("explicit export verification builds once and records the inventory", (t) => {
	const result = verify(t, ["--export"]);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(result.calls, ["install", "run typecheck", "run build:export"]);
	assert.ok(fs.existsSync(path.join(result.target, "output/export-inventory.json")));
});

test("export verification fails when its deliverable is missing", (t) => {
	const result = verify(t, ["--export"], { output: false });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /out\/index.html/u);
});

test("failed typecheck stops before export packaging", (t) => {
	const result = verify(t, ["--export"], { fail: "run typecheck" });
	assert.equal(result.status, 7);
	assert.deepEqual(result.calls, ["install", "run typecheck"]);
	assert.equal(fs.existsSync(path.join(result.target, "output/export-inventory.json")), false);
});

test("unsupported verification options stop before package commands", (t) => {
	const result = verify(t, ["--skip-everything"]);
	assert.equal(result.status, 2);
	assert.deepEqual(result.calls, []);
});

test("referenced assets are checked after the single export build", (t) => {
	const result = verify(t, ["--export"], { missingAsset: true });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Missing referenced asset.*missing.js/u);
	assert.deepEqual(result.calls, ["install", "run typecheck", "run build:export"]);
});

for (const wrapper of [false, true]) {
	test(`target verification selects ${wrapper ? "build:export" : "build"} and records the actual export inventory`, (t) => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-verify-target-"));
		t.after(() => fs.rmSync(root, { recursive: true, force: true }));
		fs.mkdirSync(path.join(root, "scripts"));
		fs.mkdirSync(path.join(root, "bin"));
		fs.copyFileSync(path.resolve(__dirname, "../../../../scripts/prepare-static-export.mjs"), path.join(root, "scripts/prepare-static-export.mjs"));
		fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: wrapper ? { "build:export": "fixture" } : {} }));
		const fakePnpm = path.join(root, "bin/pnpm");
		fs.writeFileSync(fakePnpm, '#!/bin/sh\nprintf "%s\\n" "$*" >> calls.log\ncase "$*" in\n"run build"|"run build:export") mkdir -p out; printf "<html>Exported</html>" > out/index.html;;\nesac\n');
		fs.chmodSync(fakePnpm, 0o755);
		const result = spawnSync("bash", [path.join(__dirname, "verify-target.sh"), root], {
			encoding: "utf8", env: { ...process.env, PATH: `${root}/bin${path.delimiter}${process.env.PATH}` },
		});
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.equal(fs.readFileSync(path.join(root, "calls.log"), "utf8"), `install\nrun typecheck\nrun ${wrapper ? "build:export" : "build"}\n`);
		const inventory = JSON.parse(fs.readFileSync(path.join(root, "output/export-inventory.json"), "utf8"));
		assert.equal(inventory.routes[0].html.rawBytes, 21);
		assert.equal(fs.existsSync(path.join(root, "out/index.html.gz")), false);
	});
}
