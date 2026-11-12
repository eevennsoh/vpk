const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const USE_CHAT_LIFECYCLE_ACTIONS_SOURCE = readSource("use-rovo-app-use-chat-lifecycle-actions.ts");

test("Rovo app core delegates useChat error and finish side effects to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-use-chat-lifecycle-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppUseChatLifecycleActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /onData: handleRovoAppDataPart/u);
	assert.match(CORE_HOOK_SOURCE, /onError: handleUseChatError/u);
	assert.match(CORE_HOOK_SOURCE, /onFinish: completeUseChatTurn/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /handleRovoAppUseChatError/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /completeRovoAppUseChatTurn/u);

	assert.match(USE_CHAT_LIFECYCLE_ACTIONS_SOURCE, /export function useRovoAppUseChatLifecycleActions/u);
	assert.match(USE_CHAT_LIFECYCLE_ACTIONS_SOURCE, /handleRovoAppUseChatError\(\{/u);
	assert.match(USE_CHAT_LIFECYCLE_ACTIONS_SOURCE, /completeRovoAppUseChatTurn\(\{/u);
	assert.match(USE_CHAT_LIFECYCLE_ACTIONS_SOURCE, /activeThreadId: activeThreadIdRef\.current/u);
});
