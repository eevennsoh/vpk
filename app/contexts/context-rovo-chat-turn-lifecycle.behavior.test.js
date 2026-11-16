// Characterization suite for the chat turn lifecycle owned by RovoChatProvider
// (SM-FE-15): submit, streaming, tool calls, error, cancel, retry and thread switch.
// Harness and fake network: ./rovo-chat-turn-test-harness.js.
const assert = require("node:assert/strict");
const test = require("node:test");
const {
	CANCEL_REQUEST_TIMEOUT_MS,
	RETRY_DELAY_MS,
	React,
	cancelRunCalls,
	chatState,
	describeMessages,
	mountChat,
	send,
	settle,
	startAction,
	streamPartial,
	waitFor,
} = require("./rovo-chat-turn-test-harness.js");

test("submit marks the turn pending, streams the reply, and settles only after turn-complete", async (t) => {
	const { server, chat } = await mountChat(t);
	const initial = chatState();
	assert.deepEqual(initial, {
		streaming: false, submitPending: false, inFlight: false, active: null, queued: [], thread: null, messages: [],
	});

	await send(chat, "  Hello there  ");
	await waitFor("the first request", () => server.turns.length === 1);
	const [turn] = server.turns;
	const threadId = chat().activeThreadId;
	assert.equal(typeof threadId, "string");
	assert.deepEqual(window.testApi.calls, ["createThread:Hello there"]);
	assert.equal(turn.body.id, threadId);
	assert.equal(turn.body.hasQueuedPrompts, false);
	assert.deepEqual(describeMessages(turn.body.messages), ["user:Hello there"]);
	await waitFor("streaming", () => chat().isStreaming);
	assert.equal(chat().activePrompt?.text, "Hello there");
	assert.equal(chat().hasInFlightTurn, true);

	turn.send({ type: "start" });
	turn.text("t1", "Hi!");
	await waitFor("streamed text", () => chatState().messages.at(-1) === "assistant:Hi!");
	assert.equal(chat().isStreaming, true);
	assert.equal(chat().isSubmitPending, false);

	turn.turnComplete();
	turn.end();
	await waitFor("the turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	assert.deepEqual(chatState(), {
		streaming: false,
		submitPending: false,
		inFlight: false,
		active: null,
		queued: [],
		thread: threadId,
		messages: ["user:Hello there", "assistant:Hi!+data-turn-complete"],
	});
});

// Regression (SM-FE-15): a stream that closed without turn-complete used to
// leave its prompt active, so the queue stayed blocked until reset, a thread
// switch or Stop.
test("a stream that ends without turn-complete finalizes the turn, keeps the partial reply with an error, and advances the queue", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	const incompleteText = `assistant:${harness.getIncompleteTurnUserMessage()}`;
	await send(chat, "First");
	await waitFor("the first request", () => server.turns.length === 1);
	await send(chat, "Second");
	assert.deepEqual(chatState().queued, ["Second"]);

	server.turns[0].text("t1", "Partial");
	server.turns[0].end();
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.equal(chat().activePrompt?.text, "Second");
	assert.deepEqual(chatState().queued, []);
	// The partial reply is real history; the error notice is display-only.
	assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:First", "assistant:Partial", "user:Second"]);
	assert.deepEqual(chatState().messages, ["user:First", "assistant:Partial", incompleteText, "user:Second"]);

	server.turns[1].text("t2", "Done");
	server.turns[1].turnComplete();
	server.turns[1].end();
	await waitFor("the second turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	assert.deepEqual(chatState().messages, [
		"user:First", "assistant:Partial", incompleteText,
		"user:Second", "assistant:Done+data-turn-complete",
	]);
	assert.equal(chat().hasInFlightTurn, false);
});

test("a lone stream that ends without turn-complete clears in-flight state", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	await send(chat, "Only");
	await waitFor("the request", () => server.turns.length === 1);
	server.turns[0].text("t1", "Half");
	server.turns[0].end();
	await waitFor("the turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	assert.equal(chat().hasInFlightTurn, false);
	assert.deepEqual(chatState().messages, ["user:Only", "assistant:Half", `assistant:${harness.getIncompleteTurnUserMessage()}`]);
});

