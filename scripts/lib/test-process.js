"use strict";

// Process hygiene for tests and the unit runner.
//
// spawnInGroup: start a long-lived child in its own process group and kill the whole group on
// cleanup (the test's `t.after` when given, and always when the test process exits), so no
// grandchild outlives the test.
//
// findMarkedProcesses: the unit runner puts a unique UNIT_BATCH_MARKER_ENV value in each batch's
// environment, which every descendant inherits even after it is orphaned or detaches into its own
// group. A process still carrying the marker after its batch exited is a leak.

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");

const UNIT_BATCH_MARKER_ENV = "VPK_UNIT_BATCH";
const GROUP_EXIT_TIMEOUT_MS = 5_000;

const liveGroups = new Set();
let exitHookInstalled = false;

function groupSignalable(pgid) {
	try {
		process.kill(-pgid, 0);
		return true;
	} catch (error) {
		return error.code === "EPERM";
	}
}

// Process states of every member of `pgid` (single letters: R, S, Z, …), or null when the
// process table cannot be read.
function groupMemberStates(pgid, { platform = process.platform } = {}) {
	if (platform === "linux") {
		const states = [];
		for (const name of fs.readdirSync("/proc")) {
			if (!/^\d+$/u.test(name)) continue;
			let stat;
			try {
				stat = fs.readFileSync(`/proc/${name}/stat`, "utf8");
			} catch {
				continue;
			}
			// `pid (comm) state ppid pgrp …`; comm may hold spaces and parentheses.
			const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
			if (Number(fields[2]) === pgid) states.push(fields[0]);
		}
		return states;
	}
	const result = spawnSync("ps", ["-A", "-o", "pgid=,stat="], { encoding: "utf8" });
	if (result.status !== 0) return null;
	return result.stdout.split("\n").map((line) => line.trim().split(/\s+/u)).filter(([group]) => Number(group) === pgid).map(([, state]) => state);
}

// True while any member of the group can still run. A zombie (killed but not yet reaped, which
// lasts forever under a PID 1 that does not reap orphans) does not count.
function groupAlive(pgid, { signalable = groupSignalable, states = groupMemberStates } = {}) {
	if (!signalable(pgid)) return false;
	let members = null;
	try {
		members = states(pgid);
	} catch {
		members = null;
	}
	if (members === null) return true;
	return members.some((state) => !state.startsWith("Z"));
}

function signalGroup(pgid, signal) {
	try {
		process.kill(-pgid, signal);
	} catch {
		// The group already exited.
	}
}

function installExitHook() {
	if (exitHookInstalled) return;
	exitHookInstalled = true;
	process.on("exit", () => {
		for (const pgid of liveGroups) signalGroup(pgid, "SIGKILL");
	});
}

// Kills the child's process group and resolves once no member is left (bounded).
async function killGroup(child, { signal = "SIGKILL", timeoutMs = GROUP_EXIT_TIMEOUT_MS } = {}) {
	const pgid = child.pid;
	if (!pgid) return;
	signalGroup(pgid, signal);
	const deadline = Date.now() + timeoutMs;
	while (groupAlive(pgid)) {
		if (Date.now() > deadline) throw new Error(`process group ${pgid} still alive ${timeoutMs}ms after ${signal}`);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	liveGroups.delete(pgid);
}

function spawnInGroup(command, args = [], options = {}, { t } = {}) {
	const child = spawn(command, args, { ...options, detached: true });
	if (child.pid) {
		liveGroups.add(child.pid);
		installExitHook();
	}
	if (t) t.after(() => killGroup(child));
	return child;
}

function listProcessEnvironmentsLinux() {
	const rows = [];
	for (const name of fs.readdirSync("/proc")) {
		if (!/^\d+$/u.test(name)) continue;
		try {
			rows.push({ pid: Number(name), environment: fs.readFileSync(`/proc/${name}/environ`, "utf8").split("\0") });
		} catch {
			// Exited, or another user's process.
		}
	}
	return rows;
}

function listProcessEnvironmentsDarwin() {
	const result = spawnSync("ps", ["-axE", "-ww", "-o", "pid=,command="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	if (result.status !== 0) return null;
	return result.stdout.split("\n").filter(Boolean).map((line) => {
		const match = /^\s*(\d+)\s(.*)$/u.exec(line);
		// ps prints the command and then the environment, space separated.
		return match ? { pid: Number(match[1]), environment: match[2].split(" ") } : null;
	}).filter(Boolean);
}

// Every live process whose environment has `${UNIT_BATCH_MARKER_ENV}=${marker}`, with its command
// line. Returns null when the process table cannot be read (for example in an agent sandbox).
function findMarkedProcesses(marker, { platform = process.platform } = {}) {
	let rows;
	try {
		rows = platform === "linux" ? listProcessEnvironmentsLinux() : listProcessEnvironmentsDarwin();
	} catch {
		rows = null;
	}
	if (rows === null) return null;
	const entry = `${UNIT_BATCH_MARKER_ENV}=${marker}`;
	return rows
		.filter((row) => row.pid !== process.pid && row.environment.includes(entry))
		.map((row) => ({ pid: row.pid, command: commandOf(row.pid) }))
		.filter((row) => row.command !== null);
}

function commandOf(pid) {
	if (process.platform === "linux") {
		try {
			return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean).join(" ");
		} catch {
			return null;
		}
	}
	const result = spawnSync("ps", ["-ww", "-o", "command=", "-p", String(pid)], { encoding: "utf8" });
	return result.status === 0 ? result.stdout.trim() : null;
}

module.exports = {
	UNIT_BATCH_MARKER_ENV,
	findMarkedProcesses,
	groupAlive,
	groupMemberStates,
	killGroup,
	spawnInGroup,
};
