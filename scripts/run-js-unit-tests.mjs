import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import {
	CI_INCLUDED_TEST_CLASSIFICATIONS,
	INCLUDED_TEST_PREFIXES,
	TEST_FILE_CLASSIFICATIONS,
} from "./js-unit-test-manifest.mjs";

const COMPONENT_TEST_PREFIX = "components/";
const MANIFEST_PATH = "scripts/js-unit-test-manifest.mjs";
const COMPONENT_TEST_REPORT_PREFIX = "JS_UNIT_COMPONENT_TEST_REPORT";
const COMPONENT_TEST_REPORT_MAX_LINE_BYTES = 60 * 1024;
const COMPONENT_TEST_REPORT_CHUNK_PREFIX_RESERVE_BYTES = 32;
const VM_MODULE_TEST_MARKERS = [
	"vm.SyntheticModule",
	"vm.SourceTextModule",
];
const BATCH_TIMINGS = JSON.parse(readFileSync(new URL("./js-unit-test-timings.json", import.meta.url), "utf8")).batches;
export const UNIT_SHARD_COUNT = 4;

const TEST_FILE_CLASSIFICATION_BY_PATH = buildTestFileClassificationMap(TEST_FILE_CLASSIFICATIONS);
const CI_INCLUDED_TEST_CLASSIFICATION_SET = new Set(CI_INCLUDED_TEST_CLASSIFICATIONS);
// Explicitly not run: the frozen legacy-drift baseline and SKIPPED_TEST_FILES (each with a reason).
const LISTED_NOT_RUN_CLASSIFICATIONS = new Set(["legacy-drift", "skipped"]);
const EXCLUDED_TEST_FILES = new Set([...LISTED_NOT_RUN_CLASSIFICATIONS].flatMap((classification) => TEST_FILE_CLASSIFICATIONS[classification] ?? []));
const INCLUDED_TEST_FILES = new Set([...TEST_FILE_CLASSIFICATION_BY_PATH]
	.filter(([, classification]) => CI_INCLUDED_TEST_CLASSIFICATION_SET.has(classification))
	.map(([filePath]) => filePath));

export function buildTestFileClassificationMap(classifications = TEST_FILE_CLASSIFICATIONS) {
	const classificationByFile = new Map();
	for (const [classification, filePaths] of Object.entries(classifications)) {
		for (const filePath of filePaths) {
			classificationByFile.set(filePath, classification);
		}
	}
	return classificationByFile;
}

export function getTestFileClassification(filePath, {
	classificationByFile = TEST_FILE_CLASSIFICATION_BY_PATH,
} = {}) {
	return classificationByFile.get(filePath) ?? "unclassified";
}

function isComponentNodeTestEntry(entry) {
	return entry.filePath.startsWith(COMPONENT_TEST_PREFIX) && (entry.source ?? "").includes("node:test");
}

