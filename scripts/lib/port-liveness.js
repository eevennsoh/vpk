const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_TIMEOUT_MS = 250;

function probePortAlive(port, { host = DEFAULT_HOST, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
	return new Promise((resolve) => {
		const numericPort = Number(port);
		if (!Number.isInteger(numericPort) || numericPort <= 0) {
			resolve(false);
			return;
		}

		const socket = net.createConnection({ port: numericPort, host });
		let settled = false;
		const finish = (alive) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolve(alive);
		};

		socket.once("connect", () => finish(true));
		socket.once("error", () => finish(false));
		socket.setTimeout(timeoutMs, () => finish(false));
	});
}

function canonicalPath(value) {
	try {
		return fs.realpathSync(value);
	} catch {
		return path.resolve(value);
	}
}

// Parse `lsof -F` output into records, one per process (`p<pid>`), each with its `n` lines.
function parseLsofFields(text) {
	const records = [];
	let current = null;
	for (const line of String(text ?? "").split("\n")) {
		if (line.startsWith("p")) {
			current = { pid: Number.parseInt(line.slice(1), 10), names: [] };
			records.push(current);
		} else if (line.startsWith("n") && current) {
			current.names.push(line.slice(1));
		}
	}
	return records.filter((record) => Number.isInteger(record.pid) && record.pid > 0);
}

/**
 * Who listens on each TCP port: Map port -> Set of the listening processes' canonical cwds.
 * Two lsof calls for the whole machine (listeners, then the cwds of their pids), so a dashboard
 * that refreshes every second can call it once per refresh. Returns null when lsof cannot be
 * run, so a caller can tell "unknown" from "nobody".
 */
function listListenerCwds({ spawnSyncImpl = spawnSync } = {}) {
	const listeners = spawnSyncImpl("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"], { encoding: "utf8" });
	if (listeners.error) return null;
	const portsByPid = new Map();
	for (const record of parseLsofFields(listeners.stdout)) {
		for (const name of record.names) {
			const port = Number.parseInt(name.slice(name.lastIndexOf(":") + 1), 10);
			if (!Number.isInteger(port)) continue;
			const ports = portsByPid.get(record.pid) ?? new Set();
			ports.add(port);
			portsByPid.set(record.pid, ports);
		}
	}
	const result = new Map();
	if (portsByPid.size === 0) return result;
	const cwds = spawnSyncImpl("lsof", ["-a", "-d", "cwd", "-p", [...portsByPid.keys()].join(","), "-Fpn"], { encoding: "utf8" });
	const cwdByPid = new Map(parseLsofFields(cwds.stdout).filter((record) => record.names.length > 0).map((record) => [record.pid, canonicalPath(record.names[0])]));
	for (const [pid, ports] of portsByPid) {
		const cwd = cwdByPid.get(pid);
		if (!cwd) continue;
		for (const port of ports) {
			const owners = result.get(port) ?? new Set();
			owners.add(cwd);
			result.set(port, owners);
		}
	}
	return result;
}

// Whether a port's listener runs in this worktree: true, false (only other directories' processes
// listen on it), or null (unknown: nobody listed, or the listener's cwd could not be read).
function listenerOwnership(listenerCwds, port, worktreePath) {
	const owners = listenerCwds?.get(Number(port));
	if (!owners || owners.size === 0) return null;
	return owners.has(canonicalPath(worktreePath));
}

module.exports = {
	listListenerCwds,
	listenerOwnership,
	parseLsofFields,
	probePortAlive,
};
