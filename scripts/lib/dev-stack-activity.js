#!/usr/bin/env node
"use strict";

// Whether a worktree's dev stack is in active use, and a record of every stop.
//
// A stack counts as in use when a live task shows: an agent or tool process (OPERATOR_NAMES) with
// its cwd in the worktree, or recent activity, meaning the newest of these was written within the
// idle window:
//   - the stack's dev log (<worktree>/output/logs/<name>/dev.log), which the dev server writes
//     on every request and recompile, so a browser check or a code edit keeps it fresh;
//   - the stack record (.dev-stack.json), written at each start, stop and service change;
//   - the worktree's git index, which commits, staging and status refreshes write.
// Agents often keep their process cwd in another checkout (a workflow subagent runs inside a
// session whose cwd is the main checkout, and only its short-lived shells enter the worktree), so
// the operator check alone calls such a stack idle while its agent is mid-task.
//
// Stops that another worktree or automation requests go through `stop-guard`: the caller names
// itself (VPK_DEV_STOP_BY) and where it runs (VPK_DEV_STOP_FROM). Such a stop of a stack in use is
// refused unless forced. Every stop, allowed or refused, is appended to
// <log dir>/dev-stops.log with who asked, from where, and the caller's process ancestry.
//
// Dependency-free (node built-ins only): vpk-system-clean's install.sh copies it next to the
// scheduled sweep.
//
//   node scripts/lib/dev-stack-activity.js check --worktree PATH [--idle-secs N]
//     prints `in-use|<evidence>` or `idle|<newest activity>`; exit 0.
//   node scripts/lib/dev-stack-activity.js stop-guard --worktree PATH [--session NAME] [--log-dir DIR] [--idle-secs N] [--force]
//     exit 0: the stop may go ahead (logged). Exit 6: refused (logged, reason on stderr).

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_IDLE_SECS = 1800;
const EXIT_STOP_REFUSED = 6;
// Agent and tool processes whose cwd marks a worktree as in use (the vpk-system-clean sweep and
// the stack budget use the same list).
const OPERATOR_NAMES = ["claude", "codex", "cursor-agent", "lazygit", "caffeinate"];
const STOP_LOG = "dev-stops.log";

function canonicalPath(value) {
	try {
		return fs.realpathSync(value);
	} catch {
		return path.resolve(value);
	}
}

function within(child, root) {
	return child === root || child.startsWith(`${root}${path.sep}`);
}

function run(command, args, { spawnSyncImpl = spawnSync } = {}) {
	const result = spawnSyncImpl(command, args, { encoding: "utf8" });
	return result.status === 0 ? String(result.stdout ?? "") : "";
}

function defaultLogDir(worktreePath) {
	return path.join(worktreePath, "output", "logs", path.basename(worktreePath));
}

// The git index of a worktree: `.git` is a directory in the main checkout and a `gitdir:` file in
// a linked worktree.
function gitIndexPath(worktreePath, { fsImpl = fs } = {}) {
	const dotGit = path.join(worktreePath, ".git");
	try {
		if (fsImpl.statSync(dotGit).isDirectory()) return path.join(dotGit, "index");
		const match = fsImpl.readFileSync(dotGit, "utf8").match(/^gitdir:\s*(.+)$/mu);
		return match ? path.join(path.resolve(worktreePath, match[1].trim()), "index") : null;
	} catch {
		return null;
	}
}

function activitySources(worktreePath, { logDir = defaultLogDir(worktreePath), fsImpl = fs } = {}) {
	return [
		{ source: "dev log", file: path.join(logDir, "dev.log") },
		{ source: "stack record", file: path.join(worktreePath, ".dev-stack.json") },
		{ source: "git index", file: gitIndexPath(worktreePath, { fsImpl }) },
	].filter((entry) => entry.file);
}

// The most recently written activity source: { source, file, mtimeMs } or null.
function newestActivity(worktreePath, { logDir, fsImpl = fs } = {}) {
	let newest = null;
	for (const entry of activitySources(worktreePath, { logDir, fsImpl })) {
		let mtimeMs;
		try {
			mtimeMs = fsImpl.statSync(entry.file).mtimeMs;
		} catch {
			continue;
		}
		if (!newest || mtimeMs > newest.mtimeMs) newest = { ...entry, mtimeMs };
	}
	return newest;
}

