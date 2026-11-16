const test = require("node:test");
const assert = require("node:assert/strict");

const {
	findPromptUserMessageIndex,
	findReplyAfter,
	getAgentExecutionSummaries,
	getMessageReasoningTimestamps,
	getLatestTodoQueue,
	getLatestRouteDecision,
	getThinkingToolCallSummaries,
	isRoutingDecision,
} = require("./rovo-ui-messages.ts");

function createMessage(parts) {
	return {
		id: "assistant-1",
		role: "assistant",
		parts,
	};
}

test("isRoutingDecision accepts only the strict v2 route-decision shape", () => {
	assert.equal(
		isRoutingDecision({
			intent: "genui",
			presentation: "genui_card",
			confidence: 0.9,
			reason: "intent_task_toolable",
			origin: "text",
		}),
		true,
	);

	assert.equal(
		isRoutingDecision({
			reason: "intent_task_toolable",
			experience: "generative_ui",
			timestamp: "2026-03-16T00:00:00.000Z",
		}),
		false,
	);
});

test("getLatestRouteDecision returns the latest valid v2 route decision", () => {
	const decision = getLatestRouteDecision(
		createMessage([
			{
				type: "data-route-decision",
				data: {
					intent: "chat",
					presentation: "text",
					confidence: 0.9,
					reason: "intent_text_default",
					origin: "text",
				},
			},
			{
				type: "data-route-decision",
				data: {
					intent: "genui",
					presentation: "genui_card",
					confidence: 1,
					reason: "intent_task_toolable",
					origin: "voice",
				},
			},
		]),
	);

	assert.deepEqual(decision, {
		intent: "genui",
		presentation: "genui_card",
		confidence: 1,
		reason: "intent_task_toolable",
		origin: "voice",
	});
});

test("getLatestRouteDecision ignores malformed legacy route decisions", () => {
	const decision = getLatestRouteDecision(
		createMessage([
			{
				type: "data-route-decision",
				data: {
					intent: "genui",
					presentation: "genui_card",
					confidence: 0.88,
					reason: "genui_verb_data_noun",
					origin: "text",
				},
			},
			{
				type: "data-route-decision",
				data: {
					experience: "text",
					reason: "fallback_ui_failed",
				},
			},
		]),
	);

	assert.deepEqual(decision, {
		intent: "genui",
		presentation: "genui_card",
		confidence: 0.88,
		reason: "genui_verb_data_noun",
		origin: "text",
	});
});

test("getLatestRouteDecision returns null when no v2 payload exists", () => {
	assert.equal(
		getLatestRouteDecision(
			createMessage([
				{
					type: "data-route-decision",
					data: {
						experience: "text",
						reason: "intent_task_toolable",
					},
				},
			]),
		),
		null,
	);
});

test("getThinkingToolCallSummaries marks paused approval events distinctly", () => {
	const summaries = getThinkingToolCallSummaries(
		createMessage([
			{
				type: "data-thinking-event",
				data: {
					eventId: "tool-1:start:1",
					phase: "start",
					toolName: "open_files",
					toolCallId: "tool-1",
					permissionScenario: "prompt",
					timestamp: "2026-03-20T00:00:00.000Z",
				},
			},
		]),
	);

	assert.deepEqual(summaries, [
		{
			id: "call:tool-1",
			toolName: "open_files",
			toolCallId: "tool-1",
			state: "approval-requested",
			input: undefined,
			output: undefined,
			outputPreview: undefined,
			outputTruncated: undefined,
			outputBytes: undefined,
			suppressedRawOutput: undefined,
			errorText: undefined,
			timestamp: "2026-03-20T00:00:00.000Z",
			mcpServer: undefined,
			permissionScenario: "prompt",
		},
	]);
});

