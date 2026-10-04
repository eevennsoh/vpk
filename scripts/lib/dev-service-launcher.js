const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { getNextDevEnv, getNextDevHostname } = require("./next-dev-env");
const { getFrontendBasePort, getBackendBasePort } = require("./worktree-ports");
const { isPortAvailable: probePortAvailable } = require("./rovo-utils");
const { subscribeProcessSignals } = require("./rovo-supervisor");

// One launch operation owns port records and child lifetime. The backend's health
// reuse policy and Next's lock/retry policy deliberately remain distinct.
async function launchDevService(service) {
	if (service !== "frontend" && service !== "backend") {
		throw new Error(`Unknown dev service: ${service}`);
	}
	const basePort = service === "frontend" ? getFrontendBasePort() : getBackendBasePort();
	const maxTries = Number.parseInt(process.env.PORT_SEARCH_MAX ?? "20", 10);
	const portFile = path.join(process.cwd(), `.dev-${service}-port`);
	const lockFile = path.join(process.cwd(), ".next", "dev", "lock");
	const sessionOwned = process.env.VPK_TMUX_OWNED === "1";
	const healthProbeTimeoutMs = Number.parseInt(process.env.BACKEND_HEALTH_PROBE_TIMEOUT_MS ?? "1500", 10);
	const isPortAvailable = (port) => probePortAvailable(port, { includeLoopback: service === "frontend" });
	const findAvailablePort = async (minPort = basePort) => {
		const start = Math.max(basePort, minPort);
		const end = basePort + maxTries;
		for (let port = start; port < end; port += 1) {
			if (await isPortAvailable(port)) {
				return port;
			}
		}

		throw new Error(
			`No available port found from ${start} to ${end - 1}.`
		);
	};

	const isPortInWorktreeRange = (port) =>
		Number.isInteger(port) &&
		port >= basePort &&
		port < basePort + maxTries;

	const writePortFile = (port) => {
		fs.writeFileSync(portFile, String(port));
	};

	const cleanupPortFile = () => {
		try {
			fs.unlinkSync(portFile);
		} catch {
			// ignore missing file
		}
	};

	const readRecordedPort = () => {
		if (!fs.existsSync(portFile)) {
			return null;
		}

		try {
			const port = Number.parseInt(fs.readFileSync(portFile, "utf8").trim(), 10);
			if (!Number.isNaN(port) && port > 0) {
				return port;
			}
		} catch {
			// Ignore read errors
		}

		return null;
	};

	const probeBackendHealth = (port) =>
		new Promise((resolve) => {
			const req = require("node:http").request(
				{
					host: "127.0.0.1",
					port,
					path: "/api/health",
					method: "GET",
					timeout: healthProbeTimeoutMs,
				},
				(res) => {
					if (res.statusCode !== 200) {
						res.resume();
						resolve(false);
						return;
					}
					let body = "";
					res.setEncoding("utf8");
					res.on("data", (chunk) => {
						body += chunk;
						if (body.length > 4096) {
							req.destroy();
						}
					});
					res.on("end", () => {
						try {
							const payload = JSON.parse(body);
							resolve(payload && payload.status === "OK");
						} catch {
							resolve(false);
						}
					});
				}
			);
			req.on("error", () => resolve(false));
			req.on("timeout", () => {
				req.destroy();
				resolve(false);
			});
			req.end();
		});

	const spawnChild = (args, options) => {
		const child = spawn(process.execPath, args, options);
		const disposeSignals = subscribeProcessSignals(process, (signal) => child.kill(signal));
		let failed = false;
		child.once("error", (error) => {
			failed = true;
			disposeSignals();
			cleanupPortFile();
			console.error(error);
			process.exit(1);
		});
		return {
			child,
			onExit: (port, callback) => child.once("exit", async (code, signal) => {
				disposeSignals();
				if (failed) return;
				console.warn(`[dev-${service}] ${service === "frontend" ? "Frontend" : "Backend"} process exited (code=${code ?? "null"}, signal=${signal ?? "null"}, port=${port})`);
				try {
					await callback(code, signal);
				} catch (error) {
					cleanupPortFile();
					console.error(error);
					process.exit(1);
				}
			}),
		};
	};
	const readValidatedRecordedPort = () => {
		const recordedPort = readRecordedPort();
		if (recordedPort === null) {
			return null;
		}

		if (isPortInWorktreeRange(recordedPort)) {
			return recordedPort;
		}

		console.log(
			`Ignoring stale ${service} port file (${recordedPort}); expected range ${basePort}-${basePort + maxTries - 1} for this worktree.`
		);
		cleanupPortFile();
		return null;
	};

	const resolveRunningFrontendPort = async (existingPortHint, attemptedPort) => {
		const candidates = [existingPortHint, attemptedPort, basePort]
			.filter((port) => typeof port === "number")
			.filter((port, index, array) => array.indexOf(port) === index);

		for (const port of candidates) {
			// If the port cannot be listened on, something is already serving it.
			if (!(await isPortAvailable(port))) {
				return port;
			}
		}

		// Fallback scan across this worktree's frontend range.
		for (let port = basePort; port < basePort + maxTries; port += 1) {
			if (!(await isPortAvailable(port))) {
				return port;
			}
		}

		return null;
	};

	const MAX_PORT_RETRIES = 5;

	const startNext = async (port, attempt = 0, existingPortHint = null) => {
		if (attempt === 0 && port !== basePort) {
			console.log(`Port ${basePort} in use. Using port ${port} instead.`);
		}

		writePortFile(port);

		const nextBin = require.resolve("next/dist/bin/next");
		let stderr = "";

		// Read backend port so the frontend can connect WebSockets directly
		const backendPortFile = path.join(process.cwd(), ".dev-backend-port");
		let backendPort = "";
		try {
			backendPort = fs.readFileSync(backendPortFile, "utf8").trim();
		} catch {
			// Backend port file may not exist yet; will fall back to same-origin
		}

		const { child, onExit } = spawnChild(
			[nextBin, "dev", "--turbopack", "--port", String(port), "--hostname", getNextDevHostname()],
			{
				stdio: ["inherit", "inherit", "pipe"],
				env: getNextDevEnv({ backendPort, port }),
			}
		);

		child.stderr?.on("data", (chunk) => {
			const s = chunk.toString();
			stderr += s;
			process.stderr.write(chunk);
		});

		onExit(port, async (code, signal) => {
			if (signal) {
				cleanupPortFile();
				process.kill(process.pid, signal);
				return;
			}

			const isEaddrInUse =
				code === 1 &&
				(stderr.includes("EADDRINUSE") || stderr.includes("address already in use"));

			const isLockError =
				code === 1 &&
				stderr.includes("Unable to acquire lock");

			if (isEaddrInUse && attempt < MAX_PORT_RETRIES - 1) {
				cleanupPortFile();
				try {
					const nextPort = await findAvailablePort(port + 1);
					console.log(`Port ${port} failed (address in use). Trying port ${nextPort} instead.`);
					await startNext(nextPort, attempt + 1, existingPortHint);
					return;
				} catch (err) {
					console.error(err);
					process.exit(1);
				}
			}

			if (isLockError) {
				const runningPort = await resolveRunningFrontendPort(existingPortHint, port);
				if (runningPort !== null) {
					if (sessionOwned) {
						cleanupPortFile();
						console.error(
							`Frontend is already running for this worktree on port ${runningPort}. ` +
							"Stop the existing frontend before starting a tmux-owned session."
						);
						process.exit(1);
						return;
					}
					writePortFile(runningPort);
					console.log(
						`Next.js dev is already running for this worktree on port ${runningPort}. Reusing existing process.`
					);
					process.exit(0);
					return;
				}

				cleanupPortFile();
				console.error(
					"Unable to acquire the Next.js dev lock. Another frontend dev process is already running for this worktree."
				);
				console.error(
					"Stop the existing process first, or use the existing frontend port from .dev-frontend-port."
				);
				process.exit(1);
				return;
			}

			cleanupPortFile();
			process.exit(code ?? 0);
		});
	};

	const cleanStaleLock = async () => {
		if (!fs.existsSync(lockFile)) {
			return;
		}

		// Check which port to test - use recorded port if available, otherwise base port
		let portToCheck = basePort;
		const recordedPort = readValidatedRecordedPort();
		if (recordedPort !== null) {
			portToCheck = recordedPort;
		}

		// Check if a process is actually using the port
		const portInUse = !(await isPortAvailable(portToCheck));
		if (portInUse) {
			// Lock is legitimate - a Next.js instance is running
			return;
		}

		// Also check the base port if different
		if (portToCheck !== basePort) {
			const basePortInUse = !(await isPortAvailable(basePort));
			if (basePortInUse) {
				return;
			}
		}

		// Lock exists but no process on port - stale lock
		console.log("Removing stale Next.js lock file from previous run...");
		try {
			fs.unlinkSync(lockFile);
		} catch {
			// Ignore errors (file might have been cleaned up already)
		}
		// Also clean up the stale port file
		cleanupPortFile();
	};

	const runFrontend = async () => {
		const existingPortHint = readValidatedRecordedPort();
		await cleanStaleLock();

		if (fs.existsSync(lockFile)) {
			const runningPort = await resolveRunningFrontendPort(existingPortHint, basePort);
			if (runningPort !== null) {
				if (sessionOwned) {
					cleanupPortFile();
					throw new Error(
						`Frontend is already running for this worktree on port ${runningPort}. ` +
						"Stop the existing frontend before starting a tmux-owned session."
					);
				}
				writePortFile(runningPort);
				console.log(
					`Next.js dev is already running for this worktree on port ${runningPort}. Reusing existing process.`
				);
				return;
			}
		}

		const port = await findAvailablePort();
		await startNext(port, 0, existingPortHint);
	};

	const runBackend = async () => {
		const recordedPort = readValidatedRecordedPort();
		if (recordedPort !== null) {
			const inUse = !(await isPortAvailable(recordedPort));
			if (inUse) {
				const isOurBackend = await probeBackendHealth(recordedPort);
				if (isOurBackend) {
					if (sessionOwned) {
						throw new Error(
							`Backend is already running for this worktree on port ${recordedPort}. ` +
								"Stop the existing backend before starting a tmux-owned session."
						);
					}
					writePortFile(recordedPort);
					console.log(`Backend dev server is already running for this worktree on port ${recordedPort}. Reusing existing process.`);
					console.warn(
						"[dev-backend] Reuse does not reload .env.local or backend code. " +
							`Stop the process listening on ${recordedPort} before starting if you changed CloudID, ASAP, or gateway helpers.`
					);
					return;
				}
				console.warn(
					`Port ${recordedPort} is in use but did not respond to /api/health as our backend. ` +
						"Assuming the port is held by an unrelated process and picking the next available port."
				);
			}
			cleanupPortFile();
		}

		const port = await findAvailablePort();

		if (port !== basePort) {
			console.log(`Port ${basePort} in use. Using ${port} instead.`);
		}

		writePortFile(port);

		const { onExit } = spawnChild(["backend/server.js"], {
			stdio: "inherit",
			env: {
				...process.env,
				PORT: String(port),
				BACKEND_PORT: String(port),
			},
		});

		onExit(port, (code, signal) => {
			cleanupPortFile();

			if (signal) {
				process.kill(process.pid, signal);
				return;
			}

			process.exit(code ?? 0);
		});
	};

	try {
		await (service === "frontend" ? runFrontend() : runBackend());
	} catch (error) {
		cleanupPortFile();
		throw error;
	}
}

module.exports = { launchDevService };