function listOperators({ spawnSyncImpl = spawnSync } = {}) {
	const cwdOf = (pid) =>
		run("lsof", ["-a", "-d", "cwd", "-p", String(pid), "-Fn"], { spawnSyncImpl })
			.split("\n")
			.find((line) => line.startsWith("n"))
			?.slice(1) ?? null;
	return OPERATOR_NAMES.flatMap((name) =>
		run("pgrep", ["-x", name], { spawnSyncImpl })
			.split("\n")
			.map(Number)
			.filter((pid) => pid > 0)
			.map((pid) => ({ name, pid, cwd: cwdOf(pid) }))
			.filter((operator) => operator.cwd),
	);
}

function describeAge(ms) {
	const seconds = Math.max(0, Math.round(ms / 1000));
	return seconds < 120 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
}

/**
 * { inUse, evidence, newest }: evidence names why the stack is in use (null when it is not);
 * newest is the most recent activity source, or null.
 */
function assessActivity({ worktreePath, now = Date.now(), idleSecs = DEFAULT_IDLE_SECS, operators = null, logDir, fsImpl = fs, spawnSyncImpl = spawnSync } = {}) {
	const root = canonicalPath(worktreePath);
	const live = (operators ?? listOperators({ spawnSyncImpl })).find((operator) => operator.cwd && within(canonicalPath(operator.cwd), root));
	const newest = newestActivity(root, { logDir: logDir ?? defaultLogDir(root), fsImpl });
	if (live) return { inUse: true, evidence: `${live.name} pid ${live.pid} has its cwd here`, newest };
	if (newest && now - newest.mtimeMs < idleSecs * 1000) {
		return { inUse: true, evidence: `recent activity: ${newest.source} written ${describeAge(now - newest.mtimeMs)} ago (idle after ${describeAge(idleSecs * 1000)})`, newest };
	}
	return { inUse: false, evidence: null, newest };
}

function listWorktreeRoots(cwd, { spawnSyncImpl = spawnSync } = {}) {
	return run("git", ["-C", cwd, "worktree", "list", "--porcelain"], { spawnSyncImpl })
		.split("\n")
		.filter((line) => line.startsWith("worktree "))
		.map((line) => canonicalPath(line.slice("worktree ".length)));
}

// The worktree a path belongs to: the deepest root that contains it (linked worktrees can sit
// inside the main checkout), or null when none does.
function worktreeOf(dir, roots) {
	const target = canonicalPath(dir);
	return roots.filter((root) => within(target, root)).sort((left, right) => right.length - left.length)[0] ?? null;
}

// The caller's process ancestry, nearest first: [{ pid, command }].
function callerAncestry({ pid = process.ppid, spawnSyncImpl = spawnSync, limit = 8 } = {}) {
	const table = new Map();
	for (const line of run("ps", ["-axo", "pid=,ppid=,command="], { spawnSyncImpl }).split("\n")) {
		const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/u);
		if (match) table.set(Number(match[1]), { ppid: Number(match[2]), command: match[3].slice(0, 200) });
	}
	const chain = [];
	let current = pid;
	while (table.has(current) && chain.length < limit) {
		const entry = table.get(current);
		chain.push({ pid: current, command: entry.command });
		if (entry.ppid <= 1 || entry.ppid === current) break;
		current = entry.ppid;
	}
	return chain;
}

function appendStopLog(entry, { logDir }) {
	try {
		fs.mkdirSync(logDir, { recursive: true });
		fs.appendFileSync(path.join(logDir, STOP_LOG), `${JSON.stringify(entry)}\n`);
		return path.join(logDir, STOP_LOG);
	} catch {
		return null;
	}
}

/**
 * Decide whether a stop may go ahead. A stop the worktree's own user runs (no VPK_DEV_STOP_BY,
 * or a requester inside this worktree) always may. A stop another worktree or automation
 * requests is refused while the stack is in use, unless forced.
 */
