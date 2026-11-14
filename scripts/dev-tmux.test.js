const assert = require("node:assert/strict");
const http = require("node:http");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
	findAvailableRovoPorts,
	waitForRovoPortsHealthy,
} = require("./lib/dev-tmux-ports");
const { checkRovoHealth } = require("./lib/rovo-utils");

const repoRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(repoRoot, "scripts/dev-tmux.sh");

test("dev-tmux accepts pnpm passthrough args with a leading double dash", () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-tmux-test-"));
	const tmuxPath = path.join(tempDir, "tmux");

	fs.writeFileSync(
		tmuxPath,
		[
			"#!/usr/bin/env bash",
			"",
			"if [ \"$1\" = \"has-session\" ]; then",
			"\texit 1",
			"fi",
			"",
			"echo \"unexpected tmux invocation: $*\" >&2",
			"exit 1",
			"",
		].join("\n"),
		"utf8"
	);
	fs.chmodSync(tmuxPath, 0o755);

	const output = execFileSync(scriptPath, ["--", "status"], {
		cwd: repoRoot,
		encoding: "utf8",
		env: {
			...process.env,
			PATH: `${tempDir}:${process.env.PATH}`,
			ROVO_BILLING_URL: "https://example.invalid",
		},
	});

	assert.match(output, /Session:/);
	assert.match(output, /tmux: stopped/);

	fs.rmSync(tempDir, { recursive: true, force: true });
});

test("dev-tmux accepts explicit command with numeric pool size", () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-tmux-start-test-"));
	const tmuxPath = path.join(tempDir, "tmux");

	fs.writeFileSync(
		tmuxPath,
		[
			"#!/usr/bin/env bash",
			"",
			"if [ \"$1\" = \"has-session\" ]; then",
			"\texit 1",
			"fi",
			"",
			"echo \"unexpected tmux invocation: $*\" >&2",
			"exit 1",
			"",
		].join("\n"),
		"utf8"
	);
	fs.chmodSync(tmuxPath, 0o755);

	const output = execFileSync(scriptPath, ["status", "6"], {
		cwd: repoRoot,
		encoding: "utf8",
		env: {
			...process.env,
			PATH: `${tempDir}:${process.env.PATH}`,
			ROVO_BILLING_URL: "https://example.invalid",
		},
	});

	assert.match(output, /Session:/);
	assert.match(output, /tmux: stopped/);

	fs.rmSync(tempDir, { recursive: true, force: true });
});

test("dev-tmux accepts shorthand double-dash pool size syntax", () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-tmux-shorthand-test-"));
	const tmuxPath = path.join(tempDir, "tmux");

	fs.writeFileSync(
		tmuxPath,
		[
			"#!/usr/bin/env bash",
			"",
			"if [ \"$1\" = \"has-session\" ]; then",
			"\texit 1",
			"fi",
			"",
			"echo \"unexpected tmux invocation: $*\" >&2",
			"exit 1",
			"",
		].join("\n"),
		"utf8"
	);
	fs.chmodSync(tmuxPath, 0o755);

	const output = execFileSync(scriptPath, ["status", "--1"], {
		cwd: repoRoot,
		encoding: "utf8",
		env: {
			...process.env,
			PATH: `${tempDir}:${process.env.PATH}`,
			ROVO_BILLING_URL: "https://example.invalid",
		},
	});

	assert.match(output, /Session:/);
	assert.match(output, /tmux: stopped/);

	fs.rmSync(tempDir, { recursive: true, force: true });
});

test("dev-tmux stop invokes worktree listener cleanup", () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-tmux-stop-test-"));
	const tmuxPath = path.join(tempDir, "tmux");
	const nodePath = path.join(tempDir, "node");
	const cleanupLogPath = path.join(tempDir, "cleanup.log");

	fs.writeFileSync(
		tmuxPath,
		[
			"#!/usr/bin/env bash",
			"",
			"if [ \"$1\" = \"has-session\" ]; then",
			"\texit 1",
			"fi",
			"",
			"echo \"unexpected tmux invocation: $*\" >&2",
			"exit 1",
			"",
		].join("\n"),
		"utf8"
	);
	fs.chmodSync(tmuxPath, 0o755);

	fs.writeFileSync(
		nodePath,
		[
			"#!/usr/bin/env bash",
			"",
			"if [ \"$1\" = \"./scripts/cleanup-worktree-listeners.js\" ]; then",
			"\techo \"$1\" >> \"$NODE_CLEANUP_LOG\"",
			"\texit 0",
			"fi",
			"",
			`exec "${process.execPath}" "$@"`,
			"",
		].join("\n"),
		"utf8"
	);
	fs.chmodSync(nodePath, 0o755);

	const output = execFileSync(scriptPath, ["stop"], {
		cwd: repoRoot,
		encoding: "utf8",
		env: {
			...process.env,
			PATH: `${tempDir}:${process.env.PATH}`,
			NODE_CLEANUP_LOG: cleanupLogPath,
			ROVO_BILLING_URL: "https://example.invalid",
		},
	});

	assert.match(output, /No tmux session named/);
	assert.equal(
		fs.readFileSync(cleanupLogPath, "utf8").trim(),
		"./scripts/cleanup-worktree-listeners.js"
	);

	fs.rmSync(tempDir, { recursive: true, force: true });
});