test("prompts sent during a turn queue in order and dispatch after each turn-complete", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "One");
	await waitFor("the first request", () => server.turns.length === 1);
	await send(chat, "Two");
	await send(chat, "Three");
	assert.deepEqual(chatState().queued, ["Two", "Three"]);
	assert.equal(chat().queueCount, 2);

	server.turns[0].text("a", "Reply one");
	server.turns[0].turnComplete();
	server.turns[0].end();
	await waitFor("the second request", () => server.turns.length === 2);
	assert.equal(server.turns[1].body.hasQueuedPrompts, true);
	assert.deepEqual(chatState().queued, ["Three"]);
	assert.equal(chat().activePrompt?.text, "Two");

	server.turns[1].text("b", "Reply two");
	server.turns[1].turnComplete();
	server.turns[1].end();
	await waitFor("the third request", () => server.turns.length === 3);
	assert.equal(server.turns[2].body.hasQueuedPrompts, false);
	server.turns[2].text("c", "Reply three");
	server.turns[2].turnComplete();
	server.turns[2].end();
	await waitFor("the queue to drain", () => chat().activePrompt === null && !chat().isStreaming);
	assert.deepEqual(chatState().messages, [
		"user:One", "assistant:Reply one+data-turn-complete",
		"user:Two", "assistant:Reply two+data-turn-complete",
		"user:Three", "assistant:Reply three+data-turn-complete",
	]);
	assert.deepEqual(window.testApi.calls, ["createThread:One"]);
});

test("tool calls stream through input and output states on the assistant message", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Search for bugs");
	await waitFor("the request", () => server.turns.length === 1);
	const [turn] = server.turns;
	turn.send({ type: "start" });
	turn.send({ type: "tool-input-start", toolCallId: "call-1", toolName: "search" });
	await waitFor("tool input streaming", () => chatState().messages.at(-1) === "assistant:tool-search(input-streaming)");
	turn.send({ type: "tool-input-available", toolCallId: "call-1", toolName: "search", input: { query: "bugs" } });
	await waitFor("tool input", () => chatState().messages.at(-1) === "assistant:tool-search(input-available)");
	turn.send({ type: "tool-output-available", toolCallId: "call-1", output: { count: 3 } });
	await waitFor("tool output", () => chatState().messages.at(-1) === "assistant:tool-search(output-available)");
	const toolPart = chat().uiMessages.at(-1).parts.find((part) => part.type === "tool-search");
	assert.deepEqual({ input: toolPart.input, output: toolPart.output }, { input: { query: "bugs" }, output: { count: 3 } });
	assert.equal(chat().isStreaming, true);

	turn.text("t1", "Found 3 bugs.");
	turn.turnComplete();
	turn.end();
	await waitFor("the turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	assert.deepEqual(chatState().messages, [
		"user:Search for bugs",
		"assistant:tool-search(output-available)+Found 3 bugs.+data-turn-complete",
	]);
});

// Regression (SM-FE-15): the failed turn's error used to disappear as soon as
// the next queued prompt dispatched. It now stays attached to the failed turn.
test("a failed request finalizes and shows its error, which stays on the failed turn after the next queued prompt dispatches", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	const errorText = `assistant:${harness.toUserFacingChatErrorMessage("Upstream exploded")}`;
	let releaseFailure;
	server.failNext(500, "Upstream exploded", new Promise((resolve) => { releaseFailure = resolve; }));
	await send(chat, "Break please");
	await waitFor("the failing request", () => server.turns.length === 1);
	await send(chat, "Then this");
	assert.deepEqual(chatState().queued, ["Then this"]);

	// Record every committed render so the brief error state is observable even
	// though the queue dispatches the next prompt right after it.
	const renders = [];
	window.onTestChatRender = () => renders.push(chatState());
	await React.act(async () => releaseFailure());
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	const errorRender = renders.find((state) => state.messages.at(-1) === errorText);
	assert.ok(errorRender, `the error never rendered; renders: ${JSON.stringify(renders.map((state) => state.messages))}`);
	assert.deepEqual(errorRender.messages, ["user:Break please", errorText]);
	// The error showed while the next prompt was still waiting in the queue.
	assert.deepEqual(errorRender.queued, ["Then this"]);
	// The failed user message stays in the transcript and is resent as history.
	assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Break please", "user:Then this"]);
	// The error stays on the failed turn while the next prompt runs.
	assert.deepEqual(chatState().messages, ["user:Break please", errorText, "user:Then this"]);
	assert.equal(chat().activePrompt?.text, "Then this");

	server.turns[1].text("t", "Recovered");
	server.turns[1].turnComplete();
	server.turns[1].end();
	await waitFor("the second turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	assert.deepEqual(chatState().messages, [
		"user:Break please",
		errorText,
		"user:Then this",
		"assistant:Recovered+data-turn-complete",
	]);
});

