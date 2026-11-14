#!/usr/bin/env node

// `pnpm run check`: one "am I done?" command for a change. It runs, concurrently, every
// repository guard, ESLint on changed files and their direct importers, the full typecheck,
// and the unit suites related to the change, then prints one summary of every problem.
// `pnpm run verify:fast` is `check --guards`. `pnpm run ci:pr` stays the merge gate.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildReverseImports, directImporters, isSourceFile, isTestFile, selectRelatedTests } from "./lib/import-graph.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_HEALTH_SCRIPT = ".agents/skills/vpk-git-ship/scripts/main-health.js";
const MACHINE_STATE_SCRIPT = "scripts/machine-state.js";
const DETAIL_LINES = 25;

// The guard list lives in scripts/lib/guard-scripts.js so scripts/lib/package-gates.js can
// tell which gates reach a guard through check.mjs.
export const { GUARD_SCRIPTS } = createRequire(import.meta.url)("./lib/guard-scripts.js");
const { acquireHeavyRunLock } = createRequire(import.meta.url)("./lib/heavy-run-lock.js");
const { pressureReasons, readMemoryState } = createRequire(import.meta.url)("./lib/memory-pressure.js");

const GENERATED_GUARDS = new Set(["verify:route-manifest", "verify:api-surfaces", "verify:repo-map", "verify:cursor-rules", "validate:skills"]);

export function guardFixCommand(name) {
	if (GENERATED_GUARDS.has(name)) return "pnpm run fix:generated (then rerun: pnpm run " + name + ")";
	if (name === "verify:file-size") return "split the file; budgets only shrink";
	if (name === "verify:asset-size") return "resize or re-encode the asset; the baseline only shrinks";
	if (name === "verify:eslint-suppressions") return "fix the new violations; never suppress them";
	if (name === "verify:unused-code") return "use or delete the new unused file or dependency (a new entry point goes in knip.jsonc `entry`); after removing old entries: pnpm run fix:generated --only unused-code";
	return `pnpm run ${name}`;
}

const children = new Set();
export function killChildren(signal) {
	for (const child of children) {
		try { process.kill(-child.pid, signal); } catch { /* already gone */ }
	}
}

// How many runShell commands may run at once. Unlimited by default; one under memory pressure.
let shellSlots = Number.POSITIVE_INFINITY;
let shellsRunning = 0;
const shellQueue = [];

export function setShellConcurrency(limit) {
	shellSlots = limit;
}

async function takeShellSlot() {
	while (shellsRunning >= shellSlots) await new Promise((resolve) => shellQueue.push(resolve));
	shellsRunning += 1;
}

function freeShellSlot() {
	shellsRunning -= 1;
	shellQueue.shift()?.();
}

// Under memory pressure check and ci:pr run their commands one at a time and say so; returns
// the line that says so, or null.
export function serializeUnderPressure({ memory = readMemoryState(), name }) {
	const reasons = pressureReasons(memory);
	if (reasons.length === 0) return null;
	setShellConcurrency(1);
	return `${name}: memory pressure (${reasons.join("; ")}): running its commands one at a time`;
}

// Each command runs in its own process group so an interrupted check leaves nothing behind.
export async function runShell(command, { cwd = REPO_ROOT, env = process.env } = {}) {
	await takeShellSlot();
	try {
		return await spawnShell(command, { cwd, env });
	} finally {
		freeShellSlot();
	}
}

function spawnShell(command, { cwd, env }) {
	const started = performance.now();
	return new Promise((resolve) => {
		// Absolute path: a PATH lookup of `sh` fails with EPERM inside the agent sandbox.
		const child = spawn("/bin/sh", ["-c", command], { cwd, detached: true, env, stdio: ["ignore", "pipe", "pipe"] });
		children.add(child);
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => { stdout += chunk; });
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		const finish = (status) => {
			children.delete(child);
			resolve({ seconds: (performance.now() - started) / 1000, status, stderr, stdout });
		};
		child.on("error", (error) => { stderr += error.message; finish(1); });
		child.on("close", (status, signal) => finish(status ?? (signal ? 1 : 0)));
	});
}

