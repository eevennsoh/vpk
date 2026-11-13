const assert = require("node:assert/strict");
const test = require("node:test");
const { PRESSURE_LEVEL_MIN: LEVEL, PRESSURE_SWAP_USED_GB: SWAP } = require("./lib/memory-pressure.js");
// Pressure fixtures follow the sweep's limits, so changing them there breaks no test.
const OVER = SWAP + 13;

const NODE_TEST_SOURCE = 'const test = require("node:test");';

test("discovery covers every node:test file extension tracked in the repo", async () => {
	const { execFileSync } = require("node:child_process");
	const { TEST_FILE_GLOBS } = await import("./run-js-unit-tests.mjs");
	const extensions = new Set(TEST_FILE_GLOBS.map((glob) => glob.replace("*", "")));
	const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
		.split("\n")
		.filter((file) => /\.test\.[cm]?[jt]sx?$/u.test(file) && !file.startsWith("node_modules/"));
	// *.test.mjs suites were silently never run before they were added here.
	const missed = tracked.filter((file) => ![...extensions].some((extension) => file.endsWith(extension)));
	assert.deepEqual(missed, []);
});

test("component test report lists every component suite as included unless it is skipped or legacy-drift", async () => {
	const { buildComponentTestReport } = await import("./run-js-unit-tests.mjs");
	const report = buildComponentTestReport([
		{ filePath: "components/allowed.test.js", source: NODE_TEST_SOURCE },
		{ filePath: "components/new.source.test.js", source: NODE_TEST_SOURCE },
		{ filePath: "components/frozen.test.js", source: NODE_TEST_SOURCE },
		{ filePath: "components/type.contract.test.ts", source: NODE_TEST_SOURCE },
		{ filePath: "components/not-node-test.test.js", source: "module.exports = {};" },
		{ filePath: "lib/outside.test.js", source: NODE_TEST_SOURCE },
	], {
		legacyDriftTestFiles: new Set(["components/frozen.test.js"]),
		skippedTestFiles: new Set(["components/type.contract.test.ts"]),
	});

	assert.deepEqual(report, {
		version: 1,
		componentRoot: "components/",
		includedCount: 2,
		excludedCount: 2,
		includedFiles: ["components/allowed.test.js", "components/new.source.test.js"],
		excludedFiles: [
			{ classification: "legacy-drift", filePath: "components/frozen.test.js", reason: "legacy-drift" },
			{ classification: "skipped", filePath: "components/type.contract.test.ts", reason: "skipped" },
		],
	});
});

test("classification comes from the file name, and a new suite needs no registration to run", async () => {
	const { classifyTestFile, getTestFileInclusion } = await import("./run-js-unit-tests.mjs");
	assert.equal(classifyTestFile("components/a/foo.source.test.js"), "source-contract");
	assert.equal(classifyTestFile("components/a/foo.browser.source.test.mjs"), "source-contract");
	assert.equal(classifyTestFile("components/a/foo.behavior.test.js"), "behavior");
	assert.equal(classifyTestFile("components/a/foo.test.ts"), "unit");
	assert.equal(classifyTestFile("components/a.source/foo.test.js"), "unit");
	for (const filePath of ["components/new.test.js", "hooks/new-hook.test.js", "tools/new-root.test.mjs", "twg-install.test.js"]) {
		assert.equal(getTestFileInclusion(filePath, { legacyDriftTestFiles: new Set(), skippedTestFiles: new Set() }).included, true, filePath);
	}
});

