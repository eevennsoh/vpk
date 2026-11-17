"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildAudioDataUrl,
	handleDirectRovoMediaFences,
	streamAudioWidgetGeneration,
	streamDirectRovoAudioFenceWidgetGeneration,
	streamDirectRovoImageFenceWidgetGeneration,
	streamImageWidgetGeneration,
	streamSmartRouteAudioWidgetGeneration,
	streamSmartRouteImageWidgetGeneration,
} = require("./media-generation-stream");

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
	const errors = [];
	const infos = [];
	const warnings = [];
	return {
		errors,
		infos,
		logger: {
			error(...args) {
				errors.push(args);
			},
			info(...args) {
				infos.push(args);
			},
			warn(...args) {
				warnings.push(args);
			},
		},
		warnings,
	};
}

function wrapPayload(type, payload) {
	return {
		...payload,
		body: { kind: type },
	};
}

function createSmartRouteEmitters() {
	const parts = [];
	return {
		parts,
		emitWidgetLoading(id, type, loading) {
			parts.push({
				type: "data-widget-loading",
				id,
				data: { type, loading },
			});
		},
		emitWidgetData(id, type, payload) {
			parts.push({
				type: "data-widget-data",
				id,
				data: { type, payload },
			});
		},
		emitWidgetError(id, type, message) {
			parts.push({
				type: "data-widget-error",
				id,
				data: { type, message, canRetry: true },
			});
		},
		emitTextDelta(delta) {
			parts.push({ type: "text-delta", delta });
		},
	};
}

test("buildAudioDataUrl defaults missing content type to mp3", () => {
	assert.equal(buildAudioDataUrl(Buffer.from("abc"), ""), "data:audio/mpeg;base64,YWJj");
});

test("streamAudioWidgetGeneration emits loading, audio data, text, and completion loading", async () => {
	const { parts, writer } = createWriter();
	const beforeCalls = [];

	await streamAudioWidgetGeneration({
		inputSource: "context",
		onBeforeGenerate: () => beforeCalls.push("before"),
		source: "audio-context-clarification",
		stripConversationalFiller: (input) => input.replace(/^please read\s+/iu, ""),
		synthesizeSound: async (input) => {
			assert.deepEqual(input, {
				input: "please read hello",
				provider: "google",
				model: "tts-latest",
				responseFormat: "mp3",
			});
			return {
				audioBytes: Buffer.from("sound"),
				contentType: "audio/wav",
			};
		},
		textId: "text-1",
		voiceInput: "please read hello",
		widgetId: "widget-1",
		widgetPayloadWrapper: wrapPayload,
		widgetType: "audio-preview",
		writer,
	});

	assert.deepEqual(beforeCalls, ["before"]);
	assert.equal(parts[0].type, "data-thinking-status");
	assert.deepEqual(parts[1], {
		type: "data-widget-loading",
		id: "widget-1",
		data: { type: "audio-preview", loading: true },
	});
	const widgetData = parts.find((part) => part.type === "data-widget-data");
	assert.equal(widgetData.data.payload.audioUrl, "data:audio/wav;base64,c291bmQ=");
	assert.equal(widgetData.data.payload.transcript, "hello");
	assert.equal(widgetData.data.payload.source, "audio-context-clarification");
	assert.equal(widgetData.data.payload.inputSource, "context");
	assert.equal(parts.find((part) => part.type === "text-delta")?.delta, "please read hello");
	assert.deepEqual(parts.at(-1), {
		type: "data-widget-loading",
		id: "widget-1",
		data: { type: "audio-preview", loading: false },
	});
});

