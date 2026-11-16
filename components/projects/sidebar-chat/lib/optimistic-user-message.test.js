const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

async function loadOptimisticUserMessageModule() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					appendOptimisticCompactUserMessage,
					createOptimisticCompactUserMessage,
					getCompactPromptMessageId,
				} from "./components/projects/sidebar-chat/lib/optimistic-user-message.ts";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "optimistic-user-message-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

function createPrompt(overrides = {}) {
	return {
		id: "prompt-1",
		files: [],
		text: "Should we respond to this RFP?",
		createdAt: Date.parse("2026-05-18T01:00:00.000Z"),
		...overrides,
	};
}

test("compact chat appends an optimistic user message while a prompt is queued before SDK echo", async () => {
	const { appendOptimisticCompactUserMessage } = await loadOptimisticUserMessageModule();
	const prompt = createPrompt();
	const messages = [
		{
			id: "older-user",
			role: "user",
			parts: [{ type: "text", text: prompt.text, state: "done" }],
		},
		{
			id: "assistant-1",
			role: "assistant",
			parts: [
				{ type: "text", text: "Done", state: "done" },
				{ type: "data-turn-complete", data: { timestamp: "2026-05-18T00:59:00.000Z" } },
			],
		},
	];

	const result = appendOptimisticCompactUserMessage(messages, prompt);

	assert.equal(result.length, 3);
	assert.equal(result[2].role, "user");
	assert.equal(result[2].id, "compact-user-prompt-1");
	assert.deepEqual(result[2].parts, [
		{ type: "text", text: prompt.text, state: "done" },
	]);
});

test("compact chat does not duplicate the optimistic bubble after the SDK user message appears", async () => {
	const { appendOptimisticCompactUserMessage } = await loadOptimisticUserMessageModule();
	const prompt = createPrompt();
	const messages = [
		{
			id: "assistant-1",
			role: "assistant",
			parts: [
				{ type: "text", text: "Done", state: "done" },
				{ type: "data-turn-complete", data: { timestamp: "2026-05-18T00:59:00.000Z" } },
			],
		},
		{
			id: "sdk-user-1",
			role: "user",
			metadata: { promptId: prompt.id },
			parts: [{ type: "text", text: prompt.text, state: "done" }],
		},
	];

	const result = appendOptimisticCompactUserMessage(messages, prompt);

	assert.equal(result.length, 2);
	assert.equal(result, messages);
});

test("compact chat inserts the optimistic user bubble before a streamed assistant trace when the SDK user echo has not arrived", async () => {
	const { appendOptimisticCompactUserMessage } = await loadOptimisticUserMessageModule();
	const prompt = createPrompt();
	const messages = [
		{
			id: "assistant-thinking",
			role: "assistant",
			parts: [
				{
					type: "data-thinking-status",
					data: {
						label: "Coordinating agents",
					},
				},
			],
		},
	];

	const result = appendOptimisticCompactUserMessage(messages, prompt);

	assert.equal(result.length, 2);
	assert.equal(result[0].role, "user");
	assert.equal(result[0].id, "compact-user-prompt-1");
	assert.equal(result[1], messages[0]);
});

test("compact chat keeps the SDK user message once the assistant has started streaming", async () => {
	const { appendOptimisticCompactUserMessage } = await loadOptimisticUserMessageModule();
	const prompt = createPrompt();
	const messages = [
		{
			id: "assistant-1",
			role: "assistant",
			parts: [
				{ type: "text", text: "Done", state: "done" },
				{ type: "data-turn-complete", data: { timestamp: "2026-05-18T00:59:00.000Z" } },
			],
		},
		{
			id: "sdk-user-1",
			role: "user",
			metadata: { promptId: prompt.id },
			parts: [{ type: "text", text: prompt.text, state: "done" }],
		},
		{
			id: "assistant-2",
			role: "assistant",
			parts: [{ type: "text", text: "", state: "streaming" }],
		},
	];

	const result = appendOptimisticCompactUserMessage(messages, prompt);

	assert.equal(result.length, 3);
	assert.equal(result, messages);
});

test("compact chat does not re-add the active prompt after a completed question-card turn", async () => {
	const { appendOptimisticCompactUserMessage } = await loadOptimisticUserMessageModule();
	const prompt = createPrompt();
	const messages = [
		{
			id: "sdk-user-1",
			role: "user",
			metadata: { promptId: prompt.id },
			parts: [{ type: "text", text: prompt.text, state: "done" }],
		},
		{
			id: "assistant-1",
			role: "assistant",
			parts: [
				{ type: "text", text: "I need a few details first.", state: "done" },
				{
					type: "data-widget-data",
					data: {
						type: "question-card",
						payload: { type: "question-card", questions: [] },
					},
				},
				{ type: "data-turn-complete", data: { timestamp: "2026-05-18T01:00:01.000Z" } },
			],
		},
	];

	const result = appendOptimisticCompactUserMessage(messages, prompt);

	assert.equal(result.length, 2);
	assert.equal(result, messages);
});

// Regression: matching used to compare the server's turn-complete timestamp with
// the client's prompt.createdAt and allowed 1 s of skew, so a client clock more
// than 1 s ahead re-added the prompt as a duplicate bubble after its reply.
test("compact chat does not re-add the active prompt after its reply when the client clock runs ahead", async () => {
	const { appendOptimisticCompactUserMessage } = await loadOptimisticUserMessageModule();
	const prompt = createPrompt({ createdAt: Date.parse("2026-05-18T01:00:05.000Z") });
	const messages = [
		{
			id: "sdk-user-1",
			role: "user",
			metadata: { promptId: prompt.id },
			parts: [{ type: "text", text: prompt.text, state: "done" }],
		},
		{
			id: "assistant-1",
			role: "assistant",
			parts: [
				{ type: "text", text: "Done", state: "done" },
				{ type: "data-turn-complete", data: { timestamp: "2026-05-18T01:00:01.000Z" } },
			],
		},
	];

	assert.equal(appendOptimisticCompactUserMessage(messages, prompt), messages);
});

test("compact chat does not render hidden synthetic prompts as optimistic user bubbles", async () => {
	const { appendOptimisticCompactUserMessage } = await loadOptimisticUserMessageModule();
	const prompt = createPrompt({
		options: {
			messageMetadata: {
				visibility: "hidden",
			},
		},
	});

	const result = appendOptimisticCompactUserMessage([], prompt);

	assert.deepEqual(result, []);
});
