const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const THREAD_LIFECYCLE_ACTIONS_SOURCE = readSource("use-rovo-app-thread-lifecycle-actions.ts");

test("Rovo app core delegates thread lifecycle action wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-thread-lifecycle-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppThreadLifecycleActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /refreshThreads/u);
	assert.match(CORE_HOOK_SOURCE, /ensureThread/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /refreshRovoAppThreadsWithLifecycle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /hydrateRovoAppThreadStateWithLifecycle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /subscribeToRovoAppRunWithLifecycle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /resetRovoAppToBlankThreadState/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /leaveRovoAppActiveThreadForBackground/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /loadRovoAppThreadWithLifecycle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /activateBlankRovoAppThreadState/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /ensureRovoAppThreadWithLifecycle/u);

	assert.match(
		THREAD_LIFECYCLE_ACTIONS_SOURCE,
		/export function useRovoAppThreadLifecycleActions/u,
	);
	assert.match(THREAD_LIFECYCLE_ACTIONS_SOURCE, /refreshRovoAppThreadsWithLifecycle/u);
	assert.match(THREAD_LIFECYCLE_ACTIONS_SOURCE, /hydrateRovoAppThreadStateWithLifecycle/u);
	assert.match(THREAD_LIFECYCLE_ACTIONS_SOURCE, /subscribeToRovoAppRunWithLifecycle/u);
	assert.match(THREAD_LIFECYCLE_ACTIONS_SOURCE, /resetRovoAppToBlankThreadState/u);
	assert.match(THREAD_LIFECYCLE_ACTIONS_SOURCE, /leaveRovoAppActiveThreadForBackground/u);
	assert.match(THREAD_LIFECYCLE_ACTIONS_SOURCE, /loadRovoAppThreadWithLifecycle/u);
	assert.match(THREAD_LIFECYCLE_ACTIONS_SOURCE, /activateBlankRovoAppThreadState/u);
	assert.match(THREAD_LIFECYCLE_ACTIONS_SOURCE, /ensureRovoAppThreadWithLifecycle/u);
});