test("streamAudioWidgetGeneration emits widget error and fallback text on failure", async () => {
	const { parts, writer } = createWriter();
	const { errors, logger } = createLogger();

	await streamAudioWidgetGeneration({
		errorLogLabel: "[TEST] Audio failed:",
		source: "media-bypass-audio",
		stripConversationalFiller: (input) => input,
		synthesizeSound: async () => {
			throw new Error("synth failed");
		},
		textId: "text-1",
		voiceInput: "hello",
		widgetId: "widget-1",
		widgetPayloadWrapper: wrapPayload,
		widgetType: "audio-preview",
		writer,
		logger,
	});

	assert.equal(errors.length, 1);
	assert.equal(errors[0][0], "[TEST] Audio failed:");
	assert.deepEqual(
		parts.find((part) => part.type === "data-widget-error"),
		{
			type: "data-widget-error",
			id: "widget-1",
			data: {
				type: "audio-preview",
				message: "synth failed",
				canRetry: true,
			},
		},
	);
	assert.equal(
		parts.find((part) => part.type === "text-delta")?.delta,
		"I couldn't generate audio right now.",
	);
	assert.equal(parts.at(-1).data.loading, false);
});

test("streamImageWidgetGeneration emits image widget data and ignores non-image files", async () => {
	const { parts, writer } = createWriter();
	const calls = [];

	await streamImageWidgetGeneration({
		imageGatewayConfig: {
			gatewayUrl: "https://gateway.test",
			envVars: { KEY: "value" },
			model: "image-model",
		},
		inputSource: "context",
		isUnsupportedModalitiesError: () => false,
		payloadPrompt: "Draw the thing",
		prompt: "Enriched image prompt",
		source: "image-context-clarification",
		streamGoogleGatewayManualSse: async (options) => {
			calls.push(options);
			options.onFile({ mediaType: "text/plain", base64: "dGV4dA==" });
			options.onFile({ mediaType: "image/jpeg", base64: "aW1hZ2U=" });
		},
		system: "System prompt",
		widgetId: "widget-1",
		widgetPayloadWrapper: wrapPayload,
		widgetType: "image-preview",
		writer,
	});

	assert.equal(calls.length, 1);
	assert.equal(calls[0].prompt, "Enriched image prompt");
	assert.equal(calls[0].system, "System prompt");
	assert.deepEqual(calls[0].responseModalities, ["image"]);
	const widgetData = parts.find((part) => part.type === "data-widget-data");
	assert.deepEqual(widgetData.data.payload.images, [
		{
			url: "data:image/jpeg;base64,aW1hZ2U=",
			mimeType: "image/jpeg",
		},
	]);
	assert.equal(widgetData.data.payload.prompt, "Draw the thing");
	assert.equal(widgetData.data.payload.source, "image-context-clarification");
	assert.equal(widgetData.data.payload.inputSource, "context");
	assert.equal(parts.some((part) => part.type === "data-widget-error"), false);
	assert.equal(parts.at(-1).data.loading, false);
});

test("streamImageWidgetGeneration retries without response modalities when unsupported", async () => {
	const { parts, writer } = createWriter();
	const calls = [];
	const modalitiesError = new Error("unsupported modalities");

	await streamImageWidgetGeneration({
		imageGatewayConfig: {
			gatewayUrl: "https://gateway.test",
			envVars: {},
			model: "image-model",
		},
		isUnsupportedModalitiesError: (error) => error === modalitiesError,
		payloadPrompt: "Draw",
		prompt: "Draw",
		source: "media-bypass-image",
		streamGoogleGatewayManualSse: async (options) => {
			calls.push(options);
			if (calls.length === 1) {
				throw modalitiesError;
			}
			options.onFile({ mediaType: "", base64: "cG5n" });
		},
		widgetId: "widget-1",
		widgetPayloadWrapper: wrapPayload,
		widgetType: "image-preview",
		writer,
	});

	assert.equal(calls.length, 2);
	assert.deepEqual(calls[0].responseModalities, ["image"]);
	assert.equal(calls[1].responseModalities, undefined);
	assert.deepEqual(
		parts.find((part) => part.type === "data-widget-data").data.payload.images,
		[
			{
				url: "data:image/png;base64,cG5n",
				mimeType: "image/png",
			},
		],
	);
});

