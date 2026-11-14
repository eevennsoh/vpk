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

test("failRovoAppRun settles the run as failed with its error", async () => {
	const run = createRun("thread-1");
	const { calls, lifecycle } = createHarness({
		runs: [["thread-1", run]],
	});
	const error = new Error("boom");

	await lifecycle.failRovoAppRun(run, error);

	assert.deepEqual(calls, [["settleRovoAppRun", "thread-1", "failed", { error }]]);
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
	run.abortController.abort();
	const { calls, lifecycle } = createHarness({
		runs: [["thread-1", run]],
		dependencies: {
			executeRovoAppManagedRun: async () => {
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
