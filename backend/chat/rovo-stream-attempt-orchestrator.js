"use strict";

const {
	runFreshRovoStreamTurn,
} = require("./rovo-fresh-stream-turn");
const {
	abandonPausedRovoToolCall,
	runPausedRovoToolContinuation,
} = require("./rovo-paused-continuation");
const {
	createRovoPlanFeedbackToolGuard,
} = require("./rovo-plan-feedback-tool-events");
const {
	createRovoStreamLifecycleHandlers,
} = require("./rovo-stream-lifecycle-events");
const {
	createRovoStreamToolCallbacks,
} = require("./rovo-stream-tool-callbacks");
const {
	handleRovoThinkingEvent,
	handleRovoThinkingStatus,
} = require("./rovo-thinking-events");
const {
	handleRovoToolCallInputResolvedEvent,
	handleRovoToolCallStartEvent,
} = require("./rovo-tool-call-events");

function resolvePausedRovoToolCallRecord({
	currentToolFirstAttempt = 1,
	logger = console,
	now = Date.now,
	pausedContinuationToolCallId,
	takePausedRovoToolCall = () => null,
} = {}) {
	const pausedToolCallRecord =
		pausedContinuationToolCallId && currentToolFirstAttempt === 1
			? takePausedRovoToolCall(pausedContinuationToolCallId)
			: null;
	if (pausedContinuationToolCallId) {
		logger.info("[DEBUG-PLAN-APPROVAL] Paused tool call record", {
			pausedContinuationToolCallId,
			recordFound: Boolean(pausedToolCallRecord),
			recordKind: pausedToolCallRecord?.kind,
			recordPort: pausedToolCallRecord?.port,
			recordCreatedAt: pausedToolCallRecord?.createdAt,
			recordExpiresAt: pausedToolCallRecord?.expiresAt,
			ageMs: pausedToolCallRecord?.createdAt
				? now() - pausedToolCallRecord.createdAt
				: null,
		});
	}

	return pausedToolCallRecord;
}

function buildRovoStreamCommonOptions({
	abortController,
	activeRequests,
	bashQuestionCardWorkaroundCallIds,
	browserToolEventRouter,
	classifyCommand,
	createRovoPlanFeedbackToolGuardFn = createRovoPlanFeedbackToolGuard,
	createRovoStreamLifecycleHandlersFn = createRovoStreamLifecycleHandlers,
	createRovoStreamToolCallbacksFn = createRovoStreamToolCallbacks,
	detectSecrets,
	emitExitPlanWidget,
	emitRequestUserInputQuestionCard,
	emitRequestUserInputQuestionCardFromResult,
	extractCommandFromArgs,
	getHasBlockedPlanFeedbackExecutionTool,
	getPlanFeedbackToolGuard,
	getResolvedRovoPort,
	handleReplayDeferredToolRequest,
	handleRovoThinkingEventFn = handleRovoThinkingEvent,
	handleRovoThinkingStatusFn = handleRovoThinkingStatus,
	handleRovoToolCallInputResolvedEventFn =
		handleRovoToolCallInputResolvedEvent,
	handleRovoToolCallStartEventFn = handleRovoToolCallStartEvent,
	isBashQuestionCardWorkaround,
	isExitPlanModeTool,
	isPlanFeedbackDeferredResumeTurn = false,
	isRequestUserInputTool,
	isStrictToolFirstTurn = false,
	isToolNameRelevant,
	logger = console,
	normalizeRovoThinkingEvent,
	normalizeRovoThinkingStatus,
	onBlockedPlanFeedbackExecutionTool,
	onEmittedThinkingStatus,
	onObservedActionableToolCall,
	onObservedDeferredToolRequest,
	onObservedRelevantActionableToolCall,
	onObservedToolExecution,
	onPausedToolCallHandled,
	onResolvedRovoPort,
	onTextDelta,
	recordToolObservation,
	recordToolThinkingEvent,
	redactSecrets,
	registerActiveDeferredToolCall,
	registerPausedToolCall,
	resumedToolCallId,
	rovoCancelChat,
	rovoSessionId,
	sessionMode,
	shouldSuppressToolFirstIntentStatus,
	stageTrace,
	syncRovoAppThreadSessionFromCurrentPort,
	threadId,
	toPreview,
	toolFirstExecutionState,
	toolFirstFullOutputs,
	toolFirstPolicy,
	toolFirstRelevanceDomains,
	waitForTurnTimeoutMs,
	writer,
} = {}) {
	const maybeGuardPlanFeedbackTool = createRovoPlanFeedbackToolGuardFn({
		abortController,
		getHasBlockedPlanFeedbackExecutionTool,
		getPlanFeedbackToolGuard,
		getResolvedRovoPort,
		isExitPlanModeTool,
		isPlanFeedbackDeferredResumeTurn,
		isRequestUserInputTool,
		logger,
		onBlockedPlanFeedbackExecutionTool,
		resumedToolCallId,
		rovoCancelChat,
		threadId,
	});

	const streamLifecycleHandlers = createRovoStreamLifecycleHandlersFn({
		abortController,
		activeRequests,
		logger,
		onResolvedRovoPort,
		sessionMode,
		stageTrace,
		syncRovoAppThreadSessionFromCurrentPort,
		threadId,
	});

	const streamToolCallbacks = createRovoStreamToolCallbacksFn({
		browserToolEventRouter,
		detectSecrets,
		emitExitPlanWidget,
		emitRequestUserInputQuestionCard,
		emitRequestUserInputQuestionCardFromResult,
		getResolvedRovoPort,
		handleReplayDeferredToolRequest,
		isBashQuestionCardWorkaround,
		isExitPlanModeTool,
		isRequestUserInputTool,
		isToolNameRelevant,
		logger,
		maybeGuardPlanFeedbackTool,
		onObservedDeferredToolRequest,
		onPausedToolCallHandled,
		recordToolObservation,
		redactSecrets,
		registerActiveDeferredToolCall,
		registerPausedToolCall,
		sessionId: rovoSessionId,
		sessionMode,
		syncThreadSessionFromCurrentPort:
			syncRovoAppThreadSessionFromCurrentPort,
		threadId,
		toPreview,
		toolFirstFullOutputs,
		toolFirstPolicy,
		toolFirstRelevanceDomains,
	});

	return {
		onTextDelta,
		// Output routing tracks every Rovo tool call while preserving the
		// existing question-card and two-step GenUI side effects.
		onToolCallStart: (toolCall) => {
			handleRovoToolCallStartEventFn(toolCall, {
				bashQuestionCardWorkaroundCallIds,
				browserToolEventRouter,
				emitExitPlanWidget,
				emitRequestUserInputQuestionCard,
				isBashQuestionCardWorkaround,
				isExitPlanModeTool,
				isRequestUserInputTool,
				isToolNameRelevant,
				maybeGuardPlanFeedbackTool,
				onObservedActionableToolCall,
				onObservedDeferredToolRequest,
				onObservedRelevantActionableToolCall,
				toolFirstRelevanceDomains,
			});
		},
		onToolCallInputResolved: (toolCall) => {
			handleRovoToolCallInputResolvedEventFn(toolCall, {
				bashQuestionCardWorkaroundCallIds,
				browserToolEventRouter,
				classifyCommand,
				emitRequestUserInputQuestionCard,
				extractCommandFromArgs,
				isBashQuestionCardWorkaround,
				isRequestUserInputTool,
				logger,
			});
		},
		...streamToolCallbacks,
		enableDeferredTools: true,
		idleTimeoutMs: waitForTurnTimeoutMs,
		includeSubagentEvents: true,
		pauseOnCallToolsStart: true,
		signal: abortController?.signal,
		conflictPolicy: "wait-for-turn",
		...streamLifecycleHandlers,
		onThinkingStatus: (statusUpdate) => {
			handleRovoThinkingStatusFn(statusUpdate, {
				isStrictToolFirstTurn,
				normalizeRovoThinkingStatus,
				onEmittedThinkingStatus,
				shouldSuppressToolFirstIntentStatus,
				toolFirstExecutionState,
				writer,
			});
		},
		onThinkingEvent: (thinkingEvent) => {
			handleRovoThinkingEventFn(thinkingEvent, {
				bashQuestionCardWorkaroundCallIds,
				normalizeRovoThinkingEvent,
				onObservedToolExecution,
				recordToolObservation,
				recordToolThinkingEvent,
				toPreview,
				toolFirstExecutionState,
				writer,
			});
		},
	};
}

