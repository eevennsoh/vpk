"use strict";

const { withCanonicalPreviewBody } = require("../lib/widget-preview-payload");
const { getNonEmptyString } = require("../lib/shared-utils");
const {
	AGENT_RESULT_STREAM_PREFIX,
	normalizeStudioAgentResult,
	parseJsonObjectAt,
} = require("../lib/studio-agent-result");

const DEFAULT_CLARIFICATION_WIDGET_TYPE = "question-card";
const DEFAULT_GENUI_WIDGET_TYPE = "genui-preview";
const WIDGET_LOADING_PREFIX = "WIDGET_LOADING:";
const WIDGET_DATA_PREFIX = "WIDGET_DATA:";
const THINKING_STATUS_PREFIX = "THINKING_STATUS:";
const AGENT_EXECUTION_PREFIX = "AGENT_EXECUTION:";

function sanitizeThinkingLabel(value) {
	if (typeof value !== "string") {
		return "";
	}

	return value.replace(/(?:\s*(?:\.{3}|…))+$/u, "").trim();
}

function sanitizeThinkingActivity(value) {
	if (
		value === "image" ||
		value === "audio" ||
		value === "ui" ||
		value === "data" ||
		value === "results"
	) {
		return value;
	}

	return undefined;
}

function sanitizeThinkingSource(value) {
	if (value === "backend" || value === "fallback") {
		return value;
	}

	return undefined;
}

