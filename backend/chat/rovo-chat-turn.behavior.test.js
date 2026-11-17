"use strict";

// How a Rovo chat turn ends today: one test per ending, driven through the composed turn runner
// with a stand-in Rovo stream. The end-of-turn facts are read from the routing telemetry, which
// receives the turn's flags after the stream.

const assert = require("node:assert/strict");
const { before, test } = require("node:test");
const { loadAiSdk } = require("../lib/ai-sdk-runtime");
const { createRovoTurnRunner } = require("./rovo-chat-stream");
const { createContractDependencies, createRequestState } = require("./chat-sdk-handler.fixture");

before(async () => { await loadAiSdk(); });

const STRICT_SOFT_RETRY_TURN = {
	isStrictToolFirstTurn: true,
	toolFirstPolicy: {
		domains: ["jira"],
		relevanceDomains: ["jira"],
		enforcement: { mode: "soft-retry", maxRelevantRetries: 2, retryBackoffMs: [0, 0] },
	},
};

function createTurn(overrides = {}) {
	return {
		...createRequestState({ backendPreference: "rovo" }),
		isStrictToolFirstTurn: false,
		isTaskLikeRequest: false,
		prefersGenuiCardExperience: false,
		smartGenerationActive: false,
		stageTrace: { mark() {}, requestId: "request-1" },
		toolFirstPolicy: { domains: [], enforcement: {}, relevanceDomains: [] },
		userMessageText: "Hello",
		...overrides,
	};
}

function createPortStuckError(port) {
	return Object.assign(new Error(`Rovo port ${port} is stuck`), { code: "ROVO_PORT_STUCK", port });
}

async function runTurn(dependencyOverrides = {}, turnOverrides = {}, signal = new AbortController().signal) {
	const parts = [];
	const attempts = [];
	let endOfTurnFacts = null;
	const { dependencies } = createContractDependencies({
		buildRovoTurnRoutingTelemetry: (facts) => {
			endOfTurnFacts = facts;
			return facts;
		},
		recordToolFirstAttempt: (_state, { isRetry }) => attempts.push(isRetry ? "retry" : "first"),
		...dependencyOverrides,
	});
	let result;
	let error;
	try {
		result = await createRovoTurnRunner(dependencies)(createTurn(turnOverrides), {
			signal,
			emit: (part) => parts.push(part),
		});
	} catch (caught) {
		error = caught;
	}
	return { activeRequests: dependencies.activeRequests, attempts, endOfTurnFacts, error, parts, result };
}

function visibleText(parts) {
	return parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join("");
}

function statusLabels(parts) {
	return parts.filter((part) => part.type === "data-thinking-status").map((part) => part.data.label);
}

function widgetParts(parts, type) {
	return parts.filter((part) => part.data?.type === type).map((part) =>
		part.type === "data-widget-loading" ? `loading:${part.data.loading}` : part.type.replace(/^data-widget-/u, ""),
	);
}

function endsWithTurnComplete(parts) {
	return parts.at(-1)?.type === "data-turn-complete";
}

test("an aborted turn closes its text, keeps what was shown and writes no turn-complete", async () => {
	const viewer = new AbortController();
	const turn = await runTurn({
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			onPortAcquired(43123);
			onTextDelta("Partial answer");
			viewer.abort("viewer left");
		},
	}, {}, viewer.signal);

	assert.equal(turn.result.aborted, true);
	assert.equal(visibleText(turn.parts), "Partial answer");
	assert.equal(turn.parts.at(-1).type, "text-end");
	assert.equal(turn.parts.some((part) => part.type === "data-turn-complete"), false);
	assert.equal(turn.endOfTurnFacts, null);
	assert.equal(turn.activeRequests.size, 0);
});

test("an unrecoverable stream error rejects the turn, writes no turn-complete and frees the thread", async () => {
	const failure = new Error("Rovo stream broke");
	const turn = await runTurn({
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			onPortAcquired(43123);
			onTextDelta("Partial answer");
			throw failure;
		},
	});

	assert.equal(turn.error, failure);
	assert.equal(turn.parts.some((part) => part.type === "data-turn-complete"), false);
	assert.deepEqual(turn.attempts, ["first"]);
	assert.equal(turn.activeRequests.size, 0);
});

