"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
	createBackendRuntimeComposition,
	createDebugLogger,
} = require("./server-runtime-composition");

function createNamedFunction(name, calls, result) {
	return (...args) => {
		calls.push([name, ...args]);
		return typeof result === "function" ? result(...args) : result;
	};
}

test("createDebugLogger only logs when debug mode is enabled", () => {
	const logs = [];
	const logger = {
		log: (...args) => logs.push(args),
	};

	createDebugLogger({ debugMode: false, logger })("runtime", "hidden", { ok: false });
	createDebugLogger({ debugMode: true, logger })("runtime", "ready", { ok: true });

	assert.deepEqual(logs, [
		["[DEBUG][runtime] ready", JSON.stringify({ ok: true }, null, 2)],
	]);
});

test("createBackendRuntimeComposition wires runtime owners into app, startup, ws, and shutdown bundles", () => {
	const calls = [];
	const backendDir = path.join("/tmp", "vpk-backend");
	const projectRoot = path.join("/tmp", "vpk");
	const logger = {
		error: createNamedFunction("logger.error", calls),
		log: createNamedFunction("logger.log", calls),
	};
	const activeRuntime = {
		clearActiveDeferredToolCall: createNamedFunction("clearActiveDeferredToolCall", calls),
		detachPausedRovoToolCall: createNamedFunction("detachPausedRovoToolCall", calls),
		getRovoPool: createNamedFunction("getRovoPool", calls),
		isRovoAvailable: createNamedFunction("isRovoAvailable", calls, true),
		pausedRovoToolCallStore: { owner: "paused-rovo-tool-calls" },
		refreshRovoAvailability: createNamedFunction("refreshRovoAvailability", calls),
		registerActiveDeferredToolCall: createNamedFunction("registerActiveDeferredToolCall", calls),
		registerPausedRovoToolCall: createNamedFunction("registerPausedRovoToolCall", calls),
		resolveRovoAppPortAvailability: createNamedFunction("resolveRovoAppPortAvailability", calls),
		setStartNextQueuedRovoAppRun: createNamedFunction("setStartNextQueuedRovoAppRun", calls),
		shutdownRovoPool: createNamedFunction("shutdownRovoPool", calls),
		takePausedRovoToolCall: createNamedFunction("takePausedRovoToolCall", calls),
		waitForPortReady: createNamedFunction("waitForPortReady", calls),
	};
	const backendServices = {
		agentsRfpDemoStateManager: { owner: "rfp-state" },
		aiGatewayProvider: { owner: "gateway" },
		rovoAppDocumentManager: { owner: "documents" },
		rovoAppGeneratedFilesManager: { owner: "generated-files" },
		rovoAppRunManager: { owner: "runs" },
		rovoAppThreadManager: { owner: "threads" },
		rovoAppUploadManager: { owner: "uploads" },
	};
	const gatewayTextGeneration = {
		compressUiConversationHistory: createNamedFunction("compressUiConversationHistory", calls),
		generateSmartGenuiResult: createNamedFunction("generateSmartGenuiResult", calls),
		generateTextViaGateway: createNamedFunction("generateTextViaGateway", calls),
		mapUiMessagesToConversation: createNamedFunction("mapUiMessagesToConversation", calls),
		streamTextViaGateway: createNamedFunction("streamTextViaGateway", calls),
	};
	const agentsRfpDemoJobOwner = {
		updateAgentsRfpDemoState: async (updater) => updater({}),
		advanceAgentsRfpDemoProcessing: createNamedFunction("advanceAgentsRfpDemoProcessing", calls),
		deleteAgentsRfpDemoThread: createNamedFunction("deleteAgentsRfpDemoThread", calls),
		runAgentsRfpDemoJob: createNamedFunction("runAgentsRfpDemoJob", calls),
	};
	const handleChatSdkRequest = createNamedFunction("handleChatSdkRequest", calls);
	const rovoAppRuntime = {
		proxyRovoAppChatRequest: createNamedFunction("proxyRovoAppChatRequest", calls),
	};
	const app = {
		owner: "express-app",
	};
	const runtimeControls = {
		isAllowedRuntimeSocketOrigin: createNamedFunction("isAllowedRuntimeSocketOrigin", calls),
		isRuntimeSocketTokenValid: createNamedFunction("isRuntimeSocketTokenValid", calls),
		runtimeAdminRequired: true,
		runtimeAdminToken: "runtime-token",
	};
	let serviceInput;
	let chatInput;
	let appDependencyInput;
	let createBackendAppInput;

	const result = createBackendRuntimeComposition({
		backendDir,
		env: {
			DEBUG: "true",
			PORT: "9191",
		},
		logger,
		projectRoot,
	}, {
		browserWorkspaceManager: { owner: "browser-workspaces" },
		buildBackendAppDependencies: (input) => {
			appDependencyInput = input;
			return { dependencyToken: true };
		},
		buildLlmRoutingStatus: createNamedFunction("buildLlmRoutingStatus", calls),
		buildRuntimeStatusSnapshot: createNamedFunction("buildRuntimeStatusSnapshot", calls),
		cancelActiveDeferredToolCallRecord: createNamedFunction("cancelActiveDeferredToolCallRecord", calls),
		cancelPausedDeferredToolCallRecord: createNamedFunction("cancelPausedDeferredToolCallRecord", calls),
		chromiumPreviewManager: { owner: "chromium-preview" },
		classifyRovoHealthCheck: createNamedFunction("classifyRovoHealthCheck", calls),
		clearPlanSession: createNamedFunction("clearPlanSession", calls),
		collectRovoAppUploadIdsFromMessages: createNamedFunction("collectRovoAppUploadIdsFromMessages", calls),
		createAbortControllerFromRequest: createNamedFunction("createAbortControllerFromRequest", calls),
		createBackendApp: (input) => {
			createBackendAppInput = input;
			return {
				app,
				...runtimeControls,
			};
		},
		createBackendServiceComposition: (input) => {
			serviceInput = input;
			return {
				agentsRfpDemoJobOwner,
				gatewayTextGeneration,
				services: backendServices,
			};
		},
		createChatRuntimeComposition: (input) => {
			chatInput = input;
			return {
				handleChatSdkRequest,
				rovoAppRuntime,
			};
		},
		createChatSdkServerComposition: () => ({
			createChatSdkHandler: createNamedFunction("createChatSdkHandler", calls),
			interactiveChatForcePortRecoveryMaxAttempts: 3,
			interactiveChatForcePortRecoveryTimeoutMs: 4000,
			requestUserInputQuestionMetaStore: { owner: "question-meta" },
		}),
		createGatewayErrorResponseSender: () => createNamedFunction("sendGatewayErrorResponse", calls),
		createListeningPidReader: () => createNamedFunction("getListeningPidsForPort", calls),
		createPreferredBackendResolver: () => createNamedFunction("resolvePreferredBackend", calls),
		createRovoPool: createNamedFunction("createRovoPool", calls),
		createRovoRuntimeAvailabilityComposition: (input) => {
			assert.equal(input.projectRoot, projectRoot);
			return activeRuntime;
		},
		createRovoUnavailableError: createNamedFunction("createRovoUnavailableError", calls),
		createStageTrace: createNamedFunction("createStageTrace", calls),
		createStageTraceFromRequestResolver: () => createNamedFunction("resolveStageTraceFromRequest", calls),
		deleteRovoAppThreadBrowserWorkspace: createNamedFunction("deleteThreadBrowserWorkspace", calls),
		describeChatBackend: createNamedFunction("describeChatBackend", calls),
		destroyMirrorBrowser: createNamedFunction("destroyMirrorBrowser", calls),
		ensureRovoAppThreadBrowserWorkspace: createNamedFunction("ensureThreadBrowserWorkspace", calls),
		ensureRovoSession: createNamedFunction("ensureRovoSession", calls),
		executeRovoTask: createNamedFunction("executeRovoTask", calls),
		generateTextViaRovo: createNamedFunction("generateTextViaRovo", calls),
		getAgentMode: createNamedFunction("getAgentMode", calls),
		getAiGatewayConfigReport: createNamedFunction("getAiGatewayConfigReport", calls),
		getCurrentRovoSession: createNamedFunction("getCurrentRovoSession", calls),
		getEnvVars: createNamedFunction("getEnvVars", calls),
		getMirrorBrowser: createNamedFunction("getMirrorBrowser", calls),
		getRealtimeConfig: createNamedFunction("getRealtimeConfig", calls),
		getRovoAppThreadBrowserWorkspace: createNamedFunction("getThreadBrowserWorkspace", calls),
		getRovoBasePort: createNamedFunction("getRovoBasePort", calls),
		hasGatewayUrlConfigured: createNamedFunction("hasGatewayUrlConfigured", calls),
		initPool: createNamedFunction("initPool", calls),
		isBrowserWorkspaceNotFoundError: createNamedFunction("isBrowserWorkspaceNotFoundError", calls),
		isChatInProgressError: createNamedFunction("isChatInProgressError", calls),
		loadRovoConfigBuilders: () => ({
			buildAIGatewaySystemPrompt: createNamedFunction("buildAIGatewaySystemPrompt", calls),
			buildQuestionCardSkipNotification: createNamedFunction("buildQuestionCardSkipNotification", calls),
			buildUserMessage: createNamedFunction("buildUserMessage", calls),
		}),
		normalizeAIGatewayError: createNamedFunction("normalizeAIGatewayError", calls),
		replayViaRovo: createNamedFunction("replayViaRovo", calls),
		resolveRovoPorts: createNamedFunction("resolveRovoPorts", calls),
		rovoCancelChat: createNamedFunction("rovoCancelChat", calls),
		rovoHealthCheck: createNamedFunction("rovoHealthCheck", calls),
		rovoResumeToolCalls: createNamedFunction("rovoResumeToolCalls", calls),
		runRovoBackgroundTask: createNamedFunction("runRovoBackgroundTask", calls),
		searchThreads: createNamedFunction("searchThreads", calls),
		setAgentMode: createNamedFunction("setAgentMode", calls),
		streamViaRovo: createNamedFunction("streamViaRovo", calls),
		waitForTurnTimeoutMs: 1234,
	});

	assert.equal(result.app, app);
	assert.equal(result.port, "9191");
	assert.equal(result.backendServices, backendServices);
	assert.equal(result.serverReadyDependencies.port, "9191");
	assert.equal(result.serverReadyDependencies.debugMode, true);
	assert.equal(result.webSocketRelayDependencies.runtimeAdminRequired, true);
	assert.equal(result.webSocketRelayDependencies.runtimeAdminToken, "runtime-token");
	assert.equal(createBackendAppInput.dependencyToken, true);
	assert.equal(serviceInput.baseDir, path.join(backendDir, "data"));
	assert.equal(chatInput.activeRequests, appDependencyInput.activeRequests);
	assert.equal(chatInput.updateAgentsRfpDemoState, agentsRfpDemoJobOwner.updateAgentsRfpDemoState);
	assert.equal(chatInput.rovoAppThreadManager, backendServices.rovoAppThreadManager);
	assert.equal(appDependencyInput.chatSdk.handleChatSdkRequest, handleChatSdkRequest);
	assert.equal(appDependencyInput.rovoAppRuntime, rovoAppRuntime);
	assert.equal(appDependencyInput.runtime.debugMode, true);
	assert.equal(appDependencyInput.runtime.runtimePort, "9191");
	assert.equal(appDependencyInput.runtime.logger, logger);

	appDependencyInput.runtime.debugLog("runtime", "composed", { ok: true });
	result.shutdownRuntime();

	assert.ok(calls.some((call) => call[0] === "shutdownRovoPool"));
	assert.ok(calls.some((call) => {
		return call[0] === "logger.log" &&
			call[1] === "[DEBUG][runtime] composed" &&
			call[2] === JSON.stringify({ ok: true }, null, 2);
	}));
});
