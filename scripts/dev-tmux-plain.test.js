const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(repoRoot, "scripts/dev-tmux-plain.sh");
const frontendPortFile = path.join(repoRoot, ".dev-frontend-port");
const backendPortFile = path.join(repoRoot, ".dev-backend-port");

function writeExecutable(filePath, lines) {
	fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
	fs.chmodSync(filePath, 0o755);
}

function withPortFiles(frontendPort, backendPort, callback) {
	const files = [
		[frontendPortFile, frontendPort],
		[backendPortFile, backendPort],
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
	const cleanupLogPath = path.join(tempDir, "cleanup.log");

	writeExecutable(tmuxPath, [
		"#!/usr/bin/env bash",
		"printf '%s\\n' \"$*\" >> \"$FAKE_TMUX_LOG\"",
		"command_name=\"\"",
		"for arg in \"$@\"; do",
		"\tcase \"$arg\" in",
		"\t\thas-session|new-session|send-keys|kill-session)",
		"\t\t\tcommand_name=\"$arg\"",
		"\t\t\tbreak",
		"\t\t\t;;",
		"\tesac",
		"done",
		"if [ \"$command_name\" = \"has-session\" ]; then",
		"\tif [ \"${FAKE_TMUX_HAS_SESSION:-0}\" = \"1\" ]; then",
		"\t\texit 0",
		"\tfi",
		"\texit 1",
		"fi",
		"exit 0",
	]);

	writeExecutable(lsofPath, [
		"#!/usr/bin/env bash",
		"if [ -n \"${FAKE_CWD_PID:-}\" ] && [[ \" $* \" == *\" -d cwd \"* ]] && [[ \" $* \" == *\" -p ${FAKE_CWD_PID} \"* ]]; then",
		"\techo \"n${FAKE_CWD_ROOT}\"",
		"\texit 0",
		"fi",
		"if [ -n \"${FAKE_LISTEN_PORT:-}\" ] && [[ \" $* \" == *\":${FAKE_LISTEN_PORT}\"* ]]; then",
		"\texit 0",
		"fi",
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

	return {
		tempDir,
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
				FAKE_LISTEN_PORT: "49123",
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
