"use strict";

function writeStatusParts(writer, statusParts = []) {
	for (const part of statusParts) {
		writer.write(part);
	}
}

async function handleRovoStreamAttemptError({
	abortSignal,
	adaptClarificationAnswersForToolContract,
	buildInteractiveStuckPortFailureMessage,
	clarificationSubmission,
	clarificationToolCallId,
	forcePortRecoveryAttemptCount = 0,
	getListeningPidsForPort,
	handleStreamTextDelta,
	hasPausedClarificationToolCall = false,
	hasRetriedAsDeferredToolResponse = false,
	interactiveChatForcePortRecoveryMaxAttempts,
	interactiveChatForcePortRecoveryTimeoutMs,
	interactiveChatStuckPortRecoveryRetryAttempts,
	logger = console,
	refreshRovoAvailability,
	resolvedRovoPort,
	restartRovoPort,
	resolveRovoChatInProgressTimeoutRecovery,
	resolveRovoPortStuckRecovery,
	rovoCancelChat,
	rovoHealthCheck,
	rovoStreamError,
	shouldRetryInteractiveStuckPortRecovery,
	stuckPortRecoveryRetryCount = 0,
	synthesiseDeferredToolResponseFromClarification,
	threadId,
	writer,
	emitFailureNotice,
} = {}) {
	if (rovoStreamError?.code === "ROVO_PORT_STUCK") {
		const recoveryPort = rovoStreamError.port || resolvedRovoPort;
		const recoveryDecision = await resolveRovoPortStuckRecovery({
			abortSignal,
			attemptCount: stuckPortRecoveryRetryCount,
			buildInteractiveStuckPortFailureMessage,
			logger,
			maxAttempts: interactiveChatStuckPortRecoveryRetryAttempts,
			recoveryPort,
			restartOptions: {
				cancelChat: rovoCancelChat,
				healthCheck: rovoHealthCheck,
				getListeningPidsForPort,
				refreshAvailability: refreshRovoAvailability,
				timeoutMs: interactiveChatForcePortRecoveryTimeoutMs,
			},
			restartRovoPort,
			shouldRetryInteractiveStuckPortRecovery,
		});
		writeStatusParts(writer, recoveryDecision.statusParts);
		if (recoveryDecision.action === "retry") {
			return {
				action: "retry-stream",
				resetAssistantText: true,
				stuckPortRecoveryRetryCount: recoveryDecision.nextAttemptCount,
			};
		}

		emitFailureNotice(`⚠️ ${recoveryDecision.failureText}`);
		return {
			action: "continue-after-error",
			shouldContinueToolFirstRetry: false,
		};
	}

	if (rovoStreamError?.code === "ROVO_CHAT_IN_PROGRESS_TIMEOUT") {
		const resolvedRecoveryPort =
			typeof resolvedRovoPort === "number" && resolvedRovoPort > 0
				? resolvedRovoPort
				: null;
		const recoveryDecision =
			await resolveRovoChatInProgressTimeoutRecovery({
				attemptCount: forcePortRecoveryAttemptCount,
				logger,
				maxAttempts: interactiveChatForcePortRecoveryMaxAttempts,
				resolvedRecoveryPort,
				restartOptions: {
					cancelChat: rovoCancelChat,
					healthCheck: rovoHealthCheck,
					getListeningPidsForPort,
					refreshAvailability: refreshRovoAvailability,
					timeoutMs: interactiveChatForcePortRecoveryTimeoutMs,
				},
				restartRovoPort,
			});
		writeStatusParts(writer, recoveryDecision.statusParts);
		if (recoveryDecision.action === "retry") {
			return {
				action: "retry-stream",
				forcePortRecoveryAttemptCount: recoveryDecision.nextAttemptCount,
			};
		}

		handleStreamTextDelta(`\n\n⚠️ ${recoveryDecision.textDelta}`);
		return {
			action: "stream-timeout",
			forcePortRecoveryAttemptCount: recoveryDecision.nextAttemptCount,
		};
	}

	const errorMessage =
		rovoStreamError instanceof Error
			? rovoStreamError.message
			: String(rovoStreamError ?? "");
	const shouldRetryAsDeferredToolResponse =
		!hasRetriedAsDeferredToolResponse &&
		clarificationSubmission &&
		!hasPausedClarificationToolCall &&
		/pending deferred tool request/i.test(errorMessage);

	if (shouldRetryAsDeferredToolResponse) {
		const deferredToolResponse =
			synthesiseDeferredToolResponseFromClarification(
				clarificationSubmission,
				clarificationToolCallId,
				adaptClarificationAnswersForToolContract,
			);
		if (deferredToolResponse) {
			logger.warn(
				"[CHAT-SDK] Clarification continuation hit pending deferred tool request; retrying with DeferredToolResponse",
				{
					threadId,
					toolCallId: clarificationToolCallId,
					sessionId: clarificationSubmission.sessionId ?? null,
				},
			);
			return {
				action: "retry-stream",
				activeAttemptMessage: {
					message: deferredToolResponse,
					enableDeepPlan: false,
				},
				hasRetriedAsDeferredToolResponse: true,
			};
		}
	}

	throw rovoStreamError;
}

