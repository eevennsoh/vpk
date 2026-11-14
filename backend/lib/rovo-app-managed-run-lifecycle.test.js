const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoAppManagedRunLifecycle } = require("./rovo-app-managed-run-lifecycle");
const { createRovoAppRunManager } = require("./rovo-app-runs");
const { createRovoAppRunStateService } = require("./rovo-app-run-state");

function flushMicrotasks() {
	return new Promise((resolve) => setImmediate(resolve));
}

function createRun(threadId, overrides = {}) {
	return {
		abortController: new AbortController(),
		backend: "ai-gateway",
		threadId,
		...overrides,
	};
}

function createHarness(overrides = {}) {
	const calls = [];
	const runs = new Map(overrides.runs || []);
	const queuedThreadIds = [...(overrides.queuedThreadIds || [])];
	const dependencies = {
		executeRovoAppManagedRun: async (run) => {
			calls.push(["executeRovoAppManagedRun", run.threadId]);
		},
		logger: {
			error: (...args) => calls.push(["logger.error", args]),
		},
		persistRovoAppRunState: async (threadId, run) => {
			calls.push(["persistRovoAppRunState", threadId, run]);
		},
		resolveRovoAppPortAvailability: () => {
			calls.push(["resolveRovoAppPortAvailability"]);
			return { available: true };
		},
		rovoAppRunManager: {
			getRun: (threadId) => {
				calls.push(["getRun", threadId]);
				return runs.get(threadId) || null;
			},
			isCurrentRun: (run) => Boolean(run) && runs.get(run.threadId) === run,
			hasSubscribers: (threadId) => {
				calls.push(["hasSubscribers", threadId]);
				return false;
			},
			listQueuedThreadIds: () => {
				calls.push(["listQueuedThreadIds"]);
				return [...queuedThreadIds];
			},
			markRunStarted: (threadId, patch) => {
				calls.push(["markRunStarted", threadId, patch]);
				const run = runs.get(threadId);
				if (!run) {
					return null;
				}
				const index = queuedThreadIds.indexOf(threadId);
				if (index !== -1) {
					queuedThreadIds.splice(index, 1);
				}
				const markedRun = {
					...run,
					...patch,
					status: patch.status,
				};
				runs.set(threadId, markedRun);
				return markedRun;
			},
			removeQueuedRun: (threadId) => {
				calls.push(["removeQueuedRun", threadId]);
				const index = queuedThreadIds.indexOf(threadId);
				if (index !== -1) {
					queuedThreadIds.splice(index, 1);
				}
			},
		},
		settleRovoAppRun: async (run, outcome, details) => {
			calls.push(["settleRovoAppRun", run.threadId, outcome, details]);
			return true;
		},
		...overrides.dependencies,
	};
	const lifecycle = createRovoAppManagedRunLifecycle(dependencies);

	return {
		calls,
		lifecycle,
		queuedThreadIds,
		runs,
	};
}

// The lifecycle over the real run manager and run-state service.
function createRealLifecycle({ executeRovoAppManagedRun, persistRovoAppRunState } = {}) {
	const quiet = { error: () => {}, info: () => {}, warn: () => {} };
	const runManager = createRovoAppRunManager({ logger: quiet });
	const threadWrites = [];
	const state = createRovoAppRunStateService({
		activeRequests: new Map(),
		createFailureSseChunks: () => ["failure-chunk"],
		logger: quiet,
		rovoAppRunManager: runManager,
		rovoAppThreadManager: {
			listThreads: async () => [],
			updateThread: async (threadId, patch) => {
				threadWrites.push(patch);
				return { id: threadId, ...patch };
			},
		},
		startNextQueuedRun: () => {},
		synchronizeRovoAppThreadGeneratedFiles: async () => {},
	});
	const lifecycle = createRovoAppManagedRunLifecycle({
		executeRovoAppManagedRun: executeRovoAppManagedRun ?? (async () => {}),
		logger: quiet,
		persistRovoAppRunState: persistRovoAppRunState ?? state.persistRovoAppRunState,
		resolveRovoAppPortAvailability: () => ({}),
		rovoAppRunManager: runManager,
		settleRovoAppRun: state.settleRovoAppRun,
	});
	return { lifecycle, runManager, state, threadWrites };
}

