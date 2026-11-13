"use strict";

const express = require("express");
const { ERROR_CODES, sendError } = require("./error-response");

// Every limit here is provisional (C-9c, 14 Nov 2026), set from the largest body the
// frontend sends to each route family. Express answers a larger body with 413.
const ROUTE_JSON_BODY_LIMITS = [
	{
		paths: ["/api/chat-sdk", "/api/rovo/suggestions"],
		limit: "8mb",
	},
	{
		paths: ["/api/sound-generation", "/api/speech-transcription"],
		limit: "12mb",
	},
	{
		paths: "/api/rovo/files/upload",
		limit: "12mb",
	},
	{
		// The chat request drops data-URL file parts and trims history to 4 MB, but keeps
		// at least 8 messages (app/contexts/rovo-chat-helpers.ts); 12 MB is the Next
		// proxy's default limit.
		paths: "/api/rovo/chat",
		limit: "12mb",
	},
	{
		// Dropped files and pages as text; 12 MB is the Next proxy's default limit.
		paths: "/api/personal-graph",
		limit: "12mb",
	},
	{
		// Thread snapshots carry every attachment as a data URL, re-sent on each save,
		// with no size cap in the frontend. Documents and GenUI exports can hold image
		// data; their Next proxies allow 50 MB (BACKEND_FALLBACK_JSON_BODY_LIMIT_BYTES).
		paths: ["/api/rovo/threads", "/api/rovo/documents", "/api/genui-export"],
		limit: "50mb",
	},
];

// Every other route takes small JSON (ids, prompts, settings); the largest found is under
// 1 MB. It was 50 MB.
const FALLBACK_BODY_LIMIT = "1mb";

// The limit express.json applies to `routePath`: the first ROUTE_JSON_BODY_LIMITS entry
// whose mount path matches (Express matches mount paths case-insensitively, on whole
// segments), else the fallback.
function resolveJsonBodyLimit(routePath) {
	const normalizedPath = String(routePath).toLowerCase();
	for (const { paths, limit } of ROUTE_JSON_BODY_LIMITS) {
		for (const mountPath of Array.isArray(paths) ? paths : [paths]) {
			const prefix = mountPath.toLowerCase();
			if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
				return limit;
			}
		}
	}
	return FALLBACK_BODY_LIMIT;
}

function createPayloadTooLargeHandler() {
	return (error, _req, res, next) => {
		if (error?.type === "entity.too.large" || error?.status === 413) {
			return sendError(res, 413, ERROR_CODES.PAYLOAD_TOO_LARGE, "Request payload is too large.", {
				reason: "payload_too_large",
				details:
					"The request included more data than this endpoint can process, often from inline image/file data in chat history. You can continue chatting after starting a new thread or trimming history.",
			});
		}
		if (error?.type === "entity.parse.failed" || (error instanceof SyntaxError && error?.status === 400)) {
			return sendError(res, 400, ERROR_CODES.INVALID_JSON, "Invalid JSON request body.");
		}

		return next(error);
	};
}

function registerBodyLimitMiddleware(app, {
	expressImpl = express,
} = {}) {
	if (!app || typeof app.use !== "function") {
		throw new Error("registerBodyLimitMiddleware requires an Express app");
	}
	if (
		!expressImpl ||
		typeof expressImpl.json !== "function" ||
		typeof expressImpl.text !== "function" ||
		typeof expressImpl.urlencoded !== "function"
	) {
		throw new Error("registerBodyLimitMiddleware requires express body parser helpers");
	}

	for (const routeLimit of ROUTE_JSON_BODY_LIMITS) {
		app.use(routeLimit.paths, expressImpl.json({ limit: routeLimit.limit }));
	}

	app.use(expressImpl.json({ limit: FALLBACK_BODY_LIMIT }));
	app.use(expressImpl.text({ limit: FALLBACK_BODY_LIMIT, type: "text/markdown" }));
	app.use(expressImpl.urlencoded({ limit: FALLBACK_BODY_LIMIT, extended: true }));
	app.use(createPayloadTooLargeHandler());
}

module.exports = {
	FALLBACK_BODY_LIMIT,
	ROUTE_JSON_BODY_LIMITS,
	createPayloadTooLargeHandler,
	registerBodyLimitMiddleware,
	resolveJsonBodyLimit,
};
