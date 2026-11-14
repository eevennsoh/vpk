import { useMemo } from "react";
import {
	getMessageReasoningTimestamps,
	getMessageText,
	getLatestDataPart,
	hasTurnCompleteSignal,
	type RovoRenderableUIMessage,
} from "@/lib/rovo-ui-messages";
import { collectAssistantThinkingTraceData } from "@/components/projects/shared/lib/assistant-thinking-trace-state";
import { useDynamicThinkingLabel } from "@/components/projects/shared/hooks/use-dynamic-thinking-label";
import {
	useReasoningPhase,
	getReasoningPropsForPhase,
	type ReasoningPhase,
	type ReasoningPhaseProps,
} from "@/components/projects/shared/hooks/use-reasoning-phase";
import {
	resolveThinkingLabelForSurface,
} from "@/components/projects/shared/lib/thinking-label-policy";
import { getDefaultThinkingLabel } from "@/components/ui-custom/lib/reasoning-labels";
import {
	isCompletedAssistantFromPreviousRequest,
	resolveThinkingIndicatorVisibility,
} from "@/components/projects/shared/lib/reasoning-display-phase";

interface UseThinkingStatusOptions {
	messages: ReadonlyArray<RovoRenderableUIMessage>;
	isRequestInFlight: boolean;
	activeRequestStartedAt?: number | null;
}

interface ThinkingStatusResult {
	shouldShowThinking: boolean;
	shouldShowPreloader: boolean;
	shouldShowThinkingStatus: boolean;
	hasBackendThinkingStarted: boolean;
	isAssistantAwaitingOutput: boolean;
	hasInlineThinkingStatus: boolean;
	resolvedThinkingLabel: string;
	trimmedReasoningContent: string;
	hasReasoningContent: boolean;
	thinkingToolCalls: ReturnType<typeof collectAssistantThinkingTraceData>["thinkingToolCalls"];
	hasThinkingToolCalls: boolean;
	hasThinkingDetails: boolean;
	allowAutoCollapse: boolean;
	streamingReasoningKey: string;
	lastMessage: RovoRenderableUIMessage | undefined;
	reasoningPhase: ReasoningPhase;
	reasoningPhaseProps: ReasoningPhaseProps;
}

