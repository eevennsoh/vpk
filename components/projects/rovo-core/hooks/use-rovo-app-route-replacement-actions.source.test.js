const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const ROUTE_REPLACEMENT_ACTIONS_SOURCE = readSource("use-rovo-app-route-replacement-actions.ts");

test("Rovo app core delegates route replacement and pending route flush wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-route-replacement-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppRouteReplacementActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /flushPendingRouteReplacement/u);
	assert.match(CORE_HOOK_SOURCE, /replaceRovoAppRoute/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /useRouter\(\)/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /flushPendingRovoAppRouteReplacement/u);

	assert.match(ROUTE_REPLACEMENT_ACTIONS_SOURCE, /export function useRovoAppRouteReplacementActions/u);
	assert.match(ROUTE_REPLACEMENT_ACTIONS_SOURCE, /useRouter\(\)/u);
	assert.match(ROUTE_REPLACEMENT_ACTIONS_SOURCE, /router\.replace\(path\)/u);
	assert.match(ROUTE_REPLACEMENT_ACTIONS_SOURCE, /flushPendingRovoAppRouteReplacement\(\{/u);
	assert.match(ROUTE_REPLACEMENT_ACTIONS_SOURCE, /replaceHistoryPath: replaceRovoAppHistoryPath/u);
});
