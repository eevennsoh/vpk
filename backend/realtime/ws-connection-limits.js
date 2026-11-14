"use strict";

// Bounds on the backend's WebSocket servers (BE-F10). Each open socket can hold a partial
// frame up to its server's maxPayload, so the number of sockets bounds that memory, and a
// peer that stops answering pings is closed. Provisional values:
//   64 sockets in total, 16 per client address (both servers together);
//   a ping every 30 s, and a socket that has not answered the previous ping is closed.
// There is no `trust proxy`: the address is the socket's, as the HTTP rate limiter uses, so
// behind a proxy every client shares one address and the per-address cap is the total.
const WS_MAX_CONNECTIONS = 64;
const WS_MAX_CONNECTIONS_PER_ADDRESS = 16;
const WS_HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * @param {{ maxTotal?: number, maxPerAddress?: number }} [options]
 */
function createConnectionLimiter({
	maxTotal = WS_MAX_CONNECTIONS,
	maxPerAddress = WS_MAX_CONNECTIONS_PER_ADDRESS,
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
 * @param {Array<{ clients?: Iterable<any> }>} servers
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
	WS_MAX_CONNECTIONS_PER_ADDRESS,
	createConnectionLimiter,
	startHeartbeat,
	trackHeartbeat,
};
