#!/usr/bin/env node

// Runs each argument as a shell command concurrently and prints every command's output as
// one block when it finishes, then a summary. Exits non-zero if any command failed; no
// command is skipped because another failed. `pnpm run ci:pr` uses it so the gate takes
// as long as its slowest stage, not the sum of them.

import { fileURLToPath } from "node:url";
import path from "node:path";

import { killChildren, runShell } from "./check.mjs";

export async function runParallel(commands, { run = runShell, write = (text) => process.stdout.write(text) } = {}) {
	if (commands.length === 0) throw new Error("Usage: run-parallel.mjs '<command>' ['<command>' ...]");
	const started = performance.now();
	const results = await Promise.all(commands.map(async (command) => {
		const result = await run(command);
		write(`\n=== ${command} (exit ${result.status}, ${result.seconds.toFixed(1)}s) ===\n${result.stdout}${result.stderr}`);
		return { command, seconds: result.seconds, status: result.status };
	}));
	const failed = results.filter((result) => result.status !== 0);
	write([
		"",
		"=== summary ===",
		...results.map((result) => `${result.status === 0 ? "ok  " : "FAIL"} ${result.seconds.toFixed(1).padStart(6)}s  ${result.command}`),
		`${failed.length === 0 ? "all passed" : `${failed.length} failed`} in ${((performance.now() - started) / 1000).toFixed(1)}s`,
		"",
	].join("\n"));
	return { results, status: failed.length === 0 ? 0 : 1 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	for (const signal of ["SIGINT", "SIGTERM"]) {
		process.once(signal, () => {
			killChildren(signal);
			process.exit(130);
		});
	}
	runParallel(process.argv.slice(2).filter((argument) => argument !== "--")).then(
		({ status }) => { process.exitCode = status; },
		(error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2; },
	);
}
