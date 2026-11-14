"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildRovoInitialActiveAttemptMessage,
	resolveRovoToolFirstRetryLimit,
	runRovoStreamRetryLoop,
	runRovoStreamRetryLoopWithToolFirstPlanning,
	waitForRovoRetryDelay,
} = require("./rovo-stream-loop");
const { createRovoChatTurn } = require("./rovo-chat-turn-machine");

function createBaseOptions(overrides = {}) {
	const events = [];
	const abortSignal = { aborted: false };
	const initialActiveAttemptMessage = {
		enableDeepPlan: false,
		message: "initial prompt",
	};

	return {
		abortSignal,
		events,
		initialActiveAttemptMessage,
		options: {
			abortSignal,
			handleAttemptError: async ({ rovoStreamError }) => {
				throw rovoStreamError;
			},
			hasRelevantToolSuccess: () => {
				events.push(["success"]);
				return true;
			},
			initialActiveAttemptMessage,
			logger: {
				info(message, data) {
					events.push(["log", message, data]);
				},
			},
			recordToolFirstAttempt: ({ currentToolFirstAttempt, isRetry }) => {
				events.push(["record", currentToolFirstAttempt, isRetry]);
			},
			resetAssistantTextForRetryAttempt: () => {
				events.push(["reset"]);
			},
			resolveRetryPlan: ({ currentToolFirstAttempt, hasToolFirstSuccess }) => {
				events.push(["retry-plan", currentToolFirstAttempt, hasToolFirstSuccess]);
				return { action: "stop" };
			},
			runStreamAttempt: async ({ activeAttemptMessage, currentToolFirstAttempt }) => {
				events.push(["stream", currentToolFirstAttempt, activeAttemptMessage]);
			},
			waitForRetryDelay: async (delayMs) => {
				events.push(["wait", delayMs]);
			},
			writeStatusPart: (part) => {
				events.push(["write", part]);
			},
			...overrides,
		},
	};
}

test("buildRovoInitialActiveAttemptMessage prefers deferred tool responses", () => {
	const deferredResponse = { tool_call_id: "tool-1", output: "done" };

	assert.deepEqual(
		buildRovoInitialActiveAttemptMessage({
			rawDeferredToolResponse: deferredResponse,
			userMessageText: "ignored",
		}),
		{
			message: deferredResponse,
			enableDeepPlan: false,
		},
	);
	assert.deepEqual(
		buildRovoInitialActiveAttemptMessage({
			rawDeferredToolResponse: "plain text response",
			userMessageText: "ask for help",
		}),
		{
			message: "ask for help",
			enableDeepPlan: false,
		},
	);
});

test("resolveRovoToolFirstRetryLimit only enables strict soft retries", () => {
	assert.equal(
		resolveRovoToolFirstRetryLimit({
			isStrictToolFirstTurn: false,
			softRetryMode: "soft-retry",
			toolFirstPolicy: {
				enforcement: {
					maxRelevantRetries: 2,
					mode: "soft-retry",
				},
			},
		}),
		0,
	);
	assert.equal(
		resolveRovoToolFirstRetryLimit({
			isStrictToolFirstTurn: true,
			softRetryMode: "soft-retry",
			toolFirstPolicy: {
				enforcement: {
					maxRelevantRetries: -1,
					mode: "soft-retry",
				},
			},
		}),
		0,
	);
	assert.equal(
		resolveRovoToolFirstRetryLimit({
			isStrictToolFirstTurn: true,
			softRetryMode: "soft-retry",
			toolFirstPolicy: {
				enforcement: {
					maxRelevantRetries: 2,
					mode: "soft-retry",
				},
			},
		}),
		2,
	);
});

test("runRovoStreamRetryLoop reruns the same attempt after retry-stream recovery", async () => {
	const streamError = new Error("stuck");
	const { events, initialActiveAttemptMessage, options } = createBaseOptions({
		handleAttemptError: async ({
			currentToolFirstAttempt,
			rovoStreamError,
			stuckPortRecoveryRetryCount,
		}) => {
			events.push([
				"recover",
				currentToolFirstAttempt,
				rovoStreamError,
				stuckPortRecoveryRetryCount,
			]);
			return {
				action: "retry-stream",
				resetAssistantText: true,
				stuckPortRecoveryRetryCount: 1,
			};
		},
		runStreamAttempt: async ({ activeAttemptMessage, currentToolFirstAttempt }) => {
			events.push(["stream", currentToolFirstAttempt, activeAttemptMessage]);
			if (events.filter(([type]) => type === "stream").length === 1) {
				throw streamError;
			}
		},
	});

	const result = await runRovoStreamRetryLoop(options);

	assert.deepEqual(events, [
		["record", 1, false],
		["stream", 1, initialActiveAttemptMessage],
		["recover", 1, streamError, 0],
		["reset"],
		["record", 1, false],
		["stream", 1, initialActiveAttemptMessage],
		["success"],
		["retry-plan", 1, true],
	]);
	assert.equal(result.stuckPortRecoveryRetryCount, 1);
	assert.equal(result.currentToolFirstAttempt, 1);
});

