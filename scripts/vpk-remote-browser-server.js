#!/usr/bin/env node

// Starts and stops a Playwright browser server outside a GPT-lane worker's sandbox, so the
// worker's Playwright tests connect to it (PW_TEST_CONNECT_WS_ENDPOINT) instead of launching
// Chromium, which Seatbelt blocks inside the worker's sandbox. The server is unauthenticated
// on loopback and gives its clients host capabilities; see gpt-executor.md § Browser tests.
//
//   node scripts/vpk-remote-browser-server.js start --project <dir> --worker-dir <dir>
//        [--port <n>] [--ttl-minutes <n>] [--timeout-ms <n>]
//   node scripts/vpk-remote-browser-server.js endpoint --worker-dir <dir>
//   node scripts/vpk-remote-browser-server.js stop --worker-dir <dir>
//
// start resolves @playwright/test (else playwright) from --project, the package directory
// whose tests the worker runs, so client and server are the same Playwright version. It
// detaches a supervisor, which runs `run-server --host 127.0.0.1` in a child, waits until the
// server listens, writes <worker-dir>/browser-server.json atomically, prints the same as one
// JSON line, and exits. Output goes to <worker-dir>/browser-server.log. Starts and stops for
// one worker directory are serialised by <worker-dir>/browser-server.lock: a second start
// fails while the first is in progress, and fails while its server is alive.
//
// endpoint prints the endpoint of the live server recorded for the worker directory, and
// fails if there is none.
//
// stop ends the recorded server and every process under it, including browsers that run in
// their own process group. It signals only a process whose start time, command line and
// random token match the record, so a reused pid or a forged record cannot point it at
// another process. It is safe to repeat.
//
// The server also ends itself after --ttl-minutes (default 180), and when the supervisor is
// killed (the server's stdin closes). Either way its browsers go with it.

const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const STATE_FILE = "browser-server.json";
const LOG_FILE = "browser-server.log";
const LOCK_FILE = "browser-server.lock";
const SCRIPT_NAME = path.basename(__filename);
const DEFAULT_TTL_MINUTES = 180;
const MAX_TTL_MINUTES = 24 * 60;
const DEFAULT_START_TIMEOUT_MS = 30_000;
const DEFAULT_GRACE_MS = 3_000;
const STOP_LOCK_WAIT_MS = 60_000;
const SNAPSHOT_MS = 1_000;
const POLL_MS = 50;
const HOST = "127.0.0.1";
const TOKEN_PATTERN = /^[0-9a-f]{32}$/u;
const USAGE = "usage: vpk-remote-browser-server.js start --project <dir> --worker-dir <dir> [--port <n>] [--ttl-minutes <n>] [--timeout-ms <n>]\n       vpk-remote-browser-server.js endpoint --worker-dir <dir>\n       vpk-remote-browser-server.js stop --worker-dir <dir>";

function parseArgs(argv) {
	const [command, ...rest] = argv;
	if (!["start", "stop", "endpoint"].includes(command)) throw new Error(USAGE);
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
	if (command !== "start") return options;
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntil(predicate, ms) {
	const deadline = Date.now() + ms;
	for (;;) {
		if (predicate()) return true;
		if (Date.now() > deadline) return false;
		await sleep(POLL_MS);
	}
}

// --- Process identity -------------------------------------------------------------------
// A process is identified by its pid and its start time (`ps -o lstart`); a zombie counts as
// gone. Every signal below goes only to a process whose identity still matches.

function ps(args) {
	const result = spawnSync("ps", args, { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } });
	return result.error ? { status: null, stdout: "" } : result;
}

function pidAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error.code === "EPERM";
	}
}

// The start time of a live, non-zombie pid; null when it is gone.
function processStart(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return null;
	const result = ps(["-o", "stat=,lstart=", "-p", String(pid)]);
	const match = /^\s*(\S+)\s+(.+?)\s*$/u.exec(result.stdout);
	if (result.status !== 0 || !match || match[1].startsWith("Z")) return null;
	return match[2];
}

function commandLine(pid) {
	const result = ps(["-ww", "-o", "command=", "-p", String(pid)]);
	return result.status === 0 ? result.stdout.trim() : null;
}

// Every live process under rootPid, as { pid, pgid, start }.
function descendants(rootPid) {
	const result = ps(["-A", "-o", "pid=,ppid=,pgid=,stat=,lstart="]);
	if (result.status !== 0) return [];
	const children = new Map();
	for (const line of result.stdout.split("\n")) {
		const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/u.exec(line);
		if (!match || match[4].startsWith("Z")) continue;
		const row = { pid: Number(match[1]), ppid: Number(match[2]), pgid: Number(match[3]), start: match[5] };
		if (!children.has(row.ppid)) children.set(row.ppid, []);
		children.get(row.ppid).push(row);
	}
	const found = [];
	const queue = [rootPid];
	while (queue.length > 0) {
		for (const row of children.get(queue.shift()) ?? []) {
			found.push({ pid: row.pid, pgid: row.pgid, start: row.start });
			queue.push(row.pid);
		}
	}
	return found;
}

