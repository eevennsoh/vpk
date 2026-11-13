const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createRovoAvailabilityService,
} = require("./rovo-availability-service");

function createPool(ports, calls) {
	return {
		getStatus: () => ({
			ports: ports.map((port) => ({
				port,
				status: port === 9999 ? "busy" : "available",
			})),
		}),
		shutdown: () => calls.push(["pool.shutdown", ports]),
		updatePorts: (nextPorts) => {
			calls.push(["pool.updatePorts", nextPorts]);
			ports.splice(0, ports.length, ...nextPorts);
		},
	};
}

function createHarness(overrides = {}) {
	const calls = [];
	const env = { ROVO_PORT: overrides.envPort };
	const existingPaths = new Set(overrides.existingPaths || []);
	const healthByPort = new Map(overrides.healthByPort || []);
	const dependencies = {
		classifyRovoHealthCheck: (health) => {
			calls.push(["classifyRovoHealthCheck", health]);
			return health;
		},
		createRovoPool: (ports, options) => {
			calls.push(["createRovoPool", ports, options]);
			return createPool([...ports], calls);
		},
		debugLog: (...args) => calls.push(["debugLog", args]),
		env,
		fsModule: {
			existsSync: (filePath) => {
				calls.push(["existsSync", filePath]);
				return existingPaths.has(filePath);
			},
		},
		getBasePort: () => {
			calls.push(["getBasePort"]);
			return 9000;
		},
		initPool: (pool) => calls.push(["initPool", pool]),
		logger: {
			log: (...args) => calls.push(["logger.log", args]),
			warn: (...args) => calls.push(["logger.warn", args]),
		},
		maxTries: 3,
		now: () => {
			calls.push(["now"]);
			return overrides.nowValue ?? 1000;
		},
		onPortAvailable: () => calls.push(["onPortAvailable"]),
		portFile: "/tmp/rovo-port",
		portsFile: "/tmp/rovo-ports",
		refreshIntervalMs: 60_000,
		resolveRovoPorts: async (input) => {
			calls.push(["resolveRovoPorts", input]);
			return overrides.resolveRovoPortsResult ?? {
				ports: [9000],
				source: "recorded",
			};
		},
		rovoHealthCheck: async (port) => {
			calls.push(["rovoHealthCheck", port]);
			if (overrides.healthCheckErrorPorts?.includes(port)) {
				throw new Error(`port ${port} down`);
			}
			return healthByPort.get(port) || { ready: true, status: "ready" };
		},
		waitForReady: async () => {},
		...overrides.dependencies,
	};

	return {
		calls,
		env,
		service: createRovoAvailabilityService(dependencies),
	};
}

test("createRovoAvailabilityService validates required dependencies", () => {
	assert.throws(() => createRovoAvailabilityService(), /classifyRovoHealthCheck/u);
	assert.throws(
		() =>
			createRovoAvailabilityService({
				classifyRovoHealthCheck: () => ({}),
			}),
		/createRovoPool/u,
	);
});

test("refreshRovoAvailability creates a pool for healthy recorded ports", async () => {
	const { calls, env, service } = createHarness({
		resolveRovoPortsResult: {
			ports: [9000, 9001],
			source: "recorded",
		},
	});

	assert.equal(await service.refreshRovoAvailability(), true);
	assert.equal(env.ROVO_PORT, "9000");
	assert.equal(service.getRovoPool().getStatus().ports.length, 2);
	assert.deepEqual(calls.map(([name]) => name), [
		"getBasePort",
		"resolveRovoPorts",
		"rovoHealthCheck",
		"classifyRovoHealthCheck",
		"rovoHealthCheck",
		"classifyRovoHealthCheck",
		"createRovoPool",
		"initPool",
		"logger.log",
		"now",
	]);
	assert.equal(calls[6][1].length, 2);
});

