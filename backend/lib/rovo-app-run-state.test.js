const assert = require("node:assert/strict");
const test = require("node:test");

const { EventEmitter } = require("node:events");

const { createRovoAppRunManager } = require("./rovo-app-runs");
const {
	buildRovoAppActiveRunPayload,
	createRovoAppRunStateService,
} = require("./rovo-app-run-state");

const QUIET_LOGGER = { error: () => {}, info: () => {}, warn: () => {} };

function createHarness(overrides = {}) {
	const calls = [];
	const threads = new Map(overrides.threads || []);
	const runs = new Map(overrides.runs || []);
	const dependencies = {
		activeRequests: {
			delete: (threadId) => {
				calls.push(["activeRequests.delete", threadId]);
				return true;
			},
		},
		logger: QUIET_LOGGER,
		rovoAppRunManager: {
			appendChunk: (threadId, chunk) => {
				calls.push(["appendChunk", threadId, chunk]);
				return true;
			},
			getRun: (threadId) => runs.get(threadId) ?? null,
			settleRun: (threadId, options) => {
				calls.push(["settleRun", threadId, options]);
				const run = runs.get(threadId);
				runs.delete(threadId);
				return run ?? null;
			},
			hasRun: (threadId) => {
				calls.push(["hasRun", threadId]);
				return runs.has(threadId);
			},
			setRunBackend: (threadId, backend) => {
				calls.push(["setRunBackend", threadId, backend]);
				const run = runs.get(threadId);
				if (!run) {
					return null;
				}
				const nextRun = {
					...run,
					backend,
				};
				runs.set(threadId, nextRun);
				return nextRun;
			},
		},
		rovoAppThreadManager: {
			listThreads: async () => {
				calls.push(["listThreads"]);
				return [...threads.values()];
			},
			getThread: async (threadId) => {
				calls.push(["getThread", threadId]);
				return threads.get(threadId) || null;
			},
			updateThread: async (threadId, patch) => {
				calls.push(["updateThread", threadId, patch]);
				const currentThread = threads.get(threadId);
				if (!currentThread) {
					return null;
				}
				const activeRun =
					patch.activeRun && typeof patch.activeRun === "object"
						? {
							...patch.activeRun,
							sessionId: patch.activeRun.sessionId ?? currentThread.sessionId ?? null,
							sessionMode:
								patch.activeRun.sessionMode ??
								(currentThread.sessionId
									? currentThread.sessionMode ?? "persistent"
									: null),
						}
						: patch.activeRun;
				const nextThread = {
					...currentThread,
					...patch,
					...(Object.hasOwn(patch, "activeRun") ? { activeRun } : {}),
				};
				threads.set(threadId, nextThread);
				return nextThread;
			},
		},
		startNextQueuedRun: () => {
			calls.push(["startNextQueuedRun"]);
		},
		synchronizeRovoAppThreadGeneratedFiles: async (thread, options) => {
			calls.push(["synchronizeRovoAppThreadGeneratedFiles", thread, options]);
		},
		...overrides.dependencies,
	};

	return {
		calls,
		runs,
		service: createRovoAppRunStateService(dependencies),
		threads,
	};
}

test("buildRovoAppActiveRunPayload normalizes active run fields", () => {
	assert.equal(buildRovoAppActiveRunPayload(null, { id: "thread-1" }), null);
	assert.deepEqual(
		buildRovoAppActiveRunPayload(
			{
				id: "run-1",
				backend: "rovo",
				status: "streaming",
				rovoPort: 8001,
				startedAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:01.000Z",
			},
			{
				sessionId: " session-1 ",
				sessionMode: "ephemeral",
			},
		),
		{
			id: "run-1",
			backend: "rovo",
			status: "streaming",
			portIndex: null,
			rovoPort: 8001,
			sessionId: "session-1",
			sessionMode: "ephemeral",
			startedAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:01.000Z",
		},
	);
	assert.deepEqual(
		buildRovoAppActiveRunPayload(
			{
				id: "run-2",
				backend: "ai-gateway",
				status: "background",
				rovoPort: 0,
			},
			{},
		),
		{
			id: "run-2",
			backend: "ai-gateway",
			status: "background",
			portIndex: null,
			rovoPort: null,
			sessionId: null,
			sessionMode: null,
			startedAt: undefined,
			updatedAt: undefined,
		},
	);
});

