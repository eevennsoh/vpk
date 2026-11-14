const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { PRESSURE_SWAP_USED_GB: SWAP } = require("./lib/memory-pressure.js");
// Pressure fixtures follow the sweep's limits, so changing them there breaks no test.
const OVER = SWAP + 13;

const repoRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(repoRoot, "scripts/dev-tmux-plain.sh");
const frontendPortFile = path.join(repoRoot, ".dev-frontend-port");
const backendPortFile = path.join(repoRoot, ".dev-backend-port");
const stackFile = path.join(repoRoot, ".dev-stack.json");
// Ports the fake dev server listens on once a session runs `portless run` (see the fake tmux).
const READY_PORTS = "49150 49151";

function writeExecutable(filePath, lines) {
	fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
	fs.chmodSync(filePath, 0o755);
}

function withPortFiles(frontendPort, backendPort, callback, stackRecord = null) {
	const files = [
		[frontendPortFile, frontendPort],
		[backendPortFile, backendPort],
		[stackFile, stackRecord === null ? null : JSON.stringify(stackRecord)],
	];
	const backups = files.map(([filePath]) => ({
		filePath,
		exists: fs.existsSync(filePath),
		content: fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "",
	}));

	try {
		for (const [filePath, content] of files) {
			if (content === null) {
				fs.rmSync(filePath, { force: true });
			} else {
				fs.writeFileSync(filePath, String(content), "utf8");
			}
		}
		return callback();
	} finally {
		for (const backup of backups) {
			if (backup.exists) {
				fs.writeFileSync(backup.filePath, backup.content, "utf8");
			} else {
				fs.rmSync(backup.filePath, { force: true });
			}
		}
	}
}

