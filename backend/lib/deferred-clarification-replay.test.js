const test = require("node:test");
const assert = require("node:assert/strict");

const { adaptClarificationAnswers } = require("./ask-user-questions-adapter");
const {
	buildClarificationResumeDecision,
	buildClarificationResumeDenyMessage,
} = require("./deferred-clarification");
const {
	handleReplayDeferredToolRequest,
} = require("./replay-deferred-tool");
const { getNonEmptyString } = require("./shared-utils");

function toPlainValue(value) {
	return structuredClone(value);
}

function createQuestionMetaStore() {
	return new Map([
		[
			"request-user-input-tool-call-123",
			[
				{
					id: "q-1",
					label: "What kind of app?",
					options: [
						{ id: "dashboard", label: "Dashboard" },
						{ id: "docs", label: "Documentation" },
					],
				},
			],
		],
	]);
}

function createClarificationDenyMessageBuilder(questionMetaStore) {
	return (clarificationSubmission) =>
		buildClarificationResumeDenyMessage(
			clarificationSubmission,
			(sessionId, answers) =>
				adaptClarificationAnswers(
					sessionId,
					answers,
					questionMetaStore.get(sessionId) || null,
				),
		);
}

function isRequestUserInputTool(toolName) {
	const normalizedToolName = getNonEmptyString(toolName)?.toLowerCase();
	return normalizedToolName === "ask_user_questions";
}

function isExitPlanModeTool(toolName) {
	const normalizedToolName = getNonEmptyString(toolName)?.toLowerCase();
	return normalizedToolName === "exit_plan_mode";
}

function createPausedReplayHarness({
	pausedToolCallRecord,
	clarificationSubmission,
	questionMetaStore = new Map(),
	threadId = "thread-123",
	rovoSessionId = "rovo-session-123",
	sessionMode = "persistent",
}) {
	const emitRequestUserInputQuestionCardCalls = [];
	const registerPausedRovoToolCallCalls = [];
	const syncThreadSessionCalls = [];
	const resumeCalls = [];
	const replayViaRovoCalls = [];
	const rovoResumeToolCallsCalls = [];
	let hasObservedDeferredToolRequest = false;
	let pausedToolCallHandled = false;

	const onPausedToolCalls = async ({ rawEvent, control }) => {
		const pausedParts = Array.isArray(rawEvent?.parts) ? rawEvent.parts : [];
		const interactivePart = pausedParts.find((part) => {
			const toolName = getNonEmptyString(part?.tool_name);
			return isRequestUserInputTool(toolName) || isExitPlanModeTool(toolName);
		});

		if (!interactivePart) {
			const decisions = pausedParts
				.map((part) => {
					const toolCallId = getNonEmptyString(part?.tool_call_id);
					return toolCallId
						? { tool_call_id: toolCallId, deny_message: null }
						: null;
				})
				.filter(Boolean);
			if (decisions.length > 0) {
				await control.resume({ decisions });
			}
			return { disconnect: false };
		}

		const replayDeferredToolResult = await handleReplayDeferredToolRequest({
			rawEvent,
			control,
			threadId,
			sessionId: rovoSessionId,
			sessionMode,
			isRequestUserInputTool,
			isExitPlanModeTool,
			syncThreadSessionFromPort: async (...args) => {
				syncThreadSessionCalls.push(args);
				return {
					sessionId: rovoSessionId,
					sessionMode,
				};
			},
			emitRequestUserInputQuestionCard: (payload) => {
				emitRequestUserInputQuestionCardCalls.push(payload);
			},
			emitExitPlanWidget: () => {},
			registerPausedToolCall: (payload) => {
				registerPausedRovoToolCallCalls.push(payload);
			},
		});

		if (replayDeferredToolResult.handled) {
			if (replayDeferredToolResult.hasObservedDeferredToolRequest) {
				hasObservedDeferredToolRequest = true;
			}
			if (replayDeferredToolResult.pausedToolCallHandled) {
				pausedToolCallHandled = true;
			}
			return { disconnect: replayDeferredToolResult.disconnect === true };
		}

		const decisions = pausedParts
			.map((part) => {
				const toolCallId = getNonEmptyString(part?.tool_call_id);
				return toolCallId
					? { tool_call_id: toolCallId, deny_message: null }
					: null;
			})
			.filter(Boolean);
		if (decisions.length > 0) {
			await control.resume({ decisions });
		}
		return { disconnect: false };
	};

	const rovoResumeToolCalls = async (...args) => {
		rovoResumeToolCallsCalls.push(args);
		return { resumed: true };
	};
	const replayViaRovo = async (args) => {
		replayViaRovoCalls.push(args);
	};

	return {
		get hasObservedDeferredToolRequest() {
			return hasObservedDeferredToolRequest;
		},
		get pausedToolCallHandled() {
			return pausedToolCallHandled;
		},
		emitRequestUserInputQuestionCardCalls,
		registerPausedRovoToolCallCalls,
		syncThreadSessionCalls,
		resumeCalls,
		replayViaRovoCalls,
		rovoResumeToolCallsCalls,
		onPausedToolCalls,
		resumePausedClarification: async () => {
			const resumeDecisions = [
				buildClarificationResumeDecision({
					clarificationSubmission,
					clarificationToolCallId: pausedToolCallRecord.toolCallId,
					setChatAccepted: false,
					buildDenyMessageFn:
						createClarificationDenyMessageBuilder(questionMetaStore),
				}),
			].filter(Boolean);

			if (resumeDecisions.length === 0) {
				throw new Error(
					`Paused tool continuation ${pausedToolCallRecord.toolCallId} is missing a resume decision.`,
				);
			}

			await rovoResumeToolCalls(pausedToolCallRecord.port, {
				decisions: resumeDecisions,
			});
			await replayViaRovo({
				port: pausedToolCallRecord.port,
				portHandle: pausedToolCallRecord.handle,
				onTextDelta: () => {},
				skipReplayUntilToolCallId: pausedToolCallRecord.toolCallId,
				onPausedToolCalls,
			});
		},
		createControl: (handle = pausedToolCallRecord.handle || null) => ({
			port: pausedToolCallRecord.port,
			resume: async (payload) => {
				resumeCalls.push(payload);
				return { resumed: true };
			},
			disconnect: () => {},
			reservePort: () => handle,
		}),
	};
}

