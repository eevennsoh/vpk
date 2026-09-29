#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { getAllWorktreePortInfo } = require("../../../../scripts/lib/worktree-ports");
const { probePortAlive } = require("../../../../scripts/lib/port-liveness");
const { loadPortlessRoutes, isOwnerAlive } = require("../../../../scripts/lib/portless-routes");
const packageMetadata = require("../../../../package.json");

const projectName = packageMetadata.name.replace(/^@[^/]+\//u, "");
const DEFAULT_TARGET_URL = `https://${projectName}.localhost`;
const SESSION_PREFIX = "vpk-tunnel-";
const START_TIMEOUT_MS = 30_000;
const START_POLL_INTERVAL_MS = 250;
const ACCESS_MESSAGES = Object.freeze({
	private: "Private sharing: accessible through Atlassian VPN and whitelist proxies; external participants cannot use this link.",
	public: "WARNING: --public exposes this local application to the internet. Use it only when external/public sharing is intended.",
});
const CLEANUP_WARNING = "Cleanup runs atlas tunnel clean, which deletes all CLI-created tunnels, configuration files, and logs.";
const REQUIRED_TUNNEL_DEV_ORIGINS = Object.freeze([
	"*.public.atlastunnel.com",
	"*.atlastunnel.com",
]);

function normalizeTargetUrl(value = DEFAULT_TARGET_URL) {
	let parsed;
	try {
		parsed = new URL(value || DEFAULT_TARGET_URL);
	} catch {
		throw new Error(`Invalid Portless URL: ${value}`);
	}

	if (!["http:", "https:"].includes(parsed.protocol)) {
		throw new Error("Portless URL must use http or https.");
	}
	if (!parsed.hostname.endsWith(".localhost")) {
		throw new Error(`Expected a Portless .localhost URL, received: ${parsed.href}`);
	}
	if (parsed.username || parsed.password) {
		throw new Error("Portless URL must not contain credentials.");
	}

	return parsed;
}

function chooseRoute(routes, hostname, ownerAlive = isOwnerAlive) {
	const matches = routes.filter(
		(route) => route && String(route.hostname).toLowerCase() === hostname.toLowerCase(),
	);
	if (matches.length === 0) {
		throw new Error(
			`No Portless route matches ${hostname}. Run \`pnpm ports once\` and choose an exact live URL.`,
		);
	}

	const liveRoute = matches.find((route) => ownerAlive(route.pid));
	if (!liveRoute) {
		throw new Error(
			`Portless route ${hostname} is stale because its owning process is not running. Run \`pnpm ports once\` and choose an exact live URL.`,
		);
	}
	return liveRoute;
}

function readFrontendPort(worktreePath) {
	try {
		return fs.readFileSync(path.join(worktreePath, ".dev-frontend-port"), "utf8").trim();
	} catch {
		return null;
	}
}

function findSourceWorktree(port, worktrees = getAllWorktreePortInfo()) {
	const match = worktrees.find((worktree) => Number(readFrontendPort(worktree.path)) === Number(port));
	if (!match) return null;

	return {
		branch: match.branch,
		identifier: match.identifier,
		isMain: Boolean(match.isMain),
		path: match.path,
	};
}

async function resolvePortlessTarget({
	targetUrl = DEFAULT_TARGET_URL,
	routes = loadPortlessRoutes(),
	ownerAlive = isOwnerAlive,
	probePort = probePortAlive,
	worktrees,
} = {}) {
	const parsed = normalizeTargetUrl(targetUrl);
	const route = chooseRoute(routes, parsed.hostname, ownerAlive);
	const port = Number(route.port);
	if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
		throw new Error(`Portless route ${parsed.hostname} has an invalid frontend port.`);
	}
	if (!(await probePort(port))) {
		throw new Error(
			`Portless route ${parsed.hostname} points to frontend port ${port}, but that port is not responding.`,
		);
	}

	return {
		hostname: parsed.hostname,
		localUrl: parsed.href,
		port,
		sourceWorktree: findSourceWorktree(port, worktrees),
		...describeShareTarget(parsed.href),
	};
}

function describeShareTarget(localUrl) {
	const parsed = normalizeTargetUrl(localUrl);
	const pathname = parsed.pathname || "/";
	return {
		isCatalogRoot: pathname === "/",
		pathname,
	};
}

function nextConfigPathForTarget(target) {
	const worktreePath = target?.sourceWorktree?.path;
	return path.join(worktreePath || process.cwd(), "next.config.ts");
}