test("unfiltered runs fail when a selected test file in any root has no node:test import", async () => {
	const {
		assertEveryTestFileSelected,
		findUnselectedTestFiles,
	} = await import("./run-js-unit-tests.mjs");
	const selectedEntries = [
		{ filePath: "components/stable.test.js", source: NODE_TEST_SOURCE },
		{ filePath: "components/frozen.test.js", source: "describe('frozen', () => {});" },
		{ filePath: "components/type.contract.test.ts", source: "export type Contract = true;" },
		{ filePath: "hooks/new-hook.test.js", source: NODE_TEST_SOURCE },
		{ filePath: "artifacts/deliverable.test.mjs", source: "module.exports = {};" },
	];
	const testEntries = [
		{ filePath: "lib/jest-style.test.js", source: "describe('x', () => {});" },
		...selectedEntries,
		{ filePath: "components/a-new.test.js", source: "module.exports = {};" },
	];
	const options = {
		legacyDriftTestFiles: new Set(["components/frozen.test.js"]),
		skippedTestFiles: new Set(["components/type.contract.test.ts"]),
		skippedTestPrefixes: ["artifacts/"],
	};

	assert.deepEqual(findUnselectedTestFiles(testEntries, options), [
		{ filePath: "components/a-new.test.js", reason: "no node:test import" },
		{ filePath: "lib/jest-style.test.js", reason: "no node:test import" },
	]);
	assert.throws(
		() => assertEveryTestFileSelected(testEntries, options),
		new Error([
			"js-unit-tests: 2 test file(s) would run without reporting, so the CI unit gate silently drops them:",
			"- components/a-new.test.js (no node:test import)",
			"- lib/jest-style.test.js (no node:test import)",
			"Import node:test where it is missing, or add the file to SKIPPED_TEST_FILES (or its root to SKIPPED_TEST_PREFIXES) in scripts/js-unit-test-skipped.mjs with the reason it does not run.",
			"Do not add it to scripts/js-unit-test-legacy-drift.mjs: that is a frozen baseline of failing suites that must only shrink.",
		].join("\n")),
	);
	assert.doesNotThrow(() => assertEveryTestFileSelected(selectedEntries, options));
});

test("the real repository has no test file that the unit gate silently drops", async () => {
	const { readFileSync } = require("node:fs");
	const { findUnselectedTestFiles, listCandidateTestFiles } = await import("./run-js-unit-tests.mjs");
	const testEntries = listCandidateTestFiles().map((filePath) => ({ filePath, source: readFileSync(filePath, "utf8") }));
	assert.deepEqual(findUnselectedTestFiles(testEntries), []);
});

test("every skipped test file and root states why it does not run", async () => {
	const { SKIPPED_TEST_FILES, SKIPPED_TEST_PREFIXES } = await import("./js-unit-test-skipped.mjs");
	const missingReason = Object.entries({ ...SKIPPED_TEST_FILES, ...SKIPPED_TEST_PREFIXES })
		.filter(([, reason]) => typeof reason !== "string" || reason.trim().length < 20);
	assert.deepEqual(missingReason, []);
	assert.deepEqual(Object.keys(SKIPPED_TEST_FILES).filter((filePath) => filePath.startsWith("artifacts/")), [], "artifacts/ is skipped by prefix, not file by file");
});

test("a suite under a skipped root never runs, while one under any other root runs without registration", async () => {
	const { selectRunnableTestFiles } = await import("./run-js-unit-tests.mjs");
	const testEntries = [
		{ filePath: "artifacts/vpk-html/new-explainer/_figures/brand-new.behavior.test.mjs", source: 'import test from "node:test";' },
		{ filePath: "tools/new-root.test.mjs", source: 'import test from "node:test";' },
		{ filePath: "hooks/new-hook.test.js", source: NODE_TEST_SOURCE },
	];
	assert.deepEqual(selectRunnableTestFiles(testEntries, { skippedTestPrefixes: ["artifacts/"] }), [
		"tools/new-root.test.mjs",
		"hooks/new-hook.test.js",
	]);
});

test("legacy-drift entries are excluded from unfiltered and prefix runs but an explicit --file force-runs them", async () => {
	const { LEGACY_DRIFT_TEST_FILES } = await import("./js-unit-test-legacy-drift.mjs");
	const { buildSelectionOptions, selectRunnableTestFiles } = await import("./run-js-unit-tests.mjs");
	const frozenFile = LEGACY_DRIFT_TEST_FILES.find((filePath) => filePath.startsWith("components/"));
	const runningFile = "components/ui/button.test.js";
	const testEntries = [frozenFile, runningFile].map((filePath) => ({ filePath, source: NODE_TEST_SOURCE }));

	assert.deepEqual(selectRunnableTestFiles(testEntries, buildSelectionOptions()), [runningFile]);
	assert.deepEqual(
		selectRunnableTestFiles(testEntries, buildSelectionOptions({ prefixes: ["components/"] })),
		[runningFile],
	);
	assert.deepEqual(
		selectRunnableTestFiles(testEntries, buildSelectionOptions({ files: [frozenFile] })),
		[frozenFile],
	);
});

