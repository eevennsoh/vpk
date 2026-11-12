const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const DISPATCH_PREP_ACTIONS_SOURCE = readSource("use-rovo-app-dispatch-prep-actions.ts");

test("Rovo app core delegates dispatch preparation actions to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-dispatch-prep-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppDispatchPrepActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /removeQueuedPrompt/u);
	assert.match(CORE_HOOK_SOURCE, /syncAgentModeForDispatch/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /syncRovoAppAgentModeForDispatch/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /lastSyncedAgentModeRef/u);

	assert.match(DISPATCH_PREP_ACTIONS_SOURCE, /export function useRovoAppDispatchPrepActions/u);
	assert.match(DISPATCH_PREP_ACTIONS_SOURCE, /syncRovoAppAgentModeForDispatch\(fetch, mode\)/u);
	assert.match(DISPATCH_PREP_ACTIONS_SOURCE, /lastSyncedAgentModeRef/u);
	assert.match(DISPATCH_PREP_ACTIONS_SOURCE, /lastSyncedAgentModeRef\.current = null/u);
	assert.match(DISPATCH_PREP_ACTIONS_SOURCE, /removeQueuedAction\(runtimeThreadId, id\)/u);
});
