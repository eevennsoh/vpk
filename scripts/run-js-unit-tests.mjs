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

const TEST_FILE_CLASSIFICATION_BY_PATH = buildTestFileClassificationMap(TEST_FILE_CLASSIFICATIONS);
const CI_INCLUDED_TEST_CLASSIFICATION_SET = new Set(CI_INCLUDED_TEST_CLASSIFICATIONS);
const EXCLUDED_TEST_FILES = new Set(TEST_FILE_CLASSIFICATIONS["legacy-drift"] ?? []);
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

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
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

	return {
		files,
		prefixes,
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

export function findUnclassifiedComponentTestFiles(testEntries, {
	classificationByFile = TEST_FILE_CLASSIFICATION_BY_PATH,
} = {}) {
	return testEntries
		.filter(isComponentNodeTestEntry)
		.filter((entry) => getTestFileClassification(entry.filePath, { classificationByFile }) === "unclassified")
		.map((entry) => entry.filePath)
		.sort((left, right) => left.localeCompare(right));
}

export function assertComponentTestFilesClassified(testEntries, options) {
	const unclassifiedFiles = findUnclassifiedComponentTestFiles(testEntries, options);
	if (unclassifiedFiles.length === 0) {
		return;
	}

	throw new Error([
		`js-unit-tests: ${unclassifiedFiles.length} component node:test suite(s) are not classified, so the CI unit gate cannot run them:`,
		...unclassifiedFiles.map((filePath) => `- ${filePath}`),
		`Add each path to ${MANIFEST_PATH} under \`stable\` (behavioral tests) or \`source-contract\` (tests that assert on source text).`,
		"Do not add them to `legacy-drift`: it is a frozen baseline of skipped suites that must only shrink.",
	].join("\n"));
}

// Every node:test file extension in the repo; a missing one silently drops those suites from CI.
export const TEST_FILE_GLOBS = ["*.test.js", "*.test.mjs", "*.test.ts"];

function listCandidateTestFiles() {
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

export function runTestFiles(testFiles, {
	readFile = readFileSync,
	spawn = spawnSync,
} = {}) {
	for (const batch of buildTestFileBatches(testFiles, { readFile })) {
		const result = spawn(process.execPath, [...batch.nodeArgs, "--test", ...batch.files], {
			stdio: "inherit",
		});

		if (result.status !== 0) {
			process.exit(result.status ?? 1);
		}

		if (result.signal) {
			process.kill(process.pid, result.signal);
		}
	}
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
	const unclassifiedFiles = findUnclassifiedComponentTestFiles(
		testEntries.filter((entry) => selectedFiles.has(entry.filePath)),
	);
	if (unclassifiedFiles.length === 0) {
		return;
	}

	console.warn([
		`js-unit-tests: warning: selected component suites are unclassified; the unfiltered CI run fails until they are classified in ${MANIFEST_PATH}:`,
		...unclassifiedFiles.map((filePath) => `- ${filePath}`),
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
		exitOnManifestError(() => assertComponentTestFilesClassified(testEntries));
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

	runTestFiles(testFiles);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
