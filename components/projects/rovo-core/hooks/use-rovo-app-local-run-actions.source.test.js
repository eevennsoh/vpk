const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const LOCAL_RUN_ACTIONS_SOURCE = readSource("use-rovo-app-local-run-actions.ts");

test("Rovo app core delegates local active-run state transitions to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-local-run-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppLocalRunActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /markLocalThreadRunPending/u);
	assert.match(CORE_HOOK_SOURCE, /setLocalThreadActiveRun/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /createRovoAppLocalActiveRun/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /updateRovoAppThreadActiveRun/u);

	assert.match(LOCAL_RUN_ACTIONS_SOURCE, /export function useRovoAppLocalRunActions/u);
	assert.match(LOCAL_RUN_ACTIONS_SOURCE, /createRovoAppLocalActiveRun/u);
	assert.match(LOCAL_RUN_ACTIONS_SOURCE, /updateRovoAppThreadActiveRun/u);
	assert.match(LOCAL_RUN_ACTIONS_SOURCE, /resetObservedTurnComplete\(\)/u);
	assert.match(LOCAL_RUN_ACTIONS_SOURCE, /setAttachedRunStatus\(status\)/u);
});
