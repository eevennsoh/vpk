"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	INITIAL_ROVO_AVAILABILITY,
	ROVO_AVAILABILITY_STATUSES,
	decideRovoAvailabilityRead,
	transitionRovoAvailability,
} = require("./rovo-availability-machine");

const at = (status, checkedAt = 500) => ({ status, checkedAt });

test("the machine starts unknown with no completed check", () => {
	assert.deepEqual(INITIAL_ROVO_AVAILABILITY, { status: "unknown", checkedAt: 0 });
	assert.deepEqual(ROVO_AVAILABILITY_STATUSES, ["unknown", "checking", "available", "unavailable"]);
});

test("transition table", () => {
	const rows = [
		// [from, event, to]
		[at("unknown", 0), { type: "CHECK_STARTED" }, at("checking", 0)],
		[at("available"), { type: "CHECK_STARTED" }, at("checking")],
		[at("unavailable"), { type: "CHECK_STARTED" }, at("checking")],
		[at("checking"), { type: "CHECK_FINISHED", available: true, at: 900 }, at("available", 900)],
		[at("checking"), { type: "CHECK_FINISHED", available: false, at: 900 }, at("unavailable", 900)],
		[at("checking"), { type: "CHECK_FAILED", at: 900 }, at("unavailable", 900)],
	];
	for (const [from, event, to] of rows) {
		assert.deepEqual(transitionRovoAvailability(from, event), to, `${from.status} + ${event.type}`);
	}
});

test("events that cannot happen return the same state object", () => {
	const cannotHappen = [
		// A second check never starts while one is in flight (single-flight).
		[at("checking"), { type: "CHECK_STARTED" }],
		// A check result only arrives while checking.
		...["unknown", "available", "unavailable"].flatMap((status) => [
			[at(status), { type: "CHECK_FINISHED", available: true, at: 900 }],
			[at(status), { type: "CHECK_FAILED", at: 900 }],
		]),
		[at("available"), { type: "NOT_AN_EVENT" }],
		[at("available"), undefined],
	];
	for (const [from, event] of cannotHappen) {
		assert.equal(transitionRovoAvailability(from, event), from, `${from.status} + ${event?.type}`);
	}
});

test("read decisions", () => {
	const fresh = { now: 1000, portFilesPresent: true, refreshIntervalMs: 60_000 };
	assert.deepEqual(decideRovoAvailabilityRead(at("checking"), fresh), { action: "join" });
	assert.deepEqual(decideRovoAvailabilityRead(at("checking"), { ...fresh, portFilesPresent: false }), { action: "join" });
	assert.deepEqual(decideRovoAvailabilityRead(at("unknown", 0), fresh), { action: "refresh", reason: "unknown" });
	// An unavailable result is never cached: every read retries.
	assert.deepEqual(decideRovoAvailabilityRead(at("unavailable", 1000), fresh), { action: "refresh", reason: "unavailable" });
	assert.deepEqual(decideRovoAvailabilityRead(at("available", 1000), fresh), { action: "use-cached" });
	assert.deepEqual(decideRovoAvailabilityRead(at("available", 1000), { ...fresh, now: 61_000 }), { action: "use-cached" });
	assert.deepEqual(decideRovoAvailabilityRead(at("available", 1000), { ...fresh, now: 61_001 }), { action: "refresh", reason: "stale" });
	assert.deepEqual(
		decideRovoAvailabilityRead(at("available", 1000), { ...fresh, portFilesPresent: false }),
		{ action: "refresh", reason: "port-files-missing" },
	);
});