test("findAvailableRovoPorts skips occupied reserved ports", async () => {
	const ports = await findAvailableRovoPorts({
		basePort: 8002,
		poolSize: 3,
		maxTries: 6,
		isPortAvailableFn: async (port) => ![8002, 8004].includes(port),
	});

	assert.deepEqual(ports, [8003, 8005, 8006]);
});

test("waitForRovoPortsHealthy retries until every reserved port is healthy", async () => {
	const attemptsByPort = new Map();

	const results = await waitForRovoPortsHealthy({
		ports: [8000, 8001],
		maxAttempts: 4,
		intervalMs: 0,
		checkRovoHealthFn: async (port) => {
			const nextAttempt = (attemptsByPort.get(port) ?? 0) + 1;
			attemptsByPort.set(port, nextAttempt);

			return {
				healthy: nextAttempt >= 2,
				status: nextAttempt >= 2 ? "healthy" : "starting",
				mcpServers: null,
			};
		},
	});

	assert.deepEqual(
		results.map(({ port, health }) => [port, health.status]),
		[
			[8000, "healthy"],
			[8001, "healthy"],
		]
	);
	assert.equal(attemptsByPort.get(8000), 2);
	assert.equal(attemptsByPort.get(8001), 2);
});

test("waitForRovoPortsHealthy surfaces the last unhealthy status on timeout", async () => {
	await assert.rejects(
		() =>
			waitForRovoPortsHealthy({
				ports: [8000],
				maxAttempts: 2,
				intervalMs: 0,
				checkRovoHealthFn: async () => ({
					healthy: false,
					status: "unreachable",
					mcpServers: null,
				}),
			}),
		/Rovo ports did not become healthy in time: 8000 \(unreachable\)/
	);
});

test("checkRovoHealth treats 401 auth responses as healthy", async () => {
	const server = http.createServer((_req, res) => {
		res.writeHead(401, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ detail: "Missing credentials" }));
	});

	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	assert.ok(address && typeof address === "object");

	try {
		const result = await checkRovoHealth(address.port);
		assert.deepEqual(result, {
			healthy: true,
			status: "auth-required",
			mcpServers: null,
		});
	} finally {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
});

test("rovo:tmux start builds its session with window targets tmux accepts, up to the first Rovo launcher", (t) => {
	const { writeFakeTmux } = require("./lib/fake-tmux.js");
	const { spawnSync } = require("node:child_process");
	// A throwaway worktree, so the start writes no port files into this checkout.
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dev-tmux-rovo-start-")));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const worktree = path.join(root, "wt");
	const bin = path.join(root, "bin");
	fs.mkdirSync(worktree);
	fs.mkdirSync(bin);
	for (const entry of ["scripts", "node_modules", "package.json"]) {
		fs.symlinkSync(path.join(repoRoot, entry), path.join(worktree, entry));
	}
	writeFakeTmux(path.join(bin, "tmux"));
	const tmuxLog = path.join(root, "tmux.log");
	const serverLog = path.join(root, "servers.log");
	const result = spawnSync(path.join(worktree, "scripts/dev-tmux.sh"), ["start"], {
		cwd: worktree,
		encoding: "utf8",
		env: {
			...process.env,
			PATH: `${bin}:${process.env.PATH}`,
			ROVO_BILLING_URL: "https://example.invalid",
			ROVO_POOL_SIZE: "1",
			ROVO_TMUX_SESSION: "vpk-dev-rovo-start-test",
			// No Rovo answers in a test: the health wait fails at once, after the launcher was sent.
			ROVO_HEALTHCHECK_MAX_ATTEMPTS: "1",
			ROVO_HEALTHCHECK_INTERVAL_MS: "0",
			FAKE_TMUX_STATE: path.join(root, "state"),
			FAKE_TMUX_LOG: tmuxLog,
			FAKE_SERVER_LOG: serverLog,
		},
	});
	const log = fs.existsSync(tmuxLog) ? fs.readFileSync(tmuxLog, "utf8") : "";
	assert.doesNotMatch(result.stderr, /no such window|can't find session/, result.stderr);
	assert.match(log, /^set-option -t =vpk-dev-rovo-start-test: remain-on-exit on$/mu);
	assert.match(log, /^send-keys -t =vpk-dev-rovo-start-test:ports\.2 cd .* node scripts\/dev-rovo-port\.js/mu);
	assert.deepEqual(fs.readFileSync(serverLog, "utf8").trim().split("\n"), ["vpk-dev-rovo-start-test"]);
	assert.match(result.stderr, /did not become healthy/);
	assert.equal(fs.existsSync(path.join(worktree, ".env.local")), false, "nothing was seeded into the temp worktree");
});
