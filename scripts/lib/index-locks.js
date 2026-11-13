"use strict";

// Finds index.lock files in worktrees' git directories and, only when asked, removes
// the stale ones: no process holds the file and it is older than the minimum age. The
// decision is decideIndexLock (worktree-staleness.js); this file only reads and unlinks.

const fs = require("node:fs");
const path = require("node:path");

const { findFileHolders, listProcessCwds, processesUnder } = require("./process-holders");
const { decideIndexLock } = require("./worktree-staleness");

function statOrNull(file) {
	try {
		return fs.statSync(file);
	} catch {
		return null;
	}
}

// Processes whose cwd is inside the worktree, without this process; null when unreadable.
function worktreeProcessesFrom(processCwds, worktree) {
	return processesUnder(processCwds, worktree, { exclude: [process.pid] })?.map(({ pid, command }) => ({ pid, command })) ?? null;
}

/**
 * @param {Array<{ worktree: string, gitDir: string, protectedCheckout?: boolean }>} entries
 * @returns {Promise<Array<{ worktree, lock, ageMs, mtimeMs, holders, worktreeProcesses, decision }>>}
 */
async function inspectIndexLocks(entries, { now = Date.now(), minAgeMs, findHolders = findFileHolders, readProcessCwds = listProcessCwds } = {}) {
	const found = [];
	for (const entry of entries) {
		const lock = path.join(entry.gitDir, "index.lock");
		const stat = statOrNull(lock);
		if (!stat) continue;
		found.push({ ...entry, lock: fs.realpathSync(lock), ino: stat.ino, mtimeMs: stat.mtimeMs, ageMs: Math.max(0, now - stat.mtimeMs) });
	}
	if (found.length === 0) return [];
	const [holders, processCwds] = await Promise.all([findHolders(found.map((entry) => entry.lock)), readProcessCwds()]);
	return found.map((entry) => {
		const held = holders === null ? null : holders.get(entry.lock) ?? [];
		const worktreeProcesses = worktreeProcessesFrom(processCwds, entry.worktree);
		return {
			worktree: entry.worktree,
			lock: entry.lock,
			ageMs: entry.ageMs,
			ino: entry.ino,
			mtimeMs: entry.mtimeMs,
			minAgeMs,
			protectedCheckout: entry.protectedCheckout === true,
			holders: held,
			worktreeProcesses,
			decision: decideIndexLock({ ageMs: entry.ageMs, holders: held, worktreeProcesses, minAgeMs, protectedCheckout: entry.protectedCheckout === true }),
		};
	});
}

// Removes each lock whose decision is "remove", after checking again that it is the same
// file (same mtime) and deciding again on fresh holder and process facts. Returns what
// happened to each.
async function removeStaleIndexLocks(inspected, { findHolders = findFileHolders, readProcessCwds = listProcessCwds } = {}) {
	const results = [];
	for (const entry of inspected) {
		if (entry.decision.action !== "remove") {
			results.push({ lock: entry.lock, removed: false, reason: entry.decision.reason });
			continue;
		}
		const sameFile = () => {
			const stat = statOrNull(entry.lock);
			return Boolean(stat) && stat.ino === entry.ino && stat.mtimeMs === entry.mtimeMs;
		};
		if (!sameFile()) {
			results.push({ lock: entry.lock, removed: false, reason: "changed since it was inspected" });
			continue;
		}
		const [holders, processCwds] = await Promise.all([findHolders([entry.lock]), readProcessCwds()]);
		const held = holders === null ? null : holders.get(entry.lock) ?? [];
		if (held === null || held.length > 0) {
			results.push({ lock: entry.lock, removed: false, reason: held === null ? "lock holders unknown on recheck" : "held on recheck" });
			continue;
		}
		const recheck = decideIndexLock({
			ageMs: entry.ageMs,
			holders: held,
			worktreeProcesses: worktreeProcessesFrom(processCwds, entry.worktree),
			minAgeMs: entry.minAgeMs,
			protectedCheckout: entry.protectedCheckout,
		});
		if (recheck.action !== "remove") {
			results.push({ lock: entry.lock, removed: false, reason: `on recheck: ${recheck.reason}` });
			continue;
		}
		// A git command may have replaced the lock while the holders were being read.
		if (!sameFile()) {
			results.push({ lock: entry.lock, removed: false, reason: "replaced during the recheck" });
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