test("createRovoAppRunStateService validates required dependencies", () => {
	assert.throws(() => createRovoAppRunStateService(), /activeRequests\.delete/u);
	assert.throws(
		() =>
			createRovoAppRunStateService({
				activeRequests: { delete: () => true },
				rovoAppRunManager: {
					appendChunk: () => true,
					getRun: () => null,
					hasRun: () => false,
				},
			}),
		/rovoAppRunManager\.setRunBackend/u,
	);
});

test("persistRovoAppRunState writes the normalized active run payload", async () => {
	const run = {
		id: "run-1",
		backend: "rovo",
		status: "streaming",
		rovoPort: 8100,
	};
	const { calls, service } = createHarness({
		threads: [["thread-1", { id: "thread-1", sessionId: "session-1" }]],
	});

	const result = await service.persistRovoAppRunState("thread-1", run);

	assert.equal(result.activeRun.id, "run-1");
	assert.equal(result.activeRun.sessionId, "session-1");
	assert.equal(result.activeRun.sessionMode, "persistent");
	assert.deepEqual(calls, [
		[
			"updateThread",
			"thread-1",
			{
				activeRun: {
					id: "run-1",
					backend: "rovo",
					status: "streaming",
					portIndex: null,
					rovoPort: 8100,
					sessionId: null,
					sessionMode: null,
					startedAt: undefined,
					updatedAt: undefined,
				},
			},
		],
	]);
});

test("persistRovoAppRunState returns null for missing inputs or missing threads", async () => {
	const { calls, service } = createHarness();

	assert.equal(await service.persistRovoAppRunState("", { id: "run-1" }), null);
	assert.equal(await service.persistRovoAppRunState("missing", { id: "run-1" }), null);
	assert.equal(calls.length, 1);
	assert.equal(calls[0][0], "updateThread");
	assert.equal(calls[0][1], "missing");
});

test("persistRovoAppRunBackend updates the run backend before persisting state", async () => {
	const { calls, service } = createHarness({
		runs: [["thread-1", { id: "run-1", status: "streaming" }]],
		threads: [["thread-1", { id: "thread-1" }]],
	});

	const result = await service.persistRovoAppRunBackend("thread-1", "rovo");

	assert.equal(result.activeRun.backend, "rovo");
	assert.deepEqual(calls.map(([name]) => name), [
		"setRunBackend",
		"updateThread",
	]);
	assert.equal(await service.persistRovoAppRunBackend("missing", "rovo"), null);
});

test("clearRovoAppRunState clears activeRun when a thread id is present", async () => {
	const { calls, service } = createHarness({
		threads: [["thread-1", { id: "thread-1", activeRun: { id: "run-1" } }]],
	});

	assert.equal(await service.clearRovoAppRunState(null), null);
	const result = await service.clearRovoAppRunState("thread-1");

	assert.deepEqual(result.activeRun, null);
	assert.deepEqual(calls, [
		[
			"updateThread",
			"thread-1",
			{
				activeRun: null,
			},
		],
	]);
});

test("persistRovoAppRunMessagesSnapshot updates only valid existing thread snapshots", async () => {
	const messages = [{ id: "message-1" }];
	const { calls, service } = createHarness({
		threads: [["thread-1", { id: "thread-1", messages: [] }]],
	});

	assert.equal(await service.persistRovoAppRunMessagesSnapshot("thread-1", null), null);
	assert.equal(await service.persistRovoAppRunMessagesSnapshot("missing", messages), null);
	const result = await service.persistRovoAppRunMessagesSnapshot("thread-1", messages);

	assert.equal(result.messages, messages);
	assert.deepEqual(calls, [
		["updateThread", "missing", { messages }],
		["updateThread", "thread-1", { messages }],
	]);
});

test("settleRovoAppRun completed saves final messages, synchronizes files, clears the active request, settles, and starts queued work", async () => {
	const messages = [{ id: "assistant-1" }];
	const streamedMessages = [{ id: "assistant-1", parts: [] }];
	const run = { id: "run-1", threadId: "thread-1" };
	const { calls, runs, service } = createHarness({
		runs: [["thread-1", run]],
		threads: [["thread-1", { id: "thread-1", activeRun: { id: "run-1" } }]],
	});

	assert.equal(await service.settleRovoAppRun(run, "completed", { messages, streamedMessages }), true);

	assert.equal(runs.has("thread-1"), false);
	assert.deepEqual(calls, [
		["updateThread", "thread-1", { activeRun: null, messages }],
		[
			"synchronizeRovoAppThreadGeneratedFiles",
			{
				id: "thread-1",
				activeRun: null,
				messages,
			},
			{ streamedMessages },
		],
		["activeRequests.delete", "thread-1"],
		["settleRun", "thread-1", { outcome: "completed", runId: "run-1", error: null }],
		["startNextQueuedRun"],
	]);
});

