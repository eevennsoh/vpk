const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const {
	buildRecoverableRovoAppThreadInput,
	buildRovoAppPersistedThreadKey,
	buildRovoAppThreadPersistencePlan,
	hasRecoverableRovoAppThreadState,
	isRovoAppThreadNotFoundError,
	runRovoAppThreadPersistenceLifecycle,
	shouldPersistResolvedRovoAppTitle,
	shouldRecoverRovoAppThreadAfterPersistenceFailure,
} = loadRovoCoreModule("lib/rovo-app-thread-persistence.ts");

function createMessage(id, role, text) {
	return {
		id,
		role,
		parts: [{ type: "text", text }],
	};
}

function createThread(overrides = {}) {
	return {
		id: "thread-1",
		title: "New chat",
		messages: [],
		realtimeMessages: [],
		visibility: "private",
		modelId: null,
		provider: null,
		activeDocumentId: null,
		activeRun: null,
		createdAt: "2026-03-31T00:00:00.000Z",
		updatedAt: "2026-03-31T00:00:00.000Z",
		...overrides,
	};
}

async function flushAsyncTurns(count = 4) {
	for (let index = 0; index < count; index += 1) {
		await Promise.resolve();
	}
}

test("treats missing thread persistence failures as recoverable when local realtime state exists", () => {
	const state = {
		activeDocumentId: null,
		messages: [],
		realtimeMessages: [createMessage("realtime-1", "user", "hello from voice")],
		threadId: "thread-1",
		title: "hello from voice",
		visibility: "private",
	};

	assert.equal(hasRecoverableRovoAppThreadState(state), true);
	assert.equal(
		shouldRecoverRovoAppThreadAfterPersistenceFailure({
			error: new Error("Thread not found"),
			state,
		}),
		true,
	);
});

test("does not recover missing thread failures when there is no local thread state to preserve", () => {
	const state = {
		activeDocumentId: null,
		messages: [],
		realtimeMessages: [],
		threadId: "thread-1",
		title: "New chat",
		visibility: "private",
	};

	assert.equal(hasRecoverableRovoAppThreadState(state), false);
	assert.equal(
		shouldRecoverRovoAppThreadAfterPersistenceFailure({
			error: new Error("Thread not found"),
			state,
		}),
		false,
	);
});

test("does not recover unrelated persistence failures even when local state exists", () => {
	const state = {
		activeDocumentId: "doc-1",
		messages: [createMessage("rovo-1", "user", "Make a plan")],
		realtimeMessages: [],
		threadId: "thread-1",
		title: "Make a plan",
		visibility: "private",
	};

	assert.equal(hasRecoverableRovoAppThreadState(state), true);
	assert.equal(
		shouldRecoverRovoAppThreadAfterPersistenceFailure({
			error: new Error("Database unavailable"),
			state,
		}),
		false,
	);
});

test("buildRecoverableRovoAppThreadInput preserves realtime messages and active document state", () => {
	const realtimeMessages = [createMessage("realtime-1", "assistant", "Voice reply")];

	assert.deepEqual(
		buildRecoverableRovoAppThreadInput({
			activeDocumentId: "doc-1",
			messages: [createMessage("rovo-1", "user", "Make a plan")],
			realtimeMessages,
			threadId: "thread-1",
			title: "Make a plan",
			visibility: "public",
		}),
		{
			activeDocumentId: "doc-1",
			id: "thread-1",
			messages: [createMessage("rovo-1", "user", "Make a plan")],
			realtimeMessages,
			title: "Make a plan",
			visibility: "public",
		},
	);
});

