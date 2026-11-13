const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const MODE_STATE_ACTIONS_SOURCE = readSource("use-rovo-app-mode-state-actions.ts");

test("Rovo app core delegates mode and direct-delegation state to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-mode-state-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppModeStateActions\(\)/u);
	assert.match(CORE_HOOK_SOURCE, /clearDirectDelegationState/u);
	assert.match(CORE_HOOK_SOURCE, /togglePlanMode/u);
	assert.match(CORE_HOOK_SOURCE, /toggleVoiceMode/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /setIsVoiceMode/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /setIsPlanMode/u);
	assert.doesNotMatch(
		CORE_HOOK_SOURCE,
		/setBackgroundDelegationMessageId\(null\);\n\t\tsetDelegationTurnStatus\("ready"\);\n\t\tsetDirectDelegationPhase\("idle"\);/u,
	);

	assert.match(MODE_STATE_ACTIONS_SOURCE, /export function useRovoAppModeStateActions/u);
	assert.match(MODE_STATE_ACTIONS_SOURCE, /setBackgroundDelegationMessageId\(null\)/u);
	assert.match(MODE_STATE_ACTIONS_SOURCE, /setDelegationTurnStatus\("ready"\)/u);
	assert.match(MODE_STATE_ACTIONS_SOURCE, /setDirectDelegationPhase\("idle"\)/u);
	assert.match(MODE_STATE_ACTIONS_SOURCE, /setIsVoiceMode\(\(prev\) => !prev\)/u);
	assert.match(MODE_STATE_ACTIONS_SOURCE, /setIsPlanMode\(\(previousMode\) => !previousMode\)/u);
});
