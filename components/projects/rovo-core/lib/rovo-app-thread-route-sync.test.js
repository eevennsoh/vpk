const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildRovoAppThreadPath,
	buildRovoAppThreadPersistKey,
	createRovoAppThreadRouteSync,
	flushPendingRovoAppRouteReplacement,
	getRovoAppThreadIdFromPath,
	shouldLoadInitialRovoAppThread,
	shouldSkipRovoAppThreadLoad,
	shouldReplacePendingRovoAppRoute,
	shouldReplaceRovoAppRouteAfterPersistence,
} = require("./rovo-app-thread-route-sync.ts");

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
		title: "Create a page about apple",
		messages: [],
		realtimeMessages: [],
		visibility: "private",
		modelId: null,
		provider: null,
		activeDocumentId: null,
		createdAt: "2026-03-09T09:00:00.000Z",
		updatedAt: "2026-03-09T09:00:00.000Z",
		...overrides,
	};
}

test("does not switch to the thread route while the persisted thread is still empty", () => {
	const messages = [
		createMessage("user-1", "user", "Create a page about apple"),
		createMessage("assistant-1", "assistant", 'Created artifact "apple".'),
	];

	assert.equal(
		shouldReplaceRovoAppRouteAfterPersistence({
			pendingThreadId: "thread-1",
			thread: createThread(),
			messages,
			realtimeMessages: [],
			visibility: "private",
			activeDocumentId: "doc-1",
			title: "Create a page about apple",
		}),
		false,
	);
});

test("switches to the thread route once the persisted thread matches the current chat state", () => {
	const messages = [
		createMessage("user-1", "user", "Create a page about apple"),
		createMessage("assistant-1", "assistant", 'Created artifact "apple".'),
	];

	assert.equal(
		shouldReplaceRovoAppRouteAfterPersistence({
			pendingThreadId: "thread-1",
			thread: createThread({
				messages,
				realtimeMessages: [],
				activeDocumentId: "doc-1",
			}),
			messages,
			realtimeMessages: [],
			visibility: "private",
			activeDocumentId: "doc-1",
			title: "Create a page about apple",
		}),
		true,
	);
});

test("keeps the draft route while a matching persisted thread is still streaming", () => {
	const messages = [
		createMessage("user-1", "user", "Create a page about apple"),
		createMessage("assistant-1", "assistant", 'Created artifact "apple".'),
	];

	assert.equal(
		shouldReplaceRovoAppRouteAfterPersistence({
			pendingThreadId: "thread-1",
			thread: createThread({
				messages,
				realtimeMessages: [],
				activeDocumentId: "doc-1",
			}),
			messages,
			realtimeMessages: [],
			visibility: "private",
			activeDocumentId: "doc-1",
			title: "Create a page about apple",
		}),
		true,
	);

	assert.equal(
		shouldReplacePendingRovoAppRoute({
			activeThreadId: "thread-1",
			embedded: false,
			hasPersistedThreadState: true,
			isStreaming: true,
			isVoiceMode: false,
			pendingThreadId: "thread-1",
		}),
		false,
	);
});

test("buildRovoAppThreadPersistKey includes title and active artifact state", () => {
	const key = buildRovoAppThreadPersistKey({
		messages: [createMessage("user-1", "user", "Create a page about apple")],
		realtimeMessages: [],
		visibility: "private",
		activeDocumentId: "doc-1",
		title: "Create a page about apple",
	});

	assert.match(key, /"activeDocumentId":"doc-1"/u);
	assert.match(key, /"title":"Create a page about apple"/u);
});

test("buildRovoAppThreadPath encodes the thread id into the route path", () => {
	assert.equal(
		buildRovoAppThreadPath("/rovo", "thread/with spaces"),
		"/rovo/thread%2Fwith%20spaces",
	);
});

test("getRovoAppThreadIdFromPath resolves a thread route id", () => {
	assert.equal(
		getRovoAppThreadIdFromPath("/rovo", "/rovo/thread%2Fwith%20spaces"),
		"thread/with spaces",
	);
});

test("getRovoAppThreadIdFromPath returns null for the draft route", () => {
	assert.equal(getRovoAppThreadIdFromPath("/rovo", "/rovo"), null);
	assert.equal(getRovoAppThreadIdFromPath("/rovo", "/rovo/"), null);
});

test("createRovoAppThreadRouteSync parameterizes route roots", () => {
	const studioRouteSync = createRovoAppThreadRouteSync("/studio");

	assert.equal(
		studioRouteSync.buildRovoAppThreadPath("thread/with spaces"),
		"/studio/thread%2Fwith%20spaces",
	);
	assert.equal(
		studioRouteSync.getRovoAppThreadIdFromPath("/studio/thread%2Fwith%20spaces"),
		"thread/with spaces",
	);
	assert.equal(studioRouteSync.getRovoAppThreadIdFromPath("/rovo/thread-1"), null);
});

test("does not replace the draft route while the first turn is still streaming after voice mode turns off", () => {
	assert.equal(
		shouldReplacePendingRovoAppRoute({
			activeThreadId: "thread-1",
			embedded: false,
			hasPersistedThreadState: true,
			isStreaming: true,
			isVoiceMode: false,
			pendingThreadId: "thread-1",
		}),
		false,
	);
});

