const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const THREAD_PERSISTENCE_HOOK_SOURCE = readSource("use-rovo-app-thread-persistence.ts");

test("Rovo app core delegates thread persistence orchestration to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-thread-persistence";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppThreadPersistence\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /createThread: createRovoAppThread/u);
	assert.match(CORE_HOOK_SOURCE, /updateThread: updateRovoAppThread/u);
	assert.match(CORE_HOOK_SOURCE, /normalizedMessages: normalizedRovoMessages/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /buildRovoAppThreadPersistencePlan/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /runRovoAppThreadPersistenceLifecycle/u);

	assert.match(
		THREAD_PERSISTENCE_HOOK_SOURCE,
		/export function useRovoAppThreadPersistence/u,
	);
	assert.match(THREAD_PERSISTENCE_HOOK_SOURCE, /buildRovoAppThreadPersistencePlan/u);
	assert.match(THREAD_PERSISTENCE_HOOK_SOURCE, /runRovoAppThreadPersistenceLifecycle/u);
	assert.match(THREAD_PERSISTENCE_HOOK_SOURCE, /lastPersistedKeyRef/u);
	assert.match(THREAD_PERSISTENCE_HOOK_SOURCE, /isHydratingThreadRef/u);
});
