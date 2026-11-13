"use strict";

// One thread's plan session as one state value, owned by plan-session.js.
//
//   none      --ENTER_PLAN_MODE-->  qa
//   any       --PLAN_EMITTED-->     plan        (keeps the last deferred tool call, adds the card)
//   none, qa, plan --START_EXECUTION--> execution
//   any       --CLEAR-->            none
//
// `phase` is the only status field: a session is active exactly when its phase is not
// "none". `updatedAt` is when the session last changed; plan-session.js expires a
// session that has not changed for its TTL. Events that do not change the state return
// the same object.

/**
 * @typedef {{
 *   phase: "none" | "qa" | "plan" | "execution";
 *   deferredToolCallId: string | null;
 *   planCardIds: readonly string[];
 *   updatedAt: number;
 * }} PlanSession
 */

const PLAN_SESSION_PHASES = Object.freeze(["none", "qa", "plan", "execution"]);

const NO_PLAN_SESSION = Object.freeze({
	phase: "none",
	deferredToolCallId: null,
	planCardIds: Object.freeze([]),
	updatedAt: 0,
});

function normalizeNonEmptyString(value) {
	if (typeof value !== "string") {
		return null;
	}
	const trimmedValue = value.trim();
	return trimmedValue.length > 0 ? trimmedValue : null;
}

function planReducer(state, event) {
	switch (event?.type) {
		case "ENTER_PLAN_MODE":
			return state.phase === "none" ? { ...NO_PLAN_SESSION, phase: "qa", updatedAt: event.at } : state;
		case "PLAN_EMITTED": {
			const deferredToolCallId = normalizeNonEmptyString(event.deferredToolCallId) ?? state.deferredToolCallId;
			const planCardId = normalizeNonEmptyString(event.planCardId);
			const planCardIds =
				planCardId && !state.planCardIds.includes(planCardId) ? [...state.planCardIds, planCardId] : state.planCardIds;
			return { phase: "plan", deferredToolCallId, planCardIds, updatedAt: event.at };
		}
		case "START_EXECUTION":
			return state.phase === "execution" ? state : { ...state, phase: "execution", updatedAt: event.at };
		case "CLEAR":
			return state.phase === "none" ? state : NO_PLAN_SESSION;
		default:
			return state;
	}
}

function isPlanSessionExpired(state, { now, ttlMs }) {
	return state.phase !== "none" && now - state.updatedAt > ttlMs;
}

module.exports = {
	NO_PLAN_SESSION,
	PLAN_SESSION_PHASES,
	isPlanSessionExpired,
	planReducer,
};