test("a stream that errors mid-reply keeps the partial reply and shows the error after it", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	const errorText = `assistant:${harness.toUserFacingChatErrorMessage("Model crashed")}`;
	await send(chat, "Explain");
	await waitFor("the request", () => server.turns.length === 1);
	await send(chat, "Follow up");
	server.turns[0].send({ type: "start" });
	server.turns[0].send({ type: "text-start", id: "t" });
	server.turns[0].send({ type: "text-delta", id: "t", delta: "Half an answer" });
	await waitFor("partial text", () => chatState().messages.at(-1) === "assistant:Half an answer");
	server.turns[0].send({ type: "error", errorText: "Model crashed" });
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.deepEqual(chatState().messages, ["user:Explain", "assistant:Half an answer", errorText, "user:Follow up"]);
});

test("editing the failed message drops its error and resends it", async (t) => {
	const { server, chat } = await mountChat(t);
	server.failNext(500, "Nope");
	await send(chat, "Broken");
	await waitFor("the error to settle", () => server.turns.length === 1 && chat().activePrompt === null && !chat().isStreaming);
	assert.equal(chatState().messages.length, 2);
	const userMessageId = chat().uiMessages[0].id;

	await startAction(() => chat().editMessage(userMessageId, "Fixed"));
	await waitFor("the edit request", () => server.turns.length === 2);
	assert.deepEqual(chatState().messages, ["user:Fixed"]);
	server.turns[1].text("t", "Works");
	server.turns[1].turnComplete();
	server.turns[1].end();
	await waitFor("the edit stream to end", () => !chat().isStreaming);
	await settle(20);
	assert.deepEqual(chatState().messages, ["user:Fixed", "assistant:Works+data-turn-complete"]);
});

test("resetChat clears errors left on failed turns", async (t) => {
	const { server, chat } = await mountChat(t);
	server.failNext(500, "Nope");
	await send(chat, "Broken");
	await waitFor("the error to settle", () => server.turns.length === 1 && chat().activePrompt === null && !chat().isStreaming);
	assert.equal(chatState().messages.length, 2);
	await React.act(async () => {
		chat().resetChat();
	});
	await waitFor("the reset to settle", () => chat().activeThreadId === null);
	await settle(20);
	assert.deepEqual(chatState().messages, []);
});

test("selecting another thread clears errors left on failed turns", async (t) => {
	const { server, chat } = await mountChat(t);
	window.testApi.threads.set("stored-thread", {
		id: "stored-thread", title: "Stored",
		messages: [{ id: "s-u", role: "user", parts: [{ type: "text", text: "Old question" }] }],
		realtimeMessages: [], visibility: "private", activeDocumentId: null, createdAt: 0, updatedAt: 0,
	});
	server.failNext(500, "Nope");
	await send(chat, "Broken");
	await waitFor("the error to settle", () => server.turns.length === 1 && chat().activePrompt === null && !chat().isStreaming);
	assert.equal(chatState().messages.length, 2);
	await (await startAction(() => chat().selectThread("stored-thread")))();
	assert.deepEqual(chatState().messages, ["user:Old question"]);
});

test("deleting the active thread clears errors left on failed turns", async (t) => {
	const { server, chat } = await mountChat(t);
	server.failNext(500, "Nope");
	await send(chat, "Broken");
	await waitFor("the error to settle", () => server.turns.length === 1 && chat().activePrompt === null && !chat().isStreaming);
	assert.equal(chatState().messages.length, 2);
	await (await startAction(() => chat().deleteThread(chat().activeThreadId)))();
	await settle(20);
	assert.deepEqual(chatState().messages, []);
});

