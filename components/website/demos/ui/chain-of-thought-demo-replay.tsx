"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import {
	ChainOfThought,
	ChainOfThoughtContent,
	ChainOfThoughtHeader,
	ChainOfThoughtStep,
} from "@/components/ui/chain-of-thought";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { ToolInput, ToolOutput } from "@/components/ui/tool";
import { resolveThinkingLabelForSurface } from "@/components/projects/shared/lib/thinking-label-policy";
import { getThinkingToolByline, getThinkingToolTitle } from "@/components/projects/shared/lib/thinking-tool-display";
import { renderResolvedToolIcon, resolveToolIcon } from "@/components/projects/shared/lib/tool-icon-resolver";
import { getAwaitingUserResponseLabel, getQuestionsAnsweredLabel } from "@/lib/reasoning-labels";
import {
	buildThinkingNarrationDetailMap,
	buildThinkingNarrationMap,
	getThinkingToolCallSummaries,
	type RovoUIMessage,
	type ThinkingNarrationDetailRow,
	type ThinkingToolCallSummary,
} from "@/lib/rovo-ui-messages";
import { cn } from "@/lib/utils";

import { ChainOfThoughtDemoFrame } from "./chain-of-thought-demo-frame";
import { STUDIO_REPLAY_DESIGNING_AGENT_LABEL, type ReplayMode, type StudioReplayPhase } from "./chain-of-thought-demo-replay-steps";
import { useStudioReplayMessage } from "./chain-of-thought-demo-replay-timeline";