function createSubscriber() {
	const listeners = new Map();
	return {
		ended: false,
		writes: [],
		end() {
			this.ended = true;
			listeners.get("close")?.();
		},
		flushHeaders() {},
		once(eventName, listener) {
			listeners.set(eventName, listener);
			return this;
		},
		setHeader() {},
		status() {
			return this;
		},
		write(chunk) {
			this.writes.push(chunk);
		},
	};
}

test("failRovoAppRun ends the run failed: its subscriber gets the failure card and the run leaves the registry", async () => {
	const { lifecycle, runManager, threadWrites } = createRealLifecycle();
	const run = runManager.createRun({ threadId: "thread-1" });
	runManager.markRunStarted("thread-1", { status: "streaming" });
	const subscriber = createSubscriber();
	runManager.attachSubscriber("thread-1", subscriber);

	await lifecycle.failRovoAppRun(run, new Error("boom"));

	assert.equal(run.status, "failed");
	assert.equal(run.error, "Rovo run failed");
	assert.deepEqual(subscriber.writes, ["failure-chunk"]);
	assert.equal(subscriber.ended, true);
	assert.equal(runManager.getRun("thread-1"), null);
	assert.deepEqual(threadWrites, [{ activeRun: null }]);
});

test("a run cancelled while its started state is stored does not execute", async () => {
	let executed = 0;
	let releaseWrite;
	const writeHeld = new Promise((resolve) => {
		releaseWrite = resolve;
	});
	let harness;
	harness = createRealLifecycle({
		executeRovoAppManagedRun: async () => {
			executed += 1;
		},
		persistRovoAppRunState: async (threadId, run) => {
			await writeHeld;
			return harness.state.persistRovoAppRunState(threadId, run);
		},
	});
	const run = harness.runManager.createRun({ threadId: "thread-1" });

	const starting = harness.lifecycle.startManagedRovoAppRun(run);
	await harness.state.settleRovoAppRun(run, "cancelled");
	releaseWrite();
	await starting;
	await flushMicrotasks();

	assert.equal(run.status, "cancelled");
	assert.equal(executed, 0);
});

test("startManagedRovoAppRun marks, persists, and executes a run", async () => {
	const run = createRun("thread-1");
	const { calls, lifecycle } = createHarness({
		runs: [["thread-1", run]],
	});

	await lifecycle.startManagedRovoAppRun(run);
	await flushMicrotasks();

	assert.deepEqual(calls.slice(0, 4), [
		["hasSubscribers", "thread-1"],
		[
			"markRunStarted",
			"thread-1",
			{
				backend: "ai-gateway",
				portIndex: null,
				rovoPort: null,
				status: "background",
			},
		],
		[
			"persistRovoAppRunState",
			"thread-1",
			{
				...run,
				backend: "ai-gateway",
				portIndex: null,
				rovoPort: null,
				status: "background",
			},
		],
		["executeRovoAppManagedRun", "thread-1"],
	]);
});

test("startManagedRovoAppRun logs non-abort execution failures and fails the run", async () => {
	const run = createRun("thread-1");
	const failure = new Error("execution failed");
	const { calls, lifecycle } = createHarness({
		runs: [["thread-1", run]],
		dependencies: {
			executeRovoAppManagedRun: async () => {
				throw failure;
			},
		},
	});

	await lifecycle.startManagedRovoAppRun(run);
	await flushMicrotasks();
	await flushMicrotasks();

	assert.equal(calls.some(([name]) => name === "logger.error"), true);
	assert.deepEqual(calls.find(([name]) => name === "settleRovoAppRun"), ["settleRovoAppRun", "thread-1", "failed", { error: failure }]);
});

test("startManagedRovoAppRun still executes a run whose started state cannot be stored", async () => {
	const run = createRun("thread-1");
	const { calls, lifecycle } = createHarness({
		runs: [["thread-1", run]],
		dependencies: {
			persistRovoAppRunState: async () => {
				throw new Error("thread store unavailable");
			},
		},
	});

	await lifecycle.startManagedRovoAppRun(run);
	await flushMicrotasks();

	assert.equal(calls.some(([name]) => name === "logger.error"), true);
	assert.equal(calls.some(([name]) => name === "executeRovoAppManagedRun"), true);
	assert.equal(calls.some(([name]) => name === "settleRovoAppRun"), false);
});

