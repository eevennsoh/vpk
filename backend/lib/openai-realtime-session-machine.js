"use strict";

// The realtime session (SM-BT-12): not_initialized → connecting → ready → refreshing → closed.
// `connecting` lasts from connect() until OpenAI's session.created; `refreshing` from the
// planned close before the session's maximum lifetime until the upstream closes (the
// browser then reconnects with a new session). `closed` is terminal.
const SESSION_STATE = Object.freeze({
	NOT_INITIALIZED: "not_initialized",
	CONNECTING: "connecting",
	READY: "ready",
	REFRESHING: "refreshing",
	CLOSED: "closed",
});

/**
 * @typedef {typeof SESSION_STATE[keyof typeof SESSION_STATE]} SessionState
 * @typedef {{ type: "connect" } | { type: "session-created" } | { type: "refresh" } | { type: "close" }} SessionEvent
 */

/**
 * @param {SessionState} state
 * @param {SessionEvent} event
 * @returns {SessionState}
 */
function sessionReducer(state, event) {
	if (state === SESSION_STATE.CLOSED) {
		return state;
	}
	switch (event?.type) {
		case "connect":
			return state === SESSION_STATE.NOT_INITIALIZED ? SESSION_STATE.CONNECTING : state;
		case "session-created":
			return state === SESSION_STATE.REFRESHING ? state : SESSION_STATE.READY;
		case "refresh":
			return state === SESSION_STATE.READY || state === SESSION_STATE.CONNECTING
				? SESSION_STATE.REFRESHING
				: state;
		case "close":
			return SESSION_STATE.CLOSED;
		default:
			return state;
	}
}

// The model response in flight, if any. OpenAI rejects a response.create while one is
// active, so a request then waits in `pending` (forced if any waiting request was) until
// the active response is done.
/**
 * @typedef {{ phase: "idle" | "active", id: string | null, pending: null | { force: boolean } }} ResponseState
 * @typedef {{ type: "created", id?: unknown }
 *   | { type: "done" }
 *   | { type: "request", force?: boolean }
 *   | { type: "take-pending" }
 *   | { type: "drop-pending" }
 *   | { type: "reset" }} ResponseEvent
 */

/** @type {ResponseState} */
const IDLE_RESPONSE = Object.freeze({ phase: "idle", id: null, pending: null });

/**
 * @param {ResponseState} response
 * @param {ResponseEvent} event
 * @returns {ResponseState}
 */
function responseReducer(response, event) {
	switch (event?.type) {
		case "created":
			// A response.created without an id cannot be matched to its done, so it does
			// not hold back later requests.
			return typeof event.id === "string" && event.id
				? { phase: "active", id: event.id, pending: response.pending }
				: { phase: "idle", id: null, pending: response.pending };
		case "done":
			return { phase: "idle", id: null, pending: response.pending };
		case "request":
			return response.phase === "active"
				? { ...response, pending: { force: Boolean(response.pending?.force) || event.force === true } }
				: response;
		case "take-pending":
		case "drop-pending":
			return response.pending ? { ...response, pending: null } : response;
		case "reset":
			return IDLE_RESPONSE;
		default:
			return response;
	}
}

module.exports = {
	IDLE_RESPONSE,
	SESSION_STATE,
	responseReducer,
	sessionReducer,
};