test("streamImageWidgetGeneration emits no-image error when gateway returns no images", async () => {
	const { parts, writer } = createWriter();

	await streamImageWidgetGeneration({
		imageGatewayConfig: {
			gatewayUrl: "https://gateway.test",
			envVars: {},
			model: "image-model",
		},
		isUnsupportedModalitiesError: () => false,
		noImageMessage: "No image.",
		payloadPrompt: "Draw",
		prompt: "Draw",
		source: "media-bypass-image",
		streamGoogleGatewayManualSse: async () => {},
		widgetId: "widget-1",
		widgetPayloadWrapper: wrapPayload,
		widgetType: "image-preview",
		writer,
	});

	assert.deepEqual(
		parts.find((part) => part.type === "data-widget-error"),
		{
			type: "data-widget-error",
			id: "widget-1",
			data: {
				type: "image-preview",
				message: "No image.",
				canRetry: true,
			},
		},
	);
	assert.equal(parts.at(-1).data.loading, false);
});

test("streamSmartRouteImageWidgetGeneration retries unsupported modalities and emits smart image payloads", async () => {
	const emitters = createSmartRouteEmitters();
	const calls = [];
	const modalitiesError = new Error("unsupported modalities");
	const abortController = new AbortController();

	const result = await streamSmartRouteImageWidgetGeneration({
		abortSignal: abortController.signal,
		emitWidgetData: emitters.emitWidgetData,
		emitWidgetError: emitters.emitWidgetError,
		emitWidgetLoading: emitters.emitWidgetLoading,
		imageGatewayConfig: {
			ok: true,
			gatewayUrl: "https://gateway.test",
			envVars: {},
			model: "image-model",
		},
		inputSource: "context",
		isSmartRouteAbortError: (error) => error?.name === "AbortError",
		isUnsupportedModalitiesError: (error) => error === modalitiesError,
		latestUserMessage: "Draw it",
		logger: {
			warn(message) {
				calls.push({ type: "warn", message });
			},
			error() {},
		},
		prompt: "Image prompt",
		streamGoogleGatewayManualSse: async (options) => {
			calls.push(options);
			if (calls.filter((call) => call.gatewayUrl).length === 1) {
				throw modalitiesError;
			}
			options.onFile({ mediaType: "", base64: "cG5n" });
		},
		system: "System",
		throwIfAborted: () => {
			if (abortController.signal.aborted) {
				const error = new Error("aborted");
				error.name = "AbortError";
				throw error;
			}
		},
		toImageWidgetErrorMessage: () => "",
		widgetId: "image-widget",
		widgetType: "image-preview",
	});

	assert.equal(result.aborted, false);
	assert.equal(calls.filter((call) => call.gatewayUrl).length, 2);
	assert.deepEqual(calls.find((call) => call.gatewayUrl).responseModalities, ["image"]);
	assert.equal(calls.filter((call) => call.gatewayUrl)[1].responseModalities, undefined);
	assert.equal(calls.some((call) => call.type === "warn"), true);
	assert.deepEqual(
		emitters.parts.find((part) => part.type === "data-widget-data").data.payload,
		{
			images: [
				{
					url: "data:image/png;base64,cG5n",
					mimeType: "image/png",
				},
			],
			prompt: "Draw it",
			source: "chat-sdk-google-image",
			inputSource: "context",
		},
	);
	assert.equal(emitters.parts.at(-1).data.loading, false);
});

