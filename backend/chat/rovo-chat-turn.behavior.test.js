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
	// Today: text already streamed by the stuck attempt stays in the reply; only its held-back
	// tail is dropped, and the rerun's text follows with no separator.
	assert.match(visibleText(turn.parts), /^Lost with/u);
	assert.doesNotMatch(visibleText(turn.parts), /the stuck port/u);
	assert.match(visibleText(turn.parts), /Recovered answer$/u);
	assert.equal(endsWithTurnComplete(turn.parts), true);
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
