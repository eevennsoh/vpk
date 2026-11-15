// @ts-check
"use strict";

// Where the backend keeps its runtime data, and the lock that keeps it to one backend.
//
// Two backends writing the same directory (two stacks pointed at one checkout, or a stray
// process left from an earlier run) corrupt each other's state: the second one's startup sweep
// even clears the first one's in-flight runs. So the backend takes an exclusive pid lock in its
// data directory before it creates anything else, and refuses to start while a live backend
// holds it. A lock whose holder is gone (crash, SIGKILL, SIGHUP from a closed terminal) is stale
// and taken over. The lock is removed when the process exits; SIGINT and SIGTERM drain and then
// exit, so they remove it too.
//
// Each worktree's backend uses its own backend/data, so per-worktree dev stacks never contend.
// VPK_BACKEND_DATA_DIR points a backend somewhere else (tests use a temporary directory).

const fs = require("node:fs");
const path = require("node:path");

const {
	isProcessAlive,
	processStartTime,
	publish,
	readHolder,
	reclaimStale,
} = require("../../scripts/lib/pid-lock-file");

const DATA_DIR_ENV = "VPK_BACKEND_DATA_DIR";
const LOCK_FILE_NAME = "backend.lock";
// Another backend reclaiming the same stale lock holds its guard for microseconds.
const MAX_ATTEMPTS = 50;
const RETRY_MS = 20;

/**
 * @param {{ backendDir: string, env?: NodeJS.ProcessEnv }} options
 * @returns {string}
 */
function resolveBackendDataDir({ backendDir, env = process.env }) {
	const override = env[DATA_DIR_ENV]?.trim();
	return override ? path.resolve(override) : path.join(backendDir, "data");
}

/**
 * @typedef {{ pid: number, procStart?: string | null, startedAt?: string, cwd?: string, port?: string | null }} BackendLockRecord
 */

class BackendDataDirLockedError extends Error {
	/**
	 * @param {{ dataDir: string, lockPath: string, holder: BackendLockRecord }} details
	 */
	constructor({ dataDir, lockPath, holder }) {
		const where = [
			holder.port ? `port ${holder.port}` : null,
			holder.cwd ? `cwd ${holder.cwd}` : null,
			holder.startedAt ? `started ${holder.startedAt}` : null,
		].filter(Boolean).join(", ");
		super(
			`Backend data directory ${dataDir} is already in use by backend pid ${holder.pid}${where ? ` (${where})` : ""}. ` +
				`Only one backend may write it at a time. Stop pid ${holder.pid}, or set ${DATA_DIR_ENV} to another directory. ` +
				`Lock file: ${lockPath}`,
		);
		this.name = "BackendDataDirLockedError";
		this.code = "BACKEND_DATA_DIR_LOCKED";
		this.holderPid = holder.pid;
		this.lockPath = lockPath;
	}
}

/** @param {number} ms */
function sleepSync(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Takes the data directory's lock or throws BackendDataDirLockedError naming the live holder.
 *
 * @param {{
 *   dataDir: string,
 *   pid?: number,
 *   port?: string | null,
 *   alive?: (pid: number) => boolean,
 *   startTimeOf?: (pid: number) => string | null,
 *   onExit?: (release: () => void) => void,
 *   now?: () => number,
 *   log?: (line: string) => void,
 * }} options
 * @returns {{ lockPath: string, release: () => void }}
 */
function acquireBackendDataDirLock({
	dataDir,
	pid = process.pid,
	port = null,
	alive = isProcessAlive,
	startTimeOf = processStartTime,
	onExit = (release) => process.once("exit", release),
	now = () => Date.now(),
	log = (line) => console.log(line),
}) {
	fs.mkdirSync(dataDir, { recursive: true });
	const lockPath = path.join(dataDir, LOCK_FILE_NAME);
	/** @type {BackendLockRecord} */
	const record = { pid, procStart: startTimeOf(pid), startedAt: new Date(now()).toISOString(), cwd: process.cwd(), port };
	// A holder is this backend's rival only while its pid runs the same process it recorded: a
	// dead holder's pid reused by an unrelated process, or by this very process (a container
	// restart over a kept data volume starts from the same low pids), is not a rival.
	/** @param {BackendLockRecord} holder */
	const holderAlive = (holder) => {
		if (!holder?.pid || holder.pid === pid || !alive(holder.pid)) return false;
		if (!holder.procStart) return true;
		const current = startTimeOf(holder.pid);
		return current === null || current === holder.procStart;
	};

	for (let attempt = 0; ; attempt += 1) {
		if (publish(lockPath, record)) break;
		/** @type {BackendLockRecord | null} */
		const holder = readHolder(lockPath);
		if (holder === null) continue;
		if (holderAlive(holder)) throw new BackendDataDirLockedError({ dataDir, lockPath, holder });
		if (attempt >= MAX_ATTEMPTS) {
			throw new Error(`Could not take the backend data directory lock ${lockPath}: another process kept reclaiming it.`);
		}
		log(`[STARTUP] Taking over a stale backend lock in ${dataDir} (${holder.pid ? `pid ${holder.pid} is gone` : "unreadable lock"})`);
		if (!reclaimStale(lockPath, holder, { alive })) sleepSync(RETRY_MS);
	}

	let released = false;
	const release = () => {
		if (released) return;
		released = true;
		if (readHolder(lockPath)?.pid === pid) fs.rmSync(lockPath, { force: true });
	};
	onExit(release);
	return { lockPath, release };
}

module.exports = {
	BackendDataDirLockedError,
	DATA_DIR_ENV,
	LOCK_FILE_NAME,
	acquireBackendDataDirLock,
	resolveBackendDataDir,
};
