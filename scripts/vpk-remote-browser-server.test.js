const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { LOG_FILE, STATE_FILE, parseArgs, resolvePlaywright, start, stop } = require("./vpk-remote-browser-server.js");

const tempDir = (prefix) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));

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
const LISTENING_CLI = `
const net = require("node:net");
const argv = process.argv;
const host = argv[argv.indexOf("--host") + 1];
const port = Number(argv[argv.indexOf("--port") + 1]);
const server = net.createServer((socket) => socket.end());
server.listen(port, host, () => console.log("Listening on ws://" + host + ":" + port + "/"));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`;

const alive = (pid) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error.code === "EPERM";
	}
};

async function startedServer(t, project, extra = {}) {
	const workerDir = tempDir("browser-server-worker-");
	const options = { command: "start", project, workerDir, port: 0, ttlMs: 60_000, timeoutMs: 10_000, ...extra };
	const state = await start(options);
	t.after(() => stop({ workerDir }));
	return { state, workerDir };
}

test("parseArgs requires a command, a worker directory, and a project for start", () => {
	assert.throws(() => parseArgs([]), /usage:/u);
	assert.throws(() => parseArgs(["status"]), /usage:/u);
	assert.throws(() => parseArgs(["start", "--project", "/p"]), /--worker-dir is required/u);
	assert.throws(() => parseArgs(["start", "--worker-dir", "/w"]), /--project is required/u);
	assert.throws(() => parseArgs(["stop", "--worker-dir", "/w", "--project", "/p"]), /unknown option --project for stop/u);
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

test("start records the server in the worker directory and stop ends it, twice safely", async (t) => {
	const project = fakeProject({ cli: LISTENING_CLI });
	const { state, workerDir } = await startedServer(t, project);
	assert.match(state.endpoint, /^ws:\/\/127\.0\.0\.1:\d+\/$/u);
	assert.equal(state.endpoint, `ws://127.0.0.1:${state.port}/`);
	assert.equal(state.playwrightVersion, "9.8.7");
	assert.equal(state.project, project);
	assert.ok(alive(state.pid));
	assert.deepEqual(JSON.parse(fs.readFileSync(path.join(workerDir, STATE_FILE), "utf8")), state);
	assert.ok(fs.readFileSync(path.join(workerDir, LOG_FILE), "utf8").includes(`Listening on ${state.endpoint}`));

	await assert.rejects(start({ command: "start", project, workerDir, port: 0, ttlMs: 60_000, timeoutMs: 10_000 }), /already running/u);

	assert.deepEqual(await stop({ workerDir }), { stopped: true, pid: state.pid, endpoint: state.endpoint });
	assert.equal(alive(state.pid), false);
	assert.equal(fs.existsSync(path.join(workerDir, STATE_FILE)), false);
	assert.equal((await stop({ workerDir })).stopped, false);
});

test("stop is safe when the recorded process is already gone or the pid is not ours", async () => {
	const workerDir = tempDir("browser-server-worker-");
	assert.equal((await stop({ workerDir })).stopped, false);
	// The test process itself: alive, but not a supervisor for this worker directory.
	fs.writeFileSync(path.join(workerDir, STATE_FILE), JSON.stringify({ pid: process.pid, endpoint: "ws://127.0.0.1:1/" }));
	assert.deepEqual(await stop({ workerDir }), { stopped: false, pid: process.pid, reason: "already gone" });
	assert.equal(fs.existsSync(path.join(workerDir, STATE_FILE)), false);
	fs.writeFileSync(path.join(workerDir, STATE_FILE), "not json");
	assert.equal((await stop({ workerDir })).stopped, false);
	assert.equal(fs.existsSync(path.join(workerDir, STATE_FILE)), false);
});

test("a server that exits during start fails with its reason and leaves nothing behind", async () => {
	const project = fakeProject({ cli: 'console.error("fake: port already in use"); process.exit(3);' });
	const workerDir = tempDir("browser-server-worker-");
	await assert.rejects(start({ command: "start", project, workerDir, port: 0, ttlMs: 60_000, timeoutMs: 10_000 }), (error) => /did not start: exited with code 3/u.test(error.message) && error.message.includes("fake: port already in use"));
	assert.equal(fs.existsSync(path.join(workerDir, STATE_FILE)), false);
});

test("a server that never listens is killed at the timeout, with no orphan", async () => {
	const pidFile = path.join(tempDir("browser-server-pid-"), "pid");
	const project = fakeProject({ cli: `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);` });
	const workerDir = tempDir("browser-server-worker-");
	await assert.rejects(start({ command: "start", project, workerDir, port: 0, ttlMs: 60_000, timeoutMs: 1_500 }), /not listening on ws:\/\/127\.0\.0\.1:\d+\/ after 1500ms/u);
	const serverPid = Number(fs.readFileSync(pidFile, "utf8"));
	for (let i = 0; i < 50 && alive(serverPid); i++) await new Promise((resolve) => setTimeout(resolve, 100));
	assert.equal(alive(serverPid), false);
	assert.equal(fs.existsSync(path.join(workerDir, STATE_FILE)), false);
});

test("a server nobody stops ends itself at its TTL and clears its record", async (t) => {
	const project = fakeProject({ cli: LISTENING_CLI });
	const { state, workerDir } = await startedServer(t, project, { ttlMs: 1_000 });
	for (let i = 0; i < 100 && alive(state.pid); i++) await new Promise((resolve) => setTimeout(resolve, 100));
	assert.equal(alive(state.pid), false);
	assert.equal(fs.existsSync(path.join(workerDir, STATE_FILE)), false);
	assert.match(fs.readFileSync(path.join(workerDir, LOG_FILE), "utf8"), /stopping \(ttl expired\)/u);
});

test("the real Playwright server starts from this repo and stops", { skip: (() => { try { resolvePlaywright(path.join(__dirname, "..")); return false; } catch { return "Playwright is not installed here"; } })() }, async (t) => {
	const project = path.join(__dirname, "..");
	const { state, workerDir } = await startedServer(t, project);
	assert.equal(state.playwrightVersion, resolvePlaywright(project).version);
	const response = await fetch(`http://127.0.0.1:${state.port}/`).catch((error) => error);
	assert.ok(!(response instanceof Error), "the server accepts connections on its port");
	assert.equal((await stop({ workerDir })).stopped, true);
	assert.equal(alive(state.pid), false);
});
