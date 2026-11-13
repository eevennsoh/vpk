// Every lock here is a temp file (VPK_HEAVY_RUN_LOCK_PATH), so these tests never wait on, or
// block, a real heavy run. Waits are on conditions (a log line, a file, an exit), never a sleep.

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { HOLDER_ENV, LOCK_PATH_ENV, acquireHeavyRunLock } = require("./heavy-run-lock.js");

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
	const children = [];
	t.after(() => {
		for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
		rmSync(dir, { recursive: true, force: true });
	});
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
		const child = spawn(process.execPath, ["-e", script], { env, stdio: ["ignore", "ignore", "pipe"] });
		children.push(child);
		let stderr = "";
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve(code ?? signal)));
		return { child, exited, stderr: () => stderr };
	};
	const spawnTracked = (command, args) => {
		const child = spawn(command, args, { cwd: REPO_ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
		children.push(child);
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
