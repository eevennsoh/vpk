const { spawn } = require("node:child_process");

const DEFAULT_RESTART_DELAY_MS = 1_500;

function subscribeProcessSignals(signalTarget, forwardSignal) {
	const listeners = new Map(["SIGINT", "SIGTERM", "SIGHUP"].map((signal) => [
		signal, () => forwardSignal(signal),
	]));
	for (const [signal, listener] of listeners) {
		signalTarget.on?.(signal, listener);
	}
	return () => {
		for (const [signal, listener] of listeners) {
			signalTarget.removeListener?.(signal, listener);
		}
	};
}

function startSupervisedRovoPorts({
	ports,
	rovoBin,
	buildSpawnArgsForPort,
	logger = console,
	env = process.env,
	restartDelayMs = DEFAULT_RESTART_DELAY_MS,
	spawnFn = spawn,
	setTimeoutFn = setTimeout,
	clearTimeoutFn = clearTimeout,
	signalTarget = process,
	exitFn = (code) => process.exit(code),
	reemitSignalFn = (signal) => process.kill(process.pid, signal),
	cleanup = () => {},
} = {}) {
	if (!Array.isArray(ports) || ports.length === 0) {
		throw new Error("Expected at least one Rovo port to supervise.");
	}
	if (typeof rovoBin !== "string" || rovoBin.trim().length === 0) {
		throw new Error("Expected a resolved Rovo binary path.");
	}
	if (typeof buildSpawnArgsForPort !== "function") {
		throw new Error("Expected buildSpawnArgsForPort to be a function.");
	}

	const childrenByPort = new Map();
	const restartTimersByPort = new Map();
	let firstError = null;
	let shuttingDown = false;

	let removeSignalListeners = () => {};

	const finalizeShutdown = (code, signal) => {
		removeSignalListeners();
		cleanup();
		if (signal) {
			reemitSignalFn(signal);
			return;
		}
		exitFn(code ?? 0);
	};

	const killAllChildren = (signal) => {
		for (const child of childrenByPort.values()) {
			try {
				child.kill(signal);
			} catch {
				// Ignore kill failures; the child may already have exited.
			}
		}
	};

	const spawnChildForPort = (port, { isRestart = false } = {}) => {
		const spawnArgs = buildSpawnArgsForPort(port);
		if (isRestart) {
			logger.log?.(`[rovo] Restarting process on port ${port}...`);
		}
		logger.log?.(`[rovo] Starting: ${rovoBin} ${spawnArgs.join(" ")}`);

		const child = spawnFn(rovoBin, spawnArgs, {
			stdio: "inherit",
			env: {
				...env,
				ROVO_PORT: String(port),
				// Pin the serve session token so it matches the token the backend
				// sends via Authorization header (ROVO_SESSION_TOKEN in .env.local).
				...(env.ROVO_SESSION_TOKEN
					? { ROVO_SERVE_SESSION_TOKEN: env.ROVO_SESSION_TOKEN }
					: {}),
			},
		});

		child._rovoPort = port;
		childrenByPort.set(port, child);

		child.on("error", (err) => {
			if (firstError) {
				return;
			}

			firstError = err;
			shuttingDown = true;
			removeSignalListeners();
			cleanup();

			if (err.code === "ENOENT") {
				logger.error?.(
					`\nError: "${rovoBin}" command not found.\n` +
						`Install the Rovo CLI ("rovo") first, then try again.\n` +
						`If it's already installed, make sure it's on your PATH.\n`
				);
			} else {
				logger.error?.("Failed to start rovo serve:", err.message);
			}

			killAllChildren("SIGTERM");
			exitFn(1);
		});

		child.on("exit", (code, signal) => {
			const currentChild = childrenByPort.get(port);
			if (currentChild === child) {
				childrenByPort.delete(port);
			}

			if (shuttingDown) {
				if (childrenByPort.size === 0) {
					finalizeShutdown(code, signal);
				}
				return;
			}

			if (childrenByPort.size > 0) {
				logger.warn?.(
					`[rovo] Process on port ${child._rovoPort} exited (code=${code}, signal=${signal}). ` +
						`${childrenByPort.size} other port(s) still running.`
				);
			} else {
				logger.warn?.(
					`[rovo] Process on port ${child._rovoPort} exited (code=${code}, signal=${signal}). ` +
						"No ports currently running."
				);
			}

			if (restartTimersByPort.has(port)) {
				clearTimeoutFn(restartTimersByPort.get(port));
			}

			const restartTimer = setTimeoutFn(() => {
				restartTimersByPort.delete(port);
				if (shuttingDown) {
					return;
				}
				spawnChildForPort(port, { isRestart: true });
			}, restartDelayMs);
			restartTimersByPort.set(port, restartTimer);
		});
	};

	const forwardSignal = (signal) => {
		shuttingDown = true;
		logger.warn?.(
			`[rovo] Supervisor received ${signal}; forwarding to ${childrenByPort.size} serve process(es).`
		);

		for (const timer of restartTimersByPort.values()) {
			clearTimeoutFn(timer);
		}
		restartTimersByPort.clear();

		killAllChildren(signal);
		if (childrenByPort.size === 0) {
			finalizeShutdown(0, signal);
		}
	};

	removeSignalListeners = subscribeProcessSignals(signalTarget, forwardSignal);

	for (const port of ports) {
		spawnChildForPort(port);
	}

	return {
		getPorts: () => [...ports],
		stop: forwardSignal,
		dispose: removeSignalListeners,
	};
}

module.exports = {
	DEFAULT_RESTART_DELAY_MS,
	subscribeProcessSignals,
	startSupervisedRovoPorts,
};
