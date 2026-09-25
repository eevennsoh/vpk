"use strict";

const {
	createAgentsRfpDemoChatStreamOwner: defaultCreateAgentsRfpDemoChatStreamOwner,
} = require("./agents-rfp-demo-chat-stream");
const {
	createRovoAppMessageFilePersistence: defaultCreateRovoAppMessageFilePersistence,
} = require("./rovo-app-upload-helpers");
const {
	createRovoAppManagedResponseConsumer: defaultCreateRovoAppManagedResponseConsumer,
} = require("./rovo-app-managed-response-consumer");
const {
	createRovoAppManagedRunRequestPreparer: defaultCreateRovoAppManagedRunRequestPreparer,
} = require("./rovo-app-managed-run-preparation");
const {
	createRovoAppManagedRunRouteResolver: defaultCreateRovoAppManagedRunRouteResolver,
} = require("./rovo-app-managed-run-routing");
const {
	createRovoAppManagedRunChatDispatcher: defaultCreateRovoAppManagedRunChatDispatcher,
} = require("./rovo-app-managed-run-chat-dispatch");
const {
	createRovoAppManagedRunArtifactRouter: defaultCreateRovoAppManagedRunArtifactRouter,
} = require("./rovo-app-managed-run-artifact-route");
const {
	createRovoAppManagedRunResponseCompleter: defaultCreateRovoAppManagedRunResponseCompleter,
} = require("./rovo-app-managed-run-response-completion");
const {
	createRovoAppManagedRunExecutor: defaultCreateRovoAppManagedRunExecutor,
} = require("./rovo-app-managed-run-executor");
const {
	createRovoAppManagedRunLifecycle: defaultCreateRovoAppManagedRunLifecycle,
} = require("./rovo-app-managed-run-lifecycle");
const {
	createRovoAppManagedRunProxy: defaultCreateRovoAppManagedRunProxy,
} = require("./rovo-app-managed-run-proxy");
const {
	createRovoAppRunStateService: defaultCreateRovoAppRunStateService,
} = require("./rovo-app-run-state");
const {
	createRovoAppThreadSessionSync: defaultCreateRovoAppThreadSessionSync,
} = require("./rovo-app-thread-session-sync");
const {
	createRovoAppArtifactGenerationService: defaultCreateRovoAppArtifactGenerationService,
} = require("./rovo-app-artifact-generation");
const {
	createRovoAppArtifactToolResponseStreamer: defaultCreateRovoAppArtifactToolResponseStreamer,
} = require("./rovo-app-artifact-tool-response");
const {
	createRovoAppArtifactToolRequestHandler: defaultCreateRovoAppArtifactToolRequestHandler,
} = require("./rovo-app-artifact-tool-request");
const {
	createChatGenerationHelpers: defaultCreateChatGenerationHelpers,
} = require("../chat/generation-helpers");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppRuntimeComposition requires ${name}`);
	}
	return value;
}

function requireObject(name, value) {
	if (!value || typeof value !== "object") {
		throw new Error(`createRovoAppRuntimeComposition requires ${name}`);
	}
	return value;
}

function createRovoAppRuntimeComposition({
	activeRequests,
	agentsRfpDemoStateManager,
	updateAgentsRfpDemoState,
	aiGatewayProvider,
	compressUiConversationHistory,
	createStageTrace,
	dispatchChatSdkRequestInProcess,
	ensureRovoSession,
	generateTextViaGateway,
	getCurrentRovoSession,
	hasGatewayUrlConfigured,
	isRovoAvailable,
	logger = console,
	mapUiMessagesToConversation,
	requestUserInputQuestionMetaStore,
	resolveRovoAppPortAvailability,
	rovoAppDocumentManager,
	rovoAppGeneratedFilesManager,
	rovoAppRunManager,
	rovoAppThreadManager,
	rovoAppUploadManager,
	rovoCancelChat,
	runRovoBackgroundTask,
	streamTextViaGateway,
} = {}, factories = {}) {
	const {
		createAgentsRfpDemoChatStreamOwner = defaultCreateAgentsRfpDemoChatStreamOwner,
		createChatGenerationHelpers = defaultCreateChatGenerationHelpers,
		createRovoAppArtifactGenerationService = defaultCreateRovoAppArtifactGenerationService,
		createRovoAppArtifactToolRequestHandler = defaultCreateRovoAppArtifactToolRequestHandler,
		createRovoAppArtifactToolResponseStreamer = defaultCreateRovoAppArtifactToolResponseStreamer,
		createRovoAppManagedResponseConsumer = defaultCreateRovoAppManagedResponseConsumer,
		createRovoAppManagedRunArtifactRouter = defaultCreateRovoAppManagedRunArtifactRouter,
		createRovoAppManagedRunChatDispatcher = defaultCreateRovoAppManagedRunChatDispatcher,
		createRovoAppManagedRunExecutor = defaultCreateRovoAppManagedRunExecutor,
		createRovoAppManagedRunLifecycle = defaultCreateRovoAppManagedRunLifecycle,
		createRovoAppManagedRunProxy = defaultCreateRovoAppManagedRunProxy,
		createRovoAppManagedRunRequestPreparer = defaultCreateRovoAppManagedRunRequestPreparer,
		createRovoAppManagedRunResponseCompleter = defaultCreateRovoAppManagedRunResponseCompleter,
		createRovoAppManagedRunRouteResolver = defaultCreateRovoAppManagedRunRouteResolver,
		createRovoAppMessageFilePersistence = defaultCreateRovoAppMessageFilePersistence,
		createRovoAppRunStateService = defaultCreateRovoAppRunStateService,
		createRovoAppThreadSessionSync = defaultCreateRovoAppThreadSessionSync,
	} = factories;

	requireObject("activeRequests", activeRequests);
	requireObject("aiGatewayProvider", aiGatewayProvider);
	requireObject("rovoAppDocumentManager", rovoAppDocumentManager);
	requireObject("rovoAppGeneratedFilesManager", rovoAppGeneratedFilesManager);
	requireObject("rovoAppRunManager", rovoAppRunManager);
	requireObject("rovoAppThreadManager", rovoAppThreadManager);
	requireObject("rovoAppUploadManager", rovoAppUploadManager);
	requireFunction("compressUiConversationHistory", compressUiConversationHistory);
	requireFunction("updateAgentsRfpDemoState", updateAgentsRfpDemoState);
	requireFunction("createStageTrace", createStageTrace);
	requireFunction("dispatchChatSdkRequestInProcess", dispatchChatSdkRequestInProcess);
	requireFunction("ensureRovoSession", ensureRovoSession);
	requireFunction("generateTextViaGateway", generateTextViaGateway);
	requireFunction("getCurrentRovoSession", getCurrentRovoSession);
	requireFunction("hasGatewayUrlConfigured", hasGatewayUrlConfigured);
	requireFunction("isRovoAvailable", isRovoAvailable);
	requireFunction("mapUiMessagesToConversation", mapUiMessagesToConversation);
	requireFunction("resolveRovoAppPortAvailability", resolveRovoAppPortAvailability);
	requireFunction("rovoCancelChat", rovoCancelChat);
	requireFunction("runRovoBackgroundTask", runRovoBackgroundTask);
	requireFunction("streamTextViaGateway", streamTextViaGateway);

	const {
		buildArtifactPreviewSummary,
		generatePlanMetadataViaGateway,
		generateSuggestedQuestions,
		withStudioAgentGatewayFallbackTimeout,
	} = createChatGenerationHelpers({
		aiGatewayProvider,
		generateTextViaGateway,
		hasGatewayUrlConfigured,
		logger,
	});

	const {
		maybeMigratePersistedThreadBrowserScreenshots: maybeMigratePersistedRovoAppThreadBrowserScreenshots,
		persistBrowserScreenshotBuffer: persistRovoAppBrowserScreenshotBuffer,
		persistMessageFiles: persistRovoAppMessageFiles,
		synchronizeThreadGeneratedFiles: synchronizeRovoAppThreadGeneratedFiles,
	} = createRovoAppMessageFilePersistence({
		rovoAppGeneratedFilesManager,
		rovoAppThreadManager,
		rovoAppUploadManager,
	});

	let startNextQueuedRovoAppRun = () => {};
	const {
		clearRovoAppRunState,
		finalizeRovoAppRun,
		persistRovoAppRunBackend,
		persistRovoAppRunMessagesSnapshot,
		persistRovoAppRunState,
		reconcileOrphanedRovoAppThread,
	} = createRovoAppRunStateService({
		activeRequests,
		rovoAppRunManager,
		rovoAppThreadManager,
		startNextQueuedRun: () => startNextQueuedRovoAppRun(),
		synchronizeRovoAppThreadGeneratedFiles,
	});

	const {
		generateRovoAppArtifactText,
		generateRovoAppArtifactTitleFromContent,
		resolveRovoAppArtifactDecision,
		resolveRovoAppArtifactKind,
	} = createRovoAppArtifactGenerationService({
		aiGatewayProvider,
		generateTextViaGateway,
		rovoCancelChat,
		streamTextViaGateway,
	});

	const {
		streamRovoAppArtifactToolResponse,
	} = createRovoAppArtifactToolResponseStreamer({
		generateRovoAppArtifactText,
		generateRovoAppArtifactTitleFromContent,
		generateSuggestedQuestions,
		generateTextViaGateway,
		rovoAppDocumentManager,
		rovoAppThreadManager,
	});

	const {
		handleRovoAppArtifactToolRequest,
	} = createRovoAppArtifactToolRequestHandler({
		mapUiMessagesToConversation,
		resolveRovoAppArtifactDecision,
		resolveRovoAppArtifactKind,
		rovoAppDocumentManager,
		rovoAppThreadManager,
		streamRovoAppArtifactToolResponse,
	});

	const {
		syncRovoAppThreadSession,
		syncRovoAppThreadSessionFromCurrentPort,
	} = createRovoAppThreadSessionSync({
		ensureRovoSession,
		getCurrentRovoSession,
		logger,
		rovoAppThreadManager,
	});

	const {
		consumeRovoAppManagedResponse,
	} = createRovoAppManagedResponseConsumer({
		finalizeRovoAppRun,
		mapUiMessagesToConversation,
		persistRovoAppRunMessagesSnapshot,
		persistRovoAppRunState,
		rovoAppRunManager,
		rovoAppThreadManager,
		syncRovoAppThreadSession,
	});

	const {
		prepareRovoAppManagedRunRequest,
	} = createRovoAppManagedRunRequestPreparer({
		compressUiConversationHistory,
		mapUiMessagesToConversation,
		rovoAppDocumentManager,
		rovoAppThreadManager,
		runRovoBackgroundTask,
	});

	const {
		resolveRovoAppManagedRunRoute,
	} = createRovoAppManagedRunRouteResolver({
		generateTextViaGateway,
		logger,
	});

	const {
		dispatchRovoAppManagedRunChat,
	} = createRovoAppManagedRunChatDispatcher({
		dispatchChatSdkRequestInProcess,
		isRovoAvailable,
		persistRovoAppRunBackend,
	});

	const {
		handleRovoAppManagedRunArtifactRoute,
	} = createRovoAppManagedRunArtifactRouter({
		consumeRovoAppManagedResponse,
		handleRovoAppArtifactToolRequest,
		isRovoAvailable,
		persistRovoAppRunBackend,
	});

	const {
		completeRovoAppManagedRunResponse,
	} = createRovoAppManagedRunResponseCompleter({
		consumeRovoAppManagedResponse,
	});

	const {
		executeRovoAppManagedRun,
	} = createRovoAppManagedRunExecutor({
		completeRovoAppManagedRunResponse,
		createStageTrace,
		dispatchRovoAppManagedRunChat,
		handleRovoAppManagedRunArtifactRoute,
		logger,
		prepareRovoAppManagedRunRequest,
		resolveRovoAppManagedRunRoute,
	});

	const rovoAppManagedRunLifecycle = createRovoAppManagedRunLifecycle({
		activeRequests,
		clearRovoAppRunState,
		executeRovoAppManagedRun,
		logger,
		persistRovoAppRunState,
		resolveRovoAppPortAvailability,
		rovoAppRunManager,
	});
	const {
		startManagedRovoAppRun,
		startNextQueuedRovoAppRun: resolvedStartNextQueuedRovoAppRun,
	} = rovoAppManagedRunLifecycle;
	startNextQueuedRovoAppRun = resolvedStartNextQueuedRovoAppRun;

	const agentsRfpDemoChatStreamOwner = createAgentsRfpDemoChatStreamOwner({
		agentsRfpDemoStateManager,
		updateAgentsRfpDemoState,
		generateTextViaGateway,
		requestUserInputQuestionMetaStore,
		rovoAppDocumentManager,
		rovoAppThreadManager,
	});

	const {
		proxyRovoAppChatRequest,
	} = createRovoAppManagedRunProxy({
		agentsRfpDemoChatStreamOwner,
		clearRovoAppRunState,
		logger,
		persistRovoAppRunState,
		rovoAppRunManager,
		rovoCancelChat,
		startManagedRovoAppRun,
	});

	return {
		agentsRfpDemoChatStreamOwner,
		buildArtifactPreviewSummary,
		clearRovoAppRunState,
		generatePlanMetadataViaGateway,
		generateSuggestedQuestions,
		handleRovoAppArtifactToolRequest,
		maybeMigratePersistedRovoAppThreadBrowserScreenshots,
		persistRovoAppBrowserScreenshotBuffer,
		persistRovoAppMessageFiles,
		persistRovoAppRunState,
		proxyRovoAppChatRequest,
		reconcileOrphanedRovoAppThread,
		startNextQueuedRovoAppRun,
		syncRovoAppThreadSessionFromCurrentPort,
		withStudioAgentGatewayFallbackTimeout,
	};
}

module.exports = {
	createRovoAppRuntimeComposition,
};
