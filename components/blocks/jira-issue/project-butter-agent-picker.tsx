"use client";

import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import ScreenIcon from "@atlaskit/icon/core/screen";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import AddIcon from "@atlaskit/icon/core/add";
import { AgentSelector, type AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { matchingAgentSessions, sessionChoiceItems } from "@/components/blocks/agent-assignment/components/session-choice-items";
import { RichTextSuggestionMenu } from "@/components/ui-custom/rich-text-editor";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { ProjectButterLocalAgentMenu } from "./project-butter-local-agent-menu";
import {
	useProjectButterInvocationActions,
	useProjectButterInvocationAgents,
} from "./project-butter-invocation";

const RUN_ON_LABELS: Readonly<Record<string, string>> = {
	"claude-code": "Open in Claude",
	"test-agent": "Open in Cursor",
	"review-agent": "Open in Codex",
	"release-agent": "Open in VS Code",
	"github-copilot": "Open in VS Code",
};
const VS_CODE_AGENT_IDS = new Set(["release-agent", "github-copilot"]);
const RUN_ON_AGENT_IDS = [...Object.keys(RUN_ON_LABELS), "rovo-cli"];
const hasWorkspaceOptions = (agentId: string) => agentId === "rovo-cli";

export function ProjectButterAgentPicker({
	anchor,
	id,
	onAssign,
	onBrowseAgents,
	onCreateAgent,
	onContinueSession,
	sessions,
}: Readonly<{
	anchor?: ComponentProps<typeof PopoverContent>["anchor"];
	id?: string;
	onAssign: (agent: AgentSelectorAgent) => void;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	onContinueSession?: (session: AgentSessionItem) => void;
	sessions?: readonly AgentSessionItem[];
}>) {
	return (
		<PopoverContent id={id} anchor={anchor} aria-label="Agents" side="right" align="start" alignOffset={-6} sideOffset={8} className="w-80 max-h-[min(26rem,var(--available-height,26rem))] overflow-hidden p-0" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
			<ProjectButterAgentPickerContent onAssign={onAssign} onBrowseAgents={onBrowseAgents} onCreateAgent={onCreateAgent} onContinueSession={onContinueSession} sessions={sessions} />
		</PopoverContent>
	);
}

export function ProjectButterAgentPickerContent({ onAssign, onBrowseAgents, onContinueSession, onCreateAgent, onPreviewSession, sessions = [], selectedAgentIds, submenuPositionerClassName = "z-[600]", workspacePositionerClassName = "z-[650]" }: Readonly<{
	onAssign: (agent: AgentSelectorAgent) => void;
	onBrowseAgents?: () => void;
	onContinueSession?: (session: AgentSessionItem) => void;
	onCreateAgent?: () => void;
	onPreviewSession?: (sessionId: string | null) => void;
	sessions?: readonly AgentSessionItem[];
	selectedAgentIds?: readonly string[];
	submenuPositionerClassName?: string;
	workspacePositionerClassName?: string;
}>) {
	const agents = useProjectButterInvocationAgents();
	const actions = useProjectButterInvocationActions();
	const pickerAgents = agents.filter((agent) => agent.id !== "github-copilot" || !agents.some((candidate) => candidate.id === "release-agent"));
	const pointer = useRef<{ x: number; y: number } | null>(null);
	const popup = useRef<HTMLDivElement | null>(null);
	const frame = useRef<number | null>(null);
	const syncHighlight = useRef(false);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const selectingFolder = useRef(false);
	const cloudButton = useRef<HTMLButtonElement | null>(null);
	const submenuContent = useRef<HTMLDivElement | null>(null);
	const submenuId = useId();
	const [submenu, setSubmenu] = useState<{ agent: AgentSelectorAgent; anchor: HTMLElement } | null>(null);
	const [choosingSession, setChoosingSession] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
	const sessionsFor = (agent: AgentSelectorAgent) => onContinueSession ? matchingAgentSessions(agent, sessions) : [];
	const hasSubmenu = (agent: AgentSelectorAgent) => RUN_ON_AGENT_IDS.includes(agent.id) || sessionsFor(agent).length > 0;
	const matchingSessions = submenu ? sessionsFor(submenu.agent) : [];
	const sessionItems = sessionChoiceItems(matchingSessions).map(({ id, label, icon }) => ({ id, label, icon, leadingVisual: icon }));
	const selectedIndex = Math.min(selectedSessionIndex, Math.max(0, sessionItems.length - 1));
	useEffect(() => {
		if (!submenu) return;
		submenu.anchor.setAttribute("aria-controls", submenuId);
		return () => submenu.anchor.removeAttribute("aria-controls");
	}, [submenu, submenuId]);
	const cancelClose = () => {
		if (closeTimer.current !== null) clearTimeout(closeTimer.current);
		closeTimer.current = null;
	};
	const closeSubmenuLater = () => {
		cancelClose();
		closeTimer.current = setTimeout(() => {
			if (selectingFolder.current) return;
			if (choosingSession && submenuContent.current?.contains(document.activeElement)) return;
			if (document.activeElement?.closest("[data-butter-local-menu], [aria-label='Codebase workspaces']")) return;
			setSubmenu(null);
			setChoosingSession(false);
			onPreviewSession?.(null);
			actions?.preview(null, -1);
		}, 180);
	};
	const openSubmenu = (agent: AgentSelectorAgent, anchor: HTMLElement, focus = false) => {
		cancelClose();
		if (submenu?.agent.id !== agent.id || submenu.anchor !== anchor) { setChoosingSession(false); onPreviewSession?.(null); }
		setSubmenu((current) => current?.agent.id === agent.id && current.anchor === anchor ? current : { agent, anchor });
		if (focus) requestAnimationFrame(() => (agent.id === "rovo-cli" ? submenuContent.current?.querySelector<HTMLButtonElement>("button") : cloudButton.current)?.focus());
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

	const submenuActions = submenu ? (
		<>
					{choosingSession ? <RichTextSuggestionMenu className="rich-text-command-menu-embedded [&_.rich-text-command-menu-list]:p-0! [&_.rich-text-command-menu-item]:h-auto! [&_.rich-text-command-menu-item]:min-h-11 [&_.rich-text-command-menu-item]:py-2! [&_.menu-row-title]:line-clamp-2 [&_.menu-row-title]:whitespace-normal [&_.menu-row-byline]:whitespace-normal" emptyLabel="No active sessions" items={sessionItems} onHover={(index) => { setSelectedSessionIndex(index); if (sessionItems[index]) onPreviewSession?.(sessionItems[index].id); }} onHoverEnd={() => onPreviewSession?.(null)} onSelect={(item) => { const session = matchingSessions.find((candidate) => candidate.id === item.id); if (session) { onPreviewSession?.(null); onContinueSession?.(session); } }} selectedIndex={selectedIndex} showReturnShortcut={false} title={`Choose a ${submenu.agent.name} session`} /> : <>
					{matchingSessions.length > 0 ? <div role="group" aria-label="Run on cloud">
						<div className="px-2 pt-2 pb-1 text-xs font-medium text-text-subtle">Run on cloud</div>
						<Button ref={cloudButton} role="menuitem" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal" variant="ghost" onClick={() => { if (matchingSessions.length === 1) onContinueSession?.(matchingSessions[0]); else { cancelClose(); setChoosingSession(true); setSelectedSessionIndex(0); requestAnimationFrame(() => submenuContent.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus()); } }}><Icon aria-hidden className="size-4 shrink-0" render={<AiChatIcon label="" size="small" />} />{matchingSessions.length > 1 ? "Continue to existing session" : "Continue with last session"}</Button>
						{submenu.agent.id !== "rovo-cli" ? <Button role="menuitem" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal" variant="ghost" onClick={() => onAssign(submenu.agent)}><Icon aria-hidden className="size-4 shrink-0" render={<AddIcon label="" size="small" />} />Start a new session</Button> : null}
					</div> : submenu.agent.id !== "rovo-cli" ? <Button ref={cloudButton} role="menuitem" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal" variant="ghost" onClick={() => onAssign(submenu.agent)}><Icon aria-hidden className="size-4 shrink-0" render={<CloudIcon label="" size="small" />} />Run on cloud</Button> : null}
					{matchingSessions.length > 0 && RUN_ON_AGENT_IDS.includes(submenu.agent.id) ? <hr className="my-1 border-0 border-t border-border" /> : null}
					{hasWorkspaceOptions(submenu.agent.id) ? <ProjectButterLocalAgentMenu key={submenu.agent.id} onPointerEnter={cancelClose} onPointerLeave={closeSubmenuLater} onSelectingFolderChange={(selecting) => { selectingFolder.current = selecting; if (selecting) cancelClose(); }} workspacePositionerClassName={workspacePositionerClassName} /> : RUN_ON_AGENT_IDS.includes(submenu.agent.id) ? <>
					<Button
						role="menuitem"
						aria-disabled={VS_CODE_AGENT_IDS.has(submenu.agent.id) ? true : undefined}
						onClick={(event) => { if (VS_CODE_AGENT_IDS.has(submenu.agent.id)) event.preventDefault(); }}
						className={cn("w-full justify-start gap-3 px-2 text-sm font-normal aria-disabled:opacity-(--opacity-disabled) aria-disabled:hover:bg-transparent", VS_CODE_AGENT_IDS.has(submenu.agent.id) ? "h-11" : "h-8")}
						variant="ghost"
					>
						<Icon aria-hidden className="size-4 shrink-0" render={<ScreenIcon label="" size="small" />} />
						<span className="flex min-w-0 flex-col text-left">
							<span className="menu-row-title">{RUN_ON_LABELS[submenu.agent.id]}</span>
							{VS_CODE_AGENT_IDS.has(submenu.agent.id) ? <span className="menu-row-byline">Not installed</span> : null}
						</span>
					</Button>
					</> : null}
					</>}
		</>
	) : null;


	return (
		<>
		<div
			ref={popup}
			className="w-full"
			onPointerMove={(event) => {
				if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
				pointer.current = { x: event.clientX, y: event.clientY };
				const option = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-slot="command-item"][data-value]') : null;
				if (option && event.currentTarget.contains(option)) {
					const agent = agents.find((candidate) => candidate.id === option.dataset.value);
					if (agent && hasSubmenu(agent)) openSubmenu(agent, option);
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
					if (option && agent && hasSubmenu(agent)) {
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
		>
			<AgentSelector
				agents={pickerAgents}
				className="min-w-0 w-full"
				onAgentToggle={(agentId) => {
					const agent = agents.find((candidate) => candidate.id === agentId);
					if (!agent) return;
					if (hasSubmenu(agent)) {
						const option = popup.current?.querySelector<HTMLElement>(`[data-slot="command-item"][data-value="${agent.id}"]`);
						if (option) openSubmenu(agent, option, true);
					} else onAssign(agent);
				}}
				onBrowseAgents={onBrowseAgents ? () => { actions.close(); onBrowseAgents(); } : undefined}
				onCreateAgent={onCreateAgent ? () => { actions.close(); onCreateAgent(); } : undefined}
				onQueryChange={(value) => {
					setQuery(value);
					cancelClose();
					setSubmenu(null);
					pointer.current = null;
					if (popup.current) schedulePreview(popup.current);
				}}
				pinningEnabled={false}
				query={query}
				searchVariant="palette"
				sections={{ heading: "Software agents", agentIds: ["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent", "github-copilot", "rovo-cli"], initialLimit: 3, otherHeading: "Other agents" }}
				showByline={false}
				selectedAgentIds={selectedAgentIds}
				showSelectedTickInSingleSelect
				submenuAgentIds={pickerAgents.filter(hasSubmenu).map((agent) => agent.id)}
				selectionMode="single"
			/>
		<Popover open={submenu !== null} onOpenChange={(open) => { if (!open) { setChoosingSession(false); onPreviewSession?.(null); setSubmenu((current) => current?.agent.id === submenu?.agent.id ? null : current); } }}>
			{submenu ? (
				<PopoverContent
					id={submenuId}
					ref={submenuContent}
					anchor={submenu.anchor}
					aria-label={choosingSession ? `Choose a ${submenu.agent.name} session` : submenu.agent.id === "rovo-cli" ? `${submenu.agent.name} local options` : `Run ${submenu.agent.name} on`}
					role={choosingSession || hasWorkspaceOptions(submenu.agent.id) ? "dialog" : "menu"}
					initialFocus={false}
					finalFocus={false}
					side="right"
					align="start"
					sideOffset={0}
					className={cn("gap-0 p-1", choosingSession ? "w-96 max-w-[calc(100vw-24px)]" : "w-70")}
					positionerClassName={submenuPositionerClassName}
					onPointerEnter={cancelClose}
					onPointerLeave={closeSubmenuLater}
					onClick={(event) => event.stopPropagation()}
					onPointerDown={(event) => event.stopPropagation()}
					onFocusCapture={(event) => {
						if (!choosingSession || !(event.target instanceof HTMLElement)) return;
						const options = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')];
						const index = options.indexOf(event.target);
						if (index >= 0 && sessionItems[index]) { setSelectedSessionIndex(index); onPreviewSession?.(sessionItems[index].id); }
					}}
					onKeyDown={(event) => {
						if (submenu.agent.id === "rovo-cli" && !choosingSession) return;
						if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target) || event.target instanceof HTMLInputElement) return;
						if (choosingSession && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
							event.preventDefault();
							const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')];
							const current = options.indexOf(document.activeElement instanceof HTMLButtonElement ? document.activeElement : options[0]);
							options[(current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length]?.focus();
							return;
						}
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
							setChoosingSession(false);
							onPreviewSession?.(null);
							popup.current?.querySelector<HTMLInputElement>('input[aria-label="Search agents"]')?.focus();
						}
					}}
				>
					{submenuActions}
				</PopoverContent>
			) : null}
		</Popover>
		</div>
		</>
	);
}
