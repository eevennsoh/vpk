const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const RUNTIME_REFS_HOOK_SOURCE = readSource("use-rovo-app-runtime-refs.ts");

test("Rovo app core delegates passive runtime ref synchronization to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-runtime-refs";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppRuntimeRefs\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /lastUseChatBusyAtRef/u);
	assert.match(CORE_HOOK_SOURCE, /runSubscriptionAbortControllerRef/u);
	assert.doesNotMatch(
		CORE_HOOK_SOURCE,
		/useEffect\(\(\) => \{\n\t\tactiveThreadIdRef\.current = activeThreadId;/u,
	);
	assert.doesNotMatch(
		CORE_HOOK_SOURCE,
		/useEffect\(\(\) => \{\n\t\tuseChatStatusRef\.current = useChatStatus;/u,
	);
	assert.doesNotMatch(
		CORE_HOOK_SOURCE,
		/useEffect\(\(\) => \{\n\t\treturn \(\) => \{\n\t\t\trunSubscriptionAbortControllerRef\.current\?\.abort\(\);/u,
	);

	assert.match(
		RUNTIME_REFS_HOOK_SOURCE,
		/export function useRovoAppRuntimeRefs/u,
	);
	assert.match(RUNTIME_REFS_HOOK_SOURCE, /activeThreadIdRef\.current = activeThreadId/u);
	assert.doesNotMatch(RUNTIME_REFS_HOOK_SOURCE, /lastSyncedAgentModeRef/u);
	assert.match(RUNTIME_REFS_HOOK_SOURCE, /streamingArtifactMessageIdRef\.current = streamingArtifactMessageId/u);
	assert.match(RUNTIME_REFS_HOOK_SOURCE, /runSubscriptionAbortControllerRef\.current\?\.abort\(\)/u);
	assert.match(RUNTIME_REFS_HOOK_SOURCE, /realtimeMessagesRef\.current = realtimeMessages/u);
	assert.match(RUNTIME_REFS_HOOK_SOURCE, /statusRef\.current = status/u);
	assert.match(RUNTIME_REFS_HOOK_SOURCE, /lastUseChatBusyAtRef\.current = Date\.now\(\)/u);
	assert.match(RUNTIME_REFS_HOOK_SOURCE, /attachedRunStatusRef\.current = attachedRunStatus/u);
});
