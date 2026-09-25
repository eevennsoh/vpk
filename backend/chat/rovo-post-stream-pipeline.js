"use strict";

const {
	runRovoPostStreamFinalizers: defaultRunRovoPostStreamFinalizers,
} = require("./rovo-post-stream-finalizers");
const {
	runRovoPostStreamRouting: defaultRunRovoPostStreamRouting,
} = require("./rovo-post-stream-routing-orchestrator");
const {
	runRovoPostTurnCompletion: defaultRunRovoPostTurnCompletion,
} = require("./rovo-post-turn-completion-orchestrator");

async function runRovoPostStreamPipeline({
	flushRovoMarkerStream,
	onHasEmittedGenuiWidget,
	onShouldEmitMissingStudioAgentResultFailure,
	runRovoPostStreamFinalizers = defaultRunRovoPostStreamFinalizers,
	runRovoPostStreamRouting = defaultRunRovoPostStreamRouting,
	runRovoPostTurnCompletion = defaultRunRovoPostTurnCompletion,
	...options
} = {}) {
	flushRovoMarkerStream?.();

	const postStreamFinalizerResult = await runRovoPostStreamFinalizers({
		abortSignal: options.abortSignal,
		assistantText: options.getAssistantText(),
		buildDirectSpecWidgetParts: options.buildDirectSpecWidgetParts,
		buildSmartGenerationGatewayOptions:
			options.buildSmartGenerationGatewayOptions,
		creationMode: options.creationMode,
		detectEndpointType: options.detectEndpointType,
		emitPlanWidgetLoading: options.emitPlanWidgetLoading,
		emitTextDeltaRaw: options.emitTextDeltaRaw,
		emitWidgetError: options.emitWidgetError,
		extractDirectSpec: options.extractDirectSpec,
		extractStudioAgentResultFromText:
			options.extractStudioAgentResultFromText,
		finalizeBufferedAssistantText: options.finalizeBufferedAssistantText,
		finalizeRovoClassifierLeakRepair:
			options.finalizeRovoClassifierLeakRepair,
		finalizeRovoDirectOutputs: options.finalizeRovoDirectOutputs,
		finalizeRovoPlanWidgetPostStream:
			options.finalizeRovoPlanWidgetPostStream,
		finalizeRovoStudioAgentResult:
			options.finalizeRovoStudioAgentResult,
		generateTextViaGateway: options.generateTextViaGateway,
		genuiHint: options.genuiHint,
		getAssistantText: options.getAssistantText,
		getEnvVars: options.getEnvVars,
		getHasEmittedAgentResult: options.getHasEmittedAgentResult,
		getHasSuppressedLargeAssistantJson:
			options.getHasSuppressedLargeAssistantJson,
		getUnsuppressedAssistantText: options.getUnsuppressedAssistantText,
		handleDirectRovoMediaFences: options.handleDirectRovoMediaFences,
		hasDeferredToolRequest: options.hasObservedDeferredToolRequest,
		hasEmittedGenuiWidget: options.hasEmittedGenuiWidget,
		hasEmittedPlanLoadingState: options.hasEmittedPlanLoadingState,
		hasEmittedPlanWidget: options.hasEmittedPlanWidget,
		hasEmittedQuestionCard: options.hasEmittedQuestionCard,
		hasExplicitPlanPayload: options.hasExplicitPlanPayload,
		hasSeenPlanWidgetSignal: options.hasSeenPlanWidgetSignal,
		isPlanExecutionActive: options.isPlanExecutionPhase(options.threadId),
		latestUserMessage: options.latestUserMessage,
		logger: options.logger,
		parseClassifierIntentPayload: options.parseClassifierIntentPayload,
		provider: options.provider,
		rawAgentCreationAssistantText:
			options.getRawAgentCreationAssistantText(),
		rawModel: options.rawModel,
		requestOrigin: options.requestOrigin,
		resolveGatewayUrl: options.resolveGatewayUrl,
		resolveGoogleImageGatewayConfig:
			options.resolveGoogleImageGatewayConfig,
		setAssistantText: options.setAssistantText,
		shouldSurfaceMissingStudioAgentResultFailure:
			options.shouldSurfaceMissingStudioAgentResultFailure,
		streamGoogleGatewayManualSse: options.streamGoogleGatewayManualSse,
		stripDirectMediaFences: options.stripDirectMediaFences,
		synthesizeSound: options.synthesizeSound,
		unsuppressedAssistantText: options.getUnsuppressedAssistantText(),
		userMessageText: options.userMessageText,
		widgetPayloadWrapper: options.widgetPayloadWrapper,
		widgetTypeAudio: options.widgetTypeAudio,
		widgetTypeGenui: options.widgetTypeGenui,
		widgetTypeImage: options.widgetTypeImage,
		writer: options.writer,
		writeTextEndIfStarted: options.writeTextEndIfStarted,
	});
	if (postStreamFinalizerResult.aborted) {
		return {
			aborted: true,
			postStreamFinalizerResult,
		};
	}

	onHasEmittedGenuiWidget?.(
		postStreamFinalizerResult.hasEmittedGenuiWidget,
	);
	onShouldEmitMissingStudioAgentResultFailure?.(
		postStreamFinalizerResult
			.shouldEmitMissingStudioAgentResultFailure,
	);

	const postStreamRoutingResult = await runRovoPostStreamRouting({
		abortSignal: options.abortSignal,
		browserBridge: options.browserBridge,
		buildToolContextForGenui: options.buildToolContextForGenui,
		buildToolFirstTextFallback: options.buildToolFirstTextFallback,
		buildWorkSummaryExecutionLog: options.buildWorkSummaryExecutionLog,
		buildZeroToolCallRecoverySpec: options.buildZeroToolCallRecoverySpec,
		createRouteDecisionPart: options.createRouteDecisionPart,
		createRovoRouteWidgetPayloadDecorator:
			options.createRovoRouteWidgetPayloadDecorator,
		dispatchBespokeGenuiHandler: options.dispatchBespokeGenuiHandler,
		emitAutomaticGenuiFailure: options.emitAutomaticGenuiFailure,
		emitBufferedAssistantTextForTextRoute:
			options.emitBufferedAssistantTextForTextRoute,
		emitCreateIntentDirectGenuiWidget:
			options.emitCreateIntentDirectGenuiWidget,
		emitForcedTextDelta: options.emitForcedTextDelta,
		emitPostToolGenuiWidget: options.emitPostToolGenuiWidget,
		emitRovoToolFirstRouteSummary:
			options.emitRovoToolFirstRouteSummary,
		emitToolFirstRelevantGenuiWidget:
			options.emitToolFirstRelevantGenuiWidget,
		emitWorkSummaryZeroToolRecoveryWidget:
			options.emitWorkSummaryZeroToolRecoveryWidget,
		generateSmartGenuiResult: options.generateSmartGenuiResult,
		getAssistantText: options.getAssistantText,
		getHasSuppressedLargeAssistantJson:
			options.getHasSuppressedLargeAssistantJson,
		getNonEmptyString: options.getNonEmptyString,
		getReadonlyBlockedWriteToolNames:
			options.getReadonlyBlockedWriteToolNames,
		getUnsuppressedAssistantText: options.getUnsuppressedAssistantText,
		hasEmittedGenuiWidget:
			postStreamFinalizerResult.hasEmittedGenuiWidget,
		hasEmittedPlanWidget: options.hasEmittedPlanWidget,
		hasEmittedQuestionCard: options.hasEmittedQuestionCard,
		hasObservedActionableToolCall: options.hasObservedActionableToolCall,
		hasObservedRelevantActionableToolCall:
			options.hasObservedRelevantActionableToolCall,
		hasRelevantToolObservation: options.hasRelevantToolObservation,
		hasRelevantToolSuccess: () =>
			options.hasRelevantToolSuccess(options.toolFirstExecutionState),
		hasToolObservationEntries: options.hasToolObservationEntries,
		isCreateIntentRequestPrompt: options.isCreateIntentRequestPrompt,
		isPlainObject: options.isPlainObject,
		isPlanExecutionPhase: options.isPlanExecutionPhase,
		isStrictToolFirstTurn: options.isStrictToolFirstTurn,
		isTaskLikeRequest: options.isTaskLikeRequest,
		isToolNameRelevant: options.isToolNameRelevant,
		isWorkSummary: options.isWorkSummary,
		latestPromptText: options.latestPromptText,
		latestUserMessage: options.latestUserMessage,
		layoutContext: options.layoutContext,
		logger: options.logger,
		looksLikeClarificationResponse:
			options.looksLikeClarificationResponse,
		looksLikeInabilityResponse: options.looksLikeInabilityResponse,
		looksLikeWriteBlockedTurn: options.looksLikeWriteBlockedTurn,
		mapUiMessagesToRoleContent: options.mapUiMessagesToRoleContent,
		messages: options.messages,
		removeToolFirstFailureNarrative:
			options.removeToolFirstFailureNarrative,
		requestOrigin: options.requestOrigin,
		resolveAutomaticGenuiOutcome: options.resolveAutomaticGenuiOutcome,
		resolveRovoNonStrictPostStreamRouting:
			options.resolveRovoNonStrictPostStreamRouting,
		resolvedPlanModeActive: options.resolvedPlanModeActive,
		resolvedRovoPort: options.resolvedRovoPort,
		resolveRovoRouteToolsDetected:
			options.resolveRovoRouteToolsDetected,
		resolveToolFirstWidgetContentType:
			options.resolveToolFirstWidgetContentType,
		resolveToolFirstWidgetSource:
			options.resolveToolFirstWidgetSource,
		shouldAttemptPostToolGenui: options.shouldAttemptPostToolGenui,
		shouldForceCardFirstGenui: options.shouldForceCardFirstGenui,
		threadId: options.threadId,
		toolFirstExecutionState: options.toolFirstExecutionState,
		toolFirstFullOutputs: options.toolFirstFullOutputs,
		toolFirstPolicy: options.toolFirstPolicy,
		toolFirstRelevanceDomains: options.toolFirstRelevanceDomains,
		toolObservationEntries: options.toolObservationEntries,
		widgetPayloadWrapper: options.widgetPayloadWrapper,
		widgetType: options.widgetType,
		workSummaryStartMs: options.workSummaryStartMs,
		writePostToolGenuiLoading: options.writePostToolGenuiLoading,
		writer: options.writer,
	});

	await runRovoPostTurnCompletion({
		activeRequests: options.activeRequests,
		buildArtifactPreviewSummary: options.buildArtifactPreviewSummary,
		buildMissingStudioAgentResultFailureParts:
			options.buildMissingStudioAgentResultFailureParts,
		buildPostTurnWorkCompleteTraceData:
			options.buildPostTurnWorkCompleteTraceData,
		buildRovoTurnRoutingTelemetry:
			options.buildRovoTurnRoutingTelemetry,
		buildTurnCompletePart: options.buildTurnCompletePart,
		clearPlanSession: options.clearPlanSession,
		createRouteDecisionPart: options.createRouteDecisionPart,
		derivePlanExecutionArtifactTitle:
			options.derivePlanExecutionArtifactTitle,
		emitRovoMissingStudioAgentResultFailure:
			options.emitRovoMissingStudioAgentResultFailure,
		finalizePlanExecutionArtifactPostStream:
			options.finalizePlanExecutionArtifactPostStream,
		flushDeferredToolFirstText: options.flushDeferredToolFirstText,
		generatePlanMetadataViaGateway:
			options.generatePlanMetadataViaGateway,
		getAssistantText: options.getAssistantText,
		getLatestPlanWidgetMetadata:
			options.getLatestPlanWidgetMetadata,
		hasEmittedPlanWidget: options.hasEmittedPlanWidget,
		hasEmittedQuestionCard: options.hasEmittedQuestionCard,
		hasObservedActionableToolCall: options.hasObservedActionableToolCall,
		hasObservedToolExecution: options.hasObservedToolExecution,
		hasQueuedPrompts: options.hasQueuedPrompts,
		isPlanExecutionPhase: options.isPlanExecutionPhase,
		isPostClarificationTurn: options.isPostClarificationTurn,
		isStrictToolFirstTurn: options.isStrictToolFirstTurn,
		logger: options.logger,
		postStreamRoutingResult,
		requestOrigin: options.requestOrigin,
		requestUserInputQuestionCardEmitter:
			options.requestUserInputQuestionCardEmitter,
		resolvePlanExecutionCompletionFn:
			options.resolvePlanExecutionCompletionFn,
		resolvedRovoPort: options.resolvedRovoPort,
		rovoAppDocumentManager: options.rovoAppDocumentManager,
		rovoAppThreadManager: options.rovoAppThreadManager,
		sessionMode: options.sessionMode,
		shouldEmitMissingStudioAgentResultFailure:
			postStreamFinalizerResult
				.shouldEmitMissingStudioAgentResultFailure,
		stageTrace: options.stageTrace,
		syncRovoAppThreadSessionFromCurrentPort:
			options.syncRovoAppThreadSessionFromCurrentPort,
		threadId: options.threadId,
		toolObservationEntries: options.toolObservationEntries,
		writeTextEndIfStarted: options.writeTextEndIfStarted,
		writer: options.writer,
	});

	return {
		aborted: false,
		postStreamFinalizerResult,
		postStreamRoutingResult,
	};
}

module.exports = {
	runRovoPostStreamPipeline,
};