test("the legacy-drift ratchet fails on an added suite, allows removals, and needs a base in CI", async () => {
	const { assertLegacyDriftDidNotGrow, findLegacyDriftGrowth, parseLegacyDriftSource } = await import("./run-js-unit-tests.mjs");
	const { LEGACY_DRIFT_TEST_FILES } = await import("./js-unit-test-legacy-drift.mjs");
	const source = (files) => `export const LEGACY_DRIFT_TEST_FILES = [\n${files.map((file) => `\t"${file}",`).join("\n")}\n];\n`;
	assert.deepEqual(parseLegacyDriftSource(source(["a/x.test.js", "b/y.test.ts"])), ["a/x.test.js", "b/y.test.ts"]);
	assert.deepEqual(findLegacyDriftGrowth(["a.test.js", "b.test.js"], ["b.test.js"]), []);
	// Membership, not size: swapping a graduated suite for a new one still fails.
	assert.deepEqual(findLegacyDriftGrowth(["a.test.js", "b.test.js"], ["b.test.js", "c.test.js"]), ["c.test.js"]);

	const git = (baseFiles) => (args) => {
		if (args[0] === "merge-base") return "base1234567\n";
		if (args[0] === "rev-parse") return "base1234567\n";
		if (args[0] === "show") return source(baseFiles);
		return null;
	};
	assert.doesNotThrow(() => assertLegacyDriftDidNotGrow({ env: {}, git: git([...LEGACY_DRIFT_TEST_FILES, "graduated.test.js"]) }));
	assert.throws(
		() => assertLegacyDriftDidNotGrow({ env: {}, git: git(LEGACY_DRIFT_TEST_FILES.slice(1)) }),
		new RegExp(`may only shrink, but these suites were added since base12345:\n- ${LEGACY_DRIFT_TEST_FILES[0].replaceAll(".", "\\.")}`, "u"),
	);
	const warnings = [];
	assertLegacyDriftDidNotGrow({ env: {}, git: () => null, log: (line) => warnings.push(line) });
	assert.match(warnings[0], /ratchet base unavailable/u);
	assert.throws(() => assertLegacyDriftDidNotGrow({ env: { GITHUB_BASE_REF: "main" }, git: () => null }), /ratchet base unavailable/u);
});

test("component test report output chunks only payloads that exceed the line limit", async () => {
	const { formatComponentTestReport } = await import("./run-js-unit-tests.mjs");
	const smallReport = { includedFiles: ["components/a.test.js"] };
	assert.equal(
		formatComponentTestReport(smallReport),
		`JS_UNIT_COMPONENT_TEST_REPORT ${JSON.stringify(smallReport)}`,
	);

	const largeReport = { excludedFiles: Array.from({ length: 20 }, (_, index) => ({
		filePath: `components/long-component-name-${index}.test.js`,
	})) };
	const output = formatComponentTestReport(largeReport, { maxLineBytes: 128 });
	const lines = output.split("\n");
	assert.equal(lines[0].startsWith("JS_UNIT_COMPONENT_TEST_REPORT_BEGIN "), true);
	assert.equal(lines.at(-1), "JS_UNIT_COMPONENT_TEST_REPORT_END");
	assert.equal(lines.every((line) => Buffer.byteLength(line) <= 128), true);
	const reconstructed = lines.slice(1, -1)
		.map((line) => line.replace(/^JS_UNIT_COMPONENT_TEST_REPORT_CHUNK \d+\/\d+ /u, ""))
		.join("");
	assert.deepEqual(JSON.parse(reconstructed), largeReport);
});

test("runnable test selection runs unit, behavior and source-contract suites alike", async () => {
	const { selectRunnableTestFiles } = await import("./run-js-unit-tests.mjs");
	const runnableFiles = selectRunnableTestFiles([
		{ filePath: "components/unit.test.js", source: NODE_TEST_SOURCE },
		{ filePath: "components/contract.source.test.js", source: NODE_TEST_SOURCE },
		{ filePath: "components/render.behavior.test.js", source: NODE_TEST_SOURCE },
		{ filePath: "components/legacy-drift.test.js", source: NODE_TEST_SOURCE },
		{ filePath: "scripts/not-node-test.test.js", source: "module.exports = {};" },
	], { legacyDriftTestFiles: new Set(["components/legacy-drift.test.js"]) });

	assert.deepEqual(runnableFiles, [
		"components/unit.test.js",
		"components/contract.source.test.js",
		"components/render.behavior.test.js",
	]);
});

