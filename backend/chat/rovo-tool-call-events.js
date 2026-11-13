"use strict";

const { redactLogText } = require("../lib/log-redaction");

function handleRovoToolCallStartEvent(toolCall, {
	bashQuestionCardWorkaroundCallIds,
	browserToolEventRouter,
	emitExitPlanWidget,
	emitRequestUserInputQuestionCard,
	isBashQuestionCardWorkaround,
	isExitPlanModeTool,
	isRequestUserInputTool,
	isToolNameRelevant,
	maybeGuardPlanFeedbackTool,
	onObservedActionableToolCall,
	onObservedDeferredToolRequest,
	onObservedRelevantActionableToolCall,
	toolFirstRelevanceDomains = [],
} = {}) {
	if (!toolCall || typeof toolCall !== "object") {
		return false;
	}

	if (browserToolEventRouter.handleToolCallStart(toolCall)) {
		return true;
	}

	const toolGuard = maybeGuardPlanFeedbackTool({
		toolCallId: toolCall.toolCallId,
		toolName: toolCall.toolName,
	});
	if (toolGuard.ignore || toolGuard.block) {
		return true;
	}

	if (toolCall.isDeferredToolRequest === true) {
		onObservedDeferredToolRequest?.();
		if (isRequestUserInputTool(toolCall.toolName) && toolCall.toolInput) {
			emitRequestUserInputQuestionCard({
				toolName: "ask_user_questions",
				toolCallId: toolCall.toolCallId,
				questionInput: toolCall.toolInput,
				source: "deferred_tool_request",
			});
		}

		if (isExitPlanModeTool(toolCall.toolName) && toolCall.toolInput) {
			emitExitPlanWidget({
				toolCallId: toolCall.toolCallId,
				toolInput: toolCall.toolInput,
				source: "deferred_tool_request",
			});
		}
		return true;
	}

	if (isRequestUserInputTool(toolCall.toolName)) {
		return true;
	}

	if (isBashQuestionCardWorkaround(toolCall.toolName, toolCall.toolInput)) {
		if (toolCall.toolCallId) {
			bashQuestionCardWorkaroundCallIds.add(toolCall.toolCallId);
		}
		if (toolCall.toolInput) {
			emitRequestUserInputQuestionCard({
				toolName: "ask_user_questions",
				toolCallId: toolCall.toolCallId,
				questionInput: toolCall.toolInput,
				source: "bash_workaround_tool_input",
			});
		}
		return true;
	}

	if (
		isToolNameRelevant({
			toolName: toolCall.toolName,
			domains: toolFirstRelevanceDomains,
		})
	) {
		onObservedRelevantActionableToolCall?.();
	}
	onObservedActionableToolCall?.();
	return true;
}

function warnOnDangerousResolvedToolInput(toolCall, {
	classifyCommand,
	extractCommandFromArgs,
	logger = console,
} = {}) {
	if (!toolCall?.toolInput) {
		return false;
	}

	const cmd = extractCommandFromArgs(toolCall.toolInput);
	if (!cmd) {
		return false;
	}

	const classification = classifyCommand(cmd);
	if (!classification) {
		return false;
	}

	logger.warn(
		`[SAFETY] Dangerous command detected in ${toolCall.toolName}: ${classification.label} (${redactLogText(classification.match)})`,
	);
	return true;
}

function handleRovoToolCallInputResolvedEvent(toolCall, {
	bashQuestionCardWorkaroundCallIds,
	browserToolEventRouter,
	classifyCommand,
	emitRequestUserInputQuestionCard,
	extractCommandFromArgs,
	isBashQuestionCardWorkaround,
	isRequestUserInputTool,
	logger = console,
} = {}) {
	warnOnDangerousResolvedToolInput(toolCall, {
		classifyCommand,
		extractCommandFromArgs,
		logger,
	});

	if (!isRequestUserInputTool(toolCall?.toolName)) {
		emitRequestUserInputQuestionCard({
			toolName: toolCall?.toolName,
			toolCallId: toolCall?.toolCallId,
			questionInput: toolCall?.toolInput,
			source: "request_user_input_tool_input",
		});
	}

	if (isBashQuestionCardWorkaround(toolCall?.toolName, toolCall?.toolInput)) {
		if (toolCall?.toolCallId) {
			bashQuestionCardWorkaroundCallIds.add(toolCall.toolCallId);
		}
		emitRequestUserInputQuestionCard({
			toolName: "ask_user_questions",
			toolCallId: toolCall?.toolCallId,
			questionInput: toolCall?.toolInput,
			source: "bash_workaround_tool_input",
		});
	}

	browserToolEventRouter.handleToolCallInputResolved(toolCall);
	return true;
}

module.exports = {
	handleRovoToolCallInputResolvedEvent,
	handleRovoToolCallStartEvent,
	warnOnDangerousResolvedToolInput,
};
