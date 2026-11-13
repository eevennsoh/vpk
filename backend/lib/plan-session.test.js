"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const planSessionModule = require("./plan-session");
const { NO_PLAN_SESSION } = require("./plan-session-machine");

const { DEFAULT_MAX_PLAN_SESSIONS, DEFAULT_PLAN_SESSION_TTL_MS, createPlanSessionStore } = planSessionModule;

// Each test gets its own store with an injected clock; nothing waits on real time.
function createStore({ ttlMs = 1000 } = {}) {
	const clock = { now: 100 };
	const store = createPlanSessionStore({ now: () => clock.now, ttlMs });
	return { clock, store };
}

function storeWith(seed) {
	const { clock, store } = createStore();
	for (const [threadId, events] of Object.entries(seed)) {
		for (const event of events) store.dispatchPlanSessionEvent(threadId, event);
	}
	return { clock, store };
}

const QA = [{ type: "ENTER_PLAN_MODE" }];
const PLAN = [{ type: "ENTER_PLAN_MODE" }, { type: "PLAN_EMITTED", deferredToolCallId: "tool-plan", planCardId: "plan-card-1" }];
const EXECUTION = [...PLAN, { type: "START_EXECUTION" }];
const BAD_THREAD_IDS = [null, undefined, ""];

const restore = (store, overrides = {}) =>
	store.shouldRestorePlanModeOnResume({
		pausedToolCallRecord: { toolCallId: "tc-1" },
		resolvedPlanModeActive: false,
		threadId: "t1",
		...overrides,
	});

