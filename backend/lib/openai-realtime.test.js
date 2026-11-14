const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const WebSocket = require("ws");

const {
	RealtimeSession,
	ROVO_SYSTEM_INSTRUCTIONS,
	SESSION_STATE,
} = require("./openai-realtime");
const { getRealtimeConfig } = require("./ai-gateway-helpers");
const SOURCE = fs.readFileSync(path.join(__dirname, "openai-realtime.js"), "utf8");

function createReadySession() {
	const openaiMessages = [];
	const logEntries = [];
	const clientMessages = [];
	const clientWs = {
		readyState: WebSocket.OPEN,
		send(payload) {
			clientMessages.push(JSON.parse(payload));
		},
	};
	const session = new RealtimeSession(clientWs, {
		onLog: (scope, message) => {
			logEntries.push({ scope, message });
		},
	});

	session._state = SESSION_STATE.READY;
	session._openaiWs = {
		readyState: WebSocket.OPEN,
		send(payload) {
			openaiMessages.push(JSON.parse(payload));
		},
		close() {},
		ping() {},
		terminate() {},
	};

	return {
		clientMessages,
		session,
		openaiMessages,
		logEntries,
	};
}

function assertSystemMessage(openaiMessage, expectedText) {
	assert.equal(openaiMessage.type, "conversation.item.create");
	assert.equal(openaiMessage.item?.type, "message");
	assert.equal(openaiMessage.item?.role, "system");
	assert.equal(openaiMessage.item?.content?.[0]?.type, "input_text");
	assert.equal(openaiMessage.item?.content?.[0]?.text, expectedText);
}

function sendOpenAIEvent(session, event) {
	session._handleOpenAIMessage(Buffer.from(JSON.stringify(event)));
}

test("realtime config defaults to the current realtime model", () => {
	const previousModel = process.env.OPENAI_REALTIME_MODEL;
	delete process.env.OPENAI_REALTIME_MODEL;

	try {
		assert.equal(getRealtimeConfig().model, "gpt-realtime");
	} finally {
		if (previousModel === undefined) {
			delete process.env.OPENAI_REALTIME_MODEL;
		} else {
			process.env.OPENAI_REALTIME_MODEL = previousModel;
		}
	}
});

test("system instructions include artifact annotation guidance", () => {
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/artifact annotations are provided as system context/iu,
	);
});

test("system instructions force delegation for explicit artifact requests", () => {
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/create me an artifact about Apple/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/MUST delegate immediately/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/Do not say things like "I'm putting that together"/iu,
	);
});

test("system instructions route screen pointing through structured tools", () => {
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/When the user asks where something is, asks you to show them something, or asks you to point at something on the Studio screen/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/call get_screen_state first, then call point_at_target/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/this area.*activeRegion/isu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/targetHints/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/Do not infer raw screen coordinates, screenshots, CUA actions, or arbitrary clicks from a painted region/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/activeRegion\.targetHints contains the Studio agent instructions field/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/call apply_agent_draft_patch with patch\.instructions/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/Treat patch\.instructions as a complete replacement body/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/Do not use set_composer_text for painted instructions updates/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/Prefer the targetId or fieldId returned by get_screen_state over a freeform label/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/call get_screen_state first, optionally call point_at_target to show what you will use, then call activate_screen_target/iu,
	);
	assert.match(
		ROVO_SYSTEM_INSTRUCTIONS,
		/Only say you clicked, opened, picked, or chose something after activate_screen_target returns ok: true/iu,
	);
});

test("relays a client function_call_output to OpenAI and requests a new response", () => {
	const { session, openaiMessages } = createReadySession();

	session._handleFunctionCallOutput({
		type: "function_call_output",
		callId: "call_abc",
		output: JSON.stringify({ ok: true }),
	});

	const outputItem = openaiMessages.find(
		(m) => m.type === "conversation.item.create" && m.item?.type === "function_call_output",
	);
	assert.ok(outputItem, "expected a function_call_output conversation item");
	assert.equal(outputItem.item.call_id, "call_abc");
	assert.equal(outputItem.item.output, JSON.stringify({ ok: true }));
	assert.ok(
		openaiMessages.some((m) => m.type === "response.create"),
		"expected a response.create after the tool output",
	);
});

