"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	BACKEND_PROCESS_STATUSES,
	INITIAL_BACKEND_PROCESS,
	decideSignalAction,
	transitionBackendProcess,
} = require("./backend-process-machine");

const at = (status, signals = 0, exitCode = null) => ({ status, signals, exitCode });

test("the process starts in starting", () => {
	assert.deepEqual(BACKEND_PROCESS_STATUSES, ["starting", "listening", "draining", "stopped"]);
	assert.deepEqual(INITIAL_BACKEND_PROCESS, at("starting"));
});

test("transition table", () => {
	const rows = [
		[at("starting"), { type: "LISTENING" }, at("listening")],
		[at("starting"), { type: "SIGNAL" }, at("draining", 1)],
		[at("listening"), { type: "SIGNAL" }, at("draining", 1)],
		[at("draining", 1), { type: "SIGNAL" }, at("draining", 2)],
		[at("draining", 2), { type: "SIGNAL" }, at("draining", 3)],
		[at("draining", 1), { type: "DRAINED" }, at("stopped", 1, 0)],
		[at("draining", 1), { type: "TIMED_OUT" }, at("stopped", 1, 1)],
		[at("draining", 3), { type: "FORCED" }, at("stopped", 3, 1)],
	];
	for (const [from, event, to] of rows) {
		assert.deepEqual(transitionBackendProcess(from, event), to, `${from.status} + ${event.type}`);
	}
});

test("events that cannot happen return the same state object", () => {
	const cannotHappen = [
		// listen completes only once, and never after shutdown began
		[at("listening"), { type: "LISTENING" }],
		[at("draining", 1), { type: "LISTENING" }],
		// shutdown results arrive only while draining
		...["starting", "listening"].flatMap((status) =>
			["DRAINED", "TIMED_OUT", "FORCED"].map((type) => [at(status), { type }]),
		),
		// nothing moves a stopped process
		...["LISTENING", "SIGNAL", "DRAINED", "TIMED_OUT", "FORCED"].map((type) => [at("stopped", 1, 0), { type }]),
		[at("listening"), { type: "NOT_AN_EVENT" }],
		[at("listening"), undefined],
	];
	for (const [from, event] of cannotHappen) {
		assert.equal(transitionBackendProcess(from, event), from, `${from.status} + ${event?.type}`);
	}
});

test("signal decisions: the first drains, the second is ignored, the third forces exit", () => {
	assert.deepEqual(decideSignalAction(at("draining", 1)), { action: "drain" });
	assert.deepEqual(decideSignalAction(at("draining", 2)), { action: "ignore" });
	assert.deepEqual(decideSignalAction(at("draining", 3)), { action: "force-exit" });
	assert.deepEqual(decideSignalAction(at("draining", 4)), { action: "force-exit" });
	assert.deepEqual(decideSignalAction(at("stopped", 1, 0)), { action: "none" });
	assert.deepEqual(decideSignalAction(at("listening")), { action: "none" });
});
