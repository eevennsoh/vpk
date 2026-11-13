"use strict";

const crypto = require("node:crypto");

const {
	appendRuntimeSocketToken: appendRuntimeSocketTokenWithOptions,
	createRuntimeSocketToken: createRuntimeSocketTokenWithOptions,
	isAllowedRuntimeSocketOrigin: isRuntimeSocketOriginAllowed,
	isRuntimeSocketTokenValid: isRuntimeSocketTokenValidWithOptions,
} = require("../lib/runtime-socket-security");
const { getNonEmptyString } = require("../lib/shared-utils");
const { resolveAllowedOrigins } = require("./security");

const RUNTIME_SOCKET_TOKEN_TTL_MS = 60_000;

function resolveRuntimeAdminConfig(env = process.env) {
	return {
		runtimeAdminRequired:
			env.NODE_ENV === "production" ||
			env.VPK_REQUIRE_RUNTIME_ADMIN === "true",
		runtimeAdminToken: getNonEmptyString(env.VPK_RUNTIME_ADMIN_TOKEN),
		runtimeSocketTokenTtlMs: RUNTIME_SOCKET_TOKEN_TTL_MS,
	};
}

function assertRuntimeAdminConfig({
	runtimeAdminRequired,
	runtimeAdminToken,
}, {
	consoleImpl = console,
	exit = process.exit,
} = {}) {
	if (runtimeAdminRequired && !runtimeAdminToken) {
		consoleImpl.error(
			"[STARTUP] VPK_RUNTIME_ADMIN_TOKEN is required when runtime admin protection is enabled."
		);
		exit(1);
		return false;
	}
	return true;
}

function getRuntimeAdminTokenFromRequest(req) {
	const headerToken = getNonEmptyString(req.get?.("x-vpk-runtime-admin-token"));
	if (headerToken) {
		return headerToken;
	}

	const authorization = getNonEmptyString(req.get?.("authorization"));
	const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
	if (bearerMatch) {
		return bearerMatch[1].trim();
	}

	return getNonEmptyString(req.query?.runtimeToken ?? req.query?.token);
}

function isRuntimeAdminTokenValid(token, runtimeAdminToken) {
	if (!runtimeAdminToken || !token) {
		return false;
	}

	const tokenBuffer = Buffer.from(token);
	const expectedBuffer = Buffer.from(runtimeAdminToken);
	if (tokenBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return Boolean(
		crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
	);
}

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * Who may get a runtime socket token (the token the browser puts on the preview and
 * realtime WebSocket URLs). A browser's same-origin GET carries no Origin header but
 * does carry `Sec-Fetch-Site: same-origin`, so a missing Origin alone is no longer
 * enough. Headers can be set by any non-browser client, so this keeps other sites'
 * pages and header-less clients out; it is not authentication.
 *   issue  — no token configured (local development: tokens are empty), a valid runtime
 *            admin token, an allowed Origin, a same-origin browser request, or, outside
 *            production, a loopback caller (the Next dev proxy, which sends no Origin)
 *   reject — anything else
 * @param {{ adminTokenValid: boolean, origin: string | null, originAllowed: boolean,
 *   remoteAddress: string | null, runtimeAdminRequired: boolean, runtimeAdminToken: string | null,
 *   secFetchSite: string | null }} request
 * @returns {{ action: "issue" | "reject", reason: string }}
 */
function decideRuntimeSocketTokenRequest({
	adminTokenValid,
	origin,
	originAllowed,
	remoteAddress,
	runtimeAdminRequired,
	runtimeAdminToken,
	secFetchSite,
}) {
	if (!runtimeAdminToken && !runtimeAdminRequired) return { action: "issue", reason: "tokens-disabled" };
	if (adminTokenValid) return { action: "issue", reason: "runtime-admin" };
	if (origin) return originAllowed ? { action: "issue", reason: "allowed-origin" } : { action: "reject", reason: "origin-not-allowed" };
	if (secFetchSite === "same-origin") return { action: "issue", reason: "same-origin-browser" };
	if (!runtimeAdminRequired && remoteAddress && LOOPBACK_ADDRESSES.has(remoteAddress)) {
		return { action: "issue", reason: "local-proxy" };
	}
	return { action: "reject", reason: "no-origin" };
}

function createRuntimeAdminControls({
	allowedOrigins,
	consoleImpl = console,
	env = process.env,
	exit = process.exit,
} = {}) {
	const {
		runtimeAdminRequired,
		runtimeAdminToken,
		runtimeSocketTokenTtlMs,
	} = resolveRuntimeAdminConfig(env);
	const resolvedAllowedOrigins = allowedOrigins ?? resolveAllowedOrigins(env);

	assertRuntimeAdminConfig({
		runtimeAdminRequired,
		runtimeAdminToken,
	}, {
		consoleImpl,
		exit,
	});

	function requireRuntimeAdmin(req, res, next) {
		if (!runtimeAdminToken && !runtimeAdminRequired) {
			return next();
		}

		if (isRuntimeAdminTokenValid(getRuntimeAdminTokenFromRequest(req), runtimeAdminToken)) {
			return next();
		}

		return res.status(runtimeAdminToken ? 403 : 503).json({
			error: "Runtime admin authorization required",
		});
	}

	function createRuntimeSocketToken(scope) {
		return createRuntimeSocketTokenWithOptions(scope, {
			runtimeAdminToken,
			ttlMs: runtimeSocketTokenTtlMs,
		});
	}

	function isRuntimeSocketTokenValid(token, expectedScope) {
		return isRuntimeSocketTokenValidWithOptions(token, expectedScope, {
			runtimeAdminToken,
		});
	}

	function appendRuntimeSocketToken(wsUrl, scope, paramName) {
		return appendRuntimeSocketTokenWithOptions(wsUrl, scope, paramName, {
			runtimeAdminToken,
			ttlMs: runtimeSocketTokenTtlMs,
		});
	}

	function isAllowedRuntimeSocketOrigin(origin, request) {
		return isRuntimeSocketOriginAllowed(
			origin,
			request.headers.host,
			resolvedAllowedOrigins,
		);
	}

	function requireRuntimeSocketTokenRequester(req, res, next) {
		const origin = getNonEmptyString(req.get?.("origin"));
		const decision = decideRuntimeSocketTokenRequest({
			adminTokenValid: isRuntimeAdminTokenValid(getRuntimeAdminTokenFromRequest(req), runtimeAdminToken),
			origin,
			originAllowed: Boolean(origin) && isAllowedRuntimeSocketOrigin(origin, req),
			remoteAddress: getNonEmptyString(req.socket?.remoteAddress),
			runtimeAdminRequired,
			runtimeAdminToken,
			secFetchSite: getNonEmptyString(req.get?.("sec-fetch-site")),
		});
		if (decision.action === "issue") {
			return next();
		}

		return res.status(403).json({
			error: "Runtime socket token origin is not allowed",
		});
	}

	return {
		appendRuntimeSocketToken,
		createRuntimeSocketToken,
		isAllowedRuntimeSocketOrigin,
		isRuntimeSocketTokenValid,
		requireRuntimeAdmin,
		requireRuntimeSocketTokenRequester,
		runtimeAdminRequired,
		runtimeAdminToken,
		runtimeSocketTokenTtlMs,
	};
}

module.exports = {
	RUNTIME_SOCKET_TOKEN_TTL_MS,
	assertRuntimeAdminConfig,
	createRuntimeAdminControls,
	decideRuntimeSocketTokenRequest,
	getRuntimeAdminTokenFromRequest,
	isRuntimeAdminTokenValid,
	resolveRuntimeAdminConfig,
};