test("CLI selection options can narrow tests to named slices", async () => {
	const { buildSelectionOptions, parseTestSelectionArgs, selectRunnableTestFiles } = await import("./run-js-unit-tests.mjs");
	const selection = parseTestSelectionArgs([
		"--prefix",
		"backend/,app/api/",
		"--file=components/allowed.test.js",
	]);
	const options = buildSelectionOptions(selection);
	const runnableFiles = selectRunnableTestFiles([
		{
			filePath: "backend/included.test.js",
			source: 'const test = require("node:test");',
		},
		{
			filePath: "app/api/included.test.ts",
			source: 'import test from "node:test";',
		},
		{
			filePath: "components/allowed.test.js",
			source: 'const test = require("node:test");',
		},
		{
			filePath: "components/stable-outside-selection.test.js",
			source: 'const test = require("node:test");',
		},
		{
			filePath: "lib/excluded.test.js",
			source: 'const test = require("node:test");',
		},
	], options);

	assert.deepEqual(selection, {
		files: ["components/allowed.test.js"],
		prefixes: ["backend/", "app/api/"],
	});
	assert.deepEqual(runnableFiles, [
		"backend/included.test.js",
		"app/api/included.test.ts",
		"components/allowed.test.js",
	]);
});

test("CLI selection rejects unknown or incomplete arguments", async () => {
	const { parseTestSelectionArgs } = await import("./run-js-unit-tests.mjs");

	assert.throws(() => parseTestSelectionArgs(["--prefix"]), /requires a value/);
	assert.throws(() => parseTestSelectionArgs(["--unknown"]), /Unknown argument/);
});

test("component coverage report is skipped for non-component slices", async () => {
	const { shouldReportComponentCoverage } = await import("./run-js-unit-tests.mjs");

	assert.equal(shouldReportComponentCoverage(), true);
	assert.equal(shouldReportComponentCoverage({ prefixes: ["backend/"] }), false);
	assert.equal(shouldReportComponentCoverage({ prefixes: ["components/website/"] }), true);
	assert.equal(shouldReportComponentCoverage({ files: ["components/ui/button.test.js"] }), true);
});

test("test discovery skips files deleted or moved before staging", async () => {
	const { filterExistingTestFiles } = await import("./run-js-unit-tests.mjs");

	assert.deepEqual(
		filterExistingTestFiles([
			"components/projects/rovo/components/deleted.test.js",
			"components/projects/rovo-core/components/moved.test.js",
		], (filePath) => filePath.includes("rovo-core")),
		["components/projects/rovo-core/components/moved.test.js"],
	);
});

test("not-run lists fail validation for missing paths and for a path in both lists", async () => {
	const { assertListedTestFilesExist } = await import("./run-js-unit-tests.mjs");

	assert.throws(
		() => assertListedTestFilesExist({
			fileExists: (filePath) => filePath === "components/present.test.js" || filePath === "components/both.test.js",
			legacyDriftTestFiles: ["components/present.test.js", "components/deleted-legacy.test.js", "components/both.test.js"],
			skippedTestFiles: ["app/data/moved.contract.test.ts", "components/both.test.js"],
		}),
		new Error([
			"js-unit-tests: the not-run lists name paths that do not exist or appear in both lists; remove them:",
			"- scripts/js-unit-test-legacy-drift.mjs: components/deleted-legacy.test.js",
			"- scripts/js-unit-test-skipped.mjs: app/data/moved.contract.test.ts",
			"- listed twice: components/both.test.js",
		].join("\n")),
	);
});

