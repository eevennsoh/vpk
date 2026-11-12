"use client";

import { use, useEffect, useRef, type RefObject } from "react";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { PopoverContent } from "@/components/ui/popover";
import { AgentAdd } from "@/components/ui-custom/agent-add";
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ProjectButterAgentPicker, ProjectButterAgentPickerContent } from "./project-butter-agent-picker";
import { ProjectButterCloudAgentPicker } from "./project-butter-inline-agent-picker";
import { ButterInlineAgentPickerContext } from "./project-butter-inline-picker-context";
import {
	useProjectButterInvocationActions,
	useProjectButterInvocationAgents,
	useProjectButterInvocationPhase,
	useProjectButterInvocationSource,
} from "./project-butter-invocation";
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
	const cloudPicker = use(ButterInlineAgentPickerContext);
	const assignAgent = useButterAgentAssignment(assignment, triggerRef);
	return (
		<DropdownMenuSub onOpenChange={(open) => open ? actions?.open("menu") : actions?.close()}>
			<DropdownMenuSubTrigger aria-haspopup="dialog">Add agent</DropdownMenuSubTrigger>
			<DropdownMenuSubContent aria-label="Agents" role="dialog" className="w-80 max-h-[min(26rem,var(--available-height,26rem))] overflow-hidden p-0" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
				{cloudPicker ? <ProjectButterCloudAgentPicker onAssign={(agent) => { assignAgent(agent); onRequestClose(); }} onBrowseAgents={assignment.onBrowseAgents ? () => { onRequestClose(); assignment.onBrowseAgents?.(); } : undefined} /> : <ProjectButterAgentPickerContent
					sessions={assignment.sessions}
					onContinueSession={assignment.onOpenSession ? (session) => { actions?.close(); onRequestClose(); assignment.onOpenSession?.(session); } : undefined}
					onAssign={(agent) => { assignAgent(agent); onRequestClose(); }}
					onBrowseAgents={assignment.onBrowseAgents ? () => { onRequestClose(); assignment.onBrowseAgents?.(); } : undefined}
					onCreateAgent={assignment.onCreateAgent ? () => { onRequestClose(); assignment.onCreateAgent?.(); } : undefined}
				/>}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

export function ProjectButterAddAgent({
	alwaysVisible = false,
	issueKey,
	assignment,
	side = "right",
}: Readonly<{
	alwaysVisible?: boolean;
	issueKey: string;
	assignment?: JiraIssueAgentAssignment;
	side?: "left" | "right";
}>) {
	const phase = useProjectButterInvocationPhase();
	const source = useProjectButterInvocationSource();
	const actions = useProjectButterInvocationActions();
	const inlinePicker = use(ButterInlineAgentPickerContext);
	const open = phase === "choosing" && source === "footer";
	const exiting = phase === "handoff";
	useEffect(() => () => actions?.close(), [actions]);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const assignAgent = useButterAgentAssignment(assignment, triggerRef);
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
			<AgentAdd open={open} onOpenChange={(nextOpen) => (nextOpen ? actions.open("footer") : actions.close())} label={`Add agent to ${issueKey}`} disabled={exiting} triggerRef={triggerRef}>
				{inlinePicker ? <PopoverContent aria-label="Agents" side={side} align="start" alignOffset={-6} sideOffset={8} className="w-80 max-h-[min(26rem,var(--available-height,26rem))] overflow-hidden p-0 [&>div]:max-h-[var(--available-height,26rem)]" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
					<ProjectButterCloudAgentPicker onAssign={assignAgent} onBrowseAgents={assignment.onBrowseAgents ? () => { actions.close(); assignment.onBrowseAgents?.(); } : undefined} />
				</PopoverContent> : <ProjectButterAgentPicker
					side={side}
					sessions={assignment.sessions}
					onContinueSession={assignment.onOpenSession ? (session) => { actions.close(); assignment.onOpenSession?.(session); } : undefined}
					onAssign={assignAgent}
					onBrowseAgents={assignment.onBrowseAgents}
					onCreateAgent={assignment.onCreateAgent}
				/>}
			</AgentAdd>
		</div>
	);
}
