// @ts-check
"use strict";

// The backend process lifecycle as one state value, owned by backend-shutdown.js.
//
//   starting  --LISTENING-->        listening
//   starting  --SIGNAL-->           draining   (signals: 1)
//   listening --SIGNAL-->           draining   (signals: 1)
//   draining  --SIGNAL-->           draining   (signals + 1)
//   draining  --DRAINED-->          stopped    (exitCode 0)
//   draining  --TIMED_OUT-->        stopped    (exitCode 1)
//   draining  --FORCED-->           stopped    (exitCode 1)
//
// Events that cannot change the state return the same object.

const BACKEND_PROCESS_STATUSES = Object.freeze(["starting", "listening", "draining", "stopped"]);

/**
 * @typedef {"starting" | "listening" | "draining" | "stopped"} BackendProcessStatus
 * @typedef {{ status: BackendProcessStatus, signals: number, exitCode: number | null }} BackendProcessState
 * @typedef {{ type: "LISTENING" | "SIGNAL" | "DRAINED" | "TIMED_OUT" | "FORCED" }} BackendProcessEvent
 */

/** @type {Readonly<BackendProcessState>} */
const INITIAL_BACKEND_PROCESS = Object.freeze({ status: "starting", signals: 0, exitCode: null });

// A second signal while draining is ignored; the third forces exit.
const FORCE_EXIT_SIGNAL_COUNT = 3;

/**
 * @param {Readonly<BackendProcessState>} state
 * @param {BackendProcessEvent} event
 * @returns {Readonly<BackendProcessState>}
 */
function transitionBackendProcess(state, event) {
	switch (event?.type) {
		case "LISTENING":
			return state.status === "starting" ? { ...state, status: "listening" } : state;
		case "SIGNAL":
			if (state.status === "stopped") return state;
			return { ...state, status: "draining", signals: state.signals + 1 };
		case "DRAINED":
			return state.status === "draining" ? { ...state, status: "stopped", exitCode: 0 } : state;
		case "TIMED_OUT":
		case "FORCED":
			return state.status === "draining" ? { ...state, status: "stopped", exitCode: 1 } : state;
		default:
			return state;
	}
}

// What a signal that produced `state` asks for.
//   drain      — the first signal: run the shutdown steps
//   ignore     — a repeat signal while the steps run
//   force-exit — enough repeats: stop waiting
//   none       — the process already stopped
/** @param {Readonly<BackendProcessState>} state */
function decideSignalAction(state) {
	if (state.status !== "draining") return { action: "none" };
	if (state.signals === 1) return { action: "drain" };
	if (state.signals >= FORCE_EXIT_SIGNAL_COUNT) return { action: "force-exit" };
	return { action: "ignore" };
}

module.exports = {
	BACKEND_PROCESS_STATUSES,
	FORCE_EXIT_SIGNAL_COUNT,
	INITIAL_BACKEND_PROCESS,
	decideSignalAction,
	transitionBackendProcess,
};
