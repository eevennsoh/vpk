"use strict";

// One machine-wide lock for the heavy stage of `pnpm run check`, `pnpm run ci:pr` and the unit
// runner, so concurrent agent sessions take turns instead of running full lint, typecheck and
// unit suites all at once. It lives under the shared git directory, so every worktree of this
// repository sees it.
//
// - Acquired atomically: the record is written in full to a private draft and hard-linked into
//   place; the link fails when the lock exists, so two runs can never both win (a read-then-write
//   check can: that race broke main once in scripts/build-static-export.mjs).
// - A holder that died leaves a stale lock. A waiter removes it only under a reclaim guard, and
//   only while it still holds the stale record it saw, so a live successor's lock is never moved.
// - Re-entrant: the holder exports VPK_HEAVY_RUN_LOCK_HOLDER, so the unit runner that `check`
//   or `ci:pr` starts runs inside its parent's turn instead of waiting for it.
// - Never blocks CI: with CI set it is a no-op.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const LOCK_FILE_NAME = "vpk-heavy-run.lock";
const HOLDER_ENV = "VPK_HEAVY_RUN_LOCK_HOLDER";
const LOCK_PATH_ENV = "VPK_HEAVY_RUN_LOCK_PATH";
const POLL_MS = 250;
// A heavy run takes minutes. A lock this old belongs to a holder whose pid has been reused by an
// unrelated process, so it is stale even though that pid is alive.
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

function defaultLockPath({ cwd = process.cwd(), env = process.env } = {}) {
	if (env[LOCK_PATH_ENV]) return env[LOCK_PATH_ENV];
	const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, encoding: "utf8" });
	const commonDir = result.status === 0 ? result.stdout.trim() : "";
	return commonDir ? path.join(commonDir, LOCK_FILE_NAME) : null;
}

function isProcessAlive(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM: the pid exists but is not ours to signal; never treat it as dead.
		return error.code !== "ESRCH";
	}
}

function readHolder(file) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch (error) {
		return error.code === "ENOENT" ? null : { pid: null, unreadable: true };
	}
}

function publish(lockPath, record) {
	const draft = `${lockPath}.draft-${process.pid}`;
	fs.writeFileSync(draft, `${JSON.stringify(record)}\n`);
	try {
		fs.linkSync(draft, lockPath);
		return true;
	} catch (error) {
		if (error.code === "EEXIST") return false;
		throw error;
	} finally {
		fs.rmSync(draft, { force: true });
	}
}

// Renames a lock aside and hands it back if its holder is alive. Used only for the reclaim
// guard below, whose holder keeps it for microseconds; a guard left by a crashed reclaimer is the
// only thing it ever moves.
function retireCrashedGuard(guardPath, { alive }) {
	const claim = `${guardPath}.claim-${process.pid}`;
	try {
		fs.renameSync(guardPath, claim);
	} catch (error) {
		if (error.code === "ENOENT") return;
		throw error;
	}
	try {
		const claimed = readHolder(claim);
		if (claimed?.pid && claimed.pid !== process.pid && alive(claimed.pid)) {
			try {
				fs.linkSync(claim, guardPath);
			} catch (error) {
				if (error.code !== "EEXIST") throw error;
			}
		}
	} finally {
		fs.rmSync(claim, { force: true });
	}
}

function sameRecord(a, b) {
	return Boolean(a?.pid && b?.pid) && a.pid === b.pid && a.startedAt === b.startedAt;
}

// Removes the lock only while it still holds the stale record this run observed. Reclaimers
// take a guard first (published like the lock itself), so a delayed waiter can never move a
// live successor's lock: the lock cannot change under the guard, because publishing needs the
// name to be free and removing someone else's lock needs the guard.
function reclaimStale(lockPath, stale, { alive }) {
	const guardPath = `${lockPath}.reclaim`;
	if (!publish(guardPath, { pid: process.pid, startedAt: new Date().toISOString() })) {
		const guard = readHolder(guardPath);
		if (guard?.pid && !alive(guard.pid)) retireCrashedGuard(guardPath, { alive });
		return false;
	}
	try {
		// An unreadable lock (never written by publish, whose link is atomic) reads the same again.
		if (sameRecord(readHolder(lockPath), stale) || stale?.unreadable) fs.rmSync(lockPath, { force: true });
	} finally {
		fs.rmSync(guardPath, { force: true });
	}
	return true;
}

const NO_LOCK = Object.freeze({ held: false, release() {} });

async function acquireHeavyRunLock({
	alive = isProcessAlive,
	env = process.env,
	label,
	lockPath = defaultLockPath({ env }),
	log = (line) => process.stderr.write(`${line}\n`),
	now = () => Date.now(),
	pollMs = POLL_MS,
	staleAfterMs = STALE_AFTER_MS,
} = {}) {
	if (env.CI || !lockPath) return NO_LOCK;
	if (env[HOLDER_ENV]) {
		const holder = readHolder(lockPath);
		if (holder?.pid && String(holder.pid) === env[HOLDER_ENV] && alive(holder.pid)) return NO_LOCK;
	}
	const record = { pid: process.pid, label, cwd: process.cwd(), startedAt: new Date().toISOString() };
	let announced = null;
	for (;;) {
		if (publish(lockPath, record)) break;
		const holder = readHolder(lockPath);
		if (holder === null) continue;
		if (holder.pid === process.pid) break;
		const age = now() - Date.parse(holder.startedAt ?? "");
		const tooOld = Number.isFinite(age) && age > staleAfterMs;
		if (holder.pid && alive(holder.pid) && !tooOld) {
			if (announced !== holder.pid) {
				log(`heavy-run lock: waiting for pid ${holder.pid} (${holder.label ?? "a heavy run"} in ${holder.cwd ?? "?"}, since ${holder.startedAt ?? "?"}) to finish its heavy stage`);
				announced = holder.pid;
			}
			await new Promise((resolve) => setTimeout(resolve, pollMs));
			continue;
		}
		const why = !holder.pid ? "the lock is unreadable" : tooOld ? `pid ${holder.pid}'s lock is ${Math.round(age / 60_000)} minutes old` : `pid ${holder.pid} is gone`;
		if (announced !== `stale ${holder.pid}`) {
			log(`heavy-run lock: ${why}; taking over its stale lock`);
			announced = `stale ${holder.pid}`;
		}
		// Another waiter is reclaiming it: give it a moment rather than spin.
		if (!reclaimStale(lockPath, holder, { alive })) await new Promise((resolve) => setTimeout(resolve, pollMs));
	}
	env[HOLDER_ENV] = String(process.pid);
	let released = false;
	const release = () => {
		if (released) return;
		released = true;
		process.removeListener("exit", release);
		if (readHolder(lockPath)?.pid === process.pid) fs.rmSync(lockPath, { force: true });
		if (env[HOLDER_ENV] === String(process.pid)) delete env[HOLDER_ENV];
	};
	process.on("exit", release);
	return { held: true, lockPath, release };
}

module.exports = {
	HOLDER_ENV,
	LOCK_FILE_NAME,
	LOCK_PATH_ENV,
	acquireHeavyRunLock,
	defaultLockPath,
	isProcessAlive,
	reclaimStale,
};
