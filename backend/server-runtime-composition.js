"use strict";

const path = require("node:path");
const {
	createBackendServiceComposition: defaultCreateBackendServiceComposition,
} = require("./services/backend-service-composition");
const {
	createBackendApp: defaultCreateBackendApp,
} = require("./app");
const {
	buildBackendAppDependencies: defaultBuildBackendAppDependencies,
} = require("./app-dependency-composition");
const {
	executeRovoTask: defaultExecuteRovoTask,
	runRovoBackgroundTask: defaultRunRovoBackgroundTask,
} = require("./lib/rovo-task-executor");
const {
	createPreferredBackendResolver: defaultCreatePreferredBackendResolver,
} = require("./lib/chat-backend-selection");
const { buildRuntimeStatusSnapshot: defaultBuildRuntimeStatusSnapshot } = require("./lib/runtime-status");
const { searchThreads: defaultSearchThreads } = require("./lib/session-search");
const {
	createAbortControllerFromRequest: defaultCreateAbortControllerFromRequest,
} = require("./lib/http-request-abort");
const {
	collectRovoAppUploadIdsFromMessages: defaultCollectRovoAppUploadIdsFromMessages,
} = require("./lib/rovo-app-upload-helpers");
const {
	createRovoRuntimeAvailabilityComposition: defaultCreateRovoRuntimeAvailabilityComposition,
} = require("./lib/rovo-runtime-availability-composition");
const {
	loadRovoConfigBuilders: defaultLoadRovoConfigBuilders,
} = require("./lib/rovo-config-loader");
const {
	createChatSdkServerComposition: defaultCreateChatSdkServerComposition,
} = require("./chat/chat-sdk-server-composition");
const {
	createChatRuntimeComposition: defaultCreateChatRuntimeComposition,
} = require("./chat/chat-runtime-composition");
const {
	streamViaRovo: defaultStreamViaRovo,
	replayViaRovo: defaultReplayViaRovo,
	generateTextViaRovo: defaultGenerateTextViaRovo,
	isChatInProgressError: defaultIsChatInProgressError,
	initPool: defaultInitPool,
	WAIT_FOR_TURN_TIMEOUT_MS: DEFAULT_WAIT_FOR_TURN_TIMEOUT_MS,
} = require("./lib/rovo-gateway");
const { classifyRovoHealthCheck: defaultClassifyRovoHealthCheck } = require("./lib/rovo-health");
const {
	ensureRovoSession: defaultEnsureRovoSession,
	getCurrentRovoSession: defaultGetCurrentRovoSession,
} = require("./lib/rovo-session");
const {
	buildLlmRoutingStatus: defaultBuildLlmRoutingStatus,
	describeChatBackend: defaultDescribeChatBackend,
} = require("./lib/llm-routing-status");
const {
	clearPlanSession: defaultClearPlanSession,
} = require("./lib/plan-session");
const {
	healthCheck: defaultRovoHealthCheck,
	cancelChat: defaultRovoCancelChat,
	resumeToolCalls: defaultRovoResumeToolCalls,
} = require("./lib/rovo-client");
const {
	setAgentMode: defaultSetAgentMode,
	getAgentMode: defaultGetAgentMode,
} = require("./lib/rovo-agent-mode");
const {
	cancelActiveDeferredToolCallRecord: defaultCancelActiveDeferredToolCallRecord,
	cancelPausedDeferredToolCallRecord: defaultCancelPausedDeferredToolCallRecord,
} = require("./lib/deferred-tool-cancel");
const { createRovoPool: defaultCreateRovoPool } = require("./lib/rovo-pool");
const {
	createListeningPidReader: defaultCreateListeningPidReader,
} = require("./lib/rovo-port-recovery");
const {
	resolveRovoPorts: defaultResolveRovoPorts,
} = require("./lib/rovo-port-discovery");
const {
	getRovoBasePort: defaultGetRovoBasePort,
} = require("../scripts/lib/worktree-ports");
const {
	getEnvVars: defaultGetEnvVars,
	getAIGatewayConfigReport: defaultGetAIGatewayConfigReport,
	hasGatewayUrlConfigured: defaultHasGatewayUrlConfigured,
	getRealtimeConfig: defaultGetRealtimeConfig,
} = require("./lib/ai-gateway-helpers");
const { chromiumPreviewManager: defaultChromiumPreviewManager } = require("./lib/chromium-preview");
const {
	browserWorkspaceManager: defaultBrowserWorkspaceManager,
	isBrowserWorkspaceNotFoundError: defaultIsBrowserWorkspaceNotFoundError,
} = require("./lib/browser-workspace-manager");
const {
	deleteRovoAppThreadBrowserWorkspace: defaultDeleteRovoAppThreadBrowserWorkspace,
	ensureRovoAppThreadBrowserWorkspace: defaultEnsureRovoAppThreadBrowserWorkspace,
	getRovoAppThreadBrowserWorkspace: defaultGetRovoAppThreadBrowserWorkspace,
} = require("./lib/rovo-app-browser-workspace");
const {
	getMirrorBrowser: defaultGetMirrorBrowser,
	destroyMirrorBrowser: defaultDestroyMirrorBrowser,
} = require("./lib/rovo-app-browser-mirror");
const {
	createGatewayErrorResponseSender: defaultCreateGatewayErrorResponseSender,
	createRovoUnavailableError: defaultCreateRovoUnavailableError,
	normalizeAIGatewayError: defaultNormalizeAIGatewayError,
} = require("./chat/error-response");
const {
	createStageTrace: defaultCreateStageTrace,
	createStageTraceFromRequestResolver: defaultCreateStageTraceFromRequestResolver,
} = require("./lib/stage-trace");