test("paused clarification resume decision uses adapted answers in deny_message", () => {
	const questionMetaStore = createQuestionMetaStore();
	const clarificationSubmission = {
		sessionId: "request-user-input-tool-call-123",
		answers: {
			"q-1": "dashboard",
		},
	};

	const decision = buildClarificationResumeDecision({
		clarificationSubmission,
		clarificationToolCallId: "tool-call-123",
		setChatAccepted: false,
		buildDenyMessageFn: createClarificationDenyMessageBuilder(questionMetaStore),
	});

	assert.deepEqual(toPlainValue(decision), {
		tool_call_id: "tool-call-123",
		deny_message: [
			"The user answered the clarification questions.",
			"Use these answers instead of calling the clarification tool again:",
			"- What kind of app?: Dashboard",
		].join("\n"),
	});
});

test("paused clarification replay resumes with deny_message before replaying the port", async () => {
	const questionMetaStore = createQuestionMetaStore();
	const harness = createPausedReplayHarness({
		pausedToolCallRecord: {
			kind: "clarification",
			toolCallId: "tool-call-123",
			port: 8001,
			handle: null,
		},
		clarificationSubmission: {
			sessionId: "request-user-input-tool-call-123",
			answers: {
				"q-1": "dashboard",
			},
		},
		questionMetaStore,
	});

	await harness.resumePausedClarification();

	assert.deepEqual(toPlainValue(harness.rovoResumeToolCallsCalls), [
		[
			8001,
			{
				decisions: [
					{
						tool_call_id: "tool-call-123",
						deny_message: [
							"The user answered the clarification questions.",
							"Use these answers instead of calling the clarification tool again:",
							"- What kind of app?: Dashboard",
						].join("\n"),
					},
				],
			},
		],
	]);
	assert.equal(harness.replayViaRovoCalls.length, 1);
	assert.equal(harness.replayViaRovoCalls[0].port, 8001);
	assert.equal(harness.replayViaRovoCalls[0].portHandle, null);
	assert.equal(
		harness.replayViaRovoCalls[0].skipReplayUntilToolCallId,
		"tool-call-123",
	);
	assert.equal(typeof harness.replayViaRovoCalls[0].onTextDelta, "function");
	assert.equal(
		typeof harness.replayViaRovoCalls[0].onPausedToolCalls,
		"function",
	);
});