test("does not replace the pending draft route until the persisted thread matches the chat state", () => {
	assert.equal(
		shouldReplacePendingRovoAppRoute({
			activeThreadId: "thread-1",
			embedded: false,
			hasPersistedThreadState: false,
			isStreaming: false,
			isVoiceMode: false,
			pendingThreadId: "thread-1",
		}),
		false,
	);
});

test("replaces the pending draft route once voice mode is off and persistence is complete", () => {
	assert.equal(
		shouldReplacePendingRovoAppRoute({
			activeThreadId: "thread-1",
			embedded: false,
			hasPersistedThreadState: true,
			isStreaming: false,
			isVoiceMode: false,
			pendingThreadId: "thread-1",
		}),
		true,
	);
});

test("flushPendingRovoAppRouteReplacement skips when no active thread is available", () => {
	const pendingThreadIdRef = { current: "thread-1" };
	const pendingRouteReadyRef = { current: true };
	const replacedPaths = [];

	assert.equal(
		flushPendingRovoAppRouteReplacement({
			activeThreadId: null,
			buildThreadPath: (threadId) => `/rovo/${threadId}`,
			embedded: false,
			isStreaming: false,
			isVoiceMode: false,
			pendingRouteReadyRef,
			pendingThreadIdRef,
			replaceHistoryPath: (path) => replacedPaths.push(path),
		}),
		false,
	);
	assert.equal(pendingThreadIdRef.current, "thread-1");
	assert.equal(pendingRouteReadyRef.current, true);
	assert.deepEqual(replacedPaths, []);
});

test("flushPendingRovoAppRouteReplacement skips without clearing refs when the gate blocks", () => {
	const pendingThreadIdRef = { current: "thread-1" };
	const pendingRouteReadyRef = { current: true };
	const replacedPaths = [];

	assert.equal(
		flushPendingRovoAppRouteReplacement({
			activeThreadId: "thread-1",
			buildThreadPath: (threadId) => `/rovo/${threadId}`,
			embedded: false,
			isStreaming: true,
			isVoiceMode: false,
			pendingRouteReadyRef,
			pendingThreadIdRef,
			replaceHistoryPath: (path) => replacedPaths.push(path),
		}),
		false,
	);
	assert.equal(pendingThreadIdRef.current, "thread-1");
	assert.equal(pendingRouteReadyRef.current, true);
	assert.deepEqual(replacedPaths, []);
});

test("flushPendingRovoAppRouteReplacement clears refs and replaces history on success", () => {
	const pendingThreadIdRef = { current: "thread-1" };
	const pendingRouteReadyRef = { current: true };
	const replacedPaths = [];

	assert.equal(
		flushPendingRovoAppRouteReplacement({
			activeThreadId: "thread-1",
			buildThreadPath: (threadId) => `/rovo/${threadId}`,
			embedded: false,
			isStreaming: false,
			isVoiceMode: false,
			pendingRouteReadyRef,
			pendingThreadIdRef,
			replaceHistoryPath: (path) => replacedPaths.push(path),
		}),
		true,
	);
	assert.equal(pendingThreadIdRef.current, null);
	assert.equal(pendingRouteReadyRef.current, false);
	assert.deepEqual(replacedPaths, ["/rovo/thread-1"]);
});

test("recovered threads use the same deferred route replacement gate", () => {
	assert.equal(
		shouldReplacePendingRovoAppRoute({
			activeThreadId: "thread-recovered",
			embedded: false,
			hasPersistedThreadState: true,
			isStreaming: true,
			isVoiceMode: false,
			pendingThreadId: "thread-recovered",
		}),
		false,
	);

	assert.equal(
		shouldReplacePendingRovoAppRoute({
			activeThreadId: "thread-recovered",
			embedded: false,
			hasPersistedThreadState: true,
			isStreaming: false,
			isVoiceMode: false,
			pendingThreadId: "thread-recovered",
		}),
		true,
	);
});

test("skips reloading only when the active thread is already hydrated", () => {
	assert.equal(
		shouldSkipRovoAppThreadLoad({
			activeThreadId: "thread-1",
			hasHydratedThreadState: true,
			requestedThreadId: "thread-1",
		}),
		true,
	);
});

test("does not skip loading when the route mounts a thread that has not been hydrated yet", () => {
	assert.equal(
		shouldSkipRovoAppThreadLoad({
			activeThreadId: "thread-1",
			hasHydratedThreadState: false,
			requestedThreadId: "thread-1",
		}),
		false,
	);
});

test("loads the initial route thread only once until the route param changes", () => {
	assert.equal(
		shouldLoadInitialRovoAppThread({
			initialThreadId: "thread-1",
			lastLoadedInitialThreadId: null,
		}),
		true,
	);

	assert.equal(
		shouldLoadInitialRovoAppThread({
			initialThreadId: "thread-1",
			lastLoadedInitialThreadId: "thread-1",
		}),
		false,
	);

	assert.equal(
		shouldLoadInitialRovoAppThread({
			initialThreadId: "thread-2",
			lastLoadedInitialThreadId: "thread-1",
		}),
		true,
	);
});
