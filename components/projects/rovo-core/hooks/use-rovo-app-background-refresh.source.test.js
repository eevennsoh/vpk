const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const BACKGROUND_REFRESH_HOOK_SOURCE = readSource("use-rovo-app-background-refresh.ts");

test("Rovo app core delegates background refresh polling to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-background-refresh";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppBackgroundRefresh\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /listBackgroundStreams: listRovoAppBackgroundStreams/u);
	assert.match(CORE_HOOK_SOURCE, /listThreads: listRovoAppThreads/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /getRovoAppBackgroundRefreshThreadIds/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /runRovoAppBackgroundRefreshPoll/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /backgroundRefreshThreadIdsKey/u);

	assert.match(
		BACKGROUND_REFRESH_HOOK_SOURCE,
		/export function useRovoAppBackgroundRefresh/u,
	);
	assert.match(BACKGROUND_REFRESH_HOOK_SOURCE, /getRovoAppBackgroundRefreshThreadIds/u);
	assert.match(BACKGROUND_REFRESH_HOOK_SOURCE, /runRovoAppBackgroundRefreshPoll/u);
	assert.match(BACKGROUND_REFRESH_HOOK_SOURCE, /window\.setInterval\(poll, 3000\)/u);
});
