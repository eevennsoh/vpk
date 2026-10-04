"use strict";

const {
	STAGE_TRACE_ID_HEADER,
	createStageTrace,
} = require("../lib/stage-trace");
const {
	buildGatewayErrorResponse,
	createRovoUnavailableError,
} = require("./error-response");
const {
	createAIGatewayChatStream,
} = require("./gateway-stream");
const {
	buildRovoPreprocessingTraceData,
	createRovoTextOutputController,
	emitRovoMissingStudioAgentResultFailure,
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
	createRovoRouteWidgetPayloadDecorator,
	resolveRovoRouteToolsDetected,
} = require("./rovo-post-stream-routing-helpers");
const {
	createRovoMarkerStreamAdapter,
} = require("./rovo-marker-stream-adapter");
const {
	getNonEmptyString,
	isPlainObject,
} = require("../lib/shared-utils");

function createRequestState({ backendPreference = "ai-gateway", ...overrides } = {}) {
	const messages = [
		{
			role: "user",
			parts: [{ type: "text", text: "Hello" }],
		},
	];

	return {
		approvalSubmission: null,
		approvalToolCallId: null,
		backendPreference,
		chatSdkSource: "direct",
		clarificationSubmission: null,
		clarificationToolCallId: null,
		clientTimeZone: "UTC",
		contextDescription: null,
		conversationHistory: [],
		creationMode: null,
		deferredToolResponseToolCallId: null,
		genuiHint: false,
		hasPausedApprovalToolCall: false,
		hasPausedClarificationToolCall: false,
		hasQueuedPrompts: false,
		isPlanFeedbackDeferredResumeTurn: false,
		isPostClarificationTurn: false,
		latestUserMessage: "Hello",
		latestUserMessageSource: null,
		latestVisiblePromptText: "Hello",
		latestVisibleUserMessage: { text: "Hello" },
		messages,
		missingUserMessageResponse: null,
		provider: "openai",
		rawApproval: null,
		rawDeferredToolResponse: null,
		rawModel: null,
		rawSmartGeneration: null,
		rawUserName: null,
		requestOrigin: "text",
		resolvedPlanModeActive: false,
		rovoSessionId: null,
		sessionMode: "persistent",
		threadId: "thread-1",
		...overrides,
	};
}

