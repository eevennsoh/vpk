"use strict";

// Records every agent-browser session control-vpk starts, with the agent session that owns it,
// so a browser left behind when its owner ends can be found and closed. Records live under the
// shared git directory, so every worktree of this repository and the scheduled sweep see the
// same list. Only recorded sessions are ever closed.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { REPO_ROOT } = require("./repo.js");

const REGISTRY_DIR_NAME = "vpk-agent-browsers";
// An agent process is recognised by its executable name while walking up from control-vpk.
const OWNER_NAMES = new Set(["claude", "codex", "cursor-agent"]);
const MAX_ANCESTOR_DEPTH = 32;
// A recorded browser unused for this long is closed even if its owner still runs.
const BROWSER_IDLE_HOURS = 2;

function registryDir({ env = process.env, repoRoot = REPO_ROOT } = {}) {
	if (env.VPK_BROWSER_REGISTRY_DIR) return env.VPK_BROWSER_REGISTRY_DIR;
	const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	const commonDir = result.status === 0 ? result.stdout.trim() : "";
	if (!commonDir) throw new Error("control-vpk: cannot resolve the shared git directory for the browser registry");
	return path.join(commonDir, REGISTRY_DIR_NAME);
}

// `ps -o ppid=,lstart=,comm=` → { ppid, startedAt, name }; lstart is five fields wide.
function readProcess(pid) {
	const result = spawnSync("ps", ["-o", "ppid=,lstart=,comm=", "-p", String(pid)], { encoding: "utf8" });
	const fields = result.status === 0 ? result.stdout.trim().split(/\s+/u) : [];
	if (fields.length < 7) return null;
	return {
		ppid: Number(fields[0]),
		startedAt: fields.slice(1, 6).join(" "),
		name: path.basename(fields.slice(6).join(" ")),
	};
}

function resolveOwner({ env = process.env, startPid = process.ppid, read = readProcess } = {}) {
	const explicitPid = Number(env.VPK_BROWSER_OWNER_PID);
	if (Number.isInteger(explicitPid) && explicitPid > 0) {
		const info = read(explicitPid);
		return info ? { pid: explicitPid, startedAt: info.startedAt, name: info.name } : null;
	}
	let pid = startPid;
	for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && pid > 1; depth += 1) {
		const info = read(pid);
		if (!info) return null;
		if (OWNER_NAMES.has(info.name)) return { pid, startedAt: info.startedAt, name: info.name };
		pid = info.ppid;
	}
	return null;
}

function signalZero(pid) {
	try {
		process.kill(pid, 0);
		return "exists";
	} catch (error) {
		return error.code === "ESRCH" ? "missing" : "unknown";
	}
}

// "alive", "gone" (no such pid, or the pid now belongs to a process started at another time), or
// "unknown" when the process table cannot be read here (an agent sandbox denies ps). Only "gone"
// is proof the owner ended.
function ownerState(owner, { probe = signalZero, read = readProcess } = {}) {
	const presence = probe(owner.pid);
	if (presence === "missing") return "gone";
	if (presence !== "exists") return "unknown";
	const info = read(owner.pid);
	if (!info) return "unknown";
	return info.startedAt === owner.startedAt ? "alive" : "gone";
}

function recordFile(dir, { namespace, session }) {
	return path.join(dir, `${encodeURIComponent(namespace ? `${namespace}~${session}` : session)}.json`);
}

function writeJsonAtomic(file, value) {
	const draft = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(draft, `${JSON.stringify(value, null, "\t")}\n`);
	fs.renameSync(draft, file);
}

function readRecord(file) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return null;
	}
}

// Called after a command succeeded in `session`. A browser-starting command creates or renews
// the record; any other command only refreshes `lastUsedAt` on an existing one.
function noteBrowserUse(session, {
	dir = registryDir(),
	env = process.env,
	now = Date.now(),
	owner,
	started,
	worktree = REPO_ROOT,
} = {}) {
	const namespace = env.AGENT_BROWSER_NAMESPACE || null;
	const file = recordFile(dir, { namespace, session });
	const existing = readRecord(file);
	if (!started && !existing) return null;
	const record = {
		...existing,
		session,
		namespace,
		worktree,
		lastUsedAt: new Date(now).toISOString(),
		startedAt: existing?.startedAt ?? new Date(now).toISOString(),
		owner: started ? (owner === undefined ? resolveOwner({ env }) : owner) : existing.owner,
	};
	fs.mkdirSync(dir, { recursive: true });
	writeJsonAtomic(file, record);
	return record;
}

function listBrowserRecords({ dir = registryDir() } = {}) {
	let names;
	try {
		names = fs.readdirSync(dir);
	} catch {
		return [];
	}
	return names
		.filter((name) => name.endsWith(".json"))
		.map((name) => ({ file: path.join(dir, name), record: readRecord(path.join(dir, name)) }))
		.filter((entry) => entry.record?.session);
}

function removeBrowserRecord(session, { dir = registryDir(), namespace = process.env.AGENT_BROWSER_NAMESPACE || null } = {}) {
	fs.rmSync(recordFile(dir, { namespace, session }), { force: true });
}

function hoursAgo(isoTime, now) {
	const then = Date.parse(isoTime);
	return Number.isFinite(then) ? (now - then) / 3_600_000 : Number.POSITIVE_INFINITY;
}

function classifyBrowserRecord(record, { idleHours = BROWSER_IDLE_HOURS, stateOf = ownerState, now = Date.now() } = {}) {
	const unused = hoursAgo(record.lastUsedAt, now);
	const used = Number.isFinite(unused) ? `last used ${unused.toFixed(1)}h ago` : "last use unknown";
	const label = record.owner?.pid ? `owner ${record.owner.name ?? "agent"} pid ${record.owner.pid}` : "owner";
	const state = record.owner?.pid ? stateOf(record.owner) : "unknown";
	if (state === "gone") return { action: "close", reason: `${label} is gone; ${used}` };
	const status = state === "alive" ? `${label} is alive` : `${label} unknown (cannot inspect it here)`;
	if (unused >= idleHours) return { action: "close", reason: `${status}, but the browser is idle: ${used} >= ${idleHours}h` };
	return { action: "keep", reason: `${status}; ${used}` };
}

module.exports = {
	BROWSER_IDLE_HOURS,
	OWNER_NAMES,
	classifyBrowserRecord,
	listBrowserRecords,
	noteBrowserUse,
	ownerState,
	readProcess,
	registryDir,
	removeBrowserRecord,
	resolveOwner,
};
