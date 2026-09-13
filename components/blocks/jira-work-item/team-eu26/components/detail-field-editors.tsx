"use client";

import { useEffect, useState, type ReactNode } from "react";

import PersonIcon from "@atlaskit/icon/core/person";
import PriorityHighIcon from "@atlaskit/icon/core/priority-high";
import PriorityHighestIcon from "@atlaskit/icon/core/priority-highest";
import PriorityLowIcon from "@atlaskit/icon/core/priority-low";
import PriorityLowestIcon from "@atlaskit/icon/core/priority-lowest";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";

import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import { AgentAssignment, type AgentAssignmentAgent } from "@/components/blocks/agent-assignment";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type { CrewMember } from "@/components/blocks/jira-work-item/data/metadata-crew";
import type { AgentPlannerAssignee } from "@/components/blocks/jira-work-item/data/planner-state";
import { WorkingSessionActivityByline } from "@/components/blocks/jira-work-item/team-eu26/components/agent-session-activity-byline";
import { DetailValueTrigger } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-row";
import {
	useJiraWorkItemActions,
	useJiraWorkItemMeta,
	useJiraWorkItemState,
} from "@/components/blocks/jira-work-item/team-eu26/context-jira-work-item";
import {
	resolveAssignedAgentRows,
	resolveLatestAgentSession,
	resolveUsedAgentIds,
} from "@/components/blocks/jira-work-item/team-eu26/lib/assigned-agent-rows";
import {
	DEFAULT_PINNED_SPACE_AGENT_IDS,
	WORK_ITEM_PINNED_ITEMS_LABEL,
} from "@/components/blocks/jira-work-item/team-eu26/lib/work-item-picker-options";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconTile } from "@/components/ui/icon-tile";
import { Lozenge, LozengeDropdownTrigger } from "@/components/ui/lozenge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchIcon } from "@/components/ui/vpk-icons";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import {
	RichTextCommandMenuSearchField,
	RichTextSuggestionEmptyState,
	RichTextSuggestionMenu,
	type RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor";
import { cn } from "@/lib/utils";
import {
	filterMetadataSearchItems,
	PRIORITY_OPTIONS,
	STATUS_PHASES,
	statusVariant,
	type PriorityValue,
} from "./detail-field-editor-data";

export {
	filterMetadataSearchItems,
	PRIORITY_OPTIONS,
	STATUS_PHASES,
	statusVariant,
} from "./detail-field-editor-data";
export type { PriorityValue } from "./detail-field-editor-data";

const PRIORITY_ICONS: Record<PriorityValue, typeof PriorityMediumIcon> = {
	Highest: PriorityHighestIcon,
	High: PriorityHighIcon,
	Medium: PriorityMediumIcon,
	Low: PriorityLowIcon,
	Lowest: PriorityLowestIcon,
};

const PRIORITY_COLOR_CLASSES: Record<PriorityValue, string> = {
	Highest: "text-icon-danger",
	High: "text-icon-danger",
	Medium: "text-icon-warning",
	Low: "text-icon-information",
	Lowest: "text-icon-information",
};

/**
 * Keep the positioning popup visually transparent so the shared editor-palette
 * menu remains the single owner of the picker surface, radius, and shadow.
 */
export const METADATA_PICKER_POPOVER_CLASS =
	"w-auto gap-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none dark:shadow-none [[data-color-mode=dark]_&]:shadow-none";
export const METADATA_PICKER_POSITIONER_CLASS = "z-[700]";
/** Clears the property-row focus ring (ring-3 + offset-1 ≈ 4px) below the trigger. */
export const METADATA_PICKER_SIDE_OFFSET = 8;

