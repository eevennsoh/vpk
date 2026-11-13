"use strict";

// Which processes have their working directory under a path, and which hold a file
// open. Linux reads /proc; macOS asks lsof once. Every function returns null when the
// process table cannot be read (a sandbox that denies lsof or /proc, a timeout): the
// caller must treat that as unknown, never as "no process".

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const LSOF_TIMEOUT_MS = 15_000;

function runLsof(args) {
	return new Promise((resolve) => {
		try {
			execFile("lsof", args, { timeout: LSOF_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, encoding: "utf8" }, (error, stdout, stderr) => {
				resolve({ code: error ? (Number.isInteger(error.code) ? error.code : null) : 0, stdout: stdout ?? "", stderr: stderr ?? "" });
			});
		} catch (error) {
			// A sandbox can refuse the spawn itself (EPERM), synchronously.
			resolve({ code: null, stdout: "", stderr: String(error?.message ?? error) });
		}
	});
}

// lsof -F output: `p<pid>`, `c<command>`, `n<name>` lines, one process at a time.
function parseLsofFields(text) {
	const rows = [];
	let current = null;
	for (const line of text.split("\n")) {
		const tag = line[0];
		const value = line.slice(1);
		if (tag === "p") {
			current = { pid: Number(value), command: "", names: [] };
			rows.push(current);
		} else if (tag === "c" && current) current.command = value;
		else if (tag === "n" && current) current.names.push(value);
	}
	return rows;
}

// lsof exits 1 when any named file (or the selection) matched nothing, even when it
// printed the others, and on errors; with -w an error is the only thing on stderr.
function lsofRows(result) {
	if (result.code === 0 || (result.code === 1 && !result.stderr.trim())) return parseLsofFields(result.stdout);
	return null;
}

// A process that exited while it was being read (ENOENT, ESRCH) is simply gone; any other
// failure (EACCES on another user's process) leaves the whole reading unknown.
const UNREADABLE = Symbol("unreadable");

function readOrGone(read) {
	try {
		return read();
	} catch (error) {
		return error?.code === "ENOENT" || error?.code === "ESRCH" ? null : UNREADABLE;
	}
}

// One row per process for which `read(name)` returns facts; null when any process could
// not be read, because the one we could not read may be the one that matters.
function linuxProcEntries(read, fsImpl = fs) {
	let names;
	try {
		names = fsImpl.readdirSync("/proc").filter((name) => /^\d+$/u.test(name));
	} catch {
		return null;
	}
	const rows = [];
	for (const name of names) {
		const pid = Number(name);
		const command = readOrGone(() => fsImpl.readFileSync(`/proc/${name}/comm`, "utf8").trim());
		if (command === null) continue;
		if (command === UNREADABLE) return null;
		const value = read(name);
		if (value === UNREADABLE) return null;
		if (value !== null) rows.push({ pid, command, ...value });
	}
	return rows;
}

/** Every process with its cwd: [{ pid, command, cwd }], or null when unreadable. */
async function listProcessCwds({ platform = process.platform, lsof = runLsof, fsImpl = fs } = {}) {
	if (platform === "linux") {
		return linuxProcEntries((name) => {
			const cwd = readOrGone(() => fsImpl.readlinkSync(`/proc/${name}/cwd`));
			return cwd === null || cwd === UNREADABLE ? cwd : { cwd };
		}, fsImpl);
	}
	const rows = lsofRows(await lsof(["-w", "-nP", "-d", "cwd", "-Fpcn"]));
	return rows === null ? null : rows.flatMap((row) => row.names.map((cwd) => ({ pid: row.pid, command: row.command, cwd })));
}

function isInside(child, parent) {
	const relative = path.relative(parent, child);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** Processes whose cwd is `dir` or below it, from a listProcessCwds() result. */
function processesUnder(processCwds, dir, { exclude = [] } = {}) {
	if (processCwds === null) return null;
	return processCwds.filter((entry) => isInside(entry.cwd, dir) && !exclude.includes(entry.pid));
}

/** For each path, the processes holding it open: Map<path, [{ pid, command }]>, or null. */
async function findFileHolders(paths, { platform = process.platform, lsof = runLsof, fsImpl = fs } = {}) {
	const holders = new Map(paths.map((file) => [file, []]));
	if (paths.length === 0) return holders;
	if (platform === "linux") {
		const wanted = new Set(paths);
		const rows = linuxProcEntries((name) => {
			const fds = readOrGone(() => fsImpl.readdirSync(`/proc/${name}/fd`));
			if (fds === null || fds === UNREADABLE) return fds;
			const open = [];
			for (const fd of fds) {
				const target = readOrGone(() => fsImpl.readlinkSync(`/proc/${name}/fd/${fd}`));
				if (target === UNREADABLE) return UNREADABLE;
				if (target !== null && wanted.has(target)) open.push(target);
			}
			return open.length ? { open } : null;
		}, fsImpl);
		if (rows === null) return null;
		for (const row of rows) for (const file of row.open) holders.get(file).push({ pid: row.pid, command: row.command });
		return holders;
	}
	const rows = lsofRows(await lsof(["-w", "-nP", "-Fpcn", "--", ...paths]));
	if (rows === null) return null;
	for (const row of rows) {
		for (const name of row.names) holders.get(name)?.push({ pid: row.pid, command: row.command });
	}
	return holders;
}

module.exports = {
	findFileHolders,
	isInside,
	listProcessCwds,
	parseLsofFields,
	processesUnder,
};
