"use strict";

const assert = require("node:assert/strict");
const { before, test } = require("node:test");

let createUIMessageStream;
let pipeUIMessageStreamToResponse;

before(async () => {
	({
		createUIMessageStream,
		pipeUIMessageStreamToResponse,
	} = await import("ai"));
});

const {
	createCapturedResponse,
	createInProcessRequest,
} = require("../lib/in-process-http");
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
const { createChatSdkHandler } = require("./chat-sdk-handler");
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

async function dispatchWithDependencies({ body, headers, signal }, dependencies) {
	const handler = createChatSdkHandler(dependencies);
	const req = createInProcessRequest({ body, headers, signal });
	const res = createCapturedResponse();
	const handlerPromise = handler(req, res);
	await res.waitForHeaders();
	return { handlerPromise, response: res.toWebResponse() };
}

function assertOrdered(source, needles) {
	let cursor = 0;
	for (const needle of needles) {
		const index = source.indexOf(needle, cursor);
		assert.notEqual(index, -1, `Expected ordered content: ${needle}\n${source}`);
		cursor = index + needle.length;
	}
}

test("chat SDK handler preserves trace and SSE headers for a stubbed AI Gateway turn", async () => {
	const { calls, dependencies } = createContractDependencies();
	const { handlerPromise, response } = await dispatchWithDependencies({
		body: { backendPreference: "ai-gateway", messages: [] },
		headers: { [STAGE_TRACE_ID_HEADER]: "trace-contract-1" },
	}, dependencies);
	await handlerPromise;

	assert.equal(response.status, 200);
	assert.equal(response.headers.get(STAGE_TRACE_ID_HEADER), "trace-contract-1");
	assert.match(response.headers.get("content-type") || "", /text\/event-stream/u);
	assert.equal(response.headers.get("cache-control"), "no-cache");
	assert.equal(response.headers.get("content-length"), null);

	const bodyText = await response.text();
	assertOrdered(bodyText, [
		"data-thinking-status",
		"text-start",
		"text-delta",
		"Hello from gateway",
		"text-end",
		"data-turn-complete",
	]);
	assert.equal(calls.executeAIGatewayBufferedStream.length, 1);
	assert.equal(calls.stageMarks[0]?.stage, "entry");
});

test("chat SDK handler aborts the AI Gateway execution signal when the request closes", async () => {
	let observedSignal;
	let resolveAbort;
	const abortObserved = new Promise((resolve) => {
		resolveAbort = resolve;
	});
	const requestAbortController = new AbortController();
	const { dependencies } = createContractDependencies({
		executeAIGatewayBufferedStream: async ({ abortSignal, writer }) => {
			observedSignal = abortSignal;
			writer.write({ type: "text-start", id: "abort-text" });
			writer.write({
				type: "text-delta",
				id: "abort-text",
				delta: "partial",
			});
			abortSignal.addEventListener("abort", () => resolveAbort(), {
				once: true,
			});
			await abortObserved;
		},
	});

	const { handlerPromise } = await dispatchWithDependencies({
		body: { backendPreference: "ai-gateway", messages: [] },
		headers: { [STAGE_TRACE_ID_HEADER]: "trace-contract-abort" },
		signal: requestAbortController.signal,
	}, dependencies);

	assert.equal(observedSignal.aborted, false);
	requestAbortController.abort();
	await abortObserved;
	assert.equal(observedSignal.aborted, true);
	await handlerPromise;
});