function createFakeLauncherEnvironment() {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-tmux-plain-test-"));
	const tmuxPath = path.join(tempDir, "tmux");
	const lsofPath = path.join(tempDir, "lsof");
	const nodePath = path.join(tempDir, "node");
	const pgrepPath = path.join(tempDir, "pgrep");
	const tmuxLogPath = path.join(tempDir, "tmux.log");
	const listenPath = path.join(tempDir, "listening");
	const cleanupLogPath = path.join(tempDir, "cleanup.log");

	// Sessions live in FAKE_TMUX_STATE as `name|start-directory` lines; every launched dev
	// server (a send-keys of `portless run`) is appended to FAKE_SERVER_LOG.
	writeExecutable(tmuxPath, [
		"#!/usr/bin/env bash",
		"printf '%s\\n' \"$*\" >> \"$FAKE_TMUX_LOG\"",
		"state=\"${FAKE_TMUX_STATE:-/dev/null}\"",
		"command_name=\"\"; target=\"\"; dir=\"\"",
		// A launched dev server records its two ports and listens on them.
		"fake_serve() {",
		"\tset -- ${FAKE_READY_PORTS:-}",
		"\t[ \"$#\" -eq 2 ] || return 0",
		"\tprintf '%s' \"$1\" > .dev-frontend-port; printf '%s' \"$2\" > .dev-backend-port",
		"\tprintf '%s %s\\n' \"$1\" \"$2\" >> \"${FAKE_LISTEN_FILE:-/dev/null}\"",
		"}",
		"while [ \"$#\" -gt 0 ]; do",
		"\tcase \"$1\" in",
		"\t\thas-session|new-session|send-keys|kill-session|list-sessions) command_name=\"$1\"; shift ;;",
		"\t\t-t|-s) target=\"$2\"; shift 2 ;;",
		"\t\t-c) dir=\"$2\"; shift 2 ;;",
		"\t\t-L|-F) shift 2 ;;",
		"\t\t*) [ \"$command_name\" = \"send-keys\" ] && case \"$1\" in *\"portless run\"*) echo \"$target\" >> \"${FAKE_SERVER_LOG:-/dev/null}\"; fake_serve ;; esac; shift ;;",
		"\tesac",
		"done",
		"case \"$command_name\" in",
		"\thas-session)",
		"\t\t[ \"${FAKE_TMUX_HAS_SESSION:-0}\" = \"1\" ] && exit 0",
		"\t\tgrep -q \"^${target}|\" \"$state\" 2>/dev/null && exit 0",
		"\t\texit 1 ;;",
		"\tnew-session) printf '%s|%s\\n' \"$target\" \"$dir\" >> \"$state\" ;;",
		"\tkill-session) [ -f \"$state\" ] && { grep -v \"^${target}|\" \"$state\" > \"$state.next\" || true; mv \"$state.next\" \"$state\"; } ;;",
		"\tlist-sessions) [ -f \"$state\" ] && cat \"$state\" ;;",
		"esac",
		"exit 0",
	]);

	writeExecutable(lsofPath, [
		"#!/usr/bin/env bash",
		"if [ -n \"${FAKE_CWD_PID:-}\" ] && [[ \" $* \" == *\" -d cwd \"* ]] && [[ \" $* \" == *\" -p ${FAKE_CWD_PID} \"* ]]; then",
		"\techo \"n${FAKE_CWD_ROOT}\"",
		"\texit 0",
		"fi",
		"for port in ${FAKE_LISTEN_PORT:-} $(cat \"${FAKE_LISTEN_FILE:-/dev/null}\" 2>/dev/null); do",
		"\t[[ \" $* \" == *\":${port} \"* ]] && exit 0",
		"done",
		"exit 1",
	]);

	writeExecutable(pgrepPath, [
		"#!/usr/bin/env bash",
		"if [ -n \"${FAKE_PGREP_PIDS:-}\" ] && [[ \" $* \" == *\"next-server\"* ]]; then",
		"\tprintf '%s\\n' ${FAKE_PGREP_PIDS}",
		"\texit 0",
		"fi",
		"exit 1",
	]);

	writeExecutable(nodePath, [
		"#!/usr/bin/env bash",
		"if [ \"$1\" = \"./scripts/cleanup-worktree-listeners.js\" ]; then",
		"\techo \"$1\" >> \"$NODE_CLEANUP_LOG\"",
		"\texit 0",
		"fi",
		`exec "${process.execPath}" "$@"`,
	]);

	const statePath = path.join(tempDir, "tmux-state");
	const serverLogPath = path.join(tempDir, "servers.log");
	return {
		tempDir,
		statePath,
		serverLogPath,
		sessions: () => (fs.existsSync(statePath) ? fs.readFileSync(statePath, "utf8").split("\n").filter(Boolean) : []),
		serversLaunched: () => (fs.existsSync(serverLogPath) ? fs.readFileSync(serverLogPath, "utf8").split("\n").filter(Boolean) : []),
		writeInventory: (inventory) => {
			const file = path.join(tempDir, `inventory-${Math.random().toString(36).slice(2)}.json`);
			fs.writeFileSync(file, JSON.stringify({ servers: [], swapUsedGb: 0, pressureLevel: 1, ...inventory }));
			return file;
		},
		listenPath,
		tmuxPath,
		tmuxLogPath,
		cleanupLogPath,
		cleanup() {
			fs.rmSync(tempDir, { recursive: true, force: true });
		},
	};
}

function runLauncher(env) {
	return execFileSync(scriptPath, ["start"], {
		cwd: repoRoot,
		encoding: "utf8",
		env: {
			...process.env,
			FAKE_READY_PORTS: READY_PORTS,
			...env,
		},
	});
}

test("dev-tmux plain start reuses a session with a listening frontend port", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		const output = withPortFiles("49123", "49124", () =>
			runLauncher({
				PATH: `${fake.tempDir}:${process.env.PATH}`,
				VPK_TMUX_BIN: fake.tmuxPath,
				VPK_DEV_TMUX_SESSION: "vpk-dev-plain-test",
				VPK_DEV_TMUX_WAIT: "1",
				FAKE_TMUX_HAS_SESSION: "1",
				FAKE_LISTEN_PORT: "49123 49124",
				FAKE_TMUX_LOG: fake.tmuxLogPath,
				NODE_CLEANUP_LOG: fake.cleanupLogPath,
			})
		);

		const tmuxLog = fs.readFileSync(fake.tmuxLogPath, "utf8");
		assert.match(output, /Session 'vpk-dev-plain-test' already running/);
		assert.doesNotMatch(output, /Restarting it/);
		assert.doesNotMatch(tmuxLog, /kill-session/);
		assert.doesNotMatch(tmuxLog, /new-session/);
	} finally {
		fake.cleanup();
	}
});

