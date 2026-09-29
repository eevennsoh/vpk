const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const {
	DEFAULT_TARGET_URL,
	REQUIRED_TUNNEL_DEV_ORIGINS,
	assertTunnelDevOrigins,
	buildTunnelCommand,
	buildTunnelUrl,
	checkDependencies,
	describeShareTarget,
	extractAllowedDevOrigins,
	extractTunnelBaseUrl,
	missingTunnelDevOrigins,
	nextConfigPathForTarget,
	normalizeTargetUrl,
	parseCliArguments,
	resolvePortlessTarget,
	sessionNameForHostname,
	startTunnel,
	statusTunnel,
	stopTunnel,
	verifyHttpTarget,
} = require("./vpk-tunnel");

const ALLOWED_NEXT_CONFIG = `
	allowedDevOrigins: [
		"example-project.localhost",
		"*.example-project.localhost",
		"*.public.atlastunnel.com",
		"*.atlastunnel.com",
	],
`;

function result(status = 0, stdout = "", stderr = "") {
	return { error: null, status, stderr, stdout };
}

test("normalizes the stable main Portless URL by default", () => {
	assert.equal(normalizeTargetUrl().href, `${DEFAULT_TARGET_URL}/`);
});

test("resolves an exact custom Portless route and preserves its full local URL", async () => {
	const target = await resolvePortlessTarget({
		targetUrl: "https://feature.example-project.localhost/jira?view=board#activity",
		routes: [{ hostname: "feature.example-project.localhost", port: 4321, pid: 99 }],
		ownerAlive: () => true,
		probePort: async (port) => port === 4321,
		worktrees: [],
	});

	assert.equal(target.hostname, "feature.example-project.localhost");
	assert.equal(target.port, 4321);
	assert.equal(
		target.localUrl,
		"https://feature.example-project.localhost/jira?view=board#activity",
	);
	assert.equal(target.isCatalogRoot, false);
	assert.equal(target.pathname, "/jira");
});

test("rejects unknown and dead Portless routes", async () => {
	await assert.rejects(
		resolvePortlessTarget({
			targetUrl: "https://missing.localhost",
			routes: [],
			worktrees: [],
		}),
		/No Portless route matches/u,
	);
	await assert.rejects(
		resolvePortlessTarget({
			targetUrl: "https://dead.localhost",
			routes: [{ hostname: "dead.localhost", port: 4444, pid: 1 }],
			ownerAlive: () => true,
			probePort: async () => false,
			worktrees: [],
		}),
		/port 4444, but that port is not responding/u,
	);
	await assert.rejects(
		resolvePortlessTarget({
			targetUrl: "https://stale.localhost",
			routes: [{ hostname: "stale.localhost", port: 4555, pid: 1 }],
			ownerAlive: () => false,
			probePort: async () => true,
			worktrees: [],
		}),
		/route stale\.localhost is stale/u,
	);
});

test("constructs hostname-scoped session names", () => {
	assert.equal(
		sessionNameForHostname("Feature.Example-Project.localhost"),
		"vpk-tunnel-feature-example-project-localhost",
	);
	const longName = sessionNameForHostname(`${"a".repeat(100)}.localhost`);
	assert.ok(longName.length <= 80);
	assert.match(longName, /^vpk-tunnel-/u);
});

test("preserves the local path, query, and fragment in the tunnel URL", () => {
	assert.equal(
		buildTunnelUrl(
			"https://research-session.atlastunnel.com",
			"https://feature.localhost/jira?view=board#activity",
		),
		"https://research-session.atlastunnel.com/jira?view=board#activity",
	);
});

test("extracts an external URL but ignores Portless URLs", () => {
	assert.equal(
		extractTunnelBaseUrl(
			"Local https://example-project.localhost is available at https://research.atlastunnel.com",
		),
		"https://research.atlastunnel.com",
	);
	assert.equal(extractTunnelBaseUrl("Help: https://example.com/tunnel"), null);
});

