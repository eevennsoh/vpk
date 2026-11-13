"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	NO_PLAN_SESSION,
	PLAN_SESSION_PHASES,
	isPlanSessionExpired,
	planReducer,
} = require("./plan-session-machine");

const session = (phase, extra = {}) => ({
	phase,
	deferredToolCallId: null,
	planCardIds: [],
	updatedAt: 100,
	...extra,
});

test("phases and the empty session", () => {
	assert.deepEqual(PLAN_SESSION_PHASES, ["none", "qa", "plan", "execution"]);
	assert.deepEqual(NO_PLAN_SESSION, { phase: "none", deferredToolCallId: null, planCardIds: [], updatedAt: 0 });
	assert.ok(Object.isFrozen(NO_PLAN_SESSION) && Object.isFrozen(NO_PLAN_SESSION.planCardIds));
});

test("transition table", () => {
	const emitted = { type: "PLAN_EMITTED", deferredToolCallId: " tool-1 ", planCardId: "card-1", at: 200 };
	const rows = [
		// [from, event, to]
		[NO_PLAN_SESSION, { type: "ENTER_PLAN_MODE", at: 200 }, session("qa", { updatedAt: 200 })],
		[NO_PLAN_SESSION, emitted, session("plan", { deferredToolCallId: "tool-1", planCardIds: ["card-1"], updatedAt: 200 })],
		[session("qa"), emitted, session("plan", { deferredToolCallId: "tool-1", planCardIds: ["card-1"], updatedAt: 200 })],
		// A second plan widget replaces the deferred tool call and adds a new card once.
		[
			session("plan", { deferredToolCallId: "tool-1", planCardIds: ["card-1"] }),
			{ type: "PLAN_EMITTED", deferredToolCallId: "tool-2", planCardId: "card-1", at: 200 },
			session("plan", { deferredToolCallId: "tool-2", planCardIds: ["card-1"], updatedAt: 200 }),
		],
		// Missing metadata keeps what the session already had.
		[
			session("plan", { deferredToolCallId: "tool-1", planCardIds: ["card-1"] }),
			{ type: "PLAN_EMITTED", deferredToolCallId: "  ", at: 200 },
			session("plan", { deferredToolCallId: "tool-1", planCardIds: ["card-1"], updatedAt: 200 }),
		],
		// A plan widget during execution goes back to plan (as before this machine).
		[session("execution", { deferredToolCallId: "tool-1" }), emitted, session("plan", { deferredToolCallId: "tool-1", planCardIds: ["card-1"], updatedAt: 200 })],
		// The auto-accept approval path starts execution with no prior session.
		[NO_PLAN_SESSION, { type: "START_EXECUTION", at: 200 }, session("execution", { updatedAt: 200 })],
		[session("qa"), { type: "START_EXECUTION", at: 200 }, session("execution", { updatedAt: 200 })],
		[
			session("plan", { deferredToolCallId: "tool-1", planCardIds: ["card-1"] }),
			{ type: "START_EXECUTION", at: 200 },
			session("execution", { deferredToolCallId: "tool-1", planCardIds: ["card-1"], updatedAt: 200 }),
		],
		...["qa", "plan", "execution"].map((phase) => [session(phase), { type: "CLEAR" }, NO_PLAN_SESSION]),
	];
	for (const [from, event, to] of rows) {
		assert.deepEqual(planReducer(from, event), to, `${from.phase} + ${event.type}`);
	}
});

test("events that do not change the session return the same object", () => {
	const unchanged = [
		...["qa", "plan", "execution"].map((phase) => [session(phase), { type: "ENTER_PLAN_MODE", at: 200 }]),
		[session("execution"), { type: "START_EXECUTION", at: 200 }],
		[NO_PLAN_SESSION, { type: "CLEAR" }],
		[session("plan"), { type: "NOT_AN_EVENT" }],
		[session("plan"), undefined],
	];
	for (const [from, event] of unchanged) {
		assert.equal(planReducer(from, event), from, `${from.phase} + ${event?.type}`);
	}
});

test("a session expires once it has not changed for longer than the TTL", () => {
	assert.equal(isPlanSessionExpired(NO_PLAN_SESSION, { now: 10_000, ttlMs: 1 }), false);
	assert.equal(isPlanSessionExpired(session("execution"), { now: 1100, ttlMs: 1000 }), false);
	assert.equal(isPlanSessionExpired(session("execution"), { now: 1101, ttlMs: 1000 }), true);
});
