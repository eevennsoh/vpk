const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const ACTIVE_TURN_ACTIONS_SOURCE = readSource("use-rovo-app-active-turn-actions.ts");

test("Rovo app core delegates active turn and voice steer wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-active-turn-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppActiveTurnActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /interruptActiveTurn/u);
	assert.match(CORE_HOOK_SOURCE, /cancelThreadRun/u);
	assert.match(CORE_HOOK_SOURCE, /applyVoiceSteer/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /requestExplicitRovoAppCancel/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /cancelRovoAppThreadRunWithLifecycle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /interruptRovoAppActiveTurn/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /dispatchRovoAppVoiceSteer/u);

	assert.match(ACTIVE_TURN_ACTIONS_SOURCE, /export function useRovoAppActiveTurnActions/u);
	assert.match(ACTIVE_TURN_ACTIONS_SOURCE, /requestExplicitRovoAppCancel/u);
	assert.match(ACTIVE_TURN_ACTIONS_SOURCE, /cancelRovoAppThreadRunWithLifecycle/u);
	assert.match(ACTIVE_TURN_ACTIONS_SOURCE, /interruptRovoAppActiveTurn/u);
	assert.match(ACTIVE_TURN_ACTIONS_SOURCE, /dispatchRovoAppVoiceSteer/u);
});
