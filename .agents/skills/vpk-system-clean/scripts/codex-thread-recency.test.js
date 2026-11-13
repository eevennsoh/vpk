const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const {
	IDLE_HOURS,
	PRESSURE_IDLE_HOURS,
	parseArgs,
	probeCodexThreadRecency,
	resolveStateDbPath,
} = require("./codex-thread-recency.js");

const PROBE_PATH = join(__dirname, "codex-thread-recency.js");
const HOUR_MS = 3600 * 1000;
const NOW_MS = Date.UTC(2026, 10, 13, 12, 0, 0);
const WORKTREE = "/Users/someone/.codex/worktrees/9eb6/vpk";

function loadSqlite() {
	const originalEmitWarning = process.emitWarning;
	process.emitWarning = () => {};
	try {
		return require("node:sqlite");
	} finally {
		process.emitWarning = originalEmitWarning;
	}
}

function withCodexHome(callback) {
	const codexHome = mkdtempSync(join(tmpdir(), "codex-recency-test-"));
	try {
		return callback(codexHome);
	} finally {
		rmSync(codexHome, { recursive: true, force: true });
	}
}

// The real Codex database is in WAL mode; `wal: true` builds the fixture the same way.
function writeStateDb(path, threads, { schema = "current", wal = false } = {}) {
	const { DatabaseSync } = loadSqlite();
	const db = new DatabaseSync(path);
	if (wal) db.exec("PRAGMA journal_mode=WAL");
	if (schema === "current") {
		db.exec("CREATE TABLE threads (id TEXT PRIMARY KEY, cwd TEXT NOT NULL, updated_at INTEGER NOT NULL, updated_at_ms INTEGER, rollout_path TEXT)");
		const insert = db.prepare("INSERT INTO threads (id, cwd, updated_at, updated_at_ms, rollout_path) VALUES (?, ?, ?, ?, ?)");
		threads.forEach((thread, index) => {
			const updatedMs = thread.updatedMs;
			insert.run(`t${index}`, thread.cwd, Math.floor(updatedMs / 1000), thread.legacyOnly ? null : updatedMs, thread.rollout ?? null);
		});
	} else {
		db.exec("CREATE TABLE threads (id TEXT PRIMARY KEY, cwd TEXT NOT NULL)");
	}
	db.close();
}

function probe(codexHome, threads, options = {}) {
	const dbPath = join(codexHome, "state_5.sqlite");
	writeStateDb(dbPath, threads, options);
	return probeCodexThreadRecency({ cwd: WORKTREE, dbPath, nowMs: NOW_MS, ...options.probe });
}

test("the provisional idle thresholds are 24 hours, 6 under pressure", () => {
	assert.equal(IDLE_HOURS, 24);
	assert.equal(PRESSURE_IDLE_HOURS, 6);
	assert.equal(parseArgs(["--cwd", WORKTREE, "--pressure"]).idleHours, 6);
	assert.equal(parseArgs(["--cwd", WORKTREE]).idleHours, undefined);
	assert.equal(parseArgs(["--idle-hours", "3", "--pressure"]).idleHours, 3);
});

test("a thread updated minutes ago is active", () => {
	withCodexHome((codexHome) => {
		const result = probe(codexHome, [{ cwd: WORKTREE, updatedMs: NOW_MS - 2 * 60 * 1000 }]);
		assert.equal(result.verdict, "active");
		assert.equal(result.newestAgeSecs, 120);
	});
});

test("a thread younger than the threshold is recent, even beside idle ones", () => {
	withCodexHome((codexHome) => {
		const result = probe(codexHome, [
			{ cwd: WORKTREE, updatedMs: NOW_MS - 40 * HOUR_MS },
			{ cwd: WORKTREE, updatedMs: NOW_MS - 3 * HOUR_MS },
		]);
		assert.equal(result.verdict, "recent");
		assert.equal(result.threadCount, 2);
	});
});