test("a run whose final save and failure clear both fail ends failed without an unhandled rejection", async (t) => {
	const unhandled = [];
	const onUnhandled = (reason) => unhandled.push(reason);
	process.on("unhandledRejection", onUnhandled);
	t.after(() => process.off("unhandledRejection", onUnhandled));

	const quiet = { error: () => {}, info: () => {}, warn: () => {} };
	const runManager = createRovoAppRunManager({ logger: quiet });
	let settled;
	const queueStarted = new Promise((resolve) => {
		settled = resolve;
	});
	const state = createRovoAppRunStateService({
		activeRequests: new Map(),
		logger: quiet,
		rovoAppRunManager: runManager,
		rovoAppThreadManager: {
			listThreads: async () => [],
			updateThread: async () => {
				throw new Error("thread store unavailable");
			},
		},
		startNextQueuedRun: () => settled(),
		synchronizeRovoAppThreadGeneratedFiles: async () => {},
	});
	const lifecycle = createRovoAppManagedRunLifecycle({
		executeRovoAppManagedRun: (markedRun) =>
			state.settleRovoAppRun(markedRun, "completed", { messages: [{ id: "assistant-1" }] }),
		logger: quiet,
		persistRovoAppRunState: async () => null,
		resolveRovoAppPortAvailability: () => ({}),
		rovoAppRunManager: runManager,
		settleRovoAppRun: state.settleRovoAppRun,
	});
	const run = runManager.createRun({ threadId: "thread-1" });

	await lifecycle.startManagedRovoAppRun(run);
	await queueStarted;
	await flushMicrotasks();

	assert.equal(run.status, "failed");
	assert.equal(runManager.getRun("thread-1"), null);
	assert.deepEqual(unhandled, []);
});

test("startManagedRovoAppRun suppresses logs for aborted execution failures", async () => {
	const run = createRun("thread-1");
	const { calls, lifecycle } = createHarness({
		runs: [["thread-1", run]],
		dependencies: {
			executeRovoAppManagedRun: async (markedRun) => {
				markedRun.abortController.abort();
				throw new Error("execution aborted");
			},
		},
	});

	await lifecycle.startManagedRovoAppRun(run);
	await flushMicrotasks();
	await flushMicrotasks();

	assert.equal(calls.some(([name]) => name === "logger.error"), false);
	assert.equal(calls.some(([name]) => name === "settleRovoAppRun"), true);
});

test("startNextQueuedRovoAppRun removes stale queued runs and starts the first available run", async () => {
	const threadOneRun = createRun("thread-1");
	const threadTwoRun = createRun("thread-2");
	const { calls, lifecycle, queuedThreadIds } = createHarness({
		queuedThreadIds: ["missing-thread", "thread-1", "thread-2"],
		runs: [
			["thread-1", threadOneRun],
			["thread-2", threadTwoRun],
		],
	});

	await lifecycle.startNextQueuedRovoAppRun();
	await flushMicrotasks();

	assert.deepEqual(queuedThreadIds, ["thread-2"]);
	assert.equal(
		calls.some((call) => call[0] === "removeQueuedRun" && call[1] === "missing-thread"),
		true,
	);
	assert.equal(
		calls.some((call) => call[0] === "markRunStarted" && call[1] === "thread-1"),
		true,
	);
	assert.equal(
		calls.some((call) => call[0] === "markRunStarted" && call[1] === "thread-2"),
		false,
	);
});

test("startNextQueuedRovoAppRun leaves queued runs untouched when no port is available", async () => {
	const run = createRun("thread-1");
	const { calls, lifecycle, queuedThreadIds } = createHarness({
		queuedThreadIds: ["thread-1"],
		runs: [["thread-1", run]],
		dependencies: {
			resolveRovoAppPortAvailability: () => {
				calls.push(["resolveRovoAppPortAvailability"]);
				return null;
			},
		},
	});

	await lifecycle.startNextQueuedRovoAppRun();

	assert.deepEqual(queuedThreadIds, ["thread-1"]);
	assert.equal(calls.some(([name]) => name === "markRunStarted"), false);
});
