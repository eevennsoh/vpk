const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const USER_MESSAGE_ACTIONS_SOURCE = readSource("use-rovo-app-user-message-actions.ts");

test("Rovo app core delegates local user-message creation to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-user-message-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppUserMessageActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /appendLocalUserMessage/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /createRovoAppUserMessage/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /createId\("rovo-app-user"\)/u);

	assert.match(USER_MESSAGE_ACTIONS_SOURCE, /export function useRovoAppUserMessageActions/u);
	assert.match(USER_MESSAGE_ACTIONS_SOURCE, /createId\("rovo-app-user"\)/u);
	assert.match(USER_MESSAGE_ACTIONS_SOURCE, /createRovoAppUserMessage\(\{/u);
	assert.match(USER_MESSAGE_ACTIONS_SOURCE, /setMessages\(\(previousMessages\) => \[\.\.\.previousMessages, message\]\)/u);
});
