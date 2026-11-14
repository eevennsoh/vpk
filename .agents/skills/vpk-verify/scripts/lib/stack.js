"use strict";

// This worktree's dev stack: doctor health probe, launch readiness polling and launch state.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");

const { resolveOrigin } = require("./origin.js");
const {
	BACKEND_PORT_FILE,
	FRONTEND_PORT_FILE,
	REPO_ROOT,
	RUN_DIR,
	STATE_FILE,
	readTrimmed,
} = require("./repo.js");

const DEFAULT_LAUNCH_READY_TIMEOUT_MS = 60_000;
const MIN_LAUNCH_READY_TIMEOUT_MS = 1_000;
const MAX_LAUNCH_READY_TIMEOUT_MS = 300_000;
const LAUNCH_READY_POLL_INTERVAL_MS = 500;
// Quick probe first; a listening server that misses it is usually compiling the route
// on demand. A fresh stack took 17.7 s for `GET /` and 25.6 s for a first open of
// /jira-team-eu26, so the second attempt waits up to the compile budget.
const QUICK_PROBE_TIMEOUT_MS = 4_000;
const DEFAULT_COMPILE_TIMEOUT_MS = 90_000;

function parseCompileTimeoutMs(env = process.env) {
	const configured = Number.parseInt(env.VPK_VERIFY_COMPILE_TIMEOUT_MS ?? "", 10);
	if (!Number.isFinite(configured)) return DEFAULT_COMPILE_TIMEOUT_MS;
	return Math.min(Math.max(configured, QUICK_PROBE_TIMEOUT_MS), MAX_LAUNCH_READY_TIMEOUT_MS);
}

// The one line a caller sees when the long wait starts, so a compile does not look like a hang.
function longWaitNotice(stderr) {
	return (url, timeoutMs) => {
		stderr.write(`${new URL(url).pathname} did not answer within ${QUICK_PROBE_TIMEOUT_MS / 1000} s, so Next is probably compiling it; waiting up to ${Math.round(timeoutMs / 1000)} s.\n`);
	};
}

// GET a URL on this worktree's server, giving Next time to compile it on first request.
// Returns the response plus `compiled: true` when only the longer attempt answered.
async function requestCompiling(url, {
	compileTimeoutMs = parseCompileTimeoutMs(),
	onLongWait = () => {},
	request = requestWorktreeOrigin,
} = {}) {
	const quick = await request(url, { timeoutMs: QUICK_PROBE_TIMEOUT_MS });
	if (quick.error !== "timeout") return { ...quick, compiled: false };
	onLongWait(url, compileTimeoutMs);
	const slow = await request(url, { timeoutMs: compileTimeoutMs });
	return { ...slow, compiled: slow.ok };
}

// Request a route before the browser opens it, so a first-request compile happens here,
// within the compile budget, instead of inside the browser's 35 s command limit.
async function warmRoute(url, {
	now = Date.now,
	request = requestWorktreeOrigin,
	stderr = process.stderr,
} = {}) {
	const started = now();
	const result = await requestCompiling(url, { onLongWait: longWaitNotice(stderr), request });
	const pathname = new URL(url).pathname;
	if (result.compiled) {
		stderr.write(`Compiled ${pathname} on its first request (${((now() - started) / 1000).toFixed(1)} s).\n`);
	} else if (result.error === "timeout") {
		stderr.write(`${pathname} did not answer within the compile budget (VPK_VERIFY_COMPILE_TIMEOUT_MS); opening it anyway.\n`);
	}
	return result;
}

function portListening(port) {
	if (!port) return false;
	const result = spawnSync(
		"lsof",
		["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"],
		{ stdio: "ignore" },
	);
	return result.status === 0;
}

function requestWorktreeOrigin(url, { timeoutMs = 4000 } = {}) {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (value) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};
		let parsed;
		try {
			parsed = new URL(url);
		} catch (error) {
			finish({ ok: false, status: 0, error: error.message, body: "" });
			return;
		}
		const lib = parsed.protocol === "https:" ? https : http;
		const req = lib.request(
			{
				protocol: parsed.protocol,
				hostname: parsed.hostname,
				port: parsed.port || undefined,
				path: `${parsed.pathname}${parsed.search}`,
				method: "GET",
				rejectUnauthorized: false,
				headers: { accept: "application/json, text/html;q=0.8" },
			},
			(res) => {
				const chunks = [];
				res.on("data", (chunk) => chunks.push(chunk));
				res.on("end", () => {
					finish({
						ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 400,
						status: res.statusCode ?? 0,
						error: "",
						body: Buffer.concat(chunks).toString("utf8"),
					});
				});
			},
		);
		req.setTimeout(timeoutMs, () => {
			req.destroy();
			finish({ ok: false, status: 0, error: "timeout", body: "" });
		});
		req.on("error", (error) => {
			finish({ ok: false, status: 0, error: error.message, body: "" });
		});
		req.end();
	});
}