function getReplayStepStatus(state: ThinkingToolCallSummary["state"]): "complete" | "active" | "pending" {
	if (state === "running" || state === "awaiting-input" || state === "approval-requested") {
		return "active";
	}
	return "complete";
}

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

	if (!hasDetail) {
		return <div className="group/tool-row">{trigger}</div>;
	}

	return (
		<Collapsible onOpenChange={setOpen} open={open}>
			<button
				type="button"
				className="group/tool-row w-full text-left"
				onClick={() => setOpen((currentOpen) => !currentOpen)}
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

function ToolNarrationDisclosure({
	children,
	detailRows,
}: Readonly<{
	children: ReactNode;
	detailRows: readonly ThinkingNarrationDetailRow[] | undefined;
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

function StudioReplayToolCallStep({
	detailRows,
	narration,
	onOpenChange,
	open,
	toolCall,
}: Readonly<{
	detailRows: readonly ThinkingNarrationDetailRow[] | undefined;
	narration: string[] | undefined;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	toolCall: ThinkingToolCallSummary;
}>): ReactNode {
	const status = getReplayStepStatus(toolCall.state);
	const resolvedToolIcon = resolveToolIcon({
		toolName: toolCall.toolName,
		title: toolCall.toolName,
		input: toolCall.input,
		mcpServer: toolCall.mcpServer,
	});

	return (
		<ChainOfThoughtStep
			collapsible
			defaultOpen={false}
			description={toolCall.state === "completed" ? null : getThinkingToolByline(toolCall, narration)}
			iconRender={renderResolvedToolIcon(resolvedToolIcon, { className: "size-4" })}
			label={getThinkingToolTitle(toolCall)}
			onOpenChange={onOpenChange}
			open={open}
			status={status}
		>
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
		</ChainOfThoughtStep>
	);
}

function getLatestThinkingStatusLabel(message: RovoUIMessage): string {
	for (let index = message.parts.length - 1; index >= 0; index -= 1) {
		const part = message.parts[index];
		if (part.type !== "data-thinking-status") {
			continue;
		}
		const label = part.data.label;
		if (typeof label === "string" && label.trim()) {
			return label.trim();
		}
	}
	return STUDIO_REPLAY_DESIGNING_AGENT_LABEL;
}

function getLatestThinkingEvent(message: RovoUIMessage): { phase?: string; toolName?: string } | null {
	for (let index = message.parts.length - 1; index >= 0; index -= 1) {
		const part = message.parts[index];
		if (part.type === "data-thinking-event") {
			return part.data;
		}
	}
	return null;
}

function getReplayHeaderLabel({
	hasAwaitingInput,
	message,
	phase,
}: Readonly<{
	hasAwaitingInput: boolean;
	message: RovoUIMessage;
	phase: StudioReplayPhase;
}>): ReactNode {
	if (hasAwaitingInput || phase === "awaiting") {
		return getAwaitingUserResponseLabel();
	}

	const latestEvent = getLatestThinkingEvent(message);
	if (
		phase === "playing" &&
		latestEvent?.phase === "result" &&
		latestEvent.toolName === "ask_user_questions"
	) {
		return getQuestionsAnsweredLabel();
	}

	if (phase === "completed") {
		return undefined;
	}

	return resolveThinkingLabelForSurface({
		baseLabel: getLatestThinkingStatusLabel(message),
		reasoningPhase: "thinking",
		surface: "fullscreen",
	});
}

function StudioReplayGeneratingResponseStep(): ReactNode {
	return (
		<ChainOfThoughtStep
			description={null}
			iconRender={<Spinner size="xs" label="Generating a response" />}
			label="Generating a response"
			status="active"
		/>
	);
}

function StudioChainOfThoughtReplay({ mode }: Readonly<{ mode: ReplayMode }>): ReactNode {
	const { duration, message, phase } = useStudioReplayMessage(mode);
	const [isOpen, setIsOpen] = useState(true);
	const [openedToolCallIds, setOpenedToolCallIds] = useState<ReadonlySet<string>>(() => new Set());
	const thinkingToolCalls = useMemo(
		() => getThinkingToolCallSummaries(message),
		[message],
	);
	const thinkingNarrationMap = useMemo(
		() => buildThinkingNarrationMap(message),
		[message],
	);
	const thinkingNarrationDetailMap = useMemo(
		() => buildThinkingNarrationDetailMap(message),
		[message],
	);
	const hasAwaitingInput = thinkingToolCalls.some((toolCall) => toolCall.state === "awaiting-input");
	const hasThinkingDetails = thinkingToolCalls.length > 0 || phase === "generating";
	const shouldAutoCollapse = phase === "completed" || phase === "awaiting" || hasAwaitingInput;
	const headerLabel = getReplayHeaderLabel({
		hasAwaitingInput,
		message,
		phase,
	});

	// Collapse once when the run completes or waits for input; the person can reopen it.
	const [wasAutoCollapsed, setWasAutoCollapsed] = useState(shouldAutoCollapse);
	if (wasAutoCollapsed !== shouldAutoCollapse) {
		setWasAutoCollapsed(shouldAutoCollapse);
		if (shouldAutoCollapse) {
			setIsOpen(false);
		}
	}

	const handleToolOpenChange = useCallback((toolCallId: string, nextOpen: boolean) => {
		setOpenedToolCallIds((currentIds) => {
			const nextIds = new Set(currentIds);
			if (nextOpen) {
				nextIds.add(toolCallId);
			} else {
				nextIds.delete(toolCallId);
			}
			return nextIds;
		});
	}, []);

	return (
		<ChainOfThought
			className="w-full"
			onOpenChange={setIsOpen}
			open={isOpen}
		>
			<ChainOfThoughtHeader
				duration={duration}
				showChevron={hasThinkingDetails}
				state={phase === "completed" ? "completed" : "thinking"}
			>
				{headerLabel}
			</ChainOfThoughtHeader>
			{hasThinkingDetails ? (
				<ChainOfThoughtContent>
					{thinkingToolCalls.map((toolCall, index) => {
						const narration = toolCall.toolCallId
							? thinkingNarrationMap.byToolCallId.get(toolCall.toolCallId)
							: undefined;
						const detailRows = toolCall.toolCallId
							? thinkingNarrationDetailMap.byToolCallId.get(toolCall.toolCallId)
							: undefined;

						return (
							<StudioReplayToolCallStep
								key={`${toolCall.id}-${index}`}
								detailRows={detailRows}
								narration={narration}
								onOpenChange={(nextOpen) => handleToolOpenChange(toolCall.id, nextOpen)}
								open={openedToolCallIds.has(toolCall.id)}
								toolCall={toolCall}
							/>
						);
					})}
					{phase === "generating" ? <StudioReplayGeneratingResponseStep /> : null}
				</ChainOfThoughtContent>
			) : null}
		</ChainOfThought>
	);
}

function ChainOfThoughtReplayDemo({
	mode,
	resetLabel,
}: Readonly<{
	mode: ReplayMode;
	resetLabel: string;
}>) {
	const [replayKey, setReplayKey] = useState(0);
	const handleReset = useCallback(() => {
		setReplayKey((currentKey) => currentKey + 1);
	}, []);

	return (
		<ChainOfThoughtDemoFrame>
			<div className="flex w-full max-w-2xl flex-col gap-4" data-chain-of-thought-replay-demo="true">
				<div className="flex justify-end">
					<button
						aria-label={resetLabel}
						className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-bg-neutral-subtle px-3 font-medium text-sm text-text-subtle transition-colors hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
						onClick={handleReset}
						type="button"
					>
						<Icon render={<RefreshIcon label="" size="small" />} label="Reset" />
						Reset
					</button>
				</div>
				<StudioChainOfThoughtReplay key={replayKey} mode={mode} />
			</div>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoNormalToolCallingReplay() {
	return (
		<ChainOfThoughtReplayDemo
			mode="normal"
			resetLabel="Reset normal tool calling animation"
		/>
	);
}

export function ChainOfThoughtDemoAwaitingUserResponseReplay() {
	return (
		<ChainOfThoughtReplayDemo
			mode="awaiting"
			resetLabel="Reset awaiting user response animation"
		/>
	);
}

