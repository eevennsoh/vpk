#!/usr/bin/env node

// Starts and stops a Playwright browser server outside a GPT-lane worker's sandbox, so the
// worker's Playwright tests connect to it (PW_TEST_CONNECT_WS_ENDPOINT) instead of launching
// Chromium, which Seatbelt blocks inside `codex exec --sandbox workspace-write`.
//
//   node scripts/vpk-remote-browser-server.js start --project <dir> --worker-dir <dir>
//        [--port <n>] [--ttl-minutes <n>] [--timeout-ms <n>]
//   node scripts/vpk-remote-browser-server.js stop --worker-dir <dir>
//
// start resolves @playwright/test (else playwright) from --project, the package directory
// whose tests the worker runs, so client and server are the same Playwright version. It
// detaches a supervisor that runs `run-server --host 127.0.0.1`, waits until the server is
// listening, prints one JSON line (endpoint, port, pid, playwrightVersion, …), records the
// same in <worker-dir>/browser-server.json, and exits. The supervisor ends the server after
// --ttl-minutes (default 180) even if nobody calls stop. Its output goes to
// <worker-dir>/browser-server.log.
//
// stop ends the server recorded for that worker directory; it is safe to repeat, and safe
// when the process is already gone.

const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const STATE_FILE = "browser-server.json";
const LOG_FILE = "browser-server.log";
const DEFAULT_TTL_MINUTES = 180;
const MAX_TTL_MINUTES = 24 * 60;
const DEFAULT_START_TIMEOUT_MS = 30_000;
const STOP_GRACE_MS = 5_000;
const POLL_MS = 100;
const HOST = "127.0.0.1";
const USAGE = "usage: vpk-remote-browser-server.js start --project <dir> --worker-dir <dir> [--port <n>] [--ttl-minutes <n>] [--timeout-ms <n>]\n       vpk-remote-browser-server.js stop --worker-dir <dir>";