function extractAllowedDevOrigins(configSource) {
	const match = String(configSource).match(/allowedDevOrigins\s*:\s*\[([\s\S]*?)\]/u);
	if (!match) return [];
	return [...match[1].matchAll(/["']([^"']+)["']/gu)].map((entry) => entry[1]);
}

function missingTunnelDevOrigins(origins) {
	const present = new Set(origins);
	return REQUIRED_TUNNEL_DEV_ORIGINS.filter((origin) => !present.has(origin));
}

function assertTunnelDevOrigins({
	configPath,
	readFile = (filePath) => fs.readFileSync(filePath, "utf8"),
} = {}) {
	if (!configPath) {
		throw new Error("Could not locate next.config.ts to verify allowedDevOrigins.");
	}

	let configSource;
	try {
		configSource = readFile(configPath);
	} catch {
		throw new Error(`Could not read ${configPath} to verify allowedDevOrigins.`);
	}

	const missing = missingTunnelDevOrigins(extractAllowedDevOrigins(configSource));
	if (missing.length === 0) return;

	throw new Error(
		`Next.js will serve a blank tunnel page because allowedDevOrigins is missing ${missing.join(", ")}. Add those hosts in next.config.ts, restart that worktree's frontend, re-resolve the Portless URL (the port may change), then start the tunnel again.`,
	);
}

function sessionNameForHostname(hostname) {
	const slug = String(hostname)
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/gu, "");
	const candidate = `${SESSION_PREFIX}${slug}`;
	if (candidate.length <= 80) return candidate;

	const digest = crypto.createHash("sha256").update(hostname).digest("hex").slice(0, 8);
	return `${candidate.slice(0, 71)}-${digest}`;
}

function createRunner(spawn = spawnSync) {
	return (command, args, options = {}) => {
		const result = spawn(command, args, {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
			...options,
		});
		return {
			error: result.error ?? null,
			status: result.status,
			stderr: result.stderr ?? "",
			stdout: result.stdout ?? "",
		};
	};
}

function commandExists(command, run) {
	const result = run("/bin/sh", ["-lc", `command -v ${command}`]);
	return !result.error && result.status === 0 && result.stdout.trim().length > 0;
}

function dependencySetupMessage(missing) {
	const lines = [`Missing required tunnel dependency: ${missing.join(", ")}.`];
	if (missing.includes("atlas")) {
		lines.push("Install or update Atlas CLI, then run: atlas plugin install --name tunnel");
	}
	if (missing.includes("cloudflared")) {
		lines.push("Install cloudflared after user approval: brew install cloudflared");
	}
	if (missing.includes("tmux")) {
		lines.push("Install tmux before using persistent scoped tunnel sessions.");
	}
	if (missing.includes("curl")) {
		lines.push("Install curl so the prototype route can be health-checked before exposure.");
	}
	return lines.join("\n");
}

function checkDependencies(run) {
	const required = ["atlas", "cloudflared", "tmux", "curl"];
	const missing = required.filter((command) => !commandExists(command, run));
	if (missing.length > 0) {
		throw new Error(dependencySetupMessage(missing));
	}

	const plugins = run("atlas", ["plugin", "installed"]);
	if (plugins.error || plugins.status !== 0) {
		throw new Error(
			`Could not inspect installed Atlas plugins. ${plugins.stderr.trim() || "Run atlas plugin installed and retry."}`,
		);
	}
	if (!/^\s*tunnel\s+/imu.test(plugins.stdout)) {
		throw new Error(
			"Atlas Tunnel plugin is not installed. After user approval, run: atlas plugin install --name tunnel",
		);
	}
}

function verifyHttpTarget(localUrl, run) {
	const result = run("curl", [
		"-k",
		"-sS",
		"-L",
		"--max-time",
		"10",
		"-o",
		"/dev/null",
		"-w",
		"%{http_code}",
		localUrl,
	]);
	const statusCode = Number(result.stdout.trim());
	if (result.error || result.status !== 0 || statusCode < 200 || statusCode >= 400) {
		const detail = result.stderr.trim() || `HTTP ${result.stdout.trim() || "probe failed"}`;
		throw new Error(`Local prototype did not return a successful HTTP response: ${detail}`);
	}
	return statusCode;
}

function tmuxSessionExists(sessionName, run) {
	const result = run("tmux", ["has-session", "-t", sessionName]);
	return !result.error && result.status === 0;
}