function git(args) {
	const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || "").trim()}`);
	return result.stdout;
}

function lines(text) {
	return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function changedFiles({ base, runGit = git }) {
	const mergeBase = runGit(["merge-base", base, "HEAD"]).trim();
	const files = new Set([
		...lines(runGit(["diff", "--name-only", "--no-renames", mergeBase])),
		...lines(runGit(["ls-files", "--others", "--exclude-standard"])),
	]);
	return { files: [...files].sort(), mergeBase };
}

// Targets come from the `lint` script so the scoped run lints exactly what the full run does.
export function lintTargets(lintScript) {
	const words = lintScript.split(/\s+/u);
	return words.slice(words.indexOf("eslint") + 1).filter((word) => word && !word.startsWith("-") && !/^\d+$/u.test(word));
}

export function inLintTargets(file, targets) {
	return targets.some((target) => file === target || file.startsWith(`${target}/`));
}

// The line that says what failed: a node:test failure or error line when there is one,
// otherwise the first line that is not pnpm's own echo.
export function firstMeaningfulLine(text) {
	const all = lines(text).filter((line) => !line.startsWith("$ ") && !line.startsWith("[ELIFECYCLE]"));
	return all.find((line) => /^(?:✖ (?!failing tests)|not ok\b|\w*Error\b|ERROR\b)/u.test(line)) ?? all[0] ?? "failed";
}

function tail(text, count = DETAIL_LINES) {
	return text.trimEnd().split("\n").slice(-count).join("\n");
}

export async function runGuards({ scripts, run = runShell, env = process.env }) {
	const results = await Promise.all(GUARD_SCRIPTS.map(async (name) => {
		if (!scripts[name]) return { name, output: `package.json has no "${name}" script`, seconds: 0, status: 1 };
		const result = await run(scripts[name], { env });
		return { name, output: `${result.stdout}${result.stderr}`, seconds: result.seconds, status: result.status };
	}));
	const failing = results.filter((result) => result.status !== 0);
	return {
		details: failing.map((result) => ({ title: result.name, text: result.output })),
		id: "guards",
		label: `${results.length - failing.length}/${results.length} passed`,
		problems: failing.map((result) => ({
			file: "-",
			fix: guardFixCommand(result.name),
			line: null,
			message: firstMeaningfulLine(result.output),
			rule: result.name,
		})),
		seconds: Math.max(0, ...results.map((result) => result.seconds)),
		status: failing.length === 0 ? "passed" : "failed",
	};
}

export function parseEslintJson(stdout) {
	const problems = [];
	for (const file of JSON.parse(stdout || "[]")) {
		const relative = path.relative(REPO_ROOT, file.filePath);
		for (const message of file.messages) {
			problems.push({
				file: relative,
				fix: message.fix ? `pnpm exec eslint --fix ${relative}` : `edit ${relative}`,
				line: message.line ?? null,
				message: message.message,
				rule: message.ruleId ?? (message.fatal ? "parse-error" : "eslint"),
			});
		}
	}
	return problems;
}

async function runEslint({ files, run = runShell }) {
	if (files.length === 0) return { details: [], id: "eslint", label: "no lintable changes", problems: [], seconds: 0, status: "skipped" };
	const quoted = files.map((file) => `'${file.replaceAll("'", "'\\''")}'`).join(" ");
	const result = await run(`node_modules/.bin/eslint --format json --max-warnings 0 --no-warn-ignored ${quoted}`);
	let problems;
	try {
		problems = parseEslintJson(result.stdout);
	} catch {
		problems = [{ file: "-", fix: "pnpm run lint", line: null, message: firstMeaningfulLine(`${result.stderr}${result.stdout}`), rule: "eslint" }];
	}
	if (result.status !== 0 && problems.length === 0) {
		// Exit 1 with no messages: for example unpruned suppressions, reported on stderr.
		problems.push({ file: "-", fix: "pnpm run fix:generated --only eslint-suppressions", line: null, message: firstMeaningfulLine(result.stderr), rule: "eslint" });
	}
	return {
		details: result.status === 0 ? [] : [{ title: "eslint", text: result.stderr }].filter((detail) => detail.text.trim()),
		id: "eslint",
		label: `${files.length} files`,
		problems,
		seconds: result.seconds,
		status: result.status === 0 ? "passed" : "failed",
	};
}

const TSC_ERROR = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/u;

export function parseTypecheckOutput(output) {
	return lines(output).flatMap((line) => {
		const match = TSC_ERROR.exec(line);
		return match ? [{ file: match[1], fix: "pnpm run typecheck", line: Number(match[2]), message: match[4], rule: match[3] }] : [];
	});
}

async function runTypecheck({ scripts, run = runShell }) {
	const result = await run(scripts.typecheck);
	const output = `${result.stdout}${result.stderr}`;
	const problems = parseTypecheckOutput(output);
	if (result.status !== 0 && problems.length === 0) {
		problems.push({ file: "-", fix: "pnpm run typecheck", line: null, message: firstMeaningfulLine(output), rule: "typecheck" });
	}
	return {
		details: result.status === 0 ? [] : [{ title: "typecheck", text: output }],
		id: "typecheck",
		label: "full project",
		problems,
		seconds: result.seconds,
		status: result.status === 0 ? "passed" : "failed",
	};
}

const TEST_LOCATION = /^test at (.+?):(\d+):\d+$/u;

export function parseNodeTestFailures(output) {
	const problems = [];
	const all = output.split("\n");
	for (let index = 0; index < all.length; index += 1) {
		const match = TEST_LOCATION.exec(all[index].trim());
		if (!match) continue;
		const file = path.isAbsolute(match[1]) ? path.relative(REPO_ROOT, match[1]) : match[1];
		const name = (all[index + 1] ?? "").trim().replace(/^✖\s*/u, "").replace(/\s*\([\d.]+m?s\)$/u, "");
		problems.push({ file, fix: `node scripts/run-js-unit-tests.mjs --file ${file}`, line: Number(match[2]), message: name || "test failed", rule: "node:test" });
	}
	return problems;
}

async function runUnit({ tests, run = runShell }) {
	if (tests.length === 0) return { details: [], id: "unit", label: "no related suites", problems: [], seconds: 0, status: "skipped" };
	const result = await run(`node scripts/run-js-unit-tests.mjs --keep-going ${tests.map((file) => `--file '${file}'`).join(" ")}`);
	const output = `${result.stdout}${result.stderr}`;
	const problems = result.status === 0 ? [] : parseNodeTestFailures(output);
	if (result.status !== 0 && problems.length === 0) {
		problems.push({ file: "-", fix: "node scripts/run-js-unit-tests.mjs", line: null, message: firstMeaningfulLine(output), rule: "unit" });
	}
	return {
		details: result.status === 0 ? [] : [{ title: "unit", text: output }],
		id: "unit",
		label: `${tests.length} related suites`,
		problems,
		seconds: result.seconds,
		status: result.status === 0 ? "passed" : "failed",
	};
}

async function readMainHealth(run = runShell) {
	if (!existsSync(path.join(REPO_ROOT, MAIN_HEALTH_SCRIPT))) return null;
	const result = await run(`node ${MAIN_HEALTH_SCRIPT}`);
	return lines(result.stdout)[0] ?? null;
}

// One line on swap, dev stacks and pressure (scripts/lib/machine-state.js), beside main health.
async function readMachineState(run = runShell) {
	if (!existsSync(path.join(REPO_ROOT, MACHINE_STATE_SCRIPT))) return null;
	const result = await run(`node ${MACHINE_STATE_SCRIPT} --brief`);
	return lines(result.stdout)[0] ?? null;
}

async function includedTests(tests) {
	// The default unit run's own inclusion rules decide; skipped and legacy-drift suites stay out.
	const { getTestFileInclusion } = await import("./run-js-unit-tests.mjs");
	return tests.filter((file) => existsSync(path.join(REPO_ROOT, file)) && getTestFileInclusion(file).included);
}

export function selectChange({ changed, tracked, readSource, targets }) {
	const existing = changed.filter((file) => existsSync(path.join(REPO_ROOT, file)));
	const universe = [...new Set([...tracked, ...existing])];
	const importersOf = buildReverseImports(universe, readSource);
	const importers = [...directImporters(changed, importersOf)].filter((file) => !changed.includes(file));
	const lintFiles = [...new Set([...existing, ...importers])]
		.filter((file) => isSourceFile(file) && inLintTargets(file, targets) && existsSync(path.join(REPO_ROOT, file)))
		.sort();
	const tests = selectRelatedTests({ changed, importersOf, readSource, testFiles: universe.filter(isTestFile) });
	return { importers, lintFiles, tests };
}

export function formatProblem(problem) {
	const location = problem.file === "-" ? "-" : `${problem.file}${problem.line ? `:${problem.line}` : ""}`;
	return `${location}  ${problem.rule}  ${problem.message}  fix: ${problem.fix}`;
}

export function formatReport(report, { detailLines = DETAIL_LINES } = {}) {
	const out = [];
	if (report.mainHealth) out.push(report.mainHealth);
	if (report.machineState) out.push(report.machineState);
	if (report.change) {
		out.push(`check: ${report.change.files.length} changed files since ${report.change.base} (${report.change.mergeBase.slice(0, 9)}); ` +
			`${report.change.importers} direct importers`);
	}
	for (const stage of report.stages) {
		out.push(`${stage.id.padEnd(10)}${stage.status.padEnd(8)}${stage.label}${stage.seconds ? ` (${stage.seconds.toFixed(1)}s)` : ""}`);
	}
	const problems = report.stages.flatMap((stage) => stage.problems);
	for (const detail of report.stages.flatMap((stage) => stage.details)) {
		out.push("", `--- ${detail.title} ---`, tail(detail.text, detailLines));
	}
	if (problems.length > 0) out.push("", "Problems:", ...problems.map(formatProblem));
	out.push("", `check: ${report.ok ? "passed" : `FAILED (${problems.length} problem${problems.length === 1 ? "" : "s"})`} in ${report.seconds.toFixed(1)}s`);
	return `${out.join("\n")}\n`;
}

export function parseArgs(argv) {
	const options = { base: "origin/main", guardsOnly: false, json: false };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--") continue;
		if (argument === "--guards") options.guardsOnly = true;
		else if (argument === "--json") options.json = true;
		else if (argument === "--base") {
			options.base = argv[index + 1];
			if (!options.base) throw new Error("--base requires a ref");
			index += 1;
		} else throw new Error(`Unknown argument: ${argument}\nUsage: check.mjs [--guards] [--json] [--base <ref>]`);
	}
	return options;
}

export async function runCheck({ base = "origin/main", guardsOnly = false, env = process.env } = {}) {
	const started = performance.now();
	const { scripts } = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
	if (guardsOnly) {
		const guards = await runGuards({ env, scripts });
		return { ok: guards.status !== "failed", seconds: (performance.now() - started) / 1000, stages: [guards] };
	}
	const healthPromise = env.CI ? Promise.resolve(null) : readMainHealth();
	const machinePromise = env.CI ? Promise.resolve(null) : readMachineState();
	const guardsPromise = runGuards({ env, scripts });
	const typecheckPromise = runTypecheck({ scripts });
	const { files, mergeBase } = changedFiles({ base });
	const tracked = lines(git(["ls-files"]));
	const readSource = (file) => readFileSync(path.join(REPO_ROOT, file), "utf8");
	const selection = selectChange({ changed: files, readSource, targets: lintTargets(scripts.lint), tracked });
	const tests = await includedTests(selection.tests);
	const [mainHealth, machineState, guards, eslint, typecheck, unit] = await Promise.all([
		healthPromise, machinePromise, guardsPromise, runEslint({ files: selection.lintFiles }), typecheckPromise, runUnit({ tests }),
	]);
	const stages = [guards, eslint, typecheck, unit];
	return {
		change: { base, files, importers: selection.importers.length, mergeBase },
		machineState,
		mainHealth,
		ok: stages.every((stage) => stage.status !== "failed"),
		seconds: (performance.now() - started) / 1000,
		stages,
	};
}

async function main() {
	for (const signal of ["SIGINT", "SIGTERM"]) {
		process.once(signal, () => {
			killChildren(signal);
			process.exit(130);
		});
	}
	const options = parseArgs(process.argv.slice(2));
	// The full check is a heavy run: take the machine-wide turn (a no-op in CI) and, under memory
	// pressure, run its commands one at a time. Guards alone are light and run as before.
	let lock = null;
	if (!options.guardsOnly) {
		const serial = serializeUnderPressure({ name: "check" });
		if (serial) process.stderr.write(`${serial}\n`);
		lock = await acquireHeavyRunLock({ label: "pnpm run check" });
	}
	let report;
	try {
		report = await runCheck(options);
	} finally {
		lock?.release();
	}
	// CI logs show a failing guard's whole output; interactive runs keep the summary short.
	process.stdout.write(options.json ? `${JSON.stringify(report, null, "\t")}\n`
		: formatReport(report, { detailLines: options.guardsOnly ? Infinity : DETAIL_LINES }));
	process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 2;
	});
}
