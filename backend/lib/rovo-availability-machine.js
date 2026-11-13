"use strict";

// Rovo Serve availability as one state value, owned by rovo-availability-service.js.
//
//   unknown | available | unavailable  --CHECK_STARTED-->             checking
//   checking                           --CHECK_FINISHED{available}--> available | unavailable
//   checking                           --CHECK_FAILED-->              unavailable
//
// `checkedAt` is when the last check completed (0 before the first one); a check in
// flight keeps the previous value. Events that cannot happen in a state return the
// same object.

const ROVO_AVAILABILITY_STATUSES = Object.freeze(["unknown", "checking", "available", "unavailable"]);

const INITIAL_ROVO_AVAILABILITY = Object.freeze({ status: "unknown", checkedAt: 0 });

function transitionRovoAvailability(state, event) {
	switch (event?.type) {
		case "CHECK_STARTED":
			return state.status === "checking" ? state : { status: "checking", checkedAt: state.checkedAt };
		case "CHECK_FINISHED":
			if (state.status !== "checking") return state;
			return { status: event.available === true ? "available" : "unavailable", checkedAt: event.at };
		case "CHECK_FAILED":
			if (state.status !== "checking") return state;
			return { status: "unavailable", checkedAt: event.at };
		default:
			return state;
	}
}

// What a caller asking "is Rovo available?" should do now.
//   join       — a check is in flight; wait for its result
//   refresh    — start a check (`reason` says why)
//   use-cached — the last check said available and is still fresh
function decideRovoAvailabilityRead(state, { now, portFilesPresent, refreshIntervalMs }) {
	if (state.status === "checking") return { action: "join" };
	if (state.status !== "available") return { action: "refresh", reason: state.status };
	if (!portFilesPresent) return { action: "refresh", reason: "port-files-missing" };
	if (now - state.checkedAt > refreshIntervalMs) return { action: "refresh", reason: "stale" };
	return { action: "use-cached" };
}

module.exports = {
	INITIAL_ROVO_AVAILABILITY,
	ROVO_AVAILABILITY_STATUSES,
	decideRovoAvailabilityRead,
	transitionRovoAvailability,
};
