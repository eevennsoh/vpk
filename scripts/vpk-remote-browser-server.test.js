const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const { LOCK_FILE, LOG_FILE, STATE_FILE, UNRECORDED_GRACE_MS, acquireLock, descendants, endpoint, parseArgs, processStart, resolvePlaywright, start, stop, supervisorsFor } = require("./vpk-remote-browser-server.js");

const SCRIPT = path.join(__dirname, "vpk-remote-browser-server.js");
const GRACE_MS = 500;
// Each test's cleanups, run last-registered first once it ends, pass or fail, so a directory
// outlives the server stopped in it. Every cleanup runs; the first error is rethrown.
const cleanups = new WeakMap();
function defer(t, cleanup) {
	let stack = cleanups.get(t);
	if (!stack) {
		stack = [];
		cleanups.set(t, stack);
		t.after(async () => {
			let firstError;
			while (stack.length > 0) {
				try {
					await stack.pop()();
				} catch (error) {
					firstError ??= error;
				}
			}
			if (firstError !== undefined) throw firstError;
		});
	}
	stack.push(cleanup);
}

// A temporary directory the test removes when it ends.
function tempDir(t, prefix) {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
	defer(t, () => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => processStart(pid) !== null;

async function eventually(predicate, ms = 10_000) {
	const deadline = Date.now() + ms;
	while (!predicate()) {
		if (Date.now() > deadline) return false;
		await sleep(50);
	}
	return true;
}

function refusesConnections(port) {
	return new Promise((resolve) => {
		const socket = net.connect(port, "127.0.0.1");
		socket.once("connect", () => {
			socket.destroy();
			resolve(false);
		});
		socket.once("error", () => resolve(true));
	});
}

// A project with a fake Playwright package whose cli.js stands in for `run-server`.
function fakeProject(t, { name = "@playwright/test", version = "9.8.7", cli }) {
	const project = tempDir(t, "browser-server-project-");
	const pkg = path.join(project, "node_modules", ...name.split("/"));
	fs.mkdirSync(pkg, { recursive: true });
	fs.writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name, version, exports: { "./package.json": "./package.json", "./cli": "./cli.js" } }));
	fs.writeFileSync(path.join(pkg, "cli.js"), cli);
	return project;
}

// Listens like `playwright run-server` and prints the same line.
const LISTEN = `
const net = require("node:net");
const argv = process.argv;
const host = argv[argv.indexOf("--host") + 1];
const port = Number(argv[argv.indexOf("--port") + 1]);
const server = net.createServer((socket) => socket.end());
server.listen(port, host, () => console.log("Listening on ws://" + host + ":" + port + "/"));
`;

// Also starts a stand-in browser: its own process group, deaf to SIGTERM unless polite, pid in pidFile.
const withBrowser = (pidFile, { polite = false } = {}) => `${LISTEN}
const browser = require("node:child_process").spawn(process.execPath, ["-e", "${polite ? "" : "process.on('SIGTERM', () => {}); "}setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(browser.pid));
`;

// A server that hangs once listening: its event loop never runs again.
const hung = (pidFile) => `${withBrowser(pidFile)}
setTimeout(() => { for (;;) {} }, 300);
`;

function browserPid(t, pidFile) {
	const pid = Number(fs.readFileSync(pidFile, "utf8"));
	defer(t, () => {
		try {
			process.kill(pid, "SIGKILL");
		} catch {}
	});
	return pid;
}

function options(project, workerDir, extra = {}) {
	return { command: "start", project, workerDir, port: 0, ttlMs: 60_000, timeoutMs: 10_000, graceMs: GRACE_MS, ...extra };
}

async function startedServer(t, project, extra = {}) {
	const workerDir = tempDir(t, "browser-server-worker-");
	const state = await start(options(project, workerDir, extra));
	defer(t, async () => {
		await stop({ workerDir });
		try {
			process.kill(-state.pid, "SIGKILL");
		} catch {}
	});
	return { state, workerDir };
}

