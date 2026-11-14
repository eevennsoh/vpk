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
//       "frontend": { "port": 3001, "pid": 123, "childPid": 456, "recordedAt": "<ISO time>" },
//       "backend": { ... }
//     }
//   }
//
// `pid` is the service launcher (scripts/dev-frontend.js or dev-backend.js), which forwards
// signals to `childPid` (next dev or the Express server). The `.dev-<service>-port` files stay
// as a mirror of `services.<service>.port` for the readers that predate this file.
//
// `deriveStackStatus(facts)` is pure: given the record and what is alive now, it names one of
// STACK_STATUSES and the next action. `collectStackFacts` gathers those facts with injectable
// probes.

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

function normalizeService(value) {
	if (!value || typeof value !== "object") return null;
	const port = positiveInteger(value.port);
	const pid = positiveInteger(value.pid);
	const childPid = positiveInteger(value.childPid);
	if (port === null && pid === null && childPid === null) return null;
	return {
		port,
		pid,
		childPid,
		recordedAt: typeof value.recordedAt === "string" ? value.recordedAt : null,
	};
}

// Anything unreadable, from another version, or for another worktree is treated as no record.
function normalizeStackRecord(value, { worktreePath = null } = {}) {
	if (!value || typeof value !== "object" || value.version !== STACK_FILE_VERSION) return null;
	if (worktreePath && typeof value.worktree === "string" && path.resolve(value.worktree) !== path.resolve(worktreePath)) {
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
		worktree: typeof value.worktree === "string" ? value.worktree : worktreePath,
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
		worktree: path.resolve(worktreePath),
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
// write is a read-modify-write under an exclusive lock file. A lock older than staleMs belongs
// to a process that died holding it.
function withStackLock(worktreePath, callback, { fsImpl = fs, retries = 250, retryMs = 20, staleMs = 5_000, now = Date.now } = {}) {
	const lockPath = `${stackFilePath(worktreePath)}.lock`;
	for (let attempt = 0; ; attempt += 1) {
		let fd;
		try {
			fd = fsImpl.openSync(lockPath, "wx");
		} catch (error) {
			if (error?.code !== "EEXIST") throw error;
			try {
				if (now() - fsImpl.statSync(lockPath).mtimeMs > staleMs) {
					fsImpl.rmSync(lockPath, { force: true });
					continue;
				}
			} catch {
				// The holder released it between our open and stat; try again.
			}
			if (attempt >= retries) throw new Error(`Timed out waiting for ${lockPath}`);
			sleepSync(retryMs);
			continue;
		}
		try {
			return callback();
		} finally {
			fsImpl.closeSync(fd);
			fsImpl.rmSync(lockPath, { force: true });
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

function recordPhase(worktreePath, phase, { session, fsImpl = fs, now } = {}) {
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
			services: phase === "seeding-env" || phase === "stopped" ? {} : record.services,
		}),
		{ fsImpl, now },
	);
}

function recordService(worktreePath, service, { port, pid, childPid = null }, { fsImpl = fs, now } = {}) {
	if (!SERVICES.includes(service)) throw new Error(`Unknown dev service: ${service}`);
	return updateStackRecord(
		worktreePath,
		(record, at) => ({
			...record,
			services: {
				...record.services,
				[service]: { port, pid, childPid, recordedAt: at.toISOString() },
			},
		}),
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
function serviceServing(fact) {
	if (!fact || !fact.listening) return false;
	return fact.pidAlive !== false && fact.childPidAlive !== false;
}

function serviceAlive(fact) {
	return Boolean(fact && (fact.pidAlive === true || fact.childPidAlive === true || fact.listening));
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

function defaultIsPidAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM: the process exists but belongs to someone else.
		return error?.code === "EPERM";
	}
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
	isPidAlive = defaultIsPidAlive,
	isPortListening,
	now = Date.now(),
}) {
	if (typeof isPortListening !== "function") throw new Error("collectStackFacts needs isPortListening");
	const record = readStackRecord(worktreePath, { fsImpl });
	const services = {};
	await Promise.all(
		SERVICES.map(async (service) => {
			const entry = record?.services?.[service] ?? null;
			const port = entry?.port ?? readPortFile(worktreePath, service, { fsImpl });
			services[service] = {
				port,
				pid: entry?.pid ?? null,
				childPid: entry?.childPid ?? null,
				listening: port === null ? false : Boolean(await isPortListening(port)),
				pidAlive: entry?.pid ? isPidAlive(entry.pid) : null,
				childPidAlive: entry?.childPid ? isPidAlive(entry.childPid) : null,
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
	readStackRecord,
	recordPhase,
	recordService,
	recordedPids,
	stackFilePath,
	updateStackRecord,
	withStackLock,
};
