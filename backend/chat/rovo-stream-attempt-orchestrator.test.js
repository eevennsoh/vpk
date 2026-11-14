"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildRovoStreamCommonOptions,
	createRovoStreamAttemptRunner,
	resolvePausedRovoToolCallRecord,
} = require("./rovo-stream-attempt-orchestrator");

function createBaseCommonOptions(overrides = {}) {
	const events = [];
	const abortController = {
		signal: { aborted: false },
	};

	return {
		events,
		options: {
			abortController,
			activeRequests: new Map(),
			bashQuestionCardWorkaroundCallIds: new Set(),
			browserToolEventRouter: {},
			createRovoPlanFeedbackToolGuardFn: (guardOptions) => {
				events.push(["create-guard", guardOptions.threadId]);
				return (toolCall) => {
					events.push(["guard", toolCall]);
					return { block: false, ignore: false };
				};
			},
			createRovoStreamLifecycleHandlersFn: (lifecycleOptions) => {
				events.push(["create-lifecycle", lifecycleOptions.threadId]);
				return {
					onPortAcquired(port) {
						events.push(["port", port]);
					},
				};
			},
			createRovoStreamToolCallbacksFn: (callbackOptions) => {
				events.push(["create-tool-callbacks", callbackOptions.sessionId]);
				return {
					onToolCallResult(result) {
						events.push(["tool-result", result]);
					},
				};
			},
			handleRovoThinkingEventFn: (thinkingEvent, thinkingOptions) => {
				events.push(["thinking-event", thinkingEvent]);
				thinkingOptions.onObservedToolExecution();
				thinkingOptions.recordToolObservation({
					phase: "result",
					toolName: "bash",
				});
			},
			handleRovoThinkingStatusFn: (statusUpdate, statusOptions) => {
				events.push(["thinking-status", statusUpdate]);
				statusOptions.onEmittedThinkingStatus();
			},
			handleRovoToolCallInputResolvedEventFn: (toolCall, toolOptions) => {
				events.push(["tool-input", toolCall, toolOptions.logger.name]);
			},
			handleRovoToolCallStartEventFn: (toolCall, toolOptions) => {
				events.push(["tool-start", toolCall]);
				toolOptions.onObservedActionableToolCall();
				toolOptions.onObservedDeferredToolRequest();
				toolOptions.onObservedRelevantActionableToolCall();
			},
			isStrictToolFirstTurn: true,
			logger: { name: "logger" },
			onBlockedPlanFeedbackExecutionTool: () => {
				events.push(["blocked-plan-feedback"]);
			},
			onEmittedThinkingStatus: () => {
				events.push(["thinking-status-marked"]);
			},
			onObservedActionableToolCall: () => {
				events.push(["actionable"]);
			},
			onObservedDeferredToolRequest: () => {
				events.push(["deferred"]);
			},
			onObservedRelevantActionableToolCall: () => {
				events.push(["relevant"]);
			},
			onObservedToolExecution: () => {
				events.push(["tool-execution"]);
			},
			onPausedToolCallHandled: () => {
				events.push(["paused-handled"]);
			},
			onResolvedRovoPort: (port) => {
				events.push(["resolved-port", port]);
			},
			onTextDelta: (delta) => {
				events.push(["text", delta]);
			},
			recordToolObservation: (entry) => {
				events.push(["observation", entry]);
			},
			recordToolThinkingEvent: (state, event) => {
				events.push(["thinking-record", state, event]);
			},
			rovoSessionId: "session-1",
			sessionMode: "chat",
			stageTrace: { mark() {} },
			threadId: "thread-1",
			toolFirstExecutionState: {},
			waitForTurnTimeoutMs: 12_345,
			writer: { write() {} },
			...overrides,
		},
	};
}

test("resolvePausedRovoToolCallRecord consumes paused records only on first attempt", () => {
	const record = {
		kind: "approval",
		port: 3200,
		createdAt: 1000,
		expiresAt: 5000,
	};
	const logs = [];
	const takenIds = [];
	const logger = {
		info(message, data) {
			logs.push([message, data]);
		},
	};

	assert.equal(
		resolvePausedRovoToolCallRecord({
			currentToolFirstAttempt: 1,
			logger,
			now: () => 1500,
			pausedContinuationToolCallId: "paused-1",
			takePausedRovoToolCall(id) {
				takenIds.push(id);
				return record;
			},
		}),
		record,
	);
	assert.deepEqual(takenIds, ["paused-1"]);
	assert.deepEqual(logs, [[
		"[DEBUG-PLAN-APPROVAL] Paused tool call record",
		{
			pausedContinuationToolCallId: "paused-1",
			recordFound: true,
			recordKind: "approval",
			recordPort: 3200,
			recordCreatedAt: 1000,
			recordExpiresAt: 5000,
			ageMs: 500,
		},
	]]);

	assert.equal(
		resolvePausedRovoToolCallRecord({
			currentToolFirstAttempt: 2,
			logger,
			now: () => 2000,
			pausedContinuationToolCallId: "paused-1",
			takePausedRovoToolCall(id) {
				takenIds.push(id);
				return record;
			},
		}),
		null,
	);
	assert.deepEqual(takenIds, ["paused-1"]);
	assert.equal(logs[1][1].recordFound, false);
});