test("flags catalog-root shares separately from project routes", () => {
	assert.deepEqual(describeShareTarget("https://example-project.localhost"), {
		isCatalogRoot: true,
		pathname: "/",
	});
	assert.deepEqual(describeShareTarget("https://example-project.localhost/jira-golden-journeys-v4"), {
		isCatalogRoot: false,
		pathname: "/jira-golden-journeys-v4",
	});
});

test("extracts allowedDevOrigins and reports missing Atlas Tunnel hosts", () => {
	assert.deepEqual(
		extractAllowedDevOrigins(ALLOWED_NEXT_CONFIG),
		[
			"example-project.localhost",
			"*.example-project.localhost",
			"*.public.atlastunnel.com",
			"*.atlastunnel.com",
		],
	);
	assert.deepEqual(
		missingTunnelDevOrigins(["example-project.localhost", "*.example-project.localhost"]),
		[...REQUIRED_TUNNEL_DEV_ORIGINS],
	);
	assert.deepEqual(missingTunnelDevOrigins([...REQUIRED_TUNNEL_DEV_ORIGINS]), []);
	assert.equal(
		nextConfigPathForTarget({ sourceWorktree: { path: "/tmp/worktree" } }),
		"/tmp/worktree/next.config.ts",
	);
	assert.throws(
		() => assertTunnelDevOrigins({
			configPath: "/tmp/worktree/next.config.ts",
			readFile: () => `allowedDevOrigins: ["example-project.localhost"]`,
		}),
		/allowedDevOrigins is missing \*\.public\.atlastunnel\.com, \*\.atlastunnel\.com/u,
	);
	assert.doesNotThrow(() => assertTunnelDevOrigins({
		configPath: "/tmp/worktree/next.config.ts",
		readFile: () => ALLOWED_NEXT_CONFIG,
	}));
});

test("requires a successful local HTTP response", () => {
	assert.equal(verifyHttpTarget("https://feature.localhost", () => result(0, "204")), 204);
	assert.throws(
		() => verifyHttpTarget("https://feature.localhost", () => result(28, "000", "timed out")),
		/Local prototype did not return a successful HTTP response: timed out/u,
	);
	assert.throws(
		() => verifyHttpTarget("https://feature.localhost", () => result(0, "500")),
		/HTTP 500/u,
	);
});

test("reports missing dependencies with setup guidance", () => {
	const run = (command, args) => {
		if (command === "/bin/sh" && args.at(-1).includes("atlas")) return result(1);
		return result(0, "/usr/bin/tool\n");
	};
	assert.throws(() => checkDependencies(run), /Missing required tunnel dependency: atlas/u);
});

test("treats a URL-only invocation as the documented start command", () => {
	assert.deepEqual(
		parseCliArguments(["https://feature.localhost/demo"]),
		{
			command: "start",
			targetUrl: "https://feature.localhost/demo",
			access: "private",
		},
	);
});

test("reuses an existing scoped tunnel without starting another", async () => {
	const calls = [];
	const run = (command, args) => {
		calls.push([command, args]);
		if (command === "/bin/sh") return result(0, "/usr/bin/tool\n");
		if (command === "atlas") return result(0, "tunnel 141 Atlas Tunnel CLI\n");
		if (command === "curl") return result(0, "200");
		if (command === "tmux" && args[0] === "has-session") return result(0);
		if (command === "tmux" && args[0] === "show-options" && args.at(-1) === "@vpk-tunnel-port") {
			return result(0, "4321\n");
		}
		if (command === "tmux" && args[0] === "show-options" && args.at(-1) === "@vpk-tunnel-access") {
			return result(0, "private\n");
		}
		if (command === "tmux" && args[0] === "capture-pane") {
			return result(0, "Public URL: https://research.atlastunnel.com\n");
		}
		return result(0);
	};
	const tunnel = await startTunnel({
		readFile: () => ALLOWED_NEXT_CONFIG,
		resolveTarget: async () => ({
			hostname: "feature.localhost",
			localUrl: "https://feature.localhost/demo",
			port: 4321,
		}),
		run,
	});

	assert.equal(tunnel.reused, true);
	assert.equal(tunnel.tunnelUrl, "https://research.atlastunnel.com/demo");
	assert.equal(tunnel.publicUrl, null);
	assert.equal(
		calls.some(([command, args]) => command === "tmux" && args[0] === "new-session"),
		false,
	);
});

