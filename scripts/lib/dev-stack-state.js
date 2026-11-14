"use strict";

// One worktree's dev stack, in one place.
//
// `.dev-stack.json` (in the worktree root) records what the launcher last did and which
// processes serve the stack:
//
//   {
//     "version": 1,
//     "worktree": "/abs/path",
//     "session": { "name": "vpk-dev-<worktree>", "socket": "vpk-dev" },
//     "phase": "seeding-env" | "starting" | "stopping" | "stopped",
//     "phaseAt": "<ISO time>",
//     "services": {
//       "frontend": {
//         "port": 3001,
//         "pid": 123, "pidStart": "Sat Nov 14 10:32:53 2026", "pidCommand": "node scripts/dev-frontend.js",
//         "childPid": 456, "childStart": "…", "childCommand": "…",
//         "recordedAt": "<ISO time>"
//       },
//       "backend": { ... }
//     }
//   }
//
// `pid` is the service launcher (scripts/dev-frontend.js or dev-backend.js), which forwards
// signals to `childPid` (next dev or the Express server). Each pid is stored with its identity
// (start time and command, from `ps`), and a pid counts as the stack's only while both still
// match: a pid the system has since given to another process is never the stack's. The
// `.dev-<service>-port` files stay as a mirror of `services.<service>.port`.
//
// The worktree path is canonical (realpath) in the record and in every comparison, so a
// worktree reached through a symlink is one worktree.
//
// `deriveStackStatus(facts)` is pure: given the record and what is alive now, it names one of
// STACK_STATUSES and the next action. `collectStackFacts` gathers those facts with injectable
// probes.

const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const STACK_FILE = ".dev-stack.json";
const STACK_FILE_VERSION = 1;
const SERVICES = ["frontend", "backend"];

// What a caller can see. `absent` (never started here) and `stopped` (started, then stopped
// cleanly) both mean nothing runs; `orphaned` means stack processes outlived their session.
const STACK_STATUSES = [
	"absent",
	"seeding-env",
	"starting",
	"ready",
	"degraded",
	"stopping",
	"stopped",
	"orphaned",
];

// What the launcher records. `ready` and `degraded` are never recorded: they are read from the
// processes and ports each time, so a stack that dies after starting is not reported ready.
const RECORDED_PHASES = ["seeding-env", "starting", "stopping", "stopped"];

const NEXT_ACTIONS = {
	absent: "start",
	"seeding-env": "wait",
	starting: "wait",
	ready: "none",
	degraded: "restart",
	stopping: "wait",
	stopped: "start",
	orphaned: "stop",
};

// The launcher waits 90 s for the frontend (VPK_DEV_TMUX_WAIT); a stack still starting after
// that is degraded, not starting.
const DEFAULT_START_TIMEOUT_MS = 90_000;
// `stop` sends Ctrl-C, waits, then kills the session and any listener left; past this a stack
// still marked stopping has stuck processes.
const DEFAULT_STOP_TIMEOUT_MS = 30_000;
// `dev:tmux:start` exits with this when the stack did not become ready (3 and 4 are the budget's).
const EXIT_NOT_READY = 5;
// How long a non-waiting state must hold before wait-ready gives up early.
const SETTLE_MS = 3_000;

function parseNonNegativeInteger(value, name) {
	if (/^\d+$/u.test(String(value ?? ""))) return Number.parseInt(value, 10);
	process.stderr.write(`${name} must be a whole number of milliseconds, got "${value}".\n`);
	return null;
}

function canonicalPath(value) {
	try {
		return fs.realpathSync(value);
	} catch {
		return path.resolve(value);
	}
}

function stackFilePath(worktreePath) {
	return path.join(worktreePath, STACK_FILE);
}

function portFilePath(worktreePath, service) {
	return path.join(worktreePath, `.dev-${service}-port`);
}

function positiveInteger(value) {
	const number = typeof value === "string" ? Number.parseInt(value.trim(), 10) : value;
	return Number.isInteger(number) && number > 0 ? number : null;
}

const text = (value) => (typeof value === "string" && value.length > 0 ? value : null);

function normalizeService(value) {
	if (!value || typeof value !== "object") return null;
	const port = positiveInteger(value.port);
	const pid = positiveInteger(value.pid);
	const childPid = positiveInteger(value.childPid);
	if (port === null && pid === null && childPid === null) return null;
	return {
		port,
		pid,
		pidStart: pid === null ? null : text(value.pidStart),
		pidCommand: pid === null ? null : text(value.pidCommand),
		childPid,
		childStart: childPid === null ? null : text(value.childStart),
		childCommand: childPid === null ? null : text(value.childCommand),
		recordedAt: text(value.recordedAt),
	};
}

