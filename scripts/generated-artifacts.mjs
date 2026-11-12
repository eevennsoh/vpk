#!/usr/bin/env node

// One registry for every checked-in file a script regenerates, with the command that
// regenerates it and the command that proves it is current. `generated:status` runs the
// checkers; `fix:generated` regenerates what is stale. On a merge conflict in one of these
// files, take either side and run `pnpm run fix:generated`.

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NODE = process.execPath;

// Order matters: an entry may read the artifacts of entries above it, so `fix` regenerates
// top to bottom and each checker sees its inputs already fixed. `slow` entries run only with
// --all. Baselines that may only shrink by fixing code (scripts/file-size-allowlist.json,
// scripts/js-unit-test-legacy-drift.mjs) are deliberately absent: regenerating them would
// accept new debt. The suppressions entry is present because ESLint's prune only removes.
export const GENERATED_ARTIFACTS = [
	{
		id: "route-manifest",
		paths: ["backend/routes/route-manifest.json"],
		generate: [NODE, "backend/routes/route-manifest.js", "--update"],
		check: [NODE, "backend/routes/route-manifest.js"],
	},
	{
		id: "api-surfaces",
		paths: [".agents/knowledge/api-surfaces.md"],
		generate: [NODE, "scripts/generate-api-surfaces.js"],
		check: [NODE, "scripts/generate-api-surfaces.js", "--check"],
	},
	{
		id: "cursor-rules",
		paths: [".agents/rules/cursor/*.mdc"],
		generate: [NODE, "scripts/generate-cursor-rules.js"],
		check: [NODE, "scripts/generate-cursor-rules.js", "--check"],
	},
	{
		id: "skills-index",
		paths: [".agents/skills/INDEX.md"],
		generate: [NODE, "scripts/validate-skills.js", "--update-index"],
		check: [NODE, "scripts/validate-skills.js"],
	},
	{
		id: "repo-map",
		paths: [".agents/knowledge/repo-map.json"],
		generate: [NODE, "scripts/generate-repo-map.js"],
		check: [NODE, "scripts/generate-repo-map.js", "--check"],
	},
	{
		id: "pnpm-lockfile",
		paths: ["pnpm-lock.yaml"],
		// pnpm also resolves git conflict markers in the lockfile during this install.
		generate: ["pnpm", "install", "--lockfile-only", "--ignore-scripts"],
		check: ["pnpm", "install", "--frozen-lockfile", "--lockfile-only", "--ignore-scripts"],
	},
	{
		id: "eslint-suppressions",
		paths: ["eslint-suppressions.json"],
		slow: true,
		// Prune only removes entries whose violations are gone, so the baseline can only shrink.
		// No `--`: pnpm forwards it to ESLint, which would read the flag as a file name.
		generate: ["pnpm", "run", "lint", "--prune-suppressions"],
		check: ["pnpm", "run", "lint"],
	},
];

function commandText(command) {
	return command.map((part) => (part === NODE ? "node" : part)).join(" ");
}

