"use strict";

const { toPreview } = require("./tool-output-sanitizer");
const {
	buildThinkingEventFromToolEvent,
	buildThinkingStatusFromToolEvent,
	normalizeToolName,
	resolveToolCallInput,
	resolveToolNameForToolEvent,
} = require("./rovo-gateway-tool-events");

function normalizeToolCallId(toolCallId) {
	return typeof toolCallId === "string" && toolCallId.trim()
		? toolCallId.trim()
		: null;
}

function createRovoToolEventDispatcher({
	onTextDelta,
	onSubagentTextDelta,
	suppressSubagentText = false,
	onThinkingStatus,
	onThinkingEvent,
	onToolCallStart,
	onToolCallInputResolved,
	onToolCallResult,
	onDeferredToolRequest,
}) {
	const toolNameByCallId = new Map();
	const toolInputByCallId = new Map();
	const toolArgsBufferByCallId = new Map();
	const resolvedToolInputCallIds = new Set();
	const activeToolCallIdsByName = new Map();
	const activeToolCallOrder = [];

	const rememberActiveToolCall = ({ toolCallId, toolName }) => {
		const normalizedToolCallId = normalizeToolCallId(toolCallId);
		if (!normalizedToolCallId) {
			return;
		}

		const normalizedToolName = normalizeToolName(toolName);
		if (normalizedToolName) {
			const existingIds = activeToolCallIdsByName.get(normalizedToolName) ?? [];
			if (!existingIds.includes(normalizedToolCallId)) {
				existingIds.push(normalizedToolCallId);
				activeToolCallIdsByName.set(normalizedToolName, existingIds);
			}
		}

		if (!activeToolCallOrder.includes(normalizedToolCallId)) {
			activeToolCallOrder.push(normalizedToolCallId);
		}
	};

	const forgetActiveToolCall = (toolCallId) => {
		const normalizedToolCallId = normalizeToolCallId(toolCallId);
		if (!normalizedToolCallId) {
			return;
		}

		const orderIndex = activeToolCallOrder.indexOf(normalizedToolCallId);
		if (orderIndex >= 0) {
			activeToolCallOrder.splice(orderIndex, 1);
		}

		for (const [toolName, ids] of activeToolCallIdsByName.entries()) {
			const nextIds = ids.filter((id) => id !== normalizedToolCallId);
			if (nextIds.length === 0) {
				activeToolCallIdsByName.delete(toolName);
				continue;
			}
			activeToolCallIdsByName.set(toolName, nextIds);
		}
	};

	const resolveCorrelatedToolCallId = ({
		toolCallId,
		reportedToolName,
	}) => {
		const normalizedToolCallId = normalizeToolCallId(toolCallId);
		if (normalizedToolCallId) {
			return normalizedToolCallId;
		}

		const normalizedToolName = normalizeToolName(reportedToolName);
		if (normalizedToolName) {
			const idsForTool = activeToolCallIdsByName.get(normalizedToolName);
			if (Array.isArray(idsForTool) && idsForTool.length > 0) {
				return idsForTool[idsForTool.length - 1];
			}
		}

		if (activeToolCallOrder.length > 0) {
			return activeToolCallOrder[activeToolCallOrder.length - 1];
		}

		return null;
	};

	const emitResolvedToolInputIfAvailable = ({
		toolCallId,
		reportedToolName,
		fallbackWithoutArgs = false,
	}) => {
		if (typeof onToolCallInputResolved !== "function") {
			return;
		}

		const normalizedToolCallId = normalizeToolCallId(toolCallId);
		if (
			normalizedToolCallId &&
			resolvedToolInputCallIds.has(normalizedToolCallId)
		) {
			return;
		}

		const rememberedToolName = normalizedToolCallId
			? toolNameByCallId.get(normalizedToolCallId) ?? null
			: null;
		const resolvedToolName = resolveToolNameForToolEvent({
			reportedToolName,
			rememberedToolName,
		});

		const mergedToolInput = normalizedToolCallId
			? resolveToolCallInput({
				initialInput: toolInputByCallId.get(normalizedToolCallId) ?? null,
				argsBuffer: toolArgsBufferByCallId.get(normalizedToolCallId) ?? "",
			})
			: null;
		if (!mergedToolInput) {
			if (!fallbackWithoutArgs) {
				return;
			}

			const fallbackInput = resolveToolCallInput({
				initialInput:
					normalizedToolCallId
						? toolInputByCallId.get(normalizedToolCallId) ?? null
						: null,
				argsBuffer: "",
			});
			if (!fallbackInput) {
				return;
			}

			onToolCallInputResolved({
				toolName: resolvedToolName,
				toolCallId: normalizedToolCallId,
				toolInput: fallbackInput,
			});
			if (normalizedToolCallId) {
				resolvedToolInputCallIds.add(normalizedToolCallId);
			}
			return;
		}

		onToolCallInputResolved({
			toolName: resolvedToolName,
			toolCallId: normalizedToolCallId,
			toolInput: mergedToolInput,
		});
		if (normalizedToolCallId) {
			resolvedToolInputCallIds.add(normalizedToolCallId);
		}
	};

	const handleTextChunk = (chunk) => {
		if (chunk.type !== "text") {
			return false;
		}

		if (chunk.subagentName) {
			if (typeof onSubagentTextDelta === "function" && chunk.text) {
				onSubagentTextDelta(chunk.text, {
					subagentName: chunk.subagentName,
					subagentToolCallId: chunk.subagentToolCallId,
				});
			}
			if (suppressSubagentText) {
				return true;
			}
		}

		if (chunk.text) {
			onTextDelta(chunk.text);
		}
		return true;
	};

	const handleToolCallStart = (chunk) => {
		const resolvedToolName = normalizeToolName(chunk.toolName);
		const normalizedToolCallId = normalizeToolCallId(chunk.toolCallId);
		const isDuplicateStartEvent =
			normalizedToolCallId !== null &&
			activeToolCallOrder.includes(normalizedToolCallId);
		if (normalizedToolCallId && resolvedToolName) {
			toolNameByCallId.set(normalizedToolCallId, resolvedToolName);
		}
		if (
			normalizedToolCallId &&
			chunk.toolInput &&
			typeof chunk.toolInput === "object"
		) {
			toolInputByCallId.set(normalizedToolCallId, chunk.toolInput);
		}
		if (normalizedToolCallId && !isDuplicateStartEvent) {
			rememberActiveToolCall({
				toolCallId: normalizedToolCallId,
				toolName: resolvedToolName ?? chunk.toolName,
			});
		}
		if (isDuplicateStartEvent) {
			emitResolvedToolInputIfAvailable({
				toolCallId: normalizedToolCallId,
				reportedToolName: resolvedToolName,
			});
			return;
		}

		if (typeof onToolCallStart === "function") {
			onToolCallStart({
				toolName: resolvedToolName,
				toolCallId: normalizedToolCallId,
				toolInput:
					chunk.toolInput && typeof chunk.toolInput === "object"
						? chunk.toolInput
						: null,
			});
		}

		if (typeof onThinkingStatus === "function") {
			onThinkingStatus(
				buildThinkingStatusFromToolEvent(resolvedToolName, "start", {
					permissionScenario: chunk.permissionScenario,
				})
			);
		}
		if (typeof onThinkingEvent === "function") {
			const toolInputPreview =
				chunk.toolInput !== undefined
					? toPreview(chunk.toolInput).text
					: undefined;
			const thinkingEvent = buildThinkingEventFromToolEvent({
				toolName: resolvedToolName,
				toolCallId: chunk.toolCallId,
				phase: "start",
				input: toolInputPreview,
				mcpServer: chunk.mcpServer,
				permissionScenario: chunk.permissionScenario,
				subagentName: chunk.subagentName,
				subagentToolCallId: chunk.subagentToolCallId,
			});
			if (thinkingEvent) {
				onThinkingEvent(thinkingEvent);
			}
		}

		if (!chunk.toolCallId && chunk.toolInput && typeof chunk.toolInput === "object") {
			emitResolvedToolInputIfAvailable({
				toolCallId: null,
				reportedToolName: resolvedToolName,
				fallbackWithoutArgs: true,
			});
		}
	};

	const handleToolCallArgs = (chunk) => {
		const normalizedToolCallId = normalizeToolCallId(chunk.toolCallId);
		if (!normalizedToolCallId) {
			return;
		}

		const argsDelta = typeof chunk.text === "string" ? chunk.text : "";
		if (!argsDelta) {
			return;
		}

		const previousBuffer = toolArgsBufferByCallId.get(normalizedToolCallId) ?? "";
		toolArgsBufferByCallId.set(
			normalizedToolCallId,
			previousBuffer + argsDelta
		);

		emitResolvedToolInputIfAvailable({
			toolCallId: normalizedToolCallId,
			reportedToolName: chunk.toolName,
		});
	};

	const handleDeferredToolRequest = (chunk) => {
		if (typeof onDeferredToolRequest !== "function") {
			return;
		}

		return onDeferredToolRequest({
			toolName: normalizeToolName(chunk.toolName),
			toolCallId: normalizeToolCallId(chunk.toolCallId),
			toolInput:
				chunk.toolInput && typeof chunk.toolInput === "object"
					? chunk.toolInput
					: null,
		});
	};

	const handleToolResult = (chunk) => {
		const correlatedToolCallId = resolveCorrelatedToolCallId({
			toolCallId: chunk.toolCallId,
			reportedToolName: chunk.toolName,
		});
		emitResolvedToolInputIfAvailable({
			toolCallId: correlatedToolCallId,
			reportedToolName: chunk.toolName,
			fallbackWithoutArgs: true,
		});

		if (chunk.type === "tool_result" && typeof onToolCallResult === "function") {
			const normalizedToolCallId = correlatedToolCallId;
			const resolvedToolName = resolveToolNameForToolEvent({
				reportedToolName: chunk.toolName,
				rememberedToolName: normalizedToolCallId
					? toolNameByCallId.get(normalizedToolCallId) ?? null
					: null,
			});
			const canonicalOutput =
				chunk.rawOutput !== undefined ? chunk.rawOutput : chunk.text;

			onToolCallResult({
				toolName: resolvedToolName,
				toolCallId: normalizedToolCallId,
				output: canonicalOutput,
				toolOutputRaw: canonicalOutput,
				toolOutputPreview:
					typeof chunk.outputPreview === "string"
						? chunk.outputPreview
						: undefined,
				outputTruncated: chunk.outputTruncated === true,
				outputBytes:
					typeof chunk.outputBytes === "number" ? chunk.outputBytes : undefined,
			});
		}

		const rememberedToolName = correlatedToolCallId
			? toolNameByCallId.get(correlatedToolCallId) ?? null
			: null;
		const resolvedToolName = resolveToolNameForToolEvent({
			reportedToolName: chunk.toolName,
			rememberedToolName,
		});
		const canonicalOutput =
			chunk.rawOutput !== undefined ? chunk.rawOutput : chunk.text;
		const canonicalOutputPreview = toPreview(canonicalOutput);
		const outputPreview =
			typeof chunk.outputPreview === "string"
				? chunk.outputPreview
				: canonicalOutputPreview.text;
		const outputTruncated =
			chunk.outputTruncated === true || canonicalOutputPreview.truncated;
		const outputBytes =
			typeof chunk.outputBytes === "number"
				? chunk.outputBytes
				: canonicalOutputPreview.bytes;
		const suppressedRawOutput = chunk.rawOutput === undefined && outputTruncated;

		if (correlatedToolCallId) {
			toolNameByCallId.delete(correlatedToolCallId);
			toolInputByCallId.delete(correlatedToolCallId);
			toolArgsBufferByCallId.delete(correlatedToolCallId);
			resolvedToolInputCallIds.delete(correlatedToolCallId);
			forgetActiveToolCall(correlatedToolCallId);
		}

		if (typeof onThinkingStatus === "function") {
			onThinkingStatus(
				buildThinkingStatusFromToolEvent(
					resolvedToolName,
					chunk.type === "tool_error" ? "error" : "result"
				)
			);
		}
		if (typeof onThinkingEvent === "function") {
			const isToolError = chunk.type === "tool_error";
			const thinkingEvent = buildThinkingEventFromToolEvent({
				toolName: resolvedToolName,
				toolCallId: correlatedToolCallId,
				phase: isToolError ? "error" : "result",
				output: canonicalOutput,
				outputPreview,
				outputTruncated,
				outputBytes,
				suppressedRawOutput,
				errorText: isToolError ? outputPreview : undefined,
				subagentName: chunk.subagentName,
				subagentToolCallId: chunk.subagentToolCallId,
			});
			if (thinkingEvent) {
				onThinkingEvent(thinkingEvent);
			}
		}
	};

	const handleChunk = (chunk) => {
		if (!chunk || typeof chunk !== "object") {
			return;
		}

		if (handleTextChunk(chunk)) {
			return;
		}

		if (chunk.type === "tool_call_start") {
			handleToolCallStart(chunk);
			return;
		}

		if (chunk.type === "tool_call_args") {
			handleToolCallArgs(chunk);
			return;
		}

		if (chunk.type === "deferred-tool-request") {
			return handleDeferredToolRequest(chunk);
		}

		if (chunk.type === "tool_result" || chunk.type === "tool_error") {
			handleToolResult(chunk);
		}
	};

	return {
		handleChunk,
	};
}

module.exports = {
	createRovoToolEventDispatcher,
	normalizeToolCallId,
};