test("function_call_output can suppress the follow-up response", () => {
	const { session, openaiMessages } = createReadySession();

	session._handleFunctionCallOutput({
		type: "function_call_output",
		callId: "call_xyz",
		output: { ok: true },
		createResponse: false,
	});

	assert.ok(
		openaiMessages.some(
			(m) => m.type === "conversation.item.create" && m.item?.type === "function_call_output",
		),
		"expected the function_call_output item to be relayed",
	);
	assert.ok(
		!openaiMessages.some((m) => m.type === "response.create"),
		"expected no response.create when createResponse is false",
	);
});

test("realtime relay does not keep the legacy cursor screenshot image path", () => {
	assert.doesNotMatch(SOURCE, /image_message_from_user/u);
	assert.doesNotMatch(SOURCE, /_handleImageMessageFromUser/u);
	assert.doesNotMatch(SOURCE, /input_image/u);
});

test("accepts initial_context injections", () => {
	const { session, openaiMessages, logEntries } = createReadySession();

	session._handleContextInject({
		type: "context_inject",
		data: {
			type: "initial_context",
			content: "Initial voice context",
		},
	});

	assert.equal(openaiMessages.length, 1);
	assertSystemMessage(openaiMessages[0], "Initial voice context");
	assert.deepEqual(logEntries.at(-1), {
		scope: "REALTIME",
		message: "Context injected: initial_context",
	});
});

test("accepts thread_context injections", () => {
	const { session, openaiMessages, logEntries } = createReadySession();

	session._handleContextInject({
		type: "context_inject",
		data: {
			type: "thread_context",
			summary: "User asked to refine the active artifact.",
		},
	});

	assert.equal(openaiMessages.length, 1);
	assertSystemMessage(
		openaiMessages[0],
		"User asked to refine the active artifact.",
	);
	assert.deepEqual(logEntries.at(-1), {
		scope: "REALTIME",
		message: "Context injected: thread_context",
	});
});

test("accepts artifact_annotations injections", () => {
	const { session, openaiMessages, logEntries } = createReadySession();
	const annotationContext = [
		"[Artifact Annotations]",
		"Artifact kind: code",
		"",
		"#1: \"Make this larger\"",
	].join("\n");

	session._handleContextInject({
		type: "context_inject",
		data: {
			type: "artifact_annotations",
			content: annotationContext,
		},
	});

	assert.equal(openaiMessages.length, 1);
	assertSystemMessage(openaiMessages[0], annotationContext);
	assert.deepEqual(logEntries.at(-1), {
		scope: "REALTIME",
		message: "Context injected: artifact_annotations",
	});
});

test("accepts artifact_context injections", () => {
	const { session, openaiMessages, logEntries } = createReadySession();

	session._handleContextInject({
		type: "context_inject",
		data: {
			type: "artifact_context",
			content: "Artifact open: Landing page draft",
		},
	});

	assert.equal(openaiMessages.length, 1);
	assertSystemMessage(openaiMessages[0], "Artifact open: Landing page draft");
	assert.deepEqual(logEntries.at(-1), {
		scope: "REALTIME",
		message: "Context injected: artifact_context",
	});
});

test("text_message_from_user creates a user message and requests a response", () => {
	const { session, openaiMessages, logEntries } = createReadySession();

	session.handleClientMessage(JSON.stringify({
		type: "text_message_from_user",
		text: "Build a login form",
	}));

	assert.equal(openaiMessages.length, 2);
	assert.equal(openaiMessages[0].type, "conversation.item.create");
	assert.equal(openaiMessages[0].item?.role, "user");
	assert.equal(openaiMessages[0].item?.content?.[0]?.type, "input_text");
	assert.equal(openaiMessages[0].item?.content?.[0]?.text, "Build a login form");
	assert.equal(openaiMessages[1].type, "response.create");
	assert.deepEqual(logEntries.at(-1), {
		scope: "REALTIME",
		message: "Text message received from user",
	});
});