const isSameProcess = (record) => processStart(record.pid) === record.start;

function signalRecorded(records, signal) {
	for (const record of records) {
		if (!isSameProcess(record)) continue;
		// A browser leads its own process group; signal the group to reach its helpers too.
		if (record.pgid === record.pid) {
			try {
				process.kill(-record.pid, signal);
			} catch {}
		}
		try {
			process.kill(record.pid, signal);
		} catch {}
	}
}

// SIGTERM, then SIGKILL for whatever is left after graceMs.
async function endRecorded(records, graceMs) {
	const live = () => records.filter(isSameProcess);
	if (live().length === 0) return;
	signalRecorded(live(), "SIGTERM");
	if (await waitUntil(() => live().length === 0, graceMs)) return;
	signalRecorded(live(), "SIGKILL");
	await waitUntil(() => live().length === 0, graceMs);
}

// Ends a supervisor and everything under it: SIGTERM lets it close the server's browsers;
// past the grace period its process group gets SIGKILL, then any recorded descendant that
// left the group.
async function endSupervisor(pid, start, graceMs) {
	const leader = { pid, pgid: pid, start };
	if (!isSameProcess(leader)) return;
	const tree = descendants(pid);
	try {
		process.kill(pid, "SIGTERM");
	} catch {}
	if (!await waitUntil(() => !isSameProcess(leader), 5 * graceMs + 1_000)) {
		tree.push(...descendants(pid));
		signalRecorded([leader], "SIGKILL");
		await waitUntil(() => !isSameProcess(leader), graceMs);
	}
	signalRecorded(tree, "SIGKILL");
	await waitUntil(() => !tree.some(isSameProcess), graceMs);
}

// --- State and lock ---------------------------------------------------------------------

function readJson(file) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return null;
	}
}

function writeFileAtomic(file, text) {
	const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
	try {
		fs.writeFileSync(temp, text, { flag: "wx" });
		fs.renameSync(temp, file);
	} finally {
		fs.rmSync(temp, { force: true });
	}
}

// True only while the record describes a live supervisor started for this state file: same
// start time, and a command line that ends with this state file and the record's token.
function isLiveSupervisor(state, stateFile) {
	if (!state || !Number.isInteger(state.pid) || state.pid <= 0 || typeof state.token !== "string" || !TOKEN_PATTERN.test(state.token) || typeof state.processStart !== "string") return false;
	if (processStart(state.pid) !== state.processStart) return false;
	const command = commandLine(state.pid);
	return command !== null && command.includes(`${SCRIPT_NAME} supervise `) && command.endsWith(` --state ${stateFile} --token ${state.token}`);
}

// An exclusive lock file holding its owner's pid and start time. A lock whose owner is gone
// is moved aside atomically and taken over; if what was moved turns out to be a live
// owner's fresh lock, it is linked back.
async function acquireLock(workerDir, { waitMs, purpose }) {
	const lockFile = path.join(workerDir, LOCK_FILE);
	const nonce = crypto.randomBytes(8).toString("hex");
	const body = JSON.stringify({ pid: process.pid, start: processStart(process.pid), nonce, purpose });
	const deadline = Date.now() + waitMs;
	for (;;) {
		const temp = `${lockFile}.${nonce}.tmp`;
		fs.writeFileSync(temp, body);
		try {
			fs.linkSync(temp, lockFile);
			return () => {
				try {
					if (fs.readFileSync(lockFile, "utf8") === body) fs.rmSync(lockFile, { force: true });
				} catch {}
			};
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
		} finally {
			fs.rmSync(temp, { force: true });
		}
		let raw;
		try {
			raw = fs.readFileSync(lockFile, "utf8");
		} catch {
			continue;
		}
		const holder = (() => {
			try {
				return JSON.parse(raw);
			} catch {
				return null;
			}
		})();
		if (holder?.start && isSameProcess({ pid: holder.pid, start: holder.start })) {
			if (Date.now() < deadline) {
				await sleep(POLL_MS);
				continue;
			}
			throw new Error(`another ${holder.purpose ?? "start or stop"} for ${workerDir} is in progress (pid ${holder.pid})`);
		}
		const aside = `${lockFile}.stale.${nonce}`;
		try {
			fs.renameSync(lockFile, aside);
		} catch {
			continue;
		}
		if (fs.readFileSync(aside, "utf8") !== raw) {
			try {
				fs.linkSync(aside, lockFile);
			} catch {}
		}
		fs.rmSync(aside, { force: true });
	}
}

