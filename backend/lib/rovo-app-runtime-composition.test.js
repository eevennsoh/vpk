const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createRovoAppRuntimeComposition,
} = require("./rovo-app-runtime-composition");

function createRequiredDependencies(overrides = {}) {
	return {
		activeRequests: new Map(),
		agentsRfpDemoStateManager: { name: "agents-rfp-demo-state" },
		updateAgentsRfpDemoState: async (updater) => updater({}),
		aiGatewayProvider: { generateText: async () => "gateway text" },
		compressUiConversationHistory: () => [],
		createStageTrace: () => ({ mark() {} }),
		dispatchChatSdkRequestInProcess: async () => ({ status: 200 }),
		ensureRovoSession: async () => ({ port: 4100 }),
		generateTextViaGateway: async () => "generated text",
		getCurrentRovoSession: () => ({ port: 4100 }),
		hasGatewayUrlConfigured: () => true,
		isRovoAvailable: () => true,
		logger: {
			error() {},
			info() {},
			warn() {},
		},
		mapUiMessagesToConversation: () => [],
		requestUserInputQuestionMetaStore: new Map(),
		resolveRovoAppPortAvailability: () => ({ port: 4100 }),
		rovoAppDocumentManager: { name: "documents" },
		rovoAppGeneratedFilesManager: { name: "generated-files" },
		rovoAppRunManager: { name: "runs" },
		rovoAppThreadManager: { name: "threads" },
		rovoAppUploadManager: { name: "uploads" },
		rovoCancelChat: async () => {},
		runRovoBackgroundTask: async () => {},
		streamTextViaGateway: async () => "streamed text",
		...overrides,
	};
}