test("a stuck port that recovers reruns the same attempt; what the first attempt already streamed stays visible", async () => {
	let streams = 0;
	const restartedPorts = [];
	const turn = await runTurn({
		restartRovoPort: async ({ port }) => {
			restartedPorts.push(port);
			return { recovered: true };
		},
		shouldRetryInteractiveStuckPortRecovery: ({ attemptCount }) => attemptCount < 1,
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			streams += 1;
			onPortAcquired(43123);
			onTextDelta(streams === 1 ? "Lost with the stuck port" : "Recovered answer");
			if (streams === 1) {
				throw createPortStuckError(43123);
			}
		},
	});

	assert.equal(turn.result.aborted, false);
	assert.equal(streams, 2);
	assert.deepEqual(restartedPorts, [43123]);
	// A stuck-port rerun is the same tool-first attempt, recorded again as a first attempt.
	assert.deepEqual(turn.attempts, ["first", "first"]);
	assert.ok(statusLabels(turn.parts).includes("Recovered stuck port, retrying"));
	// Before: the rerun's text ran straight on ("Lost withRecovered answer"). The held-back tail
	// " the stuck port" was never shown and is still dropped; the rerun is now its own paragraph.
	assert.equal(visibleText(turn.parts), "Lost with\n\nRecovered answer");
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

// The marker stream holds back an attempt's last 15 characters as a possible marker start, and a
// rerun drops them unshown. Text followed by this tail has reached the wire before the stuck port.
const HELD_BACK_TAIL = "~".repeat(15);

function recoveringStuckPortStreams(attemptTexts) {
	let streams = 0;
	return {
		getStreams: () => streams,
		dependencies: {
			restartRovoPort: async () => ({ recovered: true }),
			shouldRetryInteractiveStuckPortRecovery: ({ attemptCount }) => attemptCount < attemptTexts.length - 1,
			streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
				streams += 1;
				onPortAcquired(43123);
				// An attempt's text is one chunk, or a list of chunks streamed in order.
				const text = attemptTexts[Math.min(streams, attemptTexts.length) - 1];
				for (const chunk of [text].flat()) {
					if (chunk) {
						onTextDelta(chunk);
					}
				}
				if (streams < attemptTexts.length) {
					throw createPortStuckError(43123);
				}
			},
		},
	};
}

