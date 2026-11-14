const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildRovoAppActiveRunPayload,
	createRovoAppRunStateService,
} = require("./rovo-app-run-state");

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
		rovoAppRunManager: {
			clearRun: (threadId) => {
				calls.push(["clearRun", threadId]);
				runs.delete(threadId);
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
					clearRun: () => {},
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

test("finalizeRovoAppRun persists final messages, synchronizes files, clears active request, and starts queued work", async () => {
	const messages = [{ id: "assistant-1" }];
	const streamedMessages = [{ id: "assistant-1", parts: [] }];
	const { calls, runs, service } = createHarness({
		runs: [["thread-1", { id: "run-1" }]],
		threads: [["thread-1", { id: "thread-1", activeRun: { id: "run-1" } }]],
	});

	await service.finalizeRovoAppRun("thread-1", { id: "run-1" }, messages, { streamedMessages });

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
		["clearRun", "thread-1"],
		["startNextQueuedRun"],
	]);
});

test("finalizeRovoAppRun falls back to clearing run state without a final message list", async () => {
	const { calls, service } = createHarness({
		runs: [["thread-1", { id: "run-1" }]],
		threads: [["thread-1", { id: "thread-1", activeRun: { id: "run-1" } }]],
	});

	await service.finalizeRovoAppRun("thread-1", { id: "run-1" }, null);

	assert.deepEqual(calls, [
		["updateThread", "thread-1", { activeRun: null }],
		["activeRequests.delete", "thread-1"],
		["clearRun", "thread-1"],
		["startNextQueuedRun"],
	]);
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