test("every thread past the threshold is idle", () => {
	withCodexHome((codexHome) => {
		const result = probe(codexHome, [
			{ cwd: WORKTREE, updatedMs: NOW_MS - 26 * HOUR_MS },
			{ cwd: WORKTREE, updatedMs: NOW_MS - 30 * HOUR_MS },
			{ cwd: `${WORKTREE}/app`, updatedMs: NOW_MS - 50 * HOUR_MS },
			{ cwd: `${WORKTREE}-other`, updatedMs: NOW_MS - 60 * 1000 },
			{ cwd: `${WORKTREE}2/app`, updatedMs: NOW_MS - 60 * 1000 },
		]);
		assert.equal(result.verdict, "idle");
		assert.equal(result.threadCount, 3, "the root and its sub-directory count; siblings sharing a prefix do not");
		assert.equal(result.newestAgeSecs, 26 * 3600);
	});
});

test("a fresh thread in a sub-directory makes the worktree active even beside an old root thread", () => {
	withCodexHome((codexHome) => {
		const result = probe(codexHome, [
			{ cwd: WORKTREE, updatedMs: NOW_MS - 40 * HOUR_MS },
			{ cwd: `${WORKTREE}/components/blocks`, updatedMs: NOW_MS - 60 * 1000 },
		]);
		assert.equal(result.verdict, "active");
		assert.equal(result.threadCount, 2);
	});
});

test("% and _ in the worktree path are literal", () => {
	withCodexHome((codexHome) => {
		const dbPath = join(codexHome, "state_5.sqlite");
		writeStateDb(dbPath, [{ cwd: "/w/aXb%c/sub", updatedMs: NOW_MS - 60 * 1000 }]);
		const result = probeCodexThreadRecency({ cwd: "/w/a_b%", dbPath, nowMs: NOW_MS });
		assert.equal(result.verdict, "unknown", "LIKE would have matched `_` against X");
	});
});

test("a recent rollout write counts even when updated_at_ms lags behind it", () => {
	withCodexHome((codexHome) => {
		const rollout = join(codexHome, "rollout.jsonl");
		writeFileSync(rollout, "{}\n");
		const result = probe(codexHome, [{ cwd: WORKTREE, updatedMs: NOW_MS - 30 * HOUR_MS, rollout }], { probe: { nowMs: statSync(rollout).mtimeMs + 60_000 } });
		assert.equal(result.verdict, "active");
	});
	withCodexHome((codexHome) => {
		const missing = probe(codexHome, [{ cwd: WORKTREE, updatedMs: NOW_MS - 30 * HOUR_MS, rollout: join(codexHome, "gone.jsonl") }]);
		assert.equal(missing.verdict, "idle", "a missing rollout file leaves the update time to decide");
	});
});

test("a thread update still only in the write-ahead log is read", () => {
	withCodexHome((codexHome) => {
		const dbPath = join(codexHome, "state_5.sqlite");
		writeStateDb(dbPath, [{ cwd: WORKTREE, updatedMs: NOW_MS - 40 * HOUR_MS }], { wal: true });
		const { DatabaseSync } = loadSqlite();
		const writer = new DatabaseSync(dbPath);
		try {
			writer.exec("PRAGMA wal_autocheckpoint=0");
			writer.prepare("UPDATE threads SET updated_at_ms = ?, updated_at = ?").run(NOW_MS - 30_000, Math.floor((NOW_MS - 30_000) / 1000));
			assert.ok(statSync(`${dbPath}-wal`).size > 0, "the update sits in the WAL");
			// The main file alone still holds the old row: copy it without its WAL and read it.
			const mainOnly = join(codexHome, "main-only.sqlite");
			copyFileSync(dbPath, mainOnly);
			assert.equal(probeCodexThreadRecency({ cwd: WORKTREE, dbPath: mainOnly, nowMs: NOW_MS }).verdict, "idle");
			assert.equal(probeCodexThreadRecency({ cwd: WORKTREE, dbPath, nowMs: NOW_MS }).verdict, "active");
		} finally {
			writer.close();
		}
	});
});

