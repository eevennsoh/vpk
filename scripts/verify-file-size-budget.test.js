const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	buildUpdatedAllowlist,
	countLines,
	evaluateFileSizeBudget,
	formatFailure,
	getGrowthLimit,
	isBudgetedTextFile,
	isExtensionlessNodeScript,
	listTrackedFiles,
	readBudgetEntries,
} = require("./verify-file-size-budget");

function nodeScriptSource(lineCount) {
	return ["#!/usr/bin/env node", ...Array.from({ length: lineCount - 1 }, (_, index) => `// line ${index + 2}`)].join("\n") + "\n";
}

test("counts logical lines with and without trailing newlines", () => {
	assert.equal(countLines(""), 0);
	assert.equal(countLines("one"), 1);
	assert.equal(countLines("one\n"), 1);
	assert.equal(countLines("one\ntwo"), 2);
	assert.equal(countLines("one\ntwo\n"), 2);
});

test("budgets only tracked source and documentation text extensions", () => {
	assert.equal(isBudgetedTextFile("backend/server.js"), true);
	assert.equal(isBudgetedTextFile("components/example.tsx"), true);
	assert.equal(isBudgetedTextFile(".agents/skills/example/SKILL.md"), true);
	assert.equal(isBudgetedTextFile("package.json"), false);
	assert.equal(isBudgetedTextFile("public/icon.svg"), false);
});

test("leaves vendored builds, replaced whole, out of the budget", () => {
	assert.equal(isBudgetedTextFile("public/1p/rovo-stage-kit/dist/rovo-stage.js"), false);
	assert.equal(isBudgetedTextFile("public/1p/rovo-stage-kit/GUIDE.md"), false);
	assert.equal(isBudgetedTextFile("public/1p/rovo-stage-kit-notes.md"), true);
});

test("detects new oversized files, growth, and stale allowlist entries", () => {
	const failures = evaluateFileSizeBudget([
		{
			filePath: "backend/server.js",
			lines: 110,
		},
		{
			filePath: "components/new.tsx",
			lines: 101,
		},
		{
			filePath: "components/small.tsx",
			lines: 20,
		},
		{
			filePath: "backend/runtime.js",
			lines: 51,
		},
	], {
		threshold: 100,
		growthBudgetPercent: 5,
		files: {
			"backend/server.js": 100,
			"components/deleted.tsx": 120,
		},
		maxLines: {
			"backend/runtime.js": 50,
			"backend/deleted-runtime.js": 75,
		},
	});

	assert.deepEqual(failures, [
		{
			type: "allowlisted-file-grew",
			filePath: "backend/server.js",
			lines: 110,
			recordedLines: 100,
			growthLimit: 105,
			growthBudgetPercent: 5,
		},
		{
			type: "new-oversized-file",
			filePath: "components/new.tsx",
			lines: 101,
			threshold: 100,
		},
		{
			type: "max-lines-exceeded",
			filePath: "backend/runtime.js",
			lines: 51,
			maxLines: 50,
		},
		{
			type: "stale-allowlist-entry",
			filePath: "components/deleted.tsx",
			recordedLines: 120,
		},
		{
			type: "stale-max-lines-entry",
			filePath: "backend/deleted-runtime.js",
			maxLines: 75,
		},
	]);
});

test("builds an updated allowlist from current files above the threshold and preserves strict budgets", () => {
	const allowlist = buildUpdatedAllowlist([
		{
			filePath: "components/a.tsx",
			lines: 101,
		},
		{
			filePath: "components/b.tsx",
			lines: 100,
		},
		{
			filePath: "backend/server.js",
			lines: 140,
		},
	], {
		threshold: 100,
		growthBudgetPercent: 7,
		maxLines: {
			"backend/server.js": 150,
		},
		files: {
			"components/deleted.tsx": 200,
		},
	});

	assert.deepEqual(allowlist, {
		version: 1,
		threshold: 100,
		growthBudgetPercent: 7,
		maxLines: {
			"backend/server.js": 150,
		},
		files: {
			"backend/server.js": 140,
			"components/a.tsx": 101,
		},
	});
});

