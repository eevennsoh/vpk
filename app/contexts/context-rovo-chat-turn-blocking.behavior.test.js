// Characterization suite for the RovoChatProvider turn lifecycle (SM-FE-15),
// written before the turn state moved into a reducer: media-generation
// blocking, plan approval submission, and local-turn transitions. It renders
// the real provider, real AI SDK `useChat` and real transport against the fake
// network in ./rovo-chat-turn-test-harness.js, so no paid model call can happen.
// Tests named `current behaviour: …` pin what the provider does today rather
// than a desired contract.
const assert = require("node:assert/strict");
const test = require("node:test");
const {
	React,
	cancelRunCalls,
	captureMediaTimeouts,
	chatState,
	describeMessages,
	holdDetach,
	holdThreadFetchUntilRequestFinishes,
	mountChat,
	send,
	settle,
	startAction,
	streamPartial,
	waitFor,
	waitForUncommitted,
	withCommitsHeld,
} = require("./rovo-chat-turn-test-harness.js");

function mediaLoading(turn, loading, type = "image-preview") {
	turn.send({ type: "data-widget-loading", data: { type, loading } });
}

const assistantText = (text) => [{ type: "text", text }];

// ── Media generation ──────────────────────────────────────────────────────

test("a media widget that loads and finishes inside the turn flags media generation, then lets the queue advance", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Draw a cat");
	await waitFor("the request", () => server.turns.length === 1);
	await send(chat, "Then a dog");
	const [turn] = server.turns;
	turn.send({ type: "start" });
	mediaLoading(turn, true);
	await waitFor("media generation to start", () => chat().isMediaGenerating);
	assert.equal(chat().hasInFlightTurn, true);

	mediaLoading(turn, false);
	await waitFor("media generation to finish", () => !chat().isMediaGenerating);
	turn.turnComplete();
	turn.end();
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.equal(chat().activePrompt?.text, "Then a dog");
	assert.equal(chat().isMediaGenerating, false);
});

test("audio and video widgets count as media generation too; other widgets do not", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Make sounds");
	await waitFor("the request", () => server.turns.length === 1);
	const [turn] = server.turns;
	turn.send({ type: "start" });
	mediaLoading(turn, true, "work-item-card");
	await settle(30);
	assert.equal(chat().isMediaGenerating, false);
	mediaLoading(turn, true, "audio-preview");
	await waitFor("audio generation", () => chat().isMediaGenerating);
	mediaLoading(turn, false, "audio-preview");
	await waitFor("audio done", () => !chat().isMediaGenerating);
	mediaLoading(turn, true, "video-preview");
	await waitFor("video generation", () => chat().isMediaGenerating);
	turn.turnComplete();
	turn.end();
	await waitFor("the turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
});

test("a stream that ends without turn-complete while media is loading keeps the prompt active and the queue blocked until Stop", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	const timeouts = captureMediaTimeouts(t, harness);
	await send(chat, "Draw a cat");
	await waitFor("the request", () => server.turns.length === 1);
	await send(chat, "Then a dog");
	const [turn] = server.turns;
	turn.send({ type: "start" });
	mediaLoading(turn, true);
	await waitFor("media generation to start", () => chat().isMediaGenerating);
	turn.end();
	await waitFor("the stream to end", () => !chat().isStreaming);
	await settle(80);

	assert.equal(server.turns.length, 1, "the queued prompt must not dispatch while media is still generating");
	assert.equal(chat().activePrompt?.text, "Draw a cat");
	assert.deepEqual(chatState().queued, ["Then a dog"]);
	assert.equal(chat().isMediaGenerating, true);
	assert.equal(chat().hasInFlightTurn, true);
	// Regression: the cut-short notice used to show as soon as the request
	// finished. It now waits for media generation to settle.
	assert.deepEqual(chatState().messages, [
		"user:Draw a cat",
		"assistant:data-widget-loading",
	]);
	assert.equal(timeouts.cutShort.count(), 1);

	await (await startAction(() => chat().stopStreaming()))();
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.equal(chat().activePrompt?.text, "Then a dog");
	// A cut-short wait that runs out after Stop changes nothing.
	await timeouts.cutShort.fireLatest();
	await settle(20);
	assert.equal(server.turns.length, 2);
	// The user ended the turn with Stop, so no cut-short notice follows it.
	assert.equal(chatState().messages.includes(`assistant:${harness.getIncompleteTurnUserMessage()}`), false);
	// No stream was live, so Stop sent no backend cancel.
	assert.deepEqual(cancelRunCalls(), []);
});

test("a cut-short turn whose media widget is still loading shows the notice after the short cut-short wait, not the full media timeout, then advances the queue", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	assert.equal(harness.CUT_SHORT_MEDIA_WAIT_MS < harness.MEDIA_GENERATION_TIMEOUT_MS, true);
	const timeouts = captureMediaTimeouts(t, harness);
	await send(chat, "Draw a cat");
	await waitFor("the request", () => server.turns.length === 1);
	await send(chat, "Then a dog");
	const [turn] = server.turns;
	turn.send({ type: "start" });
	mediaLoading(turn, true);
	await waitFor("media generation to start", () => chat().isMediaGenerating);
	assert.equal(timeouts.full.count(), 1);
	assert.equal(timeouts.cutShort.count(), 0, "the short wait starts only once the turn is known to be cut short");
	turn.end();
	await waitFor("the stream to end", () => !chat().isStreaming);
	await settle(40);
	assert.equal(server.turns.length, 1);
	assert.equal(chatState().messages.includes(`assistant:${harness.getIncompleteTurnUserMessage()}`), false);
	// Later queue ticks do not restart the short wait.
	assert.equal(timeouts.cutShort.count(), 1);

	await timeouts.cutShort.fireLatest();
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.equal(chat().activePrompt?.text, "Then a dog");
	assert.equal(chat().isMediaGenerating, false);
	const notice = `assistant:${harness.getIncompleteTurnUserMessage()}`;
	assert.deepEqual(chatState().messages.slice(0, 3), [
		"user:Draw a cat",
		"assistant:data-widget-loading",
		notice,
	]);
	assert.equal(chatState().messages.filter((message) => message === notice).length, 1);
});

