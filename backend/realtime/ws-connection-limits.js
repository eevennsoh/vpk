"use strict";

// Bounds on the backend's WebSocket servers (BE-F10). Each open socket can hold a partial
// frame up to its server's maxPayload, so the number of sockets bounds that memory, and a
// peer that stops answering pings is closed. Provisional values:
//   64 sockets in total across both servers (about 64 MiB of partial frames at worst);
//   no separate per-address cap unless one is configured: behind a proxy every client
//   shares one address (there is no `trust proxy`), so a per-address cap would be a cap
//   on all users together;
//   a ping every 30 s, and a socket that has not answered the previous ping is closed.
// VPK_WS_MAX_CONNECTIONS and VPK_WS_MAX_CONNECTIONS_PER_ADDRESS override the caps, and
// the realtime and preview servers each get their own pool of that size, so preview use
// cannot starve realtime (worst case about 64 MiB + 16 MiB of partial frames).
const WS_MAX_CONNECTIONS = 64;
const WS_HEARTBEAT_INTERVAL_MS = 30_000;
// One socket token (it lives RUNTIME_SOCKET_TOKEN_TTL_MS, 60 s, in middleware/runtime-admin.js)
// may hold at most this many sockets, so one token cannot take every slot.
const WS_MAX_CONNECTIONS_PER_TOKEN = 4;
// A socket that has sent no frame by then is closed. The preview client sends
// `preview-sync` as soon as it opens; the realtime client sends audio once the microphone
// starts, which can wait on the browser's permission prompt.
const WS_FIRST_FRAME_TIMEOUT_MS = Object.freeze({ preview: 10_000, realtime: 60_000 });

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
function decrement(map, key) {
	const remaining = (map.get(key) ?? 1) - 1;
	if (remaining <= 0) map.delete(key);
	else map.set(key, remaining);
}

function createConnectionLimiter({
	maxTotal = WS_MAX_CONNECTIONS,
	maxPerAddress = maxTotal,
	maxPerToken = WS_MAX_CONNECTIONS_PER_TOKEN,
} = {}) {
	let total = 0;
	const byAddress = new Map();
	const byToken = new Map();
	return {
		/**
		 * A slot for one socket from `address` presenting `token` (none when socket tokens
		 * are off), or null when a cap is reached. The returned release is idempotent.
		 * @param {unknown} address
		 * @param {string | null} [token]
		 * @returns {(() => void) | null}
		 */
		tryAcquire(address, token = null) {
			const key = typeof address === "string" && address ? address : "unknown";
			const forAddress = byAddress.get(key) ?? 0;
			const forToken = token ? byToken.get(token) ?? 0 : 0;
			if (total >= maxTotal || forAddress >= maxPerAddress || (token && forToken >= maxPerToken)) {
				return null;
			}
			total += 1;
			byAddress.set(key, forAddress + 1);
			if (token) byToken.set(token, forToken + 1);
			let released = false;
			return () => {
				if (released) return;
				released = true;
				total -= 1;
				decrement(byAddress, key);
				if (token) decrement(byToken, token);
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
 * Closes `ws` (1008) unless it sends a frame within `timeoutMs`. Call `seen()` from the
 * socket's message handler and `clear()` from its close handler.
 * @param {{ close?: (code: number, reason: string) => void, terminate?: () => void }} ws
 * @param {number} timeoutMs
 * @param {{ setTimeoutImpl?: typeof setTimeout, clearTimeoutImpl?: typeof clearTimeout }} [options]
 */
function armFirstFrameTimeout(ws, timeoutMs, { setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
	let timer = setTimeoutImpl(() => {
		timer = null;
		try {
			ws.close?.(1008, "No message received");
		} catch {
			ws.terminate?.();
		}
	}, timeoutMs);
	timer?.unref?.();
	const clear = () => {
		if (timer !== null) {
			clearTimeoutImpl(timer);
			timer = null;
		}
	};
	return { seen: clear, clear };
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
	WS_FIRST_FRAME_TIMEOUT_MS,
	WS_HEARTBEAT_INTERVAL_MS,
	WS_MAX_CONNECTIONS,
	WS_MAX_CONNECTIONS_PER_TOKEN,
	armFirstFrameTimeout,
	createConnectionLimiter,
	resolveConnectionLimits,
	startHeartbeat,
	trackHeartbeat,
};