function createHarness() {
	const calls = [];
	const captured = {};
	const values = {
		agentsRfpDemoChatStreamOwner: {
			generateAgentsRfpDemoReportPreview: () => "preview",
			streamAgentsRfpDemoChatTurn: () => {},
		},
		buildArtifactPreviewSummary: () => "summary",
		clearRovoAppRunState: async () => {},
		completeRovoAppManagedRunResponse: async () => {},
		consumeRovoAppManagedResponse: async () => {},
		dispatchRovoAppManagedRunChat: async () => {},
		executeRovoAppManagedRun: async () => {},
		finalizeRovoAppRun: async () => {},
		generatePlanMetadataViaGateway: async () => ({ title: "Plan" }),
		generateRovoAppArtifactText: async () => "artifact",
		generateRovoAppArtifactTitleFromContent: async () => "Artifact",
		generateSuggestedQuestions: async () => ["Question?"],
		handleRovoAppArtifactToolRequest: async () => {},
		handleRovoAppManagedRunArtifactRoute: async () => false,
		maybeMigratePersistedRovoAppThreadBrowserScreenshots: async () => {},
		persistRovoAppBrowserScreenshotBuffer: async () => {},
		persistRovoAppMessageFiles: async () => {},
		persistRovoAppRunBackend: async () => {},
		persistRovoAppRunMessagesSnapshot: async () => {},
		persistRovoAppRunState: async () => {},
		prepareRovoAppManagedRunRequest: async () => ({}),
		proxyRovoAppChatRequest: async () => {},
		reconcileOrphanedRovoAppThread: async () => {},
		resolveRovoAppArtifactDecision: () => "chat",
		resolveRovoAppArtifactKind: () => "html",
		resolveRovoAppManagedRunRoute: async () => ({}),
		startManagedRovoAppRun: async (run) => {
			calls.push(["startManagedRovoAppRun", run]);
		},
		startNextQueuedRovoAppRun: async () => {
			calls.push(["startNextQueuedRovoAppRun"]);
			return "queued";
		},
		streamRovoAppArtifactToolResponse: () => {},
		synchronizeRovoAppThreadGeneratedFiles: async () => {},
		syncRovoAppThreadSession: async () => {},
		syncRovoAppThreadSessionFromCurrentPort: async () => {},
		withStudioAgentGatewayFallbackTimeout: async (promise) => promise,
	};
	const factories = {
		createAgentsRfpDemoChatStreamOwner: (input) => {
			captured.agentsRfpDemoChatStreamOwner = input;
			return values.agentsRfpDemoChatStreamOwner;
		},
		createChatGenerationHelpers: (input) => {
			captured.chatGenerationHelpers = input;
			return {
				buildArtifactPreviewSummary: values.buildArtifactPreviewSummary,
				generatePlanMetadataViaGateway: values.generatePlanMetadataViaGateway,
				generateSuggestedQuestions: values.generateSuggestedQuestions,
				withStudioAgentGatewayFallbackTimeout: values.withStudioAgentGatewayFallbackTimeout,
			};
		},
		createRovoAppArtifactGenerationService: (input) => {
			captured.artifactGenerationService = input;
			return {
				generateRovoAppArtifactText: values.generateRovoAppArtifactText,
				generateRovoAppArtifactTitleFromContent: values.generateRovoAppArtifactTitleFromContent,
				resolveRovoAppArtifactDecision: values.resolveRovoAppArtifactDecision,
				resolveRovoAppArtifactKind: values.resolveRovoAppArtifactKind,
			};
		},
		createRovoAppArtifactToolRequestHandler: (input) => {
			captured.artifactToolRequestHandler = input;
			return { handleRovoAppArtifactToolRequest: values.handleRovoAppArtifactToolRequest };
		},
		createRovoAppArtifactToolResponseStreamer: (input) => {
			captured.artifactToolResponseStreamer = input;
			return { streamRovoAppArtifactToolResponse: values.streamRovoAppArtifactToolResponse };
		},
		createRovoAppManagedResponseConsumer: (input) => {
			captured.managedResponseConsumer = input;
			return { consumeRovoAppManagedResponse: values.consumeRovoAppManagedResponse };
		},
		createRovoAppManagedRunArtifactRouter: (input) => {
			captured.managedRunArtifactRouter = input;
			return { handleRovoAppManagedRunArtifactRoute: values.handleRovoAppManagedRunArtifactRoute };
		},
		createRovoAppManagedRunChatDispatcher: (input) => {
			captured.managedRunChatDispatcher = input;
			return { dispatchRovoAppManagedRunChat: values.dispatchRovoAppManagedRunChat };
		},
		createRovoAppManagedRunExecutor: (input) => {
			captured.managedRunExecutor = input;
			return { executeRovoAppManagedRun: values.executeRovoAppManagedRun };
		},
		createRovoAppManagedRunLifecycle: (input) => {
			captured.managedRunLifecycle = input;
			return {
				startManagedRovoAppRun: values.startManagedRovoAppRun,
				startNextQueuedRovoAppRun: values.startNextQueuedRovoAppRun,
			};
		},
		createRovoAppManagedRunProxy: (input) => {
			captured.managedRunProxy = input;
			return { proxyRovoAppChatRequest: values.proxyRovoAppChatRequest };
		},
		createRovoAppManagedRunRequestPreparer: (input) => {
			captured.managedRunRequestPreparer = input;
			return { prepareRovoAppManagedRunRequest: values.prepareRovoAppManagedRunRequest };
		},
		createRovoAppManagedRunResponseCompleter: (input) => {
			captured.managedRunResponseCompleter = input;
			return { completeRovoAppManagedRunResponse: values.completeRovoAppManagedRunResponse };
		},
		createRovoAppManagedRunRouteResolver: (input) => {
			captured.managedRunRouteResolver = input;
			return { resolveRovoAppManagedRunRoute: values.resolveRovoAppManagedRunRoute };
		},
		createRovoAppMessageFilePersistence: (input) => {
			captured.messageFilePersistence = input;
			return {
				maybeMigratePersistedThreadBrowserScreenshots: values.maybeMigratePersistedRovoAppThreadBrowserScreenshots,
				persistBrowserScreenshotBuffer: values.persistRovoAppBrowserScreenshotBuffer,
				persistMessageFiles: values.persistRovoAppMessageFiles,
				synchronizeThreadGeneratedFiles: values.synchronizeRovoAppThreadGeneratedFiles,
			};
		},
		createRovoAppRunStateService: (input) => {
			captured.runStateService = input;
			return {
				clearRovoAppRunState: values.clearRovoAppRunState,
				finalizeRovoAppRun: values.finalizeRovoAppRun,
				persistRovoAppRunBackend: values.persistRovoAppRunBackend,
				persistRovoAppRunMessagesSnapshot: values.persistRovoAppRunMessagesSnapshot,
				persistRovoAppRunState: values.persistRovoAppRunState,
				reconcileOrphanedRovoAppThread: values.reconcileOrphanedRovoAppThread,
			};
		},
		createRovoAppThreadSessionSync: (input) => {
			captured.threadSessionSync = input;
			return {
				syncRovoAppThreadSession: values.syncRovoAppThreadSession,
				syncRovoAppThreadSessionFromCurrentPort: values.syncRovoAppThreadSessionFromCurrentPort,
			};
		},
	};
	const dependencies = createRequiredDependencies();
	const result = createRovoAppRuntimeComposition(dependencies, factories);

	return {
		calls,
		captured,
		dependencies,
		result,
		values,
	};
}

