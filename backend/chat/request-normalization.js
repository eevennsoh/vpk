"use strict";

const { resolveChatSdkThreadId } = require("../lib/chat-sdk-thread-id");
const { getNonEmptyString } = require("../lib/shared-utils");
const {
	buildCreationModeContextPrefix,
} = require("../lib/studio-agent-result");

function shouldStartPlanExecutionFromApproval(approvalSubmission) {
	return approvalSubmission?.decision === "auto-accept";
}

function resolveChatSdkRequestEnvelope({
	body = {},
	getLatestUserMessageSource,
	getLatestVisibleUserMessage,
	normalizeApprovalSubmission,
	normalizeClarificationSubmission,
	normalizeClientTimeZone,
} = {}) {
	const {
		messages,
		backendPreference: rawBackendPreference,
		contextDescription: rawContextDescription,
		clientTimeZone: rawClientTimeZone,
		userName: rawUserName,
		provider,
		model: rawModel,
		clarification: rawClarification,
		approval: rawApproval,
		deferredToolResponse: rawDeferredToolResponse,
		creationMode,
		smartGeneration: rawSmartGeneration,
		hasQueuedPrompts: rawHasQueuedPrompts,
		origin: rawOrigin,
		genuiHint: rawGenuiHint,
		resolvedPlanModeActive: rawResolvedPlanModeActive,
		chatSdkSource: rawChatSdkSource,
		threadId: rawThreadId,
		id: rawRequestId,
		sessionId: rawSessionId,
		sessionMode: rawSessionMode,
	} = body || {};
	const backendPreference =
		rawBackendPreference === "ai-gateway" || rawBackendPreference === "rovo"
			? rawBackendPreference
			: "ai-gateway";
	const clientTimeZone = normalizeClientTimeZone(rawClientTimeZone);
	const genuiHint = rawGenuiHint === true;
	const resolvedPlanModeActive = rawResolvedPlanModeActive === true;
	const chatSdkSource = getNonEmptyString(rawChatSdkSource) || "direct";
	const threadId = resolveChatSdkThreadId({
		chatSdkSource,
		threadId: rawThreadId,
		id: rawRequestId,
	});
	const sessionId =
		typeof rawSessionId === "string" && rawSessionId.trim().length > 0
			? rawSessionId.trim()
			: null;
	const sessionMode = rawSessionMode === "ephemeral" ? "ephemeral" : "persistent";
	const rovoSessionId =
		sessionId && sessionMode !== "ephemeral" ? sessionId : null;
	const requestOrigin =
		getNonEmptyString(rawOrigin)?.toLowerCase() === "voice" ? "voice" : "text";
	const hasQueuedPrompts = Boolean(rawHasQueuedPrompts);

	let contextDescription = rawContextDescription;
	if (creationMode === "skill" || creationMode === "agent") {
		const prefix = buildCreationModeContextPrefix(creationMode);
		if (prefix) {
			contextDescription = contextDescription
				? `${prefix}\n\n${contextDescription}`
				: prefix;
		}
	}

	const latestVisibleUserMessage = getLatestVisibleUserMessage(messages);
	const latestUserMessageSource = getLatestUserMessageSource(messages);
	const isPostClarificationTurn =
		latestUserMessageSource === "clarification-submit";
	const clarificationSubmission =
		normalizeClarificationSubmission(rawClarification);
	const approvalSubmission = normalizeApprovalSubmission(rawApproval);

	return {
		messages,
		provider,
		rawModel,
		rawUserName,
		rawApproval,
		rawDeferredToolResponse,
		creationMode,
		rawSmartGeneration,
		backendPreference,
		clientTimeZone,
		genuiHint,
		resolvedPlanModeActive,
		chatSdkSource,
		threadId,
		sessionId,
		sessionMode,
		rovoSessionId,
		requestOrigin,
		hasQueuedPrompts,
		contextDescription,
		latestVisibleUserMessage,
		latestUserMessageSource,
		isPostClarificationTurn,
		clarificationSubmission,
		approvalSubmission,
		stageTraceMeta: {
			path: "/api/chat-sdk",
			origin: requestOrigin,
			source: chatSdkSource,
		},
		entryTraceData: {
			messageCount: Array.isArray(messages) ? messages.length : 0,
			backendPreference,
			provider: getNonEmptyString(provider) || null,
			model: getNonEmptyString(rawModel) || null,
			hasClarification: Boolean(rawClarification),
			hasApproval: Boolean(rawApproval),
			hasDeferredToolResponse: Boolean(rawDeferredToolResponse),
			resolvedPlanModeActive,
		},
	};
}