test("buildRovoStreamCommonOptions preserves callback wiring and common stream flags", () => {
	const { events, options } = createBaseCommonOptions();

	const streamCommonOptions = buildRovoStreamCommonOptions(options);

	assert.equal(streamCommonOptions.enableDeferredTools, true);
	assert.equal(streamCommonOptions.idleTimeoutMs, 12_345);
	assert.equal(streamCommonOptions.includeSubagentEvents, true);
	assert.equal(streamCommonOptions.pauseOnCallToolsStart, true);
	assert.equal(streamCommonOptions.signal, options.abortController.signal);
	assert.equal(streamCommonOptions.conflictPolicy, "wait-for-turn");

	streamCommonOptions.onTextDelta("hello");
	streamCommonOptions.onToolCallStart({
		toolCallId: "tool-1",
		toolName: "bash",
	});
	streamCommonOptions.onToolCallInputResolved({
		toolCallId: "tool-1",
		toolName: "bash",
	});
	streamCommonOptions.onThinkingStatus({ label: "Working" });
	streamCommonOptions.onThinkingEvent({ phase: "result" });
	streamCommonOptions.onToolCallResult({ toolCallId: "tool-1" });
	streamCommonOptions.onPortAcquired(4422);

	assert.deepEqual(events, [
		["create-guard", "thread-1"],
		["create-lifecycle", "thread-1"],
		["create-tool-callbacks", "session-1"],
		["text", "hello"],
		["tool-start", { toolCallId: "tool-1", toolName: "bash" }],
		["actionable"],
		["deferred"],
		["relevant"],
		["tool-input", { toolCallId: "tool-1", toolName: "bash" }, "logger"],
		["thinking-status", { label: "Working" }],
		["thinking-status-marked"],
		["thinking-event", { phase: "result" }],
		["tool-execution"],
		["observation", { phase: "result", toolName: "bash" }],
		["tool-result", { toolCallId: "tool-1" }],
		["port", 4422],
	]);
});

test("createRovoStreamAttemptRunner dispatches paused continuations with stream common options", async () => {
	const record = {
		handle: { settleLease: () => true },
		kind: "approval",
		port: 3200,
		toolCallId: "tool-1",
	};
	const { events, options } = createBaseCommonOptions({
		approvalSubmission: { approved: true },
		getPausedToolCallHandled: () => false,
		hasPausedApprovalToolCall: true,
		logger: {
			info(message, data) {
				events.push(["log", message, data.recordFound]);
			},
		},
		pausedContinuationToolCallId: "paused-1",
		runFreshRovoStreamTurnFn: async () => {
			throw new Error("fresh stream should not run");
		},
		runPausedRovoToolContinuationFn: async (pausedOptions) => {
			events.push([
				"paused",
				pausedOptions.pausedToolCallRecord,
				pausedOptions.runId,
				pausedOptions.threadId,
				pausedOptions.streamCommonOptions.conflictPolicy,
			]);
		},
		takePausedRovoToolCall(id) {
			events.push(["take", id]);
			return record;
		},
		stageTrace: { requestId: "run-1" },
	});
	const runAttempt = createRovoStreamAttemptRunner(options);

	await runAttempt({
		activeAttemptMessage: { message: "ignored" },
		currentToolFirstAttempt: 1,
	});

	assert.deepEqual(events.slice(-2), [[
		"create-tool-callbacks",
		"session-1",
	], [
		"paused",
		record,
		"run-1",
		"thread-1",
		"wait-for-turn",
	]]);
});

test("createRovoStreamAttemptRunner dispatches fresh turns when no paused record is available", async () => {
	const activeAttemptMessage = {
		enableDeepPlan: false,
		message: "build something",
	};
	const { events, options } = createBaseCommonOptions({
		approvalToolCallId: "approval-1",
		rovoSessionId: "session-2",
		runFreshRovoStreamTurnFn: async (freshOptions) => {
			events.push([
				"fresh",
				freshOptions.activeAttemptMessage,
				freshOptions.approvalToolCallId,
				freshOptions.rovoSessionId,
				freshOptions.streamCommonOptions.conflictPolicy,
			]);
		},
		runPausedRovoToolContinuationFn: async () => {
			throw new Error("paused continuation should not run");
		},
	});
	const runAttempt = createRovoStreamAttemptRunner(options);

	await runAttempt({
		activeAttemptMessage,
		currentToolFirstAttempt: 2,
	});

	assert.deepEqual(events.slice(-1), [[
		"fresh",
		activeAttemptMessage,
		"approval-1",
		"session-2",
		"wait-for-turn",
	]]);
});

test("a paused record taken before the stream options fail to build is abandoned, not left reserved", async () => {
	const settles = [];
	const cancels = [];
	const record = {
		handle: {
			settleLease: (disposition) => {
				settles.push(disposition);
				return true;
			},
		},
		kind: "approval",
		port: 3201,
		toolCallId: "tool-2",
	};
	const { options } = createBaseCommonOptions({
		createRovoStreamToolCallbacksFn: () => {
			throw new Error("callbacks failed");
		},
		hasPausedApprovalToolCall: true,
		logger: { info() {} },
		pausedContinuationToolCallId: "paused-2",
		rovoCancelChat: async (port) => {
			cancels.push(port);
		},
		runPausedRovoToolContinuationFn: async () => {
			throw new Error("continuation should not run");
		},
		takePausedRovoToolCall: () => record,
	});
	const runAttempt = createRovoStreamAttemptRunner(options);

	await assert.rejects(runAttempt({ currentToolFirstAttempt: 1 }), /callbacks failed/u);
	assert.deepEqual(cancels, [3201]);
	assert.deepEqual(settles, ["release"]);
});