test("session updates use the GA realtime audio session schema", () => {
	const { session, openaiMessages } = createReadySession();

	session._sendSessionUpdate({ voice: "alloy" });

	assert.equal(openaiMessages.length, 1);
	assert.equal(openaiMessages[0].type, "session.update");
	assert.deepEqual(openaiMessages[0].session?.output_modalities, ["audio"]);
	assert.equal(openaiMessages[0].session?.audio?.output?.voice, "alloy");
	assert.deepEqual(openaiMessages[0].session?.audio?.input?.format, {
		type: "audio/pcm",
		rate: 24_000,
	});
	assert.deepEqual(openaiMessages[0].session?.audio?.input?.transcription, {
		model: "gpt-4o-mini-transcribe",
		language: "en",
	});
	assert.deepEqual(openaiMessages[0].session?.audio?.output?.format, {
		type: "audio/pcm",
		rate: 24_000,
	});
	assert.equal(openaiMessages[0].session?.max_output_tokens, "inf");
	const tools = openaiMessages[0].session?.tools ?? [];
	const getScreenStateTool = tools.find((tool) => tool.name === "get_screen_state");
	const pointAtTargetTool = tools.find((tool) => tool.name === "point_at_target");
	const activateScreenTargetTool = tools.find((tool) => tool.name === "activate_screen_target");
	const applyAgentDraftPatchTool = tools.find((tool) => tool.name === "apply_agent_draft_patch");
	assert.ok(getScreenStateTool, "expected get_screen_state tool in realtime session");
	assert.ok(pointAtTargetTool, "expected point_at_target tool in realtime session");
	assert.ok(activateScreenTargetTool, "expected activate_screen_target tool in realtime session");
	assert.ok(applyAgentDraftPatchTool, "expected apply_agent_draft_patch tool in realtime session");
	assert.match(getScreenStateTool.description, /Call this first/u);
	assert.match(getScreenStateTool.description, /activeRegion/u);
	assert.match(getScreenStateTool.description, /targetHints/u);
	assert.match(pointAtTargetTool.description, /ids or fieldIds returned by get_screen_state/u);
	assert.match(pointAtTargetTool.description, /painted\/highlighted region/u);
	assert.match(pointAtTargetTool.description, /targetHints/u);
	assert.match(pointAtTargetTool.description, /labels only as a fallback/u);
	assert.match(activateScreenTargetTool.description, /ids or fieldIds returned by get_screen_state/u);
	assert.match(activateScreenTargetTool.description, /click, open, pick, choose, or activate/u);
	assert.match(applyAgentDraftPatchTool.description, /Never publishes or activates an agent/u);
	assert.match(applyAgentDraftPatchTool.description, /full replacement Markdown body in patch\.instructions/u);
	assert.ok(pointAtTargetTool.parameters.properties.targetId);
	assert.ok(pointAtTargetTool.parameters.properties.fieldId);
	assert.ok(pointAtTargetTool.parameters.properties.label);
	assert.ok(activateScreenTargetTool.parameters.properties.targetId);
	assert.ok(activateScreenTargetTool.parameters.properties.fieldId);
	assert.ok(activateScreenTargetTool.parameters.properties.label);
	assert.equal("modalities" in openaiMessages[0].session, false);
	assert.equal("input_audio_format" in openaiMessages[0].session, false);
	assert.equal("output_audio_format" in openaiMessages[0].session, false);
	assert.equal("max_response_output_tokens" in openaiMessages[0].session, false);
});

