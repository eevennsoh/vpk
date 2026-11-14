"use strict";

const { getNonEmptyString } = require("../lib/shared-utils");

const DEFAULT_PAUSED_ROVO_TOOL_CALL_TTL_MS = 15 * 60_000;

function createClarificationSessionId() {
	return `clarification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createAIGatewayDeferredToolCallId(toolName) {
	const normalizedToolName =
		getNonEmptyString(toolName)?.toLowerCase().replace(/[^a-z0-9_]+/g, "_") ||
		"tool";
	return `ai-gateway-${normalizedToolName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAIGatewayDeferredToolCallId(toolCallId) {
	return getNonEmptyString(toolCallId)?.startsWith("ai-gateway-") === true;
}

function createDeferredToolCallState({
	cancelChat,
	cancelPausedToolCallRecord,
	logger = console,
	ttlMs = DEFAULT_PAUSED_ROVO_TOOL_CALL_TTL_MS,
	waitForReady,
} = {}) {
	const activeDeferredToolCallStore = new Map();
	const pausedRovoToolCallStore = new Map();
	const normalizedTtlMs =
		Number.isFinite(ttlMs) && ttlMs > 0
			? ttlMs
			: DEFAULT_PAUSED_ROVO_TOOL_CALL_TTL_MS;

	function clearActiveDeferredToolCall(toolCallId) {
		const normalizedToolCallId = getNonEmptyString(toolCallId);
		if (!normalizedToolCallId) {
			return null;
		}

		const record = activeDeferredToolCallStore.get(normalizedToolCallId) || null;
		if (!record) {
			return null;
		}

		activeDeferredToolCallStore.delete(normalizedToolCallId);
		if (record.expiryTimer) {
			clearTimeout(record.expiryTimer);
			record.expiryTimer = null;
		}

		return record;
	}

	function registerActiveDeferredToolCall({
		toolCallId,
		port,
		threadId = null,
		kind,
	}) {
		const normalizedToolCallId = getNonEmptyString(toolCallId);
		if (!normalizedToolCallId || !Number.isInteger(port) || port <= 0) {
			return null;
		}

		clearActiveDeferredToolCall(normalizedToolCallId);

		const now = Date.now();
		const record = {
			toolCallId: normalizedToolCallId,
			port,
			threadId: getNonEmptyString(threadId),
			kind: kind === "plan-approval" ? "plan-approval" : "clarification",
			createdAt: now,
			expiresAt: now + normalizedTtlMs,
			expiryTimer: null,
		};

		record.expiryTimer = setTimeout(() => {
			clearActiveDeferredToolCall(normalizedToolCallId);
		}, normalizedTtlMs);
		if (typeof record.expiryTimer?.unref === "function") {
			record.expiryTimer.unref();
		}

		activeDeferredToolCallStore.set(normalizedToolCallId, record);
		return record;
	}

	function detachPausedRovoToolCall(toolCallId) {
		const normalizedToolCallId = getNonEmptyString(toolCallId);
		if (!normalizedToolCallId) {
			return null;
		}

		const record = pausedRovoToolCallStore.get(normalizedToolCallId) || null;
		if (!record) {
			return null;
		}

		pausedRovoToolCallStore.delete(normalizedToolCallId);
		if (record.expiryTimer) {
			clearTimeout(record.expiryTimer);
			record.expiryTimer = null;
		}

		return record;
	}

	function releasePausedRovoToolCallHandle(record, {
		unhealthy = false,
		unhealthyReason = "paused tool cleanup failed",
	} = {}) {
		try {
			record.handle?.settleLease?.(
				unhealthy ? "unhealthy" : "release",
				unhealthy ? { reason: unhealthyReason } : {},
			);
		} catch (error) {
			logger.warn?.(
				unhealthy
					? "[ROVO-PAUSE] Failed to release unhealthy reserved port handle:"
					: "[ROVO-PAUSE] Failed to release reserved port handle:",
				error,
			);
		}
	}

	function clearPausedRovoToolCall(toolCallId, { cancel = false } = {}) {
		const normalizedToolCallId = getNonEmptyString(toolCallId);
		const record = detachPausedRovoToolCall(normalizedToolCallId);
		if (!record) {
			return null;
		}

		if (cancel) {
			if (typeof cancelPausedToolCallRecord !== "function") {
				releasePausedRovoToolCallHandle(record, { unhealthy: true });
				return record;
			}

			void cancelPausedToolCallRecord(record, {
				cancelChat,
				waitForReady,
				onReleaseError: (error) => {
					logger.warn?.("[ROVO-PAUSE] Failed to release reserved port handle:", error);
				},
			}).catch((error) => {
				logger.warn?.("[ROVO-PAUSE] Failed to cancel paused tool call:", {
					toolCallId: normalizedToolCallId,
					port: record.port,
					error: error instanceof Error ? error.message : String(error),
				});
			});
		} else {
			releasePausedRovoToolCallHandle(record);
		}

		return record;
	}

	function registerPausedRovoToolCall({
		toolCallId,
		port,
		handle,
		threadId = null,
		sessionId = null,
		sessionMode = "persistent",
		kind,
	}) {
		const normalizedToolCallId = getNonEmptyString(toolCallId);
		if (!normalizedToolCallId || !Number.isInteger(port) || port <= 0 || !handle) {
			return null;
		}

		clearPausedRovoToolCall(normalizedToolCallId, { cancel: true });

		const now = Date.now();
		const record = {
			toolCallId: normalizedToolCallId,
			port,
			handle,
			threadId: getNonEmptyString(threadId),
			sessionId: getNonEmptyString(sessionId),
			sessionMode: sessionMode === "ephemeral" ? "ephemeral" : "persistent",
			kind: kind === "plan-approval" ? "plan-approval" : "clarification",
			createdAt: now,
			expiresAt: now + normalizedTtlMs,
			expiryTimer: null,
		};

		record.expiryTimer = setTimeout(() => {
			logger.info?.("[ROVO-PAUSE] Expiring paused tool call reservation", {
				toolCallId: normalizedToolCallId,
				port,
				kind: record.kind,
			});
			clearPausedRovoToolCall(normalizedToolCallId, { cancel: true });
		}, normalizedTtlMs);
		if (typeof record.expiryTimer?.unref === "function") {
			record.expiryTimer.unref();
		}

		pausedRovoToolCallStore.set(normalizedToolCallId, record);
		return record;
	}

	function takePausedRovoToolCall(toolCallId) {
		return detachPausedRovoToolCall(toolCallId);
	}

	return {
		activeDeferredToolCallStore,
		clearActiveDeferredToolCall,
		clearPausedRovoToolCall,
		detachPausedRovoToolCall,
		pausedRovoToolCallStore,
		registerActiveDeferredToolCall,
		registerPausedRovoToolCall,
		releasePausedRovoToolCallHandle,
		takePausedRovoToolCall,
	};
}

module.exports = {
	DEFAULT_PAUSED_ROVO_TOOL_CALL_TTL_MS,
	createAIGatewayDeferredToolCallId,
	createClarificationSessionId,
	createDeferredToolCallState,
	isAIGatewayDeferredToolCallId,
};
