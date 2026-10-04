"use client";

import { useMemo, useState, type ReactElement } from "react";
import AiAgentAddIcon from "@atlaskit/icon-lab/core/ai-agent-add";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import type { JiraKanbanAgentData } from "@/components/blocks/jira-kanban";
import { BOARD_COLUMN_ACTION_REVEAL } from "@/components/blocks/jira-kanban/experimental/lib/board-column-action-reveal";
import { WorkItemAgentSelector } from "@/components/blocks/jira-work-item/experimental-v3/components/work-item-agent-selector";
import { DEFAULT_PINNED_SPACE_AGENT_IDS } from "@/components/blocks/jira-work-item/experimental-v3/lib/work-item-picker-options";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AgentAvatarProps {
	agent: JiraKanbanAgentData;
	className?: string;
}

interface AgentStackProps {
	agents: readonly JiraKanbanAgentData[];
}

interface BoardColumnAgentAssignmentProps {
	agents: readonly JiraKanbanAgentData[];
	assignedAgentIds: readonly string[];
	columnTitle: string;
	onCreateAgent: (columnTitle: string) => void;
	onToggleAgent: (agentId: string) => void;
}

function getAgentInitials(name: string): string {
	return name
		.split(/\s+/u)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function AgentAvatar({
	agent,
	className,
}: Readonly<AgentAvatarProps>): ReactElement {
	if (agent.brandName) {
		return (
			<Avatar className={className} label={agent.name} shape="hexagon" size="sm">
				<LogoThirdParty borderless label="" name={agent.brandName} size="xxsmall" />
			</Avatar>
		);
	}

	return (
		<Avatar className={className} label={agent.name} shape="hexagon" size="sm">
			<AvatarImage alt="" src={agent.avatarSrc} />
			<AvatarFallback>{getAgentInitials(agent.name)}</AvatarFallback>
		</Avatar>
	);
}

function AgentStack({ agents }: Readonly<AgentStackProps>): ReactElement | null {
	const visibleAgents = agents.slice(0, 2);
	const overflowCount = Math.max(0, agents.length - visibleAgents.length);
	const label = agents.map((agent) => agent.name).join(", ");

	if (agents.length === 0) {
		return null;
	}

	return (
		<AvatarGroup className="-space-x-1.5 *:data-[slot=avatar]:ring-0!" label={`Assigned agents: ${label}`}>
			{visibleAgents.map((agent) => (
				<AgentAvatar agent={agent} key={agent.id} />
			))}
			{overflowCount > 0 ? (
				<Avatar aria-label={`${overflowCount} more assigned agents`} shape="hexagon" size="sm">
					<AvatarFallback className="bg-bg-neutral-bold text-[10px] font-semibold text-text-inverse">
						+{overflowCount}
					</AvatarFallback>
				</Avatar>
			) : null}
		</AvatarGroup>
	);
}

export function BoardColumnAgentAssignment({
	agents,
	assignedAgentIds,
	columnTitle,
	onCreateAgent,
	onToggleAgent,
}: Readonly<BoardColumnAgentAssignmentProps>): ReactElement {
	const [open, setOpen] = useState(false);
	const [pinnedAgentIds, setPinnedAgentIds] = useState<readonly string[]>(DEFAULT_PINNED_SPACE_AGENT_IDS);
	const [query, setQuery] = useState("");
	const assignedAgents = useMemo(
		() => assignedAgentIds
			.map((id) => agents.find((agent) => agent.id === id))
			.filter((agent): agent is JiraKanbanAgentData => Boolean(agent)),
		[agents, assignedAgentIds],
	);
	const hasAssignedAgents = assignedAgents.length > 0;
	const triggerLabel = hasAssignedAgents
		? `Manage agents for ${columnTitle}`
		: `Add agent to ${columnTitle}`;

	function closeMenu() {
		setOpen(false);
		setQuery("");
	}

	function handleCreateAgent() {
		closeMenu();
		onCreateAgent(columnTitle);
	}

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			setOpen(true);
			return;
		}

		closeMenu();
	}

	return (
		<div className="flex min-w-0 shrink-0 items-center">
			<DropdownMenu open={open} onOpenChange={handleOpenChange}>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger render={<span className="inline-flex" />}>
							<DropdownMenuTrigger
								render={
									<Button
										aria-label={triggerLabel}
										className={cn(
											BOARD_COLUMN_ACTION_REVEAL,
											"group-hover/board-column:pointer-events-auto group-hover/board-column:opacity-100",
											"group-has-[:focus-visible]/board-column:pointer-events-auto group-has-[:focus-visible]/board-column:opacity-100",
											hasAssignedAgents && "h-8 min-w-0 gap-1 px-1.5",
											(hasAssignedAgents || open) && "pointer-events-auto opacity-100",
										)}
										data-assigned={hasAssignedAgents || undefined}
										data-open={open || undefined}
										size={hasAssignedAgents ? "default" : "icon-compact"}
										variant="ghost"
									/>
								}
							>
								{hasAssignedAgents ? (
									<>
										<AgentStack agents={assignedAgents} />
										<Icon className="ml-0.5 text-icon-subtle group-aria-expanded/button:text-icon-selected" render={<ChevronDownIcon label="" size="small" />} />
									</>
								) : (
									<Icon
										className="text-icon-subtle group-aria-expanded/button:text-icon-selected"
										label="Add agent"
										render={<AiAgentAddIcon label="" />}
									/>
								)}
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<TooltipContent>{hasAssignedAgents ? "Manage agents" : "Add agent"}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<DropdownMenuContent
					align="end"
					className="max-h-none w-[360px] overflow-hidden p-0"
					positionerClassName="z-[502]"
					sideOffset={8}
				>
					<WorkItemAgentSelector
						agents={agents}
						onAgentToggle={onToggleAgent}
						onBrowseAgents={closeMenu}
						onCreateAgent={handleCreateAgent}
						onPinnedAgentIdsChange={setPinnedAgentIds}
						onQueryChange={setQuery}
						pinnedAgentIds={pinnedAgentIds}
						query={query}
						selectedAgentIds={assignedAgentIds}
					/>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
