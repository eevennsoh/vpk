const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SHOW_WORKTREE_PORTS_SCRIPT = path.resolve(__dirname, "show-worktree-ports.js");
const {
	browserUrlForRow,
	dashboardRowsSignature,
	defaultBrowserCommand,
	moveSelectionIndex,
	reconcileSelectionIndex,
} = require("./show-worktree-ports");

function execGit(args, cwd) {
	execFileSync("git", args, {
		cwd,
		stdio: "ignore",
	});
}

function createGitWorktreeFixture() {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "show-worktree-ports-"));
	const repoPath = path.join(tempDir, "repo");
	const worktreePath = path.join(tempDir, "wt-pool");

	try {
		execGit(["init", repoPath], tempDir);
		execGit(["config", "user.email", "test@example.com"], repoPath);
		execGit(["config", "user.name", "test"], repoPath);

		fs.writeFileSync(path.join(repoPath, "README.md"), "fixture\n", "utf8");
		execGit(["add", "README.md"], repoPath);
		execGit(["commit", "-m", "init"], repoPath);
		execGit(["branch", "feature-pool"], repoPath);
		execGit(["worktree", "add", worktreePath, "feature-pool"], repoPath);

		return {
			repoPath,
			worktreePath,
			cleanup() {
				fs.rmSync(tempDir, { recursive: true, force: true });
			},
		};
	} catch (error) {
		fs.rmSync(tempDir, { recursive: true, force: true });
		throw error;
	}
}

function listenOnEphemeralPort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Failed to bind ephemeral port"));
				return;
			}
			resolve({ server, port: address.port });
		});
	});
}

function closeServer(server) {
	return new Promise((resolve) => {
		server.close(() => resolve());
	});
}

test("interactive selection wraps around the worktree list", () => {
	assert.equal(moveSelectionIndex(0, -1, 3), 2);
	assert.equal(moveSelectionIndex(2, 1, 3), 0);
	assert.equal(moveSelectionIndex(-1, 1, 3), 1);
	assert.equal(moveSelectionIndex(0, 1, 0), -1);
});

test("interactive refresh preserves the selected worktree by path", () => {
	const rows = [
		{ wt: { path: "/repo/main" } },
		{ wt: { path: "/repo/new" } },
		{ wt: { path: "/repo/selected" } },
	];

	assert.equal(reconcileSelectionIndex(rows, "/repo/selected", 0), 2);
	assert.equal(reconcileSelectionIndex(rows, "/repo/removed", 9), 2);
	assert.equal(reconcileSelectionIndex([], "/repo/selected", 0), -1);
});

test("watch refresh detects meaningful dashboard row changes", () => {
	const row = {
		wt: { path: "/repo/main", branch: "main", identifier: "main" },
		name: "repo",
		isMain: true,
		hasRecordedPorts: true,
		isRunning: true,
		runningFrontend: "4484",
		runningBackend: "8080",
		runningRovo: null,
		portlessUrl: "https://repo.localhost",
	};

	assert.equal(dashboardRowsSignature([row]), dashboardRowsSignature([{ ...row }]));
	assert.notEqual(
		dashboardRowsSignature([row]),
		dashboardRowsSignature([{ ...row, runningFrontend: "4485" }]),
	);
});

test("interactive open prefers the Portless URL and falls back to the live frontend", () => {
	assert.equal(
		browserUrlForRow({
			portlessUrl: "https://feature.example-project.localhost",
			runningFrontend: "4321",
		}),
		"https://feature.example-project.localhost",
	);
	assert.equal(browserUrlForRow({ portlessUrl: null, runningFrontend: "4321" }), "http://localhost:4321");
	assert.equal(browserUrlForRow({ portlessUrl: null, runningFrontend: null }), null);
});

test("interactive open uses the platform default-browser command", () => {
	const url = "https://example-project.localhost";
	assert.deepEqual(defaultBrowserCommand(url, "darwin"), { command: "open", args: [url] });
	assert.deepEqual(defaultBrowserCommand(url, "linux"), { command: "xdg-open", args: [url] });
	assert.deepEqual(defaultBrowserCommand(url, "win32"), {
		command: "cmd",
		args: ["/c", "start", "", url],
	});
});

test("ports CLI shows pool ports that are actually listening", async () => {
	const fixture = createGitWorktreeFixture();
	const { server: alive, port: alivePort } = await listenOnEphemeralPort();

	try {
		fs.writeFileSync(
			path.join(fixture.worktreePath, ".dev-rovo-ports"),
			JSON.stringify([alivePort]),
			"utf8",
		);

		const output = execFileSync(process.execPath, [SHOW_WORKTREE_PORTS_SCRIPT], {
			cwd: fixture.repoPath,
			encoding: "utf8",
		});

		assert.match(output, /feature-pool/);
		assert.match(output, new RegExp(`rovo=${alivePort}\\b`));
	} finally {
		await closeServer(alive);
		fixture.cleanup();
	}
});

