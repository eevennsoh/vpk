"use strict";

const {
	resolveCallerIdentity,
	resolveCallerIdentityMode,
} = require("../lib/caller-identity");

// Micros probes /healthcheck without credentials (the Service Proxy lets it through), so
// it answers without an identity. Express matches routes case-insensitively and with a
// trailing slash, so this does too.
const OPEN_PATH = /^\/healthcheck\/?$/iu;
const CALLER_KEY = Symbol.for("vpk.caller");

/**
 * Resolves the caller for every request except /healthcheck and stores it on the
 * request. In slauth mode a request without X-Slauth-Subject gets 401 before any route.
 * @param {{ env?: NodeJS.ProcessEnv, logger?: Pick<Console, "log" | "warn"> }} [options]
 */
function createCallerIdentityMiddleware({ env = process.env, logger = console } = {}) {
	const mode = resolveCallerIdentityMode(env, logger);
	if (env.NODE_ENV === "production" && mode === "local") {
		logger.warn?.("[STARTUP] VPK_CALLER_IDENTITY=local in production: every caller is \"local\". Use this only for a local serve without the SLAuth sidecar.");
	} else {
		logger.log?.(`[STARTUP] Caller identity: ${mode === "slauth" ? "X-Slauth-Subject (required)" : "fixed local owner"}`);
	}

	function callerIdentity(req, res, next) {
		if (OPEN_PATH.test(req.path)) {
			return next();
		}
		const resolved = resolveCallerIdentity(req, mode);
		if (!resolved.ok) {
			return res.status(401).json({
				error: "Authentication required",
				code: "CALLER_IDENTITY_REQUIRED",
			});
		}
		req[CALLER_KEY] = resolved.caller;
		return next();
	}

	callerIdentity.mode = mode;
	return callerIdentity;
}

/**
 * The caller stored by the middleware. A router mounted without it (route unit tests)
 * resolves from the request with the environment's mode, so production still needs the
 * header. Null when there is no caller.
 * @param {object} req
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ owner: string, local: boolean } | null}
 */
function getRequestCaller(req, env = process.env) {
	if (req?.[CALLER_KEY]) {
		return req[CALLER_KEY];
	}
	const resolved = resolveCallerIdentity(req, resolveCallerIdentityMode(env, {}));
	return resolved.ok ? resolved.caller : null;
}

module.exports = {
	createCallerIdentityMiddleware,
	getRequestCaller,
};
