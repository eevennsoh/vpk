"use strict";

function buildPausedRovoResumeDecisions({
	adaptClarificationAnswersForToolContract,
	approvalSubmission,
	buildApprovalResumeDecision,
	buildClarificationResumeDecision,
	buildClarificationResumeDenyMessage,
	clarificationSubmission,
	hasPausedApprovalToolCall = false,
	hasPausedClarificationToolCall = false,
	pausedToolCallRecord,
} = {}) {
	if (hasPausedClarificationToolCall && clarificationSubmission) {
		return [
			buildClarificationResumeDecision({
				clarificationSubmission,
				clarificationToolCallId: pausedToolCallRecord.toolCallId,
				setChatAccepted: false,
				buildDenyMessageFn: (submission) =>
					buildClarificationResumeDenyMessage(
						submission,
						adaptClarificationAnswersForToolContract,
					),
			}),
		].filter(Boolean);
	}

	if (hasPausedApprovalToolCall && approvalSubmission) {
		return [
			{
				tool_call_id: pausedToolCallRecord.toolCallId,
				deny_message: buildApprovalResumeDecision(approvalSubmission),
			},
		];
	}

	return [];
}

/**
 * Ends a paused tool call that will not be resumed: cancels its turn on Rovo and ends its
 * port lease (released after a cancel that worked, quarantined otherwise).
 */
async function abandonPausedRovoToolCall(pausedToolCallRecord, { rovoCancelChat } = {}) {
	let cancelled = false;
	try {
		await rovoCancelChat?.(pausedToolCallRecord?.port, { timeoutMs: 3_000 });
		cancelled = typeof rovoCancelChat === "function";
	} catch {}
	pausedToolCallRecord?.handle?.settleLease?.(
		cancelled ? "release" : "unhealthy",
		cancelled ? {} : { reason: "paused tool call abandoned" },
	);
}

async function runPausedRovoToolContinuation({
	adaptClarificationAnswersForToolContract,
	approvalSubmission,
	buildApprovalResumeDecision,
	buildClarificationResumeDecision,
	buildClarificationResumeDenyMessage,
	clarificationSubmission,
	getPausedToolCallHandled = () => false,
	hasPausedApprovalToolCall = false,
	hasPausedClarificationToolCall = false,
	logger = console,
	pausedToolCallRecord,
	replayViaRovo,
	rovoCancelChat,
	rovoResumeToolCalls,
	runId,
	streamCommonOptions = {},
	threadId,
} = {}) {
	let resumeDecisions;
	try {
		resumeDecisions = buildPausedRovoResumeDecisions({
			adaptClarificationAnswersForToolContract,
			approvalSubmission,
			buildApprovalResumeDecision,
			buildClarificationResumeDecision,
			buildClarificationResumeDenyMessage,
			clarificationSubmission,
			hasPausedApprovalToolCall,
			hasPausedClarificationToolCall,
			pausedToolCallRecord,
		});
		if (resumeDecisions.length === 0) {
			throw new Error(
				`Paused tool continuation ${pausedToolCallRecord.toolCallId} is missing a resume decision.`,
			);
		}
	} catch (error) {
		// The record was already taken from the store, so no one else can resume this
		// paused turn: cancel it and end its lease.
		await abandonPausedRovoToolCall(pausedToolCallRecord, { rovoCancelChat });
		throw error;
	}

	let replayCompleted = false;
	try {
		logger.info("[CHAT-SDK] Resuming paused tool continuation", {
			threadId,
			runId,
			toolCallId: pausedToolCallRecord.toolCallId,
			kind: pausedToolCallRecord.kind,
			port: pausedToolCallRecord.port,
		});
		await rovoResumeToolCalls(pausedToolCallRecord.port, {
			decisions: resumeDecisions,
		});
		logger.info("[DEBUG-PLAN-APPROVAL] Resume tool calls sent successfully", {
			port: pausedToolCallRecord.port,
			toolCallId: pausedToolCallRecord.toolCallId,
			kind: pausedToolCallRecord.kind,
			resumeDecisionCount: resumeDecisions.length,
		});

		await Promise.race([
			replayViaRovo({
				port: pausedToolCallRecord.port,
				portHandle: pausedToolCallRecord.handle,
				onTextDelta: streamCommonOptions.onTextDelta,
				onThinkingStatus: streamCommonOptions.onThinkingStatus,
				onThinkingEvent: streamCommonOptions.onThinkingEvent,
				onToolCallStart: streamCommonOptions.onToolCallStart,
				onToolCallInputResolved: streamCommonOptions.onToolCallInputResolved,
				onToolCallResult: streamCommonOptions.onToolCallResult,
				onWarning: streamCommonOptions.onWarning,
				onDeferredToolRequest: streamCommonOptions.onDeferredToolRequest,
				signal: streamCommonOptions.signal,
				onTimingStage: streamCommonOptions.onTimingStage,
				skipReplayUntilToolCallId: pausedToolCallRecord.toolCallId,
				onPausedToolCalls: streamCommonOptions.onPausedToolCalls,
			}),
		]);
		logger.info("[CHAT-SDK] Paused tool continuation replay completed", {
			threadId,
			runId,
			toolCallId: pausedToolCallRecord.toolCallId,
			kind: pausedToolCallRecord.kind,
			port: pausedToolCallRecord.port,
		});
		replayCompleted = true;
	} finally {
		if (!getPausedToolCallHandled()) {
			if (!replayCompleted) {
				await rovoCancelChat(pausedToolCallRecord.port, {
					timeoutMs: 3_000,
				}).catch(() => {});
			}
			pausedToolCallRecord.handle?.settleLease?.("release");
		}
	}
}

module.exports = {
	abandonPausedRovoToolCall,
	buildPausedRovoResumeDecisions,
	runPausedRovoToolContinuation,
};