test("buildRovoAppThreadPersistencePlan preserves existing title", () => {
	const messages = [createMessage("rovo-1", "user", "Write a launch plan")];
	const realtimeMessages = [createMessage("realtime-1", "assistant", "Voice reply")];
	const plan = buildRovoAppThreadPersistencePlan({
		activeDocumentId: "doc-1",
		activeThreadId: "thread-1",
		isGeneratingTitle: false,
		messages,
		normalizedMessages: messages,
		pendingTitleThreadId: null,
		realtimeMessages,
		threadVisibility: "private",
		threads: [
			createThread({
				title: "Existing launch thread",
			}),
		],
	});

	assert.equal(plan.title, "Existing launch thread");
	assert.deepEqual(plan.nextThreadUpdate, {
		activeDocumentId: "doc-1",
		messages,
		realtimeMessages,
		title: "Existing launch thread",
		visibility: "private",
	});
	assert.deepEqual(plan.recoveryState, {
		activeDocumentId: "doc-1",
		messages,
		realtimeMessages,
		threadId: "thread-1",
		title: "Existing launch thread",
		visibility: "private",
	});
});

test("buildRovoAppThreadPersistencePlan derives title but defers title writes while generation owns it", () => {
	const messages = [createMessage("rovo-1", "user", "Write a launch plan\nwith milestones")];
	const plan = buildRovoAppThreadPersistencePlan({
		activeDocumentId: null,
		activeThreadId: "thread-1",
		isGeneratingTitle: true,
		messages,
		normalizedMessages: messages,
		pendingTitleThreadId: "thread-1",
		realtimeMessages: [],
		threadVisibility: "public",
		threads: [createThread()],
	});

	assert.equal(plan.title, "Write a launch plan");
	assert.deepEqual(plan.nextThreadUpdate, {
		activeDocumentId: null,
		messages,
		realtimeMessages: [],
		visibility: "public",
	});
	assert.match(plan.nextPersistKey, /"title":"Write a launch plan"/u);
	assert.deepEqual(plan.recoveryState, {
		activeDocumentId: null,
		messages,
		realtimeMessages: [],
		threadId: "thread-1",
		title: "Write a launch plan",
		visibility: "public",
	});
});

test("runRovoAppThreadPersistenceLifecycle persists and hydrates canonical server messages", async () => {
	const calls = [];
	const localMessages = [createMessage("user-1", "user", "Make a plan")];
	const serverMessages = [
		createMessage("user-1", "user", "Make a plan"),
		createMessage("assistant-1", "assistant", "Plan saved"),
	];
	const serverRealtimeMessages = [
		createMessage("realtime-1", "assistant", "Realtime saved"),
	];
	const refs = {
		activeThreadIdRef: { current: "thread-1" },
		deletedThreadIdsRef: { current: new Set() },
		lastPersistedKeyRef: { current: null },
		pendingRouteReadyRef: { current: false },
		pendingRouteThreadIdRef: { current: null },
		realtimeMessagesRef: { current: [] },
		realtimeMessagesVersionRef: { current: 1 },
	};
	let threads = [];

	const persistencePlan = buildRovoAppThreadPersistencePlan({
		activeDocumentId: "doc-1",
		activeThreadId: "thread-1",
		isGeneratingTitle: false,
		messages: localMessages,
		normalizedMessages: localMessages,
		pendingTitleThreadId: null,
		realtimeMessages: [],
		threadVisibility: "private",
		threads: [createThread({ activeDocumentId: "doc-1", title: "Make a plan" })],
	});

	runRovoAppThreadPersistenceLifecycle({
		...refs,
		activeDocumentId: "doc-1",
		activeThreadId: "thread-1",
		beginThreadHydration: () => calls.push(["beginThreadHydration"]),
		completeThreadHydration: () => calls.push(["completeThreadHydration"]),
		createThread: async () => {
			throw new Error("should not recover");
		},
		embedded: false,
		flushPendingRouteReplacement: (threadId) => {
			calls.push(["flushPendingRouteReplacement", threadId]);
			return true;
		},
		normalizedMessages: localMessages,
		persistencePlan,
		realtimeMessages: [],
		reconcileThreadWithLocalTitle: (thread) => thread,
		replaceRealtimeMessagesState: (messages, options) => {
			calls.push(["replaceRealtimeMessagesState", messages.map((message) => message.id), options]);
		},
		requestVersion: 1,
		scheduleComplete: (callback) => {
			calls.push(["scheduleComplete"]);
			callback();
		},
		setInputError: (message) => calls.push(["setInputError", message]),
		setMessages: (nextMessages) => {
			calls.push(["setMessages", nextMessages.map((message) => message.id)]);
		},
		setThreads: (nextThreads) => {
			threads = typeof nextThreads === "function" ? nextThreads(threads) : nextThreads;
			calls.push(["setThreads", threads.map((thread) => thread.id)]);
		},
		threadVisibility: "private",
		toUserErrorMessage: (error) => error.message,
		updateThread: async (threadId, input) => {
			calls.push(["updateThread", threadId, input.title]);
			return createThread({
				id: threadId,
				activeDocumentId: "doc-1",
				messages: serverMessages,
				realtimeMessages: serverRealtimeMessages,
				title: "Make a plan",
			});
		},
	});

	await flushAsyncTurns();

	assert.equal(
		refs.lastPersistedKeyRef.current,
		buildRovoAppPersistedThreadKey(createThread({
			activeDocumentId: "doc-1",
			messages: serverMessages,
			realtimeMessages: serverRealtimeMessages,
			title: "Make a plan",
		})),
	);
	assert.deepEqual(calls, [
		["updateThread", "thread-1", "Make a plan"],
		["setThreads", ["thread-1"]],
		["beginThreadHydration"],
		["setMessages", ["user-1", "assistant-1"]],
		["scheduleComplete"],
		["completeThreadHydration"],
		["beginThreadHydration"],
		["replaceRealtimeMessagesState", ["realtime-1"], { incrementVersion: false }],
		["scheduleComplete"],
		["completeThreadHydration"],
	]);
});

