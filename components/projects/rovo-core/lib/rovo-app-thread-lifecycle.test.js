const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const {
	activateBlankRovoAppThreadState,
	ensureRovoAppThreadWithLifecycle,
	handleRovoAppThreadPopState,
	hydrateCompletedRovoAppActiveRun,
	hydrateRovoAppThreadStateWithLifecycle,
	leaveRovoAppActiveThreadForBackground,
	loadRovoAppThreadWithLifecycle,
	refreshRovoAppThreadsWithLifecycle,
	resetRovoAppToBlankThreadState,
} = loadRovoCoreModule("lib/rovo-app-thread-lifecycle.ts");

function createThread(overrides = {}) {
	return {
		id: "thread-1",
		title: "Thread one",
		messages: [],
		realtimeMessages: [],
		visibility: "private",
		activeDocumentId: null,
		activeRun: null,
		createdAt: "2026-07-04T00:00:00.000Z",
		updatedAt: "2026-07-04T00:00:00.000Z",
		...overrides,
	};
}

function createDocument(overrides = {}) {
	return {
		id: "doc-1",
		threadId: "thread-1",
		title: "Doc one",
		kind: "text",
		sourceMessageId: null,
		createdAt: "2026-07-04T00:00:00.000Z",
		updatedAt: "2026-07-04T00:00:00.000Z",
		versions: [
			{
				id: "version-1",
				title: "Doc one",
				content: "hello",
				changeLabel: "Initial",
				createdAt: "2026-07-04T00:00:00.000Z",
			},
		],
		...overrides,
	};
}

function createVote(overrides = {}) {
	return {
		id: "vote-1",
		threadId: "thread-1",
		messageId: "assistant-1",
		value: "up",
		createdAt: "2026-07-04T00:00:00.000Z",
		updatedAt: "2026-07-04T00:00:00.000Z",
		...overrides,
	};
}

function createSetState(calls, label, initialValue) {
	let value = initialValue;
	return {
		get value() {
			return value;
		},
		set(nextValue) {
			value = typeof nextValue === "function" ? nextValue(value) : nextValue;
			calls.push([label, value]);
		},
	};
}

test("refreshRovoAppThreadsWithLifecycle reconciles threads and clears backend-unavailable errors", async () => {
	const calls = [];
	const threadsState = createSetState(calls, "setThreads", []);
	let inputError = "Backend unavailable";

	await refreshRovoAppThreadsWithLifecycle({
		deletedThreadIdsRef: { current: new Set(["deleted-thread"]) },
		getBackendUnavailableUserMessage: () => "Backend unavailable",
		isBackendUnavailableError: () => false,
		listThreads: async () => [
			createThread({ id: "thread-1", title: "Server title" }),
			createThread({ id: "deleted-thread" }),
		],
		reconcileThreadWithLocalTitle: (thread) => ({
			...thread,
			title: thread.id === "thread-1" ? "Local title" : thread.title,
		}),
		setInputError(nextError) {
			inputError = typeof nextError === "function" ? nextError(inputError) : nextError;
			calls.push(["setInputError", inputError]);
		},
		setThreads: threadsState.set,
		setThreadsLoaded(loaded) {
			calls.push(["setThreadsLoaded", loaded]);
		},
	});

	assert.deepEqual(threadsState.value.map((thread) => `${thread.id}:${thread.title}`), [
		"thread-1:Local title",
	]);
	assert.equal(inputError, null);
	assert.deepEqual(calls.at(-1), ["setThreadsLoaded", true]);
});

