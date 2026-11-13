const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const COMPLETED_RUN_HOOK_SOURCE = readSource("use-rovo-app-completed-run-hydration.ts");

test("Rovo app core delegates completed active-run hydration to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-completed-run-hydration";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppCompletedRunHydration\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /currentActiveRun: currentThread\?\.activeRun/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /hydrateCompletedRovoAppActiveRun/u);

	assert.match(
		COMPLETED_RUN_HOOK_SOURCE,
		/export function useRovoAppCompletedRunHydration/u,
	);
	assert.match(COMPLETED_RUN_HOOK_SOURCE, /hydrateCompletedRovoAppActiveRun/u);
	assert.match(COMPLETED_RUN_HOOK_SOURCE, /setLocalThreadActiveRun/u);
	assert.match(COMPLETED_RUN_HOOK_SOURCE, /useChatStatus/u);
});
