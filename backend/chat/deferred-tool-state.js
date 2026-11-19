"use strict";

const { currentGeneratedMediaScope } = require("../lib/generated-media-owners");
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

/**
 * The signed-in caller the running chat turn belongs to, or null. The chat guard runs
 * every /api/chat-sdk and /api/rovo/chat turn of an SLAuth caller in a scope that names
 * them (lib/rovo-app-thread-ownership.js, registerChatThreadOwnershipGuards), and a
 * queued Rovo app run re-enters it. A local caller's turn has no scope.
 */
function currentTurnOwner() {
	return getNonEmptyString(currentGeneratedMediaScope()?.owner);
}

/**
 * Whether the running turn may resume or clear this record. A turn without a signed-in
 * caller (local development) may, as before. A signed-in caller's turn may only use a
 * record it registered (`record.owner`) on the thread it is running for, which the chat
 * guard has already checked is theirs.
 * @param {{ owner?: string | null, threadId?: string | null }} record
 * @param {unknown} threadId - the thread the running turn is for
 */
function isUsableByCurrentTurn(record, threadId) {
	const owner = currentTurnOwner();
	if (!owner) return true;
	const turnThreadId = getNonEmptyString(threadId);
	return record.owner === owner && Boolean(record.threadId) && record.threadId === turnThreadId;
}

/**
 * Whether a lookup may act on `record`. `expected`: the exact record the caller checked
 * (a different or new record under the same id is refused). `turn`: the running chat
 * turn's thread (see isUsableByCurrentTurn).
 */
function mayActOnRecord(record, { expected, turn } = {}) {
	if (expected !== undefined && record !== expected) return false;
	if (turn && !isUsableByCurrentTurn(record, turn.threadId)) return false;
	return true;
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

	/**
	 * Removes and returns the active record under `toolCallId`. With `options`, a record
	 * the lookup may not act on (mayActOnRecord) stays in place and the result is null,
	 * exactly as for an unknown id.
	 */
	function clearActiveDeferredToolCall(toolCallId, options) {
		const normalizedToolCallId = getNonEmptyString(toolCallId);
		if (!normalizedToolCallId) {
			return null;
		}

		const record = activeDeferredToolCallStore.get(normalizedToolCallId) || null;
		if (!record || !mayActOnRecord(record, options)) {
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
			owner: currentTurnOwner(),
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

	/** Removes and returns the paused record; `options` as for clearActiveDeferredToolCall. */
	function detachPausedRovoToolCall(toolCallId, options) {
		const normalizedToolCallId = getNonEmptyString(toolCallId);
		if (!normalizedToolCallId) {
			return null;
		}

		const record = pausedRovoToolCallStore.get(normalizedToolCallId) || null;
		if (!record || !mayActOnRecord(record, options)) {
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
			owner: currentTurnOwner(),
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

	/**
	 * The records a toolCallId names, without clearing them, so a caller can be checked
	 * before anything is cancelled.
	 * @returns {{ active: object | null, paused: object | null }}
	 */
	function peekDeferredToolCall(toolCallId) {
		const normalizedToolCallId = getNonEmptyString(toolCallId);
		if (!normalizedToolCallId) {
			return { active: null, paused: null };
		}
		return {
			active: activeDeferredToolCallStore.get(normalizedToolCallId) || null,
			paused: pausedRovoToolCallStore.get(normalizedToolCallId) || null,
		};
	}

	/**
	 * Takes the paused record a chat turn resumes. Another caller's record, or one on a
	 * different thread, is left in place and the turn sees none (isUsableByCurrentTurn).
	 */
	function takePausedRovoToolCall(toolCallId, { threadId = null } = {}) {
		return detachPausedRovoToolCall(toolCallId, { turn: { threadId } });
	}

	return {
		activeDeferredToolCallStore,
		clearActiveDeferredToolCall,
		clearPausedRovoToolCall,
		detachPausedRovoToolCall,
		pausedRovoToolCallStore,
		peekDeferredToolCall,
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
	isUsableByCurrentTurn,
};
