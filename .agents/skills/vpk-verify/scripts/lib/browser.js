"use strict";

// Worktree-scoped agent-browser resolution, session handling and failure reporting.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { EVIDENCE_DIR, REPO_ROOT } = require("./repo.js");

const SESSION_PREFIX = "vpk-verify";
const DEFAULT_BROWSER_TIMEOUT_MS = 35_000;
const MIN_BROWSER_TIMEOUT_MS = 1_000;
const MAX_BROWSER_TIMEOUT_MS = 300_000;

function resolveAgentBrowserBin(repoRoot = REPO_ROOT) {
	let packageJsonPath;
	try {
		packageJsonPath = require.resolve("agent-browser/package.json", { paths: [repoRoot] });
	} catch {
		throw new Error(
			"agent-browser is not installed in this worktree. Run `pnpm install` from the repo root.",
		);
	}
	const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
	const binField = pkg.bin;
	const relativeBin = typeof binField === "string"
		? binField
		: binField && typeof binField === "object"
			? binField["agent-browser"]
			: undefined;
	if (typeof relativeBin !== "string" || relativeBin.length === 0) {
		throw new Error("agent-browser package.json is missing a bin.agent-browser entry.");
	}
	const binPath = path.resolve(path.dirname(packageJsonPath), relativeBin);
	if (!fs.existsSync(binPath)) {
		throw new Error(
			`agent-browser bin is missing at ${binPath}. Run \`pnpm install\` from the repo root.`,
		);
	}
	return binPath;
}

function parseBrowserTimeoutMs(env = process.env) {
	const configured = Number.parseInt(env.VPK_VERIFY_BROWSER_TIMEOUT_MS ?? "", 10);
	if (!Number.isFinite(configured)) return DEFAULT_BROWSER_TIMEOUT_MS;
	return Math.min(Math.max(configured, MIN_BROWSER_TIMEOUT_MS), MAX_BROWSER_TIMEOUT_MS);
}

function runAgentBrowser(args, options = {}) {
	const {
		binPath = resolveAgentBrowserBin(),
		timeoutMs = parseBrowserTimeoutMs(),
		...spawnOptions
	} = options;
	return spawnSync(binPath, args, {
		cwd: REPO_ROOT,
		killSignal: "SIGTERM",
		timeout: timeoutMs,
		...spawnOptions,
	});
}

function failureText(failure) {
	if (failure instanceof Error) return failure.message;
	return [failure?.stdout, failure?.stderr, failure?.error?.message]
		.filter(Boolean)
		.map(String)
		.join("\n");
}

function classifyAgentBrowserFailure(failure) {
	if (!failure) return "assertion_failure";
	if (["timeout", "stale_session", "missing_binary", "assertion_failure"].includes(failure.classification)) {
		return failure.classification;
	}
	if (failure?.error?.code === "ETIMEDOUT") return "timeout";
	if (!(failure instanceof Error) && failure.status === 0) return null;
	const text = failureText(failure);
	if (/not installed in this worktree|bin is missing|missing a bin\.agent-browser|ENOENT/iu.test(text)) {
		return "missing_binary";
	}
	// "Failed to connect … (os error 2)" is the daemon socket left behind by a killed or timed-out run.
	if (/no browser session|session (?:is )?not found|browser session.*(?:closed|missing)|about:blank|could not configure browser: failed to connect/iu.test(text)) {
		return "stale_session";
	}
	return "assertion_failure";
}

function isBrowserSessionStarter(forwarded) {
	return forwarded[0] === "open" || forwarded[0] === "connect";
}

function inspectBrowserSession(runCommand, runOptions, session) {
	let result;
	try {
		result = runCommand(
			["--session", session, "session", "info", "--json"],
			runOptions,
		);
	} catch (error) {
		return { classification: classifyAgentBrowserFailure(error), result: error };
	}
	const commandClassification = classifyAgentBrowserFailure(result);
	if (commandClassification !== null) {
		return { classification: commandClassification, result };
	}

	let payload;
	try {
		payload = JSON.parse(result.stdout);
	} catch {
		return {
			classification: "assertion_failure",
			result: {
				...result,
				stderr: "agent-browser session info did not return valid JSON.",
			},
		};
	}
	const info = payload?.data;
	const active = info?.active === true
		&& info?.runtime?.browserLaunched === true
		&& Number(info?.runtime?.pageCount) > 0;
	if (active) return { classification: null, result };
	return {
		classification: "stale_session",
		result: {
			...result,
			status: 1,
			stderr: "The scoped agent-browser session has no active page. Run `control-vpk browser open <url>` before non-navigation commands.",
		},
	};
}

