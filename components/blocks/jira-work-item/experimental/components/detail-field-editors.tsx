"use client";

import { useEffect, useState } from "react";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import EpicIcon from "@atlaskit/icon/core/epic";
import StatusInformationIcon from "@atlaskit/icon/core/status-information";
import PersonIcon from "@atlaskit/icon/core/person";
import PriorityHighIcon from "@atlaskit/icon/core/priority-high";
import PriorityHighestIcon from "@atlaskit/icon/core/priority-highest";
import PriorityLowIcon from "@atlaskit/icon/core/priority-low";
import PriorityLowestIcon from "@atlaskit/icon/core/priority-lowest";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";
import TagIcon from "@atlaskit/icon/core/tag";

import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import { CREW_ROSTER, type CrewMember } from "@/components/blocks/jira-work-item/data/metadata-crew";
import type { AgentSessionStatus } from "@/components/blocks/jira-work-item/data/session-state";
import { useJiraWorkItemState } from "@/components/blocks/jira-work-item/experimental/context-jira-work-item";
import { LABEL_OPTIONS, PARENT_OPTIONS } from "@/components/blocks/jira-work-item/data/metadata-fixtures";
import { AgentProfileCard } from "@/components/blocks/agent-profile-card/components/agent-profile-card";
import { BOARD_AGENTS } from "@/components/projects/jira/data/board-agents";
import type { AgentPlannerAssignee } from "@/components/blocks/jira-work-item/data/planner-state";
import { DetailValueTrigger } from "@/components/blocks/jira-work-item/experimental/components/detail-field-row";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { IconTile } from "@/components/ui/icon-tile";
import { Lozenge, LozengeDropdownTrigger } from "@/components/ui/lozenge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Tag, TagGroup } from "@/components/ui/tag";
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
	className,
	emptyLabel,
	items,
	onEscape,
	onSelect,
	placeholder,
}: Readonly<{
	className?: string;
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
			className={cn("rich-text-command-menu-borderless", className)}
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

export function PersonLabel({ person }: Readonly<{ person: AgentPlannerAssignee }>) {
	const isAgent = person.kind === "agent";
	const fallbackText = person.name.slice(0, 2).toUpperCase();
	return (
		<span className="flex min-w-0 items-center gap-1">
			{isAgent ? (
				<AgentAvatarVisual
					avatarClassName="shrink-0"
					avatarSrc={person.avatarUrl}
					brandName={person.brandName}
					fallbackText={fallbackText}
					sizePx={24}
				/>
			) : (
				<Avatar className="shrink-0" size="sm">
					{person.avatarUrl ? <AvatarImage alt="" src={person.avatarUrl} /> : null}
					<AvatarFallback>{fallbackText}</AvatarFallback>
				</Avatar>
			)}
			<span className="min-w-0 truncate text-sm text-text">{person.name}</span>
		</span>
	);
}

export function PriorityLabel({ value }: Readonly<{ value: PriorityValue }>) {
	const IconComponent = PRIORITY_ICONS[value];
	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<span className={cn("flex shrink-0", PRIORITY_COLOR_CLASSES[value])}>
				<IconComponent color="currentColor" label="" />
			</span>
			<span className="truncate text-sm text-text">{value}</span>
		</span>
	);
}

