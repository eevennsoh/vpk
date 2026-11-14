"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createRovoStreamAttemptErrorHandler,
	handleRovoStreamAttemptError,
} = require("./rovo-stream-attempt");

function createBaseOptions(overrides = {}) {
	const state = {
		failureNotices: [],
		loggerWarnings: [],
		streamTextDeltas: [],
		writtenParts: [],
	};

	return {
		state,
		options: {
			abortSignal: { aborted: false },
			adaptClarificationAnswersForToolContract: () => "adapted answer",
			buildInteractiveStuckPortFailureMessage: () => "Port is stuck",
			forcePortRecoveryAttemptCount: 0,
			getListeningPidsForPort: () => [],
			handleStreamTextDelta: (delta) => {
				state.streamTextDeltas.push(delta);
			},
			hasPausedClarificationToolCall: false,
			hasRetriedAsDeferredToolResponse: false,
			interactiveChatForcePortRecoveryMaxAttempts: 1,
			interactiveChatForcePortRecoveryTimeoutMs: 5000,
			interactiveChatStuckPortRecoveryRetryAttempts: 1,
			logger: {
				warn(...args) {
					state.loggerWarnings.push(args);
				},
			},
			refreshRovoAvailability: async () => {},
			resolvedRovoPort: 43123,
			restartRovoPort: async () => ({ recovered: false }),
			resolveRovoChatInProgressTimeoutRecovery: async () => ({
				action: "timeout",
				nextAttemptCount: 1,
				statusParts: [],
				textDelta: "Timed out.",
			}),
			resolveRovoPortStuckRecovery: async () => ({
				action: "fail",
				failureText: "Port is stuck",
				nextAttemptCount: 0,
				statusParts: [],
			}),
			rovoCancelChat: async () => {},
			rovoHealthCheck: async () => {},
			shouldRetryInteractiveStuckPortRecovery: () => false,
			stuckPortRecoveryRetryCount: 0,
			synthesiseDeferredToolResponseFromClarification: () => null,
			threadId: "thread-1",
			writer: {
				write(part) {
					state.writtenParts.push(part);
				},
			},
			emitFailureNotice: (notice) => {
				state.failureNotices.push(notice);
			},
			...overrides,
		},
	};
}

test("handleRovoStreamAttemptError retries after stuck-port recovery", async () => {
	const { options, state } = createBaseOptions({
		resolveRovoPortStuckRecovery: async (input) => {
			assert.equal(input.recoveryPort, 43124);
			assert.equal(input.restartOptions.timeoutMs, 5000);
			return {
				action: "retry",
				nextAttemptCount: 1,
				statusParts: [{ type: "data-thinking-status", data: { label: "Retry" } }],
			};
		},
		rovoStreamError: {
			code: "ROVO_PORT_STUCK",
			port: 43124,
		},
	});

	const result = await handleRovoStreamAttemptError(options);

	assert.deepEqual(result, {
		action: "retry-stream",
		resetAssistantText: true,
		stuckPortRecoveryRetryCount: 1,
	});
	assert.deepEqual(state.writtenParts, [
		{ type: "data-thinking-status", data: { label: "Retry" } },
	]);
	assert.deepEqual(state.failureNotices, []);
});

test("handleRovoStreamAttemptError emits stuck-port failure text and stops retry loop", async () => {
	const { options, state } = createBaseOptions({
		resolveRovoPortStuckRecovery: async () => ({
			action: "fail",
			failureText: "Could not recover",
			nextAttemptCount: 1,
			statusParts: [{ type: "data-thinking-status", data: { label: "Failed" } }],
		}),
		rovoStreamError: {
			code: "ROVO_PORT_STUCK",
		},
	});

	const result = await handleRovoStreamAttemptError(options);

	assert.deepEqual(result, {
		action: "continue-after-error",
		shouldContinueToolFirstRetry: false,
	});
	assert.deepEqual(state.writtenParts, [
		{ type: "data-thinking-status", data: { label: "Failed" } },
	]);
	assert.deepEqual(state.failureNotices, ["⚠️ Could not recover"]);
});

test("handleRovoStreamAttemptError retries after in-progress timeout recovery", async () => {
	const { options, state } = createBaseOptions({
		resolveRovoChatInProgressTimeoutRecovery: async (input) => {
			assert.equal(input.resolvedRecoveryPort, 43123);
			assert.equal(input.restartOptions.timeoutMs, 5000);
			return {
				action: "retry",
				nextAttemptCount: 2,
				statusParts: [{ type: "data-thinking-status", data: { label: "Recovered" } }],
			};
		},
		rovoStreamError: {
			code: "ROVO_CHAT_IN_PROGRESS_TIMEOUT",
		},
	});

	const result = await handleRovoStreamAttemptError(options);

	assert.deepEqual(result, {
		action: "retry-stream",
		forcePortRecoveryAttemptCount: 2,
	});
	assert.deepEqual(state.writtenParts, [
		{ type: "data-thinking-status", data: { label: "Recovered" } },
	]);
	assert.deepEqual(state.streamTextDeltas, []);
});

test("handleRovoStreamAttemptError returns stream-timeout after failed in-progress recovery", async () => {
	const { options, state } = createBaseOptions({
		resolveRovoChatInProgressTimeoutRecovery: async () => ({
			action: "timeout",
			nextAttemptCount: 1,
			statusParts: [{ type: "data-thinking-status", data: { label: "Timed out" } }],
			textDelta: "Previous turn did not clear.",
		}),
		rovoStreamError: {
			code: "ROVO_CHAT_IN_PROGRESS_TIMEOUT",
		},
	});

	const result = await handleRovoStreamAttemptError(options);

	assert.deepEqual(result, {
		action: "stream-timeout",
		forcePortRecoveryAttemptCount: 1,
	});
	assert.deepEqual(state.writtenParts, [
		{ type: "data-thinking-status", data: { label: "Timed out" } },
	]);
	assert.deepEqual(state.streamTextDeltas, [
		"\n\n⚠️ Previous turn did not clear.",
	]);
});

