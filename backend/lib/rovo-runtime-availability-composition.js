"use strict";

const path = require("node:path");
const {
	createDeferredToolCallState: defaultCreateDeferredToolCallState,
} = require("../chat/deferred-tool-state");
const {
	createRovoAvailabilityService: defaultCreateRovoAvailabilityService,
} = require("./rovo-availability-service");
const {
	createRovoPortReadinessWaiter: defaultCreateRovoPortReadinessWaiter,
} = require("./rovo-port-readiness");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoRuntimeAvailabilityComposition requires ${name}`);
	}
	return value;
}

function requireLogger(logger) {
	requireFunction("logger.log", logger?.log);
	requireFunction("logger.warn", logger?.warn);
	return logger;
}

function requireProjectRoot(projectRoot) {
	if (typeof projectRoot !== "string" || projectRoot.length === 0) {
		throw new Error("createRovoRuntimeAvailabilityComposition requires projectRoot");
	}
	return projectRoot;
}

function createRovoRuntimeAvailabilityComposition({
	cancelPausedDeferredToolCallRecord,
	classifyRovoHealthCheck,
	createDeferredToolCallState = defaultCreateDeferredToolCallState,
	createRovoAvailabilityService = defaultCreateRovoAvailabilityService,
	createRovoPool,
	createRovoPortReadinessWaiter = defaultCreateRovoPortReadinessWaiter,
	debugLog = () => {},
	env = process.env,
	getBasePort,
	initPool,
	logger = console,
	projectRoot = path.join(__dirname, "..", ".."),
	resolveRovoPorts,
	rovoCancelChat,
	rovoHealthCheck,
} = {}) {
	requireFunction("cancelPausedDeferredToolCallRecord", cancelPausedDeferredToolCallRecord);
	requireFunction("classifyRovoHealthCheck", classifyRovoHealthCheck);
	requireFunction("createDeferredToolCallState", createDeferredToolCallState);
	requireFunction("createRovoAvailabilityService", createRovoAvailabilityService);
	requireFunction("createRovoPool", createRovoPool);
	requireFunction("createRovoPortReadinessWaiter", createRovoPortReadinessWaiter);
	requireFunction("debugLog", debugLog);
	requireFunction("getBasePort", getBasePort);
	requireFunction("initPool", initPool);
	requireFunction("resolveRovoPorts", resolveRovoPorts);
	requireFunction("rovoCancelChat", rovoCancelChat);
	requireFunction("rovoHealthCheck", rovoHealthCheck);
	requireLogger(logger);
	requireProjectRoot(projectRoot);

	const portFile = path.join(projectRoot, ".dev-rovo-port");
	const portsFile = path.join(projectRoot, ".dev-rovo-ports");
	const portSearchMaxTries = Number.parseInt(env.PORT_SEARCH_MAX ?? "20", 10);

	const waitForPortReady = createRovoPortReadinessWaiter({
		classifyHealthCheck: classifyRovoHealthCheck,
		healthCheck: rovoHealthCheck,
	});

	const deferredToolCallState = createDeferredToolCallState({
		cancelChat: rovoCancelChat,
		cancelPausedToolCallRecord: cancelPausedDeferredToolCallRecord,
		logger,
		waitForReady: waitForPortReady,
	});

	let startNextQueuedRovoAppRun = () => {};
	function setStartNextQueuedRovoAppRun(nextStartNextQueuedRovoAppRun) {
		requireFunction("nextStartNextQueuedRovoAppRun", nextStartNextQueuedRovoAppRun);
		startNextQueuedRovoAppRun = nextStartNextQueuedRovoAppRun;
	}

	const availabilityService = createRovoAvailabilityService({
		classifyRovoHealthCheck,
		createRovoPool,
		debugLog,
		getBasePort,
		initPool,
		logger,
		maxTries: portSearchMaxTries,
		onPortAvailable: () => startNextQueuedRovoAppRun(),
		portFile,
		portsFile,
		resolveRovoPorts,
		rovoHealthCheck,
		waitForReady: waitForPortReady,
	});

	return {
		clearActiveDeferredToolCall: deferredToolCallState.clearActiveDeferredToolCall,
		detachPausedRovoToolCall: deferredToolCallState.detachPausedRovoToolCall,
		getRovoAvailability: availabilityService.getRovoAvailability,
		getRovoPool: availabilityService.getRovoPool,
		isRovoAvailable: availabilityService.isRovoAvailable,
		pausedRovoToolCallStore: deferredToolCallState.pausedRovoToolCallStore,
		refreshRovoAvailability: availabilityService.refreshRovoAvailability,
		registerActiveDeferredToolCall: deferredToolCallState.registerActiveDeferredToolCall,
		registerPausedRovoToolCall: deferredToolCallState.registerPausedRovoToolCall,
		resolveRovoAppPortAvailability: availabilityService.resolveRovoAppPortAvailability,
		setStartNextQueuedRovoAppRun,
		shutdownRovoPool: availabilityService.shutdownRovoPool,
		takePausedRovoToolCall: deferredToolCallState.takePausedRovoToolCall,
		waitForPortReady,
	};
}

module.exports = {
	createRovoRuntimeAvailabilityComposition,
};