// Holds the first prompt's send (at thread creation) until `deliver` runs. Then
// the send, the whole scripted response and the request's onFinish all run
// before React commits any of it, as when a fast response beats a render.
function holdFirstSendUntilDelivery(server, script) {
	let openThreadGate;
	window.testApi.createThreadGate = new Promise((resolve) => {
		openThreadGate = resolve;
	});
	server.respondNext(script);
	return () => withCommitsHeld(async () => {
		openThreadGate();
		await waitForUncommitted("the request", () => server.turns.length > 0);
		await new Promise((resolve) => setTimeout(resolve, 100));
	});
}

// Regression: when the whole response (a loading media widget, then the close
// without turn-complete) arrived before React committed anything, the turn
// finalized from uncommitted state: no media flag, so no wait, and the notice
// anchored to the transcript as last committed, which put it above the
// question. Finalization now decides from the request's finish snapshot.
test("a cut-short response that arrives in full before React commits waits the short wait for its loading widget, then shows the notice after the reply", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	const timeouts = captureMediaTimeouts(t, harness);
	const deliver = holdFirstSendUntilDelivery(server, (turn) => {
		turn.send({ type: "start" });
		turn.text("t", "Drawing");
		mediaLoading(turn, true);
		turn.end();
	});
	await send(chat, "Draw a cat");
	await send(chat, "Then a dog");
	assert.equal(server.turns.length, 0);
	assert.equal(chat().isStreaming, false);

	await deliver();
	await waitFor("the reply to render", () => chatState().messages.length >= 2);
	await settle(40);
	const notice = `assistant:${harness.getIncompleteTurnUserMessage()}`;
	assert.deepEqual(chatState().messages, ["user:Draw a cat", "assistant:Drawing+data-widget-loading"]);
	assert.equal(chat().activePrompt?.text, "Draw a cat");
	assert.equal(server.turns.length, 1);
	assert.equal(chat().isMediaGenerating, true);
	assert.equal(timeouts.cutShort.count(), 1);

	await timeouts.cutShort.fireLatest();
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.equal(chat().activePrompt?.text, "Then a dog");
	assert.equal(chat().isMediaGenerating, false);
	assert.deepEqual(chatState().messages.slice(0, 3), ["user:Draw a cat", "assistant:Drawing+data-widget-loading", notice]);
	assert.equal(chatState().messages.filter((message) => message === notice).length, 1);
});

test("a cut-short response with no media that arrives in full before React commits shows the notice after the reply at once", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	const timeouts = captureMediaTimeouts(t, harness);
	const deliver = holdFirstSendUntilDelivery(server, (turn) => {
		turn.send({ type: "start" });
		turn.text("t", "Half an answer");
		turn.end();
	});
	await send(chat, "Explain");
	await deliver();
	await waitFor("the turn to finalize", () => chat().activePrompt === null && chatState().messages.length === 3);
	assert.deepEqual(chatState().messages, [
		"user:Explain",
		"assistant:Half an answer",
		`assistant:${harness.getIncompleteTurnUserMessage()}`,
	]);
	assert.equal(timeouts.cutShort.count(), 0);
});

// ── Cut-short turns and transcript replacement ────────────────────────────

const STORED_THREAD = Object.freeze({
	id: "stored-thread",
	title: "Stored",
	messages: [
		{ id: "s-u", role: "user", parts: [{ type: "text", text: "Old question" }] },
		{ id: "s-a", role: "assistant", parts: [{ type: "text", text: "Old answer" }] },
	],
	realtimeMessages: [],
	visibility: "private",
	activeDocumentId: null,
	createdAt: 0,
	updatedAt: 0,
});

// Starts a turn streaming its reply, with "Then a dog" queued behind it: a
// partial reply with its media widget loading or, when `completed`, a reply
// that completed (turn-complete seen) on a stream still open.
async function startStreamingTurn(t, { completed = false, ...options } = {}) {
	const mounted = await mountChat(t, options);
	const { harness, server, chat } = mounted;
	const timeouts = captureMediaTimeouts(t, harness);
	window.testApi.threads.set(STORED_THREAD.id, structuredClone(STORED_THREAD));
	await send(chat, "Draw a cat");
	await waitFor("the request", () => server.turns.length === 1);
	await send(chat, "Then a dog");
	const [turn] = server.turns;
	turn.send({ type: "start" });
	if (completed) {
		turn.text("t", "A cat");
		turn.turnComplete();
		await waitFor("the completed reply", () => chatState().messages.at(-1) === "assistant:A cat+data-turn-complete");
	} else {
		turn.text("t", "Drawing");
		mediaLoading(turn, true);
		await waitFor("media generation to start", () => chat().isMediaGenerating);
	}
	const notice = `assistant:${harness.getIncompleteTurnUserMessage()}`;
	return { ...mounted, timeouts, turn, notice, departingThreadId: chat().activeThreadId };
}

// Starts a turn that is cut short with its media widget still loading, so it
// sits in the short cut-short wait, with "Then a dog" queued behind it.
async function startCutShortMediaWait(t, options) {
	const started = await startStreamingTurn(t, options);
	const { turn, chat, timeouts } = started;
	turn.end();
	await waitFor("the stream to end", () => !chat().isStreaming);
	await settle(20);
	assert.equal(timeouts.cutShort.count(), 1);
	assert.equal(chat().activePrompt?.text, "Draw a cat");
	return started;
}