export function useThinkingStatus({
	messages,
	isRequestInFlight,
	activeRequestStartedAt,
}: Readonly<UseThinkingStatusOptions>): ThinkingStatusResult {
	const hasMessages = messages.length > 0;
	const lastMessage = messages[messages.length - 1];
	const isAssistantMessage = lastMessage?.role === "assistant";

	const isAssistantAwaitingOutput =
		isRequestInFlight &&
		hasMessages &&
		isAssistantMessage &&
		getMessageText(lastMessage) === "";
	const thinkingTraceData = isAssistantMessage
		? collectAssistantThinkingTraceData(lastMessage)
		: null;
	const thinkingStatusParts = thinkingTraceData?.thinkingStatusParts ?? [];
	const thinkingStatusPart =
		thinkingStatusParts[thinkingStatusParts.length - 1] ?? null;
	const hasAssistantThinkingStatus = thinkingStatusPart !== null;

	const thinkingEventParts = thinkingTraceData?.thinkingEventParts ?? [];
	const lastThinkingEventPart =
		thinkingEventParts[thinkingEventParts.length - 1] ?? null;
	const thinkingToolCalls = thinkingTraceData?.thinkingToolCalls ?? [];
	const hasThinkingToolCalls = thinkingToolCalls.length > 0;
	const hasBackendThinkingStarted =
		thinkingTraceData?.hasBackendThinkingActivity ?? false;
	const hasTurnComplete =
		isAssistantMessage ? hasTurnCompleteSignal(lastMessage) : false;
	const turnCompletedAt = isAssistantMessage
		? getLatestDataPart(lastMessage, "data-turn-complete")?.data.timestamp
		: null;
	const isPreviousCompletedAssistant =
		isCompletedAssistantFromPreviousRequest({
			activeRequestStartedAt,
			hasTurnComplete,
			turnCompletedAt,
		});

	// Suppress the external placeholder while the visible assistant message
	// already owns the trace. Only show the placeholder against a completed
	// assistant when a newer request started after that turn finished.
	const hasInlineThinkingStatus =
		isAssistantMessage && hasBackendThinkingStarted && !isPreviousCompletedAssistant;
	const hasActiveThinkingSignals = hasBackendThinkingStarted && !isPreviousCompletedAssistant;
	const isThinkingStreaming = isRequestInFlight && hasActiveThinkingSignals;

	// Detect the gap after a hidden message submit (e.g. clarification answer)
	// where the request is in flight but no new assistant message has appeared
	// yet. The last visible message is a completed assistant from the prior turn.
	const isWaitingForNewTurn =
		isAssistantMessage && hasTurnComplete && isPreviousCompletedAssistant;

	const shouldShowThinking =
		isRequestInFlight &&
		!hasInlineThinkingStatus &&
		(
			(hasMessages &&
				(lastMessage?.role === "user" || isAssistantAwaitingOutput || isWaitingForNewTurn)) ||
			!hasMessages
		);

	const thinkingStatusUpdateSignal = useMemo(
		() =>
			[
				lastMessage?.id ?? "stream",
				`status-count:${thinkingStatusParts.length}`,
				`status-id:${thinkingStatusPart?.id ?? ""}`,
				`status-label:${thinkingStatusPart?.data.label ?? ""}`,
				`status-content:${thinkingStatusPart?.data.content ?? ""}`,
				`event-count:${thinkingEventParts.length}`,
				`event-id:${lastThinkingEventPart?.data.eventId ?? ""}`,
				`event-phase:${lastThinkingEventPart?.data.phase ?? ""}`,
			].join("|"),
		[
			lastMessage?.id,
			thinkingStatusParts.length,
			thinkingStatusPart?.id,
			thinkingStatusPart?.data.label,
			thinkingStatusPart?.data.content,
			thinkingEventParts.length,
			lastThinkingEventPart?.data.eventId,
			lastThinkingEventPart?.data.phase,
		]
	);

	const { label: dynamicThinkingLabel } = useDynamicThinkingLabel({
		baseLabel: thinkingStatusPart?.data.label ?? getDefaultThinkingLabel(),
		isStreaming: isThinkingStreaming,
		updateSignal: thinkingStatusUpdateSignal,
		fallbackLabel: getDefaultThinkingLabel(),
	});

	const resolvedReasoningContent = hasAssistantThinkingStatus
		? thinkingStatusParts
				.map((part) => part.data.content)
				.filter(Boolean)
				.join("\n\n")
		: "";

	const trimmedReasoningContent = resolvedReasoningContent.trim();
	const hasReasoningContent = trimmedReasoningContent.length > 0;
	const hasThinkingDetails = hasReasoningContent || hasThinkingToolCalls;
	const streamingReasoningKey = lastMessage?.id ?? "stream";
	const reasoningTimestamps = lastMessage
		? getMessageReasoningTimestamps(lastMessage)
		: {};

	const { phase: reasoningPhase, duration: reasoningDuration } =
		useReasoningPhase({
			isStreaming: isThinkingStreaming,
			hasMessageText: hasActiveThinkingSignals,
			responseKey: streamingReasoningKey,
			autoIdle: true,
			minPreloadMs: 0,
			persistedStartTime: reasoningTimestamps.startedAt,
			persistedEndTime: reasoningTimestamps.completedAt,
		});
	const resolvedThinkingLabel = resolveThinkingLabelForSurface({
		baseLabel: dynamicThinkingLabel,
		surface: "sidebar",
		reasoningPhase,
	});
	const visibility = resolveThinkingIndicatorVisibility({
		requestActive: shouldShowThinking,
		hasThinkingStatusInline: hasInlineThinkingStatus,
		hasBackendThinkingActivity: hasActiveThinkingSignals,
		reasoningPhase,
	});

	const reasoningPhaseProps = getReasoningPropsForPhase(
		reasoningPhase,
		reasoningDuration,
		hasThinkingDetails
	);

	return {
		shouldShowThinking: visibility.shouldShowAny,
		shouldShowPreloader: visibility.shouldShowPreloader,
		shouldShowThinkingStatus: visibility.shouldShowThinkingStatus,
		hasBackendThinkingStarted,
		isAssistantAwaitingOutput,
		hasInlineThinkingStatus,
		resolvedThinkingLabel,
		trimmedReasoningContent,
		hasReasoningContent,
		thinkingToolCalls,
		hasThinkingToolCalls,
		hasThinkingDetails,
		allowAutoCollapse: hasTurnComplete,
		streamingReasoningKey,
		lastMessage,
		reasoningPhase,
		reasoningPhaseProps,
	};
}
