"use client";

import { use, useEffect, useId, useRef, useState, type RefObject } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ProjectButterAgentPicker, ProjectButterAgentPickerContent } from "./project-butter-agent-picker";
import { ProjectButterInlineAgentPicker } from "./project-butter-inline-agent-picker";
import {
	ButterInlineAgentPickerContext,
	useProjectButterInvocationActions,
	useProjectButterInvocationAgents,
	useProjectButterInvocationPhase,
	useProjectButterInvocationSource,
} from "./project-butter-invocation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { JiraIssueAgentAssignment } from "./index";

function useButterAgentAssignment(assignment: JiraIssueAgentAssignment | undefined, triggerRef: RefObject<HTMLElement | null>) {
	const actions = useProjectButterInvocationActions();
	const agents = useProjectButterInvocationAgents();
	return (agent: AgentSelectorAgent) => {
		if (assignment?.onCreateCloudSession) {
			actions?.commit(agent, agents.findIndex((candidate) => candidate.id === agent.id));
			assignment.onAgentAssign?.(agent);
			assignment.onCreateCloudSession(agent);
			return;
		}
		const id = agent.id;
		const card = triggerRef.current?.closest("article");
		const listSurface = triggerRef.current?.closest("[data-butter-agent-surface]");
		actions?.commit(agent, agents.findIndex((candidate) => candidate.id === id));
		assignment?.onAgentAssign?.(agent);
		const ids = assignment?.assignedAgents?.map((assigned) => assigned.id) ?? [];
		assignment?.onAssignedAgentIdsChange?.([...ids, id]);
		const focusSession = () => (listSurface ?? card)?.querySelector<HTMLElement>("[data-jira-issue-agent-row-handle]")?.focus({ preventScroll: true });
		if (listSurface) requestAnimationFrame(focusSession);
		else queueMicrotask(focusSession);
	};
}

