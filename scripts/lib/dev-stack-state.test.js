const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	NEXT_ACTIONS,
	STACK_FILE,
	STACK_STATUSES,
	canonicalPath,
	clearService,
	collectStackFacts,
	readProcessIdentity,
	verifyRecordedProcess,
	deriveStackStatus,
	readStackRecord,
	recordPhase,
	recordService,
	recordedPids,
	withStackLock,
} = require("./dev-stack-state");

const NOW = Date.parse("2026-11-14T12:00:00.000Z");
const secondsAgo = (seconds) => new Date(NOW - seconds * 1000).toISOString();

const record = (phase, seconds = 5) => ({
	version: 1,
	worktree: "/repo",
	session: { name: "vpk-dev-repo", socket: "vpk-dev" },
	phase,
	phaseAt: secondsAgo(seconds),
	services: {},
});

const serving = { listening: true, listenerInWorktree: true, pidAlive: true, childPidAlive: true };
const legacyServing = { listening: true, listenerInWorktree: true, pidAlive: null, childPidAlive: null };
const heldElsewhere = { listening: true, listenerInWorktree: false, pidAlive: null, childPidAlive: null };
const notYet = { listening: false, pidAlive: true, childPidAlive: true };
const exited = { listening: false, pidAlive: false, childPidAlive: false };
const childDied = { listening: true, listenerInWorktree: true, pidAlive: true, childPidAlive: false };
const missing = { listening: false, pidAlive: null, childPidAlive: null };
const lingering = { listening: true, listenerInWorktree: true, pidAlive: false, childPidAlive: true };

// [description, facts, expected status]
const CASES = [
	["no record, no session, nothing alive", { record: null, sessionAlive: false, services: { frontend: missing, backend: missing } }, "absent"],
	["the launcher preparing .env.local before it creates the session", { record: record("seeding-env"), sessionAlive: false, services: { frontend: missing, backend: missing } }, "seeding-env"],
	["preparing .env.local, then the launcher died", { record: record("seeding-env", 120), sessionAlive: false, services: {} }, "stopped"],
	["preparing .env.local for longer than the start timeout", { record: record("seeding-env", 120), sessionAlive: true, services: {} }, "degraded"],
	["a session whose servers have not listened yet", { record: record("starting"), sessionAlive: true, services: { frontend: notYet, backend: notYet } }, "starting"],
	["only the backend listens so far", { record: record("starting"), sessionAlive: true, services: { frontend: notYet, backend: serving } }, "starting"],
	["both services listen with live processes", { record: record("starting"), sessionAlive: true, services: { frontend: serving, backend: serving } }, "ready"],
	["a stack from before this file: ports listen, no pids", { record: null, sessionAlive: true, services: { frontend: legacyServing, backend: legacyServing } }, "ready"],
	["still not listening after the start timeout", { record: record("starting", 120), sessionAlive: true, services: { frontend: notYet, backend: serving } }, "degraded"],
	["the frontend exited seconds into the start", { record: record("starting", 5), sessionAlive: true, services: { frontend: exited, backend: notYet } }, "degraded"],
	["the frontend exited while the session runs", { record: record("starting", 600), sessionAlive: true, services: { frontend: exited, backend: serving } }, "degraded"],
	["next dev died but its launcher still holds the port", { record: record("starting", 600), sessionAlive: true, services: { frontend: childDied, backend: serving } }, "degraded"],
	["a session with no record and nothing listening", { record: null, sessionAlive: true, services: { frontend: missing, backend: missing } }, "degraded"],
	["a stop in progress", { record: record("stopping", 2), sessionAlive: true, services: { frontend: serving, backend: serving } }, "stopping"],
	["a stop that finished but was not recorded", { record: record("stopping", 2), sessionAlive: false, services: { frontend: exited, backend: exited } }, "stopped"],
	["a stop that left a process past the stop timeout", { record: record("stopping", 60), sessionAlive: false, services: { frontend: lingering, backend: exited } }, "orphaned"],
	["a recorded stop with nothing alive", { record: record("stopped"), sessionAlive: false, services: { frontend: missing, backend: missing } }, "stopped"],
	["the session is gone but next dev still runs", { record: record("starting", 600), sessionAlive: false, services: { frontend: lingering, backend: exited } }, "orphaned"],
	["no session, no record, but a server in this worktree holds a port file's port", { record: null, sessionAlive: false, services: { frontend: legacyServing, backend: missing } }, "orphaned"],
	["no session, and a process in another directory holds a recorded port", { record: record("stopped"), sessionAlive: false, services: { frontend: heldElsewhere, backend: missing } }, "stopped"],
	["a session whose ports are held by processes elsewhere", { record: record("starting", 600), sessionAlive: true, services: { frontend: heldElsewhere, backend: heldElsewhere } }, "degraded"],
	["a session after a recorded stop (started by an older launcher)", { record: record("stopped"), sessionAlive: true, services: { frontend: legacyServing, backend: legacyServing } }, "ready"],
];