function resolveChatSdkRequestState({
	clearActiveDeferredToolCall,
	clearPlanSession,
	envelope,
	getPlanSession,
	getToolCallIdFromApprovalSubmission,
	getToolCallIdFromClarificationSubmission,
	logger = console,
	mapUiMessagesToConversation,
	pausedRovoToolCallStore,
	shouldRestorePlanModeOnResume,
	updatePlanSession,
} = {}) {
	const rawDeferredToolResponse = envelope.rawDeferredToolResponse;
	const deferredToolResponseToolCallId =
		rawDeferredToolResponse && typeof rawDeferredToolResponse === "object"
			? getNonEmptyString(rawDeferredToolResponse.tool_call_id)
			: null;
	if (deferredToolResponseToolCallId) {
		clearActiveDeferredToolCall(deferredToolResponseToolCallId);
	}

	const clarificationToolCallId = getToolCallIdFromClarificationSubmission(
		envelope.clarificationSubmission
	);
	const approvalToolCallId = getToolCallIdFromApprovalSubmission(
		envelope.approvalSubmission,
		envelope.rawApproval
	);
	const hasPausedClarificationToolCall =
		Boolean(clarificationToolCallId) &&
		pausedRovoToolCallStore.has(clarificationToolCallId);
	const hasPausedApprovalToolCall =
		Boolean(approvalToolCallId) &&
		pausedRovoToolCallStore.has(approvalToolCallId);

	if (envelope.approvalSubmission) {
		logger.info?.("[DEBUG-PLAN-APPROVAL] Approval store lookup", {
			approvalToolCallId,
			hasPausedApprovalToolCall,
			storeSize: pausedRovoToolCallStore.size,
			storeKeys: [...pausedRovoToolCallStore.keys()],
			submissionDecision: envelope.approvalSubmission.decision,
			rawToolCallId: envelope.rawApproval?.toolCallId,
			rawDeferredToolCallId: envelope.rawApproval?.deferredToolCallId,
		});
	}

	let resolvedPlanModeActive = envelope.resolvedPlanModeActive;
	if (
		!resolvedPlanModeActive &&
		envelope.threadId &&
		(hasPausedClarificationToolCall || hasPausedApprovalToolCall)
	) {
		const restore = shouldRestorePlanModeOnResume({
			pausedToolCallRecord: {
				toolCallId: hasPausedClarificationToolCall
					? clarificationToolCallId
					: approvalToolCallId,
			},
			resolvedPlanModeActive,
			threadId: envelope.threadId,
		});
		if (restore.shouldRestore) {
			resolvedPlanModeActive = true;
			logger.info?.("[CHAT-SDK] Restored plan mode from plan session", {
				threadId: envelope.threadId,
				phase: restore.phase,
			});
		}
	}

	if (resolvedPlanModeActive && envelope.threadId) {
		const planSession = getPlanSession(envelope.threadId);
		if (!planSession.isActive) {
			updatePlanSession(envelope.threadId, { isActive: true, phase: "qa" });
		}
		if (
			envelope.approvalSubmission &&
			shouldStartPlanExecutionFromApproval(envelope.approvalSubmission) &&
			planSession.phase !== "execution"
		) {
			updatePlanSession(envelope.threadId, { phase: "execution" });
			logger.info?.("[PLAN-SESSION] Transitioned to execution phase on approval", {
				threadId: envelope.threadId,
				decision: envelope.approvalSubmission.decision,
				previousPhase: planSession.phase,
			});
		}
	} else if (
		envelope.approvalSubmission &&
		shouldStartPlanExecutionFromApproval(envelope.approvalSubmission) &&
		envelope.threadId
	) {
		const planSession = getPlanSession(envelope.threadId);
		if (planSession.isActive) {
			updatePlanSession(envelope.threadId, { phase: "execution" });
			logger.info?.(
				"[PLAN-SESSION] Transitioned to execution phase on auto-accept approval",
				{
					threadId: envelope.threadId,
					decision: envelope.approvalSubmission.decision,
					previousPhase: planSession.phase,
				}
			);
		} else {
			updatePlanSession(envelope.threadId, {
				isActive: true,
				phase: "execution",
			});
			logger.info?.(
				"[PLAN-SESSION] Created execution-phase session for auto-accept approval",
				{
					threadId: envelope.threadId,
					decision: envelope.approvalSubmission.decision,
				}
			);
		}
	} else if (
		!resolvedPlanModeActive &&
		envelope.threadId &&
		!hasPausedClarificationToolCall &&
		!hasPausedApprovalToolCall
	) {
		const planSession = getPlanSession(envelope.threadId);
		if (
			deferredToolResponseToolCallId &&
			planSession.isActive &&
			planSession.phase !== "execution"
		) {
			updatePlanSession(envelope.threadId, { phase: "execution" });
			logger.info?.(
				"[PLAN-SESSION] Transitioned to execution phase on deferred tool acceptance",
				{
					threadId: envelope.threadId,
					deferredToolCallId: deferredToolResponseToolCallId,
					previousPhase: planSession.phase,
				}
			);
		} else {
			const shouldKeepExecutionSession =
				planSession.isActive && planSession.phase === "execution";
			if (!shouldKeepExecutionSession && envelope.latestVisibleUserMessage) {
				clearPlanSession(envelope.threadId);
			}
		}
	}

	const currentPlanSession = envelope.threadId
		? getPlanSession(envelope.threadId)
		: null;
	const isPlanFeedbackDeferredResumeTurn = Boolean(
		rawDeferredToolResponse &&
			resolvedPlanModeActive &&
			deferredToolResponseToolCallId &&
			currentPlanSession?.isActive &&
			currentPlanSession.phase === "plan" &&
			currentPlanSession.deferredToolCallId === deferredToolResponseToolCallId
	);
	const {
		message: latestUserMessage,
		conversationHistory,
	} = mapUiMessagesToConversation(envelope.messages);
	const latestVisiblePromptText =
		getNonEmptyString(envelope.latestVisibleUserMessage?.text) ||
		latestUserMessage;

	return {
		...envelope,
		resolvedPlanModeActive,
		deferredToolResponseToolCallId,
		clarificationToolCallId,
		approvalToolCallId,
		hasPausedClarificationToolCall,
		hasPausedApprovalToolCall,
		currentPlanSession,
		isPlanFeedbackDeferredResumeTurn,
		latestUserMessage,
		conversationHistory,
		latestVisiblePromptText,
		missingUserMessageResponse: latestUserMessage
			? null
			: { status: 400, body: { error: "A user message is required" } },
	};
}

module.exports = {
	resolveChatSdkRequestEnvelope,
	resolveChatSdkRequestState,
};
