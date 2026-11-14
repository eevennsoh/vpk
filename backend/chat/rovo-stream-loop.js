"use strict";

const { createRovoChatTurn } = require("./rovo-chat-turn-machine");

function buildRovoInitialActiveAttemptMessage({
	rawDeferredToolResponse,
	userMessageText,
} = {}) {
	return rawDeferredToolResponse && typeof rawDeferredToolResponse === "object"
		? {
				message: rawDeferredToolResponse,
				enableDeepPlan: false,
			}
		: {
				message: userMessageText,
				enableDeepPlan: false,
			};
}

function resolveRovoToolFirstRetryLimit({
	isStrictToolFirstTurn = false,
	softRetryMode,
	toolFirstPolicy,
} = {}) {
	if (
		!isStrictToolFirstTurn ||
		toolFirstPolicy?.enforcement?.mode !== softRetryMode
	) {
		return 0;
	}
	return Math.max(toolFirstPolicy?.enforcement?.maxRelevantRetries ?? 0, 0);
}

function waitForRovoRetryDelay(delayMs, {
	abortSignal,
} = {}) {
	return new Promise((resolve) => {
		if (
			typeof delayMs !== "number" ||
			delayMs <= 0 ||
			abortSignal?.aborted
		) {
			resolve();
			return;
		}
		let settled = false;
		const finish = () => {
			if (settled) {
				return;
			}
			settled = true;
			abortSignal?.removeEventListener?.("abort", onAbort);
			resolve();
		};
		const onAbort = () => {
			clearTimeout(timer);
			finish();
		};
		const timer = setTimeout(finish, delayMs);
		abortSignal?.addEventListener?.("abort", onAbort, { once: true });
	});
}

async function runRovoStreamRetryLoop({
	abortSignal,
	handleAttemptError,
	hasRelevantToolSuccess,
	initialActiveAttemptMessage,
	logger = console,
	recordToolFirstAttempt,
	resetAssistantTextForRetryAttempt,
	resolveRetryPlan,
	runStreamAttempt,
	turn = createRovoChatTurn(),
	waitForRetryDelay = waitForRovoRetryDelay,
	writeStatusPart,
} = {}) {
	// The turn owns the attempt, its recovery counts and the facts its callbacks record.
	const loopTurn = turn;
	loopTurn.dispatch({
		type: "attempt-started",
		activeAttemptMessage: initialActiveAttemptMessage,
		attempt: 1,
	});

	for (;;) {
		const { activeAttemptMessage, attempt: currentToolFirstAttempt } = loopTurn.getState();
		loopTurn.dispatch({ type: "attempt-started" });
		recordToolFirstAttempt({
			activeAttemptMessage,
			currentToolFirstAttempt,
			isRetry: currentToolFirstAttempt > 1,
		});

		let resetAssistantText = false;
		try {
			await runStreamAttempt({
				activeAttemptMessage,
				currentToolFirstAttempt,
			});
			loopTurn.dispatch({ type: "attempt-finished" });
		} catch (rovoStreamError) {
			const { recovery } = loopTurn.getState();
			const recoveryResult = await handleAttemptError({
				activeAttemptMessage,
				currentToolFirstAttempt,
				forcePortRecoveryAttemptCount: recovery.forcePortRecoveryAttempts,
				hasRetriedAsDeferredToolResponse: recovery.retriedAsDeferredToolResponse,
				rovoStreamError,
				stuckPortRecoveryRetryCount: recovery.stuckPortRetries,
			});
			resetAssistantText = recoveryResult.resetAssistantText === true;
			loopTurn.dispatch({ type: "attempt-failed", recovery: recoveryResult });
		}

		const { activeAttemptMessage: attemptMessageAfterRecovery, next } = loopTurn.getState();
		if (next === "rerun") {
			if (resetAssistantText) {
				resetAssistantTextForRetryAttempt();
			}
			continue;
		}
		if (next !== "plan-retry") {
			break;
		}

		const hasToolFirstSuccess = hasRelevantToolSuccess();
		const retryPlan = resolveRetryPlan({
			activeAttemptMessage: attemptMessageAfterRecovery,
			currentToolFirstAttempt,
			hasToolFirstSuccess,
		});
		if (retryPlan.action !== "retry") {
			break;
		}

		logger.info("[TOOL-FIRST] Retrying tool-grounded response", {
			...retryPlan.logData,
		});
		loopTurn.dispatch({ type: "retry-scheduled" });
		writeStatusPart(retryPlan.statusPart);
		resetAssistantTextForRetryAttempt();

		if (retryPlan.retryDelayMs > 0) {
			await waitForRetryDelay(retryPlan.retryDelayMs, { abortSignal });
		}
		if (abortSignal?.aborted) {
			break;
		}

		loopTurn.dispatch({
			type: "attempt-started",
			activeAttemptMessage: retryPlan.activeAttemptMessage,
			attempt: retryPlan.nextAttempt,
		});
	}

	const { activeAttemptMessage, attempt, recovery } = loopTurn.getState();
	return {
		activeAttemptMessage,
		currentToolFirstAttempt: attempt,
		forcePortRecoveryAttemptCount: recovery.forcePortRecoveryAttempts,
		hasRetriedAsDeferredToolResponse: recovery.retriedAsDeferredToolResponse,
		stuckPortRecoveryRetryCount: recovery.stuckPortRetries,
	};
}

async function runRovoStreamRetryLoopWithToolFirstPlanning({
	abortSignal,
	handleAttemptError,
	hasRelevantToolSuccess: hasRelevantToolSuccessFn,
	initialActiveAttemptMessage,
	logger = console,
	recordToolFirstAttempt,
	resetAssistantTextForRetryAttempt,
	resolveRovoToolFirstRetryPlan,
	runRovoStreamRetryLoopFn = runRovoStreamRetryLoop,
	runStreamAttempt,
	toolFirstExecutionState,
	toolFirstPolicy,
	toolFirstRelevanceDomains,
	toolFirstSoftRetryEnabled = false,
	totalToolFirstAttempts = 1,
	turn = createRovoChatTurn(),
	userMessageText,
	writer,
} = {}) {
	return runRovoStreamRetryLoopFn({
		abortSignal,
		initialActiveAttemptMessage,
		logger,
		recordToolFirstAttempt: ({ isRetry }) => {
			recordToolFirstAttempt(toolFirstExecutionState, { isRetry });
		},
		runStreamAttempt,
		handleAttemptError,
		hasRelevantToolSuccess: () =>
			hasRelevantToolSuccessFn(toolFirstExecutionState),
		resolveRetryPlan: ({
			currentToolFirstAttempt,
			hasToolFirstSuccess,
		}) => resolveRovoToolFirstRetryPlan({
			abortSignal,
			currentToolFirstAttempt,
			hasEmittedQuestionCard: turn.getState().facts.questionCard,
			hasObservedDeferredToolRequest: turn.getState().facts.deferredToolRequest,
			hasToolFirstSuccess,
			toolFirstExecutionState,
			toolFirstPolicy,
			toolFirstRelevanceDomains,
			toolFirstSoftRetryEnabled,
			totalToolFirstAttempts,
			userMessageText,
		}),
		resetAssistantTextForRetryAttempt,
		turn,
		writeStatusPart: (statusPart) => {
			writer.write(statusPart);
		},
	});
}

module.exports = {
	buildRovoInitialActiveAttemptMessage,
	resolveRovoToolFirstRetryLimit,
	runRovoStreamRetryLoop,
	runRovoStreamRetryLoopWithToolFirstPlanning,
	waitForRovoRetryDelay,
};
