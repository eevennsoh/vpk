"use strict";

const express = require("express");

const { handleChatCancelRequest } = require("../chat/chat-cancel");
const { createRovoAppThreadOwnership } = require("../lib/rovo-app-thread-ownership");
const { getRequestCaller } = require("../middleware/caller-identity");
const { getNonEmptyString } = require("../lib/shared-utils");

const DEFERRED_TOOL_CALL_NOT_FOUND = Object.freeze({ error: "Deferred tool call not found" });

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createChatControlRouter requires ${name}`);
	}
}

function createChatControlRouter({
	activeRequests,
	cancelActiveDeferredToolCallRecord,
	cancelChat,
	cancelPausedDeferredToolCallRecord,
	clearActiveDeferredToolCall,
	clearPlanSession,
	detachPausedRovoToolCall,
	getString = getNonEmptyString,
	handleChatCancel = handleChatCancelRequest,
	logger = console,
	peekDeferredToolCall,
	rovoAppThreadManager,
	waitForReady,
} = {}) {
	if (!activeRequests || typeof activeRequests.get !== "function") {
		throw new Error("createChatControlRouter requires activeRequests");
	}
	requireFunction("cancelActiveDeferredToolCallRecord", cancelActiveDeferredToolCallRecord);
	requireFunction("cancelChat", cancelChat);
	requireFunction("cancelPausedDeferredToolCallRecord", cancelPausedDeferredToolCallRecord);
	requireFunction("clearActiveDeferredToolCall", clearActiveDeferredToolCall);
	requireFunction("clearPlanSession", clearPlanSession);
	requireFunction("detachPausedRovoToolCall", detachPausedRovoToolCall);
	requireFunction("getString", getString);
	requireFunction("handleChatCancel", handleChatCancel);
	requireFunction("peekDeferredToolCall", peekDeferredToolCall);
	requireFunction("waitForReady", waitForReady);
	if (typeof rovoAppThreadManager?.getThread !== "function") {
		throw new Error("createChatControlRouter requires rovoAppThreadManager.getThread");
	}
	const ownership = createRovoAppThreadOwnership({ rovoAppThreadManager });

	/**
	 * Whether the caller may cancel every record in `checked` (a peek). An empty peek still
	 * pays for one ownership lookup and answers false, so a missing id and another
	 * caller's id are refused alike, in the same time.
	 */
	async function mayCancelDeferredToolCall(caller, checked) {
		const records = [checked.active, checked.paused].filter(Boolean);
		if (records.length === 0) {
			await ownership.ownsDeferredToolCall(caller, null);
			return false;
		}
		const allowed = await Promise.all(records.map((record) => ownership.ownsDeferredToolCall(caller, record)));
		return allowed.every(Boolean);
	}

	const router = express.Router();

	router.post("/chat-cancel", async (req, res) => {
		return handleChatCancel({
			activeRequests,
			cancelChat,
			logger,
			req,
			res,
		});
	});

	router.post("/rovo/cancel-deferred-tool", async (req, res) => {
		try {
			const toolCallId = getString(req.body?.toolCallId);
			if (!toolCallId) {
				return res.status(400).json({ error: "toolCallId is required" });
			}

			// AI Gateway clarification cards have no backend state to clean:
			// the request that emitted the card has already completed.
			if (toolCallId.startsWith("ai-gateway-clarification-")) {
				return res.status(200).json({
					cancelled: true,
					kind: "ai-gateway-clarification",
					toolCallId,
				});
			}

			const caller = getRequestCaller(req);
			if (!caller) {
				return res.status(401).json({ error: "Authentication required", code: "CALLER_IDENTITY_REQUIRED" });
			}
			// Decide on the records as they are now, without clearing anything: another
			// caller's card answers exactly like a missing one and stays in place.
			const checked = peekDeferredToolCall(toolCallId);
			if (!(await mayCancelDeferredToolCall(caller, checked))) {
				return res.status(404).json(DEFERRED_TOOL_CALL_NOT_FOUND);
			}
			// The ownership lookup awaited, so a record may have been replaced, removed or
			// added under this id meanwhile. Act only if the store still holds exactly the
			// records that were checked; this re-check and the clear below run synchronously.
			const current = peekDeferredToolCall(toolCallId);
			if (current.active !== checked.active || current.paused !== checked.paused) {
				return res.status(404).json(DEFERRED_TOOL_CALL_NOT_FOUND);
			}

			const activeDeferredToolCall = checked.active
				? clearActiveDeferredToolCall(toolCallId, { expected: checked.active })
				: null;
			if (activeDeferredToolCall) {
				await cancelActiveDeferredToolCallRecord(activeDeferredToolCall, {
					cancelChat,
					waitForReady,
				});
				if (activeDeferredToolCall.threadId) {
					activeRequests.delete(activeDeferredToolCall.threadId);
					if (activeDeferredToolCall.kind === "plan-approval") {
						clearPlanSession(activeDeferredToolCall.threadId);
					}
				}

				return res.status(200).json({
					cancelled: true,
					kind: activeDeferredToolCall.kind,
					toolCallId,
				});
			}

			const pausedToolCall = checked.paused
				? detachPausedRovoToolCall(toolCallId, { expected: checked.paused })
				: null;
			if (pausedToolCall) {
				await cancelPausedDeferredToolCallRecord(pausedToolCall, {
					cancelChat,
					waitForReady,
					onReleaseError: (error) => {
						logger.warn?.("[ROVO-PAUSE] Failed to release reserved port handle:", error);
					},
				});
				if (pausedToolCall.threadId && pausedToolCall.kind === "plan-approval") {
					clearPlanSession(pausedToolCall.threadId);
				}

				return res.status(200).json({
					cancelled: true,
					kind: pausedToolCall.kind,
					toolCallId,
				});
			}

			return res.status(404).json(DEFERRED_TOOL_CALL_NOT_FOUND);
		} catch (error) {
			logger.error?.("[FUTURE-CHAT] Failed to cancel deferred tool call:", error);
			return res.status(500).json({
				error: error instanceof Error ? error.message : "Failed to cancel deferred tool call",
			});
		}
	});

	return router;
}

function registerChatControlRoutes(app, dependencies) {
	app.use("/api", createChatControlRouter(dependencies));
}

module.exports = {
	createChatControlRouter,
	registerChatControlRoutes,
};