// Every path that replaces or drops the transcript ends the departing turn
// first: no notice on the new transcript, no media hold, no queued prompt from
// the old thread, and the old cut-short wait no longer does anything.
const TRANSCRIPT_REPLACEMENTS = [
	{ name: "selectThread", run: (chat) => chat().selectThread(STORED_THREAD.id), messages: ["user:Old question", "assistant:Old answer"] },
	{ name: "selectThread of a missing thread", run: (chat) => chat().selectThread("missing-thread"), messages: [] },
	{ name: "deleteThread of the active thread", run: (chat) => chat().deleteThread(chat().activeThreadId), messages: [] },
	{ name: "deleteAllThreads", run: (chat) => chat().deleteAllThreads(), messages: [] },
	{ name: "resetChat", run: (chat) => chat().resetChat(), messages: [] },
	{
		name: "activateSession",
		run: (chat) => chat().activateSession({ threadId: STORED_THREAD.id, messages: STORED_THREAD.messages }),
		messages: ["user:Old question", "assistant:Old answer"],
	},
];

for (const replacement of TRANSCRIPT_REPLACEMENTS) {
	test(`${replacement.name} during a cut-short turn's media wait ends that turn without a notice anywhere`, async (t) => {
		const { server, chat, timeouts, notice } = await startCutShortMediaWait(t);

		await (await startAction(() => replacement.run(chat)))();
		await settle(20);
		assert.equal(chat().activePrompt, null);
		assert.deepEqual(chat().queuedPrompts, []);
		assert.equal(chat().isMediaGenerating, false);
		assert.equal(chat().hasInFlightTurn, false);
		assert.deepEqual(chatState().messages, replacement.messages);

		// The departing turn's wait runs out on the new transcript: nothing happens.
		await timeouts.cutShort.fireLatest();
		await settle(20);
		assert.deepEqual(chatState().messages, replacement.messages);
		assert.equal(chatState().messages.includes(notice), false);
		assert.equal(server.turns.length, 1);
	});
}

test("the departing thread keeps its partial reply, saved without the notice, after a switch during the cut-short wait", async (t) => {
	const { chat, timeouts, notice, departingThreadId } = await startCutShortMediaWait(t);
	const partial = ["user:Draw a cat", "assistant:Drawing+data-widget-loading"];
	await waitFor("the partial reply to be saved", () => describeMessages(window.testApi.threads.get(departingThreadId)?.messages ?? []).length === 2);

	await (await startAction(() => chat().selectThread(STORED_THREAD.id)))();
	await timeouts.cutShort.fireLatest();
	await settle(20);
	assert.deepEqual(describeMessages(window.testApi.threads.get(departingThreadId).messages), partial);

	await (await startAction(() => chat().selectThread(departingThreadId)))();
	await settle(20);
	assert.deepEqual(chatState().messages, partial);
	assert.equal(chatState().messages.includes(notice), false);
	assert.equal(chat().activePrompt, null);
	assert.equal(chat().isMediaGenerating, false);
});

