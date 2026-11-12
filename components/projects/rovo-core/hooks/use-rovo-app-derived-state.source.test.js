const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const DERIVED_STATE_SOURCE = readSource("use-rovo-app-derived-state.ts");

test("Rovo app core delegates derived thread, document, queue, and smart-generation state to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-derived-state";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppDerivedState\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /activeDocumentContent/u);
	assert.match(CORE_HOOK_SOURCE, /backgroundStreamThreadIds/u);
	assert.match(CORE_HOOK_SOURCE, /reconcileThreadWithLocalTitle/u);
	assert.match(CORE_HOOK_SOURCE, /smartGenerationRequest/u);
	assert.match(CORE_HOOK_SOURCE, /runtimeThreadId/u);
	assert.match(CORE_HOOK_SOURCE, /queuedPrompts/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /getLatestDocumentContent/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /buildRovoAppSmartGenerationRequest/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /mergeRovoAppThreadWithLocalTitle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /documents\.find\(\(document\) => document\.id === activeDocumentId\)/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /queuedActionsByThreadId\[runtimeThreadId\] \?\? \[\]/u);

	assert.match(DERIVED_STATE_SOURCE, /export function useRovoAppDerivedState/u);
	assert.match(DERIVED_STATE_SOURCE, /getLatestDocumentContent\(activeDocument\)/u);
	assert.match(DERIVED_STATE_SOURCE, /buildRovoAppSmartGenerationRequest\(\{/u);
	assert.match(DERIVED_STATE_SOURCE, /mergeRovoAppThreadWithLocalTitle\(threadsRef\.current, thread\)/u);
	assert.match(DERIVED_STATE_SOURCE, /queuedActionsByThreadId\[runtimeThreadId\] \?\? \[\]/u);
});
