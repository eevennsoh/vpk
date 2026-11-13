import { spawn as spawnChild, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { availableParallelism } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LEGACY_DRIFT_TEST_FILES } from "./js-unit-test-legacy-drift.mjs";
import { SKIPPED_TEST_FILES, SKIPPED_TEST_PREFIXES } from "./js-unit-test-skipped.mjs";

// Every node:test file runs by default; nothing has to be registered. Classification
// comes from the file name and only describes the suite:
//   *.source.test.*   source-contract (asserts on source text)
//   *.behavior.test.* behavior (renders or drives the real thing)
//   anything else     unit
// The only lists are what does NOT run: SKIPPED_TEST_FILES / SKIPPED_TEST_PREFIXES, each
// with a reason, and LEGACY_DRIFT_PATH, a frozen baseline that may only shrink.

const COMPONENT_TEST_PREFIX = "components/";
const LEGACY_DRIFT_PATH = "scripts/js-unit-test-legacy-drift.mjs";
const SKIPPED_PATH = "scripts/js-unit-test-skipped.mjs";
// Lets a module a suite loads directly use the app's `@/` alias and extensionless imports.
export const ALIAS_HOOK_PATH = fileURLToPath(new URL("./lib/register-alias-hook.mjs", import.meta.url));
const ALIAS_HOOK_ARGS = ["--import", ALIAS_HOOK_PATH];
const COMPONENT_TEST_REPORT_PREFIX = "JS_UNIT_COMPONENT_TEST_REPORT";
const COMPONENT_TEST_REPORT_MAX_LINE_BYTES = 60 * 1024;
const COMPONENT_TEST_REPORT_CHUNK_PREFIX_RESERVE_BYTES = 32;
const VM_MODULE_TEST_MARKERS = [
	"vm.SyntheticModule",
	"vm.SourceTextModule",
];
const BATCH_TIMINGS = JSON.parse(readFileSync(new URL("./js-unit-test-timings.json", import.meta.url), "utf8")).batches;
export const UNIT_SHARD_COUNT = 4;

const LEGACY_DRIFT_TEST_FILE_SET = new Set(LEGACY_DRIFT_TEST_FILES);
const SKIPPED_TEST_FILE_SET = new Set(Object.keys(SKIPPED_TEST_FILES));
const SKIPPED_TEST_PREFIX_LIST = Object.keys(SKIPPED_TEST_PREFIXES);

export function classifyTestFile(filePath) {
	if (/\.source\.test\.[^./]+$/u.test(filePath)) return "source-contract";
	if (/\.behavior\.test\.[^./]+$/u.test(filePath)) return "behavior";
	return "unit";
}

function isComponentNodeTestEntry(entry) {
	return entry.filePath.startsWith(COMPONENT_TEST_PREFIX) && (entry.source ?? "").includes("node:test");
}

// `forcedTestFiles` are paths named with --file: they run even when listed as not run, so
// a legacy-drift suite can be checked before it graduates. `includedTestPrefixes: null`
// means the unfiltered run, which selects every file.
export function getTestFileInclusion(filePath, {
	forcedTestFiles = new Set(),
	includedTestPrefixes = null,
	legacyDriftTestFiles = LEGACY_DRIFT_TEST_FILE_SET,
	skippedTestFiles = SKIPPED_TEST_FILE_SET,
	skippedTestPrefixes = SKIPPED_TEST_PREFIX_LIST,
} = {}) {
	const classification = classifyTestFile(filePath ?? "");
	if (!filePath) return { classification, included: false, reason: "excluded-file" };
	const forced = forcedTestFiles.has(filePath);
	if (forced) return { classification, included: true, reason: "included-file" };
	if (skippedTestPrefixes.some((prefix) => filePath.startsWith(prefix))) return { classification: "skipped", included: false, reason: "skipped-prefix" };
	if (skippedTestFiles.has(filePath)) return { classification: "skipped", included: false, reason: "skipped" };
	if (legacyDriftTestFiles.has(filePath)) return { classification: "legacy-drift", included: false, reason: "legacy-drift" };
	if (includedTestPrefixes && !includedTestPrefixes.some((prefix) => filePath.startsWith(prefix))) {
		return { classification, included: false, reason: "not-selected" };
	}
	return { classification, included: true, reason: classification };
}