test("a shorter threshold turns a recent thread idle", () => {
	withCodexHome((codexHome) => {
		const result = probe(codexHome, [{ cwd: WORKTREE, updatedMs: NOW_MS - 13 * HOUR_MS }], { probe: { idleHours: 6 } });
		assert.equal(result.verdict, "idle");
	});
});

test("rows without updated_at_ms fall back to updated_at seconds", () => {
	withCodexHome((codexHome) => {
		const result = probe(codexHome, [{ cwd: WORKTREE, updatedMs: NOW_MS - 2 * HOUR_MS, legacyOnly: true }]);
		assert.equal(result.verdict, "recent");
	});
});

test("no thread for the cwd is unknown, so the stack is kept", () => {
	withCodexHome((codexHome) => {
		const result = probe(codexHome, [{ cwd: "/elsewhere", updatedMs: NOW_MS - 90 * HOUR_MS }]);
		assert.equal(result.verdict, "unknown");
		assert.equal(result.threadCount, 0);
	});
});

test("a missing database is unknown", () => {
	withCodexHome((codexHome) => {
		const result = probeCodexThreadRecency({ cwd: WORKTREE, dbPath: join(codexHome, "state_5.sqlite"), nowMs: NOW_MS });
		assert.equal(result.verdict, "unknown");
		assert.equal(resolveStateDbPath({ codexHome }), null);
	});
});

test("an unrecognised schema is unknown", () => {
	withCodexHome((codexHome) => {
		const result = probe(codexHome, [], { schema: "old" });
		assert.equal(result.verdict, "unknown");
		assert.match(result.reason, /schema not recognised/u);
	});
});

test("a file that is not a database is unknown", () => {
	withCodexHome((codexHome) => {
		const dbPath = join(codexHome, "state_5.sqlite");
		writeFileSync(dbPath, "not a database");
		const result = probeCodexThreadRecency({ cwd: WORKTREE, dbPath, nowMs: NOW_MS });
		assert.equal(result.verdict, "unknown");
	});
});

test("the newest state_N database is chosen", () => {
	withCodexHome((codexHome) => {
		for (const name of ["state_4.sqlite", "state_12.sqlite", "state_5.sqlite-wal", "logs_2.sqlite"]) {
			writeFileSync(join(codexHome, name), "");
		}
		assert.equal(resolveStateDbPath({ codexHome }), join(codexHome, "state_12.sqlite"));
	});
});

test("the CLI reads CODEX_HOME, prints one parseable line, and changes nothing but WAL sidecars", () => {
	withCodexHome((codexHome) => {
		const dbPath = join(codexHome, "state_5.sqlite");
		writeStateDb(dbPath, [{ cwd: WORKTREE, updatedMs: Date.now() - 30 * HOUR_MS }], { wal: true });
		const before = { bytes: readFileSync(dbPath).toString("base64"), mtimeMs: statSync(dbPath).mtimeMs };
		const filesBefore = new Set(readdirSync(codexHome));
		const result = spawnSync(process.execPath, [PROBE_PATH, "--cwd", WORKTREE], {
			encoding: "utf8",
			env: { ...process.env, CODEX_HOME: codexHome },
		});
		assert.equal(result.status, 0, result.stderr);
		assert.equal(result.stderr, "");
		const [verdict, ageSecs, threadCount] = result.stdout.trim().split("|");
		assert.equal(verdict, "idle");
		assert.ok(Number(ageSecs) >= 30 * 3600);
		assert.equal(threadCount, "1");
		// The database itself is untouched. With no other connection open, SQLite's WAL mode
		// creates the -shm/-wal sidecars beside it; nothing else appears.
		assert.deepEqual({ bytes: readFileSync(dbPath).toString("base64"), mtimeMs: statSync(dbPath).mtimeMs }, before);
		const added = readdirSync(codexHome).filter((name) => !filesBefore.has(name)).sort();
		assert.ok(added.every((name) => ["state_5.sqlite-shm", "state_5.sqlite-wal"].includes(name)), `unexpected files: ${added.join(", ")}`);
	});
});