test("refreshRovoAppThreadsWithLifecycle handles backend-unavailable failures", async () => {
	const calls = [];
	const threadsState = createSetState(calls, "setThreads", [createThread()]);
	let inputError = null;

	await refreshRovoAppThreadsWithLifecycle({
		deletedThreadIdsRef: { current: new Set() },
		getBackendUnavailableUserMessage: () => "Backend unavailable",
		isBackendUnavailableError: () => true,
		listThreads: async () => {
			throw new Error("offline");
		},
		options: { reportBackendUnavailable: true },
		reconcileThreadWithLocalTitle: (thread) => thread,
		setInputError(nextError) {
			inputError = typeof nextError === "function" ? nextError(inputError) : nextError;
			calls.push(["setInputError", inputError]);
		},
		setThreads: threadsState.set,
		setThreadsLoaded(loaded) {
			calls.push(["setThreadsLoaded", loaded]);
		},
	});

	assert.deepEqual(threadsState.value, []);
	assert.equal(inputError, "Backend unavailable");
	assert.deepEqual(calls, [
		["setThreads", []],
		["setInputError", "Backend unavailable"],
		["setThreadsLoaded", true],
	]);
});

test("hydrateRovoAppThreadStateWithLifecycle restores thread state and persistence key", () => {
	const calls = [];
	const nextDocument = createDocument({ id: "doc-1" });
	const thread = createThread({
		activeDocumentId: "doc-1",
		messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "hello" }] }],
		realtimeMessages: [{ id: "assistant-1", role: "assistant", parts: [{ type: "text", text: "hi" }] }],
	});
	const refs = {
		activeThreadIdRef: { current: null },
		hasHydratedActiveThreadRef: { current: false },
		lastPersistedKeyRef: { current: null },
		pendingRouteReadyRef: { current: true },
		pendingRouteThreadIdRef: { current: "thread-1" },
		pendingThreadCreationRef: { current: Promise.resolve("pending") },
		queueProcessorRunningRef: { current: true },
	};

	hydrateRovoAppThreadStateWithLifecycle({
		...refs,
		beginThreadHydration() {
			calls.push(["beginThreadHydration"]);
		},
		clearDirectDelegationState() {
			calls.push(["clearDirectDelegationState"]);
		},
		clearPendingPlanMetadataGeneration() {
			calls.push(["clearPendingPlanMetadataGeneration"]);
		},
		clearStreamingArtifactState() {
			calls.push(["clearStreamingArtifactState"]);
		},
		completeThreadHydration() {
			calls.push(["completeThreadHydration"]);
		},
		nextDocuments: [nextDocument],
		nextVotes: [createVote()],
		replaceRealtimeMessagesState(messages, options) {
			calls.push(["replaceRealtimeMessagesState", messages.map((message) => message.id), options]);
		},
		resetObservedTurnComplete() {
			calls.push(["resetObservedTurnComplete"]);
		},
		resetPendingArtifactAssociation() {
			calls.push(["resetPendingArtifactAssociation"]);
		},
		scheduleComplete(callback) {
			calls.push(["scheduleComplete"]);
			callback();
		},
		setActiveDocumentId(documentId) {
			calls.push(["setActiveDocumentId", documentId]);
		},
		setActiveThreadId(threadId) {
			calls.push(["setActiveThreadId", threadId]);
		},
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setDocuments(documents) {
			calls.push(["setDocuments", documents.map((document) => document.id)]);
		},
		setHasActiveDispatch(hasActiveDispatch) {
			calls.push(["setHasActiveDispatch", hasActiveDispatch]);
		},
		setPanelState(panelState) {
			calls.push(["setPanelState", panelState]);
		},
		setRovoMessages(messages) {
			calls.push(["setRovoMessages", messages.map((message) => message.id)]);
		},
		setSelectedVersionId(versionId) {
			calls.push(["setSelectedVersionId", versionId]);
		},
		setThreadVisibility(visibility) {
			calls.push(["setThreadVisibility", visibility]);
		},
		setVisibleArtifactDocumentId(documentId) {
			calls.push(["setVisibleArtifactDocumentId", documentId]);
		},
		setVotes(votes) {
			calls.push(["setVotes", votes]);
		},
		thread,
	});

	assert.equal(refs.activeThreadIdRef.current, "thread-1");
	assert.equal(refs.hasHydratedActiveThreadRef.current, true);
	assert.equal(refs.pendingThreadCreationRef.current, null);
	assert.equal(refs.pendingRouteThreadIdRef.current, null);
	assert.equal(refs.pendingRouteReadyRef.current, false);
	assert.equal(refs.queueProcessorRunningRef.current, false);
	assert.match(refs.lastPersistedKeyRef.current, /Thread one/);
	assert.deepEqual(calls.filter((call) => call[0] === "setPanelState"), [["setPanelState", "preview"]]);
	assert.deepEqual(calls.filter((call) => call[0] === "setSelectedVersionId"), [["setSelectedVersionId", "version-1"]]);
	assert.deepEqual(calls.at(-1), ["completeThreadHydration"]);
});