test("a prompt sent on the newly selected thread before the old cut-short wait runs out is neither blocked, finalized nor annotated by it", async (t) => {
	const { server, chat, timeouts, notice } = await startCutShortMediaWait(t);
	await (await startAction(() => chat().selectThread(STORED_THREAD.id)))();

	await send(chat, "Fresh question");
	await waitFor("the fresh request", () => server.turns.length === 2);
	assert.equal(chat().activePrompt?.text, "Fresh question");
	await streamPartial(server, chat, 1, "Fresh partial");

	await timeouts.cutShort.fireLatest();
	await settle(20);
	assert.equal(chat().activePrompt?.text, "Fresh question");
	assert.equal(chat().isStreaming, true);
	assert.equal(chatState().messages.includes(notice), false);

	server.turns[1].text("t1-end", " and done");
	server.turns[1].turnComplete();
	server.turns[1].end();
	await waitFor("the fresh turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	await settle(20);
	assert.equal(chatState().messages.includes(notice), false);
	assert.deepEqual(chatState().messages.slice(0, 3), ["user:Old question", "assistant:Old answer", "user:Fresh question"]);
	assert.equal(server.turns.length, 2);
});

test("the old cut-short wait running out does not release a new thread's cut-short turn that is waiting on its own media", async (t) => {
	const { server, chat, timeouts, notice } = await startCutShortMediaWait(t);
	await (await startAction(() => chat().selectThread(STORED_THREAD.id)))();
	await send(chat, "Draw a dog");
	await waitFor("the fresh request", () => server.turns.length === 2);
	const fresh = server.turns[1];
	fresh.send({ type: "start" });
	fresh.text("t1", "Dog");
	mediaLoading(fresh, true);
	fresh.end();
	await waitFor("the fresh stream to end", () => !chat().isStreaming && timeouts.cutShort.count() === 2);

	await timeouts.cutShort.fire(0);
	await settle(20);
	assert.equal(chat().activePrompt?.text, "Draw a dog");
	assert.equal(chatState().messages.includes(notice), false);

	await timeouts.cutShort.fire(1);
	await waitFor("the fresh turn to finalize", () => chat().activePrompt === null);
	assert.deepEqual(chatState().messages, [
		"user:Old question", "assistant:Old answer", "user:Draw a dog", "assistant:Dog+data-widget-loading", notice,
	]);
});

// ── The cut-short wait across effect cleanup ──────────────────────────────

async function expectNoticeThenQueue(server, chat, notice) {
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.equal(chat().activePrompt?.text, "Then a dog");
	assert.deepEqual(chatState().messages.slice(0, 3), ["user:Draw a cat", "assistant:Drawing+data-widget-loading", notice]);
	assert.equal(chatState().messages.filter((message) => message === notice).length, 1);
}

// Regression: the wait's timer started inside the request callback, so hiding
// the provider through <Activity> (which cleans up its effects, as retained
// views do) cancelled it and showing it again did not start it, leaving the
// prompt active and the queue blocked for good. The turn now keeps when its
// wait ends, and an effect arms the timer from that.
test("a cut-short wait hidden through Activity and shown again ends with the time it had left, then shows the notice and advances the queue", async (t) => {
	const { harness, server, chat, timeouts, notice, setHidden } = await startCutShortMediaWait(t);
	await setHidden(true);
	await settle(20);
	assert.equal(timeouts.cutShort.live(), 0);
	await setHidden(false);
	await settle(20);
	assert.equal(chat().activePrompt?.text, "Draw a cat");
	assert.equal(server.turns.length, 1);
	assert.equal(timeouts.cutShort.live(), 1);
	assert.ok(timeouts.cutShort.delays().at(-1) <= harness.CUT_SHORT_MEDIA_WAIT_MS);

	await timeouts.cutShort.fireLive();
	await expectNoticeThenQueue(server, chat, notice);
});

test("a cut-short wait whose end passed while hidden through Activity ends as soon as it is shown again", async (t) => {
	const { harness, server, chat, notice, setHidden } = await startCutShortMediaWait(t);
	await setHidden(true);
	await settle(20);
	const realNow = Date.now;
	Date.now = () => realNow() + harness.CUT_SHORT_MEDIA_WAIT_MS + 1;
	t.after(() => {
		Date.now = realNow;
	});
	await setHidden(false);
	await expectNoticeThenQueue(server, chat, notice);
});

test("under StrictMode a cut-short turn's media wait runs once, then shows the notice and advances the queue", async (t) => {
	const { server, chat, timeouts, notice } = await startCutShortMediaWait(t, { strict: true });
	assert.equal(timeouts.cutShort.live(), 1);
	await timeouts.cutShort.fireLive();
	await expectNoticeThenQueue(server, chat, notice);
	assert.equal(timeouts.cutShort.live(), 0);
});

// Regression: selecting a thread reset the turn before knowing the transcript
// would be replaced, so selecting the thread already shown dropped the pending
// notice for good.
test("selecting the thread already shown during a cut-short wait leaves the wait, its notice and the queue in place", async (t) => {
	const { server, chat, timeouts, notice, departingThreadId } = await startCutShortMediaWait(t);
	await (await startAction(() => chat().selectThread(departingThreadId)))();
	await settle(20);
	assert.equal(chat().activeThreadId, departingThreadId);
	assert.equal(chat().activePrompt?.text, "Draw a cat");
	assert.deepEqual(chat().queuedPrompts.map((prompt) => prompt.text), ["Then a dog"]);

	await timeouts.cutShort.fireLive();
	await expectNoticeThenQueue(server, chat, notice);
});

// Regression: a thread change reset the departing turn before awaiting the
// stop and detach, so a selection superseded in that window left the old
// transcript shown with its wait, notice and queue gone for good.
const SUPERSEDING_SELECTIONS = [
	{
		name: "a selection whose fetch fails",
		run: async (chat) => {
			window.testApi.failingThreadIds = new Set(["broken-thread"]);
			await assert.rejects((await startAction(() => chat().selectThread("broken-thread")))(), /Thread fetch failed/);
		},
	},
	{ name: "re-selecting the departing thread", run: async (chat, threadId) => (await startAction(() => chat().selectThread(threadId)))() },
];

for (const superseding of SUPERSEDING_SELECTIONS) {
	test(`${superseding.name} while a switch detaches the departing run keeps the cut-short wait, its notice and the queue`, async (t) => {
		const { server, chat, timeouts, notice, departingThreadId } = await startCutShortMediaWait(t);
		const detach = holdDetach();
		const switching = await startAction(() => chat().selectThread(STORED_THREAD.id));
		await waitFor("the stop phase to reach the detach", () => detach.reached(departingThreadId));
		await superseding.run(chat, departingThreadId);
		await detach.open();
		await switching();
		await settle(20);
		assert.equal(chat().activeThreadId, departingThreadId);
		assert.equal(chat().activePrompt?.text, "Draw a cat");
		assert.deepEqual(chat().queuedPrompts.map((prompt) => prompt.text), ["Then a dog"]);

		await timeouts.cutShort.fireLive();
		await expectNoticeThenQueue(server, chat, notice);
		assert.equal(server.turns[1].body.id, departingThreadId);
	});
}

// Ends the departing request, then starts a switch to the stored thread while
// React still holds the commit of the idle status: the switch's stop phase runs
// after the request's onFinish but reads a streaming flag that is still true.
// When `superseded`, a selection whose fetch fails supersedes the switch while
// it detaches the departing run.
async function switchAfterFinishBeforeIdleCommits({ chat, turn, departingThreadId }, { superseded }) {
	const detach = holdDetach();
	let switched = false;
	await withCommitsHeld(async () => {
		turn.end();
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.equal(chat().isStreaming, true);
		void chat().selectThread(STORED_THREAD.id).then(() => { switched = true; });
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
	await waitFor("the stop phase to reach the detach", () => detach.reached(departingThreadId));
	if (superseded) {
		window.testApi.failingThreadIds = new Set(["broken-thread"]);
		await assert.rejects((await startAction(() => chat().selectThread("broken-thread")))(), /Thread fetch failed/);
	}
	await detach.open();
	await waitFor("the switch to settle", () => switched);
	await settle(20);
}

// Regression: the stop phase took the committed streaming flag, still true for
// a moment after the request finished, for a live request and ended the
// cut-short turn as a Stop: the superseded switch then left the old thread
// without its wait and notice, and the queue went out at once.
test("a cut-short request's switch started before its idle status commits, then superseded, keeps the wait, then shows the notice and advances the queue", async (t) => {
	const started = await startStreamingTurn(t);
	const { server, chat, timeouts, notice, departingThreadId } = started;
	await switchAfterFinishBeforeIdleCommits(started, { superseded: true });
	assert.equal(chat().activeThreadId, departingThreadId);
	assert.equal(chat().activePrompt?.text, "Draw a cat");
	assert.deepEqual(chat().queuedPrompts.map((prompt) => prompt.text), ["Then a dog"]);
	assert.equal(server.turns.length, 1);
	// The wait armed once, from the finish, and was never cleared or armed again.
	assert.equal(timeouts.cutShort.count(), 1);
	assert.equal(timeouts.cutShort.live(), 1);

	await timeouts.cutShort.fireLive();
	await expectNoticeThenQueue(server, chat, notice);
	assert.equal(server.turns[1].body.id, departingThreadId);
});

test("a cut-short request's switch started before its idle status commits clears the old turn at its commit point, and nothing lands on the new thread", async (t) => {
	const started = await startStreamingTurn(t);
	const { server, chat, timeouts, notice } = started;
	await switchAfterFinishBeforeIdleCommits(started, { superseded: false });
	const stored = ["user:Old question", "assistant:Old answer"];
	assert.equal(chat().activeThreadId, STORED_THREAD.id);
	assert.deepEqual(chatState().messages, stored);
	assert.equal(chat().activePrompt, null);
	assert.deepEqual(chat().queuedPrompts, []);
	assert.equal(chat().isMediaGenerating, false);
	assert.equal(timeouts.cutShort.live(), 0);

	// Any wait the departing turn armed runs out on the new transcript: nothing happens.
	for (let index = 0; index < timeouts.cutShort.count(); index += 1) {
		await timeouts.cutShort.fire(index);
	}
	await settle(20);
	assert.deepEqual(chatState().messages, stored);
	assert.equal(chatState().messages.includes(notice), false);
	assert.equal(server.turns.length, 1);
});

test("a completed request's switch started before its idle status commits, then superseded, finalizes the turn once with no notice, and the queue goes out on the old thread", async (t) => {
	const started = await startStreamingTurn(t, { completed: true });
	const { server, chat, notice, departingThreadId } = started;
	await switchAfterFinishBeforeIdleCommits(started, { superseded: true });
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.equal(chat().activeThreadId, departingThreadId);
	assert.equal(server.turns[1].body.id, departingThreadId);
	assert.equal(chat().activePrompt?.text, "Then a dog");
	assert.deepEqual(chatState().messages.slice(0, 3), ["user:Draw a cat", "assistant:A cat+data-turn-complete", "user:Then a dog"]);
	assert.equal(chatState().messages.includes(notice), false);
	await settle(40);
	assert.equal(server.turns.length, 2);
});

test("a completed request's switch started before its idle status commits clears the old turn at its commit point, and nothing lands on the new thread", async (t) => {
	const started = await startStreamingTurn(t, { completed: true });
	const { server, chat, notice } = started;
	await switchAfterFinishBeforeIdleCommits(started, { superseded: false });
	assert.equal(chat().activeThreadId, STORED_THREAD.id);
	assert.deepEqual(chatState().messages, ["user:Old question", "assistant:Old answer"]);
	assert.equal(chatState().messages.includes(notice), false);
	assert.equal(chat().activePrompt, null);
	assert.deepEqual(chat().queuedPrompts, []);
	assert.equal(server.turns.length, 1);
});

// An edit resend (no active prompt, so no cut-short fact) leaves a media widget
// loading with "Then a dog" queued. A selection's held fetch resolves once the
// edit's request has finished cleanly, before its send settles, with commits
// held; when `superseded`, a failing selection supersedes it during the detach.
async function switchAsEditResendFinishes(t, { superseded }) {
	const { harness, server, chat } = await mountChat(t);
	const timeouts = captureMediaTimeouts(t, harness);
	window.testApi.threads.set(STORED_THREAD.id, structuredClone(STORED_THREAD));
	server.respondNext((turn) => { turn.turnComplete(); turn.end(); });
	await send(chat, "Original");
	await waitFor("the first turn to finalize", () => server.turns.length === 1 && chat().activePrompt === null && !chat().isStreaming);
	const departingThreadId = chat().activeThreadId;
	const editing = await startAction(() => chat().editMessage(chat().uiMessages[0].id, "Draw a cat"));
	await waitFor("the edit request", () => server.turns.length === 2);
	const editTurn = server.turns[1];
	editTurn.send({ type: "start" });
	editTurn.text("e", "Drawing");
	mediaLoading(editTurn, true);
	await waitFor("media generation to start", () => chat().isMediaGenerating);
	await send(chat, "Then a dog");
	const fetchGate = holdThreadFetchUntilRequestFinishes();
	const detach = holdDetach();
	const switching = await startAction(() => chat().selectThread(STORED_THREAD.id));
	await withCommitsHeld(async () => {
		editTurn.end();
		await waitForUncommitted("the stop phase to reach the detach", () => detach.reached(departingThreadId));
	});
	assert.equal(fetchGate.opened, true);
	if (superseded) await SUPERSEDING_SELECTIONS[0].run(chat); // A selection whose fetch fails.
	await detach.open();
	await switching();
	await editing();
	await settle(20);
	return { server, chat, timeouts, departingThreadId };
}

// Regression: the edit's request still counted as live there, so the stop phase
// cleared the media hold as a Stop does and the queue went out at once.
test("an edit resend that finished before its send settles keeps its media hold and queue through a superseded switch, until the media timeout", async (t) => {
	const { server, chat, timeouts, departingThreadId } = await switchAsEditResendFinishes(t, { superseded: true });
	assert.equal(chat().activeThreadId, departingThreadId);
	assert.deepEqual(chatState().messages, ["user:Draw a cat", "assistant:Drawing+data-widget-loading"]);
	assert.equal(chat().isMediaGenerating, true);
	assert.deepEqual(chatState().queued, ["Then a dog"]);
	assert.equal(server.turns.length, 2);

	await timeouts.full.fireLive();
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 3);
	assert.equal(chat().isMediaGenerating, false);
	assert.equal(chat().activePrompt?.text, "Then a dog");
	assert.equal(server.turns[2].body.id, departingThreadId);
});

test("an edit resend that finished before its send settles is cleared by its switch's commit point, and nothing lands on the new thread", async (t) => {
	const { server, chat, timeouts } = await switchAsEditResendFinishes(t, { superseded: false });
	const stored = ["user:Old question", "assistant:Old answer"];
	assert.equal(chat().activeThreadId, STORED_THREAD.id);
	assert.deepEqual(chatState().messages, stored);
	assert.equal(chat().isMediaGenerating, false);
	assert.deepEqual(chatState().queued, []);
	assert.equal(chat().activePrompt, null);

	// The departing reply's media timeout runs out on the new transcript: nothing happens.
	await timeouts.full.fireLatest();
	await settle(20);
	assert.deepEqual(chatState().messages, stored);
	assert.equal(server.turns.length, 2);
});

test("current behaviour: turn-complete finalizes the turn even while a media widget is still loading, and the queue advances", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	const timeouts = captureMediaTimeouts(t, harness);
	await send(chat, "Draw a cat");
	await waitFor("the request", () => server.turns.length === 1);
	await send(chat, "Then a dog");
	const [turn] = server.turns;
	turn.send({ type: "start" });
	mediaLoading(turn, true);
	await waitFor("media generation to start", () => chat().isMediaGenerating);
	turn.turnComplete();
	turn.end();
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.equal(chat().activePrompt?.text, "Then a dog");
	// A completed turn neither waits on media nor starts the cut-short wait, and shows no notice.
	assert.equal(timeouts.cutShort.count(), 0);
	assert.equal(chatState().messages.includes(`assistant:${harness.getIncompleteTurnUserMessage()}`), false);
});

// Regression: the loading-part scan used to read the latest assistant message
// wherever it was, so once the next prompt's user message landed it found the
// earlier turn's unfinished part and raised the flag again, and a next turn
// that was cut short then waited out the 120 s media timeout.
test("an earlier turn's unfinished media widget does not flag media generation for the next turn", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	await send(chat, "Draw a cat");
	await waitFor("the request", () => server.turns.length === 1);
	await send(chat, "Then a dog");
	mediaLoading(server.turns[0], true);
	await waitFor("media generation to start", () => chat().isMediaGenerating);
	server.turns[0].turnComplete();
	server.turns[0].end();
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	await settle(20);
	assert.equal(chat().isMediaGenerating, false);

	await send(chat, "Then a bird");
	await streamPartial(server, chat, 1, "A do");
	assert.equal(chat().isMediaGenerating, false);
	server.turns[1].end();
	await waitFor("the third prompt to dispatch", () => server.turns.length === 3);
	assert.equal(chat().activePrompt?.text, "Then a bird");
	assert.equal(chatState().messages.includes(`assistant:${harness.getIncompleteTurnUserMessage()}`), true);
});