test("runRovoStreamRetryLoop stops before retry planning after stream timeout", async () => {
	const streamError = new Error("in progress");
	const { events, options } = createBaseOptions({
		handleAttemptError: async ({ rovoStreamError }) => {
			events.push(["recover", rovoStreamError]);
			return {
				action: "stream-timeout",
				forcePortRecoveryAttemptCount: 1,
			};
		},
		runStreamAttempt: async () => {
			events.push(["stream"]);
			throw streamError;
		},
	});

	const result = await runRovoStreamRetryLoop(options);

	assert.deepEqual(events, [
		["record", 1, false],
		["stream"],
		["recover", streamError],
	]);
	assert.equal(result.forcePortRecoveryAttemptCount, 1);
});

test("runRovoStreamRetryLoop writes status, resets, waits, and increments tool-first retries", async () => {
	const retryMessage = {
		enableDeepPlan: false,
		message: "retry prompt",
	};
	const statusPart = {
		type: "data-thinking-status",
		data: { label: "Retrying" },
	};
	const { events, initialActiveAttemptMessage, options } = createBaseOptions({
		hasRelevantToolSuccess: () => {
			events.push(["success"]);
			return events.filter(([type]) => type === "stream").length > 1;
		},
		resolveRetryPlan: ({ currentToolFirstAttempt, hasToolFirstSuccess }) => {
			events.push(["retry-plan", currentToolFirstAttempt, hasToolFirstSuccess]);
			if (currentToolFirstAttempt === 1) {
				return {
					action: "retry",
					activeAttemptMessage: retryMessage,
					logData: { reason: "missing_tool" },
					nextAttempt: 2,
					retryDelayMs: 25,
					statusPart,
				};
			}
			return { action: "stop" };
		},
	});

	const result = await runRovoStreamRetryLoop(options);

	assert.deepEqual(events, [
		["record", 1, false],
		["stream", 1, initialActiveAttemptMessage],
		["success"],
		["retry-plan", 1, false],
		["log", "[TOOL-FIRST] Retrying tool-grounded response", { reason: "missing_tool" }],
		["write", statusPart],
		["reset"],
		["wait", 25],
		["record", 2, true],
		["stream", 2, retryMessage],
		["success"],
		["retry-plan", 2, true],
	]);
	assert.equal(result.currentToolFirstAttempt, 2);
	assert.equal(result.activeAttemptMessage, retryMessage);
});

test("runRovoStreamRetryLoop default retry delay receives the abort signal", async () => {
	const retryMessage = {
		enableDeepPlan: false,
		message: "retry prompt",
	};
	const { abortSignal, events, initialActiveAttemptMessage, options } =
		createBaseOptions({
			resolveRetryPlan: ({ currentToolFirstAttempt, hasToolFirstSuccess }) => {
				events.push(["retry-plan", currentToolFirstAttempt, hasToolFirstSuccess]);
				return {
					action: "retry",
					activeAttemptMessage: retryMessage,
					logData: {},
					nextAttempt: 2,
					retryDelayMs: 1,
					statusPart: { type: "data-thinking-status" },
				};
			},
			waitForRetryDelay: async (delayMs, waitOptions) => {
				events.push(["wait-options", delayMs, waitOptions.abortSignal]);
				abortSignal.aborted = true;
			},
		});

	const result = await runRovoStreamRetryLoop(options);

	assert.deepEqual(events, [
		["record", 1, false],
		["stream", 1, initialActiveAttemptMessage],
		["success"],
		["retry-plan", 1, true],
		["log", "[TOOL-FIRST] Retrying tool-grounded response", {}],
		["write", { type: "data-thinking-status" }],
		["reset"],
		["wait-options", 1, abortSignal],
	]);
	assert.equal(result.currentToolFirstAttempt, 1);
});

