const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const test = require("node:test");

const script = path.join(__dirname, "plan-target-refresh.mjs");
function write(root, relative, contents) {
	const file = path.join(root, relative);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, contents);
}

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-refresh-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const source = path.join(root, "source");
	const stage = path.join(root, "stage");
	const target = path.join(root, "standalone target");
	for (const directory of [source, stage, target]) fs.mkdirSync(directory);
	const git = (...args) => execFileSync("git", ["-C", source, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
	git("init", "-q");
	git("config", "user.email", "fixture@example.com");
	git("config", "user.name", "Fixture");
	git("config", "commit.gpgsign", "false");
	git("config", "core.hooksPath", path.join(root, "no-hooks"));
	const old = { "components/card.tsx": "old card\n", "components/local.tsx": "source local\n", "app/card.css": ".card { color: red; }\n", "public/asset.bin": Buffer.from([0, 1, 2]), "package.json": '{"dependencies":{}}\n' };
	for (const [relative, content] of Object.entries(old)) { write(source, relative, content); write(target, relative, content); }
	git("add", "."); git("commit", "-qm", "baseline");
	const baseline = git("rev-parse", "HEAD");
	const latest = { ...old, "components/card.tsx": "new card\n", "app/card.css": ".card { color: blue; }\n", "public/asset.bin": Buffer.from([0, 4, 5]), "types/card.d.ts": "declare const card: string;\n", "package.json": '{"dependencies":{"new-package":"1.0.0"}}\n' };
	for (const [relative, content] of Object.entries(latest)) { write(source, relative, content); write(stage, relative, content); }
	git("add", "."); git("commit", "-qm", "latest");
	const selected = git("rev-parse", "HEAD");
	write(target, "components/local.tsx", "unshipped local override\n");
	write(target, "components/old-only.ts", "keep this draft\n");
	for (const relative of ["README.md", "service-descriptor.yml", "scripts/dev-backend-backed.mjs"]) {
		write(stage, relative, "generic scaffold\n");
		write(target, relative, "target configuration\n");
	}
	const plan = path.join(root, "plan.json"), manifest = path.join(root, "refresh.json");
	write(root, "plan.json", JSON.stringify({ repoRoot: source, sourceRevision: selected, files: ["components/card.tsx"] }));
	const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
	const planning = () => run(plan, stage, target, "--baseline", baseline, "--out", manifest);
	const apply = () => run("--apply", manifest);
	return { root, source, stage, target, plan, manifest, baseline, selected, git, run, planning, apply };
}

test("refresh discovers local CSS outside the TS plan, preserves overrides/configuration, and never deletes old-only files", (t) => {
	const f = fixture(t), result = f.planning();
	assert.equal(result.status, 0, result.stderr);
	const manifest = JSON.parse(fs.readFileSync(f.manifest));
	assert.deepEqual(manifest.copy.map((x) => x.path), ["app/card.css", "components/card.tsx", "public/asset.bin", "types/card.d.ts"]);
	assert.deepEqual(manifest.localOverrides, ["components/local.tsx"]);
	assert.deepEqual(manifest.manualReview, ["package.json"]);
	assert.equal(f.apply().status, 0);
	for (const item of manifest.copy) assert.deepEqual(fs.readFileSync(path.join(f.target, item.path)), fs.readFileSync(path.join(f.stage, item.path)));
	assert.equal(fs.readFileSync(path.join(f.target, "README.md"), "utf8"), "target configuration\n");
	assert.equal(fs.readFileSync(path.join(f.target, "package.json"), "utf8"), '{"dependencies":{}}\n');
	assert.equal(fs.readFileSync(path.join(f.target, "components/local.tsx"), "utf8"), "unshipped local override\n");
	assert.equal(fs.readFileSync(path.join(f.target, "components/old-only.ts"), "utf8"), "keep this draft\n");
	write(f.target, "public/asset.bin", "edited target");
	assert.deepEqual(fs.readFileSync(path.join(f.stage, "public/asset.bin")), Buffer.from([0, 4, 5]));
});

test("overlapping source/local changes block every refresh write", (t) => {
	const f = fixture(t);
	write(f.target, "components/card.tsx", "local card edit\n");
	assert.equal(f.planning().status, 0);
	const result = f.apply();
	assert.equal(result.status, 1);
	assert.match(result.stderr, /overlapping/u);
	assert.equal(fs.readFileSync(path.join(f.target, "app/card.css"), "utf8"), ".card { color: red; }\n");
});

for (const owner of ["target", "stage"]) {
	test(`a ${owner} edit after review stops before any copy`, (t) => {
		const f = fixture(t);
		assert.equal(f.planning().status, 0);
		write(f[owner], "public/asset.bin", "later edit");
		const result = f.apply();
		assert.equal(result.status, 1);
		assert.match(result.stderr, /changed after review/u);
		assert.equal(fs.readFileSync(path.join(f.target, "app/card.css"), "utf8"), ".card { color: red; }\n");
	});
}

test("reviewed staging remains usable after the live source checkout switches revision", (t) => {
	const f = fixture(t);
	f.git("checkout", "--detach", f.baseline);
	assert.equal(f.planning().status, 0);
	assert.equal(f.apply().status, 0);
	assert.equal(fs.readFileSync(path.join(f.target, "components/card.tsx"), "utf8"), "new card\n");
});

for (const relative of ["../outside.ts", "service-descriptor.yml", "components//card.tsx"]) {
	test(`a modified manifest cannot copy ${relative}`, (t) => {
		const f = fixture(t);
		assert.equal(f.planning().status, 0);
		const manifest = JSON.parse(fs.readFileSync(f.manifest));
		manifest.copy[0].path = relative;
		fs.writeFileSync(f.manifest, JSON.stringify(manifest));
		assert.equal(f.apply().status, 1);
		assert.equal(fs.readFileSync(path.join(f.target, "app/card.css"), "utf8"), ".card { color: red; }\n");
	});
}

test("a dangling symlink created after review cannot redirect a new file outside the target", (t) => {
	const f = fixture(t);
	assert.equal(f.planning().status, 0);
	const outside = path.join(f.root, "outside.d.ts");
	fs.mkdirSync(path.join(f.target, "types"));
	fs.symlinkSync(outside, path.join(f.target, "types/card.d.ts"));
	const result = f.apply();
	assert.equal(result.status, 1);
	assert.match(result.stderr, /symlink/u);
	assert.equal(fs.existsSync(outside), false);
	assert.equal(fs.readFileSync(path.join(f.target, "app/card.css"), "utf8"), ".card { color: red; }\n");
});

test("generated harness differences are left for review", (t) => {
	const f = fixture(t);
	write(f.stage, "app/page.tsx", "generated entry\n");
	write(f.target, "app/page.tsx", "custom target entry\n");
	assert.equal(f.planning().status, 0);
	const manifest = JSON.parse(fs.readFileSync(f.manifest));
	assert.ok(manifest.manualReview.includes("app/page.tsx"));
	assert.equal(f.apply().status, 0);
	assert.equal(fs.readFileSync(path.join(f.target, "app/page.tsx"), "utf8"), "custom target entry\n");
});