test("resetChat clears media generation and the blocked queue", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Draw a cat");
	await waitFor("the request", () => server.turns.length === 1);
	await send(chat, "Then a dog");
	mediaLoading(server.turns[0], true);
	await waitFor("media generation to start", () => chat().isMediaGenerating);
	server.turns[0].end();
	await waitFor("the stream to end", () => !chat().isStreaming);

	await React.act(async () => {
		chat().resetChat();
	});
	await waitFor("the reset to settle", () => chat().activeThreadId === null);
	await settle(20);
	assert.deepEqual(chatState(), {
		streaming: false, submitPending: false, inFlight: false, active: null, queued: [], thread: null, messages: [],
	});
	assert.equal(chat().isMediaGenerating, false);
	assert.equal(server.turns.length, 1);
});

// ── Plan approval ─────────────────────────────────────────────────────────

const PLAN_WIDGET = Object.freeze({
	title: "Launch plan",
	markdown: "1. Draft\n2. Ship",
	tasks: [{ id: "task-1", label: "Draft" }, { id: "task-2", label: "Ship" }],
	agents: [],
	deferredToolCallId: "tool-plan-1",
});

function lastUserMessage(turn) {
	return turn.body.messages.findLast((message) => message.role === "user");
}

test("submitting a keep-planning decision sends the approval prompt with the approval body and plan metadata", async (t) => {
	const { server, chat } = await mountChat(t);
	await React.act(async () => {
		await chat().submitPlanApproval(PLAN_WIDGET, { decision: "continue-planning", customInstruction: "  add tests  " });
	});
	await waitFor("the approval request", () => server.turns.length === 1);
	const [turn] = server.turns;
	const user = lastUserMessage(turn);
	assert.equal(user.parts.find((part) => part.type === "text").text, [
		"I reviewed the plan and submitted an approval decision.",
		"Decision: No, keep planning.",
		"Additional instruction: add tests",
		"Use this approval to continue from the existing plan.",
	].join("\n"));
	assert.equal(user.metadata.source, "plan-approval-submit");
	assert.equal(user.metadata.planApprovalDecision, "continue-planning");
	assert.equal(typeof user.metadata.planApprovalPlanKey, "string");
	assert.deepEqual(turn.body.approval, {
		decision: "continue-planning",
		customInstruction: "add tests",
		planTitle: "Launch plan",
		planTasks: [],
		toolCallId: "tool-plan-1",
		deferredToolCallId: "tool-plan-1",
	});
	assert.equal(turn.body.deferredToolResponse, undefined);
	assert.equal(chat().activePrompt?.text.startsWith("I reviewed the plan"), true);
});