test("runRovoStreamRetryLoop stops after retry delay when the request aborts", async () => {
	const retryMessage = {
		enableDeepPlan: false,
		message: "retry prompt",
	};
	const { abortSignal, events, initialActiveAttemptMessage, options } =
		createBaseOptions({
			resolveRetryPlan: () => ({
				action: "retry",
				activeAttemptMessage: retryMessage,
				logData: { reason: "missing_tool" },
				nextAttempt: 2,
				retryDelayMs: 25,
				statusPart: { type: "data-thinking-status" },
			}),
			waitForRetryDelay: async (delayMs) => {
				events.push(["wait", delayMs]);
				abortSignal.aborted = true;
			},
		});

	const result = await runRovoStreamRetryLoop(options);

	assert.deepEqual(events, [
		["record", 1, false],
		["stream", 1, initialActiveAttemptMessage],
		["success"],
		["log", "[TOOL-FIRST] Retrying tool-grounded response", { reason: "missing_tool" }],
		["write", { type: "data-thinking-status" }],
		["reset"],
		["wait", 25],
	]);
	assert.equal(result.currentToolFirstAttempt, 1);
	assert.equal(result.activeAttemptMessage, initialActiveAttemptMessage);
});

test("waitForRovoRetryDelay resolves immediately for invalid or already aborted waits", async () => {
	const abortedController = new AbortController();
	abortedController.abort();

	await waitForRovoRetryDelay(0);
	await waitForRovoRetryDelay(10, {
		abortSignal: abortedController.signal,
	});
});

test("waitForRovoRetryDelay resolves when the signal aborts", async () => {
	const controller = new AbortController();
	const waitPromise = waitForRovoRetryDelay(1000, {
		abortSignal: controller.signal,
	});
	controller.abort();

	await waitPromise;
});

test("runRovoStreamRetryLoop leaves paused continuation routing to first attempt only", async () => {
	const retryMessage = {
		enableDeepPlan: false,
		message: "retry prompt",
	};
	const { events, initialActiveAttemptMessage, options } = createBaseOptions({
		resolveRetryPlan: ({ currentToolFirstAttempt }) => {
			if (currentToolFirstAttempt === 1) {
				return {
					action: "retry",
					activeAttemptMessage: retryMessage,
					logData: {},
					nextAttempt: 2,
					retryDelayMs: 0,
					statusPart: { type: "data-thinking-status" },
				};
			}
			return { action: "stop" };
		},
		runStreamAttempt: async ({ activeAttemptMessage, currentToolFirstAttempt }) => {
			events.push([
				currentToolFirstAttempt === 1 ? "paused" : "fresh",
				currentToolFirstAttempt,
				activeAttemptMessage,
			]);
		},
	});

	await runRovoStreamRetryLoop(options);

	assert.deepEqual(events, [
		["record", 1, false],
		["paused", 1, initialActiveAttemptMessage],
		["success"],
		["log", "[TOOL-FIRST] Retrying tool-grounded response", {}],
		["write", { type: "data-thinking-status" }],
		["reset"],
		["record", 2, true],
		["fresh", 2, retryMessage],
		["success"],
	]);
});

test("runRovoStreamRetryLoop passes deferred retry state to later error handling", async () => {
	const retryMessage = {
		enableDeepPlan: false,
		message: "deferred tool response",
	};
	const streamError = new Error("pending deferred tool request");
	const { events, options } = createBaseOptions({
		handleAttemptError: async ({
			activeAttemptMessage,
			hasRetriedAsDeferredToolResponse,
		}) => {
			events.push([
				"recover",
				activeAttemptMessage,
				hasRetriedAsDeferredToolResponse,
			]);
			if (!hasRetriedAsDeferredToolResponse) {
				return {
					action: "retry-stream",
					activeAttemptMessage: retryMessage,
					hasRetriedAsDeferredToolResponse: true,
				};
			}
			return {
				action: "continue-after-error",
				shouldContinueToolFirstRetry: false,
			};
		},
		runStreamAttempt: async ({ activeAttemptMessage, currentToolFirstAttempt }) => {
			events.push(["stream", currentToolFirstAttempt, activeAttemptMessage]);
			throw streamError;
		},
	});

	const result = await runRovoStreamRetryLoop(options);

	assert.deepEqual(events.slice(0, 6), [
		["record", 1, false],
		["stream", 1, options.initialActiveAttemptMessage],
		["recover", options.initialActiveAttemptMessage, false],
		["record", 1, false],
		["stream", 1, retryMessage],
		["recover", retryMessage, true],
	]);
	assert.equal(result.hasRetriedAsDeferredToolResponse, true);
});

