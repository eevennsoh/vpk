"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createGoogleDirectImageStream,
	streamGoogleDirectImageRoute,
} = require("./google-direct-stream");

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
			warn: (...args) => entries.push(["warn", ...args]),
		},
	};
}

function createResponse() {
	const calls = [];
	return {
		calls,
		res: {
			status(statusCode) {
				calls.push(["status", statusCode]);
				return this;
			},
			json(payload) {
				calls.push(["json", payload]);
				return this;
			},
		},
	};
}

function createBaseRouteOptions(overrides = {}) {
	const { res } = createResponse();
	return {
		createUIMessageStream: (options) => options,
		detectEndpointType: () => "generate-content",
		getEnvVars: () => ({}),
		inferPromptIntent: () => "image",
		isStrictToolFirstTurn: false,
		isUnsupportedModalitiesError: () => false,
		latestUserMessage: "Draw a city",
		pipeUIMessageStreamToResponse: () => {},
		provider: "google",
		rawModel: "google/image",
		res,
		resolveGatewayUrl: () => "https://gateway.test",
		resolveGoogleImageGatewayConfig: () => ({
			ok: true,
			envVars: { token: "test" },
			gatewayUrl: "https://gateway.test",
			model: "google/image",
		}),
		streamGoogleGatewayManualSse: async () => {},
		userMessageText: "Draw a city",
		...overrides,
	};
}

test("streamGoogleDirectImageRoute ignores non-Google, strict, and non-image turns", () => {
	assert.equal(streamGoogleDirectImageRoute(createBaseRouteOptions({
		provider: "openai",
	})), false);
	assert.equal(streamGoogleDirectImageRoute(createBaseRouteOptions({
		isStrictToolFirstTurn: true,
	})), false);
	assert.equal(streamGoogleDirectImageRoute(createBaseRouteOptions({
		inferPromptIntent: () => "chat",
	})), false);
});

test("streamGoogleDirectImageRoute preserves gateway config error responses", () => {
	const { calls, res } = createResponse();
	const handled = streamGoogleDirectImageRoute(createBaseRouteOptions({
		res,
		resolveGoogleImageGatewayConfig: () => ({
			ok: false,
			statusCode: 503,
			error: "Image generation not configured",
			details: { reason: "missing-key" },
		}),
	}));

	assert.equal(handled, true);
	assert.deepEqual(calls, [
		["status", 503],
		["json", {
			error: "Image generation not configured",
			details: { reason: "missing-key" },
		}],
	]);
});

test("streamGoogleDirectImageRoute pipes handled image streams", () => {
	const pipes = [];
	const handled = streamGoogleDirectImageRoute(createBaseRouteOptions({
		pipeUIMessageStreamToResponse: (input) => pipes.push(input),
	}));

	assert.equal(handled, true);
	assert.equal(pipes.length, 1);
	assert.equal(typeof pipes[0].stream.execute, "function");
});

test("createGoogleDirectImageStream emits text framing and file parts", async () => {
	const { parts, writer } = createWriter();
	const stream = createGoogleDirectImageStream({
		createUIMessageStream: (options) => options,
		googleImageConfig: {
			envVars: { token: "test" },
			gatewayUrl: "https://gateway.test",
			model: "google/image",
		},
		isUnsupportedModalitiesError: () => false,
		streamGoogleGatewayManualSse: async ({ onTextDelta, onFile }) => {
			onTextDelta("Here is the image.");
			onFile({ base64: "aW1hZ2U=" });
		},
		userMessageText: "Draw a city",
	});

	await stream.execute({ writer });

	assert.equal(parts[0].type, "text-start");
	assert.deepEqual(parts[1], {
		type: "text-delta",
		id: parts[0].id,
		delta: "Here is the image.",
	});
	assert.deepEqual(parts[2], {
		type: "file",
		mediaType: "image/png",
		url: "data:image/png;base64,aW1hZ2U=",
	});
	assert.deepEqual(parts[3], {
		type: "text-end",
		id: parts[0].id,
	});
	// Regression: the image reply used to close without the turn boundary, so the
	// client flagged every successful Google image turn as cut short.
	assert.equal(parts.length, 5);
	assert.equal(parts[4].type, "data-turn-complete");
	assert.equal(typeof parts[4].data.timestamp, "string");
});

test("createGoogleDirectImageStream retries without modalities when unsupported", async () => {
	const { parts, writer } = createWriter();
	const { entries, logger } = createLogger();
	const calls = [];
	const unsupportedError = new Error("Unsupported response modalities");
	const stream = createGoogleDirectImageStream({
		createUIMessageStream: (options) => options,
		googleImageConfig: {
			envVars: {},
			gatewayUrl: "https://gateway.test",
			model: "google/image",
		},
		isUnsupportedModalitiesError: (error) => error === unsupportedError,
		logger,
		streamGoogleGatewayManualSse: async (options) => {
			calls.push(options);
			if (calls.length === 1) {
				throw unsupportedError;
			}
			options.onTextDelta("Retried text");
			options.onFile({ mediaType: "image/jpeg", base64: "cmV0cnk=" });
		},
		userMessageText: "Draw a city",
	});

	await stream.execute({ writer });

	assert.deepEqual(calls.map((call) => call.responseModalities), [
		["image"],
		undefined,
	]);
	assert.equal(entries[0][0], "warn");
	assert.equal(parts.find((part) => part.type === "text-delta").delta, "Retried text");
	assert.deepEqual(parts.find((part) => part.type === "file"), {
		type: "file",
		mediaType: "image/jpeg",
		url: "data:image/jpeg;base64,cmV0cnk=",
	});
});

test("createGoogleDirectImageStream keeps existing error mapping", () => {
	const stream = createGoogleDirectImageStream({
		createUIMessageStream: (options) => options,
		googleImageConfig: {},
		isUnsupportedModalitiesError: () => false,
		streamGoogleGatewayManualSse: async () => {},
		userMessageText: "Draw a city",
	});

	assert.equal(stream.onError(new Error("Gateway failed")), "Gateway failed");
	assert.equal(stream.onError("bad"), "Failed to stream Google AI response");
});