test("getThinkingToolCallSummaries preserves raw tool output separately from preview text", () => {
	const rawOutput = {
		content: "Success",
		data: {
			manager: {
				name: "David Hoang",
			},
		},
	};
	const summaries = getThinkingToolCallSummaries(
		createMessage([
			{
				type: "data-thinking-event",
				data: {
					eventId: "tool-2:result:1",
					phase: "result",
					toolName: "get_user_manager_v2",
					toolCallId: "tool-2",
					output: rawOutput,
					outputPreview: "{\"content\":\"Success\",\"data\":{\"manager\":{\"name\":\"David Hoang\"}}}",
					outputTruncated: true,
					outputBytes: 512,
					timestamp: "2026-03-20T00:00:10.000Z",
				},
			},
		]),
	);

	assert.deepEqual(summaries, [
		{
			id: "call:tool-2",
			toolName: "get_user_manager_v2",
			toolCallId: "tool-2",
			state: "completed",
			input: undefined,
			output: rawOutput,
			outputPreview: "{\"content\":\"Success\",\"data\":{\"manager\":{\"name\":\"David Hoang\"}}}",
			outputTruncated: true,
			outputBytes: 512,
			suppressedRawOutput: undefined,
			errorText: undefined,
			timestamp: "2026-03-20T00:00:10.000Z",
			mcpServer: undefined,
			permissionScenario: undefined,
		},
	]);
});

test("getThinkingToolCallSummaries preserves readable thinking labels", () => {
	const summaries = getThinkingToolCallSummaries(
		createMessage([
			{
				type: "data-thinking-event",
				data: {
					eventId: "tool-3:start:1",
					phase: "start",
					toolName: "jira.read_work_item",
					label: "Reading RFP-101",
					toolCallId: "tool-3",
					timestamp: "2026-03-20T00:00:20.000Z",
				},
			},
			{
				type: "data-thinking-event",
				data: {
					eventId: "tool-3:result:1",
					phase: "result",
					toolName: "jira.read_work_item",
					label: "Reading RFP-101",
					toolCallId: "tool-3",
					outputPreview: "Loaded active work item context.",
					timestamp: "2026-03-20T00:00:21.000Z",
				},
			},
		]),
	);

	assert.equal(summaries[0].label, "Reading RFP-101");
	assert.equal(summaries[0].state, "completed");
});

test("getMessageReasoningTimestamps prefers persisted thinking timestamps", () => {
	const timestamps = getMessageReasoningTimestamps({
		id: "assistant-1",
		role: "assistant",
		metadata: {
			createdAt: "2026-03-20T00:00:00.000Z",
			updatedAt: "2026-03-20T00:00:15.000Z",
		},
		parts: [
			{
				type: "data-thinking-status",
				data: {
					label: "Thinking",
					timestamp: "2026-03-20T00:00:02.000Z",
				},
			},
			{
				type: "data-thinking-event",
				data: {
					eventId: "tool-1:start:1",
					phase: "start",
					toolName: "open_files",
					timestamp: "2026-03-20T00:00:03.000Z",
				},
			},
			{
				type: "data-turn-complete",
				data: {
					timestamp: "2026-03-20T00:00:10.000Z",
				},
			},
		],
	});

	assert.deepEqual(timestamps, {
		startedAt: "2026-03-20T00:00:03.000Z",
		completedAt: "2026-03-20T00:00:10.000Z",
	});
});

test("getMessageReasoningTimestamps falls back to message metadata", () => {
	const timestamps = getMessageReasoningTimestamps({
		id: "assistant-1",
		role: "assistant",
		metadata: {
			createdAt: "2026-03-20T00:00:00.000Z",
			updatedAt: "2026-03-20T00:00:08.000Z",
		},
		parts: [
			{
				type: "data-thinking-status",
				data: {
					label: "Thinking",
				},
			},
		],
	});

	assert.deepEqual(timestamps, {
		startedAt: "2026-03-20T00:00:00.000Z",
		completedAt: "2026-03-20T00:00:08.000Z",
	});
});

