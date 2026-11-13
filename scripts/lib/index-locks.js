"use strict";

// Finds index.lock files in worktrees' git directories and, only when asked, removes
// the stale ones: no process holds the file and it is older than the minimum age. The
// decision is decideIndexLock (worktree-staleness.js); this file only reads and unlinks.

const fs = require("node:fs");
const path = require("node:path");

const { findFileHolders } = require("./process-holders");
const { decideIndexLock } = require("./worktree-staleness");

function statOrNull(file) {
	try {
		return fs.statSync(file);
	} catch {
		return null;
	}
}

/**
 * @param {Array<{ worktree: string, gitDir: string, protectedCheckout?: boolean }>} entries
 * @returns {Promise<Array<{ worktree, lock, ageMs, mtimeMs, holders, decision }>>}
 */
async function inspectIndexLocks(entries, { now = Date.now(), minAgeMs, findHolders = findFileHolders } = {}) {
	const found = [];
	for (const entry of entries) {
		const lock = path.join(entry.gitDir, "index.lock");
		const stat = statOrNull(lock);
		if (!stat) continue;
		found.push({ ...entry, lock: fs.realpathSync(lock), mtimeMs: stat.mtimeMs, ageMs: Math.max(0, now - stat.mtimeMs) });
	}
	const holders = await findHolders(found.map((entry) => entry.lock));
	return found.map((entry) => {
		const held = holders === null ? null : holders.get(entry.lock) ?? [];
		return {
			worktree: entry.worktree,
			lock: entry.lock,
			ageMs: entry.ageMs,
			mtimeMs: entry.mtimeMs,
			holders: held,
			decision: decideIndexLock({ ageMs: entry.ageMs, holders: held, minAgeMs, protectedCheckout: entry.protectedCheckout === true }),
		};
	});
}

// Removes each lock whose decision is "remove", after checking again that it is the same
// file (same mtime) and that still nothing holds it. Returns what happened to each.
async function removeStaleIndexLocks(inspected, { findHolders = findFileHolders } = {}) {
	const results = [];
	for (const entry of inspected) {
		if (entry.decision.action !== "remove") {
			results.push({ lock: entry.lock, removed: false, reason: entry.decision.reason });
			continue;
		}
		const stat = statOrNull(entry.lock);
		if (!stat || stat.mtimeMs !== entry.mtimeMs) {
			results.push({ lock: entry.lock, removed: false, reason: "changed since it was inspected" });
			continue;
		}
		const holders = await findHolders([entry.lock]);
		const held = holders === null ? null : holders.get(entry.lock) ?? [];
		if (held === null || held.length > 0) {
			results.push({ lock: entry.lock, removed: false, reason: held === null ? "lock holders unknown on recheck" : "held on recheck" });
			continue;
		}
		try {
			fs.unlinkSync(entry.lock);
			results.push({ lock: entry.lock, removed: true, reason: entry.decision.reason });
		} catch (error) {
			results.push({ lock: entry.lock, removed: false, reason: `unlink failed: ${error.code ?? error.message}` });
		}
	}
	return results;
}

module.exports = { inspectIndexLocks, removeStaleIndexLocks };