function tail(file, lines = 20) {
	try {
		return fs.readFileSync(file, "utf8").trimEnd().split("\n").slice(-lines).join("\n");
	} catch {
		return "";
	}
}

// --- Commands ---------------------------------------------------------------------------

async function start(options, hooks = {}) {
	const playwright = resolvePlaywright(options.project);
	const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
	fs.mkdirSync(options.workerDir, { recursive: true });
	const stateFile = path.join(options.workerDir, STATE_FILE);
	const logFile = path.join(options.workerDir, LOG_FILE);
	const release = await acquireLock(options.workerDir, { waitMs: 0, purpose: "start" });
	let child = null;
	let exited = null;
	let supervisorStart = null;
	const token = crypto.randomBytes(16).toString("hex");
	try {
		const existing = readJson(stateFile);
		if (existing && isLiveSupervisor(existing, stateFile)) {
			throw new Error(`a browser server is already running for ${options.workerDir} (pid ${existing.pid}, ${existing.endpoint}); stop it first`);
		}
		fs.rmSync(stateFile, { force: true });
		const port = options.port || await freePort();
		const endpoint = `ws://${HOST}:${port}/`;
		const log = fs.openSync(logFile, "w");
		const startedAt = new Date();
		child = spawn(process.execPath, [__filename, "supervise", "--cli", playwright.cli, "--port", String(port), "--ttl-ms", String(options.ttlMs), "--grace-ms", String(graceMs), "--state", stateFile, "--token", token], {
			cwd: options.project,
			detached: true,
			stdio: ["ignore", log, log],
		});
		fs.closeSync(log);
		child.once("exit", (code, signal) => { exited = { code, signal }; });
		child.once("error", (error) => { exited = { error }; });
		const deadline = Date.now() + options.timeoutMs;
		const notStarted = (reason) => {
			const output = tail(logFile);
			return new Error(`browser server did not start: ${reason}${output ? `\n${output}` : ""}`);
		};
		for (;;) {
			if (supervisorStart === null && child.pid && !exited) supervisorStart = processStart(child.pid);
			if (supervisorStart !== null && fs.readFileSync(logFile, "utf8").includes(`Listening on ${endpoint}`)) break;
			if (exited) throw notStarted(exited.error ? exited.error.message : `exited with ${exited.signal ?? `code ${exited.code}`}`);
			if (Date.now() > deadline) throw notStarted(`not listening on ${endpoint} after ${options.timeoutMs}ms`);
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
			processStart: supervisorStart,
			token,
			graceMs,
		};
		await hooks.beforePublish?.(state);
		writeFileAtomic(stateFile, `${JSON.stringify(state)}\n`);
		child.unref();
		return state;
	} catch (error) {
		if (child?.pid && !exited) {
			await endSupervisor(child.pid, supervisorStart ?? processStart(child.pid), graceMs);
		}
		if (readJson(stateFile)?.token === token) fs.rmSync(stateFile, { force: true });
		throw error.message.startsWith("browser server did not start") || !child ? error : new Error(`browser server did not start: ${error.message}`);
	} finally {
		release();
	}
}

async function stop(options) {
	const stateFile = path.join(options.workerDir, STATE_FILE);
	if (!fs.statSync(options.workerDir, { throwIfNoEntry: false })?.isDirectory()) return { stopped: false, reason: `no browser server recorded in ${options.workerDir}` };
	// Waits for a start in progress, so the server it is starting is the one stopped.
	const release = await acquireLock(options.workerDir, { waitMs: STOP_LOCK_WAIT_MS, purpose: "stop" });
	try {
		if (!fs.existsSync(stateFile)) return { stopped: false, reason: `no browser server recorded in ${options.workerDir}` };
		const state = readJson(stateFile);
		if (!state) return { stopped: false, reason: `${stateFile} is unreadable; nothing signalled, file left in place` };
		if (!isLiveSupervisor(state, stateFile)) {
			// A record whose pid is gone describes nothing; one whose pid is alive but does
			// not match is not ours to signal or to delete.
			if (!Number.isInteger(state.pid) || !pidAlive(state.pid)) {
				fs.rmSync(stateFile, { force: true });
				return { stopped: false, pid: state.pid, reason: "already gone" };
			}
			return { stopped: false, pid: state.pid, reason: `pid ${state.pid} is not the browser server recorded for ${options.workerDir}; nothing signalled, file left in place` };
		}
		const graceMs = Number.isInteger(state.graceMs) && state.graceMs >= 100 && state.graceMs <= 60_000 ? state.graceMs : DEFAULT_GRACE_MS;
		await endSupervisor(state.pid, state.processStart, graceMs);
		if (readJson(stateFile)?.token === state.token) fs.rmSync(stateFile, { force: true });
		return { stopped: true, pid: state.pid, endpoint: state.endpoint };
	} finally {
		release();
	}
}

