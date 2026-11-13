#!/usr/bin/env node

"use strict";

// `pnpm run doctor [--json]`: one read-only answer to "is this worktree ready to work in?"
// Toolchain preflight, this worktree's ports, its dev stack, the env settings the backend
// sees, and /api/health. It starts, stops and writes nothing.
//
// Env files are checked by name only; nothing here opens them. Listing their keys would
// mean reading the values too, so per-setting SET/MISSING comes from the running backend's
// /api/health, which reports each setting without its value. With no backend running, only
// the files' presence is known.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_FILES = [".env.local", ".env"];
const TMUX_SOCKET = "vpk-dev";
const TMUX_CANDIDATES = ["/opt/homebrew/bin/tmux", "/usr/local/bin/tmux", "/usr/bin/tmux"];

function summarizePreflight(report) {
	return {
		ok: report.failures.length === 0,
		node: report.nodeVersion,
		pnpm: report.pnpm?.version ?? null,
		// The pin without its integrity hash.
		packageManager: report.packageManager?.split("+")[0] ?? null,
		failures: report.failures.map(({ message, remediation }) => (remediation ? `${message} ${remediation}` : message)),
		warnings: report.warnings.map(({ message }) => message),
	};
}

// Each value is "SET" or "MISSING" (or a non-secret kind label); never a value from the env.
function envSettingsFromHealth(health) {
	if (!health || typeof health !== "object") return null;
	const settings = {};
	for (const [key, value] of Object.entries({ ...health.envCheck, ...health.llmRouting?.aiGatewayConfig })) {
		if (/^(SET|MISSING)$/u.test(String(value))) settings[key] = value;
	}
	return settings;
}

function parseJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

async function collectDoctorReport({
	repoRoot = REPO_ROOT,
	envFileExists = (name) => fs.existsSync(path.join(repoRoot, name)),
	getPortInfo = () => require("./lib/worktree-ports").getPortInfo(),
	logFile = path.join(repoRoot, "output", "logs", path.basename(repoRoot), "dev.log"),
	preflight = () => require("./validate-local-preflight").createPreflightReport({ cwd: repoRoot }),
	readPortFile = (name) => {
		try {
			return fs.readFileSync(path.join(repoRoot, name), "utf8").trim() || null;
		} catch {
			return null;
		}
	},
	requestHealth = (url) => require("../.agents/skills/vpk-verify/scripts/lib/stack.js").requestWorktreeOrigin(url),
	stack = () => require("../.agents/skills/vpk-verify/scripts/lib/stack.js").collectDoctor(),
	tmuxSessions = listTmuxSessions,
} = {}) {
	const preflightReport = summarizePreflight(preflight());
	const portInfo = getPortInfo();
	const stackReport = await stack();
	const sessions = tmuxSessions().filter((session) => session.path === repoRoot).map((session) => session.name);
	const health = stackReport.origin ? await requestHealth(`${stackReport.origin}/api/health`) : null;
	const healthJson = health ? parseJson(health.body) : null;

	const report = {
		worktree: repoRoot,
		preflight: preflightReport,
		ports: {
			worktreeName: portInfo.worktreeName,
			slot: portInfo.slot,
			reserved: { frontend: portInfo.frontendBase, backend: portInfo.backendBase, rovo: portInfo.rovoBase },
			running: { frontend: readPortFile(".dev-frontend-port"), backend: readPortFile(".dev-backend-port") },
		},
		stack: {
			ok: stackReport.ok,
			origin: stackReport.origin || null,
			tmuxSessions: sessions,
			frontendListening: stackReport.frontendListening,
			frontendStatus: stackReport.frontendStatus,
			backendListening: stackReport.backendListening,
			log: fs.existsSync(logFile) ? logFile : null,
		},
		env: {
			files: Object.fromEntries(ENV_FILES.map((name) => [name, envFileExists(name) ? "present" : "absent"])),
			settings: envSettingsFromHealth(healthJson),
			settingsSource: healthJson ? "/api/health" : "unavailable: the backend is not answering, so only file presence is known",
		},
		health: {
			ok: healthJson?.status === "OK",
			status: health?.status ?? null,
			error: healthJson ? null : (health?.error || (health ? "response was not JSON" : "no origin")),
		},
	};
	report.ok = report.preflight.ok && report.stack.ok && report.health.ok;
	return report;
}

function resolveTmux(env = process.env) {
	return [env.VPK_TMUX_BIN, ...TMUX_CANDIDATES].find((candidate) => candidate && fs.existsSync(candidate)) ?? "tmux";
}

function listTmuxSessions() {
	const result = spawnSync(resolveTmux(), ["-L", TMUX_SOCKET, "list-sessions", "-F", "#{session_name}|#{session_path}"], { encoding: "utf8" });
	if (result.status !== 0) return [];
	return result.stdout.split("\n").filter(Boolean).map((line) => {
		const [name, sessionPath] = line.split("|");
		return { name, path: sessionPath };
	});
}

function formatDoctorReport(report) {
	const mark = (ok) => (ok ? "ok  " : "FAIL");
	const lines = [`doctor ${report.worktree}`];
	lines.push(`${mark(report.preflight.ok)} preflight  node ${report.preflight.node}, pnpm ${report.preflight.pnpm ?? "?"} (pin ${report.preflight.packageManager ?? "?"})`);
	for (const failure of report.preflight.failures) lines.push(`       ${failure}`);
	for (const warning of report.preflight.warnings) lines.push(`       warning: ${warning}`);
	const { reserved, running } = report.ports;
	lines.push(`     ports      slot ${report.ports.slot} (${report.ports.worktreeName}): frontend ${reserved.frontend}, backend ${reserved.backend}, rovo ${reserved.rovo}; running frontend ${running.frontend ?? "-"}, backend ${running.backend ?? "-"}`);
	const sessions = report.stack.tmuxSessions.length > 0 ? report.stack.tmuxSessions.join(", ") : "none";
	lines.push(`${mark(report.stack.ok)} stack      ${report.stack.origin ?? "no origin"}; tmux ${sessions}; frontend ${report.stack.frontendListening ? `listening, GET / ${report.stack.frontendStatus || "no answer"}` : "not listening"}`);
	if (report.stack.log) lines.push(`       log ${report.stack.log}`);
	const files = Object.entries(report.env.files).map(([name, state]) => `${name} ${state}`).join(", ");
	lines.push(`     env        ${files}`);
	if (report.env.settings) {
		for (const [key, value] of Object.entries(report.env.settings)) lines.push(`       ${key}: ${value}`);
	} else {
		lines.push(`       settings ${report.env.settingsSource}`);
	}
	lines.push(`${mark(report.health.ok)} health     /api/health ${report.health.ok ? "OK" : (report.health.error ?? `status ${report.health.status}`)}`);
	if (!report.stack.ok) lines.push("next   pnpm run dev:tmux:start");
	return `${lines.join("\n")}\n`;
}

async function main(argv = process.argv.slice(2)) {
	const unknown = argv.filter((arg) => arg !== "--json");
	if (unknown.length > 0) {
		process.stderr.write(`Usage: pnpm run doctor [--json]\nUnknown argument: ${unknown[0]}\n`);
		process.exitCode = 2;
		return;
	}
	const report = await collectDoctorReport();
	process.stdout.write(argv.includes("--json") ? `${JSON.stringify(report, null, "\t")}\n` : formatDoctorReport(report));
	if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
	main();
}

module.exports = {
	collectDoctorReport,
	envSettingsFromHealth,
	formatDoctorReport,
	main,
};