test("createRovoAppRuntimeComposition wires managed-run callbacks through the lifecycle", async () => {
	const {
		calls,
		captured,
		dependencies,
		result,
		values,
	} = createHarness();

	assert.equal(captured.artifactToolResponseStreamer.generateSuggestedQuestions, values.generateSuggestedQuestions);
	assert.equal(captured.artifactToolRequestHandler.streamRovoAppArtifactToolResponse, values.streamRovoAppArtifactToolResponse);
	assert.equal(captured.threadSessionSync.ensureRovoSession, dependencies.ensureRovoSession);
	assert.equal(captured.agentsRfpDemoChatStreamOwner.updateAgentsRfpDemoState, dependencies.updateAgentsRfpDemoState);
	assert.equal(captured.threadSessionSync.getCurrentRovoSession, dependencies.getCurrentRovoSession);
	assert.equal(captured.managedResponseConsumer.syncRovoAppThreadSession, values.syncRovoAppThreadSession);
	assert.equal(captured.managedRunChatDispatcher.dispatchChatSdkRequestInProcess, dependencies.dispatchChatSdkRequestInProcess);
	assert.equal(captured.managedRunProxy.startManagedRovoAppRun, values.startManagedRovoAppRun);

	const run = { threadId: "thread-1" };
	await captured.managedRunProxy.startManagedRovoAppRun(run);
	await captured.runStateService.startNextQueuedRun();

	assert.deepEqual(calls, [
		["startManagedRovoAppRun", run],
		["startNextQueuedRovoAppRun"],
	]);
	assert.equal(result.proxyRovoAppChatRequest, values.proxyRovoAppChatRequest);
	assert.equal(result.startNextQueuedRovoAppRun, values.startNextQueuedRovoAppRun);
	assert.equal(result.handleRovoAppArtifactToolRequest, values.handleRovoAppArtifactToolRequest);
	assert.equal(result.persistRovoAppBrowserScreenshotBuffer, values.persistRovoAppBrowserScreenshotBuffer);
});

test("createRovoAppRuntimeComposition validates required live dependencies", () => {
	assert.throws(
		() => createRovoAppRuntimeComposition(createRequiredDependencies({ activeRequests: null })),
		/activeRequests/u,
	);
	assert.throws(
		() => createRovoAppRuntimeComposition(createRequiredDependencies({ rovoCancelChat: null })),
		/rovoCancelChat/u,
	);
});
