const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const THREAD_REFRESH_HOOK_SOURCE = readSource("use-rovo-app-thread-refresh-effects.ts");

test("Rovo app core delegates thread refresh and initial route hydration effects", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-thread-refresh-effects";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppThreadRefreshEffects\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /lastLoadedInitialThreadIdRef/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /startRovoAppPassiveThreadRefresh/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /shouldLoadInitialRovoAppThread/u);
	assert.doesNotMatch(
		CORE_HOOK_SOURCE,
		/void refreshThreads\(\{ reportBackendUnavailable: false \}\);/u,
	);

	assert.match(
		THREAD_REFRESH_HOOK_SOURCE,
		/export function useRovoAppThreadRefreshEffects/u,
	);
	assert.match(THREAD_REFRESH_HOOK_SOURCE, /startRovoAppPassiveThreadRefresh/u);
	assert.match(THREAD_REFRESH_HOOK_SOURCE, /shouldLoadInitialRovoAppThread/u);
	assert.match(THREAD_REFRESH_HOOK_SOURCE, /void refreshThreads\(\{ reportBackendUnavailable: false \}\);/u);
	assert.match(THREAD_REFRESH_HOOK_SOURCE, /void loadThreadRef\.current\(initialThreadId\);/u);
});
