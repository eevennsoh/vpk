// Unit tests for the pure chat turn machine (SM-FE-15). The provider-level
// behaviour it drives is covered by context-rovo-chat-turn-*.behavior.test.js.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

function loadMachine() {
	const result = esbuild.buildSync({
		stdin: {
			contents: `
				export * from "@/app/contexts/rovo-chat-turn-machine";
				export * from "@/app/contexts/rovo-chat-media-state";
				export * from "@/lib/chat-error-utils";
				export { getPayloadTooLargeUserMessage } from "@/app/contexts/rovo-chat-helpers";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "rovo-chat-turn-machine-entry.ts",
		},
		bundle: true,
		format: "cjs",
		loader: { ".css": "empty" },
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});
	return loadCjsModuleFromText(result.outputFiles[0].text, "rovo-chat-turn-machine.cjs");
}

const machine = loadMachine();
const {
	ROVO_CHAT_TURN_INITIAL_STATE: INITIAL,
	canDispatchNextPrompt,
	canFinalizeActivePrompt,
	classifyTurnError,
	createRetryCountdownMessage,
	findCutShortMediaWait,
	findCutShortNotice,
	findLatestMediaLoadingState,
	hasLiveRequest,
	hasSendInFlight,
	isTurnWorkIdle,
	rovoChatTurnReducer: reduce,
	shouldStartSubmitPending,
} = machine;

const IDLE = Object.freeze({ isStreaming: false, isMediaGenerating: false, isCancelling: false, retryScheduled: false });
const prompt = (id) => ({ id, files: [], text: `prompt ${id}`, createdAt: 0 });
const run = (state, ...events) => events.reduce(reduce, state);

test("enqueue, remove and clear keep queue order and always write a new queue array", () => {
	const queued = run(INITIAL, { type: "enqueue", prompt: prompt("a") }, { type: "enqueue", prompt: prompt("b") }, { type: "enqueue", prompt: prompt("c") });
	assert.deepEqual(queued.queue.map((item) => item.id), ["a", "b", "c"]);
	const removed = reduce(queued, { type: "removeQueued", id: "b" });
	assert.deepEqual(removed.queue.map((item) => item.id), ["a", "c"]);
	assert.notEqual(reduce(removed, { type: "removeQueued", id: "missing" }).queue, removed.queue);
	const cleared = reduce(INITIAL, { type: "clearQueue" });
	assert.deepEqual(cleared.queue, []);
	assert.notEqual(cleared.queue, INITIAL.queue);
});

test("dispatchNext moves the head of the queue into flight and starts its turn fresh", () => {
	const midTurn = { ...INITIAL, queue: [prompt("a"), prompt("b")], finalizeRequested: true, turnCompleteSeen: true, cutShort: { anchorMessageId: "r", mediaWaitEndsAt: 5_000 }, retryCount: 2 };
	const next = reduce(midTurn, { type: "dispatchNext" });
	assert.equal(next.activePrompt.id, "a");
	assert.deepEqual(next.queue.map((item) => item.id), ["b"]);
	assert.equal(next.dispatching, true);
	assert.equal(next.sendAttempt, midTurn.sendAttempt + 1);
	assert.equal(next.finalizeRequested, false);
	assert.equal(next.turnCompleteSeen, false);
	assert.equal(next.cutShort, null);
	assert.equal(next.retryCount, 0);
	assert.equal(reduce(INITIAL, { type: "dispatchNext" }), INITIAL);
});

const settledEvent = (state, failed) => ({ type: "dispatchSettled", attempt: state.sendAttempt, failed });

test("a settled dispatch requests finalize only when the send failed", () => {
	const inFlight = run(INITIAL, { type: "enqueue", prompt: prompt("a") }, { type: "dispatchNext" });
	const ok = reduce(inFlight, settledEvent(inFlight, false));
	assert.equal(ok.dispatching, false);
	assert.equal(ok.finalizeRequested, false);
	const failed = reduce(inFlight, settledEvent(inFlight, true));
	assert.equal(failed.dispatching, false);
	assert.equal(failed.finalizeRequested, true);
});

// Regression: settlements were not scoped, so a send superseded by a reset
// (a thread change) finalized the prompt sent after it before its request started.
test("a settlement from a send that a reset or a later send superseded is ignored", () => {
	const first = run(INITIAL, { type: "enqueue", prompt: prompt("a") }, { type: "dispatchNext" });
	const stale = settledEvent(first, true);
	const replaced = run(first, { type: "reset" }, { type: "enqueue", prompt: prompt("b") }, { type: "dispatchNext" });
	assert.equal(replaced.activePrompt.id, "b");
	assert.equal(reduce(replaced, stale), replaced);
	assert.equal(reduce(reduce(first, { type: "reset" }), stale).finalizeRequested, false);
	const retrying = reduce(first, { type: "retryDispatchStarted" });
	assert.equal(reduce(retrying, stale), retrying);
	const editing = run(first, { type: "editStarted" }, { type: "editDispatchStarted" });
	assert.equal(reduce(editing, stale), editing);
	assert.equal(reduce(editing, settledEvent(editing, false)).dispatching, false);
});

test("a retry counts the attempt, withdraws a pending finalize, and dispatches again", () => {
	const inFlight = run(INITIAL, { type: "enqueue", prompt: prompt("a") }, { type: "dispatchNext" });
	const failedOnce = reduce(inFlight, settledEvent(inFlight, true));
	const retrying = reduce(failedOnce, { type: "retryDispatchStarted" });
	assert.equal(retrying.retryCount, 1);
	assert.equal(retrying.finalizeRequested, false);
	assert.equal(retrying.dispatching, true);
	assert.equal(retrying.sendAttempt, failedOnce.sendAttempt + 1);
	assert.equal(reduce(retrying, { type: "retryDispatchStarted" }).retryCount, 2);
});

test("turnFailed requests finalize and resets retries only for a give-up", () => {
	const retried = { ...INITIAL, activePrompt: prompt("a"), retryCount: 2 };
	assert.deepEqual(
		pick(reduce(retried, { type: "turnFailed", resetRetries: false })),
		{ finalizeRequested: true, retryCount: 2 },
	);
	assert.deepEqual(
		pick(reduce(retried, { type: "turnFailed", resetRetries: true })),
		{ finalizeRequested: true, retryCount: 0 },
	);
	function pick(state) {
		return { finalizeRequested: state.finalizeRequested, retryCount: state.retryCount };
	}
});

test("stopRequested finalizes the active prompt and is a no-op without one", () => {
	assert.equal(reduce(INITIAL, { type: "stopRequested" }), INITIAL);
	const active = { ...INITIAL, activePrompt: prompt("a") };
	assert.equal(reduce(active, { type: "stopRequested" }).finalizeRequested, true);
	const failed = { ...active, finalizeRequested: true };
	assert.equal(reduce(failed, { type: "stopRequested" }), failed);
});

test("Stop on a cut-short turn still waiting for media drops the cut-short notice", () => {
	const cut = reduce({ ...INITIAL, activePrompt: prompt("a") }, cutShortFinish(true));
	const stopped = reduce(cut, { type: "stopRequested" });
	assert.equal(stopped.finalizeRequested, true);
	assert.equal(stopped.cutShort, null);
	assert.equal(findCutShortNotice(stopped), null);
	// Stop's own path clears the media flag; the snapshot's media wait no longer holds the turn.
	assert.equal(canFinalizeActivePrompt(stopped, IDLE), true);
});

test("turnCompleteSeen is idempotent", () => {
	const seen = reduce({ ...INITIAL, activePrompt: prompt("a") }, { type: "turnCompleteSeen" });
	assert.equal(seen.turnCompleteSeen, true);
	assert.equal(reduce(seen, { type: "turnCompleteSeen" }), seen);
});

test("finalize clears the active prompt and its flags but keeps the queue", () => {
	const state = { ...INITIAL, queue: [prompt("b")], activePrompt: prompt("a"), finalizeRequested: true, turnCompleteSeen: true, retryCount: 1 };
	const finalized = reduce(state, { type: "finalize" });
	assert.equal(finalized.activePrompt, null);
	assert.equal(finalized.finalizeRequested, false);
	assert.equal(finalized.turnCompleteSeen, false);
	assert.equal(finalized.retryCount, 0);
	assert.equal(finalized.queue, state.queue);
	assert.equal(reduce(INITIAL, { type: "finalize" }), INITIAL);
});

test("an edit drops the queue and the active prompt but keeps the retry count, then dispatches without one", () => {
	const state = { ...INITIAL, queue: [prompt("b")], activePrompt: prompt("a"), finalizeRequested: true, turnCompleteSeen: true, retryCount: 1 };
	const edited = reduce(state, { type: "editStarted" });
	assert.deepEqual(edited.queue, []);
	assert.equal(edited.activePrompt, null);
	assert.equal(edited.finalizeRequested, false);
	assert.equal(edited.turnCompleteSeen, false);
	assert.equal(edited.retryCount, 1);
	const sending = reduce(edited, { type: "editDispatchStarted" });
	assert.equal(sending.dispatching, true);
	assert.equal(reduce(sending, settledEvent(sending, false)).finalizeRequested, false);
});

test("reset returns to the initial state with a fresh queue array and moves the send on", () => {
	const busy = { ...INITIAL, queue: [prompt("b")], activePrompt: prompt("a"), finalizeRequested: true, turnCompleteSeen: true, cutShort: { anchorMessageId: "r", mediaWaitEndsAt: 5_000 }, dispatching: true, sendAttempt: 4, retryCount: 3 };
	const reset = reduce(busy, { type: "reset" });
	assert.deepEqual(reset, { ...INITIAL, queue: [], sendAttempt: 5, transcriptVersion: 1, editId: 1 });
	assert.notEqual(reset.queue, INITIAL.queue);
});

test("a transition holds dispatch until the current owner finishes; only commit invalidates transcript work", () => {
	const queued = reduce(INITIAL, { type: "enqueue", prompt: prompt("a") });
	const first = reduce(queued, { type: "transitionStarted", id: 1 });
	assert.equal(canDispatchNextPrompt(first, IDLE), false);
	const superseding = reduce(first, { type: "transitionStarted", id: 2 });
	assert.equal(reduce(superseding, { type: "transitionFinished", id: 1 }), superseding);
	const retained = reduce(superseding, { type: "transitionFinished", id: 2 });
	assert.equal(retained.transcriptVersion, queued.transcriptVersion);
	assert.equal(canDispatchNextPrompt(retained, IDLE), true);
	const committed = reduce(first, { type: "reset" });
	assert.equal(committed.transcriptVersion, first.transcriptVersion + 1);
	assert.equal(committed.transitionId, first.transitionId, "commit still holds dispatch until the transition finishes");
	assert.deepEqual(committed.queue, []);
});

test("retry deadlines survive transition and settlement, and Stop, edit and commit clear them", () => {
	const sending = run(INITIAL, { type: "enqueue", prompt: prompt("a") }, { type: "dispatchNext" });
	const retry = { promptId: "a", dueAt: 1_000, monotonicDueAt: 1_000, delayMs: 500, messageId: "retry", reason: "rate-limit" };
	const waiting = reduce(sending, { type: "retryScheduled", retry });
	const retained = run(waiting, settledEvent(waiting, false), { type: "transitionStarted", id: 1 }, { type: "transitionFinished", id: 1 });
	assert.equal(retained.retry, retry);
	assert.equal(canFinalizeActivePrompt(retained, IDLE), false);
	for (const event of [{ type: "stopRequested" }, { type: "editStarted" }, { type: "reset" }, { type: "retryDispatchStarted" }]) {
		assert.equal(reduce(retained, event).retry, null, event.type);
	}
	assert.equal(reduce(retained, { type: "retryScheduled", retry: { ...retry, promptId: "stale" } }), retained);
});

test("pending edits block the queue and only their own settlement releases preparation", () => {
	const first = reduce(INITIAL, { type: "editStarted" });
	const second = reduce(first, { type: "editStarted" });
	const queued = reduce(second, { type: "enqueue", prompt: prompt("a") });
	assert.equal(canDispatchNextPrompt(queued, IDLE), false);
	assert.equal(reduce(queued, { type: "editSettled", id: first.editId }), queued);
	assert.equal(canDispatchNextPrompt(reduce(queued, { type: "editSettled", id: second.editId }), IDLE), true);
});

test("hasSendInFlight holds while a prompt is active or a send is dispatching", () => {
	assert.equal(hasSendInFlight(INITIAL), false);
	assert.equal(hasSendInFlight({ ...INITIAL, activePrompt: prompt("a") }), true);
	assert.equal(hasSendInFlight({ ...INITIAL, dispatching: true }), true);
});

const WAIT_ENDS_AT = 9_000;
const cutShortFinish = (mediaLoading, anchorMessageId = "reply-a", promptId = "a") => ({
	type: "turnCutShort",
	promptId,
	finish: { anchorMessageId, mediaLoading },
	mediaWaitEndsAt: mediaLoading ? WAIT_ENDS_AT : null,
});

// A request is live from its send's start until its own onFinish or onError has
// run; the committed streaming flag, which lags the request's end, never decides.
const SENDING = Object.freeze({ ...INITIAL, activePrompt: prompt("a"), dispatching: true, requestStarted: true });
const SETTLED = Object.freeze({ ...SENDING, dispatching: false });
const FINISHED = { type: "requestFinished" };
const EDIT_SENDING = Object.freeze(run(INITIAL, { type: "editStarted" }, { type: "editDispatchStarted" }));
const LIVENESS_BY_TURN_STATE = [
	{ name: "idle", state: INITIAL, env: IDLE, live: false },
	{ name: "a prompt sending or streaming", state: SENDING, env: IDLE, live: true },
	{ name: "a prompt creating its thread", state: run(INITIAL, { type: "enqueue", prompt: prompt("a") }, { type: "dispatchNext" }), env: IDLE, live: false },
	{ name: "an edit resend sending or streaming", state: EDIT_SENDING, env: IDLE, live: true },
	{ name: "a retry resend sending or streaming", state: reduce(SETTLED, { type: "retryDispatchStarted" }), env: IDLE, live: true },
	{ name: "cut short, before its send settles", state: reduce(SENDING, cutShortFinish(true)), env: IDLE, live: false },
	{ name: "cut short and settled", state: reduce(SETTLED, cutShortFinish(true)), env: IDLE, live: false },
	{ name: "completed (turn-complete seen), stream still open", state: reduce(SENDING, { type: "turnCompleteSeen" }), env: IDLE, live: false },
	{ name: "completed and settled", state: SETTLED, env: IDLE, live: false },
	{ name: "failed for good, before its send settles", state: reduce(SENDING, { type: "turnFailed", resetRetries: false }), env: IDLE, live: false },
	{ name: "failed into a retry countdown, before its send settles", state: SENDING, env: { ...IDLE, retryScheduled: true }, live: false },
	{ name: "failed into a retry countdown and settled", state: SETTLED, env: { ...IDLE, retryScheduled: true }, live: false },
	{ name: "stopped, before its send settles", state: reduce(SENDING, { type: "stopRequested" }), env: IDLE, live: false },
	{ name: "reset by a thread change", state: reduce(SENDING, { type: "reset" }), env: IDLE, live: false },
	{ name: "an edit resend still streaming", state: EDIT_SENDING, env: IDLE, live: true },
	{ name: "an edit resend finished (onFinish ran) but not settled", state: reduce(EDIT_SENDING, FINISHED), env: IDLE, live: false },
	{ name: "a queued send finished cleanly (onFinish ran) but not settled", state: reduce(SENDING, FINISHED), env: IDLE, live: false },
	// A finish recorded for one send never carries into the next.
	{ name: "an edit resend started after the previous request finished", state: run(SENDING, FINISHED, { type: "editStarted" }, { type: "editDispatchStarted" }), env: IDLE, live: true },
	{ name: "a retry resend started after its failed request finished", state: run(SENDING, FINISHED, settledEvent(SENDING, false), { type: "retryDispatchStarted" }), env: IDLE, live: true },
	{ name: "a send after a reset that followed a finish", state: run(SENDING, FINISHED, { type: "reset" }, { type: "enqueue", prompt: prompt("b") }, { type: "dispatchNext" }, { type: "requestStarted" }), env: IDLE, live: true },
];

for (const row of LIVENESS_BY_TURN_STATE) {
	for (const isStreaming of [false, true]) {
		test(`hasLiveRequest: ${row.name}, streaming flag ${isStreaming ? "true" : "false"} → ${row.live ? "live" : "not live"}`, () => {
			assert.equal(hasLiveRequest(row.state, { ...row.env, isStreaming }), row.live);
		});
	}
}

test("a request finish is recorded only while a send dispatches, and leaves the send's settlement as it was", () => {
	// A finish arriving after a reset (no send dispatching) records nothing.
	const reset = reduce(SENDING, { type: "reset" });
	assert.equal(reduce(reset, FINISHED), reset);
	assert.equal(reduce(INITIAL, FINISHED), INITIAL);
	const finished = reduce(SENDING, FINISHED);
	assert.equal(reduce(finished, FINISHED), finished);
	assert.deepEqual(finished, { ...SENDING, requestFinished: true });
	// The send still settles by its own attempt, and only its own.
	assert.equal(reduce(finished, { type: "dispatchSettled", attempt: finished.sendAttempt + 1, failed: false }), finished);
	assert.equal(reduce(finished, settledEvent(finished, false)).dispatching, false);
	assert.equal(hasSendInFlight(finished), true);
});

test("a cut-short turn keeps its finish snapshot's anchor and notices only if turn-complete never arrives", () => {
	assert.equal(reduce(INITIAL, cutShortFinish(false)), INITIAL);
	// Another prompt's finish does not cut this one short.
	const other = { ...INITIAL, activePrompt: prompt("b") };
	assert.equal(reduce(other, cutShortFinish(false)), other);
	const cut = reduce({ ...INITIAL, activePrompt: prompt("a"), retryCount: 1 }, cutShortFinish(false));
	assert.equal(cut.finalizeRequested, true);
	assert.deepEqual(cut.cutShort, { anchorMessageId: "reply-a", mediaWaitEndsAt: null });
	assert.equal(cut.retryCount, 1);
	assert.deepEqual(findCutShortNotice(cut), { anchorMessageId: "reply-a", mediaWaitEndsAt: null });
	assert.equal(findCutShortNotice(reduce(cut, { type: "turnCompleteSeen" })), null);
	assert.equal(findCutShortNotice({ ...INITIAL, activePrompt: prompt("a"), finalizeRequested: true }), null);
	for (const event of [{ type: "finalize" }, { type: "editStarted" }, { type: "retryDispatchStarted" }, { type: "reset" }]) {
		assert.equal(reduce(cut, event).cutShort, null, event.type);
	}
});

// Regression: the cut-short decision used to read the committed media flag,
// which lags a response that arrived in full before React rendered it.
test("a cut-short turn's media comes from its finish snapshot, not the media flag", () => {
	const noMedia = reduce({ ...INITIAL, activePrompt: prompt("a") }, cutShortFinish(false));
	assert.equal(canFinalizeActivePrompt(noMedia, IDLE), true);
	assert.equal(canFinalizeActivePrompt(noMedia, { ...IDLE, isMediaGenerating: true }), true);
	assert.equal(canFinalizeActivePrompt(noMedia, { ...IDLE, isStreaming: true }), false);

	const waiting = reduce({ ...INITIAL, activePrompt: prompt("a") }, cutShortFinish(true));
	assert.equal(waiting.cutShort.mediaWaitEndsAt, WAIT_ENDS_AT);
	assert.deepEqual(findCutShortMediaWait(waiting), { promptId: "a", endsAt: WAIT_ENDS_AT });
	assert.equal(findCutShortMediaWait(noMedia), null);
	assert.equal(canFinalizeActivePrompt(waiting, IDLE), false);
	assert.equal(reduce(waiting, { type: "cutShortMediaWaitElapsed", promptId: "other" }), waiting);
	const elapsed = reduce(waiting, { type: "cutShortMediaWaitElapsed", promptId: "a" });
	assert.deepEqual(elapsed.cutShort, { anchorMessageId: "reply-a", mediaWaitEndsAt: null });
	assert.equal(findCutShortMediaWait(elapsed), null);
	assert.equal(canFinalizeActivePrompt(elapsed, { ...IDLE, isMediaGenerating: true }), true);
	assert.equal(reduce(elapsed, { type: "cutShortMediaWaitElapsed", promptId: "a" }), elapsed);
});

test("a cut-short wait that outlives its turn changes nothing", () => {
	const waiting = reduce({ ...INITIAL, queue: [prompt("b")], activePrompt: prompt("a") }, cutShortFinish(true));
	const elapsed = { type: "cutShortMediaWaitElapsed", promptId: "a" };
	// Stop, a transcript replacement (reset), or the next prompt taking over.
	const stopped = reduce(waiting, { type: "stopRequested" });
	assert.equal(reduce(stopped, elapsed), stopped);
	const reset = reduce(waiting, { type: "reset" });
	assert.equal(reduce(reset, elapsed), reset);
	const next = run(waiting, { type: "finalize" }, { type: "dispatchNext" }, cutShortFinish(true, "reply-b", "b"));
	assert.equal(next.activePrompt.id, "b");
	assert.equal(reduce(next, elapsed), next);
});

test("the active prompt finalizes after turn-complete once the stream closes, even while media loads", () => {
	const completed = { ...INITIAL, activePrompt: prompt("a"), turnCompleteSeen: true };
	assert.equal(canFinalizeActivePrompt(completed, { ...IDLE, isStreaming: true }), false);
	assert.equal(canFinalizeActivePrompt(completed, IDLE), true);
	assert.equal(canFinalizeActivePrompt(completed, { ...IDLE, isMediaGenerating: true }), true);
});

test("a failed turn finalizes only once the stream and media generation settle", () => {
	const failed = { ...INITIAL, activePrompt: prompt("a"), finalizeRequested: true };
	assert.equal(canFinalizeActivePrompt(failed, IDLE), true);
	assert.equal(canFinalizeActivePrompt(failed, { ...IDLE, isStreaming: true }), false);
	assert.equal(canFinalizeActivePrompt(failed, { ...IDLE, isMediaGenerating: true }), false);
});

test("nothing finalizes during a send, a scheduled retry or a cancel, or without an active prompt", () => {
	const ready = { ...INITIAL, activePrompt: prompt("a"), finalizeRequested: true, turnCompleteSeen: true };
	assert.equal(canFinalizeActivePrompt({ ...ready, dispatching: true }, IDLE), false);
	assert.equal(canFinalizeActivePrompt(ready, { ...IDLE, retryScheduled: true }), false);
	assert.equal(canFinalizeActivePrompt(ready, { ...IDLE, isCancelling: true }), false);
	assert.equal(canFinalizeActivePrompt({ ...ready, activePrompt: null }, IDLE), false);
	assert.equal(canFinalizeActivePrompt({ ...INITIAL, activePrompt: prompt("a") }, IDLE), false);
});

test("the next prompt dispatches only when the queue has one and nothing is in flight or generating", () => {
	const queued = { ...INITIAL, queue: [prompt("a")] };
	assert.equal(canDispatchNextPrompt(queued, IDLE), true);
	assert.equal(canDispatchNextPrompt(INITIAL, IDLE), false);
	assert.equal(canDispatchNextPrompt({ ...queued, activePrompt: prompt("x") }, IDLE), false);
	assert.equal(canDispatchNextPrompt({ ...queued, dispatching: true }, IDLE), false);
	for (const key of ["isStreaming", "isMediaGenerating", "isCancelling", "retryScheduled"]) {
		assert.equal(canDispatchNextPrompt(queued, { ...IDLE, [key]: true }), false, key);
	}
});

test("submit pending starts only when nothing is in flight, and media alone does not block it", () => {
	assert.equal(shouldStartSubmitPending(INITIAL, IDLE), true);
	assert.equal(shouldStartSubmitPending({ ...INITIAL, queue: [prompt("a")] }, IDLE), true);
	assert.equal(shouldStartSubmitPending(INITIAL, { ...IDLE, isMediaGenerating: true }), true);
	assert.equal(shouldStartSubmitPending({ ...INITIAL, activePrompt: prompt("a") }, IDLE), false);
	assert.equal(shouldStartSubmitPending({ ...INITIAL, dispatching: true }, IDLE), false);
	for (const key of ["isStreaming", "isCancelling", "retryScheduled"]) {
		assert.equal(shouldStartSubmitPending(INITIAL, { ...IDLE, [key]: true }), false, key);
	}
});

test("turn work is idle only with an empty queue and nothing in flight", () => {
	assert.equal(isTurnWorkIdle(INITIAL, IDLE), true);
	assert.equal(isTurnWorkIdle(INITIAL, { ...IDLE, isMediaGenerating: true }), true);
	assert.equal(isTurnWorkIdle({ ...INITIAL, queue: [prompt("a")] }, IDLE), false);
	assert.equal(isTurnWorkIdle({ ...INITIAL, activePrompt: prompt("a") }, IDLE), false);
	assert.equal(isTurnWorkIdle(INITIAL, { ...IDLE, retryScheduled: true }), false);
});

test("rate-limit errors retry until the maximum, then give up with their copy and reset retries", () => {
	const active = prompt("a");
	const retry = classifyTurnError({ errorMessage: "rate limit exceeded", retryCount: 0, activePrompt: active });
	assert.deepEqual(retry, { kind: "retry", reason: "rate-limit", delayMs: machine.RATE_LIMIT_RETRY_DELAY_MS, prompt: active });
	assert.deepEqual(
		classifyTurnError({ errorMessage: "rate limit exceeded", retryCount: machine.RATE_LIMIT_MAX_RETRIES, activePrompt: active }),
		{ kind: "fail", userMessage: machine.getRateLimitUserMessage(machine.RATE_LIMIT_MAX_RETRIES), resetRetries: true, sanitizeTranscript: false },
	);
	// Without an active prompt there is nothing to resend.
	assert.equal(classifyTurnError({ errorMessage: "rate limit exceeded", retryCount: 0, activePrompt: null }).kind, "fail");
});

test("chat-in-progress errors retry until the maximum, then give up with their copy", () => {
	const active = prompt("a");
	assert.deepEqual(
		classifyTurnError({ errorMessage: "ROVO_CHAT_IN_PROGRESS", retryCount: 0, activePrompt: active }),
		{ kind: "retry", reason: "chat-in-progress", delayMs: machine.CHAT_IN_PROGRESS_RETRY_DELAY_MS, prompt: active },
	);
	assert.deepEqual(
		classifyTurnError({ errorMessage: "ROVO_CHAT_IN_PROGRESS", retryCount: machine.CHAT_IN_PROGRESS_MAX_RETRIES, activePrompt: active }),
		{ kind: "fail", userMessage: machine.getChatInProgressUserMessage(machine.CHAT_IN_PROGRESS_MAX_RETRIES), resetRetries: true, sanitizeTranscript: false },
	);
});

test("payload-too-large errors fail with their copy and sanitize the transcript; other errors fail with the user-facing copy", () => {
	assert.deepEqual(
		classifyTurnError({ errorMessage: "PayloadTooLargeError: request entity too large", retryCount: 0, activePrompt: prompt("a") }),
		{ kind: "fail", userMessage: machine.getPayloadTooLargeUserMessage(), resetRetries: false, sanitizeTranscript: true },
	);
	const generic = classifyTurnError({ errorMessage: "", retryCount: 0, activePrompt: prompt("a") });
	assert.deepEqual(generic, { kind: "fail", userMessage: "Sorry, I hit an error. Please try again.", resetRetries: false, sanitizeTranscript: false });
});

test("retry countdowns use the rate-limit text and the chat-in-progress thinking status", () => {
	const rateLimit = createRetryCountdownMessage("rate-limit", "error-1", 3);
	assert.equal(rateLimit.id, "error-1");
	assert.deepEqual(rateLimit.parts, [{ type: "text", text: machine.getRateLimitRetryCountdownMessage(3), state: "done" }]);
	const inProgress = createRetryCountdownMessage("chat-in-progress", "error-2", 2);
	assert.equal(inProgress.parts[0].type, "data-thinking-status");
	assert.equal(inProgress.parts[0].data.label, machine.getChatInProgressRetryCountdownLabel(2));
});

test("the media loading state comes from the current turn's latest assistant message", () => {
	const loading = (type, value) => ({ type: "data-widget-loading", data: { type, loading: value } });
	const assistant = (...parts) => ({ id: "a", role: "assistant", parts });
	const user = (promptId) => ({ id: "u", role: "user", metadata: promptId ? { promptId } : undefined, parts: [{ type: "text", text: "hi" }] });
	const scan = (messages) => findLatestMediaLoadingState(messages, "p1");
	assert.equal(scan([]), null);
	assert.equal(scan([user("p1"), assistant({ type: "text", text: "no media" })]), null);
	assert.equal(scan([user("p1"), assistant(loading("work-item-card", true))]), null);
	assert.equal(scan([user("p1"), assistant(loading("image-preview", true))]), true);
	assert.equal(scan([user("p1"), assistant(loading("audio-preview", true), loading("audio-preview", false))]), false);
	assert.equal(scan([user("p1"), assistant(loading("image-preview", true)), assistant({ type: "text", text: "later" })]), null);
	// The active prompt's user message has not landed yet.
	assert.equal(scan([user("p0"), assistant(loading("video-preview", true))]), null);
});

// Regression: the scan used to read the latest assistant message wherever it
// was, so a widget an earlier turn left loading kept media generation up for
// the next turn until the 120 s timeout.
test("a widget an earlier turn left loading does not count for the next turn", () => {
	const stale = { id: "a0", role: "assistant", parts: [{ type: "data-widget-loading", data: { type: "video-preview", loading: true } }] };
	const user = (id, promptId) => ({ id, role: "user", metadata: promptId ? { promptId } : undefined, parts: [{ type: "text", text: "hi" }] });
	assert.equal(findLatestMediaLoadingState([user("u0", "p0"), stale, user("u1", "p1")], "p1"), null);
	assert.equal(findLatestMediaLoadingState([user("u0", "p0"), stale], "p1"), null);
	// With no active prompt, a finalized queued turn does not count either...
	assert.equal(findLatestMediaLoadingState([user("u0", "p0"), stale], null), null);
	// ...but an edit resend (its user message carries no prompt id) does.
	assert.equal(findLatestMediaLoadingState([user("u0"), stale], null), true);
});