test("client session updates preserve configurable realtime voice options", () => {
	const { session, openaiMessages } = createReadySession();

	session.handleClientMessage(JSON.stringify({
		type: "session_update",
		config: {
			instructions: "Use a quiet voice.",
			voice: "verse",
			turn_detection: {
				type: "semantic_vad",
				eagerness: "low",
				create_response: true,
				interrupt_response: true,
			},
		},
	}));

	assert.equal(openaiMessages.length, 1);
	assert.equal(openaiMessages[0].type, "session.update");
	assert.equal(openaiMessages[0].session?.instructions, "Use a quiet voice.");
	assert.deepEqual(openaiMessages[0].session?.output_modalities, ["audio"]);
	assert.equal(openaiMessages[0].session?.audio?.output?.voice, "verse");
	assert.equal(
		openaiMessages[0].session?.audio?.input?.turn_detection?.eagerness,
		"low",
	);
});

test("manual turn-taking coalesces transcript completions into one client turn", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	t.after(() => t.mock.timers.reset());
	const { session, clientMessages, openaiMessages } = createReadySession();

	session.handleClientMessage(JSON.stringify({
		type: "session_update",
		config: {
			turn_detection: {
				type: "semantic_vad",
				create_response: false,
			},
		},
	}));
	openaiMessages.length = 0;

	sendOpenAIEvent(session, {
		type: "conversation.item.input_audio_transcription.completed",
		transcript: "hello",
	});
	sendOpenAIEvent(session, {
		type: "conversation.item.input_audio_transcription.completed",
		transcript: "world",
	});

	assert.deepEqual(clientMessages, []);
	assert.deepEqual(openaiMessages, []);

	t.mock.timers.tick(799);
	assert.deepEqual(clientMessages, []);
	assert.deepEqual(openaiMessages, []);

	t.mock.timers.tick(1);

	assert.deepEqual(clientMessages, [
		{
			type: "transcription_completed",
			transcript: "hello world",
		},
	]);
	assert.deepEqual(openaiMessages, [
		{
			type: "response.create",
			response: {},
		},
	]);
});

test("transcription-only manual turns do not request a model response", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	t.after(() => t.mock.timers.reset());
	const { session, clientMessages, openaiMessages } = createReadySession();

	session.handleClientMessage(JSON.stringify({
		type: "session_update",
		config: {
			transcription_only: true,
			turn_detection: {
				type: "semantic_vad",
				create_response: false,
			},
		},
	}));
	openaiMessages.length = 0;

	sendOpenAIEvent(session, {
		type: "conversation.item.input_audio_transcription.completed",
		transcript: "review this first",
	});

	t.mock.timers.tick(800);

	assert.deepEqual(clientMessages, [
		{
			type: "transcription_completed",
			transcript: "review this first",
		},
	]);
	assert.deepEqual(openaiMessages, []);
});

test("explicit-response-only manual turns wait for explicit text responses", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	t.after(() => t.mock.timers.reset());
	const { session, clientMessages, openaiMessages } = createReadySession();

	session.handleClientMessage(JSON.stringify({
		type: "session_update",
		config: {
			explicit_response_only: true,
			turn_detection: {
				type: "semantic_vad",
				create_response: false,
			},
		},
	}));
	openaiMessages.length = 0;

	sendOpenAIEvent(session, {
		type: "conversation.item.input_audio_transcription.completed",
		transcript: "next",
	});

	t.mock.timers.tick(800);

	assert.deepEqual(clientMessages, [
		{
			type: "transcription_completed",
			transcript: "next",
		},
	]);
	assert.deepEqual(openaiMessages, []);

	session.handleClientMessage(JSON.stringify({
		type: "text_message_from_user",
		text: "Read aloud exactly this onboarding guide response. Do not add any other words:\nMoving to step 2 of 4.",
	}));

	assert.equal(openaiMessages.length, 2);
	assert.equal(openaiMessages[0].type, "conversation.item.create");
	assert.equal(openaiMessages[0].item?.role, "user");
	assert.equal(openaiMessages[1].type, "response.create");
});

