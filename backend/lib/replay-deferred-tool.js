"use strict";

const {
	getNonEmptyString,
	parseMaybeJson,
} = require("./shared-utils");

function getReplayDeferredToolInput(part) {
	if (!part || typeof part !== "object") {
		return null;
	}

	const candidates = [
		part.input,
		part.arguments,
		part.params,
		part.payload,
		part.args,
	];

	for (const candidate of candidates) {
		if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
			return candidate;
		}

		const parsedCandidate = parseMaybeJson(candidate);
		if (
			parsedCandidate &&
			typeof parsedCandidate === "object" &&
			!Array.isArray(parsedCandidate)
		) {
			return parsedCandidate;
		}
	}

	return null;
}

async function handleReplayDeferredToolRequest({
	rawEvent,
	control,
	threadId = null,
	sessionId = null,
	sessionMode = "persistent",
	isRequestUserInputTool,
	isExitPlanModeTool,
	syncThreadSessionFromPort,
	emitRequestUserInputQuestionCard,
	emitExitPlanWidget,
	registerPausedToolCall,
} = {}) {
	const pausedParts = Array.isArray(rawEvent?.parts) ? rawEvent.parts : [];
	const interactivePart = pausedParts.find((part) => {
		const toolName = getNonEmptyString(part?.tool_name);
		return (
			typeof isRequestUserInputTool === "function" &&
			isRequestUserInputTool(toolName)
		) || (
			typeof isExitPlanModeTool === "function" &&
			isExitPlanModeTool(toolName)
		);
	});
	if (!interactivePart) {
		return {
			handled: false,
			disconnect: false,
			hasObservedDeferredToolRequest: false,
			pausedToolCallHandled: false,
		};
	}

	const toolCallId = getNonEmptyString(interactivePart.tool_call_id);
	const toolName = getNonEmptyString(interactivePart.tool_name);
	// Reserve the port only for a pause that can be registered; an invalid one must not
	// take the lease from the stream.
	const handle = toolCallId && toolName ? control?.reservePort?.() ?? null : null;
	if (!toolCallId || !toolName || !handle) {
		return {
			handled: false,
			disconnect: false,
			hasObservedDeferredToolRequest: false,
			pausedToolCallHandled: false,
		};
	}

	const toolInput = getReplayDeferredToolInput(interactivePart);
	const isClarificationTool =
		typeof isRequestUserInputTool === "function" &&
		isRequestUserInputTool(toolName);
	const kind = isClarificationTool ? "clarification" : "plan-approval";

	let pausedSessionId = getNonEmptyString(sessionId);
	let pausedSessionMode = sessionMode === "ephemeral" ? "ephemeral" : "persistent";
	if (threadId && typeof syncThreadSessionFromPort === "function") {
		try {
			const synchronizedThread = await syncThreadSessionFromPort(threadId, control.port, {
				sessionMode: pausedSessionMode,
			});
			pausedSessionId =
				getNonEmptyString(synchronizedThread?.sessionId) || pausedSessionId;
			pausedSessionMode =
				synchronizedThread?.sessionMode === "ephemeral"
					? "ephemeral"
					: pausedSessionMode;
		} catch {
			// Best effort only. The caller can log the sync failure if needed.
		}
	}

	try {
		if (isClarificationTool && toolInput && typeof emitRequestUserInputQuestionCard === "function") {
			emitRequestUserInputQuestionCard({
				toolName: "ask_user_questions",
				toolCallId,
				questionInput: toolInput,
				source: "deferred_tool_request",
			});
		}

		if (!isClarificationTool && toolInput && typeof emitExitPlanWidget === "function") {
			emitExitPlanWidget({
				toolCallId,
				toolInput,
				source: "deferred_tool_request",
			});
		}

		if (typeof registerPausedToolCall === "function") {
			registerPausedToolCall({
				toolCallId,
				port: control.port,
				handle,
				threadId,
				sessionId: pausedSessionId,
				sessionMode: pausedSessionMode,
				kind,
			});
		}
	} catch (error) {
		// The lease was handed to this pause; nothing will resume or release it now. The
		// paused turn is still on the port, so it is quarantined for the health check.
		handle.settleLease?.("unhealthy", { reason: "paused tool call could not be registered" });
		throw error;
	}
	if (typeof registerPausedToolCall !== "function") {
		// No store will keep this pause, so its lease ends here.
		handle.settleLease?.("unhealthy", { reason: "paused tool call could not be registered" });
	}

	return {
		handled: true,
		disconnect: true,
		hasObservedDeferredToolRequest: true,
		pausedToolCallHandled: true,
		kind,
		toolCallId,
	};
}

module.exports = {
	getReplayDeferredToolInput,
	handleReplayDeferredToolRequest,
};
