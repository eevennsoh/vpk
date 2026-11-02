"use client";

import { useEffect, useRef, useState } from "react";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import ScreenIcon from "@atlaskit/icon/core/screen";
import { AgentSelector, type AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ProjectButterLocalAgentMenu } from "./project-butter-local-agent-menu";
import {
	useProjectButterInvocationActions,
	useProjectButterInvocationAgents,
} from "./project-butter-invocation";

const RUN_ON_LABELS: Readonly<Record<string, string>> = {
	"test-agent": "Open in Cursor app",
	"review-agent": "Open in Codex app",
};
const LOCAL_AGENT_IDS = new Set(["release-agent", "github-copilot", "rovo-cli"]);
const RUN_ON_AGENT_IDS = ["claude-code", ...Object.keys(RUN_ON_LABELS), ...LOCAL_AGENT_IDS];
const hasWorkspaceOptions = (agentId: string) => agentId === "claude-code" || LOCAL_AGENT_IDS.has(agentId);

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
	const pickerAgents = agents.filter((agent) => agent.id !== "github-copilot" || !agents.some((candidate) => candidate.id === "release-agent"));
	const pointer = useRef<{ x: number; y: number } | null>(null);
	const popup = useRef<HTMLDivElement | null>(null);
	const frame = useRef<number | null>(null);
	const syncHighlight = useRef(false);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cloudButton = useRef<HTMLButtonElement | null>(null);
	const submenuContent = useRef<HTMLDivElement | null>(null);
	const [submenu, setSubmenu] = useState<{ agent: AgentSelectorAgent; anchor: HTMLElement } | null>(null);
	const cancelClose = () => {
		if (closeTimer.current !== null) clearTimeout(closeTimer.current);
		closeTimer.current = null;
	};
	const closeSubmenuLater = () => {
		cancelClose();
		closeTimer.current = setTimeout(() => {
			if (document.activeElement?.closest("[data-butter-local-menu], [aria-label='Codebase workspaces']")) return;
			setSubmenu(null);
			actions?.preview(null, -1);
		}, 180);
	};
	const openSubmenu = (agent: AgentSelectorAgent, anchor: HTMLElement, focus = false) => {
		cancelClose();
		setSubmenu((current) => current?.agent.id === agent.id && current.anchor === anchor ? current : { agent, anchor });
		if (focus) requestAnimationFrame(() => (LOCAL_AGENT_IDS.has(agent.id) ? submenuContent.current?.querySelector<HTMLButtonElement>("button") : cloudButton.current)?.focus());
	};
	useEffect(
		() => () => {
			if (frame.current !== null) cancelAnimationFrame(frame.current);
			if (closeTimer.current !== null) clearTimeout(closeTimer.current);
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
		<>
		<PopoverContent
			ref={popup}
			aria-label="Agents"
			side="right"
			align="start"
			alignOffset={-6}
			sideOffset={8}
			className="w-80 max-h-[min(26rem,var(--available-height,26rem))] overflow-hidden p-0"
			onPointerMove={(event) => {
				if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
				pointer.current = { x: event.clientX, y: event.clientY };
				const option = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-slot="command-item"][data-value]') : null;
				if (option && event.currentTarget.contains(option)) {
					const agent = agents.find((candidate) => candidate.id === option.dataset.value);
					if (agent && RUN_ON_AGENT_IDS.includes(agent.id)) openSubmenu(agent, option);
					else { cancelClose(); setSubmenu(null); }
				}
				schedulePreview(event.currentTarget);
			}}
			onScrollCapture={(event) => {
				if (pointer.current && event.target instanceof HTMLElement && event.target.dataset.slot === "command-list") {
					schedulePreview(event.currentTarget, true);
				}
			}}
			onKeyDownCapture={(event) => {
				if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
				pointer.current = null;
				if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
					setSubmenu(null);
					schedulePreview(event.currentTarget);
				}
				if (event.key === "ArrowRight") {
					const option = event.currentTarget.querySelector<HTMLElement>('[data-slot="command-item"][aria-selected="true"]');
					const agent = agents.find((candidate) => candidate.id === option?.dataset.value);
					if (option && agent && RUN_ON_AGENT_IDS.includes(agent.id)) {
						event.preventDefault();
						openSubmenu(agent, option, true);
					}
				}
			}}
			onPointerLeave={() => {
				pointer.current = null;
				if (frame.current !== null) cancelAnimationFrame(frame.current);
				frame.current = null;
				syncHighlight.current = false;
				closeSubmenuLater();
			}}
			onClick={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
		>
			<AgentSelector
				agents={pickerAgents}
				avatarSize={20}
				className="min-w-0 w-full"
				onAgentToggle={(agentId) => {
					const agent = agents.find((candidate) => candidate.id === agentId);
					if (!agent) return;
					if (RUN_ON_AGENT_IDS.includes(agent.id)) {
						const option = popup.current?.querySelector<HTMLElement>(`[data-slot="command-item"][data-value="${agent.id}"]`);
						if (option) openSubmenu(agent, option, true);
					} else onAssign(agent);
				}}
				onBrowseAgents={onBrowseAgents ? () => { actions.close(); onBrowseAgents(); } : undefined}
				onCreateAgent={onCreateAgent ? () => { actions.close(); onCreateAgent(); } : undefined}
				onQueryChange={() => {
					cancelClose();
					setSubmenu(null);
					pointer.current = null;
					if (popup.current) schedulePreview(popup.current);
				}}
				pinningEnabled={false}
				searchVariant="palette"
				sections={{ heading: "Software agents", agentIds: ["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent", "github-copilot", "rovo-cli"], initialLimit: 3, otherHeading: "Other agents" }}
				showByline={false}
				submenuAgentIds={RUN_ON_AGENT_IDS}
				selectionMode="single"
			/>
		<Popover open={submenu !== null} onOpenChange={(open) => { if (!open) setSubmenu((current) => current?.agent.id === submenu?.agent.id ? null : current); }}>
			{submenu ? (
				<PopoverContent
					ref={submenuContent}
					anchor={submenu.anchor}
					aria-label={LOCAL_AGENT_IDS.has(submenu.agent.id) ? `${submenu.agent.name} local options` : `Run ${submenu.agent.name} on`}
					role={hasWorkspaceOptions(submenu.agent.id) ? "dialog" : "menu"}
					initialFocus={false}
					finalFocus={false}
					side="right"
					align="start"
					sideOffset={0}
					className="w-60 gap-0 p-1"
					onPointerEnter={cancelClose}
					onPointerLeave={closeSubmenuLater}
					onClick={(event) => event.stopPropagation()}
					onPointerDown={(event) => event.stopPropagation()}
					onKeyDown={(event) => {
						if (LOCAL_AGENT_IDS.has(submenu.agent.id)) return;
						if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target) || event.target instanceof HTMLInputElement) return;
						if (!hasWorkspaceOptions(submenu.agent.id) && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
							event.preventDefault();
							const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
							const current = items.indexOf(document.activeElement instanceof HTMLButtonElement ? document.activeElement : items[0]);
							items[(current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
						}
						if (event.key === "ArrowLeft" || event.key === "Escape") {
							event.preventDefault();
							event.stopPropagation();
							setSubmenu(null);
							popup.current?.querySelector<HTMLInputElement>('input[aria-label="Search agents"]')?.focus();
						}
					}}
				>
					{!LOCAL_AGENT_IDS.has(submenu.agent.id) ? <>
					<Button ref={cloudButton} role={hasWorkspaceOptions(submenu.agent.id) ? undefined : "menuitem"} className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal" variant="ghost" onClick={() => onAssign(submenu.agent)}>
						<Icon aria-hidden className="size-4 shrink-0" render={<CloudIcon label="" size="small" />} />Run on cloud
					</Button>
					</> : null}
					{hasWorkspaceOptions(submenu.agent.id) ? <ProjectButterLocalAgentMenu key={submenu.agent.id} onPointerEnter={cancelClose} onPointerLeave={closeSubmenuLater} /> : <>
					<Button role="menuitem" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal" variant="ghost">
						<Icon aria-hidden className="size-4 shrink-0" render={<ScreenIcon label="" size="small" />} />{RUN_ON_LABELS[submenu.agent.id]}
					</Button>
					</>}
				</PopoverContent>
			) : null}
		</Popover>
		</PopoverContent>
		</>
	);
}
