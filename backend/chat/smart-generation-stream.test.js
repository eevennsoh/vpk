"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const {
	createSmartGenerationStream,
	isSmartGenerationAbortError,
	streamSmartGenerationRoute,
	throwIfSmartGenerationAborted,
} = require("./smart-generation-stream");

function createWriter() {
	const parts = [];
	return {
		parts,
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	};
}

function createLogger() {
	const entries = [];
	return {
		entries,
		logger: {
			error: (...args) => entries.push(["error", ...args]),
			info: (...args) => entries.push(["info", ...args]),
			log: (...args) => entries.push(["log", ...args]),
		},
	};
}

function createBaseStreamOptions(overrides = {}) {
	const messages = [
		{
			role: "user",
			parts: [{ type: "text", text: "Create something" }],
		},
	];

	return {
		CLARIFICATION_WIDGET_TYPE: "question-card",
		GENUI_FALLBACK_ERROR_TEXT: "Fallback preview",
		SMART_IMAGE_PROMPT_MAX_CHARS: 4000,
		SMART_VOICE_INPUT_MAX_CHARS: 4000,
		SMART_WIDGET_TYPE_AUDIO: "audio-preview",
		SMART_WIDGET_TYPE_GENUI: "genui-preview",
		SMART_WIDGET_TYPE_IMAGE: "image-preview",
		abortController: new AbortController(),
		buildExcalidrawWidgetPayload: ({ normalizedSceneJson }) => ({
			scene: normalizedSceneJson,
		}),
		buildExcalidrawWidgetSystemPrompt: ({ title }) => `Diagram: ${title}`,
		buildFallbackGenuiSpecFromText: ({ text }) => ({
			type: "fallback",
			text,
		}),
		conversationHistory: [],
		createRouteDecisionPart: (data) => ({
			type: "data-route-decision",
			data,
		}),
		createUIMessageStream: (options) => options,
		deriveExcalidrawTitle: () => "Diagram",
		detectEndpointType: () => "generate-content",
		forceSmartAudioRoute: false,
		generateSmartGenuiResult: async () => ({
			narrative: "Generated narrative",
			spec: { type: "generated" },
		}),
		generateTextViaGateway: async () => "{}",
		getEnvVars: () => ({}),
		getNonEmptyString: (value) =>
			typeof value === "string" && value.trim() ? value.trim() : "",
		isExcalidrawDiagramRequest: () => false,
		isUnsupportedModalitiesError: () => false,
		latestUserMessage: "Create something",
		latestVisibleUserMessage: { text: "Create something" },
		logger: createLogger().logger,
		messages,
		normalizeExcalidrawArtifactOutput: (value) => value,
		provider: "openai",
		rawModel: "model",
		requestOrigin: "text",
		resolveGatewayUrl: () => "https://gateway.test",
		resolveGoogleImageGatewayConfig: () => ({
			envVars: {},
			gatewayUrl: "https://gateway.test",
			model: "image-model",
		}),
		resolveSmartAudioVoiceInput: () => ({
			voiceInput: "Generated narrative",
			source: "generated-narrative",
			needsClarification: false,
		}),
		resolveSmartImagePrompt: () => ({
			imagePrompt: "Draw a thing",
			source: "direct",
			needsClarification: false,
		}),
		roleMessages: [],
		smartIntentResult: {
			intent: "genui",
		},
		smartLayoutContext: {
			widthClass: "wide",
		},
		streamGoogleGatewayManualSse: async () => {},
		streamSmartRouteAudioWidgetGeneration: async () => ({ aborted: false }),
		streamSmartRouteImageWidgetGeneration: async () => ({ aborted: false }),
		stripConversationalFiller: (value) => value,
		synthesizeSound: async () => ({
			audioBytes: Buffer.from("audio"),
			contentType: "audio/mpeg",
		}),
		toImageWidgetErrorMessage: () => "Image failed",
		userMessageText: "Create something",
		withCanonicalPreviewBody: (type, payload) => ({
			...payload,
			body: { kind: type },
		}),
		...overrides,
	};
}

test("isSmartGenerationAbortError detects abort-shaped errors", () => {
	const abortByName = new Error("aborted");
	abortByName.name = "AbortError";
	const abortByCode = new Error("aborted");
	abortByCode.code = "ABORT_ERR";

	assert.equal(isSmartGenerationAbortError(abortByName), true);
	assert.equal(isSmartGenerationAbortError(abortByCode), true);
	assert.equal(isSmartGenerationAbortError(new Error("other")), false);

	const abortController = new AbortController();
	abortController.abort();
	assert.throws(
		() => throwIfSmartGenerationAborted(abortController),
		(error) => error.name === "AbortError" && error.code === "ABORT_ERR"
	);
});