export function getTestFileInclusion(filePath, {
	ciIncludedClassifications = CI_INCLUDED_TEST_CLASSIFICATION_SET,
	classificationByFile = TEST_FILE_CLASSIFICATION_BY_PATH,
	excludedTestFiles = EXCLUDED_TEST_FILES,
	includedTestFiles = INCLUDED_TEST_FILES,
	includedTestPrefixes = INCLUDED_TEST_PREFIXES,
} = {}) {
	const classification = getTestFileClassification(filePath, { classificationByFile });
	// An explicitly named `--file` still force-runs a legacy-drift suite so it can be checked before graduating.
	if (!filePath || (excludedTestFiles.has(filePath) && !includedTestFiles.has(filePath))) {
		return {
			classification,
			included: false,
			reason: "excluded-file",
		};
	}

	if (ciIncludedClassifications.has(classification)) {
		return {
			classification,
			included: true,
			reason: classification,
		};
	}

	if (includedTestFiles.has(filePath)) {
		return {
			classification,
			included: true,
			reason: "included-file",
		};
	}

	if (includedTestPrefixes.some((prefix) => filePath.startsWith(prefix))) {
		return {
			classification,
			included: true,
			reason: "included-prefix",
		};
	}

	return {
		classification,
		included: false,
		reason: classification === "legacy-drift" || classification === "unclassified" ? classification : "not-included",
	};
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
		ciIncludedClassifications: new Set(),
		excludedTestFiles: EXCLUDED_TEST_FILES,
		includedTestFiles: new Set(files),
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

export function assertClassifiedTestFilesExist(
	classifications = TEST_FILE_CLASSIFICATIONS,
	fileExists = existsSync,
) {
	const missingEntries = Object.entries(classifications)
		.flatMap(([classification, filePaths]) => filePaths
			.filter((filePath) => !fileExists(filePath))
			.map((filePath) => ({ classification, filePath })))
		.sort((left, right) => {
			return left.classification.localeCompare(right.classification) ||
				left.filePath.localeCompare(right.filePath);
		});

	if (missingEntries.length === 0) {
		return;
	}

	throw new Error([
		"js-unit-tests: classified test paths do not exist:",
		...missingEntries.map(({ classification, filePath }) => {
			return `- ${classification}: ${filePath}`;
		}),
	].join("\n"));
}

export function assertUniqueTestFileClassifications(classifications = TEST_FILE_CLASSIFICATIONS) {
	const classificationsByFile = new Map();
	for (const [classification, filePaths] of Object.entries(classifications)) {
		for (const filePath of filePaths) {
			classificationsByFile.set(filePath, [...(classificationsByFile.get(filePath) ?? []), classification]);
		}
	}
	const duplicateEntries = [...classificationsByFile]
		.filter(([, fileClassifications]) => fileClassifications.length > 1)
		.sort(([left], [right]) => left.localeCompare(right));

	if (duplicateEntries.length === 0) {
		return;
	}

	throw new Error([
		`js-unit-tests: test paths are listed more than once in ${MANIFEST_PATH}; keep exactly one classification per path:`,
		...duplicateEntries.map(([filePath, fileClassifications]) => {
			return `- ${filePath}: ${fileClassifications.join(", ")}`;
		}),
	].join("\n"));
}

function hasNodeTestImport(entry) {
	return (entry.source ?? "").includes("node:test");
}

/**
 * Test files the unfiltered gate would silently skip: neither run (a CI-included
 * classification or an included prefix, with a node:test import) nor listed as not run
 * (legacy-drift or SKIPPED_TEST_FILES). Covers every root, not only components/.
 */
export function findUnselectedTestFiles(testEntries, {
	classificationByFile = TEST_FILE_CLASSIFICATION_BY_PATH,
	includedTestPrefixes = INCLUDED_TEST_PREFIXES,
} = {}) {
	return testEntries
		.flatMap((entry) => {
			const inclusion = getTestFileInclusion(entry.filePath, { classificationByFile, includedTestPrefixes });
			if (LISTED_NOT_RUN_CLASSIFICATIONS.has(inclusion.classification)) return [];
			// components/** suites always need an explicit classification, even under an included prefix.
			const needsClassification = entry.filePath.startsWith(COMPONENT_TEST_PREFIX) && inclusion.classification === "unclassified";
			if (!inclusion.included || needsClassification) return [{ filePath: entry.filePath, reason: "unclassified" }];
			return hasNodeTestImport(entry) ? [] : [{ filePath: entry.filePath, reason: "no node:test import" }];
		})
		.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

export function assertEveryTestFileSelected(testEntries, options) {
	const unselected = findUnselectedTestFiles(testEntries, options);
	if (unselected.length === 0) {
		return;
	}

	throw new Error([
		`js-unit-tests: ${unselected.length} test file(s) are neither run nor listed as skipped, so the CI unit gate silently drops them:`,
		...unselected.map(({ filePath, reason }) => `- ${filePath} (${reason})`),
		`Classify each path in ${MANIFEST_PATH} under \`stable\` (behavioral tests) or \`source-contract\` (tests that assert on source text), import node:test where it is missing, or add it to SKIPPED_TEST_FILES with the reason it does not run.`,
		"Do not add them to `legacy-drift`: it is a frozen baseline of skipped suites that must only shrink.",
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
		`js-unit-tests: component node:test coverage ${report.includedCount} included, ${legacyDriftCount} frozen legacy-drift. Graduate legacy-drift tests to stable or source-contract in ${MANIFEST_PATH}.`
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
				nodeArgs: ["--experimental-vm-modules"],
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
			nodeArgs: [],
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

// Longest measured batches first; deterministic ties go to the lowest numbered shard.
// Keep directory batches and their VM flags intact. New batches cost one second/file
// until measured; changed batch sizes scale the historical median proportionally.
export function partitionTestBatches(batches, timings = BATCH_TIMINGS) {
	const shards = Array.from({ length: UNIT_SHARD_COUNT }, () => ({ batches: [], seconds: 0 }));
	const weighted = batches.map((batch) => {
		const measured = timings[batchIdentity(batch)];
		const seconds = measured ? measured[1] * batch.files.length / measured[0] : batch.files.length;
		return { batch, seconds };
	}).sort((a, b) => b.seconds - a.seconds || (batchIdentity(a.batch) < batchIdentity(b.batch) ? -1 : 1));
	for (const { batch, seconds } of weighted) {
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
		status = result.status ?? 1;
		const timing = { id, files: batch.files.length, seconds: Number(((now() - started) / 1000).toFixed(3)), status, signal: result.signal ?? null };
		timings.push(timing);
		log(`JS_UNIT_BATCH ${JSON.stringify(timing)}`);
		if (status !== 0) break;
	}
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

function warnUnclassifiedSelectedTests(testEntries, testFiles) {
	const selectedFiles = new Set(testFiles);
	const unclassifiedFiles = findUnselectedTestFiles(
		testEntries.filter((entry) => selectedFiles.has(entry.filePath)),
	);
	if (unclassifiedFiles.length === 0) {
		return;
	}

	console.warn([
		`js-unit-tests: warning: selected suites are unclassified; the unfiltered CI run fails until they are classified in ${MANIFEST_PATH}:`,
		...unclassifiedFiles.map(({ filePath }) => `- ${filePath}`),
	].join("\n"));
}

function main() {
	exitOnManifestError(() => {
		assertClassifiedTestFilesExist();
		assertUniqueTestFileClassifications();
	});
	const selection = parseTestSelectionArgs(process.argv.slice(2));
	const selectionOptions = buildSelectionOptions(selection);
	const testEntries = readTestEntries(listCandidateTestFiles());
	const hasSelection = selection.files.length > 0 || selection.prefixes.length > 0;
	if (!hasSelection) {
		exitOnManifestError(() => assertEveryTestFileSelected(testEntries));
	}
	const testFiles = selectRunnableTestFiles(testEntries, selectionOptions);
	if (hasSelection) {
		warnUnclassifiedSelectedTests(testEntries, testFiles);
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

	process.exitCode = runTestFiles(testFiles, { shard: selection.shard }).status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
