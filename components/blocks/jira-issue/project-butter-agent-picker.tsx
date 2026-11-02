"use client";

import { useEffect, useRef } from "react";
import { AgentSelector, type AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { PopoverContent } from "@/components/ui/popover";
import {
	useProjectButterInvocationActions,
	useProjectButterInvocationAgents,
} from "./project-butter-invocation";

export function ProjectButterAgentPicker({
	onAssign,
	onBrowseAgents,
	onCreateAgent,
}: Readonly<{
	onAssign: (agent: AgentSelectorAgent) => void;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
}>) {
	const agents = useProjectButterInvocationAgents();
	const actions = useProjectButterInvocationActions();
	const pointer = useRef<{ x: number; y: number } | null>(null);
	const popup = useRef<HTMLDivElement | null>(null);
	const frame = useRef<number | null>(null);
	const syncHighlight = useRef(false);
	useEffect(
		() => () => {
			if (frame.current !== null) cancelAnimationFrame(frame.current);
		},
		[],
	);
	if (!actions) return null;

	const schedulePreview = (root: HTMLElement, fromScroll = false) => {
		syncHighlight.current ||= fromScroll;
		if (frame.current !== null) return;
		frame.current = requestAnimationFrame(() => {
			frame.current = null;
			if (!root.isConnected) return;
			const position = pointer.current;
			const option = position
				? document.elementFromPoint(position.x, position.y)?.closest<HTMLElement>('[data-slot="command-item"][data-value]')
				: root.querySelector<HTMLElement>('[data-slot="command-item"][aria-selected="true"]');
			const shouldSyncHighlight = syncHighlight.current;
			syncHighlight.current = false;
			if (!option || !root.contains(option)) {
				if (!position) actions.preview(null, -1);
				return;
			}
			const index = agents.findIndex((agent) => agent.id === option.dataset.value);
			if (index < 0) return;
			if (shouldSyncHighlight && position && option.getAttribute("aria-selected") !== "true") {
				option.dispatchEvent(new PointerEvent("pointermove", {
					bubbles: true,
					clientX: position.x,
					clientY: position.y,
				}));
			}
			actions.preview(agents[index], index);
		});
	};

	return (
		<PopoverContent
			ref={popup}
			aria-label="Agents"
			side="right"
			align="start"
			alignOffset={-6}
			sideOffset={8}
			className="w-80 max-h-[min(26rem,var(--available-height,26rem))] overflow-hidden p-0"
			onPointerMove={(event) => {
				pointer.current = { x: event.clientX, y: event.clientY };
				schedulePreview(event.currentTarget);
			}}
			onScrollCapture={(event) => {
				if (pointer.current && event.target instanceof HTMLElement && event.target.dataset.slot === "command-list") {
					schedulePreview(event.currentTarget, true);
				}
			}}
			onKeyDownCapture={(event) => {
				pointer.current = null;
				if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) schedulePreview(event.currentTarget);
			}}
			onPointerLeave={() => {
				pointer.current = null;
				if (frame.current !== null) cancelAnimationFrame(frame.current);
				frame.current = null;
				syncHighlight.current = false;
				actions.preview(null, -1);
			}}
			onClick={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
		>
			<AgentSelector
				agents={agents}
				className="min-w-0 w-full"
				onAgentToggle={(agentId) => {
					const agent = agents.find((candidate) => candidate.id === agentId);
					if (agent) onAssign(agent);
				}}
				onBrowseAgents={onBrowseAgents ? () => { actions.close(); onBrowseAgents(); } : undefined}
				onCreateAgent={onCreateAgent ? () => { actions.close(); onCreateAgent(); } : undefined}
				onQueryChange={() => {
					pointer.current = null;
					if (popup.current) schedulePreview(popup.current);
				}}
				pinningEnabled={false}
				searchVariant="palette"
				selectionMode="single"
			/>
		</PopoverContent>
	);
}