function captureSession(sessionName, run) {
	const result = run("tmux", ["capture-pane", "-p", "-t", sessionName, "-S", "-200"]);
	if (result.error || result.status !== 0) return "";
	return result.stdout;
}

function readStoredTunnelBaseUrl(sessionName, run) {
	const result = run("tmux", [
		"show-options",
		"-v",
		"-t",
		sessionName,
		"@vpk-tunnel-url",
	]);
	if (result.error || result.status !== 0) return null;
	return extractTunnelBaseUrl(result.stdout);
}

function readStoredTunnelAccess(sessionName, run) {
	const result = run("tmux", ["show-options", "-v", "-t", sessionName, "@vpk-tunnel-access"]);
	const access = result.stdout.trim();
	return !result.error && result.status === 0 && Object.hasOwn(ACCESS_MESSAGES, access)
		? access
		: null;
}

function readStoredTunnelPort(sessionName, run) {
	const result = run("tmux", [
		"show-options",
		"-v",
		"-t",
		sessionName,
		"@vpk-tunnel-port",
	]);
	if (result.error || result.status !== 0) return null;
	const port = Number(result.stdout.trim());
	return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : null;
}

function storeTunnelBaseUrl(sessionName, tunnelBaseUrl, run) {
	const result = run("tmux", [
		"set-option",
		"-t",
		sessionName,
		"@vpk-tunnel-url",
		tunnelBaseUrl,
	]);
	if (result.error || result.status !== 0) {
		throw new Error(`Could not persist the tunnel URL on scoped tunnel session ${sessionName}.`);
	}
}

function storeTunnelAccess(sessionName, access, run) {
	const result = run("tmux", ["set-option", "-t", sessionName, "@vpk-tunnel-access", access]);
	if (result.error || result.status !== 0) {
		throw new Error(`Could not persist access mode on scoped tunnel session ${sessionName}.`);
	}
}

function storeTunnelPort(sessionName, port, run) {
	const result = run("tmux", [
		"set-option",
		"-t",
		sessionName,
		"@vpk-tunnel-port",
		String(port),
	]);
	if (result.error || result.status !== 0) {
		throw new Error(`Could not persist the frontend port on scoped tunnel session ${sessionName}.`);
	}
}

function extractTunnelBaseUrl(output) {
	const matches = String(output).match(/https:\/\/[^\s"'<>\\]+/gu) ?? [];
	const tunnelMatches = matches.filter((candidate) => {
		try {
			const parsed = new URL(candidate.replace(/[),.;]+$/gu, ""));
			return parsed.hostname === "atlastunnel.com" || parsed.hostname.endsWith(".atlastunnel.com");
		} catch {
			return false;
		}
	});
	return tunnelMatches.length > 0
		? tunnelMatches[tunnelMatches.length - 1].replace(/[),.;]+$/gu, "")
		: null;
}

function buildTunnelUrl(tunnelBaseUrl, localUrl) {
	const base = new URL(tunnelBaseUrl);
	const local = normalizeTargetUrl(localUrl);
	base.pathname = local.pathname;
	base.search = local.search;
	base.hash = local.hash;
	return base.href;
}

async function waitForTunnelUrl(sessionName, run, {
	sleep = delay,
	timeoutMs = START_TIMEOUT_MS,
	pollIntervalMs = START_POLL_INTERVAL_MS,
} = {}) {
	const deadline = Date.now() + timeoutMs;
	let latestOutput = "";
	while (Date.now() < deadline) {
		if (!tmuxSessionExists(sessionName, run)) {
			throw new Error(
				`Atlas Tunnel exited before publishing a URL.${latestOutput.trim() ? `\n${latestOutput.trim()}` : ""}`,
			);
		}
		latestOutput = captureSession(sessionName, run);
		const tunnelBaseUrl = extractTunnelBaseUrl(latestOutput);
		if (tunnelBaseUrl) return tunnelBaseUrl;
		await sleep(pollIntervalMs);
	}

	throw new Error(
		`Timed out waiting for Atlas Tunnel to publish a URL.${latestOutput.trim() ? `\n${latestOutput.trim()}` : ""}`,
	);
}

