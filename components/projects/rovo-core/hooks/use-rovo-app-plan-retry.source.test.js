const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const PLAN_RETRY_HOOK_SOURCE = readSource("use-rovo-app-plan-retry.ts");

test("Rovo app core delegates plan retry monitoring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-plan-retry";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppPlanRetry\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /messages: normalizedRovoMessages/u);
	assert.match(CORE_HOOK_SOURCE, /appendLocalUserMessage/u);
	assert.match(CORE_HOOK_SOURCE, /releaseCompletedUseChatTurnIfNeeded/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /runRovoAppPlanRetryLifecycle/u);

	assert.match(
		PLAN_RETRY_HOOK_SOURCE,
		/export function useRovoAppPlanRetry/u,
	);
	assert.match(PLAN_RETRY_HOOK_SOURCE, /runRovoAppPlanRetryLifecycle/u);
	assert.match(PLAN_RETRY_HOOK_SOURCE, /planningSession/u);
	assert.match(PLAN_RETRY_HOOK_SOURCE, /syncAgentModeForDispatch/u);
});
