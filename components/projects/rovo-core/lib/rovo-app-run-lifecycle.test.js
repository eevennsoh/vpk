const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const {
	cancelRovoAppThreadRunWithLifecycle,
	completeRovoAppUseChatTurn,
	createRovoAppLocalActiveRun,
	handleRovoAppAttachedRunChunk,
	handleRovoAppUseChatError,
	interruptRovoAppActiveTurn,
	isRovoAppUseChatBusy,
	releaseCompletedRovoAppUseChatTurn,
	requestExplicitRovoAppCancel,
	updateRovoAppThreadActiveRun,
	waitForRovoAppActiveTurnToStop,
} = loadRovoCoreModule("lib/rovo-app-run-lifecycle.ts");
const { createRovoCancelDebounce } = require("../../../../lib/rovo-cancel-strategy.ts");

function createThread(overrides = {}) {
	return {
		id: "thread-1",
		title: "Thread",
		messages: [],
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

test("run lifecycle helpers identify busy useChat states", () => {
	assert.equal(isRovoAppUseChatBusy("submitted"), true);
	assert.equal(isRovoAppUseChatBusy("streaming"), true);
	assert.equal(isRovoAppUseChatBusy("ready"), false);
	assert.equal(isRovoAppUseChatBusy("error"), false);
});

test("updateRovoAppThreadActiveRun updates only the target thread timestamp", () => {
	const activeRun = createRovoAppLocalActiveRun({
		now: "2026-07-04T00:00:05.000Z",
		status: "queued",
		threadId: "thread-2",
	});
	const threads = [
		createThread({ id: "thread-1" }),
		createThread({ id: "thread-2" }),
	];

	const nextThreads = updateRovoAppThreadActiveRun(threads, {
		activeRun,
		now: "2026-07-04T00:00:06.000Z",
		threadId: "thread-2",
	});

	assert.equal(nextThreads[0], threads[0]);
	assert.notEqual(nextThreads[1], threads[1]);
	assert.equal(nextThreads[1].activeRun, activeRun);
	assert.equal(nextThreads[1].updatedAt, "2026-07-04T00:00:06.000Z");
});

test("createRovoAppLocalActiveRun preserves the route hook local run shape", () => {
	assert.deepEqual(
		createRovoAppLocalActiveRun({
			now: "2026-07-04T00:00:05.000Z",
			status: "background",
			threadId: "thread-3",
		}),
		{
			id: "rovo-app-run-local-thread-3",
			backend: "ai-gateway",
			status: "background",
			rovoPort: null,
			startedAt: "2026-07-04T00:00:05.000Z",
			updatedAt: "2026-07-04T00:00:05.000Z",
		},
	);
});

test("completeRovoAppUseChatTurn clears active run state and kicks the queue", () => {
	const calls = [];

	completeRovoAppUseChatTurn({
		activeThreadId: "thread-1",
		kickQueue() {
			calls.push(["kickQueue"]);
		},
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setLocalThreadActiveRun(threadId, activeRun) {
			calls.push(["setLocalThreadActiveRun", threadId, activeRun]);
		},
	});

	assert.deepEqual(calls, [
		["setLocalThreadActiveRun", "thread-1", null],
		["setAttachedRunStatus", null],
		["kickQueue"],
	]);
});

test("requestExplicitRovoAppCancel skips a cancel the debounce gate refuses", async () => {
	const calls = [];
	const debounceKeys = [];
	const result = await requestExplicitRovoAppCancel({
		activeThreadIdRef: { current: "thread-1" },
		attachedRunStatus: null,
		cancelRun: async () => {
			calls.push(["cancelRun"]);
			return true;
		},
		cancelUrlForThread: () => "/cancel",
		currentActiveRun: null,
		fetchCancel: async () => {
			calls.push(["fetchCancel"]);
		},
		mayCancel(key) {
			debounceKeys.push(key);
			return false;
		},
		queueProcessorRunningRef: { current: true },
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setHasActiveDispatch(hasActiveDispatch) {
			calls.push(["setHasActiveDispatch", hasActiveDispatch]);
		},
		setLocalThreadActiveRun(threadId, activeRun) {
			calls.push(["setLocalThreadActiveRun", threadId, activeRun]);
		},
		turnId: "user-1",
		warn(message, error) {
			calls.push(["warn", message, error]);
		},
	});

	assert.equal(result, "debounced");
	assert.deepEqual(calls, []);
	assert.deepEqual(debounceKeys, ["thread-1:turn:user-1"]);
});

test("requestExplicitRovoAppCancel clears local active run state when run cancellation succeeds", async () => {
	const calls = [];
	const queueProcessorRunningRef = { current: true };
	const activeRun = createRovoAppLocalActiveRun({ threadId: "thread-1" });

	const result = await requestExplicitRovoAppCancel({
		activeThreadIdRef: { current: "thread-1" },
		attachedRunStatus: "streaming",
		cancelRun: async (threadId) => {
			calls.push(["cancelRun", threadId]);
			return true;
		},
		cancelUrlForThread: () => "/cancel",
		currentActiveRun: activeRun,
		fetchCancel: async () => {
			calls.push(["fetchCancel"]);
		},
		mayCancel: () => true,
		queueProcessorRunningRef,
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setHasActiveDispatch(hasActiveDispatch) {
			calls.push(["setHasActiveDispatch", hasActiveDispatch]);
		},
		setLocalThreadActiveRun(threadId, activeRun) {
			calls.push(["setLocalThreadActiveRun", threadId, activeRun]);
		},
		turnId: "user-1",
	});

	assert.equal(result, "run-cancelled");
	assert.equal(queueProcessorRunningRef.current, false);
	assert.deepEqual(calls, [
		["cancelRun", "thread-1"],
		["setHasActiveDispatch", false],
		["setLocalThreadActiveRun", "thread-1", null],
		["setAttachedRunStatus", null],
	]);
});

test("cancelRovoAppThreadRunWithLifecycle clears active thread subscription state", async () => {
	const calls = [];
	const abortController = new AbortController();
	const queueProcessorRunningRef = { current: true };
	const runSubscriptionAbortControllerRef = { current: abortController };
	const runSubscriptionThreadIdRef = { current: "thread-1" };

	const result = await cancelRovoAppThreadRunWithLifecycle({
		activeThreadIdRef: { current: "thread-1" },
		cancelRun: async (threadId) => {
			calls.push(["cancelRun", threadId]);
			return true;
		},
		queueProcessorRunningRef,
		refreshThreads: async () => {
			calls.push(["refreshThreads"]);
		},
		runSubscriptionAbortControllerRef,
		runSubscriptionThreadIdRef,
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setHasActiveDispatch(hasActiveDispatch) {
			calls.push(["setHasActiveDispatch", hasActiveDispatch]);
		},
		setInputError(message) {
			calls.push(["setInputError", message]);
		},
		setLocalThreadActiveRun(threadId, activeRun) {
			calls.push(["setLocalThreadActiveRun", threadId, activeRun]);
		},
		threadId: "thread-1",
		toUserErrorMessage(error) {
			return error.message;
		},
	});

	assert.equal(result, true);
	assert.equal(queueProcessorRunningRef.current, false);
	assert.equal(runSubscriptionAbortControllerRef.current, null);
	assert.equal(runSubscriptionThreadIdRef.current, null);
	assert.equal(abortController.signal.aborted, true);
	assert.deepEqual(calls, [
		["cancelRun", "thread-1"],
		["setLocalThreadActiveRun", "thread-1", null],
		["setHasActiveDispatch", false],
		["setAttachedRunStatus", null],
	]);
});

test("interruptRovoAppActiveTurn escalates timed-out useChat stops and marks the assistant reply", async () => {
	const calls = [];
	let rovoMessages = [
		{
			id: "assistant-1",
			role: "assistant",
			parts: [{ type: "text", text: "Working on it" }],
			metadata: {},
		},
	];
	const runSubscriptionAbortController = new AbortController();
	const interruptPromiseRef = { current: null };
	let waitCalls = 0;

	await interruptRovoAppActiveTurn({
		activeThreadIdRef: { current: "thread-1" },
		attachedRunStatus: null,
		clearDirectDelegationState() {
			calls.push(["clearDirectDelegationState"]);
		},
		currentActiveRun: null,
		delegationAbortControllerRef: { current: null },
		interruptPromiseRef,
		mutateRealtimeMessagesState(updater) {
			calls.push(["mutateRealtimeMessagesState"]);
			return updater([]);
		},
		requestExplicitCancel: async () => {
			calls.push(["requestExplicitCancel"]);
		},
		runSubscriptionAbortControllerRef: { current: runSubscriptionAbortController },
		runSubscriptionThreadIdRef: { current: "thread-1" },
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setInputError(message) {
			calls.push(["setInputError", message]);
		},
		setLocalThreadActiveRun(threadId, activeRun) {
			calls.push(["setLocalThreadActiveRun", threadId, activeRun]);
		},
		setRovoMessages(updater) {
			rovoMessages = typeof updater === "function" ? updater(rovoMessages) : updater;
			calls.push(["setRovoMessages"]);
		},
		sleep: async (ms) => {
			calls.push(["sleep", ms]);
		},
		source: "user-stop",
		statusRef: { current: "streaming" },
		stopUseChat: async () => {
			calls.push(["stopUseChat"]);
		},
		toUserErrorMessage(error) {
			return error.message;
		},
		useChatStatus: "streaming",
		waitForActiveTurnToStop: async () => {
			waitCalls += 1;
			calls.push(["waitForActiveTurnToStop", waitCalls]);
			return false;
		},
		warn(message) {
			calls.push(["warn", message]);
		},
	});

	assert.equal(interruptPromiseRef.current, null);
	assert.deepEqual(
		calls.map((call) => call[0]),
		[
			"stopUseChat",
			"waitForActiveTurnToStop",
			"warn",
			"requestExplicitCancel",
			"waitForActiveTurnToStop",
			"setAttachedRunStatus",
			"clearDirectDelegationState",
			"warn",
			"setRovoMessages",
			"sleep",
		],
	);
	assert.equal(runSubscriptionAbortController.signal.aborted, true);
	assert.deepEqual(rovoMessages[0].metadata.interruption, {
		status: "interrupted",
		source: "user-stop",
		interruptedAt: rovoMessages[0].metadata.interruption.interruptedAt,
	});
});

function createInterruptInput(overrides = {}) {
	const calls = [];
	const input = {
		activeThreadIdRef: { current: "thread-1" },
		attachedRunStatus: null,
		clearDirectDelegationState() {},
		currentActiveRun: null,
		delegationAbortControllerRef: { current: null },
		interruptPromiseRef: { current: null },
		mutateRealtimeMessagesState(updater) {
			return updater([]);
		},
		requestExplicitCancel: async () => {
			calls.push("requestExplicitCancel");
		},
		runSubscriptionAbortControllerRef: { current: null },
		runSubscriptionThreadIdRef: { current: null },
		setAttachedRunStatus() {},
		setInputError() {},
		setLocalThreadActiveRun() {},
		setRovoMessages() {},
		sleep: async () => {},
		source: "user-stop",
		statusRef: { current: "streaming" },
		stopUseChat: async () => {
			calls.push("stopUseChat");
		},
		toUserErrorMessage(error) {
			return error.message;
		},
		useChatStatus: "streaming",
		// AI SDK stop() settles the chat locally, so the wait always succeeds.
		waitForActiveTurnToStop: async () => true,
		warn() {},
		...overrides,
	};
	return { calls, input };
}

test("interruptRovoAppActiveTurn sends a backend cancel on user Stop even when stop() settles in time", async () => {
	const { calls, input } = createInterruptInput();

	await interruptRovoAppActiveTurn(input);

	assert.deepEqual(calls, ["stopUseChat", "requestExplicitCancel"]);
});

test("interruptRovoAppActiveTurn leaves a voice barge-in that settles in time to stop()", async () => {
	const { calls, input } = createInterruptInput({ source: "voice-barge-in" });

	await interruptRovoAppActiveTurn(input);

	assert.deepEqual(calls, ["stopUseChat"]);
});

test("interruptRovoAppActiveTurn cancels an attached background run once across repeated Stops", async () => {
	const backendCalls = [];
	const mayCancel = createRovoCancelDebounce({ now: () => 1_000 });
	const activeThreadIdRef = { current: "thread-1" };
	const currentActiveRun = createRovoAppLocalActiveRun({ threadId: "thread-1" });
	const requestExplicitCancel = () =>
		requestExplicitRovoAppCancel({
			activeThreadIdRef,
			attachedRunStatus: "streaming",
			cancelRun: async (threadId, { signal }) => {
				backendCalls.push(["cancelRun", threadId, signal instanceof AbortSignal]);
				return true;
			},
			cancelUrlForThread: () => "/cancel",
			currentActiveRun,
			fetchCancel: async (url) => {
				backendCalls.push(["fetchCancel", url]);
			},
			mayCancel,
			queueProcessorRunningRef: { current: true },
			setAttachedRunStatus() {},
			setHasActiveDispatch() {},
			setLocalThreadActiveRun() {},
			turnId: "user-1",
		});

	for (let attempt = 0; attempt < 2; attempt += 1) {
		const { input } = createInterruptInput({
			activeThreadIdRef,
			attachedRunStatus: "streaming",
			currentActiveRun,
			requestExplicitCancel,
		});
		await interruptRovoAppActiveTurn(input);
	}

	assert.deepEqual(backendCalls, [["cancelRun", "thread-1", true]]);
});

test("requestExplicitRovoAppCancel keys the debounce on the turn so a Stop on a new turn still cancels", async () => {
	const fetched = [];
	const mayCancel = createRovoCancelDebounce({ now: () => 1_000 });
	const request = (turnId) =>
		requestExplicitRovoAppCancel({
			activeThreadIdRef: { current: "thread-1" },
			attachedRunStatus: null,
			cancelRun: async () => true,
			cancelUrlForThread: (threadId) => `/cancel?threadId=${threadId}`,
			currentActiveRun: null,
			fetchCancel: async (url) => {
				fetched.push(url);
			},
			mayCancel,
			queueProcessorRunningRef: { current: true },
			setAttachedRunStatus() {},
			setHasActiveDispatch() {},
			setLocalThreadActiveRun() {},
			turnId,
		});

	assert.equal(await request("user-1"), "cancel-requested");
	assert.equal(await request("user-1"), "debounced");
	assert.equal(await request("user-2"), "cancel-requested");
	assert.deepEqual(fetched, ["/cancel?threadId=thread-1", "/cancel?threadId=thread-1"]);
});

test("requestExplicitRovoAppCancel caps a hanging cancel at the timeout", async () => {
	const warnings = [];
	const waitForAbort = (signal) =>
		new Promise((_resolve, reject) => {
			signal.addEventListener("abort", () => reject(signal.reason), { once: true });
		});
	const startedAt = Date.now();

	const result = await requestExplicitRovoAppCancel({
		activeThreadIdRef: { current: "thread-1" },
		attachedRunStatus: "streaming",
		cancelRun: (_threadId, { signal }) => waitForAbort(signal),
		cancelUrlForThread: () => "/cancel",
		currentActiveRun: null,
		fetchCancel: (_url, { signal }) =>
			signal.aborted ? Promise.reject(signal.reason) : waitForAbort(signal),
		mayCancel: () => true,
		queueProcessorRunningRef: { current: true },
		setAttachedRunStatus() {},
		setHasActiveDispatch() {},
		setLocalThreadActiveRun() {},
		timeoutMs: 20,
		turnId: "user-1",
		warn(message) {
			warnings.push(message);
		},
	});

	assert.equal(result, "failed");
	assert.ok(Date.now() - startedAt < 1_000);
	assert.deepEqual(warnings, ["[RovoApp] Explicit cancel request failed:"]);
});

test("handleRovoAppUseChatError clears transient artifact and retries artifact creates", () => {
	const calls = [];
	const currentTurnIntentRef = { current: "artifact_create" };
	const pendingArtifactCreationRetryRef = { current: false };

	handleRovoAppUseChatError({
		activeDocumentRef: { current: null },
		clearArtifactState() {
			calls.push(["clearArtifactState"]);
		},
		clearStreamingArtifactState() {
			calls.push(["clearStreamingArtifactState"]);
		},
		currentTurnIntentRef,
		error: new Error("failed"),
		pendingArtifactCreationRetryRef,
		resetPendingArtifactAssociation() {
			calls.push(["resetPendingArtifactAssociation"]);
		},
		setInputError(message) {
			calls.push(["setInputError", message]);
		},
		streamingArtifactRef: {
			current: { documentId: "document-1" },
		},
		toUserErrorMessage(error) {
			return error.message;
		},
	});

	assert.deepEqual(calls, [
		["clearStreamingArtifactState"],
		["resetPendingArtifactAssociation"],
		["clearArtifactState"],
		["setInputError", "failed"],
	]);
	assert.equal(currentTurnIntentRef.current, null);
	assert.equal(pendingArtifactCreationRetryRef.current, true);
});

test("handleRovoAppAttachedRunChunk ignores non-data chunks", () => {
	const calls = [];
	let threads = [createThread()];

	handleRovoAppAttachedRunChunk({
		attachedRunStatus: "queued",
		chunk: { data: "ignored", type: "text" },
		dispatchDataPart(dataPart) {
			calls.push(["dispatchDataPart", dataPart]);
		},
		runSubscriptionThreadIdRef: { current: "thread-1" },
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setThreads(nextThreads) {
			threads = typeof nextThreads === "function"
				? nextThreads(threads)
				: nextThreads;
			calls.push(["setThreads"]);
		},
	});

	assert.deepEqual(calls, []);
	assert.equal(threads[0].activeRun, null);
});

test("handleRovoAppAttachedRunChunk promotes queued attached runs and dispatches data", () => {
	const calls = [];
	let threads = [
		createThread({
			id: "thread-1",
			activeRun: createRovoAppLocalActiveRun({
				now: "2026-07-04T00:00:00.000Z",
				status: "queued",
				threadId: "thread-1",
			}),
		}),
		createThread({
			id: "thread-2",
			activeRun: createRovoAppLocalActiveRun({
				now: "2026-07-04T00:00:00.000Z",
				status: "queued",
				threadId: "thread-2",
			}),
		}),
	];

	handleRovoAppAttachedRunChunk({
		attachedRunStatus: "queued",
		chunk: { data: "delta", type: "data-textDelta" },
		dispatchDataPart(dataPart) {
			calls.push(["dispatchDataPart", dataPart]);
		},
		now: () => "2026-07-04T00:00:05.000Z",
		runSubscriptionThreadIdRef: { current: "thread-1" },
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setThreads(nextThreads) {
			threads = typeof nextThreads === "function"
				? nextThreads(threads)
				: nextThreads;
			calls.push(["setThreads"]);
		},
	});

	assert.deepEqual(calls, [
		["setAttachedRunStatus", "streaming"],
		["setThreads"],
		["dispatchDataPart", { data: "delta", type: "data-textDelta" }],
	]);
	assert.equal(threads[0].activeRun.status, "streaming");
	assert.equal(threads[0].activeRun.updatedAt, "2026-07-04T00:00:05.000Z");
	assert.equal(threads[1].activeRun.status, "queued");
	assert.equal(threads[1].activeRun.updatedAt, "2026-07-04T00:00:00.000Z");
});

test("handleRovoAppAttachedRunChunk dispatches data without promotion when already streaming", () => {
	const calls = [];
	let threads = [createThread()];

	handleRovoAppAttachedRunChunk({
		attachedRunStatus: "streaming",
		chunk: { data: { done: true }, type: "data-finish" },
		dispatchDataPart(dataPart) {
			calls.push(["dispatchDataPart", dataPart]);
		},
		runSubscriptionThreadIdRef: { current: "thread-1" },
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setThreads(nextThreads) {
			threads = typeof nextThreads === "function"
				? nextThreads(threads)
				: nextThreads;
			calls.push(["setThreads"]);
		},
	});

	assert.deepEqual(calls, [
		["dispatchDataPart", { data: { done: true }, type: "data-finish" }],
	]);
	assert.equal(threads[0].activeRun, null);
});

test("waitForRovoAppActiveTurnToStop returns once status becomes ready", async () => {
	let nowValue = 1_000;
	const statusRef = { current: "streaming" };
	const waits = [];

	const stopped = await waitForRovoAppActiveTurnToStop({
		now: () => nowValue,
		sleep: async (ms) => {
			waits.push(ms);
			nowValue += ms;
			statusRef.current = "ready";
		},
		statusRef,
		timeoutMs: 100,
		waitIntervalMs: 25,
	});

	assert.equal(stopped, true);
	assert.deepEqual(waits, [25]);
});

test("waitForRovoAppActiveTurnToStop reports timeout while status stays busy", async () => {
	let nowValue = 1_000;

	const stopped = await waitForRovoAppActiveTurnToStop({
		now: () => nowValue,
		sleep: async (ms) => {
			nowValue += ms;
		},
		statusRef: { current: "streaming" },
		timeoutMs: 50,
		waitIntervalMs: 25,
	});

	assert.equal(stopped, false);
});

test("releaseCompletedRovoAppUseChatTurn clears local run and waits for stop", async () => {
	let nowValue = 1_000;
	const calls = [];
	const statusRef = { current: "streaming" };

	await releaseCompletedRovoAppUseChatTurn({
		activeThreadIdRef: { current: "thread-1" },
		hasObservedTurnCompleteRef: { current: true },
		now: () => nowValue,
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setLocalThreadActiveRun(threadId, activeRun) {
			calls.push(["setLocalThreadActiveRun", threadId, activeRun]);
		},
		sleep: async (ms) => {
			calls.push(["sleep", ms]);
			nowValue += ms;
			statusRef.current = "ready";
		},
		statusRef,
		stopUseChat() {
			calls.push(["stopUseChat"]);
		},
		timeoutMs: 100,
		useChatStatus: "streaming",
	});

	assert.deepEqual(calls, [
		["setLocalThreadActiveRun", "thread-1", null],
		["setAttachedRunStatus", null],
		["stopUseChat"],
		["sleep", 25],
	]);
});

test("releaseCompletedRovoAppUseChatTurn is a no-op for idle or unobserved turns", async () => {
	const calls = [];

	await releaseCompletedRovoAppUseChatTurn({
		activeThreadIdRef: { current: "thread-1" },
		hasObservedTurnCompleteRef: { current: false },
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setLocalThreadActiveRun(threadId, activeRun) {
			calls.push(["setLocalThreadActiveRun", threadId, activeRun]);
		},
		statusRef: { current: "ready" },
		stopUseChat() {
			calls.push(["stopUseChat"]);
		},
		useChatStatus: "streaming",
	});
	await releaseCompletedRovoAppUseChatTurn({
		activeThreadIdRef: { current: "thread-1" },
		hasObservedTurnCompleteRef: { current: true },
		setAttachedRunStatus(status) {
			calls.push(["setAttachedRunStatus", status]);
		},
		setLocalThreadActiveRun(threadId, activeRun) {
			calls.push(["setLocalThreadActiveRun", threadId, activeRun]);
		},
		statusRef: { current: "ready" },
		stopUseChat() {
			calls.push(["stopUseChat"]);
		},
		useChatStatus: "ready",
	});

	assert.deepEqual(calls, []);
});