test("chat SDK handler routes local model turns before AI Gateway", async () => {
	const localModelCalls = [];
	const { calls, dependencies } = createContractDependencies({
		isLocalModelRequest: (provider, model) =>
			provider === "local" || model === "local/qwen",
		resolveChatSdkRequestState: () =>
			createRequestState({
				backendPreference: "ai-gateway",
				conversationHistory: [{ role: "user", content: "Earlier" }],
				latestUserMessage: "Hello local",
				provider: "local",
				rawModel: "local/qwen",
			}),
		streamLocalModel: async ({ userMessage, conversationHistory, writer }) => {
			localModelCalls.push({ userMessage, conversationHistory });
			writer.write({ type: "text-start", id: "local-text-contract" });
			writer.write({
				type: "text-delta",
				id: "local-text-contract",
				delta: "Local response",
			});
			writer.write({ type: "text-end", id: "local-text-contract" });
			writer.write({
				type: "data-turn-complete",
				data: { timestamp: "2026-07-05T00:00:00.000Z" },
			});
		},
	});
	const { handlerPromise, response } = await dispatchWithDependencies({
		body: { backendPreference: "ai-gateway", messages: [] },
		headers: { [STAGE_TRACE_ID_HEADER]: "trace-contract-local" },
	}, dependencies);
	await handlerPromise;

	assert.equal(response.status, 200);
	const bodyText = await response.text();
	assert.match(bodyText, /Local response/u);
	assert.deepEqual(localModelCalls, [{
		userMessage: "Hello local",
		conversationHistory: [{ role: "user", content: "Earlier" }],
	}]);
	assert.equal(calls.executeAIGatewayBufferedStream.length, 0);
});

test("chat SDK handler returns the Rovo unavailable JSON contract", async () => {
	const { dependencies } = createContractDependencies({
		resolveChatSdkRequestState: () =>
			createRequestState({ backendPreference: "rovo" }),
		resolvePreferredBackend: async () => ({ backend: "ai-gateway" }),
	});
	const { handlerPromise, response } = await dispatchWithDependencies({
		body: { backendPreference: "rovo", messages: [] },
		headers: { [STAGE_TRACE_ID_HEADER]: "trace-contract-rovo" },
	}, dependencies);
	await handlerPromise;

	assert.equal(response.status, 503);
	assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
	assert.deepEqual(await response.json(), {
		backendSelected: "rovo",
		details:
			"Rovo Serve is required but not available. Please start Rovo Serve with 'pnpm run rovo' before using this feature.",
		error: "Rovo Serve is required but not available",
		failureStage: "unavailable",
	});
});

test("chat SDK handler preserves Rovo happy-path SSE ordering", async () => {
	const streamCalls = [];
	const syncCalls = [];
	const { dependencies } = createContractDependencies({
		resolveChatSdkRequestState: () =>
			createRequestState({
				backendPreference: "rovo",
				latestUserMessage: "Use Rovo",
				latestVisiblePromptText: "Use Rovo",
				latestVisibleUserMessage: { text: "Use Rovo" },
			}),
		resolvePreferredBackend: async () => ({ backend: "rovo" }),
		streamViaRovo: async (options) => {
			streamCalls.push({
				conflictPolicy: options.conflictPolicy,
				message: options.message,
				sessionId: options.sessionId,
			});
			options.onPortAcquired?.(43123);
			options.onThinkingStatus?.({
				label: "Checking Rovo",
				content: "Reading context",
				activity: "data",
				source: "rovo",
			});
			options.onThinkingEvent?.({
				eventId: "thinking-event-agent-1",
				input: "Draft tests",
				phase: "start",
				subagentName: "Scout",
				timestamp: "2026-07-05T00:00:00.000Z",
				toolCallId: "tool-agent-1",
				toolName: "agent_run",
			});
			options.onTextDelta?.("Hello from Rovo");
		},
		syncRovoAppThreadSessionFromCurrentPort: async (...args) => {
			syncCalls.push(args);
			return { id: "thread-1", messages: [] };
		},
	});

	const { handlerPromise, response } = await dispatchWithDependencies({
		body: { backendPreference: "rovo", messages: [] },
		headers: { [STAGE_TRACE_ID_HEADER]: "trace-contract-rovo-happy" },
	}, dependencies);
	await handlerPromise;

	assert.equal(response.status, 200);
	assert.equal(response.headers.get(STAGE_TRACE_ID_HEADER), "trace-contract-rovo-happy");
	assert.match(response.headers.get("content-type") || "", /text\/event-stream/u);

	const bodyText = await response.text();
	assertOrdered(bodyText, [
		"data-thinking-status",
		"Checking Rovo",
		"data-thinking-event",
		"thinking-event-agent-1",
		"data-agent-execution",
		"agent-execution-tool-agent-1",
		"Scout",
		"text-start",
		"text-delta",
		"Hello from Rovo",
		"data-route-decision",
		"intent_text_default",
		"text-end",
		"data-turn-complete",
	]);
	assert.deepEqual(streamCalls, [{
		conflictPolicy: "wait-for-turn",
		message: {
			enableDeepPlan: false,
			message: "Hello",
		},
		sessionId: undefined,
	}]);
	assert.equal(syncCalls.length, 2);
	assert.deepEqual(syncCalls.map((args) => args.slice(0, 2)), [
		["thread-1", 43123],
		["thread-1", 43123],
	]);
});

