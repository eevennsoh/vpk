"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { acquireBackendDataDirLock, LOCK_FILE_NAME } = require("../lib/backend-data-dir");
const { buildRovoAppThreadPaths } = require("../lib/rovo-app-storage-paths");
const { RETENTION_LIMIT } = require("../lib/rovo-app-threads");
const { main, parseArgs, runBackfill } = require("./backfill-rovo-thread-owner");

const OWNER = "557058:owner-subject";

function makeDataDir(t) {
	const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-thread-owner-backfill-"));
	t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
	return dataDir;
}

/** Writes a thread record as an older backend stored it (no owner unless given). */
function writeThread(dataDir, id, fields = {}) {
	const { threadFilePath } = buildRovoAppThreadPaths(dataDir, id);
	fs.mkdirSync(path.dirname(threadFilePath), { recursive: true });
	fs.writeFileSync(threadFilePath, `${JSON.stringify({
		id,
		title: `Thread ${id}`,
		messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }],
		createdAt: "2026-11-01T00:00:00.000Z",
		updatedAt: "2026-11-02T00:00:00.000Z",
		...fields,
	}, null, 2)}\n`);
	return threadFilePath;
}

const readThread = (dataDir, id) => JSON.parse(fs.readFileSync(buildRovoAppThreadPaths(dataDir, id).threadFilePath, "utf8"));
const quiet = () => {};

function seed(dataDir) {
	writeThread(dataDir, "rovo-app-a");
	writeThread(dataDir, "rovo-app-b", { owner: "   " });
	writeThread(dataDir, "rovo-app-mine", { owner: OWNER });
	writeThread(dataDir, "rovo-app-theirs", { owner: "someone-else" });
}

test("a dry run reports the counts and writes nothing", async (t) => {
	const dataDir = makeDataDir(t);
	seed(dataDir);
	const before = fs.readFileSync(buildRovoAppThreadPaths(dataDir, "rovo-app-a").threadFilePath, "utf8");
	const lines = [];

	const counts = await runBackfill({ owner: OWNER, dataDir, log: (line) => lines.push(line) });

	assert.deepEqual(counts, { threads: 4, ownerless: 2, alreadyOwner: 1, otherOwners: 1, unreadable: 0, assigned: 0, skipped: 0 });
	assert.equal(fs.readFileSync(buildRovoAppThreadPaths(dataDir, "rovo-app-a").threadFilePath, "utf8"), before);
	assert.ok(lines.some((line) => line.includes("Run again with --apply")));
	assert.equal(fs.existsSync(path.join(dataDir, LOCK_FILE_NAME)), false, "a dry run does not take the lock");
});

test("--apply assigns only ownerless threads, keeps their other fields, and runs again as a no-op", async (t) => {
	const dataDir = makeDataDir(t);
	seed(dataDir);

	const counts = await runBackfill({ owner: OWNER, dataDir, apply: true, log: quiet });

	assert.equal(counts.assigned, 2);
	const assigned = readThread(dataDir, "rovo-app-a");
	assert.equal(assigned.owner, OWNER);
	assert.equal(assigned.updatedAt, "2026-11-02T00:00:00.000Z", "the list order does not change");
	assert.equal(assigned.title, "Thread rovo-app-a");
	assert.equal(assigned.messages.length, 1);
	assert.equal(readThread(dataDir, "rovo-app-b").owner, OWNER);
	assert.equal(readThread(dataDir, "rovo-app-theirs").owner, "someone-else", "an existing owner is never replaced");
	assert.equal(readThread(dataDir, "rovo-app-mine").owner, OWNER);
	assert.equal(fs.existsSync(path.join(dataDir, LOCK_FILE_NAME)), false, "the lock is released");
	const leftovers = fs.readdirSync(path.dirname(buildRovoAppThreadPaths(dataDir, "rovo-app-a").threadFilePath)).filter((name) => name.endsWith(".tmp"));
	assert.deepEqual(leftovers, [], "the write leaves no temp file");

	const again = await runBackfill({ owner: OWNER, dataDir, apply: true, log: quiet });
	assert.deepEqual(again, { threads: 4, ownerless: 0, alreadyOwner: 3, otherOwners: 1, unreadable: 0, assigned: 0, skipped: 0 });
});

test("--apply refuses while a live backend holds the data directory lock", async (t) => {
	const dataDir = makeDataDir(t);
	seed(dataDir);
	// A live process other than this one (the test runner's parent) holds the lock.
	const backend = acquireBackendDataDirLock({ dataDir, pid: process.ppid, startTimeOf: () => null, onExit: () => {}, log: quiet });
	t.after(() => fs.rmSync(backend.lockPath, { force: true }));

	await assert.rejects(
		runBackfill({ owner: OWNER, dataDir, apply: true, log: quiet }),
		(error) => error.code === "BACKEND_DATA_DIR_LOCKED",
	);
	assert.equal(readThread(dataDir, "rovo-app-a").owner, undefined, "nothing was written");
	assert.equal(JSON.parse(fs.readFileSync(backend.lockPath, "utf8")).pid, process.ppid, "the backend keeps its lock");

	const dryRun = await runBackfill({ owner: OWNER, dataDir, log: quiet });
	assert.equal(dryRun.ownerless, 2, "a dry run still reads while the backend runs");
});

