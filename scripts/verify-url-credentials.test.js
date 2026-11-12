const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { findUrlCredentials, grepTrackedFiles } = require("./verify-url-credentials");

const line = (text, filePath = "package.json") => ({ filePath, lineNumber: 1, text });

test("flags literal credentials in URL queries without echoing the value", () => {
	assert.deepEqual(findUrlCredentials([
		line("\"motion-plus\": \"https://api.motion.dev/registry?package=motion-plus&version=2.11.2&token=abc123\""),
		line("fetch(\"https://example.test/hook?KEY=s3cr3t\")", "lib/hook.ts"),
		line("https://example.test/?auth=xyz&secret=pqr", "docs/x.md"),
	]), [
		{ filePath: "package.json", lineNumber: 1, parameter: "token" },
		{ filePath: "lib/hook.ts", lineNumber: 1, parameter: "key" },
		{ filePath: "docs/x.md", lineNumber: 1, parameter: "auth" },
		{ filePath: "docs/x.md", lineNumber: 1, parameter: "secret" },
	]);
});

test("ignores interpolated, placeholder and empty values, and allowlisted fixtures", () => {
	assert.deepEqual(findUrlCredentials([
		line("statusUrl: `${origin}/api/jobs/${job.id}?key=${token}`", "a.mjs"),
		line("assert.match(source, /<Insights[\\s\\S]*?key=\\{scopeKey\\}/u);", "b.test.js"),
		line("https://example.test/?token=<your-token>", "c.md"),
		line("https://example.test/?token=&next=1", "d.md"),
		line("https://example.test/?token=%TOKEN%", "e.md"),
		line("https://api.motion.dev/registry?token=example", "scripts/verify-pnpm-lockfile.test.js"),
	]), []);
});

test("scans tracked files only and fails the CLI with paths and line numbers", (t) => {
	const root = mkdtempSync(path.join(tmpdir(), "url-credentials-"));
	t.after(() => rmSync(root, { force: true, recursive: true }));
	const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
	git("init", "--quiet");
	writeFileSync(path.join(root, "clean.md"), "See https://example.test/docs?page=2\n");
	writeFileSync(path.join(root, "leak.json"), "{\n  \"url\": \"https://registry.test/pkg?token=live-value\"\n}\n");
	writeFileSync(path.join(root, "untracked.md"), "https://registry.test/pkg?token=not-tracked\n");
	git("add", "clean.md", "leak.json");

	assert.deepEqual(findUrlCredentials(grepTrackedFiles(root)), [{ filePath: "leak.json", lineNumber: 2, parameter: "token" }]);

	const cli = spawnSync(process.execPath, [path.join(__dirname, "verify-url-credentials.js")], { cwd: root, encoding: "utf8" });
	assert.equal(cli.status, 1);
	assert.match(cli.stderr, /- leak\.json:2 \(token=\)/u);
	assert.doesNotMatch(cli.stderr, /live-value/u);
});

test("the checked-in tree has no URL-embedded credentials", () => {
	assert.deepEqual(findUrlCredentials(grepTrackedFiles()), []);
});

test("verify:fast, ci:pr and validate:local run the URL-credential check", () => {
	const { readFileSync } = require("node:fs");
	const { gateRunsScript } = require("./lib/package-gates.js");
	const packageJson = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
	assert.equal(packageJson.scripts["verify:url-credentials"], "node scripts/verify-url-credentials.js");
	for (const gate of ["validate:local", "ci:pr", "verify:fast"]) {
		assert.ok(gateRunsScript(packageJson.scripts, gate, "verify:url-credentials"), `${gate} must run verify:url-credentials`);
	}
});