test("restarts a scoped tunnel when its resolved frontend port changes", async () => {
	let sessionExists = true;
	const calls = [];
	const run = (command, args) => {
		calls.push([command, args]);
		if (command === "/bin/sh") return result(0, "/usr/bin/tool\n");
		if (command === "atlas") return result(0, "tunnel 141 Atlas Tunnel CLI\n");
		if (command === "curl") return result(0, "200");
		if (command === "tmux" && args[0] === "has-session") {
			return result(sessionExists ? 0 : 1);
		}
		if (command === "tmux" && args[0] === "show-options" && args.at(-1) === "@vpk-tunnel-port") {
			return result(0, "4000\n");
		}
		if (command === "tmux" && args[0] === "kill-session") {
			sessionExists = false;
			return result(0);
		}
		if (command === "tmux" && args[0] === "new-session") {
			sessionExists = true;
			return result(0);
		}
		return result(0);
	};
	const tunnel = await startTunnel({
		readFile: () => ALLOWED_NEXT_CONFIG,
		resolveTarget: async () => ({
			hostname: "feature.localhost",
			localUrl: "https://feature.localhost/demo",
			port: 4321,
		}),
		run,
		sleep: async () => {},
		waitForUrl: async () => "https://research.atlastunnel.com",
	});

	assert.equal(tunnel.reused, false);
	assert.equal(
		calls.some(([command, args]) => command === "tmux" && args[0] === "kill-session"),
		true,
	);
	assert.equal(
		calls.some(
			([command, args]) => command === "tmux"
				&& args[0] === "new-session"
				&& args.at(-1).endsWith("atlas tunnel start --port 4321"),
		),
		true,
	);
});

test("starts the canonical public Atlas command in a new scoped session", async () => {
	const calls = [];
	const run = (command, args) => {
		calls.push([command, args]);
		if (command === "/bin/sh") return result(0, "/usr/bin/tool\n");
		if (command === "atlas") return result(0, "tunnel 141 Atlas Tunnel CLI\n");
		if (command === "curl") return result(0, "200");
		if (command === "tmux" && args[0] === "has-session") return result(1);
		return result(0);
	};
	const tunnel = await startTunnel({
		access: "public",
		readFile: () => ALLOWED_NEXT_CONFIG,
		resolveTarget: async () => ({
			hostname: "feature.localhost",
			localUrl: "https://feature.localhost/demo",
			port: 4321,
		}),
		run,
		waitForUrl: async () => "https://research.atlastunnel.com",
	});

	assert.equal(tunnel.reused, false);
	assert.deepEqual(
		calls.find(([command, args]) => command === "tmux" && args[0] === "new-session"),
		[
			"tmux",
			[
				"new-session",
				"-d",
				"-s",
				"vpk-tunnel-feature-localhost",
				"/bin/sh",
				"-c",
				buildTunnelCommand(4321, "public"),
			],
		],
	);
	assert.deepEqual(
		calls.find(([command, args]) => command === "tmux" && args[0] === "set-option"),
		[
			"tmux",
			[
				"set-option",
				"-t",
				"vpk-tunnel-feature-localhost",
				"@vpk-tunnel-url",
				"https://research.atlastunnel.com",
			],
		],
	);
	assert.deepEqual(
		calls.find(
			([command, args]) => command === "tmux"
				&& args[0] === "set-option"
				&& args.at(-2) === "@vpk-tunnel-port",
		),
		[
			"tmux",
			[
				"set-option",
				"-t",
				"vpk-tunnel-feature-localhost",
				"@vpk-tunnel-port",
				"4321",
			],
		],
	);
});

