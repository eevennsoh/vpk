#!/usr/bin/env node

// Starts and stops a Playwright browser server outside a GPT-lane worker's sandbox, so the
// worker's Playwright tests connect to it (PW_TEST_CONNECT_WS_ENDPOINT) instead of launching
// Chromium, which Seatbelt blocks inside the worker's sandbox. The server is unauthenticated
// on loopback and gives its clients host capabilities; see gpt-executor.md § Browser tests.
//
//   node scripts/vpk-remote-browser-server.js new-token
//   node scripts/vpk-remote-browser-server.js start --project <dir> --worker-dir <dir>
//        [--token <hex>] [--port <n>] [--ttl-minutes <n>] [--timeout-ms <n>]
//   node scripts/vpk-remote-browser-server.js endpoint --worker-dir <dir> [--token <hex>]
//   node scripts/vpk-remote-browser-server.js stop --worker-dir <dir> [--token <hex>]
//
// new-token prints a fresh ownership token (32 hex digits). A run script takes one before it
// installs its cleanup trap and passes it to start, endpoint and stop, so the trap can only
// ever stop the server that run started, even when start fails because another run's server
// is alive.
//
// start resolves @playwright/test (else playwright) from --project, the package directory
// whose tests the worker runs, so client and server are the same Playwright version. It
// detaches a supervisor, which runs `run-server --host 127.0.0.1` in a child, waits until the
// server listens, writes <worker-dir>/browser-server.json atomically, prints the same as one
// JSON line, and exits. Output goes to <worker-dir>/browser-server.log. Starts and stops for
// one worker directory are serialised by <worker-dir>/browser-server.lock: a second start
// fails while the first is in progress, and fails while its server is alive. A supervisor
// whose record does not appear within its start timeout plus UNRECORDED_GRACE_MS (its starter
// died) ends itself, and the next start or stop for that worker directory ends it at once.
//
// endpoint prints the endpoint of the live server recorded for the worker directory, and
// fails if there is none or, with --token, if it is another run's.
//
// stop ends the recorded server and every process under it, including browsers that run in
// their own process group. It signals only a process whose start time, command line and
// token match, so a reused pid or a forged record cannot point it at another process. With
// --token it refuses a server started with another token, and also ends an unrecorded
// supervisor started with that token. It is safe to repeat.
//
// The server also ends itself after --ttl-minutes (default 180), and when the supervisor is
// killed, through a watchdog thread that runs even when the server's main thread hangs.
// Either way its browsers go with it.

const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { Worker, isMainThread, workerData } = require("node:worker_threads");

const STATE_FILE = "browser-server.json";
const LOG_FILE = "browser-server.log";
const LOCK_FILE = "browser-server.lock";
const SCRIPT_NAME = path.basename(__filename);
const DEFAULT_TTL_MINUTES = 180;
const MAX_TTL_MINUTES = 24 * 60;
const DEFAULT_START_TIMEOUT_MS = 30_000;
const DEFAULT_GRACE_MS = 3_000;
const STOP_LOCK_WAIT_MS = 60_000;
// How long a lock that cannot be read or parsed is given to become readable before start or
// stop gives up with an error; and how many times a stale lock's takeover is attempted.
const UNREADABLE_LOCK_WAIT_MS = 5_000;
const LOCK_TAKEOVER_ATTEMPTS = 5;
// Added to the start timeout: a supervisor whose record has not appeared by then ends itself.
const UNRECORDED_GRACE_MS = 5_000;
// Test hook: when set to a file path, start writes the state it is about to publish there and
// waits forever, so a test can kill the starter between spawn and publish.
const HOLD_BEFORE_PUBLISH_ENV = "VPK_BROWSER_SERVER_TEST_HOLD_BEFORE_PUBLISH";
const SNAPSHOT_MS = 1_000;
const POLL_MS = 50;
const HOST = "127.0.0.1";
const TOKEN_PATTERN = /^[0-9a-f]{32}$/u;
const USAGE = "usage: vpk-remote-browser-server.js new-token\n       vpk-remote-browser-server.js start --project <dir> --worker-dir <dir> [--token <hex>] [--port <n>] [--ttl-minutes <n>] [--timeout-ms <n>]\n       vpk-remote-browser-server.js endpoint --worker-dir <dir> [--token <hex>]\n       vpk-remote-browser-server.js stop --worker-dir <dir> [--token <hex>]";

