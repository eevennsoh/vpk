const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const REALTIME_STATE_ACTIONS_SOURCE = readSource("use-rovo-app-realtime-state-actions.ts");

test("Rovo app core delegates realtime state replacement and mutation wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-realtime-state-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppRealtimeStateActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /mutateRealtimeMessagesState/u);
	assert.match(CORE_HOOK_SOURCE, /replaceRealtimeMessagesState/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /realtimeMessagesVersionRef\.current \+= 1/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /setRealtimeMessages\(nextMessages\)/u);

	assert.match(REALTIME_STATE_ACTIONS_SOURCE, /export function useRovoAppRealtimeStateActions/u);
	assert.match(REALTIME_STATE_ACTIONS_SOURCE, /realtimeMessagesVersionRef\.current \+= 1/u);
	assert.match(REALTIME_STATE_ACTIONS_SOURCE, /setRealtimeMessages\(nextMessages\)/u);
	assert.match(REALTIME_STATE_ACTIONS_SOURCE, /updater\(realtimeMessagesRef\.current\)/u);
});