test("parseArgs requires a command, a worker directory, and a project for start", () => {
	assert.throws(() => parseArgs([]), /usage:/u);
	assert.throws(() => parseArgs(["status"]), /usage:/u);
	assert.throws(() => parseArgs(["start", "--project", "/p"]), /--worker-dir is required/u);
	assert.throws(() => parseArgs(["start", "--worker-dir", "/w"]), /--project is required/u);
	assert.throws(() => parseArgs(["stop", "--worker-dir", "/w", "--project", "/p"]), /unknown option --project for stop/u);
	assert.throws(() => parseArgs(["endpoint", "--worker-dir", "/w", "--port", "1"]), /unknown option --port for endpoint/u);
	assert.throws(() => parseArgs(["start", "--project", "/p", "--worker-dir"]), /--worker-dir needs a value/u);
	assert.throws(() => parseArgs(["start", "--project", "--worker-dir", "/w"]), /--project needs a value/u);
	assert.throws(() => parseArgs(["start", "--project", "/p", "--worker-dir", "/w", "--host", "0.0.0.0"]), /unknown option --host/u);
	assert.throws(() => parseArgs(["stop", "--worker-dir", "/w", "--token", "abc"]), /--token must be 32 lowercase hex digits/u);
	assert.throws(() => parseArgs(["new-token", "--worker-dir", "/w"]), /new-token takes no options/u);
	assert.deepEqual(parseArgs(["new-token"]), { command: "new-token" });
	const token = "a".repeat(32);
	assert.equal(parseArgs(["stop", "--worker-dir", "/w", "--token", token]).token, token);
	assert.equal(parseArgs(["endpoint", "--worker-dir", "/w", "--token", token]).token, token);
	assert.equal(parseArgs(["start", "--project", "/p", "--worker-dir", "/w", "--token", token]).token, token);
});

test("parseArgs validates port, TTL and timeout, and defaults to a free port", () => {
	const base = ["start", "--project", "p", "--worker-dir", "w"];
	assert.deepEqual(parseArgs(base), { command: "start", project: path.resolve("p"), workerDir: path.resolve("w"), port: 0, ttlMs: 180 * 60_000, timeoutMs: 30_000 });
	assert.equal(parseArgs([...base, "--port", "9323", "--ttl-minutes", "5"]).port, 9323);
	assert.equal(parseArgs([...base, "--ttl-minutes", "5"]).ttlMs, 300_000);
	for (const [flag, value] of [["--port", "0"], ["--port", "70000"], ["--port", "abc"], ["--ttl-minutes", "0"], ["--ttl-minutes", "1441"], ["--ttl-minutes", "1.5"], ["--timeout-ms", "10"]]) {
		assert.throws(() => parseArgs([...base, flag, value]), new RegExp(`${flag} must be an integer`, "u"));
	}
	assert.deepEqual(parseArgs(["stop", "--worker-dir", "w"]), { command: "stop", workerDir: path.resolve("w") });
	assert.deepEqual(parseArgs(["endpoint", "--worker-dir", "w"]), { command: "endpoint", workerDir: path.resolve("w") });
});

test("Playwright resolution names the directory when neither package resolves", (t) => {
	const project = tempDir(t, "browser-server-empty-");
	assert.throws(() => resolvePlaywright(project), (error) => error.message.includes(project) && /neither @playwright\/test nor playwright resolves/u.test(error.message));
	assert.throws(() => resolvePlaywright(path.join(project, "missing")), /is not a directory/u);
});

test("Playwright resolves from the project, preferring @playwright/test, else playwright", (t) => {
	const testProject = fakeProject(t, { cli: "" });
	assert.deepEqual(resolvePlaywright(testProject), { name: "@playwright/test", version: "9.8.7", cli: path.join(testProject, "node_modules", "@playwright", "test", "cli.js") });
	const coreProject = fakeProject(t, { name: "playwright", version: "1.2.3", cli: "" });
	assert.equal(resolvePlaywright(coreProject).name, "playwright");
	assert.equal(resolvePlaywright(coreProject).version, "1.2.3");
});