test("dev-tmux plain start restarts an existing session with no listening frontend port", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		const output = withPortFiles("49125", "49126", () =>
			runLauncher({
				PATH: `${fake.tempDir}:${process.env.PATH}`,
				VPK_TMUX_BIN: fake.tmuxPath,
				VPK_DEV_TMUX_SESSION: "vpk-dev-plain-test",
				VPK_DEV_TMUX_WAIT: "0",
				FAKE_TMUX_HAS_SESSION: "1",
				FAKE_LISTEN_PORT: "",
				FAKE_LISTEN_FILE: fake.listenPath,
				FAKE_TMUX_LOG: fake.tmuxLogPath,
				NODE_CLEANUP_LOG: fake.cleanupLogPath,
			})
		);

		const tmuxLog = fs.readFileSync(fake.tmuxLogPath, "utf8");
		assert.match(output, /has no listening frontend port\. Restarting it/);
		assert.match(output, /Stopped tmux session 'vpk-dev-plain-test'/);
		assert.match(output, /Started tmux session 'vpk-dev-plain-test'/);
		assert.match(tmuxLog, /send-keys .* C-c/);
		assert.match(tmuxLog, /kill-session/);
		assert.match(tmuxLog, /new-session/);
		assert.equal(
			fs.readFileSync(fake.cleanupLogPath, "utf8").trim(),
			"./scripts/cleanup-worktree-listeners.js"
		);
	} finally {
		fake.cleanup();
	}
});

test("dev-tmux plain start does not warn about other running stacks", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		const result = withPortFiles("49127", "49128", () =>
			spawnSync(scriptPath, ["start"], {
				cwd: repoRoot,
				encoding: "utf8",
				env: {
					...process.env,
					PATH: `${fake.tempDir}:${process.env.PATH}`,
					VPK_TMUX_BIN: fake.tmuxPath,
					VPK_DEV_TMUX_SESSION: "vpk-dev-plain-test",
					VPK_DEV_TMUX_WAIT: "0",
					VPK_DEV_STACK_WARN: "1",
					FAKE_READY_PORTS: READY_PORTS,
					FAKE_LISTEN_FILE: fake.listenPath,
					FAKE_TMUX_STATE: fake.statePath,
					VPK_DEV_STACK_INVENTORY: fake.writeInventory({ servers: [{ pid: 12345, cwd: "/tmp/other-project", cpu: 1 }] }),
					FAKE_TMUX_HAS_SESSION: "0",
					FAKE_PGREP_PIDS: "12345",
					FAKE_CWD_PID: "12345",
					FAKE_CWD_ROOT: "/tmp/other-project",
					FAKE_TMUX_LOG: fake.tmuxLogPath,
					NODE_CLEANUP_LOG: fake.cleanupLogPath,
				},
			})
		);

		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /Started tmux session 'vpk-dev-plain-test'/);
		assert.doesNotMatch(result.stderr, /other VPK dev stack/);
	} finally {
		fake.cleanup();
	}
});

// R-1: one stack per worktree path, and a budget before a new stack starts. tmux, the dev
// server and the machine inventory are all fakes; no real stack starts.
function startAs(fake, sessionName, extraEnv = {}, args = ["start"]) {
	return spawnSync(scriptPath, args, {
		cwd: repoRoot,
		encoding: "utf8",
		env: {
			...process.env,
			PATH: `${fake.tempDir}:${process.env.PATH}`,
			VPK_TMUX_BIN: fake.tmuxPath,
			VPK_DEV_TMUX_SESSION: sessionName,
			VPK_DEV_TMUX_WAIT: "0",
			VPK_DEV_STACK_INVENTORY: fake.writeInventory({}),
			FAKE_READY_PORTS: READY_PORTS,
			FAKE_LISTEN_FILE: fake.listenPath,
			FAKE_TMUX_STATE: fake.statePath,
			FAKE_SERVER_LOG: fake.serverLogPath,
			FAKE_TMUX_LOG: fake.tmuxLogPath,
			NODE_CLEANUP_LOG: fake.cleanupLogPath,
			...extraEnv,
		},
	});
}