test("resetRovoAppToBlankThreadState clears route, run, artifact, and queue state", () => {
	const calls = [];
	const abortController = new AbortController();
	const refs = {
		activeThreadIdRef: { current: "thread-1" },
		hasHydratedActiveThreadRef: { current: true },
		lastPersistedKeyRef: { current: "previous" },
		pendingRouteReadyRef: { current: true },
		pendingRouteThreadIdRef: { current: "thread-1" },
		pendingThreadCreationRef: { current: Promise.resolve("thread-1") },
		queueProcessorRunningRef: { current: true },
		runSubscriptionAbortControllerRef: { current: abortController },
		runSubscriptionThreadIdRef: { current: "thread-1" },
	};

	resetRovoAppToBlankThreadState({
		...refs,
		beginThreadHydration() {
			calls.push(["beginThreadHydration"]);
		},
		clearArtifactState() {
			calls.push(["clearArtifactState"]);
		},
		clearDirectDelegationState() {
			calls.push(["clearDirectDelegationState"]);
		},
		clearPendingPlanMetadataGeneration() {
			calls.push(["clearPendingPlanMetadataGeneration"]);
		},
		clearStreamingArtifactState() {
			calls.push(["clearStreamingArtifactState"]);
		},
		completeThreadHydration() {
			calls.push(["completeThreadHydration"]);
		},
		nextDraftId: "draft-2",
		replaceRealtimeMessagesState(messages, options) {
			calls.push(["replaceRealtimeMessagesState", messages, options]);
		},
		resetObservedTurnComplete() {
			calls.push(["resetObservedTurnComplete"]);
		},
		resetPendingArtifactAssociation() {
			calls.push(["resetPendingArtifactAssociation"]);
		},
		scheduleComplete(callback) {
			callback();
		},
		setActiveThreadId(threadId) {
			calls.push(["setActiveThreadId", threadId]);
		},
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setDocuments(documents) {
			calls.push(["setDocuments", documents]);
		},
		setDraftThreadId(threadId) {
			calls.push(["setDraftThreadId", threadId]);
		},
		setEditingMessageId(messageId) {
			calls.push(["setEditingMessageId", messageId]);
		},
		setHasActiveDispatch(hasActiveDispatch) {
			calls.push(["setHasActiveDispatch", hasActiveDispatch]);
		},
		setRovoMessages(messages) {
			calls.push(["setRovoMessages", messages]);
		},
		setThreadVisibility(visibility) {
			calls.push(["setThreadVisibility", visibility]);
		},
		setVotes(votes) {
			calls.push(["setVotes", votes]);
		},
	});

	assert.equal(refs.activeThreadIdRef.current, null);
	assert.equal(refs.hasHydratedActiveThreadRef.current, false);
	assert.equal(refs.pendingThreadCreationRef.current, null);
	assert.equal(refs.queueProcessorRunningRef.current, false);
	assert.equal(refs.runSubscriptionAbortControllerRef.current, null);
	assert.equal(refs.runSubscriptionThreadIdRef.current, null);
	assert.equal(abortController.signal.aborted, true);
	assert.match(refs.lastPersistedKeyRef.current, /New chat/);
	assert.deepEqual(calls.filter((call) => call[0] === "setDraftThreadId"), [["setDraftThreadId", "draft-2"]]);
	assert.deepEqual(calls.at(-1), ["completeThreadHydration"]);
});

