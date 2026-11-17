const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawn } = require("node:child_process");

const { LOCK_FILE, LOG_FILE, STATE_FILE, descendants, endpoint, parseArgs, processStart, resolvePlaywright, start, stop } = require("./vpk-remote-browser-server.js");

const SCRIPT = path.join(__dirname, "vpk-remote-browser-server.js");
const GRACE_MS = 500;
const tempDir = (prefix) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
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
function fakeProject({ name = "@playwright/test", version = "9.8.7", cli }) {
	const project = tempDir("browser-server-project-");
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

// Also starts a stand-in browser: its own process group, deaf to SIGTERM, pid in pidFile.
const withBrowser = (pidFile) => `${LISTEN}
const browser = require("node:child_process").spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(browser.pid));
`;

// A server that hangs once listening: its event loop never runs again.
const hung = (pidFile) => `${withBrowser(pidFile)}
setTimeout(() => { for (;;) {} }, 300);
`;

function browserPid(t, pidFile) {
	const pid = Number(fs.readFileSync(pidFile, "utf8"));
	t.after(() => {
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
	const workerDir = tempDir("browser-server-worker-");
	const state = await start(options(project, workerDir, extra));
	t.after(async () => {
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

test("Playwright resolution names the directory when neither package resolves", () => {
	const project = tempDir("browser-server-empty-");
	assert.throws(() => resolvePlaywright(project), (error) => error.message.includes(project) && /neither @playwright\/test nor playwright resolves/u.test(error.message));
	assert.throws(() => resolvePlaywright(path.join(project, "missing")), /is not a directory/u);
});

test("Playwright resolves from the project, preferring @playwright/test, else playwright", () => {
	const testProject = fakeProject({ cli: "" });
	assert.deepEqual(resolvePlaywright(testProject), { name: "@playwright/test", version: "9.8.7", cli: path.join(testProject, "node_modules", "@playwright", "test", "cli.js") });
	const coreProject = fakeProject({ name: "playwright", version: "1.2.3", cli: "" });
	assert.equal(resolvePlaywright(coreProject).name, "playwright");
	assert.equal(resolvePlaywright(coreProject).version, "1.2.3");
});

test("start records the server, endpoint reports it, and stop ends it and its browser, twice safely", async (t) => {
	const pidFile = path.join(tempDir("browser-server-pid-"), "pid");
	const project = fakeProject({ cli: withBrowser(pidFile) });
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
	const project = fakeProject({ cli: `setTimeout(() => {}, 300); ${LISTEN}` });
	const workerDir = tempDir("browser-server-worker-");
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
	t.after(async () => {
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
	const pidFile = path.join(tempDir("browser-server-pid-"), "pid");
	const project = fakeProject({ cli: withBrowser(pidFile) });
	const workerDir = tempDir("browser-server-worker-");
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
	const project = fakeProject({ cli: LISTEN });
	const { state, workerDir } = await startedServer(t, project);
	const other = tempDir("browser-server-worker-");
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
	const pidFile = path.join(tempDir("browser-server-pid-"), "pid");
	const project = fakeProject({ cli: hung(pidFile) });
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
	const pidFile = path.join(tempDir("browser-server-pid-"), "pid");
	const project = fakeProject({ cli: withBrowser(pidFile) });
	const { state, workerDir } = await startedServer(t, project);
	const browser = browserPid(t, pidFile);
	const [server] = descendants(state.pid);
	process.kill(state.pid, "SIGKILL");
	assert.ok(await eventually(() => !alive(server.pid) && !alive(browser)), "server and browser outlived the supervisor");
	assert.ok(await refusesConnections(state.port));
	assert.equal((await stop({ workerDir })).reason, "already gone");
});

test("a server nobody stops ends itself and its browser at its TTL and clears its record", async (t) => {
	const pidFile = path.join(tempDir("browser-server-pid-"), "pid");
	const project = fakeProject({ cli: withBrowser(pidFile) });
	const { state, workerDir } = await startedServer(t, project, { ttlMs: 1_500 });
	const browser = browserPid(t, pidFile);
	assert.ok(await eventually(() => !alive(state.pid) && !alive(browser)));
	assert.equal(fs.existsSync(path.join(workerDir, STATE_FILE)), false);
	assert.match(fs.readFileSync(path.join(workerDir, LOG_FILE), "utf8"), /stopping \(ttl expired\)/u);
});

test("a server that exits during start fails with its reason and leaves nothing behind", async () => {
	const project = fakeProject({ cli: 'console.error("fake: port already in use"); process.exit(3);' });
	const workerDir = tempDir("browser-server-worker-");
	await assert.rejects(start(options(project, workerDir)), (error) => /did not start: exited with code 3/u.test(error.message) && error.message.includes("fake: port already in use"));
	assert.deepEqual(fs.readdirSync(workerDir), [LOG_FILE]);
});

test("a server that never listens is ended at the timeout, browser included", async (t) => {
	const pidFile = path.join(tempDir("browser-server-pid-"), "pid");
	const project = fakeProject({ cli: `${withBrowser(pidFile).replace(LISTEN, "")} setInterval(() => {}, 1000);` });
	const workerDir = tempDir("browser-server-worker-");
	await assert.rejects(start(options(project, workerDir, { timeoutMs: 1_500 })), /not listening on ws:\/\/127\.0\.0\.1:\d+\/ after 1500ms/u);
	const browser = browserPid(t, pidFile);
	assert.equal(alive(browser), false);
	assert.deepEqual(fs.readdirSync(workerDir), [LOG_FILE]);
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