test("refreshRovoAvailability logs discovered ports and filters unhealthy ports", async () => {
	const { calls, env, service } = createHarness({
		healthByPort: [
			[9000, { ready: false, terminal: true, status: "error", reason: "stuck", message: "stuck" }],
			[9001, { ready: true, status: "ready" }],
		],
		resolveRovoPortsResult: {
			ports: [9000, 9001],
			source: "discovered",
		},
	});

	assert.equal(await service.refreshRovoAvailability(), true);
	assert.equal(env.ROVO_PORT, "9001");
	assert.equal(calls.filter(([name]) => name === "logger.warn").length, 2);
	assert.deepEqual(calls.find(([name]) => name === "createRovoPool")[1], [9001]);
});

test("refreshRovoAvailability clears an existing pool when no healthy ports remain", async () => {
	let resolveRovoPortsResult = {
		ports: [9000],
		source: "recorded",
	};
	const { calls, service } = createHarness({
		dependencies: {
			resolveRovoPorts: async (input) => {
				calls.push(["resolveRovoPorts", input]);
				return resolveRovoPortsResult;
			},
		},
	});
	assert.equal(await service.refreshRovoAvailability(), true);
	assert.notEqual(service.getRovoPool(), null);

	resolveRovoPortsResult = {
		ports: [],
		source: "missing",
	};
	assert.equal(await service.refreshRovoAvailability(), false);
	assert.equal(service.getRovoPool(), null);
	assert.deepEqual(
		calls.filter(([name]) => ["pool.shutdown", "initPool"].includes(name)).map(([name, value]) => [name, value === null ? null : "pool"]),
		[
			["initPool", "pool"],
			["pool.shutdown", "pool"],
			["initPool", null],
		],
	);
});

test("refreshRovoAvailability updates an existing pool in place", async () => {
	const { calls, service } = createHarness();

	assert.equal(await service.refreshRovoAvailability(), true);
	const firstPool = service.getRovoPool();
	assert.equal(await service.refreshRovoAvailability(), true);

	assert.equal(service.getRovoPool(), firstPool);
	assert.equal(calls.some(([name]) => name === "pool.updatePorts"), true);
	assert.equal(calls.filter(([name]) => name === "createRovoPool").length, 1);
});

test("isRovoAvailable refreshes on missing port files and cache expiry", async () => {
	let tick = 1000;
	let resolveCount = 0;
	const { calls, service } = createHarness({
		existingPaths: ["/tmp/rovo-port"],
		dependencies: {
			now: () => {
				calls.push(["now"]);
				return tick;
			},
			resolveRovoPorts: async (input) => {
				calls.push(["resolveRovoPorts", input]);
				resolveCount += 1;
				return { ports: [9000], source: "recorded" };
			},
		},
	});

	assert.equal(await service.isRovoAvailable(), true);
	assert.equal(resolveCount, 1);
	assert.equal(await service.isRovoAvailable(), true);
	assert.equal(resolveCount, 1);
	tick = 62_000;
	assert.equal(await service.isRovoAvailable(), true);
	assert.equal(resolveCount, 2);
});

test("resolveRovoAppPortAvailability reports whether a pool has available ports", async () => {
	const { service } = createHarness({
		resolveRovoPortsResult: {
			ports: [9999],
			source: "recorded",
		},
	});

	assert.equal(service.resolveRovoAppPortAvailability(), null);
	assert.equal(await service.refreshRovoAvailability(), true);
	assert.equal(service.resolveRovoAppPortAvailability(), null);

	const availableHarness = createHarness();
	assert.equal(await availableHarness.service.refreshRovoAvailability(), true);
	assert.deepEqual(availableHarness.service.resolveRovoAppPortAvailability(), { available: true });
});