/** Status pill for the Details header bar (video's "To Do ▾"). */
export function StatusPill({ value, onChange }: Readonly<{ value: string; onChange: (next: string) => void }>) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<LozengeDropdownTrigger
						aria-label={`Change status. Current status: ${value}`}
						size="compact"
						variant={statusVariant(value)}
					/>
				}
			>
				{value}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56" positionerClassName={METADATA_PICKER_POSITIONER_CLASS} sideOffset={METADATA_PICKER_SIDE_OFFSET}>
				{STATUS_PHASES.map((phase) => (
					<DropdownMenuItem
						key={phase}
						onSelect={() => onChange(phase)}
						selected={phase === value}
					>
						<Lozenge variant={statusVariant(phase)}>{phase}</Lozenge>
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
	value,
	onChange,
}: Readonly<{
	ariaLabel: string;
	people: readonly WorkItemPerson[];
	placeholder: string;
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
				{value ? <PersonLabel person={value} /> : <span className="text-sm text-text-subtlest">{placeholder}</span>}
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

/**
 * Read-only person value (e.g. Reporter, which can't be reassigned). Renders the
 * same flat value line as the interactive picker's trigger — carrying the
 * `detail-value-trigger` slot so the FloatingField expand/float mechanics still
 * apply — but as a non-interactive element with no popover.
 */
export function PersonReadOnlyValue({
	value,
	placeholder,
}: Readonly<{ value: AgentPlannerAssignee | null; placeholder: string }>) {
	return (
		<div
			className="-mx-2 flex w-full min-w-0 max-w-full items-center gap-2 rounded-md px-2 py-0.5 text-left text-sm"
			data-slot="detail-value-trigger"
		>
			{value ? <PersonLabel person={value} /> : <span className="text-sm text-text-subtlest">{placeholder}</span>}
		</div>
	);
}

export function DateRowField({
	ariaLabel,
	placeholder,
	value,
	onChange,
	CalendarComponent,
}: Readonly<{
	ariaLabel: string;
	placeholder: string;
	value?: Date;
	onChange: (next: Date | undefined) => void;
	// Injected to keep this module free of a direct calendar import at the top;
	// callers pass the shared Calendar.
	CalendarComponent: React.ComponentType<{ mode: "single"; selected?: Date; onSelect: (d: Date | undefined) => void }>;
}>) {
	const [open, setOpen] = useState(false);
	const [label, setLabel] = useState(placeholder);

	useEffect(() => {
		setLabel(value
			? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value)
			: placeholder);
	}, [placeholder, value]);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={<DetailValueTrigger aria-label={ariaLabel} />}>
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
						onChange(next);
						setOpen(false);
					}}
					selected={value}
				/>
			</PopoverContent>
		</Popover>
	);
}

export function ParentRowField({ value, onChange }: Readonly<{ value: string | null; onChange: (key: string) => void }>) {
	const [open, setOpen] = useState(false);
	const selected = PARENT_OPTIONS.find((option) => option.key === value);
	const items = PARENT_OPTIONS.map((option): RichTextSuggestionMenuItem => ({
		description: option.key,
		icon: <EpicIcon label="" size="small" />,
		id: option.key,
		label: option.summary,
	}));

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={<DetailValueTrigger aria-label="Change parent" />}>
				{selected ? (
					<span className="flex min-w-0 items-center gap-1.5 text-sm text-text">
						<span className="shrink-0 font-medium text-text-subtle">{selected.key}</span>
						<span className="min-w-0 truncate text-text-subtle">{selected.summary}</span>
					</span>
				) : (
					<span className="text-sm text-text-subtlest">Add parent</span>
				)}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className={METADATA_PICKER_POPOVER_CLASS}
				positionerClassName={METADATA_PICKER_POSITIONER_CLASS}
				sideOffset={METADATA_PICKER_SIDE_OFFSET}
			>
				<MetadataSearchPicker
					emptyLabel="No work items found"
					items={items}
					onEscape={() => setOpen(false)}
					onSelect={(item) => {
						onChange(item.id);
						setOpen(false);
					}}
					placeholder="Search work items"
				/>
			</PopoverContent>
		</Popover>
	);
}

export function LabelsRowField({ value, onChange }: Readonly<{ value: readonly string[]; onChange: (next: string[]) => void }>) {
	const [open, setOpen] = useState(false);
	const items = LABEL_OPTIONS.map((label): RichTextSuggestionMenuItem => ({
		icon: <TagIcon label="" size="small" />,
		id: label,
		label,
	}));

	const toggle = (label: string) => {
		onChange(value.includes(label) ? value.filter((item) => item !== label) : [...value, label]);
	};

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={<DetailValueTrigger aria-label="Edit labels" />}>
				{value.length > 0 ? (
					<TagGroup className="gap-1">
						{value.map((label) => (
							<Tag color="gray" key={label}>
								{label}
							</Tag>
						))}
					</TagGroup>
				) : (
					<span className="text-sm text-text-subtlest">Add label</span>
				)}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className={METADATA_PICKER_POPOVER_CLASS}
				positionerClassName={METADATA_PICKER_POSITIONER_CLASS}
				sideOffset={METADATA_PICKER_SIDE_OFFSET}
			>
				<MetadataSearchPicker
					emptyLabel="No labels found"
					items={items}
					onEscape={() => setOpen(false)}
					onSelect={(item) => toggle(item.id)}
					placeholder="Search labels"
				/>
			</PopoverContent>
		</Popover>
	);
}

const MAX_AGENT_AVATARS = 3;

// Strips the leading role text from a board agent byline so it can seed the
// profile card's "By {partner}" attribution (e.g. "Rovo agent by Enterprise
// Solutions" -> "Enterprise Solutions", "by Figma" -> "Figma").
function partnerNameFromByline(byline: string | undefined): string | undefined {
	if (!byline) {
		return undefined;
	}
	const match = byline.match(/\bby\s+(.+)$/i);
	return match ? match[1].trim() : byline;
}