// The first start launched a server that is now listening on the recorded port.
function serveFrontend(port) {
	fs.writeFileSync(frontendPortFile, port, "utf8");
	return { FAKE_LISTEN_PORT: port };
}

test("starting twice in one worktree under the same name ends with one session and one server", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		withPortFiles(null, null, () => {
			const first = startAs(fake, "vpk-dev-branch-a");
			assert.equal(first.status, 0, first.stderr);
			const second = startAs(fake, "vpk-dev-branch-a", serveFrontend("49131"));
			assert.equal(second.status, 0, second.stderr);
			assert.match(second.stdout, /Session 'vpk-dev-branch-a' already running/);
		});
		assert.deepEqual(fake.sessions(), [`vpk-dev-branch-a|${repoRoot}`]);
		assert.deepEqual(fake.serversLaunched(), ["vpk-dev-branch-a"]);
	} finally {
		fake.cleanup();
	}
});

test("a start after the branch is renamed adopts the worktree's session instead of starting a second", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		withPortFiles(null, null, () => {
			const first = startAs(fake, "vpk-dev-branch-a");
			assert.equal(first.status, 0, first.stderr);
			const renamed = startAs(fake, "vpk-dev-branch-b", serveFrontend("49132"));
			assert.equal(renamed.status, 0, renamed.stderr);
			assert.match(renamed.stdout, /Adopting tmux session 'vpk-dev-branch-a' for this worktree/);
			assert.match(renamed.stdout, /Session 'vpk-dev-branch-a' already running/);
		});
		assert.deepEqual(fake.sessions(), [`vpk-dev-branch-a|${repoRoot}`]);
		assert.deepEqual(fake.serversLaunched(), ["vpk-dev-branch-a"]);
	} finally {
		fake.cleanup();
	}
});

test("a worktree with a directory-named and a branch-named session keeps one and stops the other", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		fs.writeFileSync(fake.statePath, `vpk-dev-e736|${repoRoot}\nvpk-dev-feature-x|${repoRoot}\nvpk-dev-elsewhere|/tmp/other-worktree\n`);
		const result = withPortFiles("49133", "49134", () => startAs(fake, "vpk-dev-feature-x", { FAKE_LISTEN_PORT: "49133 49134" }));
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /Stopping duplicate tmux session 'vpk-dev-e736' for this worktree/);
		assert.deepEqual(fake.sessions(), [`vpk-dev-feature-x|${repoRoot}`, "vpk-dev-elsewhere|/tmp/other-worktree"]);
		assert.deepEqual(fake.serversLaunched(), []);
	} finally {
		fake.cleanup();
	}
});

test("stop stops every session that belongs to this worktree", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		fs.writeFileSync(fake.statePath, `vpk-dev-e736|${repoRoot}\nvpk-dev-feature-x|${repoRoot}\nvpk-dev-elsewhere|/tmp/other-worktree\n`);
		const result = withPortFiles(null, null, () => startAs(fake, "vpk-dev-feature-x", {}, ["stop"]));
		assert.equal(result.status, 0, result.stderr);
		assert.deepEqual(fake.sessions(), ["vpk-dev-elsewhere|/tmp/other-worktree"]);
	} finally {
		fake.cleanup();
	}
});

test("over the stack budget a start refuses, lists the live stacks, and --force overrides", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		const inventory = fake.writeInventory({
			servers: [
				{ pid: 901, cwd: "/tmp/wt-one", cpu: 2 },
				{ pid: 902, cwd: "/tmp/wt-two", cpu: 150 },
				{ pid: 903, cwd: "/tmp/wt-three", cpu: 0.4 },
				{ pid: 904, cwd: "/tmp/wt-four", cpu: 1 },
			],
		});
		withPortFiles(null, null, () => {
			const refused = startAs(fake, "vpk-dev-new", { VPK_DEV_STACK_INVENTORY: inventory });
			assert.equal(refused.status, 3);
			assert.match(refused.stderr, /Not starting: 4 dev stacks already run; starting this one would make 5 > budget 4/);
			assert.match(refused.stderr, /quiet {2}\/tmp\/wt-one {2}\(pid 901 2%\)/);
			assert.match(refused.stderr, /busy {3}\/tmp\/wt-two/);
			assert.match(refused.stderr, /no live task seen; stop: \(cd '\/(?:private\/)?tmp\/wt-three' && pnpm run dev:tmux:stop\)/);
			assert.match(refused.stderr, /pnpm run dev:tmux:start -- --force/);
			assert.deepEqual(fake.sessions(), []);

			const forced = startAs(fake, "vpk-dev-new", { VPK_DEV_STACK_INVENTORY: inventory }, ["start", "--", "--force"]);
			assert.equal(forced.status, 0, forced.stderr);
			assert.match(forced.stderr, /Starting anyway \(--force\)/);
		});
		assert.deepEqual(fake.sessions(), [`vpk-dev-new|${repoRoot}`]);
	} finally {
		fake.cleanup();
	}
});

