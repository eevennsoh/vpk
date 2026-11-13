"use strict"

// One agent-browser command with a bound of our own (BE-F1). Without one, a daemon that
// never answers holds the workspace's queue, so a close queued behind it stays
// "closing" and keeps one of the live-workspace slots.

// agent-browser's own limits (installed README, "Default Timeout"): the daemon gives up on
// an operation after 25 s, and the CLI stops reading the daemon's answer after 30 s. The
// CLI then retries read-only commands itself; a command that changes the page is not
// re-sent and fails with `outcome_unknown`. Our bounds sit clearly above those limits, so
// whenever the CLI answers (success or its own error) its answer wins, and ours only ends
// a CLI that never returns.
const AGENT_BROWSER_DAEMON_OPERATION_TIMEOUT_MS = 25_000
const AGENT_BROWSER_CLI_READ_TIMEOUT_MS = 30_000
// The README does not say how many times a read-only command is retried; three CLI reads
// is an assumption, not a measured value.
const ASSUMED_READ_ONLY_ATTEMPTS = 3
const MARGIN_MS = 15_000

// Provisional bounds per command class.
const AGENT_BROWSER_CALL_TIMEOUT_MS = Object.freeze({
	// Changes the page or the browser: one CLI read plus a margin.
	default: AGENT_BROWSER_CLI_READ_TIMEOUT_MS + MARGIN_MS,
	// Waits on a navigation, which can take the daemon's whole operation timeout before the
	// page answers; open has its own recovery for agent-browser's timeout error.
	navigation: 60_000,
	// Read-only, retried by the CLI.
	readOnly: ASSUMED_READ_ONLY_ATTEMPTS * AGENT_BROWSER_CLI_READ_TIMEOUT_MS + MARGIN_MS,
})

const NAVIGATION_COMMANDS = new Set(["open", "reload", "back", "forward"])
// Commands that only read; `tab` with no subcommand lists tabs. A screenshot changes no
// page, and is treated as read-only so a slow capture is not mistaken for a hang.
const READ_ONLY_COMMANDS = new Set(["snapshot", "url", "get", "title", "screenshot", "is"])

/**
 * The bound for one agent-browser command, from its arguments (without --json/--session).
 * @param {ReadonlyArray<unknown>} args
 * @returns {number}
 */
function resolveAgentBrowserCallTimeoutMs(args) {
	const [command, subcommand] = args.map((value) => String(value))
	if (NAVIGATION_COMMANDS.has(command) || (command === "tab" && subcommand === "new")) {
		return AGENT_BROWSER_CALL_TIMEOUT_MS.navigation
	}
	if (READ_ONLY_COMMANDS.has(command) || (command === "tab" && subcommand === undefined) || (command === "stream" && subcommand === "status")) {
		return AGENT_BROWSER_CALL_TIMEOUT_MS.readOnly
	}
	return AGENT_BROWSER_CALL_TIMEOUT_MS.default
}

const AGENT_BROWSER_CALL_TIMEOUT_CODE = "AGENT_BROWSER_CALL_TIMEOUT"

// The message avoids "timed out": isOperationTimedOutError reads that as agent-browser's
// own page-load timeout and retries, which a daemon that stopped answering cannot serve.
class AgentBrowserCallTimeoutError extends Error {
	/**
	 * @param {string} command
	 * @param {number} timeoutMs
	 */
	constructor(command, timeoutMs) {
		super(`agent-browser ${command} did not answer within ${timeoutMs} ms`)
		this.name = "AgentBrowserCallTimeoutError"
		this.code = AGENT_BROWSER_CALL_TIMEOUT_CODE
		this.command = command
		this.timeoutMs = timeoutMs
	}
}

function isAgentBrowserCallTimeoutError(error) {
	return error instanceof AgentBrowserCallTimeoutError
}

/**
 * Runs `file args` through a callback-style execFile and settles with its trimmed stdout,
 * or rejects with the execFile error (carrying stdout and stderr, as promisify(execFile)
 * does), or, past the command's bound, kills the child and rejects with an
 * AgentBrowserCallTimeoutError after calling onTimeout with it.
 * @param {{
 *   args: ReadonlyArray<unknown>,
 *   commandArgs: string[],
 *   execFileImpl: typeof import("node:child_process").execFile,
 *   file: string,
 *   onTimeout?: (error: AgentBrowserCallTimeoutError) => void,
 *   options: import("node:child_process").ExecFileOptions,
 *   timers: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout },
 * }} call
 * @returns {Promise<string>}
 */
function runBoundedAgentBrowserCall({ args, commandArgs, execFileImpl, file, onTimeout, options, timers }) {
	const command = String(args[0] ?? "command")
	const timeoutMs = resolveAgentBrowserCallTimeoutMs(args)
	return new Promise((resolve, reject) => {
		let settled = false
		/** @type {ReturnType<typeof setTimeout> | undefined} */
		let timer
		const child = execFileImpl(file, commandArgs, options, (error, stdout, stderr) => {
			if (settled) return
			settled = true
			timers.clearTimeout(timer)
			if (error) {
				reject(Object.assign(error, { stdout, stderr }))
				return
			}
			resolve(String(stdout).trim())
		})
		timer = timers.setTimeout(() => {
			if (settled) return
			settled = true
			try {
				child?.kill?.("SIGKILL")
			} catch {}
			const timeoutError = new AgentBrowserCallTimeoutError(command, timeoutMs)
			onTimeout?.(timeoutError)
			reject(timeoutError)
		}, timeoutMs)
	})
}

/**
 * The bounded command runner one runtime uses. After a command does not answer, onCrash
 * is called once and every later command but `close` fails at once with that error;
 * `close` is still sent (bounded too), so the release can stop the browser.
 * @param {{
 *   execFileImpl: typeof import("node:child_process").execFile,
 *   file: string,
 *   onCrash?: ((reason: string) => void) | null,
 *   timers?: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout },
 * }} options
 */
function createAgentBrowserCaller({ execFileImpl, file, onCrash = null, timers = { setTimeout, clearTimeout } }) {
	/** @type {AgentBrowserCallTimeoutError | null} */
	let unresponsive = null
	const markUnresponsive = (error) => {
		if (unresponsive) return
		unresponsive = error
		if (typeof onCrash === "function") onCrash(error.message)
	}
	return {
		hasTimedOut: () => unresponsive !== null,
		/** @param {ReadonlyArray<unknown>} args */
		assertAnswering(args) {
			if (unresponsive && String(args[0]) !== "close") throw unresponsive
		},
		/** @param {{ args: ReadonlyArray<unknown>, commandArgs: string[], options: import("node:child_process").ExecFileOptions }} call */
		call({ args, commandArgs, options }) {
			return runBoundedAgentBrowserCall({ args, commandArgs, execFileImpl, file, onTimeout: markUnresponsive, options, timers })
		},
	}
}

module.exports = {
	AGENT_BROWSER_CALL_TIMEOUT_CODE,
	AGENT_BROWSER_CALL_TIMEOUT_MS,
	AGENT_BROWSER_CLI_READ_TIMEOUT_MS,
	AGENT_BROWSER_DAEMON_OPERATION_TIMEOUT_MS,
	AgentBrowserCallTimeoutError,
	createAgentBrowserCaller,
	isAgentBrowserCallTimeoutError,
	resolveAgentBrowserCallTimeoutMs,
	runBoundedAgentBrowserCall,
}