function createRovoStreamAttemptErrorHandler({
	abortSignal,
	adaptClarificationAnswersForToolContract,
	buildInteractiveStuckPortFailureMessage,
	clarificationSubmission,
	clarificationToolCallId,
	emitFailureNotice,
	getListeningPidsForPort,
	getResolvedRovoPort,
	handleRovoStreamAttemptErrorFn = handleRovoStreamAttemptError,
	handleStreamTextDelta,
	hasPausedClarificationToolCall = false,
	interactiveChatForcePortRecoveryMaxAttempts,
	interactiveChatForcePortRecoveryTimeoutMs,
	interactiveChatStuckPortRecoveryRetryAttempts,
	logger = console,
	refreshRovoAvailability,
	restartRovoPort,
	resolveRovoChatInProgressTimeoutRecovery,
	resolveRovoPortStuckRecovery,
	rovoCancelChat,
	rovoHealthCheck,
	shouldRetryInteractiveStuckPortRecovery,
	synthesiseDeferredToolResponseFromClarification,
	threadId,
	writer,
} = {}) {
	return ({
		forcePortRecoveryAttemptCount,
		hasRetriedAsDeferredToolResponse,
		rovoStreamError,
		stuckPortRecoveryRetryCount,
	} = {}) =>
		handleRovoStreamAttemptErrorFn({
			abortSignal,
			adaptClarificationAnswersForToolContract,
			buildInteractiveStuckPortFailureMessage,
			clarificationSubmission,
			clarificationToolCallId,
			emitFailureNotice,
			forcePortRecoveryAttemptCount,
			getListeningPidsForPort,
			handleStreamTextDelta,
			hasPausedClarificationToolCall,
			hasRetriedAsDeferredToolResponse,
			interactiveChatForcePortRecoveryMaxAttempts,
			interactiveChatForcePortRecoveryTimeoutMs,
			interactiveChatStuckPortRecoveryRetryAttempts,
			logger,
			refreshRovoAvailability,
			resolvedRovoPort:
				typeof getResolvedRovoPort === "function"
					? getResolvedRovoPort()
					: undefined,
			restartRovoPort,
			resolveRovoChatInProgressTimeoutRecovery,
			resolveRovoPortStuckRecovery,
			rovoCancelChat,
			rovoHealthCheck,
			rovoStreamError,
			shouldRetryInteractiveStuckPortRecovery,
			stuckPortRecoveryRetryCount,
			synthesiseDeferredToolResponseFromClarification,
			threadId,
			writer,
		});
}

module.exports = {
	createRovoStreamAttemptErrorHandler,
	handleRovoStreamAttemptError,
};