function createContractDependencies(overrides = {}) {
	const { createUIMessageStream, pipeUIMessageStreamToResponse } = require("../lib/ai-sdk-runtime").getAiSdk();
	const calls = {
		executeAIGatewayBufferedStream: [],
		stageMarks: [],
	};
	const dependencies = {
		CLASSIFIER_JSON_BUFFER_MAX_CHARS: 4096,
		CLARIFICATION_CUSTOM_OPTION_PLACEHOLDER: "Describe it another way",
		CLARIFICATION_MAX_LABEL_LENGTH: 80,
		CLARIFICATION_MAX_PRESET_OPTIONS: 4,
		CLARIFICATION_WIDGET_TYPE: "question-card",
		FALLBACK_AGENT_CREATION_QUESTION_INPUT: [],
		GENUI_FALLBACK_ERROR_TEXT: "I couldn't generate that preview.",
		SMART_IMAGE_PROMPT_MAX_CHARS: 4000,
		SMART_ROUTE_TARGET_SURFACES: ["sidebar"],
		SMART_VOICE_INPUT_MAX_CHARS: 4000,
		SMART_WIDGET_TYPE_AUDIO: "audio",
		SMART_WIDGET_TYPE_GENUI: "generative-ui",
		SMART_WIDGET_TYPE_IMAGE: "image",
		STAGE_TRACE_ID_HEADER,
		STUDIO_AGENT_GATEWAY_FALLBACK_TIMEOUT_MS: 10,
		TOOL_FIRST_ENFORCEMENT_MODE_SOFT_RETRY: "soft-retry",
		TOOL_FIRST_GATE_SKIP_SOURCES: [],
		WAIT_FOR_TURN_TIMEOUT_MS: 1000,
		WORK_ITEM_REPORT_REQUEST_START: "[Work Item Report Request]",
		_requestUserInputQuestionMetaStore: new Map(),
		activeRequests: new Map(),
		adaptClarificationAnswersForToolContract: () => "",
		appendToolObservationEntry: (entries, entry) => entries.push(entry),
		buildAIGatewayDeferredToolResultBlock: () => "",
		buildAIGatewayPlanApprovalResult: () => "",
		buildAIGatewayPreprocessingTraceData: () => ({ backend: "ai-gateway" }),
		buildAIGatewaySystemPrompt: () => "system",
		buildApprovalResumeDecision: (approval) => approval?.decision || "accepted",
		buildArtifactPreviewSummary: () => null,
		buildChatSdkPrompt: () => ({
			compressedPromptHistory: { conversationHistory: [] },
			promptBuiltTraceData: { promptProfile: "plain" },
			userMessageText: "Hello",
		}),
		buildClarificationResumeDecision: ({ clarificationToolCallId }) => ({
			tool_call_id: clarificationToolCallId,
			deny_message: null,
		}),
		buildClarificationResumeDenyMessage: () => null,
		buildDirectSpecWidgetParts: () => [],
		buildEnrichedImagePrompt: () => ({
			prompt: "",
			systemInstruction: "",
		}),
		buildExcalidrawWidgetPayload: () => ({}),
		buildExcalidrawWidgetSystemPrompt: () => "",
		buildFallbackGenuiSpecFromText: () => null,
		buildGoogleCalendarDateContext: () => null,
		buildInteractiveStuckPortFailureMessage: () => "Rovo is busy.",
		buildMissingStudioAgentResultFailureParts: () => [],
		buildPostTurnWorkCompleteTraceData: () => ({}),
		buildQuestionCardPayloadFromRequestUserInput: (input, defaults = {}) => ({
			sessionId: defaults.sessionId || "question-session-1",
			round: defaults.round || 1,
			maxRounds: defaults.maxRounds || 1,
			title: defaults.title || "Answer these questions to continue",
			description: defaults.description || "",
			widgetType: defaults.widgetType,
			questions: [
				{
					id: "question-1",
					label:
						typeof input?.question === "string"
							? input.question
							: typeof input === "string"
								? input
								: "Which project?",
					options: [],
				},
			],
		}),
		buildQuestionMetaFromQuestionCardPayload: () => ({}),
		buildRovoPreprocessingTraceData,
		buildRovoTurnRoutingTelemetry: (input) => input,
		buildSmartGenerationGatewayOptions: () => ({}),
		buildStudioAgentCreationTrace: () => [],
		buildToolContextForGenui: () => "",
		buildToolFirstClarificationInstruction: () => "",
		buildToolFirstTextFallback: () => "Tool output was not available.",
		buildRouteDecisionPart: (input) => ({
			type: "data-route-decision",
			data: input,
		}),
		buildTurnCompletePart: () => ({
			type: "data-turn-complete",
			data: { timestamp: "2026-07-05T00:00:00.000Z" },
		}),
		buildUserMessage: () => "Hello",
		classifyPromptIntent: () => ({
			inferredIntent: "chat",
			mediaPreClassification: { intent: null },
		}),
		clearActiveDeferredToolCall: () => {},
		clearPlanSession: () => {},
		compressUiConversationHistory: () => ({ conversationHistory: [] }),
		createAIGatewayDeferredToolCallId: () => "deferred-1",
		createAIGatewayChatStream,
		createAbortControllerFromRequest: require("../lib/http-request-abort").createAbortControllerFromRequest,
		createChatAbortTracking: require("./chat-abort-tracking").createChatAbortTracking,
		createClarificationSessionId: () => "clarification-1",
		createRouteDecisionPart: (input) => ({
			type: "data-route-decision",
			data: input,
		}),
		createRovoRouteWidgetPayloadDecorator,
		createRovoTextOutputController,
		createRovoAppThreadId: () => "thread-generated",
		createRovoMarkerStreamAdapter,
		createThreadBrowserBridge: () => ({
			handleToolCallStart: async () => {},
			handleToolCallResult: async () => {},
			hasAuthoritativeOutput: () => false,
		}),
		createToolFirstExecutionState: () => ({}),
		createRovoUnavailableError,
		createUIMessageStream,
		deriveExcalidrawTitle: () => "Diagram",
		derivePlanExecutionArtifactTitle: () => "Plan",
		detectEndpointType: () => "chat",
		detectSecrets: () => [],
		dispatchBespokeGenuiHandler: async () => null,
		emitAutomaticGenuiFailure: () => {},
		emitCreateIntentDirectGenuiWidget: async () => false,
		emitPostToolGenuiWidget: async () => ({ emittedWidget: false }),
		writePostToolGenuiLoading: () => {},
		emitRovoMissingStudioAgentResultFailure,
		emitRovoToolFirstRouteSummary: () => {},
		emitToolFirstRelevantGenuiWidget: async () => ({ emittedWidget: false }),
		emitWorkSummaryZeroToolRecoveryWidget: () => ({
			emittedWidget: false,
		}),
		executeAIGatewayBufferedStream: async (options) => {
			calls.executeAIGatewayBufferedStream.push(options);
			const textId = "ai-gateway-text-test";
			options.writer.write({
				type: "data-thinking-status",
				data: { label: "Working" },
			});
			options.writer.write({ type: "text-start", id: textId });
			options.writer.write({
				type: "text-delta",
				id: textId,
				delta: "Hello from gateway",
			});
			options.writer.write({ type: "text-end", id: textId });
			options.writer.write({
				type: "data-turn-complete",
				data: { timestamp: "2026-07-05T00:00:00.000Z" },
			});
		},
		findOriginalAgentBrief: () => "",
		finalizePlanExecutionArtifactPostStream: async () => {},
		finalizeRovoClassifierLeakRepair,
		finalizeRovoDirectOutputs,
		finalizeRovoPlanWidgetPostStream,
		finalizeRovoStudioAgentResult,
		getLatestUserMessageSource: () => null,
		getLatestVisibleUserMessage: () => ({ text: "Hello" }),
		getEnvVars: () => ({}),
		getLatestPlanWidgetMetadata: () => null,
		getListeningPidsForPort: async () => [],
		getNonEmptyString,
		getPlanFeedbackToolGuard: () => ({ ignore: false, block: false }),
		getPlanSession: () => null,
		getReadonlyBlockedWriteToolNames: () => [],
		getToolCallIdFromApprovalSubmission: () => null,
		getToolCallIdFromClarificationSubmission: () => null,
		handleDirectRovoMediaFences: async () => ({ handled: false }),
		handleReplayDeferredToolRequest: async () => ({ handled: false }),
		handleRovoAppArtifactToolRequest: async () => ({ handled: false }),
		handleStudioAutomationDiscoveryChatTurn: () => false,
		handleTranslationTurn: async () => false,
		hasRelevantToolObservation: () => false,
		hasRelevantToolSuccess: () => false,
		inferPromptIntent: () => "chat",
		instrumentChatSdkWriter,
		isAIGatewayDeferredToolCallId: () => false,
		isAudioContextClarificationSession: () => false,
		isBashQuestionCardWorkaround: () => false,
		isBrowserToolCall: () => false,
		isClassifierIntentLeakCandidate: () => false,
		isExcalidrawDiagramRequest: () => false,
		isExitPlanModeTool: (toolName) => toolName === "exit_plan_mode",
		isImageContextClarificationSession: () => false,
		isLocalModelRequest: () => false,
		isPlainObject,
		isPlanExecutionPhase: () => false,
		isRequestUserInputTool: (toolName) => toolName === "ask_user_questions",
		isSmartGenerationEnabled: () => false,
		isToolNameRelevant: () => false,
		isUnsupportedModalitiesError: () => false,
		isWorkSummaryTurn: () => false,
		looksLikeClarificationResponse: () => false,
		looksLikeInabilityResponse: () => false,
		looksLikeWriteBlockedTurn: () => false,
		mapUiMessagesToConversation: () => ({
			conversationHistory: [],
			message: "Hello",
		}),
		mapUiMessagesToRoleContent: () => [],
		normalizeRovoThinkingEvent,
		normalizeRovoThinkingStatus,
		normalizeApprovalSubmission: () => null,
		normalizeClarificationSubmission: () => null,
		normalizeClientTimeZone: () => "UTC",
		normalizeExcalidrawArtifactOutput: () => null,
		normalizeSmartGenerationOptions: () => ({
			enabled: false,
			surface: null,
		}),
		pipeUIMessageStreamToResponse,
		pipeWebResponseToExpressResponse: async () => {},
		persistRovoAppBrowserScreenshotBuffer: async () => ({}),
		parseClassifierIntentPayload: () => null,
		recordPlanWidgetEmission: () => {},
		recordToolFirstAttempt: () => {},
		recordToolThinkingEvent: () => {},
		redactSecrets: (text) => text,
		refreshRovoAvailability: async () => {},
		registerActiveDeferredToolCall: () => {},
		registerPausedRovoToolCall: () => {},
		replayViaRovo: async () => {},
		restartRovoPort: async () => {},
		resolveAudioContextVoiceInputFromClarification: () => ({
			source: null,
			voiceInput: null,
		}),
		resolveAutomaticGenuiOutcome: () => ({ shouldEmit: false }),
		resolveAIGatewayStreamInputs: () => ({
			agentCreationOriginalBrief: "",
			agentCreationTracePrompt: "Hello",
			gatewayMessages: [],
			gatewaySystem: "system",
		}),
		resolveGatewayUrl: () => "http://gateway.test",
		resolveGoogleImageGatewayConfig: () => ({
			ok: false,
			statusCode: 503,
			error: "not configured",
		}),
		resolveImageContextFromClarification: () => ({
			contextText: null,
			source: null,
		}),
		resolveChatSdkPreprocessingContext: ({ contextDescription }) =>
			contextDescription,
		resolveChatSdkPromptBuildInputs: () => ({
			effectiveContextWithPortBinding: null,
			pausedContinuationToolCallId: null,
			promptProfile: "plain",
			smartGeneration: { enabled: false, surface: null },
			smartGenerationActive: false,
			smartLayoutContext: null,
		}),
		resolveChatSdkRequestEnvelope: () => ({
			entryTraceData: {
				backendPreference: "ai-gateway",
				messageCount: 1,
			},
			stageTraceMeta: {
				origin: "text",
				path: "/api/chat-sdk",
				source: "direct",
			},
		}),
		resolveChatSdkRequestState: () =>
			createRequestState({ backendPreference: "ai-gateway" }),
		resolvePreferredBackend: async () => ({ backend: "ai-gateway" }),
		resolvePlanExecutionCompletion: () => null,
		resolveRovoChatInProgressTimeoutRecovery,
		resolveRovoNonStrictPostStreamRouting,
		resolveRovoPortStuckRecovery,
		resolveRovoRouteToolsDetected,
		resolveRovoToolFirstRetryPlan,
		resolveSmartAudioVoiceInput: () => ({
			needsClarification: false,
			voiceInput: null,
		}),
		resolveSmartImagePrompt: () => ({
			imagePrompt: "",
			needsClarification: false,
		}),
		resolveWorkItemReportRequest: () => ({
			hasContext: false,
			isIntent: false,
			shouldCreateArtifact: false,
		}),
		resolveSmartRouteGate: () => ({
			forceSmartAudioRoute: false,
			isCreateIntentRequestPrompt: false,
			isTaskLikeRequest: false,
			prefersGenuiCardExperience: false,
			smartIntentResult: null,
			smartRoutingActive: false,
		}),
		resolveStageTraceFromRequest: (req, scope, baseMeta) => {
			const trace = createStageTrace({
				baseMeta,
				logger: { info: () => {} },
				requestId: req.get(STAGE_TRACE_ID_HEADER),
				scope,
			});
			const mark = trace.mark;
			trace.mark = (stage, details) => {
				calls.stageMarks.push({ stage, details });
				return mark(stage, details);
			};
			return trace;
		},
		resolveToolFirstPolicy: () => ({
			domainLabels: {},
			domains: [],
			enforcement: {},
			matched: false,
			relevanceDomains: [],
		}),
		resolveToolFirstRoutingFlags: () => ({
			isStrictToolFirstTurn: false,
		}),
		resolveToolFirstWidgetContentType: () => null,
		resolveToolFirstWidgetSource: () => null,
		rovoAppDocumentManager: {},
		rovoAppThreadManager: {},
		rovoCancelChat: async () => {},
		rovoHealthCheck: async () => ({ ok: true }),
		rovoResumeToolCalls: async () => {},
		sanitizeQuestionCardPayload: (payload) => payload,
		sendGatewayErrorResponse: (res, error, fallbackErrorMessage) => {
			const { statusCode, body } = buildGatewayErrorResponse({
				error,
				fallbackErrorMessage,
			});
			return res.status(statusCode).json(body);
		},
		shouldAttemptPostToolGenui: () => false,
		shouldBoundStudioAgentGatewayCall: () => false,
		shouldGateToolFirstQuestionCard: () => ({
			shouldGate: false,
			unsatisfiedHints: [],
		}),
		shouldRejectExpiredDeferredClarification: () => false,
		shouldRestorePlanModeOnResume: () => ({
			shouldRestore: false,
		}),
		shouldRetryInteractiveStuckPortRecovery: () => false,
		shouldSurfaceMissingStudioAgentResultFailure: () => false,
		splitDirectMediaTextForStreaming: (text) => ({
			pendingText: "",
			visibleText: text,
		}),
		splitSpecFenceTextForStreaming: (text) => ({
			pendingText: "",
			visibleText: text,
		}),
		streamAudioWidgetGeneration: async () => {},
		streamExpiredClarificationResponse: () => {},
		streamGoogleGatewayManualSse: async () => {},
		streamImageWidgetGeneration: async () => {},
		streamTextViaGateway: async () => "",
		streamSmartRouteAudioWidgetGeneration: async () => ({ aborted: false }),
		streamSmartRouteImageWidgetGeneration: async () => ({ aborted: false }),
		streamViaRovo: async () => {},
		stripConversationalFiller: (text) => text,
		stripDirectMediaFences: (text) => ({
			cleanedText: text,
			mediaRequests: [],
		}),
		stripToolFirstFailureNarrative: (text) => ({
			replaced: false,
			text,
		}),
		syncRovoAppThreadSessionFromCurrentPort: async () => null,
		synthesizeSound: async () => null,
		synthesiseDeferredToolResponseFromClarification: () => null,
		takePausedRovoToolCall: () => null,
		toImageWidgetErrorMessage: () => "Image generation failed",
		toPreview: (value) => ({
			bytes: typeof value === "string" ? value.length : 0,
			text: typeof value === "string" ? value : JSON.stringify(value),
			truncated: false,
		}),
		updatePlanSession: () => {},
		withCanonicalPreviewBody: (_type, payload) => payload,
		withStudioAgentGatewayFallbackTimeout: (promise) =>
			promise.then((value) => ({ timedOut: false, value })),
		writeAIGatewayFinalOutputStream: async () => {},
		writeGenericThinkingTraceSteps: async () => {},
		...overrides,
	};

	return { calls, dependencies };
}

module.exports = { createRequestState, createContractDependencies };
