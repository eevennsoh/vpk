// @ts-check
"use strict";

const {
	NO_PLAN_SESSION,
	isPlanSessionExpired,
	planReducer,
} = require("./plan-session-machine");

// A session that has not changed for this long is dropped. It bounds a thread left in
// execution: a plain message keeps an execution session alive (see
// request-normalization.js), so without a TTL it lasted until the backend restarted.
const DEFAULT_PLAN_SESSION_TTL_MS = 6 * 60 * 60 * 1000;

function createPlanSessionStore({ now = () => Date.now(), ttlMs = DEFAULT_PLAN_SESSION_TTL_MS } = {}) {
	/** @type {Map<string, import("./plan-session-machine").PlanSession>} */
	const sessions = new Map();

	// Reads never create an entry; an expired entry is removed on read.
	function getPlanSession(threadId) {
		if (!threadId) {
			return NO_PLAN_SESSION;
		}
		const session = sessions.get(threadId);
		if (!session) {
			return NO_PLAN_SESSION;
		}
		if (isPlanSessionExpired(session, { now: now(), ttlMs })) {
			sessions.delete(threadId);
			return NO_PLAN_SESSION;
		}
		return session;
	}

	function dispatchPlanSessionEvent(threadId, event) {
		if (!threadId) {
			return NO_PLAN_SESSION;
		}
		const next = planReducer(getPlanSession(threadId), { ...event, at: now() });
		if (next.phase === "none") {
			sessions.delete(threadId);
		} else {
			sessions.set(threadId, next);
		}
		return next;
	}

	/**
	 * @param {string} threadId
	 * @param {{ deferredToolCallId?: string, planCardId?: string }} [emission]
	 */
	function recordPlanWidgetEmission(threadId, { deferredToolCallId, planCardId } = {}) {
		return dispatchPlanSessionEvent(threadId, { type: "PLAN_EMITTED", deferredToolCallId, planCardId });
	}

	function clearPlanSession(threadId) {
		dispatchPlanSessionEvent(threadId, { type: "CLEAR" });
	}

	/**
	 * On deferred-tool resume turns the original request's `isPlanMode` flag
	 * is absent. This helper checks whether the persisted plan session should
	 * re-activate `resolvedPlanModeActive` so downstream GenUI blocking and
	 * prompt instructions stay correct.
	 *
	 * @param {{ pausedToolCallRecord: unknown; resolvedPlanModeActive: boolean; threadId: string }} ctx
	 * @returns {{ shouldRestore: boolean; phase: string | null }}
	 */
	function shouldRestorePlanModeOnResume({ pausedToolCallRecord, resolvedPlanModeActive, threadId }) {
		if (!pausedToolCallRecord || resolvedPlanModeActive) {
			return { shouldRestore: false, phase: null };
		}
		const { phase } = getPlanSession(threadId);
		return phase === "none" ? { shouldRestore: false, phase: null } : { shouldRestore: true, phase };
	}

	/**
	 * True when the plan session for `threadId` is in the execution phase. During
	 * execution, all GenUI card routing is suppressed so that plan task outputs route
	 * to the artifact panel instead.
	 */
	function isPlanExecutionPhase(threadId) {
		return getPlanSession(threadId).phase === "execution";
	}

	return {
		clearPlanSession,
		dispatchPlanSessionEvent,
		getPlanSession,
		isPlanExecutionPhase,
		recordPlanWidgetEmission,
		shouldRestorePlanModeOnResume,
		size: () => sessions.size,
	};
}

const defaultStore = createPlanSessionStore();

module.exports = {
	DEFAULT_PLAN_SESSION_TTL_MS,
	clearPlanSession: defaultStore.clearPlanSession,
	createPlanSessionStore,
	dispatchPlanSessionEvent: defaultStore.dispatchPlanSessionEvent,
	getPlanSession: defaultStore.getPlanSession,
	isPlanExecutionPhase: defaultStore.isPlanExecutionPhase,
	recordPlanWidgetEmission: defaultStore.recordPlanWidgetEmission,
	shouldRestorePlanModeOnResume: defaultStore.shouldRestorePlanModeOnResume,
};