export function ProjectButterMenuAgentSubmenu({ assignment, onRequestClose, triggerRef }: Readonly<{
	assignment: JiraIssueAgentAssignment;
	onRequestClose: () => void;
	triggerRef: RefObject<HTMLElement | null>;
}>) {
	const actions = useProjectButterInvocationActions();
	const assignAgent = useButterAgentAssignment(assignment, triggerRef);
	return (
		<DropdownMenuSub onOpenChange={(open) => open ? actions?.open("menu") : actions?.close()}>
			<DropdownMenuSubTrigger aria-haspopup="dialog">Add agent</DropdownMenuSubTrigger>
			<DropdownMenuSubContent aria-label="Agents" role="dialog" className="w-80 max-h-[min(26rem,var(--available-height,26rem))] overflow-hidden p-0" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
				<ProjectButterAgentPickerContent
					sessions={assignment.sessions}
					onContinueSession={assignment.onOpenSession ? (session) => { actions?.close(); onRequestClose(); assignment.onOpenSession?.(session); } : undefined}
					onAssign={(agent) => { assignAgent(agent); onRequestClose(); }}
					onBrowseAgents={assignment.onBrowseAgents ? () => { onRequestClose(); assignment.onBrowseAgents?.(); } : undefined}
					onCreateAgent={assignment.onCreateAgent ? () => { onRequestClose(); assignment.onCreateAgent?.(); } : undefined}
				/>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

export function ProjectButterMenuAgentPicker({ assignment, id, source: pickerSource = "menu", triggerRef }: Readonly<{
	assignment: JiraIssueAgentAssignment;
	id: string;
	source?: "menu" | "session";
	triggerRef: RefObject<HTMLElement | null>;
}>) {
	const phase = useProjectButterInvocationPhase();
	const source = useProjectButterInvocationSource();
	const actions = useProjectButterInvocationActions();
	const assignAgent = useButterAgentAssignment(assignment, triggerRef);
	return (
		<Popover open={phase === "choosing" && source === pickerSource} onOpenChange={(open) => open ? actions?.open(pickerSource) : actions?.close()}>
			<ProjectButterAgentPicker id={id} anchor={triggerRef} onAssign={assignAgent} onBrowseAgents={assignment.onBrowseAgents} onCreateAgent={assignment.onCreateAgent} sessions={assignment.sessions} onContinueSession={assignment.onOpenSession ? (session) => { actions?.close(); assignment.onOpenSession?.(session); } : undefined} />
		</Popover>
	);
}

export function ProjectButterAddAgent({
	alwaysVisible = false,
	issueKey,
	assignment,
}: Readonly<{
	alwaysVisible?: boolean;
	issueKey: string;
	assignment?: JiraIssueAgentAssignment;
}>) {
	const phase = useProjectButterInvocationPhase();
	const source = useProjectButterInvocationSource();
	const actions = useProjectButterInvocationActions();
	const inlinePicker = use(ButterInlineAgentPickerContext);
	const open = phase === "choosing" && source === "footer";
	const exiting = phase === "handoff";
	useEffect(() => () => actions?.close(), [actions]);
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const assignAgent = useButterAgentAssignment(assignment, triggerRef);
	const tooltipId = useId();
	const onAssign = assignment?.onAgentAssign;
	if (!assignment || (!onAssign && !assignment.onAssignedAgentIdsChange) || !actions) return null;

	return (
		<div
			data-slot="jira-issue-add-agent"
			data-open={open || undefined}
			className={cn(
				"group/butter-add-agent pointer-events-none size-6 shrink-0 opacity-0 transition-opacity duration-fast ease-out-practical motion-reduce:transition-none group-hover/jira-issue:pointer-events-auto group-hover/jira-issue:opacity-100 group-has-[:focus-visible]/jira-issue:pointer-events-auto group-has-[:focus-visible]/jira-issue:opacity-100 data-[open=true]:pointer-events-auto data-[open=true]:opacity-100",
				alwaysVisible && "pointer-events-auto opacity-100",
				exiting && !alwaysVisible && "opacity-0! pointer-events-none!",
			)}
		>
			<Popover open={open} onOpenChange={(nextOpen) => (nextOpen ? actions.open("footer") : actions.close())}>
				<Tooltip open={tooltipOpen && !open} onOpenChange={setTooltipOpen}>
					<TooltipTrigger
						render={
							<PopoverTrigger
								render={
									<button
										ref={triggerRef}
										disabled={exiting}
										type="button"
										aria-label={`Add agent to ${issueKey}`}
										aria-describedby={tooltipOpen && !open ? tooltipId : undefined}
										className="group/butter-add-agent-trigger relative inline-flex size-6 items-center justify-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
										onClick={(event) => event.stopPropagation()}
										onPointerDown={(event) => event.stopPropagation()}
									/>
								}
							/>
						}
					>
						<span
							data-slot="jira-issue-add-agent-visual"
							className="flex size-6 scale-90 transition-transform duration-normal ease-out-practical motion-reduce:scale-100 motion-reduce:transition-none group-hover/jira-issue:scale-100 group-has-[:focus-visible]/jira-issue:scale-100 group-data-[open=true]/butter-add-agent:scale-100"
						>
							<Avatar aria-hidden animate={false} shape="hexagon" size="sm" borderTone={open ? "selected" : "default"}>
								<span className="flex size-full items-center justify-center bg-bg-neutral-subtle text-icon-subtle transition-colors duration-fast ease-out-practical motion-reduce:transition-none group-hover/butter-add-agent-trigger:bg-bg-neutral-subtle-hovered group-active/butter-add-agent-trigger:bg-bg-neutral-subtle-pressed group-aria-expanded/butter-add-agent-trigger:bg-bg-selected group-aria-expanded/butter-add-agent-trigger:text-icon-selected">
									<AddIcon label="" size="small" color="currentColor" />
								</span>
							</Avatar>
						</span>
					</TooltipTrigger>
					<TooltipContent id={tooltipId} role="tooltip" side="top" sideOffset={8}>
						Add agent
					</TooltipContent>
				</Tooltip>
				{inlinePicker ? <PopoverContent aria-label="Agents" side="right" align="start" alignOffset={-6} sideOffset={8} className="w-80 max-h-[min(26rem,var(--available-height,26rem))] overflow-hidden p-0 [&>div]:max-h-[var(--available-height,26rem)]" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
					<ProjectButterInlineAgentPicker sessions={assignment.sessions} onContinueSession={assignment.onOpenSession ? (session) => { actions.close(); assignment.onOpenSession?.(session); } : undefined} onAssign={(agent) => { setTooltipOpen(false); assignAgent(agent); }} onBrowseAgents={assignment.onBrowseAgents ? () => { actions.close(); assignment.onBrowseAgents?.(); } : undefined} onCreateAgent={assignment.onCreateAgent ? () => { actions.close(); assignment.onCreateAgent?.(); } : undefined} />
				</PopoverContent> : <ProjectButterAgentPicker
					sessions={assignment.sessions}
					onContinueSession={assignment.onOpenSession ? (session) => { actions.close(); assignment.onOpenSession?.(session); } : undefined}
					onAssign={(agent) => { setTooltipOpen(false); assignAgent(agent); }}
					onBrowseAgents={assignment.onBrowseAgents}
					onCreateAgent={assignment.onCreateAgent}
				/>}
			</Popover>
		</div>
	);
}
