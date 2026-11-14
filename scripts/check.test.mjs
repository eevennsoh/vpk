import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	GUARD_SCRIPTS,
	changedFiles,
	firstMeaningfulLine,
	formatProblem,
	formatReport,
	guardFixCommand,
	inLintTargets,
	lintTargets,
	parseArgs,
	parseEslintJson,
	parseNodeTestFailures,
	parseTypecheckOutput,
	runGuards,
	runShell,
	PARALLEL_FROM_SUITES,
	runUnit,
} from "./check.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { scripts } = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));

test("verify:fast is the guard stage of check, and every guard is still its own script", () => {
	assert.equal(scripts["verify:fast"], "node scripts/check.mjs --guards");
	assert.equal(scripts.check, "node scripts/check.mjs");
	assert.match(scripts["ci:pr"], /'pnpm run verify:fast'/u);
	// The fifteen guards the old `&&` chain ran, in the same order, plus verify:asset-size
	// (C-1b) after verify:file-size and verify:unused-code (C-10) after the suppressions
	// ratchet; none may be dropped.
	assert.deepEqual(GUARD_SCRIPTS, [
		"verify:root-artifacts", "verify:url-credentials", "verify:route-manifest", "verify:api-surfaces", "verify:repo-map",
		"verify:vpk-feature-map", "verify:file-size", "verify:asset-size", "verify:catalog", "verify:lazy-load", "verify:source-guardrails",
		"verify:eslint-suppressions", "verify:unused-code", "verify:cursor-rules", "verify:doc-scripts", "validate:agents", "validate:skills",
	]);
	for (const name of GUARD_SCRIPTS) assert.equal(typeof scripts[name], "string", name);
	assert.ok(!GUARD_SCRIPTS.some((name) => /(?:^|&&\s*)pnpm\b/u.test(scripts[name])), "a guard that shells out to pnpm cannot run in the sandbox");
});

test("a seeded failure in every guard is reported in one run, not just the first", async () => {
	const started = [];
	const run = async (command) => {
		started.push(command);
		return { seconds: 0.1, status: 1, stderr: `$ ${command}\n${command} found a seeded violation\n`, stdout: "" };
	};
	const stage = await runGuards({ run, scripts });
	assert.equal(started.length, GUARD_SCRIPTS.length);
	assert.equal(stage.status, "failed");
	assert.equal(stage.label, `0/${GUARD_SCRIPTS.length} passed`);
	assert.deepEqual(stage.problems.map((problem) => problem.rule), GUARD_SCRIPTS);
	for (const problem of stage.problems) assert.match(problem.message, /found a seeded violation$/u);
	assert.equal(stage.details.length, GUARD_SCRIPTS.length);
});

test("guards run concurrently and a missing script fails instead of silently passing", async () => {
	let active = 0;
	let peak = 0;
	const run = async () => {
		active += 1;
		peak = Math.max(peak, active);
		await new Promise((resolve) => setImmediate(resolve));
		active -= 1;
		return { seconds: 0, status: 0, stderr: "", stdout: "" };
	};
	const stage = await runGuards({ run, scripts });
	assert.equal(peak, GUARD_SCRIPTS.length);
	assert.equal(stage.status, "passed");
	const missing = await runGuards({ run, scripts: { ...scripts, "verify:catalog": undefined } });
	assert.deepEqual(missing.problems.map((problem) => problem.rule), ["verify:catalog"]);
	assert.match(missing.problems[0].message, /no "verify:catalog" script/u);
});

test("runShell captures output and exit status and leaves no process behind", async () => {
	const result = await runShell(`${JSON.stringify(process.execPath)} -e "console.log('out'); console.error('err'); process.exit(3)"`);
	assert.equal(result.status, 3);
	assert.equal(result.stdout.trim(), "out");
	assert.equal(result.stderr.trim(), "err");
});

test("lint targets come from the lint script, so scoped and full lint cover the same paths", () => {
	const targets = lintTargets(scripts.lint);
	for (const target of ["app", "components", "backend", "scripts", "tests", "next.config.ts"]) assert.ok(targets.includes(target), target);
	assert.equal(targets.includes("--max-warnings"), false);
	assert.equal(targets.includes("0"), false);
	assert.equal(inLintTargets("components/ui/button.tsx", targets), true);
	assert.equal(inLintTargets("componentsx/a.ts", targets), false);
	assert.equal(inLintTargets(".agents/skills/x/a.js", targets), false);
});