test("errors on failed turns are never saved with the thread", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	server.failNext(500, "Nope");
	await send(chat, "Broken");
	await waitFor("the error to settle", () => server.turns.length === 1 && chat().activePrompt === null && !chat().isStreaming);
	const threadId = chat().activeThreadId;
	assert.deepEqual(chatState().messages, ["user:Broken", `assistant:${harness.toUserFacingChatErrorMessage("Nope")}`]);
	await waitFor("the thread to be saved", () => (window.testApi.threads.get(threadId)?.messages ?? []).length > 0, 3000);
	assert.deepEqual(describeMessages(window.testApi.threads.get(threadId).messages), ["user:Broken"]);
});

test("a payload-too-large error shows its own copy, finalizes the prompt, and releases the queue", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	const errorText = `assistant:${harness.getPayloadTooLargeUserMessage()}`;
	let releaseFailure;
	server.failNext(413, "Request Entity Too Large", new Promise((resolve) => { releaseFailure = resolve; }));
	await send(chat, "Huge prompt");
	await waitFor("the failing request", () => server.turns.length === 1);
	await send(chat, "Small follow-up");
	const renders = [];
	window.onTestChatRender = () => renders.push(chatState());
	await React.act(async () => releaseFailure());
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	const errorRender = renders.find((state) => state.messages.at(-1) === errorText);
	assert.ok(errorRender, `the payload error never rendered; renders: ${JSON.stringify(renders.map((state) => state.messages))}`);
	assert.deepEqual(errorRender.queued, ["Small follow-up"]);
	assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Huge prompt", "user:Small follow-up"]);
	assert.equal(chat().activePrompt?.text, "Small follow-up");
});

test("a payload-too-large error with nothing queued keeps its copy visible and clears in-flight state", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	server.failNext(413, "Request Entity Too Large");
	await send(chat, "Huge prompt");
	await waitFor("the error to settle", () => server.turns.length === 1 && chat().activePrompt === null && !chat().isStreaming);
	assert.deepEqual(chatState().messages, ["user:Huge prompt", `assistant:${harness.getPayloadTooLargeUserMessage()}`]);
	assert.equal(chat().hasInFlightTurn, false);
});

test("a failed request with nothing queued clears pending state and keeps the error visible", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	server.failNext(500, "Nope");
	await send(chat, "Only prompt");
	await waitFor("the error to settle", () => server.turns.length === 1 && chat().activePrompt === null && !chat().isStreaming);
	assert.deepEqual(chatState(), {
		streaming: false,
		submitPending: false,
		inFlight: false,
		active: null,
		queued: [],
		thread: chat().activeThreadId,
		messages: ["user:Only prompt", `assistant:${harness.toUserFacingChatErrorMessage("Nope")}`],
	});
});

test("stopStreaming aborts the live request, keeps the partial reply, and releases the queue", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Long answer");
	await waitFor("the request", () => server.turns.length === 1);
	server.turns[0].send({ type: "start" });
	server.turns[0].send({ type: "text-start", id: "t" });
	server.turns[0].send({ type: "text-delta", id: "t", delta: "Partial" });
	await waitFor("partial text", () => chatState().messages.at(-1) === "assistant:Partial");
	await send(chat, "Next");

	await (await startAction(() => chat().stopStreaming()))();
	assert.equal(server.turns[0].aborted, true);
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Long answer", "assistant:Partial", "user:Next"]);
	// A user Stop always cancels the backend run for the thread, once.
	assert.deepEqual(window.testApi.calls.filter((call) => call.startsWith("cancelRun:")), [`cancelRun:${chat().activeThreadId}`]);
	assert.equal(chat().activePrompt?.text, "Next");
	// A stopped turn is not an incomplete reply.
	assert.equal(chatState().messages.some((label) => label.includes("ended before it finished")), false);
});

// Regression (SM-FE-15): AI SDK `stop()` settles the chat status locally as soon
// as it aborts, even when the backend never closes the response, so the grace
// window always reported "stopped in time" and stopStreaming never reached the
// explicit cancel (cancelRovoAppRun / chat-cancel). Stop now cancels directly.
test("stopStreaming cancels the backend run even when the backend ignores the abort", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Stuck answer");
	await waitFor("the request", () => server.turns.length === 1);
	const [turn] = server.turns;
	turn.ignoreAbort = true;
	turn.send({ type: "start" });
	turn.send({ type: "text-start", id: "t" });
	turn.send({ type: "text-delta", id: "t", delta: "Stuck" });
	await waitFor("partial text", () => chatState().messages.at(-1) === "assistant:Stuck");

	const startedAt = Date.now();
	await (await startAction(() => chat().stopStreaming()))();
	assert.equal(turn.aborted, true);
	assert.equal(chat().isStreaming, false);
	assert.ok(Date.now() - startedAt < 1000, "stopStreaming waited for the grace window");
	assert.deepEqual(window.testApi.calls.filter((call) => call.startsWith("cancelRun:")), [`cancelRun:${chat().activeThreadId}`]);
	assert.deepEqual(chatState().messages, ["user:Stuck answer", "assistant:Stuck"]);
	turn.end();
});

