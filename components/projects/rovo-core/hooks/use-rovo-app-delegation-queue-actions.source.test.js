const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const DELEGATION_QUEUE_ACTIONS_SOURCE = readSource("use-rovo-app-delegation-queue-actions.ts");

test("Rovo app core delegates delegation and queue wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-delegation-queue-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppDelegationQueueActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /delegateToRovo/u);
	assert.match(CORE_HOOK_SOURCE, /sendQueuedPromptNow/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /dispatchRovoAppDelegationNow/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /submitRovoAppDelegationDispatch/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /dispatchQueuedRovoAppActionImmediately/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /processRovoAppQueuedActions/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /buildRovoAppQueuedDelegationAction/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /resolveRovoAppQueuedActionDispatch/u);

	assert.match(
		DELEGATION_QUEUE_ACTIONS_SOURCE,
		/export function useRovoAppDelegationQueueActions/u,
	);
	assert.match(DELEGATION_QUEUE_ACTIONS_SOURCE, /dispatchRovoAppDelegationNow/u);
	assert.match(DELEGATION_QUEUE_ACTIONS_SOURCE, /submitRovoAppDelegationDispatch/u);
	assert.match(DELEGATION_QUEUE_ACTIONS_SOURCE, /dispatchQueuedRovoAppActionImmediately/u);
	assert.match(DELEGATION_QUEUE_ACTIONS_SOURCE, /processRovoAppQueuedActions/u);
	assert.match(DELEGATION_QUEUE_ACTIONS_SOURCE, /buildRovoAppQueuedDelegationAction/u);
	assert.match(DELEGATION_QUEUE_ACTIONS_SOURCE, /resolveRovoAppQueuedActionDispatch/u);
});