function buildTunnelCommand(port, access) {
	return [
		"cleanup() {",
		"  atlas tunnel clean || {",
		"    printf '%s\\n' 'Atlas Tunnel cleanup failed; run atlas tunnel clean before restarting.' >&2",
		"    exit 1",
		"  }",
		"}",
		"trap cleanup EXIT",
		"trap 'exit 130' INT",
		"trap 'exit 143' TERM",
		`atlas tunnel start --port ${port}${access === "public" ? " --public" : ""}`,
	].join("\n");
}

function cleanTunnelResources(run) {
	const cleaned = run("atlas", ["tunnel", "clean"]);
	if (cleaned.error || cleaned.status !== 0) {
		throw new Error(`Atlas Tunnel cleanup failed: ${cleaned.stderr.trim() || cleaned.error?.message || "atlas tunnel clean failed"}. Run atlas tunnel clean before restarting.`);
	}
}

async function startTunnel({
	targetUrl = DEFAULT_TARGET_URL,
	access = "private",
	run = createRunner(),
	resolveTarget = resolvePortlessTarget,
	sleep = delay,
	waitForUrl = waitForTunnelUrl,
	readFile = (filePath) => fs.readFileSync(filePath, "utf8"),
	warn = (message) => console.error(message),
} = {}) {
	if (!Object.hasOwn(ACCESS_MESSAGES, access)) {
		throw new Error("Tunnel access must be private or public.");
	}
	const target = await resolveTarget({ targetUrl });
	assertTunnelDevOrigins({
		configPath: nextConfigPathForTarget(target),
		readFile,
	});
	checkDependencies(run);
	const httpStatus = verifyHttpTarget(target.localUrl, run);
	warn(`${ACCESS_MESSAGES[access]}\nLocal source: ${target.localUrl}\n${CLEANUP_WARNING}`);
	const sessionName = sessionNameForHostname(target.hostname);
	let reused = tmuxSessionExists(sessionName, run);
	if (reused && (readStoredTunnelPort(sessionName, run) !== target.port
		|| readStoredTunnelAccess(sessionName, run) !== access)) {
		await stopTunnel({ targetUrl, run, sleep, warn });
		reused = false;
	}

	if (!reused) {
		const atlasCommand = buildTunnelCommand(target.port, access);
		const started = run("tmux", ["new-session", "-d", "-s", sessionName, "/bin/sh", "-c", atlasCommand]);
		if (started.error || started.status !== 0) {
			throw new Error(
				`Could not start scoped tunnel session ${sessionName}: ${started.stderr.trim() || "tmux failed"}`,
			);
		}
	}

	try {
		const existingOutput = captureSession(sessionName, run);
		const tunnelBaseUrl = readStoredTunnelBaseUrl(sessionName, run)
			?? extractTunnelBaseUrl(existingOutput)
			?? await waitForUrl(sessionName, run);
		storeTunnelBaseUrl(sessionName, tunnelBaseUrl, run);
		storeTunnelPort(sessionName, target.port, run);
		storeTunnelAccess(sessionName, access, run);
		return {
			access,
			httpStatus,
			localUrl: target.localUrl,
			port: target.port,
			tunnelBaseUrl,
			tunnelUrl: buildTunnelUrl(tunnelBaseUrl, target.localUrl),
			publicBaseUrl: access === "public" ? tunnelBaseUrl : null,
			publicUrl: access === "public" ? buildTunnelUrl(tunnelBaseUrl, target.localUrl) : null,
			reused,
			sessionName,
			sourceWorktree: target.sourceWorktree ?? null,
			...describeShareTarget(target.localUrl),
		};
	} catch (error) {
		try {
			await stopTunnel({ targetUrl, run, sleep, warn });
		} catch (cleanupError) {
			throw new AggregateError([error, cleanupError], `${error.message}\n${cleanupError.message}`);
		}
		throw error;
	}
}

function statusTunnel({ targetUrl = DEFAULT_TARGET_URL, run = createRunner() } = {}) {
	const parsed = normalizeTargetUrl(targetUrl);
	const sessionName = sessionNameForHostname(parsed.hostname);
	const running = tmuxSessionExists(sessionName, run);
	const output = running ? captureSession(sessionName, run) : "";
	const access = running ? readStoredTunnelAccess(sessionName, run) : null;
	const tunnelBaseUrl = running
		? readStoredTunnelBaseUrl(sessionName, run) ?? extractTunnelBaseUrl(output)
		: null;
	return {
		access,
		localUrl: parsed.href,
		port: running ? readStoredTunnelPort(sessionName, run) : null,
		tunnelBaseUrl,
		tunnelUrl: tunnelBaseUrl ? buildTunnelUrl(tunnelBaseUrl, parsed.href) : null,
		publicBaseUrl: access === "public" ? tunnelBaseUrl : null,
		publicUrl: access === "public" && tunnelBaseUrl ? buildTunnelUrl(tunnelBaseUrl, parsed.href) : null,
		running,
		sessionName,
	};
}

