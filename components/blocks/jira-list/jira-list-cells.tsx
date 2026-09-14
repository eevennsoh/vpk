"use client";

import { memo, type ReactNode } from "react";
import type { JiraListColumnDefinition } from "@/components/blocks/jira-list/jira-list-column-model";
import type { JiraListRowData } from "@/components/blocks/jira-list/jira-list-types";
import BugIcon from "@atlaskit/icon/core/bug";
import EpicIcon from "@atlaskit/icon/core/epic";
import PriorityMajorIcon from "@atlaskit/icon/core/priority-major";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";
import PriorityMinorIcon from "@atlaskit/icon/core/priority-minor";
import StoryIcon from "@atlaskit/icon/core/story";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import TaskIcon from "@atlaskit/icon/core/task";

import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import {
	AgentAssignment,
	resolveAssignedAgentStatusKind,
	type AgentAssignmentAgent,
} from "@/components/blocks/agent-assignment";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

import type {
	JiraListAssignedAgent,
	JiraListIssueType,
	JiraListGoal,
	JiraListPerson,
	JiraListPriority,
	JiraListTag,
} from "@/components/blocks/jira-list/jira-list-types";

const LIST_ASSIGNED_AGENT_MAX_VISIBLE = 3;

const PRIORITY_ICONS = {
	major: PriorityMajorIcon,
	medium: PriorityMediumIcon,
	minor: PriorityMinorIcon,
} as const;

const ISSUE_TYPE_ICONS = {
	epic: EpicIcon,
	task: TaskIcon,
	story: StoryIcon,
	subtask: SubtasksIcon,
	bug: BugIcon,
} as const;

const ISSUE_TYPE_ICON_CLASS_NAMES = {
	epic: "text-icon-accent-purple [&_svg]:text-icon-accent-purple!",
	task: "text-icon-accent-blue [&_svg]:text-icon-accent-blue!",
	story: "text-icon-accent-green [&_svg]:text-icon-accent-green!",
	subtask: "text-icon-accent-blue [&_svg]:text-icon-accent-blue!",
	bug: "text-icon-accent-red [&_svg]:text-icon-accent-red!",
} as const;

export function HierarchyConnector({
	indentLevel,
}: Readonly<{
	indentLevel: number;
}>) {
	if (indentLevel <= 0) {
		return null;
	}

	return (
		<div
			aria-hidden="true"
			className="relative shrink-0"
			style={{ width: `${indentLevel * 18}px` }}
		>
			<span className="absolute inset-y-0 left-2 w-px bg-border" />
			<span className="absolute top-1/2 left-2 h-px w-3 -translate-y-1/2 bg-border" />
		</div>
	);
}

function getPersonInitials(name: string): string {
	return name
		.split(/\s+/u)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

export function JiraListAvatar({ person }: Readonly<{ person: JiraListPerson }>) {
	if (person.avatarUnassignedKind) {
		return (
			<Avatar label={person.name} shape={person.avatarShape ?? "circle"} size="sm">
				<AvatarFallback>{person.avatarUnassignedKind === "agent" ? "AI" : "?"}</AvatarFallback>
			</Avatar>
		);
	}

	return (
		<Avatar label={person.name} shape={person.avatarShape ?? "circle"} size="sm">
			{person.avatarSrc ? <AvatarImage alt="" src={person.avatarSrc} /> : null}
			<AvatarFallback>{getPersonInitials(person.name)}</AvatarFallback>
		</Avatar>
	);
}

export function IssueTypeGlyph({ issueType }: Readonly<{ issueType: JiraListIssueType }>) {
	const IssueTypeIcon = ISSUE_TYPE_ICONS[issueType];
	return (
		<Icon
			className={ISSUE_TYPE_ICON_CLASS_NAMES[issueType]}
			label={issueType}
			render={<IssueTypeIcon color="currentColor" label="" size="small" />}
		/>
	);
}

export function PriorityGlyph({ priority }: Readonly<{ priority: JiraListPriority }>) {
	const PriorityIcon = PRIORITY_ICONS[priority];
	return (
		<Icon
			className={cn(
				priority === "major" && "text-icon-danger",
				priority === "medium" && "text-icon-information",
				priority === "minor" && "text-icon-information",
			)}
			label={`${priority} priority`}
			render={<PriorityIcon label="" size="small" />}
		/>
	);
}

export function OverflowBadge({
	count,
	label,
}: Readonly<{
	count: number;
	label: string;
}>) {
	return count > 0 ? <Badge aria-label={label}>+{count}</Badge> : null;
}

function OverflowMenu({
	children,
	count,
	label,
}: Readonly<{
	children: ReactNode;
	count: number;
	label: string;
}>) {
	if (count <= 0) {
		return null;
	}

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Badge
						aria-label={`Show ${count} more ${label}`}
						className="cursor-pointer focus-visible:ring-inset"
						render={<button type="button" />}
					>
						+{count}
					</Badge>
				}
			/>
			<PopoverContent
				align="start"
				className="w-auto min-w-36 gap-0 p-1.5 shadow-xl"
				sideOffset={6}
			>
				<ul aria-label={`More ${label}`} className="flex flex-col gap-1">{children}</ul>
			</PopoverContent>
		</Popover>
	);
}