test("refuses to start when Next.js allowedDevOrigins omits Atlas Tunnel hosts", async () => {
	let calls = 0;
	await assert.rejects(
		startTunnel({
			readFile: () => `allowedDevOrigins: ["example-project.localhost"]`,
			resolveTarget: async () => ({
				hostname: "feature.localhost",
				localUrl: "https://feature.localhost/demo",
				port: 4321,
				sourceWorktree: { path: "/tmp/worktree" },
			}),
			run: () => {
				calls += 1;
				return result();
			},
		}),
		/blank tunnel page because allowedDevOrigins is missing/u,
	);
	assert.equal(calls, 0);
});

test("reports a stored public URL after startup logs scroll away", () => {
	const run = (command, args) => {
		if (command === "tmux" && args[0] === "has-session") return result(0);
		if (command === "tmux" && args[0] === "show-options") {
			if (args.at(-1) === "@vpk-tunnel-access") return result(0, "public\n");
			return args.at(-1) === "@vpk-tunnel-port"
				? result(0, "4321\n")
				: result(0, "https://research.atlastunnel.com\n");
		}
		if (command === "tmux" && args[0] === "capture-pane") return result(0, "request logs\n");
		return result(1);
	};
	const status = statusTunnel({ run, targetUrl: "https://feature.localhost/demo" });

	assert.equal(status.running, true);
	assert.equal(status.port, 4321);
	assert.equal(status.publicUrl, "https://research.atlastunnel.com/demo");
});

test("stops the target local session and cleans Atlas resources", async () => {
	let hasSessionChecks = 0;
	const calls = [];
	const run = (command, args) => {
		calls.push([command, args]);
		if (command === "tmux" && args[0] === "has-session") {
			hasSessionChecks += 1;
			return result(hasSessionChecks <= 2 ? 0 : 1);
		}
		return result(0);
	};
	const stopped = await stopTunnel({
		run,
		sleep: async () => {},
		targetUrl: "https://feature.localhost/demo",
	});

	assert.equal(stopped.stopped, true);
	assert.equal(stopped.cleaned, true);
	assert.deepEqual(calls.at(-1), ["atlas", ["tunnel", "clean"]]);
	assert.deepEqual(
		calls.filter(([command]) => command === "tmux").map(([, args]) => args.slice(0, 3)),
		[
			["has-session", "-t", "vpk-tunnel-feature-localhost"],
			["send-keys", "-t", "vpk-tunnel-feature-localhost"],
			["has-session", "-t", "vpk-tunnel-feature-localhost"],
			["kill-session", "-t", "vpk-tunnel-feature-localhost"],
		],
	);
});

test("defaults to private access and accepts public only as an explicit start flag", () => {
	assert.deepEqual(parseCliArguments([]), {
		command: "start",
		targetUrl: DEFAULT_TARGET_URL,
		access: "private",
	});
	assert.deepEqual(parseCliArguments(["--public", "https://feature.localhost/demo"]), {
		command: "start",
		targetUrl: "https://feature.localhost/demo",
		access: "public",
	});
	assert.throws(() => parseCliArguments(["start", "--confirm-public"]), /Use --public/u);
	assert.throws(() => parseCliArguments(["stop", "--public"]), /only supported when starting/u);
});

