"use strict";

const { getAiSdk } = require("../lib/ai-sdk-runtime");
const {
	WORK_ITEM_REPORT_REQUEST_START,
	buildWorkItemReportRequestContext,
	resolveWorkItemReportRequest,
} = require("../../lib/work-item-report-intent");
const { classifyCommand, extractCommandFromArgs } = require("../lib/command-approval");
const { redactSecrets, detectSecrets } = require("../lib/secret-redaction");
const {
	pipeWebResponseToExpressResponse,
} = require("../lib/in-process-http");
const {
	getLatestUserMessageSource,
	getLatestVisibleUserMessage,
} = require("../lib/rovo-app-message-helpers");
const { isLocalModelRequest, streamLocalModel } = require("../lib/local-model-provider");
const { buildFallbackGenuiSpecFromText } = require("../lib/genui-fallback-spec");
const { extractDirectSpec } = require("../lib/genui-spec-utils");
const { shouldAttemptPostToolGenui } = require("../lib/genui-post-tool-eligibility");
const { buildDirectSpecWidgetParts } = require("../lib/direct-spec-widget-parts");
const { withCanonicalPreviewBody } = require("../lib/widget-preview-payload");
const { resolveAutomaticGenuiOutcome } = require("../lib/automatic-genui-outcome");
const { dispatchBespokeGenuiHandler } = require("../lib/bespoke-genui-handler-dispatch");
const {
	buildExcalidrawWidgetPayload,
	buildExcalidrawWidgetSystemPrompt,
	deriveExcalidrawTitle,
	isExcalidrawDiagramRequest,
	normalizeExcalidrawArtifactOutput,
} = require("../lib/excalidraw-artifact");
const { looksLikeInabilityResponse } = require("../lib/inability-response-detector");
const {
	getPlanSession,
	updatePlanSession,
	recordPlanWidgetEmission,
	clearPlanSession,
	shouldRestorePlanModeOnResume,
	isPlanExecutionPhase,
} = require("../lib/plan-session");
const {
	getPlanFeedbackToolGuard,
} = require("../lib/plan-feedback-tool-guard");
const {
	createRouteDecisionPart,
} = require("../lib/route-decision");
const {
	buildMissingStudioAgentResultFailureParts,
	extractStudioAgentResultFromText,
	findOriginalAgentBrief,
	shouldBoundStudioAgentGatewayCall,
	shouldSurfaceMissingStudioAgentResultFailure,
} = require("../lib/studio-agent-result");
const {
	buildStudioAgentCreationTrace,
} = require("../lib/studio-agent-trace");
const {
	handleStudioAutomationDiscoveryChatTurn,
} = require("../lib/studio-automation-discovery-chat");
const {
	writeThinkingTraceSteps: writeGenericThinkingTraceSteps,
} = require("../lib/thinking-trace-writer");
const {
	buildSmartGenerationGatewayOptions,
} = require("../lib/smart-generation-gateway-options");
const {
	SMART_ROUTE_TARGET_SURFACES,
} = require("../lib/smart-generation-surface-gate");
const {
	isSmartGenerationEnabled,
	mapUiMessagesToRoleContent,
	normalizeSmartGenerationOptions,
} = require("../lib/smart-generation-options");
const {
	resolveToolFirstPolicy,
	TOOL_FIRST_ENFORCEMENT_MODE_SOFT_RETRY,
	createToolFirstExecutionState,
	recordToolFirstAttempt,
	recordToolThinkingEvent,
	isToolNameRelevant,
	hasRelevantToolSuccess,
	hasRelevantToolObservation,
	isWorkSummaryTurn,
	buildToolContextForGenui,
	buildToolFirstTextFallback,
	shouldSuppressToolFirstIntentStatus,
	stripToolFirstFailureNarrative,
	buildZeroToolCallRecoverySpec,
	buildWorkSummaryExecutionLog,
} = require("../lib/tool-first-genui-policy");
const {
	resolveToolFirstWidgetContentType,
	resolveToolFirstWidgetSource,
} = require("../lib/tool-first-widget-content-type");
const { resolveToolFirstRoutingFlags } = require("../lib/tool-first-routing-flags");
const {
	resolveGoogleImageGatewayConfig,
	toImageWidgetErrorMessage,
	isUnsupportedModalitiesError,
} = require("../lib/image-generation-routing");
const {
	splitDirectMediaTextForStreaming,
	stripDirectMediaFences,
} = require("../lib/direct-media-fence");
const {
	buildClarificationResumeDecision,
	buildClarificationResumeDenyMessage,
	synthesiseDeferredToolResponseFromClarification,
	shouldRejectExpiredDeferredClarification,
} = require("../lib/deferred-clarification");
const {
	handleReplayDeferredToolRequest,
} = require("../lib/replay-deferred-tool");
const {
	buildInteractiveStuckPortFailureMessage,
	shouldRetryInteractiveStuckPortRecovery,
} = require("../lib/interactive-chat-port-recovery");
const {
	derivePlanExecutionArtifactTitle,
	getLatestPlanWidgetMetadata,
} = require("../lib/plan-metadata");
const {
	restartRovoPort,
} = require("../lib/rovo-port-recovery");
const {
	getEnvVars,
	detectEndpointType,
	resolveGatewayUrl,
	streamGoogleGatewayManualSse,
} = require("../lib/ai-gateway-helpers");
const { synthesizeSound } = require("../lib/sound-generation");
const {
	resolveSmartAudioVoiceInput,
	stripConversationalFiller,
} = require("../lib/smart-audio-routing");
const {
	isAudioContextClarificationSession,
	resolveAudioContextVoiceInputFromClarification,
} = require("../lib/audio-context-resolution");
const {
	isImageContextClarificationSession,
	resolveImageContextFromClarification,
} = require("../lib/image-context-resolution");
const {
	resolveSmartImagePrompt,
	buildEnrichedImagePrompt,
} = require("../lib/smart-image-routing");
const {
	isBrowserToolCall,
	createThreadBrowserBridge,
} = require("../lib/rovo-app-browser-tools");
const {
	classifyPromptIntent,
	inferPromptIntent,
} = require("../lib/prompt-intent");
const {
	looksLikeClarificationResponse,
	MAX_LABEL_LENGTH: CLARIFICATION_MAX_LABEL_LENGTH,
} = require("../lib/question-card-extractor");
const {
	sanitizeQuestionCardPayload,
	buildQuestionCardPayloadFromRequestUserInput,
} = require("../lib/question-card-payload");
const {
	buildQuestionMetaFromQuestionCardPayload,
} = require("../lib/ai-gateway-deferred-tools");
const {
	shouldGateToolFirstQuestionCard,
	buildToolFirstClarificationInstruction,
} = require("../lib/tool-first-question-gate");
const {
	toPreview,
	splitSpecFenceTextForStreaming,
} = require("../lib/tool-output-sanitizer");
const {
	getNonEmptyString,
	isPlainObject,
	parseMaybeJson,
} = require("../lib/shared-utils");
const {
	STAGE_TRACE_ID_HEADER,
} = require("../lib/stage-trace");
const {
	createChatSdkHandler,
} = require("./chat-sdk-handler");
const {
	handleTranslationTurn,
} = require("./translation-turn");
const {
	handleDirectRovoMediaFences,
	streamAudioWidgetGeneration,
	streamImageWidgetGeneration,
	streamSmartRouteAudioWidgetGeneration,
	streamSmartRouteImageWidgetGeneration,
} = require("./media-generation-stream");
const {
	appendToolObservationEntry,
} = require("./tool-observation-context");
const {
	emitAutomaticGenuiFailure,
	emitCreateIntentDirectGenuiWidget,
	emitPostToolGenuiWidget,
	writePostToolGenuiLoading,
} = require("./post-tool-genui-finalization");
const {
	emitToolFirstRelevantGenuiWidget,
	emitWorkSummaryZeroToolRecoveryWidget,
} = require("./tool-first-finalization");
const {
	executeAIGatewayBufferedStream,
} = require("./ai-gateway-buffered-stream");
const {
	createAIGatewayChatStream,
} = require("./gateway-stream");
const {
	createChatAbortTracking,
} = require("./chat-abort-tracking");
const {
	createRovoMarkerStreamAdapter,
} = require("./rovo-marker-stream-adapter");
const {
	createRovoRouteWidgetPayloadDecorator,
	resolveRovoRouteToolsDetected,
} = require("./rovo-post-stream-routing-helpers");
const {
	buildRovoPreprocessingTraceData,
	createRovoTextOutputController,
	emitRovoMissingStudioAgentResultFailure,
	emitRovoToolFirstRouteSummary,
	finalizeRovoClassifierLeakRepair,
	finalizeRovoDirectOutputs,
	finalizeRovoPlanWidgetPostStream,
	finalizeRovoStudioAgentResult,
	instrumentChatSdkWriter,
	normalizeRovoThinkingEvent,
	normalizeRovoThinkingStatus,
	resolveRovoChatInProgressTimeoutRecovery,
	resolveRovoNonStrictPostStreamRouting,
	resolveRovoPortStuckRecovery,
	resolveRovoToolFirstRetryPlan,
} = require("./rovo-stream");
const {
	buildPostTurnWorkCompleteTraceData,
	buildTurnCompletePart,
	finalizePlanExecutionArtifactPostStream,
	resolvePlanExecutionCompletion,
} = require("./post-turn");
const {
	buildAIGatewayPlanApprovalResult,
	buildApprovalResumeDecision,
	getToolCallIdFromApprovalSubmission,
	normalizeApprovalSubmission,
} = require("./plan-approval");
const {
	writeAIGatewayFinalOutputStream,
} = require("./ai-gateway-final-output-stream");
const {
	resolveChatSdkRequestEnvelope,
	resolveChatSdkRequestState,
} = require("./request-normalization");
const {
	buildRouteDecisionResolvedTraceData,
	buildRovoTurnRoutingTelemetry,
} = require("./route-decision");
const {
	resolveChatSdkPreprocessingContext,
} = require("./preprocessing-context");
const {
	buildAIGatewayDeferredToolResultBlock,
} = require("./preprocessing");
const {
	createAIGatewayDeferredToolCallId,
	createClarificationSessionId,
	isAIGatewayDeferredToolCallId,
} = require("./deferred-tool-state");
const {
	buildGoogleCalendarDateContext,
	normalizeClientTimeZone,
} = require("./date-context");
const {
	isClassifierIntentLeakCandidate,
	parseClassifierIntentPayload,
} = require("./classifier-intent");
const {
	isBashQuestionCardWorkaround,
	isExitPlanModeTool,
	isRequestUserInputTool,
} = require("./tool-predicates");
const {
	getReadonlyBlockedWriteToolNames,
	looksLikeWriteBlockedTurn,
} = require("./write-block-detection");
const {
	buildChatSdkPrompt,
	resolveChatSdkPromptBuildInputs,
} = require("./prompt-build");
const {
	resolveSmartRouteGate,
} = require("./smart-route-gate");