test("hydrateCompletedRovoAppActiveRun clears completed active run and rehydrates", () => {
	const calls = [];
	const didHydrate = hydrateCompletedRovoAppActiveRun({
		activeThreadId: "thread-1",
		attachedRunStatus: null,
		currentActiveRun: { id: "run-1", status: "streaming" },
		hydrateThreadById: async (threadId) => {
			calls.push(["hydrateThreadById", threadId]);
		},
		messages: [
			{
				id: "assistant-1",
				role: "assistant",
				parts: [{ type: "data-turn-complete", data: { status: "complete" } }],
			},
		],
		setLocalThreadActiveRun(threadId, activeRun) {
			calls.push(["setLocalThreadActiveRun", threadId, activeRun]);
		},
		useChatStatus: "ready",
	});

	assert.equal(didHydrate, true);
	assert.deepEqual(calls, [
		["setLocalThreadActiveRun", "thread-1", null],
		["hydrateThreadById", "thread-1"],
	]);
});

test("leaveRovoAppActiveThreadForBackground detaches streaming work and persists a snapshot", async () => {
	const calls = [];
	const runAbortController = new AbortController();
	const delegationAbortController = new AbortController();

	await leaveRovoAppActiveThreadForBackground({
		activeDocumentId: "doc-1",
		activeThreadIdRef: { current: "thread-1" },
		attachedRunStatus: "streaming",
		clearDirectDelegationState() {
			calls.push(["clearDirectDelegationState"]);
		},
		currentActiveRun: null,
		delegationAbortControllerRef: { current: delegationAbortController },
		detachRun: async (threadId) => {
			calls.push(["detachRun", threadId]);
		},
		detachStream: async (threadId) => {
			calls.push(["detachStream", threadId]);
		},
		realtimeMessagesRef: { current: [{ id: "assistant-1", role: "assistant", parts: [] }] },
		rovoMessagesRef: { current: [{ id: "user-1", role: "user", parts: [] }] },
		runSubscriptionAbortControllerRef: { current: runAbortController },
		runSubscriptionThreadIdRef: { current: "thread-1" },
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setLocalThreadActiveRun(threadId, activeRun) {
			calls.push(["setLocalThreadActiveRun", threadId, activeRun.status]);
		},
		statusRef: { current: "streaming" },
		stopUseChat() {
			calls.push(["stopUseChat"]);
		},
		threadVisibility: "private",
		updateThread: async (threadId, input) => {
			calls.push(["updateThread", threadId, input.activeDocumentId, input.messages.length]);
		},
	});

	assert.equal(runAbortController.signal.aborted, true);
	assert.equal(delegationAbortController.signal.aborted, true);
	assert.deepEqual(calls, [
		["detachRun", "thread-1"],
		["stopUseChat"],
		["setAttachedRunStatus", null],
		["clearDirectDelegationState"],
		["updateThread", "thread-1", "doc-1", 1],
		["setLocalThreadActiveRun", "thread-1", "background"],
	]);
});

test("loadRovoAppThreadWithLifecycle resets blank state and replaces root route when missing", async () => {
	const calls = [];

	await loadRovoAppThreadWithLifecycle({
		activeThreadIdRef: { current: null },
		clearRunSubscription() {
			calls.push(["clearRunSubscription"]);
		},
		createThreadId: () => "draft-2",
		deletedThreadIdsRef: { current: new Set() },
		embedded: false,
		getDocument: async () => null,
		getThread: async (threadId) => {
			calls.push(["getThread", threadId]);
			return null;
		},
		hasHydratedActiveThreadRef: { current: false },
		hydrateThreadState() {
			calls.push(["hydrateThreadState"]);
		},
		leaveActiveThreadForBackground: async () => {
			calls.push(["leaveActiveThreadForBackground"]);
		},
		listDocuments: async (threadId) => {
			calls.push(["listDocuments", threadId]);
			return [];
		},
		listVotes: async (threadId) => {
			calls.push(["listVotes", threadId]);
			return [];
		},
		reconcileThreadWithLocalTitle: (thread) => thread,
		replaceRootRoute() {
			calls.push(["replaceRootRoute"]);
		},
		resetToBlankChatState(nextDraftId) {
			calls.push(["resetToBlankChatState", nextDraftId]);
		},
		setInputError(message) {
			calls.push(["setInputError", message]);
		},
		setIsLoadingThread(isLoading) {
			calls.push(["setIsLoadingThread", isLoading]);
		},
		setThreads() {
			calls.push(["setThreads"]);
		},
		subscribeToRun: async () => {
			calls.push(["subscribeToRun"]);
		},
		threadId: "missing-thread",
		toUserErrorMessage: (error) => error.message,
	});

	assert.deepEqual(calls, [
		["leaveActiveThreadForBackground"],
		["setInputError", null],
		["setIsLoadingThread", true],
		["getThread", "missing-thread"],
		["listDocuments", "missing-thread"],
		["listVotes", "missing-thread"],
		["resetToBlankChatState", "draft-2"],
		["replaceRootRoute"],
		["setIsLoadingThread", false],
	]);
});

