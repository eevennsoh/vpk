"use client";

/* eslint-disable @typescript-eslint/no-unused-vars -- These underscored compatibility props and inferred generic placeholders are intentionally retained for API shape. */

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NewCoreIconProps } from "@atlaskit/icon/base-new";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import AiGenerativeTextSummaryIcon from "@atlaskit/icon/core/ai-generative-text-summary";
import ListChecklistIcon from "@atlaskit/icon/core/list-checklist";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import {
	ChainOfThought,
	ChainOfThoughtContent,
	ChainOfThoughtHeader,
	ChainOfThoughtStep,
} from "@/components/ui-custom/chain-of-thought";
import { CodeBlock } from "@/components/ui-custom/code-block";
import { MessageContent, MessageResponse } from "@/components/ui-custom/message";
import { isTimelineOnlyContent } from "@/components/ui-custom/reasoning";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { AnimatedDot } from "@/components/ui-custom/animated-dot";
import { Spinner } from "@/components/ui/spinner";
import { ToolInput, ToolOutput } from "@/components/ui-custom/tool";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Lozenge } from "@/components/ui/lozenge";
import { useDynamicThinkingLabel } from "@/components/projects/shared/hooks/use-dynamic-thinking-label";
import { useReasoningPhase, type ReasoningPhase } from "@/components/projects/shared/hooks/use-reasoning-phase";
import {
	getAwaitingUserResponseLabel,
	getDefaultThinkingLabel,
	getQuestionsAnsweredLabel,
	getReasoningSectionTitle,
} from "@/components/ui-custom/lib/reasoning-labels";
import {
	areAllThinkingToolCallsSettled,
	collectAssistantThinkingTraceData,
	resolveAssistantThinkingTraceOpen,
	resolveAssistantThinkingTracePhase,
	resolveAssistantThinkingTraceResponseGenerationStep,
	resolveAssistantThinkingTraceVisibility,
	resolveThinkingToolCallStepOpen,
	shouldCollapseAssistantThinkingTraceOnPhaseChange,
	type AssistantThinkingTraceData,
} from "@/components/projects/shared/lib/assistant-thinking-trace-state";
import {
	isThinkingStatusActive as checkThinkingStatusActive,
	resolveThinkingStatusTriggerLabel,
} from "@/components/projects/shared/thread-message/lib/thinking-status-state";
import {
	getMessageReasoningTimestamps,
	hasTurnCompleteSignal,
	type AgentExecutionStatus,
	type AgentExecutionSummary,
	type RovoUIMessage,
	type ThinkingNarrationDetailRow,
	type ThinkingToolCallSummary,
} from "@/lib/rovo-ui-messages";
import {
	type RovoAppTodoProgressItem,
} from "@/components/projects/shared/lib/rovo-todo-progress";
import {
	defaultAssistantThinkingToolTracePresentationResolver,
	type AssistantThinkingToolTracePresentationResolver,
} from "@/components/projects/shared/lib/assistant-thinking-trace-presentation";
import { getThinkingToolByline, getThinkingToolTitle } from "@/components/projects/shared/lib/thinking-tool-display";
import { renderResolvedToolIcon, resolveToolIcon } from "@/components/projects/shared/lib/tool-icon-resolver";
import { cn } from "@/lib/utils";

export interface AssistantThinkingTraceState {
	accumulatedThinkingContent: string;
	data: AssistantThinkingTraceData;
	hasPlanNarrationText: boolean;
	hasThinkingDetails: boolean;
	isOpen: boolean;
	isThinkingStreaming: boolean;
	message: RovoUIMessage;
	onOpenChange: (open: boolean) => void;
	planNarrationStreaming: boolean;
	planNarrationText: string;
	reasoningDuration: number | undefined;
	reasoningPhase: ReasoningPhase;
	shouldShowResponseGenerationStep: boolean;
	shouldShowThinkingSection: boolean;
	thinkingActive: boolean;
	triggerLabel: string;
}