export function buildComponentTestReport(testEntries, options) {
	const componentEntries = testEntries
		.filter(isComponentNodeTestEntry)
		.map((entry) => {
			const inclusion = getTestFileInclusion(entry.filePath, options);
			return {
				classification: inclusion.classification,
				filePath: entry.filePath,
				included: inclusion.included,
				reason: inclusion.reason,
			};
		})
		.sort((a, b) => a.filePath.localeCompare(b.filePath));

	const includedFiles = componentEntries
		.filter((entry) => entry.included)
		.map((entry) => entry.filePath);
	const excludedFiles = componentEntries
		.filter((entry) => !entry.included)
		.map((entry) => ({
			classification: entry.classification,
			filePath: entry.filePath,
			reason: entry.reason,
		}));

	return {
		version: 1,
		componentRoot: COMPONENT_TEST_PREFIX,
		includedCount: includedFiles.length,
		excludedCount: excludedFiles.length,
		includedFiles,
		excludedFiles,
	};
}

export function selectRunnableTestFiles(testEntries, options) {
	return testEntries
		.filter((entry) => {
			const inclusion = getTestFileInclusion(entry.filePath, options);
			return inclusion.included && entry.source.includes("node:test");
		})
		.map((entry) => entry.filePath);
}

function parseListOptionValue(value) {
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export function parseTestSelectionArgs(argv) {
	const prefixes = [];
	const files = [];
	let shard;
	let keepGoing = false;
	let parallel;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--shard" || arg.startsWith("--shard=")) {
			const value = arg === "--shard" ? argv[++index] : arg.slice("--shard=".length);
			if (shard || !/^[1-4]\/4$/u.test(value ?? "")) {
				throw new Error("--shard requires a single value from 1/4 to 4/4");
			}
			shard = Number(value[0]);
			continue;
		}
		if (arg === "--parallel" || arg.startsWith("--parallel=")) {
			const value = arg === "--parallel" ? argv[++index] : arg.slice("--parallel=".length);
			if (parallel !== undefined || !value) throw new Error("--parallel requires a single value: a positive integer or auto");
			parallel = resolveParallel(value);
			continue;
		}
		// Run every batch even after one fails, so a caller sees all failing suites at once.
		if (arg === "--keep-going") {
			keepGoing = true;
			continue;
		}
		if (arg === "--prefix") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("--prefix requires a value");
			}
			prefixes.push(...parseListOptionValue(value));
			index += 1;
			continue;
		}
		if (arg.startsWith("--prefix=")) {
			prefixes.push(...parseListOptionValue(arg.slice("--prefix=".length)));
			continue;
		}
		if (arg === "--file") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("--file requires a value");
			}
			files.push(...parseListOptionValue(value));
			index += 1;
			continue;
		}
		if (arg.startsWith("--file=")) {
			files.push(...parseListOptionValue(arg.slice("--file=".length)));
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	if (shard && (files.length || prefixes.length)) {
		throw new Error("--shard cannot be combined with --file or --prefix; shards validate the full manifest");
	}
	return {
		files,
		prefixes,
		...(keepGoing ? { keepGoing } : {}),
		...(parallel ? { parallel } : {}),
		...(shard ? { shard } : {}),
	};
}

export function buildSelectionOptions({
	files = [],
	prefixes = [],
} = {}) {
	if (files.length === 0 && prefixes.length === 0) {
		return {};
	}

	return {
		forcedTestFiles: new Set(files),
		includedTestPrefixes: prefixes,
	};
}

export function shouldReportComponentCoverage({
	files = [],
	prefixes = [],
} = {}) {
	if (files.length === 0 && prefixes.length === 0) {
		return true;
	}

	return [
		...files,
		...prefixes,
	].some((entry) => entry === COMPONENT_TEST_PREFIX || entry.startsWith(COMPONENT_TEST_PREFIX));
}

export function filterExistingTestFiles(filePaths, fileExists = existsSync) {
	return filePaths.filter((filePath) => fileExists(filePath));
}