test("loadRovoAppThreadWithLifecycle hydrates existing threads and subscribes active runs", async () => {
	const calls = [];
	const thread = createThread({
		activeRun: { id: "run-1", status: "queued" },
	});
	let threads = [];

	await loadRovoAppThreadWithLifecycle({
		activeThreadIdRef: { current: null },
		clearRunSubscription() {
			calls.push(["clearRunSubscription"]);
		},
		createThreadId: () => "draft-2",
		deletedThreadIdsRef: { current: new Set() },
		embedded: true,
		getDocument: async () => null,
		getThread: async () => thread,
		hasHydratedActiveThreadRef: { current: false },
		hydrateThreadState(nextThread, documents, votes) {
			calls.push(["hydrateThreadState", nextThread.id, documents.length, votes.length]);
		},
		leaveActiveThreadForBackground: async () => {
			calls.push(["leaveActiveThreadForBackground"]);
		},
		listDocuments: async () => [createDocument()],
		listVotes: async () => [createVote()],
		reconcileThreadWithLocalTitle: (nextThread) => ({
			...nextThread,
			title: "Local title",
		}),
		replaceRootRoute() {
			calls.push(["replaceRootRoute"]);
		},
		resetToBlankChatState() {
			calls.push(["resetToBlankChatState"]);
		},
		setInputError(message) {
			calls.push(["setInputError", message]);
		},
		setIsLoadingThread(isLoading) {
			calls.push(["setIsLoadingThread", isLoading]);
		},
		setThreads(nextThreads) {
			threads = typeof nextThreads === "function" ? nextThreads(threads) : nextThreads;
			calls.push(["setThreads", threads.map((nextThread) => nextThread.title)]);
		},
		subscribeToRun: async (threadId, activeRun) => {
			calls.push(["subscribeToRun", threadId, activeRun.status]);
		},
		threadId: "thread-1",
		toUserErrorMessage: (error) => error.message,
	});

	assert.deepEqual(calls, [
		["leaveActiveThreadForBackground"],
		["setInputError", null],
		["setIsLoadingThread", true],
		["hydrateThreadState", "thread-1", 1, 1],
		["setThreads", ["Local title"]],
		["subscribeToRun", "thread-1", "queued"],
		["setIsLoadingThread", false],
	]);
});

test("activateBlankRovoAppThreadState and handleRovoAppThreadPopState centralize route navigation", async () => {
	const calls = [];

	await activateBlankRovoAppThreadState({
		createThreadId: () => "draft-2",
		embedded: false,
		leaveActiveThreadForBackground: async () => {
			calls.push(["leaveActiveThreadForBackground"]);
		},
		pushRootPath() {
			calls.push(["pushRootPath"]);
		},
		resetToBlankChatState(nextDraftId) {
			calls.push(["resetToBlankChatState", nextDraftId]);
		},
	});

	const handledThread = handleRovoAppThreadPopState({
		activateBlankChatState: async () => {
			calls.push(["activateBlankChatState"]);
		},
		activeThreadIdRef: { current: "thread-1" },
		getThreadIdFromPath: () => "thread-2",
		hasHydratedActiveThreadRef: { current: true },
		loadThread: async (threadId) => {
			calls.push(["loadThread", threadId]);
		},
		pathname: "/rovo/thread-2",
		rootPath: "/rovo",
	});
	const handledRoot = handleRovoAppThreadPopState({
		activateBlankChatState: async (options) => {
			calls.push(["activateBlankChatState", options]);
		},
		activeThreadIdRef: { current: "thread-1" },
		getThreadIdFromPath: () => null,
		hasHydratedActiveThreadRef: { current: true },
		loadThread: async () => {
			calls.push(["loadThread"]);
		},
		pathname: "/rovo",
		rootPath: "/rovo",
	});

	assert.equal(handledThread, true);
	assert.equal(handledRoot, true);
	assert.deepEqual(calls, [
		["leaveActiveThreadForBackground"],
		["resetToBlankChatState", "draft-2"],
		["pushRootPath"],
		["loadThread", "thread-2"],
		["activateBlankChatState", { syncHistory: false }],
	]);
});

