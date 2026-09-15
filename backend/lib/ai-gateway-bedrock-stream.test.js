const test = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");

const { streamBedrockGatewayManualSse } = require("./ai-gateway-helpers");
const { createAIGatewayProvider } = require("./ai-gateway-provider");

// streamBedrockGatewayManualSse calls getAuthToken(), which RS256-signs a real
// ASAP JWT. Generate a throwaway keypair so the suite is hermetic and never
// depends on a developer's .env.local or on CI holding ASAP credentials.
const { privateKey: ASAP_TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
	modulusLength: 2048,
	privateKeyEncoding: { type: "pkcs8", format: "pem" },
	publicKeyEncoding: { type: "spki", format: "pem" },
});

const GATEWAY_URL =
	"https://ai-gateway.us-east-1.staging.atl-paas.net/v1/bedrock/model/anthropic.claude-sonnet-5/invoke-with-response-stream";

const ENV_VARS = {
	AI_GATEWAY_URL: GATEWAY_URL,
	AI_GATEWAY_USE_CASE_ID: "rad-venn-prototype",
	AI_GATEWAY_CLOUD_ID: "internal-dummy-rad-venn-prototype",
	AI_GATEWAY_USER_ID: "user@example.com",
};

function sseFrame(payload) {
	return `data: ${JSON.stringify(payload)}\n`;
}

function messageStart({ input = 0, cacheRead = 0, cacheWrite = 0 } = {}) {
	return sseFrame({
		type: "message_start",
		message: {
			usage: {
				input_tokens: input,
				cache_read_input_tokens: cacheRead,
				cache_creation_input_tokens: cacheWrite,
			},
		},
	});
}

function textDelta(text) {
	return sseFrame({ type: "content_block_delta", delta: { type: "text_delta", text } });
}

function messageDelta(outputTokens) {
	return sseFrame({ type: "message_delta", usage: { output_tokens: outputTokens } });
}

function splitIntoChunks(text, chunkSize) {
	const bytes = new TextEncoder().encode(text);
	const chunks = [];
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		chunks.push(bytes.slice(offset, offset + chunkSize));
	}
	return chunks;
}

/**
 * Drives the real streamBedrockGatewayManualSse against a stubbed transport.
 * Restores global.fetch and every gateway/ASAP env var it sets, so the other
 * suites in this directory observe an unmodified process.
 */