function parseArgs(argv) {
	const [command, ...rest] = argv;
	if (!["start", "stop"].includes(command)) throw new Error(USAGE);
	const allowed = command === "start" ? ["--project", "--worker-dir", "--port", "--ttl-minutes", "--timeout-ms"] : ["--worker-dir"];
	const options = { command };
	for (let index = 0; index < rest.length; index += 2) {
		const [flag, value] = [rest[index], rest[index + 1]];
		if (!allowed.includes(flag)) throw new Error(`unknown option ${flag} for ${command}\n${USAGE}`);
		if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
		options[{ "--project": "project", "--worker-dir": "workerDir", "--port": "port", "--ttl-minutes": "ttlMinutes", "--timeout-ms": "timeoutMs" }[flag]] = value;
	}
	if (!options.workerDir) throw new Error(`--worker-dir is required\n${USAGE}`);
	options.workerDir = path.resolve(options.workerDir);
	if (command === "stop") return options;
	if (!options.project) throw new Error(`--project is required\n${USAGE}`);
	options.project = path.resolve(options.project);
	const integer = (flag, value, min, max) => {
		const number = Number(value);
		if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${flag} must be an integer from ${min} to ${max}`);
		return number;
	};
	options.port = options.port === undefined ? 0 : integer("--port", options.port, 1, 65535);
	options.ttlMs = integer("--ttl-minutes", options.ttlMinutes ?? DEFAULT_TTL_MINUTES, 1, MAX_TTL_MINUTES) * 60_000;
	delete options.ttlMinutes;
	options.timeoutMs = integer("--timeout-ms", options.timeoutMs ?? DEFAULT_START_TIMEOUT_MS, 1_000, 300_000);
	return options;
}

// The project's own Playwright, never this repo's or a global one, so the worker's test
// runner and the server speak the same protocol version.
function resolvePlaywright(project) {
	if (!fs.statSync(project, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`--project ${project} is not a directory`);
	for (const name of ["@playwright/test", "playwright"]) {
		let manifest;
		try {
			manifest = require.resolve(`${name}/package.json`, { paths: [project] });
		} catch {
			continue;
		}
		const cli = path.join(path.dirname(manifest), "cli.js");
		if (!fs.existsSync(cli)) continue;
		const { version } = JSON.parse(fs.readFileSync(manifest, "utf8"));
		return { name, version, cli };
	}
	throw new Error(`neither @playwright/test nor playwright resolves from ${project}; pass the package directory whose Playwright tests the worker runs, after pnpm install`);
}

function freePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once("error", reject);
		server.listen(0, HOST, () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
	});
}

function pidAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error.code === "EPERM";
	}
}

// A recorded pid counts only while it is still this worker directory's supervisor, so a
// reused pid is never signalled.
function isSupervisor(pid, stateFile) {
	if (!Number.isInteger(pid) || pid <= 0 || !pidAlive(pid)) return false;
	const ps = spawnSync("ps", ["-ww", "-o", "command=", "-p", String(pid)], { encoding: "utf8" });
	return ps.status === 0 && ps.stdout.includes(`${path.basename(__filename)} supervise`) && ps.stdout.includes(stateFile);
}

function readState(stateFile) {
	try {
		return JSON.parse(fs.readFileSync(stateFile, "utf8"));
	} catch {
		return null;
	}
}

function tail(file, lines = 20) {
	try {
		return fs.readFileSync(file, "utf8").trimEnd().split("\n").slice(-lines).join("\n");
	} catch {
		return "";
	}
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForExit(pid, ms) {
	const deadline = Date.now() + ms;
	while (pidAlive(pid)) {
		if (Date.now() > deadline) return false;
		await sleep(POLL_MS);
	}
	return true;
}

// SIGTERM to the supervisor, which stops the server; then SIGKILL to its whole process group.
async function endSupervisor(pid) {
	try {
		process.kill(pid, "SIGTERM");
	} catch {}
	if (await waitForExit(pid, STOP_GRACE_MS)) return;
	try {
		process.kill(-pid, "SIGKILL");
	} catch {}
	await waitForExit(pid, STOP_GRACE_MS);
}

async function start(options) {
	const playwright = resolvePlaywright(options.project);
	fs.mkdirSync(options.workerDir, { recursive: true });
	const stateFile = path.join(options.workerDir, STATE_FILE);
	const logFile = path.join(options.workerDir, LOG_FILE);
	const existing = readState(stateFile);
	if (existing && isSupervisor(existing.pid, stateFile)) {
		throw new Error(`a browser server is already running for ${options.workerDir} (pid ${existing.pid}, ${existing.endpoint}); stop it first`);
	}
	fs.rmSync(stateFile, { force: true });
	const port = options.port || await freePort();
	const endpoint = `ws://${HOST}:${port}/`;
	const log = fs.openSync(logFile, "w");
	const startedAt = new Date();
	const child = spawn(process.execPath, [__filename, "supervise", "--cli", playwright.cli, "--port", String(port), "--ttl-ms", String(options.ttlMs), "--state", stateFile], {
		cwd: options.project,
		detached: true,
		stdio: ["ignore", log, log],
	});
	fs.closeSync(log);
	let exited = null;
	child.once("exit", (code, signal) => { exited = { code, signal }; });
	child.once("error", (error) => { exited = { error }; });
	const deadline = Date.now() + options.timeoutMs;
	const fail = async (reason) => {
		if (child.pid && !exited) await endSupervisor(child.pid);
		fs.rmSync(stateFile, { force: true });
		const output = tail(logFile);
		throw new Error(`browser server did not start: ${reason}${output ? `\n${output}` : ""}`);
	};
	for (;;) {
		if (fs.readFileSync(logFile, "utf8").includes(`Listening on ${endpoint}`)) break;
		if (exited) return fail(exited.error ? exited.error.message : `exited with ${exited.signal ?? `code ${exited.code}`}`);
		if (Date.now() > deadline) return fail(`not listening on ${endpoint} after ${options.timeoutMs}ms`);
		await sleep(POLL_MS);
	}
	const state = {
		endpoint,
		port,
		pid: child.pid,
		playwrightVersion: playwright.version,
		playwrightPackage: playwright.name,
		project: options.project,
		log: logFile,
		startedAt: startedAt.toISOString(),
		expiresAt: new Date(startedAt.getTime() + options.ttlMs).toISOString(),
	};
	fs.writeFileSync(stateFile, `${JSON.stringify(state)}\n`);
	child.unref();
	return state;
}

async function stop(options) {
	const stateFile = path.join(options.workerDir, STATE_FILE);
	const state = readState(stateFile);
	if (!state) {
		fs.rmSync(stateFile, { force: true });
		return { stopped: false, reason: `no browser server recorded in ${options.workerDir}` };
	}
	if (!isSupervisor(state.pid, stateFile)) {
		fs.rmSync(stateFile, { force: true });
		return { stopped: false, pid: state.pid, reason: "already gone" };
	}
	await endSupervisor(state.pid);
	fs.rmSync(stateFile, { force: true });
	return { stopped: true, pid: state.pid, endpoint: state.endpoint };
}

// The detached process start leaves behind: runs the server in its own process group, ends
// it on SIGTERM, SIGINT, SIGHUP or the TTL, and removes the state file when it goes.
function supervise(argv) {
	const option = (flag) => argv[argv.indexOf(flag) + 1];
	const stateFile = option("--state");
	const server = spawn(process.execPath, [option("--cli"), "run-server", "--host", HOST, "--port", option("--port")], { stdio: ["ignore", "inherit", "inherit"] });
	let stopping = false;
	const shutdown = (why) => {
		if (stopping) return;
		stopping = true;
		console.error(`vpk-remote-browser-server: stopping (${why})`);
		server.kill("SIGTERM");
		setTimeout(() => server.kill("SIGKILL"), STOP_GRACE_MS).unref();
	};
	const ttl = setTimeout(() => shutdown("ttl expired"), Number(option("--ttl-ms")));
	for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(signal, () => shutdown(signal));
	server.on("exit", (code) => {
		clearTimeout(ttl);
		if (readState(stateFile)?.pid === process.pid) fs.rmSync(stateFile, { force: true });
		process.exit(stopping ? 0 : code ?? 1);
	});
}

if (require.main === module) {
	if (process.argv[2] === "supervise") {
		supervise(process.argv.slice(3));
	} else {
		(async () => {
			let options;
			try {
				options = parseArgs(process.argv.slice(2));
			} catch (error) {
				console.error(`vpk-remote-browser-server: ${error.message}`);
				process.exitCode = 2;
				return;
			}
			try {
				const result = options.command === "start" ? await start(options) : await stop(options);
				process.stdout.write(`${JSON.stringify(result)}\n`);
			} catch (error) {
				console.error(`vpk-remote-browser-server: ${error.message}`);
				process.exitCode = 1;
			}
		})();
	}
}

module.exports = { LOG_FILE, STATE_FILE, parseArgs, resolvePlaywright, start, stop };
