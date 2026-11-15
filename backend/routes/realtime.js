"use strict";

const express = require("express");

const { getRequestCaller } = require("../middleware/caller-identity");

const REALTIME_AUDIO_CONVERSATION_SCOPE = "realtime:audio-conversation";

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRealtimeRouter requires ${name}`);
	}
}

function createRealtimeRouter({
	createRuntimeSocketToken,
	requireRuntimeSocketTokenRequester,
	runtimeSocketTokenTtlMs,
} = {}) {
	requireFunction("createRuntimeSocketToken", createRuntimeSocketToken);
	requireFunction("requireRuntimeSocketTokenRequester", requireRuntimeSocketTokenRequester);
	if (!Number.isFinite(runtimeSocketTokenTtlMs)) {
		throw new Error("createRealtimeRouter requires runtimeSocketTokenTtlMs");
	}

	const router = express.Router();

	router.get("/audio-conversation-token", requireRuntimeSocketTokenRequester, (req, res) => {
		const caller = getRequestCaller(req);
		if (!caller) {
			return res.status(401).json({ error: "Authentication required", code: "CALLER_IDENTITY_REQUIRED" });
		}
		// Bound to the caller: the upgrade must come from the same SLAuth subject.
		const token = createRuntimeSocketToken(REALTIME_AUDIO_CONVERSATION_SCOPE, caller.owner);
		return res.json({
			token: token || null,
			expiresInMs: token ? runtimeSocketTokenTtlMs : 0,
		});
	});

	return router;
}

function registerRealtimeRoutes(app, dependencies) {
	app.use("/api/realtime", createRealtimeRouter(dependencies));
}

module.exports = {
	REALTIME_AUDIO_CONVERSATION_SCOPE,
	createRealtimeRouter,
	registerRealtimeRoutes,
};