test("pressing Stop twice on one turn cancels the backend once", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Answer");
	await waitFor("the request", () => server.turns.length === 1);
	await streamPartial(server, chat, 0, "Part");
	let firstFinished;
	let secondFinished;
	await React.act(async () => {
		firstFinished = await startAction(() => chat().stopStreaming());
		secondFinished = await startAction(() => chat().stopStreaming());
	});
	await firstFinished();
	await secondFinished();
	await settle(20);
	assert.deepEqual(cancelRunCalls(), [`cancelRun:${chat().activeThreadId}`]);
});

// Review regression: the per-thread debounce used to swallow a Stop on the next
// turn in the same thread within 2 s, leaving that backend run alive.
test("Stop, send, then Stop again in the same thread cancels both turns", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "First");
	await waitFor("the first request", () => server.turns.length === 1);
	await streamPartial(server, chat, 0, "One");
	await (await startAction(() => chat().stopStreaming()))();

	await send(chat, "Second");
	await waitFor("the second request", () => server.turns.length === 2);
	await streamPartial(server, chat, 1, "Two");
	await (await startAction(() => chat().stopStreaming()))();
	const threadId = chat().activeThreadId;
	assert.deepEqual(cancelRunCalls(), [`cancelRun:${threadId}`, `cancelRun:${threadId}`]);
});

// The transcript owner (session activation, local turns) stops the stream but
// cancels the backend only when the stop does not settle in time.
test("activating a session mid-stream stops the request without a backend cancel", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Live");
	await waitFor("the request", () => server.turns.length === 1);
	await streamPartial(server, chat, 0, "Streaming");
	await (await startAction(() => chat().activateSession({ messages: [], threadId: null })))();
	assert.equal(server.turns[0].aborted, true);
	assert.deepEqual(cancelRunCalls(), []);
	assert.equal(server.otherRequests.some((url) => url.includes("/api/chat-cancel")), false);
});

// Review regression: a Stop that arrived while an ordinary cancel was in flight
// waited on it and returned, so the backend was never cancelled.
test("Stop during an ordinary cancel still cancels the backend run", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Live");
	await waitFor("the request", () => server.turns.length === 1);
	await streamPartial(server, chat, 0, "Streaming");
	const threadId = chat().activeThreadId;
	let activateFinished;
	let stopFinished;
	await React.act(async () => {
		activateFinished = await startAction(() => chat().activateSession({ messages: [], threadId: null }));
		stopFinished = await startAction(() => chat().stopStreaming());
	});
	await activateFinished();
	await stopFinished();
	assert.deepEqual(cancelRunCalls(), [`cancelRun:${threadId}`]);
});

test("Stop waits for a slow backend cancel only up to its limit, then releases the queue", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Slow cancel");
	await waitFor("the request", () => server.turns.length === 1);
	await streamPartial(server, chat, 0, "Partial");
	await send(chat, "Next");
	window.testApi.hangCancel = true;
	const startedAt = Date.now();
	await (await startAction(() => chat().stopStreaming()))();
	const elapsed = Date.now() - startedAt;
	assert.ok(elapsed >= CANCEL_REQUEST_TIMEOUT_MS - 20, `Stop returned before the cancel limit (${elapsed} ms)`);
	assert.ok(elapsed < 1000, `Stop waited ${elapsed} ms for a hung cancel`);
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.equal(chat().activePrompt?.text, "Next");
});

test("stopStreaming with no live stream is a no-op that leaves the transcript intact", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Done turn");
	await waitFor("the request", () => server.turns.length === 1);
	server.turns[0].text("t", "Answer");
	server.turns[0].turnComplete();
	server.turns[0].end();
	await waitFor("the turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	const before = chatState();
	await (await startAction(() => chat().stopStreaming()))();
	await settle(20);
	assert.deepEqual(chatState(), before);
	assert.equal(server.turns.length, 1);
});