test("ports CLI shows (no active ports) when port files are stale tombstones", async () => {
	const fixture = createGitWorktreeFixture();

	try {
		// Tombstones for ports nothing is listening on. Use values in the unlikely-to-be-bound
		// reserved/private range so the test stays deterministic on dev machines.
		fs.writeFileSync(path.join(fixture.worktreePath, ".dev-frontend-port"), "1", "utf8");
		fs.writeFileSync(path.join(fixture.worktreePath, ".dev-backend-port"), "2", "utf8");
		fs.writeFileSync(
			path.join(fixture.worktreePath, ".dev-rovo-ports"),
			JSON.stringify([3, 4]),
			"utf8",
		);

		const output = execFileSync(process.execPath, [SHOW_WORKTREE_PORTS_SCRIPT], {
			cwd: fixture.repoPath,
			encoding: "utf8",
		});

		assert.match(output, /feature-pool/, "worktree row should still appear");
		assert.match(output, /\(no active ports\)/, "should fall back to the no-ports label");
		assert.doesNotMatch(output, /frontend=1\b/, "stale frontend port must not appear");
		assert.doesNotMatch(output, /backend=2\b/, "stale backend port must not appear");
		assert.doesNotMatch(output, /rovo=3\b/, "stale rovo pool ports must not appear");
	} finally {
		fixture.cleanup();
	}
});

test("ports CLI shows a mix of alive and dead pool ports as only the alive ones", async () => {
	const fixture = createGitWorktreeFixture();
	const { server: alive, port: alivePort } = await listenOnEphemeralPort();
	// Pick a dead port that's deterministically unbound for the test's lifetime by
	// binding then immediately closing.
	const { server: deadHolder, port: deadPort } = await listenOnEphemeralPort();
	await closeServer(deadHolder);

	try {
		fs.writeFileSync(
			path.join(fixture.worktreePath, ".dev-rovo-ports"),
			JSON.stringify([alivePort, deadPort]),
			"utf8",
		);

		const output = execFileSync(process.execPath, [SHOW_WORKTREE_PORTS_SCRIPT], {
			cwd: fixture.repoPath,
			encoding: "utf8",
		});

		assert.match(output, new RegExp(`rovo=${alivePort}\\b`));
		assert.doesNotMatch(output, new RegExp(`\\b${deadPort}\\b`));
	} finally {
		await closeServer(alive);
		fixture.cleanup();
	}
});

test("ports kill resolves a legacy private session and rejects an unsafe default-socket stop", () => {
	const fixture = createGitWorktreeFixture();
	const fakeTmuxPath = path.join(fixture.repoPath, "fake-tmux");
	const stopScriptPath = path.join(fixture.worktreePath, "scripts", "dev-tmux-plain.sh");
	const stopResultPath = path.join(fixture.worktreePath, "stop-result");

	try {
		fs.mkdirSync(path.dirname(stopScriptPath), { recursive: true });
		fs.writeFileSync(
			fakeTmuxPath,
			`#!/usr/bin/env node\nif (process.argv[2] === "-L" && process.argv[3] === "vpk-dev") {\n\tprocess.stdout.write(${JSON.stringify(`vpk-dev-cursor-legacy|${fixture.worktreePath}\n`)});\n\tprocess.exit(0);\n}\nprocess.exit(1);\n`,
			"utf8",
		);
		fs.chmodSync(fakeTmuxPath, 0o755);
		fs.writeFileSync(
			stopScriptPath,
			'#!/bin/bash\nprintf "%s|%s\\n" "$VPK_DEV_TMUX_SESSION" "$VPK_TMUX_SOCKET" > stop-result\n',
			"utf8",
		);

		execFileSync(process.execPath, [SHOW_WORKTREE_PORTS_SCRIPT, "kill", "feature-pool"], {
			cwd: fixture.repoPath,
			env: { ...process.env, VPK_TMUX_BIN: fakeTmuxPath },
			encoding: "utf8",
		});

		assert.equal(fs.readFileSync(stopResultPath, "utf8"), "vpk-dev-cursor-legacy|vpk-dev\n");

		fs.unlinkSync(stopResultPath);
		fs.writeFileSync(
			fakeTmuxPath,
			`#!/usr/bin/env node\nif (process.argv[2] === "list-sessions") {\n\tprocess.stdout.write(${JSON.stringify(`vpk-dev-cursor-legacy|${fixture.worktreePath}\n`)});\n\tprocess.exit(0);\n}\nprocess.exit(1);\n`,
			"utf8",
		);
		const legacyResult = spawnSync(process.execPath, [SHOW_WORKTREE_PORTS_SCRIPT, "kill", "feature-pool"], {
			cwd: fixture.repoPath,
			env: { ...process.env, VPK_TMUX_BIN: fakeTmuxPath },
			encoding: "utf8",
		});
		assert.equal(legacyResult.status, 2);
		assert.match(legacyResult.stderr, /default socket/);
		assert.equal(fs.existsSync(stopResultPath), false);

		fs.writeFileSync(
			fakeTmuxPath,
			'#!/usr/bin/env node\nprocess.stderr.write("Operation not permitted\\n");\nprocess.exit(1);\n',
			"utf8",
		);
		const deniedResult = spawnSync(process.execPath, [SHOW_WORKTREE_PORTS_SCRIPT, "kill", "feature-pool"], {
			cwd: fixture.repoPath,
			env: { ...process.env, VPK_TMUX_BIN: fakeTmuxPath },
			encoding: "utf8",
		});
		assert.equal(deniedResult.status, 2);
		assert.match(deniedResult.stderr, /Could not inspect tmux/);
		assert.equal(fs.existsSync(stopResultPath), false);
	} finally {
		fixture.cleanup();
	}
});
