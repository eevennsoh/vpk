"use strict";

const fs = require("node:fs");
const {
	INITIAL_ROVO_AVAILABILITY,
	decideRovoAvailabilityRead,
	transitionRovoAvailability,
} = require("./rovo-availability-machine");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAvailabilityService requires ${name}`);
	}
	return value;
}

function createRovoAvailabilityService({
	classifyRovoHealthCheck,
	createRovoPool,
	debugLog = () => {},
	env = process.env,
	fsModule = fs,
	getBasePort,
	initPool,
	logger = console,
	maxTries = 20,
	now = () => Date.now(),
	onPortAvailable = () => {},
	portFile,
	portsFile,
	refreshIntervalMs = 60_000,
	resolveRovoPorts,
	rovoHealthCheck,
	waitForReady,
} = {}) {
	requireFunction("classifyRovoHealthCheck", classifyRovoHealthCheck);
	requireFunction("createRovoPool", createRovoPool);
	requireFunction("debugLog", debugLog);
	requireFunction("fsModule.existsSync", fsModule?.existsSync);
	requireFunction("getBasePort", getBasePort);
	requireFunction("initPool", initPool);
	requireFunction("logger.log", logger?.log);
	requireFunction("logger.warn", logger?.warn);
	requireFunction("now", now);
	requireFunction("onPortAvailable", onPortAvailable);
	requireFunction("resolveRovoPorts", resolveRovoPorts);
	requireFunction("rovoHealthCheck", rovoHealthCheck);
	requireFunction("waitForReady", waitForReady);

	let availability = INITIAL_ROVO_AVAILABILITY;
	let inFlightCheck = null;
	let rovoPool = null;

	function clearRovoPool() {
		if (rovoPool) {
			rovoPool.shutdown();
			rovoPool = null;
			initPool(null);
		}
	}

	function getRovoPool() {
		return rovoPool;
	}

	function shutdownRovoPool() {
		if (rovoPool) {
			rovoPool.shutdown();
		}
	}

	// Resolves to true when at least one healthy port backs the pool. Rejections are
	// handled by refreshRovoAvailability.
	async function checkRovoAvailability() {
		const { ports, source } = await resolveRovoPorts({
			portFile,
			portsFile,
			envPort: env.ROVO_PORT,
			basePort: getBasePort(),
			maxTries,
			healthCheck: rovoHealthCheck,
			classifyHealthCheck: classifyRovoHealthCheck,
			persistDiscoveredPorts: true,
		});
		if (ports.length === 0) {
			clearRovoPool();
			return false;
		}

		if (source === "discovered") {
			logger.warn(
				`[ROVO] Rediscovered healthy Rovo port files from live serve instance(s): ${ports.join(", ")}`
			);
		}

		const healthyPorts = [];
		for (const port of ports) {
			try {
				const health = await rovoHealthCheck(port);
				const classifiedHealth = classifyRovoHealthCheck(health);
				if (classifiedHealth.ready) {
					healthyPorts.push(port);
					continue;
				}

				if (classifiedHealth.terminal) {
					logger.warn("[ROVO] Port health requires attention", {
						port,
						status: classifiedHealth.status,
						reason: classifiedHealth.reason,
						message: classifiedHealth.message,
					});
					continue;
				}

				debugLog("ROVO", `Port ${port} health check returned ${classifiedHealth.status || "unknown"}`, {
					status: classifiedHealth.status,
					reason: classifiedHealth.reason,
				});
			} catch (healthCheckErr) {
				debugLog("ROVO", `Port ${port} health check failed`, {
					error: healthCheckErr.message,
				});
			}
		}

		if (healthyPorts.length === 0) {
			clearRovoPool();
			return false;
		}

		env.ROVO_PORT = String(healthyPorts[0]);

		if (rovoPool) {
			rovoPool.updatePorts(healthyPorts);
		} else {
			rovoPool = createRovoPool(healthyPorts, {
				waitForReady,
				onPortAvailable: () => {
					void onPortAvailable();
				},
			});
			initPool(rovoPool);
		}

		if (healthyPorts.length === 1) {
			logger.log(`[ROVO] Serve available on port ${healthyPorts[0]}`);
		} else {
			logger.log(`[ROVO] Pool initialized: ${healthyPorts.length} ports (${healthyPorts.join(", ")})`);
		}

		return true;
	}

	// Single-flight: the transition to `checking` and the in-flight handle are set in
	// the same synchronous step, so every caller that arrives while a check runs
	// shares it. The handle is cleared and the state leaves `checking` whether the
	// check resolves or rejects.
	function refreshRovoAvailability() {
		if (inFlightCheck) {
			return inFlightCheck;
		}
		availability = transitionRovoAvailability(availability, { type: "CHECK_STARTED" });
		inFlightCheck = (async () => {
			try {
				const available = await checkRovoAvailability();
				availability = transitionRovoAvailability(availability, { type: "CHECK_FINISHED", available, at: now() });
				return available;
			} catch (err) {
				availability = transitionRovoAvailability(availability, { type: "CHECK_FAILED", at: now() });
				debugLog("ROVO", "Not available", { error: err.message });
				return false;
			} finally {
				inFlightCheck = null;
			}
		})();
		return inFlightCheck;
	}

	async function isRovoAvailable() {
		const portFilesPresent =
			(typeof portsFile === "string" && fsModule.existsSync(portsFile)) ||
			(typeof portFile === "string" && fsModule.existsSync(portFile));
		const decision = decideRovoAvailabilityRead(availability, {
			now: now(),
			portFilesPresent,
			refreshIntervalMs,
		});

		if (decision.action === "use-cached") {
			return true;
		}
		if (decision.reason === "port-files-missing") {
			logger.warn("[ROVO] Port files removed — attempting Rovo rediscovery");
		}
		return refreshRovoAvailability();
	}

	function getRovoAvailability() {
		return availability.status;
	}

	function resolveRovoAppPortAvailability() {
		const poolStatus = rovoPool?.getStatus?.();
		if (!rovoPool) {
			return null;
		}

		const poolPorts = Array.isArray(poolStatus?.ports) ? poolStatus.ports : [];
		if (poolPorts.length === 0) {
			return null;
		}
		const hasAvailable = poolPorts.some((p) => p?.status === "available");
		return hasAvailable ? { available: true } : null;
	}

	return {
		getRovoAvailability,
		getRovoPool,
		isRovoAvailable,
		refreshRovoAvailability,
		resolveRovoAppPortAvailability,
		shutdownRovoPool,
	};
}

module.exports = {
	createRovoAvailabilityService,
};