test("transcription-only mode ignores explicit response_create fallback requests", () => {
	const { session, openaiMessages, logEntries } = createReadySession();

	session.handleClientMessage(JSON.stringify({
		type: "session_update",
		config: {
			transcription_only: true,
			turn_detection: {
				type: "semantic_vad",
				create_response: false,
			},
		},
	}));
	openaiMessages.length = 0;

	session.handleClientMessage(JSON.stringify({
		type: "response_create",
	}));

	assert.deepEqual(openaiMessages, []);
	assert.deepEqual(logEntries.at(-1), {
		scope: "REALTIME",
		message: "Response create ignored — transcription-only mode",
	});
});

test("default turn-taking forwards transcript completions one-to-one", () => {
	const { session, clientMessages, openaiMessages } = createReadySession();

	sendOpenAIEvent(session, {
		type: "conversation.item.input_audio_transcription.completed",
		transcript: "hello",
	});
	sendOpenAIEvent(session, {
		type: "conversation.item.input_audio_transcription.completed",
		transcript: "world",
	});

	assert.deepEqual(clientMessages, [
		{
			type: "transcription_completed",
			transcript: "hello",
		},
		{
			type: "transcription_completed",
			transcript: "world",
		},
	]);
	assert.deepEqual(openaiMessages, []);
});

test("transcription deltas stream to the client immediately", () => {
	const { session, clientMessages } = createReadySession();

	sendOpenAIEvent(session, {
		type: "conversation.item.input_audio_transcription.delta",
		delta: "hel",
	});

	assert.deepEqual(clientMessages, [
		{
			type: "transcription_delta",
			delta: "hel",
		},
	]);
});

test("manual barge-in sends response.cancel only in manual mode", () => {
	const manual = createReadySession();
	manual.session.handleClientMessage(JSON.stringify({
		type: "session_update",
		config: {
			turn_detection: {
				type: "semantic_vad",
				create_response: false,
			},
		},
	}));
	manual.openaiMessages.length = 0;
	manual.session._activeResponseId = "response-manual";

	sendOpenAIEvent(manual.session, {
		type: "input_audio_buffer.speech_started",
	});

	assert.deepEqual(manual.clientMessages, [{ type: "speech_started" }]);
	assert.deepEqual(manual.openaiMessages, [{ type: "response.cancel" }]);

	const defaults = createReadySession();
	defaults.session._activeResponseId = "response-default";

	sendOpenAIEvent(defaults.session, {
		type: "input_audio_buffer.speech_started",
	});

	assert.deepEqual(defaults.clientMessages, [{ type: "speech_started" }]);
	assert.deepEqual(defaults.openaiMessages, []);
});

test("manual barge-in clears stale pending response creation", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	t.after(() => t.mock.timers.reset());
	const { session, clientMessages, openaiMessages } = createReadySession();

	session.handleClientMessage(JSON.stringify({
		type: "session_update",
		config: {
			turn_detection: {
				type: "semantic_vad",
				create_response: false,
			},
		},
	}));
	openaiMessages.length = 0;

	sendOpenAIEvent(session, {
		type: "conversation.item.input_audio_transcription.completed",
		transcript: "stale turn",
	});
	session._activeResponseId = "response-active";
	session._pendingResponseCreate = true;

	sendOpenAIEvent(session, {
		type: "input_audio_buffer.speech_started",
	});
	t.mock.timers.tick(4_000);
	sendOpenAIEvent(session, {
		type: "response.done",
		response: { id: "response-active" },
	});

	assert.equal(session._pendingResponseCreate, false);
	assert.deepEqual(openaiMessages, [{ type: "response.cancel" }]);
	assert.equal(
		clientMessages.some((message) => message.type === "transcription_completed"),
		false,
	);
	assert.equal(
		openaiMessages.some((message) => message.type === "response.create"),
		false,
	);
});

