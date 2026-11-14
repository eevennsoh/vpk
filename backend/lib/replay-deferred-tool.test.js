const test = require("node:test");
const assert = require("node:assert/strict");

const {
	getReplayDeferredToolInput,
	handleReplayDeferredToolRequest,
} = require("./replay-deferred-tool");

test("getReplayDeferredToolInput parses JSON args payloads from replay events", () => {
	const result = getReplayDeferredToolInput({
		args: JSON.stringify({
			questions: [
				{
					question: "What should we build?",
					options: ["Dashboard"],
				},
			],
		}),
	});

	assert.deepEqual(result, {
		questions: [
			{
				question: "What should we build?",
				options: ["Dashboard"],
			},
		],
	});
});

test("handleReplayDeferredToolRequest surfaces replayed ask_user_questions as a new paused clarification", async () => {
	const questionCardCalls = [];
	const planWidgetCalls = [];
	const registerCalls = [];
	const syncCalls = [];
	const handle = { settleLease: () => true };

	const result = await handleReplayDeferredToolRequest({
		rawEvent: {
			parts: [
				{
					tool_name: "ask_user_questions",
					tool_call_id: "tool-call-456",
					args: JSON.stringify({
						questions: [
							{
								question: "What should we build?",
								options: ["Dashboard"],
							},
						],
					}),
				},
			],
		},
		control: {
			port: 8123,
			reservePort: () => handle,
		},
		threadId: "thread-123",
		sessionId: "rovo-session-123",
		sessionMode: "persistent",
		isRequestUserInputTool: (toolName) => toolName === "ask_user_questions",
		isExitPlanModeTool: (toolName) => toolName === "exit_plan_mode",
		syncThreadSessionFromPort: async (...args) => {
			syncCalls.push(args);
			return {
				sessionId: "rovo-session-synced",
				sessionMode: "ephemeral",
			};
		},
		emitRequestUserInputQuestionCard: (payload) => {
			questionCardCalls.push(payload);
		},
		emitExitPlanWidget: (payload) => {
			planWidgetCalls.push(payload);
			return true;
		},
		registerPausedToolCall: (payload) => {
			registerCalls.push(payload);
		},
	});

	assert.deepEqual(result, {
		handled: true,
		disconnect: true,
		hasObservedDeferredToolRequest: true,
		pausedToolCallHandled: true,
		kind: "clarification",
		toolCallId: "tool-call-456",
	});
	assert.deepEqual(syncCalls, [
		[
			"thread-123",
			8123,
			{ sessionMode: "persistent" },
		],
	]);
	assert.deepEqual(questionCardCalls, [
		{
			toolName: "ask_user_questions",
			toolCallId: "tool-call-456",
			questionInput: {
				questions: [
					{
						question: "What should we build?",
						options: ["Dashboard"],
					},
				],
			},
			source: "deferred_tool_request",
		},
	]);
	assert.deepEqual(planWidgetCalls, []);
	assert.deepEqual(registerCalls, [
		{
			toolCallId: "tool-call-456",
			port: 8123,
			handle,
			threadId: "thread-123",
			sessionId: "rovo-session-synced",
			sessionMode: "ephemeral",
			kind: "clarification",
		},
	]);
});

test("handleReplayDeferredToolRequest surfaces replayed exit_plan_mode as a new paused plan approval", async () => {
	const questionCardCalls = [];
	const planWidgetCalls = [];
	const registerCalls = [];
	const handle = { settleLease: () => true };

	const result = await handleReplayDeferredToolRequest({
		rawEvent: {
			parts: [
				{
					tool_name: "exit_plan_mode",
					tool_call_id: "tool-call-plan",
					args: JSON.stringify({
						plan: [
							"# Planner",
							"",
							"## Action items",
							"- [ ] Create route shell",
						].join("\n"),
					}),
				},
			],
		},
		control: {
			port: 8124,
			reservePort: () => handle,
		},
		threadId: "thread-plan",
		sessionId: "rovo-session-plan",
		sessionMode: "persistent",
		isRequestUserInputTool: (toolName) => toolName === "ask_user_questions",
		isExitPlanModeTool: (toolName) => toolName === "exit_plan_mode",
		syncThreadSessionFromPort: async () => ({
			sessionId: "rovo-session-plan",
			sessionMode: "persistent",
		}),
		emitRequestUserInputQuestionCard: (payload) => {
			questionCardCalls.push(payload);
		},
		emitExitPlanWidget: (payload) => {
			planWidgetCalls.push(payload);
			return true;
		},
		registerPausedToolCall: (payload) => {
			registerCalls.push(payload);
		},
	});

	assert.equal(result.handled, true);
	assert.equal(result.disconnect, true);
	assert.equal(result.kind, "plan-approval");
	assert.equal(result.toolCallId, "tool-call-plan");
	assert.deepEqual(questionCardCalls, []);
	assert.deepEqual(planWidgetCalls, [
		{
			toolCallId: "tool-call-plan",
			toolInput: {
				plan: [
					"# Planner",
					"",
					"## Action items",
					"- [ ] Create route shell",
				].join("\n"),
			},
			source: "deferred_tool_request",
		},
	]);
	assert.deepEqual(registerCalls, [
		{
			toolCallId: "tool-call-plan",
			port: 8124,
			handle,
			threadId: "thread-plan",
			sessionId: "rovo-session-plan",
			sessionMode: "persistent",
			kind: "plan-approval",
		},
	]);
});

function createPauseEvent(parts) {
	return { parts };
}

const replayToolOptions = {
	isRequestUserInputTool: (toolName) => toolName === "ask_user_questions",
	isExitPlanModeTool: (toolName) => toolName === "exit_plan_mode",
};

test("a pause that cannot be registered does not take the port lease", async () => {
	let reservations = 0;
	const result = await handleReplayDeferredToolRequest({
		...replayToolOptions,
		rawEvent: createPauseEvent([{ tool_name: "ask_user_questions", args: "{}" }]),
		control: {
			port: 8123,
			reservePort: () => {
				reservations += 1;
				return { settleLease: () => true };
			},
		},
		registerPausedToolCall: () => {},
	});

	assert.equal(result.handled, false);
	assert.equal(reservations, 0);
});

test("a pause whose registration throws quarantines the lease it took", async () => {
	const settles = [];
	const handle = {
		settleLease: (disposition, options) => {
			settles.push([disposition, options]);
			return true;
		},
	};
	await assert.rejects(
		handleReplayDeferredToolRequest({
			...replayToolOptions,
			rawEvent: createPauseEvent([{ tool_name: "exit_plan_mode", tool_call_id: "tool-call-9", args: "{}" }]),
			control: { port: 8123, reservePort: () => handle },
			emitExitPlanWidget: () => {
				throw new Error("widget failed");
			},
			registerPausedToolCall: () => {},
		}),
		/widget failed/u,
	);

	assert.deepEqual(settles, [["unhealthy", { reason: "paused tool call could not be registered" }]]);
});
