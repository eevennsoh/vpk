const test = require("node:test");
const assert = require("node:assert/strict");

const {
	createRovoBackendCanceller,
	createRovoCancelDebounce,
	getRovoCancelDebounceKey,
	requestRovoBackendCancel,
	shouldSendExplicitRovoCancel,
} = require("./rovo-cancel-strategy.ts");

test("shouldSendExplicitRovoCancel skips explicit cancel when a useChat turn stops in time", () => {
	assert.equal(
		shouldSendExplicitRovoCancel({
			explicitUserCancel: false,
			hasBackgroundCancelableWork: false,
			hasUseChatTurn: true,
			stopSettledInTime: true,
		}),
		false,
	);
});

test("shouldSendExplicitRovoCancel escalates when a useChat turn does not stop in time", () => {
	assert.equal(
		shouldSendExplicitRovoCancel({
			explicitUserCancel: false,
			hasBackgroundCancelableWork: false,
			hasUseChatTurn: true,
			stopSettledInTime: false,
		}),
		true,
	);
});

test("shouldSendExplicitRovoCancel still allows explicit cancel for non-useChat turns", () => {
	assert.equal(
		shouldSendExplicitRovoCancel({
			explicitUserCancel: false,
			hasBackgroundCancelableWork: false,
			hasUseChatTurn: false,
			stopSettledInTime: true,
		}),
		true,
	);
});

test("shouldSendExplicitRovoCancel escalates when background work remains cancelable", () => {
	assert.equal(
		shouldSendExplicitRovoCancel({
			explicitUserCancel: false,
			hasBackgroundCancelableWork: true,
			hasUseChatTurn: true,
			stopSettledInTime: true,
		}),
		true,
	);
});

test("shouldSendExplicitRovoCancel always cancels on an explicit user Stop, even when stop() settled in time", () => {
	assert.equal(
		shouldSendExplicitRovoCancel({
			explicitUserCancel: true,
			hasBackgroundCancelableWork: false,
			hasUseChatTurn: true,
			stopSettledInTime: true,
		}),
		true,
	);
});

test("getRovoCancelDebounceKey keys a user Stop on the turn and other cancels on the target", () => {
	assert.equal(getRovoCancelDebounceKey({ threadId: "t1", portIndex: 2 }, null), "t1");
	assert.equal(getRovoCancelDebounceKey({ threadId: null, portIndex: 2 }, null), "port:2");
	assert.equal(getRovoCancelDebounceKey({ threadId: null }, null), "default");
	assert.equal(getRovoCancelDebounceKey({ threadId: "t1" }, "q1"), "t1:turn:q1");
	assert.notEqual(getRovoCancelDebounceKey({ threadId: "t1" }, "q1"), getRovoCancelDebounceKey({ threadId: "t1" }, "q2"));
});

function createCancelRecorder() {
	const calls = [];
	return {
		calls,
		cancelRun: async (threadId, options) => { calls.push(["cancelRun", threadId, options.signal]); },
		fetchImpl: async (url, init) => { calls.push(["fetch", url, init.method, init.signal]); },
	};
}

test("requestRovoBackendCancel cancels the thread run when there is a thread", async () => {
	const recorder = createCancelRecorder();
	const signal = new AbortController().signal;
	await requestRovoBackendCancel({ target: { threadId: "t1", portIndex: 3 }, cancelEndpoint: "/api/chat-cancel", ...recorder, signal });
	assert.deepEqual(recorder.calls, [["cancelRun", "t1", signal]]);
});

test("requestRovoBackendCancel posts chat-cancel with the port index when there is no thread", async () => {
	const recorder = createCancelRecorder();
	const signal = new AbortController().signal;
	await requestRovoBackendCancel({ target: { threadId: null, portIndex: 3 }, cancelEndpoint: "/api/chat-cancel", ...recorder, signal });
	await requestRovoBackendCancel({ target: { threadId: null }, cancelEndpoint: "/api/chat-cancel", ...recorder, signal });
	assert.deepEqual(recorder.calls, [
		["fetch", "/api/chat-cancel?portIndex=3", "POST", signal],
		["fetch", "/api/chat-cancel", "POST", signal],
	]);
});

test("createRovoBackendCanceller skips a repeat of the same key inside the window and swallows request errors", async () => {
	let clock = 0;
	const calls = [];
	const send = createRovoBackendCanceller({
		cancelEndpoint: "/api/chat-cancel",
		cancelRun: async (threadId) => { calls.push(threadId); throw new Error("already ended"); },
		fetchImpl: async () => {},
		timeoutMs: 1000,
		debounceMs: 2000,
		now: () => clock,
	});
	assert.equal(await send({ threadId: "t1" }, "q1"), true);
	assert.equal(await send({ threadId: "t1" }, "q1"), false);
	assert.equal(await send({ threadId: "t1" }, "q2"), true);
	clock = 2500;
	assert.equal(await send({ threadId: "t1" }, "q2"), true);
	assert.deepEqual(calls, ["t1", "t1", "t1"]);
});

test("createRovoCancelDebounce refuses a repeat key inside the window and passes a new key", () => {
	let clock = 1_000;
	const mayCancel = createRovoCancelDebounce({ debounceMs: 2_000, now: () => clock });

	assert.equal(mayCancel("thread-1:turn:a"), true);
	assert.equal(mayCancel("thread-1:turn:a"), false);
	assert.equal(mayCancel("thread-1:turn:b"), true);
	clock += 2_000;
	assert.equal(mayCancel("thread-1:turn:b"), true);
});