function endpoint(options) {
	const stateFile = path.join(options.workerDir, STATE_FILE);
	const state = readJson(stateFile);
	if (!isLiveSupervisor(state, stateFile)) throw new Error(`no live browser server recorded in ${options.workerDir}`);
	return state.endpoint;
}

// --- Detached processes -----------------------------------------------------------------

function optionReader(argv) {
	return (flag) => {
		const index = argv.indexOf(flag);
		if (index < 0 || argv[index + 1] === undefined) throw new Error(`${flag} is required`);
		return argv[index + 1];
	};
}

// The detached process start leaves behind. It runs the server in a child whose stdin it
// holds, takes a snapshot of the processes under that child every second, ends the server
// on SIGTERM, SIGINT, SIGHUP or the TTL, ends any snapshotted process that outlives the
// server, and removes the state file if it is still its own.
function supervise(argv) {
	const option = optionReader(argv);
	const stateFile = option("--state");
	const token = option("--token");
	const graceMs = Number(option("--grace-ms"));
	const server = spawn(process.execPath, [__filename, "serve", "--cli", option("--cli"), "--port", option("--port"), "--grace-ms", String(graceMs)], { stdio: ["pipe", "inherit", "inherit"] });
	server.stdin.on("error", () => {});
	const known = new Map();
	const remember = () => {
		if (!server.pid || server.exitCode !== null || server.signalCode !== null) return;
		for (const record of descendants(server.pid)) known.set(`${record.pid} ${record.start}`, record);
	};
	const snapshots = setInterval(remember, SNAPSHOT_MS);
	let stopping = false;
	const shutdown = (why) => {
		if (stopping) return;
		stopping = true;
		console.error(`vpk-remote-browser-server: stopping (${why})`);
		remember();
		// run-server closes its browsers and exits when its stdin closes.
		server.stdin.end();
		setTimeout(() => {
			remember();
			server.kill("SIGKILL");
		}, 2 * graceMs).unref();
	};
	const ttl = setTimeout(() => shutdown("ttl expired"), Number(option("--ttl-ms")));
	for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(signal, () => shutdown(signal));
	server.on("exit", async (code, signal) => {
		clearInterval(snapshots);
		clearTimeout(ttl);
		const leftovers = [...known.values()].filter(isSameProcess);
		if (leftovers.length > 0) {
			console.error(`vpk-remote-browser-server: ending ${leftovers.length} process(es) left by the server`);
			await endRecorded(leftovers, graceMs);
		}
		if (readJson(stateFile)?.token === token) fs.rmSync(stateFile, { force: true });
		process.exit(stopping ? 0 : code ?? (signal ? 1 : 0));
	});
}

// The server itself: Playwright's CLI loaded in this process, which first starts reading
// stdin so run-server sees it close when the supervisor goes, however it goes. If the
// server has not exited a grace period later, it ends its own process tree and exits.
function serve(argv) {
	const option = optionReader(argv);
	const cli = option("--cli");
	const graceMs = Number(option("--grace-ms"));
	let ending = false;
	const end = () => {
		if (ending) return;
		ending = true;
		const tree = descendants(process.pid);
		setTimeout(async () => {
			await endRecorded([...tree, ...descendants(process.pid)], graceMs);
			process.exit(0);
		}, graceMs);
	};
	process.stdin.on("end", end);
	process.stdin.on("close", end);
	process.stdin.on("error", end);
	process.stdin.resume();
	process.on("SIGTERM", () => {
		process.stdin.destroy();
		end();
	});
	process.argv = [process.execPath, cli, "run-server", "--host", HOST, "--port", option("--port")];
	require(cli);
}

if (require.main === module) {
	const [mode, ...rest] = process.argv.slice(2);
	if (mode === "supervise") {
		supervise(rest);
	} else if (mode === "serve") {
		serve(rest);
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
				if (options.command === "endpoint") {
					process.stdout.write(`${endpoint(options)}\n`);
					return;
				}
				const result = options.command === "start" ? await start(options) : await stop(options);
				process.stdout.write(`${JSON.stringify(result)}\n`);
			} catch (error) {
				console.error(`vpk-remote-browser-server: ${error.message}`);
				process.exitCode = 1;
			}
		})();
	}
}

module.exports = { LOCK_FILE, LOG_FILE, STATE_FILE, descendants, endpoint, parseArgs, processStart, resolvePlaywright, start, stop };
