"use strict";

const express = require("express");

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
];

const FALLBACK_BODY_LIMIT = "50mb";

function createPayloadTooLargeHandler() {
	return (error, _req, res, next) => {
		if (error?.type === "entity.too.large" || error?.status === 413) {
			return res.status(413).json({
				error: "Request payload is too large.",
				reason: "payload_too_large",
				details:
					"The request included more data than this endpoint can process, often from inline image/file data in chat history. You can continue chatting after starting a new thread or trimming history.",
			});
		}
		if (error?.type === "entity.parse.failed" || (error instanceof SyntaxError && error?.status === 400)) {
			return res.status(400).json({
				error: "Invalid JSON request body.",
			});
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
};
