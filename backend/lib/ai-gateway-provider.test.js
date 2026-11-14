const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { buildOpenAiCompletionPayload, createAIGatewayProvider } = require("./ai-gateway-provider");

test("GPT-6.1 Sol sends a chat completion payload without unsupported temperature", () => {
	const messages = [{ role: "user", content: "Hello" }];
	assert.deepEqual(buildOpenAiCompletionPayload({
		model: "gpt-6.1-sol",
		messages,
		maxOutputTokens: 256,
		temperature: 0.4,
	}), {
		model: "gpt-6.1-sol",
		messages,
		max_completion_tokens: 2048,
		stream: false,
	});
});

test("GPT-6 Sol keeps larger requested completion budgets", () => {
	assert.equal(buildOpenAiCompletionPayload({
		model: "gpt-6.1-sol",
		messages: [],
		maxOutputTokens: 8000,
	}).max_completion_tokens, 8000);
});

test("other OpenAI models retain their requested temperature", () => {
	const payload = buildOpenAiCompletionPayload({
		model: "gpt-4.1",
		messages: [],
		temperature: 0.4,
	});
	assert.equal(payload.temperature, 0.4);
	assert.equal(Object.hasOwn(payload, "max_completion_tokens"), false);
});

const SSE_OK = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n';
const TEMPERATURE_REJECTION = JSON.stringify({
	status: 400,
	message: "Unsupported value: 'temperature' does not support 0.1 with this model. Only the default (1) value is supported.",
});

// Stubs ASAP credentials, OPENAI_MODEL and fetch; respond(body, index) answers each gateway request.
function stubGateway(t, { model, respond }) {
	const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
	const envKeys = ["ASAP_PRIVATE_KEY", "ASAP_KID", "ASAP_ISSUER", "OPENAI_MODEL"];
	const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
	process.env.ASAP_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" });
	process.env.ASAP_KID = "test-kid";
	process.env.ASAP_ISSUER = "test-issuer";
	process.env.OPENAI_MODEL = model;
	const requestBodies = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (_url, init) => {
		const body = JSON.parse(init.body);
		requestBodies.push(body);
		return respond(body, requestBodies.length - 1);
	};
	t.after(() => {
		globalThis.fetch = originalFetch;
		for (const key of envKeys) {
			if (previousEnv[key] === undefined) delete process.env[key];
			else process.env[key] = previousEnv[key];
		}
	});
	return requestBodies;
}

function generateClassifierText() {
	return createAIGatewayProvider({ logger: { warn() {} } }).generateText({
		gatewayUrl: "https://ai-gateway.example.test/v1/openai/v1/chat/completions",
		prompt: "Classify this request.",
		maxOutputTokens: 220,
		temperature: 0.1,
	});
}

// The gateway answers 400 to any non-default temperature for reasoning models; GPT-5.6 Sol
// (a common OPENAI_MODEL override) slipped past the old GPT-6-only check.
for (const model of ["gpt-5.6-sol", "gpt-6.1-sol"]) {
	test(`${model} artifact requests are accepted by a gateway that rejects temperature`, async (t) => {
		const requestBodies = stubGateway(t, {
			model,
			respond: (body) => Object.hasOwn(body, "temperature")
				? new Response(TEMPERATURE_REJECTION, { status: 400 })
				: new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }),
		});

		assert.equal(await generateClassifierText(), "ok");
		assert.equal(requestBodies.length, 1);
		assert.equal(requestBodies[0].model, model);
	});
}

// A failed OpenAI-compatible call retries through the streaming parser, which used to
// re-add temperature and turn any first failure into a temperature rejection.
test("reasoning-model fallback request omits temperature", async (t) => {
	const requestBodies = stubGateway(t, {
		model: "gpt-5.6-sol",
		respond: (_body, index) => index === 0
			? new Response("upstream unavailable", { status: 500 })
			: new Response(SSE_OK, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
	});

	assert.equal(await generateClassifierText(), "ok");
	assert.equal(requestBodies.length, 2);
	for (const body of requestBodies) {
		assert.equal(Object.hasOwn(body, "temperature"), false);
		assert.equal(body.max_completion_tokens, 2048);
	}
});
