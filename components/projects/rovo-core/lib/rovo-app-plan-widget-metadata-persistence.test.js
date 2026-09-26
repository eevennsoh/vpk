const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const {
	persistRovoAppPlanWidgetMetadata,
} = loadRovoCoreModule("lib/rovo-app-plan-widget-metadata-persistence.ts");

function createPlanMessage(overrides = {}) {
	return {
		id: "message-plan",
		role: "assistant",
		parts: [
			{
				type: "data-widget-data",
				data: {
					type: "plan",
					payload: {
						title: "Plan",
						shortDescription: "",
						markdown: "# Plan",
						tasks: [{ id: "task-1", label: "Build it", blockedBy: [] }],
						agents: [],
						...overrides,
					},
				},
			},
		],
		metadata: {
			visibility: "visible",
		},
	};
}

function getPlanPayload(messages) {
	return messages[0].parts[0].data.payload;
}

function createThread(overrides = {}) {
	return {
		id: "thread-1",
		title: "New chat",
		messages: [createPlanMessage()],
		realtimeMessages: [],
		visibility: "private",
		modelId: null,
		provider: null,
		activeDocumentId: null,
		sessionId: null,
		sessionMode: "persistent",
		activeRun: null,
		createdAt: "2026-07-04T00:00:00.000Z",
		updatedAt: "2026-07-04T00:00:00.000Z",
		...overrides,
	};
}

function createLifecycle(overrides = {}) {
	const calls = [];
	const messages = [createPlanMessage()];
	let threads = [createThread({ messages })];
	let rovoMessages = messages;
	const deletedThreadIdsRef = { current: new Set() };
	const lastPersistedKeyRef = { current: "" };

	return {
		activeThreadIdRef: { current: "thread-1" },
		beginThreadHydration() {
			calls.push(["beginThreadHydration"]);
		},
		calls,
		clearPendingPlanMetadataGeneration(sourceMessageId) {
			calls.push(["clearPendingPlanMetadataGeneration", sourceMessageId]);
		},
		completeThreadHydration() {
			calls.push(["completeThreadHydration"]);
		},
		deletedThreadIdsRef,
		get lastPersistedKey() {
			return lastPersistedKeyRef.current;
		},
		lastPersistedKeyRef,
		messages,
		reconcileThreadWithLocalTitle(thread) {
			calls.push(["reconcileThreadWithLocalTitle", thread.id]);
			return thread;
		},
		scheduleHydrationCompletion(callback) {
			calls.push(["scheduleHydrationCompletion"]);
			callback();
		},
		setRovoMessages(nextMessages) {
			rovoMessages = nextMessages;
			calls.push(["setRovoMessages", getPlanPayload(nextMessages).title]);
		},
		setThreads(nextThreads) {
			threads =
				typeof nextThreads === "function"
					? nextThreads(threads)
					: nextThreads;
			calls.push(["setThreads", threads.map((thread) => thread.id)]);
		},
		get rovoMessages() {
			return rovoMessages;
		},
		get threads() {
			return threads;
		},
		threadsRef: { current: threads },
		updateThread: async (threadId, patch) => {
			calls.push(["updateThread", threadId, getPlanPayload(patch.messages).title]);
			return createThread({
				id: threadId,
				messages: patch.messages,
				title: "Persisted plan",
				updatedAt: "2026-07-04T00:00:01.000Z",
			});
		},
		warn(message, error) {
			calls.push(["warn", message, error instanceof Error ? error.message : String(error)]);
		},
		...overrides,
	};
}

test("persistRovoAppPlanWidgetMetadata clears pending state when metadata is empty", async () => {
	const lifecycle = createLifecycle();

	await persistRovoAppPlanWidgetMetadata({
		...lifecycle,
		sourceMessageId: "message-plan",
		threadId: "thread-1",
		title: "   ",
		shortDescription: "",
	});

	assert.deepEqual(lifecycle.calls, [
		["clearPendingPlanMetadataGeneration", "message-plan"],
	]);
	assert.equal(getPlanPayload(lifecycle.rovoMessages).title, "Plan");
	assert.equal(lifecycle.lastPersistedKey, "");
});

