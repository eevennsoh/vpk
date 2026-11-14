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
	};
}

function sleepSync(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// The frontend and backend launchers record themselves at about the same moment, so every
// write is a read-modify-write under an exclusive lock file holding the owner's token
// ("<pid>-<uuid>"). Only the owner removes it. A lock is stale when its owner pid is gone, when
// it is older than staleMs, or when its mtime is in the future (a clock change); a stale lock is
// moved aside under a unique name and checked before it is deleted, so two waiters cannot both
// take it over.
function readLockToken(lockPath, fsImpl) {
	try {
		return fsImpl.readFileSync(lockPath, "utf8");
	} catch {
		return null;
	}
}

function lockOwnerGone(token) {
	const pid = positiveInteger(String(token ?? "").split("-")[0]);
	if (pid === null) return false;
	try {
		process.kill(pid, 0);
		return false;
	} catch (error) {
		return error?.code === "ESRCH";
	}
}

function lockIsStale(lockPath, token, { fsImpl, staleMs, now }) {
	let mtimeMs;
	try {
		mtimeMs = fsImpl.statSync(lockPath).mtimeMs;
	} catch {
		return false;
	}
	const age = now() - mtimeMs;
	return age > staleMs || age < -1_000 || lockOwnerGone(token);
}

function takeOverStaleLock(lockPath, observed, ownToken, fsImpl) {
	const aside = `${lockPath}.${ownToken}.stale`;
	try {
		fsImpl.renameSync(lockPath, aside);
	} catch {
		return; // Someone else moved or released it.
	}
	if (readLockToken(aside, fsImpl) !== observed) {
		// A fresh lock replaced the stale one before the rename: put it back.
		try {
			fsImpl.linkSync(aside, lockPath);
		} catch {
			// A newer holder already took the slot.
		}
	}
	fsImpl.rmSync(aside, { force: true });
}

function withStackLock(worktreePath, callback, { fsImpl = fs, retries = 250, retryMs = 20, staleMs = 5_000, now = Date.now } = {}) {
	const lockPath = `${stackFilePath(worktreePath)}.lock`;
	const token = `${process.pid}-${randomUUID()}`;
	for (let attempt = 0; ; attempt += 1) {
		try {
			fsImpl.writeFileSync(lockPath, token, { flag: "wx" });
		} catch (error) {
			if (error?.code !== "EEXIST") throw error;
			const observed = readLockToken(lockPath, fsImpl);
			if (lockIsStale(lockPath, observed, { fsImpl, staleMs, now })) {
				takeOverStaleLock(lockPath, observed, token, fsImpl);
				continue;
			}
			if (attempt >= retries) throw new Error(`Timed out waiting for ${lockPath}`);
			sleepSync(retryMs);
			continue;
		}
		try {
			return callback();
		} finally {
			if (readLockToken(lockPath, fsImpl) === token) fsImpl.rmSync(lockPath, { force: true });
		}
	}
}

function writeRecordAtomically(worktreePath, record, { fsImpl = fs } = {}) {
	const target = stackFilePath(worktreePath);
	const temporary = `${target}.${process.pid}.tmp`;
	fsImpl.writeFileSync(temporary, `${JSON.stringify(record, null, "\t")}\n`);
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
		() => {
			const current = readStackRecord(worktreePath, { fsImpl }) ?? emptyRecord(worktreePath);
			const next = normalizeStackRecord({ ...update(structuredClone(current), now()), version: STACK_FILE_VERSION }, { worktreePath });
			if (!next) throw new Error("updateStackRecord produced an invalid record");
			writeRecordAtomically(worktreePath, next, { fsImpl });
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
			return {
				...record,
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
function clearService(worktreePath, service, { pid = null, fsImpl = fs, now } = {}) {
	if (!SERVICES.includes(service)) throw new Error(`Unknown dev service: ${service}`);
	return updateStackRecord(
		worktreePath,
		(record) => {
			const entry = record.services[service];
			if (!entry || (pid !== null && entry.pid !== null && entry.pid !== pid)) return record;
			const services = { ...record.services };
			delete services[service];
			return { ...record, services };
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

	// A recorded process that has exited is degraded at once, even inside the start grace period.
	const dead = notServing.filter((service) => services[service]?.pidAlive === false || services[service]?.childPidAlive === false);
	if (dead.length > 0) return result("degraded", `${dead.join(" and ")} exited while the session runs`);

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

// { state: "absent" } when no live process has the pid (a zombie counts as absent), { state:
// "unknown" } when that cannot be read (ps blocked or failing), else { state: "alive", start,
// command } with `start` the ps lstart, whitespace collapsed.
function readProcessIdentity(pid, { spawnSyncImpl = spawnSync, kill = process.kill } = {}) {
	try {
		kill(pid, 0);
	} catch (error) {
		if (error?.code === "ESRCH") return { state: "absent" };
		if (error?.code !== "EPERM") return { state: "unknown" };
	}
	const result = spawnSyncImpl("ps", ["-o", "stat=", "-o", "lstart=", "-o", "command=", "-p", String(pid)], { encoding: "utf8" });
	if (result.error) return { state: "unknown" };
	const line = String(result.stdout ?? "").trim();
	if (line.length === 0) return result.status === 1 ? { state: "absent" } : { state: "unknown" };
	const match = line.match(/^(\S+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.*)$/u);
	if (!match) return { state: "unknown" };
	if (match[1].startsWith("Z")) return { state: "absent" };
	return { state: "alive", start: match[2].replace(/\s+/gu, " "), command: match[3] };
}

// true: the pid still runs with the recorded identity. false: gone, or the pid now belongs to a
// process that started at another time or runs another command. null: cannot tell.
function verifyRecordedProcess({ pid, start, command }, { readIdentity = readProcessIdentity } = {}) {
	if (!pid) return null;
	const identity = readIdentity(pid);
	if (identity.state === "absent") return false;
	if (identity.state !== "alive" || !start) return null;
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

module.exports = {
	DEFAULT_START_TIMEOUT_MS,
	DEFAULT_STOP_TIMEOUT_MS,
	NEXT_ACTIONS,
	RECORDED_PHASES,
	SERVICES,
	STACK_FILE,
	STACK_FILE_VERSION,
	STACK_STATUSES,
	clearService,
	collectStackFacts,
	deriveStackStatus,
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