for (const [description, facts, expected] of CASES) {
	test(`deriveStackStatus: ${description} → ${expected}`, () => {
		const { status, nextAction, reason } = deriveStackStatus({ now: NOW, ...facts });
		assert.equal(status, expected);
		assert.equal(nextAction, NEXT_ACTIONS[expected]);
		assert.ok(reason.length > 0);
	});
}

test("every status is reachable and has a next action", () => {
	const reached = new Set(CASES.map(([, , status]) => status));
	assert.deepEqual([...reached].sort(), [...STACK_STATUSES].sort());
	for (const status of STACK_STATUSES) assert.ok(NEXT_ACTIONS[status], status);
});

test("ready needs a listening port, not only a live process", () => {
	const { status } = deriveStackStatus({
		now: NOW,
		record: record("starting", 600),
		sessionAlive: true,
		services: { frontend: notYet, backend: serving },
	});
	assert.equal(status, "degraded");
});

function tempWorktree(t) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-stack-state-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}

const clock = (iso) => () => new Date(iso);

test("recording services writes the record and mirrors each port file", (t) => {
	const dir = tempWorktree(t);
	recordPhase(dir, "starting", { session: { name: "vpk-dev-x", socket: "vpk-dev" }, now: clock("2026-11-14T12:00:00.000Z") });
	recordService(dir, "frontend", { port: 3001, pid: 101, childPid: 102 });
	recordService(dir, "backend", { port: 8081, pid: 201, childPid: 202 });

	const saved = readStackRecord(dir);
	assert.equal(saved.phase, "starting");
	assert.equal(saved.phaseAt, "2026-11-14T12:00:00.000Z");
	assert.deepEqual(saved.session, { name: "vpk-dev-x", socket: "vpk-dev" });
	assert.equal(saved.services.frontend.port, 3001);
	assert.equal(saved.services.backend.childPid, 202);
	assert.equal(fs.readFileSync(path.join(dir, ".dev-frontend-port"), "utf8"), "3001");
	assert.equal(fs.readFileSync(path.join(dir, ".dev-backend-port"), "utf8"), "8081");
	assert.deepEqual(recordedPids(saved), [101, 102, 201, 202]);
});

test("clearing a service removes its port file, and only the launcher that recorded it can clear it", (t) => {
	const dir = tempWorktree(t);
	recordService(dir, "frontend", { port: 3001, pid: 101, childPid: 102 });
	clearService(dir, "frontend", { pid: 999 });
	assert.equal(readStackRecord(dir).services.frontend.pid, 101);
	assert.ok(fs.existsSync(path.join(dir, ".dev-frontend-port")));

	clearService(dir, "frontend", { pid: 101 });
	assert.equal(readStackRecord(dir).services.frontend, undefined);
	assert.equal(fs.existsSync(path.join(dir, ".dev-frontend-port")), false);
});

test("a new start and a finished stop forget the previous run's processes", (t) => {
	const dir = tempWorktree(t);
	recordService(dir, "frontend", { port: 3001, pid: 101 });
	recordPhase(dir, "stopping");
	assert.deepEqual(recordedPids(readStackRecord(dir)), [101]);
	recordPhase(dir, "stopped");
	assert.deepEqual(recordedPids(readStackRecord(dir)), []);
	assert.equal(fs.existsSync(path.join(dir, ".dev-frontend-port")), false);

	recordService(dir, "backend", { port: 8081, pid: 201 });
	recordPhase(dir, "seeding-env");
	assert.deepEqual(readStackRecord(dir).services, {});
});

test("an unknown phase is refused", (t) => {
	const dir = tempWorktree(t);
	assert.throws(() => recordPhase(dir, "ready"), /Unknown stack phase: ready/);
});