function createRovoStreamAttemptRunner({
	runFreshRovoStreamTurnFn = runFreshRovoStreamTurn,
	runPausedRovoToolContinuationFn = runPausedRovoToolContinuation,
	...options
} = {}) {
	return async function runRovoStreamAttempt({
		activeAttemptMessage,
		currentToolFirstAttempt,
	} = {}) {
		const pausedToolCallRecord = resolvePausedRovoToolCallRecord({
			currentToolFirstAttempt,
			logger: options.logger,
			now: options.now,
			pausedContinuationToolCallId: options.pausedContinuationToolCallId,
			takePausedRovoToolCall: options.takePausedRovoToolCall,
		});

		let streamCommonOptions;
		try {
			streamCommonOptions = buildRovoStreamCommonOptions(options);
		} catch (error) {
			// A paused record taken above would otherwise keep its port reserved for good.
			if (pausedToolCallRecord) {
				await abandonPausedRovoToolCall(pausedToolCallRecord, { rovoCancelChat: options.rovoCancelChat });
			}
			throw error;
		}

		if (pausedToolCallRecord) {
			await runPausedRovoToolContinuationFn({
				adaptClarificationAnswersForToolContract:
					options.adaptClarificationAnswersForToolContract,
				approvalSubmission: options.approvalSubmission,
				buildApprovalResumeDecision: options.buildApprovalResumeDecision,
				buildClarificationResumeDecision:
					options.buildClarificationResumeDecision,
				buildClarificationResumeDenyMessage:
					options.buildClarificationResumeDenyMessage,
				clarificationSubmission: options.clarificationSubmission,
				getPausedToolCallHandled: options.getPausedToolCallHandled,
				hasPausedApprovalToolCall: options.hasPausedApprovalToolCall,
				hasPausedClarificationToolCall:
					options.hasPausedClarificationToolCall,
				logger: options.logger,
				pausedToolCallRecord,
				replayViaRovo: options.replayViaRovo,
				rovoCancelChat: options.rovoCancelChat,
				rovoResumeToolCalls: options.rovoResumeToolCalls,
				runId: options.runId ?? options.stageTrace?.requestId,
				streamCommonOptions,
				threadId: options.threadId,
			});
			return;
		}

		await runFreshRovoStreamTurnFn({
			activeAttemptMessage,
			approvalSubmission: options.approvalSubmission,
			approvalToolCallId: options.approvalToolCallId,
			rovoCancelChat: options.rovoCancelChat,
			rovoResumeToolCalls: options.rovoResumeToolCalls,
			rovoSessionId: options.rovoSessionId,
			streamCommonOptions,
			streamViaRovo: options.streamViaRovo,
		});
	};
}

module.exports = {
	buildRovoStreamCommonOptions,
	createRovoStreamAttemptRunner,
	resolvePausedRovoToolCallRecord,
};
