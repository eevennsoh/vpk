#!/usr/bin/env node

// Runs the browser smoke suite: the tests tagged @smoke. Playwright loads every spec file it
// is given before running any test, and one spec that fails to load aborts the whole run,
// so this passes Playwright only the files that tag a smoke test.

import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SMOKE_TAG = "@smoke";
const TAG_PATTERN = /\btag:\s*(?:"@smoke"|\[[^\]]*"@smoke"[^\]]*\])/u;

export function isSmokeSpec(source) {
	return TAG_PATTERN.test(source);
}

export function selectSmokeSpecs(files, readSource) {
	return files.filter((file) => file.endsWith(".spec.ts") && isSmokeSpec(readSource(file))).sort();
}

// A plain git pathspec lets `*` cross `/` but needs the `/` after `**`, so `tests/**/*.spec.ts`
// misses specs directly under tests/. Glob magic makes `**/` match zero or more directories.
export function trackedSpecs(cwd = REPO_ROOT) {
	return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", ":(glob)tests/**/*.spec.ts"], { cwd, encoding: "utf8" })
		.split("\n").filter(Boolean);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const specs = selectSmokeSpecs(trackedSpecs(), (file) => readFileSync(path.join(REPO_ROOT, file), "utf8"));
	if (specs.length === 0) {
		process.stderr.write("No spec tags a @smoke test.\n");
		process.exit(1);
	}
	process.stdout.write(`playwright smoke: ${specs.length} spec files\n`);
	const extra = process.argv.slice(2).filter((argument) => argument !== "--");
	const child = spawn(path.join(REPO_ROOT, "node_modules/.bin/playwright"), ["test", "--grep", SMOKE_TAG, ...specs, ...extra], { cwd: REPO_ROOT, stdio: "inherit" });
	for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
	child.on("close", (status, signal) => { process.exitCode = status ?? (signal ? 1 : 0); });
}