async function runBedrockStream({ sse, chunkSize = 4096, viaProvider = false, ...options }) {
	const originalFetch = global.fetch;
	const originalEnv = {
		AI_GATEWAY_URL: process.env.AI_GATEWAY_URL,
		AI_GATEWAY_USE_CASE_ID: process.env.AI_GATEWAY_USE_CASE_ID,
		AI_GATEWAY_CLOUD_ID: process.env.AI_GATEWAY_CLOUD_ID,
		AI_GATEWAY_USER_ID: process.env.AI_GATEWAY_USER_ID,
		ASAP_PRIVATE_KEY: process.env.ASAP_PRIVATE_KEY,
		ASAP_ISSUER: process.env.ASAP_ISSUER,
		ASAP_KID: process.env.ASAP_KID,
	};

	process.env.ASAP_PRIVATE_KEY = ASAP_TEST_PRIVATE_KEY;
	process.env.ASAP_ISSUER = "rad-venn-prototype";
	process.env.ASAP_KID = "test/kid";
	Object.assign(process.env, ENV_VARS);

	let requestBody = null;
	let requestSignal = null;
	const deltas = [];

	global.fetch = async (_url, init) => {
		requestBody = JSON.parse(init.body);
		requestSignal = init.signal;
		const chunks = splitIntoChunks(sse, chunkSize);
		let index = 0;
		return {
			ok: true,
			status: 200,
			headers: { get: () => null },
			body: {
				getReader: () => ({
					read: async () =>
						index < chunks.length
							? { done: false, value: chunks[index++] }
							: { done: true, value: undefined },
				}),
			},
		};
	};

	try {
		const result = viaProvider
			? await createAIGatewayProvider({ logger: { warn() {} } }).streamText({
				gatewayUrl: GATEWAY_URL,
				maxOutputTokens: 256,
				onTextDelta: (text) => deltas.push(text),
				...options,
			})
			: await streamBedrockGatewayManualSse({
				gatewayUrl: GATEWAY_URL,
				envVars: ENV_VARS,
				maxOutputTokens: 256,
				onTextDelta: (text) => deltas.push(text),
				...options,
			});
		return { result, requestBody, requestSignal, deltas };
	} finally {
		global.fetch = originalFetch;
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

test("forwards the caller abort signal to the Bedrock transport", async () => {
	const controller = new AbortController();
	const { requestSignal } = await runBedrockStream({
		sse: textDelta("ok"),
		prompt: "hi",
		messages: [],
		signal: controller.signal,
	});

	assert.equal(requestSignal, controller.signal);
});

test("honors the provider streamText abort signal on the Bedrock branch", async () => {
	const controller = new AbortController();
	const { result, requestSignal } = await runBedrockStream({
		sse: textDelta("ok"),
		viaProvider: true,
		prompt: "hi",
		signal: controller.signal,
	});

	assert.equal(result, "ok");
	assert.equal(requestSignal, controller.signal);
});

test("sends the system prompt through unchanged", async () => {
	const { requestBody } = await runBedrockStream({
		sse: textDelta("ok"),
		system: "STABLE SYSTEM PREFIX",
		prompt: "hi",
		messages: [],
	});

	assert.equal(requestBody.system, "STABLE SYSTEM PREFIX");
	assert.equal(requestBody.anthropic_version, "bedrock-2023-05-31");
});

test("omits system entirely when no system prompt is supplied", async () => {
	const { requestBody } = await runBedrockStream({
		sse: textDelta("ok"),
		prompt: "hi",
		messages: [],
	});

	assert.equal("system" in requestBody, false, "absent, not an empty string the gateway would reject");
});

test("accumulates usage across message_start and message_delta frames", async () => {
	const { result } = await runBedrockStream({
		sse: [
			messageStart({ input: 137, cacheRead: 4096, cacheWrite: 512 }),
			textDelta("Hello"),
			messageDelta(42),
			"data: [DONE]\n",
		].join(""),
		system: "prefix",
		prompt: "hi",
		messages: [],
	});

	assert.deepEqual(result.usage, {
		inputTokens: 137,
		outputTokens: 42,
		cacheReadTokens: 4096,
		cacheWriteTokens: 512,
	});
});

test("reports zeroed usage when the stream carries no usage frames", async () => {
	const { result } = await runBedrockStream({
		sse: textDelta("Hello"),
		prompt: "hi",
		messages: [],
	});

	assert.deepEqual(result.usage, {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
	});
});

test("reassembles text and usage when frames are split mid-line across chunks", async () => {
	const sse = [
		messageStart({ input: 11, cacheRead: 22, cacheWrite: 33 }),
		textDelta("Hello "),
		textDelta("world"),
		messageDelta(7),
		"data: [DONE]\n",
	].join("");

	// One byte per read is the harshest case for the buffer/newline reassembly:
	// every frame arrives split mid-line, including mid-JSON.
	const { result, deltas } = await runBedrockStream({ sse, chunkSize: 1, prompt: "hi", messages: [] });

	assert.equal(result.text, "Hello world");
	assert.deepEqual(deltas, ["Hello ", "world"], "each delta is forwarded once, in order");
	assert.deepEqual(result.usage, {
		inputTokens: 11,
		outputTokens: 7,
		cacheReadTokens: 22,
		cacheWriteTokens: 33,
	});
});

test("flushes a trailing frame that arrives without a closing newline", async () => {
	const sse = `${textDelta("Hello ")}data: ${JSON.stringify({
		type: "content_block_delta",
		delta: { type: "text_delta", text: "world" },
	})}`;

	const { result } = await runBedrockStream({ sse, prompt: "hi", messages: [] });

	assert.equal(result.text, "Hello world", "the post-loop buffer flush must still be processed");
});

test("returns text alongside usage so existing .text-only callers keep working", async () => {
	const { result } = await runBedrockStream({
		sse: [messageStart({ input: 5 }), textDelta("hi"), messageDelta(3)].join(""),
		prompt: "hi",
		messages: [],
	});

	// ai-gateway-provider.js reads (result.text || "").trim() and nothing else.
	assert.equal(result.text, "hi");
	assert.equal(typeof result.usage, "object");
});
