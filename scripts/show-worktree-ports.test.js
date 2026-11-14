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
	collectStackRows,
	listDevSessions,
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

test("ports --json derives each worktree's stack status from its record, sessions and ports", async (t) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "ports-json-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const dir = (name) => {
		const target = path.join(root, name);
		fs.mkdirSync(target);
		return target;
	};
	const main = dir("main");
	const ready = dir("ready");
	const orphan = dir("orphan");
	const idle = dir("idle");
	fs.writeFileSync(path.join(main, ".dev-frontend-port"), "4001");
	fs.writeFileSync(path.join(ready, ".dev-frontend-port"), "4101");
	fs.writeFileSync(path.join(ready, ".dev-backend-port"), "8101");
	fs.writeFileSync(path.join(orphan, ".dev-frontend-port"), "4201");
	const listening = new Set([4101, 8101, 4201]);

	const rows = await collectStackRows({
		worktrees: [
			{ path: main, isMain: true, branch: "main", worktreeName: null },
			{ path: ready, branch: "feature-ready", worktreeName: "feature-ready" },
			{ path: orphan, branch: "feature-orphan", worktreeName: "feature-orphan" },
			{ path: idle, branch: "feature-idle", worktreeName: "feature-idle" },
		],
		routes: [{ hostname: "feature-ready.vpk.localhost", port: 4101, pid: process.pid }],
		sessions: [
			{ name: "vpk-dev-main", socket: "vpk-dev", path: main },
			{ name: "vpk-dev-feature-ready", socket: "vpk-dev", path: ready },
		],
		isPortListening: (port) => listening.has(port),
		// The orphan's port is held by a process in that worktree.
		listenerInWorktree: (port, worktreePath) => listening.has(port) && worktreePath !== idle,
	});

	const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
	assert.deepEqual(Object.keys(byName).sort(), ["main", "orphan", "ready"], "a worktree with no stack is left out");
	assert.equal(byName.main.status, "degraded");
	assert.equal(byName.ready.status, "ready");
	assert.equal(byName.ready.sessionName, "vpk-dev-feature-ready");
	assert.equal(byName.ready.portlessUrl, "https://feature-ready.vpk.localhost");
	assert.deepEqual(byName.ready.backend, { port: 8101, listening: true, listenerInWorktree: true, pid: null, childPid: null });
	assert.equal(byName.orphan.status, "orphaned");
	assert.equal(byName.orphan.nextAction, "stop");
	assert.equal(byName.ready.nextDir, null, "a worktree without .next reports no sizes");
});

test("dev sessions include any name on the private socket, and only vpk-dev-* on the default one", (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ports-sessions-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const tmux = path.join(dir, "tmux");
	fs.writeFileSync(tmux, [
		"#!/bin/sh",
		'if [ "$1" = "-L" ]; then printf "demo|/wt/custom\\nvpk-dev-a|/wt/a\\n"; else printf "vpk-dev-b|/wt/b\\nnotes|/home\\n"; fi',
		"",
	].join("\n"));
	fs.chmodSync(tmux, 0o755);
	const previous = process.env.VPK_TMUX_BIN;
	process.env.VPK_TMUX_BIN = tmux;
	t.after(() => (previous === undefined ? delete process.env.VPK_TMUX_BIN : (process.env.VPK_TMUX_BIN = previous)));
	assert.deepEqual(
		listDevSessions().map(({ name, socket }) => `${socket}:${name}`),
		["vpk-dev:demo", "vpk-dev:vpk-dev-a", "default:vpk-dev-b"],
	);
});

test("ports --json finds a session on a custom socket through the stack record", async (t) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "ports-socket-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	fs.writeFileSync(path.join(root, ".dev-frontend-port"), "4301");
	fs.writeFileSync(path.join(root, ".dev-backend-port"), "8301");
	fs.writeFileSync(path.join(root, ".dev-stack.json"), JSON.stringify({ version: 1, worktree: root, session: { name: "demo", socket: "demo-socket" }, phase: "starting", phaseAt: new Date().toISOString(), services: {} }));
	const probed = [];
	const rows = await collectStackRows({
		worktrees: [{ path: root, branch: "feature-socket", worktreeName: "feature-socket" }],
		routes: [],
		sessions: [],
		isPortListening: () => true,
		listenerInWorktree: () => true,
		isRecordedSessionAlive: (query) => {
			probed.push(query);
			return query.socket === "demo-socket" && query.sessionName === "demo";
		},
	});
	assert.equal(rows[0].status, "ready");
	assert.deepEqual(rows[0].sessions, [{ name: "demo", socket: "demo-socket", path: root }]);
	assert.equal(probed.length, 1);
});

test("ports --json does not call a port held by another directory's process an orphan", async (t) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "ports-held-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	fs.writeFileSync(path.join(root, ".dev-frontend-port"), "4401");
	const rows = await collectStackRows({
		worktrees: [{ path: root, isMain: true, branch: "main", worktreeName: null }],
		routes: [],
		sessions: [],
		isPortListening: () => true,
		listenerInWorktree: () => false,
	});
	assert.notEqual(rows[0].status, "orphaned");
});

test("ports --json counts a frontend that listens only on IPv6 loopback", async (t) => {
	const server = net.createServer();
	const listening = await new Promise((resolve) => {
		server.once("error", () => resolve(false));
		server.listen(0, "::1", () => resolve(true));
	});
	if (!listening) {
		t.skip("no IPv6 loopback on this machine");
		return;
	}
	t.after(() => server.close());
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "ports-ipv6-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	fs.writeFileSync(path.join(root, ".dev-frontend-port"), String(server.address().port));
	const rows = await collectStackRows({
		worktrees: [{ path: root, isMain: true, branch: "main", worktreeName: null }],
		routes: [],
		sessions: [{ name: "vpk-dev-main", socket: "vpk-dev", path: root }],
		listenerInWorktree: () => true,
	});
	assert.equal(rows[0].frontend.listening, true);
});
