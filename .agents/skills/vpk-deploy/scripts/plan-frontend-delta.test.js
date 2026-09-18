const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SCRIPT = path.join(__dirname, "plan-frontend-delta.mjs");
const BASE_IMAGE = `docker.atl-paas.net/example-service@sha256:${"a".repeat(64)}`;

function write(root, relative, content) {
	const file = path.join(root, relative);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
}

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-deploy-delta-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const target = path.join(root, "target");
	const prior = path.join(root, "prior");
	const overlay = path.join(root, "overlay");
	write(target, "service-descriptor.yml", "image: docker.atl-paas.net/example-service\n");
	for (const relative of ["backend/app.js", "lib/util.js", "rovo/config.js", "scripts/lib/port.js",
		"package.json", "backend/package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]) {
		write(target, relative, `${relative}: same\n`);
		write(prior, relative, `${relative}: same\n`);
	}
	write(prior, "backend/public/index.html", "<html>Old</html>");
	write(prior, "backend/public/_next/static/old.js", "old chunk");
	write(prior, "backend/public/unchanged.svg", "same asset");
	write(target, "out/index.html", "<html>New</html>");
	write(target, "out/_next/static/new.js", "new chunk");
	write(target, "out/unchanged.svg", "same asset");
	return { target, prior, overlay };
}

function run(f, args = [], baseImage = BASE_IMAGE) {
	return spawnSync(process.execPath, [SCRIPT, f.target, f.prior, "--base-image", baseImage, ...args], {
		encoding: "utf8",
	});
}

test("plans and writes only changed export files over a verified digest", (t) => {
	const f = fixture(t);
	const result = run(f, ["--out", f.overlay, "--apply"]);
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.match(result.stdout, /"runtimeFilesChecked": 5/u);
	assert.match(result.stdout, /"changedExportFiles": 2/u);
	assert.match(result.stdout, /"oldOnlyExportFiles": 1/u);
	assert.equal(fs.readFileSync(path.join(f.overlay, "index.html"), "utf8"), "<html>New</html>");
	assert.equal(fs.readFileSync(path.join(f.overlay, "_next/static/new.js"), "utf8"), "new chunk");
	assert.ok(!fs.existsSync(path.join(f.overlay, "unchanged.svg")));
	assert.equal(fs.readFileSync(`${f.overlay}.Dockerfile`, "utf8"), `FROM ${BASE_IMAGE}\nCOPY . ./backend/public/\n`);
	const plan = JSON.parse(fs.readFileSync(`${f.overlay}.plan.json`, "utf8"));
	assert.deepEqual(plan.changedPaths, ["_next/static/new.js", "index.html"]);
});

test("blocks frontend-only recovery when runtime files differ", (t) => {
	const f = fixture(t);
	write(f.target, "backend/app.js", "new backend behavior\n");
	const result = run(f, ["--out", f.overlay, "--apply"]);
	assert.equal(result.status, 1, result.stdout + result.stderr);
	assert.match(result.stderr, /Runtime file parity failed/u);
	assert.ok(!fs.existsSync(f.overlay));
});

test("requires explicit review when the prior dependency layer differs", (t) => {
	const f = fixture(t);
	write(f.target, "pnpm-lock.yaml", "new lockfile\n");
	const blocked = run(f, ["--out", f.overlay, "--apply"]);
	assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
	assert.match(blocked.stderr, /prior installed packages/u);
	assert.ok(!fs.existsSync(f.overlay));
	const accepted = run(f, ["--out", f.overlay, "--apply", "--accept-prior-dependencies"]);
	assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
	const plan = JSON.parse(fs.readFileSync(`${f.overlay}.plan.json`, "utf8"));
	assert.deepEqual(plan.dependencyDifferences, ["pnpm-lock.yaml"]);
	assert.equal(plan.acceptedPriorDependencies, true);
});

test("rejects a foreign base repository and an overlay inside the selected export", (t) => {
	const f = fixture(t);
	const foreign = run(f, [], BASE_IMAGE.replace("example-service", "foreign-service"));
	assert.equal(foreign.status, 2);
	assert.match(foreign.stderr, /must match the target descriptor/u);
	const nested = run(f, ["--out", path.join(f.target, "out", "overlay"), "--apply"]);
	assert.equal(nested.status, 2);
	assert.match(nested.stderr, /outside the selected export/u);
});
