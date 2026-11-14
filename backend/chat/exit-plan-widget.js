"use strict";

const {
	getNonEmptyString,
	parseMaybeJson,
} = require("../lib/shared-utils");

function normalizeExitPlanToolInput(toolInput) {
	if (typeof toolInput === "string") {
		return parseMaybeJson(toolInput) ?? toolInput;
	}

	return toolInput;
}

function isObjectLike(value) {
	return value !== null && typeof value === "object";
}

function buildExitPlanWidgetPayloadFromToolInput({ toolCallId, toolInput } = {}) {
	const normalizedToolInput = normalizeExitPlanToolInput(toolInput);
	const hasObjectInput = isObjectLike(normalizedToolInput);
	const planMarkdown = hasObjectInput
		? getNonEmptyString(normalizedToolInput.plan)
		: getNonEmptyString(normalizedToolInput);
	if (!planMarkdown) {
		return {
			normalizedToolInput,
			payload: null,
		};
	}

	return {
		normalizedToolInput,
		payload: {
			title: hasObjectInput
				? getNonEmptyString(normalizedToolInput.title) ||
					getNonEmptyString(normalizedToolInput.name) ||
					getNonEmptyString(normalizedToolInput.planTitle) ||
					"Plan"
				: "Plan",
			description: hasObjectInput
				? getNonEmptyString(normalizedToolInput.description) ||
					getNonEmptyString(normalizedToolInput.summary) ||
					getNonEmptyString(normalizedToolInput.subtitle) ||
					undefined
				: undefined,
			shortDescription: hasObjectInput
				? getNonEmptyString(normalizedToolInput.shortDescription) ||
					getNonEmptyString(normalizedToolInput.short_description) ||
					undefined
				: undefined,
			markdown: planMarkdown,
			tasks: hasObjectInput && Array.isArray(normalizedToolInput.tasks)
				? normalizedToolInput.tasks
				: hasObjectInput && Array.isArray(normalizedToolInput.steps)
					? normalizedToolInput.steps
					: [],
			agents: hasObjectInput && Array.isArray(normalizedToolInput.agents)
				? normalizedToolInput.agents
				: [],
			deferredToolCallId: toolCallId,
		},
	};
}

function previewToolInput(toolInput, maxChars) {
	if (typeof toolInput === "string") {
		return toolInput.slice(0, maxChars);
	}

	try {
		const serialized = JSON.stringify(toolInput);
		if (typeof serialized === "string") {
			return serialized.slice(0, maxChars);
		}
	} catch {
		return String(toolInput).slice(0, maxChars);
	}

	return String(toolInput).slice(0, maxChars);
}

function createExitPlanWidgetEmitter({
	getIsPlanWidgetLoading = () => false,
	logger = console,
	onPlanWidgetData = () => {},
	onPlanWidgetLoading = () => {},
	recordPlanWidgetEmission,
	threadId,
	widgetId,
	writer,
} = {}) {
	const emitLoading = (loading) => {
		writer.write({
			type: "data-widget-loading",
			id: widgetId,
			data: {
				type: "plan",
				loading,
			},
		});
		onPlanWidgetLoading(loading);
	};

	const emitData = (payload) => {
		writer.write({
			type: "data-widget-data",
			id: widgetId,
			data: {
				type: "plan",
				payload,
			},
		});
		onPlanWidgetData(payload);
	};

	const emitFromToolInput = ({
		toolCallId,
		toolInput,
		source,
	}) => {
		const { payload: planPayload } = buildExitPlanWidgetPayloadFromToolInput({
			toolCallId,
			toolInput,
		});
		if (!planPayload) {
			logger.warn?.("[EXIT-PLAN-MODE] Plan markdown missing from tool input", {
				toolCallId,
				source,
				toolInputPreview: previewToolInput(toolInput, 200),
			});
			return false;
		}

		if (threadId && typeof recordPlanWidgetEmission === "function") {
			recordPlanWidgetEmission(threadId, {
				deferredToolCallId: toolCallId,
				planCardId: widgetId,
			});
		}
		emitData(planPayload);
		if (getIsPlanWidgetLoading()) {
			emitLoading(false);
		}
		logger.info?.("[EXIT-PLAN-MODE] Plan widget emitted from tool input", {
			toolCallId,
			source,
			taskCount: Array.isArray(planPayload.tasks) ? planPayload.tasks.length : 0,
			hasMarkdown: Boolean(planPayload.markdown),
			markdownLength: planPayload.markdown?.length ?? 0,
			markdownPreview: (planPayload.markdown || "").slice(0, 300),
			title: planPayload.title,
			description: (planPayload.description || "").slice(0, 100),
			rawToolInputType: typeof toolInput,
			rawToolInputPreview: previewToolInput(toolInput, 300),
		});
		return true;
	};

	return {
		emitData,
		emitFromToolInput,
		emitLoading,
	};
}

module.exports = {
	buildExitPlanWidgetPayloadFromToolInput,
	createExitPlanWidgetEmitter,
	normalizeExitPlanToolInput,
};