test("streamSmartRouteImageWidgetGeneration returns aborted without closing loading", async () => {
	const emitters = createSmartRouteEmitters();
	const abortController = new AbortController();
	abortController.abort();

	const result = await streamSmartRouteImageWidgetGeneration({
		abortSignal: abortController.signal,
		emitWidgetData: emitters.emitWidgetData,
		emitWidgetError: emitters.emitWidgetError,
		emitWidgetLoading: emitters.emitWidgetLoading,
		imageGatewayConfig: { ok: true },
		isSmartRouteAbortError: (error) => error?.name === "AbortError",
		isUnsupportedModalitiesError: () => false,
		latestUserMessage: "Draw",
		prompt: "Draw",
		streamGoogleGatewayManualSse: async () => {
			throw new Error("should not stream");
		},
		throwIfAborted: () => {
			const error = new Error("aborted");
			error.name = "AbortError";
			throw error;
		},
		toImageWidgetErrorMessage: () => "",
		widgetId: "image-widget",
		widgetType: "image-preview",
	});

	assert.equal(result.aborted, true);
	assert.deepEqual(emitters.parts, [
		{
			type: "data-widget-loading",
			id: "image-widget",
			data: { type: "image-preview", loading: true },
		},
	]);
});

test("streamSmartRouteAudioWidgetGeneration emits audio data and optional echo text", async () => {
	const emitters = createSmartRouteEmitters();
	const abortController = new AbortController();
	const calls = [];

	const result = await streamSmartRouteAudioWidgetGeneration({
		abortSignal: abortController.signal,
		emitTextDelta: emitters.emitTextDelta,
		emitWidgetData: emitters.emitWidgetData,
		emitWidgetError: emitters.emitWidgetError,
		emitWidgetLoading: emitters.emitWidgetLoading,
		inputSource: "context",
		isSmartRouteAbortError: (error) => error?.name === "AbortError",
		shouldEchoVoiceInput: true,
		stripConversationalFiller: (input) => input.replace("please read ", ""),
		synthesizeSound: async (input) => {
			calls.push(input);
			return {
				audioBytes: Buffer.from("sound"),
				contentType: "audio/mpeg",
			};
		},
		throwIfAborted: () => {},
		voiceInput: "please read hello",
		widgetId: "audio-widget",
		widgetType: "audio-preview",
	});

	assert.equal(result.aborted, false);
	assert.equal(calls[0].signal, abortController.signal);
	assert.deepEqual(
		emitters.parts.find((part) => part.type === "data-widget-data").data.payload,
		{
			audioUrl: "data:audio/mpeg;base64,c291bmQ=",
			mimeType: "audio/mpeg",
			transcript: "hello",
			source: "sound-generation",
			inputSource: "context",
		},
	);
	assert.equal(emitters.parts.find((part) => part.type === "text-delta")?.delta, "please read hello");
	assert.equal(emitters.parts.at(-1).data.loading, false);
});

test("streamSmartRouteAudioWidgetGeneration emits voice fallback on failure", async () => {
	const emitters = createSmartRouteEmitters();
	const { errors, logger } = createLogger();

	const result = await streamSmartRouteAudioWidgetGeneration({
		abortSignal: new AbortController().signal,
		emitTextDelta: emitters.emitTextDelta,
		emitWidgetData: emitters.emitWidgetData,
		emitWidgetError: emitters.emitWidgetError,
		emitWidgetLoading: emitters.emitWidgetLoading,
		isSmartRouteAbortError: (error) => error?.name === "AbortError",
		logger,
		stripConversationalFiller: (input) => input,
		synthesizeSound: async () => {
			throw new Error("failed");
		},
		throwIfAborted: () => {},
		voiceInput: "hello",
		widgetId: "audio-widget",
		widgetType: "audio-preview",
	});

	assert.equal(result.aborted, false);
	assert.equal(errors[0][0], "[SMART-GENERATION] Audio generation failed:");
	assert.deepEqual(
		emitters.parts.find((part) => part.type === "data-widget-error"),
		{
			type: "data-widget-error",
			id: "audio-widget",
			data: {
				type: "audio-preview",
				message: "I couldn't generate voice output right now.",
				canRetry: true,
			},
		},
	);
	assert.equal(
		emitters.parts.find((part) => part.type === "text-delta")?.delta,
		"I couldn't generate voice output right now.",
	);
	assert.equal(emitters.parts.at(-1).data.loading, false);
});