test("start records the server, endpoint reports it, and stop ends it and its browser, twice safely", async (t) => {
	const pidFile = path.join(tempDir(t, "browser-server-pid-"), "pid");
	const project = fakeProject(t, { cli: withBrowser(pidFile) });
	const { state, workerDir } = await startedServer(t, project);
	const browser = browserPid(t, pidFile);
	assert.equal(state.endpoint, `ws://127.0.0.1:${state.port}/`);
	assert.equal(state.playwrightVersion, "9.8.7");
	assert.equal(state.project, project);
	assert.match(state.token, /^[0-9a-f]{32}$/u);
	assert.equal(state.processStart, processStart(state.pid));
	assert.deepEqual(JSON.parse(fs.readFileSync(path.join(workerDir, STATE_FILE), "utf8")), state);
	assert.ok(fs.readFileSync(path.join(workerDir, LOG_FILE), "utf8").includes(`Listening on ${state.endpoint}`));
	assert.equal(endpoint({ workerDir }), state.endpoint);
	assert.deepEqual(fs.readdirSync(workerDir).sort(), [STATE_FILE, LOG_FILE]);
	assert.ok(alive(browser));

	await assert.rejects(start(options(project, workerDir)), /already running/u);

	assert.deepEqual(await stop({ workerDir }), { stopped: true, pid: state.pid, endpoint: state.endpoint });
	assert.equal(alive(state.pid), false);
	assert.equal(alive(browser), false);
	assert.ok(await refusesConnections(state.port), "the endpoint no longer accepts connections");
	assert.deepEqual(fs.readdirSync(workerDir), [LOG_FILE]);
	assert.throws(() => endpoint({ workerDir }), /no live browser server/u);
	assert.equal((await stop({ workerDir })).stopped, false);
});