test("Jira and ASX tests renamed to v0, v1, and v2 remain source-contract suites", async () => {
	const { existsSync } = require("node:fs");
	const { classifyTestFile } = await import("./run-js-unit-tests.mjs");

	for (const filePath of [
		"components/projects/jira-golden-journey-v0/kanban-stage.source.test.js",
		"components/projects/jira-golden-journey-v0/queue-stage.source.test.js",
		"components/projects/jira-golden-journey-v1/agent-chat-demo.source.test.js",
		"components/projects/jira-golden-journey-v1/kanban-stage.source.test.js",
		"components/projects/jira-golden-journey-v2/jira-golden-journey-v2.source.test.js",
		"app/data/jira-golden-journey-v1-contract.source.test.js",
	]) {
		assert.equal(existsSync(filePath), true, `${filePath} should exist`);
		assert.equal(classifyTestFile(filePath), "source-contract", `${filePath} should remain source-contract`);
	}
});

test("every checked-in not-run path exists and is listed once", async () => {
	const { assertListedTestFilesExist } = await import("./run-js-unit-tests.mjs");
	assert.doesNotThrow(() => assertListedTestFilesExist());
});

test("test batching groups ordinary node tests by directory and isolates vm-module tests", async () => {
	const { ALIAS_HOOK_PATH, buildTestFileBatches } = await import("./run-js-unit-tests.mjs");
	const alias = ["--import", ALIAS_HOOK_PATH];
	const sourceByFile = new Map([
		["backend/a.test.js", 'const test = require("node:test");'],
		["backend/b.test.js", 'const test = require("node:test");'],
		["backend/lib/c.test.js", 'const test = require("node:test");'],
		["scripts/vm.test.js", "const module = new vm.SourceTextModule('');"],
		["scripts/ordinary.test.js", 'const test = require("node:test");'],
	]);

	assert.deepEqual(
		buildTestFileBatches([...sourceByFile.keys()], {
			readFile: (filePath) => sourceByFile.get(filePath),
		}),
		[
			{
				files: ["backend/a.test.js", "backend/b.test.js"],
				nodeArgs: alias,
				reason: "directory",
			},
			{
				files: ["backend/lib/c.test.js"],
				nodeArgs: alias,
				reason: "directory",
			},
			{
				files: ["scripts/vm.test.js"],
				nodeArgs: ["--experimental-vm-modules", ...alias],
				reason: "vm-modules",
			},
			{
				files: ["scripts/ordinary.test.js"],
				nodeArgs: alias,
				reason: "directory",
			},
		],
	);
});

test("runTestFiles invokes node:test once per batch", async () => {
	const { ALIAS_HOOK_PATH, runTestFiles } = await import("./run-js-unit-tests.mjs");
	const calls = [];
	const sourceByFile = new Map([
		["backend/a.test.js", 'const test = require("node:test");'],
		["backend/b.test.js", 'const test = require("node:test");'],
		["scripts/vm.test.js", "const module = new vm.SyntheticModule([], () => {});"],
	]);

	runTestFiles([...sourceByFile.keys()], {
		readFile: (filePath) => sourceByFile.get(filePath),
		spawn: (command, args, options) => {
			calls.push({ args, command, options });
			return { status: 0 };
		},
	});

	assert.deepEqual(calls.map(({ args, command, options }) => ({ args, command, stdio: options.stdio })), [
		{
			command: process.execPath,
			args: ["--import", ALIAS_HOOK_PATH, "--test", "backend/a.test.js", "backend/b.test.js"],
			stdio: "inherit",
		},
		{
			command: process.execPath,
			args: ["--experimental-vm-modules", "--import", ALIAS_HOOK_PATH, "--test", "scripts/vm.test.js"],
			stdio: "inherit",
		},
	]);
	// Each batch carries its own leak-check marker on top of the runner's environment.
	const markers = calls.map(({ options }) => options.env.VPK_UNIT_BATCH);
	assert.ok(markers.every((marker) => /^[0-9a-f-]{36}$/u.test(marker)), "every batch has a marker");
	assert.notEqual(markers[0], markers[1]);
	assert.equal(calls[0].options.env.PATH, process.env.PATH);
});