test("a record that is unreadable, from another version, or for another worktree reads as none", (t) => {
	const dir = tempWorktree(t);
	const file = path.join(dir, STACK_FILE);
	fs.writeFileSync(file, "{not json");
	assert.equal(readStackRecord(dir), null);
	fs.writeFileSync(file, JSON.stringify({ version: 2, phase: "starting" }));
	assert.equal(readStackRecord(dir), null);
	fs.writeFileSync(file, JSON.stringify({ version: 1, worktree: "/elsewhere", phase: "starting" }));
	assert.equal(readStackRecord(dir), null);
});

test("concurrent writers under the lock keep both services", async (t) => {
	const dir = tempWorktree(t);
	const { spawn } = require("node:child_process");
	const modulePath = require.resolve("./dev-stack-state");
	const writer = (service, port) =>
		new Promise((resolve, reject) => {
			const code = `const s = require(${JSON.stringify(modulePath)});
for (let i = 0; i < 25; i += 1) s.recordService(${JSON.stringify(dir)}, ${JSON.stringify(service)}, { port: ${port} + i, pid: process.pid });`;
			const child = spawn(process.execPath, ["-e", code], { stdio: "ignore" });
			child.once("error", reject);
			child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${service} writer exited ${code}`))));
		});
	await Promise.all([writer("frontend", 3000), writer("backend", 8000)]);
	const saved = readStackRecord(dir);
	assert.equal(saved.services.frontend.port, 3024);
	assert.equal(saved.services.backend.port, 8024);
	assert.equal(fs.existsSync(path.join(dir, `${STACK_FILE}.lock`)), false);
});

test("a lock left by a dead holder is taken over once stale", (t) => {
	const dir = tempWorktree(t);
	const lock = path.join(dir, `${STACK_FILE}.lock`);
	fs.writeFileSync(lock, "");
	const old = new Date(Date.now() - 60_000);
	fs.utimesSync(lock, old, old);
	assert.equal(withStackLock(dir, () => "ran"), "ran");
	assert.equal(fs.existsSync(lock), false);
});

test("collectStackFacts falls back to port files and probes recorded pids", async (t) => {
	const dir = tempWorktree(t);
	fs.writeFileSync(path.join(dir, ".dev-frontend-port"), "3005\n");
	const listeningPorts = new Set([3005]);
	let facts = await collectStackFacts({
		worktreePath: dir,
		sessionAlive: true,
		isPortListening: (port) => listeningPorts.has(port),
		listenerInWorktree: () => true,
		verifyProcess: () => true,
		now: NOW,
	});
	assert.equal(facts.record, null);
	assert.deepEqual(facts.services.frontend, { port: 3005, exited: null, pid: null, childPid: null, listening: true, listenerInWorktree: true, pidAlive: null, childPidAlive: null });
	assert.equal(facts.services.backend.listening, false);

	recordService(dir, "backend", { port: 8085, pid: 41, pidStart: "Sat Nov 14 10:00:00 2026", childPid: 42, childStart: "Sat Nov 14 10:00:01 2026" });
	listeningPorts.add(8085);
	const verified = [];
	facts = await collectStackFacts({
		worktreePath: dir,
		sessionAlive: true,
		isPortListening: (port) => listeningPorts.has(port),
		listenerInWorktree: () => true,
		verifyProcess: (query) => {
			verified.push(query);
			return query.pid === 41;
		},
		now: NOW,
	});
	assert.deepEqual(verified.map(({ pid, start }) => [pid, start]), [[41, "Sat Nov 14 10:00:00 2026"], [42, "Sat Nov 14 10:00:01 2026"]]);
	assert.equal(facts.services.backend.pidAlive, true);
	assert.equal(facts.services.backend.childPidAlive, false);
	assert.equal(deriveStackStatus(facts).status, "degraded");
});

test("a recorded pid counts only while its start time and command still match", () => {
	const alive = (start, command) => () => ({ state: "alive", start, command });
	const recorded = { pid: 77, start: "Sat Nov 14 10:32:53 2026", command: "node scripts/dev-frontend.js" };
	assert.equal(verifyRecordedProcess(recorded, { readIdentity: alive(recorded.start, recorded.command) }), true);
	assert.equal(verifyRecordedProcess(recorded, { readIdentity: alive("Sat Nov 14 11:00:00 2026", recorded.command) }), false, "the pid was reused");
	assert.equal(verifyRecordedProcess(recorded, { readIdentity: alive(recorded.start, "zsh") }), false, "another command");
	assert.equal(verifyRecordedProcess(recorded, { readIdentity: () => ({ state: "absent" }) }), false);
	assert.equal(verifyRecordedProcess(recorded, { readIdentity: () => ({ state: "unknown" }) }), null, "unreadable is not ours");
	assert.equal(verifyRecordedProcess({ pid: 77, start: null, command: null }, { readIdentity: alive("x", "y") }), null, "no identity recorded");
});

test("readProcessIdentity reads a live process, and reports an unknown or missing one", async (t) => {
	const { spawnInGroup } = require("./test-process.js");
	const child = spawnInGroup("sleep", ["300"], { stdio: "ignore" }, { t });
	const identity = readProcessIdentity(child.pid);
	assert.equal(identity.state, "alive");
	// Linux reads /proc (boot id + start ticks); elsewhere ps lstart in UTC.
	assert.match(identity.start, process.platform === "linux" ? /^[\w-]+\+\d+$/ : /^\w{3} \w{3} \d+ \d{2}:\d{2}:\d{2} \d{4}$/);
	assert.equal(identity.command, "sleep 300");
	assert.deepEqual(readProcessIdentity(child.pid, { platform: "darwin", spawnSyncImpl: () => ({ error: new Error("EPERM") }) }), { state: "unknown" });
	assert.deepEqual(readProcessIdentity(child.pid, { platform: "linux", readFile: () => { throw new Error("EACCES"); } }), { state: "unknown" });
	assert.deepEqual(readProcessIdentity(2 ** 22 + 1, { kill: () => { throw Object.assign(new Error("gone"), { code: "ESRCH" }); } }), { state: "absent" });
});

test("a launcher reusing a server it did not start keeps the owner's record", (t) => {
	const dir = tempWorktree(t);
	recordService(dir, "backend", { port: 8081, pid: 201, pidStart: "Sat Nov 14 10:00:00 2026", childPid: 202 });
	recordService(dir, "backend", { port: 8081, pid: null });
	assert.equal(readStackRecord(dir).services.backend.pid, 201);
	recordService(dir, "backend", { port: 8082, pid: null });
	assert.equal(readStackRecord(dir).services.backend.pid, null, "a different port is a different server");
});

test("a worktree reached through a symlink is the same worktree", (t) => {
	const real = tempWorktree(t);
	const link = path.join(os.tmpdir(), `dev-stack-link-${process.pid}-${Date.now()}`);
	fs.symlinkSync(real, link);
	t.after(() => fs.rmSync(link, { force: true }));
	recordPhase(link, "starting", { session: { name: "vpk-dev-x", socket: "vpk-dev" } });
	recordService(real, "frontend", { port: 3001, pid: 101 });
	const saved = readStackRecord(link);
	assert.equal(saved.phase, "starting", "the launcher's write through the real path kept the shell's phase");
	assert.deepEqual(saved.session, { name: "vpk-dev-x", socket: "vpk-dev" });
	assert.equal(saved.worktree, canonicalPath(real));
	assert.equal(readStackRecord(real).services.frontend.port, 3001);
});

test("a lock with a future mtime is stale, and a holder never removes a lock it does not own", (t) => {
	const dir = tempWorktree(t);
	const lock = path.join(dir, `${STACK_FILE}.lock`);
	fs.writeFileSync(lock, "1-someone");
	const future = new Date(Date.now() + 3_600_000);
	fs.utimesSync(lock, future, future);
	assert.equal(withStackLock(dir, () => "ran", { retries: 2, retryMs: 1 }), "ran");

	// A slow holder whose lock was taken over must not delete the new holder's lock.
	withStackLock(dir, () => {
		fs.writeFileSync(lock, "2-next-holder");
	});
	assert.equal(fs.readFileSync(lock, "utf8"), "2-next-holder");
});

test("waiters that find one stale lock never hold it at the same time", async (t) => {
	const dir = tempWorktree(t);
	const lock = path.join(dir, `${STACK_FILE}.lock`);
	fs.writeFileSync(lock, "1-dead");
	const old = new Date(Date.now() - 60_000);
	fs.utimesSync(lock, old, old);
	const { spawn } = require("node:child_process");
	const modulePath = require.resolve("./dev-stack-state");
	const inside = path.join(dir, "inside");
	const violations = path.join(dir, "violations");
	const worker = () =>
		new Promise((resolve, reject) => {
			const code = `const fs = require("node:fs");
const { withStackLock } = require(${JSON.stringify(modulePath)});
for (let i = 0; i < 10; i += 1) withStackLock(${JSON.stringify(dir)}, () => {
	try { fs.writeFileSync(${JSON.stringify(inside)}, "x", { flag: "wx" }); } catch { fs.appendFileSync(${JSON.stringify(violations)}, "overlap\\n"); }
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
	fs.rmSync(${JSON.stringify(inside)}, { force: true });
});`;
			const child = spawn(process.execPath, ["-e", code], { stdio: "ignore" });
			child.once("error", reject);
			child.once("exit", (status) => (status === 0 ? resolve() : reject(new Error(`worker exited ${status}`))));
		});
	await Promise.all([worker(), worker(), worker(), worker()]);
	assert.equal(fs.existsSync(violations), false, fs.existsSync(violations) ? fs.readFileSync(violations, "utf8") : "");
	assert.equal(fs.existsSync(lock), false);
});

test("a waiter never removes a lock that another writer took after the stale one", (t) => {
	const dir = tempWorktree(t);
	const lock = path.join(dir, `${STACK_FILE}.lock`);
	const deadOwner = JSON.stringify({ token: "dead", pid: 2 ** 22 + 7, start: "Mon Jan 1 00:00:00 2024", command: "node" });
	const liveOwner = JSON.stringify({ token: "live", pid: process.pid, start: null, command: null });
	fs.writeFileSync(lock, deadOwner);
	// Right after the waiter reads the stale token, another writer replaces the stale lock with
	// its own (the interleaving the review reproduced) and is now inside its callback.
	let lockReads = 0;
	const fsImpl = {
		...fs,
		readFileSync(file, ...rest) {
			const value = fs.readFileSync(file, ...rest);
			if (file === lock && (lockReads += 1) === 1) {
				fs.rmSync(lock);
				fs.writeFileSync(lock, liveOwner);
			}
			return value;
		},
	};
	assert.throws(() => withStackLock(dir, () => assert.fail("entered while another writer held the lock"), { fsImpl, retries: 3, retryMs: 1 }), /Timed out/);
	assert.equal(fs.readFileSync(lock, "utf8"), liveOwner, "the live writer's lock is untouched");
	assert.equal(fs.existsSync(`${lock}.takeover`), false);
});

test("a verifiably live owner keeps its lock however old, and a recycled owner pid does not", (t) => {
	const dir = tempWorktree(t);
	const lock = path.join(dir, `${STACK_FILE}.lock`);
	const me = readProcessIdentity(process.pid);
	assert.equal(me.state, "alive");
	fs.writeFileSync(lock, JSON.stringify({ token: "held", pid: process.pid, start: me.start, command: me.command }));
	const old = new Date(Date.now() - 3_600_000);
	fs.utimesSync(lock, old, old);
	assert.throws(() => withStackLock(dir, () => "ran", { retries: 2, retryMs: 1 }), /Timed out/, "an hour-old lock of a live owner is not taken");

	// The same pid, but another process now (it started at another time): the owner is gone.
	fs.writeFileSync(lock, JSON.stringify({ token: "recycled", pid: process.pid, start: "Mon Jan 1 00:00:00 2024", command: me.command }));
	assert.equal(withStackLock(dir, () => "ran", { retries: 2, retryMs: 1 }), "ran");
});

test("a holder whose lock was taken redoes its update instead of overwriting", (t) => {
	const dir = tempWorktree(t);
	const lock = path.join(dir, `${STACK_FILE}.lock`);
	let calls = 0;
	const result = withStackLock(dir, (assertOwned) => {
		calls += 1;
		// The first time, another writer displaces this holder and finishes before it writes.
		if (calls === 1) fs.rmSync(lock);
		assertOwned();
		return "written";
	}, { retries: 5, retryMs: 1 });
	assert.equal(result, "written");
	assert.equal(calls, 2);
	assert.equal(fs.existsSync(lock), false);

	// The same through updateStackRecord: the first attempt's record never lands.
	recordService(dir, "frontend", { port: 3001, pid: 101 });
	const realWrite = fs.writeFileSync;
	let displaced = false;
	const fsImpl = {
		...fs,
		writeFileSync(file, ...rest) {
			const written = realWrite(file, ...rest);
			if (!displaced && String(file).endsWith(".tmp")) {
				displaced = true;
				// Between preparing its record and replacing the file, this holder loses the lock to
				// another writer, which records the backend and finishes.
				const lockFile = path.join(dir, `${STACK_FILE}.lock`);
				fs.rmSync(lockFile);
				const other = JSON.parse(fs.readFileSync(path.join(dir, STACK_FILE), "utf8"));
				other.services.backend = { port: 8081, pid: 201 };
				realWrite(path.join(dir, STACK_FILE), JSON.stringify(other));
			}
			return written;
		},
	};
	recordService(dir, "frontend", { port: 3002, pid: 102 }, { fsImpl });
	const saved = readStackRecord(dir);
	assert.equal(saved.services.frontend.port, 3002);
	assert.equal(saved.services.backend.port, 8081, "the other writer's entry survived");
});

test("identity does not depend on the time zone or the locale", async (t) => {
	const { spawnInGroup } = require("./test-process.js");
	const child = spawnInGroup("sleep", ["300"], { stdio: "ignore" }, { t });
	const saved = { TZ: process.env.TZ, LC_ALL: process.env.LC_ALL };
	t.after(() => {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});
	process.env.TZ = "Asia/Tokyo";
	process.env.LC_ALL = "de_DE.UTF-8";
	const tokyo = readProcessIdentity(child.pid);
	process.env.TZ = "America/Los_Angeles";
	process.env.LC_ALL = "fr_FR.UTF-8";
	const losAngeles = readProcessIdentity(child.pid);
	assert.equal(tokyo.state, "alive");
	assert.deepEqual(tokyo, losAngeles);
});

test("a process whose identity cannot be read is unknown, never gone", () => {
	const exists = () => {};
	assert.deepEqual(readProcessIdentity(42, { kill: exists, platform: "darwin", spawnSyncImpl: () => ({ status: 1, stdout: "" }) }), { state: "unknown" });
	assert.deepEqual(readProcessIdentity(42, { kill: exists, platform: "darwin", spawnSyncImpl: () => ({ status: 0, stdout: "S  Sa 14 Nov 10:00:00 2026  node\n" }) }), { state: "unknown" });
	assert.deepEqual(readProcessIdentity(42, { kill: exists, platform: "linux", readFile: () => { throw new Error("EACCES"); } }), { state: "unknown" });
	const proc = { "/proc/42/stat": "42 (node) S 1 42 42 0 -1 4194560 1 0 0 0 0 0 0 0 20 0 1 0 987654 1000 100", "/proc/sys/kernel/random/boot_id": "b00t\n", "/proc/42/cmdline": "node\0server.js\0" };
	assert.deepEqual(readProcessIdentity(42, { kill: exists, platform: "linux", readFile: (file) => proc[file] }), { state: "alive", start: "b00t+987654", command: "node server.js" });
	assert.equal(verifyRecordedProcess({ pid: 42, start: "x", command: "y" }, { readIdentity: () => ({ state: "unknown" }) }), null);
});

test("a launcher's recorded exit makes the stack degraded at once", (t) => {
	const dir = tempWorktree(t);
	recordPhase(dir, "starting", { session: { name: "vpk-dev-x", socket: "vpk-dev" } });
	recordService(dir, "frontend", { port: 3001, pid: 101 });
	clearService(dir, "frontend", { pid: 101, exit: { code: 1, signal: null } });
	const record = readStackRecord(dir);
	assert.equal(record.exits.frontend.code, 1);
	const status = deriveStackStatus({
		now: Date.now(),
		record,
		sessionAlive: true,
		services: { frontend: { listening: false, exited: record.exits.frontend }, backend: notYet },
	});
	assert.equal(status.status, "degraded");
	assert.match(status.reason, /frontend \(code 1\) exited/);
	recordService(dir, "frontend", { port: 3001, pid: 103 });
	assert.equal(readStackRecord(dir).exits.frontend, undefined, "a new launch clears the exit");
});
