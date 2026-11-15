"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	BackendDataDirLockedError,
	LOCK_FILE_NAME,
	acquireBackendDataDirLock,
	resolveBackendDataDir,
} = require("./backend-data-dir");

function tempDataDir(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-data-dir-lock-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	return path.join(root, "data");
}

function writeLock(dataDir, record) {
	fs.mkdirSync(dataDir, { recursive: true });
	fs.writeFileSync(path.join(dataDir, LOCK_FILE_NAME), `${JSON.stringify(record)}\n`);
}

const readLock = (dataDir) => JSON.parse(fs.readFileSync(path.join(dataDir, LOCK_FILE_NAME), "utf8"));
const quiet = { log: () => {}, onExit: () => {}, startTimeOf: () => null };

test("resolveBackendDataDir defaults to backend/data and honours VPK_BACKEND_DATA_DIR", () => {
	assert.equal(resolveBackendDataDir({ backendDir: "/repo/backend", env: {} }), path.join("/repo/backend", "data"));
	assert.equal(resolveBackendDataDir({ backendDir: "/repo/backend", env: { VPK_BACKEND_DATA_DIR: "  " } }), path.join("/repo/backend", "data"));
	assert.equal(resolveBackendDataDir({ backendDir: "/repo/backend", env: { VPK_BACKEND_DATA_DIR: "/tmp/elsewhere" } }), "/tmp/elsewhere");
});

test("the first backend takes the lock, creating the data directory, and release removes it", (t) => {
	const dataDir = tempDataDir(t);
	let registered = null;
	const lock = acquireBackendDataDirLock({ ...quiet, dataDir, pid: 4242, port: "8080", onExit: (release) => (registered = release) });
	assert.equal(lock.lockPath, path.join(dataDir, LOCK_FILE_NAME));
	assert.deepEqual({ pid: readLock(dataDir).pid, port: readLock(dataDir).port }, { pid: 4242, port: "8080" });
	assert.equal(registered, lock.release, "release runs on process exit");
	lock.release();
	assert.equal(fs.existsSync(lock.lockPath), false);
});

test("a second backend fails fast naming the live holder's pid, and leaves its lock alone", (t) => {
	const dataDir = tempDataDir(t);
	acquireBackendDataDirLock({ ...quiet, dataDir, pid: 1111, port: "8080" });
	assert.throws(
		() => acquireBackendDataDirLock({ ...quiet, dataDir, pid: 2222, alive: (pid) => pid === 1111 }),
		(error) => {
			assert.ok(error instanceof BackendDataDirLockedError);
			assert.equal(error.code, "BACKEND_DATA_DIR_LOCKED");
			assert.equal(error.holderPid, 1111);
			assert.match(error.message, /already in use by backend pid 1111 \(port 8080/u);
			assert.match(error.message, /Stop pid 1111, or set VPK_BACKEND_DATA_DIR/u);
			return true;
		},
	);
	assert.equal(readLock(dataDir).pid, 1111);
});

test("an ephemeral port \"0\" is not recorded, so a conflict message never says \"port 0\"", (t) => {
	const dataDir = tempDataDir(t);
	acquireBackendDataDirLock({ ...quiet, dataDir, pid: 1111, port: "0" });
	assert.equal(readLock(dataDir).port, null);
	assert.throws(
		() => acquireBackendDataDirLock({ ...quiet, dataDir, pid: 2222, alive: (pid) => pid === 1111 }),
		(error) => !/port 0/u.test(error.message) && /already in use by backend pid 1111/u.test(error.message),
	);
});

test("a lock whose holder is gone is stale and taken over", (t) => {
	const dataDir = tempDataDir(t);
	writeLock(dataDir, { pid: 999_999, startedAt: "2026-01-01T00:00:00.000Z" });
	const logs = [];
	acquireBackendDataDirLock({ ...quiet, dataDir, pid: 3333, alive: () => false, log: (line) => logs.push(line) });
	assert.equal(readLock(dataDir).pid, 3333);
	assert.match(logs.join("\n"), /stale backend lock in .*\(pid 999999 is gone\)/u);
});

test("a live pid that now runs a different process (start time changed) is not the holder", (t) => {
	const dataDir = tempDataDir(t);
	writeLock(dataDir, { pid: 1111, procStart: "Mon Jan  1 00:00:00 2026" });
	acquireBackendDataDirLock({ ...quiet, dataDir, pid: 3333, alive: () => true, startTimeOf: (pid) => (pid === 1111 ? "Tue Jan  2 00:00:00 2026" : null) });
	assert.equal(readLock(dataDir).pid, 3333);
});

test("a lock recorded under this process's own pid (a restarted container) is stale", (t) => {
	const dataDir = tempDataDir(t);
	writeLock(dataDir, { pid: 1, startedAt: "2026-01-01T00:00:00.000Z" });
	acquireBackendDataDirLock({ ...quiet, dataDir, pid: 1, alive: () => true });
	assert.notEqual(readLock(dataDir).startedAt, "2026-01-01T00:00:00.000Z");
});

test("an unreadable lock is taken over", (t) => {
	const dataDir = tempDataDir(t);
	fs.mkdirSync(dataDir, { recursive: true });
	fs.writeFileSync(path.join(dataDir, LOCK_FILE_NAME), "not json");
	acquireBackendDataDirLock({ ...quiet, dataDir, pid: 3333, alive: () => true });
	assert.equal(readLock(dataDir).pid, 3333);
});

test("release never removes a lock that a successor now holds", (t) => {
	const dataDir = tempDataDir(t);
	const lock = acquireBackendDataDirLock({ ...quiet, dataDir, pid: 1111 });
	writeLock(dataDir, { pid: 2222 });
	lock.release();
	assert.equal(readLock(dataDir).pid, 2222);
});