test("a failing batch stops the run unless --keep-going, which still reports failure", async () => {
	const { parseTestSelectionArgs, runTestFiles } = await import("./run-js-unit-tests.mjs");
	const sourceByFile = new Map([
		["backend/a.test.js", 'const test = require("node:test");'],
		["scripts/b.test.js", 'const test = require("node:test");'],
	]);
	const run = (keepGoing) => {
		const calls = [];
		const result = runTestFiles([...sourceByFile.keys()], {
			keepGoing,
			log: () => {},
			readFile: (filePath) => sourceByFile.get(filePath),
			spawn: (command, args) => {
				calls.push(args.at(-1));
				return { status: calls.length === 1 ? 1 : 0 };
			},
		});
		return { calls, status: result.status };
	};
	assert.deepEqual(run(false), { calls: ["backend/a.test.js"], status: 1 });
	assert.deepEqual(run(true), { calls: ["backend/a.test.js", "scripts/b.test.js"], status: 1 });
	assert.equal(parseTestSelectionArgs(["--keep-going", "--file", "a.test.js"]).keepGoing, true);
	assert.equal(parseTestSelectionArgs(["--file", "a.test.js"]).keepGoing, undefined);
});

test("four shards cover the inventory and ordinary Butter growth exactly once within an indivisible-batch bound", async () => {
	const { readFileSync } = require("node:fs");
	const { buildTestFileBatches, listCandidateTestFiles, partitionTestBatches, selectRunnableTestFiles } = await import("./run-js-unit-tests.mjs");
	const entries = listCandidateTestFiles().map((filePath) => ({ filePath, source: readFileSync(filePath, "utf8") }));
	const selected = selectRunnableTestFiles(entries);
	const growth = ["council-growth-one", "council-growth-two"].map((name) => `components/blocks/jira-work-item/project-butter/${name}.test.js`);
	assert.ok(selected.length > 0);
	assert.ok(growth.every((file) => !selected.includes(file)));
	for (const files of [selected, [...selected, ...growth]]) {
		const batches = buildTestFileBatches(files, { readFile: (file) => growth.includes(file) ? NODE_TEST_SOURCE : readFileSync(file, "utf8") });
		const shards = partitionTestBatches(batches);
		const union = shards.flatMap((shard) => shard.batches.flatMap((batch) => batch.files));
		assert.equal(shards.length, 4);
		assert.equal(new Set(union).size, union.length);
		assert.deepEqual([...union].sort(), [...files].sort());
		assert.deepEqual(partitionTestBatches([...batches].reverse()), shards);
		const largestBatch = Math.max(...batches.map((batch) => partitionTestBatches([batch])[0].seconds));
		const spread = Math.max(...shards.map((shard) => shard.seconds)) - Math.min(...shards.map((shard) => shard.seconds));
		assert.ok(spread <= largestBatch, `Spread ${spread} exceeds largest indivisible batch ${largestBatch}`);
	}
});

test("new batches use deterministic file weights and VM batches retain their flags", async () => {
	const { ALIAS_HOOK_PATH, buildTestFileBatches, partitionTestBatches } = await import("./run-js-unit-tests.mjs");
	const files = ["z/vm.test.js", "a/a.test.js", "a/b.test.js", "b/a.test.js", "c/a.test.js", "d/a.test.js"];
	const batches = buildTestFileBatches(files, { readFile: (file) => file.includes("vm") ? "vm.SourceTextModule" : NODE_TEST_SOURCE });
	const shards = partitionTestBatches(batches, {});
	assert.deepEqual(shards.map((shard) => shard.seconds), [2, 2, 1, 1]);
	const vm = shards.flatMap((shard) => shard.batches).find((batch) => batch.reason === "vm-modules");
	assert.deepEqual(vm.nodeArgs, ["--experimental-vm-modules", "--import", ALIAS_HOOK_PATH]);
	assert.deepEqual(partitionTestBatches([...batches].reverse(), {}), shards);
});

test("shard arguments fail closed and cannot bypass full manifest validation through selection", async () => {
	const { parseTestSelectionArgs } = await import("./run-js-unit-tests.mjs");
	for (const value of ["0/4", "5/4", "1/3", "1/5", "1", "01/4", "1.5/4", "1/4/4", "", "--file"]) {
		assert.throws(() => parseTestSelectionArgs(["--shard", value]), /--shard/);
	}
	assert.throws(() => parseTestSelectionArgs(["--shard=1/4", "--shard=2/4"]), /--shard/);
	assert.throws(() => parseTestSelectionArgs(["--shard=1/4", "--prefix=backend/"]), /cannot be combined/);
	assert.throws(() => parseTestSelectionArgs(["--file=x.test.js", "--shard=1/4"]), /cannot be combined/);
	assert.deepEqual(parseTestSelectionArgs(["--shard", "4/4"]), { files: [], prefixes: [], shard: 4 });
});

