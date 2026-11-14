const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflow = readFileSync(path.join(__dirname, "../.github/workflows/ci.yml"), "utf8");
const jobs = Object.fromEntries([...workflow.split("\njobs:\n")[1].matchAll(/^  (\w+):\n([\s\S]*?)(?=^  \w+:\n|$(?![\s\S]))/gmu)]
	.map((match) => [match[1], match[2]]));

test("CI covers every local PR gate through independent static and four unit jobs", () => {
	assert.deepEqual(Object.keys(jobs), ["static", "unit", "smoke", "perf", "aggregate"]);
	assert.match(jobs.unit, /fail-fast: false/u);
	assert.match(jobs.unit, /max-parallel: 4/u);
	assert.match(jobs.unit, /shard: \[1, 2, 3, 4\]/u);
	assert.match(jobs.unit, /pnpm run test:unit:js --shard "\$\{\{ matrix.shard \}\}\/4"/u);
	assert.doesNotMatch(jobs.unit + jobs.static, /needs:|continue-on-error:|--prefix|--file/u);
	// ci:pr runs its stages concurrently through run-parallel.mjs; each stage's script must run in CI.
	const ciPr = require("../package.json").scripts["ci:pr"];
	assert.match(ciPr, /^node scripts\/run-parallel\.mjs /u);
	const gates = [...ciPr.matchAll(/'pnpm run ([\w:.-]+)[^']*'/gu)].map((match) => match[1]);
	assert.deepEqual(gates, ["verify:fast", "lint", "typecheck", "test:unit:js"]);
	for (const name of gates) {
		assert.ok((jobs.static + jobs.unit).includes(`run: time pnpm run ${name}`), `Missing CI gate: ${name}`);
	}
});

test("PR checks always evaluates and rejects failure, cancelled, skipped and missing dependencies", () => {
	assert.match(jobs.aggregate, /name: PR checks\n/u);
	assert.match(jobs.aggregate, /if: \$\{\{ always\(\) \}\}/u);
	assert.match(jobs.aggregate, /needs: \[static, unit, smoke\]/u);
	assert.match(jobs.aggregate, /STATIC_RESULT: \$\{\{ needs.static.result \}\}/u);
	assert.match(jobs.aggregate, /UNIT_RESULT: \$\{\{ needs.unit.result \}\}/u);
	assert.match(jobs.aggregate, /SMOKE_RESULT: \$\{\{ needs.smoke.result \}\}/u);
	const script = jobs.aggregate.split("        run: |\n")[1].replace(/^          /gmu, "");
	const results = ["success", "failure", "cancelled", "skipped", ""];
	for (const staticResult of results) {
		for (const unitResult of results) {
			for (const smokeResult of results) {
				const result = spawnSync("bash", ["-e", "-c", script], {
					env: { ...process.env, SMOKE_RESULT: smokeResult, STATIC_RESULT: staticResult, UNIT_RESULT: unitResult },
				});
				assert.equal(result.status === 0, staticResult === "success" && unitResult === "success" && smokeResult === "success");
			}
		}
	}
});

// Evaluates the `${{ }}` expressions the concurrency block uses: context paths, string literals,
// ==, && and || (GitHub's short-circuit semantics, returning the deciding operand).
function evaluateExpression(source, context) {
	const tokens = source.match(/'[^']*'|==|&&|\|\||[\w.]+/gu);
	let index = 0;
	const operand = () => {
		const token = tokens[index++];
		if (token.startsWith("'")) return token.slice(1, -1);
		return token.split(".").reduce((value, key) => value?.[key], context) ?? "";
	};
	const equality = () => {
		const left = operand();
		if (tokens[index] !== "==") return left;
		index += 1;
		return left === operand();
	};
	const and = () => {
		let value = equality();
		while (tokens[index] === "&&") {
			index += 1;
			const right = equality();
			value = value ? right : value;
		}
		return value;
	};
	let value = and();
	while (tokens[index] === "||") {
		index += 1;
		const right = and();
		value = value || right;
	}
	return value;
}

function concurrencyFor(context) {
	const block = workflow.match(/^concurrency:\n((?: {2}.*\n)+)/mu)[1];
	const field = (name) => block.match(new RegExp(`^  ${name}: (.*)$`, "mu"))[1];
	const render = (text) => text.replace(/\$\{\{ (.*?) \}\}/gu, (_, expression) => String(evaluateExpression(expression, context)));
	return { cancel: render(field("cancel-in-progress")) === "true", group: render(field("group")) };
}

test("only pull-request runs cancel a superseded run; every main push and dispatch runs to completion", () => {
	const pr = (number, sha) => ({ github: { event_name: "pull_request", ref: `refs/pull/${number}/merge`, sha, workflow: "CI" } });
	const main = (sha) => ({ github: { event_name: "push", ref: "refs/heads/main", sha, workflow: "CI" } });
	const dispatch = (ref, sha) => ({ github: { event_name: "workflow_dispatch", ref, sha, workflow: "CI" } });
	// A pull request's newer push replaces its older run, and only that pull request's.
	assert.deepEqual(concurrencyFor(pr(7, "a1")), { cancel: true, group: "ci-CI-refs/pull/7/merge" });
	assert.equal(concurrencyFor(pr(7, "a2")).group, concurrencyFor(pr(7, "a1")).group);
	assert.notEqual(concurrencyFor(pr(8, "a1")).group, concurrencyFor(pr(7, "a1")).group);
	// Pushes to main never cancel or queue behind each other, and never share a pull request's group.
	assert.deepEqual(concurrencyFor(main("b1")), { cancel: false, group: "ci-CI-b1" });
	assert.notEqual(concurrencyFor(main("b2")).group, concurrencyFor(main("b1")).group);
	assert.notEqual(concurrencyFor(main("b1")).group, concurrencyFor(pr(7, "b1")).group);
	// A manual dispatch runs to completion too.
	assert.deepEqual(concurrencyFor(dispatch("refs/heads/main", "c1")), { cancel: false, group: "ci-CI-c1" });
});

test("CI retains event coverage, cancellation, ratchets and authenticated frozen setup", () => {
	assert.match(workflow, /pull_request:/u);
	assert.match(workflow, /push:\n    branches: \[main\]/u);
	assert.match(workflow, /workflow_dispatch:/u);
	assert.match(workflow, /permissions:\n  contents: read/u);
	for (const job of [jobs.static, jobs.unit, jobs.smoke, jobs.perf]) {
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
	// The ratchets compare a pull request's merge commit with its first parent (resolveBaseRef).
	for (const job of [jobs.static, jobs.unit]) {
		assert.match(job, /uses: actions\/checkout@v\d+\n\s+with:\n(?:\s+#.*\n)*\s+fetch-depth: 2\n/u);
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

// The smoke job serves the production backend with its default origin allowlist; browsing at an
// origin outside that list gets every same-origin API POST rejected (a 500), so the two must agree.
test("the smoke job browses at an origin the production backend allows by default", () => {
	const { DEFAULT_ALLOWED_ORIGINS } = require("../backend/middleware/security.js");
	const smoke = stepsFor(jobs.smoke).find((step) => step.name === "Smoke specs");
	const origin = new URL(smoke.env.PLAYWRIGHT_BASE_URL).origin;
	assert.ok(DEFAULT_ALLOWED_ORIGINS.includes(origin), `${origin} is not in DEFAULT_ALLOWED_ORIGINS (${DEFAULT_ALLOWED_ORIGINS.join(", ")})`);
	assert.doesNotMatch(jobs.smoke, /ALLOWED_ORIGINS/u, "the job relies on the backend's defaults, not an override");
	assert.equal(new URL(smoke.env.PLAYWRIGHT_BASE_URL).port, "8080", "the job serves on 8080");
});

test("the browser smoke job serves a production build and runs only the @smoke suite", () => {
	const steps = stepsFor(jobs.smoke);
	const order = ["Install dependencies", "Build the static export", "Serve the production build", "Install Chromium", "Smoke specs"];
	assert.deepEqual(steps.map((step) => step.name).filter((name) => order.includes(name)), order);
	assert.match(jobs.smoke, /run: time pnpm run build:export/u);
	assert.match(jobs.smoke, /cp -R out backend\/public/u);
	assert.match(jobs.smoke, /VPK_RUNTIME_ADMIN_TOKEN="\$\(openssl rand -hex 32\)" NODE_ENV=production PORT=8080 nohup node backend\/server.js/u, "a throwaway admin token, generated in the step");
	assert.doesNotMatch(jobs.smoke, /secrets\.VPK_RUNTIME_ADMIN_TOKEN/u);
	assert.match(jobs.smoke, /server_pid=\$!/u);
	assert.match(jobs.smoke, /kill -0 "\$server_pid"/u, "stops waiting once the server has exited");
	assert.match(jobs.smoke, /curl -fsS http:\/\/127\.0\.0\.1:8080\/api\/health/u);
	const smoke = steps.find((step) => step.name === "Smoke specs");
	assert.equal(smoke.run, "time pnpm run test:e2e:smoke");
	assert.equal(smoke.env.PLAYWRIGHT_BASE_URL, "http://localhost:8080");
	assert.equal(require("../package.json").scripts["test:e2e:smoke"], "node scripts/run-playwright-smoke.mjs");
	assert.doesNotMatch(workflow, /pull_request_target/u);
});

test("the perf job checks route byte budgets on pushes to main, never on PRs", () => {
	assert.match(jobs.perf, /if: \$\{\{ github.event_name != 'pull_request' \}\}/u);
	assert.doesNotMatch(jobs.aggregate, /needs: \[[^\]]*perf/u, "PRs must not wait for the perf job");
	assert.match(jobs.perf, /set -o pipefail\n\s+time pnpm run build 2>&1 \| tee output\/perf-build\.log/u);
	assert.match(jobs.perf, /node scripts\/collect-perf-baseline\.js --input output\/perf-build\.log\n\s+node scripts\/collect-route-transfer\.mjs --base-url http:\/\/127\.0\.0\.1:3100 --runs 3\n\s+node scripts\/verify-perf-baseline-budget\.js --require-fetched/u);
	assert.match(jobs.perf, /nohup pnpm exec next start -p 3100 -H 127\.0\.0\.1/u, "the fetched metric loads the build that was just measured");
	assert.match(jobs.perf, /pnpm exec playwright install --with-deps chromium/u);
	assert.doesNotMatch(jobs.perf, /--warn-only/u);
});