test("ensureRovoAppThreadWithLifecycle creates once, records route/title side effects, and reuses pending creation", async () => {
	const calls = [];
	const refs = {
		activeThreadIdRef: { current: null },
		hasHydratedActiveThreadRef: { current: false },
		lastPersistedKeyRef: { current: null },
		pendingRouteReadyRef: { current: true },
		pendingRouteThreadIdRef: { current: null },
		pendingThreadCreationRef: { current: null },
		pendingTitleMessageRef: { current: null },
		pendingTitleThreadIdRef: { current: null },
	};
	let threads = [];
	let createCount = 0;

	const firstPromise = ensureRovoAppThreadWithLifecycle({
		...refs,
		activeDocumentId: "doc-1",
		createThread: async (input) => {
			createCount += 1;
			calls.push(["createThread", input.id, input.title, input.activeDocumentId]);
			return createThread({
				id: "thread-created",
				title: input.title,
				activeDocumentId: input.activeDocumentId,
				visibility: input.visibility,
			});
		},
		deletedThreadIdsRef: { current: new Set() },
		draftThreadId: "draft-1",
		embedded: false,
		seedText: "\n  Build the thing  ",
		setActiveThreadId(threadId) {
			calls.push(["setActiveThreadId", threadId]);
		},
		setIsGeneratingTitle(isGenerating) {
			calls.push(["setIsGeneratingTitle", isGenerating]);
		},
		setPendingTitleThreadId(threadId) {
			calls.push(["setPendingTitleThreadId", threadId]);
		},
		setThreads(nextThreads) {
			threads = typeof nextThreads === "function" ? nextThreads(threads) : nextThreads;
			calls.push(["setThreads", threads.map((thread) => thread.id)]);
		},
		threadVisibility: "private",
	});
	const secondPromise = ensureRovoAppThreadWithLifecycle({
		...refs,
		activeDocumentId: "doc-2",
		createThread: async () => {
			throw new Error("should not create twice");
		},
		deletedThreadIdsRef: { current: new Set() },
		draftThreadId: "draft-2",
		embedded: false,
		seedText: "Other",
		setActiveThreadId() {},
		setIsGeneratingTitle() {},
		setPendingTitleThreadId() {},
		setThreads() {},
		threadVisibility: "private",
	});

	assert.equal(firstPromise, secondPromise);
	assert.equal(await firstPromise, "thread-created");
	assert.equal(createCount, 1);
	assert.equal(refs.activeThreadIdRef.current, "thread-created");
	assert.equal(refs.hasHydratedActiveThreadRef.current, true);
	assert.equal(refs.pendingThreadCreationRef.current, null);
	assert.equal(refs.pendingRouteThreadIdRef.current, "thread-created");
	assert.equal(refs.pendingRouteReadyRef.current, false);
	assert.equal(refs.pendingTitleThreadIdRef.current, "thread-created");
	assert.equal(refs.pendingTitleMessageRef.current, "\n  Build the thing  ");
	assert.match(refs.lastPersistedKeyRef.current, /Build the thing/);
	assert.deepEqual(calls, [
		["createThread", "draft-1", "Build the thing", "doc-1"],
		["setActiveThreadId", "thread-created"],
		["setThreads", ["thread-created"]],
		["setIsGeneratingTitle", true],
		["setPendingTitleThreadId", "thread-created"],
	]);
});