// Each agent avatar reveals the agent's profile card on hover/focus. The trigger
// is a plain focusable span (not a button) so it can be nested inside the row's
// popover-trigger element without producing an invalid button-in-button.
function AgentAvatar({ member }: Readonly<{ member: CrewMember }>) {
	const boardAgent = BOARD_AGENTS.find((agent) => agent.id === member.id);
	const partnerName = partnerNameFromByline(boardAgent?.byline);

	return (
		<HoverCard closeDelay={120} openDelay={250}>
			<HoverCardTrigger
				render={
					<span
						aria-label={member.name}
						className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
						tabIndex={0}
					/>
				}
			>
				<AgentAvatarVisual
					avatarClassName="shrink-0"
					avatarSrc={member.avatarUrl}
					brandName={member.brandName}
					fallbackText={member.name.slice(0, 2).toUpperCase()}
					sizePx={20}
				/>
			</HoverCardTrigger>
			<HoverCardContent align="start" className="w-auto border-none bg-transparent p-0 shadow-none" side="left">
				<AgentProfileCard
					avatarSrc={member.avatarUrl}
					// The roster carries no per-agent blurb, so surface the byline as the
					// description rather than the card's built-in placeholder copy, which
					// would misdescribe every agent. Fall back to an empty string (never
					// `undefined`) so the placeholder default can't slip back in.
					description={boardAgent?.byline ?? ""}
					name={member.name}
					partnerBrandName={member.brandName}
					partnerName={partnerName}
					surface="overlay"
					variant="preview"
				/>
			</HoverCardContent>
		</HoverCard>
	);
}

// Section headings for the agent picker, grouping the currently-added agents by
// their live session status. Agents with no session (added but not yet run) fall
// under "Running" as the active-by-default bucket. The unselected roster sits
// under "Select agent".
const AGENT_STATUS_SECTIONS: readonly { key: string; label: string; status: AgentSessionStatus }[] = [
	{ key: "running", label: "Running", status: "running" },
	{ key: "waiting", label: "Awaiting user response", status: "waiting" },
	{ key: "completed", label: "Done", status: "completed" },
];

// Trailing per-row status glyph in the agent picker, mirroring the Jira agent
// session card: `running` shows the Rovo rainbow spinner, `waiting` an
// information icon (needs user input), `completed` nothing. Each glyph sits in a
// 24×24 transparent IconTile so the trailing slot reads at a consistent size.
function AgentStatusIndicator({ status }: Readonly<{ status: AgentSessionStatus }>) {
	switch (status) {
		case "running":
			return (
				<IconTile
					icon={<Spinner label="Running" variant="rainbow" />}
					iconSize="small"
					label="Running"
					size="small"
					variant="transparent"
				/>
			);
		case "waiting":
			return (
				<IconTile
					icon={
						<span className="grid place-items-center leading-none text-icon-information">
							<StatusInformationIcon color="currentColor" label="" size="small" />
						</span>
					}
					iconSize="small"
					label="Awaiting user response"
					size="small"
					title="Awaiting user response"
					variant="transparent"
				/>
			);
		case "completed":
			return null;
	}
}

function toAgentSuggestionItem(
	agent: CrewMember,
	status?: AgentSessionStatus,
): RichTextSuggestionMenuItem {
	return {
		icon: <AiAgentIcon label="" size="small" />,
		id: agent.id,
		label: agent.name,
		visual: agent.brandName
			? { kind: "third-party", name: agent.brandName }
			: agent.avatarUrl
				? { kind: "avatar", shape: "hexagon", src: agent.avatarUrl }
				: undefined,
		...(status && status !== "completed" ? { trailing: <AgentStatusIndicator status={status} /> } : {}),
	};
}

function toAgentSuggestionHeading(id: string, label: string): RichTextSuggestionMenuItem {
	return {
		headingLabel: label,
		icon: null,
		id,
		label,
	};
}