test("two concurrent starts for one worker directory leave one server and a matching record", async (t) => {
	const project = fakeProject(t, { cli: `setTimeout(() => {}, 300); ${LISTEN}` });
	const workerDir = tempDir(t, "browser-server-worker-");
	const run = () => new Promise((resolve) => {
		const child = spawn(process.execPath, [SCRIPT, "start", "--project", project, "--worker-dir", workerDir], { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => { stdout += chunk; });
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		child.on("exit", (code) => resolve({ code, stdout, stderr }));
	});
	const results = await Promise.all([run(), run()]);
	const winners = results.filter((result) => result.code === 0);
	const losers = results.filter((result) => result.code !== 0);
	assert.equal(winners.length, 1, JSON.stringify(results));
	const state = JSON.parse(winners[0].stdout);
	defer(t, async () => {
		await stop({ workerDir });
	});
	assert.equal(losers.length, 1);
	assert.match(losers[0].stderr, /another start for .* is in progress|already running/u);
	assert.deepEqual(JSON.parse(fs.readFileSync(path.join(workerDir, STATE_FILE), "utf8")), state);
	assert.ok(alive(state.pid));
	assert.equal(fs.existsSync(path.join(workerDir, LOCK_FILE)), false);
	assert.equal((await stop({ workerDir })).stopped, true);
	assert.equal(alive(state.pid), false);
});

test("a failure while publishing state ends the server and its browser and releases the lock", async (t) => {
	const pidFile = path.join(tempDir(t, "browser-server-pid-"), "pid");
	const project = fakeProject(t, { cli: withBrowser(pidFile) });
	const workerDir = tempDir(t, "browser-server-worker-");
	let supervisor;
	await assert.rejects(start(options(project, workerDir), { beforePublish: (state) => {
		supervisor = state.pid;
		throw new Error("disk full");
	} }), /did not start: disk full/u);
	const browser = browserPid(t, pidFile);
	assert.equal(alive(supervisor), false);
	assert.equal(alive(browser), false);
	assert.deepEqual(fs.readdirSync(workerDir), [LOG_FILE]);
	const state = await start(options(project, workerDir));
	browserPid(t, pidFile);
	assert.equal((await stop({ workerDir })).stopped, true);
	assert.equal(alive(state.pid), false);
});

test("stop never signals a process a stale or forged record points at", async (t) => {
	const project = fakeProject(t, { cli: LISTEN });
	const { state, workerDir } = await startedServer(t, project);
	const other = tempDir(t, "browser-server-worker-");
	const stateFile = path.join(other, STATE_FILE);
	const write = (record) => fs.writeFileSync(stateFile, JSON.stringify(record));

	// Another worker directory's live record, copied: its command line names another state file.
	write(state);
	assert.match((await stop({ workerDir: other })).reason, /not the browser server recorded/u);
	assert.throws(() => endpoint({ workerDir: other }), /no live browser server/u);
	// The test process: alive, but no supervisor.
	write({ ...state, pid: process.pid, processStart: processStart(process.pid) });
	assert.match((await stop({ workerDir: other })).reason, /not the browser server recorded/u);
	assert.ok(fs.existsSync(stateFile), "a record that is not ours is left in place");
	// The right pid with another start time, as after pid reuse, and the right pid with a forged token.
	const ownFile = path.join(workerDir, STATE_FILE);
	fs.writeFileSync(ownFile, JSON.stringify({ ...state, processStart: "Thu Jan  1 00:00:00 1970" }));
	assert.equal((await stop({ workerDir })).stopped, false);
	fs.writeFileSync(ownFile, JSON.stringify({ ...state, token: "0".repeat(32) }));
	assert.equal((await stop({ workerDir })).stopped, false);
	assert.ok(alive(state.pid), "the real server was never signalled");
	// A dead pid: the record describes nothing and goes.
	write({ ...state, pid: 999_999 });
	assert.equal((await stop({ workerDir: other })).reason, "already gone");
	assert.equal(fs.existsSync(stateFile), false);
	write("not json");
	fs.writeFileSync(stateFile, "not json");
	assert.match((await stop({ workerDir: other })).reason, /unreadable/u);

	fs.writeFileSync(ownFile, JSON.stringify(state));
	assert.equal((await stop({ workerDir })).stopped, true);
	assert.equal(alive(state.pid), false);
});

test("a server that hangs and a browser that ignores SIGTERM both end on stop", async (t) => {
	const pidFile = path.join(tempDir(t, "browser-server-pid-"), "pid");
	const project = fakeProject(t, { cli: hung(pidFile) });
	const { state, workerDir } = await startedServer(t, project);
	const browser = browserPid(t, pidFile);
	await sleep(1_500);
	const [server] = descendants(state.pid);
	assert.ok(server && alive(server.pid));
	assert.equal((await stop({ workerDir })).stopped, true);
	assert.equal(alive(state.pid), false);
	assert.equal(alive(server.pid), false);
	assert.equal(alive(browser), false);
	assert.ok(await refusesConnections(state.port));
});

test("a killed supervisor takes the server and its browser with it", async (t) => {
	const pidFile = path.join(tempDir(t, "browser-server-pid-"), "pid");
	const project = fakeProject(t, { cli: withBrowser(pidFile) });
	const { state, workerDir } = await startedServer(t, project);
	const browser = browserPid(t, pidFile);
	const [server] = descendants(state.pid);
	process.kill(state.pid, "SIGKILL");
	assert.ok(await eventually(() => !alive(server.pid) && !alive(browser)), "server and browser outlived the supervisor");
	assert.ok(await refusesConnections(state.port));
	assert.equal((await stop({ workerDir })).reason, "already gone");
});

test("a server nobody stops ends itself and its browser at its TTL and clears its record", async (t) => {
	const pidFile = path.join(tempDir(t, "browser-server-pid-"), "pid");
	const project = fakeProject(t, { cli: withBrowser(pidFile) });
	const { state, workerDir } = await startedServer(t, project, { ttlMs: 1_500 });
	const browser = browserPid(t, pidFile);
	assert.ok(await eventually(() => !alive(state.pid) && !alive(browser)));
	assert.equal(fs.existsSync(path.join(workerDir, STATE_FILE)), false);
	assert.match(fs.readFileSync(path.join(workerDir, LOG_FILE), "utf8"), /stopping \(ttl expired\)/u);
});

test("a server that exits during start fails with its reason and leaves nothing behind", async (t) => {
	const project = fakeProject(t, { cli: 'console.error("fake: port already in use"); process.exit(3);' });
	const workerDir = tempDir(t, "browser-server-worker-");
	await assert.rejects(start(options(project, workerDir)), (error) => /did not start: exited with code 3/u.test(error.message) && error.message.includes("fake: port already in use"));
	assert.deepEqual(fs.readdirSync(workerDir), [LOG_FILE]);
});

test("a server that never listens is ended at the timeout, browser included", async (t) => {
	const pidFile = path.join(tempDir(t, "browser-server-pid-"), "pid");
	const project = fakeProject(t, { cli: `${withBrowser(pidFile).replace(LISTEN, "")} setInterval(() => {}, 1000);` });
	const workerDir = tempDir(t, "browser-server-worker-");
	await assert.rejects(start(options(project, workerDir, { timeoutMs: 1_500 })), /not listening on ws:\/\/127\.0\.0\.1:\d+\/ after 1500ms/u);
	const browser = browserPid(t, pidFile);
	assert.equal(alive(browser), false);
	assert.deepEqual(fs.readdirSync(workerDir), [LOG_FILE]);
});

test("a hung server and its browser end when the supervisor is killed", async (t) => {
	const pidFile = path.join(tempDir(t, "browser-server-pid-"), "pid");
	const project = fakeProject(t, { cli: hung(pidFile) });
	const { state, workerDir } = await startedServer(t, project);
	const browser = browserPid(t, pidFile);
	await sleep(1_500);
	const [server] = descendants(state.pid);
	assert.ok(server && alive(server.pid));
	process.kill(state.pid, "SIGKILL");
	assert.ok(await eventually(() => !alive(server.pid) && !alive(browser), 15_000), "a hung server or its browser outlived the killed supervisor");
	assert.ok(await refusesConnections(state.port));
	assert.equal((await stop({ workerDir })).reason, "already gone");
});

// Runs the CLI; resolves with its exit code and output.
function cli(args, env = {}) {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [SCRIPT, ...args], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => { stdout += chunk; });
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		child.on("exit", (code) => resolve({ code, stdout, stderr }));
	});
}

