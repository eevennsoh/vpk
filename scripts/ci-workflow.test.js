const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workflow = readFileSync(path.join(__dirname, "../.github/workflows/ci.yml"), "utf8");
const jobs = Object.fromEntries([...workflow.split("\njobs:\n")[1].matchAll(/^  (\w+):\n([\s\S]*?)(?=^  \w+:\n|$(?![\s\S]))/gmu)]
	.map((match) => [match[1], match[2]]));

test("CI covers every local PR gate through independent static and four unit jobs", () => {
	assert.deepEqual(Object.keys(jobs), ["static", "unit", "aggregate"]);
	assert.match(jobs.unit, /fail-fast: false/u);
	assert.match(jobs.unit, /max-parallel: 4/u);
	assert.match(jobs.unit, /shard: \[1, 2, 3, 4\]/u);
	assert.match(jobs.unit, /pnpm run test:unit:js --shard "\$\{\{ matrix.shard \}\}\/4"/u);
	assert.doesNotMatch(jobs.unit + jobs.static, /needs:|continue-on-error:|--prefix|--file/u);
	const gates = require("../package.json").scripts["ci:pr"].split(" && ");
	for (const command of gates) {
		assert.ok((jobs.static + jobs.unit).includes(`run: time ${command}`), `Missing CI gate: ${command}`);
	}
});

test("PR checks always evaluates and rejects failure, cancelled, skipped and missing dependencies", () => {
	assert.match(jobs.aggregate, /name: PR checks\n/u);
	assert.match(jobs.aggregate, /if: \$\{\{ always\(\) \}\}/u);
	assert.match(jobs.aggregate, /needs: \[static, unit\]/u);
	assert.match(jobs.aggregate, /STATIC_RESULT: \$\{\{ needs.static.result \}\}/u);
	assert.match(jobs.aggregate, /UNIT_RESULT: \$\{\{ needs.unit.result \}\}/u);
	const script = jobs.aggregate.split("        run: |\n")[1].replace(/^          /gmu, "");
	for (const staticResult of ["success", "failure", "cancelled", "skipped", ""]) {
		for (const unitResult of ["success", "failure", "cancelled", "skipped", ""]) {
			const result = spawnSync("bash", ["-e", "-c", script], {
				env: { ...process.env, STATIC_RESULT: staticResult, UNIT_RESULT: unitResult },
			});
			assert.equal(result.status === 0, staticResult === "success" && unitResult === "success");
		}
	}
});

test("CI retains event coverage, cancellation, ratchets and authenticated frozen setup", () => {
	assert.match(workflow, /pull_request:/u);
	assert.match(workflow, /push:\n    branches: \[main\]/u);
	assert.match(workflow, /workflow_dispatch:/u);
	assert.match(workflow, /cancel-in-progress: true/u);
	assert.match(workflow, /permissions:\n  contents: read/u);
	assert.match(jobs.static, /if: github.event_name == 'pull_request'[\s\S]*git fetch[^\n]*GITHUB_BASE_REF/u);
	assert.match(jobs.static, /BEFORE_SHA: \$\{\{ github.event.before \}\}[\s\S]*git fetch[^\n]*BEFORE_SHA/u);
	assert.match(jobs.static, /VPK_SUPPRESSIONS_BASE: \$\{\{ github.event_name == 'push' && github.event.before \|\| '' \}\}/u);
	for (const job of [jobs.static, jobs.unit]) {
		const steps = ["actions/checkout@", "pnpm/action-setup@", "actions/setup-node@", "node scripts/verify-pnpm-lockfile.js", "node scripts/write-npmrc.mjs", "pnpm install --frozen-lockfile"];
		let previous = -1;
		for (const step of steps) {
			assert.ok(job.indexOf(step) > previous, `Setup order: ${step}`);
			previous = job.indexOf(step);
		}
		assert.match(job, /node-version: 24/u);
		assert.match(job, /ATLASSIAN_NPM_TOKEN: \$\{\{ secrets.ATLASSIAN_NPM_TOKEN \}\}/u);
	}
	assert.match(jobs.static, /path: node_modules\/\.cache\/eslint/u);
	for (const file of ["pnpm-lock.yaml", "package.json", "eslint.config.mjs", "eslint-suppressions.json"]) {
		assert.equal(jobs.static.split(`'${file}'`).length - 1, 2, `Cache key and restore prefix: ${file}`);
	}
});

test("ESLint content cache reuses unchanged files and invalidates same-size edits with identical mtime", async () => {
	const { ESLint } = require("eslint");
	for (const name of ["lint", "lint:design-system"]) {
		const command = require("../package.json").scripts[name];
		assert.match(command, /--cache --cache-strategy content --cache-location node_modules\/\.cache\/eslint\//u);
	}
	const root = mkdtempSync(path.join(tmpdir(), "vpk-eslint-content-"));
	try {
		const file = path.join(root, "input.js");
		const cacheLocation = path.join(root, "cache");
		let ruleRuns = 0;
		const probe = {
			meta: { name: "vpk-cache-probe", version: "1" },
			rules: { run: { meta: { schema: [] }, create() { ruleRuns += 1; return {}; } } },
		};
		const lint = () => new ESLint({ cwd: root, overrideConfigFile: true,
			overrideConfig: [{ plugins: { probe }, rules: { "no-debugger": "error", "probe/run": "error" } }],
			cache: true, cacheStrategy: "content", cacheLocation }).lintFiles([file]);
		writeFileSync(file, "void 1;  ");
		utimesSync(file, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"));
		const original = statSync(file);
		assert.equal((await lint())[0].errorCount, 0);
		assert.equal(ruleRuns, 1);
		const cached = readFileSync(cacheLocation, "utf8");
		assert.equal((await lint())[0].errorCount, 0);
		assert.equal(ruleRuns, 1, "unchanged content skips rule execution");
		assert.equal(readFileSync(cacheLocation, "utf8"), cached);
		writeFileSync(file, "debugger;");
		utimesSync(file, original.atime, original.mtime);
		assert.equal(statSync(file).size, original.size);
		assert.equal(statSync(file).mtimeMs, original.mtimeMs);
		assert.equal((await lint())[0].messages[0].ruleId, "no-debugger");
		assert.equal(ruleRuns, 2, "changed content executes rules again");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
