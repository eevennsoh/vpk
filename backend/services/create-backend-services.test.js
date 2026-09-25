"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	DEFAULT_CHECKPOINT_LIMIT,
	createBackendServices,
} = require("./create-backend-services");

const SERVICE_FACTORY_NAMES = [
	"createAIGatewayProvider",
	"createAgentsRfpDemoStateManager",
	"createCheckpointManager",
	"createOrchestratorLog",
	"createRovoAppDocumentManager",
	"createRovoAppGeneratedFilesManager",
	"createRovoAppRunManager",
	"createRovoAppThreadManager",
	"createRovoAppUploadManager",
	"createRovoAppVoteManager",
];

function createFactoryHarness() {
	const calls = [];
	const factories = Object.fromEntries(
		SERVICE_FACTORY_NAMES.map((name) => [
			name,
			(options = {}) => {
				const service = {
					name,
				};
				calls.push({
					name,
					options,
					service,
				});
				return service;
			},
		]),
	);

	return {
		calls,
		factories,
		getCall: (name) => calls.find((call) => call.name === name),
	};
}

test("createBackendServices creates the backend service graph with shared paths and logger", () => {
	const harness = createFactoryHarness();
	const logger = { log() {} };
	const services = createBackendServices({
		baseDir: "/tmp/backend-data",
		factories: harness.factories,
		logger,
		projectRoot: "/repo",
	});

	assert.deepEqual(Object.keys(services).sort(), [
		"agentsRfpDemoStateManager",
		"aiGatewayProvider",
		"checkpointManager",
		"orchestratorLog",
		"rovoAppDocumentManager",
		"rovoAppGeneratedFilesManager",
		"rovoAppRunManager",
		"rovoAppThreadManager",
		"rovoAppUploadManager",
		"rovoAppVoteManager",
	]);

	assert.deepEqual(harness.getCall("createRovoAppThreadManager").options, {
		baseDir: "/tmp/backend-data",
		logger,
	});
	assert.deepEqual(harness.getCall("createCheckpointManager").options, {
		baseDir: "/tmp/backend-data",
		maxCheckpoints: DEFAULT_CHECKPOINT_LIMIT,
	});
	assert.deepEqual(harness.getCall("createRovoAppGeneratedFilesManager").options, {
		baseDir: "/tmp/backend-data",
		logger,
		projectRoot: "/repo",
	});
	assert.deepEqual(harness.getCall("createOrchestratorLog").options, {
		baseDir: "/tmp/backend-data",
		logger,
	});
	assert.deepEqual(harness.getCall("createAIGatewayProvider").options, {
		logger,
	});
	assert.deepEqual(harness.getCall("createRovoAppRunManager").options, {
		logger,
	});

	for (const name of [
		"createAgentsRfpDemoStateManager",
		"createRovoAppDocumentManager",
		"createRovoAppUploadManager",
		"createRovoAppVoteManager",
	]) {
		assert.deepEqual(harness.getCall(name).options, {
			baseDir: "/tmp/backend-data",
		});
	}
});


test("factory creates retained services without background-job lifecycle callbacks", () => {
	const harness = createFactoryHarness();
	const services = createBackendServices({ factories: harness.factories });
	assert.equal(services.checkpointManager, harness.getCall("createCheckpointManager").service);
	assert.equal(Object.keys(services).length, SERVICE_FACTORY_NAMES.length);
});

test("fresh storage recreates ordinary chat and RFP state without external integration data", async () => {
	const fs = require("node:fs/promises");
	const os = require("node:os");
	const path = require("node:path");
	const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "vpk-fresh-services-"));
	try {
		const services = createBackendServices({ baseDir, logger: { log() {}, warn() {}, error() {} } });
		const state = await services.agentsRfpDemoStateManager.readState();
		assert.equal(state.agent, null);
		const thread = await services.rovoAppThreadManager.createThread({ title: "Fresh chat", messages: [] });
		assert.equal((await services.rovoAppThreadManager.getThread(thread.id)).title, "Fresh chat");
		const files = await fs.readdir(baseDir);
		assert.equal(files.some((name) => /hermes|wiki|skill-draft|job-link/u.test(name)), false);
		assert.deepEqual(await services.checkpointManager.list(), []);
	} finally {
		await fs.rm(baseDir, { recursive: true, force: true });
	}
});