function decideStop({ worktreePath, env = process.env, force = false, idleSecs = DEFAULT_IDLE_SECS, now = Date.now(), roots, operators, logDir, fsImpl = fs, spawnSyncImpl = spawnSync } = {}) {
	const target = canonicalPath(worktreePath);
	const by = env.VPK_DEV_STOP_BY || null;
	const from = env.VPK_DEV_STOP_FROM || null;
	if (!by) return { allowed: true, crossWorktree: false, by: "this worktree (direct stop)", from, evidence: null };
	const requester = from ? worktreeOf(from, roots ?? listWorktreeRoots(target, { spawnSyncImpl })) : null;
	if (requester === target) return { allowed: true, crossWorktree: false, by, from, evidence: null };
	const activity = assessActivity({ worktreePath: target, now, idleSecs, operators, logDir, fsImpl, spawnSyncImpl });
	if (!activity.inUse) return { allowed: true, crossWorktree: true, by, from, evidence: null };
	return { allowed: force, forced: force, crossWorktree: true, by, from, evidence: activity.evidence };
}

// Append a stop decision to the stopped worktree's dev-stops.log; returns the log file, or null.
function recordStop({ decision, worktreePath, session = null, logDir = defaultLogDir(worktreePath), now = Date.now(), ancestry = callerAncestry() }) {
	const outcome = decision.allowed ? (decision.forced ? "stopping (forced)" : "stopping") : "refused";
	return appendStopLog(
		{
			at: new Date(now).toISOString(),
			outcome,
			worktree: worktreePath,
			session,
			by: decision.by,
			from: decision.from,
			crossWorktree: decision.crossWorktree,
			inUse: decision.evidence,
			ancestry,
		},
		{ logDir },
	);
}

function refusalMessage(worktreePath, decision) {
	const where = decision.from ? ` from ${decision.from}` : "";
	return (
		`[dev:tmux] Not stopping ${worktreePath}: ${decision.by}${where} asked, and this stack is in use (${decision.evidence}).\n` +
		"[dev:tmux] Leave it running. If it really must stop, ask its owner, or rerun the stop with --force.\n"
	);
}

function parseArgs(argv) {
	const [command, ...rest] = argv;
	const options = { force: false };
	for (let index = 0; index < rest.length; index += 1) {
		const arg = rest[index];
		if (arg === "--force") options.force = true;
		else if (arg.startsWith("--")) {
			options[arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = rest[index + 1];
			index += 1;
		}
	}
	return { command, options };
}

function main(argv = process.argv.slice(2), { env = process.env, stdout = process.stdout, stderr = process.stderr, now = Date.now() } = {}) {
	const { command, options } = parseArgs(argv);
	const idleSecs = options.idleSecs === undefined ? DEFAULT_IDLE_SECS : Number(options.idleSecs);
	if (!options.worktree || !Number.isFinite(idleSecs) || idleSecs < 0 || !["check", "stop-guard"].includes(command)) {
		stderr.write("Usage: dev-stack-activity.js check --worktree PATH [--idle-secs N] | stop-guard --worktree PATH [--session NAME] [--log-dir DIR] [--idle-secs N] [--force]\n");
		return 2;
	}
	const worktreePath = canonicalPath(options.worktree);
	const logDir = options.logDir ?? defaultLogDir(worktreePath);
	if (command === "check") {
		const activity = assessActivity({ worktreePath, now, idleSecs, logDir });
		const newest = activity.newest ? `${activity.newest.source} written ${describeAge(now - activity.newest.mtimeMs)} ago` : "no activity recorded";
		stdout.write(activity.inUse ? `in-use|${activity.evidence}\n` : `idle|${newest}\n`);
		return 0;
	}
	const decision = decideStop({ worktreePath, env, force: options.force, idleSecs, now, logDir });
	const logFile = recordStop({ decision, worktreePath, session: options.session ?? null, logDir, now });
	const where = decision.from ? ` from ${decision.from}` : "";
	if (!decision.allowed) {
		stderr.write(refusalMessage(worktreePath, decision));
		return EXIT_STOP_REFUSED;
	}
	stdout.write(`[dev:tmux] Stop requested by ${decision.by}${where}${decision.forced ? ` (forced; in use: ${decision.evidence})` : ""}${logFile ? `; logged to ${logFile}` : ""}.\n`);
	return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = {
	DEFAULT_IDLE_SECS,
	EXIT_STOP_REFUSED,
	OPERATOR_NAMES,
	STOP_LOG,
	activitySources,
	assessActivity,
	callerAncestry,
	decideStop,
	gitIndexPath,
	listOperators,
	main,
	newestActivity,
	recordStop,
	refusalMessage,
	worktreeOf,
};