test("streamDirectRovoImageFenceWidgetGeneration preserves direct image fence payload behavior", async () => {
	const { parts, writer } = createWriter();
	const abortController = new AbortController();
	const calls = [];

	await streamDirectRovoImageFenceWidgetGeneration({
		imageGatewayConfig: {
			ok: true,
			gatewayUrl: "https://gateway.test",
			envVars: {},
			model: "image-model",
		},
		imagePayload: { prompt: "Draw directly" },
		latestUserMessage: "Fallback prompt",
		signal: abortController.signal,
		streamGoogleGatewayManualSse: async (options) => {
			calls.push(options);
			options.onFile({ mediaType: "application/octet-stream", base64: "YmluYXJ5" });
		},
		widgetId: "direct-image-widget",
		widgetPayloadWrapper: wrapPayload,
		widgetType: "image-preview",
		writer,
	});

	assert.equal(calls.length, 1);
	assert.equal(calls[0].prompt, "Draw directly");
	assert.deepEqual(calls[0].responseModalities, ["image"]);
	assert.equal(calls[0].signal, abortController.signal);
	assert.deepEqual(
		parts.find((part) => part.type === "data-widget-data").data.payload,
		{
			images: [
				{
					url: "data:application/octet-stream;base64,YmluYXJ5",
					mimeType: "application/octet-stream",
				},
			],
			prompt: "Draw directly",
			source: "direct-rovo-image",
			body: { kind: "image-preview" },
		},
	);
	assert.equal(parts.some((part) => part.type === "data-widget-error"), false);
	assert.equal(parts.at(-1).data.loading, false);
});

test("streamDirectRovoImageFenceWidgetGeneration closes loading without error when image gateway config is unavailable", async () => {
	const { parts, writer } = createWriter();
	let streamCalled = false;

	await streamDirectRovoImageFenceWidgetGeneration({
		imageGatewayConfig: {
			ok: false,
		},
		imagePayload: { prompt: "Draw directly" },
		latestUserMessage: "Fallback prompt",
		streamGoogleGatewayManualSse: async () => {
			streamCalled = true;
		},
		widgetId: "direct-image-widget",
		widgetPayloadWrapper: wrapPayload,
		widgetType: "image-preview",
		writer,
	});

	assert.equal(streamCalled, false);
	assert.equal(parts.some((part) => part.type === "data-widget-data"), false);
	assert.equal(parts.some((part) => part.type === "data-widget-error"), false);
	assert.deepEqual(parts.at(-1), {
		type: "data-widget-loading",
		id: "direct-image-widget",
		data: { type: "image-preview", loading: false },
	});
});

test("streamDirectRovoImageFenceWidgetGeneration emits generic widget error on stream failure", async () => {
	const { parts, writer } = createWriter();
	const { errors, logger } = createLogger();

	await streamDirectRovoImageFenceWidgetGeneration({
		imageGatewayConfig: {
			ok: true,
			gatewayUrl: "https://gateway.test",
			envVars: {},
			model: "image-model",
		},
		imagePayload: { prompt: "Draw directly" },
		latestUserMessage: "Fallback prompt",
		logger,
		streamGoogleGatewayManualSse: async () => {
			throw new Error("gateway failed");
		},
		widgetId: "direct-image-widget",
		widgetPayloadWrapper: wrapPayload,
		widgetType: "image-preview",
		writer,
	});

	assert.deepEqual(errors[0], [
		"[DIRECT-IMAGE] Image generation failed:",
		"gateway failed",
	]);
	assert.deepEqual(
		parts.find((part) => part.type === "data-widget-error"),
		{
			type: "data-widget-error",
			id: "direct-image-widget",
			data: {
				type: "image-preview",
				message: "Image generation failed.",
				canRetry: true,
			},
		},
	);
	assert.equal(parts.at(-1).data.loading, false);
});

