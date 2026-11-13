// Every lock here is a temp file (VPK_HEAVY_RUN_LOCK_PATH), so these tests never wait on, or
// block, a real heavy run. Waits are on conditions (a log line, a file, an exit), never a sleep.

const assert = require("node:assert/strict");
const { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { HOLDER_ENV, LOCK_PATH_ENV, acquireHeavyRunLock, reclaimStale } = require("./heavy-run-lock.js");
const { spawnInGroup } = require("./test-process.js");

const REPO_ROOT = path.resolve(__dirname, "../..");
const LOCK_MODULE = path.join(__dirname, "heavy-run-lock.js");

async function waitFor(condition, what, timeoutMs = 30_000) {
	const deadline = Date.now() + timeoutMs;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

function workspace(t) {
	const dir = mkdtempSync(path.join(tmpdir(), "heavy-run-lock-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const lockPath = path.join(dir, "vpk-heavy-run.lock");
	const logPath = path.join(dir, "log");
	const env = { ...process.env, [LOCK_PATH_ENV]: lockPath };
	delete env.CI;
	delete env[HOLDER_ENV];
	delete env.NODE_TEST_CONTEXT;
	const log = () => (existsSync(logPath) ? readFileSync(logPath, "utf8").split("\n").filter(Boolean) : []);
	// A holder takes the lock, logs `start <id>`, waits for `go-<id>`, logs `end <id>`, releases.
	const startHolder = (id) => {
		const script = `const fs = require("node:fs");
const { acquireHeavyRunLock } = require(${JSON.stringify(LOCK_MODULE)});
(async () => {
	const lock = await acquireHeavyRunLock({ label: ${JSON.stringify(`holder ${id}`)}, pollMs: 20 });
	fs.appendFileSync(${JSON.stringify(logPath)}, "start ${id}\\n");
	while (!fs.existsSync(${JSON.stringify(path.join(dir, `go-${id}`))})) await new Promise((r) => setTimeout(r, 10));
	fs.appendFileSync(${JSON.stringify(logPath)}, "end ${id}\\n");
	lock.release();
})();`;
		const child = spawnInGroup(process.execPath, ["-e", script], { env, stdio: ["ignore", "ignore", "pipe"] }, { t });
		let stderr = "";
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve(code ?? signal)));
		return { child, exited, stderr: () => stderr };
	};
	const spawnTracked = (command, args) => {
		const child = spawnInGroup(command, args, { cwd: REPO_ROOT, env, stdio: ["ignore", "pipe", "pipe"] }, { t });
		let output = "";
		child.stdout.on("data", (chunk) => { output += chunk; });
		child.stderr.on("data", (chunk) => { output += chunk; });
		const exited = new Promise((resolve) => child.once("exit", (code) => resolve(code)));
		return { exited, output: () => output };
	};
	return { dir, env, lockPath, log, go: (id) => writeFileSync(path.join(dir, `go-${id}`), ""), spawnTracked, startHolder };
}

test("two concurrent runs take turns: the second waits, names the holder, then runs", async (t) => {
	const ws = workspace(t);
	const a = ws.startHolder("A");
	await waitFor(() => ws.log().includes("start A"), "A to take the lock");
	const b = ws.startHolder("B");
	await waitFor(() => b.stderr().includes(`waiting for pid ${a.child.pid} (holder A in`), "B to report who holds the lock");
	assert.deepEqual(ws.log(), ["start A"], "B did not start while A held the lock");

	ws.go("A");
	assert.equal(await a.exited, 0);
	await waitFor(() => ws.log().includes("start B"), "B to take its turn");
	ws.go("B");
	assert.equal(await b.exited, 0);
	assert.deepEqual(ws.log(), ["start A", "end A", "start B", "end B"]);
	assert.equal(existsSync(ws.lockPath), false, "the last holder released the lock");
});

test("a holder that was killed leaves a stale lock that the next run takes over", async (t) => {
	const ws = workspace(t);
	const a = ws.startHolder("A");
	await waitFor(() => ws.log().includes("start A"), "A to take the lock");
	a.child.kill("SIGKILL");
	await a.exited;
	assert.equal(existsSync(ws.lockPath), true, "SIGKILL left the lock behind");

	const b = ws.startHolder("B");
	await waitFor(() => ws.log().includes("start B"), "B to take over");
	assert.match(b.stderr(), new RegExp(`pid ${a.child.pid} is gone; taking over its stale lock`, "u"));
	ws.go("B");
	assert.equal(await b.exited, 0);
	assert.deepEqual(ws.log(), ["start A", "start B", "end B"]);
});

test("the lock is a no-op in CI and inside the holder's own children", async (t) => {
	const ws = workspace(t);
	const a = ws.startHolder("A");
	await waitFor(() => ws.log().includes("start A"), "A to take the lock");
	const inCi = await acquireHeavyRunLock({ env: { CI: "true" }, lockPath: ws.lockPath });
	assert.equal(inCi.held, false);
	const nested = await acquireHeavyRunLock({ env: { [HOLDER_ENV]: String(a.child.pid) }, lockPath: ws.lockPath });
	assert.equal(nested.held, false, "a child of the holder runs inside its turn");
	ws.go("A");
	assert.equal(await a.exited, 0);
});

test("the unit runner and run-parallel wait for the holder before their heavy stage", async (t) => {
	const ws = workspace(t);
	const a = ws.startHolder("A");
	await waitFor(() => ws.log().includes("start A"), "A to take the lock");
	const unit = ws.spawnTracked(process.execPath, ["scripts/run-js-unit-tests.mjs", "--file", "scripts/lib/memory-pressure.test.js"]);
	const gate = ws.spawnTracked(process.execPath, ["scripts/run-parallel.mjs", `${JSON.stringify(process.execPath)} -e "console.log('gate ran')"`]);
	await waitFor(() => unit.output().includes(`waiting for pid ${a.child.pid}`) && gate.output().includes(`waiting for pid ${a.child.pid}`), "both to wait");
	assert.doesNotMatch(unit.output(), /JS_UNIT_BATCH/u);
	assert.doesNotMatch(gate.output(), /gate ran/u);

	ws.go("A");
	assert.equal(await a.exited, 0);
	assert.equal(await unit.exited, 0, unit.output());
	assert.equal(await gate.exited, 0, gate.output());
	assert.match(unit.output(), /JS_UNIT_BATCH/u);
	assert.match(gate.output(), /gate ran/u);
	assert.equal(existsSync(ws.lockPath), false);
});

test("a lock far older than any heavy run is stale even if its pid now belongs to a live process", async (t) => {
	const ws = workspace(t);
	// A live process that is not a lock holder stands in for a reused pid.
	const bystander = spawnInGroup(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)"], { stdio: "ignore" }, { t });
	writeFileSync(ws.lockPath, JSON.stringify({ pid: bystander.pid, label: "old run", cwd: "/elsewhere", startedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString() }));
	const lines = [];
	const lock = await acquireHeavyRunLock({ env: { ...ws.env }, lockPath: ws.lockPath, log: (line) => lines.push(line) });
	assert.equal(lock.held, true);
	assert.match(lines.join("\n"), new RegExp(`pid ${bystander.pid}'s lock is 180 minutes old; taking over its stale lock`, "u"));
	assert.equal(JSON.parse(readFileSync(ws.lockPath, "utf8")).pid, process.pid);
	lock.release();
	assert.equal(existsSync(ws.lockPath), false);
});

test("a waiter that saw a stale lock never moves a live successor's lock", async (t) => {
	// B saw holder X dead; meanwhile A reclaimed X and took the lock. B's late reclaim must leave
	// A's lock exactly as it is (moving it, even briefly, lets a third run publish beside A).
	const ws = workspace(t);
	const stale = { pid: 999_999, label: "X", cwd: "/elsewhere", startedAt: "2026-11-13T00:00:00.000Z" };
	const successor = spawnInGroup(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)"], { stdio: "ignore" }, { t });
	const live = JSON.stringify({ pid: successor.pid, label: "A", cwd: "/here", startedAt: new Date().toISOString() });
	writeFileSync(ws.lockPath, live);
	const before = statSync(ws.lockPath);
	assert.equal(reclaimStale(ws.lockPath, stale, { alive: () => true }), true);
	const after = statSync(ws.lockPath);
	assert.equal(readFileSync(ws.lockPath, "utf8"), live);
	assert.deepEqual([after.ino, after.ctimeMs, after.nlink], [before.ino, before.ctimeMs, before.nlink], "the lock was not renamed or relinked");
	assert.equal(existsSync(`${ws.lockPath}.reclaim`), false, "the guard is released");

	// The record B saw is still there: B removes it.
	writeFileSync(ws.lockPath, JSON.stringify(stale));
	assert.equal(reclaimStale(ws.lockPath, stale, { alive: () => false }), true);
	assert.equal(existsSync(ws.lockPath), false);
});

test("a reclaim guard left by a crashed reclaimer is cleared, one held by a live one is respected", async (t) => {
	const ws = workspace(t);
	const stale = { pid: 999_999, startedAt: "2026-11-13T00:00:00.000Z" };
	writeFileSync(ws.lockPath, JSON.stringify(stale));
	writeFileSync(`${ws.lockPath}.reclaim`, JSON.stringify({ pid: 999_998, startedAt: "x" }));
	const alive = (pid) => pid !== 999_998 && pid !== 999_999;
	assert.equal(reclaimStale(ws.lockPath, stale, { alive }), false, "the guard was busy on this try");
	assert.equal(existsSync(`${ws.lockPath}.reclaim`), false, "the crashed reclaimer's guard is gone");
	assert.equal(reclaimStale(ws.lockPath, stale, { alive }), true);
	assert.equal(existsSync(ws.lockPath), false);

	writeFileSync(ws.lockPath, JSON.stringify(stale));
	writeFileSync(`${ws.lockPath}.reclaim`, JSON.stringify({ pid: process.pid, startedAt: "x" }));
	assert.equal(reclaimStale(ws.lockPath, stale, { alive: () => true }), false);
	assert.equal(existsSync(ws.lockPath), true, "a live reclaimer's turn is left alone");
});

test("a live pid with a different start time is not the holder: its lock is taken over", async (t) => {
	const ws = workspace(t);
	const bystander = spawnInGroup(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)"], { stdio: "ignore" }, { t });
	writeFileSync(ws.lockPath, JSON.stringify({ pid: bystander.pid, procStart: "Mon Jan  1 00:00:00 2001", label: "killed run", cwd: "/elsewhere", startedAt: new Date().toISOString() }));
	const lines = [];
	const lock = await acquireHeavyRunLock({
		env: { ...ws.env },
		lockPath: ws.lockPath,
		log: (line) => lines.push(line),
		startTimeOf: (pid) => (pid === bystander.pid ? "Fri Nov 13 13:00:00 2026" : "Fri Nov 13 13:30:00 2026"),
	});
	assert.equal(lock.held, true);
	assert.match(lines.join("\n"), new RegExp(`pid ${bystander.pid} now belongs to another process \\(different start time\\); taking over`, "u"));
	lock.release();
});

test("a waiter repeats who it waits for, then runs without the turn after the limit and leaves the lock alone", async (t) => {
	const ws = workspace(t);
	const holder = JSON.stringify({ pid: 4242, procStart: "Fri Nov 13 13:00:00 2026", label: "pnpm run ci:pr", cwd: "/wt/other", startedAt: new Date().toISOString() });
	writeFileSync(ws.lockPath, holder);
	let clock = Date.now();
	const lines = [];
	const lock = await acquireHeavyRunLock({
		alive: () => true,
		env: { ...ws.env },
		lockPath: ws.lockPath,
		log: (line) => lines.push(line),
		maxWaitMs: 65_000,
		now: () => clock,
		pollMs: 5_000,
		sleep: async (ms) => { clock += ms; },
		startTimeOf: () => "Fri Nov 13 13:00:00 2026",
	});
	assert.equal(lock.held, false);
	assert.equal(lock.proceeded, true);
	const waiting = lines.filter((line) => line.includes("waiting for pid 4242 (pnpm run ci:pr in /wt/other"));
	assert.deepEqual(waiting.map((line) => /waited ([\d.]+) min/u.exec(line)[1]), ["0.0", "0.5", "1.0"], "the line repeats every 30 s");
	assert.match(lines.at(-1), /proceeding without the turn after waiting 1\.1 min: pid 4242 \(pnpm run ci:pr\) still holds it/u);
	lock.release();
	assert.equal(readFileSync(ws.lockPath, "utf8"), holder, "the holder's lock is untouched");
});

test("under node --test the lock is a no-op unless a lock path is named", async (t) => {
	const ws = workspace(t);
	const unnamed = await acquireHeavyRunLock({ env: { NODE_TEST_CONTEXT: "child-v8" } });
	assert.equal(unnamed.held, false);
	const named = await acquireHeavyRunLock({ env: { NODE_TEST_CONTEXT: "child-v8", [LOCK_PATH_ENV]: ws.lockPath } });
	assert.equal(named.held, true);
	named.release();
	assert.equal(existsSync(ws.lockPath), false);
});
