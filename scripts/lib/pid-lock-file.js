"use strict";

// Exclusive pid lock files shared by the heavy-run lock (scripts/lib/heavy-run-lock.js) and the
// backend's data-directory lock (backend/lib/backend-data-dir.js).
//
// - publish() acquires atomically: the record is written in full to a private draft and
//   hard-linked into place. link(2) fails with EEXIST when the name exists, which is the same
//   exclusive-create guarantee as open(O_CREAT | O_EXCL), and a reader never sees a half-written
//   record.
// - reclaimStale() removes a dead holder's lock only under a reclaim guard and only while the
//   lock still holds the stale record the caller saw, so a live successor's lock is never moved.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

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

// `ps -o lstart=` for a pid, or null where the process table cannot be read (agent sandboxes).
function processStartTime(pid) {
	const result = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" });
	const value = result.status === 0 ? result.stdout.trim() : "";
	return value || null;
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

module.exports = {
	isProcessAlive,
	processStartTime,
	publish,
	readHolder,
	reclaimStale,
	sameRecord,
};
