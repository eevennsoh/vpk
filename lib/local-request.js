// Shared "is this request from this machine?" predicates for the dev backend
// (backend/middleware/local-only.js) and the Next dev proxy adapters
// (app/api/_utils/local-request.ts). CommonJS so both runtimes can load it.

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * A loopback host name. `allowLocalhostSubdomains` also accepts `*.localhost`, which
 * Portless uses for the frontend; the backend is only ever reached as plain localhost.
 */
function isLoopbackHostname(hostname, { allowLocalhostSubdomains = false } = {}) {
	const normalized = String(hostname ?? "").toLowerCase();
	return LOOPBACK_HOSTNAMES.has(normalized) || (allowLocalhostSubdomains && normalized.endsWith(".localhost"));
}

function parseHttpOrigin(value) {
	try {
		const origin = new URL(value);
		return ["http:", "https:"].includes(origin.protocol) && origin.origin === value ? origin : null;
	} catch {
		return null;
	}
}

/** An exact `http(s)://localhost[:port]` or `http(s)://*.localhost[:port]` origin. */
function isLocalhostOrigin(value) {
	const origin = parseHttpOrigin(value);
	return Boolean(origin) && (origin.hostname === "localhost" || origin.hostname.endsWith(".localhost"));
}

/** `isLocalhostOrigin`, or the same page served from 127.0.0.1 / [::1]. */
function isLoopbackOrigin(value) {
	const origin = parseHttpOrigin(value);
	return Boolean(origin) && isLoopbackHostname(origin.hostname.replace(/^\[(.*)\]$/u, "$1"), { allowLocalhostSubdomains: true });
}

module.exports = {
	isLocalhostOrigin,
	isLoopbackHostname,
	isLoopbackOrigin,
};