// Anything unreadable, from another version, or for another worktree is treated as no record.
function normalizeStackRecord(value, { worktreePath = null } = {}) {
	if (!value || typeof value !== "object" || value.version !== STACK_FILE_VERSION) return null;
	if (worktreePath && typeof value.worktree === "string" && canonicalPath(value.worktree) !== canonicalPath(worktreePath)) {
		return null;
	}
	const services = {};
	for (const service of SERVICES) {
		const entry = normalizeService(value.services?.[service]);
		if (entry) services[service] = entry;
	}
	// A launcher that has finished records how it exited, so a start whose servers died reads as
	// degraded at once instead of "starting" until the deadline.
	const exits = {};
	for (const service of SERVICES) {
		const exit = value.exits?.[service];
		if (exit && typeof exit === "object") {
			exits[service] = { at: text(exit.at), code: Number.isInteger(exit.code) ? exit.code : null, signal: text(exit.signal) };
		}
	}
	const session =
		value.session && typeof value.session.name === "string" && value.session.name.length > 0
			? { name: value.session.name, socket: typeof value.session.socket === "string" ? value.session.socket : null }
			: null;
	return {
		version: STACK_FILE_VERSION,
		worktree: canonicalPath(typeof value.worktree === "string" ? value.worktree : worktreePath),
		session,
		phase: RECORDED_PHASES.includes(value.phase) ? value.phase : null,
		phaseAt: typeof value.phaseAt === "string" ? value.phaseAt : null,
		services,
		exits,
	};
}

function readStackRecord(worktreePath, { fsImpl = fs } = {}) {
	try {
		return normalizeStackRecord(JSON.parse(fsImpl.readFileSync(stackFilePath(worktreePath), "utf8")), { worktreePath });
	} catch {
		return null;
	}
}

function emptyRecord(worktreePath) {
	return {
		version: STACK_FILE_VERSION,
		worktree: canonicalPath(worktreePath),
		session: null,
		phase: null,
		phaseAt: null,
		services: {},
		exits: {},
	};
}