interface UseAssistantThinkingTraceStateOptions {
	message: RovoUIMessage;
	isThinkingLifecycleStreaming: boolean;
	isResponseInFlight: boolean;
	answeredQuestionToolCallIds?: readonly string[];
	isPostToolsGeneration?: boolean;
	isPostToolsResultPending?: boolean;
	hasWidgetOutput?: boolean;
	isRetryThinkingStatus?: boolean;
	thinkingToolCalls?: ThinkingToolCallSummary[];
	treatQuestionToolCallsAsAnswered?: boolean;
	/**
	 * For scripted-trace surfaces (Studio agent creation) with no real
	 * post-tools generation signal: when set, the "Generating a response" step
	 * is shown once every thinking tool call has settled while the response is
	 * still streaming (turn not complete).
	 */
	treatSettledToolsAsPostResultPending?: boolean;
	planNarrationText?: string;
	planNarrationStreaming?: boolean;
}

interface AssistantThinkingTraceProps {
	state: AssistantThinkingTraceState;
	className?: string;
	toolTracePresentationResolver?: AssistantThinkingToolTracePresentationResolver;
}

const StepThinkingIcon = ({ label = "", size = "small", spacing = "none", ...props }: NewCoreIconProps) => <Icon render={<AiAgentIcon label={label} size={size} spacing={spacing} {...props} />} />;
const StepChecklistIcon = ({ label = "", size = "small", spacing = "none", ...props }: NewCoreIconProps) => (
	<Icon render={<ListChecklistIcon label={label} size={size} spacing={spacing} {...props} />} />
);
const StepAgentsIcon = ({ label = "", size = "small", spacing = "none", ...props }: NewCoreIconProps) => <Icon render={<PeopleGroupIcon label={label} size={size} spacing={spacing} {...props} />} />;
const StepStreamIcon = ({ label = "", size = "small", spacing = "none", ...props }: NewCoreIconProps) => (
	<Icon render={<AiGenerativeTextSummaryIcon label={label} size={size} spacing={spacing} {...props} />} />
);

function toolStateToCoTStatus(state: string): "complete" | "active" | "pending" {
	if (state === "running" || state === "awaiting-input" || state === "approval-requested") {
		return "active";
	}
	if (state === "pending") {
		return "pending";
	}
	return "complete";
}

function isToolCallStepOpenByDefault(state: string): boolean {
	return state === "running" || state === "awaiting-input" || state === "approval-requested" || state === "error" || state === "denied";
}

function getAgentExecutionVariant(status: AgentExecutionStatus): ComponentProps<typeof Lozenge>["variant"] {
	if (status === "completed") {
		return "success";
	}
	if (status === "failed") {
		return "danger";
	}
	return "information";
}

function getAgentExecutionLabel(status: AgentExecutionStatus): string {
	if (status === "completed") {
		return "Completed";
	}
	if (status === "failed") {
		return "Failed";
	}
	return "Working";
}

function getTodoProgressVariant(status: RovoAppTodoProgressItem["status"]): ComponentProps<typeof Lozenge>["variant"] {
	if (status === "completed") {
		return "success";
	}
	if (status === "in_progress") {
		return "information";
	}
	return "neutral";
}

function getTodoProgressLabel(status: RovoAppTodoProgressItem["status"]): string {
	if (status === "completed") {
		return "Completed";
	}
	if (status === "in_progress") {
		return "In progress";
	}
	return "Pending";
}

