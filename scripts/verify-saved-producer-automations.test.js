const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const EXPECTED_PRODUCER_IDS = [
	"bug-scan",
	"code-simplification",
	"correction-ladder",
	"dependency-sweep",
	"deprecation-audit",
	"engineering-improvement-map",
	"frontend-runtime-audit",
	"interface-contract-audit",
	"performance-audit",
	"test-coverage",
	"ui-design-quality-audit",
	"update-agents-md",
	"verification-maintenance",
];

function writeAutomation(root, id, promptLine) {
	const automationDir = path.join(root, id);
	mkdirSync(automationDir, { recursive: true });
	writeFileSync(path.join(automationDir, "automation.toml"), [
		"version = 1",
		`id = "${id}"`,
		'kind = "cron"',
		`name = "${id}"`,
		promptLine,
		'status = "ACTIVE"',
	].join("\n"));
}

test("expected producer inventory names all thirteen saved jobs", async () => {
	const { EXPECTED_PRODUCER_AUTOMATION_IDS } = await import("./verify-saved-producer-automations.mjs");

	assert.deepEqual(EXPECTED_PRODUCER_AUTOMATION_IDS, EXPECTED_PRODUCER_IDS);
});

test("validator accepts a producer that delegates generic policy to the shared skill", async () => {
	const { validateAutomationStore } = await import("./verify-saved-producer-automations.mjs");
	const automationRoot = mkdtempSync(path.join(os.tmpdir(), "saved-producer-valid-"));

	try {
		writeAutomation(
			automationRoot,
			"bug-scan",
			'prompt = "Invoke `$vpk-scheduled-automation`, then inspect one evidenced regression and stop when no candidate is strong enough."',
		);

		assert.deepEqual(validateAutomationStore({
			automationRoot,
			expectedIds: ["bug-scan"],
		}), {
			automationIds: ["bug-scan"],
			diagnostics: [],
		});
	} finally {
		rmSync(automationRoot, { force: true, recursive: true });
	}
});

test("validator rejects negated or historical-only skill mentions", async () => {
	const { validateAutomationStore } = await import("./verify-saved-producer-automations.mjs");
	const automationRoot = mkdtempSync(path.join(os.tmpdir(), "saved-producer-negated-policy-"));

	try {
		for (const [id, prompt] of [
			["bug-scan", "Do not invoke `$vpk-scheduled-automation`; inspect the task directly."],
			["test-coverage", "Historical note: `$vpk-scheduled-automation` used to own this task."],
		]) {
			writeAutomation(automationRoot, id, `prompt = ${JSON.stringify(prompt)}`);
		}

		assert.deepEqual(validateAutomationStore({
			automationRoot,
			expectedIds: ["bug-scan", "test-coverage"],
		}).diagnostics, [
			{ automationId: "bug-scan", categories: ["missing-shared-policy"] },
			{ automationId: "test-coverage", categories: ["missing-shared-policy"] },
		]);
	} finally {
		rmSync(automationRoot, { force: true, recursive: true });
	}
});

test("validator reports missing policy and duplicated shared rules by category only", async () => {
	const { formatDiagnostics, validateAutomationStore } = await import("./verify-saved-producer-automations.mjs");
	const automationRoot = mkdtempSync(path.join(os.tmpdir(), "saved-producer-missing-policy-"));
	const secret = "do-not-print-this-secret";

	try {
		writeAutomation(
			automationRoot,
			"bug-scan",
			`prompt = "${secret}. Run all pnpm commands via corepack pnpm. Run corepack pnpm run ci:pr. Do not merge from this producer job."`,
		);
		const result = validateAutomationStore({
			automationRoot,
			expectedIds: ["bug-scan"],
		});
		const output = formatDiagnostics(result);

		assert.deepEqual(result.diagnostics, [
			{
				automationId: "bug-scan",
				categories: ["missing-shared-policy"],
			},
			{
				automationId: "bug-scan",
				categories: ["corepack-policy", "full-pr-validation", "no-self-merge"],
			},
		]);
		assert.doesNotMatch(output, new RegExp(secret));
		assert.equal(
			output,
			"ERROR bug-scan: missing-shared-policy\n" +
				"ERROR bug-scan: duplicated-shared-policy[corepack-policy,full-pr-validation,no-self-merge]",
		);
	} finally {
		rmSync(automationRoot, { force: true, recursive: true });
	}
});

test("validator classifies malformed records without echoing their contents", async () => {
	const { formatDiagnostics, validateAutomationStore } = await import("./verify-saved-producer-automations.mjs");
	const automationRoot = mkdtempSync(path.join(os.tmpdir(), "saved-producer-malformed-"));

	try {
		writeAutomation(
			automationRoot,
			"bug-scan",
			'prompt = "Invoke `$vpk-scheduled-automation` but never close this value',
		);
		const result = validateAutomationStore({
			automationRoot,
			expectedIds: ["bug-scan"],
		});

		assert.deepEqual(result.diagnostics, [{
			automationId: "bug-scan",
			categories: ["malformed-record"],
		}]);
		assert.equal(formatDiagnostics(result), "ERROR bug-scan: malformed-record");
	} finally {
		rmSync(automationRoot, { force: true, recursive: true });
	}
});