test("settleRovoAppRun completed without a final message list only clears the stored run", async () => {
	const run = { id: "run-1", threadId: "thread-1" };
	const { calls, service } = createHarness({
		runs: [["thread-1", run]],
		threads: [["thread-1", { id: "thread-1", activeRun: { id: "run-1" } }]],
	});

	await service.settleRovoAppRun(run, "completed", { messages: null });

	assert.deepEqual(calls, [
		["updateThread", "thread-1", { activeRun: null }],
		["activeRequests.delete", "thread-1"],
		["settleRun", "thread-1", { outcome: "completed", runId: "run-1", error: null }],
		["startNextQueuedRun"],
	]);
});

test("settleRovoAppRun failed appends the failure card before clearing; an abort gets no card", async () => {
	const run = { id: "run-1", threadId: "thread-1" };
	const { calls, service } = createHarness({
		runs: [["thread-1", run]],
		threads: [["thread-1", { id: "thread-1", activeRun: { id: "run-1" } }]],
		dependencies: { createFailureSseChunks: () => ["failure-chunk"] },
	});

	await service.settleRovoAppRun(run, "failed", { error: new Error("boom") });
	assert.deepEqual(calls, [
		["appendChunk", "thread-1", "failure-chunk"],
		["updateThread", "thread-1", { activeRun: null }],
		["activeRequests.delete", "thread-1"],
		["settleRun", "thread-1", { outcome: "failed", runId: "run-1", error: "Rovo run failed" }],
		["startNextQueuedRun"],
	]);

	const abortedRun = { id: "run-2", threadId: "thread-2" };
	const aborted = createHarness({
		runs: [["thread-2", abortedRun]],
		threads: [["thread-2", { id: "thread-2" }]],
		dependencies: { createFailureSseChunks: () => ["failure-chunk"] },
	});
	const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
	await aborted.service.settleRovoAppRun(abortedRun, "failed", { error: abortError });
	assert.equal(aborted.calls.some(([name]) => name === "appendChunk"), false);
});