export function MetadataSearchPicker({
	emptyLabel,
	items,
	onEscape,
	onSelect,
	placeholder,
}: Readonly<{
	emptyLabel: string;
	items: readonly RichTextSuggestionMenuItem[];
	onEscape: () => void;
	onSelect: (item: RichTextSuggestionMenuItem) => void;
	placeholder: string;
}>) {
	const [query, setQuery] = useState("");
	const visibleItems = filterMetadataSearchItems(items, query);

	return (
		<RichTextSuggestionMenu
			className="rich-text-command-menu-borderless"
			emptyLabel={emptyLabel}
			emptyState={<RichTextSuggestionEmptyState label={emptyLabel} />}
			header={(
				<RichTextCommandMenuSearchField
					autoFocus
					icon={<SearchIcon className="size-4 text-icon-subtle" />}
					label={placeholder}
					onClear={() => setQuery("")}
					onEscape={onEscape}
					onSubmit={() => {
						if (visibleItems[0]) {
							onSelect(visibleItems[0]);
						}
					}}
					onValueChange={setQuery}
					value={query}
				/>
			)}
			items={visibleItems}
			onSelect={onSelect}
			selectedIndex={-1}
			title={placeholder}
		/>
	);
}

const PERSON_LABEL_AVATAR_PX = {
	xs: 16,
	sm: 24,
} as const;

const PERSON_LABEL_TEXT_CLASS = {
	xs: "text-xs",
	sm: "text-sm",
} as const;

export function PersonLabel({
	person,
	prefix,
	size = "sm",
}: Readonly<{
	person: AgentPlannerAssignee;
	/** Muted inline text before the name, e.g. "Reported by". */
	prefix?: string;
	size?: keyof typeof PERSON_LABEL_AVATAR_PX;
}>) {
	const isAgent = person.kind === "agent";
	const fallbackText = person.name.slice(0, 2).toUpperCase();
	return (
		<span className="flex min-w-0 items-center gap-2">
			{isAgent ? (
				<AgentAvatarVisual
					avatarClassName="shrink-0"
					avatarSrc={person.avatarUrl}
					brandName={person.brandName}
					fallbackText={fallbackText}
					sizePx={PERSON_LABEL_AVATAR_PX[size]}
				/>
			) : (
				<Avatar className="shrink-0" size={size}>
					{person.avatarUrl ? <AvatarImage alt="" src={person.avatarUrl} /> : null}
					<AvatarFallback>{fallbackText}</AvatarFallback>
				</Avatar>
			)}
			<span className={cn("min-w-0 truncate", PERSON_LABEL_TEXT_CLASS[size])}>
				{prefix ? <span className="text-text-subtlest">{prefix}{" "}</span> : null}
				<span className="text-text">{person.name}</span>
			</span>
		</span>
	);
}

export function PriorityLabel({ value }: Readonly<{ value: PriorityValue }>) {
	const IconComponent = PRIORITY_ICONS[value];
	return (
		<span className="flex min-w-0 items-center gap-2">
			<IconTile
				aria-hidden
				className={PRIORITY_COLOR_CLASSES[value]}
				icon={<IconComponent color="currentColor" label="" />}
				label=""
				size="small"
				variant="transparent"
			/>
			<span className="truncate text-sm text-text">{value}</span>
		</span>
	);
}