test("runRovoAppThreadPersistenceLifecycle marks matching pending route ready", async () => {
	const messages = [createMessage("user-1", "user", "Make a plan")];
	const calls = [];
	const refs = {
		activeThreadIdRef: { current: "thread-1" },
		deletedThreadIdsRef: { current: new Set() },
		lastPersistedKeyRef: { current: null },
		pendingRouteReadyRef: { current: false },
		pendingRouteThreadIdRef: { current: "thread-1" },
		realtimeMessagesRef: { current: [] },
		realtimeMessagesVersionRef: { current: 1 },
	};
	let threads = [];
	const thread = createThread({
		activeDocumentId: "doc-1",
		messages,
		title: "Make a plan",
	});
	const persistencePlan = buildRovoAppThreadPersistencePlan({
		activeDocumentId: "doc-1",
		activeThreadId: "thread-1",
		isGeneratingTitle: false,
		messages,
		normalizedMessages: messages,
		pendingTitleThreadId: null,
		realtimeMessages: [],
		threadVisibility: "private",
		threads: [thread],
	});

	runRovoAppThreadPersistenceLifecycle({
		...refs,
		activeDocumentId: "doc-1",
		activeThreadId: "thread-1",
		beginThreadHydration: () => calls.push(["beginThreadHydration"]),
		completeThreadHydration: () => calls.push(["completeThreadHydration"]),
		createThread: async () => {
			throw new Error("should not recover");
		},
		embedded: false,
		flushPendingRouteReplacement: (threadId) => {
			calls.push(["flushPendingRouteReplacement", threadId]);
			return true;
		},
		normalizedMessages: messages,
		persistencePlan,
		realtimeMessages: [],
		reconcileThreadWithLocalTitle: (nextThread) => nextThread,
		replaceRealtimeMessagesState: () => calls.push(["replaceRealtimeMessagesState"]),
		requestVersion: 1,
		scheduleComplete: (callback) => callback(),
		setInputError: (message) => calls.push(["setInputError", message]),
		setMessages: () => calls.push(["setMessages"]),
		setThreads: (nextThreads) => {
			threads = typeof nextThreads === "function" ? nextThreads(threads) : nextThreads;
			calls.push(["setThreads", threads.map((nextThread) => nextThread.id)]);
		},
		threadVisibility: "private",
		toUserErrorMessage: (error) => error.message,
		updateThread: async () => thread,
	});

	await flushAsyncTurns();

	assert.equal(refs.pendingRouteReadyRef.current, true);
	assert.deepEqual(calls, [
		["setThreads", ["thread-1"]],
		["flushPendingRouteReplacement", "thread-1"],
	]);
});

