"use strict";

// The managed run's status (SM-BT-3): queued → streaming ⇄ background → completed | failed |
// cancelled. A terminal status never changes again; the run manager removes a run from its
// registry in the same step that makes it terminal, so a caller still holding the run object
// can tell that it has been settled.
const RUN_TERMINAL_STATUSES = Object.freeze(["completed", "failed", "cancelled"]);

/** @param {unknown} status */
function isTerminalRunStatus(status) {
	return typeof status === "string" && RUN_TERMINAL_STATUSES.includes(status);
}

/**
 * @typedef {"queued" | "streaming" | "background" | "completed" | "failed" | "cancelled"} RunStatus
 * @typedef {{ type: "start", streaming: boolean }
 *   | { type: "attach" }
 *   | { type: "detach" }
 *   | { type: "settle", outcome: "completed" | "failed" | "cancelled" }} RunEvent
 */

/**
 * @param {RunStatus} status
 * @param {RunEvent} event
 * @returns {RunStatus}
 */
function runReducer(status, event) {
	if (isTerminalRunStatus(status)) {
		return status;
	}
	switch (event?.type) {
		case "start":
			return event.streaming ? "streaming" : "background";
		case "attach":
			// A subscriber on a queued run waits for it to start.
			return status === "background" ? "streaming" : status;
		case "detach":
			return status === "streaming" ? "background" : status;
		case "settle":
			return isTerminalRunStatus(event.outcome) ? event.outcome : status;
		default:
			return status;
	}
}

module.exports = {
	RUN_TERMINAL_STATUSES,
	isTerminalRunStatus,
	runReducer,
};
