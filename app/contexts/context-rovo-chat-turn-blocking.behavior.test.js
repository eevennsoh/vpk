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
	chatState,
	describeMessages,
	mountChat,
	send,
	settle,
	startAction,
	streamPartial,
	waitFor,
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

	await (await startAction(() => chat().stopStreaming()))();
	await waitFor("the queued prompt to dispatch", () => server.turns.length === 2);
	assert.equal(chat().activePrompt?.text, "Then a dog");
	// The user ended the turn with Stop, so no cut-short notice follows it.
	assert.equal(chatState().messages.includes(`assistant:${harness.getIncompleteTurnUserMessage()}`), false);
	// No stream was live, so Stop sent no backend cancel.
	assert.deepEqual(cancelRunCalls(), []);
});

// Captures the provider's media-generation timeout instead of scheduling it, so
// a test can release it without waiting 120 s or mocking the harness's own timers.
function captureMediaTimeout(t, timeoutMs) {
	const captured = [];
	const originalSetTimeout = globalThis.setTimeout;
	const originalWindowSetTimeout = window.setTimeout;
	const capture = (schedule) => (callback, delay, ...args) => {
		if (delay === timeoutMs) {
			captured.push(callback);
			return schedule(() => {}, 0);
		}
		return schedule(callback, delay, ...args);
	};
	globalThis.setTimeout = capture(originalSetTimeout);
	window.setTimeout = capture(originalWindowSetTimeout.bind(window));
	t.after(() => {
		globalThis.setTimeout = originalSetTimeout;
		window.setTimeout = originalWindowSetTimeout;
	});
	return {
		count: () => captured.length,
		fireLatest: () => React.act(async () => {
			captured.at(-1)();
		}),
	};
}

test("a cut-short turn whose media widget is still loading shows the notice once the media timeout releases it, then advances the queue", async (t) => {
	const { harness, server, chat } = await mountChat(t);
	const mediaTimeout = captureMediaTimeout(t, harness.MEDIA_GENERATION_TIMEOUT_MS);
	await send(chat, "Draw a cat");
	await waitFor("the request", () => server.turns.length === 1);
	await send(chat, "Then a dog");
	const [turn] = server.turns;
	turn.send({ type: "start" });
	mediaLoading(turn, true);
	await waitFor("media generation to start", () => chat().isMediaGenerating);
	turn.end();
	await waitFor("the stream to end", () => !chat().isStreaming);
	await settle(40);
	assert.equal(server.turns.length, 1);
	assert.equal(chatState().messages.includes(`assistant:${harness.getIncompleteTurnUserMessage()}`), false);
	assert.equal(mediaTimeout.count(), 1);

	await mediaTimeout.fireLatest();
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

test("current behaviour: turn-complete finalizes the turn even while a media widget is still loading, and the queue advances", async (t) => {
	const { server, chat } = await mountChat(t);
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
