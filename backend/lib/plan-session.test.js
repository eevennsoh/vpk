"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const planSessionModule = require("./plan-session");
const { NO_PLAN_SESSION } = require("./plan-session-machine");

const { DEFAULT_PLAN_SESSION_TTL_MS, createPlanSessionStore } = planSessionModule;

function createStore({ ttlMs = 1000 } = {}) {
	const clock = { now: 100 };
	const store = createPlanSessionStore({ now: () => clock.now, ttlMs });
	return { clock, store };
}

const RESUME = { pausedToolCallRecord: { toolCallId: "tc-1" }, resolvedPlanModeActive: false };

test("the module exports one default store", () => {
	assert.equal(DEFAULT_PLAN_SESSION_TTL_MS, 6 * 60 * 60 * 1000);
	for (const name of [
		"clearPlanSession",
		"dispatchPlanSessionEvent",
		"getPlanSession",
		"isPlanExecutionPhase",
		"recordPlanWidgetEmission",
		"shouldRestorePlanModeOnResume",
	]) {
		assert.equal(typeof planSessionModule[name], "function", name);
	}
	assert.equal("updatePlanSession" in planSessionModule, false);
});

test("an unknown or missing thread has no session, and reading does not create one", () => {
	const { store } = createStore();
	for (const threadId of ["thread-new", null, undefined, ""]) {
		assert.equal(store.getPlanSession(threadId), NO_PLAN_SESSION);
		assert.equal(store.isPlanExecutionPhase(threadId), false);
		assert.deepEqual(store.shouldRestorePlanModeOnResume({ ...RESUME, threadId }), { shouldRestore: false, phase: null });
	}
	assert.equal(store.size(), 0);
	assert.equal(store.dispatchPlanSessionEvent(null, { type: "ENTER_PLAN_MODE" }), NO_PLAN_SESSION);
	assert.equal(store.size(), 0);
});

test("the full lifecycle: qa -> plan -> execution -> cleared", () => {
	const { clock, store } = createStore();
	store.dispatchPlanSessionEvent("t1", { type: "ENTER_PLAN_MODE" });
	assert.equal(store.getPlanSession("t1").phase, "qa");
	assert.equal(store.isPlanExecutionPhase("t1"), false);

	clock.now = 200;
	const planned = store.recordPlanWidgetEmission("t1", { deferredToolCallId: "tool-plan-1", planCardId: "plan-card-1" });
	assert.deepEqual(planned, { phase: "plan", deferredToolCallId: "tool-plan-1", planCardIds: ["plan-card-1"], updatedAt: 200 });
	assert.equal(store.getPlanSession("t1"), planned);

	store.dispatchPlanSessionEvent("t1", { type: "START_EXECUTION" });
	assert.equal(store.isPlanExecutionPhase("t1"), true);
	assert.deepEqual(store.shouldRestorePlanModeOnResume({ ...RESUME, threadId: "t1" }), { shouldRestore: true, phase: "execution" });

	store.clearPlanSession("t1");
	assert.equal(store.getPlanSession("t1"), NO_PLAN_SESSION);
	assert.equal(store.isPlanExecutionPhase("t1"), false);
	assert.equal(store.size(), 0);
});

test("clearing is idempotent and per thread", () => {
	const { store } = createStore();
	store.dispatchPlanSessionEvent("t1", { type: "ENTER_PLAN_MODE" });
	store.recordPlanWidgetEmission("t2", { planCardId: "card-2" });
	store.clearPlanSession("t1");
	store.clearPlanSession("t1");
	assert.equal(store.getPlanSession("t1"), NO_PLAN_SESSION);
	assert.equal(store.getPlanSession("t2").phase, "plan");
	assert.equal(store.size(), 1);
});

test("restoring plan mode on a resume turn", () => {
	const { store } = createStore();
	store.dispatchPlanSessionEvent("t1", { type: "ENTER_PLAN_MODE" });
	assert.deepEqual(store.shouldRestorePlanModeOnResume({ ...RESUME, threadId: "t1" }), { shouldRestore: true, phase: "qa" });
	// Any truthy paused record counts as a resume signal.
	assert.deepEqual(store.shouldRestorePlanModeOnResume({ ...RESUME, pausedToolCallRecord: {}, threadId: "t1" }), {
		shouldRestore: true,
		phase: "qa",
	});
	assert.deepEqual(store.shouldRestorePlanModeOnResume({ ...RESUME, pausedToolCallRecord: null, threadId: "t1" }), {
		shouldRestore: false,
		phase: null,
	});
	assert.deepEqual(store.shouldRestorePlanModeOnResume({ ...RESUME, resolvedPlanModeActive: true, threadId: "t1" }), {
		shouldRestore: false,
		phase: null,
	});
	store.clearPlanSession("t1");
	assert.deepEqual(store.shouldRestorePlanModeOnResume({ ...RESUME, threadId: "t1" }), { shouldRestore: false, phase: null });
});

test("a session that has not changed for longer than the TTL expires", () => {
	const { clock, store } = createStore({ ttlMs: 1000 });
	store.dispatchPlanSessionEvent("t1", { type: "START_EXECUTION" });
	clock.now = 1100;
	assert.equal(store.isPlanExecutionPhase("t1"), true, "still live at exactly the TTL");
	clock.now = 1101;
	assert.equal(store.isPlanExecutionPhase("t1"), false);
	assert.equal(store.size(), 0, "the expired entry is removed");
	assert.deepEqual(store.shouldRestorePlanModeOnResume({ ...RESUME, threadId: "t1" }), { shouldRestore: false, phase: null });
});

test("the TTL runs from the last change, and a no-op event does not extend it", () => {
	const { clock, store } = createStore({ ttlMs: 1000 });
	store.dispatchPlanSessionEvent("t1", { type: "ENTER_PLAN_MODE" });
	clock.now = 900;
	store.recordPlanWidgetEmission("t1", { planCardId: "card-1" });
	clock.now = 1800;
	assert.equal(store.getPlanSession("t1").phase, "plan", "the emission at 900 restarted the TTL");
	store.dispatchPlanSessionEvent("t1", { type: "ENTER_PLAN_MODE" });
	clock.now = 1901;
	assert.equal(store.getPlanSession("t1"), NO_PLAN_SESSION, "ENTER_PLAN_MODE on an active session is a no-op");
});
