const express = require("express");
const {
	registerBodyLimitMiddleware,
} = require("./middleware/body-limits");
const {
	registerAiCostRateLimitMiddleware,
} = require("./middleware/rate-limit");
const {
	createRuntimeAdminControls,
} = require("./middleware/runtime-admin");
const {
	registerSecurityMiddleware,
} = require("./middleware/security");
const {
	registerPersonalGraphRoutes,
} = require("./routes/personal-graph");
const {
	registerStatusRoutes,
} = require("./routes/status");
const {
	registerVpkHtmlRoutes,
} = require("./routes/vpk-html");
const {
	registerHtmlSelectorRoutes,
} = require("./routes/html-selector");
const {
	registerMediaRoutes,
} = require("./routes/media");
const {
	registerOrchestratorRoutes,
} = require("./routes/orchestrator");
const {
	registerDemosRoutes,
} = require("./routes/demos");
const {
	registerBrowserWorkspacesRoutes,
} = require("./routes/browser-workspaces");
const {
	registerChromiumPreviewRoutes,
} = require("./routes/chromium-preview");
const {
	registerRovoAppRoutes,
} = require("./routes/rovo-app");
const {
	registerRovoChatProxyRoutes,
} = require("./routes/rovo-chat-proxy");
const {
	registerRealtimeRoutes,
} = require("./routes/realtime");
const {
	registerAiUtilitiesRoutes,
} = require("./routes/ai-utilities");
const {
	registerChatControlRoutes,
} = require("./routes/chat-control");
const {
	registerChatSdkRoutes,
} = require("./routes/chat-sdk");
const {
	registerChatSkipQuestionRoutes,
} = require("./routes/chat-skip-question");
const {
	registerAgentModeRoutes,
} = require("./routes/agent-mode");
const {
	registerGenuiRoutes,
} = require("./routes/genui");

function createBackendApp(dependencies = {}, options = {}) {
	const {
		expressImpl = express,
		logger = console,
	} = dependencies;
	const {
		createRuntimeAdmin = createRuntimeAdminControls,
		registerAiCostRateLimit = registerAiCostRateLimitMiddleware,
		registerBodyLimit = registerBodyLimitMiddleware,
		registerRoutes = registerBackendAppRoutes,
		registerSecurity = registerSecurityMiddleware,
	} = options;

	const app = expressImpl();
	const { allowedOrigins } = registerSecurity(app);
	const runtimeAdminControls = createRuntimeAdmin({ allowedOrigins });

	registerAiCostRateLimit(app);
	registerBodyLimit(app, { expressImpl });

	logger.log("[STARTUP] Middleware configured");

	registerRoutes(app, {
		...dependencies,
		...runtimeAdminControls,
	});

	return {
		app,
		allowedOrigins,
		...runtimeAdminControls,
	};
}