test("handleRovoStreamAttemptError retries pending deferred clarification as tool response", async () => {
	const clarificationSubmission = {
		answers: { color: "blue" },
		sessionId: "clarification-session-1",
	};
	const { options, state } = createBaseOptions({
		clarificationSubmission,
		clarificationToolCallId: "tool-1",
		rovoStreamError: new Error("pending deferred tool request for tool-1"),
		synthesiseDeferredToolResponseFromClarification: (
			submission,
			toolCallId,
			adapter,
		) => {
			assert.equal(submission, clarificationSubmission);
			assert.equal(toolCallId, "tool-1");
			assert.equal(adapter(), "adapted answer");
			return { tool: "ask_user_questions", result: "blue" };
		},
	});

	const result = await handleRovoStreamAttemptError(options);

	assert.deepEqual(result, {
		action: "retry-stream",
		activeAttemptMessage: {
			message: { tool: "ask_user_questions", result: "blue" },
			enableDeepPlan: false,
		},
		hasRetriedAsDeferredToolResponse: true,
	});
	assert.deepEqual(state.loggerWarnings, [
		[
			"[CHAT-SDK] Clarification continuation hit pending deferred tool request; retrying with DeferredToolResponse",
			{
				threadId: "thread-1",
				toolCallId: "tool-1",
				sessionId: "clarification-session-1",
			},
		],
	]);
});

test("handleRovoStreamAttemptError does not retry pending deferred clarification twice", async () => {
	const error = new Error("pending deferred tool request for tool-1");
	const { options, state } = createBaseOptions({
		clarificationSubmission: {
			answers: { color: "blue" },
			sessionId: "clarification-session-1",
		},
		clarificationToolCallId: "tool-1",
		hasRetriedAsDeferredToolResponse: true,
		rovoStreamError: error,
		synthesiseDeferredToolResponseFromClarification: () => {
			throw new Error("should not synthesise a second deferred tool response");
		},
	});

	await assert.rejects(
		() => handleRovoStreamAttemptError(options),
		(errorCandidate) => errorCandidate === error,
	);
	assert.deepEqual(state.loggerWarnings, []);
});

test("handleRovoStreamAttemptError rethrows unhandled stream errors", async () => {
	const error = new Error("boom");
	const { options } = createBaseOptions({
		rovoStreamError: error,
	});

	await assert.rejects(
		() => handleRovoStreamAttemptError(options),
		(errorCandidate) => errorCandidate === error,
	);
});

test("createRovoStreamAttemptErrorHandler resolves live port and forwards retry counters", async () => {
	const calls = [];
	let resolvedRovoPort = 43123;
	const handleAttemptError = createRovoStreamAttemptErrorHandler({
		abortSignal: { aborted: false },
		adaptClarificationAnswersForToolContract: () => "adapted",
		buildInteractiveStuckPortFailureMessage: () => "stuck",
		clarificationSubmission: { sessionId: "session-1" },
		clarificationToolCallId: "tool-1",
		emitFailureNotice: () => {},
		getListeningPidsForPort: () => [],
		getResolvedRovoPort: () => resolvedRovoPort,
		handleRovoStreamAttemptErrorFn: async (options) => {
			calls.push(options);
			return { action: "retry-stream" };
		},
		handleStreamTextDelta: () => {},
		hasPausedClarificationToolCall: true,
		interactiveChatForcePortRecoveryMaxAttempts: 3,
		interactiveChatForcePortRecoveryTimeoutMs: 5000,
		interactiveChatStuckPortRecoveryRetryAttempts: 2,
		logger: { warn() {} },
		refreshRovoAvailability: async () => {},
		restartRovoPort: async () => {},
		resolveRovoChatInProgressTimeoutRecovery: async () => {},
		resolveRovoPortStuckRecovery: async () => {},
		rovoCancelChat: async () => {},
		rovoHealthCheck: async () => {},
		shouldRetryInteractiveStuckPortRecovery: () => false,
		synthesiseDeferredToolResponseFromClarification: () => null,
		threadId: "thread-1",
		writer: { write() {} },
	});
	const rovoStreamError = new Error("timeout");

	resolvedRovoPort = 43124;
	const result = await handleAttemptError({
		forcePortRecoveryAttemptCount: 4,
		hasRetriedAsDeferredToolResponse: true,
		rovoStreamError,
		stuckPortRecoveryRetryCount: 5,
	});

	assert.deepEqual(result, { action: "retry-stream" });
	assert.equal(calls.length, 1);
	assert.equal(calls[0].resolvedRovoPort, 43124);
	assert.equal(calls[0].forcePortRecoveryAttemptCount, 4);
	assert.equal(calls[0].hasRetriedAsDeferredToolResponse, true);
	assert.equal(calls[0].rovoStreamError, rovoStreamError);
	assert.equal(calls[0].stuckPortRecoveryRetryCount, 5);
	assert.equal(calls[0].hasPausedClarificationToolCall, true);
	assert.equal(calls[0].interactiveChatForcePortRecoveryMaxAttempts, 3);
	assert.equal(calls[0].interactiveChatForcePortRecoveryTimeoutMs, 5000);
	assert.equal(calls[0].interactiveChatStuckPortRecoveryRetryAttempts, 2);
});