test("under memory pressure a start refuses within the stack budget while another stack runs, and warns when none does", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		const crowded = fake.writeInventory({ swapUsedGb: OVER, servers: [{ pid: 905, cwd: "/tmp/wt-other", cpu: 1 }] });
		const refused = withPortFiles(null, null, () => startAs(fake, "vpk-dev-new", { VPK_DEV_STACK_INVENTORY: crowded }));
		assert.equal(refused.status, 3);
		assert.match(refused.stderr, new RegExp(`swap in use is ${OVER} GB >= ${SWAP} GB`));
		assert.deepEqual(fake.sessions(), []);

		const alone = withPortFiles(null, null, () => startAs(fake, "vpk-dev-new", { VPK_DEV_STACK_INVENTORY: fake.writeInventory({ swapUsedGb: OVER }) }));
		assert.equal(alone.status, 0, alone.stderr);
		assert.match(alone.stderr, new RegExp(`Warning: memory pressure \\(swap in use is ${OVER} GB >= ${SWAP} GB\\), but no other dev stack runs; starting`));
		assert.deepEqual(fake.sessions(), [`vpk-dev-new|${repoRoot}`]);
	} finally {
		fake.cleanup();
	}
});

test("a next-server already serving this worktree outside tmux blocks a second one, even with --force", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		const inventory = fake.writeInventory({ servers: [{ pid: 777, cwd: repoRoot, cpu: 3 }] });
		const result = withPortFiles(null, null, () => startAs(fake, "vpk-dev-new", { VPK_DEV_STACK_INVENTORY: inventory }, ["start", "--force"]));
		assert.equal(result.status, 4);
		assert.match(result.stderr, /A next-server already serves this worktree outside its tmux session: pid 777/);
		assert.deepEqual(fake.sessions(), []);
		assert.deepEqual(fake.serversLaunched(), []);
	} finally {
		fake.cleanup();
	}
});

test("restarting a session whose frontend died still checks the budget", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		fs.writeFileSync(fake.statePath, `vpk-dev-stale|${repoRoot}\n`);
		const inventory = fake.writeInventory({ swapUsedGb: OVER, servers: [{ pid: 906, cwd: "/tmp/wt-other", cpu: 1 }] });
		const result = withPortFiles(null, null, () => startAs(fake, "vpk-dev-stale", { VPK_DEV_STACK_INVENTORY: inventory }));
		assert.equal(result.status, 3);
		assert.match(result.stdout, /exists but has no listening frontend port\. Restarting it/);
		assert.match(result.stderr, new RegExp(`Not starting: swap in use is ${OVER} GB >= ${SWAP} GB`));
		assert.deepEqual(fake.sessions(), [], "the dead session was stopped and nothing replaced it");
		assert.deepEqual(fake.serversLaunched(), []);
	} finally {
		fake.cleanup();
	}
});