async function stopTmuxSession(sessionName, run, sleep = delay) {
	run("tmux", ["send-keys", "-t", sessionName, "C-c"]);
	await sleep(500);
	if (!tmuxSessionExists(sessionName, run)) return;

	const killed = run("tmux", ["kill-session", "-t", sessionName]);
	if (killed.error || killed.status !== 0) {
		throw new Error(
			`Could not stop scoped tunnel session ${sessionName}: ${killed.stderr.trim() || "tmux failed"}`,
		);
	}
}

async function stopTunnel({
	targetUrl = DEFAULT_TARGET_URL,
	run = createRunner(),
	sleep = delay,
	warn = (message) => console.error(message),
} = {}) {
	const parsed = normalizeTargetUrl(targetUrl);
	const sessionName = sessionNameForHostname(parsed.hostname);
	warn(CLEANUP_WARNING);
	const stopped = tmuxSessionExists(sessionName, run);
	if (stopped) await stopTmuxSession(sessionName, run, sleep);
	// Retry cleanup explicitly even if the session's exit trap already ran, or
	// could not run because the process was force-killed.
	cleanTunnelResources(run);
	return { cleaned: true, localUrl: parsed.href, sessionName, stopped };
}

function parseCliArguments(argv) {
	if (argv.includes("--confirm-public")) {
		throw new Error("Use --public to explicitly request internet access; --confirm-public is no longer supported.");
	}
	const flags = argv.filter((value) => value.startsWith("--"));
	const unknownFlag = flags.find((value) => value !== "--public");
	if (unknownFlag) throw new Error(`Unknown option: ${unknownFlag}. Only --public is supported.`);
	const positional = argv.filter((value) => value !== "--public");
	const firstArgument = positional[0];
	const urlOnlyStart = typeof firstArgument === "string" && /^https?:\/\//iu.test(firstArgument);
	const command = urlOnlyStart ? "start" : firstArgument ?? "start";
	const rest = urlOnlyStart ? positional : positional.slice(1);
	if (!["resolve", "start", "status", "stop"].includes(command)) {
		throw new Error("Usage: vpk-tunnel <resolve|start|status|stop> [Portless URL] [--public]");
	}
	if (flags.length > 0 && command !== "start") {
		throw new Error("--public is only supported when starting a tunnel.");
	}
	if (rest.length > 1) {
		throw new Error("Pass at most one Portless URL.");
	}
	return { command, targetUrl: rest[0] ?? DEFAULT_TARGET_URL, access: flags.includes("--public") ? "public" : "private" };
}

async function main(argv = process.argv.slice(2)) {
	const { command, targetUrl, access } = parseCliArguments(argv);
	let result;
	if (command === "resolve") {
		result = await resolvePortlessTarget({ targetUrl });
	} else if (command === "start") {
		result = await startTunnel({ targetUrl, access });
	} else if (command === "status") {
		result = statusTunnel({ targetUrl });
	} else {
		result = await stopTunnel({ targetUrl });
	}
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}

module.exports = {
	DEFAULT_TARGET_URL,
	REQUIRED_TUNNEL_DEV_ORIGINS,
	assertTunnelDevOrigins,
	buildTunnelCommand,
	buildTunnelUrl,
	checkDependencies,
	chooseRoute,
	createRunner,
	dependencySetupMessage,
	describeShareTarget,
	extractAllowedDevOrigins,
	extractTunnelBaseUrl,
	missingTunnelDevOrigins,
	nextConfigPathForTarget,
	normalizeTargetUrl,
	parseCliArguments,
	readStoredTunnelBaseUrl,
	readStoredTunnelAccess,
	readStoredTunnelPort,
	resolvePortlessTarget,
	sessionNameForHostname,
	startTunnel,
	statusTunnel,
	stopTmuxSession,
	storeTunnelBaseUrl,
	storeTunnelAccess,
	storeTunnelPort,
	stopTunnel,
	tmuxSessionExists,
	verifyHttpTarget,
	waitForTunnelUrl,
};