test("a default start does not expose the prototype publicly", async () => {
	let startCommand;
	const tunnel = await startTunnel({
		readFile: () => ALLOWED_NEXT_CONFIG,
		resolveTarget: async () => ({
			hostname: "feature.localhost",
			localUrl: "https://feature.localhost/demo",
			port: 4321,
		}),
		run: (command, args) => {
			if (command === "/bin/sh") return result(0, "/usr/bin/tool\n");
			if (command === "atlas") return result(0, "tunnel 141 Atlas Tunnel CLI\n");
			if (command === "curl") return result(0, "200");
			if (command === "tmux" && args[0] === "has-session") return result(1);
			if (command === "tmux" && args[0] === "new-session") startCommand = args.at(-1);
			return result(0);
		},
		waitForUrl: async () => "https://research.atlastunnel.com",
	});
	assert.doesNotMatch(startCommand, /--public/u);
	assert.equal(tunnel.access, "private");
	assert.equal(tunnel.tunnelUrl, "https://research.atlastunnel.com/demo");
	assert.equal(tunnel.publicUrl, null);
});

test("stop cleans Atlas resources even when the local tunnel already exited", async () => {
	const calls = [];
	const stopped = await stopTunnel({
		targetUrl: "https://feature.localhost/demo",
		run: (command, args) => {
			calls.push([command, args]);
			return result(command === "tmux" ? 1 : 0);
		},
	});
	assert.equal(stopped.stopped, false);
	assert.equal(stopped.cleaned, true);
	assert.deepEqual(calls.at(-1), ["atlas", ["tunnel", "clean"]]);
});

function startFixture(storedAccess = null) {
	let running = storedAccess !== null;
	const calls = [];
	const warnings = [];
	return {
		calls,
		warnings,
		options: {
			readFile: () => ALLOWED_NEXT_CONFIG,
			resolveTarget: async () => ({
				hostname: "feature.localhost",
				localUrl: "https://feature.localhost/demo",
				port: 4321,
			}),
			warn: (message) => warnings.push(message),
			sleep: async () => {},
			waitForUrl: async () => "https://research.atlastunnel.com",
			run: (command, args) => {
				calls.push([command, args]);
				if (command === "/bin/sh") return result(0, "/usr/bin/tool\n");
				if (command === "atlas" && args[0] === "plugin") return result(0, "tunnel 141 Atlas Tunnel CLI\n");
				if (command === "curl") return result(0, "200");
				if (command === "tmux") {
					if (args[0] === "has-session") return result(running ? 0 : 1);
					if (args[0] === "show-options") {
						if (args.at(-1) === "@vpk-tunnel-port") return result(0, "4321");
						if (args.at(-1) === "@vpk-tunnel-access") return result(0, storedAccess ?? "");
					}
					if (args[0] === "send-keys") running = false;
					if (args[0] === "new-session") running = true;
				}
				return result();
			},
		},
	};
}

test("warns about internet exposure before starting an explicit public tunnel", async () => {
	const fixture = startFixture();
	const run = fixture.options.run;
	const tunnel = await startTunnel({
		...fixture.options,
		access: "public",
		run: (command, args) => {
			if (command === "tmux" && args[0] === "new-session") {
				assert.match(fixture.warnings[0], /WARNING: --public.*internet/u);
				assert.match(fixture.warnings[0], /https:\/\/feature\.localhost\/demo/u);
			}
			return run(command, args);
		},
	});
	assert.equal(tunnel.access, "public");
	assert.equal(tunnel.publicUrl, tunnel.tunnelUrl);
});

for (const storedAccess of ["public", "legacy-session"]) {
	test(`private start replaces an existing ${storedAccess} session and cleans before restart`, async () => {
		const fixture = startFixture(storedAccess);
		const tunnel = await startTunnel(fixture.options);
		assert.equal(tunnel.reused, false);
		assert.equal(tunnel.access, "private");
		const cleanupIndex = fixture.calls.findIndex(([command, args]) => command === "atlas" && args[0] === "tunnel" && args[1] === "clean");
		const startIndex = fixture.calls.findIndex(([command, args]) => command === "tmux" && args[0] === "new-session");
		assert.ok(cleanupIndex >= 0 && cleanupIndex < startIndex);
	});
}