test("start ends with the URL to open: the Portless route when one exists, else localhost", () => {
	const fake = createFakeLauncherEnvironment();
	const env = {
		PATH: `${fake.tempDir}:${process.env.PATH}`,
		VPK_TMUX_BIN: fake.tmuxPath,
		VPK_DEV_TMUX_SESSION: "vpk-dev-plain-url-test",
		VPK_DEV_TMUX_WAIT: "1",
		FAKE_TMUX_HAS_SESSION: "1",
		FAKE_LISTEN_PORT: "49127 49128",
		FAKE_TMUX_LOG: fake.tmuxLogPath,
		NODE_CLEANUP_LOG: fake.cleanupLogPath,
		// Portless routes are read from ~/.portless/routes.json.
		HOME: fake.tempDir,
	};
	try {
		const lastLine = (output) => output.trimEnd().split("\n").at(-1);
		const localhost = withPortFiles("49127", "49128", () => runLauncher(env));
		assert.equal(lastLine(localhost), "http://localhost:49127");

		fs.mkdirSync(path.join(fake.tempDir, ".portless"), { recursive: true });
		fs.writeFileSync(
			path.join(fake.tempDir, ".portless", "routes.json"),
			JSON.stringify([{ hostname: "plain-url-test.vpk.localhost", port: 49127, pid: process.pid }]),
		);
		const routed = withPortFiles("49127", "49128", () => runLauncher(env));
		assert.equal(lastLine(routed), "https://plain-url-test.vpk.localhost");
	} finally {
		fake.cleanup();
	}
});

test("a launched session copies its pane output to the worktree's dev log and keeps one previous run", () => {
	const fake = createFakeLauncherEnvironment();
	const logDir = path.join(fake.tempDir, "logs");
	fs.mkdirSync(logDir, { recursive: true });
	fs.writeFileSync(path.join(logDir, "dev.log"), "last run\n");
	try {
		const output = withPortFiles(null, null, () =>
			runLauncher({
				PATH: `${fake.tempDir}:${process.env.PATH}`,
				VPK_TMUX_BIN: fake.tmuxPath,
				VPK_DEV_TMUX_SESSION: "vpk-dev-plain-log-test",
				VPK_DEV_TMUX_WAIT: "0",
				VPK_DEV_LOG_DIR: logDir,
				FAKE_LISTEN_FILE: fake.listenPath,
				FAKE_TMUX_STATE: fake.statePath,
				FAKE_SERVER_LOG: fake.serverLogPath,
				FAKE_TMUX_LOG: fake.tmuxLogPath,
				NODE_CLEANUP_LOG: fake.cleanupLogPath,
			})
		);

		const tmuxLog = fs.readFileSync(fake.tmuxLogPath, "utf8");
		const pipe = tmuxLog.split("\n").find((line) => line.startsWith("-L vpk-dev pipe-pane -t vpk-dev-plain-log-test -o ")) ?? "";
		assert.ok(pipe.includes(`'${path.join(repoRoot, "scripts/lib/dev-log-filter.js")}' --out '${path.join(logDir, "dev.log")}' --max-bytes '20971520'`), tmuxLog);
		assert.equal(fs.readFileSync(path.join(logDir, "dev.previous.log"), "utf8"), "last run\n");
		assert.equal(fs.existsSync(path.join(logDir, "dev.log")), false, "the fake pane wrote nothing yet");
		assert.ok(output.includes(`Logs:        ${path.join(logDir, "dev.log")}`), output);
		assert.deepEqual(fake.serversLaunched(), ["vpk-dev-plain-log-test"]);
	} finally {
		fake.cleanup();
	}
});

// SM-BT-1: start succeeds only when the stack is ready; stop ends the recorded processes; status
// is derived from the record, the session and the ports.
test("start exits 5 when the dev server never listens, and names the state", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		const result = withPortFiles(null, null, () => startAs(fake, "vpk-dev-never-ready", { FAKE_READY_PORTS: "" }));
		assert.equal(result.status, 5, result.stderr);
		assert.match(result.stderr, /Not ready: (starting|degraded) \(waiting for frontend and backend|Not ready: degraded/);
		assert.match(result.stdout, /The dev stack is not ready/);
		assert.doesNotMatch(result.stdout, /http:\/\/localhost/);
	} finally {
		fake.cleanup();
	}
});

test("a running session is not ready while its backend does not listen", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		const result = withPortFiles("49141", "49142", () =>
			startAs(fake, "vpk-dev-half", { FAKE_TMUX_HAS_SESSION: "1", FAKE_LISTEN_PORT: "49141" }),
		);
		assert.equal(result.status, 5);
		assert.match(result.stdout, /Session 'vpk-dev-half' already running/);
		assert.match(result.stderr, /Not ready: degraded \(backend not listening\)/);
	} finally {
		fake.cleanup();
	}
});

