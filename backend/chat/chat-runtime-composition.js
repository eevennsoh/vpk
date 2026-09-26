"use strict";

const {
	dispatchInProcessHttpRequest: defaultDispatchInProcessHttpRequest,
} = require("../lib/in-process-http");
const {
	createRovoAppRuntimeComposition: defaultCreateRovoAppRuntimeComposition,
} = require("../lib/rovo-app-runtime-composition");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createChatRuntimeComposition requires ${name}`);
	}
	return value;
}

function createChatRuntimeComposition({
	_pausedRovoToolCallStore,
	activeRequests,
	agentsRfpDemoStateManager,
	updateAgentsRfpDemoState,
	aiGatewayProvider,
	buildAIGatewaySystemPrompt,
	buildUserMessage,
	clearActiveDeferredToolCall,
	compressUiConversationHistory,
	createAbortControllerFromRequest,
	createChatSdkHandler,
	createRovoAppRuntimeComposition = defaultCreateRovoAppRuntimeComposition,
	createRovoUnavailableError,
	createStageTrace,
	dispatchInProcessHttpRequest = defaultDispatchInProcessHttpRequest,
	ensureRovoSession,
	generateSmartGenuiResult,
	generateTextViaGateway,
	getCurrentRovoSession,
	getListeningPidsForPort,
	hasGatewayUrlConfigured,
	isRovoAvailable,
	logger = console,
	mapUiMessagesToConversation,
	refreshRovoAvailability,
	registerActiveDeferredToolCall,
	registerPausedRovoToolCall,
	replayViaRovo,
	requestUserInputQuestionMetaStore,
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
} = {}) {
	requireFunction("createChatSdkHandler", createChatSdkHandler);
	requireFunction("updateAgentsRfpDemoState", updateAgentsRfpDemoState);
	requireFunction("createRovoAppRuntimeComposition", createRovoAppRuntimeComposition);
	requireFunction("dispatchInProcessHttpRequest", dispatchInProcessHttpRequest);
	requireFunction("setStartNextQueuedRovoAppRun", setStartNextQueuedRovoAppRun);

	let handleChatSdkRequest;

	async function dispatchChatSdkRequestInProcess({
		body,
		headers,
		protocol = "http",
		signal,
	}) {
		return dispatchInProcessHttpRequest({
			body,
			handleRequest: handleChatSdkRequest,
			headers,
			protocol,
			signal,
		});
	}

	const rovoAppRuntime = createRovoAppRuntimeComposition({
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
		logger,
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
	});

	setStartNextQueuedRovoAppRun(rovoAppRuntime.startNextQueuedRovoAppRun);

	handleChatSdkRequest = createChatSdkHandler({
		_pausedRovoToolCallStore,
		activeRequests,
		buildAIGatewaySystemPrompt,
		buildArtifactPreviewSummary: rovoAppRuntime.buildArtifactPreviewSummary,
		buildUserMessage,
		clearActiveDeferredToolCall,
		compressUiConversationHistory,
		createAbortControllerFromRequest,
		createRovoUnavailableError,
		generatePlanMetadataViaGateway: rovoAppRuntime.generatePlanMetadataViaGateway,
		generateSmartGenuiResult,
		generateTextViaGateway,
		getListeningPidsForPort,
		handleRovoAppArtifactToolRequest: rovoAppRuntime.handleRovoAppArtifactToolRequest,
		mapUiMessagesToConversation,
		persistRovoAppBrowserScreenshotBuffer: rovoAppRuntime.persistRovoAppBrowserScreenshotBuffer,
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
		streamTextViaGateway,
		streamViaRovo,
		syncRovoAppThreadSessionFromCurrentPort: rovoAppRuntime.syncRovoAppThreadSessionFromCurrentPort,
		takePausedRovoToolCall,
		withStudioAgentGatewayFallbackTimeout: rovoAppRuntime.withStudioAgentGatewayFallbackTimeout,
	});

	return {
		buildArtifactPreviewSummary: rovoAppRuntime.buildArtifactPreviewSummary,
		dispatchChatSdkRequestInProcess,
		generatePlanMetadataViaGateway: rovoAppRuntime.generatePlanMetadataViaGateway,
		handleChatSdkRequest,
		handleRovoAppArtifactToolRequest: rovoAppRuntime.handleRovoAppArtifactToolRequest,
		persistRovoAppBrowserScreenshotBuffer: rovoAppRuntime.persistRovoAppBrowserScreenshotBuffer,
		rovoAppRuntime,
		syncRovoAppThreadSessionFromCurrentPort: rovoAppRuntime.syncRovoAppThreadSessionFromCurrentPort,
		withStudioAgentGatewayFallbackTimeout: rovoAppRuntime.withStudioAgentGatewayFallbackTimeout,
	};
}

module.exports = {
	createChatRuntimeComposition,
};
