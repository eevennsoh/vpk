const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const {
	createRovoRealtimeConversation,
	appendRovoRealtimeMessage,
	resolveRovoRealtimeMutationId,
	setRovoRealtimeChatVoiceMode,
	updateRovoRealtimeMessage,
} = loadRovoCoreModule("hooks/use-rovo-realtime-shell-bridge.ts");

test("resolveRovoRealtimeMutationId preserves string and object ids", () => {
	assert.equal(resolveRovoRealtimeMutationId("message-1"), "message-1");
	assert.equal(resolveRovoRealtimeMutationId("  message-2  "), "  message-2  ");
	assert.equal(resolveRovoRealtimeMutationId({ id: "message-3" }), "message-3");
	assert.equal(resolveRovoRealtimeMutationId({ id: " " }), null);
	assert.equal(resolveRovoRealtimeMutationId(undefined), null);
	assert.equal(resolveRovoRealtimeMutationId({}), null);
});

test("setRovoRealtimeChatVoiceMode prefers direct setter and falls back to toggle", () => {
	const setCalls = [];
	const directAdapter = {
		isVoiceMode: false,
		setVoiceMode(next) {
			setCalls.push(next);
		},
		toggleVoiceMode() {
			throw new Error("toggle should not be called when direct setter exists");
		},
	};
	setRovoRealtimeChatVoiceMode(directAdapter, true);
	assert.deepEqual(setCalls, [true]);

	let toggleCount = 0;
	const fallbackAdapter = {
		isVoiceMode: false,
		toggleVoiceMode() {
			toggleCount += 1;
		},
	};
	setRovoRealtimeChatVoiceMode(fallbackAdapter, true);
	setRovoRealtimeChatVoiceMode({ ...fallbackAdapter, isVoiceMode: true }, true);
	assert.equal(toggleCount, 1);
});

test("appendRovoRealtimeMessage normalizes created message ids", async () => {
	const calls = [];
	const createdId = await appendRovoRealtimeMessage(
		{
			appendRealtimeMessage(role, content, options) {
				calls.push({ role, content, options });
				return { id: "assistant-1" };
			},
		},
		"assistant",
		"Hello",
		{ source: "realtime" },
	);

	assert.equal(createdId, "assistant-1");
	assert.deepEqual(calls, [
		{
			role: "assistant",
			content: "Hello",
			options: { source: "realtime" },
		},
	]);
	assert.equal(await appendRovoRealtimeMessage({}, "user", "Ignored"), null);
});

test("updateRovoRealtimeMessage chooses replace or delta paths", async () => {
	const calls = [];
	const adapter = {
		setRealtimeMessageContent(messageId, content) {
			calls.push(["set", messageId, content]);
		},
		updateRealtimeMessage(messageId, content) {
			calls.push(["update", messageId, content]);
		},
	};

	await updateRovoRealtimeMessage(adapter, "message-1", "Full text", { replace: true });
	await updateRovoRealtimeMessage(adapter, "message-1", " delta");
	await updateRovoRealtimeMessage(adapter, null, "Ignored");
	await updateRovoRealtimeMessage(adapter, "message-1", "");

	assert.deepEqual(calls, [
		["set", "message-1", "Full text"],
		["update", "message-1", " delta"],
	]);
});


function conversationHarness(overrides = {}) {
	const calls = [];
	let nextId = 0;
	const chat = {
		messages: [],
		appendRealtimeMessage(role, content, options) {
			const id = options?.messageId ?? `${role}-${++nextId}`;
			calls.push(["append", role, content, id]);
			this.messages.push({ id, role });
			return id;
		},
		updateRealtimeMessage(id, delta) { calls.push(["delta", id, delta]); },
		setRealtimeMessageContent(id, text) { calls.push(["replace", id, text]); },
		...overrides,
	};
	const transport = {
		connect(options) { calls.push(["connect", options]); },
		disconnect() { calls.push(["disconnect"]); },
		sendTextInput(payload) { calls.push(["send", payload]); },
	};
	return { calls, chat, transport, conversation: createRovoRealtimeConversation({ current: chat }) };
}

test("assistant events share one identity per user turn and render before transcript mutation", async () => {
	const { calls, conversation } = conversationHarness();
	conversation.beginSpeech();
	await conversation.completeSpeech("Hello");
	await Promise.all([
		conversation.assistantDelta("A", (text) => calls.push(["visible", text])),
		conversation.assistantDelta("B"),
	]);
	await conversation.assistantCompleted("AB");
	assert.equal(calls.filter((call) => call[0] === "append" && call[1] === "assistant").length, 1);
	const assistantId = conversation.assistantMessageId;
	assert.deepEqual(calls.at(-1), ["replace", assistantId, "AB"]);
	assert.equal(calls.findIndex((call) => call[0] === "visible") < calls.findIndex((call) => call[1] === "assistant"), true);
	conversation.beginSpeech();
	await conversation.assistantDelta("Next");
	assert.notEqual(conversation.assistantMessageId, assistantId);
});

test("preferred assistant responses preserve transcript identity", async () => {
	const { calls, chat, conversation } = conversationHarness();
	chat.messages.push({ id: "existing", role: "assistant" });
	assert.equal(await conversation.ensureAssistant("existing"), "existing");
	await conversation.assistantDelta({ text: "Full", delta: "partial", replace: true });
	assert.deepEqual(calls, [["replace", "existing", "Full"]]);
});

