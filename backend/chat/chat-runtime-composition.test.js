"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createChatRuntimeComposition,
} = require("./chat-runtime-composition");

function createDependencies(overrides = {}) {
	return {
		_pausedRovoToolCallStore: new Map(),
		activeRequests: new Map(),
		agentsRfpDemoStateManager: { name: "rfp-state" },
		updateAgentsRfpDemoState: async (updater) => updater({}),
		aiGatewayProvider: { name: "gateway" },
		buildAIGatewaySystemPrompt: () => "system",
		buildUserMessage: () => "user",
		clearActiveDeferredToolCall: () => {},
		compressUiConversationHistory: () => [],
		createAbortControllerFromRequest: () => new AbortController(),
		createChatSdkHandler: () => async () => {},
		createRovoAppRuntimeComposition: () => ({
			buildArtifactPreviewSummary: () => "summary",
			generatePlanMetadataViaGateway: async () => ({}),
			handleRovoAppArtifactToolRequest: async () => {},
			persistRovoAppBrowserScreenshotBuffer: async () => {},
			startNextQueuedRovoAppRun: async () => {},
			syncRovoAppThreadSessionFromCurrentPort: async () => {},
			withStudioAgentGatewayFallbackTimeout: async (promise) => promise,
		}),
		createRovoUnavailableError: () => new Error("unavailable"),
		createStageTrace: () => ({ mark() {} }),
		dispatchInProcessHttpRequest: async () => ({}),
		ensureRovoSession: async () => ({ port: 4100 }),
		generateSmartGenuiResult: async () => ({}),
		generateTextViaGateway: async () => "text",
		getCurrentRovoSession: () => ({ port: 4100 }),
		getListeningPidsForPort: () => [],
		hasGatewayUrlConfigured: () => true,
		isRovoAvailable: () => true,
		logger: { error() {}, info() {}, warn() {} },
		mapUiMessagesToConversation: () => [],
		refreshRovoAvailability: async () => {},
		registerActiveDeferredToolCall: () => {},
		registerPausedRovoToolCall: () => {},
		replayViaRovo: async () => {},
		requestUserInputQuestionMetaStore: new Map(),
		resolvePreferredBackend: async () => "rovo",
		resolveRovoAppPortAvailability: () => ({ port: 4100 }),
		resolveStageTraceFromRequest: () => ({ mark() {} }),
		rovoAppDocumentManager: { name: "documents" },
		rovoAppGeneratedFilesManager: { name: "generated-files" },
		rovoAppRunManager: { name: "runs" },
		rovoAppThreadManager: { name: "threads" },
		rovoAppUploadManager: { name: "uploads" },
		rovoCancelChat: async () => {},
		rovoHealthCheck: async () => ({ ok: true }),
		rovoResumeToolCalls: async () => {},
		runRovoBackgroundTask: async () => {},
		sendGatewayErrorResponse: () => {},
		setStartNextQueuedRovoAppRun: () => {},
		streamTextViaGateway: async () => {},
		streamViaRovo: async () => {},
		takePausedRovoToolCall: () => null,
		...overrides,
	};
}

test("createChatRuntimeComposition wires the chat and Rovo runtime cycle", async () => {
	const captured = {};
	const runtime = {
		buildArtifactPreviewSummary: () => "summary",
		generatePlanMetadataViaGateway: async () => ({ title: "Plan" }),
		handleRovoAppArtifactToolRequest: async () => {},
		persistRovoAppBrowserScreenshotBuffer: async () => {},
		startNextQueuedRovoAppRun: async () => "queued",
		syncRovoAppThreadSessionFromCurrentPort: async () => {},
		withStudioAgentGatewayFallbackTimeout: async (promise) => promise,
	};
	const handler = async () => "handled";
	const dependencies = createDependencies({
		createChatSdkHandler: (input) => {
			captured.createChatSdkHandler = input;
			return handler;
		},
		createRovoAppRuntimeComposition: (input) => {
			captured.createRovoAppRuntimeComposition = input;
			return runtime;
		},
		dispatchInProcessHttpRequest: async (input) => {
			captured.dispatchInProcessHttpRequest = input;
			return input.handleRequest();
		},
		setStartNextQueuedRovoAppRun: (callback) => {
			captured.startNextQueuedCallback = callback;
		},
	});

	const result = createChatRuntimeComposition(dependencies);

	assert.equal(result.rovoAppRuntime, runtime);
	assert.equal(result.handleChatSdkRequest, handler);
	assert.equal(result.buildArtifactPreviewSummary, runtime.buildArtifactPreviewSummary);
	assert.equal(captured.startNextQueuedCallback, runtime.startNextQueuedRovoAppRun);
	assert.equal(captured.createRovoAppRuntimeComposition.updateAgentsRfpDemoState, dependencies.updateAgentsRfpDemoState);
	assert.equal(
		captured.createRovoAppRuntimeComposition.dispatchChatSdkRequestInProcess,
		result.dispatchChatSdkRequestInProcess
	);
	assert.equal(
		captured.createRovoAppRuntimeComposition.requestUserInputQuestionMetaStore,
		dependencies.requestUserInputQuestionMetaStore
	);
	assert.equal(
		captured.createChatSdkHandler.buildArtifactPreviewSummary,
		runtime.buildArtifactPreviewSummary
	);
	assert.equal(
		captured.createChatSdkHandler.generatePlanMetadataViaGateway,
		runtime.generatePlanMetadataViaGateway
	);
	assert.equal(
		captured.createChatSdkHandler.syncRovoAppThreadSessionFromCurrentPort,
		runtime.syncRovoAppThreadSessionFromCurrentPort
	);

	const response = await result.dispatchChatSdkRequestInProcess({
		body: "body",
		headers: { accept: "text/plain" },
		protocol: "https",
		signal: "signal",
	});

	assert.equal(response, "handled");
	assert.deepEqual({
		body: captured.dispatchInProcessHttpRequest.body,
		handleRequest: captured.dispatchInProcessHttpRequest.handleRequest,
		headers: captured.dispatchInProcessHttpRequest.headers,
		protocol: captured.dispatchInProcessHttpRequest.protocol,
		signal: captured.dispatchInProcessHttpRequest.signal,
	}, {
		body: "body",
		handleRequest: handler,
		headers: { accept: "text/plain" },
		protocol: "https",
		signal: "signal",
	});
});

test("createChatRuntimeComposition validates composition functions", () => {
	assert.throws(
		() => createChatRuntimeComposition(createDependencies({ createChatSdkHandler: null })),
		/createChatRuntimeComposition requires createChatSdkHandler/u
	);
	assert.throws(
		() => createChatRuntimeComposition(createDependencies({ setStartNextQueuedRovoAppRun: null })),
		/createChatRuntimeComposition requires setStartNextQueuedRovoAppRun/u
	);
});