test("persistRovoAppPlanWidgetMetadata bails when the thread is missing locally", async () => {
	const lifecycle = createLifecycle({
		threadsRef: { current: [] },
	});

	await persistRovoAppPlanWidgetMetadata({
		...lifecycle,
		sourceMessageId: "message-plan",
		threadId: "thread-missing",
		title: "Specific plan title",
	});

	assert.deepEqual(lifecycle.calls, [
		["clearPendingPlanMetadataGeneration", "message-plan"],
	]);
	assert.equal(lifecycle.lastPersistedKey, "");
});

test("persistRovoAppPlanWidgetMetadata updates local and persisted plan metadata", async () => {
	const lifecycle = createLifecycle();

	await persistRovoAppPlanWidgetMetadata({
		...lifecycle,
		sourceMessageId: "message-plan",
		threadId: "thread-1",
		title: "  Specific plan title  ",
		shortDescription: "  Focused summary  ",
	});

	assert.equal(getPlanPayload(lifecycle.rovoMessages).title, "Specific plan title");
	assert.equal(getPlanPayload(lifecycle.rovoMessages).shortDescription, "Focused summary");
	assert.equal(getPlanPayload(lifecycle.threads[0].messages).title, "Specific plan title");
	assert.notEqual(lifecycle.lastPersistedKey, "");
	assert.deepEqual(lifecycle.calls, [
		["setThreads", ["thread-1"]],
		["setRovoMessages", "Specific plan title"],
		["clearPendingPlanMetadataGeneration", "message-plan"],
		["updateThread", "thread-1", "Specific plan title"],
		["reconcileThreadWithLocalTitle", "thread-1"],
		["setThreads", ["thread-1"]],
	]);
});

test("persistRovoAppPlanWidgetMetadata hydrates active messages when persisted messages differ", async () => {
	const serverMessages = [createPlanMessage({ title: "Server plan title" })];
	const lifecycle = createLifecycle({
		updateThread: async (threadId, patch) => {
			lifecycle.calls.push(["updateThread", threadId, getPlanPayload(patch.messages).title]);
			return createThread({
				id: threadId,
				messages: serverMessages,
				title: "Persisted plan",
				updatedAt: "2026-07-04T00:00:01.000Z",
			});
		},
	});

	await persistRovoAppPlanWidgetMetadata({
		...lifecycle,
		sourceMessageId: "message-plan",
		threadId: "thread-1",
		title: "Specific plan title",
	});

	assert.equal(getPlanPayload(lifecycle.rovoMessages).title, "Server plan title");
	assert.deepEqual(lifecycle.calls, [
		["setThreads", ["thread-1"]],
		["setRovoMessages", "Specific plan title"],
		["clearPendingPlanMetadataGeneration", "message-plan"],
		["updateThread", "thread-1", "Specific plan title"],
		["reconcileThreadWithLocalTitle", "thread-1"],
		["setThreads", ["thread-1"]],
		["beginThreadHydration"],
		["setRovoMessages", "Server plan title"],
		["scheduleHydrationCompletion"],
		["completeThreadHydration"],
	]);
});

test("persistRovoAppPlanWidgetMetadata marks deleted threads when persistence reports not found", async () => {
	const lifecycle = createLifecycle({
		updateThread: async () => {
			throw new Error("Thread not found");
		},
	});

	await persistRovoAppPlanWidgetMetadata({
		...lifecycle,
		sourceMessageId: "message-plan",
		threadId: "thread-1",
		title: "Specific plan title",
	});

	assert.deepEqual([...lifecycle.deletedThreadIdsRef.current], ["thread-1"]);
	assert.deepEqual(lifecycle.threads, []);
	assert.deepEqual(lifecycle.calls, [
		["setThreads", ["thread-1"]],
		["setRovoMessages", "Specific plan title"],
		["clearPendingPlanMetadataGeneration", "message-plan"],
		["setThreads", []],
	]);
});
