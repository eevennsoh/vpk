#!/usr/bin/env node
// codex-thread-recency.js — read-only probe: is any Codex thread working in this
// worktree (its root or a directory under it) still in use?
//
//   node codex-thread-recency.js --cwd <worktree> [--pressure | --idle-hours <n>] [--db <path>]
//
// Prints one line, `verdict|newest_age_secs|thread_count|reason`:
//   active   a thread here was updated in the last ACTIVE_WINDOW_SECS
//   recent   the newest thread is younger than the idle threshold
//   idle     every thread here is at least the idle threshold old
//   unknown  no thread matches, the database is missing or unreadable, or its
//            schema has changed; callers must keep the stack
//
// Only `idle` lets a caller stop a stack. The database is opened read-only, so
// its contents are never changed and rows still in the write-ahead log are read.
// SQLite's WAL mode does create the `-shm`/`-wal` sidecar files next to it when
// they are absent (Codex keeps them while it runs); nothing else under the Codex
// home is written. Exit status is always 0.
"use strict";

const { readdirSync, statSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

// PROVISIONAL until the owner confirms them: a Codex worktree's stack may be
// stopped once its newest thread is this many hours old, normally and when the
// sweep runs in memory-pressure mode (`--pressure`). The sweep and status.sh
// both take them from here.
const IDLE_HOURS = 24;
const PRESSURE_IDLE_HOURS = 6;
const ACTIVE_WINDOW_SECS = 15 * 60;
const STATE_DB_PATTERN = /^state_(\d+)\.sqlite$/u;

function resolveStateDbPath({ codexHome = process.env.CODEX_HOME || join(homedir(), ".codex") } = {}) {
	let entries;
	try {
		entries = readdirSync(codexHome);
	} catch {
		return null;
	}
	const newest = entries
		.map((name) => ({ name, version: Number(STATE_DB_PATTERN.exec(name)?.[1]) }))
		.filter((entry) => Number.isInteger(entry.version))
		.sort((a, b) => b.version - a.version)[0];
	return newest ? join(codexHome, newest.name) : null;
}

function rolloutMtimeMs(file) {
	if (typeof file !== "string" || file.length === 0) return 0;
	try {
		return statSync(file).mtimeMs;
	} catch {
		return 0;
	}
}

function unknown(reason, threadCount = "-") {
	return { verdict: "unknown", newestAgeSecs: null, threadCount, reason };
}

function openReadOnly(dbPath) {
	// node:sqlite prints an ExperimentalWarning on first load in Node 22–24.
	const originalEmitWarning = process.emitWarning;
	process.emitWarning = () => {};
	try {
		const { DatabaseSync } = require("node:sqlite");
		return new DatabaseSync(dbPath, { readOnly: true });
	} finally {
		process.emitWarning = originalEmitWarning;
	}
}

function probeCodexThreadRecency({ cwd, idleHours = IDLE_HOURS, dbPath = resolveStateDbPath(), nowMs = Date.now() }) {
	if (!cwd) return unknown("no cwd given");
	if (!(idleHours > 0)) return unknown("no idle threshold given");
	if (!dbPath) return unknown("Codex state database not found");

	let db;
	try {
		db = openReadOnly(dbPath);
	} catch (error) {
		return unknown(`Codex state database unreadable (${error.code ?? error.message})`);
	}
	// A thread working in a sub-directory is use of the worktree too. substr, not LIKE, so `%` and
	// `_` in paths stay literal; the trailing separator keeps a sibling such as `<root>-2` out.
	const root = cwd.length > 1 ? cwd.replace(/\/+$/u, "") : cwd;
	const under = `${root}/`;
	const match = "(cwd = ? OR substr(cwd, 1, length(?)) = ?)";
	let row;
	let rollouts = [];
	try {
		row = db
			.prepare(`SELECT COUNT(*) AS threads, MAX(COALESCE(updated_at_ms, updated_at * 1000)) AS newest FROM threads WHERE ${match}`)
			.get(root, under, under);
		try {
			rollouts = db.prepare(`SELECT rollout_path AS path FROM threads WHERE ${match}`).all(root, under, under);
		} catch {
			// No rollout_path column: the update times alone decide.
		}
	} catch (error) {
		return unknown(`Codex state schema not recognised (${error.message})`);
	} finally {
		db.close();
	}

	const threadCount = Number(row?.threads ?? 0);
	if (threadCount === 0) return unknown("no Codex thread has this cwd", 0);
	// updated_at_ms can lag the rollout file a turn keeps writing (seen 11 minutes behind), so
	// the newer of the two counts. Reading a file's mtime writes nothing.
	const newest = Math.max(Number(row.newest) || 0, ...rollouts.map((entry) => rolloutMtimeMs(entry.path)));
	if (!Number.isFinite(newest) || newest <= 0) return unknown("Codex thread has no update time", threadCount);

	const newestAgeSecs = Math.max(0, Math.floor((nowMs - newest) / 1000));
	const idleSecs = idleHours * 3600;
	if (newestAgeSecs < ACTIVE_WINDOW_SECS) {
		return { verdict: "active", newestAgeSecs, threadCount, reason: "a Codex thread was updated in the last 15 minutes" };
	}
	if (newestAgeSecs < idleSecs) {
		return { verdict: "recent", newestAgeSecs, threadCount, reason: `newest Codex thread is younger than ${idleHours}h` };
	}
	return { verdict: "idle", newestAgeSecs, threadCount, reason: `every Codex thread is at least ${idleHours}h old` };
}

function formatProbeLine(result) {
	return [result.verdict, result.newestAgeSecs ?? "-", result.threadCount, result.reason.replaceAll("|", "/")].join("|");
}

function parseArgs(argv) {
	const options = {};
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		const value = argv[index + 1];
		if (flag === "--pressure") {
			options.idleHours ??= PRESSURE_IDLE_HOURS;
			continue;
		}
		if (flag === "--cwd") options.cwd = value;
		else if (flag === "--idle-hours") options.idleHours = Number(value);
		else if (flag === "--db") options.dbPath = value;
		else continue;
		index += 1;
	}
	return options;
}

if (require.main === module) {
	let line;
	try {
		line = formatProbeLine(probeCodexThreadRecency(parseArgs(process.argv.slice(2))));
	} catch (error) {
		line = formatProbeLine(unknown(`probe failed (${error.message})`));
	}
	process.stdout.write(`${line}\n`);
}

module.exports = { ACTIVE_WINDOW_SECS, IDLE_HOURS, PRESSURE_IDLE_HOURS, parseArgs, formatProbeLine, probeCodexThreadRecency, resolveStateDbPath };