function createSubscriber() {
	const emitter = new EventEmitter();
	return {
		ended: false,
		writes: [],
		end() {
			this.ended = true;
		},
		flushHeaders() {},
		once(eventName, listener) {
			emitter.once(eventName, listener);
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

// The service over the real run manager; thread writes fail while `failWrites.value` is true.
function createRealRunHarness({ failWrites = false } = {}) {
	const runManager = createRovoAppRunManager({ logger: QUIET_LOGGER });
	const activeRequests = new Map();
	const threadWrites = [];
	const errors = [];
	const writeFailure = { value: failWrites };
	let queuedStarts = 0;
	const service = createRovoAppRunStateService({
		activeRequests,
		createFailureSseChunks: () => ["failure-chunk"],
		logger: { ...QUIET_LOGGER, error: (...args) => errors.push(args) },
		rovoAppRunManager: runManager,
		rovoAppThreadManager: {
			listThreads: async () => [],
			updateThread: async (threadId, patch) => {
				threadWrites.push([threadId, patch]);
				if (writeFailure.value) {
					throw new Error("thread store unavailable");
				}
				return { id: threadId, ...patch };
			},
		},
		startNextQueuedRun: () => {
			queuedStarts += 1;
		},
		synchronizeRovoAppThreadGeneratedFiles: async () => {},
	});
	return {
		activeRequests,
		errors,
		getQueuedStarts: () => queuedStarts,
		runManager,
		service,
		threadWrites,
		writeFailure,
	};
}

test("a finished run whose save and clear both fail ends failed instead of rejecting", async () => {
	const harness = createRealRunHarness({ failWrites: true });
	const run = harness.runManager.createRun({ threadId: "thread-1" });
	harness.runManager.markRunStarted("thread-1", { status: "streaming" });
	const subscriber = createSubscriber();
	harness.runManager.attachSubscriber("thread-1", subscriber);
	harness.activeRequests.set("thread-1", { port: 8001 });

	const settled = await harness.service.settleRovoAppRun(run, "completed", { messages: [{ id: "assistant-1" }] });

	assert.equal(settled, true);
	assert.equal(run.status, "failed");
	assert.equal(run.error, "Rovo run failed");
	assert.equal(harness.runManager.getRun("thread-1"), null);
	assert.equal(harness.activeRequests.has("thread-1"), false);
	assert.deepEqual(subscriber.writes, ["failure-chunk"]);
	assert.equal(subscriber.ended, true);
	assert.deepEqual(harness.threadWrites.map(([, patch]) => Object.keys(patch).sort()), [["activeRun", "messages"], ["activeRun"]]);
	assert.equal(harness.errors.length, 2);
	assert.equal(harness.getQueuedStarts(), 1);
});

test("a late settle of a cancelled run leaves the run that replaced it alone", async () => {
	for (const [outcome, details] of [
		["failed", { error: Object.assign(new Error("aborted"), { name: "AbortError" }) }],
		["completed", { messages: [{ id: "old-assistant" }] }],
	]) {
		const harness = createRealRunHarness();
		const oldRun = harness.runManager.createRun({ threadId: "thread-1" });
		harness.runManager.markRunStarted("thread-1", { status: "streaming" });
		harness.runManager.settleRun("thread-1", { outcome: "cancelled" });
		const replacement = harness.runManager.createRun({ threadId: "thread-1" });
		harness.runManager.markRunStarted("thread-1", { status: "streaming" });
		harness.activeRequests.set("thread-1", { port: 8002 });

		assert.equal(await harness.service.settleRovoAppRun(oldRun, outcome, details), false, outcome);

		assert.equal(oldRun.status, "cancelled", outcome);
		assert.equal(harness.runManager.getRun("thread-1"), replacement, outcome);
		assert.equal(replacement.status, "streaming", outcome);
		assert.equal(harness.activeRequests.has("thread-1"), true, outcome);
		assert.deepEqual(harness.threadWrites, [], outcome);
		assert.equal(harness.getQueuedStarts(), 0, outcome);
	}
});

test("a late settle of a cancelled run with no successor still saves its messages", async () => {
	const harness = createRealRunHarness();
	const run = harness.runManager.createRun({ threadId: "thread-1" });
	harness.runManager.markRunStarted("thread-1", { status: "background" });
	harness.runManager.settleRun("thread-1", { outcome: "cancelled" });

	assert.equal(await harness.service.settleRovoAppRun(run, "completed", { messages: [{ id: "partial" }] }), true);

	assert.equal(run.status, "cancelled");
	assert.deepEqual(harness.threadWrites, [["thread-1", { activeRun: null, messages: [{ id: "partial" }] }]]);
	assert.equal(harness.getQueuedStarts(), 1);
});

test("sweepOrphanedRovoAppRuns clears stored runs that no live run owns and never throws", async () => {
	const { calls, service } = createHarness({
		runs: [["thread-live", { id: "run-live", threadId: "thread-live" }]],
		threads: [
			["thread-live", { id: "thread-live", activeRun: { id: "run-live" } }],
			["thread-orphan", { id: "thread-orphan", activeRun: { id: "run-orphan" } }],
			["thread-idle", { id: "thread-idle", activeRun: null }],
		],
	});

	assert.equal(await service.sweepOrphanedRovoAppRuns(), 1);
	assert.deepEqual(
		calls.filter(([name]) => name === "updateThread"),
		[["updateThread", "thread-orphan", { activeRun: null }]],
	);

	const failing = createHarness({
		dependencies: {
			rovoAppThreadManager: {
				listThreads: async () => {
					throw new Error("unreadable");
				},
				updateThread: async () => null,
			},
		},
	});
	assert.equal(await failing.service.sweepOrphanedRovoAppRuns(), 0);
});

test("reconcileOrphanedRovoAppThread clears activeRun only when no in-memory run exists", async () => {
	const activeThread = { id: "thread-active", activeRun: { id: "run-active" } };
	const orphanThread = { id: "thread-orphan", activeRun: { id: "run-orphan" } };
	const { calls, service } = createHarness({
		runs: [["thread-active", { id: "run-active" }]],
		threads: [
			["thread-active", activeThread],
			["thread-orphan", orphanThread],
		],
	});

	assert.equal(await service.reconcileOrphanedRovoAppThread(null), null);
	assert.equal((await service.reconcileOrphanedRovoAppThread({ id: "thread-idle" })).id, "thread-idle");
	assert.equal(await service.reconcileOrphanedRovoAppThread(activeThread), activeThread);
	const result = await service.reconcileOrphanedRovoAppThread(orphanThread);

	assert.deepEqual(result.activeRun, null);
	assert.deepEqual(calls, [
		["hasRun", "thread-active"],
		["hasRun", "thread-orphan"],
		["updateThread", "thread-orphan", { activeRun: null }],
	]);
});
