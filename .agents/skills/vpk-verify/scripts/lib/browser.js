"use strict";

// Worktree-scoped agent-browser resolution, session handling and failure reporting.

const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { classifyBrowserRecord, findBrowserRecord, listBrowserRecords, noteBrowserUse, readProcess, removeBrowserRecord } = require("./browser-registry.js");
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

function browserSessionId({ timeoutMs = parseBrowserTimeoutMs(), env = process.env, runCommand = runAgentBrowser } = {}) {
	const result = runCommand(
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
	const worktreeSession = result.stdout.trim();
	const owner = env.CODEX_THREAD_ID || env.CLAUDE_CODE_SESSION_ID;
	if (!owner) return worktreeSession;
	const suffix = createHash("sha256").update(owner).digest("hex").slice(0, 12);
	return `${worktreeSession}-${suffix}`;
}

const ALREADY_CLOSED = /no browser session|session (?:is )?not found|not running|no such file|failed to connect/iu;

function closeSucceeded(result) {
	return Boolean(result) && !(result instanceof Error) && (result.status === 0 || ALREADY_CLOSED.test(failureText(result)));
}

// Forgets this chat's record only once the browser is closed; after a failed or timed-out close
// the record stays, so the SessionStart hook and the sweep retry it.
// Forgets this chat's record only once the browser is closed; after a failed or timed-out close
// the record stays, so the SessionStart hook and the sweep retry it.
function closeBrowserSessionBestEffort({
	closeRecorded = closeRecordedBrowser,
	findRecord = (session) => findBrowserRecord(session),
	forget = (session) => removeBrowserRecord(session),
	resolveSession = browserSessionId,
	runCommand = runAgentBrowser,
} = {}) {
	let session = "";
	try {
		session = resolveSession();
	} catch {
		return false;
	}
	let record = null;
	try {
		record = findRecord(session);
	} catch {
		// No shared git directory: nothing was recorded.
	}
	let closed;
	if (record) {
		closed = closeRecorded(record, { runCommand }).closed;
	} else {
		let result;
		try {
			result = runCommand(["--session", session, "close"], { encoding: "utf8" });
		} catch (error) {
			result = error;
		}
		closed = closeSucceeded(result);
	}
	if (!closed) return false;
	try {
		forget(session);
	} catch {
		// No shared git directory: nothing was recorded either.
	}
	return true;
}

// The session's daemon pid (from `session info`) with its start time, so cleanup can prove the
// browser is gone instead of trusting the close command's error text. Null when unavailable.
function readDaemon(session, { read = readProcess, runCommand = runAgentBrowser } = {}) {
	try {
		const result = runCommand(["--session", session, "session", "info", "--json"], { encoding: "utf8", timeoutMs: 10_000 });
		const pid = Number(JSON.parse(result.stdout)?.data?.pid);
		if (!Number.isInteger(pid) || pid <= 0) return null;
		const info = read(pid);
		return info ? { pid, startedAt: info.startedAt, name: info.name } : null;
	} catch {
		return null;
	}
}

// Recording must never fail the browser command it follows.
function noteBrowserUseBestEffort(session, options = {}) {
	try {
		noteBrowserUse(session, options.started ? { ...options, daemon: readDaemon(session) } : options);
	} catch (error) {
		process.stderr.write(`control-vpk: could not record browser session ${session}: ${error.message}\n`);
	}
}

const PARKED_URL = "data:text/html,%3Ctitle%3Eparked%20by%20control-vpk%3C%2Ftitle%3E";

// Navigates the scoped page to a static document so an animated route stops using CPU between
// checks. The session stays open; the next `open-target`, `capture` or `browser open` resumes.
function parkBrowserSession(session, options = {}) {
	return executeBrowserCommand(["open", PARKED_URL], { session, ...options });
}

const DAEMON_EXIT_WAIT_MS = 15_000; // a daemon shutting Chrome down under load took over 5 s

// Bounded wait on a condition, polling every 50 ms.
function waitUntil(condition, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while (!condition()) {
		if (Date.now() > deadline) return false;
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
	}
	return true;
}

function childPids(pid) {
	const result = spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
	return result.status === 0 ? result.stdout.split("\n").map(Number).filter((child) => child > 0) : [];
}

function descendantPids(pid, children = childPids) {
	return children(pid).flatMap((child) => [child, ...descendantPids(child, children)]);
}

function signalPid(pid, signal) {
	try {
		process.kill(pid, signal);
	} catch {
		// Exited meanwhile.
	}
}

// Closes a recorded browser and returns { closed, detail }. When the daemon's pid was recorded,
// closed means that pid is gone (or now belongs to another process): a daemon that is alive but
// not answering its socket reports "failed to connect", which is not proof it ended. A daemon still
// alive after the close is ended by pid (TERM to it and its descendants, CONT so a stopped one can
// act on it), only after checking it is the recorded agent-browser process.
function closeRecordedBrowser(record, {
	children = childPids,
	read = readProcess,
	runCommand = runAgentBrowser,
	signal = signalPid,
	wait = waitUntil,
	waitMs = DAEMON_EXIT_WAIT_MS,
} = {}) {
	const env = { ...process.env };
	delete env.AGENT_BROWSER_SESSION;
	delete env.AGENT_BROWSER_RESTORE;
	if (record.namespace) env.AGENT_BROWSER_NAMESPACE = record.namespace;
	else delete env.AGENT_BROWSER_NAMESPACE;
	let binPath;
	try {
		binPath = resolveAgentBrowserBin(record.worktree);
	} catch {
		binPath = resolveAgentBrowserBin();
	}
	let result;
	try {
		result = runCommand(["--session", record.session, "close"], { binPath, encoding: "utf8", env, timeoutMs: Math.min(15_000, parseBrowserTimeoutMs()) });
	} catch (error) {
		result = error;
	}
	const daemon = record.daemon;
	if (!daemon?.pid) return { closed: closeSucceeded(result) };
	const sameDaemon = () => {
		const info = read(daemon.pid);
		return Boolean(info && info.startedAt === daemon.startedAt);
	};
	if (wait(() => !sameDaemon(), waitMs)) return { closed: true };
	const info = read(daemon.pid);
	if (!info || info.startedAt !== daemon.startedAt) return { closed: true };
	if (!String(info.name).startsWith("agent-browser")) {
		return { closed: false, detail: `pid ${daemon.pid} is not an agent-browser daemon (${info.name}); not signalled` };
	}
	const pids = [daemon.pid, ...descendantPids(daemon.pid, children)];
	for (const pid of pids) signal(pid, "SIGTERM");
	for (const pid of pids) signal(pid, "SIGCONT");
	if (wait(() => !sameDaemon(), waitMs)) return { closed: true, detail: `ended daemon pid ${daemon.pid} and ${pids.length - 1} descendant(s) by pid` };
	return { closed: false, detail: `daemon pid ${daemon.pid} still running after SIGTERM` };
}

// Closes every recorded browser whose owner is gone or that has sat unused past the limit, and
// forgets it. Returns one line per record, kept or closed, with the reason.
function closeOrphanedBrowsers({
	classify = classifyBrowserRecord,
	close = closeRecordedBrowser,
	dryRun = false,
	records = listBrowserRecords(),
	remove = (entry) => fs.rmSync(entry.file, { force: true }),
} = {}) {
	return records.map((entry) => {
		const { record } = entry;
		const label = `${record.session}${record.namespace ? ` (namespace ${record.namespace})` : ""} from ${record.worktree}`;
		const verdict = classify(record);
		if (verdict.action === "keep") return `kept browser ${label}: ${verdict.reason}`;
		if (dryRun) return `would close browser ${label}: ${verdict.reason}`;
		let outcome = { closed: false };
		try {
			outcome = close(record);
		} catch {
			// Missing binary or a timeout: keep the record so the next cleanup retries.
		}
		const detail = outcome.detail ? ` (${outcome.detail})` : "";
		if (!outcome.closed) return `FAILED to close browser ${label}: ${verdict.reason}${detail}`;
		remove(entry);
		return `closed browser ${label}: ${verdict.reason}${detail}`;
	});
}

module.exports = {
	browserSessionId,
	classifyAgentBrowserFailure,
	closeBrowserSessionBestEffort,
	closeOrphanedBrowsers,
	closeRecordedBrowser,
	descendantPids,
	executeBrowserCommand,
	failureText,
	noteBrowserUseBestEffort,
	PARKED_URL,
	parkBrowserSession,
	readDaemon,
	formatBrowserFailure,
	isBrowserSessionStarter,
	parseBrowserTimeoutMs,
	quotedCommand,
	resolveAgentBrowserBin,
	runAgentBrowser,
	writeCapturedOutput,
};
