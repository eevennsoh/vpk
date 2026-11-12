const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
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
	for (const job of [jobs.static, jobs.unit]) {
		const steps = ["actions/checkout@", "pnpm/action-setup@", "actions/setup-node@", "node scripts/verify-pnpm-lockfile.js", "node scripts/write-npmrc.mjs", "pnpm install --frozen-lockfile"];
		let previous = -1;
		for (const step of steps) {
			assert.ok(job.indexOf(step) > previous, `Setup order: ${step}`);
			previous = job.indexOf(step);
		}
		assert.match(job, /node-version: 24/u);
		assert.match(job, /ATLASSIAN_NPM_TOKEN: \$\{\{ secrets.ATLASSIAN_NPM_TOKEN \}\}/u);
		assert.match(job, /MOTION_TOKEN: \$\{\{ secrets.MOTION_TOKEN \}\}/u);
	}
	assert.doesNotMatch(workflow, /actions\/cache@|\.cache\/eslint|--cache/u);
});

function stepsFor(job) {
	return job.split(/^      - /gmu).slice(1).map((source) => ({
		name: /^name: (.+)$/mu.exec(source)?.[1],
		condition: /^        if: (.+)$/mu.exec(source)?.[1],
		run: /^        run: (.+)$/mu.exec(source)?.[1],
		env: Object.fromEntries([...source.matchAll(/^          (\w+): (.+)$/gmu)].map((match) => [match[1], match[2]])),
	}));
}

test("static and unit jobs preserve the same base fetches and validation environment", () => {
	const [staticSteps, unitSteps] = [jobs.static, jobs.unit].map(stepsFor);
	for (const name of ["Fetch PR base for ratchet checks", "Fetch pre-push tip for ratchet checks"]) {
		const fetch = staticSteps.find((step) => step.name === name);
		assert.ok(fetch);
		assert.deepEqual(unitSteps.find((step) => step.name === name), fetch);
		for (const steps of [staticSteps, unitSteps]) {
			assert.ok(steps.findIndex((step) => step.name === name) < steps.findIndex((step) => step.name === "Install dependencies"));
		}
		const isPr = name.includes("PR base");
		assert.equal(fetch.condition, `github.event_name == '${isPr ? "pull_request" : "push"}'`);
		assert.deepEqual(fetch.env, isPr ? {} : { BEFORE_SHA: "${{ github.event.before }}" });
		const result = spawnSync("bash", ["-eu", "-c", `git() { printf '%s\\n' "$@"; }\n${fetch.run}`], {
			encoding: "utf8", env: { ...process.env, GITHUB_BASE_REF: "release/test", BEFORE_SHA: "a".repeat(40) },
		});
		assert.equal(result.status, 0, result.stderr);
		assert.deepEqual(result.stdout.trim().split("\n"), ["fetch", "--no-tags", "--depth=1", "origin",
			isPr ? "+refs/heads/release/test:refs/remotes/origin/release/test" : "a".repeat(40)]);
	}
	const guards = staticSteps.find((step) => step.name === "Repository guards");
	const units = unitSteps.find((step) => step.name === "Unit tests");
	assert.deepEqual(units.env, guards.env);
	assert.deepEqual(units.env, { VPK_SUPPRESSIONS_BASE: "${{ github.event_name == 'push' && github.event.before || '' }}" });
});

test("uncached lint observes real no-restyle violations after changing only an imported wrapper", async () => {
	mkdirSync(path.join(__dirname, "../output"), { recursive: true });
	const root = mkdtempSync(path.join(__dirname, "../output/lint-dependency-"));
	try {
		const caller = path.join(root, "caller.tsx");
		const wrapper = path.join(root, "wrapper.tsx");
		const callerSource = 'import { Surface } from "./wrapper";\nexport const Fixture = () => <Surface className="border" />;\n';
		writeFileSync(caller, callerSource);
		const eslintBin = path.join(path.dirname(require.resolve("eslint/package.json")), "bin/eslint.js");
		for (const name of ["lint", "lint:design-system"]) {
			const command = require("../package.json").scripts[name].split(/\s+/u);
			assert.equal(command[0], "eslint");
			assert.ok(!command.some((arg) => arg.startsWith("--cache")), `${name} must inspect imported dependencies every run`);
			const options = command.slice(command.findIndex((arg) => arg.startsWith("--")));
			const config = path.join(root, `${name.replace(":", "-")}.config.mjs`);
			const representative = name === "lint" ? "components/blocks/demo/fixture.tsx" : "components/projects/jira-team-eu26/fixture.tsx";
			writeFileSync(config, `import eslint from ${JSON.stringify(require.resolve("eslint"))};
const { languageOptions, plugins, rules, settings, linterOptions } = await new eslint.ESLint().calculateConfigForFile(${JSON.stringify(representative)});
export default [{ files: ["**/*.tsx"], languageOptions, plugins, rules, settings, linterOptions }];\n`);
			const lint = () => {
				const result = spawnSync(process.execPath, [eslintBin, ...options, "--config", config, "--format", "json", caller], { encoding: "utf8" });
				assert.ok(result.status === 0 || result.status === 1, result.stderr);
				const [finding] = JSON.parse(result.stdout);
				assert.equal(finding.fatalErrorCount, 0, result.stdout);
				return { status: result.status, findings: finding.messages.filter((message) => message.ruleId === "shadcn/no-restyle") };
			};
			writeFileSync(wrapper, 'export function Surface({ className }: { className?: string }) { return <div className={className} />; }\n');
			assert.deepEqual(lint(), { status: 0, findings: [] }, `${name}: warm lint must pass`);
			writeFileSync(wrapper, 'import { PopoverContent } from "@/components/ui/popover";\nexport function Surface({ className }: { className?: string }) { return <PopoverContent className={className} />; }\n');
			assert.equal(readFileSync(caller, "utf8"), callerSource);
			const changed = lint();
			assert.equal(changed.status, 1, `${name}: unchanged caller must now fail`);
			assert.equal(changed.findings.length, 1);
			assert.match(changed.findings[0].message, /surfaces are defined by overlay elevation/u);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