// Starts the CLI with the hold-before-publish hook, waits until it holds, and kills it there.
async function killStarterBeforePublish(t, project, workerDir, token) {
	const holdFile = path.join(tempDir(t, "browser-server-hold-"), "state.json");
	const args = [SCRIPT, "start", "--project", project, "--worker-dir", workerDir, "--timeout-ms", "1000", ...(token ? ["--token", token] : [])];
	const starter = spawn(process.execPath, args, { stdio: "ignore", env: { ...process.env, VPK_BROWSER_SERVER_TEST_HOLD_BEFORE_PUBLISH: holdFile } });
	defer(t, () => {
		try {
			starter.kill("SIGKILL");
		} catch {}
	});
	assert.ok(await eventually(() => fs.existsSync(holdFile) && fs.statSync(holdFile).size > 0), "the starter never reached the publish step");
	const held = JSON.parse(fs.readFileSync(holdFile, "utf8"));
	defer(t, () => {
		try {
			process.kill(-held.pid, "SIGKILL");
		} catch {}
	});
	const exited = new Promise((resolve) => starter.once("exit", resolve));
	starter.kill("SIGKILL");
	await exited;
	assert.equal(fs.existsSync(path.join(workerDir, STATE_FILE)), false, "nothing was published");
	assert.ok(alive(held.pid), "the unrecorded supervisor is running");
	return held;
}