test("chat SDK handler uses acquired Rovo port for deferred tool callbacks", async () => {
	const activeDeferredCalls = [];
	const streamCalls = [];
	const syncCalls = [];
	const { dependencies } = createContractDependencies({
		registerActiveDeferredToolCall: (payload) => {
			activeDeferredCalls.push(payload);
		},
		resolveChatSdkRequestState: () =>
			createRequestState({
				backendPreference: "rovo",
				latestUserMessage: "Ask a follow-up",
				latestVisiblePromptText: "Ask a follow-up",
				latestVisibleUserMessage: { text: "Ask a follow-up" },
			}),
		resolvePreferredBackend: async () => ({ backend: "rovo" }),
		streamViaRovo: async (options) => {
			streamCalls.push({
				hasDeferredCallback: typeof options.onDeferredToolRequest === "function",
			});
			options.onPortAcquired?.(43124);
			await options.onDeferredToolRequest?.({
				toolCallId: "deferred-question-1",
				toolInput: { question: "Which project?" },
				toolName: "ask_user_questions",
			});
			options.onTextDelta?.("Waiting for your answer");
		},
		syncRovoAppThreadSessionFromCurrentPort: async (...args) => {
			syncCalls.push(args);
			return { id: "thread-1", messages: [] };
		},
	});

	const { handlerPromise, response } = await dispatchWithDependencies({
		body: { backendPreference: "rovo", messages: [] },
		headers: { [STAGE_TRACE_ID_HEADER]: "trace-contract-rovo-deferred" },
	}, dependencies);
	await handlerPromise;

	assert.equal(response.status, 200);
	assert.deepEqual(streamCalls, [{ hasDeferredCallback: true }]);
	assert.deepEqual(activeDeferredCalls, [
		{
			toolCallId: "deferred-question-1",
			port: 43124,
			threadId: "thread-1",
			kind: "clarification",
		},
	]);
	assert.ok(
		syncCalls.some((args) =>
			args[0] === "thread-1" &&
			args[1] === 43124 &&
			args[2]?.sessionMode === "persistent",
		),
		"expected deferred callback to sync with the acquired port",
	);
	assert.match(await response.text(), /Which project\?/u);
});