test("accepting a plan sends \"Accepted the plan.\" with the deferred tool response and no approval body", async (t) => {
	const { server, chat } = await mountChat(t);
	await React.act(async () => {
		await chat().submitPlanApproval(PLAN_WIDGET, { decision: "auto-accept" });
	});
	await waitFor("the accept request", () => server.turns.length === 1);
	const [turn] = server.turns;
	const user = lastUserMessage(turn);
	assert.equal(user.parts.find((part) => part.type === "text").text, "Accepted the plan.");
	assert.equal(user.metadata.planApprovalDecision, "auto-accept");
	assert.deepEqual(turn.body.deferredToolResponse, { tool_call_id: "tool-plan-1", result: "Accept." });
	assert.equal(turn.body.approval, undefined);
});

test("accepting a plan without a deferred tool call rejects and sends nothing", async (t) => {
	const { server, chat } = await mountChat(t);
	const { deferredToolCallId: _omitted, ...planWithoutToolCall } = PLAN_WIDGET;
	let failure = null;
	await React.act(async () => {
		try {
			await chat().acceptPlanReview(planWithoutToolCall);
		} catch (error) {
			failure = error;
		}
	});
	assert.match(String(failure?.message), /missing a deferred tool call/);
	await settle(30);
	assert.equal(server.turns.length, 0);
	assert.equal(chat().hasInFlightTurn, false);
	assert.deepEqual(chatState().queued, []);
});

