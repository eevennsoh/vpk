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

test("index.lock decisions: remove only an old lock that no process holds and no git command owns", () => {
	const old = 45 * MINUTE_MS;
	const minAgeMs = 30 * MINUTE_MS;
	const base = { ageMs: old, holders: [], worktreeProcesses: [], minAgeMs, protectedCheckout: false };
	assert.equal(decideIndexLock(base).action, "remove");
	assert.deepEqual(decideIndexLock({ ...base, holders: null }), { action: "keep", reason: "lock holders unknown (process check unavailable)" });
	assert.deepEqual(decideIndexLock({ ...base, holders: [{ pid: 7, command: "git" }] }), { action: "keep", reason: "held by pid 7 (git)" });
	// Unheld and old, but a git command runs in the worktree (a commit waiting on its editor).
	assert.deepEqual(decideIndexLock({ ...base, worktreeProcesses: [{ pid: 8, command: "git" }] }), { action: "keep", reason: "git is running in the worktree: pid 8 (git)" });
	assert.equal(decideIndexLock({ ...base, worktreeProcesses: [{ pid: 9, command: "git-remot" }] }).action, "keep");
	// Only a non-git process (an agent sitting in the worktree): the lock is still stale.
	assert.equal(decideIndexLock({ ...base, worktreeProcesses: [{ pid: 10, command: "claude" }, { pid: 11, command: "gitk-ish" }] }).action, "remove");
	// The process list could not be read.
	assert.deepEqual(decideIndexLock({ ...base, worktreeProcesses: null }), { action: "keep", reason: "processes in the worktree unknown (process check unavailable)" });
	assert.deepEqual(decideIndexLock({ ...base, ageMs: 5 * MINUTE_MS }), { action: "keep", reason: "5 min old; younger than 30 min" });
	assert.equal(decideIndexLock({ ...base, protectedCheckout: true }).action, "keep");
	assert.equal(decideIndexLock({ ...base, ageMs: null }).action, "keep");
});
