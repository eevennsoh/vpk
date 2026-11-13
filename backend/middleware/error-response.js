"use strict";

const { STATUS_CODES } = require("node:http");

const { redactLogText } = require("../lib/log-redaction");

// One JSON error shape for the backend: `{ error: string, code: string }`, plus optional
// extra fields a route already sends (for example the 413's `reason` and `details`). Routes
// that return `{ error }` today stay readable: `error` keeps its meaning, `code` is added.

const ERROR_CODES = Object.freeze({
	BAD_REQUEST: "BAD_REQUEST",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	INVALID_JSON: "INVALID_JSON",
	NOT_FOUND: "NOT_FOUND",
	ORIGIN_NOT_ALLOWED: "ORIGIN_NOT_ALLOWED",
	PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
});

const CODE_BY_STATUS = Object.freeze({
	400: ERROR_CODES.BAD_REQUEST,
	404: ERROR_CODES.NOT_FOUND,
	413: ERROR_CODES.PAYLOAD_TOO_LARGE,
});

const INTERNAL_ERROR_MESSAGE = "Internal server error.";

/**
 * An error whose status, code and message are safe to send to the client as they are.
 * Anything else that reaches the final handler is answered with a generic message.
 */
class PublicHttpError extends Error {
	/**
	 * @param {number} status
	 * @param {string} code
	 * @param {string} publicMessage what the client sees
	 * @param {{ logMessage?: string }} [options] what the server log sees, when it says more
	 */
	constructor(status, code, publicMessage, { logMessage } = {}) {
		super(logMessage ?? publicMessage);
		this.name = "PublicHttpError";
		this.status = status;
		this.code = code;
		this.publicMessage = publicMessage;
	}
}

/** @param {string | undefined} origin */
function createOriginNotAllowedError(origin) {
	return new PublicHttpError(403, ERROR_CODES.ORIGIN_NOT_ALLOWED, "Origin not allowed.", {
		logMessage: `CORS: origin ${origin} not allowed`,
	});
}

/**
 * @param {import("express").Response} res
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [extra] fields an existing route already sends beside `error`
 */
function sendError(res, status, code, message, extra = {}) {
	return res.status(status).json({ ...extra, error: message, code });
}

function isHttpErrorStatus(value) {
	return Number.isInteger(value) && value >= 400 && value <= 599;
}

/**
 * Decides what the client sees for an error that no route answered. Only a
 * `PublicHttpError` sends its own message; every other error sends its 4xx status (from
 * body parsers and `http-errors`) with the standard status text, or a generic 500. The
 * error's own message, stack, paths and upstream bodies are never part of the response.
 * @param {unknown} error
 * @returns {{ status: number, code: string, message: string }}
 */
function decideErrorResponse(error) {
	if (error instanceof PublicHttpError && isHttpErrorStatus(error.status)) {
		return { status: error.status, code: error.code, message: error.publicMessage };
	}
	const candidate = /** @type {{ status?: unknown, statusCode?: unknown } | null} */ (
		error && typeof error === "object" ? error : null
	);
	const status = isHttpErrorStatus(candidate?.status)
		? /** @type {number} */ (candidate?.status)
		: isHttpErrorStatus(candidate?.statusCode)
			? /** @type {number} */ (candidate?.statusCode)
			: 500;
	if (status >= 500) {
		return { status, code: ERROR_CODES.INTERNAL_ERROR, message: INTERNAL_ERROR_MESSAGE };
	}
	return {
		status,
		code: CODE_BY_STATUS[status] ?? `HTTP_${status}`,
		message: `${STATUS_CODES[status] ?? "Request failed"}.`,
	};
}

// The detail goes to the server log only, through the log redaction.
function describeErrorForLog(error) {
	if (error instanceof Error) {
		return redactLogText(error.stack ?? `${error.name}: ${error.message}`);
	}
	return redactLogText(String(error));
}

/**
 * The last middleware on the app: every error that reached it gets the shared JSON shape.
 * The detail is logged on the server only.
 * @param {{ logger?: Pick<Console, "error" | "warn"> }} [options]
 */
function createFinalErrorHandler({ logger = console } = {}) {
	return function finalErrorHandler(error, req, res, next) {
		const decision = decideErrorResponse(error);
		const summary = `[HTTP] ${req.method} ${req.path} -> ${decision.status} ${decision.code}`;
		if (decision.status >= 500) {
			logger.error(summary, describeErrorForLog(error));
		} else {
			logger.warn(summary, redactLogText(error instanceof Error ? error.message : String(error)));
		}
		if (res.headersSent) {
			// The response has started; Express's default handler ends the connection.
			return next(error);
		}
		return sendError(res, decision.status, decision.code, decision.message);
	};
}

/**
 * An `/api` request that no route answered. GET is already answered by the static-export
 * fallback with this message; this covers every other method, which otherwise got
 * Express's HTML "Cannot POST" page.
 */
function apiNotFoundHandler(req, res) {
	return sendError(res, 404, ERROR_CODES.NOT_FOUND, `API route not found: ${req.baseUrl}${req.path}`);
}

/**
 * Registers the `/api` not-found answer and the final error handler. Call it after every
 * route and the static-export serving, so it is the end of the stack.
 * @param {import("express").Express} app
 * @param {{ logger?: Pick<Console, "error" | "warn"> }} [options]
 */
function registerFinalErrorHandlers(app, { logger = console } = {}) {
	if (!app || typeof app.use !== "function") {
		throw new Error("registerFinalErrorHandlers requires an Express app");
	}
	app.use("/api", apiNotFoundHandler);
	app.use(createFinalErrorHandler({ logger }));
}

module.exports = {
	ERROR_CODES,
	INTERNAL_ERROR_MESSAGE,
	PublicHttpError,
	apiNotFoundHandler,
	createFinalErrorHandler,
	createOriginNotAllowedError,
	decideErrorResponse,
	registerFinalErrorHandlers,
	sendError,
};