const FALLBACK_AGENT_CREATION_QUESTION_INPUT = {
	title: "Answer these questions to continue",
	description: "Pick the options that best match what you want.",
	questions: [
		{
			question: "Who is the primary audience for this agent?",
			options: ["My team", "The whole org", "Just me"],
		},
		{
			question: "What should the agent focus on first?",
			options: [
				"Drafting and writing",
				"Analysis and recommendations",
				"Automating a workflow",
			],
		},
		{
			question: "What tone and persona should it use?",
			options: ["Coach", "Expert", "Concise assistant"],
		},
	],
};
const STUDIO_AGENT_GATEWAY_FALLBACK_TIMEOUT_MS = 12_000;

function buildChatSdkHandlerCompositionDependencies(dependencies = {}) {
	const {
		createUIMessageStream,
		pipeUIMessageStreamToResponse,
	} = getAiSdk();
	const {
		CLARIFICATION_CUSTOM_OPTION_PLACEHOLDER,
		CLARIFICATION_MAX_PRESET_OPTIONS,
		CLARIFICATION_MAX_ROUNDS,
		CLARIFICATION_WIDGET_TYPE,
		CLASSIFIER_JSON_BUFFER_MAX_CHARS,
		GENUI_FALLBACK_ERROR_TEXT,
		INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_MAX_ATTEMPTS,
		INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_TIMEOUT_MS,
		INTERACTIVE_CHAT_STUCK_PORT_RECOVERY_RETRY_ATTEMPTS,
		SMART_IMAGE_PROMPT_MAX_CHARS,
		SMART_VOICE_INPUT_MAX_CHARS,
		SMART_WIDGET_TYPE_AUDIO,
		SMART_WIDGET_TYPE_GENUI,
		SMART_WIDGET_TYPE_IMAGE,
		TOOL_FIRST_GATE_SKIP_SOURCES,
		WAIT_FOR_TURN_TIMEOUT_MS,
		_pausedRovoToolCallStore,
		_requestUserInputQuestionMetaStore,
		activeRequests,
		adaptClarificationAnswersForToolContract,
		buildAIGatewaySystemPrompt,
		buildArtifactPreviewSummary,
		buildUserMessage,
		clearActiveDeferredToolCall,
		compressUiConversationHistory,
		createAbortControllerFromRequest,
		generatePlanMetadataViaGateway,
		generateSmartGenuiResult,
		generateTextViaGateway,
		getListeningPidsForPort,
		handleRovoAppArtifactToolRequest,
		mapUiMessagesToConversation,
		persistRovoAppBrowserScreenshotBuffer,
		refreshRovoAvailability,
		registerActiveDeferredToolCall,
		registerPausedRovoToolCall,
		replayViaRovo,
		resolvePreferredBackend,
		resolveStageTraceFromRequest,
		rovoAppDocumentManager,
		rovoAppThreadManager,
		rovoCancelChat,
		rovoHealthCheck,
		rovoResumeToolCalls,
		sendGatewayErrorResponse,
		streamExpiredClarificationResponse,
		streamQuestionCardWidget,
		streamTextViaGateway,
		streamViaRovo,
		syncRovoAppThreadSessionFromCurrentPort,
		takePausedRovoToolCall,
		withStudioAgentGatewayFallbackTimeout,
	} = dependencies;

	return {
		CLARIFICATION_CUSTOM_OPTION_PLACEHOLDER,
		CLARIFICATION_MAX_LABEL_LENGTH,
		CLARIFICATION_MAX_PRESET_OPTIONS,
		CLARIFICATION_MAX_ROUNDS,
		CLARIFICATION_WIDGET_TYPE,
		CLASSIFIER_JSON_BUFFER_MAX_CHARS,
		FALLBACK_AGENT_CREATION_QUESTION_INPUT,
		GENUI_FALLBACK_ERROR_TEXT,
		INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_MAX_ATTEMPTS,
		INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_TIMEOUT_MS,
		INTERACTIVE_CHAT_STUCK_PORT_RECOVERY_RETRY_ATTEMPTS,
		SMART_IMAGE_PROMPT_MAX_CHARS,
		SMART_ROUTE_TARGET_SURFACES,
		SMART_VOICE_INPUT_MAX_CHARS,
		SMART_WIDGET_TYPE_AUDIO,
		SMART_WIDGET_TYPE_GENUI,
		SMART_WIDGET_TYPE_IMAGE,
		STAGE_TRACE_ID_HEADER,
		STUDIO_AGENT_GATEWAY_FALLBACK_TIMEOUT_MS,
		TOOL_FIRST_ENFORCEMENT_MODE_SOFT_RETRY,
		TOOL_FIRST_GATE_SKIP_SOURCES,
		WAIT_FOR_TURN_TIMEOUT_MS,
		WORK_ITEM_REPORT_REQUEST_START,
		_pausedRovoToolCallStore,
		_requestUserInputQuestionMetaStore,
		activeRequests,
		adaptClarificationAnswersForToolContract,
		appendToolObservationEntry,
		buildAIGatewayDeferredToolResultBlock,
		buildAIGatewayPlanApprovalResult,
		buildAIGatewaySystemPrompt,
		buildApprovalResumeDecision,
		buildArtifactPreviewSummary,
		buildChatSdkPrompt,
		buildClarificationResumeDecision,
		buildClarificationResumeDenyMessage,
		buildDirectSpecWidgetParts,
		buildEnrichedImagePrompt,
		buildExcalidrawWidgetPayload,
		buildExcalidrawWidgetSystemPrompt,
		buildFallbackGenuiSpecFromText,
		buildGoogleCalendarDateContext,
		buildInteractiveStuckPortFailureMessage,
		buildMissingStudioAgentResultFailureParts,
		buildPostTurnWorkCompleteTraceData,
		buildQuestionCardPayloadFromRequestUserInput,
		buildQuestionMetaFromQuestionCardPayload,
		buildRouteDecisionResolvedTraceData,
		buildRovoPreprocessingTraceData,
		buildRovoTurnRoutingTelemetry,
		buildSmartGenerationGatewayOptions,
		buildStudioAgentCreationTrace,
		buildToolContextForGenui,
		buildToolFirstClarificationInstruction,
		buildToolFirstTextFallback,
		buildTurnCompletePart,
		buildUserMessage,
		buildWorkItemReportRequestContext,
		buildWorkSummaryExecutionLog,
		buildZeroToolCallRecoverySpec,
		classifyCommand,
		classifyPromptIntent,
		clearActiveDeferredToolCall,
		clearPlanSession,
		compressUiConversationHistory,
		createAIGatewayDeferredToolCallId,
		createAIGatewayChatStream,
		createAbortControllerFromRequest,
		createChatAbortTracking,
		createClarificationSessionId,
		createRouteDecisionPart,
		createRovoRouteWidgetPayloadDecorator,
		createRovoTextOutputController,
		createRovoAppThreadId,
		createRovoMarkerStreamAdapter,
		createRovoUnavailableError: dependencies.createRovoUnavailableError,
		createThreadBrowserBridge,
		createToolFirstExecutionState,
		createUIMessageStream,
		deriveExcalidrawTitle,
		derivePlanExecutionArtifactTitle,
		detectEndpointType,
		detectSecrets,
		dispatchBespokeGenuiHandler,
		emitAutomaticGenuiFailure,
		emitCreateIntentDirectGenuiWidget,
		emitPostToolGenuiWidget,
		writePostToolGenuiLoading,
		emitRovoMissingStudioAgentResultFailure,
		emitRovoToolFirstRouteSummary,
		emitToolFirstRelevantGenuiWidget,
		emitWorkSummaryZeroToolRecoveryWidget,
		executeAIGatewayBufferedStream,
		extractCommandFromArgs,
		extractDirectSpec,
		extractStudioAgentResultFromText,
		finalizePlanExecutionArtifactPostStream,
		finalizeRovoClassifierLeakRepair,
		finalizeRovoDirectOutputs,
		finalizeRovoPlanWidgetPostStream,
		finalizeRovoStudioAgentResult,
		findOriginalAgentBrief,
		generatePlanMetadataViaGateway,
		generateSmartGenuiResult,
		generateTextViaGateway,
		getEnvVars,
		getLatestPlanWidgetMetadata,
		getLatestUserMessageSource,
		getLatestVisibleUserMessage,
		getListeningPidsForPort,
		getNonEmptyString,
		getPlanFeedbackToolGuard,
		getPlanSession,
		getReadonlyBlockedWriteToolNames,
		getToolCallIdFromApprovalSubmission,
		getToolCallIdFromClarificationSubmission: dependencies.getToolCallIdFromClarificationSubmission,
		handleDirectRovoMediaFences,
		handleReplayDeferredToolRequest,
		handleRovoAppArtifactToolRequest,
		handleStudioAutomationDiscoveryChatTurn,
		handleTranslationTurn,
		hasRelevantToolObservation,
		hasRelevantToolSuccess,
		inferPromptIntent,
		instrumentChatSdkWriter,
		normalizeRovoThinkingEvent,
		normalizeRovoThinkingStatus,
		isAIGatewayDeferredToolCallId,
		isAudioContextClarificationSession,
		isBashQuestionCardWorkaround,
		isBrowserToolCall,
		isClassifierIntentLeakCandidate,
		isExcalidrawDiagramRequest,
		isExitPlanModeTool,
		isImageContextClarificationSession,
		isLocalModelRequest,
		isPlainObject,
		isPlanExecutionPhase,
		isRequestUserInputTool,
		isSmartGenerationEnabled,
		isToolNameRelevant,
		isUnsupportedModalitiesError,
		isWorkSummaryTurn,
		looksLikeClarificationResponse,
		looksLikeInabilityResponse,
		looksLikeWriteBlockedTurn,
		mapUiMessagesToConversation,
		mapUiMessagesToRoleContent,
		normalizeApprovalSubmission,
		normalizeClarificationSubmission: dependencies.normalizeClarificationSubmission,
		normalizeClientTimeZone,
		normalizeExcalidrawArtifactOutput,
		normalizeSmartGenerationOptions,
		parseClassifierIntentPayload,
		parseMaybeJson,
		persistRovoAppBrowserScreenshotBuffer,
		pipeUIMessageStreamToResponse,
		pipeWebResponseToExpressResponse,
		recordPlanWidgetEmission,
		recordToolFirstAttempt,
		recordToolThinkingEvent,
		redactSecrets,
		refreshRovoAvailability,
		registerActiveDeferredToolCall,
		registerPausedRovoToolCall,
		replayViaRovo,
		restartRovoPort,
		resolveAudioContextVoiceInputFromClarification,
		resolveAutomaticGenuiOutcome,
		resolveChatSdkPreprocessingContext,
		resolveChatSdkPromptBuildInputs,
		resolveChatSdkRequestEnvelope,
		resolveChatSdkRequestState,
		resolveGatewayUrl,
		resolveGoogleImageGatewayConfig,
		resolveImageContextFromClarification,
		resolvePreferredBackend,
		resolvePlanExecutionCompletion,
		resolveWorkItemReportRequest,
		resolveSmartAudioVoiceInput,
		resolveSmartImagePrompt,
		resolveSmartRouteGate,
		resolveStageTraceFromRequest,
		resolveToolFirstPolicy,
		resolveToolFirstRoutingFlags,
		resolveToolFirstWidgetContentType,
		resolveToolFirstWidgetSource,
		resolveRovoChatInProgressTimeoutRecovery,
		resolveRovoNonStrictPostStreamRouting,
		resolveRovoPortStuckRecovery,
		resolveRovoRouteToolsDetected,
		resolveRovoToolFirstRetryPlan,
		rovoAppDocumentManager,
		rovoAppThreadManager,
		rovoCancelChat,
		rovoHealthCheck,
		rovoResumeToolCalls,
		sanitizeQuestionCardPayload,
		sendGatewayErrorResponse,
		shouldAttemptPostToolGenui,
		shouldBoundStudioAgentGatewayCall,
		shouldGateToolFirstQuestionCard,
		shouldRejectExpiredDeferredClarification,
		shouldRestorePlanModeOnResume,
		shouldRetryInteractiveStuckPortRecovery,
		shouldSuppressToolFirstIntentStatus,
		shouldSurfaceMissingStudioAgentResultFailure,
		splitDirectMediaTextForStreaming,
		splitSpecFenceTextForStreaming,
		streamAudioWidgetGeneration,
		streamExpiredClarificationResponse,
		streamGoogleGatewayManualSse,
		streamImageWidgetGeneration,
		streamLocalModel,
		streamQuestionCardWidget,
		streamSmartRouteAudioWidgetGeneration,
		streamSmartRouteImageWidgetGeneration,
		streamTextViaGateway,
		streamViaRovo,
		stripConversationalFiller,
		stripDirectMediaFences,
		stripToolFirstFailureNarrative,
		syncRovoAppThreadSessionFromCurrentPort,
		synthesizeSound,
		synthesiseDeferredToolResponseFromClarification,
		takePausedRovoToolCall,
		toImageWidgetErrorMessage,
		toPreview,
		updatePlanSession,
		withCanonicalPreviewBody,
		withStudioAgentGatewayFallbackTimeout,
		writeAIGatewayFinalOutputStream,
		writeGenericThinkingTraceSteps,
	};
}

function createServerChatSdkHandler(dependencies = {}) {
	return createChatSdkHandler(buildChatSdkHandlerCompositionDependencies(dependencies));
}

function createRovoAppThreadId() {
	return `rovo-app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
	FALLBACK_AGENT_CREATION_QUESTION_INPUT,
	STUDIO_AGENT_GATEWAY_FALLBACK_TIMEOUT_MS,
	buildChatSdkHandlerCompositionDependencies,
	createServerChatSdkHandler,
};
