const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const TURN_LIFECYCLE_STATE_SOURCE = readSource("use-rovo-app-turn-lifecycle-state.ts");

test("Rovo app core delegates turn completion and hydration state to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-turn-lifecycle-state";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppTurnLifecycleState\(\)/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /setHasObservedTurnComplete/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /setThreadHydrationVersion/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /isHydratingThreadRef = useRef/u);

	assert.match(TURN_LIFECYCLE_STATE_SOURCE, /export function useRovoAppTurnLifecycleState/u);
	assert.match(TURN_LIFECYCLE_STATE_SOURCE, /setHasObservedTurnComplete/u);
	assert.match(TURN_LIFECYCLE_STATE_SOURCE, /setThreadHydrationVersion/u);
	assert.match(TURN_LIFECYCLE_STATE_SOURCE, /isHydratingThreadRef = useRef\(false\)/u);
	assert.match(TURN_LIFECYCLE_STATE_SOURCE, /threadHydrationVersion/u);
});