function executeBrowserCommand(forwarded, {
	runCommand = runAgentBrowser,
	session,
	timeoutMs = parseBrowserTimeoutMs(),
} = {}) {
	const commandArgs = ["--session", session, ...forwarded];
	const runOptions = {
		encoding: "utf8",
		env: {
			...process.env,
			AGENT_BROWSER_SESSION: session,
			AGENT_BROWSER_RESTORE: session,
		},
		stdio: ["inherit", "pipe", "pipe"],
		timeoutMs,
	};
	const invoke = () => {
		try {
			return runCommand(commandArgs, runOptions);
		} catch (error) {
			return error;
		}
	};
	const closeScopedSession = () => {
		try {
			runCommand(["--session", session, "close"], {
				...runOptions,
				stdio: "ignore",
				timeoutMs: Math.min(timeoutMs, 5_000),
			});
		} catch {
			// Best-effort cleanup must never expand beyond this worktree-scoped session.
		}
	};
	const sessionStarter = isBrowserSessionStarter(forwarded);
	if (!sessionStarter) {
		const preflight = inspectBrowserSession(runCommand, runOptions, session);
		if (preflight.classification !== null) {
			return {
				classification: preflight.classification,
				recoveredFromStaleSession: false,
				result: preflight.result,
				session,
				sessionStarter,
				timeoutMs,
			};
		}
	}

	let result = invoke();
	let classification = classifyAgentBrowserFailure(result);
	let recoveredFromStaleSession = false;
	if (classification === "stale_session" && sessionStarter) {
		closeScopedSession();
		result = invoke();
		classification = classifyAgentBrowserFailure(result);
		recoveredFromStaleSession = classification === null;
		if (classification === "stale_session" || classification === "timeout") {
			closeScopedSession();
		}
	} else if (classification === "stale_session" || classification === "timeout") {
		closeScopedSession();
	}

	return {
		classification,
		recoveredFromStaleSession,
		result,
		session,
		sessionStarter,
		timeoutMs,
	};
}

function quotedCommand(args) {
	return ["agent-browser", ...args.map((arg) => JSON.stringify(arg))].join(" ");
}

function formatBrowserFailure(outcome, forwarded) {
	const classification = outcome.classification ?? "assertion_failure";
	const detail = failureText(outcome.result).trim() || "agent-browser exited without a diagnostic.";
	const recovery = classification === "stale_session" && !outcome.sessionStarter
		? "Recovery: reopen the scoped browser at the feature entrypoint, wait for its route marker, and revalidate before retrying this command."
		: "Playwright fallback: load the Playwright skill, then run the narrow `corepack pnpm exec playwright test <spec>` proof path and report this agent-browser failure.";
	return [
		`control-vpk browser failure [${classification}]`,
		`failed command: ${quotedCommand(forwarded)}`,
		`detail: ${detail}`,
		`Existing evidence retained at ${EVIDENCE_DIR}; this failed command is not accepted as proof.`,
		recovery,
	].join("\n");
}

function writeCapturedOutput(result) {
	if (!result || result instanceof Error) return;
	if (result.stdout) process.stdout.write(result.stdout);
	if (result.stderr) process.stderr.write(result.stderr);
}

function browserSessionId({ timeoutMs = parseBrowserTimeoutMs() } = {}) {
	const result = runAgentBrowser(
		["session", "id", "--scope", "worktree", "--prefix", SESSION_PREFIX],
		{ encoding: "utf8", timeoutMs },
	);
	if (result.status !== 0) {
		const classification = classifyAgentBrowserFailure(result);
		throw Object.assign(new Error(
			`agent-browser session id failed [${classification}]: ${result.stderr?.trim()
				|| result.error?.message
				|| "Run `pnpm install` from the repo root, then retry."}`,
		), { classification });
	}
	return result.stdout.trim();
}

function closeBrowserSessionBestEffort() {
	let session = "";
	try {
		session = browserSessionId();
	} catch {
		return;
	}
	runAgentBrowser(["--session", session, "close"], { stdio: "ignore" });
}

module.exports = {
	browserSessionId,
	classifyAgentBrowserFailure,
	closeBrowserSessionBestEffort,
	executeBrowserCommand,
	failureText,
	formatBrowserFailure,
	isBrowserSessionStarter,
	parseBrowserTimeoutMs,
	quotedCommand,
	resolveAgentBrowserBin,
	runAgentBrowser,
	writeCapturedOutput,
};
