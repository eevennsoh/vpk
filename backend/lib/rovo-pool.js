/**
 * Rovo Serve Pool Manager.
 *
 * Manages a pool of `rovo serve` ports so multiple LLM calls can run
 * concurrently — one per port. Each `set_chat_message` + `stream_chat`
 * pair is pinned to a single port via acquire/release.
 *
 * With a single port the pool acts as a simple mutex, semantically
 * identical to the previous single-process behavior.
 */

const { healthCheck: defaultHealthCheck } = require("./rovo-client");

const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 30_000;
const DEFAULT_UNHEALTHY_QUARANTINE_MS = 15_000;

/**
 * A port lease (SM-BT-4): available → busy ⇄ reserved → cooldown → available, or → unhealthy
 * until a health check recovers it. `reserved` is a busy port held for a paused tool call
 * while the run waits for the user. A lease ends once, through `settleLease`.
 *
 * @typedef {"available" | "busy" | "reserved" | "cooldown" | "unhealthy"} PortStatus
 *
 * @typedef {object} PortEntry
 * @property {number} port
 * @property {PortStatus} status
 * @property {string | null} reason - Why the port is reserved or unhealthy; null otherwise
 * @property {number} lastHealthCheck
 * @property {number | null} acquiredAt
 * @property {number | null} quarantinedUntil
 *
 * @typedef {"release" | "unhealthy"} LeaseDisposition
 *
 * @typedef {object} PortHandle
 * @property {number} port
 * @property {(disposition: LeaseDisposition, options?: { reason?: string, quarantineMs?: number }) => boolean} settleLease
 *   Ends the lease: "release" returns the port (after its readiness check), "unhealthy"
 *   quarantines it. Only the first call acts; it returns whether it did.
 * @property {(reason?: string) => void} [reserve] - Holds the leased port for a paused tool call
 * @property {() => void} [resume] - The paused tool call's continuation is using the port again
 *
 * @typedef {object} PoolStatus
 * @property {number} total
 * @property {number} available
 * @property {number} busy - Busy, reserved and cooling down
 * @property {number} reserved
 * @property {number} unhealthy
 * @property {PortEntry[]} ports
 */

/**
 * Create a Rovo port pool.
 *
 * @param {number[]} ports - Array of port numbers to manage
 * @param {object} [options]
 * @param {number} [options.healthCheckIntervalMs] - Interval between health checks (default 30s)
 * @param {() => void} [options.onPortAvailable] - Called when a port transitions to available (after cooldown/health check). Use to drain external run queues that are separate from the pool's internal waiter list.
 * @param {number} [options.cooldownMs] - Delay before marking a released port as available (default 0). Used as fallback if waitForReady is not provided.
 * @param {(port: number) => Promise<void>} [options.waitForReady] - Async function that resolves when a port is ready for new requests. Replaces the blind cooldownMs timer with a deterministic readiness check.
 * @param {number} [options.unhealthyQuarantineMs] - Delay before an unhealthy port is reconsidered for acquisition.
 * @param {(port: number) => Promise<unknown>} [options.healthCheck] - Probes one port (default: Rovo's healthcheck)
 * @returns {{
 *   acquire: (opts?: { timeoutMs?: number; signal?: AbortSignal; preferredPort?: number; avoidPorts?: number[] }) => Promise<PortHandle>;
 *   updatePorts: (newPorts: number[]) => void;
 *   getStatus: () => PoolStatus;
 *   runHealthChecks: () => Promise<void>;
 *   shutdown: () => void;
 * }}
 */
