"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createRovoRuntimeAvailabilityComposition,
} = require("./rovo-runtime-availability-composition");

function createHarness(overrides = {}) {
	const calls = [];
	const captured = {};
	const waitForPortReady = async (port) => {
		calls.push(["waitForPortReady", port]);
	};
	const deferredToolCallState = {
		clearActiveDeferredToolCall: () => "clear-active",
		detachPausedRovoToolCall: () => "detach-paused",
		pausedRovoToolCallStore: new Map([["tool-1", { port: 4100 }]]),
		registerActiveDeferredToolCall: () => "register-active",
		registerPausedRovoToolCall: () => "register-paused",
		takePausedRovoToolCall: () => "take-paused",
	};
	const availabilityService = {
		getRovoAvailability: () => "available",
		getRovoPool: () => "pool",
		isRovoAvailable: async () => true,
		refreshRovoAvailability: async () => true,
		resolveRovoAppPortAvailability: () => ({ available: true }),
		shutdownRovoPool: () => "shutdown",
	};
	const dependencies = {
		cancelPausedDeferredToolCallRecord: async () => {},
		classifyRovoHealthCheck: (health) => health,
		createDeferredToolCallState: (input) => {
			captured.deferredToolCallState = input;
			return deferredToolCallState;
		},
		createRovoAvailabilityService: (input) => {
			captured.availabilityService = input;
			return availabilityService;
		},
		createRovoPool: () => ({ shutdown() {} }),
		createRovoPortReadinessWaiter: (input) => {
			captured.portReadinessWaiter = input;
			return waitForPortReady;
		},
		debugLog: () => {},
		env: { PORT_SEARCH_MAX: "7" },
		getBasePort: () => 4100,
		initPool: () => {},
		logger: {
			log() {},
			warn() {},
		},
		projectRoot: "/repo",
		resolveRovoPorts: async () => ({ ports: [4100], source: "recorded" }),
		rovoCancelChat: async () => {},
		rovoHealthCheck: async () => ({ ready: true }),
		...overrides.dependencies,
	};
	const result = createRovoRuntimeAvailabilityComposition(dependencies);

	return {
		availabilityService,
		calls,
		captured,
		deferredToolCallState,
		dependencies,
		result,
		waitForPortReady,
	};
}

test("createRovoRuntimeAvailabilityComposition wires Rovo availability and deferred state", () => {
	const {
		availabilityService,
		captured,
		deferredToolCallState,
		dependencies,
		result,
		waitForPortReady,
	} = createHarness();

	assert.deepEqual(captured.portReadinessWaiter, {
		classifyHealthCheck: dependencies.classifyRovoHealthCheck,
		healthCheck: dependencies.rovoHealthCheck,
	});
	assert.equal(captured.deferredToolCallState.cancelChat, dependencies.rovoCancelChat);
	assert.equal(
		captured.deferredToolCallState.cancelPausedToolCallRecord,
		dependencies.cancelPausedDeferredToolCallRecord
	);
	assert.equal(captured.deferredToolCallState.logger, dependencies.logger);
	assert.equal(captured.deferredToolCallState.waitForReady, waitForPortReady);

	assert.equal(captured.availabilityService.classifyRovoHealthCheck, dependencies.classifyRovoHealthCheck);
	assert.equal(captured.availabilityService.createRovoPool, dependencies.createRovoPool);
	assert.equal(captured.availabilityService.debugLog, dependencies.debugLog);
	assert.equal(captured.availabilityService.getBasePort, dependencies.getBasePort);
	assert.equal(captured.availabilityService.initPool, dependencies.initPool);
	assert.equal(captured.availabilityService.logger, dependencies.logger);
	assert.equal(captured.availabilityService.maxTries, 7);
	assert.equal(captured.availabilityService.portFile, "/repo/.dev-rovo-port");
	assert.equal(captured.availabilityService.portsFile, "/repo/.dev-rovo-ports");
	assert.equal(captured.availabilityService.resolveRovoPorts, dependencies.resolveRovoPorts);
	assert.equal(captured.availabilityService.rovoHealthCheck, dependencies.rovoHealthCheck);
	assert.equal(captured.availabilityService.waitForReady, waitForPortReady);

	assert.equal(result.waitForPortReady, waitForPortReady);
	assert.equal(result.clearActiveDeferredToolCall, deferredToolCallState.clearActiveDeferredToolCall);
	assert.equal(result.detachPausedRovoToolCall, deferredToolCallState.detachPausedRovoToolCall);
	assert.equal(result.pausedRovoToolCallStore, deferredToolCallState.pausedRovoToolCallStore);
	assert.equal(result.registerActiveDeferredToolCall, deferredToolCallState.registerActiveDeferredToolCall);
	assert.equal(result.registerPausedRovoToolCall, deferredToolCallState.registerPausedRovoToolCall);
	assert.equal(result.takePausedRovoToolCall, deferredToolCallState.takePausedRovoToolCall);
	assert.equal(result.getRovoAvailability, availabilityService.getRovoAvailability);
	assert.equal(result.getRovoPool, availabilityService.getRovoPool);
	assert.equal(result.isRovoAvailable, availabilityService.isRovoAvailable);
	assert.equal(result.refreshRovoAvailability, availabilityService.refreshRovoAvailability);
	assert.equal(result.resolveRovoAppPortAvailability, availabilityService.resolveRovoAppPortAvailability);
	assert.equal(result.shutdownRovoPool, availabilityService.shutdownRovoPool);
});

test("setStartNextQueuedRovoAppRun preserves the availability callback cycle", async () => {
	const { calls, captured, result } = createHarness();

	assert.equal(await captured.availabilityService.onPortAvailable(), undefined);

	result.setStartNextQueuedRovoAppRun(async () => {
		calls.push(["startNextQueuedRovoAppRun"]);
		return "queued";
	});

	assert.equal(await captured.availabilityService.onPortAvailable(), "queued");
	assert.deepEqual(calls, [["startNextQueuedRovoAppRun"]]);
});

test("createRovoRuntimeAvailabilityComposition uses the default port search max", () => {
	const { captured } = createHarness({
		dependencies: {
			env: {},
		},
	});

	assert.equal(captured.availabilityService.maxTries, 20);
});

test("createRovoRuntimeAvailabilityComposition validates required dependencies", () => {
	assert.throws(() => createRovoRuntimeAvailabilityComposition(), /cancelPausedDeferredToolCallRecord/u);
	assert.throws(
		() =>
			createRovoRuntimeAvailabilityComposition({
				cancelPausedDeferredToolCallRecord: async () => {},
			}),
		/classifyRovoHealthCheck/u,
	);
	assert.throws(
		() =>
			createHarness({
				dependencies: {
					projectRoot: "",
				},
			}),
		/projectRoot/u,
	);
});