test("a plan approval submitted while a turn streams queues behind it and dispatches after turn-complete", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Plan the launch");
	await waitFor("the request", () => server.turns.length === 1);
	await React.act(async () => {
		await chat().submitPlanApproval(PLAN_WIDGET, { decision: "auto-accept" });
	});
	assert.deepEqual(chatState().queued, ["Accepted the plan."]);
	server.turns[0].text("p", "Here is the plan");
	server.turns[0].turnComplete();
	server.turns[0].end();
	await waitFor("the approval to dispatch", () => server.turns.length === 2);
	assert.equal(server.turns[1].body.hasQueuedPrompts, false);
	assert.deepEqual(server.turns[1].body.deferredToolResponse, { tool_call_id: "tool-plan-1", result: "Accept." });
	assert.deepEqual(describeMessages(server.turns[1].body.messages), [
		"user:Plan the launch", "assistant:Here is the plan+data-turn-complete", "user:Accepted the plan.",
	]);
});

// ── Local turns ───────────────────────────────────────────────────────────

test("a local turn writes the user and assistant messages and creates a thread without a chat request", async (t) => {
	const { server, chat } = await mountChat(t);
	let applied;
	await React.act(async () => {
		applied = await chat().applyLocalTurn({ promptText: "Local hello", assistantParts: assistantText("Local reply") });
	});
	assert.equal(applied, true);
	assert.equal(server.turns.length, 0);
	assert.deepEqual(window.testApi.calls, ["createThread:Local hello"]);
	assert.equal(typeof chat().activeThreadId, "string");
	assert.deepEqual(chatState().messages, ["user:Local hello", "assistant:Local reply"]);
	assert.equal(chat().hasInFlightTurn, false);

	// The next network prompt continues the same thread with the local turn as history.
	await send(chat, "Network follow-up");
	await waitFor("the request", () => server.turns.length === 1);
	assert.equal(server.turns[0].body.id, chat().activeThreadId);
	assert.deepEqual(describeMessages(server.turns[0].body.messages), [
		"user:Local hello", "assistant:Local reply", "user:Network follow-up",
	]);
});

test("a local turn mid-stream stops the request without a backend cancel, drops queued prompts, and appends to the transcript", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Live");
	await waitFor("the request", () => server.turns.length === 1);
	await streamPartial(server, chat, 0, "Streaming");
	await send(chat, "Queued");
	let applied;
	const finished = await startAction(async () => {
		applied = await chat().applyLocalTurn({ promptText: "Local", assistantParts: assistantText("Done locally") });
	});
	await finished();
	await settle(30);
	assert.equal(applied, true);
	assert.equal(server.turns[0].aborted, true);
	assert.equal(server.turns.length, 1);
	assert.deepEqual(cancelRunCalls(), []);
	assert.deepEqual(chatState().queued, []);
	assert.equal(chat().activePrompt, null);
	assert.deepEqual(chatState().messages, ["user:Live", "assistant:Streaming", "user:Local", "assistant:Done locally"]);
	assert.equal(chat().hasInFlightTurn, false);
});

test("a local turn with replace history discards the previous transcript", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Old");
	await waitFor("the request", () => server.turns.length === 1);
	server.turns[0].text("o", "Old answer");
	server.turns[0].turnComplete();
	server.turns[0].end();
	await waitFor("the turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	await React.act(async () => {
		await chat().applyLocalTurn({ promptText: "Fresh", assistantParts: assistantText("Fresh reply"), history: "replace" });
	});
	assert.deepEqual(chatState().messages, ["user:Fresh", "assistant:Fresh reply"]);
});