export function assertListedTestFilesExist({
	legacyDriftTestFiles = LEGACY_DRIFT_TEST_FILES,
	skippedTestFiles = Object.keys(SKIPPED_TEST_FILES),
	fileExists = existsSync,
} = {}) {
	const missing = [
		...legacyDriftTestFiles.filter((filePath) => !fileExists(filePath)).map((filePath) => `- ${LEGACY_DRIFT_PATH}: ${filePath}`),
		...skippedTestFiles.filter((filePath) => !fileExists(filePath)).map((filePath) => `- ${SKIPPED_PATH}: ${filePath}`),
	];
	const both = legacyDriftTestFiles.filter((filePath) => skippedTestFiles.includes(filePath)).map((filePath) => `- listed twice: ${filePath}`);
	if (missing.length + both.length === 0) return;
	throw new Error([
		"js-unit-tests: the not-run lists name paths that do not exist or appear in both lists; remove them:",
		...missing,
		...both,
	].join("\n"));
}

function hasNodeTestImport(entry) {
	return (entry.source ?? "").includes("node:test");
}

/**
 * Test files the unfiltered gate would silently skip: selected to run but without a
 * node:test import, so `node --test` would load them and report nothing.
 */
export function findUnselectedTestFiles(testEntries, options = {}) {
	return testEntries
		.filter((entry) => getTestFileInclusion(entry.filePath, options).included && !hasNodeTestImport(entry))
		.map((entry) => ({ filePath: entry.filePath, reason: "no node:test import" }))
		.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

export function assertEveryTestFileSelected(testEntries, options) {
	const unselected = findUnselectedTestFiles(testEntries, options);
	if (unselected.length === 0) {
		return;
	}

	throw new Error([
		`js-unit-tests: ${unselected.length} test file(s) would run without reporting, so the CI unit gate silently drops them:`,
		...unselected.map(({ filePath, reason }) => `- ${filePath} (${reason})`),
		`Import node:test where it is missing, or add the file to SKIPPED_TEST_FILES (or its root to SKIPPED_TEST_PREFIXES) in ${SKIPPED_PATH} with the reason it does not run.`,
		`Do not add it to ${LEGACY_DRIFT_PATH}: that is a frozen baseline of failing suites that must only shrink.`,
	].join("\n"));
}

// Entries in the current legacy-drift list that the base did not have.
export function findLegacyDriftGrowth(baseFiles, currentFiles = LEGACY_DRIFT_TEST_FILES) {
	const base = new Set(baseFiles);
	return currentFiles.filter((filePath) => !base.has(filePath)).sort();
}

export function parseLegacyDriftSource(source) {
	return [...source.matchAll(/"([^"\n]+\.test\.[^"\n]+)"/gu)].map((match) => match[1]);
}

function gitOutput(args) {
	const result = spawnSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
	return result.status === 0 ? result.stdout : null;
}

// Same base as the ESLint suppression ratchet: the PR base in CI, the pre-push tip on a
// push to main, the merge base with origin/main locally.
export function assertLegacyDriftDidNotGrow({ env = process.env, git = gitOutput, log = console.warn } = {}) {
	const { isBaseRequired, resolveBaseRef } = createRequire(import.meta.url)("./verify-eslint-suppressions.js");
	const baseRef = resolveBaseRef({ env, git: (args) => git(args)?.trim() ?? null });
	if (!baseRef) {
		const message = "js-unit-tests: legacy-drift ratchet base unavailable (fetch origin/main or set VPK_SUPPRESSIONS_BASE).";
		if (isBaseRequired(env)) throw new Error(message);
		log(`${message} Skipping.`);
		return;
	}
	const baseSource = git(["show", `${baseRef}:${LEGACY_DRIFT_PATH}`]);
	if (baseSource === null) return;
	const added = findLegacyDriftGrowth(parseLegacyDriftSource(baseSource));
	if (added.length === 0) return;
	throw new Error([
		`js-unit-tests: ${LEGACY_DRIFT_PATH} may only shrink, but these suites were added since ${baseRef.slice(0, 9)}:`,
		...added.map((filePath) => `- ${filePath}`),
		"Fix the suite so it passes instead of parking it as legacy drift.",
	].join("\n"));
}

// Every node:test file extension in the repo; a missing one silently drops those suites from CI.
export const TEST_FILE_GLOBS = ["*.test.js", "*.test.mjs", "*.test.ts"];

export function listCandidateTestFiles() {
	const gitResult = spawnSync("git", [
		"ls-files",
		"--cached",
		"--others",
		"--exclude-standard",
		...TEST_FILE_GLOBS,
	], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

	if (gitResult.status !== 0) {
		process.exit(gitResult.status ?? 1);
	}

	return filterExistingTestFiles(gitResult.stdout
		.split("\n")
		.map((filePath) => filePath.trim())
		.filter(Boolean));
}

function readTestEntries(filePaths) {
	return filePaths.map((filePath) => ({
		filePath,
		source: readFileSync(filePath, "utf8"),
	}));
}

function reportComponentTestCoverage(report) {
	const legacyDriftCount = report.excludedFiles
		.filter((entry) => entry.classification === "legacy-drift")
		.length;
	console.log(
		`js-unit-tests: component node:test coverage ${report.includedCount} included, ${legacyDriftCount} frozen legacy-drift. Graduate a legacy-drift suite by fixing it and removing it from ${LEGACY_DRIFT_PATH}.`
	);
	console.log(formatComponentTestReport(report));
}

function splitByUtf8Bytes(value, maxBytes) {
	const chunks = [];
	let chunk = "";
	let chunkBytes = 0;

	for (const character of value) {
		const characterBytes = Buffer.byteLength(character);
		if (chunkBytes + characterBytes > maxBytes && chunk) {
			chunks.push(chunk);
			chunk = "";
			chunkBytes = 0;
		}
		chunk += character;
		chunkBytes += characterBytes;
	}
	if (chunk) chunks.push(chunk);
	return chunks;
}

export function formatComponentTestReport(report, {
	maxLineBytes = COMPONENT_TEST_REPORT_MAX_LINE_BYTES,
} = {}) {
	const serialized = JSON.stringify(report);
	const singleLine = `${COMPONENT_TEST_REPORT_PREFIX} ${serialized}`;
	if (Buffer.byteLength(singleLine) <= maxLineBytes) return singleLine;

	const chunkBytes = maxLineBytes
		- Buffer.byteLength(COMPONENT_TEST_REPORT_PREFIX)
		- COMPONENT_TEST_REPORT_CHUNK_PREFIX_RESERVE_BYTES;
	if (chunkBytes < 1) throw new Error("component test report line limit is too small");
	const chunks = splitByUtf8Bytes(serialized, chunkBytes);
	return [
		`${COMPONENT_TEST_REPORT_PREFIX}_BEGIN ${chunks.length} ${Buffer.byteLength(serialized)}`,
		...chunks.map((chunk, index) => (
			`${COMPONENT_TEST_REPORT_PREFIX}_CHUNK ${index + 1}/${chunks.length} ${chunk}`
		)),
		`${COMPONENT_TEST_REPORT_PREFIX}_END`,
	].join("\n");
}

function requiresVmModuleFlag(source) {
	return VM_MODULE_TEST_MARKERS.some((marker) => source.includes(marker));
}

export function buildTestFileBatches(testFiles, {
	readFile = readFileSync,
} = {}) {
	const directoryBatches = new Map();
	const batches = [];

	for (const testFile of testFiles) {
		const source = readFile(testFile, "utf8");
		if (requiresVmModuleFlag(source)) {
			batches.push({
				files: [testFile],
				nodeArgs: ["--experimental-vm-modules", ...ALIAS_HOOK_ARGS],
				reason: "vm-modules",
			});
			continue;
		}

		const group = dirname(testFile);
		const existingBatch = directoryBatches.get(group);
		if (existingBatch) {
			existingBatch.files.push(testFile);
			continue;
		}

		const batch = {
			files: [testFile],
			nodeArgs: [...ALIAS_HOOK_ARGS],
			reason: "directory",
		};
		directoryBatches.set(group, batch);
		batches.push(batch);
	}

	return batches;
}

export function batchIdentity(batch) {
	return batch.reason === "vm-modules" ? batch.files[0] : dirname(batch.files[0]);
}

// Expected seconds per batch, longest first with deterministic ties. New batches cost one
// second/file until measured; changed batch sizes scale the historical median proportionally.
export function weighTestBatches(batches, timings = BATCH_TIMINGS) {
	return batches.map((batch) => {
		const measured = timings[batchIdentity(batch)];
		const seconds = measured ? measured[1] * batch.files.length / measured[0] : batch.files.length;
		return { batch, seconds };
	}).sort((a, b) => b.seconds - a.seconds || (batchIdentity(a.batch) < batchIdentity(b.batch) ? -1 : 1));
}

// Longest measured batches first; deterministic ties go to the lowest numbered shard.
// Keep directory batches and their VM flags intact.
export function partitionTestBatches(batches, timings = BATCH_TIMINGS, count = UNIT_SHARD_COUNT) {
	const shards = Array.from({ length: count }, () => ({ batches: [], seconds: 0 }));
	for (const { batch, seconds } of weighTestBatches(batches, timings)) {
		const target = shards.reduce((best, shard) => shard.seconds < best.seconds ? shard : best);
		target.batches.push(batch);
		target.seconds += seconds;
	}
	return shards;
}

export function runTestFiles(testFiles, {
	readFile = readFileSync,
	spawn = spawnSync,
	shard,
	keepGoing = false,
	log = console.log,
	now = () => performance.now(),
} = {}) {
	const allBatches = buildTestFileBatches(testFiles, { readFile });
	const batches = shard ? partitionTestBatches(allBatches)[shard - 1].batches : allBatches;
	log(`js-unit-tests: ${shard ? `shard ${shard}/${UNIT_SHARD_COUNT}` : "unsharded"}: ${batches.length}/${allBatches.length} batches, ${batches.reduce((sum, batch) => sum + batch.files.length, 0)}/${testFiles.length} files`);
	const timings = [];
	let status = 0;
	for (const batch of batches) {
		const id = batchIdentity(batch);
		log(`js-unit-tests: batch ${id} (${batch.files.length} files, ${batch.reason})`);
		const started = now();
		const result = spawn(process.execPath, [...batch.nodeArgs, "--test", ...batch.files], {
			stdio: "inherit",
		});
		const batchStatus = result.status ?? 1;
		if (status === 0) status = batchStatus;
		const timing = { id, files: batch.files.length, seconds: Number(((now() - started) / 1000).toFixed(3)), status: batchStatus, signal: result.signal ?? null };
		timings.push(timing);
		log(`JS_UNIT_BATCH ${JSON.stringify(timing)}`);
		if (batchStatus !== 0 && !keepGoing) break;
	}
	log(`js-unit-tests: slowest batches (completed ${timings.length}/${batches.length}):`);
	for (const timing of [...timings].sort((a, b) => b.seconds - a.seconds).slice(0, 10)) {
		log(`  ${timing.seconds.toFixed(3)}s ${timing.id} (${timing.files} files, exit ${timing.status})`);
	}
	return { status, timings };
}

const runningChildren = new Set();

// One batch, output captured so concurrent batches print as whole blocks. Each batch runs
// in its own process group so an interrupted run can stop everything it started.
export function spawnCaptured(command, args) {
	return new Promise((resolve) => {
		const child = spawnChild(command, args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
		runningChildren.add(child);
		let output = "";
		child.stdout.on("data", (chunk) => { output += chunk; });
		child.stderr.on("data", (chunk) => { output += chunk; });
		child.on("error", (error) => { output += `${error.message}\n`; });
		child.on("close", (status, signal) => {
			runningChildren.delete(child);
			resolve({ output, signal: signal ?? null, status });
		});
	});
}

function stopRunningChildren(signal) {
	for (const child of runningChildren) {
		try { process.kill(-child.pid, signal); } catch { /* already exited */ }
	}
}

// node --test already runs a batch's files concurrently (one less than the CPU count by
// default). With several batches at once, split the CPUs between them instead.
export function testConcurrencyFor(parallel, cpus = availableParallelism()) {
	return Math.max(1, Math.floor(cpus / parallel));
}

export function resolveParallel(value, cpus = availableParallelism()) {
	if (value === "auto") return Math.max(1, Math.min(8, Math.floor(cpus / 2)));
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) throw new Error("--parallel requires a positive integer or auto");
	return parsed;
}

// Runs batches on `parallel` workers that take the longest remaining batch first (the
// shard weights), printing each batch's output when it finishes.
export async function runTestFilesParallel(testFiles, {
	parallel,
	readFile = readFileSync,
	spawn = spawnCaptured,
	shard,
	keepGoing = false,
	cpus = availableParallelism(),
	log = console.log,
	write = (text) => process.stdout.write(text),
	now = () => performance.now(),
} = {}) {
	const allBatches = buildTestFileBatches(testFiles, { readFile });
	const batches = shard ? partitionTestBatches(allBatches)[shard - 1].batches : allBatches;
	const queue = weighTestBatches(batches).map(({ batch }) => batch);
	const concurrency = testConcurrencyFor(parallel, cpus);
	log(`js-unit-tests: ${shard ? `shard ${shard}/${UNIT_SHARD_COUNT}` : "unsharded"}, ${parallel} parallel workers x ${concurrency} test files each: ${batches.length}/${allBatches.length} batches, ${batches.reduce((sum, batch) => sum + batch.files.length, 0)}/${testFiles.length} files`);
	const timings = [];
	let status = 0;
	let stopped = false;
	const worker = async () => {
		while (queue.length > 0 && !stopped) {
			const batch = queue.shift();
			const id = batchIdentity(batch);
			const started = now();
			const result = await spawn(process.execPath, [...batch.nodeArgs, `--test-concurrency=${concurrency}`, "--test", ...batch.files]);
			const batchStatus = result.status ?? 1;
			if (status === 0) status = batchStatus;
			const timing = { id, files: batch.files.length, seconds: Number(((now() - started) / 1000).toFixed(3)), status: batchStatus, signal: result.signal ?? null };
			timings.push(timing);
			write(`js-unit-tests: batch ${id} (${batch.files.length} files, ${batch.reason})\n${result.output}`);
			log(`JS_UNIT_BATCH ${JSON.stringify(timing)}`);
			if (batchStatus !== 0 && !keepGoing) stopped = true;
		}
	};
	await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, worker));
	log(`js-unit-tests: slowest batches (completed ${timings.length}/${batches.length}):`);
	for (const timing of [...timings].sort((a, b) => b.seconds - a.seconds).slice(0, 10)) {
		log(`  ${timing.seconds.toFixed(3)}s ${timing.id} (${timing.files} files, exit ${timing.status})`);
	}
	return { status, timings };
}