test("streamDirectRovoAudioFenceWidgetGeneration emits direct audio payload without assistant text", async () => {
	const { parts, writer } = createWriter();
	const calls = [];

	await streamDirectRovoAudioFenceWidgetGeneration({
		audioPayload: { text: "Read this" },
		synthesizeSound: async (input) => {
			calls.push(input);
			return {
				audioBytes: Buffer.from("sound"),
				contentType: "audio/mpeg",
			};
		},
		widgetId: "direct-audio-widget",
		widgetPayloadWrapper: wrapPayload,
		widgetType: "audio-preview",
		writer,
	});

	assert.deepEqual(calls, [
		{
			input: "Read this",
			provider: "google",
			model: "tts-latest",
			responseFormat: "mp3",
		},
	]);
	assert.deepEqual(
		parts.find((part) => part.type === "data-widget-data").data.payload,
		{
			audioUrl: "data:audio/mpeg;base64,c291bmQ=",
			mimeType: "audio/mpeg",
			transcript: "Read this",
			source: "direct-rovo-audio",
			body: { kind: "audio-preview" },
		},
	);
	assert.equal(parts.some((part) => part.type === "text-delta"), false);
	assert.equal(parts.at(-1).data.loading, false);
});

test("streamDirectRovoAudioFenceWidgetGeneration emits generic widget error on synthesis failure", async () => {
	const { parts, writer } = createWriter();
	const { errors, logger } = createLogger();

	await streamDirectRovoAudioFenceWidgetGeneration({
		audioPayload: { text: "Read this" },
		logger,
		synthesizeSound: async () => {
			throw new Error("tts failed");
		},
		widgetId: "direct-audio-widget",
		widgetPayloadWrapper: wrapPayload,
		widgetType: "audio-preview",
		writer,
	});

	assert.deepEqual(errors[0], [
		"[DIRECT-AUDIO] Audio generation failed:",
		"tts failed",
	]);
	assert.deepEqual(
		parts.find((part) => part.type === "data-widget-error"),
		{
			type: "data-widget-error",
			id: "direct-audio-widget",
			data: {
				type: "audio-preview",
				message: "Audio generation failed.",
				canRetry: true,
			},
		},
	);
	assert.equal(parts.at(-1).data.loading, false);
});

test("handleDirectRovoMediaFences delegates direct image and audio fences and strips them from assistant text", async () => {
	const { infos, logger } = createLogger();
	const calls = [];

	const result = await handleDirectRovoMediaFences({
		abortSignal: "signal",
		assistantText: [
			"Before",
			"```image",
			JSON.stringify({ prompt: "Draw a bridge" }),
			"```",
			"Middle",
			"```audio",
			JSON.stringify({ text: "Read this line" }),
			"```",
			"After",
		].join("\n"),
		detectEndpointType: () => "google",
		getEnvVars: () => ({ KEY: "value" }),
		latestUserMessage: "Fallback prompt",
		logger,
		now: () => 42 + calls.length,
		rawModel: "model",
		resolveGatewayUrl: () => "https://gateway.test",
		resolveGoogleImageGatewayConfig: (input) => {
			calls.push({ type: "resolve-image-config", input });
			return { ok: true };
		},
		streamDirectAudioFenceWidgetGeneration: async (input) => {
			calls.push({ type: "audio", input });
		},
		streamDirectImageFenceWidgetGeneration: async (input) => {
			calls.push({ type: "image", input });
			input.resolveImageGatewayConfig();
		},
		streamGoogleGatewayManualSse: async () => {},
		stripDirectMediaFences: (text) => text.replace(/```(?:image|audio)\s*\n[\s\S]*?```/giu, "").trim(),
		synthesizeSound: async () => {},
		widgetPayloadWrapper: wrapPayload,
		widgetTypeAudio: "audio-preview",
		widgetTypeImage: "image-preview",
		writer: {},
	});

	assert.equal(result.hasMediaFence, true);
	assert.equal(result.assistantText, "Before\n\nMiddle\n\nAfter");
	assert.equal(calls[0].type, "image");
	assert.equal(calls[0].input.widgetId, "widget-direct-image-42");
	assert.equal(calls[0].input.imagePayload.prompt, "Draw a bridge");
	assert.equal(calls[1].type, "resolve-image-config");
	assert.deepEqual(calls[1].input.envVars, { KEY: "value" });
	assert.equal(calls[2].type, "audio");
	assert.equal(calls[2].input.widgetId, "widget-direct-audio-44");
	assert.equal(calls[2].input.audioPayload.text, "Read this line");
	assert.deepEqual(infos.map((entry) => entry[0]), [
		"[DIRECT-IMAGE] Processed image fence from Rovo",
		"[DIRECT-AUDIO] Processed audio fence from Rovo",
	]);
});