test("stale response cancel errors clear active response state without notifying client", () => {
	const { session, clientMessages, logEntries } = createReadySession();

	session._activeResponseId = "response-stale";
	session._pendingResponseCreate = true;

	sendOpenAIEvent(session, {
		type: "error",
		error: {
			code: "invalid_request_error",
			message: "Cancellation failed: no active response found",
		},
	});

	assert.equal(session._activeResponseId, null);
	assert.equal(session._pendingResponseCreate, false);
	assert.deepEqual(clientMessages, []);
	assert.ok(
		logEntries.some((entry) =>
			entry.scope === "REALTIME"
			&& entry.message === "OpenAI warning: Cancellation failed: no active response found",
		),
	);
});

test("text and transcript deltas forward item ids to the client", () => {
	const { session, clientMessages } = createReadySession();

	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.created",
		response: { id: "response-1" },
	})));
	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.text.delta",
		delta: "Hello",
		item_id: "assistant-item-1",
		response_id: "response-1",
	})));
	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.audio_transcript.delta",
		delta: " there",
		item_id: "assistant-item-1",
		response_id: "response-1",
	})));
	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.done",
		response: { id: "response-1" },
	})));

	assert.deepEqual(clientMessages, [
		{
			type: "response_created",
			responseId: "response-1",
		},
		{
			type: "text_delta",
			delta: "Hello",
			itemId: "assistant-item-1",
			responseId: "response-1",
		},
		{
			type: "audio_transcript_delta",
			delta: " there",
			itemId: "assistant-item-1",
			responseId: "response-1",
		},
		{
			type: "response_done",
			responseId: "response-1",
		},
	]);
});

test("modern realtime output delta events are normalized for the client", () => {
	const { session, clientMessages } = createReadySession();

	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.created",
		response: { id: "response-2" },
	})));
	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.output_audio.delta",
		delta: "audio-base64",
		response_id: "response-2",
	})));
	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.output_text.delta",
		delta: "Hello",
		item_id: "assistant-item-2",
		response_id: "response-2",
	})));
	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.output_audio_transcript.delta",
		delta: " there",
		item_id: "assistant-item-2",
		response_id: "response-2",
	})));
	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.output_audio_transcript.done",
		transcript: "Hello there",
		item_id: "assistant-item-2",
		response_id: "response-2",
	})));
	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.done",
		response: { id: "response-2" },
	})));

	assert.deepEqual(clientMessages, [
		{
			type: "response_created",
			responseId: "response-2",
		},
		{
			type: "audio_delta",
			delta: "audio-base64",
		},
		{
			type: "text_delta",
			delta: "Hello",
			itemId: "assistant-item-2",
			responseId: "response-2",
		},
		{
			type: "audio_transcript_delta",
			delta: " there",
			itemId: "assistant-item-2",
			responseId: "response-2",
		},
		{
			type: "audio_transcript_done",
			transcript: "Hello there",
			itemId: "assistant-item-2",
			responseId: "response-2",
		},
		{
			type: "response_done",
			responseId: "response-2",
		},
	]);
});

test("content part transcript completion forwards audio transcript text", () => {
	const { session, clientMessages } = createReadySession();

	sendOpenAIEvent(session, {
		type: "response.content_part.done",
		response_id: "response-3",
		item_id: "assistant-item-3",
		part: {
			type: "audio",
			transcript: "Done, I updated the prompt.",
		},
	});

	assert.deepEqual(clientMessages, [
		{
			type: "audio_transcript_done",
			transcript: "Done, I updated the prompt.",
			itemId: "assistant-item-3",
			responseId: "response-3",
		},
	]);
});

test("response done forwards embedded audio transcript fallback", () => {
	const { session, clientMessages } = createReadySession();

	sendOpenAIEvent(session, {
		type: "response.done",
		response: {
			id: "response-4",
			output: [
				{
					id: "assistant-item-4",
					type: "message",
					content: [
						{
							type: "audio",
							transcript: "I can see the text panel now.",
						},
					],
				},
			],
		},
	});

	assert.deepEqual(clientMessages, [
		{
			type: "audio_transcript_done",
			transcript: "I can see the text panel now.",
			itemId: "assistant-item-4",
			responseId: "response-4",
		},
		{
			type: "response_done",
			responseId: "response-4",
		},
	]);
});