test("status --json reports the derived state, not only whether the session exists", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		const status = (env) => {
			const result = startAs(fake, "vpk-dev-status", env, ["status", "--json"]);
			assert.equal(result.status, 0, result.stderr);
			return JSON.parse(result.stdout);
		};
		const half = withPortFiles("49143", "49144", () => status({ FAKE_TMUX_HAS_SESSION: "1", FAKE_LISTEN_PORT: "49143" }));
		assert.equal(half.status, "degraded");
		assert.equal(half.nextAction, "restart");
		assert.equal(half.services.frontend.port, 49143);
		const ready = withPortFiles("49143", "49144", () => status({ FAKE_TMUX_HAS_SESSION: "1", FAKE_LISTEN_PORT: "49143 49144" }));
		assert.equal(ready.status, "ready");
		const absent = withPortFiles(null, null, () => status({}));
		assert.equal(absent.status, "absent");
	} finally {
		fake.cleanup();
	}
});

function recordedStack(frontendPid) {
	return {
		version: 1,
		worktree: repoRoot,
		session: { name: "vpk-dev-recorded", socket: "vpk-dev" },
		phase: "starting",
		phaseAt: new Date().toISOString(),
		services: { frontend: { port: 49145, pid: frontendPid, childPid: null } },
	};
}

test("stop ends the recorded service processes before it kills the session", async (t) => {
	const { spawnInGroup } = require("./lib/test-process.js");
	const fake = createFakeLauncherEnvironment();
	try {
		// Stands in for a launcher that ignores Ctrl-C (the fake tmux delivers none) but exits on SIGTERM.
		const server = spawnInGroup("sleep", ["300"], { stdio: "ignore" }, { t });
		const exited = new Promise((resolve) => server.once("exit", (_code, signal) => resolve(signal)));
		fs.writeFileSync(fake.statePath, `vpk-dev-recorded|${repoRoot}\n`);
		const result = withPortFiles("49145", null, () =>
			startAs(fake, "vpk-dev-recorded", { FAKE_CWD_PID: String(server.pid), FAKE_CWD_ROOT: repoRoot, VPK_DEV_STOP_WAIT_MS: "200" }, ["stop"]),
		recordedStack(server.pid));
		assert.equal(result.status, 0, result.stderr);
		assert.equal(await exited, "SIGTERM");
		const recorded = result.stdout.indexOf("Recorded processes: 0 exited after Ctrl-C, 1 after SIGTERM, 0 needed SIGKILL");
		assert.ok(recorded >= 0, result.stdout);
		assert.ok(recorded < result.stdout.indexOf("Stopped tmux session 'vpk-dev-recorded'"), result.stdout);
		assert.deepEqual(fake.sessions(), []);
	} finally {
		fake.cleanup();
	}
});

test("stop never signals the caller's own process tree, even when the record names it", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		// This test process is an ancestor of the stop, as an agent session running it would be.
		fs.writeFileSync(fake.statePath, `vpk-dev-recorded|${repoRoot}\n`);
		const result = withPortFiles("49145", null, () =>
			startAs(fake, "vpk-dev-recorded", { FAKE_CWD_PID: String(process.pid), FAKE_CWD_ROOT: repoRoot, VPK_DEV_STOP_WAIT_MS: "0" }, ["stop"]),
		recordedStack(process.pid));
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, new RegExp(`Not signalling ${process.pid}: the caller's own process tree`));
		assert.doesNotMatch(result.stdout, /Recorded processes:/);
	} finally {
		fake.cleanup();
	}
});

test("status --json stays valid JSON when the worktree's session is adopted under another name", () => {
	const fake = createFakeLauncherEnvironment();
	try {
		fs.writeFileSync(fake.statePath, `vpk-dev-old-branch|${repoRoot}\n`);
		const result = withPortFiles(null, null, () => startAs(fake, "vpk-dev-new-branch", {}, ["status", "--json"]));
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stderr, /Adopting tmux session 'vpk-dev-old-branch'/);
		const report = JSON.parse(result.stdout);
		assert.equal(report.sessionAlive, true);
	} finally {
		fake.cleanup();
	}
});