test("batch failures print identity, duration and summary, and preserve a nonzero exit", async () => {
	const { runTestFiles } = await import("./run-js-unit-tests.mjs");
	const lines = [];
	let clock = 0;
	const result = runTestFiles(["a/a.test.js", "b/b.test.js"], {
		readFile: () => NODE_TEST_SOURCE,
		log: (line) => lines.push(line),
		now: () => { clock += 250; return clock; },
		spawn: () => ({ status: null, signal: "SIGTERM" }),
	});
	assert.equal(result.status, 1);
	assert.equal(result.timings.length, 1);
	assert.equal(result.timings[0].seconds, 0.25);
	assert.ok(lines.some((line) => line.includes("completed 1/2")));
	assert.ok(lines.some((line) => line.includes('"signal":"SIGTERM"')));
});

test("every shard CLI rejects a silent suite or a stale not-run list before running tests", () => {
	const { spawnSync } = require("node:child_process");
	const { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
	const { tmpdir } = require("node:os");
	const path = require("node:path");
	const root = mkdtempSync(path.join(tmpdir(), "vpk-unit-shard-"));
	try {
		mkdirSync(path.join(root, "components"));
		mkdirSync(path.join(root, "lib"));
		for (const file of ["run-js-unit-tests.mjs", "js-unit-test-timings.json", "verify-eslint-suppressions.js", "lib/register-alias-hook.mjs", "lib/heavy-run-lock.js", "lib/memory-pressure.js", "lib/test-process.js"]) {
			copyFileSync(path.join(__dirname, file), path.join(root, file === "run-js-unit-tests.mjs" ? "runner.mjs" : file));
		}
		writeFileSync(path.join(root, "js-unit-test-skipped.mjs"), "export const SKIPPED_TEST_FILES = {};\nexport const SKIPPED_TEST_PREFIXES = {};\n");
		writeFileSync(path.join(root, "components/new.test.js"), `${NODE_TEST_SOURCE}\nthrow new Error('SHOULD_NOT_RUN');`);
		assert.equal(spawnSync("git", ["init", "--quiet", root]).status, 0);
		const cases = [
			{ legacy: ["components/missing.test.js"], expected: /do not exist/u },
			{ legacy: [], silent: true, expected: /would run without reporting/u },
		];
		for (const { legacy, silent, expected } of cases) {
			writeFileSync(path.join(root, "js-unit-test-legacy-drift.mjs"), `export const LEGACY_DRIFT_TEST_FILES = ${JSON.stringify(legacy)};\n`);
			if (silent) writeFileSync(path.join(root, "components/silent.test.js"), "module.exports = {};\n");
			for (let shard = 1; shard <= 4; shard += 1) {
				const result = spawnSync(process.execPath, ["runner.mjs", "--shard", `${shard}/4`], { cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_BASE_REF: "" } });
				assert.equal(result.status, 1);
				assert.match(result.stderr, expected);
				assert.doesNotMatch(`${result.stdout}${result.stderr}`, /SHOULD_NOT_RUN/u);
			}
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});


test("--parallel runs the longest batches first on N workers and prints each batch as one block", async () => {
	const { runTestFilesParallel, weighTestBatches, buildTestFileBatches } = await import("./run-js-unit-tests.mjs");
	const files = ["a/1.test.js", "a/2.test.js", "a/3.test.js", "b/1.test.js", "c/1.test.js", "d/1.test.js"];
	const timings = { a: [3, 30], b: [1, 1], c: [1, 20], d: [1, 5] };
	const batches = buildTestFileBatches(files, { readFile: () => NODE_TEST_SOURCE });
	assert.deepEqual(weighTestBatches(batches, timings).map(({ batch }) => batch.files[0].split("/")[0]), ["a", "c", "d", "b"]);

	let active = 0;
	let peak = 0;
	const started = [];
	const spawn = async (command, args) => {
		started.push(args.at(-1).split("/")[0]);
		active += 1;
		peak = Math.max(peak, active);
		await new Promise((resolve) => setTimeout(resolve, 5));
		active -= 1;
		return { output: `ran ${args.filter((arg) => arg.endsWith(".test.js")).join(" ")}\n`, signal: null, status: 0 };
	};
	let text = "";
	const result = await runTestFilesParallel(files, {
		cpus: 8, log: () => {}, parallel: 2, readFile: () => NODE_TEST_SOURCE, spawn, write: (chunk) => { text += chunk; },
	});
	assert.equal(result.status, 0);
	assert.equal(peak, 2);
	assert.equal(result.timings.length, 4);
	// Without measured timings for these ids, the three-file batch weighs most.
	assert.equal(started[0], "a");
	assert.match(text, /js-unit-tests: batch a \(3 files, directory\)\nran a\/1\.test\.js a\/2\.test\.js a\/3\.test\.js\n/u);
});

test("--parallel splits the CPUs between workers and stops starting batches after a failure unless --keep-going", async () => {
	const { parseTestSelectionArgs, resolveParallel, runTestFilesParallel, testConcurrencyFor } = await import("./run-js-unit-tests.mjs");
	assert.equal(testConcurrencyFor(4, 14), 3);
	assert.equal(testConcurrencyFor(16, 8), 1);
	const roomy = { availableGb: 40, pressureLevel: 1, swapUsedGb: 2 };
	assert.equal(resolveParallel("auto", 14, roomy), 7);
	assert.equal(resolveParallel("auto", 32, roomy), 8);
	assert.equal(resolveParallel("auto", 1, roomy), 1);
	assert.equal(resolveParallel("3"), 3);
	assert.throws(() => resolveParallel("0"), /positive integer or auto/u);
	assert.equal(parseTestSelectionArgs(["--parallel", "2"]).parallel, 2);
	assert.equal(parseTestSelectionArgs(["--parallel=auto"]).parallel, "auto", "auto is sized when the run starts");
	assert.throws(() => parseTestSelectionArgs(["--parallel"]), /--parallel requires/u);

	const files = ["a/1.test.js", "b/1.test.js", "c/1.test.js", "d/1.test.js"];
	const run = async (keepGoing) => {
		const calls = [];
		const spawn = async (command, args) => {
			calls.push(args);
			return { output: "", signal: null, status: args.at(-1).startsWith("a/") ? 1 : 0 };
		};
		const result = await runTestFilesParallel(files, { cpus: 4, keepGoing, log: () => {}, parallel: 1, readFile: () => NODE_TEST_SOURCE, spawn, write: () => {} });
		return { calls, status: result.status };
	};
	const stopped = await run(false);
	assert.equal(stopped.status, 1);
	assert.equal(stopped.calls.length, 1);
	assert.ok(stopped.calls[0].includes("--test-concurrency=4"));
	const all = await run(true);
	assert.equal(all.status, 1);
	assert.equal(all.calls.length, 4);
});

test("--parallel auto sizes itself from cores and available memory, and runs serially under pressure", async () => {
	const { autoParallel } = await import("./run-js-unit-tests.mjs");
	assert.deepEqual(autoParallel({ cpus: 14, memory: { availableGb: 40, pressureLevel: 1, swapUsedGb: 2 } }), { parallel: 7, note: null });
	const tight = autoParallel({ cpus: 14, memory: { availableGb: 6.4, pressureLevel: 1, swapUsedGb: 2 } });
	assert.equal(tight.parallel, 3);
	assert.match(tight.note, /3 worker\(s\) for 6\.4 GB available memory/u);
	assert.equal(autoParallel({ cpus: 14, memory: { availableGb: 0.5, pressureLevel: 1, swapUsedGb: 2 } }).parallel, 1);
	const swapping = autoParallel({ cpus: 14, memory: { availableGb: 40, pressureLevel: LEVEL - 1, swapUsedGb: OVER } });
	assert.equal(swapping.parallel, 1);
	assert.match(swapping.note, new RegExp(`memory pressure \\(swap in use is ${OVER} GB >= ${SWAP} GB\\): running batches one at a time`, "u"));
	assert.equal(autoParallel({ cpus: 14, memory: { availableGb: 40, pressureLevel: LEVEL, swapUsedGb: 1 } }).parallel, 1);
	assert.deepEqual(autoParallel({ cpus: 14, memory: { availableGb: null, pressureLevel: null, swapUsedGb: null } }), { parallel: 7, note: null });
});
