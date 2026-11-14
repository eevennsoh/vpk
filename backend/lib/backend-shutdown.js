"use strict";

const {
	INITIAL_BACKEND_PROCESS,
	decideSignalAction,
	transitionBackendProcess,
} = require("./backend-process-machine");

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

// Writes to a pipe are asynchronous on macOS, so exiting straight after a log line can
// drop it. Exit once both streams have flushed, or after a second at most.
function exitAfterFlush(code) {
	let pending = 2;
	const done = () => {
		pending -= 1;
		if (pending === 0) process.exit(code);
	};
	setTimeout(() => process.exit(code), 1000).unref();
	process.stdout.write("", done);
	process.stderr.write("", done);
}

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createBackendProcess requires ${name}`);
	}
	return value;
}

/**
 * Owns the backend process lifecycle and its ordered graceful shutdown.
 *
 * `getSteps()` is read when the first signal arrives, so it sees whatever resources
 * exist at that moment (a signal during startup finds no server yet). Steps run in
 * order, once; a failing step is logged and the next one still runs. One overall
 * timer bounds the whole sequence: when it fires, the process exits 1 and names the
 * steps that had not finished. A repeat signal is ignored; the third forces exit 1.
 *
 * @param {{
 *   getSteps: () => Array<{ name: string, run: () => unknown }>,
 *   timeoutMs?: number,
 *   setTimer?: typeof setTimeout,
 *   clearTimer?: typeof clearTimeout,
 *   exit?: (code: number) => void,
 *   logger?: Pick<Console, "log" | "error">,
 * }} options
 */
function createBackendProcess({
	getSteps,
	timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
	setTimer = setTimeout,
	clearTimer = clearTimeout,
	exit = exitAfterFlush,
	logger = console,
} = {}) {
	requireFunction("getSteps", getSteps);
	requireFunction("setTimer", setTimer);
	requireFunction("clearTimer", clearTimer);
	requireFunction("exit", exit);
	requireFunction("logger.log", logger?.log);
	requireFunction("logger.error", logger?.error);

	let state = INITIAL_BACKEND_PROCESS;
	let openSteps = [];
	let timer = null;

	// The transition is the guard: whichever of "all steps done", the timer, or a
	// forcing signal arrives first stops the process; the others find it stopped.
	function stop(event, message) {
		const previous = state;
		state = transitionBackendProcess(state, event);
		if (state === previous) {
			return;
		}
		if (timer !== null) {
			clearTimer(timer);
			timer = null;
		}
		(state.exitCode === 0 ? logger.log : logger.error)(message);
		exit(state.exitCode);
	}

	const stillOpen = () => (openSteps.length > 0 ? openSteps.join(", ") : "nothing");

	async function drain(signal) {
		const steps = getSteps();
		openSteps = steps.map((step) => step.name);
		logger.log(`[SHUTDOWN] ${signal}: draining (${openSteps.join(" -> ")}), timeout ${timeoutMs}ms`);
		timer = setTimer(() => {
			timer = null;
			stop({ type: "TIMED_OUT" }, `[SHUTDOWN] timed out after ${timeoutMs}ms; still open: ${stillOpen()}; exiting 1`);
		}, timeoutMs);
		timer?.unref?.();

		for (const step of steps) {
			if (state.status !== "draining") {
				return;
			}
			try {
				const detail = await step.run();
				logger.log(`[SHUTDOWN] ${step.name}: done${detail ? ` (${detail})` : ""}`);
			} catch (error) {
				logger.error(`[SHUTDOWN] ${step.name}: failed: ${error?.message ?? error}`);
			}
			openSteps = openSteps.filter((name) => name !== step.name);
		}
		stop({ type: "DRAINED" }, "[SHUTDOWN] complete; exiting 0");
	}

	function handleSignal(signal) {
		state = transitionBackendProcess(state, { type: "SIGNAL" });
		const { action } = decideSignalAction(state);
		if (action === "drain") {
			void drain(signal);
		} else if (action === "ignore") {
			logger.log(`[SHUTDOWN] ${signal} again: already draining; send it once more to force exit`);
		} else if (action === "force-exit") {
			stop({ type: "FORCED" }, `[SHUTDOWN] ${signal} received ${state.signals} times; still open: ${stillOpen()}; exiting 1`);
		}
	}

	// Returns false when shutdown began before listen completed: the caller must not
	// start serving.
	function markListening() {
		state = transitionBackendProcess(state, { type: "LISTENING" });
		return state.status === "listening";
	}

	return {
		getStatus: () => state.status,
		handleSignal,
		isStarting: () => state.status === "starting",
		markListening,
	};
}

const DRAINING_RESPONSE_BODY = JSON.stringify({ error: "The backend is shutting down." });

/**
 * Wraps the server's request handler. Once shutdown has begun, `server.close()` stops new
 * connections, but a keep-alive connection that was busy stays open and can carry another
 * request after runs were aborted. Such a request gets 503 and `Connection: close`, so it
 * starts no work and the connection ends with its response.
 * @param {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void} handler
 * @param {{ isDraining: () => boolean }} options
 */
function refuseRequestsWhileDraining(handler, { isDraining } = {}) {
	requireFunction("handler", handler);
	requireFunction("isDraining", isDraining);
	return (req, res) => {
		if (!isDraining()) {
			handler(req, res);
			return;
		}
		res.writeHead(503, {
			Connection: "close",
			"Content-Length": Buffer.byteLength(DRAINING_RESPONSE_BODY),
			"Content-Type": "application/json; charset=utf-8",
		});
		res.end(DRAINING_RESPONSE_BODY);
	};
}

/**
 * The HTTP server's two steps: stop accepting first, close what is left last.
 * @param {{ getServer: () => import("node:http").Server | null, getWebSocketServers?: () => Array<{ clients: Set<{ terminate(): void }> }>, getStopHeartbeat?: () => ((() => void) | null) }} options
 */
function createHttpServerShutdownSteps({ getServer, getWebSocketServers = () => [], getStopHeartbeat = () => null } = {}) {
	let closed = null;

	return {
		stopAccepting: {
			name: "stop-accepting",
			run: () => {
				const server = getServer();
				if (!server?.listening) {
					return "not listening";
				}
				closed = new Promise((resolve) => server.close(() => resolve()));
				server.closeIdleConnections?.();
				return "listener closed";
			},
		},
		closeConnections: {
			name: "close-connections",
			run: async () => {
				getStopHeartbeat()?.();
				let sockets = 0;
				for (const webSocketServer of getWebSocketServers()) {
					for (const client of webSocketServer.clients) {
						client.terminate();
						sockets += 1;
					}
				}
				const server = getServer();
				server?.closeAllConnections?.();
				if (closed) {
					await closed;
				}
				return `${sockets} websocket(s) closed`;
			},
		},
	};
}

/**
 * The runtime's steps, between the server's two: abort in-flight runs, close browser
 * workspaces, mirror browsers and the Chromium preview, shut the Rovo pool. Each step
 * is idempotent: run again, it finds nothing left to close.
 */
function createRuntimeShutdownSteps({
	activeRequests,
	browserWorkspaceManager,
	chromiumPreviewManager,
	closeAllMirrorBrowsers,
	shutdownRovoPool,
} = {}) {
	if (!(activeRequests instanceof Map)) {
		throw new Error("createRuntimeShutdownSteps requires activeRequests");
	}
	requireFunction("browserWorkspaceManager.closeAllWorkspaces", browserWorkspaceManager?.closeAllWorkspaces);
	requireFunction("closeAllMirrorBrowsers", closeAllMirrorBrowsers);
	requireFunction("chromiumPreviewManager.close", chromiumPreviewManager?.close);
	requireFunction("shutdownRovoPool", shutdownRovoPool);

	return [
		{
			name: "abort-runs",
			run: () => {
				let aborted = 0;
				for (const request of activeRequests.values()) {
					if (request?.abortController && !request.abortController.signal?.aborted) {
						request.abortController.abort();
						aborted += 1;
					}
				}
				return `${aborted} aborted`;
			},
		},
		{
			name: "close-browser-workspaces",
			// Includes workspaces another caller is already closing, so the
			// process does not exit while their browsers are still open.
			run: async () => `${await browserWorkspaceManager.closeAllWorkspaces()} closed`,
		},
		{
			name: "close-mirror-browsers",
			run: async () => `${await closeAllMirrorBrowsers()} closed`,
		},
		{
			name: "close-chromium-preview",
			run: async () => ((await chromiumPreviewManager.close()) ? "closed" : "none open"),
		},
		{
			name: "shutdown-rovo-pool",
			run: () => {
				shutdownRovoPool();
			},
		},
	];
}

module.exports = {
	DEFAULT_SHUTDOWN_TIMEOUT_MS,
	createBackendProcess,
	createHttpServerShutdownSteps,
	createRuntimeShutdownSteps,
	refuseRequestsWhileDraining,
};
