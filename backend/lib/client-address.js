"use strict";

// The address that identifies a client for per-client limits (the AI-cost rate limiter and
// the WebSocket caps). In production the backend runs behind the deployment's load
// balancer and the Service Proxy sidecar, so every socket comes from the sidecar; the
// client is the entry the balancer appended to X-Forwarded-For, one before the sidecar's.
// Entries to the left of it are whatever the client sent and are never trusted.
//
// This deliberately does not set Express's `trust proxy`: that would also make
// `req.hostname` and `req.protocol` follow X-Forwarded-Host/-Proto, which a client can set.
//
// VPK_TRUSTED_PROXY_HOPS is the number of proxies in front of the backend that append to
// X-Forwarded-For. The Micros service descriptor sets 2 (the load balancer, then the
// Service Proxy sidecar that authenticates with SLAuth); the default
// is 0 everywhere else, including a local NODE_ENV=production serve, because a header that
// no proxy appended is the caller's own. With 0 the socket address is used. If the real
// number is higher, the address resolved is a proxy's, the same as not trusting the
// header; a chain shorter than the hop count also falls back to the socket address, so a
// client never chooses its own address.
const MAX_TRUSTED_PROXY_HOPS = 8;

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ warn?: (...args: unknown[]) => void }} [logger]
 * @returns {number}
 */
function resolveTrustedProxyHops(env = process.env, logger = console) {
	const fallback = 0;
	const raw = env.VPK_TRUSTED_PROXY_HOPS;
	if (raw === undefined || raw === "") return fallback;
	if (!/^\s*\d+\s*$/u.test(raw) || Number.parseInt(raw, 10) > MAX_TRUSTED_PROXY_HOPS) {
		logger.warn?.(`[STARTUP] VPK_TRUSTED_PROXY_HOPS must be a whole number from 0 to ${MAX_TRUSTED_PROXY_HOPS}; using ${fallback}.`);
		return fallback;
	}
	return Number.parseInt(raw, 10);
}

/**
 * @param {unknown} header
 * @returns {string[]}
 */
function parseForwardedFor(header) {
	const values = Array.isArray(header) ? header : [header];
	return values
		.filter((value) => typeof value === "string")
		.flatMap((value) => value.split(","))
		.map((entry) => entry.trim())
		.filter(Boolean);
}

/**
 * The client address of an HTTP or upgrade request: the socket address, or with `hops`
 * trusted proxies the X-Forwarded-For entry that many hops from the socket (the socket
 * address when the header is shorter). "unknown" when there is no address at all.
 * @param {{ headers?: Record<string, unknown>, socket?: { remoteAddress?: string } }} request
 * @param {number} hops
 * @returns {string}
 */
function resolveClientAddress(request, hops) {
	const socketAddress = typeof request?.socket?.remoteAddress === "string" && request.socket.remoteAddress
		? request.socket.remoteAddress
		: "unknown";
	if (!(hops > 0)) return socketAddress;
	const chain = parseForwardedFor(request?.headers?.["x-forwarded-for"]);
	if (chain.length < hops) return socketAddress;
	return chain[chain.length - hops];
}

module.exports = {
	MAX_TRUSTED_PROXY_HOPS,
	resolveClientAddress,
	resolveTrustedProxyHops,
};
