"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createBackendServiceComposition } = require("./backend-service-composition");

function dependencies() {
	return {
		createRovoUnavailableError: () => new Error("Unavailable"),
		debugLog() {},
		deleteRovoAppThreadBrowserWorkspace: async () => {},
		destroyMirrorBrowser: async () => {},
		generateTextViaRovo: async () => "text",
		normalizeAIGatewayError: (error) => error,
		resolvePreferredBackend: async () => ({ backend: "ai-gateway" }),
		streamViaRovo: async () => {},
	};
}

test("composition wires retained gateway and RFP owners without a scheduler", () => {
	const captured = {};
	const services = { aiGatewayProvider: {}, agentsRfpDemoStateManager: {}, rovoAppThreadManager: {} };
	const gateway = {};
	const rfp = {};
	const result = createBackendServiceComposition({ ...dependencies(), baseDir: "/tmp/backend", projectRoot: "/repo", waitForTurnTimeoutMs: 100 }, {
		createBackendServices(input) { captured.services = input; return services; },
		createGatewayTextGenerationService(input) { captured.gateway = input; return gateway; },
		createAgentsRfpDemoJobOwner(input) { captured.rfp = input; return rfp; },
	});
	assert.deepEqual(result, { agentsRfpDemoJobOwner: rfp, gatewayTextGeneration: gateway, services });
	assert.equal(captured.services.baseDir, "/tmp/backend");
	assert.equal(captured.services.projectRoot, "/repo");
	assert.equal(captured.gateway.aiGatewayProvider, services.aiGatewayProvider);
	assert.equal(captured.gateway.waitForTurnTimeoutMs, 100);
	assert.equal(captured.rfp.agentsRfpDemoStateManager, services.agentsRfpDemoStateManager);
	assert.equal(captured.rfp.rovoAppThreadManager, services.rovoAppThreadManager);
	assert.deepEqual(Object.keys(captured.services).sort(), ["baseDir", "logger", "projectRoot"]);
});

test("composition validates required retained dependencies", () => {
	assert.throws(() => createBackendServiceComposition({ ...dependencies(), generateTextViaRovo: null }), /generateTextViaRovo/u);
});