/** Status pill for the Details header bar (video's "To Do ▾"). */
export function StatusPill({
	compact = false,
	value,
	onChange,
}: Readonly<{
	compact?: boolean;
	value: string;
	onChange: (next: string) => void;
}>) {
	const { statusPhases } = useJiraWorkItemMeta();
	const phases = statusPhases ?? STATUS_PHASES;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<LozengeDropdownTrigger
						aria-label={`Change status. Current status: ${value}`}
						className={cn(
							"data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/50",
							compact ? "h-6" : undefined,
						)}
						size={compact ? "compact" : "spacious"}
						variant={statusVariant(value, phases)}
					/>
				}
			>
				{value}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56" positionerClassName={METADATA_PICKER_POSITIONER_CLASS} sideOffset={METADATA_PICKER_SIDE_OFFSET}>
				{phases.map((phase) => (
					<DropdownMenuItem
						key={phase}
						onSelect={() => onChange(phase)}
						selected={phase === value}
					>
						<Lozenge variant={statusVariant(phase, phases)}>{phase}</Lozenge>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function PriorityRowField({ value, onChange }: Readonly<{ value: PriorityValue | null; onChange: (next: PriorityValue) => void }>) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<DetailValueTrigger aria-label={value ? `Change priority. Current priority: ${value}` : "Add priority"} />}>
				{value ? <PriorityLabel value={value} /> : <span className="text-sm text-text-subtlest">Add priority</span>}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56" positionerClassName={METADATA_PICKER_POSITIONER_CLASS} sideOffset={METADATA_PICKER_SIDE_OFFSET}>
				{PRIORITY_OPTIONS.map((option) => (
					<DropdownMenuItem key={option} onSelect={() => onChange(option)} selected={option === value}>
						<PriorityLabel value={option} />
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function PersonRowField({
	ariaLabel,
	people,
	placeholder,
	renderValue,
	value,
	onChange,
}: Readonly<{
	ariaLabel: string;
	people: readonly WorkItemPerson[];
	placeholder: string;
	renderValue?: (person: AgentPlannerAssignee) => ReactNode;
	value: AgentPlannerAssignee | null;
	onChange: (person: AgentPlannerAssignee) => void;
}>) {
	const [open, setOpen] = useState(false);

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
	};
	const items = people.map((person): RichTextSuggestionMenuItem => ({
		description: person.role,
		icon: <PersonIcon label="" size="small" />,
		id: person.name,
		label: person.name,
		visual: person.avatarUrl ? { kind: "avatar", shape: "circle", src: person.avatarUrl } : undefined,
	}));

	return (
		<Popover onOpenChange={handleOpenChange} open={open}>
			<PopoverTrigger render={<DetailValueTrigger aria-label={ariaLabel} />}>
				{value
					? renderValue?.(value) ?? <PersonLabel person={value} />
					: <span className="text-sm text-text-subtlest">{placeholder}</span>}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className={METADATA_PICKER_POPOVER_CLASS}
				positionerClassName={METADATA_PICKER_POSITIONER_CLASS}
				sideOffset={METADATA_PICKER_SIDE_OFFSET}
			>
				<MetadataSearchPicker
					emptyLabel="No people found"
					items={items}
					onEscape={() => handleOpenChange(false)}
					onSelect={(item) => {
						const person = people.find((candidate) => candidate.name === item.id);
						if (person) {
							onChange(person);
							handleOpenChange(false);
						}
					}}
					placeholder="Search people"
				/>
			</PopoverContent>
		</Popover>
	);
}

export function DateRowField({
	ariaLabel,
	dateValueMode = "instant",
	leadingVisual,
	placeholder,
	value,
	onChange,
	CalendarComponent,
}: Readonly<{
	ariaLabel: string;
	dateValueMode?: "instant" | "utc-date";
	leadingVisual?: ReactNode;
	placeholder: string;
	value?: Date;
	onChange: (next: Date | undefined) => void;
	// Injected to keep this module free of a direct calendar import at the top;
	// callers pass the shared Calendar.
	CalendarComponent: React.ComponentType<{ mode: "single"; selected?: Date; onSelect: (d: Date | undefined) => void }>;
}>) {
	const [open, setOpen] = useState(false);
	const [label, setLabel] = useState(placeholder);
	const calendarValue = dateValueMode === "utc-date" && value
		? new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
		: value;

	useEffect(() => {
		setLabel(value
			? new Intl.DateTimeFormat("en-US", {
				dateStyle: "medium",
				...(dateValueMode === "utc-date" ? { timeZone: "UTC" } : {}),
			}).format(value)
			: placeholder);
	}, [dateValueMode, placeholder, value]);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={<DetailValueTrigger aria-label={ariaLabel} />}>
				{leadingVisual}
				<span className={cn("text-sm", value ? "text-text" : "text-text-subtlest")}>{label}</span>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-auto min-w-(--anchor-width) p-2"
				positionerClassName={METADATA_PICKER_POSITIONER_CLASS}
				sideOffset={METADATA_PICKER_SIDE_OFFSET}
			>
				<CalendarComponent
					mode="single"
					onSelect={(next) => {
						onChange(next && dateValueMode === "utc-date"
							? new Date(Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()))
							: next);
						setOpen(false);
					}}
					selected={calendarValue}
				/>
			</PopoverContent>
		</Popover>
	);
}

function toCrewAgent(agent: AgentSelectorAgent): CrewMember {
	return {
		id: agent.id,
		kind: "agent",
		name: agent.name,
		...(agent.avatarSrc ? { avatarUrl: agent.avatarSrc } : {}),
		...(agent.brandName ? { brandName: agent.brandName } : {}),
	};
}

function toSelectorAgent(member: CrewMember): AgentSelectorAgent {
	return {
		id: member.id,
		name: member.name,
		byline: "",
		...(member.avatarUrl ? { avatarSrc: member.avatarUrl } : {}),
		...(member.brandName ? { brandName: member.brandName } : {}),
	};
}

export function AgentsRowField({
	value,
	onChange,
}: Readonly<{
	value: readonly CrewMember[];
	onChange: (next: CrewMember[]) => void;
}>) {
	const actions = useJiraWorkItemActions();
	const { sessions, staticEvents } = useJiraWorkItemState();
	const selectedAgents = value.filter((member) => member.kind === "agent");
	const assignedRows = resolveAssignedAgentRows(value, sessions, staticEvents);
	const assignedAgents = assignedRows.map((row, rowIndex): AgentAssignmentAgent => ({
		id: row.agentId,
		name: row.name,
		byline: "",
		...(row.avatarSrc ? { avatarSrc: row.avatarSrc } : {}),
		...(row.brandName ? { brandName: row.brandName } : {}),
		status: row.session !== undefined && row.session.status !== "completed"
			? <WorkingSessionActivityByline session={row.session} sessionIndex={rowIndex} />
			: <WorkingSessionActivityByline fallbackLabel={row.statusLabel} />,
		statusKind: row.statusKind,
		statusLabel: row.statusLabel,
	}));
	const extraAgents = selectedAgents
		.filter((member) => !ROVO_AGENT_SELECTOR_AGENTS.some((agent) => agent.id === member.id))
		.map(toSelectorAgent);
	const agents = extraAgents.length > 0
		? [...extraAgents, ...ROVO_AGENT_SELECTOR_AGENTS]
		: ROVO_AGENT_SELECTOR_AGENTS;

	const handleOpenAgentSession = (agent: AgentAssignmentAgent) => {
		const row = assignedRows.find((candidate) => candidate.agentId === agent.id);
		if (!row?.session) {
			actions.invokeAgent(agent, "context-pill", `@${agent.name}`);
			return;
		}
		actions.openSession(row.session.id);
	};

	const handleContinueExistingSession = (agent: AgentSelectorAgent) => {
		const session = resolveLatestAgentSession(sessions, agent.id);
		if (!session) {
			actions.invokeAgent(agent, "context-pill", `@${agent.name}`);
			return;
		}
		actions.openSession(session.id);
	};

	const handleAgentAssign = (agent: AgentSelectorAgent) => {
		actions.invokeAgent(agent, "context-pill", `@${agent.name}`);
	};

	const handleAssignedAgentIdsChange = (agentIds: readonly string[]) => {
		const nonAgentCrew = value.filter((member) => member.kind !== "agent");
		const selectedById = new Map(selectedAgents.map((member) => [member.id, member]));
		const availableById = new Map(agents.map((agent) => [agent.id, agent]));
		const nextAgents = agentIds.flatMap((agentId) => {
			const selected = selectedById.get(agentId);
			if (selected) {
				return [selected];
			}
			const agent = availableById.get(agentId);
			return agent ? [toCrewAgent(agent)] : [];
		});
		onChange([...nonAgentCrew, ...nextAgents]);
	};

	return (
		<AgentAssignment
			agents={agents}
			allowArchive={false}
			assignedAgents={assignedAgents}
			defaultPinnedAgentIds={DEFAULT_PINNED_SPACE_AGENT_IDS}
			maxVisibleAgents={3}
			onAgentAssign={handleAgentAssign}
			onAssignedAgentIdsChange={handleAssignedAgentIdsChange}
			onAssignedAgentSelect={handleOpenAgentSession}
			onContinueExistingSession={handleContinueExistingSession}
			onStartNewSession={handleAgentAssign}
			pinnedItemsLabel={WORK_ITEM_PINNED_ITEMS_LABEL}
			usedAgentIds={resolveUsedAgentIds(sessions)}
			positionerClassName="z-[502]"
		/>
	);
}