describe("plan-session module", () => {
	it("exports one default store over the event API", () => {
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
});

describe("getPlanSession", () => {
	it("returns default inactive session for unknown thread", () => {
		const { store } = createStore();
		const session = store.getPlanSession("thread-new");
		assert.equal(session.phase, "none");
		assert.equal(session.deferredToolCallId, null);
		assert.deepEqual(session.planCardIds, []);
	});

	it("returns default for null/undefined/empty threadId", () => {
		const { store } = createStore();
		for (const threadId of BAD_THREAD_IDS) {
			assert.equal(store.getPlanSession(threadId), NO_PLAN_SESSION);
		}
	});

	it("does not create a session by reading", () => {
		const { store } = createStore();
		store.getPlanSession("t1");
		store.isPlanExecutionPhase("t1");
		restore(store);
		assert.equal(store.size(), 0);
	});

	it("returns the same reference for the same threadId", () => {
		const { store } = storeWith({ t1: QA });
		assert.equal(store.getPlanSession("t1"), store.getPlanSession("t1"));
	});

	it("returns different objects for different threadIds", () => {
		const { store } = storeWith({ t1: QA, t2: QA });
		assert.notEqual(store.getPlanSession("t1"), store.getPlanSession("t2"));
	});
});

describe("dispatchPlanSessionEvent", () => {
	it("starts a qa session on first ENTER_PLAN_MODE", () => {
		const { store } = createStore();
		const session = store.dispatchPlanSessionEvent("t1", { type: "ENTER_PLAN_MODE" });
		assert.equal(session.phase, "qa");
		assert.equal(store.getPlanSession("t1"), session);
	});

	it("transitions phase from qa to plan", () => {
		const { store } = storeWith({ t1: QA });
		store.dispatchPlanSessionEvent("t1", { type: "PLAN_EMITTED" });
		assert.equal(store.getPlanSession("t1").phase, "plan");
	});

	it("accumulates planCardIds across updates", () => {
		const { store } = storeWith({ t1: QA });
		store.dispatchPlanSessionEvent("t1", { type: "PLAN_EMITTED", planCardId: "card-1" });
		assert.deepEqual(store.getPlanSession("t1").planCardIds, ["card-1"]);
		store.dispatchPlanSessionEvent("t1", { type: "PLAN_EMITTED", planCardId: "card-2" });
		assert.deepEqual(store.getPlanSession("t1").planCardIds, ["card-1", "card-2"]);
	});

	it("is a no-op for null/undefined/empty threadId", () => {
		const { store } = createStore();
		for (const threadId of BAD_THREAD_IDS) {
			assert.equal(store.dispatchPlanSessionEvent(threadId, { type: "ENTER_PLAN_MODE" }), NO_PLAN_SESSION);
			assert.equal(store.recordPlanWidgetEmission(threadId, { planCardId: "card-1" }), NO_PLAN_SESSION);
		}
		assert.equal(store.size(), 0);
	});
});

describe("recordPlanWidgetEmission", () => {
	it("activates the session, transitions to plan, and records plan metadata", () => {
		const { store } = createStore();
		const session = store.recordPlanWidgetEmission("t1", { deferredToolCallId: "tool-plan-1", planCardId: "plan-card-1" });
		assert.equal(session.phase, "plan");
		assert.equal(session.deferredToolCallId, "tool-plan-1");
		assert.deepEqual(session.planCardIds, ["plan-card-1"]);
	});

	it("deduplicates repeated plan card ids while refreshing the deferred tool call", () => {
		const { store } = createStore();
		store.recordPlanWidgetEmission("t1", { deferredToolCallId: "tool-plan-1", planCardId: "plan-card-1" });
		const session = store.recordPlanWidgetEmission("t1", { deferredToolCallId: "tool-plan-2", planCardId: "plan-card-1" });
		assert.equal(session.phase, "plan");
		assert.equal(session.deferredToolCallId, "tool-plan-2");
		assert.deepEqual(session.planCardIds, ["plan-card-1"]);
	});
});

describe("clearPlanSession", () => {
	it("removes the session for a thread", () => {
		const { store } = storeWith({ t1: PLAN });
		store.clearPlanSession("t1");
		assert.equal(store.getPlanSession("t1"), NO_PLAN_SESSION);
		assert.equal(store.size(), 0);
	});

	it("is idempotent", () => {
		const { store } = storeWith({ t1: QA });
		store.clearPlanSession("t1");
		store.clearPlanSession("t1");
		assert.equal(store.getPlanSession("t1"), NO_PLAN_SESSION);
	});

	it("is a no-op for null/undefined/empty threadId", () => {
		const { store } = storeWith({ t1: QA });
		for (const threadId of BAD_THREAD_IDS) store.clearPlanSession(threadId);
		assert.equal(store.getPlanSession("t1").phase, "qa");
	});

	it("does not affect other threads", () => {
		const { store } = storeWith({ t1: QA, t2: PLAN });
		store.clearPlanSession("t1");
		assert.equal(store.getPlanSession("t1"), NO_PLAN_SESSION);
		assert.equal(store.getPlanSession("t2").phase, "plan");
	});
});

describe("shouldRestorePlanModeOnResume (Test Case 4 core logic)", () => {
	it("restores plan mode when resuming with an active plan session", () => {
		const { store } = storeWith({ t1: QA });
		assert.deepEqual(restore(store), { shouldRestore: true, phase: "qa" });
	});

	it("does not restore when no paused tool call record", () => {
		const { store } = storeWith({ t1: QA });
		assert.equal(restore(store, { pausedToolCallRecord: null }).shouldRestore, false);
	});

	it("does not restore when resolvedPlanModeActive is already true", () => {
		const { store } = storeWith({ t1: QA });
		assert.equal(restore(store, { resolvedPlanModeActive: true }).shouldRestore, false);
	});

	it("does not restore when plan session is inactive", () => {
		const { store } = createStore();
		assert.deepEqual(restore(store), { shouldRestore: false, phase: null });
	});

	it("does not restore when plan session was cleared", () => {
		const { store } = storeWith({ t1: QA });
		store.clearPlanSession("t1");
		assert.equal(restore(store).shouldRestore, false);
	});

	it("reports correct phase when restoring from plan phase", () => {
		const { store } = storeWith({ t1: PLAN });
		assert.deepEqual(restore(store), { shouldRestore: true, phase: "plan" });
	});

	it("reports execution phase when restoring during build orchestration", () => {
		const { store } = storeWith({ t1: EXECUTION });
		assert.deepEqual(restore(store, { pausedToolCallRecord: { toolCallId: "tc-exec" } }), { shouldRestore: true, phase: "execution" });
	});

	it("treats any truthy pausedToolCallRecord as a deferred resume signal", () => {
		const { store } = storeWith({ t1: QA });
		assert.deepEqual(restore(store, { pausedToolCallRecord: {} }), { shouldRestore: true, phase: "qa" });
	});

	it("does not restore for null/undefined/empty threadId", () => {
		const { store } = storeWith({ t1: QA });
		for (const threadId of BAD_THREAD_IDS) {
			assert.deepEqual(restore(store, { threadId }), { shouldRestore: false, phase: null });
		}
	});
});

describe("full plan lifecycle (Q&A → plan widget → acceptance)", () => {
	it("tracks the full phase transition: qa → plan", () => {
		const { store } = storeWith({ t1: QA });
		assert.equal(store.getPlanSession("t1").phase, "qa");
		store.recordPlanWidgetEmission("t1", { deferredToolCallId: "tool-plan", planCardId: "plan-card-1" });
		const session = store.getPlanSession("t1");
		assert.equal(session.phase, "plan");
		assert.equal(session.deferredToolCallId, "tool-plan");
		assert.deepEqual(session.planCardIds, ["plan-card-1"]);
	});

	it("restore works mid-lifecycle (Q&A answer resume)", () => {
		const { store } = storeWith({ t1: QA });
		assert.deepEqual(restore(store, { pausedToolCallRecord: { toolCallId: "tc-qa" } }), { shouldRestore: true, phase: "qa" });
		store.recordPlanWidgetEmission("t1", { planCardId: "plan-card-1" });
		assert.equal(store.getPlanSession("t1").phase, "plan");
	});

	it("clearing after acceptance resets everything", () => {
		const { store } = storeWith({ t1: EXECUTION });
		store.clearPlanSession("t1");
		const session = store.getPlanSession("t1");
		assert.equal(session.phase, "none");
		assert.equal(session.deferredToolCallId, null);
		assert.deepEqual(session.planCardIds, []);
	});

	it("accepting a plan keeps its deferred tool call and cards into execution", () => {
		const { store } = storeWith({ t1: EXECUTION });
		const session = store.getPlanSession("t1");
		assert.equal(session.phase, "execution");
		assert.equal(session.deferredToolCallId, "tool-plan");
		assert.deepEqual(session.planCardIds, ["plan-card-1"]);
	});

	it("GenUI blocking scenario: planSessionActive stays true on resume", () => {
		const { store } = storeWith({ t1: QA });
		assert.equal(restore(store).shouldRestore, true);
		assert.notEqual(store.getPlanSession("t1").phase, "none", "the session stays active so post-tool GenUI is blocked");
	});
});

describe("toggle off — Plan OFF clears session (Test Case 9)", () => {
	for (const [phase, seed] of [["qa", QA], ["plan", PLAN]]) {
		it(`clearPlanSession removes active session when user toggles Plan off during ${phase}`, () => {
			const { store } = storeWith({ t1: seed });
			store.clearPlanSession("t1");
			const session = store.getPlanSession("t1");
			assert.equal(session.phase, "none");
			assert.equal(session.deferredToolCallId, null);
			assert.deepEqual(session.planCardIds, []);
		});

		it(`after toggle off during ${phase}, new message does not inherit plan context`, () => {
			const { store } = storeWith({ t1: seed });
			store.clearPlanSession("t1");
			assert.equal(restore(store).shouldRestore, false, "after toggle off, resume must not restore plan mode");
			const fresh = store.dispatchPlanSessionEvent("t1", { type: "ENTER_PLAN_MODE" });
			assert.deepEqual(
				{ phase: fresh.phase, deferredToolCallId: fresh.deferredToolCallId, planCardIds: fresh.planCardIds },
				{ phase: "qa", deferredToolCallId: null, planCardIds: [] },
			);
		});
	}

	it("toggle off during plan phase clears everything including planCardIds", () => {
		const { store } = storeWith({ t1: [...PLAN, { type: "PLAN_EMITTED", planCardId: "plan-card-2" }] });
		assert.deepEqual(store.getPlanSession("t1").planCardIds, ["plan-card-1", "plan-card-2"]);
		store.clearPlanSession("t1");
		assert.deepEqual(store.getPlanSession("t1").planCardIds, []);
	});

	it("GenUI is no longer blocked after toggle off", () => {
		const { store } = storeWith({ t1: QA });
		assert.equal(store.getPlanSession("t1").phase, "qa");
		store.clearPlanSession("t1");
		assert.equal(store.getPlanSession("t1").phase, "none");
	});

	it("toggle off on one thread does not affect another thread's plan session", () => {
		const { store } = storeWith({ t1: PLAN, t2: EXECUTION });
		store.clearPlanSession("t1");
		assert.equal(store.getPlanSession("t2").phase, "execution");
	});
});

describe("cancel flow — Skip clears plan session (Test Case 5)", () => {
	for (const [phase, seed] of [["qa", QA], ["plan", PLAN]]) {
		it(`clearPlanSession removes active ${phase}-phase session (skip cancels planning)`, () => {
			const { store } = storeWith({ t1: seed });
			store.clearPlanSession("t1");
			const session = store.getPlanSession("t1");
			assert.equal(session.phase, "none");
			assert.deepEqual(session.planCardIds, []);
		});

		it(`subsequent messages after cancel during ${phase} start fresh (no stale plan context)`, () => {
			const { store } = storeWith({ t1: seed });
			store.clearPlanSession("t1");
			assert.equal(store.getPlanSession("t1"), NO_PLAN_SESSION);
			assert.equal(store.dispatchPlanSessionEvent("t1", { type: "ENTER_PLAN_MODE" }).phase, "qa", "a new plan session can start after cancel");
		});
	}

	it("restore returns false after cancel clears the session", () => {
		const { store } = storeWith({ t1: QA });
		store.clearPlanSession("t1");
		assert.equal(restore(store, { pausedToolCallRecord: { toolCallId: "tc-cancelled" } }).shouldRestore, false);
	});

	it("cancel on one thread does not affect another thread's plan session", () => {
		const { store } = storeWith({ t1: QA, t2: PLAN });
		store.clearPlanSession("t1");
		assert.equal(store.getPlanSession("t1"), NO_PLAN_SESSION);
		assert.equal(store.getPlanSession("t2").phase, "plan");
	});
});

describe("isPlanExecutionPhase", () => {
	it("returns false for unknown thread", () => {
		const { store } = createStore();
		assert.equal(store.isPlanExecutionPhase("unknown-thread"), false);
	});

	it("returns false for null/undefined/empty threadId", () => {
		const { store } = createStore();
		for (const threadId of BAD_THREAD_IDS) assert.equal(store.isPlanExecutionPhase(threadId), false);
	});

	it("returns false when session is in qa phase", () => {
		const { store } = storeWith({ t1: QA });
		assert.equal(store.isPlanExecutionPhase("t1"), false);
	});

	it("returns false when session is in plan phase", () => {
		const { store } = storeWith({ t1: PLAN });
		assert.equal(store.isPlanExecutionPhase("t1"), false);
	});

	it("returns true when session is in execution phase", () => {
		const { store } = storeWith({ t1: EXECUTION });
		assert.equal(store.isPlanExecutionPhase("t1"), true);
	});

	it("returns false after session is cleared", () => {
		const { store } = storeWith({ t1: EXECUTION });
		store.clearPlanSession("t1");
		assert.equal(store.isPlanExecutionPhase("t1"), false);
	});

	it("transitions correctly through full lifecycle", () => {
		const { store } = createStore();
		store.dispatchPlanSessionEvent("t1", { type: "ENTER_PLAN_MODE" });
		assert.equal(store.isPlanExecutionPhase("t1"), false);
		store.dispatchPlanSessionEvent("t1", { type: "PLAN_EMITTED" });
		assert.equal(store.isPlanExecutionPhase("t1"), false);
		store.dispatchPlanSessionEvent("t1", { type: "START_EXECUTION" });
		assert.equal(store.isPlanExecutionPhase("t1"), true);
	});
});

describe("TTL", () => {
	it("expires a session that has not changed for longer than the TTL", () => {
		const { clock, store } = storeWith({ t1: [{ type: "START_EXECUTION" }] });
		clock.now = 1100;
		assert.equal(store.isPlanExecutionPhase("t1"), true, "still live at exactly the TTL");
		clock.now = 1101;
		assert.equal(store.isPlanExecutionPhase("t1"), false);
		assert.equal(store.size(), 0, "the expired entry is removed");
		assert.deepEqual(restore(store), { shouldRestore: false, phase: null });
	});

	it("runs from the last change, and a no-op event does not extend it", () => {
		const { clock, store } = storeWith({ t1: QA });
		clock.now = 900;
		store.recordPlanWidgetEmission("t1", { planCardId: "card-1" });
		clock.now = 1800;
		assert.equal(store.getPlanSession("t1").phase, "plan", "the emission at 900 restarted the TTL");
		store.dispatchPlanSessionEvent("t1", { type: "ENTER_PLAN_MODE" });
		clock.now = 1901;
		assert.equal(store.getPlanSession("t1"), NO_PLAN_SESSION, "ENTER_PLAN_MODE on an active session is a no-op");
	});
});

describe("count bound", () => {
	function boundedStore(maxSessions) {
		const clock = { now: 100 };
		const store = createPlanSessionStore({ maxSessions, now: () => clock.now, ttlMs: 1000 });
		return { clock, store };
	}

	it("keeps at most maxSessions entries, also for threads never read again", () => {
		assert.equal(DEFAULT_MAX_PLAN_SESSIONS, 1000);
		const { clock, store } = boundedStore(3);
		for (let index = 0; index < 20; index += 1) {
			clock.now += 1;
			store.dispatchPlanSessionEvent(`t${index}`, { type: "ENTER_PLAN_MODE" });
			assert.ok(store.size() <= 3, `after ${index + 1} threads: ${store.size()}`);
		}
		assert.deepEqual(["t17", "t18", "t19"].map((id) => store.getPlanSession(id).phase), ["qa", "qa", "qa"]);
	});

	it("evicts expired sessions before a live one", () => {
		const { clock, store } = boundedStore(2);
		store.dispatchPlanSessionEvent("expired", { type: "ENTER_PLAN_MODE" });
		clock.now = 900;
		for (const event of EXECUTION) store.dispatchPlanSessionEvent("live", event);
		clock.now = 1200; // "expired" is past its TTL (written at 100); "live" is not (900)
		store.dispatchPlanSessionEvent("new", { type: "ENTER_PLAN_MODE" });
		assert.equal(store.size(), 2);
		assert.equal(store.isPlanExecutionPhase("live"), true, "the live execution session is kept");
		assert.equal(store.getPlanSession("new").phase, "qa");
	});

	it("when every session is live, the least recently dispatched one goes, never the one in use", () => {
		const { clock, store } = boundedStore(2);
		for (const event of EXECUTION) store.dispatchPlanSessionEvent("in-use", event);
		clock.now = 110;
		store.dispatchPlanSessionEvent("idle", { type: "ENTER_PLAN_MODE" });
		clock.now = 120;
		// A turn on the execution thread dispatches again (a no-op), which keeps it newest.
		store.dispatchPlanSessionEvent("in-use", { type: "START_EXECUTION" });
		clock.now = 130;
		store.dispatchPlanSessionEvent("new", { type: "ENTER_PLAN_MODE" });
		assert.equal(store.isPlanExecutionPhase("in-use"), true);
		assert.equal(store.getPlanSession("idle"), NO_PLAN_SESSION);
		assert.equal(store.getPlanSession("new").phase, "qa");
	});

	it("re-dispatching an existing thread in a full store evicts nothing", () => {
		const { store } = boundedStore(2);
		store.dispatchPlanSessionEvent("a", { type: "ENTER_PLAN_MODE" });
		store.dispatchPlanSessionEvent("b", { type: "ENTER_PLAN_MODE" });
		store.recordPlanWidgetEmission("a", { planCardId: "card-1" });
		assert.equal(store.size(), 2);
		assert.equal(store.getPlanSession("a").phase, "plan");
		assert.equal(store.getPlanSession("b").phase, "qa");
	});
});