test("replay continuation emits changed follow-up questions as a new paused clarification", async () => {
	const handle = { settleLease: () => true };
	const harness = createPausedReplayHarness({
		pausedToolCallRecord: {
			kind: "clarification",
			toolCallId: "tool-call-123",
			port: 8123,
			handle,
		},
		clarificationSubmission: {
			sessionId: "request-user-input-tool-call-123",
			answers: {
				"q-1": "dashboard",
			},
		},
		questionMetaStore: createQuestionMetaStore(),
	});

	const result = await harness.onPausedToolCalls({
		rawEvent: {
			parts: [
				{
					tool_name: "ask_user_questions",
					tool_call_id: "tool-call-789",
					input: {
						questions: [
							{
								id: "q-2",
								question: "Which deployment target should we use?",
								options: [
									{ id: "cloud", label: "Cloud" },
									{ id: "dc", label: "Data Center" },
								],
							},
						],
					},
				},
			],
		},
		control: harness.createControl(handle),
	});

	assert.deepEqual(result, { disconnect: true });
	assert.deepEqual(toPlainValue(harness.emitRequestUserInputQuestionCardCalls), [
		{
			toolName: "ask_user_questions",
			toolCallId: "tool-call-789",
			questionInput: {
				questions: [
					{
						id: "q-2",
						question: "Which deployment target should we use?",
						options: [
							{ id: "cloud", label: "Cloud" },
							{ id: "dc", label: "Data Center" },
						],
					},
				],
			},
			source: "deferred_tool_request",
		},
	]);
	assert.deepEqual(harness.syncThreadSessionCalls, [
		[
			"thread-123",
			8123,
			{ sessionMode: "persistent" },
		],
	]);
	assert.deepEqual(harness.registerPausedRovoToolCallCalls, [
		{
			toolCallId: "tool-call-789",
			port: 8123,
			handle,
			threadId: "thread-123",
			sessionId: "rovo-session-123",
			sessionMode: "persistent",
			kind: "clarification",
		},
	]);
	assert.equal(harness.hasObservedDeferredToolRequest, true);
	assert.equal(harness.pausedToolCallHandled, true);
	assert.equal(harness.resumeCalls.length, 0);
});

test("replay continuation auto-resumes non-interactive paused parts", async () => {
	const harness = createPausedReplayHarness({
		pausedToolCallRecord: {
			kind: "clarification",
			toolCallId: "tool-call-123",
			port: 8123,
			handle: null,
		},
		clarificationSubmission: {
			sessionId: "request-user-input-tool-call-123",
			answers: {
				"q-1": "dashboard",
			},
		},
		questionMetaStore: createQuestionMetaStore(),
	});

	const result = await harness.onPausedToolCalls({
		rawEvent: {
			parts: [
				{
					tool_name: "read_file",
					tool_call_id: "tool-call-read",
				},
			],
		},
		control: harness.createControl(),
	});

	assert.deepEqual(result, { disconnect: false });
	assert.deepEqual(harness.resumeCalls, [
		{
			decisions: [
				{
					tool_call_id: "tool-call-read",
					deny_message: null,
				},
			],
		},
	]);
	assert.equal(harness.emitRequestUserInputQuestionCardCalls.length, 0);
	assert.equal(harness.registerPausedRovoToolCallCalls.length, 0);
	assert.equal(harness.hasObservedDeferredToolRequest, false);
	assert.equal(harness.pausedToolCallHandled, false);
});
