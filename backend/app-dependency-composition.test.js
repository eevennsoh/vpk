"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildBackendAppDependencies,
} = require("./app-dependency-composition");

function createNamedFunction(name, calls) {
	return (...args) => {
		calls.push([name, ...args]);
		return { name, args };
	};
}

test("buildBackendAppDependencies preserves live owners without eager calls", () => {
	const calls = [];
	const activeRequests = new Map();
	const runtimePort = "9123";
	const options = { prompt: "Summarize this" };
	const aiGatewayProvider = {
		generateText(input) {
			calls.push(["aiGatewayProvider.generateText", input]);
			return "gateway text";
		},
	};
	const backendServices = {
		agentsRfpDemoStateManager: { owner: "agents-rfp-demo-state" },
		aiGatewayProvider,
		checkpointManager: { owner: "checkpoints" },
		orchestratorLog: { owner: "orchestrator-log" },
		rovoAppDocumentManager: { owner: "documents" },
		rovoAppGeneratedFilesManager: { owner: "generated-files" },
		rovoAppRunManager: { owner: "runs" },
		rovoAppThreadManager: { owner: "threads" },
		rovoAppUploadManager: { owner: "uploads" },
		rovoAppVoteManager: { owner: "votes" },
	};
	const agentsRfpDemoJobOwner = {
		advanceAgentsRfpDemoProcessing: createNamedFunction("advanceAgentsRfpDemoProcessing", calls),
		deleteAgentsRfpDemoThread: createNamedFunction("deleteAgentsRfpDemoThread", calls),
		runAgentsRfpDemoJob: createNamedFunction("runAgentsRfpDemoJob", calls),
	};
	const rovoAppRuntime = {
		agentsRfpDemoChatStreamOwner: {
			generateAgentsRfpDemoReportPreview: createNamedFunction("generateAgentsRfpDemoReportPreview", calls),
		},
		clearRovoAppRunState: createNamedFunction("clearRovoAppRunState", calls),
		generateSuggestedQuestions: createNamedFunction("generateSuggestedQuestions", calls),
		maybeMigratePersistedRovoAppThreadBrowserScreenshots: createNamedFunction("maybeMigrateScreenshots", calls),
		persistRovoAppMessageFiles: createNamedFunction("persistRovoAppMessageFiles", calls),
		persistRovoAppRunState: createNamedFunction("persistRovoAppRunState", calls),
		proxyRovoAppChatRequest: createNamedFunction("proxyRovoAppChatRequest", calls),
		reconcileOrphanedRovoAppThread: createNamedFunction("reconcileOrphanedRovoAppThread", calls),
		startNextQueuedRovoAppRun: createNamedFunction("startNextQueuedRovoAppRun", calls),
	};
	const handleChatSdkRequest = createNamedFunction("handleChatSdkRequest", calls);
	const cancelChat = createNamedFunction("cancelChat", calls);
	const streamChatViaRovo = createNamedFunction("streamChatViaRovo", calls);
	const collectUploadIdsFromMessages = createNamedFunction("collectUploadIdsFromMessages", calls);
	const searchThreads = createNamedFunction("searchThreads", calls);

	const dependencies = buildBackendAppDependencies({
		activeRequests,
		agentMode: {
			getAgentMode: createNamedFunction("getAgentMode", calls),
			setAgentMode: createNamedFunction("setAgentMode", calls),
		},
		agentsRfpDemoJobOwner,
		backendServices,
		browserWorkspace: {
			browserWorkspaceManager: { owner: "browser-workspaces" },
			chromiumPreviewManager: { owner: "chromium-preview" },
			deleteThreadBrowserWorkspace: createNamedFunction("deleteThreadBrowserWorkspace", calls),
			destroyMirrorBrowser: createNamedFunction("destroyMirrorBrowser", calls),
			ensureThreadBrowserWorkspace: createNamedFunction("ensureThreadBrowserWorkspace", calls),
			getMirrorBrowser: createNamedFunction("getMirrorBrowser", calls),
			getThreadBrowserWorkspace: createNamedFunction("getThreadBrowserWorkspace", calls),
			isBrowserWorkspaceNotFoundError: createNamedFunction("isBrowserWorkspaceNotFoundError", calls),
		},
		chatControl: {
			abortControllerFromRequest: createNamedFunction("abortControllerFromRequest", calls),
			buildQuestionCardSkipNotification: createNamedFunction("buildQuestionCardSkipNotification", calls),
			buildUserMessage: createNamedFunction("buildUserMessage", calls),
			cancelActiveDeferredToolCallRecord: createNamedFunction("cancelActiveDeferredToolCallRecord", calls),
			cancelChat,
			cancelPausedDeferredToolCallRecord: createNamedFunction("cancelPausedDeferredToolCallRecord", calls),
			clearActiveDeferredToolCall: createNamedFunction("clearActiveDeferredToolCall", calls),
			clearPlanSession: createNamedFunction("clearPlanSession", calls),
			createRovoUnavailableError: createNamedFunction("createRovoUnavailableError", calls),
			detachPausedRovoToolCall: createNamedFunction("detachPausedRovoToolCall", calls),
			sendGatewayErrorResponse: createNamedFunction("sendGatewayErrorResponse", calls),
			streamChatViaRovo,
			waitForReady: createNamedFunction("waitForReady", calls),
		},
		chatSdk: {
			handleChatSdkRequest,
		},
		collectUploadIdsFromMessages,
		gatewayTextGeneration: {
			generateTextViaGateway: createNamedFunction("generateTextViaGateway", calls),
		},
		rovoAppRuntime,
		runtime: {
			buildLlmRoutingStatus: createNamedFunction("buildLlmRoutingStatus", calls),
			buildRuntimeStatusSnapshot: createNamedFunction("buildRuntimeStatusSnapshot", calls),
			debugLog: createNamedFunction("debugLog", calls),
			debugMode: true,
			getAiGatewayConfigReport: createNamedFunction("getAiGatewayConfigReport", calls),
			getEnvVars: createNamedFunction("getEnvVars", calls),
			hasGatewayUrlConfigured: createNamedFunction("hasGatewayUrlConfigured", calls),
			isRovoAvailable: createNamedFunction("isRovoAvailable", calls),
			logger: { log: createNamedFunction("logger.log", calls) },
			runtimePort,
		},
		searchThreads,
	});

	assert.deepEqual(calls, []);
	assert.equal(dependencies.activeRequests, activeRequests);
	assert.equal(dependencies.cancelChat, cancelChat);
	assert.equal(dependencies.handleChatSdkRequest, handleChatSdkRequest);
	assert.equal(dependencies.streamChatViaRovo, streamChatViaRovo);
	assert.equal(dependencies.advanceAgentsRfpDemoProcessing, agentsRfpDemoJobOwner.advanceAgentsRfpDemoProcessing);
	assert.equal(dependencies.runAgentsRfpDemoJob, agentsRfpDemoJobOwner.runAgentsRfpDemoJob);
	assert.equal(
		dependencies.generateAgentsRfpDemoReportPreview,
		rovoAppRuntime.agentsRfpDemoChatStreamOwner.generateAgentsRfpDemoReportPreview,
	);
	assert.equal(dependencies.collectUploadIdsFromMessages, collectUploadIdsFromMessages);
	assert.equal(dependencies.proxyRovoAppChatRequest, rovoAppRuntime.proxyRovoAppChatRequest);
	assert.equal(dependencies.startNextQueuedRun, rovoAppRuntime.startNextQueuedRovoAppRun);
	assert.equal(dependencies.searchThreads, searchThreads);
	assert.equal(dependencies.rovoAppThreadManager, backendServices.rovoAppThreadManager);
	assert.equal(dependencies.runtimePort, runtimePort);

	assert.equal(dependencies.generateAgentDataFlowText(options), "gateway text");
	assert.deepEqual(calls, [["aiGatewayProvider.generateText", options]]);
});