function createRovoPool(ports, options = {}) {
	const {
		healthCheckIntervalMs = DEFAULT_HEALTH_CHECK_INTERVAL_MS,
		onPortAvailable,
		cooldownMs = 0,
		waitForReady,
		unhealthyQuarantineMs = DEFAULT_UNHEALTHY_QUARANTINE_MS,
		healthCheck = defaultHealthCheck,
	} = options;

	const entryGenerations = new WeakMap();

	function createEntry(port) {
		const entry = {
			port,
			status: "available",
			reason: null,
			lastHealthCheck: Date.now(),
			acquiredAt: null,
			quarantinedUntil: null,
		};
		entryGenerations.set(entry, 0);
		return entry;
	}

	/** @type {PortEntry[]} */
	const entries = ports.map(createEntry);

	/** @type {Array<{ resolve: (handle: PortHandle) => void; reject: (err: Error) => void; preferences?: { preferredPort?: number; avoidPorts?: number[] } }>} */
	const waiters = [];

	let healthCheckTimer = null;
	let shuttingDown = false;

	// ── Notify pattern ──────────────────────────────────────────────────

	function getEntryGeneration(entry) {
		return entryGenerations.get(entry) || 0;
	}

	function advanceEntryGeneration(entry) {
		const generation = getEntryGeneration(entry) + 1;
		entryGenerations.set(entry, generation);
		return generation;
	}

	function isCurrentEntryState(entry, generation, status) {
		return (
			entries.includes(entry) &&
			getEntryGeneration(entry) === generation &&
			entry.status === status
		);
	}

	function isEntryQuarantined(entry, now = Date.now()) {
		return typeof entry.quarantinedUntil === "number" && entry.quarantinedUntil > now;
	}

	function releaseExpiredQuarantine(entry, now = Date.now()) {
		if (!isEntryQuarantined(entry, now)) {
			entry.quarantinedUntil = null;
		}
	}

	function findAvailableEntry({ preferredPort, avoidPorts = [] } = {}) {
		const now = Date.now();
		const avoidSet = new Set(
			Array.isArray(avoidPorts)
				? avoidPorts.filter((port) => Number.isInteger(port) && port > 0)
				: []
		);

		for (const entry of entries) {
			releaseExpiredQuarantine(entry, now);
		}

		if (Number.isInteger(preferredPort) && preferredPort > 0) {
			const preferredEntry = entries.find((entry) => entry.port === preferredPort);
			if (
				preferredEntry &&
				preferredEntry.status === "available" &&
				!isEntryQuarantined(preferredEntry, now)
			) {
				return preferredEntry;
			}
		}

		for (const entry of entries) {
			if (
				entry.status === "available" &&
				!avoidSet.has(entry.port) &&
				!isEntryQuarantined(entry, now)
			) {
				return entry;
			}
		}

		for (const entry of entries) {
			if (entry.status === "available" && !isEntryQuarantined(entry, now)) {
				return entry;
			}
		}

		return null;
	}

	function tryNotifyWaiter() {
		if (waiters.length === 0) {
			return;
		}

		const waiter = waiters[0];
		const entry = findAvailableEntry(waiter?.preferences);
		if (!entry) {
			return;
		}

		markEntryBusy(entry);

		waiters.shift();
		waiter.resolve(createHandle(entry));
	}

	function markEntryBusy(entry) {
		const now = Date.now();
		advanceEntryGeneration(entry);
		entry.status = "busy";
		entry.reason = null;
		entry.acquiredAt = now;
		entry.quarantinedUntil = null;
	}

	// A leased port: the health check and a port-set update leave it alone.
	function isEntryLeased(entry) {
		return entry.status === "busy" || entry.status === "reserved" || entry.status === "cooldown";
	}

	function clearBusyLease(entry) {
		entry.acquiredAt = null;
	}

	function quarantineEntry(entry, quarantineMs = unhealthyQuarantineMs, reason = null) {
		advanceEntryGeneration(entry);
		entry.status = "unhealthy";
		entry.reason = typeof reason === "string" && reason.trim() ? reason.trim() : "unhealthy";
		clearBusyLease(entry);
		entry.quarantinedUntil =
			entries.length > 1
				? Date.now() + Math.max(0, Number.isFinite(quarantineMs) ? quarantineMs : unhealthyQuarantineMs)
				: null;
	}

	function createHandle(entry) {
		let settled = false;
		const leaseGeneration = getEntryGeneration(entry);
		const holdsEntry = () => !settled && !shuttingDown && getEntryGeneration(entry) === leaseGeneration;
		return {
			port: entry.port,
			reserve: (reason = "paused tool call") => {
				if (holdsEntry() && entry.status === "busy") {
					entry.status = "reserved";
					entry.reason = reason;
				}
			},
			resume: () => {
				if (holdsEntry() && entry.status === "reserved") {
					entry.status = "busy";
					entry.reason = null;
				}
			},
			settleLease: (disposition, { reason, quarantineMs = unhealthyQuarantineMs } = {}) => {
				if (settled || (disposition !== "release" && disposition !== "unhealthy")) {
					return false;
				}
				settled = true;
				if (shuttingDown) {
					return true;
				}
				if (disposition === "unhealthy") {
					// Waiters are not notified: the port is not available. The periodic health
					// check recovers it.
					quarantineEntry(entry, quarantineMs, reason);
					return true;
				}

				const releaseGeneration = advanceEntryGeneration(entry);
				entry.reason = null;
				const makeAvailable = (expectedStatus) => {
					if (!isCurrentEntryState(entry, releaseGeneration, expectedStatus)) {
						return;
					}
					entry.status = "available";
					clearBusyLease(entry);
					entry.quarantinedUntil = null;
					tryNotifyWaiter();
					if (typeof onPortAvailable === "function") {
						try { onPortAvailable(); } catch {}
					}
				};

				if (typeof waitForReady === "function") {
					entry.status = "cooldown";
					clearBusyLease(entry);
					waitForReady(entry.port).then(() => makeAvailable("cooldown"), () => {
						if (!isCurrentEntryState(entry, releaseGeneration, "cooldown")) {
							return;
						}
						// Readiness check failed — mark unhealthy so the
						// periodic health check recovers it later.
						quarantineEntry(entry, unhealthyQuarantineMs, "readiness check failed after release");
					});
				} else if (cooldownMs > 0) {
					entry.status = "cooldown";
					clearBusyLease(entry);
					setTimeout(() => makeAvailable("cooldown"), cooldownMs);
				} else {
					makeAvailable(entry.status);
				}
				return true;
			},
		};
	}

	// ── Acquire ─────────────────────────────────────────────────────────

	/**
	 * Acquire an available port from the pool.
	 *
	 * @param {object} [opts]
	 * @param {number} [opts.timeoutMs] - Maximum wait time (default 30s)
	 * @param {AbortSignal} [opts.signal] - Abort signal for early cancellation
	 * @returns {Promise<PortHandle>}
	 */
	function acquire({ timeoutMs = 30_000, signal, preferredPort, avoidPorts } = {}) {
		if (shuttingDown) {
			return Promise.reject(new Error("Pool is shutting down"));
		}

		const entry = findAvailableEntry({ preferredPort, avoidPorts });
		if (entry) {
			markEntryBusy(entry);
			return Promise.resolve(createHandle(entry));
		}

		// Slow path — wait for a release
		return new Promise((resolve, reject) => {
			const waiter = {
				resolve,
				reject,
				preferences: {
					preferredPort,
					avoidPorts,
				},
			};
			waiters.push(waiter);

			const cleanup = () => {
				const idx = waiters.indexOf(waiter);
				if (idx !== -1) {
					waiters.splice(idx, 1);
				}
			};

			const timer = setTimeout(() => {
				cleanup();
				const err = new Error(
					`All ${entries.length} Rovo ports are busy — timed out after ${Math.ceil(timeoutMs / 1000)}s`
				);
				err.code = "ROVO_BUSY";
				reject(err);
			}, timeoutMs);

			if (signal) {
				const onAbort = () => {
					clearTimeout(timer);
					cleanup();
					reject(new Error("Pool acquire aborted"));
				};

				if (signal.aborted) {
					clearTimeout(timer);
					cleanup();
					reject(new Error("Pool acquire aborted"));
					return;
				}

				signal.addEventListener("abort", onAbort, { once: true });

				// Clean up abort listener when resolved
				const origResolve = waiter.resolve;
				waiter.resolve = (handle) => {
					clearTimeout(timer);
					signal.removeEventListener("abort", onAbort);
					origResolve(handle);
				};
				const origReject = waiter.reject;
				waiter.reject = (err) => {
					signal.removeEventListener("abort", onAbort);
					origReject(err);
				};
			} else {
				// Clean up timer when resolved
				const origResolve = waiter.resolve;
				waiter.resolve = (handle) => {
					clearTimeout(timer);
					origResolve(handle);
				};
			}
		});
	}

	// ── Health check ────────────────────────────────────────────────────

	async function runHealthChecks() {
		// ── Standard health checks ──────────────────────────────────────
		for (const entry of entries) {
			if (shuttingDown) {
				return;
			}
			if (isEntryLeased(entry)) {
				continue;
			}

			const checkedGeneration = getEntryGeneration(entry);
			const checkedStatus = entry.status;

			try {
				await healthCheck(entry.port);
				if (!isCurrentEntryState(entry, checkedGeneration, checkedStatus)) {
					continue;
				}
				if (entry.status === "unhealthy") {
					console.log(`[ROVO-POOL] Port ${entry.port} recovered`);
					advanceEntryGeneration(entry);
				}
				entry.status = "available";
				entry.reason = null;
				entry.quarantinedUntil = null;
				entry.lastHealthCheck = Date.now();
				tryNotifyWaiter();
				if (typeof onPortAvailable === "function") {
					try { onPortAvailable(); } catch {}
				}
			} catch {
				if (!isCurrentEntryState(entry, checkedGeneration, checkedStatus)) {
					continue;
				}
				if (entry.status !== "unhealthy") {
					console.warn(`[ROVO-POOL] Port ${entry.port} is unhealthy`);
				}
				quarantineEntry(entry, unhealthyQuarantineMs, "health check failed");
				entry.lastHealthCheck = Date.now();
			}
		}
	}

	if (healthCheckIntervalMs > 0) {
		healthCheckTimer = setInterval(runHealthChecks, healthCheckIntervalMs);
		// Don't prevent process exit
		if (healthCheckTimer.unref) {
			healthCheckTimer.unref();
		}
	}

	// ── In-place port update ───────────────────────────────────────────

	/**
	 * Update the pool's port set without destroying active handles.
	 * Ports that are currently busy are left untouched. New ports are added
	 * as available. Ports that are no longer in the new set AND are not busy
	 * are removed.
	 *
	 * @param {number[]} newPorts
	 */
	function updatePorts(newPorts) {
		const newSet = new Set(newPorts);

		// Remove entries that are no longer needed and not busy
		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i];
			if (!newSet.has(entry.port) && !isEntryLeased(entry)) {
				advanceEntryGeneration(entry);
				entries.splice(i, 1);
			}
		}

		// Add new ports that don't already exist
		const existingPorts = new Set(entries.map((e) => e.port));
		for (const port of newPorts) {
			if (!existingPorts.has(port)) {
				entries.push(createEntry(port));
			}
		}

		// Wake up any waiters that might now be satisfiable
		for (const entry of entries) {
			if (entry.status === "available") {
				tryNotifyWaiter();
			}
		}
	}

	// ── Status ──────────────────────────────────────────────────────────

	function getStatus() {
		let available = 0;
		let busy = 0;
		let reserved = 0;
		let unhealthy = 0;
		for (const entry of entries) {
			if (entry.status === "available") available++;
			else if (isEntryLeased(entry)) busy++;
			else unhealthy++;
			if (entry.status === "reserved") reserved++;
		}
		return {
			total: entries.length,
			available,
			busy,
			reserved,
			unhealthy,
			ports: entries.map((e) => ({ ...e })),
		};
	}

	// ── Shutdown ────────────────────────────────────────────────────────

	function shutdown() {
		shuttingDown = true;
		if (healthCheckTimer) {
			clearInterval(healthCheckTimer);
			healthCheckTimer = null;
		}
		// Reject any pending waiters
		while (waiters.length > 0) {
			const waiter = waiters.shift();
			waiter.reject(new Error("Pool is shutting down"));
		}
		// Release all busy entries
		for (const entry of entries) {
			advanceEntryGeneration(entry);
			entry.status = "available";
			entry.reason = null;
			clearBusyLease(entry);
			entry.quarantinedUntil = null;
		}
	}

	return { acquire, updatePorts, getStatus, runHealthChecks, shutdown };
}

module.exports = { createRovoPool };