test("runRovoAppThreadPersistenceLifecycle recovers a missing active thread", async () => {
	const calls = [];
	const messages = [createMessage("user-1", "user", "Recover this")];
	const refs = {
		activeThreadIdRef: { current: "thread-1" },
		deletedThreadIdsRef: { current: new Set() },
		lastPersistedKeyRef: { current: null },
		pendingRouteReadyRef: { current: false },
		pendingRouteThreadIdRef: { current: null },
		realtimeMessagesRef: { current: [] },
		realtimeMessagesVersionRef: { current: 1 },
	};
	let threads = [];
	const persistencePlan = buildRovoAppThreadPersistencePlan({
		activeDocumentId: null,
		activeThreadId: "thread-1",
		isGeneratingTitle: false,
		messages,
		normalizedMessages: messages,
		pendingTitleThreadId: null,
		realtimeMessages: [],
		threadVisibility: "private",
		threads: [],
	});

	runRovoAppThreadPersistenceLifecycle({
		...refs,
		activeDocumentId: null,
		activeThreadId: "thread-1",
		beginThreadHydration: () => calls.push(["beginThreadHydration"]),
		completeThreadHydration: () => calls.push(["completeThreadHydration"]),
		createThread: async (input) => {
			calls.push(["createThread", input.id, input.title]);
			return createThread({
				id: input.id,
				messages: input.messages,
				title: input.title,
				visibility: input.visibility,
			});
		},
		embedded: false,
		flushPendingRouteReplacement: (threadId) => {
			calls.push(["flushPendingRouteReplacement", threadId]);
			return true;
		},
		normalizedMessages: messages,
		persistencePlan,
		realtimeMessages: [],
		reconcileThreadWithLocalTitle: (thread) => thread,
		replaceRealtimeMessagesState: () => calls.push(["replaceRealtimeMessagesState"]),
		requestVersion: 1,
		scheduleComplete: (callback) => callback(),
		setInputError: (message) => calls.push(["setInputError", message]),
		setMessages: () => calls.push(["setMessages"]),
		setThreads: (nextThreads) => {
			threads = typeof nextThreads === "function" ? nextThreads(threads) : nextThreads;
			calls.push(["setThreads", threads.map((thread) => thread.id)]);
		},
		threadVisibility: "private",
		toUserErrorMessage: (error) => error.message,
		updateThread: async () => {
			throw new Error("Thread not found");
		},
	});

	await flushAsyncTurns();

	assert.equal(refs.pendingRouteThreadIdRef.current, "thread-1");
	assert.equal(refs.pendingRouteReadyRef.current, true);
	assert.deepEqual(calls, [
		["createThread", "thread-1", "Recover this"],
		["setThreads", ["thread-1"]],
		["flushPendingRouteReplacement", "thread-1"],
	]);
});

test("identifies thread-not-found persistence errors", () => {
	assert.equal(isRovoAppThreadNotFoundError(new Error("Thread not found")), true);
	assert.equal(isRovoAppThreadNotFoundError(new Error("Different error")), false);
});

test("does not persist a resolved title for a deleted thread", () => {
	assert.equal(
		shouldPersistResolvedRovoAppTitle({
			deletedThreadIds: new Set(["thread-1"]),
			threadId: "thread-1",
			threads: [createThread()],
		}),
		false,
	);
});

test("persists a resolved title while the thread still exists locally", () => {
	assert.equal(
		shouldPersistResolvedRovoAppTitle({
			deletedThreadIds: new Set(),
			threadId: "thread-1",
			threads: [createThread()],
		}),
		true,
	);
});