function parseArgs(argv) {
	const [command, ...rest] = argv;
	if (!["new-token", "start", "stop", "endpoint"].includes(command)) throw new Error(USAGE);
	if (command === "new-token") {
		if (rest.length > 0) throw new Error(`new-token takes no options\n${USAGE}`);
		return { command };
	}
	const allowed = command === "start" ? ["--project", "--worker-dir", "--token", "--port", "--ttl-minutes", "--timeout-ms"] : ["--worker-dir", "--token"];
	const options = { command };
	for (let index = 0; index < rest.length; index += 2) {
		const [flag, value] = [rest[index], rest[index + 1]];
		if (!allowed.includes(flag)) throw new Error(`unknown option ${flag} for ${command}\n${USAGE}`);
		if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
		options[{ "--project": "project", "--worker-dir": "workerDir", "--token": "token", "--port": "port", "--ttl-minutes": "ttlMinutes", "--timeout-ms": "timeoutMs" }[flag]] = value;
	}
	if (!options.workerDir) throw new Error(`--worker-dir is required\n${USAGE}`);
	options.workerDir = path.resolve(options.workerDir);
	if (options.token !== undefined && !TOKEN_PATTERN.test(options.token)) throw new Error("--token must be 32 lowercase hex digits, as new-token prints");
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

// The supervisor's command line ends with this; isLiveSupervisor and supervisorsFor match it.
const supervisorSuffix = (stateFile, token) => ` --state ${stateFile} --token ${token}`;

// True only while the record describes a live supervisor started for this state file: same
// start time, and a command line that ends with this state file and the record's token.
function isLiveSupervisor(state, stateFile) {
	if (!state || !Number.isInteger(state.pid) || state.pid <= 0 || typeof state.token !== "string" || !TOKEN_PATTERN.test(state.token) || typeof state.processStart !== "string") return false;
	if (processStart(state.pid) !== state.processStart) return false;
	const command = commandLine(state.pid);
	return command !== null && command.includes(`${SCRIPT_NAME} supervise `) && command.endsWith(supervisorSuffix(stateFile, state.token));
}

// Every live supervisor started for this state file, recorded or not, as { pid, start, token }.
function supervisorsFor(stateFile) {
	const result = ps(["-Aww", "-o", "pid=,command="]);
	if (result.status !== 0) return [];
	const found = [];
	for (const line of result.stdout.split("\n")) {
		const match = /^\s*(\d+)\s+(.*)$/u.exec(line);
		if (!match || !match[2].includes(`${SCRIPT_NAME} supervise `)) continue;
		const token = / --token ([0-9a-f]{32})$/u.exec(match[2])?.[1];
		if (!token || !match[2].endsWith(supervisorSuffix(stateFile, token))) continue;
		const pid = Number(match[1]);
		const start = processStart(pid);
		// Read the start time, then check the command line again, so a pid reused in between is not taken.
		if (start !== null && commandLine(pid)?.endsWith(supervisorSuffix(stateFile, token))) found.push({ pid, start, token });
	}
	return found;
}

// Writes body to file only if file does not exist (link(2) fails with EEXIST), so a reader
// never sees a partial record.
function publishExclusive(file, body) {
	const temp = `${file}.${crypto.randomBytes(8).toString("hex")}.tmp`;
	fs.writeFileSync(temp, body, { flag: "wx" });
	try {
		fs.linkSync(temp, file);
		return true;
	} catch (error) {
		if (error.code === "EEXIST") return false;
		throw error;
	} finally {
		fs.rmSync(temp, { force: true });
	}
}

// { holder } for a well-formed lock record ({ pid, start, token, purpose }), { unreadable }
// with the reason when the file cannot be read or parsed, and null when it is gone.
function readLockRecord(file) {
	let raw;
	try {
		raw = fs.readFileSync(file, "utf8");
	} catch (error) {
		return error.code === "ENOENT" ? null : { unreadable: error.code ?? error.message };
	}
	let record;
	try {
		record = JSON.parse(raw);
	} catch {
		return { unreadable: "not JSON" };
	}
	if (!record || !Number.isInteger(record.pid) || record.pid <= 0 || typeof record.start !== "string" || typeof record.token !== "string" || !TOKEN_PATTERN.test(record.token)) return { unreadable: "not a lock record" };
	return { holder: record };
}

// Removes the lock only while it still holds the stale owner's token. Reclaimers of one stale
// lock take turns through a guard named after that token, so two of them can never both read
// "still stale" and then remove; and since tokens never repeat, once the stale lock is gone no
// lock can match again, so a late reclaimer removes nothing. Nothing is ever renamed, so a
// live lock is never moved.
async function takeOverStaleLock(lockFile, stale) {
	const guard = `${lockFile}.reclaim-${stale.token}`;
	const stillStale = () => readLockRecord(lockFile)?.holder?.token === stale.token;
	if (publishExclusive(guard, JSON.stringify({ pid: process.pid, start: processStart(process.pid), token: crypto.randomBytes(16).toString("hex") }))) {
		try {
			if (stillStale()) fs.rmSync(lockFile, { force: true });
		} finally {
			fs.rmSync(guard, { force: true });
		}
		return;
	}
	// The stale lock is already gone, so this guard can guard nothing any more.
	if (!stillStale()) {
		fs.rmSync(guard, { force: true });
		return;
	}
	const owner = readLockRecord(guard)?.holder;
	if (owner && !isSameProcess(owner)) throw new Error(`a takeover of the stale lock ${lockFile} was interrupted (pid ${owner.pid} left ${guard}); remove both files if no start or stop for ${path.dirname(lockFile)} is running`);
	await sleep(POLL_MS);
}

// An exclusive lock file holding its owner's pid, start time and a random token. A live
// owner's lock is waited for up to waitMs; a dead owner's is taken over (takeOverStaleLock) at
// most LOCK_TAKEOVER_ATTEMPTS times; one that cannot be read or parsed is waited for up to
// unreadableWaitMs. Each ends in an error naming the lock, never in an endless loop.
async function acquireLock(workerDir, { waitMs, purpose, unreadableWaitMs = UNREADABLE_LOCK_WAIT_MS, hooks = {} }) {
	const lockFile = path.join(workerDir, LOCK_FILE);
	const start = processStart(process.pid);
	if (start === null) throw new Error("cannot read this process's start time with ps, so no lock can be taken");
	const token = crypto.randomBytes(16).toString("hex");
	const body = JSON.stringify({ pid: process.pid, start, token, purpose });
	const began = Date.now();
	let takeovers = 0;
	for (;;) {
		if (publishExclusive(lockFile, body)) {
			return () => {
				if (readLockRecord(lockFile)?.holder?.token === token) fs.rmSync(lockFile, { force: true });
			};
		}
		const seen = readLockRecord(lockFile);
		if (seen === null) continue;
		const waited = Date.now() - began;
		if (seen.unreadable) {
			if (waited >= unreadableWaitMs) throw new Error(`${lockFile} cannot be read as a lock (${seen.unreadable}) after ${waited}ms; remove it if no start or stop for ${workerDir} is running`);
			await sleep(POLL_MS);
			continue;
		}
		const { holder } = seen;
		if (isSameProcess(holder)) {
			if (waited >= waitMs) throw new Error(`another ${holder.purpose ?? "start or stop"} for ${workerDir} is in progress (pid ${holder.pid})`);
			await sleep(POLL_MS);
			continue;
		}
		takeovers += 1;
		if (takeovers > LOCK_TAKEOVER_ATTEMPTS) throw new Error(`could not take over the stale lock ${lockFile} in ${LOCK_TAKEOVER_ATTEMPTS} attempts; remove it if no start or stop for ${workerDir} is running`);
		await hooks.beforeTakeover?.(holder);
		await takeOverStaleLock(lockFile, holder);
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

// Ends supervisors (and everything under them) in parallel.
async function endSupervisors(list, graceMs) {
	await Promise.all(list.map(({ pid, start }) => endSupervisor(pid, start, graceMs)));
}

async function start(options, hooks = {}) {
	const playwright = resolvePlaywright(options.project);
	const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
	fs.mkdirSync(options.workerDir, { recursive: true });
	const stateFile = path.join(options.workerDir, STATE_FILE);
	const logFile = path.join(options.workerDir, LOG_FILE);
	const release = await acquireLock(options.workerDir, { waitMs: 0, purpose: "start", ...hooks.lock });
	let child = null;
	let exited = null;
	let supervisorStart = null;
	const token = options.token ?? crypto.randomBytes(16).toString("hex");
	try {
		const existing = readJson(stateFile);
		if (existing && isLiveSupervisor(existing, stateFile)) {
			throw new Error(`a browser server is already running for ${options.workerDir} (pid ${existing.pid}, ${existing.endpoint}); stop it first`);
		}
		// Holding the lock with no live record, any supervisor for this state file is an orphan
		// whose starter died before publishing.
		const orphans = supervisorsFor(stateFile);
		if (orphans.length > 0) {
			console.error(`vpk-remote-browser-server: ending ${orphans.length} unrecorded supervisor(s) for ${options.workerDir}: pid ${orphans.map(({ pid }) => pid).join(", ")}`);
			await endSupervisors(orphans, graceMs);
		}
		fs.rmSync(stateFile, { force: true });
		const port = options.port || await freePort();
		const endpoint = `ws://${HOST}:${port}/`;
		const log = fs.openSync(logFile, "w");
		const startedAt = new Date();
		child = spawn(process.execPath, [__filename, "supervise", "--cli", playwright.cli, "--port", String(port), "--ttl-ms", String(options.ttlMs), "--grace-ms", String(graceMs), "--record-timeout-ms", String(options.timeoutMs + UNRECORDED_GRACE_MS), "--state", stateFile, "--token", token], {
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

const validGrace = (value) => (Number.isInteger(value) && value >= 100 && value <= 60_000 ? value : DEFAULT_GRACE_MS);

async function stop(options, hooks = {}) {
	const stateFile = path.join(options.workerDir, STATE_FILE);
	const none = { stopped: false, reason: `no browser server recorded in ${options.workerDir}` };
	if (!fs.statSync(options.workerDir, { throwIfNoEntry: false })?.isDirectory()) return none;
	// Waits for a start in progress, so the server it is starting is the one stopped.
	const release = await acquireLock(options.workerDir, { waitMs: STOP_LOCK_WAIT_MS, purpose: "stop", ...hooks.lock });
	try {
		const exists = fs.existsSync(stateFile);
		const state = exists ? readJson(stateFile) : null;
		if (exists && !state) return { stopped: false, reason: `${stateFile} is unreadable; nothing signalled, file left in place` };
		const recordedLive = state !== null && isLiveSupervisor(state, stateFile);
		// Unrecorded supervisors for this state file (a starter died before publishing): with
		// --token only that run's, otherwise all of them, but only while no live record exists
		// and the record names no live process.
		const recordAbsentOrDead = state === null || !Number.isInteger(state.pid) || !pidAlive(state.pid);
		const orphans = supervisorsFor(stateFile).filter((found) => !(recordedLive && found.pid === state.pid) && (options.token ? found.token === options.token : recordAbsentOrDead));
		if (recordedLive && options.token && state.token !== options.token) {
			await endSupervisors(orphans, DEFAULT_GRACE_MS);
			return { stopped: orphans.length > 0, pid: state.pid, reason: `the recorded server (pid ${state.pid}) was started by another run (token mismatch); not signalled`, ...(orphans.length > 0 ? { orphans: orphans.map(({ pid }) => pid) } : {}) };
		}
		const withOrphans = (result) => (orphans.length > 0 ? { ...result, orphans: orphans.map(({ pid }) => pid) } : result);
		if (recordedLive) {
			await endSupervisors([{ pid: state.pid, start: state.processStart }, ...orphans], validGrace(state.graceMs));
			if (readJson(stateFile)?.token === state.token) fs.rmSync(stateFile, { force: true });
			return withOrphans({ stopped: true, pid: state.pid, endpoint: state.endpoint });
		}
		await endSupervisors(orphans, DEFAULT_GRACE_MS);
		if (state === null) return orphans.length > 0 ? withOrphans({ stopped: true, reason: "ended unrecorded supervisor(s)" }) : none;
		// A record whose pid is gone describes nothing; one whose pid is alive but does not
		// match is not ours to signal or to delete.
		if (recordAbsentOrDead) {
			fs.rmSync(stateFile, { force: true });
			return withOrphans({ stopped: orphans.length > 0, pid: state.pid, reason: "already gone" });
		}
		return withOrphans({ stopped: orphans.length > 0, pid: state.pid, reason: `pid ${state.pid} is not the browser server recorded for ${options.workerDir}; nothing signalled, file left in place` });
	} finally {
		release();
	}
}

function endpoint(options) {
	const stateFile = path.join(options.workerDir, STATE_FILE);
	const state = readJson(stateFile);
	if (!isLiveSupervisor(state, stateFile)) throw new Error(`no live browser server recorded in ${options.workerDir}`);
	if (options.token && state.token !== options.token) throw new Error(`the browser server recorded in ${options.workerDir} was started by another run (token mismatch)`);
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
// on SIGTERM, SIGINT, SIGHUP, the TTL, or when its record has not appeared by
// --record-timeout-ms (its starter died), ends any snapshotted process that outlives the
// server, and removes the state file if it is still its own.
function supervise(argv) {
	const option = optionReader(argv);
	const stateFile = option("--state");
	const token = option("--token");
	const graceMs = Number(option("--grace-ms"));
	const recordDeadline = Date.now() + Number(option("--record-timeout-ms"));
	const server = spawn(process.execPath, [__filename, "serve", "--cli", option("--cli"), "--port", option("--port"), "--grace-ms", String(graceMs)], { stdio: ["pipe", "inherit", "inherit"] });
	server.stdin.on("error", () => {});
	const known = new Map();
	const remember = () => {
		if (!server.pid || server.exitCode !== null || server.signalCode !== null) return;
		for (const record of descendants(server.pid)) known.set(`${record.pid} ${record.start}`, record);
	};
	let stopping = false;
	let recorded = false;
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
	const checkRecord = () => {
		if (recorded || stopping) return;
		if (readJson(stateFile)?.token === token) recorded = true;
		else if (Date.now() > recordDeadline) shutdown("no record named this server; its starter died before publishing");
	};
	const snapshots = setInterval(() => {
		remember();
		checkRecord();
	}, SNAPSHOT_MS);
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
// server has not exited a grace period later, it ends its own process tree and exits. A
// watchdog thread covers a main thread that no longer runs (see watchdog).
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
	new Worker(__filename, { workerData: { role: "watchdog", supervisorPid: process.ppid, graceMs } }).unref();
	process.argv = [process.execPath, cli, "run-server", "--host", HOST, "--port", option("--port")];
	require(cli);
}

// A thread in the server process that runs even when the server's main thread hangs. While
// the supervisor lives it snapshots the processes under the server every second. Once the
// supervisor is gone (this process is reparented), it gives the server's own shutdown time
// to finish, then ends every snapshotted and current descendant and SIGKILLs this process.
function watchdog({ supervisorPid, graceMs }) {
	const known = new Map();
	const timer = setInterval(() => {
		if (process.ppid === supervisorPid) {
			for (const record of descendants(process.pid)) known.set(`${record.pid} ${record.start}`, record);
			return;
		}
		clearInterval(timer);
		setTimeout(async () => {
			await endRecorded([...known.values(), ...descendants(process.pid)], graceMs);
			process.kill(process.pid, "SIGKILL");
		}, 2 * graceMs + SNAPSHOT_MS);
	}, SNAPSHOT_MS);
}

async function main(argv) {
	let options;
	try {
		options = parseArgs(argv);
	} catch (error) {
		console.error(`vpk-remote-browser-server: ${error.message}`);
		process.exitCode = 2;
		return;
	}
	try {
		if (options.command === "new-token") {
			process.stdout.write(`${crypto.randomBytes(16).toString("hex")}\n`);
			return;
		}
		if (options.command === "endpoint") {
			process.stdout.write(`${endpoint(options)}\n`);
			return;
		}
		const holdFile = process.env[HOLD_BEFORE_PUBLISH_ENV];
		const hooks = holdFile ? { beforePublish: (state) => {
			fs.writeFileSync(holdFile, JSON.stringify(state));
			return new Promise(() => setInterval(() => {}, 60_000));
		} } : {};
		const result = options.command === "start" ? await start(options, hooks) : await stop(options);
		process.stdout.write(`${JSON.stringify(result)}\n`);
	} catch (error) {
		console.error(`vpk-remote-browser-server: ${error.message}`);
		process.exitCode = 1;
	}
}

if (!isMainThread) {
	if (workerData?.role === "watchdog") watchdog(workerData);
} else if (require.main === module) {
	const [mode, ...rest] = process.argv.slice(2);
	if (mode === "supervise") supervise(rest);
	else if (mode === "serve") serve(rest);
	else main(process.argv.slice(2));
}

module.exports = { LOCK_FILE, LOG_FILE, STATE_FILE, UNRECORDED_GRACE_MS, acquireLock, descendants, endpoint, parseArgs, processStart, resolvePlaywright, start, stop, supervisorsFor };