function parseLaunchReadyTimeoutMs(env = process.env) {
	const configured = Number.parseInt(env.VPK_VERIFY_LAUNCH_TIMEOUT_MS ?? "", 10);
	if (!Number.isFinite(configured)) return DEFAULT_LAUNCH_READY_TIMEOUT_MS;
	return Math.min(
		Math.max(configured, MIN_LAUNCH_READY_TIMEOUT_MS),
		MAX_LAUNCH_READY_TIMEOUT_MS,
	);
}

function readState() {
	try {
		return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
	} catch {
		return {};
	}
}

function writeState(patch) {
	fs.mkdirSync(RUN_DIR, { recursive: true });
	const next = { ...readState(), ...patch };
	fs.writeFileSync(STATE_FILE, `${JSON.stringify(next, null, "\t")}\n`);
	return next;
}

async function collectDoctor({
	listening = portListening,
	readPort = readTrimmed,
	request = requestWorktreeOrigin,
	resolve = resolveOrigin,
	stderr = process.stderr,
} = {}) {
	const frontendPort = readPort(FRONTEND_PORT_FILE);
	const backendPort = readPort(BACKEND_PORT_FILE);
	const origin = resolve(frontendPort);
	const frontendListening = listening(frontendPort);
	const backendListening = listening(backendPort);
	const noOrigin = { ok: false, status: 0, error: "no origin", body: "", compiled: false };
	const quick = (url) => request(url, { timeoutMs: QUICK_PROBE_TIMEOUT_MS });
	// Only a listening server gets the compile budget; anything else answers or fails fast.
	const home = !origin
		? noOrigin
		: frontendListening
			? await requestCompiling(`${origin}/`, { onLongWait: longWaitNotice(stderr), request })
			: await quick(`${origin}/`);
	// At most one long wait per run: a server that never answered `/` gets only the quick
	// probe for /api/health, so a hung stack costs one compile budget, not two.
	const health = !origin
		? noOrigin
		: frontendListening && home.error !== "timeout"
			? await requestCompiling(`${origin}/api/health`, { onLongWait: longWaitNotice(stderr), request })
			: await quick(`${origin}/api/health`);
	let healthJson = null;
	try {
		healthJson = JSON.parse(health.body);
	} catch {
		healthJson = null;
	}
	const backendOk = healthJson?.status === "OK";
	const ok = Boolean(frontendPort && frontendListening && origin && home.ok);
	return {
		ok,
		worktree: REPO_ROOT,
		origin,
		frontendPort: frontendPort || null,
		frontendListening,
		frontendStatus: home.status,
		// Why `GET /` failed ("timeout" after the compile budget, a connection error), or null.
		frontendError: home.ok ? null : home.error || null,
		// True when `/` answered only after the quick probe timed out: Next was compiling it.
		frontendCompiled: Boolean(home.compiled),
		backendPort: backendPort || null,
		backendListening,
		backendStatus: health.status,
		backendOk,
		healthError: healthJson?.error || health.error || null,
	};
}

async function waitForDoctorReady({
	collect = collectDoctor,
	delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	intervalMs = LAUNCH_READY_POLL_INTERVAL_MS,
	now = Date.now,
	timeoutMs = parseLaunchReadyTimeoutMs(),
} = {}) {
	const startedAt = now();
	let report = await collect();
	while (!report.ok && now() - startedAt < timeoutMs) {
		const remainingMs = timeoutMs - (now() - startedAt);
		await delay(Math.min(intervalMs, remainingMs));
		report = await collect();
	}
	return report;
}

function printDoctor(report) {
	process.stdout.write(`${JSON.stringify(report, null, "\t")}\n`);
}

// `dev:tmux:start` exits with this when the stack did not become ready in its wait
// (scripts/lib/dev-stack-state.js EXIT_NOT_READY). The stack it launched still exists.
const DEV_TMUX_NOT_READY = 5;

// Exits on a failing status unless the caller accepts it; returns the status.
function runPnpm(args, { stdio = "inherit", acceptStatuses = [] } = {}) {
	const result = spawnSync("pnpm", args, { cwd: REPO_ROOT, stdio });
	const status = result.status ?? 1;
	if (status !== 0 && !acceptStatuses.includes(status)) {
		process.exit(status);
	}
	return status;
}

module.exports = {
	DEV_TMUX_NOT_READY,
	collectDoctor,
	parseCompileTimeoutMs,
	parseLaunchReadyTimeoutMs,
	printDoctor,
	readState,
	requestCompiling,
	requestWorktreeOrigin,
	runPnpm,
	waitForDoctorReady,
	warmRoute,
	writeState,
};
