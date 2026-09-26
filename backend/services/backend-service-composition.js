"use strict";

const path = require("node:path");
const { createAgentsRfpDemoJobOwner: defaultCreateAgentsRfpDemoJobOwner } = require("../lib/agents-rfp-demo-job-owner");
const { createGatewayTextGenerationService: defaultCreateGatewayTextGenerationService } = require("../lib/gateway-text-generation");
const { createBackendServices: defaultCreateBackendServices } = require("./create-backend-services");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createBackendServiceComposition requires ${name}`);
	}
}

function createBackendServiceComposition({
	baseDir = path.join(__dirname, "..", "data"),
	createRovoUnavailableError,
	debugLog,
	deleteRovoAppThreadBrowserWorkspace,
	destroyMirrorBrowser,
	generateTextViaRovo,
	logger = console,
	normalizeAIGatewayError,
	projectRoot = path.join(__dirname, "..", ".."),
	resolvePreferredBackend,
	streamViaRovo,
	waitForTurnTimeoutMs,
} = {}, factories = {}) {
	const {
		createAgentsRfpDemoJobOwner = defaultCreateAgentsRfpDemoJobOwner,
		createBackendServices = defaultCreateBackendServices,
		createGatewayTextGenerationService = defaultCreateGatewayTextGenerationService,
	} = factories;
	for (const [name, value] of Object.entries({ createRovoUnavailableError, debugLog, deleteRovoAppThreadBrowserWorkspace, destroyMirrorBrowser, generateTextViaRovo, normalizeAIGatewayError, resolvePreferredBackend, streamViaRovo })) {
		requireFunction(name, value);
	}

	const services = createBackendServices({ baseDir, logger, projectRoot });
	const gatewayTextGeneration = createGatewayTextGenerationService({
		aiGatewayProvider: services.aiGatewayProvider,
		createRovoUnavailableError,
		debugLog,
		generateTextViaRovo,
		normalizeAIGatewayError,
		resolvePreferredBackend,
		streamViaRovo,
		waitForTurnTimeoutMs,
	});
	const agentsRfpDemoJobOwner = createAgentsRfpDemoJobOwner({
		agentsRfpDemoStateManager: services.agentsRfpDemoStateManager,
		deleteRovoAppThreadBrowserWorkspace,
		destroyMirrorBrowser,
		rovoAppDocumentManager: services.rovoAppDocumentManager,
		rovoAppGeneratedFilesManager: services.rovoAppGeneratedFilesManager,
		rovoAppThreadManager: services.rovoAppThreadManager,
		rovoAppUploadManager: services.rovoAppUploadManager,
		rovoAppVoteManager: services.rovoAppVoteManager,
	});
	return { agentsRfpDemoJobOwner, gatewayTextGeneration, services };
}

module.exports = { createBackendServiceComposition };