test("a rate-limited request shows a countdown, retries the same prompt once, and replaces the user message", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	server.failNext(429, "Too many requests");
	await send(chat, "Busy prompt");
	await waitFor("the countdown", () => chatState().messages.at(-1)?.startsWith("assistant:I'm experiencing high demand"));
	assert.equal(chatState().messages.at(-1), `assistant:${harness.getRateLimitRetryCountdownMessage(1)}`);
	assert.equal(chat().activePrompt?.text, "Busy prompt");
	assert.equal(chat().hasInFlightTurn, true);

	await waitFor("the retry request", () => server.turns.length === 2);
	assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Busy prompt"]);
	server.turns[1].text("t", "Here you go");
	server.turns[1].turnComplete();
	server.turns[1].end();
	await waitFor("the retried turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	assert.deepEqual(chatState().messages, ["user:Busy prompt", "assistant:Here you go+data-turn-complete"]);
});

test("rate-limit retries stop after the maximum and show the give-up message", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	for (let attempt = 0; attempt <= harness.RATE_LIMIT_MAX_RETRIES; attempt += 1) {
		server.failNext(429, "rate limit");
	}
	await send(chat, "Keep trying");
	await waitFor("the give-up message", () => chat().activePrompt === null && server.turns.length === harness.RATE_LIMIT_MAX_RETRIES + 1);
	await settle(RETRY_DELAY_MS * 2);
	assert.equal(server.turns.length, harness.RATE_LIMIT_MAX_RETRIES + 1);
	assert.deepEqual(chatState().messages, [
		"user:Keep trying",
		`assistant:${harness.getRateLimitUserMessage(harness.RATE_LIMIT_MAX_RETRIES)}`,
	]);
	assert.equal(chat().hasInFlightTurn, false);
});

// onError and onFinish both run on the give-up attempt; the error must stay on
// its own turn once the next queued prompt dispatches.
test("a rate-limit give-up error stays on its turn after the next queued prompt dispatches", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	for (let attempt = 0; attempt <= harness.RATE_LIMIT_MAX_RETRIES; attempt += 1) {
		server.failNext(429, "rate limit");
	}
	await send(chat, "Keep trying");
	await waitFor("the first request", () => server.turns.length === 1);
	await send(chat, "After that");
	await waitFor("the queued prompt to dispatch", () => server.turns.length === harness.RATE_LIMIT_MAX_RETRIES + 2);
	assert.equal(chat().activePrompt?.text, "After that");
	assert.deepEqual(chatState().messages, [
		"user:Keep trying",
		`assistant:${harness.getRateLimitUserMessage(harness.RATE_LIMIT_MAX_RETRIES)}`,
		"user:After that",
	]);
});

test("a chat-in-progress error shows a thinking countdown, keeps submit pending, then retries", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	server.failNext(409, "ROVO_CHAT_IN_PROGRESS");
	await send(chat, "Overlap");
	await waitFor("the recovery status", () => chatState().messages.at(-1) === "assistant:data-thinking-status");
	const statusPart = chat().uiMessages.at(-1).parts.find((part) => part.type === "data-thinking-status");
	assert.equal(statusPart.data.label, harness.getChatInProgressRetryCountdownLabel(1));
	assert.equal(chat().isSubmitPending, true);

	await waitFor("the retry request", () => server.turns.length === 2);
	server.turns[1].text("t", "Recovered");
	server.turns[1].turnComplete();
	server.turns[1].end();
	await waitFor("the retried turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	assert.deepEqual(chatState().messages, ["user:Overlap", "assistant:Recovered+data-turn-complete"]);
	assert.equal(chat().isSubmitPending, false);
});

test("chat-in-progress retries stop after the maximum and show the give-up message", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	for (let attempt = 0; attempt <= harness.CHAT_IN_PROGRESS_MAX_RETRIES; attempt += 1) {
		server.failNext(409, "ROVO_CHAT_IN_PROGRESS");
	}
	await send(chat, "Still overlapping");
	await waitFor("the give-up message", () => chat().activePrompt === null && server.turns.length === harness.CHAT_IN_PROGRESS_MAX_RETRIES + 1);
	await settle(RETRY_DELAY_MS * 2);
	assert.equal(server.turns.length, harness.CHAT_IN_PROGRESS_MAX_RETRIES + 1);
	assert.deepEqual(chatState().messages, [
		"user:Still overlapping",
		`assistant:${harness.getChatInProgressUserMessage(harness.CHAT_IN_PROGRESS_MAX_RETRIES)}`,
	]);
	assert.equal(chat().hasInFlightTurn, false);
	assert.equal(chat().isSubmitPending, false);
});