test("skips deleted tracked paths while reading current budget entries", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-file-budget-entries-"));
	try {
		writeFileSync(path.join(cwd, "existing.ts"), "one\ntwo\n");

		assert.deepEqual(readBudgetEntries(["existing.ts", "missing.ts"], { cwd }), [
			{
				filePath: "existing.ts",
				lines: 2,
			},
		]);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("budgets extensionless files only when they start with a node shebang", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-file-budget-shebang-"));
	try {
		writeFileSync(path.join(cwd, "control-vpk"), nodeScriptSource(3));
		writeFileSync(path.join(cwd, "node-args"), "#!/usr/bin/env node --no-warnings\none\n");
		writeFileSync(path.join(cwd, "shell-tool"), "#!/bin/sh\necho one\n");
		writeFileSync(path.join(cwd, "nodejs-tool"), "#!/usr/bin/env nodejs\none\n");
		writeFileSync(path.join(cwd, "LICENSE"), "MIT\n");
		writeFileSync(path.join(cwd, "data.json"), "#!/usr/bin/env node\n");
		mkdirSync(path.join(cwd, "bin-dir"));
		symlinkSync("control-vpk", path.join(cwd, "linked-tool"));

		assert.equal(isExtensionlessNodeScript("control-vpk", { cwd }), true);
		assert.equal(isExtensionlessNodeScript("shell-tool", { cwd }), false);
		assert.equal(isExtensionlessNodeScript("bin-dir", { cwd }), false);
		assert.equal(isExtensionlessNodeScript("linked-tool", { cwd }), false);
		assert.equal(isExtensionlessNodeScript("missing-tool", { cwd }), false);
		assert.equal(isExtensionlessNodeScript("data.json", { cwd }), false);

		assert.deepEqual(readBudgetEntries([
			"control-vpk",
			"node-args",
			"shell-tool",
			"nodejs-tool",
			"LICENSE",
			"data.json",
			"bin-dir",
			"linked-tool",
			"missing-tool",
		], { cwd }), [
			{
				filePath: "control-vpk",
				lines: 3,
			},
			{
				filePath: "node-args",
				lines: 2,
			},
		]);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("an oversized extensionless node CLI fails the budget like any other source file", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-file-budget-cli-"));
	try {
		// Mirrors the pre-split 1340-line `.agents/skills/vpk-verify/scripts/control-vpk`.
		const cliPath = ".agents/skills/vpk-verify/scripts/control-vpk";
		mkdirSync(path.join(cwd, path.dirname(cliPath)), { recursive: true });
		writeFileSync(path.join(cwd, cliPath), nodeScriptSource(1340));

		const entries = readBudgetEntries([cliPath], { cwd });
		assert.deepEqual(entries, [{ filePath: cliPath, lines: 1340 }]);
		assert.deepEqual(evaluateFileSizeBudget(entries, { threshold: 1000, files: {} }), [
			{
				type: "new-oversized-file",
				filePath: cliPath,
				lines: 1340,
				threshold: 1000,
			},
		]);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("formats actionable failures", () => {
	assert.equal(getGrowthLimit(100, 5), 105);
	assert.match(formatFailure({
		type: "max-lines-exceeded",
		filePath: "backend/server.js",
		lines: 501,
		maxLines: 500,
	}), /explicit 500-line architecture budget/u);
	assert.match(formatFailure({
		type: "new-oversized-file",
		filePath: "components/new.tsx",
		lines: 101,
		threshold: 100,
	}), /components\/new\.tsx/);
});

test("lists tracked and untracked non-ignored files", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-file-budget-"));
	try {
		spawnSync("git", ["init"], { cwd, stdio: "ignore" });
		writeFileSync(path.join(cwd, ".gitignore"), "ignored.ts\n");
		writeFileSync(path.join(cwd, "tracked.ts"), "tracked\n");
		writeFileSync(path.join(cwd, "untracked.ts"), "untracked\n");
		writeFileSync(path.join(cwd, "ignored.ts"), "ignored\n");
		spawnSync("git", ["add", ".gitignore", "tracked.ts"], { cwd, stdio: "ignore" });

		assert.deepEqual(listTrackedFiles({ cwd }).sort(), [
			".gitignore",
			"tracked.ts",
			"untracked.ts",
		]);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});
