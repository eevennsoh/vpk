const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const scripts = process.env.VPK_CLI_TEST_SCRIPTS ?? __dirname;
const secret = "fixture-value-must-not-be-rendered";

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-linked-cli-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const link = path.join(root, ".agents/skills/vpk-deploy/scripts");
	fs.mkdirSync(path.dirname(link), { recursive: true });
	fs.symlinkSync(scripts, link, "dir");
	const run = (name, args, input) => spawnSync(process.execPath, [path.join(link, name), ...args], { cwd: root, encoding: "utf8", input });
	return { root, run };
}

test("a symlinked skill CLI rejects a missing receipt instead of silently succeeding", t => {
	const f = fixture(t);
	const r = f.run("release-receipt.mjs", ["verify", "--target", f.root, "--receipt", path.join(f.root, "missing.json")]);
	assert.equal(r.status, 2, r.stdout + r.stderr);
	assert.match(r.stderr, /Invalid release receipt JSON/u);
});

test("a symlinked readiness CLI preserves the pending-deployment failure status", t => {
	const f = fixture(t);
	const input = JSON.stringify({ environments: { "pdev-west2": { stable: { deploymentId: "old" } } }, stacks: { "pdev-west2": [
		{ deploymentId: "old", status: "CREATE_COMPLETE", sd: { buildNumber: "old", environment: { SECRET: secret } } },
		{ deploymentId: "new", status: "CREATE_IN_PROGRESS", sd: { buildNumber: "new" } },
	] } });
	const r = f.run("deployment-status.mjs", ["--env", "pdev-west2", "--deployment-id", "new", "--version", "new", "--require-ready"], input);
	assert.equal(r.status, 2, r.stdout + r.stderr);
	assert.equal(JSON.parse(r.stdout).ready, false);
	assert.doesNotMatch(r.stdout + r.stderr, new RegExp(secret, "u"));
});

test("a symlinked initial-theme CLI rejects incomplete inline ADS setup", t => {
	const f = fixture(t);
	const html = path.join(f.root, "index.html");
	fs.writeFileSync(html, '<html><head><style data-theme="spacing">:root{--ds-space-200:1rem}</style></head></html>');
	const r = f.run("verify-initial-theme.mjs", [html, "--if-present"]);
	assert.equal(r.status, 1, r.stdout + r.stderr);
	assert.ok(r.stderr.length > 0);
});

for (const name of ["packaging-report.mjs", "verify-browser.mjs"]) {
	test(`${name} validates arguments when invoked through a skill link`, t => {
		const f = fixture(t);
		const r = f.run(name, []);
		assert.equal(r.status, 2, r.stdout + r.stderr);
		assert.ok(r.stderr.length > 0);
	});
}