test("--apply takes over a stale lock left by a backend that is gone", async (t) => {
	const dataDir = makeDataDir(t);
	seed(dataDir);
	fs.writeFileSync(path.join(dataDir, LOCK_FILE_NAME), `${JSON.stringify({ pid: 2 ** 22 + 12345 })}\n`);

	const counts = await runBackfill({ owner: OWNER, dataDir, apply: true, log: quiet });

	assert.equal(counts.assigned, 2);
	assert.equal(fs.existsSync(path.join(dataDir, LOCK_FILE_NAME)), false);
});

test("unreadable records are counted and left alone", async (t) => {
	const dataDir = makeDataDir(t);
	writeThread(dataDir, "rovo-app-a");
	const broken = writeThread(dataDir, "rovo-app-broken");
	fs.writeFileSync(broken, "{ not json");

	const counts = await runBackfill({ owner: OWNER, dataDir, apply: true, log: quiet });

	assert.equal(counts.unreadable, 1);
	assert.equal(counts.assigned, 1);
	assert.equal(fs.readFileSync(broken, "utf8"), "{ not json");
});

test("it warns when the owner would pass the per-owner retention limit", async (t) => {
	const dataDir = makeDataDir(t);
	for (let index = 0; index <= RETENTION_LIMIT; index += 1) {
		writeThread(dataDir, `rovo-app-${index}`);
	}
	const lines = [];

	const counts = await runBackfill({ owner: OWNER, dataDir, log: (line) => lines.push(line) });

	assert.equal(counts.ownerless, RETENTION_LIMIT + 1, "every thread is counted, not only the newest page");
	assert.ok(lines.some((line) => line.startsWith("Warning:") && line.includes("deletes the oldest 1")));
});

test("an empty data directory has nothing to assign; a missing one is an error", async (t) => {
	const dataDir = makeDataDir(t);
	const counts = await runBackfill({ owner: OWNER, dataDir, log: quiet });
	assert.equal(counts.threads, 0);

	const errors = [];
	const code = await main(["--owner", OWNER, "--data-dir", path.join(dataDir, "missing")], { log: quiet, error: (line) => errors.push(line) });
	assert.equal(code, 1);
	assert.match(errors.join("\n"), /does not exist/u);
	assert.equal(fs.existsSync(path.join(dataDir, "missing")), false, "it does not create the directory");
});

test("parseArgs defaults to a dry run and validates the owner", () => {
	assert.deepEqual(parseArgs(["--owner", ` ${OWNER} `, "--data-dir", "/tmp/data"]), { help: false, owner: OWNER, dataDir: path.resolve("/tmp/data"), apply: false });
	assert.equal(parseArgs(["--owner=x", "--data-dir=/d", "--apply"]).apply, true);
	assert.deepEqual(parseArgs(["--help"]), { help: true });
	assert.equal(parseArgs(["--", "--owner", "x", "--data-dir", "/d"]).owner, "x", "pnpm run's separator is ignored");
	for (const argv of [
		["--data-dir", "/d"],
		["--owner", "x"],
		["--owner", "local", "--data-dir", "/d"],
		["--owner", "a\u0007b", "--data-dir", "/d"],
		["--owner", "x".repeat(257), "--data-dir", "/d"],
		["--owner", "x", "--data-dir", "/d", "--apply", "--dry-run"],
		["--owner", "--data-dir", "/d"],
		["--owner", "x", "--data-dir", "/d", "--force"],
	]) {
		assert.throws(() => parseArgs(argv), undefined, argv.join(" "));
	}
});

test("main exits 2 with the usage on a bad argument", async () => {
	const errors = [];
	assert.equal(await main(["--owner", "x"], { log: quiet, error: (line) => errors.push(line) }), 2);
	assert.match(errors.join("\n"), /--data-dir <dir> is required[\s\S]*Usage:/u);
});

test("assignOwnerIfMissing queues behind a concurrent backend update, so neither write is lost", async (t) => {
	const { createRovoAppThreadManager } = require("../lib/rovo-app-threads");
	const dataDir = makeDataDir(t);
	writeThread(dataDir, "rovo-app-a");
	const manager = createRovoAppThreadManager({ baseDir: dataDir, logger: { error: quiet } });

	const [, result] = await Promise.all([
		manager.updateThread("rovo-app-a", { title: "Renamed" }),
		manager.assignOwnerIfMissing("rovo-app-a", OWNER),
		manager.updateThread("rovo-app-a", { owner: "ignored" }),
	]);

	assert.equal(result.status, "assigned");
	const stored = readThread(dataDir, "rovo-app-a");
	assert.equal(stored.title, "Renamed");
	assert.equal(stored.owner, OWNER);
	assert.equal((await manager.assignOwnerIfMissing("rovo-app-a", "someone-else")).status, "owned");
	assert.equal(readThread(dataDir, "rovo-app-a").owner, OWNER);
	assert.equal((await manager.assignOwnerIfMissing("rovo-app-gone", OWNER)).status, "missing");
	await assert.rejects(manager.assignOwnerIfMissing("rovo-app-a", "  "), /requires an owner/u);
});
