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

async function collectDoctor() {
	const frontendPort = readTrimmed(FRONTEND_PORT_FILE);
	const backendPort = readTrimmed(BACKEND_PORT_FILE);
	const origin = resolveOrigin(frontendPort);
	const frontendListening = portListening(frontendPort);
	const backendListening = portListening(backendPort);
	const home = origin ? await requestWorktreeOrigin(`${origin}/`) : { ok: false, status: 0, error: "no origin", body: "" };
	const health = origin
		? await requestWorktreeOrigin(`${origin}/api/health`)
		: { ok: false, status: 0, error: "no origin", body: "" };
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

function runPnpm(args, { stdio = "inherit" } = {}) {
	const result = spawnSync("pnpm", args, { cwd: REPO_ROOT, stdio });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

module.exports = {
	collectDoctor,
	parseLaunchReadyTimeoutMs,
	printDoctor,
	readState,
	runPnpm,
	waitForDoctorReady,
	writeState,
};
