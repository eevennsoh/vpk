"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { DAY_MS, MINUTE_MS, decideIndexLock, deriveWorktreeStaleness } = require("./worktree-staleness");

const NOW = 100 * DAY_MS;

test("worktree staleness: safe only when stale, process-free by a check that ran, and landed", () => {
	const base = { now: NOW, staleDays: 7, processes: [], blockers: [] };
	const rows = [
		[{ ...base, lastActivityMs: NOW - 8 * DAY_MS }, { idleDays: 8, stale: true, safe: true }],
		[{ ...base, lastActivityMs: NOW - 2 * DAY_MS }, { idleDays: 2, stale: false, safe: false }],
		[{ ...base, lastActivityMs: null }, { idleDays: null, stale: null, safe: false }],
		// A process check that could not run is unknown, and unknown is never safe.
		[{ ...base, lastActivityMs: NOW - 8 * DAY_MS, processes: null }, { idleDays: 8, stale: true, safe: false }],
		[{ ...base, lastActivityMs: NOW - 8 * DAY_MS, processes: [{ pid: 42, command: "next-server" }] }, { idleDays: 8, stale: true, safe: false }],
		[{ ...base, lastActivityMs: NOW - 8 * DAY_MS, blockers: ["dirty: commit or stash"] }, { idleDays: 8, stale: true, safe: false }],
	];
	for (const [input, expected] of rows) {
		const { idleDays, stale, safe } = deriveWorktreeStaleness(input);
		assert.deepEqual({ idleDays, stale, safe }, expected, JSON.stringify(input));
	}
	assert.deepEqual(deriveWorktreeStaleness({ ...base, lastActivityMs: NOW - 8 * DAY_MS, processes: null }).reasons, ["process check unavailable; unknown is never safe"]);
	assert.deepEqual(deriveWorktreeStaleness({ ...base, lastActivityMs: NOW - 8 * DAY_MS, processes: [{ pid: 42, command: "next-server" }] }).reasons, ["pid 42 (next-server) works here"]);
	assert.deepEqual(deriveWorktreeStaleness({ ...base, lastActivityMs: NOW - 2 * DAY_MS }).reasons, ["active 2 day(s) ago (stale after 7)"]);
});

test("index.lock decisions: remove only an old lock that a check proved nobody holds", () => {
	const old = 45 * MINUTE_MS;
	const minAgeMs = 30 * MINUTE_MS;
	assert.equal(decideIndexLock({ ageMs: old, holders: [], minAgeMs, protectedCheckout: false }).action, "remove");
	assert.deepEqual(decideIndexLock({ ageMs: old, holders: null, minAgeMs, protectedCheckout: false }), { action: "keep", reason: "lock holders unknown (process check unavailable)" });
	assert.deepEqual(decideIndexLock({ ageMs: old, holders: [{ pid: 7, command: "git" }], minAgeMs, protectedCheckout: false }), { action: "keep", reason: "held by pid 7 (git)" });
	assert.deepEqual(decideIndexLock({ ageMs: 5 * MINUTE_MS, holders: [], minAgeMs, protectedCheckout: false }), { action: "keep", reason: "5 min old; younger than 30 min" });
	assert.equal(decideIndexLock({ ageMs: old, holders: [], minAgeMs, protectedCheckout: true }).action, "keep");
	assert.equal(decideIndexLock({ ageMs: null, holders: [], minAgeMs, protectedCheckout: false }).action, "keep");
});