function createDebugLogger({
	debugMode,
	logger = console,
}) {
	return (section, message, data) => {
		if (!debugMode) {
			return;
		}
		logger.log(`[DEBUG][${section}] ${message}`, data ? JSON.stringify(data, null, 2) : "");
	};
}

function createBackendRuntimeComposition({
	backendDir = __dirname,
	env = process.env,
	logger = console,
	projectRoot = path.join(backendDir, ".."),
} = {}, implementations = {}) {
	const {
		browserWorkspaceManager = defaultBrowserWorkspaceManager,
		buildBackendAppDependencies = defaultBuildBackendAppDependencies,
		buildLlmRoutingStatus = defaultBuildLlmRoutingStatus,
		buildRuntimeStatusSnapshot = defaultBuildRuntimeStatusSnapshot,
		cancelActiveDeferredToolCallRecord = defaultCancelActiveDeferredToolCallRecord,
		cancelPausedDeferredToolCallRecord = defaultCancelPausedDeferredToolCallRecord,
		chromiumPreviewManager = defaultChromiumPreviewManager,
		classifyRovoHealthCheck = defaultClassifyRovoHealthCheck,
		clearPlanSession = defaultClearPlanSession,
		collectRovoAppUploadIdsFromMessages = defaultCollectRovoAppUploadIdsFromMessages,
		createAbortControllerFromRequest = defaultCreateAbortControllerFromRequest,
		createBackendApp = defaultCreateBackendApp,
		createBackendServiceComposition = defaultCreateBackendServiceComposition,
		createChatRuntimeComposition = defaultCreateChatRuntimeComposition,
		createChatSdkServerComposition = defaultCreateChatSdkServerComposition,
		createGatewayErrorResponseSender = defaultCreateGatewayErrorResponseSender,
		createListeningPidReader = defaultCreateListeningPidReader,
		createPreferredBackendResolver = defaultCreatePreferredBackendResolver,
		createRovoPool = defaultCreateRovoPool,
		createRovoRuntimeAvailabilityComposition = defaultCreateRovoRuntimeAvailabilityComposition,
		createRovoUnavailableError = defaultCreateRovoUnavailableError,
		createStageTrace = defaultCreateStageTrace,
		createStageTraceFromRequestResolver = defaultCreateStageTraceFromRequestResolver,
		deleteRovoAppThreadBrowserWorkspace = defaultDeleteRovoAppThreadBrowserWorkspace,
		describeChatBackend = defaultDescribeChatBackend,
		destroyMirrorBrowser = defaultDestroyMirrorBrowser,
		ensureRovoAppThreadBrowserWorkspace = defaultEnsureRovoAppThreadBrowserWorkspace,
		ensureRovoSession = defaultEnsureRovoSession,
		executeRovoTask = defaultExecuteRovoTask,
		generateTextViaRovo = defaultGenerateTextViaRovo,
		getAgentMode = defaultGetAgentMode,
		getAiGatewayConfigReport = defaultGetAIGatewayConfigReport,
		getCurrentRovoSession = defaultGetCurrentRovoSession,
		getEnvVars = defaultGetEnvVars,
		getMirrorBrowser = defaultGetMirrorBrowser,
		getRealtimeConfig = defaultGetRealtimeConfig,
		getRovoAppThreadBrowserWorkspace = defaultGetRovoAppThreadBrowserWorkspace,
		getRovoBasePort = defaultGetRovoBasePort,
		hasGatewayUrlConfigured = defaultHasGatewayUrlConfigured,
		initPool = defaultInitPool,
		isBrowserWorkspaceNotFoundError = defaultIsBrowserWorkspaceNotFoundError,
		isChatInProgressError = defaultIsChatInProgressError,
		loadRovoConfigBuilders = defaultLoadRovoConfigBuilders,
		normalizeAIGatewayError = defaultNormalizeAIGatewayError,
		replayViaRovo = defaultReplayViaRovo,
		resolveRovoPorts = defaultResolveRovoPorts,
		rovoCancelChat = defaultRovoCancelChat,
		rovoHealthCheck = defaultRovoHealthCheck,
		rovoResumeToolCalls = defaultRovoResumeToolCalls,
		runRovoBackgroundTask = defaultRunRovoBackgroundTask,
		searchThreads = defaultSearchThreads,
		setAgentMode = defaultSetAgentMode,
		streamViaRovo = defaultStreamViaRovo,
		waitForTurnTimeoutMs = DEFAULT_WAIT_FOR_TURN_TIMEOUT_MS,
	} = implementations;
	const debugMode = env.DEBUG === "true";
	const debugLog = createDebugLogger({ debugMode, logger });
	const {
		clearActiveDeferredToolCall,
		detachPausedRovoToolCall,
		getRovoPool,
		isRovoAvailable,
		pausedRovoToolCallStore: _pausedRovoToolCallStore,
		refreshRovoAvailability,
		registerActiveDeferredToolCall,
		registerPausedRovoToolCall,
		resolveRovoAppPortAvailability,
		setStartNextQueuedRovoAppRun,
		shutdownRovoPool,
		takePausedRovoToolCall,
		waitForPortReady,
	} = createRovoRuntimeAvailabilityComposition({
		cancelPausedDeferredToolCallRecord,
		classifyRovoHealthCheck,
		createRovoPool,
		debugLog,
		getBasePort: getRovoBasePort,
		initPool,
		logger,
		projectRoot,
		resolveRovoPorts,
		rovoCancelChat,
		rovoHealthCheck,
	});
	const port = env.PORT || 8080;
	logger.log(`[STARTUP] Port configured: ${port}`);
	const sendGatewayErrorResponse = createGatewayErrorResponseSender({
		isChatInProgressError,
	});
	const activeRequests = new Map();
	const getListeningPidsForPort = createListeningPidReader();
	const resolvePreferredBackend = createPreferredBackendResolver({
		isRovoAvailable,
	});
	const {
		buildAIGatewaySystemPrompt,
		buildQuestionCardSkipNotification,
		buildUserMessage,
	} = loadRovoConfigBuilders({
		logger,
	});
	const {
		createChatSdkHandler,
		interactiveChatForcePortRecoveryMaxAttempts,
		interactiveChatForcePortRecoveryTimeoutMs,
		requestUserInputQuestionMetaStore: _requestUserInputQuestionMetaStore,
	} = createChatSdkServerComposition({
		waitForTurnTimeoutMs,
	});
	const {
		agentsRfpDemoJobOwner,
		gatewayTextGeneration,
		services: backendServices,
	} = createBackendServiceComposition({
		baseDir: path.join(backendDir, "data"),
		createRovoUnavailableError,
		debugLog,
		deleteRovoAppThreadBrowserWorkspace,
		destroyMirrorBrowser,
		executeRovoTask,
		generateTextViaRovo,
		logger,
		normalizeAIGatewayError,
		projectRoot,
		resolvePreferredBackend,
		streamViaRovo,
		waitForTurnTimeoutMs,
	});
	const {
		compressUiConversationHistory,
		generateSmartGenuiResult,
		generateTextViaGateway,
		mapUiMessagesToConversation,
		streamTextViaGateway,
	} = gatewayTextGeneration;
	const {
		agentsRfpDemoStateManager,
		aiGatewayProvider,
		rovoAppDocumentManager,
		rovoAppGeneratedFilesManager,
		rovoAppRunManager,
		rovoAppThreadManager,
		rovoAppUploadManager,
	} = backendServices;
	const resolveStageTraceFromRequest = createStageTraceFromRequestResolver({
		logger,
	});
	const {
		handleChatSdkRequest,
		rovoAppRuntime,
	} = createChatRuntimeComposition({
		_pausedRovoToolCallStore,
		activeRequests,
		agentsRfpDemoStateManager,
		updateAgentsRfpDemoState: agentsRfpDemoJobOwner.updateAgentsRfpDemoState,
		aiGatewayProvider,
		buildAIGatewaySystemPrompt,
		buildUserMessage,
		clearActiveDeferredToolCall,
		compressUiConversationHistory,
		createAbortControllerFromRequest,
		createChatSdkHandler,
		createRovoUnavailableError,
		createStageTrace,
		ensureRovoSession,
		generateSmartGenuiResult,
		generateTextViaGateway,
		getCurrentRovoSession,
		getListeningPidsForPort,
		hasGatewayUrlConfigured,
		isRovoAvailable,
		logger,
		mapUiMessagesToConversation,
		requestUserInputQuestionMetaStore: _requestUserInputQuestionMetaStore,
		refreshRovoAvailability,
		registerActiveDeferredToolCall,
		registerPausedRovoToolCall,
		replayViaRovo,
		resolvePreferredBackend,
		resolveRovoAppPortAvailability,
		resolveStageTraceFromRequest,
		rovoAppDocumentManager,
		rovoAppGeneratedFilesManager,
		rovoAppRunManager,
		rovoAppThreadManager,
		rovoAppUploadManager,
		rovoCancelChat,
		rovoHealthCheck,
		rovoResumeToolCalls,
		runRovoBackgroundTask,
		sendGatewayErrorResponse,
		setStartNextQueuedRovoAppRun,
		streamTextViaGateway,
		streamViaRovo,
		takePausedRovoToolCall,
	});
	const {
		app,
		isAllowedRuntimeSocketOrigin,
		isRuntimeSocketTokenValid,
		runtimeAdminRequired,
		runtimeAdminToken,
	} = createBackendApp(buildBackendAppDependencies({
		activeRequests,
		agentMode: {
			getAgentMode,
			setAgentMode,
		},
		agentsRfpDemoJobOwner,
		backendServices,
		browserWorkspace: {
			browserWorkspaceManager,
			chromiumPreviewManager,
			deleteThreadBrowserWorkspace: deleteRovoAppThreadBrowserWorkspace,
			destroyMirrorBrowser,
			ensureThreadBrowserWorkspace: ensureRovoAppThreadBrowserWorkspace,
			getMirrorBrowser,
			getThreadBrowserWorkspace: getRovoAppThreadBrowserWorkspace,
			isBrowserWorkspaceNotFoundError,
		},
		chatControl: {
			abortControllerFromRequest: createAbortControllerFromRequest,
			buildQuestionCardSkipNotification,
			buildUserMessage,
			cancelActiveDeferredToolCallRecord,
			cancelChat: rovoCancelChat,
			cancelPausedDeferredToolCallRecord,
			clearActiveDeferredToolCall,
			clearPlanSession,
			createRovoUnavailableError,
			detachPausedRovoToolCall,
			sendGatewayErrorResponse,
			streamChatViaRovo: streamViaRovo,
			waitForReady: waitForPortReady,
		},
		chatSdk: {
			handleChatSdkRequest,
		},
		collectUploadIdsFromMessages: collectRovoAppUploadIdsFromMessages,
		gatewayTextGeneration,
		rovoAppRuntime,
		runtime: {
			buildLlmRoutingStatus,
			buildRuntimeStatusSnapshot,
			debugLog,
			debugMode,
			getAiGatewayConfigReport,
			getEnvVars,
			hasGatewayUrlConfigured,
			isRovoAvailable,
			logger,
			runtimePort: port,
		},
		searchThreads,
	}));

	return {
		activeRequests,
		app,
		backendServices,
		debugMode,
		port,
		serverReadyDependencies: {
			buildLlmRoutingStatus,
			debugMode,
			describeChatBackend,
			getEnvVars,
			getRealtimeConfig,
			getRovoPool,
			hasGatewayUrlConfigured,
			interactiveChatForcePortRecoveryMaxAttempts,
			interactiveChatForcePortRecoveryTimeoutMs,
			logger,
			port,
			refreshRovoAvailability,
		},
		shutdownRuntime: () => {
			shutdownRovoPool();
		},
		webSocketRelayDependencies: {
			browserWorkspaceManager,
			debugMode,
			getMirrorBrowser,
			isAllowedRuntimeSocketOrigin,
			isRuntimeSocketTokenValid,
			runtimeAdminRequired,
			runtimeAdminToken,
		},
	};
}

module.exports = {
	createBackendRuntimeComposition,
	createDebugLogger,
};
