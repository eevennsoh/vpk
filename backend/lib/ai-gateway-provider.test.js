const test = require("node:test");
const assert = require("node:assert/strict");
const { buildOpenAiCompletionPayload } = require("./ai-gateway-provider");

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