test("display-only assistant deltas render visible text without creating or updating chat messages", async () => {
	const { calls, chat, conversation } = conversationHarness();
	await conversation.assistantDelta(
		{ text: "UI only", displayOnly: true },
		(text) => calls.push(["visible", text]),
	);
	assert.deepEqual(calls, [["visible", "UI only"]]);
	assert.deepEqual(chat.messages, []);
	assert.equal(conversation.assistantMessageId, null);
});

test("live voice activates the companion before connecting or emitting assistant text", async () => {
	const { calls, conversation, transport } = conversationHarness();
	conversation.startDictation(transport, "Draft", true);
	calls.length = 0;
	let companionActive = false;
	let assistantDelta;
	conversation.startLive({
		...transport,
		connect() {
			calls.push(["connect", companionActive]);
			assistantDelta = conversation.assistantDelta("Hello", (text) => {
				calls.push(["visible", text, companionActive]);
			});
		},
	}, () => {
		companionActive = true;
		calls.push(["activate", conversation.isDictating()]);
	});
	await assistantDelta;
	assert.deepEqual(calls, [
		["activate", false],
		["connect", true],
		["visible", "Hello", true],
		["append", "assistant", "", "assistant-1"],
		["delta", "assistant-1", "Hello"],
	]);
});

test("dictation preserves draft and transport order without submitting chat messages", async () => {
	const { calls, conversation, transport } = conversationHarness();
	conversation.startDictation(transport, "Existing draft", true);
	assert.deepEqual(calls, [["disconnect"], ["connect", { transcriptionOnly: true }]]);
	assert.equal(conversation.beginSpeech(), false);
	assert.equal(conversation.transcriptDelta({ text: "spoken" }).text, "Existing draft spoken");
	assert.equal((await conversation.completeSpeech("first")).text, "Existing draft first");
	assert.equal((await conversation.completeSpeech("second")).text, "Existing draft first second");
	await conversation.assistantDelta("Ignored");
	assert.equal(calls.some((call) => call[0] === "append"), false);
	conversation.stopDictation(transport);
	assert.equal(conversation.isDictating(), false);
	conversation.startLive(transport, () => calls.push(["live"]));
	assert.deepEqual(calls.at(-1), ["connect", undefined]);
});

test("typed submission prefers chat transport and voice transport appends before sending", async () => {
	const direct = conversationHarness({ async submitRealtimeText(payload) { direct.calls.push(["direct", payload]); } });
	const payload = { text: "Typed", files: [], contextDescription: "Context" };
	assert.equal(await direct.conversation.submitText(payload, direct.transport, (mode) => direct.calls.push(["start", mode])), true);
	assert.deepEqual(direct.calls, [["start", "chat"], ["direct", payload]]);
	const voice = conversationHarness();
	await voice.conversation.submitText(payload, voice.transport, (mode) => voice.calls.push(["start", mode]));
	assert.deepEqual(voice.calls.map((call) => call[0]), ["start", "append", "send"]);
	assert.equal(voice.calls.at(-1)[1].messageId, voice.conversation.userMessageId);
	assert.equal(await voice.conversation.submitText(payload, { connect() {}, disconnect() {} }, () => {}), false);
});

test("stop and destroy reject pending assistant identity and late speech completions", async () => {
	let resolveAppend;
	const { calls, conversation, transport } = conversationHarness({ appendRealtimeMessage() { return new Promise((resolve) => { resolveAppend = resolve; }); } });
	const pending = conversation.assistantDelta("Pending");
	conversation.stopVoice(transport);
	resolveAppend("stale-assistant");
	await pending;
	assert.equal(conversation.assistantMessageId, null);
	assert.deepEqual(calls, [["disconnect"]]);
	await conversation.completeSpeech("Late one");
	await conversation.completeSpeech("Late two");
	conversation.destroy();
	await conversation.assistantDelta("Late assistant");
	assert.deepEqual(calls, [["disconnect"]]);
});

test("effect replay and an explicit typed turn revive assistant lifecycle after cleanup or stop", async () => {
	const { calls, conversation, transport } = conversationHarness();
	conversation.activate();
	conversation.destroy();
	conversation.activate();
	await conversation.assistantDelta("After replay");
	assert.equal(calls.some((call) => call[0] === "delta"), true);
	conversation.interrupt();
	const notified = [];
	await conversation.completeSpeech("Late completion", (text) => notified.push(text));
	assert.deepEqual(notified, ["Late completion"]);
	const userCount = calls.filter((call) => call[0] === "append" && call[1] === "user").length;
	assert.equal(userCount, 0);
	await conversation.submitText({ text: "Intentional next turn", files: [] }, transport, () => {});
	await conversation.assistantDelta("New reply");
	assert.deepEqual(calls.at(-1), ["delta", conversation.assistantMessageId, "New reply"]);
	conversation.startDictation(transport, "Draft", true);
	conversation.stopDictation(transport);
	await conversation.submitText({ text: "After dictation", files: [] }, transport, () => {});
	await conversation.assistantCompleted("Reply");
	assert.deepEqual(calls.at(-1), ["replace", conversation.assistantMessageId, "Reply"]);
});