test("selecting another thread mid-stream detaches the run and replaces the transcript", async (t) => {
	const { server, chat } = await mountChat(t);
	window.testApi.threads.set("stored-thread", {
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
	await send(chat, "Live question");
	await waitFor("the request", () => server.turns.length === 1);
	const liveThreadId = chat().activeThreadId;
	server.turns[0].send({ type: "start" });
	server.turns[0].send({ type: "text-start", id: "t" });
	server.turns[0].send({ type: "text-delta", id: "t", delta: "Streaming" });
	await waitFor("partial text", () => chatState().messages.at(-1) === "assistant:Streaming");

	await (await startAction(() => chat().selectThread("stored-thread")))();
	assert.equal(server.turns[0].aborted, true);
	assert.equal(window.testApi.calls.includes(`detachRun:${liveThreadId}`), true);
	assert.equal(chat().activeThreadId, "stored-thread");
	assert.equal(chat().currentThread?.id, "stored-thread");
	assert.equal(chat().isStreaming, false);
	assert.deepEqual(chatState().messages, ["user:Old question", "assistant:Old answer"]);
});

test("selecting a thread that no longer exists clears the transcript and active thread", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Something");
	await waitFor("the request", () => server.turns.length === 1);
	server.turns[0].text("t", "Reply");
	server.turns[0].turnComplete();
	server.turns[0].end();
	await waitFor("the turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);

	await (await startAction(() => chat().selectThread("missing-thread")))();
	assert.equal(chat().activeThreadId, null);
	assert.deepEqual(chatState().messages, []);
});

test("resetChat mid-stream drops queued prompts, aborts the run and starts a fresh session", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Before reset");
	await waitFor("the request", () => server.turns.length === 1);
	const liveThreadId = chat().activeThreadId;
	server.turns[0].send({ type: "start" });
	server.turns[0].send({ type: "text-start", id: "t" });
	server.turns[0].send({ type: "text-delta", id: "t", delta: "Mid" });
	await waitFor("partial text", () => chatState().messages.at(-1) === "assistant:Mid");
	await send(chat, "Dropped");

	await React.act(async () => {
		chat().resetChat();
	});
	await waitFor("the reset to settle", () => chat().activeThreadId === null && !chat().isStreaming);
	await settle(20);
	assert.equal(server.turns[0].aborted, true);
	assert.equal(window.testApi.calls.includes(`detachRun:${liveThreadId}`), true);
	assert.equal(server.turns.length, 1);
	assert.deepEqual(chatState(), {
		streaming: false, submitPending: false, inFlight: false, active: null, queued: [], thread: null, messages: [],
	});

	await send(chat, "After reset");
	await waitFor("a fresh request", () => server.turns.length === 2);
	assert.notEqual(chat().activeThreadId, liveThreadId);
	assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:After reset"]);
});

test("editing a user message resends it in place with the same message id", async (t) => {
	const { server, chat } = await mountChat(t);
	await send(chat, "Original");
	await waitFor("the request", () => server.turns.length === 1);
	server.turns[0].text("t", "First answer");
	server.turns[0].turnComplete();
	server.turns[0].end();
	await waitFor("the turn to finalize", () => chat().activePrompt === null && !chat().isStreaming);
	const userMessageId = chat().uiMessages[0].id;

	const editFinished = await startAction(() => chat().editMessage(userMessageId, "Edited"));
	await waitFor("the edit request", () => server.turns.length === 2);
	assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Edited"]);
	assert.equal(server.turns[1].body.messages[0].id, userMessageId);
	server.turns[1].text("t2", "Second answer");
	server.turns[1].turnComplete();
	server.turns[1].end();
	await editFinished();
	await waitFor("the edit stream to end", () => !chat().isStreaming);
	await settle(20);
	assert.deepEqual(chatState().messages, ["user:Edited", "assistant:Second answer+data-turn-complete"]);
	assert.equal(chat().isSubmitPending, false);
});