test("response done forwards embedded output text fallback", () => {
	const { session, clientMessages } = createReadySession();

	sendOpenAIEvent(session, {
		type: "response.done",
		response: {
			id: "response-5",
			output: [
				{
					id: "assistant-item-5",
					type: "message",
					content: [
						{
							type: "output_text",
							text: "Typing is visible in the panel.",
						},
					],
				},
			],
		},
	});

	assert.deepEqual(clientMessages, [
		{
			type: "audio_transcript_done",
			transcript: "Typing is visible in the panel.",
			itemId: "assistant-item-5",
			responseId: "response-5",
		},
		{
			type: "response_done",
			responseId: "response-5",
		},
	]);
});

test("benign realtime item lifecycle events are ignored without unhandled logs", () => {
	const { session, clientMessages, logEntries } = createReadySession();

	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "conversation.item.created",
		item: { id: "item-1", type: "message" },
	})));
	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.output_item.added",
		response_id: "response-3",
		item: { id: "item-2", type: "message" },
	})));
	session._handleOpenAIMessage(Buffer.from(JSON.stringify({
		type: "response.content_part.added",
		response_id: "response-3",
		item_id: "item-2",
		part: { type: "output_text" },
	})));

	assert.deepEqual(clientMessages, []);
	assert.equal(
		logEntries.some(({ message }) => /Unhandled OpenAI event/.test(message)),
		false,
	);
});

test("unknown context types log and no-op", () => {
	const { session, openaiMessages, logEntries } = createReadySession();

	session._handleContextInject({
		type: "context_inject",
		data: {
			type: "unsupported_context",
			content: "Ignored",
		},
	});

	assert.equal(openaiMessages.length, 0);
	assert.deepEqual(logEntries.at(-1), {
		scope: "REALTIME",
		message: "Unknown context_inject contextType: unsupported_context",
	});
});

test("heartbeat terminates the upstream session when pong is missing", (t) => {
	t.mock.timers.enable({ apis: ["setInterval"] });

	const { session } = createReadySession();
	let pingCount = 0;
	let terminateCount = 0;
	session._openaiWs.ping = () => {
		pingCount += 1;
	};
	session._openaiWs.terminate = () => {
		terminateCount += 1;
	};

	session._startOpenAIHeartbeat();
	t.mock.timers.tick(20_000);
	assert.equal(pingCount, 1);
	assert.equal(terminateCount, 0);

	t.mock.timers.tick(20_000);
	assert.equal(terminateCount, 1);
	assert.equal(session._plannedCloseReason, "heartbeat_timeout");

	session._clearSessionMaintenanceTimers();
	t.mock.timers.reset();
});

test("session refresh closes the upstream connection before max lifetime", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });

	const { session } = createReadySession();
	let closeArgs = null;
	session._openaiWs.close = (code, reason) => {
		closeArgs = { code, reason };
	};

	session._scheduleSessionRefresh();
	t.mock.timers.tick(55 * 60 * 1_000);

	assert.deepEqual(closeArgs, {
		code: 1000,
		reason: "session refresh",
	});
	assert.equal(session._plannedCloseReason, "session_refresh");

	session._clearSessionMaintenanceTimers();
	t.mock.timers.reset();
});

test("an upstream message that is valid JSON but not an object is ignored with a log line", () => {
	const logs = [];
	const session = new RealtimeSession({ readyState: WebSocket.OPEN, send() {} }, { onLog: (_scope, message) => logs.push(message) });
	for (const raw of ["null", "1", "[]", "\"text\""]) {
		assert.doesNotThrow(() => session._handleOpenAIMessage(Buffer.from(raw)), raw);
	}
	assert.equal(logs.filter((message) => message.includes("not an object")).length, 4);
});