function toAssignmentAgent(assigned: JiraListAssignedAgent): AgentAssignmentAgent {
	return {
		id: assigned.id,
		name: assigned.name,
		byline: assigned.byline ?? "",
		...(assigned.avatarSrc ? { avatarSrc: assigned.avatarSrc } : {}),
		...(assigned.brandName ? { brandName: assigned.brandName } : {}),
		...(assigned.invokedBy ? { invokedBy: assigned.invokedBy } : {}),
		...(assigned.role ? { role: assigned.role } : {}),
		...(assigned.statusKind ? { statusKind: assigned.statusKind } : {}),
		statusLabel: assigned.statusLabel,
	};
}

function toSelectorAgent(assigned: JiraListAssignedAgent): AgentSelectorAgent {
	return {
		id: assigned.id,
		name: assigned.name,
		byline: assigned.byline ?? "",
		...(assigned.avatarSrc ? { avatarSrc: assigned.avatarSrc } : {}),
		...(assigned.brandName ? { brandName: assigned.brandName } : {}),
	};
}

function toListAssignedAgent(agent: AgentAssignmentAgent): JiraListAssignedAgent {
	return {
		id: agent.id,
		name: agent.name,
		byline: agent.byline,
		...(agent.avatarSrc ? { avatarSrc: agent.avatarSrc } : {}),
		...(agent.brandName ? { brandName: agent.brandName } : {}),
		...(agent.invokedBy ? { invokedBy: agent.invokedBy } : {}),
		...(agent.role ? { role: agent.role } : {}),
		...(agent.statusKind ? { statusKind: agent.statusKind } : {}),
		statusLabel: agent.statusLabel,
	};
}

