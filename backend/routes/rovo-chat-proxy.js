"use strict";

const express = require("express");

const { INVALID_INPUT_CODE, isStorageId } = require("../lib/input-schemas");
const { sendError } = require("../middleware/error-response");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoChatProxyRouter requires ${name}`);
	}
}

function createRovoChatProxyRouter({
	logger = console,
	proxyRovoAppChatRequest,
	sendGatewayErrorResponse,
} = {}) {
	requireFunction("proxyRovoAppChatRequest", proxyRovoAppChatRequest);
	requireFunction("sendGatewayErrorResponse", sendGatewayErrorResponse);

	const router = express.Router();

	router.post("/rovo/chat", async (req, res) => {
		// The thread id becomes a directory name under backend/data/rovo-app.
		const threadId = typeof req.body?.id === "string" ? req.body.id.trim() : req.body?.id;
		if (threadId !== undefined && threadId !== null && threadId !== "" && !isStorageId(threadId)) {
			return sendError(res, 400, INVALID_INPUT_CODE, "Invalid id.");
		}
		try {
			await proxyRovoAppChatRequest(req, res);
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Chat proxy failed:", error);
			return sendGatewayErrorResponse(
				res,
				error,
				"Failed to stream Rovo response"
			);
		}
	});

	return router;
}

function registerRovoChatProxyRoutes(app, dependencies) {
	app.use("/api", createRovoChatProxyRouter(dependencies));
}

module.exports = {
	createRovoChatProxyRouter,
	registerRovoChatProxyRoutes,
};