test("getThinkingToolCallSummaries keeps ask_user_questions pending after turn complete", () => {
	const summaries = getThinkingToolCallSummaries(
		createMessage([
			{
				type: "data-thinking-event",
				data: {
					eventId: "tool-1:start:1",
					phase: "start",
					toolName: "ask_user_questions",
					toolCallId: "tool-1",
					timestamp: "2026-03-24T00:00:00.000Z",
				},
			},
			{
				type: "data-turn-complete",
				data: {
					timestamp: "2026-03-24T00:00:05.000Z",
				},
			},
		]),
	);

	assert.deepEqual(summaries, [
		{
			id: "call:tool-1",
			toolName: "ask_user_questions",
			toolCallId: "tool-1",
			state: "awaiting-input",
			input: undefined,
			output: "Awaiting your answers in the question card.",
			outputPreview: "Awaiting your answers in the question card.",
			outputTruncated: undefined,
			outputBytes: undefined,
			suppressedRawOutput: undefined,
			errorText: undefined,
			timestamp: "2026-03-24T00:00:00.000Z",
			mcpServer: undefined,
			permissionScenario: undefined,
		},
	]);
});

test("getAgentExecutionSummaries groups updates by task id and appends content", () => {
	const summaries = getAgentExecutionSummaries(
		createMessage([
			{
				type: "data-agent-execution",
				data: {
					agentId: "agent-1",
					agentName: "Planner",
					taskId: "TASK-1",
					taskLabel: "Architecture",
					status: "working",
					content: "Drafting",
				},
			},
			{
				type: "data-agent-execution",
				data: {
					agentId: "agent-1",
					agentName: "Planner",
					taskId: "TASK-1",
					taskLabel: "Architecture",
					status: "completed",
					content: " the summary.",
				},
			},
			{
				type: "data-agent-execution",
				data: {
					agentId: "agent-2",
					agentName: "Designer",
					taskId: "TASK-2",
					taskLabel: "Mocks",
					status: "working",
				},
			},
		]),
	);

	assert.deepEqual(summaries, [
		{
			agentId: "agent-1",
			agentName: "Planner",
			taskId: "TASK-1",
			taskLabel: "Architecture",
			status: "completed",
			content: "Drafting the summary.",
		},
		{
			agentId: "agent-2",
			agentName: "Designer",
			taskId: "TASK-2",
			taskLabel: "Mocks",
			status: "working",
			content: "",
		},
	]);
});

test("getLatestTodoQueue returns the latest queued steps payload", () => {
	const queue = getLatestTodoQueue(
		createMessage([
			{
				type: "data-todo-queue",
				data: {
					items: [{ id: "task-1", text: "Old step", blockedBy: [] }],
				},
			},
			{
				type: "data-todo-queue",
				data: {
					items: [
						{
							id: "task-2",
							text: "Latest step",
							blockedBy: ["task-1"],
							agent: "Planner",
						},
					],
				},
			},
		]),
	);

	assert.deepEqual(queue, {
		items: [
			{
				id: "task-2",
				text: "Latest step",
				blockedBy: ["task-1"],
				agent: "Planner",
			},
		],
	});
});

test("the prompt's user message is found by prompt id, not by its text", () => {
	const user = (id, promptId) => ({ id, role: "user", metadata: promptId ? { promptId } : undefined, parts: [{ type: "text", text: "Same text" }] });
	const assistant = { id: "a", role: "assistant", parts: [] };
	const messages = [user("u0", "queued-0"), assistant, user("u1"), assistant, user("u2", "queued-2"), assistant];
	assert.equal(findPromptUserMessageIndex(messages, "queued-2"), 4);
	assert.equal(findPromptUserMessageIndex(messages, "queued-0"), 0);
	// Before the prompt's own user message lands, a same-text message does not stand in for it.
	assert.equal(findPromptUserMessageIndex(messages, "queued-3"), -1);
});

test("the reply after a user message is the latest assistant message after it", () => {
	const messages = [
		{ id: "u0", role: "user", parts: [] },
		{ id: "a0", role: "assistant", parts: [] },
		{ id: "u1", role: "user", parts: [] },
		{ id: "a1", role: "assistant", parts: [] },
		{ id: "a2", role: "assistant", parts: [] },
	];
	assert.equal(findReplyAfter(messages, 0)?.id, "a2");
	assert.equal(findReplyAfter(messages, 2)?.id, "a2");
	assert.equal(findReplyAfter(messages.slice(0, 3), 2), undefined);
	assert.equal(findReplyAfter(messages, -1), undefined);
});