test("cleans a failed startup and preserves the startup error", async () => {
	const fixture = startFixture();
	await assert.rejects(startTunnel({
		...fixture.options,
		waitForUrl: async () => { throw new Error("authentication failed"); },
	}), /authentication failed/u);
	assert.deepEqual(fixture.calls.at(-1), ["atlas", ["tunnel", "clean"]]);
});

test("cleanup failure prevents a replacement start and is reported", async () => {
	const fixture = startFixture("public");
	const run = fixture.options.run;
	await assert.rejects(startTunnel({
		...fixture.options,
		run: (command, args) => command === "atlas" && args[0] === "tunnel"
			? result(1, "", "issuer unavailable")
			: run(command, args),
	}), /cleanup failed: issuer unavailable/u);
	assert.equal(fixture.calls.some(([command, args]) => command === "tmux" && args[0] === "new-session"), false);
});

test("reports private access and its stored URL after logs scroll away", () => {
	const status = statusTunnel({
		targetUrl: "https://feature.localhost/demo",
		run: (command, args) => {
			if (command === "tmux" && args[0] === "show-options") {
				const values = {
					"@vpk-tunnel-port": "4321",
					"@vpk-tunnel-access": "private",
					"@vpk-tunnel-url": "https://research.atlastunnel.com",
				};
				return result(0, values[args.at(-1)] ?? "");
			}
			return result();
		},
	});
	assert.equal(status.access, "private");
	assert.equal(status.tunnelUrl, "https://research.atlastunnel.com/demo");
	assert.equal(status.publicUrl, null);
});

function executeTunnelCommand(access, { startExit = "0", cleanExit = "0", signal = "" } = {}) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-tunnel-test-"));
	const logPath = path.join(directory, "calls.log");
	try {
		fs.writeFileSync(path.join(directory, "atlas"), [
			"#!/bin/sh",
			'printf "%s\\n" "$*" >> "$TUNNEL_TEST_LOG"',
			'case "$1 $2" in',
			'  "tunnel start")',
			'    if [ -n "$TUNNEL_TEST_SIGNAL" ]; then kill -"$TUNNEL_TEST_SIGNAL" "$PPID"; fi',
			'    exit "$TUNNEL_TEST_START_EXIT" ;;',
			'  "tunnel clean") exit "$TUNNEL_TEST_CLEAN_EXIT" ;;',
			"esac",
		].join("\n"), { mode: 0o755 });
		const execution = spawnSync("/bin/sh", ["-c", buildTunnelCommand(4321, access)], {
			encoding: "utf8",
			timeout: 2000,
			env: {
				PATH: directory,
				TUNNEL_TEST_LOG: logPath,
				TUNNEL_TEST_SIGNAL: signal,
				TUNNEL_TEST_START_EXIT: startExit,
				TUNNEL_TEST_CLEAN_EXIT: cleanExit,
			},
		});
		assert.equal(execution.error, undefined);
		return { ...execution, calls: fs.readFileSync(logPath, "utf8").trim().split("\n") };
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
}

for (const access of ["private", "public"]) {
	for (const [label, options, expectedStatus] of [
		["normal exit", {}, 0],
		["failed Atlas start", { startExit: "7" }, 7],
		["interruption", { signal: "INT" }, 130],
		["termination", { signal: "TERM" }, 143],
	]) {
		test(`${access} tunnel runs cleanup after ${label}`, () => {
			const execution = executeTunnelCommand(access, options);
			assert.equal(execution.status, expectedStatus);
			assert.deepEqual(execution.calls, [
				`tunnel start --port 4321${access === "public" ? " --public" : ""}`,
				"tunnel clean",
			]);
		});
	}
}

test("the exit trap reports cleanup errors with a failing exit status", () => {
	const execution = executeTunnelCommand("private", { cleanExit: "1" });
	assert.equal(execution.status, 1);
	assert.match(execution.stderr, /cleanup failed; run atlas tunnel clean/u);
});