test("handleDirectRovoMediaFences strips malformed fences without invoking generation", async () => {
	const { logger, warnings } = createLogger();
	const calls = [];

	const result = await handleDirectRovoMediaFences({
		assistantText: [
			"Before",
			"```image",
			"{not json",
			"```",
			"After",
		].join("\n"),
		getEnvVars: () => ({}),
		latestUserMessage: "Fallback prompt",
		logger,
		resolveGoogleImageGatewayConfig: () => {
			calls.push("resolve-image-config");
			return { ok: true };
		},
		streamDirectAudioFenceWidgetGeneration: async () => {
			calls.push("audio");
		},
		streamDirectImageFenceWidgetGeneration: async () => {
			calls.push("image");
		},
		stripDirectMediaFences: (text) => text.replace(/```image\s*\n[\s\S]*?```/iu, "").trim(),
		widgetTypeAudio: "audio-preview",
		widgetTypeImage: "image-preview",
		writer: {},
	});

	assert.equal(result.hasMediaFence, true);
	assert.equal(result.assistantText, "Before\n\nAfter");
	assert.deepEqual(calls, []);
	assert.equal(warnings[0][0], "[DIRECT-IMAGE] Failed to parse image fence JSON:");
});

test("handleDirectRovoMediaFences reads the whole body when it holds backticks", async () => {
	// Before: the body ended at its first backticks, so JSON.parse failed and nothing was generated.
	const T = "```";
	const calls = [];
	const { stripDirectMediaFences } = require("../lib/direct-media-fence");

	const result = await handleDirectRovoMediaFences({
		assistantText: [
			"Before",
			`${T}image`,
			JSON.stringify({ prompt: `A sign that reads ${T}js` }),
			T,
			`${T}audio`,
			`${JSON.stringify({ text: `Say ${T} twice` })}${T}`,
			"After",
		].join("\n"),
		getEnvVars: () => ({}),
		latestUserMessage: "Fallback prompt",
		logger: createLogger().logger,
		now: () => 7,
		resolveGoogleImageGatewayConfig: () => ({ ok: true }),
		streamDirectAudioFenceWidgetGeneration: async (input) => {
			calls.push(["audio", input.audioPayload]);
		},
		streamDirectImageFenceWidgetGeneration: async (input) => {
			calls.push(["image", input.imagePayload]);
		},
		stripDirectMediaFences,
		widgetTypeAudio: "audio-preview",
		widgetTypeImage: "image-preview",
		writer: {},
	});

	assert.deepEqual(calls, [
		["image", { prompt: `A sign that reads ${T}js` }],
		["audio", { text: `Say ${T} twice` }],
	]);
	assert.equal(result.hasMediaFence, true);
	assert.equal(result.assistantText, "Before\n\nAfter");
});