function sleepSync(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// The frontend and backend launchers record themselves at about the same moment, so every
// write is a read-modify-write under an exclusive lock file. The lock holds its owner: a unique
// token plus the owner's pid and process identity (readProcessIdentity). Only the owner removes it.
//
// A lock is stale only when its owner is verifiably gone: no such process, or the pid now belongs
// to another process (a recycled pid). An owner that is verifiably alive keeps its lock however
// long it holds it (suspended, or across a clock step). When the owner cannot be checked (ps
// unreadable, or an unreadable lock), a lock older than staleMs or dated in the future is stale.
//
// Stale files are removed only under a second lock (`.lock.takeover`), after re-reading that the
// file still holds what was observed, by moving it aside and checking it before deleting. As a
// backstop, the holder checks right before it replaces the record that it still owns the lock, and
// redoes the whole update if it does not, so a displaced holder never overwrites another's write.
class StackLockLost extends Error {}

let ownIdentity;
function lockContent(token) {
	ownIdentity ??= readProcessIdentity(process.pid);
	return JSON.stringify({
		token,
		pid: process.pid,
		start: ownIdentity.state === "alive" ? ownIdentity.start : null,
		command: ownIdentity.state === "alive" ? ownIdentity.command : null,
	});
}

function readLockToken(lockPath, fsImpl) {
	try {
		return fsImpl.readFileSync(lockPath, "utf8");
	} catch {
		return null;
	}
}

function lockOwner(content) {
	try {
		const owner = JSON.parse(content);
		return positiveInteger(owner?.pid) ? owner : null;
	} catch {
		return null;
	}
}

function lockIsStale(lockPath, content, { fsImpl, staleMs, now, verifyOwner = verifyRecordedProcess }) {
	let mtimeMs;
	try {
		mtimeMs = fsImpl.statSync(lockPath).mtimeMs;
	} catch {
		return false;
	}
	const owner = lockOwner(content);
	if (owner) {
		const verdict = verifyOwner({ pid: owner.pid, start: owner.start ?? null, command: owner.command ?? null });
		if (verdict === true) return false;
		if (verdict === false) return true;
	}
	const age = now() - mtimeMs;
	return age > staleMs || age < -1_000;
}

// Remove `file` only if it still holds `observed`: move it aside, check, and put back anything else.
function removeIfStill(file, observed, ownToken, fsImpl) {
	const aside = `${file}.${ownToken}.aside`;
	try {
		fsImpl.renameSync(file, aside);
	} catch {
		return;
	}
	if (readLockToken(aside, fsImpl) !== observed) {
		try {
			fsImpl.linkSync(aside, file);
		} catch {
			// A newer file took the slot; its holder re-checks ownership before writing.
		}
	}
	fsImpl.rmSync(aside, { force: true });
}

function removeStaleLock(lockPath, observed, ownToken, options) {
	const { fsImpl } = options;
	const takeover = `${lockPath}.takeover`;
	const takeoverContent = lockContent(ownToken);
	try {
		fsImpl.writeFileSync(takeover, takeoverContent, { flag: "wx" });
	} catch (error) {
		if (error?.code !== "EEXIST") throw error;
		// A takeover holder re-reads and removes one file; one whose owner is gone died holding it.
		const held = readLockToken(takeover, fsImpl);
		if (lockIsStale(takeover, held, { ...options, staleMs: 1_000 })) removeIfStill(takeover, held, ownToken, fsImpl);
		return;
	}
	try {
		if (readLockToken(lockPath, fsImpl) === observed && lockIsStale(lockPath, observed, options)) {
			removeIfStill(lockPath, observed, ownToken, fsImpl);
		}
	} finally {
		if (readLockToken(takeover, fsImpl) === takeoverContent) fsImpl.rmSync(takeover, { force: true });
	}
}

// Runs `callback(assertOwned)` holding the lock. The callback calls assertOwned() right before
// it replaces the record; if the lock was taken from it meanwhile, the whole callback runs again
// under a fresh lock.
function withStackLock(worktreePath, callback, { fsImpl = fs, retries = 250, retryMs = 20, staleMs = 5_000, now = Date.now, verifyOwner } = {}) {
	const lockPath = `${stackFilePath(worktreePath)}.lock`;
	const token = randomUUID();
	const content = lockContent(token);
	const staleness = { fsImpl, staleMs, now, ...(verifyOwner ? { verifyOwner } : {}) };
	for (let attempt = 0; ; attempt += 1) {
		try {
			fsImpl.writeFileSync(lockPath, content, { flag: "wx" });
		} catch (error) {
			if (error?.code !== "EEXIST") throw error;
			const observed = readLockToken(lockPath, fsImpl);
			if (lockIsStale(lockPath, observed, staleness)) removeStaleLock(lockPath, observed, token, staleness);
			if (attempt >= retries) throw new Error(`Timed out waiting for ${lockPath}`);
			sleepSync(retryMs);
			continue;
		}
		try {
			return callback(() => {
				if (readLockToken(lockPath, fsImpl) !== content) throw new StackLockLost(`Lost ${lockPath} while holding it`);
			});
		} catch (error) {
			if (!(error instanceof StackLockLost) || attempt >= retries) throw error;
		} finally {
			if (readLockToken(lockPath, fsImpl) === content) fsImpl.rmSync(lockPath, { force: true });
		}
	}
}

function writeRecordAtomically(worktreePath, record, { fsImpl = fs, assertOwned = () => {} } = {}) {
	const target = stackFilePath(worktreePath);
	const temporary = `${target}.${process.pid}.tmp`;
	fsImpl.writeFileSync(temporary, `${JSON.stringify(record, null, "\t")}\n`);
	try {
		assertOwned();
	} catch (error) {
		fsImpl.rmSync(temporary, { force: true });
		throw error;
	}
	fsImpl.renameSync(temporary, target);
}

function writePortMirror(worktreePath, service, port, { fsImpl = fs } = {}) {
	const file = portFilePath(worktreePath, service);
	if (port === null || port === undefined) {
		fsImpl.rmSync(file, { force: true });
	} else {
		fsImpl.writeFileSync(file, String(port));
	}
}

// Apply `update(record) → record` under the lock. A service whose entry changed gets its port
// file rewritten (or removed); port files the record never knew about are left alone.
function updateStackRecord(worktreePath, update, { fsImpl = fs, now = () => new Date() } = {}) {
	return withStackLock(
		worktreePath,
		(assertOwned) => {
			const current = readStackRecord(worktreePath, { fsImpl }) ?? emptyRecord(worktreePath);
			const next = normalizeStackRecord({ ...update(structuredClone(current), now()), version: STACK_FILE_VERSION }, { worktreePath });
			if (!next) throw new Error("updateStackRecord produced an invalid record");
			writeRecordAtomically(worktreePath, next, { fsImpl, assertOwned });
			for (const service of SERVICES) {
				if (JSON.stringify(current.services[service] ?? null) !== JSON.stringify(next.services[service] ?? null)) {
					writePortMirror(worktreePath, service, next.services[service]?.port ?? null, { fsImpl });
				}
			}
			return next;
		},
		{ fsImpl },
	);
}

// `keepService(entry)` keeps an entry a finished stop could not end (the stop skips a pid it
// cannot verify), so the record still names it.
function recordPhase(worktreePath, phase, { session, keepService = () => false, fsImpl = fs, now } = {}) {
	if (!RECORDED_PHASES.includes(phase)) {
		throw new Error(`Unknown stack phase: ${phase}. Expected one of ${RECORDED_PHASES.join(", ")}.`);
	}
	return updateStackRecord(
		worktreePath,
		(record, at) => ({
			...record,
			session: session ?? record.session,
			phase,
			phaseAt: at.toISOString(),
			exits: phase === "seeding-env" || phase === "stopped" ? {} : record.exits,
			// A fresh start or a finished stop forgets the previous run's processes.
			services:
				phase === "seeding-env" || phase === "stopped"
					? Object.fromEntries(Object.entries(record.services).filter(([, entry]) => phase === "stopped" && keepService(entry)))
					: record.services,
		}),
		{ fsImpl, now },
	);
}

// A launcher records itself and its server with their identities (readProcessIdentity). A
// launcher that only reuses a server it did not start records the port without pids, and never
// replaces the entry of the launcher that owns that port.
function recordService(worktreePath, service, { port, pid, childPid = null, pidStart = null, pidCommand = null, childStart = null, childCommand = null }, { fsImpl = fs, now } = {}) {
	if (!SERVICES.includes(service)) throw new Error(`Unknown dev service: ${service}`);
	return updateStackRecord(
		worktreePath,
		(record, at) => {
			const existing = record.services[service];
			if (pid === null && existing && existing.port === port && existing.pid !== null) return record;
			const exits = { ...record.exits };
			delete exits[service];
			return {
				...record,
				exits,
				services: {
					...record.services,
					[service]: { port, pid, pidStart, pidCommand, childPid, childStart, childCommand, recordedAt: at.toISOString() },
				},
			};
		},
		{ fsImpl, now },
	);
}

// Only the service whose launcher is `pid` is forgotten, so a launcher that exits late cannot
// erase the record of the one that replaced it.
// `exit` ({ code, signal }): the launcher is exiting for good, and the record keeps how.
function clearService(worktreePath, service, { pid = null, exit = null, fsImpl = fs, now } = {}) {
	if (!SERVICES.includes(service)) throw new Error(`Unknown dev service: ${service}`);
	return updateStackRecord(
		worktreePath,
		(record, at) => {
			const entry = record.services[service];
			if (!entry || (pid !== null && entry.pid !== null && entry.pid !== pid)) return record;
			const services = { ...record.services };
			delete services[service];
			const exits = exit ? { ...record.exits, [service]: { at: at.toISOString(), code: exit.code ?? null, signal: exit.signal ?? null } } : record.exits;
			return { ...record, services, exits };
		},
		{ fsImpl, now },
	);
}

// Every recorded process with its identity: [{ pid, start, command }].
function recordedProcesses(record) {
	const processes = new Map();
	for (const service of SERVICES) {
		const entry = record?.services?.[service];
		if (!entry) continue;
		if (entry.pid) processes.set(entry.pid, { pid: entry.pid, start: entry.pidStart, command: entry.pidCommand });
		if (entry.childPid) processes.set(entry.childPid, { pid: entry.childPid, start: entry.childStart, command: entry.childCommand });
	}
	return [...processes.values()].sort((left, right) => left.pid - right.pid);
}

// Every process the record names, for `stop` to end before it falls back to the cwd scan.
function recordedPids(record) {
	const pids = new Set();
	for (const service of SERVICES) {
		const entry = record?.services?.[service];
		for (const pid of [entry?.pid, entry?.childPid]) {
			if (positiveInteger(pid)) pids.add(pid);
		}
	}
	return [...pids].sort((left, right) => left - right);
}

function elapsedSince(iso, now) {
	const at = Date.parse(iso ?? "");
	return Number.isFinite(at) ? now - at : Number.POSITIVE_INFINITY;
}

// A service serves the stack when its port listens and none of its recorded processes has
// died. A launcher that predates this file records only the port (pid null).
// pidAlive / childPidAlive: true when the recorded process still runs with its recorded identity,
// false when it is gone (or its pid now belongs to another process), null when that cannot be
// told (no pid, no identity recorded, or the process table is unreadable).
// listenerInWorktree: whether the process listening on the port runs in this worktree (null:
// unknown). "listening" alone only says something holds the port.
//
// A service serves the stack when its port listens, the listener is not known to be elsewhere,
// and no recorded process is known to be gone.
function serviceServing(fact) {
	if (!fact || !fact.listening || fact.listenerInWorktree === false) return false;
	return fact.pidAlive !== false && fact.childPidAlive !== false;
}

// Something of this stack still runs: a verified recorded process, or a listener on its port
// running in this worktree.
function serviceAlive(fact) {
	return Boolean(fact && (fact.pidAlive === true || fact.childPidAlive === true || (fact.listening && fact.listenerInWorktree === true)));
}

/**
 * @param {object} facts
 * @param {object|null} facts.record           normalized `.dev-stack.json`, or null
 * @param {boolean} facts.sessionAlive          a tmux session runs in this worktree
 * @param {object} facts.services               per service: { listening, pidAlive, childPidAlive }
 *                                              (pidAlive/childPidAlive null when not recorded)
 * @param {number} facts.now                    epoch ms
 * @returns {{status: string, nextAction: string, reason: string}}
 */
function deriveStackStatus({
	record = null,
	sessionAlive = false,
	services = {},
	now = Date.now(),
	startTimeoutMs = DEFAULT_START_TIMEOUT_MS,
	stopTimeoutMs = DEFAULT_STOP_TIMEOUT_MS,
} = {}) {
	const result = (status, reason) => ({ status, nextAction: NEXT_ACTIONS[status], reason });
	const phase = record?.phase ?? null;
	const sinceChange = elapsedSince(record?.phaseAt, now);
	const alive = SERVICES.filter((service) => serviceAlive(services[service]));
	const serving = SERVICES.filter((service) => serviceServing(services[service]));
	const notServing = SERVICES.filter((service) => !serving.includes(service));

	if (phase === "stopping") {
		if (!sessionAlive && alive.length === 0) return result("stopped", "the stop finished: no session and no stack process left");
		if (sinceChange <= stopTimeoutMs) return result("stopping", "a stop is in progress");
		return result("orphaned", `the stop did not finish within ${stopTimeoutMs / 1000} s; still alive: ${sessionAlive ? ["session", ...alive].join(", ") : alive.join(", ")}`);
	}

	// The launcher prepares .env.local before it creates the session.
	if (phase === "seeding-env" && sinceChange <= startTimeoutMs) {
		return result("seeding-env", "the launcher is preparing .env.local");
	}

	if (!sessionAlive) {
		if (alive.length > 0) return result("orphaned", `${alive.join(" and ")} still run without a tmux session`);
		return record ? result("stopped", "no session and no stack process") : result("absent", "this worktree has no dev stack record or session");
	}

	if (phase === "seeding-env") {
		return result("degraded", `still preparing the environment after ${startTimeoutMs / 1000} s`);
	}

	if (notServing.length === 0) {
		const recorded = SERVICES.some((service) => typeof services[service]?.pidAlive === "boolean");
		return result("ready", recorded ? "frontend and backend listen and their recorded processes are alive" : "frontend and backend listen (no processes recorded)");
	}

	// A recorded process that has exited, or a launcher that recorded its exit, is degraded at once,
	// even inside the start grace period.
	const exitNote = (service) => {
		const exit = services[service]?.exited;
		return exit ? ` (${exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? "?"}`})` : "";
	};
	const dead = notServing.filter((service) => services[service]?.pidAlive === false || services[service]?.childPidAlive === false || services[service]?.exited);
	if (dead.length > 0) return result("degraded", `${dead.map((service) => `${service}${exitNote(service)}`).join(" and ")} exited while the session runs`);

	if (phase === "starting" && sinceChange <= startTimeoutMs) {
		return result("starting", `waiting for ${notServing.join(" and ")}`);
	}

	return result("degraded", `${notServing.join(" and ")} not listening${phase === "starting" ? ` after ${startTimeoutMs / 1000} s` : ""}`);
}

function readPortFile(worktreePath, service, { fsImpl = fs } = {}) {
	try {
		return positiveInteger(fsImpl.readFileSync(portFilePath(worktreePath, service), "utf8"));
	} catch {
		return null;
	}
}

// A process's identity, in a form that does not depend on the time zone, the locale or the
// clock: { state: "alive", start, command }. On Linux `start` is the boot id plus the start time in
// clock ticks since boot (/proc/<pid>/stat), which a clock step does not move; elsewhere it is
// `ps -o lstart` read with TZ=UTC and LC_ALL=C.
//
// { state: "absent" } only when the kernel says no such process (ESRCH), or for a zombie.
// { state: "unknown" } whenever the process exists but its identity cannot be read (ps blocked,
// failing or printing something else): never "absent", so a record is never dropped and a
// process never treated as gone because a probe failed.
// Every identity this module writes starts with this tag. A recorded start in any other form (an
// earlier format, a hand-written record) cannot be compared and reads as unknown, never as gone.
const IDENTITY_FORMAT = "id2:";

function readProcessIdentity(pid, { spawnSyncImpl = spawnSync, kill = process.kill, platform = process.platform, readFile = fs.readFileSync } = {}) {
	try {
		kill(pid, 0);
	} catch (error) {
		if (error?.code === "ESRCH") return { state: "absent" };
		if (error?.code !== "EPERM") return { state: "unknown" };
	}
	if (platform === "linux") {
		try {
			const stat = String(readFile(`/proc/${pid}/stat`, "utf8"));
			const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
			if (fields[0] === "Z") return { state: "absent" };
			const bootId = String(readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim();
			const command = String(readFile(`/proc/${pid}/cmdline`, "utf8")).split("\0").filter(Boolean).join(" ");
			if (!/^\d+$/u.test(fields[19] ?? "") || !command) return { state: "unknown" };
			return { state: "alive", start: `${IDENTITY_FORMAT}linux:${bootId}+${fields[19]}`, command };
		} catch {
			return { state: "unknown" };
		}
	}
	const result = spawnSyncImpl("ps", ["-o", "stat=", "-o", "lstart=", "-o", "command=", "-p", String(pid)], {
		encoding: "utf8",
		env: { ...process.env, TZ: "UTC", LC_ALL: "C", LANG: "C" },
	});
	if (result.error || result.status !== 0) return { state: "unknown" };
	const line = String(result.stdout ?? "").trim();
	const match = line.match(/^(\S+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.*)$/u);
	if (!match) return { state: "unknown" };
	if (match[1].startsWith("Z")) return { state: "absent" };
	return { state: "alive", start: `${IDENTITY_FORMAT}utc:${match[2].replace(/\s+/gu, " ")}`, command: match[3] };
}

// true: the pid still runs with the recorded identity. false: gone, or the pid now belongs to a
// process that started at another time or runs another command. null: cannot tell.
function verifyRecordedProcess({ pid, start, command }, { readIdentity = readProcessIdentity } = {}) {
	if (!pid) return null;
	const identity = readIdentity(pid);
	if (identity.state === "absent") return false;
	// No identity recorded, or one in another format: it cannot be compared, so it is unknown.
	if (identity.state !== "alive" || !start || !start.startsWith(IDENTITY_FORMAT)) return null;
	return identity.start === start && (!command || identity.command === command);
}

// Whether the process listening on the port runs in this worktree: true, false, or null when
// the listener or its cwd cannot be read.
function defaultListenerInWorktree(port, worktreePath, { spawnSyncImpl = spawnSync } = {}) {
	const listeners = spawnSyncImpl("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
	if (listeners.error) return null;
	const pids = String(listeners.stdout ?? "").split(/\s+/u).filter(Boolean);
	if (pids.length === 0) return null;
	const target = canonicalPath(worktreePath);
	let unknown = false;
	for (const pid of pids) {
		const cwd = spawnSyncImpl("lsof", ["-a", "-d", "cwd", "-p", pid, "-Fn"], { encoding: "utf8" });
		const line = String(cwd.stdout ?? "").split("\n").find((entry) => entry.startsWith("n"));
		if (!line) {
			unknown = true;
			continue;
		}
		if (canonicalPath(line.slice(1)) === target) return true;
	}
	return unknown ? null : false;
}

/**
 * Gather the facts `deriveStackStatus` needs. Probes are injectable so tests run on fixtures.
 * A record without a service falls back to its `.dev-<service>-port` file (a stack started
 * before this file existed).
 */
async function collectStackFacts({
	worktreePath,
	sessionAlive,
	fsImpl = fs,
	verifyProcess = verifyRecordedProcess,
	isPortListening,
	listenerInWorktree = defaultListenerInWorktree,
	now = Date.now(),
}) {
	if (typeof isPortListening !== "function") throw new Error("collectStackFacts needs isPortListening");
	const record = readStackRecord(worktreePath, { fsImpl });
	const services = {};
	await Promise.all(
		SERVICES.map(async (service) => {
			const entry = record?.services?.[service] ?? null;
			const port = entry?.port ?? readPortFile(worktreePath, service, { fsImpl });
			const listening = port === null ? false : Boolean(await isPortListening(port));
			services[service] = {
				port,
				exited: entry ? null : (record?.exits?.[service] ?? null),
				pid: entry?.pid ?? null,
				childPid: entry?.childPid ?? null,
				listening,
				listenerInWorktree: listening ? listenerInWorktree(port, worktreePath) : null,
				pidAlive: entry?.pid ? verifyProcess({ pid: entry.pid, start: entry.pidStart, command: entry.pidCommand }) : null,
				childPidAlive: entry?.childPid ? verifyProcess({ pid: entry.childPid, start: entry.childStart, command: entry.childCommand }) : null,
			};
		}),
	);
	return { record, sessionAlive: Boolean(sessionAlive), services, now };
}

// End the processes the record names. Called by `stop` after it has sent Ctrl-C to the session:
// first wait up to waitMs for them to exit on their own (the backend drains for up to 10 s),
// then SIGTERM what is left, then SIGKILL after graceMs.
//
// A recorded pid is signalled only when, at that moment, it still runs with its recorded start
// time and command (verifyRecordedProcess) and its cwd is this worktree; it is checked again
// before SIGTERM and again before SIGKILL. Nothing is signalled by pid when the caller's own
// process tree cannot be read (it could not be told apart), and never the caller or one of its
// ancestors (an agent session running the stop). A pid that cannot be verified is left alone
// and reported; the session kill and the cwd-scoped listener sweep still run after this.
async function stopRecordedProcesses({
	worktreePath,
	record = readStackRecord(worktreePath),
	waitMs = 12_000,
	graceMs = 2_000,
	pollMs = 100,
	killFn = process.kill,
	verifyProcess = verifyRecordedProcess,
	getProcessCwdFn,
	listAncestorPidsFn,
	sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	now = Date.now,
} = {}) {
	const cleanup = require("./worktree-listener-cleanup");
	const cwdOf = getProcessCwdFn ?? ((pid) => cleanup.getProcessCwd(pid));
	const recorded = recordedProcesses(record);
	const result = { recorded: recorded.map((entry) => entry.pid), ours: [], skippedProtected: [], unverified: [], exitedOnTheirOwn: 0, terminated: [], killed: [], blocked: null };
	if (recorded.length === 0) return result;
	const ancestors = (listAncestorPidsFn ?? (() => cleanup.listAncestorPids()))();
	if (!Array.isArray(ancestors)) {
		return { ...result, blocked: "the process table cannot be read, so the caller's own processes cannot be told apart" };
	}
	const protectedPids = new Set([process.pid, ...ancestors]);
	const target = canonicalPath(worktreePath);
	const candidates = [];
	for (const entry of recorded) {
		if (protectedPids.has(entry.pid)) {
			result.skippedProtected.push(entry.pid);
			continue;
		}
		const verdict = verifyProcess(entry);
		if (verdict === false) continue; // Gone, or the pid now belongs to another process.
		const cwd = verdict === true ? cwdOf(entry.pid) : null;
		if (verdict === null || cwd === null || canonicalPath(cwd) !== target) {
			result.unverified.push(entry.pid);
			continue;
		}
		candidates.push(entry);
	}
	result.ours = candidates.map((entry) => entry.pid);
	const stillOurs = (entries) => entries.filter((entry) => verifyProcess(entry) === true);
	// Immediately before each signal: still the recorded process, and still in this worktree.
	const safeToSignal = (entry) => {
		if (verifyProcess(entry) !== true) return false;
		const cwd = cwdOf(entry.pid);
		return cwd !== null && canonicalPath(cwd) === target;
	};

	const deadline = now() + waitMs;
	while (stillOurs(candidates).length > 0 && now() < deadline) await sleepFn(pollMs);
	const left = stillOurs(candidates);
	result.exitedOnTheirOwn = candidates.length - left.length;

	for (const entry of left) {
		if (!safeToSignal(entry)) continue;
		try {
			killFn(entry.pid, "SIGTERM");
			result.terminated.push(entry.pid);
		} catch {
			// Already gone.
		}
	}
	const terminated = left.filter((entry) => result.terminated.includes(entry.pid));
	if (terminated.length > 0) {
		const graceDeadline = now() + graceMs;
		while (stillOurs(terminated).length > 0 && now() < graceDeadline) await sleepFn(pollMs);
	}
	for (const entry of terminated) {
		if (!safeToSignal(entry)) continue;
		try {
			killFn(entry.pid, "SIGKILL");
			result.killed.push(entry.pid);
		} catch {
			// Exited between the check and the signal.
		}
	}
	return result;
}

function resolveTmuxBinary(env = process.env) {
	for (const candidate of [env.VPK_TMUX_BIN, "/opt/homebrew/bin/tmux", "/usr/local/bin/tmux", "/usr/bin/tmux"]) {
		if (!candidate) continue;
		try {
			fs.accessSync(candidate, fs.constants.X_OK);
			return candidate;
		} catch {
			// Try the next one.
		}
	}
	return "tmux";
}

function samePath(left, right) {
	const real = (value) => {
		try {
			return fs.realpathSync(value);
		} catch {
			return path.resolve(value);
		}
	};
	return real(left) === real(right);
}

// A session belongs to this worktree when it has the given name or starts in its directory.
function isSessionAlive({ worktreePath, socket = "vpk-dev", sessionName = null, env = process.env, spawnSyncImpl = require("node:child_process").spawnSync }) {
	const tmux = resolveTmuxBinary(env);
	const socketArgs = socket && socket !== "default" ? ["-L", socket] : [];
	// "=name" matches exactly; a bare name would also match another session as a prefix.
	if (sessionName && spawnSyncImpl(tmux, [...socketArgs, "has-session", "-t", `=${sessionName}`], { stdio: "ignore" }).status === 0) {
		return true;
	}
	const listed = spawnSyncImpl(tmux, [...socketArgs, "list-sessions", "-F", "#{session_name}|#{session_path}"], { encoding: "utf8" });
	if (listed.status !== 0) return false;
	return String(listed.stdout)
		.split("\n")
		.some((line) => {
			const separator = line.indexOf("|");
			return separator > 0 && samePath(line.slice(separator + 1), worktreePath);
		});
}

function lsofPortListening(port, { spawnSyncImpl = require("node:child_process").spawnSync } = {}) {
	return spawnSyncImpl("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { stdio: "ignore" }).status === 0;
}

async function readStackStatus({
	worktreePath,
	socket,
	sessionName,
	env = process.env,
	isPortListening = lsofPortListening,
	listenerInWorktree,
	verifyProcess,
	now = Date.now(),
	startTimeoutMs = DEFAULT_START_TIMEOUT_MS,
} = {}) {
	const record = readStackRecord(worktreePath);
	const facts = await collectStackFacts({
		worktreePath,
		sessionAlive: isSessionAlive({ worktreePath, socket: socket ?? record?.session?.socket ?? "vpk-dev", sessionName: sessionName ?? record?.session?.name ?? null, env }),
		isPortListening,
		...(listenerInWorktree ? { listenerInWorktree } : {}),
		...(verifyProcess ? { verifyProcess } : {}),
		now,
	});
	const derived = deriveStackStatus({ ...facts, startTimeoutMs });
	return {
		worktree: canonicalPath(worktreePath),
		...derived,
		session: facts.record?.session ?? (sessionName ? { name: sessionName, socket: socket ?? "vpk-dev" } : null),
		sessionAlive: facts.sessionAlive,
		phase: facts.record?.phase ?? null,
		phaseAt: facts.record?.phaseAt ?? null,
		services: facts.services,
	};
}

module.exports = {
	DEFAULT_START_TIMEOUT_MS,
	DEFAULT_STOP_TIMEOUT_MS,
	IDENTITY_FORMAT,
	EXIT_NOT_READY,
	NEXT_ACTIONS,
	RECORDED_PHASES,
	SERVICES,
	STACK_FILE,
	STACK_FILE_VERSION,
	STACK_STATUSES,
	clearService,
	collectStackFacts,
	deriveStackStatus,
	isSessionAlive,
	readStackStatus,
	stopRecordedProcesses,
	normalizeStackRecord,
	canonicalPath,
	readProcessIdentity,
	readStackRecord,
	recordPhase,
	recordedProcesses,
	recordService,
	recordedPids,
	stackFilePath,
	updateStackRecord,
	verifyRecordedProcess,
	withStackLock,
};

// CLI for the launchers (scripts/dev-tmux-plain.sh) and agents:
//
//   node scripts/lib/dev-stack-state.js status [--json]        derived status of the cwd's stack
//   node scripts/lib/dev-stack-state.js wait-ready [--timeout-ms N]   exit 0 once ready, else 5
//   node scripts/lib/dev-stack-state.js phase <phase> [--session NAME]
//   node scripts/lib/dev-stack-state.js stop-recorded [--wait-ms N]
//
// Common options: --worktree PATH (default cwd), --socket NAME (default vpk-dev).
function parseCliArgs(argv) {
	const [command, ...rest] = argv;
	const options = { positional: [] };
	for (let index = 0; index < rest.length; index += 1) {
		const arg = rest[index];
		if (arg === "--json") options.json = true;
		else if (arg.startsWith("--")) {
			options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = rest[index + 1];
			index += 1;
		} else options.positional.push(arg);
	}
	return { command, options };
}

function describe(report) {
	const ports = SERVICES.map((service) => `${service}=${report.services[service]?.port ?? "—"}${report.services[service]?.listening ? "" : " (not listening)"}`).join("  ");
	return `State:   ${report.status} (${report.reason}); next: ${report.nextAction}\nPorts:   ${ports}`;
}

async function main(argv = process.argv.slice(2)) {
	const { command, options } = parseCliArgs(argv);
	const worktreePath = path.resolve(options.worktree ?? process.cwd());
	const socket = options.socket ?? "vpk-dev";
	const sessionName = options.session ?? null;
	if (command === "phase") {
		const phase = options.positional[0];
		const current = readStackRecord(worktreePath);
		// A stop in a worktree that never started a stack leaves no record behind.
		if (!current && (phase === "stopping" || phase === "stopped")) return 0;
		recordPhase(worktreePath, phase, {
			session: sessionName ? { name: sessionName, socket } : current?.session ?? undefined,
			// Keep the entries whose processes still run (a stop that could not verify them).
			keepService: (entry) =>
				[{ pid: entry.pid, start: entry.pidStart, command: entry.pidCommand }, { pid: entry.childPid, start: entry.childStart, command: entry.childCommand }].some(
					(candidate) => candidate.pid && verifyRecordedProcess(candidate) !== false,
				),
		});
		return 0;
	}
	if (command === "status") {
		const report = await readStackStatus({ worktreePath, socket, sessionName });
		process.stdout.write(options.json ? `${JSON.stringify(report, null, "\t")}\n` : `${describe(report)}\n`);
		return 0;
	}
	if (command === "wait-ready") {
		const timeoutMs = parseNonNegativeInteger(options.timeoutMs ?? String(DEFAULT_START_TIMEOUT_MS), "--timeout-ms");
		if (timeoutMs === null) return 2;
		const deadline = Date.now() + timeoutMs;
		let settledSince = null;
		for (;;) {
			// The start grace period is the caller's wait, so a longer VPK_DEV_TMUX_WAIT is not cut
			// short by the default 90 s.
			const report = await readStackStatus({ worktreePath, socket, sessionName, startTimeoutMs: Math.max(timeoutMs, DEFAULT_START_TIMEOUT_MS) });
			if (report.status === "ready") return 0;
			// A state that is not waiting ends the wait once it has held for SETTLE_MS, so a launcher
			// retrying on another port (a moment of degraded) does not fail the start.
			if (["seeding-env", "starting"].includes(report.status)) settledSince = null;
			else settledSince ??= Date.now();
			if (Date.now() >= deadline || (settledSince !== null && Date.now() - settledSince >= SETTLE_MS)) {
				process.stderr.write(`[dev:tmux] Not ready: ${report.status} (${report.reason}).\n`);
				return EXIT_NOT_READY;
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	if (command === "stop-recorded") {
		const waitMs = parseNonNegativeInteger(options.waitMs ?? "12000", "--wait-ms");
		if (waitMs === null) return 2;
		const result = await stopRecordedProcesses({ worktreePath, waitMs });
		if (result.blocked) {
			process.stdout.write(`[dev:tmux] Not signalling recorded processes: ${result.blocked}. The session and listener cleanup still run.\n`);
			return 0;
		}
		if (result.unverified.length > 0) {
			process.stdout.write(`[dev:tmux] Not signalling ${result.unverified.join(", ")}: cannot confirm they are still this stack's processes.\n`);
		}
		if (result.skippedProtected.length > 0) {
			process.stdout.write(`[dev:tmux] Not signalling ${result.skippedProtected.join(", ")}: the caller's own process tree.\n`);
		}
		if (result.ours.length > 0) {
			process.stdout.write(
				`[dev:tmux] Recorded processes: ${result.exitedOnTheirOwn} exited after Ctrl-C, ${result.terminated.length - result.killed.length} after SIGTERM, ${result.killed.length} needed SIGKILL.\n`,
			);
		}
		return 0;
	}
	process.stderr.write("Usage: dev-stack-state.js status [--json] | wait-ready [--timeout-ms N] | phase <phase> [--session NAME] | stop-recorded [--wait-ms N]\n");
	return 2;
}

if (require.main === module) {
	main().then(
		(code) => process.exit(code),
		(error) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		},
	);
}
