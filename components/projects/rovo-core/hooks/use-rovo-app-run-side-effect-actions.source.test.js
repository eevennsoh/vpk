const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const RUN_SIDE_EFFECT_ACTIONS_SOURCE = readSource("use-rovo-app-run-side-effect-actions.ts");

test("Rovo app core delegates attached-run and completed-turn side effects to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-run-side-effect-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppRunSideEffectActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /handleAttachedRunChunk/u);
	assert.match(CORE_HOOK_SOURCE, /releaseCompletedUseChatTurnIfNeeded/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /handleRovoAppAttachedRunChunk/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /releaseCompletedRovoAppUseChatTurn/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /ACTIVE_TURN_STOP_TIMEOUT_MS/u);

	assert.match(RUN_SIDE_EFFECT_ACTIONS_SOURCE, /export function useRovoAppRunSideEffectActions/u);
	assert.match(RUN_SIDE_EFFECT_ACTIONS_SOURCE, /handleRovoAppAttachedRunChunk\(\{/u);
	assert.match(RUN_SIDE_EFFECT_ACTIONS_SOURCE, /releaseCompletedRovoAppUseChatTurn\(\{/u);
	assert.match(RUN_SIDE_EFFECT_ACTIONS_SOURCE, /timeoutMs: ACTIVE_TURN_STOP_TIMEOUT_MS/u);
});
