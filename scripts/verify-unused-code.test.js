"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	BASELINE_FILE,
	collectFindings,
	compareFindings,
	main,
	normalizeBaseline,
	shrinkBaseline,
} = require("./verify-unused-code");

const REPO_ROOT = path.resolve(__dirname, "..");

function report(entries) {
	return {
		issues: entries.map(({ file, files = [], exports = [], dependencies = [] }) => ({
			dependencies: dependencies.map((name) => ({ name, line: 1, col: 1, pos: 0 })),
			exports: exports.map((name) => ({ name, line: 3, col: 1, pos: 10 })),
			file,
			files: files.map((name) => ({ name })),
		})),
	};
}

const TODAY_ENTRIES = [
	{ file: "components/dead.tsx", files: ["components/dead.tsx"] },
	{ file: "lib/helpers.ts", exports: ["oldHelper"] },
	{ file: "package.json", dependencies: ["left-pad"] },
];
const TODAY = report(TODAY_ENTRIES);

// A scratch repo root holding only the baseline file; git and knip are injected.
function scratch(t, baseline) {
	const cwd = mkdtempSync(path.join(tmpdir(), "vpk-unused-code-"));
	t.after(() => rmSync(cwd, { force: true, recursive: true }));
	mkdirSync(path.join(cwd, "scripts"));
	if (baseline) writeFileSync(path.join(cwd, BASELINE_FILE), JSON.stringify(baseline));
	return cwd;
}

function run(cwd, { argv = [], knipReport = TODAY, base = null } = {}) {
	const out = [];
	const err = [];
	const git = (args) => {
		if (args[0] === "merge-base") return "base0123456789";
		if (args[0] === "show") return base === null ? null : JSON.stringify(base);
		return null;
	};
	const status = main(argv, { cwd, env: {}, error: (line) => err.push(line), git, knip: () => knipReport, log: (line) => out.push(line) });
	return { status, stderr: err.join("\n"), stdout: out.join("\n") };
}

test("findings are keyed by path and name, without line numbers", () => {
	const findings = collectFindings(TODAY);
	assert.deepEqual(findings.files, ["components/dead.tsx"]);
	assert.deepEqual(findings.exports, ["lib/helpers.ts#oldHelper"]);
	assert.deepEqual(findings.dependencies, ["package.json#left-pad"]);
	assert.deepEqual(findings.types, []);
});

test("an unchanged tree passes", (t) => {
	const baseline = collectFindings(TODAY);
	const cwd = scratch(t, baseline);
	const result = run(cwd, { base: baseline });
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /Verified unused code only shrinks \(3 baselined/u);
});

test("a new unused file fails with its path", (t) => {
	const baseline = collectFindings(TODAY);
	const cwd = scratch(t, baseline);
	const knipReport = report([...TODAY_ENTRIES, { file: "components/new-orphan.tsx", files: ["components/new-orphan.tsx"] }]);
	const result = run(cwd, { base: baseline, knipReport });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /1 new finding/u);
	assert.match(result.stderr, /^- unused file: components\/new-orphan\.tsx$/mu);
	assert.match(result.stderr, /The baseline never takes new entries/u);
});

test("a removed entry with a stale baseline fails with the command to refresh it", (t) => {
	const baseline = collectFindings(TODAY);
	const cwd = scratch(t, baseline);
	// components/dead.tsx was deleted; Knip no longer reports it.
	const knipReport = report([
		{ file: "lib/helpers.ts", exports: ["oldHelper"] },
		{ file: "package.json", dependencies: ["left-pad"] },
	]);
	const result = run(cwd, { base: baseline, knipReport });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /^- unused file: components\/dead\.tsx$/mu);
	assert.match(result.stderr, /pnpm run fix:generated --only unused-code/u);

	const updated = run(cwd, { argv: ["--update"], base: baseline, knipReport });
	assert.equal(updated.status, 0, updated.stderr);
	assert.deepEqual(JSON.parse(readFileSync(path.join(cwd, BASELINE_FILE), "utf8")).files, []);
	assert.equal(run(cwd, { base: baseline, knipReport }).status, 0);
});

test("a baseline that gained an entry over the merge-base fails, even when Knip agrees", (t) => {
	const base = collectFindings(report([{ file: "lib/helpers.ts", exports: ["oldHelper"] }]));
	const cwd = scratch(t, collectFindings(TODAY));
	const result = run(cwd, { base });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /may only shrink, but it gained 2 entries over base01234/u);
	assert.match(result.stderr, /^- unused file: components\/dead\.tsx$/mu);
	assert.match(result.stderr, /^- unused dependency: package\.json#left-pad$/mu);
});

test("--update never adds: new findings stay out and still fail", (t) => {
	const base = collectFindings(report([{ file: "lib/helpers.ts", exports: ["oldHelper"] }]));
	const cwd = scratch(t, base);
	const result = run(cwd, { argv: ["--update"], base });
	assert.equal(result.status, 1);
	assert.deepEqual(normalizeBaseline(JSON.parse(readFileSync(path.join(cwd, BASELINE_FILE), "utf8"))), base);
	assert.match(result.stderr, /components\/dead\.tsx/u);
});

test("--update keeps the base's entries when the working baseline is conflicted", (t) => {
	const base = collectFindings(TODAY);
	const cwd = scratch(t, null);
	writeFileSync(path.join(cwd, BASELINE_FILE), "<<<<<<< ours\n{}\n=======\n{}\n>>>>>>> theirs\n");
	const result = run(cwd, { argv: ["--update"], base });
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(normalizeBaseline(JSON.parse(readFileSync(path.join(cwd, BASELINE_FILE), "utf8"))), base);
});

test("a missing baseline fails instead of regenerating one", (t) => {
	const cwd = scratch(t, null);
	const result = run(cwd, { base: collectFindings(TODAY) });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /is missing/u);
});

test("compare and shrink treat every category alike", () => {
	const current = collectFindings(report([{ file: "a.ts", exports: ["x"] }]));
	const baseline = collectFindings(report([{ file: "a.ts", exports: ["x", "y"] }]));
	assert.deepEqual(compareFindings({ baseline, current }), [{ category: "exports", entry: "a.ts#y", type: "stale" }]);
	assert.deepEqual(shrinkBaseline({ allowed: baseline, current }), current);
	assert.deepEqual(shrinkBaseline({ allowed: null, current }), current);
});

// Real Knip on a scratch project: guards the JSON shape collectFindings reads.
test("Knip's JSON report on a tiny project yields the unused file and export", (t) => {
	const cwd = mkdtempSync(path.join(tmpdir(), "vpk-unused-code-knip-"));
	t.after(() => rmSync(cwd, { force: true, recursive: true }));
	writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ name: "scratch", main: "index.js", private: true }));
	writeFileSync(path.join(cwd, "index.js"), "const { used } = require(\"./used\");\nused();\n");
	writeFileSync(path.join(cwd, "used.js"), "function used() {}\nfunction spare() {}\nmodule.exports = { spare, used };\n");
	writeFileSync(path.join(cwd, "orphan.js"), "module.exports = 1;\n");
	const knip = path.join(REPO_ROOT, "node_modules", "knip", "bin", "knip.js");
	const result = spawnSync(process.execPath, [knip, "--reporter", "json", "--no-progress", "--no-exit-code", "--no-gitignore"], { cwd, encoding: "utf8" });
	assert.equal(result.status, 0, result.stderr);
	const findings = collectFindings(JSON.parse(result.stdout));
	assert.deepEqual(findings.files, ["orphan.js"]);
	assert.deepEqual(findings.exports, ["used.js#spare"]);
});
