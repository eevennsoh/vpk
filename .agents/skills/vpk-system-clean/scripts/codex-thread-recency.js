#!/usr/bin/env node
// codex-thread-recency.js — read-only probe: is any Codex thread for this exact
// worktree cwd still in use?
//
//   node codex-thread-recency.js --cwd <worktree> [--idle-hours <n>] [--db <path>]
//
// Prints one line, `verdict|newest_age_secs|thread_count|reason`:
//   active   a thread for this cwd was updated in the last ACTIVE_WINDOW_SECS
//   recent   the newest thread is younger than the idle threshold
//   idle     every thread for this cwd is at least the idle threshold old
//   unknown  no thread matches, the database is missing or unreadable, or its
//            schema has changed; callers must keep the stack
//
// Only `idle` lets a caller stop a stack. The database is opened read-only and
// nothing under the Codex home is ever written. Exit status is always 0.
"use strict";

const { readdirSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

// PROVISIONAL until the owner confirms it: a Codex worktree's stack may be
// stopped once its newest thread is this many hours old. The sweep and
// status.sh both take it from here.
const IDLE_HOURS = 24;
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
	let row;
	try {
		row = db
			.prepare("SELECT COUNT(*) AS threads, MAX(COALESCE(updated_at_ms, updated_at * 1000)) AS newest FROM threads WHERE cwd = ?")
			.get(cwd);
	} catch (error) {
		return unknown(`Codex state schema not recognised (${error.message})`);
	} finally {
		db.close();
	}

	const threadCount = Number(row?.threads ?? 0);
	if (threadCount === 0) return unknown("no Codex thread has this cwd", 0);
	const newest = Number(row.newest);
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

module.exports = { ACTIVE_WINDOW_SECS, IDLE_HOURS, formatProbeLine, probeCodexThreadRecency, resolveStateDbPath };
