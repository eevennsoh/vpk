import {
	getAllDataParts,
	hasCreatePlanSkillSignal,
	hasTurnCompleteSignal,
	getLatestDataPart,
	getLatestRouteDecision,
	getMessageReasoning,
	getMessageSources,
	getMessageText,
	getThinkingToolCallSummaries,
	getToolFirstWarning,
	getMessageToolParts,
	isMessageTextStreaming,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import { getNormalizedWidgetDataParts } from "../thread-message/lib/widget-selection";
import {
	extractPlanRenderableText,
	removeActionItemsSection,
	removeLeadingSingleCharacterFragment,
	removeTrailingSingleCharacterLine,
	sanitizeMarkdownArtifactMarkers,
} from "./message-text-utils";

/** Message facts have no dependency on which surface can render a widget. */
export function readAssistantMessage(message: RovoUIMessage) {
	const widgetLoadingPart = getLatestDataPart(message, "data-widget-loading");
	const widgetDataPart = getLatestDataPart(message, "data-widget-data");
	const widgetErrorPart = getLatestDataPart(message, "data-widget-error");
	const widgetDataParts = getNormalizedWidgetDataParts(message);
	const latestWidgetDataEntry = widgetDataParts.at(-1) ?? null;
	return {
		rawMessageText: getMessageText(message),
		isStreaming: isMessageTextStreaming(message),
		hasTurnComplete: hasTurnCompleteSignal(message),
		isCreatePlanSkillFlow: hasCreatePlanSkillSignal(message),
		widgetLoadingPart,
		widgetDataPart,
		widgetDataParts,
		latestWidgetDataEntry,
		widgetErrorPart,
		widgetType: latestWidgetDataEntry?.widgetType ?? widgetLoadingPart?.data.type ?? widgetErrorPart?.data.type,
		isWidgetLoading: widgetLoadingPart?.data.loading ?? false,
		suggestedQuestions: getLatestDataPart(message, "data-suggested-questions")?.data.questions ?? [],
		reasoning: getMessageReasoning(message),
		sources: getMessageSources(message),
		toolFirstWarning: getToolFirstWarning(message),
		toolParts: getMessageToolParts(message),
		thinkingToolCalls: getThinkingToolCallSummaries(message),
		thinkingStatusPart: getLatestDataPart(message, "data-thinking-status"),
		thinkingStatusParts: getAllDataParts(message, "data-thinking-status"),
		thinkingEventParts: getAllDataParts(message, "data-thinking-event"),
		browserScreenshots: getAllDataParts(message, "data-browser-screenshot"),
		hasArtifactResult: Boolean(getLatestDataPart(message, "data-artifact-result")),
		hasAgentResult: Boolean(getLatestDataPart(message, "data-agent-result")),
		routeDecision: getLatestRouteDecision(message),
	};
}

export type AssistantMessageFacts = ReturnType<typeof readAssistantMessage>;

/** Surface widget selection may differ from the message's latest widget. */
export function presentAssistantMessageText(facts: AssistantMessageFacts, widgetType = facts.widgetType) {
	const normalizedWidgetText = widgetType
		? removeLeadingSingleCharacterFragment(facts.rawMessageText)
		: facts.rawMessageText;
	const planRenderableText = widgetType === "plan"
		? extractPlanRenderableText(normalizedWidgetText, { maxSummaryLines: 2 })
		: null;
	const baseMessageText = widgetType === "question-card"
		? removeTrailingSingleCharacterLine(normalizedWidgetText)
		: widgetType === "plan"
			? facts.isCreatePlanSkillFlow
				? planRenderableText?.text ?? ""
				: removeActionItemsSection(normalizedWidgetText)
			: normalizedWidgetText;
	return {
		normalizedWidgetText,
		messageText: sanitizeMarkdownArtifactMarkers(baseMessageText),
	};
}