function exitOnManifestError(check) {
	try {
		check();
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}

function warnSilentSelectedTests(testEntries, testFiles) {
	const selectedFiles = new Set(testFiles);
	const silent = findUnselectedTestFiles(testEntries.filter((entry) => selectedFiles.has(entry.filePath)));
	if (silent.length === 0) return;
	console.warn([
		"js-unit-tests: warning: selected suites have no node:test import; the unfiltered CI run fails until they import it or are skipped:",
		...silent.map(({ filePath }) => `- ${filePath}`),
	].join("\n"));
}

async function main() {
	for (const signal of ["SIGINT", "SIGTERM"]) {
		process.once(signal, () => {
			stopRunningChildren(signal);
			process.exit(130);
		});
	}
	exitOnManifestError(() => assertListedTestFilesExist());
	const selection = parseTestSelectionArgs(process.argv.slice(2));
	const selectionOptions = buildSelectionOptions(selection);
	const testEntries = readTestEntries(listCandidateTestFiles());
	const hasSelection = selection.files.length > 0 || selection.prefixes.length > 0;
	if (!hasSelection) {
		exitOnManifestError(() => {
			assertEveryTestFileSelected(testEntries);
			assertLegacyDriftDidNotGrow();
		});
	}
	const testFiles = selectRunnableTestFiles(testEntries, selectionOptions);
	if (hasSelection) {
		warnSilentSelectedTests(testEntries, testFiles);
	}
	if (
		shouldReportComponentCoverage(selection) &&
		(!hasSelection || testFiles.some((testFile) => testFile.startsWith(COMPONENT_TEST_PREFIX)))
	) {
		const report = buildComponentTestReport(testEntries, selectionOptions);
		reportComponentTestCoverage(report);
	}

	if (testFiles.length === 0) {
		if (hasSelection) {
			console.log("js-unit-tests: no matching node:test files selected.");
		}
		process.exit(0);
	}

	const options = { keepGoing: selection.keepGoing, shard: selection.shard };
	process.exitCode = selection.parallel
		? (await runTestFilesParallel(testFiles, { ...options, parallel: selection.parallel })).status
		: runTestFiles(testFiles, options).status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
