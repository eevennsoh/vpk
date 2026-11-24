const assert = require("node:assert/strict");
const test = require("node:test");
const { chatState, mountChat, send, startAction, waitFor } = require("./rovo-chat-turn-test-harness.js");

test("scripted prompts produce a local reply without a server thread or model request", async (t) => {
	const { server, chat } = await mountChat(t, { localScriptedTurns: true });
	await send(chat, "Review this work item");
	await waitFor("scripted reply", () => chat().uiMessages.some((message) => message.role === "assistant"));
	assert.deepEqual(chatState().messages, ["user:Review this work item", "assistant:Thanks, I’ll continue with that direction in this demo."]);
	assert.equal(server.turns.length, 0);
	assert.equal(window.testApi.calls.some((call) => call.method === "POST"), false);
});

test("editing a scripted prompt replaces its reply without contacting the backend", async (t) => {
	const { server, chat } = await mountChat(t, { localScriptedTurns: true });
	await send(chat, "First prompt");
	await waitFor("scripted reply", () => chat().uiMessages.some((message) => message.role === "assistant"));
	const messageId = chat().uiMessages.find((message) => message.role === "user").id;
	await (await startAction(() => chat().editMessage(messageId, "Updated prompt")))();
	await waitFor("updated scripted reply", () => chatState().messages.includes("user:Updated prompt"));
	assert.deepEqual(chatState().messages, ["user:Updated prompt", "assistant:Thanks, I’ll continue with that direction in this demo."]);
	assert.equal(server.turns.length, 0);
	assert.equal(window.testApi.calls.some((call) => call.method === "POST"), false);
});