function registerBackendAppRoutes(app, dependencies = {}) {
	const {
		abortControllerFromRequest,
		activeRequests,
		advanceAgentsRfpDemoProcessing,
		agentsRfpDemoStateManager,
		appendRuntimeSocketToken,
		browserWorkspaceManager,
		buildLlmRoutingStatus,
		buildQuestionCardSkipNotification,
		buildRuntimeStatusSnapshot,
		buildUserMessage,
		cancelActiveDeferredToolCallRecord,
		cancelChat,
		cancelPausedDeferredToolCallRecord,
		checkpointManager,
		chromiumPreviewManager,
		clearActiveDeferredToolCall,
		clearPlanSession,
		clearRunState,
		collectUploadIdsFromMessages,
		createRovoUnavailableError,
		createRuntimeSocketToken,
		debugLog,
		debugMode,
		deleteAgentsRfpDemoThread,
		deleteThreadBrowserWorkspace,
		destroyMirrorBrowser,
		detachPausedRovoToolCall,
		ensureThreadBrowserWorkspace,
		generateAgentDataFlowText,
		generateAgentsRfpDemoReportPreview,
		generatedFilesManager,
		generateSuggestedQuestions,
		generateTextViaGateway,
		getAiGatewayConfigReport,
		getAgentMode,
		getEnvVars,
		getMirrorBrowser,
		getThreadBrowserWorkspace,
		handleChatSdkRequest,
		hasGatewayUrlConfigured,
		isBrowserWorkspaceNotFoundError,
		isRovoAvailable,
		logger = console,
		maybeMigratePersistedThreadBrowserScreenshots,
		orchestratorLog,
		persistMessageFiles,
		persistRunState,
		proxyRovoAppChatRequest,
		reconcileOrphanedThread,
		requireRuntimeAdmin,
		requireRuntimeSocketTokenRequester,
		rovoAppDocumentManager,
		rovoAppRunManager,
		rovoAppThreadManager,
		rovoAppUploadManager,
		rovoAppVoteManager,
		runtimePort,
		runtimeSocketTokenTtlMs,
		runAgentsRfpDemoJob,
		resetAgentsRfpDemo,
		saveAgentsRfpDemoState,
		handleAgentsRfpDemoTicketEvent,
		searchThreads,
		sendGatewayErrorResponse,
		setAgentMode,
		startNextQueuedRun,
		streamChatViaRovo,
		waitForReady,
	} = dependencies;

	registerAiUtilitiesRoutes(app, {
		abortControllerFromRequest,
		generateAgentDataFlowText,
		generateSuggestedQuestions,
		generateTextViaGateway,
		sendGatewayErrorResponse,
	});

	registerVpkHtmlRoutes(app);
	registerHtmlSelectorRoutes(app);

	registerDemosRoutes(app, {
		advanceAgentsRfpDemoProcessing,
		agentsRfpDemoStateManager,
		deleteAgentsRfpDemoThread,
		generateAgentsRfpDemoReportPreview,
		runAgentsRfpDemoJob,
		resetAgentsRfpDemo,
		saveAgentsRfpDemoState,
		handleAgentsRfpDemoTicketEvent,
	});

	registerChatSdkRoutes(app, {
		handleChatSdkRequest,
	});

	registerChatControlRoutes(app, {
		activeRequests,
		cancelActiveDeferredToolCallRecord,
		cancelChat,
		cancelPausedDeferredToolCallRecord,
		clearActiveDeferredToolCall,
		clearPlanSession,
		detachPausedRovoToolCall,
		logger,
		waitForReady,
	});

	registerAgentModeRoutes(app, {
		createRovoUnavailableError,
		getAgentMode,
		isRovoAvailable,
		logger,
		setAgentMode,
	});

	registerChatSkipQuestionRoutes(app, {
		buildQuestionCardSkipNotification,
		buildUserMessage,
		logger,
		streamChatViaRovo,
	});

	registerGenuiRoutes(app, {
		isRovoAvailable,
		logger,
	});

	registerMediaRoutes(app);

	registerBrowserWorkspacesRoutes(app, {
		appendRuntimeSocketToken,
		browserWorkspaceManager,
		getMirrorBrowser,
		isBrowserWorkspaceNotFoundError,
		requireRuntimeAdmin,
		runtimePort,
	});

	registerChromiumPreviewRoutes(app, {
		chromiumPreviewManager,
	});

	registerRovoChatProxyRoutes(app, {
		logger,
		proxyRovoAppChatRequest,
		sendGatewayErrorResponse,
	});

	registerRovoAppRoutes(app, {
		cancelChat,
		checkpointManager,
		clearRunState,
		collectUploadIdsFromMessages,
		deleteThreadBrowserWorkspace,
		destroyMirrorBrowser,
		ensureThreadBrowserWorkspace,
		generatedFilesManager,
		getThreadBrowserWorkspace,
		maybeMigratePersistedThreadBrowserScreenshots,
		persistMessageFiles,
		persistRunState,
		reconcileOrphanedThread,
		requireRuntimeAdmin,
		rovoAppDocumentManager,
		rovoAppRunManager,
		rovoAppThreadManager,
		rovoAppUploadManager,
		rovoAppVoteManager,
		searchThreads,
		startNextQueuedRun,
	});

	registerOrchestratorRoutes(app, {
		orchestratorLog,
		requireRuntimeAdmin,
	});

	registerStatusRoutes(app, {
		buildRuntimeStatusSnapshot,
		buildLlmRoutingStatus,
		debugLog,
		debugMode,
		getAiGatewayConfigReport,
		getEnvVars,
		hasGatewayUrlConfigured,
		isRovoAvailable,
	});



	registerPersonalGraphRoutes(app);


	registerRealtimeRoutes(app, {
		createRuntimeSocketToken,
		requireRuntimeSocketTokenRequester,
		runtimeSocketTokenTtlMs,
	});
}

module.exports = {
	createBackendApp,
	registerBackendAppRoutes,
};
