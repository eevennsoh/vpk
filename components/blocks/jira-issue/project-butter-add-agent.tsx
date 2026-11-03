"use client";

import { useEffect, useId, useRef, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ProjectButterAgentPicker } from "./project-butter-agent-picker";
import {
	useProjectButterInvocationActions,
	useProjectButterInvocationAgents,
	useProjectButterInvocationPhase,
} from "./project-butter-invocation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { JiraIssueAgentAssignment } from "./index";

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
	const actions = useProjectButterInvocationActions();
	const agents = useProjectButterInvocationAgents();
	const open = phase === "choosing";
	const exiting = phase === "handoff";
	useEffect(() => () => actions?.close(), [actions]);
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const tooltipId = useId();
	const onAssign = assignment?.onAgentAssign;
	if (!assignment || (!onAssign && !assignment.onAssignedAgentIdsChange) || !actions) return null;

	const assignAgent = (agent: AgentSelectorAgent) => {
		const id = agent.id;
		const card = triggerRef.current?.closest("article");
		const listSurface = triggerRef.current?.closest("[data-butter-agent-surface]");
		actions.commit(
			agent,
			agents.findIndex((candidate) => candidate.id === id),
		);
		setTooltipOpen(false);
		onAssign?.(agent);
		const ids = assignment?.assignedAgents?.map((assigned) => assigned.id) ?? [];
		assignment?.onAssignedAgentIdsChange?.(ids.includes(id) ? ids : [...ids, id]);
		const focusSession = () => (listSurface ?? card)
			?.querySelector<HTMLElement>("[data-jira-issue-agent-row-handle]")?.focus({ preventScroll: true });
		if (listSurface) requestAnimationFrame(focusSession);
		else queueMicrotask(focusSession);
	};

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
			<Popover open={open} onOpenChange={(nextOpen) => (nextOpen ? actions.open() : actions.close())}>
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
				<ProjectButterAgentPicker
					onAssign={assignAgent}
					onBrowseAgents={assignment.onBrowseAgents}
					onCreateAgent={assignment.onCreateAgent}
				/>
			</Popover>
		</div>
	);
}