test("problems are reported as file:line rule message fix-command", () => {
	const eslint = parseEslintJson(JSON.stringify([{ filePath: path.join(REPO_ROOT, "components/a.tsx"), messages: [
		{ fix: { range: [0, 1], text: "" }, line: 4, message: "Unexpected var", ruleId: "no-var" },
		{ fatal: true, line: 9, message: "Parsing error", ruleId: null },
	] }]));
	assert.deepEqual(eslint.map(formatProblem), [
		"components/a.tsx:4  no-var  Unexpected var  fix: pnpm exec eslint --fix components/a.tsx",
		"components/a.tsx:9  parse-error  Parsing error  fix: edit components/a.tsx",
	]);
	const types = parseTypecheckOutput("noise\napp/page.tsx(12,5): error TS2322: Type 'x' is not assignable.\n");
	assert.deepEqual(types.map(formatProblem), ["app/page.tsx:12  TS2322  Type 'x' is not assignable.  fix: pnpm run typecheck"]);
	const unit = parseNodeTestFailures(`test at ${path.join(REPO_ROOT, "lib/a.test.js")}:7:1\n✖ adds numbers (1.2ms)\n`);
	assert.deepEqual(unit.map(formatProblem), ["lib/a.test.js:7  node:test  adds numbers  fix: node scripts/run-js-unit-tests.mjs --file lib/a.test.js"]);
	assert.equal(guardFixCommand("verify:repo-map"), "pnpm run fix:generated (then rerun: pnpm run verify:repo-map)");
	assert.equal(guardFixCommand("verify:lazy-load"), "pnpm run verify:lazy-load");
	assert.match(guardFixCommand("verify:unused-code"), /use or delete .*knip\.jsonc `entry`.*pnpm run fix:generated --only unused-code$/u);
});

test("the summary line prefers the failing test or error over test-runner chatter", () => {
	assert.equal(firstMeaningfulLine("$ node --test x\nHealth check requested\n✖ removed APIs return 404 (3ms)\n✖ failing tests:\n"), "✖ removed APIs return 404 (3ms)");
	assert.equal(firstMeaningfulLine("$ node x\nFile-size budget failed:\n- a.ts: too long\n"), "File-size budget failed:");
	assert.equal(firstMeaningfulLine(""), "failed");
});

test("the report shows every stage, details and an overall verdict", () => {
	const report = {
		change: { base: "origin/main", files: ["a.ts"], importers: 2, mergeBase: "abcdef1234567" },
		mainHealth: "main health: green at abc",
		ok: false,
		seconds: 12.34,
		stages: [
			{ details: [{ text: "x\n".repeat(40), title: "verify:catalog" }], id: "guards", label: "14/15 passed", problems: [{ file: "-", fix: "pnpm run verify:catalog", line: null, message: "bad", rule: "verify:catalog" }], seconds: 7, status: "failed" },
			{ details: [], id: "unit", label: "no related suites", problems: [], seconds: 0, status: "skipped" },
		],
	};
	const text = formatReport(report);
	assert.match(text, /^main health: green at abc\ncheck: 1 changed files since origin\/main \(abcdef123\); 2 direct importers\n/u);
	assert.match(text, /guards {4}failed {2}14\/15 passed \(7\.0s\)/u);
	assert.match(text, /\nProblems:\n- {2}verify:catalog {2}bad {2}fix: pnpm run verify:catalog\n/u);
	assert.match(text, /check: FAILED \(1 problem\) in 12\.3s\n$/u);
	assert.equal(text.split("\n").filter((line) => line === "x").length, 25, "interactive details are trimmed");
	assert.equal(formatReport(report, { detailLines: Infinity }).split("\n").filter((line) => line === "x").length, 40);
});