export function runCommand(command, { cwd = REPO_ROOT, env = process.env } = {}) {
	return new Promise((resolve) => {
		const child = spawn(command[0], command.slice(1), { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		child.stdout.on("data", (chunk) => { output += chunk; });
		child.stderr.on("data", (chunk) => { output += chunk; });
		child.on("error", (error) => resolve({ output: `${output}${error.message}\n`, status: 1 }));
		child.on("close", (status, signal) => resolve({ output, status: status ?? (signal ? 1 : 0) }));
	});
}

// Expands the registry's `dir/*.ext` patterns; other paths are literal.
export function artifactFiles(paths, cwd = REPO_ROOT) {
	return paths.flatMap((pattern) => {
		const match = /^(.*)\/\*(\.[^/]+)$/u.exec(pattern);
		if (!match) return [pattern];
		const dir = path.join(cwd, match[1]);
		return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(match[2])).sort().map((name) => `${match[1]}/${name}`) : [];
	});
}

// Some checkers compare only a generated section, so a conflict left in a hand-written
// part would pass them. Markers anywhere in a registered file make it stale.
export function conflictedFiles(paths, cwd = REPO_ROOT) {
	return artifactFiles(paths, cwd).filter((file) => {
		const absolute = path.join(cwd, file);
		return existsSync(absolute) && /^(?:<{7}|>{7})(?: |$)/mu.test(readFileSync(absolute, "utf8"));
	});
}

async function checkEntry(entry, { cwd, run }) {
	const conflicted = conflictedFiles(entry.paths, cwd);
	const result = await run(entry.check, { cwd });
	if (conflicted.length === 0) return result;
	return { output: `${result.output}conflict markers in ${conflicted.join(", ")}\n`, status: result.status || 1 };
}

function selectEntries(registry, { all = false, only = [] } = {}) {
	const unknown = only.filter((id) => !registry.some((entry) => entry.id === id));
	if (unknown.length > 0) throw new Error(`Unknown generated artifact: ${unknown.join(", ")}`);
	return registry.filter((entry) => (only.length > 0 ? only.includes(entry.id) : all || !entry.slow));
}

function lastLines(text, count = 6) {
	return text.trim().split("\n").slice(-count).join("\n");
}

// Checkers only read, so they run concurrently.
export async function collectStatus({ registry = GENERATED_ARTIFACTS, all = false, only = [], run = runCommand, cwd = REPO_ROOT } = {}) {
	const entries = selectEntries(registry, { all, only });
	const results = await Promise.all(entries.map(async (entry) => {
		const { output, status } = await checkEntry(entry, { cwd, run });
		return {
			check: commandText(entry.check),
			generate: commandText(entry.generate),
			id: entry.id,
			output: status === 0 ? "" : lastLines(output),
			paths: entry.paths,
			slow: Boolean(entry.slow),
			state: status === 0 ? "current" : "stale",
		};
	}));
	const skipped = registry.filter((entry) => !entries.includes(entry)).map((entry) => entry.id);
	return { ok: results.every((result) => result.state === "current"), results, skipped };
}

// Serial and in registry order: a regenerated input must land before its dependants are
// checked. Only stale entries are regenerated, so a current tree is left untouched.
export async function fixGenerated({ registry = GENERATED_ARTIFACTS, all = false, only = [], run = runCommand, cwd = REPO_ROOT, log = () => {} } = {}) {
	const entries = selectEntries(registry, { all, only });
	const results = [];
	for (const entry of entries) {
		const before = await checkEntry(entry, { cwd, run });
		if (before.status === 0) {
			results.push({ id: entry.id, state: "current" });
			continue;
		}
		log(`${entry.id}: stale, running ${commandText(entry.generate)}`);
		const generated = await run(entry.generate, { cwd });
		const after = generated.status === 0 ? await checkEntry(entry, { cwd, run }) : generated;
		results.push({
			id: entry.id,
			output: after.status === 0 ? "" : lastLines(after.output),
			state: after.status === 0 ? "regenerated" : "failing",
		});
	}
	return { ok: results.every((result) => result.state !== "failing"), results };
}

export function formatStatus(status) {
	const stale = status.results.filter((result) => result.state !== "current");
	const lines = [`generated: ${status.results.length - stale.length} current, ${stale.length} stale` +
		(status.skipped.length > 0 ? ` (skipped slow: ${status.skipped.join(", ")}; add --all)` : "")];
	for (const result of stale) {
		lines.push(`  stale ${result.id}  ${result.paths.join(", ")}  fix: pnpm run fix:generated --only ${result.id}`);
		if (result.output) lines.push(result.output.split("\n").map((line) => `    ${line}`).join("\n"));
	}
	return `${lines.join("\n")}\n`;
}

export function formatFix(result) {
	const lines = result.results.map((entry) => `  ${entry.state.padEnd(11)} ${entry.id}` +
		(entry.output ? `\n${entry.output.split("\n").map((line) => `    ${line}`).join("\n")}` : ""));
	const failing = result.results.filter((entry) => entry.state === "failing").map((entry) => entry.id);
	const summary = failing.length > 0
		? `fix:generated: ${failing.join(", ")} still failing after regeneration; the checker reports a problem the generator cannot fix`
		: "fix:generated: all selected generated files are current";
	return `${[summary, ...lines].join("\n")}\n`;
}

export function parseArgs(argv) {
	const [mode, ...rest] = argv;
	if (!["status", "fix"].includes(mode)) throw new Error("Usage: generated-artifacts.mjs <status|fix> [--all] [--json] [--only <id>]...");
	const options = { all: false, json: false, mode, only: [] };
	for (let index = 0; index < rest.length; index += 1) {
		const argument = rest[index];
		// pnpm forwards a literal `--` from `pnpm run fix:generated -- --all`.
		if (argument === "--") continue;
		if (argument === "--all") options.all = true;
		else if (argument === "--json") options.json = true;
		else if (argument === "--only") {
			const value = rest[index + 1];
			if (!value) throw new Error("--only requires an artifact id");
			options.only.push(value);
			index += 1;
		} else throw new Error(`Unknown argument: ${argument}`);
	}
	return options;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.mode === "status") {
		const status = await collectStatus(options);
		process.stdout.write(options.json ? `${JSON.stringify(status, null, "\t")}\n` : formatStatus(status));
		process.exitCode = status.ok ? 0 : 1;
		return;
	}
	const result = await fixGenerated({ ...options, log: options.json ? () => {} : (line) => process.stderr.write(`${line}\n`) });
	process.stdout.write(options.json ? `${JSON.stringify(result, null, "\t")}\n` : formatFix(result));
	process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 2;
	});
}
