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

// The TTL is checked only when that thread is read again, so a thread that is never read
// again kept its entry forever. At most this many sessions are kept (provisional: one
// person creates a plan session per thread that enters plan mode, far fewer than this in
// 6 hours). A write into a full store removes the expired entries first, then the least
// recently dispatched one.
const DEFAULT_MAX_PLAN_SESSIONS = 1000;

function createPlanSessionStore({
	maxSessions = DEFAULT_MAX_PLAN_SESSIONS,
	now = () => Date.now(),
	ttlMs = DEFAULT_PLAN_SESSION_TTL_MS,
} = {}) {
	/** @type {Map<string, import("./plan-session-machine").PlanSession>} Map order is write order. */
	const sessions = new Map();

	function sweepExpired(currentTime) {
		for (const [threadId, session] of sessions) {
			if (isPlanSessionExpired(session, { now: currentTime, ttlMs })) {
				sessions.delete(threadId);
			}
		}
	}

	function writeSession(threadId, session, currentTime) {
		sessions.delete(threadId);
		if (sessions.size >= maxSessions) {
			sweepExpired(currentTime);
		}
		while (sessions.size >= maxSessions) {
			sessions.delete(sessions.keys().next().value);
		}
		sessions.set(threadId, session);
	}

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
		const currentTime = now();
		const next = planReducer(getPlanSession(threadId), { ...event, at: currentTime });
		if (next.phase === "none") {
			sessions.delete(threadId);
		} else {
			writeSession(threadId, next, currentTime);
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
	DEFAULT_MAX_PLAN_SESSIONS,
	DEFAULT_PLAN_SESSION_TTL_MS,
	clearPlanSession: defaultStore.clearPlanSession,
	createPlanSessionStore,
	dispatchPlanSessionEvent: defaultStore.dispatchPlanSessionEvent,
	getPlanSession: defaultStore.getPlanSession,
	isPlanExecutionPhase: defaultStore.isPlanExecutionPhase,
	recordPlanWidgetEmission: defaultStore.recordPlanWidgetEmission,
	shouldRestorePlanModeOnResume: defaultStore.shouldRestorePlanModeOnResume,
};