test("chat SDK handler resumes and replays paused Rovo clarification continuations", async () => {
	const cancelCalls = [];
	const replayCalls = [];
	const resumeCalls = [];
	const streamCalls = [];
	let releaseCount = 0;
	const pausedRecord = {
		createdAt: Date.now(),
		expiresAt: Date.now() + 30_000,
		handle: {
			release() {
				releaseCount += 1;
			},
		},
		kind: "clarification",
		port: 43124,
		toolCallId: "paused-clarify-1",
	};
	const { dependencies } = createContractDependencies({
		buildClarificationResumeDecision: ({
			clarificationSubmission,
			clarificationToolCallId,
		}) => ({
			tool_call_id: clarificationToolCallId,
			deny_message: clarificationSubmission.answers?.choice || null,
		}),
		resolveChatSdkPromptBuildInputs: () => ({
			effectiveContextWithPortBinding: null,
			pausedContinuationToolCallId: "paused-clarify-1",
			promptProfile: "plain",
			smartGeneration: { enabled: false, surface: null },
			smartGenerationActive: false,
			smartLayoutContext: null,
		}),
		resolveChatSdkRequestState: () =>
			createRequestState({
				backendPreference: "rovo",
				clarificationSubmission: {
					answers: { choice: "Use option A" },
					sessionId: "clarification-session-1",
				},
				clarificationToolCallId: "paused-clarify-1",
				hasPausedClarificationToolCall: true,
				isPostClarificationTurn: true,
				latestUserMessage: "Use option A",
				latestVisiblePromptText: "Use option A",
				latestVisibleUserMessage: { text: "Use option A" },
			}),
		resolvePreferredBackend: async () => ({ backend: "rovo" }),
		replayViaRovo: async (options) => {
			replayCalls.push({
				port: options.port,
				skipReplayUntilToolCallId: options.skipReplayUntilToolCallId,
			});
			options.onThinkingStatus?.({
				label: "Continuing",
				content: "Applying answer",
				activity: "data",
				source: "rovo",
			});
			options.onTextDelta?.("Resumed Rovo answer");
		},
		rovoCancelChat: async (...args) => {
			cancelCalls.push(args);
		},
		rovoResumeToolCalls: async (...args) => {
			resumeCalls.push(args);
		},
		streamViaRovo: async (...args) => {
			streamCalls.push(args);
		},
		takePausedRovoToolCall: (toolCallId) =>
			toolCallId === "paused-clarify-1" ? pausedRecord : null,
	});

	const { handlerPromise, response } = await dispatchWithDependencies({
		body: { backendPreference: "rovo", messages: [] },
		headers: { [STAGE_TRACE_ID_HEADER]: "trace-contract-rovo-paused" },
	}, dependencies);
	await handlerPromise;

	assert.equal(response.status, 200);
	const bodyText = await response.text();
	assertOrdered(bodyText, [
		"data-thinking-status",
		"Continuing",
		"text-start",
		"text-delta",
		"Resu",
		"text-delta",
		"med Rovo answer",
		"data-route-decision",
		"intent_text_default",
		"text-end",
		"data-turn-complete",
	]);
	assert.deepEqual(resumeCalls, [
		[
			43124,
			{
				decisions: [{
					tool_call_id: "paused-clarify-1",
					deny_message: "Use option A",
				}],
			},
		],
	]);
	assert.deepEqual(replayCalls, [{
		port: 43124,
		skipReplayUntilToolCallId: "paused-clarify-1",
	}]);
	assert.deepEqual(streamCalls, []);
	assert.deepEqual(cancelCalls, []);
	assert.equal(releaseCount, 1);
});

test("chat SDK handler resumes superseded approval tools before fresh Rovo streams", async () => {
	const cancelCalls = [];
	const resumeCalls = [];
	const streamCalls = [];
	const { dependencies } = createContractDependencies({
		resolveChatSdkRequestState: () =>
			createRequestState({
				approvalSubmission: {
					decision: "accept",
				},
				approvalToolCallId: "approval-tool-1",
				backendPreference: "rovo",
				latestUserMessage: "Build it",
				latestVisiblePromptText: "Build it",
				latestVisibleUserMessage: { text: "Build it" },
			}),
		resolvePreferredBackend: async () => ({ backend: "rovo" }),
		rovoCancelChat: async (...args) => {
			cancelCalls.push(args);
		},
		rovoResumeToolCalls: async (...args) => {
			resumeCalls.push(args);
		},
		streamViaRovo: async (options) => {
			streamCalls.push({
				conflictPolicy: options.conflictPolicy,
				hasCancelConflictTurn: typeof options.cancelConflictTurn === "function",
			});
			await options.cancelConflictTurn?.(43125);
			options.onPortAcquired?.(43125);
			options.onTextDelta?.("Fresh approval stream");
		},
	});

	const { handlerPromise, response } = await dispatchWithDependencies({
		body: { backendPreference: "rovo", messages: [] },
		headers: { [STAGE_TRACE_ID_HEADER]: "trace-contract-rovo-approval" },
	}, dependencies);
	await handlerPromise;

	assert.equal(response.status, 200);
	assertOrdered(await response.text(), [
		"text-start",
		"text-delta",
		"Fresh ",
		"text-delta",
		"approval stream",
		"data-route-decision",
		"data-turn-complete",
	]);
	assert.deepEqual(streamCalls, [{
		conflictPolicy: "cancel-and-retry",
		hasCancelConflictTurn: true,
	}]);
	assert.deepEqual(resumeCalls, [
		[
			43125,
			{
				decisions: [{
					tool_call_id: "approval-tool-1",
					deny_message: "Plan approval superseded — starting fresh build turn.",
				}],
			},
		],
	]);
	assert.deepEqual(cancelCalls, [[43125, { timeoutMs: 5_000 }]]);
});
