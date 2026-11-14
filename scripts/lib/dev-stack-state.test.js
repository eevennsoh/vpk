const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	NEXT_ACTIONS,
	STACK_FILE,
	STACK_STATUSES,
	clearService,
	collectStackFacts,
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

const serving = { listening: true, pidAlive: true, childPidAlive: true };
const legacyServing = { listening: true, pidAlive: null, childPidAlive: null };
const notYet = { listening: false, pidAlive: true, childPidAlive: true };
const exited = { listening: false, pidAlive: false, childPidAlive: false };
const childDied = { listening: true, pidAlive: true, childPidAlive: false };
const missing = { listening: false, pidAlive: null, childPidAlive: null };
const lingering = { listening: true, pidAlive: false, childPidAlive: true };

// [description, facts, expected status]
const CASES = [
	["no record, no session, nothing alive", { record: null, sessionAlive: false, services: { frontend: missing, backend: missing } }, "absent"],
	["a session preparing .env.local", { record: record("seeding-env"), sessionAlive: true, services: { frontend: missing, backend: missing } }, "seeding-env"],
	["preparing .env.local for longer than the start timeout", { record: record("seeding-env", 120), sessionAlive: true, services: {} }, "degraded"],
	["a session whose servers have not listened yet", { record: record("starting"), sessionAlive: true, services: { frontend: notYet, backend: notYet } }, "starting"],
	["only the backend listens so far", { record: record("starting"), sessionAlive: true, services: { frontend: notYet, backend: serving } }, "starting"],
	["both services listen with live processes", { record: record("starting"), sessionAlive: true, services: { frontend: serving, backend: serving } }, "ready"],
	["a stack from before this file: ports listen, no pids", { record: null, sessionAlive: true, services: { frontend: legacyServing, backend: legacyServing } }, "ready"],
	["still not listening after the start timeout", { record: record("starting", 120), sessionAlive: true, services: { frontend: notYet, backend: serving } }, "degraded"],
	["the frontend exited while the session runs", { record: record("starting", 600), sessionAlive: true, services: { frontend: exited, backend: serving } }, "degraded"],
	["next dev died but its launcher still holds the port", { record: record("starting", 600), sessionAlive: true, services: { frontend: childDied, backend: serving } }, "degraded"],
	["a session with no record and nothing listening", { record: null, sessionAlive: true, services: { frontend: missing, backend: missing } }, "degraded"],
	["a stop in progress", { record: record("stopping", 2), sessionAlive: true, services: { frontend: serving, backend: serving } }, "stopping"],
	["a stop that finished but was not recorded", { record: record("stopping", 2), sessionAlive: false, services: { frontend: exited, backend: exited } }, "stopped"],
	["a stop that left a process past the stop timeout", { record: record("stopping", 60), sessionAlive: false, services: { frontend: lingering, backend: exited } }, "orphaned"],
	["a recorded stop with nothing alive", { record: record("stopped"), sessionAlive: false, services: { frontend: missing, backend: missing } }, "stopped"],
	["the session is gone but next dev still runs", { record: record("starting", 600), sessionAlive: false, services: { frontend: lingering, backend: exited } }, "orphaned"],
	["no session, no record, but a port file's port listens", { record: null, sessionAlive: false, services: { frontend: legacyServing, backend: missing } }, "orphaned"],
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
		isPidAlive: () => true,
		now: NOW,
	});
	assert.equal(facts.record, null);
	assert.deepEqual(facts.services.frontend, { port: 3005, pid: null, childPid: null, listening: true, pidAlive: null, childPidAlive: null });
	assert.equal(facts.services.backend.listening, false);

	recordService(dir, "backend", { port: 8085, pid: 41, childPid: 42 });
	listeningPorts.add(8085);
	facts = await collectStackFacts({
		worktreePath: dir,
		sessionAlive: true,
		isPortListening: (port) => listeningPorts.has(port),
		isPidAlive: (pid) => pid === 41,
		now: NOW,
	});
	assert.equal(facts.services.backend.pidAlive, true);
	assert.equal(facts.services.backend.childPidAlive, false);
	assert.equal(deriveStackStatus(facts).status, "degraded");
});
