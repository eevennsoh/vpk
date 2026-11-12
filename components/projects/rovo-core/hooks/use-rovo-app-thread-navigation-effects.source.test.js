const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const NAVIGATION_HOOK_SOURCE = readSource("use-rovo-app-thread-navigation-effects.ts");

test("Rovo app core delegates thread navigation effects to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-thread-navigation-effects";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppThreadNavigationEffects\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /getThreadIdFromPath: getRovoAppThreadIdFromPath/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /handleRovoAppThreadPopState/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /window\.addEventListener\("popstate"/u);
	assert.doesNotMatch(
		CORE_HOOK_SOURCE,
		/useEffect\(\(\) => \{\n\t\tflushPendingRouteReplacement\(activeThreadId\);/u,
	);

	assert.match(
		NAVIGATION_HOOK_SOURCE,
		/export function useRovoAppThreadNavigationEffects/u,
	);
	assert.match(NAVIGATION_HOOK_SOURCE, /handleRovoAppThreadPopState/u);
	assert.match(NAVIGATION_HOOK_SOURCE, /window\.addEventListener\("popstate"/u);
	assert.match(NAVIGATION_HOOK_SOURCE, /flushPendingRouteReplacement\(activeThreadId\)/u);
});