function findJsonObjectEndIndex(value, startIndex) {
	let depth = 0;
	let inString = false;
	let isEscaped = false;

	for (let index = startIndex; index < value.length; index += 1) {
		const character = value[index];

		if (inString) {
			if (isEscaped) {
				isEscaped = false;
			} else if (character === "\\") {
				isEscaped = true;
			} else if (character === "\"") {
				inString = false;
			}
			continue;
		}

		if (character === "\"") {
			inString = true;
		} else if (character === "{") {
			depth += 1;
		} else if (character === "}") {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
	}

	return -1;
}

function createRovoMarkerStreamAdapter({
	agentResultPrefix = AGENT_RESULT_STREAM_PREFIX,
	clarificationWidgetType = DEFAULT_CLARIFICATION_WIDGET_TYPE,
	creationMode,
	emitTextDelta,
	genuiWidgetType = DEFAULT_GENUI_WIDGET_TYPE,
	getHasEmittedPlanWidget = () => false,
	logger = console,
	onGenuiWidgetEmitted = () => {},
	onPlanWidgetData = () => {},
	onPlanWidgetLoading = () => {},
	onQuestionCardEmitted = () => {},
	parseAgentResultObject = parseJsonObjectAt,
	widgetId,
	writer,
} = {}) {
	let textBuffer = "";
	let widgetType = null;
	const partialMarkerBufferLength =
		Math.max(
			WIDGET_LOADING_PREFIX.length,
			WIDGET_DATA_PREFIX.length,
			THINKING_STATUS_PREFIX.length,
			AGENT_EXECUTION_PREFIX.length,
			creationMode === "agent" ? agentResultPrefix.length : 0
		) - 1;

	const findNextMarkerIndex = (value) => {
		const loadingIndex = value.indexOf(WIDGET_LOADING_PREFIX);
		const dataIndex = value.indexOf(WIDGET_DATA_PREFIX);
		const thinkingIndex = value.indexOf(THINKING_STATUS_PREFIX);
		const agentExecIndex = value.indexOf(AGENT_EXECUTION_PREFIX);
		const agentResultIndex =
			creationMode === "agent" ? value.indexOf(agentResultPrefix) : -1;
		let minIndex = -1;
		for (const idx of [loadingIndex, dataIndex, thinkingIndex, agentExecIndex, agentResultIndex]) {
			if (idx !== -1 && (minIndex === -1 || idx < minIndex)) {
				minIndex = idx;
			}
		}
		return minIndex;
	};

	const emitInvalidPrefixOrWait = ({
		isFinalChunk,
		jsonStartIndex,
		prefix,
	}) => {
		if (jsonStartIndex >= textBuffer.length) {
			if (isFinalChunk) {
				emitTextDelta(textBuffer);
				textBuffer = "";
			}
			return true;
		}

		if (textBuffer[jsonStartIndex] !== "{") {
			const invalidPrefix = textBuffer.slice(0, jsonStartIndex);
			emitTextDelta(invalidPrefix || prefix);
			textBuffer = textBuffer.slice(jsonStartIndex || prefix.length);
			return true;
		}

		return false;
	};

	const consumeJsonPayload = ({
		isFinalChunk,
		prefix,
		startIndex,
	}) => {
		let jsonStartIndex = startIndex;
		while (
			jsonStartIndex < textBuffer.length &&
			/\s/.test(textBuffer[jsonStartIndex])
		) {
			jsonStartIndex += 1;
		}

		if (emitInvalidPrefixOrWait({ isFinalChunk, jsonStartIndex, prefix })) {
			return null;
		}

		const jsonEndIndex = findJsonObjectEndIndex(textBuffer, jsonStartIndex);
		if (jsonEndIndex === -1) {
			if (isFinalChunk) {
				emitTextDelta(textBuffer);
				textBuffer = "";
			}
			return null;
		}

		const jsonPayload = textBuffer.slice(jsonStartIndex, jsonEndIndex + 1);
		textBuffer = textBuffer
			.slice(jsonEndIndex + 1)
			.replace(/^[\r\n\t ]+/, "");
		return jsonPayload;
	};

	const processWidgetLoading = (isFinalChunk) => {
		const loadingMatch = textBuffer.match(/^WIDGET_LOADING:([A-Za-z0-9_-]+)/u);
		if (!loadingMatch) {
			if (textBuffer.length > WIDGET_LOADING_PREFIX.length) {
				emitTextDelta(WIDGET_LOADING_PREFIX);
				textBuffer = textBuffer.slice(WIDGET_LOADING_PREFIX.length);
				return true;
			}
			if (isFinalChunk) {
				emitTextDelta(textBuffer);
				textBuffer = "";
			}
			return false;
		}

		widgetType = loadingMatch[1];
		if (widgetType === "plan") {
			onPlanWidgetLoading(true);
		}
		writer.write({
			type: "data-widget-loading",
			id: widgetId,
			data: {
				type: widgetType,
				loading: true,
			},
		});

		textBuffer = textBuffer
			.slice(loadingMatch[0].length)
			.replace(/^[\r\n\t ]+/, "");
		return true;
	};

	const processWidgetData = (isFinalChunk) => {
		const jsonPayload = consumeJsonPayload({
			isFinalChunk,
			prefix: WIDGET_DATA_PREFIX,
			startIndex: WIDGET_DATA_PREFIX.length,
		});
		if (!jsonPayload) {
			return false;
		}

		try {
			const parsedWidget = JSON.parse(jsonPayload);
			const resolvedWidgetType = parsedWidget?.type ?? widgetType ?? "widget";
			widgetType = resolvedWidgetType;
			if (resolvedWidgetType === clarificationWidgetType) {
				onQuestionCardEmitted(widgetId);
			}
			if (resolvedWidgetType === genuiWidgetType) {
				if (getHasEmittedPlanWidget()) {
					return true;
				}
				onGenuiWidgetEmitted();
			}
			if (resolvedWidgetType === "plan") {
				onPlanWidgetData(parsedWidget);
				logger.info?.("[PLAN-WIDGET-GENUI] Plan widget emitted from GenUI JSON path", {
					hasMarkdown: Boolean(parsedWidget?.markdown),
					markdownLength: (parsedWidget?.markdown || "").length,
					markdownPreview: (parsedWidget?.markdown || "").slice(0, 300),
					title: parsedWidget?.title,
					taskCount: Array.isArray(parsedWidget?.tasks) ? parsedWidget.tasks.length : 0,
					payloadPreview: JSON.stringify(parsedWidget).slice(0, 500),
				});
			}

			writer.write({
				type: "data-widget-data",
				id: widgetId,
				data: {
					type: resolvedWidgetType,
					payload: withCanonicalPreviewBody(
						resolvedWidgetType,
						resolvedWidgetType === clarificationWidgetType &&
							(creationMode === "agent" || creationMode === "skill")
							? {
									...parsedWidget,
									creationMode,
							  }
							: parsedWidget,
					),
				},
			});

			if (resolvedWidgetType === clarificationWidgetType) {
				return true;
			}

			writer.write({
				type: "data-widget-loading",
				id: widgetId,
				data: {
					type: resolvedWidgetType,
					loading: false,
				},
			});
			if (resolvedWidgetType === "plan") {
				onPlanWidgetLoading(false);
			}
		} catch (error) {
			logger.error?.("Failed to parse widget payload:", error);
			emitTextDelta(`${WIDGET_DATA_PREFIX}${jsonPayload}`);
		}

		return true;
	};

	const processAgentResult = (isFinalChunk) => {
		let jsonStartIndex = agentResultPrefix.length;
		while (
			jsonStartIndex < textBuffer.length &&
			/\s/.test(textBuffer[jsonStartIndex])
		) {
			jsonStartIndex += 1;
		}

		if (emitInvalidPrefixOrWait({
			isFinalChunk,
			jsonStartIndex,
			prefix: agentResultPrefix,
		})) {
			return false;
		}

		const parsedAgentResult = parseAgentResultObject(textBuffer, jsonStartIndex);
		if (!parsedAgentResult) {
			if (isFinalChunk) {
				emitTextDelta(textBuffer);
				textBuffer = "";
			}
			return false;
		}

		textBuffer = textBuffer
			.slice(parsedAgentResult.endIndex + 1)
			.replace(/^[\r\n\t ]+/, "");

		try {
			const normalizedAgentResult = normalizeStudioAgentResult(
				parsedAgentResult.value
			);
			if (normalizedAgentResult) {
				writer.write({
					type: "data-agent-result",
					id: `studio-agent-result-${Date.now()}`,
					data: normalizedAgentResult,
				});
			}
		} catch (error) {
			logger.error?.("Failed to parse agent-result payload:", error);
		}

		return true;
	};

	const processThinkingStatus = (isFinalChunk) => {
		const jsonPayload = consumeJsonPayload({
			isFinalChunk,
			prefix: THINKING_STATUS_PREFIX,
			startIndex: THINKING_STATUS_PREFIX.length,
		});
		if (!jsonPayload) {
			return false;
		}

		try {
			const parsedStatus = JSON.parse(jsonPayload);
			const label = sanitizeThinkingLabel(parsedStatus.label);
			const content =
				typeof parsedStatus.content === "string"
					? parsedStatus.content.trim()
					: "";
			const activity = sanitizeThinkingActivity(parsedStatus.activity);
			const source = sanitizeThinkingSource(parsedStatus.source);
			writer.write({
				type: "data-thinking-status",
				data: {
					label: label || "Working",
					content: content.length > 0 ? content : undefined,
					activity,
					source,
				},
			});
		} catch (error) {
			logger.error?.("Failed to parse thinking-status payload:", error);
			emitTextDelta(`${THINKING_STATUS_PREFIX}${jsonPayload}`);
		}

		return true;
	};

	const processAgentExecution = (isFinalChunk) => {
		const jsonPayload = consumeJsonPayload({
			isFinalChunk,
			prefix: AGENT_EXECUTION_PREFIX,
			startIndex: AGENT_EXECUTION_PREFIX.length,
		});
		if (!jsonPayload) {
			return false;
		}

		try {
			const parsedExecution = JSON.parse(jsonPayload);
			const taskId =
				getNonEmptyString(parsedExecution.taskId) || "unknown";
			writer.write({
				type: "data-agent-execution",
				id: `agent-execution-${taskId}`,
				data: {
					agentId: parsedExecution.agentId || "unknown",
					agentName: parsedExecution.agentName || "Agent",
					taskId,
					taskLabel: parsedExecution.taskLabel || "Task",
					status: parsedExecution.status || "working",
					content: parsedExecution.content,
				},
			});
		} catch (error) {
			logger.error?.("Failed to parse agent-execution payload:", error);
			emitTextDelta(`${AGENT_EXECUTION_PREFIX}${jsonPayload}`);
		}

		return true;
	};

	const processTextBuffer = (isFinalChunk) => {
		while (textBuffer.length > 0) {
			const markerIndex = findNextMarkerIndex(textBuffer);

			if (markerIndex === -1) {
				if (isFinalChunk) {
					emitTextDelta(textBuffer);
					textBuffer = "";
					continue;
				}

				if (textBuffer.length > partialMarkerBufferLength) {
					const flushableLength =
						textBuffer.length - partialMarkerBufferLength;
					emitTextDelta(textBuffer.slice(0, flushableLength));
					textBuffer = textBuffer.slice(flushableLength);
				}
				return;
			}

			if (markerIndex > 0) {
				emitTextDelta(textBuffer.slice(0, markerIndex));
				textBuffer = textBuffer.slice(markerIndex);
				continue;
			}

			if (textBuffer.startsWith(WIDGET_LOADING_PREFIX)) {
				if (processWidgetLoading(isFinalChunk)) {
					continue;
				}
				return;
			}

			if (textBuffer.startsWith(WIDGET_DATA_PREFIX)) {
				if (processWidgetData(isFinalChunk)) {
					continue;
				}
				return;
			}

			if (creationMode === "agent" && textBuffer.startsWith(agentResultPrefix)) {
				if (processAgentResult(isFinalChunk)) {
					continue;
				}
				return;
			}

			if (textBuffer.startsWith(THINKING_STATUS_PREFIX)) {
				if (processThinkingStatus(isFinalChunk)) {
					continue;
				}
				return;
			}

			if (textBuffer.startsWith(AGENT_EXECUTION_PREFIX)) {
				if (processAgentExecution(isFinalChunk)) {
					continue;
				}
				return;
			}

			if (isFinalChunk) {
				emitTextDelta(textBuffer);
				textBuffer = "";
			}
			return;
		}
	};

	return {
		flush() {
			processTextBuffer(true);
		},
		push(delta) {
			if (typeof delta !== "string" || delta.length === 0) {
				return;
			}
			textBuffer += delta;
			processTextBuffer(false);
		},
		reset() {
			textBuffer = "";
			widgetType = null;
		},
	};
}

module.exports = {
	createRovoMarkerStreamAdapter,
	findJsonObjectEndIndex,
	sanitizeThinkingActivity,
	sanitizeThinkingLabel,
	sanitizeThinkingSource,
};