export function AgentsRowField({ value, onChange }: Readonly<{ value: readonly CrewMember[]; onChange: (next: CrewMember[]) => void }>) {
	const [open, setOpen] = useState(false);
	const { sessions, staticEvents } = useJiraWorkItemState();
	const selectedAgents = value.filter((member) => member.kind === "agent");
	const agents = CREW_ROSTER.filter((member) => member.kind === "agent");
	const isSelected = (id: string) => selectedAgents.some((item) => item.id === id);

	// Live session status per agent id (later sessions win). This is the primary
	// source of truth for the Running / Awaiting user response / Done sections.
	const statusByAgentId = new Map<string, AgentSessionStatus>();
	for (const session of sessions) {
		statusByAgentId.set(session.agentId, session.status);
	}
	// Agents that only appear via a completed changed-files output (e.g. the Done
	// preset's Readiness Checker) have no live session but represent finished
	// work, so they resolve to "completed". The output actor id carries a
	// "static-" prefix that the crew id drops (see withOutputContributors).
	const completedOutputAgentIds = new Set<string>();
	for (const event of staticEvents) {
		if (event.kind === "changed-files" && event.sessionItem?.state === "complete") {
			completedOutputAgentIds.add(event.actor.id.replace(/^static-/u, ""));
		}
	}
	// Resolution order: live session status → completed output → "running"
	// fallback for a manually-added agent that has not started yet.
	const statusOf = (id: string): AgentSessionStatus =>
		statusByAgentId.get(id) ?? (completedOutputAgentIds.has(id) ? "completed" : "running");

	// Sections: added agents grouped by session status (Running / Awaiting user
	// response / Done), then the rest of the roster under "Select agent". Each
	// section leads with a non-interactive heading; empty sections are omitted.
	const items: RichTextSuggestionMenuItem[] = [];
	for (const section of AGENT_STATUS_SECTIONS) {
		const sectionItems = agents
			.filter((agent) => isSelected(agent.id) && statusOf(agent.id) === section.status)
			.map((agent) => toAgentSuggestionItem(agent, section.status));
		if (sectionItems.length > 0) {
			items.push(toAgentSuggestionHeading(`__agents-${section.key}-heading`, section.label), ...sectionItems);
		}
	}
	const availableItems = agents
		.filter((agent) => !isSelected(agent.id))
		.map((agent) => toAgentSuggestionItem(agent));
	if (availableItems.length > 0) {
		items.push(toAgentSuggestionHeading("__agents-select-heading", "Select agent"), ...availableItems);
	}

	const toggle = (member: CrewMember) => {
		onChange(
			isSelected(member.id)
				? selectedAgents.filter((item) => item.id !== member.id)
				: [...selectedAgents, member],
		);
	};

	const shown = selectedAgents.slice(0, MAX_AGENT_AVATARS);
	const overflow = selectedAgents.length - shown.length;
	const editContent = (
		<PopoverContent
			align="start"
			className={METADATA_PICKER_POPOVER_CLASS}
			positionerClassName={METADATA_PICKER_POSITIONER_CLASS}
			sideOffset={METADATA_PICKER_SIDE_OFFSET}
		>
			<MetadataSearchPicker
				emptyLabel="No agents found"
				items={items}
				onEscape={() => setOpen(false)}
				onSelect={(item) => {
					const agent = agents.find((candidate) => candidate.id === item.id);
					if (agent) {
						toggle(agent);
					}
				}}
				placeholder="Search agents"
			/>
		</PopoverContent>
	);

	// Empty state: the whole row is a single button that opens the agent picker.
	if (selectedAgents.length === 0) {
		return (
			<Popover onOpenChange={setOpen} open={open}>
				<PopoverTrigger render={<DetailValueTrigger aria-label="Edit agents" />}>
					<span className="text-sm text-text-subtlest">Add agents</span>
				</PopoverTrigger>
				{editContent}
			</Popover>
		);
	}

	// Filled state: the whole row opens the picker. A full-row popover trigger
	// sits behind the avatars as the click surface; the avatars layer on top as
	// standalone hover triggers (they own profile hover cards, so they can't be
	// nested inside the trigger <button>). Clicking anywhere on the row that
	// isn't an avatar opens the picker — no separate edit icon needed.
	return (
		<Popover onOpenChange={setOpen} open={open}>
			<div className="relative flex min-w-0 items-center">
				<PopoverTrigger
					render={
						<button
							aria-label="Edit agents"
							className="absolute inset-0 -mx-2 rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
							type="button"
						/>
					}
				/>
				<AvatarGroup className="pointer-events-none relative shrink-0 [&_[data-slot=hover-card-trigger]]:pointer-events-auto" label={`${selectedAgents.length} agents`}>
					{shown.map((member) => (
						<AgentAvatar key={member.id} member={member} />
					))}
					{overflow > 0 ? <AvatarGroupCount>+{overflow}</AvatarGroupCount> : null}
				</AvatarGroup>
			</div>
			{editContent}
		</Popover>
	);
}