test("a supervisor whose starter died before publishing ends itself; a later start runs exactly one server", async (t) => {
	const pidFile = path.join(tempDir(t, "browser-server-pid-"), "pid");
	const project = fakeProject(t, { cli: withBrowser(pidFile, { polite: true }) });
	const workerDir = tempDir(t, "browser-server-worker-");
	const held = await killStarterBeforePublish(t, project, workerDir);
	const browser = browserPid(t, pidFile);
	const [server] = descendants(held.pid);
	assert.ok(await eventually(() => !alive(held.pid) && !alive(server.pid) && !alive(browser), 1_000 + UNRECORDED_GRACE_MS + 10_000), "the unrecorded server outlived its record timeout");
	assert.match(fs.readFileSync(path.join(workerDir, LOG_FILE), "utf8"), /stopping \(no record named this server/u);
	assert.ok(await refusesConnections(held.port));

	const result = await cli(["start", "--project", project, "--worker-dir", workerDir]);
	assert.equal(result.code, 0, result.stderr);
	const state = JSON.parse(result.stdout);
	browserPid(t, pidFile);
	defer(t, () => stop({ workerDir }));
	assert.deepEqual(supervisorsFor(path.join(workerDir, STATE_FILE)).map(({ pid }) => pid), [state.pid]);
	assert.equal((await stop({ workerDir })).stopped, true);
	assert.deepEqual(supervisorsFor(path.join(workerDir, STATE_FILE)), []);
});

test("after a starter dies before publishing, the next start ends the orphan at once, and the run's stop --token does too", async (t) => {
	const pidFile = path.join(tempDir(t, "browser-server-pid-"), "pid");
	const project = fakeProject(t, { cli: withBrowser(pidFile, { polite: true }) });
	const workerDir = tempDir(t, "browser-server-worker-");
	const stateFile = path.join(workerDir, STATE_FILE);

	const orphan = await killStarterBeforePublish(t, project, workerDir);
	const orphanBrowser = browserPid(t, pidFile);
	const result = await cli(["start", "--project", project, "--worker-dir", workerDir]);
	assert.equal(result.code, 0, result.stderr);
	assert.match(result.stderr, /ending 1 unrecorded supervisor/u);
	const state = JSON.parse(result.stdout);
	browserPid(t, pidFile);
	defer(t, () => stop({ workerDir }));
	assert.equal(alive(orphan.pid), false);
	assert.equal(alive(orphanBrowser), false);
	assert.deepEqual(supervisorsFor(stateFile).map(({ pid }) => pid), [state.pid]);
	assert.equal((await stop({ workerDir })).stopped, true);

	const token = crypto.randomBytes(16).toString("hex");
	const second = await killStarterBeforePublish(t, project, workerDir, token);
	const secondBrowser = browserPid(t, pidFile);
	assert.match((await stop({ workerDir, token: "f".repeat(32) })).reason, /no browser server recorded/u);
	assert.ok(alive(second.pid), "stop with another token leaves it alone");
	assert.deepEqual(await stop({ workerDir, token }), { stopped: true, reason: "ended unrecorded supervisor(s)", orphans: [second.pid] });
	assert.equal(alive(second.pid), false);
	assert.equal(alive(secondBrowser), false);
	assert.deepEqual(supervisorsFor(stateFile), []);
});

test("following the recipe, a second run that cannot start leaves the first run's server serving", async (t) => {
	const project = fakeProject(t, { cli: LISTEN });
	const workerRoot = tempDir(t, "browser-server-worker-");
	const scratch = tempDir(t, "browser-server-recipe-");
	const go = path.join(scratch, "go");
	// The recipe's lines from gpt-executor.md, with a stand-in worker that waits for `go` and exits 7.
	const runScript = (name, worker) => {
		const file = path.join(scratch, name);
		fs.writeFileSync(file, `scripts=${JSON.stringify(__dirname)}
worker_root=${JSON.stringify(workerRoot)}
tree=${JSON.stringify(project)}
browser_token="$(node "$scripts/vpk-remote-browser-server.js" new-token)" || exit 1
stop_browser() { node "$scripts/vpk-remote-browser-server.js" stop --worker-dir "$worker_root" --token "$browser_token" >&2; }
trap stop_browser EXIT
trap 'exit 129' HUP INT TERM
node "$scripts/vpk-remote-browser-server.js" start --project "$tree" --worker-dir "$worker_root" --token "$browser_token" >&2 || exit 1
endpoint="$(node "$scripts/vpk-remote-browser-server.js" endpoint --worker-dir "$worker_root" --token "$browser_token")" || exit 1
env PW_TEST_CONNECT_WS_ENDPOINT="$endpoint" ${worker}
status=$?
exit "$status"
`);
		return file;
	};
	const run = (file) => {
		const child = spawn("bash", [file], { stdio: ["ignore", "pipe", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		defer(t, () => child.kill("SIGKILL"));
		return { child, done: new Promise((resolve) => child.on("exit", (code) => resolve({ code, stderr }))) };
	};
	const first = run(runScript("run-1.sh", `node -e 'const fs = require("node:fs"); fs.writeFileSync(${JSON.stringify(path.join(scratch, "endpoint"))}, process.env.PW_TEST_CONNECT_WS_ENDPOINT); const wait = () => fs.existsSync(${JSON.stringify(go)}) ? process.exit(7) : setTimeout(wait, 50); wait();'`));
	defer(t, () => stop({ workerDir: workerRoot }));
	assert.ok(await eventually(() => fs.existsSync(path.join(scratch, "endpoint"))), "the first run's worker never started");
	const state = JSON.parse(fs.readFileSync(path.join(workerRoot, STATE_FILE), "utf8"));
	assert.equal(fs.readFileSync(path.join(scratch, "endpoint"), "utf8"), state.endpoint);

	const second = await run(runScript("run-2.sh", "true")).done;
	assert.equal(second.code, 1, second.stderr);
	assert.match(second.stderr, /already running/u);
	assert.match(second.stderr, /started by another run \(token mismatch\); not signalled/u);
	assert.ok(alive(state.pid), "the first run's server was stopped by the second run's trap");
	assert.equal(await refusesConnections(state.port), false, "the first run's server no longer serves");
	assert.equal(endpoint({ workerDir: workerRoot }), state.endpoint);

	fs.writeFileSync(go, "");
	const firstResult = await first.done;
	assert.equal(firstResult.code, 7, "the run script exits with the worker's status");
	assert.equal(alive(state.pid), false);
	assert.ok(await refusesConnections(state.port));
	assert.deepEqual(supervisorsFor(path.join(workerRoot, STATE_FILE)), []);
});

// --- Lock -------------------------------------------------------------------------------

const lockRecord = (extra) => JSON.stringify({ pid: process.pid, start: processStart(process.pid), token: crypto.randomBytes(16).toString("hex"), purpose: "start", ...extra });
const STALE = { start: "Thu Jan  1 00:00:00 1970" };

test("a stale lock is taken over, and released without leftovers", async (t) => {
	const workerDir = tempDir(t, "browser-server-lock-");
	fs.writeFileSync(path.join(workerDir, LOCK_FILE), lockRecord(STALE));
	const release = await acquireLock(workerDir, { waitMs: 0, purpose: "start" });
	assert.equal(JSON.parse(fs.readFileSync(path.join(workerDir, LOCK_FILE), "utf8")).purpose, "start");
	release();
	assert.deepEqual(fs.readdirSync(workerDir), []);
});

test("taking over a stale lock never removes a live lock that replaced it", async (t) => {
	const workerDir = tempDir(t, "browser-server-lock-");
	const lockFile = path.join(workerDir, LOCK_FILE);
	fs.writeFileSync(lockFile, lockRecord(STALE));
	const live = lockRecord({ purpose: "stop" });
	// Between seeing the stale lock and removing it, another reclaimer removes it and a third
	// process takes the lock.
	await assert.rejects(acquireLock(workerDir, { waitMs: 0, purpose: "start", hooks: { beforeTakeover: () => {
		fs.rmSync(lockFile);
		fs.writeFileSync(lockFile, live);
	} } }), /another stop for .* is in progress/u);
	assert.equal(fs.readFileSync(lockFile, "utf8"), live);
	assert.deepEqual(fs.readdirSync(workerDir), [LOCK_FILE]);
});

test("a takeover in progress elsewhere is waited for a bounded number of attempts; an interrupted one is reported", async (t) => {
	const workerDir = tempDir(t, "browser-server-lock-");
	const lockFile = path.join(workerDir, LOCK_FILE);
	const stale = lockRecord(STALE);
	const { token } = JSON.parse(stale);
	fs.writeFileSync(lockFile, stale);
	const guard = `${lockFile}.reclaim-${token}`;
	fs.writeFileSync(guard, lockRecord({}));
	await assert.rejects(acquireLock(workerDir, { waitMs: 0, purpose: "start" }), /could not take over the stale lock .* in 5 attempts/u);
	fs.writeFileSync(guard, lockRecord(STALE));
	await assert.rejects(acquireLock(workerDir, { waitMs: 0, purpose: "start" }), /takeover of the stale lock .* was interrupted/u);
	assert.equal(fs.readFileSync(lockFile, "utf8"), stale, "the stale lock is left for the operator");
	// A guard for a lock that is already gone is cleared.
	fs.rmSync(lockFile);
	fs.writeFileSync(lockFile, lockRecord(STALE));
	const release = await acquireLock(workerDir, { waitMs: 0, purpose: "start" });
	release();
	assert.deepEqual(fs.readdirSync(workerDir), [path.basename(guard)], "the old guard stays until a reclaimer of its token comes by");
});

test("an unreadable or malformed lock ends in an error after a bounded wait", async (t) => {
	const workerDir = tempDir(t, "browser-server-lock-");
	const lockFile = path.join(workerDir, LOCK_FILE);
	for (const body of ["not json", "{}", JSON.stringify({ pid: process.pid, start: "x", nonce: "old format" })]) {
		fs.writeFileSync(lockFile, body);
		const began = Date.now();
		await assert.rejects(acquireLock(workerDir, { waitMs: 60_000, purpose: "stop", unreadableWaitMs: 300 }), /cannot be read as a lock \((not JSON|not a lock record)\)/u);
		const waited = Date.now() - began;
		assert.ok(waited >= 300 && waited < 5_000, `waited ${waited}ms`);
		assert.equal(fs.readFileSync(lockFile, "utf8"), body, "left in place");
	}
	if (process.getuid?.() !== 0) {
		fs.writeFileSync(lockFile, lockRecord({}));
		fs.chmodSync(lockFile, 0o000);
		defer(t, () => fs.chmodSync(lockFile, 0o600));
		await assert.rejects(acquireLock(workerDir, { waitMs: 0, purpose: "start", unreadableWaitMs: 300 }), /cannot be read as a lock \(EACCES\)/u);
	}
});

const repoPlaywright = (() => {
	try {
		const project = path.join(__dirname, "..");
		resolvePlaywright(project);
		const core = require(require.resolve("@playwright/test", { paths: [project] }));
		return fs.existsSync(core.chromium.executablePath()) ? { project, core } : null;
	} catch {
		return null;
	}
})();

test("the real Playwright server serves a browser and stop ends every process", { skip: repoPlaywright ? false : "Playwright or its Chromium is not installed here" }, async (t) => {
	const { state, workerDir } = await startedServer(t, repoPlaywright.project, { graceMs: 3_000 });
	assert.equal(state.playwrightVersion, resolvePlaywright(repoPlaywright.project).version);
	const browser = await repoPlaywright.core.chromium.connect(state.endpoint);
	const page = await browser.newPage();
	await page.setContent("<p>ok</p>");
	assert.equal(await page.textContent("p"), "ok");
	const tree = descendants(state.pid);
	assert.ok(tree.some((record) => record.pgid !== state.pid), "the browser runs in its own process group");
	assert.equal((await stop({ workerDir })).stopped, true);
	await browser.close().catch(() => {});
	assert.deepEqual(tree.filter((record) => processStart(record.pid) === record.start), []);
	assert.equal(alive(state.pid), false);
	assert.ok(await refusesConnections(state.port));
});
