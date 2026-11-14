"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
	ROVO_CHAT_TURN_PHASES,
	createRovoChatTurn,
	createRovoChatTurnState,
	rovoChatTurnReducer,
} = require("./rovo-chat-turn-machine");

function reduce(events, initialState = createRovoChatTurnState()) {
	return events.reduce(rovoChatTurnReducer, initialState);
}

test("a turn starts streaming its first attempt with no facts and no recovery", () => {
	const state = createRovoChatTurnState({ activeAttemptMessage: { message: "Hello" } });
	assert.equal(state.phase, "streaming");
	assert.equal(state.attempt, 1);
	assert.equal(state.next, null);
	assert.deepEqual(state.recovery, { forcePortRecoveryAttempts: 0, retriedAsDeferredToolResponse: false, stuckPortRetries: 0 });
	assert.equal(Object.values(state.facts).filter((value) => value === true).length, 0);
	assert.deepEqual(ROVO_CHAT_TURN_PHASES, ["streaming", "retry-pending", "post-stream", "completed", "aborted", "failed"]);
});

test("facts are sticky; only the plan card's loading state goes back to false", () => {
	const state = reduce([
		{ type: "plan-loading", loading: true },
		{ type: "plan-loading", loading: false },
		{ type: "question-card-emitted" },
		{ type: "genui-widget-emitted" },
		{ type: "tool-execution-observed" },
		{ type: "port-acquired", port: 43123 },
	]);
	assert.deepEqual(state.facts.plan, { data: false, loading: false, signal: true });
	assert.equal(state.facts.questionCard, true);
	assert.equal(state.facts.genuiWidget, true);
	assert.equal(state.facts.toolExecution, true);
	assert.equal(state.facts.port, 43123);
});

test("plan data is also a plan signal", () => {
	assert.deepEqual(reduce([{ type: "plan-data" }]).facts.plan, { data: true, loading: false, signal: true });
});

test("a relevant tool call is also actionable, and a later irrelevant one keeps it relevant", () => {
	const state = reduce([
		{ type: "tool-call-observed", relevant: true },
		{ type: "tool-call-observed", relevant: false },
	]);
	assert.equal(state.facts.actionableToolCall, true);
	assert.equal(state.facts.relevantActionableToolCall, true);
	assert.equal(reduce([{ type: "tool-call-observed", relevant: false }]).facts.relevantActionableToolCall, false);
});

test("a pause handed to the paused tool call is also a deferred tool request", () => {
	const { facts } = reduce([{ type: "paused-tool-call-handled" }]);
	assert.equal(facts.pausedToolCallHandled, true);
	assert.equal(facts.deferredToolRequest, true);
});

test("after an attempt the turn plans a retry, reruns it, or ends its stream phase", () => {
	assert.equal(reduce([{ type: "attempt-finished" }]).next, "plan-retry");
	assert.equal(reduce([{ type: "attempt-failed", recovery: { action: "retry-stream" } }]).next, "rerun");
	assert.equal(reduce([{ type: "attempt-failed", recovery: { action: "stream-timeout" } }]).next, "end");
	assert.equal(reduce([{ type: "attempt-failed", recovery: { action: "continue-after-error", shouldContinueToolFirstRetry: false } }]).next, "end");
	// A handler's "stop" wins over its "retry-stream", as the loop treated it before.
	assert.equal(reduce([{ type: "attempt-failed", recovery: { action: "retry-stream", shouldContinueToolFirstRetry: false } }]).next, "end");
	assert.equal(reduce([{ type: "attempt-failed", recovery: { action: "continue-after-error" } }]).next, "plan-retry");
});

test("a failed attempt's recovery updates the counts and the attempt message; the deferred retry stays used", () => {
	const retryMessage = { message: { type: "deferred-tool-response" } };
	const state = reduce([
		{ type: "attempt-failed", recovery: { action: "retry-stream", activeAttemptMessage: retryMessage, hasRetriedAsDeferredToolResponse: true } },
		{ type: "attempt-started" },
		{ type: "attempt-failed", recovery: { action: "retry-stream", stuckPortRecoveryRetryCount: 1 } },
		{ type: "attempt-started" },
		{ type: "attempt-failed", recovery: { action: "stream-timeout", forcePortRecoveryAttemptCount: 2 } },
	], createRovoChatTurnState({ activeAttemptMessage: { message: "Hello" } }));
	assert.equal(state.activeAttemptMessage, retryMessage);
	assert.deepEqual(state.recovery, { forcePortRecoveryAttempts: 2, retriedAsDeferredToolResponse: true, stuckPortRetries: 1 });
	assert.equal(state.next, "end");
});

test("a tool-first retry waits in retry-pending, then streams the next attempt", () => {
	const nextMessage = { message: "Try again" };
	const pending = reduce([{ type: "attempt-finished" }, { type: "retry-scheduled" }]);
	assert.equal(pending.phase, "retry-pending");
	assert.equal(pending.next, null);
	const retried = rovoChatTurnReducer(pending, { type: "attempt-started", attempt: 2, activeAttemptMessage: nextMessage });
	assert.equal(retried.phase, "streaming");
	assert.equal(retried.attempt, 2);
	assert.equal(retried.activeAttemptMessage, nextMessage);
	// An attempt result outside streaming changes nothing.
	assert.equal(rovoChatTurnReducer(pending, { type: "attempt-finished" }), pending);
});

test("a turn completes only from post-stream; aborted and failed end it from any phase", () => {
	assert.equal(reduce([{ type: "completed" }]).phase, "streaming");
	assert.equal(reduce([{ type: "post-stream-started" }, { type: "completed" }]).phase, "completed");
	assert.equal(reduce([{ type: "retry-scheduled" }, { type: "aborted" }]).phase, "aborted");
	assert.equal(reduce([{ type: "post-stream-started" }, { type: "failed" }]).phase, "failed");
});

test("an ended turn ignores every later event", () => {
	for (const ending of [[{ type: "aborted" }], [{ type: "failed" }], [{ type: "post-stream-started" }, { type: "completed" }]]) {
		const ended = reduce(ending);
		for (const event of [{ type: "question-card-emitted" }, { type: "attempt-started", attempt: 2 }, { type: "post-stream-started" }, { type: "failed" }, { type: "aborted" }]) {
			assert.equal(rovoChatTurnReducer(ended, event), ended);
		}
	}
});

test("an unknown event leaves the turn unchanged", () => {
	const state = createRovoChatTurnState();
	assert.equal(rovoChatTurnReducer(state, { type: "something-else" }), state);
	assert.equal(rovoChatTurnReducer(state, undefined), state);
});

test("a turn store dispatches through the reducer and returns the current state", () => {
	const turn = createRovoChatTurn();
	const returned = turn.dispatch({ type: "question-card-emitted" });
	assert.equal(returned, turn.getState());
	assert.equal(turn.getState().facts.questionCard, true);
});

test("a blocked plan-feedback tool is recorded in every phase, including after the turn ended", () => {
	for (const ending of [[{ type: "aborted" }], [{ type: "failed" }], [{ type: "post-stream-started" }, { type: "completed" }]]) {
		const late = rovoChatTurnReducer(reduce(ending), { type: "plan-feedback-tool-blocked" });
		assert.equal(late.facts.planFeedbackToolBlocked, true);
	}
	const blocked = reduce([{ type: "plan-feedback-tool-blocked" }]);
	assert.equal(rovoChatTurnReducer(blocked, { type: "plan-feedback-tool-blocked" }), blocked);
});