test("createSmartGenerationStream emits image clarification cards and route decisions", async () => {
	const { parts, writer } = createWriter();
	const stream = createSmartGenerationStream(createBaseStreamOptions({
		resolveSmartImagePrompt: () => ({
			needsClarification: true,
			clarificationPayload: {
				title: "Need image details",
				questions: [],
			},
		}),
		smartIntentResult: {
			intent: "image",
		},
	}));

	await stream.execute({ writer });

	const questionCard = parts.find((part) =>
		part.type === "data-widget-data" &&
		part.data.type === "question-card"
	);
	assert.equal(questionCard.data.payload.title, "Need image details");
	assert.deepEqual(questionCard.data.payload.body, { kind: "question-card" });
	assert.deepEqual(
		parts.find((part) => part.type === "data-route-decision")?.data,
		{
			intent: "chat",
			origin: "text",
			reason: "intent_clarification",
		}
	);
	assert.equal(
		parts.find((part) => part.type === "text-delta")?.delta,
		"I need one quick detail before generating the image."
	);
	assert.equal(parts.at(-1).type, "data-turn-complete");
});

test("createSmartGenerationStream passes GenUI narrative into smart audio generation", async () => {
	const { parts, writer } = createWriter();
	const audioInputs = [];
	const stream = createSmartGenerationStream(createBaseStreamOptions({
		generateSmartGenuiResult: async () => ({
			narrative: "Narrative for speech",
			spec: null,
		}),
		resolveSmartAudioVoiceInput: ({ generatedNarrative }) => {
			audioInputs.push(generatedNarrative);
			return {
				voiceInput: generatedNarrative,
				source: "generated-narrative",
				needsClarification: false,
			};
		},
		smartIntentResult: {
			intent: "both",
		},
		streamSmartRouteAudioWidgetGeneration: async ({
			emitWidgetData,
			voiceInput,
			widgetId,
			widgetType,
		}) => {
			emitWidgetData(widgetId, widgetType, {
				transcript: voiceInput,
			});
			return { aborted: false };
		},
	}));

	await stream.execute({ writer });

	assert.deepEqual(audioInputs, ["Narrative for speech"]);
	const genuiPart = parts.find((part) =>
		part.type === "data-widget-data" &&
		part.data.type === "genui-preview"
	);
	assert.equal(genuiPart.data.payload.source, "genui-chat-fallback");
	assert.equal(genuiPart.data.payload.spec.text, "Narrative for speech");
	const audioPart = parts.find((part) =>
		part.type === "data-widget-data" &&
		part.data.type === "audio-preview"
	);
	assert.equal(audioPart.data.payload.transcript, "Narrative for speech");
	assert.equal(parts.at(-1).type, "data-turn-complete");
});

test("createSmartGenerationStream generates GenUI and diagrams on the turn's backend", async () => {
	const genuiCalls = [];
	const textCalls = [];
	const genuiStream = createSmartGenerationStream(createBaseStreamOptions({
		backendPreference: "ai-gateway",
		generateSmartGenuiResult: async (options) => {
			genuiCalls.push(options);
			return { narrative: "Bar chart", spec: { type: "generated" } };
		},
	}));
	await genuiStream.execute({ writer: createWriter().writer });

	const diagramStream = createSmartGenerationStream(createBaseStreamOptions({
		backendPreference: "ai-gateway",
		isExcalidrawDiagramRequest: () => true,
		generateTextViaGateway: async (options) => {
			textCalls.push(options);
			return "{\"type\":\"excalidraw\",\"elements\":[]}";
		},
	}));
	await diagramStream.execute({ writer: createWriter().writer });

	assert.equal(genuiCalls.length, 1);
	assert.equal(genuiCalls[0].backendPreference, "ai-gateway");
	assert.equal(textCalls.length, 1);
	assert.equal(textCalls[0].backendPreference, "ai-gateway");
});

test("streamSmartGenerationRoute wires request aborts and pipes the stream", () => {
	const req = new EventEmitter();
	const res = {};
	const { entries, logger } = createLogger();
	const calls = {
		mapMessages: [],
		pipes: [],
	};

	streamSmartGenerationRoute({
		...createBaseStreamOptions({
			createUIMessageStream: (options) => options,
			logger,
		}),
		logger,
		mapUiMessagesToRoleContent: (messages) => {
			calls.mapMessages.push(messages);
			return [{ role: "user", content: "Create something" }];
		},
		pipeUIMessageStreamToResponse: (input) => calls.pipes.push(input),
		req,
		res,
		smartGeneration: {
			surface: "studio",
		},
	});

	assert.equal(calls.mapMessages.length, 1);
	assert.equal(calls.pipes.length, 1);
	assert.equal(calls.pipes[0].response, res);
	req.emit("close");
	assert.deepEqual(entries.at(-1), [
		"log",
		"[SMART-GENERATION] Client disconnected, aborting smart route",
	]);
});