test("runRovoStreamRetryLoopWithToolFirstPlanning wires live retry state into the base loop", async () => {
	const events = [];
	const abortSignal = { aborted: false };
	const initialActiveAttemptMessage = {
		enableDeepPlan: false,
		message: "initial prompt",
	};
	const toolFirstExecutionState = {
		attempts: 0,
	};
	const toolFirstPolicy = {
		enforcement: { mode: "soft-retry" },
	};
	const toolFirstRelevanceDomains = ["calendar"];
	const turn = createRovoChatTurn();
	const statusPart = {
		type: "data-thinking-status",
		data: { label: "Retrying" },
	};

	const result = await runRovoStreamRetryLoopWithToolFirstPlanning({
		abortSignal,
		handleAttemptError: async () => ({ action: "continue-after-error" }),
		hasRelevantToolSuccess: (state) => {
			events.push(["success", state]);
			return true;
		},
		initialActiveAttemptMessage,
		logger: console,
		recordToolFirstAttempt: (state, data) => {
			events.push(["record", state, data]);
		},
		resetAssistantTextForRetryAttempt: () => {
			events.push(["reset"]);
		},
		resolveRovoToolFirstRetryPlan: (input) => {
			events.push(["retry-plan", input]);
			return { action: "stop" };
		},
		runRovoStreamRetryLoopFn: async (options) => {
			events.push(["loop", options.initialActiveAttemptMessage]);
			options.recordToolFirstAttempt({ isRetry: true });
			assert.equal(options.turn, turn);
			turn.dispatch({ type: "question-card-emitted" });
			turn.dispatch({ type: "deferred-tool-request-observed" });
			const hasToolFirstSuccess = options.hasRelevantToolSuccess();
			const retryPlan = options.resolveRetryPlan({
				currentToolFirstAttempt: 2,
				hasToolFirstSuccess,
			});
			options.writeStatusPart(statusPart);
			return {
				retryPlan,
			};
		},
		runStreamAttempt: async () => {},
		toolFirstExecutionState,
		toolFirstPolicy,
		toolFirstRelevanceDomains,
		toolFirstSoftRetryEnabled: true,
		totalToolFirstAttempts: 3,
		turn,
		userMessageText: "show my meetings",
		writer: {
			write(part) {
				events.push(["write", part]);
			},
		},
	});

	assert.deepEqual(result, {
		retryPlan: { action: "stop" },
	});
	assert.equal(events[0][0], "loop");
	assert.equal(events[0][1], initialActiveAttemptMessage);
	assert.deepEqual(events[1], [
		"record",
		toolFirstExecutionState,
		{ isRetry: true },
	]);
	assert.deepEqual(events[2], ["success", toolFirstExecutionState]);
	assert.equal(events[3][0], "retry-plan");
	assert.equal(events[3][1].abortSignal, abortSignal);
	assert.equal(events[3][1].currentToolFirstAttempt, 2);
	assert.equal(events[3][1].hasEmittedQuestionCard, true);
	assert.equal(events[3][1].hasObservedDeferredToolRequest, true);
	assert.equal(events[3][1].hasToolFirstSuccess, true);
	assert.equal(events[3][1].toolFirstExecutionState, toolFirstExecutionState);
	assert.equal(events[3][1].toolFirstPolicy, toolFirstPolicy);
	assert.equal(events[3][1].toolFirstRelevanceDomains, toolFirstRelevanceDomains);
	assert.equal(events[3][1].toolFirstSoftRetryEnabled, true);
	assert.equal(events[3][1].totalToolFirstAttempts, 3);
	assert.equal(events[3][1].userMessageText, "show my meetings");
	assert.deepEqual(events[4], ["write", statusPart]);
});

test("runRovoStreamRetryLoop plans no tool-first retry after a recovery that says stop", async () => {
	const { events, options } = createBaseOptions({
		handleAttemptError: async () => ({
			action: "continue-after-error",
			shouldContinueToolFirstRetry: false,
		}),
		resolveRetryPlan: () => {
			events.push(["retry-plan"]);
			return { action: "retry", activeAttemptMessage: { message: "must not run" }, nextAttempt: 2, retryDelayMs: 0, statusPart: { type: "status" } };
		},
		runStreamAttempt: async ({ currentToolFirstAttempt }) => {
			events.push(["stream", currentToolFirstAttempt]);
			throw new Error("port stuck");
		},
	});

	const result = await runRovoStreamRetryLoop(options);

	assert.deepEqual(events, [
		["record", 1, false],
		["stream", 1],
	]);
	assert.equal(result.currentToolFirstAttempt, 1);
});