export function JiraListAgentSessionsCell({
	agentCatalog = ROVO_AGENT_SELECTOR_AGENTS,
	agentSessions,
	onAgentAssign,
	onAssignedAgentIdsChange,
	onAssignedAgentSelect,
}: Readonly<{
	agentCatalog?: readonly AgentSelectorAgent[];
	agentSessions: readonly JiraListAssignedAgent[] | undefined;
	onAgentAssign?: (agent: AgentSelectorAgent) => void;
	onAssignedAgentIdsChange?: (agentIds: readonly string[]) => void;
	onAssignedAgentSelect?: (agent: JiraListAssignedAgent) => void;
}>) {
	const assignedAgents = (agentSessions ?? []).map(toAssignmentAgent);
	const extraAgents = assignedAgents
		.filter((assigned) => !agentCatalog.some((agent) => agent.id === assigned.id))
		.map(toSelectorAgent);
	const agents = extraAgents.length > 0
		? [...extraAgents, ...agentCatalog]
		: agentCatalog;
	const canMutateAgents = Boolean(
		onAssignedAgentIdsChange || onAgentAssign || onAssignedAgentSelect,
	);

	if (!canMutateAgents) {
		const shown = assignedAgents.slice(0, LIST_ASSIGNED_AGENT_MAX_VISIBLE);
		return shown.length === 0 ? (
			<span className="text-sm text-text-subtle" />
		) : (
			<div className="flex min-h-8 min-w-0 items-center gap-0.5 overflow-visible px-2">
				{shown.map((agent) => {
					const statusKind = resolveAssignedAgentStatusKind(agent);
					const avatarStatus = statusKind === "needs-input" || statusKind === "finished"
						? statusKind
						: undefined;
					return (
						<AgentAvatarVisual
							avatarClassName="shrink-0 overflow-visible"
							avatarSrc={agent.avatarSrc}
							brandName={agent.brandName}
							fallbackText={agent.name.slice(0, 2).toUpperCase()}
							key={agent.id}
							label={`${agent.name}. ${agent.statusLabel}`}
							sizePx={24}
							status={avatarStatus}
						/>
					);
				})}
			</div>
		);
	}

	return (
		<div>
			<AgentAssignment
				agents={agents}
				assignedAgents={assignedAgents}
				maxVisibleAgents={LIST_ASSIGNED_AGENT_MAX_VISIBLE}
				onAgentAssign={onAgentAssign}
				onAssignedAgentIdsChange={onAssignedAgentIdsChange ?? (() => undefined)}
				onAssignedAgentSelect={(agent) => {
					onAssignedAgentSelect?.(toListAssignedAgent(agent));
				}}
			/>
		</div>
	);
}

export function JiraListGoalsCell({ goals }: Readonly<{ goals: readonly JiraListGoal[] | undefined }>) {
	if (!goals || goals.length === 0) {
		return <span className="text-text-subtle text-sm">None</span>;
	}

	const [primaryGoal, ...secondaryGoals] = goals;
	return (
		<div className="flex min-w-0 items-center gap-1 overflow-hidden">
			<span
				className={cn(
					"truncate text-sm",
					primaryGoal.emphasis === "warning" ? "text-text-warning" : "text-link",
				)}
			>
				{primaryGoal.text}
			</span>
			<OverflowBadge
				count={secondaryGoals.length}
				label={`${secondaryGoals.length} more goals`}
			/>
		</div>
	);
}

export function JiraListLabelsCell({ labels }: Readonly<{ labels: readonly JiraListTag[] | undefined }>) {
	if (!labels || labels.length === 0) {
		return <span className="text-text-subtle text-sm">None</span>;
	}

	const visibleLabels = labels.slice(0, 2);
	const overflowLabels = labels.slice(visibleLabels.length);
	return (
		<div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
			<div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
				{visibleLabels.map((label) => (
					<Tag className="max-w-[6.5rem] self-center" color={label.color} key={`${label.text}-${label.color}`}>
						{label.text}
					</Tag>
				))}
			</div>
			<OverflowMenu count={overflowLabels.length} label="labels">
				{overflowLabels.map((label) => (
					<li className="flex" key={`${label.text}-${label.color}`}>
						<Tag className="self-center" color={label.color}>{label.text}</Tag>
					</li>
				))}
			</OverflowMenu>
		</div>
	);
}

export function JiraListContributorsCell({ contributors }: Readonly<{ contributors: readonly JiraListPerson[] | undefined }>) {
	if (!contributors || contributors.length === 0) {
		return <span className="text-text-subtle text-sm">None</span>;
	}

	const visibleContributors = contributors.slice(0, 3);
	const overflowCount = Math.max(0, contributors.length - visibleContributors.length);
	return (
		<AvatarGroup label={`Contributors: ${contributors.map((contributor) => contributor.name).join(", ")}`}>
			{visibleContributors.map((contributor) => (
				<JiraListAvatar key={contributor.id} person={contributor} />
			))}
			{overflowCount > 0 ? (
				<AvatarGroupCount>+{overflowCount}</AvatarGroupCount>
			) : null}
		</AvatarGroup>
	);
}

/** Hover/drag chrome can change without re-rendering unchanged cell content. */
export const JiraListCellContent = memo(function JiraListCellContent({
	column,
	row,
}: Readonly<{ column: JiraListColumnDefinition; row: JiraListRowData }>) {
	return column.renderCell(row);
});
