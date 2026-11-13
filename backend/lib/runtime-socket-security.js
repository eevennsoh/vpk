const crypto = require("node:crypto");

const { getNonEmptyString } = require("./shared-utils");

function isLocalRuntimeSocketOrigin(originUrl) {
	const hostname = originUrl.hostname.toLowerCase();
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "[::1]" ||
		hostname === "::1" ||
		hostname.endsWith(".localhost")
	);
}

function isSameRuntimeSocketHost(originUrl, requestHost) {
	const normalizedRequestHost = getNonEmptyString(requestHost)?.toLowerCase();
	return Boolean(normalizedRequestHost && originUrl.host === normalizedRequestHost);
}

/**
 * @param {string | null | undefined} origin
 * @param {string | null | undefined} requestHost
 * @param {string[]} [allowedOrigins]
 * @param {{ allowLocalOrigins?: boolean }} [options] - false: a loopback or `*.localhost`
 *   Origin counts only when it is the request's own host or a configured origin
 */
function isAllowedRuntimeSocketOrigin(origin, requestHost, allowedOrigins = [], { allowLocalOrigins = true } = {}) {
	const normalizedOrigin = getNonEmptyString(origin);
	if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
		return true;
	}

	try {
		const originUrl = new URL(normalizedOrigin);
		return (
			isSameRuntimeSocketHost(originUrl, requestHost) ||
			(allowLocalOrigins && isLocalRuntimeSocketOrigin(originUrl))
		);
	} catch {
		return false;
	}
}

function signRuntimeSocketTokenPayload(payload, runtimeAdminToken) {
	return crypto
		.createHmac("sha256", runtimeAdminToken)
		.update(payload)
		.digest("base64url");
}

function createRuntimeSocketToken(scope, { runtimeAdminToken, ttlMs }) {
	if (!runtimeAdminToken) {
		return "";
	}

	const payload = Buffer.from(
		JSON.stringify({
			scope,
			exp: Date.now() + ttlMs,
			nonce: crypto.randomUUID(),
		}),
	).toString("base64url");
	return `${payload}.${signRuntimeSocketTokenPayload(payload, runtimeAdminToken)}`;
}

function isRuntimeSocketTokenValid(token, expectedScope, { runtimeAdminToken }) {
	if (!runtimeAdminToken || !token) {
		return false;
	}

	const [payload, signature, ...extraParts] = token.split(".");
	if (!payload || !signature || extraParts.length > 0) {
		return false;
	}

	const expectedSignature = signRuntimeSocketTokenPayload(payload, runtimeAdminToken);
	const signatureBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expectedSignature);
	if (signatureBuffer.length !== expectedBuffer.length) {
		return false;
	}
	if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
		return false;
	}

	try {
		const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
		return parsed?.scope === expectedScope && Number(parsed.exp) >= Date.now();
	} catch {
		return false;
	}
}

function appendRuntimeSocketToken(wsUrl, scope, paramName, options) {
	const token = createRuntimeSocketToken(scope, options);
	if (!token) {
		return wsUrl;
	}

	const parsedUrl = new URL(wsUrl, "ws://127.0.0.1");
	parsedUrl.searchParams.set(paramName, token);
	if (/^wss?:\/\//i.test(wsUrl)) {
		return parsedUrl.toString();
	}

	return `${parsedUrl.pathname}${parsedUrl.search}`;
}

module.exports = {
	appendRuntimeSocketToken,
	createRuntimeSocketToken,
	isAllowedRuntimeSocketOrigin,
	isRuntimeSocketTokenValid,
};