function createDeferred() {
	let resolve;
	let reject;
	const promise = new Promise((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, reject, resolve };
}

test("concurrent availability reads share one in-flight check", async () => {
	const pending = createDeferred();
	let resolveCount = 0;
	const { service } = createHarness({
		existingPaths: ["/tmp/rovo-port"],
		dependencies: {
			resolveRovoPorts: async () => {
				resolveCount += 1;
				return pending.promise;
			},
		},
	});

	const reads = [service.isRovoAvailable(), service.isRovoAvailable(), service.refreshRovoAvailability()];
	await Promise.resolve();
	assert.equal(service.getRovoAvailability(), "checking");
	pending.resolve({ ports: [9000], source: "recorded" });

	assert.deepEqual(await Promise.all(reads), [true, true, true]);
	assert.equal(resolveCount, 1);
	assert.equal(service.getRovoAvailability(), "available");
});

test("a rejected check ends unavailable, and the next read retries", async () => {
	let resolveCount = 0;
	const { service } = createHarness({
		existingPaths: ["/tmp/rovo-port"],
		dependencies: {
			resolveRovoPorts: async () => {
				resolveCount += 1;
				if (resolveCount === 1) {
					throw new Error("serve not reachable");
				}
				return { ports: [9000], source: "recorded" };
			},
		},
	});

	assert.equal(service.getRovoAvailability(), "unknown");
	assert.equal(await service.isRovoAvailable(), false);
	assert.equal(service.getRovoAvailability(), "unavailable");
	assert.equal(await service.isRovoAvailable(), true);
	assert.equal(resolveCount, 2);
	assert.equal(service.getRovoAvailability(), "available");
});

test("a stale available result is refreshed, measured from when the check finished", async () => {
	let tick = 1000;
	let resolveCount = 0;
	const { service } = createHarness({
		existingPaths: ["/tmp/rovo-port"],
		dependencies: {
			now: () => tick,
			resolveRovoPorts: async () => {
				resolveCount += 1;
				return { ports: [9000], source: "recorded" };
			},
		},
	});

	assert.equal(await service.isRovoAvailable(), true);
	tick = 61_000;
	assert.equal(await service.isRovoAvailable(), true);
	assert.equal(resolveCount, 1, "still fresh at exactly the refresh interval");
	tick = 61_001;
	assert.equal(await service.isRovoAvailable(), true);
	assert.equal(resolveCount, 2, "stale after the refresh interval");
});

// The test timeout only stops a regression from hanging the suite; nothing waits on real time.
test("a check that never settles is bounded: readers are released, the state ends unavailable, and the next read retries", { timeout: 10_000 }, async () => {
	const timers = [];
	let resolveCount = 0;
	const { calls, service } = createHarness({
		existingPaths: ["/tmp/rovo-port"],
		dependencies: {
			checkTimeoutMs: 30_000,
			clearTimer: (handle) => {
				if (handle) handle.cleared = true;
			},
			resolveRovoPorts: async () => {
				resolveCount += 1;
				if (resolveCount === 1) {
					return new Promise(() => {});
				}
				return { ports: [9000], source: "recorded" };
			},
			setTimer: (callback, ms) => {
				const handle = { callback, cleared: false, ms };
				timers.push(handle);
				return handle;
			},
		},
	});

	const readers = [service.isRovoAvailable(), service.isRovoAvailable(), service.refreshRovoAvailability()];
	await Promise.resolve();
	assert.equal(service.getRovoAvailability(), "checking");
	assert.equal(timers.length, 1, "one timer bounds the shared check");
	assert.equal(timers[0].ms, 30_000);

	timers[0].callback();
	assert.deepEqual(await Promise.all(readers), [false, false, false]);
	assert.equal(service.getRovoAvailability(), "unavailable");
	assert.ok(calls.some(([name, args]) => name === "logger.warn" && args[0] === "[ROVO] Availability check timed out after 30000ms"));

	assert.equal(await service.isRovoAvailable(), true);
	assert.equal(resolveCount, 2);
	assert.equal(service.getRovoAvailability(), "available");
	assert.equal(timers[1].cleared, true, "a check that settles clears its timer");
});
