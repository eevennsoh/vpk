"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createRovoToolEventDispatcher,
	normalizeToolCallId,
} = require("./rovo-gateway-tool-event-dispatcher");

test("normalizeToolCallId trims strings and rejects empty values", () => {
	assert.equal(normalizeToolCallId(" call-1 "), "call-1");
	assert.equal(normalizeToolCallId("   "), null);
	assert.equal(normalizeToolCallId(null), null);
});

test("dispatcher suppresses live subagent text from the main text stream", () => {
	const textDeltas = [];
	const subagentDeltas = [];
	const dispatcher = createRovoToolEventDispatcher({
		onTextDelta: (text) => textDeltas.push(text),
		onSubagentTextDelta: (text, metadata) => {
			subagentDeltas.push({ text, metadata });
		},
		suppressSubagentText: true,
	});

	dispatcher.handleChunk({
		type: "text",
		text: "working",
		subagentName: "Reviewer",
		subagentToolCallId: "sub-call-1",
	});

	assert.deepEqual(textDeltas, []);
	assert.deepEqual(subagentDeltas, [
		{
			text: "working",
			metadata: {
				subagentName: "Reviewer",
				subagentToolCallId: "sub-call-1",
			},
		},
	]);
});

test("dispatcher keeps replay subagent text in the main text stream when not suppressed", () => {
	const textDeltas = [];
	const dispatcher = createRovoToolEventDispatcher({
		onTextDelta: (text) => textDeltas.push(text),
		suppressSubagentText: false,
	});

	dispatcher.handleChunk({
		type: "text",
		text: "replayed",
		subagentName: "Reviewer",
	});

	assert.deepEqual(textDeltas, ["replayed"]);
});

test("dispatcher falls back to start input when args are incomplete", () => {
	const resolvedInputs = [];
	const dispatcher = createRovoToolEventDispatcher({
		onTextDelta: () => {},
		onToolCallInputResolved: (input) => resolvedInputs.push(input),
	});

	dispatcher.handleChunk({
		type: "tool_call_start",
		toolName: "request_user_input",
		toolCallId: "tool-1",
		toolInput: {
			tool_name: "request_user_input",
		},
	});
	dispatcher.handleChunk({
		type: "tool_call_args",
		toolName: "request_user_input",
		toolCallId: "tool-1",
		text: '{"questions":[{"question":"Which space?",',
	});
	assert.deepEqual(resolvedInputs, [
		{
			toolName: "request_user_input",
			toolCallId: "tool-1",
			toolInput: {
				tool_name: "request_user_input",
			},
		},
	]);

	dispatcher.handleChunk({
		type: "tool_call_args",
		toolName: "request_user_input",
		toolCallId: "tool-1",
		text: '"options":["Engineering"]}]}',
	});

	assert.deepEqual(resolvedInputs, [
		{
			toolName: "request_user_input",
			toolCallId: "tool-1",
			toolInput: {
				tool_name: "request_user_input",
			},
		},
	]);
});

test("dispatcher resolves complete buffered tool args when no start input is available", () => {
	const resolvedInputs = [];
	const dispatcher = createRovoToolEventDispatcher({
		onTextDelta: () => {},
		onToolCallInputResolved: (input) => resolvedInputs.push(input),
	});

	dispatcher.handleChunk({
		type: "tool_call_start",
		toolName: "request_user_input",
		toolCallId: "tool-1",
	});
	dispatcher.handleChunk({
		type: "tool_call_args",
		toolName: "request_user_input",
		toolCallId: "tool-1",
		text: '{"questions":[{"question":"Which space?","options":["Engineering"]}]}',
	});

	assert.deepEqual(resolvedInputs, [
		{
			toolName: "request_user_input",
			toolCallId: "tool-1",
			toolInput: {
				questions: [
					{
						question: "Which space?",
						options: ["Engineering"],
					},
				],
			},
		},
	]);
});

test("dispatcher correlates tool results without ids to the active tool call", () => {
	const results = [];
	const statuses = [];
	const events = [];
	const dispatcher = createRovoToolEventDispatcher({
		onTextDelta: () => {},
		onToolCallResult: (result) => results.push(result),
		onThinkingStatus: (status) => statuses.push(status),
		onThinkingEvent: (event) => events.push(event),
	});

	dispatcher.handleChunk({
		type: "tool_call_start",
		toolName: "mcp__figma__get_screenshot",
		toolCallId: "tool-1",
		toolInput: { nodeId: "1:2" },
	});
	dispatcher.handleChunk({
		type: "tool_result",
		toolName: "mcp__figma__get_screenshot",
		rawOutput: { ok: true },
		outputPreview: "ok",
	});

	assert.equal(results.length, 1);
	assert.equal(results[0].toolName, "mcp__figma__get_screenshot");
	assert.equal(results[0].toolCallId, "tool-1");
	assert.deepEqual(results[0].output, { ok: true });
	assert.equal(statuses.at(-1).label, "Generated image");
	assert.equal(events.at(-1).toolCallId, "tool-1");
	assert.equal(events.at(-1).phase, "result");
	assert.deepEqual(events.at(-1).output, { ok: true });
});

test("dispatcher emits normalized deferred tool requests", () => {
	const deferredRequests = [];
	const dispatcher = createRovoToolEventDispatcher({
		onTextDelta: () => {},
		onDeferredToolRequest: (request) => deferredRequests.push(request),
	});

	dispatcher.handleChunk({
		type: "deferred-tool-request",
		toolName: " request_user_input ",
		toolCallId: " deferred-1 ",
		toolInput: { questions: [] },
	});

	assert.deepEqual(deferredRequests, [
		{
			toolName: "request_user_input",
			toolCallId: "deferred-1",
			toolInput: { questions: [] },
		},
	]);
});

test("dispatcher returns the deferred handler promise and keeps other chunks synchronous", () => {
	const pending = Promise.resolve();
	const dispatcher = createRovoToolEventDispatcher({
		onTextDelta: () => pending,
		onToolCallStart: () => pending,
		onToolCallResult: () => pending,
		onDeferredToolRequest: () => pending,
	});
	for (const chunk of [
		{ type: "text", text: "hello" },
		{ type: "tool_call_start", toolName: "lookup", toolCallId: "tool-1" },
		{ type: "tool_call_args", toolCallId: "tool-1", text: "{}" },
		{ type: "tool_result", toolCallId: "tool-1", text: "done" },
		{ type: "tool_error", toolCallId: "tool-1", text: "failed" },
		null,
	]) {
		assert.equal(dispatcher.handleChunk(chunk), undefined);
	}
	assert.equal(dispatcher.handleChunk({ type: "deferred-tool-request" }), pending);
	assert.equal(createRovoToolEventDispatcher({}).handleChunk({ type: "deferred-tool-request" }), undefined);
});
