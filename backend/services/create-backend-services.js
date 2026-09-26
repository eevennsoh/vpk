"use strict";

const path = require("node:path");

const { createAIGatewayProvider } = require("../lib/ai-gateway-provider");
const { createAgentsRfpDemoStateManager } = require("../lib/agents-rfp-demo-state");
const { createCheckpointManager } = require("../lib/workspace-checkpoints");
const { createOrchestratorLog } = require("../lib/orchestrator-log");
const { createRovoAppDocumentManager } = require("../lib/rovo-app-documents");
const {
	createRovoAppGeneratedFilesManager,
} = require("../lib/rovo-app-generated-files");
const { createRovoAppRunManager } = require("../lib/rovo-app-runs");
const { createRovoAppThreadManager } = require("../lib/rovo-app-threads");
const { createRovoAppUploadManager } = require("../lib/rovo-app-uploads");
const { createRovoAppVoteManager } = require("../lib/rovo-app-votes");

const DEFAULT_CHECKPOINT_LIMIT = 10;

const DEFAULT_FACTORIES = {
	createAIGatewayProvider,
	createAgentsRfpDemoStateManager,
	createCheckpointManager,
	createOrchestratorLog,
	createRovoAppDocumentManager,
	createRovoAppGeneratedFilesManager,
	createRovoAppRunManager,
	createRovoAppThreadManager,
	createRovoAppUploadManager,
	createRovoAppVoteManager,
};


function createBackendServices({
	baseDir = path.join(__dirname, "..", "data"),
	factories = {},
	logger = console,
	projectRoot = path.join(__dirname, "..", ".."),
} = {}) {

	const serviceFactories = {
		...DEFAULT_FACTORIES,
		...factories,
	};

	const services = {};

	services.aiGatewayProvider = serviceFactories.createAIGatewayProvider({ logger });
	services.agentsRfpDemoStateManager = serviceFactories.createAgentsRfpDemoStateManager({ baseDir });
	services.checkpointManager = serviceFactories.createCheckpointManager({
		baseDir,
		maxCheckpoints: DEFAULT_CHECKPOINT_LIMIT,
	});
	services.orchestratorLog = serviceFactories.createOrchestratorLog({
		baseDir,
		logger,
	});
	services.rovoAppDocumentManager = serviceFactories.createRovoAppDocumentManager({ baseDir });
	services.rovoAppGeneratedFilesManager = serviceFactories.createRovoAppGeneratedFilesManager({
		baseDir,
		logger,
		projectRoot,
	});
	services.rovoAppRunManager = serviceFactories.createRovoAppRunManager({ logger });
	services.rovoAppThreadManager = serviceFactories.createRovoAppThreadManager({
		baseDir,
		logger,
	});
	services.rovoAppUploadManager = serviceFactories.createRovoAppUploadManager({ baseDir });
	services.rovoAppVoteManager = serviceFactories.createRovoAppVoteManager({ baseDir });

	return services;
}

module.exports = {
	DEFAULT_CHECKPOINT_LIMIT,
	createBackendServices,
};