test("changed files are the diff from the merge base plus untracked files", () => {
	const calls = [];
	const runGit = (args) => {
		calls.push(args.join(" "));
		if (args[0] === "merge-base") return "base123\n";
		if (args[0] === "diff") return "b.ts\na.ts\n";
		return "a.ts\nnew.ts\n";
	};
	assert.deepEqual(changedFiles({ base: "origin/main", runGit }), { files: ["a.ts", "b.ts", "new.ts"], mergeBase: "base123" });
	assert.deepEqual(calls, ["merge-base origin/main HEAD", "diff --name-only --no-renames base123", "ls-files --others --exclude-standard"]);
});

test("arguments", () => {
	assert.deepEqual(parseArgs([]), { base: "origin/main", deep: false, guardsOnly: false, json: false });
	assert.deepEqual(parseArgs(["--", "--guards", "--json", "--base", "HEAD~1"]), { base: "HEAD~1", deep: false, guardsOnly: true, json: true });
	assert.equal(parseArgs(["--", "--deep"]).deep, true);
	assert.throws(() => parseArgs(["--fast"]), /Unknown argument: --fast/u);
});

test("package gates follow verify:fast into check.mjs, so every guard counts as run by ci:pr", async () => {
	const { createRequire } = await import("node:module");
	const { gateRunsScript } = createRequire(import.meta.url)("./lib/package-gates.js");
	for (const gate of ["verify:fast", "ci:pr", "validate:local", "check"]) {
		for (const guard of GUARD_SCRIPTS) assert.equal(gateRunsScript(scripts, gate, guard), true, `${gate} → ${guard}`);
	}
	// Seeded: a gate that no longer reaches check.mjs runs none of the guards.
	const unhooked = { ...scripts, "verify:fast": "node scripts/other.mjs --guards" };
	assert.equal(gateRunsScript(unhooked, "ci:pr", "verify:catalog"), false);
	assert.equal(gateRunsScript({ x: "node scripts/check.mjsx" }, "x", "verify:catalog"), false);
});

test("the report names the deeper rendered and bundling suites it did not run, and is silent when there are none", () => {
	const base = {
		change: { base: "origin/main", deepNotRun: 12, files: ["components/ui/data/logo-data.ts"], importers: 2, mergeBase: "abcdef1234567" },
		ok: true,
		seconds: 30,
		stages: [{ details: [], id: "unit", label: "7 related suites", problems: [], seconds: 20, status: "passed" }],
	};
	assert.match(formatReport(base), /^unit {6}12 rendered or bundling suites depend on this change more deeply and were not run: pnpm run check -- --deep$/mu);
	assert.match(formatReport({ ...base, change: { ...base.change, deepNotRun: 1 } }), /1 rendered or bundling suite depend/u);
	assert.doesNotMatch(formatReport({ ...base, change: { ...base.change, deepNotRun: 0 } }), /more deeply/u);
});

test("--deep runs the deeper suites with the related ones, in parallel", async () => {
	const commands = [];
	const run = async (command) => {
		commands.push(command);
		return { seconds: 1, status: 0, stderr: "", stdout: "" };
	};
	const plain = await runUnit({ tests: ["a.test.js"], run });
	assert.equal(plain.label, "1 related suites");
	assert.doesNotMatch(commands[0], /--parallel/u);
	const deep = await runUnit({ tests: ["a.test.js"], deep: ["b.test.js", "a.test.js"], run });
	assert.equal(deep.label, "1 related + 2 deep suites");
	assert.match(commands[1], /^node scripts\/run-js-unit-tests\.mjs --keep-going --parallel auto --file 'a\.test\.js' --file 'b\.test\.js'$/u);
});

test("a large related selection runs in parallel; a small one runs one batch at a time", async () => {
	const commands = [];
	const run = async (command) => {
		commands.push(command);
		return { seconds: 1, status: 0, stderr: "", stdout: "" };
	};
	const suites = (count) => Array.from({ length: count }, (_, index) => `s${String(index).padStart(3, "0")}.test.js`);
	await runUnit({ tests: suites(PARALLEL_FROM_SUITES - 1), run });
	await runUnit({ tests: suites(PARALLEL_FROM_SUITES), run });
	assert.doesNotMatch(commands[0], /--parallel/u, "below the threshold");
	assert.match(commands[1], /^node scripts\/run-js-unit-tests\.mjs --keep-going --parallel auto /u, "at the threshold");
	assert.equal(PARALLEL_FROM_SUITES, 20);
});
