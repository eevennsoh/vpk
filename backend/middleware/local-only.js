"use strict";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isProduction(env) {
	return env.NODE_ENV === "production";
}

function resolveBackendListenHost(env = process.env) {
	return isProduction(env) ? "0.0.0.0" : "127.0.0.1";
}

function isLocalhostOrigin(value) {
	try {
		const origin = new URL(value);
		return ["http:", "https:"].includes(origin.protocol)
			&& (origin.hostname === "localhost" || origin.hostname.endsWith(".localhost"))
			&& origin.origin === value;
	} catch {
		return false;
	}
}

// A request from this machine: loopback socket, a loopback Host header (so a
// DNS-rebound name is refused) and, when present, a *.localhost Origin. The
// Next dev proxy calls the backend server-side and sends no Origin, so a
// missing Origin passes unless the caller requires one.
function isLoopbackRequest(req, { requireOrigin = false } = {}) {
	if (!LOOPBACK_ADDRESSES.has(req.socket?.remoteAddress)) return false;
	if (!LOOPBACK_HOSTNAMES.has(req.hostname)) return false;
	const origin = req.get("origin");
	if (!origin) return !requireOrigin;
	return isLocalhostOrigin(origin);
}

function createRequireLocalDevRequest({ env = process.env } = {}) {
	return function requireLocalDevRequest(req, res, next) {
		if (isProduction(env)) {
			return res.status(404).json({ error: "Not available" });
		}
		if (!isLoopbackRequest(req)) {
			return res.status(403).json({ error: "Only local requests are allowed" });
		}
		return next();
	};
}

function passThrough(_req, _res, next) {
	next();
}

module.exports = {
	createRequireLocalDevRequest,
	isLoopbackRequest,
	passThrough,
	resolveBackendListenHost,
};
