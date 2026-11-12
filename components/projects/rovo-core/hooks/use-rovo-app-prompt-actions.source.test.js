const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const PROMPT_ACTIONS_SOURCE = readSource("use-rovo-app-prompt-actions.ts");

test("Rovo app core delegates prompt dispatch wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-prompt-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppPromptActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /dispatchPromptNow/u);
	assert.match(CORE_HOOK_SOURCE, /submitPrompt/u);
	assert.match(CORE_HOOK_SOURCE, /suggestedPrompt/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /dispatchRovoAppPromptNow/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /submitRovoAppPromptDispatch/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /buildRovoAppQueuedPromptAction/u);

	assert.match(PROMPT_ACTIONS_SOURCE, /export function useRovoAppPromptActions/u);
	assert.match(PROMPT_ACTIONS_SOURCE, /dispatchRovoAppPromptNow/u);
	assert.match(PROMPT_ACTIONS_SOURCE, /submitRovoAppPromptDispatch/u);
	assert.match(PROMPT_ACTIONS_SOURCE, /buildRovoAppQueuedPromptAction/u);
});
