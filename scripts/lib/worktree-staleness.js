"use strict";

// Pure decisions behind the stale-worktree and stale-index.lock report in
// scripts/clean-candidates.js. A fact that could not be read (null) is never read as
// "safe": an unknown process check keeps the worktree, an unknown lock holder keeps
// the lock.

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

// Provisional: a worktree is stale after this many days without branch activity
// (commit, checkout, reset, index write). Tune with the owner; --stale-days overrides it.
const DEFAULT_STALE_DAYS = 7;

// Provisional: an index.lock younger than this may belong to a git command that is
// still running between writes (a rebase, a long add). --lock-min-age-minutes overrides it.
const DEFAULT_LOCK_MIN_AGE_MINUTES = 30;

function describeProcess({ pid, command }) {
	return `pid ${pid} (${command || "unknown"})`;
}

/**
 * @param {{
 *   lastActivityMs: number | null,
 *   now: number,
 *   staleDays: number,
 *   processes: Array<{ pid: number, command: string }> | null,  // null: unreadable
 *   blockers: string[],                                          // from the landing report
 * }} facts
 * @returns {{ idleDays: number | null, stale: boolean | null, safe: boolean, reasons: string[] }}
 */
function deriveWorktreeStaleness({ lastActivityMs, now, staleDays, processes, blockers }) {
	const reasons = [];
	const idleDays = lastActivityMs === null ? null : Math.floor((now - lastActivityMs) / DAY_MS);
	const stale = idleDays === null ? null : now - lastActivityMs >= staleDays * DAY_MS;
	if (stale === null) reasons.push("last activity unknown");
	else if (!stale) reasons.push(`active ${idleDays} day(s) ago (stale after ${staleDays})`);
	if (processes === null) reasons.push("process check unavailable; unknown is never safe");
	else for (const entry of processes) reasons.push(`${describeProcess(entry)} works here`);
	reasons.push(...blockers);
	const safe = stale === true && Array.isArray(processes) && processes.length === 0 && blockers.length === 0;
	if (safe) reasons.push(`idle ${idleDays} day(s), no process, landed and clean`);
	return { idleDays, stale, safe, reasons };
}

// git and its helpers (git-remote-https, git-upload-pack …); lsof truncates names.
function isGitProcess({ command }) {
	return command === "git" || /^git-/u.test(command ?? "");
}

/**
 * Whether a stale index.lock may be removed. Git closes the lock's descriptor after
 * writing the new index and keeps the lock until the command ends (a commit waiting
 * on its editor or a hook, a rebase between steps), so a git process working in the
 * worktree owns the lock even when nothing holds the file open.
 * @param {{
 *   ageMs: number | null,
 *   holders: Array<{ pid, command }> | null,           // processes with the file open
 *   worktreeProcesses: Array<{ pid, command }> | null, // processes whose cwd is in the worktree
 *   minAgeMs: number,
 *   protectedCheckout: boolean,
 * }} facts
 * @returns {{ action: "remove" | "keep", reason: string }}
 */
function decideIndexLock({ ageMs, holders, worktreeProcesses, minAgeMs, protectedCheckout }) {
	if (holders === null) return { action: "keep", reason: "lock holders unknown (process check unavailable)" };
	if (holders.length > 0) return { action: "keep", reason: `held by ${holders.map(describeProcess).join(", ")}` };
	if (worktreeProcesses === null || worktreeProcesses === undefined) return { action: "keep", reason: "processes in the worktree unknown (process check unavailable)" };
	const git = worktreeProcesses.filter(isGitProcess);
	if (git.length > 0) return { action: "keep", reason: `git is running in the worktree: ${git.map(describeProcess).join(", ")}` };
	if (ageMs === null) return { action: "keep", reason: "age unknown" };
	if (ageMs < minAgeMs) return { action: "keep", reason: `${Math.floor(ageMs / MINUTE_MS)} min old; younger than ${Math.floor(minAgeMs / MINUTE_MS)} min` };
	if (protectedCheckout) return { action: "keep", reason: "in the persistent main checkout; remove it there by hand" };
	return { action: "remove", reason: `${Math.floor(ageMs / MINUTE_MS)} min old and no process holds it` };
}

module.exports = {
	DAY_MS,
	DEFAULT_LOCK_MIN_AGE_MINUTES,
	DEFAULT_STALE_DAYS,
	MINUTE_MS,
	decideIndexLock,
	deriveWorktreeStaleness,
	isGitProcess,
};