test("a stuck port that recovers before any text was shown starts the reply with the rerun's text", async () => {
	const { dependencies, getStreams } = recoveringStuckPortStreams(["", "Recovered answer"]);
	const turn = await runTurn(dependencies);

	assert.equal(getStreams(), 2);
	assert.equal(visibleText(turn.parts), "Recovered answer");
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("two stuck-port recoveries in a row put one paragraph break between each attempt's shown text", async () => {
	const { dependencies, getStreams } = recoveringStuckPortStreams([
		`First try${HELD_BACK_TAIL}`,
		`Second try${HELD_BACK_TAIL}`,
		"Third try",
	]);
	const turn = await runTurn(dependencies);

	assert.equal(getStreams(), 3);
	assert.deepEqual(turn.attempts, ["first", "first", "first"]);
	assert.equal(visibleText(turn.parts), "First try\n\nSecond try\n\nThird try");
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("a rerun that shows nothing before the next recovery does not double the paragraph break", async () => {
	for (const middleAttempt of ["", "short", "\n\n"]) {
		const { dependencies, getStreams } = recoveringStuckPortStreams([`First try${HELD_BACK_TAIL}`, middleAttempt, "Third try"]);
		const turn = await runTurn(dependencies);

		assert.equal(getStreams(), 3);
		assert.equal(visibleText(turn.parts), "First try\n\nThird try", JSON.stringify(middleAttempt));
		assert.equal(endsWithTurnComplete(turn.parts), true);
	}
});

test("first-attempt text that already ends a paragraph gets no extra break before the rerun", async () => {
	const { dependencies } = recoveringStuckPortStreams([`First try\n\n${HELD_BACK_TAIL}`, "Recovered answer"]);
	const turn = await runTurn(dependencies);

	assert.equal(visibleText(turn.parts), "First try\n\nRecovered answer");
});

test("first-attempt text ending in whitespace still gets exactly one blank line before the rerun", async () => {
	for (const [firstAttempt, expected] of [
		["A  ", "A  \n\nB"],
		["A \n", "A \n\nB"],
		// A markdown hard break: the trailing spaces and newline are the first attempt's, then one blank line.
		["A  \n", "A  \n\nB"],
	]) {
		const { dependencies } = recoveringStuckPortStreams([`${firstAttempt}${HELD_BACK_TAIL}`, "B"]);
		const turn = await runTurn(dependencies);

		assert.equal(visibleText(turn.parts), expected, JSON.stringify(firstAttempt));
	}
});

test("leading newlines in the rerun's text count toward the paragraph break instead of adding to it", async () => {
	for (const rerun of ["\n\nB", ["\n", "\n", "B"]]) {
		const { dependencies } = recoveringStuckPortStreams([`A${HELD_BACK_TAIL}`, rerun]);
		const turn = await runTurn(dependencies);

		assert.equal(visibleText(turn.parts), "A\n\nB", JSON.stringify(rerun));
		assert.equal(turn.endOfTurnFacts.assistantText, [rerun].flat().join(""));
	}
});

test("a timeout notice after an empty rerun follows the first attempt's shown text after one blank line", async () => {
	let streams = 0;
	let restarts = 0;
	const turn = await runTurn({
		restartRovoPort: async () => {
			restarts += 1;
			return { recovered: restarts === 1 };
		},
		shouldRetryInteractiveStuckPortRecovery: ({ attemptCount }) => attemptCount < 1,
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			streams += 1;
			onPortAcquired(43123);
			if (streams === 1) {
				onTextDelta(`A${HELD_BACK_TAIL}`);
				throw createPortStuckError(43123);
			}
			throw Object.assign(new Error("Rovo turn still in progress"), { code: "ROVO_CHAT_IN_PROGRESS_TIMEOUT" });
		},
	});

	assert.equal(streams, 2);
	assert.match(visibleText(turn.parts), /^A\n\n⚠️ Automatic recovery timed out/u);
});

test("text the first attempt still held back is not shown when it reruns", async () => {
	// Each expected string is the first attempt's text on main, then the rerun's after one blank line if any showed.
	for (const [firstAttempt, expected] of [
		// A spec fence and its payload stay hidden; only what main had already shown stays.
		['X ```spec\n{"foo":1}', "X ``\n\nB"],
		["X ```sp", "B"],
		// Short enough to be held back whole as a possible marker start.
		["A", "B"],
		["WIDGET_", "B"],
		['WIDGET_DATA:{"type":"plan"', "B"],
		['Intro WIDGET_DATA:{"type":"plan"', "Intro \n\nB"],
		["Lost with [[RESULT:", "Lost\n\nB"],
	]) {
		const { dependencies } = recoveringStuckPortStreams([firstAttempt, "B"]);
		const turn = await runTurn(dependencies);

		assert.equal(visibleText(turn.parts), expected, JSON.stringify(firstAttempt));
		assert.equal(turn.endOfTurnFacts.assistantText, "B", JSON.stringify(firstAttempt));
	}
});

test("a first attempt that shows only whitespace adds no paragraph break before the rerun", async () => {
	// Held back whole: nothing was shown.
	const heldBack = recoveringStuckPortStreams(["\n\n", "B"]);
	assert.equal(visibleText((await runTurn(heldBack.dependencies)).parts), "B");

	// Whitespace that reached the wire stays, as on main; the rerun's text follows with nothing added.
	const shown = recoveringStuckPortStreams([`\n\n${" ".repeat(20)}`, "B"]);
	const turn = await runTurn(shown.dependencies);
	assert.equal(visibleText(turn.parts), "\n\n     B");
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("the post-stream pipeline sees only the rerun's text after a stuck-port recovery", async () => {
	const { dependencies } = recoveringStuckPortStreams(["Lost with the stuck port", "Recovered answer"]);
	const turn = await runTurn(dependencies);

	assert.equal(turn.endOfTurnFacts.assistantText, "Recovered answer");
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("on a soft-retry tool-first turn, a stuck port that recovers shows no text from the deferred first attempt", async () => {
	const { dependencies, getStreams } = recoveringStuckPortStreams(["Lost with the stuck port", "Recovered answer"]);
	const turn = await runTurn(dependencies, STRICT_SOFT_RETRY_TURN);

	// Stuck attempt, its rerun, then the two tool-first retries; only the last attempt's deferred text shows.
	assert.equal(getStreams(), 4);
	assert.deepEqual(turn.attempts, ["first", "first", "retry", "retry"]);
	assert.equal(visibleText(turn.parts), "Recovered answer\n\nTool output was not available.");
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("on a tool-first turn that streams its text, the rerun's text starts a new paragraph", async () => {
	const { dependencies, getStreams } = recoveringStuckPortStreams(["Lost with the stuck port", "Recovered answer"]);
	const turn = await runTurn(dependencies, {
		isStrictToolFirstTurn: true,
		toolFirstPolicy: { domains: ["jira"], enforcement: {}, relevanceDomains: ["jira"] },
	});

	assert.equal(getStreams(), 2);
	assert.deepEqual(turn.attempts, ["first", "first"]);
	assert.equal(visibleText(turn.parts), "Lost with\n\nRecovered answer\n\nTool output was not available.");
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

// Turns without a rerun write the same text as origin/main; the expected strings were taken by
// running each sequence against origin/main's backend.
test("without a rerun, a turn's text and its post-stream text match the pre-rerun-break output", async () => {
	const failingAfter = (text) => ({
		buildInteractiveStuckPortFailureMessage: () => "Rovo is busy.",
		restartRovoPort: async () => ({ recovered: false }),
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			onPortAcquired(43123);
			onTextDelta(text);
			throw createPortStuckError(43123);
		},
	});
	const streaming = (...steps) => ({
		streamViaRovo: async ({ onPortAcquired, onTextDelta, onToolCallStart }) => {
			onPortAcquired(43123);
			for (const step of steps) {
				if (typeof step === "string") {
					onTextDelta(step);
				} else {
					onToolCallStart(step);
				}
			}
		},
	});
	for (const [name, dependencies, turnOverrides, expected] of [
		["text ending in a whitespace line, then a failure notice", failingAfter("A\n \n"), {}, "A\n \n\n⚠️ Rovo is busy."],
		["leading whitespace before the first visible text", streaming("\n\n  ", "Answer"), {}, "\n\n  Answer"],
		[
			"whitespace around a tool part",
			streaming("Looking it up \n", { toolCallId: "search-1", toolName: "search_issues" }, "\n\n Found it.  "),
			{},
			"Looking it up \n\n\n Found it.  ",
		],
		[
			"deferred tool-first text",
			streaming("\n Attempt \n"),
			STRICT_SOFT_RETRY_TURN,
			"\n Attempt \n\n\nTool output was not available.",
		],
	]) {
		const turn = await runTurn(dependencies, turnOverrides);

		assert.equal(visibleText(turn.parts), expected, name);
		assert.equal(turn.endOfTurnFacts.assistantText, expected, name);
	}
});

test("a stuck port that cannot recover shows the failure and still completes the turn", async () => {
	let streams = 0;
	const turn = await runTurn({
		buildInteractiveStuckPortFailureMessage: () => "Rovo is busy.",
		restartRovoPort: async () => ({ recovered: false, error: "still listening" }),
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			streams += 1;
			onPortAcquired(43123);
			onTextDelta("Partial answer");
			throw createPortStuckError(43123);
		},
	});

	assert.equal(turn.result.aborted, false);
	assert.equal(streams, 1);
	assert.ok(statusLabels(turn.parts).includes("Port recovery failed"));
	assert.match(visibleText(turn.parts), /⚠️ Rovo is busy\./u);
	assert.match(visibleText(turn.parts), /Partial answer/u);
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("on a tool-first retry turn, a stuck port that cannot recover shows its failure and plans no retry", async () => {
	let streams = 0;
	const turn = await runTurn({
		buildInteractiveStuckPortFailureMessage: () => "Rovo is busy.",
		restartRovoPort: async () => ({ recovered: false }),
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			streams += 1;
			onPortAcquired(43123);
			onTextDelta("Partial answer");
			throw createPortStuckError(43123);
		},
	}, STRICT_SOFT_RETRY_TURN);

	assert.equal(turn.result.aborted, false);
	assert.equal(streams, 1);
	assert.deepEqual(turn.attempts, ["first"]);
	// Before: the loop still asked the tool-first retry plan after giving up on the port, so it
	// showed "Retrying integration tools (2/3)" for a retry that never ran and dropped this text.
	assert.equal(statusLabels(turn.parts).some((label) => label.startsWith("Retrying")), false);
	assert.match(visibleText(turn.parts), /⚠️ Rovo is busy\./u);
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("a chat-in-progress timeout shows the failure and stops tool-first retries", async () => {
	let streams = 0;
	const turn = await runTurn({
		streamViaRovo: async ({ onPortAcquired }) => {
			streams += 1;
			onPortAcquired(43123);
			throw Object.assign(new Error("Rovo turn wait timed out"), { code: "ROVO_CHAT_IN_PROGRESS_TIMEOUT" });
		},
	}, STRICT_SOFT_RETRY_TURN);

	assert.equal(turn.result.aborted, false);
	assert.equal(streams, 1);
	assert.deepEqual(turn.attempts, ["first"]);
	assert.equal(statusLabels(turn.parts).some((label) => label.startsWith("Retrying")), false);
	assert.match(visibleText(turn.parts), /⚠️ Automatic recovery timed out/u);
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("tool-first retries run until the attempts are used up, then the turn completes with the last attempt's text", async () => {
	const messages = [];
	const turn = await runTurn({
		streamViaRovo: async ({ message, onPortAcquired, onTextDelta }) => {
			messages.push(message.message);
			onPortAcquired(43123);
			onTextDelta(`Attempt ${messages.length}`);
		},
	}, STRICT_SOFT_RETRY_TURN);

	assert.equal(turn.result.aborted, false);
	assert.equal(messages.length, 3);
	assert.equal(messages[0], "Hello");
	assert.deepEqual(turn.attempts, ["first", "retry", "retry"]);
	assert.deepEqual(statusLabels(turn.parts).filter((label) => label.startsWith("Retrying")), [
		"Retrying integration tools (2/3)",
		"Retrying integration tools (3/3)",
	]);
	assert.match(visibleText(turn.parts), /^Attempt 3/u);
	assert.doesNotMatch(visibleText(turn.parts), /Attempt [12]/u);
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("a question card stops tool-first retries and ends the turn on the card", async () => {
	let streams = 0;
	const turn = await runTurn({
		streamViaRovo: async ({ onDeferredToolRequest, onPortAcquired }) => {
			streams += 1;
			onPortAcquired(43123);
			await onDeferredToolRequest({ toolCallId: "question-1", toolName: "ask_user_questions", toolInput: { question: "Which project?" } });
		},
	}, STRICT_SOFT_RETRY_TURN);

	assert.equal(streams, 1);
	assert.deepEqual(turn.attempts, ["first"]);
	assert.deepEqual(widgetParts(turn.parts, "question-card"), ["loading:true", "data", "loading:false"]);
	assert.equal(turn.endOfTurnFacts.hasEmittedQuestionCard, true);
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("a plan card that starts loading and never arrives ends with a plan error card", async () => {
	const turn = await runTurn({
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			onPortAcquired(43123);
			onTextDelta("WIDGET_LOADING:plan\n");
			onTextDelta("Planning text");
		},
	});

	assert.deepEqual(widgetParts(turn.parts, "plan"), ["loading:true", "loading:false", "error"]);
	assert.equal(turn.endOfTurnFacts.hasEmittedPlanWidget, false);
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("a plan card from exit_plan_mode is shown once and the turn completes on it", async () => {
	const turn = await runTurn({
		streamViaRovo: async ({ onPortAcquired, onToolCallStart }) => {
			onPortAcquired(43123);
			onToolCallStart({ toolCallId: "plan-1", toolName: "exit_plan_mode", isDeferredToolRequest: true, toolInput: { plan: "# Plan\n- Step one" } });
		},
	});

	assert.deepEqual(widgetParts(turn.parts, "plan"), ["data"]);
	assert.equal(turn.endOfTurnFacts.hasEmittedPlanWidget, true);
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("a GenUI widget after a plan card is not shown; one before it is", async () => {
	const genuiMarker = `WIDGET_DATA:${JSON.stringify({ type: "genui-preview", spec: { root: "card" } })}\n`;
	const planToolCall = { toolCallId: "plan-1", toolName: "exit_plan_mode", isDeferredToolRequest: true, toolInput: { plan: "# Plan\n- Step one" } };

	const planFirst = await runTurn({
		streamViaRovo: async ({ onPortAcquired, onTextDelta, onToolCallStart }) => {
			onPortAcquired(43123);
			onToolCallStart(planToolCall);
			onTextDelta(genuiMarker);
		},
	});
	assert.deepEqual(widgetParts(planFirst.parts, "genui-preview"), []);
	assert.equal(planFirst.endOfTurnFacts.hasEmittedGenuiWidget, false);

	const genuiFirst = await runTurn({
		streamViaRovo: async ({ onPortAcquired, onTextDelta, onToolCallStart }) => {
			onPortAcquired(43123);
			onTextDelta(genuiMarker);
			onToolCallStart(planToolCall);
		},
	});
	assert.deepEqual(widgetParts(genuiFirst.parts, "genui-preview"), ["data", "loading:false"]);
	assert.equal(genuiFirst.endOfTurnFacts.hasEmittedGenuiWidget, true);
	assert.equal(genuiFirst.endOfTurnFacts.hasEmittedPlanWidget, true);
});

test("a tool call seen in a discarded tool-first attempt still counts at the end of the turn", async () => {
	let streams = 0;
	const turn = await runTurn({
		streamViaRovo: async ({ onPortAcquired, onTextDelta, onToolCallStart }) => {
			streams += 1;
			onPortAcquired(43123);
			if (streams === 1) {
				onToolCallStart({ toolCallId: "search-1", toolName: "search_issues" });
			}
			onTextDelta(`Attempt ${streams}`);
		},
	}, STRICT_SOFT_RETRY_TURN);

	assert.equal(streams, 3);
	assert.equal(turn.endOfTurnFacts.hasObservedActionableToolCall, true);
	assert.doesNotMatch(visibleText(turn.parts), /Attempt [12]/u);
});

test("a pending deferred tool request is retried once as a deferred tool response; a second one fails the turn", async () => {
	const messages = [];
	const turn = await runTurn({
		synthesiseDeferredToolResponseFromClarification: () => ({ type: "deferred-tool-response" }),
		streamViaRovo: async ({ message }) => {
			messages.push(message.message);
			throw new Error("Rovo has a pending deferred tool request");
		},
	}, {
		clarificationSubmission: { sessionId: "clarification-1", answers: {} },
		clarificationToolCallId: "question-1",
	});

	assert.deepEqual(messages, ["Hello", { type: "deferred-tool-response" }]);
	assert.match(turn.error.message, /pending deferred tool request/u);
	assert.equal(turn.parts.some((part) => part.type === "data-turn-complete"), false);
	assert.equal(turn.activeRequests.size, 0);
});

test("the plan-feedback guard cancels Rovo once however many tools it blocks, and aborts the turn", async () => {
	const cancelledPorts = [];
	const turn = await runTurn({
		getPlanFeedbackToolGuard: () => ({ ignore: false, block: true }),
		rovoCancelChat: async (port) => cancelledPorts.push(port),
		streamViaRovo: async ({ onPortAcquired, onToolCallStart }) => {
			onPortAcquired(43123);
			onToolCallStart({ toolCallId: "write-1", toolName: "update_todo" });
			onToolCallStart({ toolCallId: "write-2", toolName: "update_todo" });
		},
	}, { isPlanFeedbackDeferredResumeTurn: true });

	assert.equal(turn.result.aborted, true);
	assert.deepEqual(cancelledPorts, [43123]);
	assert.equal(turn.parts.some((part) => part.type === "data-turn-complete"), false);
});

test("a pause handed to the paused tool call disconnects the stream and ends the turn on its question card", async () => {
	let streams = 0;
	let pauseDecision = null;
	const turn = await runTurn({
		handleReplayDeferredToolRequest: async ({ emitRequestUserInputQuestionCard }) => {
			emitRequestUserInputQuestionCard({ toolName: "ask_user_questions", toolCallId: "question-1", questionInput: { question: "Which project?" }, source: "deferred_tool_request" });
			return { handled: true, disconnect: true, hasObservedDeferredToolRequest: true, pausedToolCallHandled: true };
		},
		streamViaRovo: async ({ onPausedToolCalls, onPortAcquired }) => {
			streams += 1;
			onPortAcquired(43123);
			pauseDecision = await onPausedToolCalls({
				rawEvent: { parts: [{ tool_name: "ask_user_questions", tool_call_id: "question-1" }] },
				control: {},
			});
		},
	}, STRICT_SOFT_RETRY_TURN);

	assert.deepEqual(pauseDecision, { disconnect: true });
	assert.equal(streams, 1);
	assert.deepEqual(widgetParts(turn.parts, "question-card"), ["loading:true", "data", "loading:false"]);
	assert.equal(turn.endOfTurnFacts.hasEmittedQuestionCard, true);
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("plan data without an explicit plan payload never reaches the plan finalizer", async () => {
	// Both ways a turn shows a plan card carry its payload, so the finalizer's branch for implicit
	// plan data (loading still open, no explicit payload) cannot run from this runner.
	const planDataMarker = `WIDGET_DATA:${JSON.stringify({ type: "plan", title: "Plan", markdown: "# Plan\n- Step one" })}\n`;
	const streams = {
		"exit_plan_mode tool input": async ({ onPortAcquired, onToolCallStart }) => {
			onPortAcquired(43123);
			onToolCallStart({ toolCallId: "plan-1", toolName: "exit_plan_mode", isDeferredToolRequest: true, toolInput: { plan: "# Plan\n- Step one" } });
		},
		"plan marker after loading": async ({ onPortAcquired, onTextDelta }) => {
			onPortAcquired(43123);
			onTextDelta("WIDGET_LOADING:plan\n");
			onTextDelta(planDataMarker);
		},
	};
	for (const [source, streamViaRovo] of Object.entries(streams)) {
		let planFacts = null;
		const turn = await runTurn({
			finalizeRovoPlanWidgetPostStream: (facts) => {
				planFacts = facts;
				return { closedLoading: false, emittedError: false };
			},
			streamViaRovo,
		});
		assert.equal(planFacts.hasEmittedPlanWidget, true, source);
		assert.equal(planFacts.hasExplicitPlanPayload, true, source);
		assert.equal(planFacts.hasSeenPlanWidgetSignal, true, source);
		assert.equal(planFacts.hasEmittedPlanLoadingState, false, source);
		assert.deepEqual(widgetParts(turn.parts, "plan").filter((part) => part === "data"), ["data"], source);
	}
});

const STREAMED_BEFORE_STUCK_PORT = "Here are the Jira issues I found so far";

for (const [kind, turnOverrides, expected] of [
	["a plain turn", {}, `${STREAMED_BEFORE_STUCK_PORT}\n\n⚠️ Rovo is busy.`],
	["a tool-first retry turn", STRICT_SOFT_RETRY_TURN, `${STREAMED_BEFORE_STUCK_PORT}\n\n⚠️ Rovo is busy.\n\nTool output was not available.`],
]) {
	test(`on ${kind}, a port failure notice follows all the text already streamed, as its own paragraph`, async () => {
		// Before: the notice jumped ahead of the text the marker stream still held back:
		// "Here are the Jira issues\n\n⚠️ Rovo is busy. I found so far…"
		const turn = await runTurn({
			buildInteractiveStuckPortFailureMessage: () => "Rovo is busy.",
			restartRovoPort: async () => ({ recovered: false }),
			streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
				onPortAcquired(43123);
				onTextDelta(STREAMED_BEFORE_STUCK_PORT);
				throw createPortStuckError(43123);
			},
		}, turnOverrides);

		assert.equal(visibleText(turn.parts), expected);
		assert.equal(endsWithTurnComplete(turn.parts), true);
	});
}

test("a port failure during a tool-first retry follows that attempt's text with a paragraph break on both sides", async () => {
	// Before: "\n\n⚠️ Rovo is busy.Attempt 2\n\nTool output was not available."
	let streams = 0;
	const turn = await runTurn({
		buildInteractiveStuckPortFailureMessage: () => "Rovo is busy.",
		restartRovoPort: async () => ({ recovered: false }),
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			streams += 1;
			onPortAcquired(43123);
			onTextDelta(`Attempt ${streams}`);
			if (streams === 2) {
				throw createPortStuckError(43123);
			}
		},
	}, STRICT_SOFT_RETRY_TURN);

	assert.equal(streams, 2);
	assert.deepEqual(turn.attempts, ["first", "retry"]);
	assert.equal(visibleText(turn.parts), "Attempt 2\n\n⚠️ Rovo is busy.\n\nTool output was not available.");
});

function failingAfterChunks(chunks, overrides = {}) {
	return {
		buildInteractiveStuckPortFailureMessage: () => "Rovo is busy.",
		restartRovoPort: async () => ({ recovered: false }),
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			onPortAcquired(43123);
			for (const chunk of [chunks].flat()) {
				if (chunk) {
					onTextDelta(chunk);
				}
			}
			throw createPortStuckError(43123);
		},
		...overrides,
	};
}

const BUSY_NOTICE = "⚠️ Rovo is busy.";

test("a failure notice shows the text the marker stream held back, as its own paragraph after it", async () => {
	for (const [streamed, expected] of [
		["", BUSY_NOTICE],
		// Held back whole as a possible marker start.
		["Short", `Short\n\n${BUSY_NOTICE}`],
		// Short of a marker prefix's first underscore: ordinary text. Before: "Plan \n\n⚠️ Rovo is busy."
		["Plan A", `Plan A\n\n${BUSY_NOTICE}`],
		["The answer ends in WIDGET", `The answer ends in WIDGET\n\n${BUSY_NOTICE}`],
		["Answer\n", `Answer\n\n${BUSY_NOTICE}`],
		["Answer\n\n", `Answer\n\n${BUSY_NOTICE}`],
		// A complete marker is still processed; the text after it is shown.
		[`Intro\nTHINKING_STATUS:${JSON.stringify({ label: "Working" })}\nMore`, `Intro\nMore\n\n${BUSY_NOTICE}`],
	]) {
		const turn = await runTurn(failingAfterChunks(streamed));

		assert.equal(visibleText(turn.parts), expected, JSON.stringify(streamed));
		assert.equal(turn.endOfTurnFacts.assistantText, expected, JSON.stringify(streamed));
		assert.equal(endsWithTurnComplete(turn.parts), true);
	}
});

test("a failure notice drops a marker the stream had only started, and keeps the text before it", async () => {
	// Before: the unfinished marker went out as text in front of the notice,
	// for example 'Intro WIDGET_DATA:{"type":"plan"\n\n⚠️ Rovo is busy.'
	for (const [streamed, expected, turnOverrides] of [
		['Intro WIDGET_DATA:{"type":"plan"', `Intro \n\n${BUSY_NOTICE}`],
		[["Intro WIDGET_DATA:", '{"type":"plan","title":"Pl'], `Intro \n\n${BUSY_NOTICE}`],
		["Here is the answer WIDGET_DA", `Here is the answer \n\n${BUSY_NOTICE}`],
		["Done.\nTHINKING_STATUS:", `Done.\n\n${BUSY_NOTICE}`],
		['Done.\n\nAGENT_EXECUTION:{"taskId":"t-1"', `Done.\n\n${BUSY_NOTICE}`],
		["Done.\n\nWIDGET_LOADING:", `Done.\n\n${BUSY_NOTICE}`],
		["WIDGET_", BUSY_NOTICE],
		["Building your agent AGENT_RES", `Building your agent \n\n${BUSY_NOTICE}`, { creationMode: "agent" }],
		['Building your agent AGENT_RESULT: {"name":"Ops', `Building your agent \n\n${BUSY_NOTICE}`, { creationMode: "agent" }],
	]) {
		const turn = await runTurn(failingAfterChunks(streamed), turnOverrides);

		assert.equal(visibleText(turn.parts), expected, JSON.stringify(streamed));
		assert.equal(turn.endOfTurnFacts.assistantText, expected, JSON.stringify(streamed));
		assert.equal(turn.parts.some((part) => part.type.startsWith("data-widget") || part.type === "data-agent-result"), false);
		assert.equal(endsWithTurnComplete(turn.parts), true);
	}
});

test("a failure notice after an unfinished spec or media fence drops the fence and is shown outside it", async () => {
	const { isClassifierIntentLeakCandidate, parseClassifierIntentPayload } = require("./classifier-intent");
	const { splitSpecFenceTextForStreaming } = require("../lib/tool-output-sanitizer");
	const { splitDirectMediaTextForStreaming } = require("../lib/direct-media-fence");
	// The text layer holds a reply that opens with a fence (a classifier-leak candidate) and splits
	// the open fence off as pending. Before: the notice was appended inside that open fence, so it was
	// held back with the fence and dropped with it, and the reply ended with no notice at all.
	for (const [streamed, expected, turnOverrides] of [
		['```spec\n{"root":"card","elements":{"card":{"type":"Card"', BUSY_NOTICE],
		// The newline before the fence is ordinary text and still goes out.
		['\n```spec\n{"root":"card","elements":{"card":{"type":"Card"', `\n${BUSY_NOTICE}`],
		['```spec\n{"root":"card","elements":{"card":{"type":"Card"', `${BUSY_NOTICE}\n\nTool output was not available.`, STRICT_SOFT_RETRY_TURN],
		['```image\n{"prompt":"A lighthouse at dusk, painted in oils"', BUSY_NOTICE],
	]) {
		const turn = await runTurn(failingAfterChunks(streamed, {
			isClassifierIntentLeakCandidate,
			parseClassifierIntentPayload,
			splitDirectMediaTextForStreaming,
			splitSpecFenceTextForStreaming,
		}), turnOverrides);

		assert.equal(visibleText(turn.parts), expected, JSON.stringify(streamed));
		assert.equal(turn.endOfTurnFacts.assistantText, expected, JSON.stringify(streamed));
		assert.equal(endsWithTurnComplete(turn.parts), true);
	}
});

test("a failure notice after a rerun that showed only whitespace starts one blank line after the first attempt", async () => {
	// Before: the rerun's held spaces went out in front of the notice: "A\n\n  ⚠️ Rovo is busy."
	let streams = 0;
	const turn = await runTurn({
		buildInteractiveStuckPortFailureMessage: () => "Rovo is busy.",
		restartRovoPort: async () => ({ recovered: streams === 1 }),
		shouldRetryInteractiveStuckPortRecovery: ({ attemptCount }) => attemptCount < 1,
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			streams += 1;
			onPortAcquired(43123);
			onTextDelta(streams === 1 ? `A${HELD_BACK_TAIL}` : "  ");
			throw createPortStuckError(43123);
		},
	});

	assert.equal(streams, 2);
	assert.equal(visibleText(turn.parts), `A\n\n${BUSY_NOTICE}`);
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("a chat-in-progress timeout notice drops an unfinished marker and starts its own paragraph", async () => {
	const timeoutNotice = "⚠️ Automatic recovery timed out while waiting for the previous turn. Please retry or reset the chat.";
	// Before: the notice was streamed through the marker stream as text, so it ran into the open
	// marker and both went out together, and with nothing shown it started with a blank line.
	for (const [streamed, expected] of [
		["", timeoutNotice],
		["Partial answer", `Partial answer\n\n${timeoutNotice}`],
		['Intro WIDGET_DATA:{"type":"plan"', `Intro \n\n${timeoutNotice}`],
		["Intro WIDGET_DA", `Intro \n\n${timeoutNotice}`],
	]) {
		const turn = await runTurn({
			streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
				onPortAcquired(43123);
				if (streamed) {
					onTextDelta(streamed);
				}
				throw Object.assign(new Error("Rovo turn still in progress"), { code: "ROVO_CHAT_IN_PROGRESS_TIMEOUT" });
			},
		});

		assert.equal(visibleText(turn.parts), expected, JSON.stringify(streamed));
		assert.equal(turn.endOfTurnFacts.assistantText, expected, JSON.stringify(streamed));
		assert.equal(endsWithTurnComplete(turn.parts), true);
	}
});

test("a failure notice after a fence that followed text keeps the fence text already shown", async () => {
	const { isClassifierIntentLeakCandidate, parseClassifierIntentPayload } = require("./classifier-intent");
	const { splitSpecFenceTextForStreaming } = require("../lib/tool-output-sanitizer");
	const { splitDirectMediaTextForStreaming } = require("../lib/direct-media-fence");
	// A fence after ordinary text is not held across deltas, so its text goes out. Before: the notice
	// cut it from the turn's text ("Intro\n\n⚠️ Rovo is busy.") and followed it after one newline.
	for (const [streamed, expected] of [
		[['Intro\n```spec\n{"root":', '"card"'], `Intro\n\`\`\`spec\n{"root":"card"\n\n${BUSY_NOTICE}`],
		[['Intro\n```image\n{"prompt":', '"A lighthouse"'], `Intro\n\`\`\`image\n{"prompt":"A lighthouse"\n\n${BUSY_NOTICE}`],
	]) {
		const turn = await runTurn(failingAfterChunks(streamed, {
			isClassifierIntentLeakCandidate,
			parseClassifierIntentPayload,
			splitDirectMediaTextForStreaming,
			splitSpecFenceTextForStreaming,
		}));

		assert.equal(visibleText(turn.parts), expected, JSON.stringify(streamed));
		assert.equal(turn.endOfTurnFacts.assistantText, expected, JSON.stringify(streamed));
		assert.equal(endsWithTurnComplete(turn.parts), true);
	}
});

test("a failure notice after a marker prefix with an invalid payload keeps processing the markers after it", async () => {
	const turn = await runTurn(failingAfterChunks('WIDGET_DATA:xTHINKING_STATUS:{"label":"Done"}'));

	assert.equal(visibleText(turn.parts), `WIDGET_DATA:x\n\n${BUSY_NOTICE}`);
	assert.deepEqual(statusLabels(turn.parts).filter((label) => label === "Done"), ["Done"]);
	assert.equal(endsWithTurnComplete(turn.parts), true);
});

test("a failure notice on a card-first turn reaches the wire once", async () => {
	const CARD_FIRST_TURN = { prefersGenuiCardExperience: true, smartGenerationActive: true };
	const timeoutNotice = "⚠️ Automatic recovery timed out while waiting for the previous turn. Please retry or reset the chat.";
	const chatInProgressTimeout = () => Object.assign(new Error("Rovo turn still in progress"), { code: "ROVO_CHAT_IN_PROGRESS_TIMEOUT" });
	const widget = 'WIDGET_DATA:{"type":"genui-preview","title":"x"}';
	// Before: the notice was suppressed with the turn's text, and after a widget the text is never
	// replayed, so the wire had no text at all; without a widget the text route did not replay either.
	for (const [name, dependencyOverrides, expected, expectsWidget] of [
		["a widget, then a stuck port", failingAfterChunks(widget), BUSY_NOTICE, true],
		["a widget, then a chat-in-progress timeout", failingAfterChunks(widget, {
			streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
				onPortAcquired(43123);
				onTextDelta(widget);
				throw chatInProgressTimeout();
			},
		}), timeoutNotice, true],
		["suppressed text, then a stuck port", failingAfterChunks("Here is the summary"), `Here is the summary\n\n${BUSY_NOTICE}`, false],
	]) {
		const turn = await runTurn(dependencyOverrides, CARD_FIRST_TURN);

		assert.equal(visibleText(turn.parts), expected, name);
		assert.equal(turn.parts.filter((part) => part.type === "text-start").length, 1, name);
		assert.equal(widgetParts(turn.parts, "genui-preview").includes("data"), expectsWidget, name);
		assert.equal(endsWithTurnComplete(turn.parts), true, name);
	}
});

test("tool starts that arrive after the turn ended are blocked once: Rovo is cancelled once", async () => {
	const cancelledPorts = [];
	let startTool = null;
	const turn = await runTurn({
		getPlanFeedbackToolGuard: () => ({ ignore: false, block: true }),
		rovoCancelChat: async (port) => cancelledPorts.push(port),
		streamViaRovo: async ({ onPortAcquired, onToolCallStart }) => {
			startTool = onToolCallStart;
			onPortAcquired(43123);
		},
	}, { isPlanFeedbackDeferredResumeTurn: true });
	assert.equal(turn.result.aborted, false);

	// Before: the ended turn dropped the block, so each late start cancelled Rovo again.
	startTool({ toolCallId: "write-1", toolName: "update_todo" });
	startTool({ toolCallId: "write-2", toolName: "update_todo" });

	assert.deepEqual(cancelledPorts, [43123]);
});