function TraceStepsSection({
	items,
}: Readonly<{
	items: ReadonlyArray<{
		id: string;
		text: string;
		blockedBy: string[];
		agent?: string;
	}>;
}>) {
	return (
		<div className="space-y-2">
			{items.map((item) => {
				const isBlocked = item.blockedBy.length > 0;

				return (
					<div key={item.id} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
						<div className="flex flex-wrap items-start gap-2">
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-text">{item.text}</p>
								<div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-text-subtle">
									<span>{item.id}</span>
									{item.agent ? <span>{item.agent}</span> : null}
									{isBlocked ? <span>Blocked by {item.blockedBy.join(", ")}</span> : <span>Ready to run</span>}
								</div>
							</div>
							<Lozenge variant={isBlocked ? "warning" : "neutral"}>{isBlocked ? "Blocked" : "Queued"}</Lozenge>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function TraceTodoProgressSection({
	items,
}: Readonly<{
	items: ReadonlyArray<RovoAppTodoProgressItem>;
}>) {
	return (
		<div className="space-y-2">
			{items.map((item) => (
				<div key={item.id} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
					<div className="flex flex-wrap items-start gap-2">
						<div className="min-w-0 flex-1">
							<p className="text-sm font-medium text-text">{item.label}</p>
							<div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-text-subtle">
								<span>{item.id}</span>
								{item.activeForm && item.activeForm !== item.content ? <span>{item.content}</span> : null}
							</div>
						</div>
						<Lozenge variant={getTodoProgressVariant(item.status)}>{getTodoProgressLabel(item.status)}</Lozenge>
					</div>
				</div>
			))}
		</div>
	);
}

function TraceAgentExecutionSection({
	executions,
}: Readonly<{
	executions: ReadonlyArray<AgentExecutionSummary>;
}>) {
	return (
		<div className="space-y-2">
			{executions.map((execution) => (
				<div key={execution.taskId} className="space-y-2">
					<div className="flex flex-wrap items-start gap-2">
						<div className="min-w-0 flex-1">
							<p className="text-sm font-medium text-text">{execution.taskLabel}</p>
							<div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-text-subtle">
								<span>{execution.agentName}</span>
								<span>{execution.taskId}</span>
							</div>
						</div>
						<Lozenge variant={getAgentExecutionVariant(execution.status)}>{getAgentExecutionLabel(execution.status)}</Lozenge>
					</div>
					{execution.content ? (
						<div className="text-xs text-text-subtle">
							<MessageContent>
								<MessageResponse>{execution.content}</MessageResponse>
							</MessageContent>
						</div>
					) : null}
				</div>
			))}
		</div>
	);
}

export function useAssistantThinkingTraceState({
	message,
	isThinkingLifecycleStreaming,
	isResponseInFlight,
	answeredQuestionToolCallIds,
	isPostToolsGeneration = false,
	isPostToolsResultPending = false,
	hasWidgetOutput = false,
	isRetryThinkingStatus = false,
	thinkingToolCalls,
	treatQuestionToolCallsAsAnswered = false,
	treatSettledToolsAsPostResultPending = false,
	planNarrationText = "",
	planNarrationStreaming = false,
}: Readonly<UseAssistantThinkingTraceStateOptions>): AssistantThinkingTraceState {
	const data = useMemo(
		() => collectAssistantThinkingTraceData(message, {
			answeredQuestionToolCallIds,
			thinkingToolCalls,
			treatQuestionToolCallsAsAnswered,
		}),
		[
			answeredQuestionToolCallIds,
			message,
			thinkingToolCalls,
			treatQuestionToolCallsAsAnswered,
		],
	);
	const hasTurnComplete = hasTurnCompleteSignal(message);
	const rawThinkingActive = checkThinkingStatusActive({
		hasThinkingStatusPart: data.hasThinkingStatusPart,
		hasThinkingEvents: data.hasTraceDataSignals,
		isRetryThinkingStatus,
		isStreaming: isThinkingLifecycleStreaming,
	});
	const [hasLatchedThinking, setHasLatchedThinking] = useState(false);
	const { effectiveIsThinkingActive, nextLatched } = resolveAssistantThinkingTraceVisibility({
		isThinkingActive: rawThinkingActive,
		isResponseInFlight,
		wasLatched: hasLatchedThinking,
	});

	useEffect(() => {
		if (hasLatchedThinking === nextLatched) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			setHasLatchedThinking(nextLatched);
		}, 0);

		return () => window.clearTimeout(timeoutId);
	}, [hasLatchedThinking, nextLatched]);

	const thinkingActive = effectiveIsThinkingActive;
	const isThinkingStreaming =
		isThinkingLifecycleStreaming &&
		thinkingActive &&
		data.hasBackendThinkingActivity;
	const accumulatedThinkingContent = data.thinkingNarrationMap.unassociated.join("\n\n");
	const hasThinkingText = Boolean(accumulatedThinkingContent);
	const shouldShowThinkingSection =
		hasThinkingText &&
		!(isTimelineOnlyContent(accumulatedThinkingContent) && data.hasThinkingToolCalls);
	const hasPlanNarrationText = Boolean(planNarrationText);
	const shouldShowResponseGenerationStep = resolveAssistantThinkingTraceResponseGenerationStep({
		hasAwaitingInputToolCalls: data.hasAwaitingInputToolCalls,
		hasThinkingToolCalls: data.hasThinkingToolCalls,
		hasWidgetOutput,
		isPostToolsGeneration,
		isPostToolsResultPending,
		allToolsSettled: areAllThinkingToolCallsSettled(data.visibleThinkingToolCalls),
		isResponseInFlight,
		hasTurnComplete,
		treatSettledToolsAsPostResultPending,
	});
	const hasThinkingDetails =
		shouldShowThinkingSection ||
		data.hasTodoProgressItems ||
		data.hasLegacyTodoQueueItems ||
		data.hasAgentExecutions ||
		data.visibleThinkingToolCalls.length > 0 ||
		shouldShowResponseGenerationStep ||
		hasPlanNarrationText;
	const [thinkingUserOverrideState, setThinkingUserOverrideState] = useState<{
		messageId: string;
		value: boolean | null;
	}>(() => ({ messageId: message.id, value: null }));
	let resolvedThinkingUserOverrideState = thinkingUserOverrideState;
	if (thinkingUserOverrideState.messageId !== message.id) {
		resolvedThinkingUserOverrideState = { messageId: message.id, value: null };
		setThinkingUserOverrideState(resolvedThinkingUserOverrideState);
	}
	const thinkingUserOverride = resolvedThinkingUserOverrideState.value;
	const setThinkingUserOverride = (value: boolean | null) => {
		setThinkingUserOverrideState((currentState) => ({
			...currentState,
			value,
		}));
	};
	const thinkingTimestamps = getMessageReasoningTimestamps(message);
	const { phase: lifecyclePhase, duration: reasoningDuration } = useReasoningPhase({
		isStreaming: isThinkingStreaming,
		hasMessageText: data.hasBackendThinkingActivity,
		responseKey: message.id,
		autoIdle: false,
		persistedStartTime: thinkingTimestamps.startedAt,
		persistedEndTime: thinkingTimestamps.completedAt,
	});
	const reasoningPhase = resolveAssistantThinkingTracePhase({
		isThinkingActive: thinkingActive,
		hasTurnComplete,
		isThinkingLifecycleStreaming,
		hasBackendThinkingActivity: data.hasBackendThinkingActivity,
		hasAwaitingInputToolCalls: data.hasAwaitingInputToolCalls,
		isPostToolsGeneration,
		isPostToolsResultPending,
		hasWidgetOutput,
		lifecyclePhase,
	});
	const previousReasoningPhaseRef = useRef(reasoningPhase);
	const shouldCollapseOnPhaseChange = shouldCollapseAssistantThinkingTraceOnPhaseChange({
		previousReasoningPhase: previousReasoningPhaseRef.current,
		reasoningPhase,
	});
	const isOpen = resolveAssistantThinkingTraceOpen({
		allowAutoOpen: !data.hasAwaitingInputToolCalls && !data.hasAnsweredQuestionToolCalls,
		hasThinkingToolCalls: data.hasThinkingToolCalls,
		reasoningPhase,
		userOpenOverride: shouldCollapseOnPhaseChange ? false : thinkingUserOverride,
	});

	useEffect(() => {
		previousReasoningPhaseRef.current = reasoningPhase;
		if (shouldCollapseOnPhaseChange && thinkingUserOverride !== false) {
			setThinkingUserOverride(false);
		}
	}, [reasoningPhase, shouldCollapseOnPhaseChange, thinkingUserOverride]);

	const thinkingUpdateSignal = [
		message.id,
		`status-count:${data.thinkingStatusParts.length}`,
		`status-id:${data.lastThinkingStatusPart?.id ?? ""}`,
		`status-label:${data.lastThinkingStatusPart?.data.label ?? ""}`,
		`event-count:${data.thinkingEventParts.length}`,
		`event-id:${data.lastThinkingEventPart?.data.eventId ?? ""}`,
	].join("|");
	const { label: dynamicThinkingLabel } = useDynamicThinkingLabel({
		baseLabel: data.lastThinkingStatusPart?.data.label ?? getDefaultThinkingLabel(),
		isStreaming: isThinkingStreaming,
		updateSignal: thinkingUpdateSignal,
		fallbackLabel: getDefaultThinkingLabel(),
	});
	const triggerLabel = data.hasAnsweredQuestionToolCalls
		? getQuestionsAnsweredLabel()
		: data.hasAwaitingInputToolCalls
		? getAwaitingUserResponseLabel()
		: resolveThinkingStatusTriggerLabel({
				resolvedLabel: dynamicThinkingLabel,
				reasoningPhase,
				duration: reasoningDuration,
			});
	return {
		accumulatedThinkingContent,
		data,
		hasPlanNarrationText,
		hasThinkingDetails,
		isOpen,
		isThinkingStreaming,
		message,
		onOpenChange: setThinkingUserOverride,
		planNarrationStreaming,
		planNarrationText,
		reasoningDuration,
		reasoningPhase,
		shouldShowResponseGenerationStep,
		shouldShowThinkingSection,
		thinkingActive,
		triggerLabel,
	};
}

/**
 * One narration row rendered as its own self-contained accordion: the row text
 * is the trigger (with a hover-revealed chevron matching ChainOfThoughtStep) and
 * the row's own Parameters/Result collapse underneath it. Collapsed by default.
 */
function ToolDetailRowAccordion({
	row,
}: Readonly<{ row: ThinkingNarrationDetailRow }>): ReactNode {
	const [open, setOpen] = useState(false);
	const hasDetail = row.input !== undefined || row.output !== undefined;

	const trigger = (
		<span
			className={cn(
				"group/tool-row flex items-start gap-1.5 text-text-subtlest transition-colors",
				hasDetail ? "group-hover/tool-row:text-text" : null,
			)}
		>
			<span className="min-w-0 truncate">{row.content}</span>
			{hasDetail ? (
				<Icon
					render={<ChevronDownIcon label="" size="small" spacing="none" />}
					className={cn(
						"mt-0.5 size-4 shrink-0 transition-[transform,opacity] duration-medium ease-out opacity-0 group-hover/tool-row:opacity-100 group-focus-visible/tool-row:opacity-100",
						open ? "rotate-0" : "-rotate-90",
					)}
				/>
			) : null}
		</span>
	);

	// Rows without their own detail are plain progression text — no accordion.
	if (!hasDetail) {
		return <div className="group/tool-row">{trigger}</div>;
	}

	return (
		<Collapsible onOpenChange={setOpen} open={open}>
			<button
				type="button"
				className="group/tool-row w-full text-left"
				onClick={() => setOpen((prev) => !prev)}
			>
				{trigger}
			</button>
			<CollapsibleContent className="space-y-2 overflow-hidden pt-2 h-(--collapsible-panel-height) transition-[height,opacity] ease-out duration-medium data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0">
				{row.input !== undefined ? <ToolInput codeBlockSize="sm" input={row.input} /> : null}
				{row.output !== undefined ? <ToolOutput codeBlockSize="sm" errorText={undefined} output={row.output} /> : null}
			</CollapsibleContent>
		</Collapsible>
	);
}

/**
 * Renders a tool call's narration. When per-row detail is available
 * (`detailRows`), each row becomes its own independent accordion with its own
 * Parameters/Result, all collapsed by default. Otherwise it falls back to
 * rendering the tool call's shared detail (`children`) inline.
 */
function ToolNarrationDisclosure({
	detailRows,
	children,
}: Readonly<{
	detailRows: readonly ThinkingNarrationDetailRow[] | undefined;
	children: ReactNode;
}>): ReactNode {
	const rows = (detailRows ?? []).filter((row) => row.content.trim().length > 0);

	if (rows.length === 0) {
		return children;
	}

	return (
		<div className="flex flex-col gap-1">
			{rows.map((row, index) => (
				<ToolDetailRowAccordion key={`${index}-${row.content}`} row={row} />
			))}
		</div>
	);
}

function ThinkingToolCallStep({
	messageId,
	narration,
	detailRows,
	open,
	toolCall,
	index,
	onOpenChange,
	toolTracePresentationResolver,
}: Readonly<{
	messageId: string;
	narration: string[] | undefined;
	detailRows: readonly ThinkingNarrationDetailRow[] | undefined;
	open: boolean;
	toolCall: ThinkingToolCallSummary;
	index: number;
	onOpenChange: (open: boolean) => void;
	toolTracePresentationResolver: AssistantThinkingToolTracePresentationResolver;
}>): ReactNode {
	const status = toolStateToCoTStatus(toolCall.state);
	const tracePresentation = toolTracePresentationResolver({
		detailRows,
		narration,
		status,
		toolCall,
	});
	const resolvedToolIcon = resolveToolIcon({
		toolName: toolCall.toolName,
		title: toolCall.toolName,
		input: toolCall.input,
		mcpServer: toolCall.mcpServer,
	});

	return (
		<ChainOfThoughtStep
			key={`${messageId}-cot-tool-${toolCall.id}-${index}`}
			collapsible
			defaultOpen={tracePresentation?.forceOpen || isToolCallStepOpenByDefault(toolCall.state)}
			open={tracePresentation?.forceOpen ? true : open}
			onOpenChange={onOpenChange}
			iconContainerStyle={tracePresentation?.iconContainerStyle}
			iconRender={renderResolvedToolIcon(resolvedToolIcon, {
				className: "size-4",
			})}
			label={getThinkingToolTitle(toolCall)}
			description={
				tracePresentation?.headerRender || toolCall.state === "completed"
					? null
					: getThinkingToolByline(toolCall, narration)
			}
			headerRender={tracePresentation?.headerRender}
			status={status}
		>
			{tracePresentation?.detailRender ? (
				tracePresentation.detailRender()
			) : (
				<ToolNarrationDisclosure detailRows={detailRows}>
					{toolCall.input !== undefined ? <ToolInput codeBlockSize="sm" input={toolCall.input} /> : null}
					<ToolOutput
						codeBlockSize="sm"
						errorText={toolCall.errorText}
						output={toolCall.output}
						outputPreview={toolCall.outputPreview}
						outputBytes={toolCall.outputBytes}
						outputTruncated={toolCall.outputTruncated}
						suppressedRawOutput={toolCall.suppressedRawOutput}
					/>
				</ToolNarrationDisclosure>
			)}
		</ChainOfThoughtStep>
	);
}

/**
 * Range (ms) for the randomized grace period a tool call keeps its metadata
 * expanded after a newer tool call appears. The jitter makes the cascade feel
 * organic instead of a rigid, uniform collapse: the next invocation fades in
 * while the previous metadata is still collapsing, and each handoff takes a
 * slightly different amount of time.
 */
const TOOL_CALL_COLLAPSE_GRACE_MS = { min: 180, max: 520 } as const;

function randomCollapseGraceMs(): number {
	const { min, max } = TOOL_CALL_COLLAPSE_GRACE_MS;
	return min + Math.random() * (max - min);
}

/**
 * Tracks which tool calls should be treated as "latest" (and therefore kept
 * expanded). The genuinely-latest call is always included. When a newer call
 * appears, the previously-latest call lingers in the open set for a randomized
 * grace period so its collapse visually overlaps the next call's entrance.
 */
function useOverlappingLatestToolCalls(orderedToolCallIds: readonly string[]): ReadonlySet<string> {
	const latestToolCallId =
		orderedToolCallIds.length > 0 ? orderedToolCallIds[orderedToolCallIds.length - 1] : undefined;
	const [lingeringToolCallDeadlines, setLingeringToolCallDeadlines] = useState<ReadonlyMap<string, number>>(
		() => new Map(),
	);
	const previousLatestRef = useRef<string | undefined>(latestToolCallId);

	useEffect(() => {
		const previousLatest = previousLatestRef.current;
		previousLatestRef.current = latestToolCallId;

		if (previousLatest === undefined || previousLatest === latestToolCallId) {
			return;
		}

		// A newer tool call took over: let the previous one linger briefly so its
		// metadata collapse overlaps the new call's entrance.
		setLingeringToolCallDeadlines((current) => {
			const next = new Map(current);
			next.set(previousLatest, Date.now() + randomCollapseGraceMs());
			return next;
		});
	}, [latestToolCallId]);

	// Drop lingering ids that are no longer present (e.g. message switch) and
	// drop their deadlines.
	const presentToolCallIdsKey = orderedToolCallIds.join("|");
	useEffect(() => {
		const present = new Set(orderedToolCallIds);
		setLingeringToolCallDeadlines((current) => {
			const next = new Map([...current].filter(([toolCallId]) => present.has(toolCallId)));
			return next.size === current.size ? current : next;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [presentToolCallIdsKey]);

	useEffect(() => {
		if (lingeringToolCallDeadlines.size === 0) {
			return;
		}

		const now = Date.now();
		let nextDeadline = Number.POSITIVE_INFINITY;
		const expiredToolCallIds = new Set<string>();
		for (const [toolCallId, deadline] of lingeringToolCallDeadlines) {
			if (deadline <= now) {
				expiredToolCallIds.add(toolCallId);
			} else {
				nextDeadline = Math.min(nextDeadline, deadline);
			}
		}

		if (expiredToolCallIds.size > 0) {
			setLingeringToolCallDeadlines((current) => {
				const next = new Map(current);
				for (const toolCallId of expiredToolCallIds) {
					next.delete(toolCallId);
				}
				return next.size === current.size ? current : next;
			});
			return;
		}

		const timeout = setTimeout(() => {
			const timeoutNow = Date.now();
			setLingeringToolCallDeadlines((current) => {
				const next = new Map(current);
				for (const [toolCallId, deadline] of current) {
					if (deadline <= timeoutNow) {
						next.delete(toolCallId);
					}
				}
				return next.size === current.size ? current : next;
			});
		}, Math.max(0, nextDeadline - now));
		return () => clearTimeout(timeout);
	}, [lingeringToolCallDeadlines]);

	return useMemo(() => {
		const open = new Set(lingeringToolCallDeadlines.keys());
		if (latestToolCallId !== undefined) {
			open.add(latestToolCallId);
		}
		return open;
	}, [lingeringToolCallDeadlines, latestToolCallId]);
}

export function AssistantThinkingTrace({
	state,
	className,
	toolTracePresentationResolver = defaultAssistantThinkingToolTracePresentationResolver,
}: Readonly<AssistantThinkingTraceProps>): ReactNode {
	const [manuallyOpenedToolCallState, setManuallyOpenedToolCallState] = useState<{
		messageId: string;
		openedIds: Set<string>;
	}>(() => ({ messageId: state.message.id, openedIds: new Set() }));
	const toolCallIds = useMemo(
		() => state.data.visibleThinkingToolCalls.map((toolCall) => toolCall.id),
		[state.data.visibleThinkingToolCalls],
	);
	const toolCallIdsKey = toolCallIds.join("|");
	const overlappingLatestToolCallIds = useOverlappingLatestToolCalls(toolCallIds);
	const currentToolCallIds = useMemo(() => new Set(toolCallIds), [toolCallIds]);
	let resolvedManuallyOpenedToolCallState = manuallyOpenedToolCallState;
	if (manuallyOpenedToolCallState.messageId !== state.message.id) {
		resolvedManuallyOpenedToolCallState = { messageId: state.message.id, openedIds: new Set() };
		setManuallyOpenedToolCallState(resolvedManuallyOpenedToolCallState);
	} else {
		const nextOpenedIds = new Set([...manuallyOpenedToolCallState.openedIds].filter((toolCallId) => currentToolCallIds.has(toolCallId)));
		if (nextOpenedIds.size !== manuallyOpenedToolCallState.openedIds.size) {
			resolvedManuallyOpenedToolCallState = { ...manuallyOpenedToolCallState, openedIds: nextOpenedIds };
			setManuallyOpenedToolCallState(resolvedManuallyOpenedToolCallState);
		}
	}
	const manuallyOpenedToolCallIds = resolvedManuallyOpenedToolCallState.openedIds;

	const handleToolCallOpenChange = useCallback((toolCallId: string, open: boolean) => {
		if (open) {
			setManuallyOpenedToolCallState((currentState) => {
				if (currentState.openedIds.has(toolCallId)) {
					return currentState;
				}
				const next = new Set(currentState.openedIds);
				next.add(toolCallId);
				return { ...currentState, openedIds: next };
			});
			return;
		}

		setManuallyOpenedToolCallState((currentState) => {
			if (!currentState.openedIds.has(toolCallId)) {
				return currentState;
			}
			const next = new Set(currentState.openedIds);
			next.delete(toolCallId);
			return { ...currentState, openedIds: next };
		});
	}, []);

	if (!state.thinkingActive) {
		return null;
	}

	return (
		<ChainOfThought
			className={cn("mb-0 [:not(:first-child)]:mt-2", className)}
			open={state.isOpen}
			onOpenChange={state.onOpenChange}
		>
			<ChainOfThoughtHeader
				state={state.reasoningPhase === "completed" ? "completed" : state.reasoningPhase === "thinking" ? "thinking" : "preload"}
				duration={state.reasoningPhase === "completed" ? state.reasoningDuration : undefined}
				showChevron={state.hasThinkingDetails}
			>
				{state.triggerLabel}
			</ChainOfThoughtHeader>
			{state.hasThinkingDetails ? (
				<ChainOfThoughtContent>
					{state.shouldShowThinkingSection ? (
						<ChainOfThoughtStep icon={StepThinkingIcon} label={getReasoningSectionTitle("thinking")} status={state.isThinkingStreaming ? "active" : "complete"}>
							<CodeBlock code={state.accumulatedThinkingContent} language="markdown" size="sm" />
						</ChainOfThoughtStep>
					) : null}
					{state.data.hasTodoProgressItems ? (
						<ChainOfThoughtStep icon={StepChecklistIcon} label={getReasoningSectionTitle("steps")} status={state.isThinkingStreaming ? "active" : "complete"}>
							<TraceTodoProgressSection items={state.data.todoProgressItems} />
						</ChainOfThoughtStep>
					) : null}
					{state.data.hasLegacyTodoQueueItems ? (
						<ChainOfThoughtStep icon={StepChecklistIcon} label={getReasoningSectionTitle("steps")} status={state.isThinkingStreaming ? "active" : "complete"}>
							<TraceStepsSection items={state.data.todoQueueItems} />
						</ChainOfThoughtStep>
					) : null}
					{state.data.hasAgentExecutions ? (
						<ChainOfThoughtStep icon={StepAgentsIcon} label={getReasoningSectionTitle("agents")} status={state.isThinkingStreaming ? "active" : "complete"}>
							<TraceAgentExecutionSection executions={state.data.agentExecutions} />
						</ChainOfThoughtStep>
					) : null}
					{state.data.visibleThinkingToolCalls.map((toolCall, index) => {
						const narration = toolCall.toolCallId ? state.data.thinkingNarrationMap.byToolCallId.get(toolCall.toolCallId) : undefined;
						const detailRows = toolCall.toolCallId ? state.data.thinkingNarrationDetailMap.byToolCallId.get(toolCall.toolCallId) : undefined;
						const isOpen = resolveThinkingToolCallStepOpen({
							toolCallId: toolCall.id,
							manuallyOpenedToolCallIds,
							isLatestToolCall: overlappingLatestToolCallIds.has(toolCall.id),
						});
						return (
							<ThinkingToolCallStep
								key={`${state.message.id}-cot-tool-${toolCall.id}-${index}`}
								messageId={state.message.id}
								narration={narration}
								detailRows={detailRows}
								open={isOpen}
								toolCall={toolCall}
								index={index}
								onOpenChange={(open) => handleToolCallOpenChange(toolCall.id, open)}
								toolTracePresentationResolver={toolTracePresentationResolver}
							/>
						);
					})}
					{state.shouldShowResponseGenerationStep ? (
						<ChainOfThoughtStep
							iconRender={<Spinner variant="rainbow" label="Generating a response" />}
							iconShimmer={false}
							label={
								<span className="inline-flex min-w-0 items-baseline">
									<Shimmer as="span" duration={1.4} spread={2} className="min-w-0 truncate text-left">
										Generating a response
									</Shimmer>
									<AnimatedDot />
								</span>
							}
							description={null}
							status="active"
						/>
					) : null}
					{state.hasPlanNarrationText ? (
						<ChainOfThoughtStep icon={StepStreamIcon} label={getReasoningSectionTitle("stream")} status={state.planNarrationStreaming ? "active" : "complete"}>
							<div className="whitespace-pre-wrap text-xs text-text-subtle leading-5">{state.planNarrationText}</div>
						</ChainOfThoughtStep>
					) : null}
				</ChainOfThoughtContent>
			) : null}
		</ChainOfThought>
	);
}