test("sending a prompt during a delayed local turn supersedes it, and the prompt dispatches once it settles", async (t) => {
	const { server, chat } = await mountChat(t);
	let applied = "pending";
	const finished = await startAction(async () => {
		applied = await chat().applyLocalTurn({
			promptText: "Slow local",
			pendingAssistantParts: assistantText("Thinking"),
			assistantParts: assistantText("Slow reply"),
			delayMs: 5_000,
		});
	});
	await waitFor("the pending local reply", () => chatState().messages.at(-1) === "assistant:Thinking");
	await send(chat, "Interrupt");
	await finished();
	assert.equal(applied, false);
	await waitFor("the prompt to dispatch", () => server.turns.length === 1);
	assert.deepEqual(describeMessages(server.turns[0].body.messages), [
		"user:Slow local", "assistant:Thinking", "user:Interrupt",
	]);
	assert.equal(chat().activePrompt?.text, "Interrupt");
});

test("resetChat during a delayed local turn cancels it and leaves an empty session", async (t) => {
	const { server, chat } = await mountChat(t);
	let applied = "pending";
	const finished = await startAction(async () => {
		applied = await chat().applyLocalTurn({
			promptText: "Slow local",
			pendingAssistantParts: assistantText("Thinking"),
			assistantParts: assistantText("Slow reply"),
			delayMs: 5_000,
		});
	});
	await waitFor("the pending local reply", () => chatState().messages.at(-1) === "assistant:Thinking");
	await React.act(async () => {
		chat().resetChat();
	});
	await finished();
	await waitFor("the reset to settle", () => chat().activeThreadId === null);
	await settle(20);
	assert.equal(applied, false);
	assert.deepEqual(chatState().messages, []);
	assert.equal(server.turns.length, 0);
	assert.equal(chat().hasInFlightTurn, false);
});

test("staged local turns replace the pending reply stage by stage and can start a new assistant message", async (t) => {
	const { chat } = await mountChat(t);
	const seen = [];
	window.onTestChatRender = () => {
		const label = chatState().messages.join(" | ");
		if (seen.at(-1) !== label) seen.push(label);
	};
	let applied;
	await (await startAction(async () => {
		applied = await chat().applyLocalTurn({
			promptText: "Stages",
			pendingAssistantParts: assistantText("Step 0"),
			assistantParts: assistantText("Final"),
			assistantPartStages: [
				{ delayMs: 5, getAssistantParts: () => assistantText("Step 1") },
				{ delayMs: 5, getAssistantParts: () => assistantText("Second message"), startsNewAssistantMessage: true },
			],
		});
	}))();
	assert.equal(applied, true);
	assert.deepEqual(chatState().messages, ["user:Stages", "assistant:Step 1", "assistant:Second message"]);
	assert.ok(seen.includes("user:Stages | assistant:Step 0"), `pending stage never rendered: ${JSON.stringify(seen)}`);
});

// ── Edit ──────────────────────────────────────────────────────────────────

test("editing a message mid-stream drops queued prompts and resends only the edit", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Original");
	await waitFor("the request", () => server.turns.length === 1);
	await streamPartial(server, chat, 0, "Partial");
	await send(chat, "Queued");
	const userMessageId = chat().uiMessages[0].id;

	const editFinished = await startAction(() => chat().editMessage(userMessageId, "Edited"));
	await waitFor("the edit request", () => server.turns.length === 2);
	assert.equal(server.turns[0].aborted, true);
	assert.deepEqual(chatState().queued, []);
	assert.equal(chat().activePrompt, null);
	assert.equal(server.turns[1].body.hasQueuedPrompts, false);
	assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Edited"]);
	// The edit replaces the original message in place: same id, not a new message.
	assert.equal(server.turns[1].body.messages[0].id, userMessageId);
	assert.equal(chat().uiMessages[0].id, userMessageId);
	server.turns[1].text("e", "Edited answer");
	server.turns[1].turnComplete();
	server.turns[1].end();
	await editFinished();
	await waitFor("the edit stream to end", () => !chat().isStreaming);
	await settle(30);
	assert.equal(server.turns.length, 2, "the dropped prompt must not be sent");
	assert.equal(chat().hasInFlightTurn, false);
});

// After an edit resend there is no active prompt, so nothing but the media
// flag holds back a prompt queued during the edit's stream.
test("media generation alone holds back a prompt queued during an edit resend until Stop clears it", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Original");
	await waitFor("the request", () => server.turns.length === 1);
	server.turns[0].text("o", "Original answer");
	server.turns[0].turnComplete();
	server.turns[0].end();
	await waitFor("the first turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	const userMessageId = chat().uiMessages[0].id;

	const editFinished = await startAction(() => chat().editMessage(userMessageId, "Draw a cat"));
	await waitFor("the edit request", () => server.turns.length === 2);
	const editTurn = server.turns[1];
	editTurn.send({ type: "start" });
	mediaLoading(editTurn, true);
	await waitFor("media generation to start", () => chat().isMediaGenerating);
	await send(chat, "Then a dog");
	await waitFor("the prompt to queue", () => chatState().queued.length === 1);
	editTurn.turnComplete();
	editTurn.end();
	await editFinished();
	await waitFor("the edit stream to end", () => !chat().isStreaming);
	await settle(80);

	assert.equal(chat().activePrompt, null);
	assert.equal(chat().isMediaGenerating, true);
	assert.deepEqual(chatState().queued, ["Then a dog"]);
	assert.equal(server.turns.length, 2, "the queued prompt must not dispatch while media is still generating");

	await (await startAction(() => chat().stopStreaming()))();
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 3);
	assert.equal(chat().activePrompt?.text, "Then a dog");
});
