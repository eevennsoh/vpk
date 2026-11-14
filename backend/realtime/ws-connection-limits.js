"use strict";

// Bounds on the backend's WebSocket servers (BE-F10). Each open socket can hold a partial
// frame up to its server's maxPayload, so the number of sockets bounds that memory, and a
// peer that stops answering pings is closed. Provisional values:
//   64 sockets in total across both servers (about 64 MiB of partial frames at worst);
//   no separate per-address cap unless one is configured: behind a proxy every client
//   shares one address (there is no `trust proxy`), so a per-address cap would be a cap
//   on all users together;
//   a ping every 30 s, and a socket that has not answered the previous ping is closed.
// VPK_WS_MAX_CONNECTIONS and VPK_WS_MAX_CONNECTIONS_PER_ADDRESS override the caps.
const WS_MAX_CONNECTIONS = 64;
const WS_HEARTBEAT_INTERVAL_MS = 30_000;

function parsePositiveInteger(value) {
	if (typeof value !== "string" || !/^\s*\d+\s*$/u.test(value)) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The connection caps from the environment: VPK_WS_MAX_CONNECTIONS (total, default 64) and
 * VPK_WS_MAX_CONNECTIONS_PER_ADDRESS (default: the total, so no separate cap). A value
 * that is not a positive integer is logged and the default is used.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ warn?: (...args: unknown[]) => void }} [logger]
 * @returns {{ maxTotal: number, maxPerAddress: number }}
 */
function resolveConnectionLimits(env = process.env, logger = console) {
	const read = (name) => {
		const raw = env[name];
		if (raw === undefined || raw === "") return null;
		const parsed = parsePositiveInteger(raw);
		if (parsed === null) {
			logger.warn?.(`[STARTUP] ${name} is not a positive integer; using the default.`);
		}
		return parsed;
	};
	const maxTotal = read("VPK_WS_MAX_CONNECTIONS") ?? WS_MAX_CONNECTIONS;
	const configuredPerAddress = read("VPK_WS_MAX_CONNECTIONS_PER_ADDRESS");
	return { maxTotal, maxPerAddress: configuredPerAddress === null ? maxTotal : Math.min(configuredPerAddress, maxTotal) };
}

/**
 * @param {{ maxTotal?: number, maxPerAddress?: number }} [options]
 */
function createConnectionLimiter({
	maxTotal = WS_MAX_CONNECTIONS,
	maxPerAddress = maxTotal,
} = {}) {
	let total = 0;
	const byAddress = new Map();
	return {
		/**
		 * A slot for one socket from `address`, or null when a cap is reached. The returned
		 * release is idempotent.
		 * @param {unknown} address
		 * @returns {(() => void) | null}
		 */
		tryAcquire(address) {
			const key = typeof address === "string" && address ? address : "unknown";
			const forAddress = byAddress.get(key) ?? 0;
			if (total >= maxTotal || forAddress >= maxPerAddress) {
				return null;
			}
			total += 1;
			byAddress.set(key, forAddress + 1);
			let released = false;
			return () => {
				if (released) return;
				released = true;
				total -= 1;
				const remaining = (byAddress.get(key) ?? 1) - 1;
				if (remaining <= 0) byAddress.delete(key);
				else byAddress.set(key, remaining);
			};
		},
		get size() {
			return total;
		},
	};
}

// Marks a socket as alive now and on every pong.
function trackHeartbeat(ws) {
	ws.isAlive = true;
	ws.on?.("pong", () => {
		ws.isAlive = true;
	});
}

/**
 * Pings every socket of `servers` each interval; one that has not answered since the
 * previous ping is terminated. Returns a stop function.
 * @param {Array<{ clients?: Iterable<{ isAlive?: boolean, ping?: () => void, terminate?: () => void }> }>} servers
 * @param {{ intervalMs?: number, setIntervalImpl?: typeof setInterval, clearIntervalImpl?: typeof clearInterval }} [options]
 */
function startHeartbeat(servers, {
	intervalMs = WS_HEARTBEAT_INTERVAL_MS,
	setIntervalImpl = setInterval,
	clearIntervalImpl = clearInterval,
} = {}) {
	const tick = () => {
		for (const server of servers) {
			for (const ws of server.clients ?? []) {
				if (ws.isAlive === false) {
					ws.terminate?.();
					continue;
				}
				ws.isAlive = false;
				try {
					ws.ping?.();
				} catch {
					ws.terminate?.();
				}
			}
		}
	};
	const timer = setIntervalImpl(tick, intervalMs);
	timer?.unref?.();
	return () => clearIntervalImpl(timer);
}

module.exports = {
	WS_HEARTBEAT_INTERVAL_MS,
	WS_MAX_CONNECTIONS,
	createConnectionLimiter,
	resolveConnectionLimits,
	startHeartbeat,
	trackHeartbeat,
};
