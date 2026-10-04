import type { ReasoningPhase } from "@/components/projects/shared/hooks/use-reasoning-phase";
import { getReasoningCompletedLabel } from "@/components/projects/shared/lib/reasoning-labels";
import { resolveThinkingLabelForSurface } from "@/components/projects/shared/lib/thinking-label-policy";

interface ResolveThinkingStatusActiveOptions {
	hasThinkingStatusPart: boolean;
	hasThinkingEvents: boolean;
	isRetryThinkingStatus: boolean;
	isStreaming: boolean;
}

interface ResolveThinkingStatusLifecycleStreamingOptions {
	isThinkingLifecycleStreaming: boolean;
	isThinkingStatusActive: boolean;
	hasBackendThinkingActivity: boolean;
}

interface ResolvePostToolsGenuiGenerationOptions {
	widgetType: string | undefined;
	isWidgetLoading: boolean;
	hasAnyToolCalls: boolean;
	hasRunningToolCalls: boolean;
}

interface ResolveThinkingStatusTriggerLabelOptions {
	resolvedLabel: string;
	reasoningPhase: ReasoningPhase;
	duration: number | undefined;
}

export function isThinkingStatusActive({
	hasThinkingStatusPart,
	hasThinkingEvents,
	isRetryThinkingStatus,
	isStreaming,
}: Readonly<ResolveThinkingStatusActiveOptions>): boolean {
	const hasThinkingSignals = hasThinkingStatusPart || hasThinkingEvents;
	if (!hasThinkingSignals) {
		return false;
	}

	if (isRetryThinkingStatus && !isStreaming) {
		return false;
	}

	return true;
}

export function isThinkingStatusLifecycleStreaming({
	isThinkingLifecycleStreaming,
	isThinkingStatusActive,
	hasBackendThinkingActivity,
}: Readonly<ResolveThinkingStatusLifecycleStreamingOptions>): boolean {
	return (
		isThinkingLifecycleStreaming &&
		isThinkingStatusActive &&
		hasBackendThinkingActivity
	);
}

export function isPostToolsGenuiGeneration({
	widgetType,
	isWidgetLoading,
	hasAnyToolCalls,
	hasRunningToolCalls,
}: Readonly<ResolvePostToolsGenuiGenerationOptions>): boolean {
	return (
		widgetType === "genui-preview" &&
		isWidgetLoading &&
		hasAnyToolCalls &&
		!hasRunningToolCalls
	);
}

export function resolveThinkingStatusTriggerLabel({
	resolvedLabel,
	reasoningPhase,
	duration,
}: Readonly<ResolveThinkingStatusTriggerLabelOptions>): string {
	const hasCompletedDuration =
		typeof duration === "number" &&
		Number.isFinite(duration) &&
		duration > 0;

	if (reasoningPhase === "completed") {
		return getReasoningCompletedLabel(hasCompletedDuration ? duration : 0);
	}

	return resolveThinkingLabelForSurface({
		baseLabel: resolvedLabel,
		surface: "fullscreen",
		reasoningPhase,
	});
}
