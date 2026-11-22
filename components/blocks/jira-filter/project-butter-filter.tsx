"use client";

import { useState, type ReactNode } from "react";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import CrossIcon from "@atlaskit/icon/core/cross";
import CurlyBracketsIcon from "@atlaskit/icon/core/curly-brackets";
import EpicIcon from "@atlaskit/icon/core/epic";
import FieldIcon from "@atlaskit/icon/core/field";
import FilterIcon from "@atlaskit/icon/core/filter";
import LinkBrokenIcon from "@atlaskit/icon/core/link-broken";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PersonAvatarIcon from "@atlaskit/icon/core/person-avatar";
import PersonIcon from "@atlaskit/icon/core/person";
import PinIcon from "@atlaskit/icon/core/pin";
import PinFilledIcon from "@atlaskit/icon/core/pin-filled";
import DeleteIcon from "@atlaskit/icon/core/delete";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import SprintIcon from "@atlaskit/icon/core/sprint";
import VideoWatchLaterSavedIcon from "@atlaskit/icon-lab/core/video-watch-later-saved";
import { IssueTypeGlyph } from "@/components/blocks/jira-list/jira-list-cells";
import { ProjectButterStatusGlyph } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarUnassigned } from "@/components/ui/avatar";
import { IconTile } from "@/components/ui/icon-tile";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { StickyRowScrollFade } from "@/components/visual/scroll-mask";
import { RichTextSuggestionEmptyState } from "@/components/ui-custom/rich-text-editor/menus";
import { labelColor } from "@/components/blocks/artifact-pane/label-color";
import { Tag } from "@/components/ui/tag";
import { useControllableState } from "@/hooks/use-controllable-state";
import { cn } from "@/lib/utils";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSearchField,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubheading,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	jiraFiltersEqual,
	serializeJiraFilter,
	type JiraFilterCondition,
	type JiraFilterField,
	type JiraSavedFilter,
} from "@/components/blocks/jira-filter/model";
import type { JiraFilterProps } from "@/components/blocks/jira-filter/jira-filter";
import { getJiraFilterFieldIcon, jiraFilterMenuIcon } from "@/components/blocks/jira-filter/filter-field-icon";
import {
	ButterAdvancedPanel,
	ButterJqlPanel,
	ButterNamePanel,
} from "@/components/blocks/jira-filter/project-butter-panels";

type Pin =
	| { kind: "value"; field: string; value: string }
	| { kind: "saved"; id: string };

const defaultFieldIds = [
	"assignee",
	"fixVersion",
	"epic",
	"sprint",
	"type",
	"label",
	"status",
];
const quickFieldIds = ["agentStatus", "prStatus"];
const optionIcons: Record<string, Record<string, ReactNode>> = {
	agentStatus: {
		working: <Spinner animated={false} className="size-[16.75px]" label="" size="xl" variant="bloom-avatar" />,
		needsInput: <span className="size-1.5 rounded-full bg-icon-information" />,
		finished: <IconTile aria-hidden as="span" className="text-icon-success" icon={<StatusSuccessIcon color="currentColor" label="" size="small" />} iconSize="small" label="" size="xxsmall" variant="transparent" />,
	},
	prStatus: {
		draft: <span className="text-icon-subtle"><PullRequestIcon color="currentColor" label="" /></span>,
		open: <span className="text-icon-accent-lime"><PullRequestIcon color="currentColor" label="" /></span>,
		failed: <span className="text-icon-danger"><MergeFailureIcon color="currentColor" label="" /></span>,
		merged: <span className="text-icon-accent-purple"><MergeSuccessIcon color="currentColor" label="" /></span>,
		closed: <MergeFailureIcon label="" />,
		none: <LinkBrokenIcon label="" />,
	},
	type: {
		story: <IssueTypeGlyph issueType="story" />,
		epic: <IssueTypeGlyph issueType="epic" />,
		bug: <IssueTypeGlyph issueType="bug" />,
		task: <IssueTypeGlyph issueType="task" />,
		subtask: <IssueTypeGlyph issueType="subtask" />,
	},
};
const defaultOptionIcons: Record<string, ReactNode> = {
	agentStatus: <AiAgentIcon label="" />,
	prStatus: <PullRequestIcon label="" />,
	type: <IssueTypeGlyph issueType="task" />,
};

function lookupOwn<T>(record: Record<string, T>, key: string): T | undefined {
	return Object.hasOwn(record, key) ? record[key] : undefined;
}

function getOptionIcon(field: string, value: string) {
	const icons = lookupOwn(optionIcons, field);
	return (
		(icons ? lookupOwn(icons, value) : undefined) ??
		lookupOwn(defaultOptionIcons, field)
	);
}

function samePin(a: Pin, b: Pin) {
	return a.kind === "saved" && b.kind === "saved"
		? a.id === b.id
		: a.kind === "value" &&
				b.kind === "value" &&
				a.field === b.field &&
				a.value === b.value;
}

function PinButton({
	pin,
	name,
	pins,
	onToggle,
	saved = false,
}: Readonly<{
	pin: Pin;
	name: string;
	pins: readonly Pin[];
	onToggle: (pin: Pin) => void;
	saved?: boolean;
}>) {
	const pinned = pins.some((item) => samePin(item, pin));
	if (!pinned && pins.length >= 3) return null;
	return (
		<DropdownMenuItem
			closeOnClick={false}
			className={`absolute ${saved ? "right-7" : "right-1"} size-6 p-0 leading-none opacity-0 group-hover/filter-row:opacity-100 group-focus-within/filter-row:opacity-100 data-[highlighted]:opacity-100 [&>span]:items-center [&>span>span]:flex [&_svg]:size-3! [&_svg]:text-icon-subtle!`}
			aria-label={`${pinned ? "Unpin" : "Pin"} ${name}`}
			onClick={() => onToggle(pin)}
		>
			{pinned ? <PinFilledIcon color="currentColor" label="" size="small" /> : <PinIcon color="currentColor" label="" size="small" />}
		</DropdownMenuItem>
	);
}

function ValueLabel({
	field,
	option,
}: Readonly<{
	field: JiraFilterField;
	option: JiraFilterField["options"][number];
}>) {
	if (field.id === "label") {
		return <Tag className="min-w-0 max-w-full shrink" color={option.value === "no-label" ? "standard" : labelColor(option.label)}>{option.label}</Tag>;
	}
	if (field.id === "status") {
		return <span className="flex min-w-0 flex-1 items-center gap-3"><span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center"><ProjectButterStatusGlyph animated={false} size="xs" status={option.label} /></span><span className="min-w-0 truncate">{option.label}</span></span>;
	}
	if (field.id === "epic" || field.id === "sprint") {
		return <span className="flex min-w-0 flex-1 items-center gap-3"><span aria-hidden="true" className={field.id === "epic" ? "inline-flex size-4 shrink-0 items-center justify-center text-icon-accent-purple" : "inline-flex size-4 shrink-0 items-center justify-center text-icon-subtle"}><Icon render={field.id === "epic" ? <EpicIcon color="currentColor" label="" size="small" spacing="none" /> : <SprintIcon color="currentColor" label="" size="small" spacing="none" />} /></span><span className="min-w-0 truncate">{option.displayLabel ?? option.label}</span></span>;
	}
	const icon =
		field.id === "assignee" ? (
			option.value === "unassigned" ? <AvatarUnassigned animate={false} size="sm" label="" /> : option.avatarUrl ? <Avatar animate={false} size="sm" label=""><AvatarImage alt="" src={option.avatarUrl} /></Avatar> : <IconTile aria-hidden as="span" icon={<PersonIcon label="" size="small" />} label="" size="small" variant="gray" />
		) : (
			getOptionIcon(field.id, option.value)
		);
	return (
		<span className="flex min-w-0 flex-1 items-center gap-3">
			{icon ? (
				<span
					aria-hidden="true"
					className={field.id === "assignee" ? "inline-flex size-6 shrink-0 items-center justify-center" : field.id === "type" ? "inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-3!" : "inline-flex size-4 shrink-0 items-center justify-center text-icon-subtle"}
				>
					{field.id === "assignee" || field.id === "agentStatus" || field.id === "type" ? icon : jiraFilterMenuIcon(icon)}
				</span>
			) : null}
			<span className="min-w-0 truncate">{option.label}</span>
		</span>
	);
}

function ValueRow({
	field,
	option,
	selected,
	pins,
	onToggle,
	onPin,
}: Readonly<{
	field: JiraFilterField;
	option: JiraFilterField["options"][number];
	selected: boolean;
	pins: readonly Pin[];
	onToggle: () => void;
	onPin: (pin: Pin) => void;
}>) {
	const pin = { kind: "value", field: field.id, value: option.value } as const;
	const canPin = pins.length < 3 || pins.some((item) => samePin(item, pin));
	return (
		<div className="group/filter-row relative flex items-center rounded-lg hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered">
			<DropdownMenuCheckboxItem
				aria-label={field.id === "epic" || field.id === "sprint" ? option.label : undefined}
				className={cn("min-w-0 group-hover/filter-row:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:opacity-0 group-focus-within/filter-row:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:opacity-0", field.id === "assignee" && "h-10", canPin && "group-hover/filter-row:pr-9 group-focus-within/filter-row:pr-9")}
				checked={selected}
				closeOnClick={false}
				indicatorPlacement="end"
				onCheckedChange={onToggle}
			>
				<ValueLabel field={field} option={option} />
			</DropdownMenuCheckboxItem>
			<PinButton
				pin={pin}
				name={option.label}
				pins={pins}
				onToggle={onPin}
			/>
		</div>
	);
}

function SavedRow({
	filter,
	selected,
	pins,
	onSelect,
	onPin,
	onDelete,
}: Readonly<{
	filter: JiraSavedFilter;
	selected: boolean;
	pins: readonly Pin[];
	onSelect: () => void;
	onPin: (pin: Pin) => void;
	onDelete: () => void;
}>) {
	const pin = { kind: "saved", id: filter.id } as const;
	const canPin = pins.length < 3 || pins.some((item) => samePin(item, pin));
	return (
		<div className="group/filter-row relative flex items-center rounded-lg hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered">
			<DropdownMenuCheckboxItem
				className={cn("min-w-0 group-hover/filter-row:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:opacity-0 group-focus-within/filter-row:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:opacity-0", selected && "gap-2", canPin ? "group-hover/filter-row:pr-15 group-focus-within/filter-row:pr-15" : "group-hover/filter-row:pr-9 group-focus-within/filter-row:pr-9")}
				checked={selected}
				closeOnClick={false}
				indicatorPlacement="end"
				onCheckedChange={onSelect}
			>
				<span className="flex min-w-0 flex-1 items-center gap-3"><span className="inline-flex size-4 shrink-0 items-center justify-center text-icon-subtle" aria-hidden="true">{jiraFilterMenuIcon(<VideoWatchLaterSavedIcon label="" />)}</span><span className="min-w-0 truncate">{filter.name}</span></span>
			</DropdownMenuCheckboxItem>
			<PinButton
				saved
				pin={pin}
				name={filter.name}
				pins={pins}
				onToggle={onPin}
			/>
			<DropdownMenuItem
				closeOnClick={false}
				className="absolute right-1 size-6 p-0 leading-none opacity-0 group-hover/filter-row:opacity-100 group-focus-within/filter-row:opacity-100 data-[highlighted]:opacity-100 [&>span]:items-center [&>span>span]:flex [&_svg]:size-3!"
				aria-label={`Delete ${filter.name}`}
				onClick={onDelete}
			>
				<DeleteIcon label="" size="small" />
			</DropdownMenuItem>
		</div>
	);
}

function ButterFilterTrigger({ compact, triggerLabel, activeCount, open, onClear }: Readonly<{
	compact: boolean;
	triggerLabel: string;
	activeCount: number;
	open: boolean;
	onClear: () => void;
}>) {
	const selectedStyle = activeCount && compact ? "border-border-selected! bg-bg-selected! text-text-selected! hover:bg-bg-selected-hovered! focus-visible:border-ring! [&_svg]:text-icon-selected!" : undefined;
	return (
		<ButtonGroup aria-label="Filter controls" variant="split">
			<DropdownMenuTrigger
				aria-haspopup="dialog"
				aria-label={activeCount ? `${triggerLabel} (${activeCount})` : triggerLabel}
				aria-pressed={activeCount > 0 || open}
				render={<Button className={selectedStyle} size={compact ? "icon" : undefined} variant={compact ? "outline" : "secondary"} />}
			>
				<FilterIcon label="" />{compact ? null : " Filter"}
				{activeCount && !compact ? <Badge>{activeCount}</Badge> : null}
			</DropdownMenuTrigger>
			{activeCount ? (
				<Button className={selectedStyle} variant={compact ? "outline" : "secondary"} size="icon" aria-label="Clear all filters" onClick={onClear}>
					<CrossIcon label="" />
				</Button>
			) : null}
		</ButtonGroup>
	);
}

export function ProjectButterFilter({
	compact = false,
	triggerLabel = "Filter",
	open: controlledOpen,
	onOpenChange,
	fields,
	value,
	onChange,
	initialSavedFilters = [],
	onSavedFiltersChange,
	onSaveView,
	onSaveAsView,
}: Readonly<JiraFilterProps>) {
	const [open, setOpen] = useControllableState({ prop: controlledOpen, defaultProp: false, onChange: onOpenChange });
	const [search, setSearch] = useState("");
	const [optionSearch, setOptionSearch] = useState("");
	const [scrolled, setScrolled] = useState(false);
	const [visibleIds, setVisibleIds] = useState(() =>
		defaultFieldIds.filter((id) => fields.some((field) => field.id === id)),
	);
	const [filters, setFilters] =
		useState<readonly JiraSavedFilter[]>(initialSavedFilters);
	const [pins, setPins] = useState<readonly Pin[]>(() =>
		fields.some(
			(field) =>
				field.id === "agentStatus" &&
				field.options.some((option) => option.value === "needsInput"),
		)
			? [{ kind: "value", field: "agentStatus", value: "needsInput" }]
			: [],
	);
	const [savedBaseline, setSavedBaseline] =
		useState<readonly JiraFilterCondition[]>(value);
	const [viewBaseline, setViewBaseline] =
		useState<readonly JiraFilterCondition[]>(value);
	const [savedOpen, setSavedOpen] = useState(false);
	const [saveFormOpen, setSaveFormOpen] = useState(false);
	const [viewFormOpen, setViewFormOpen] = useState(false);
	const [saveName, setSaveName] = useState("");
	const [viewName, setViewName] = useState("Board view");
	const [jql, setJql] = useState("");
	const [jqlError, setJqlError] = useState<string | null>(null);
	const [jqlDirty, setJqlDirty] = useState(false);
	const [draft, setDraft] = useState<JiraFilterCondition[]>([]);

	const changeFilters = (next: readonly JiraSavedFilter[]) => {
		setFilters(next);
		onSavedFiltersChange?.(next);
	};
	const togglePin = (pin: Pin) =>
		setPins((current) =>
			current.some((item) => samePin(item, pin))
				? current.filter((item) => !samePin(item, pin))
				: current.length < 3
					? [...current, pin]
					: current,
		);
	const toggleValue = (field: JiraFilterField, option: string) => {
		const condition = value.find((item) => item.field === field.id);
		const selected = condition?.values ?? [];
		const next = selected.includes(option)
			? selected.filter((item) => item !== option)
			: field.multiple
				? [...selected, option]
				: [option];
		onChange([
			...value.filter((item) => item.field !== field.id),
			...(next.length
				? [
						{
							field: field.id,
							operator: condition?.operator ?? "is",
							values: next,
						},
					]
				: []),
		]);
	};
	const selectSaved = (filter: JiraSavedFilter) =>
		onChange(
			jiraFiltersEqual(value, filter.conditions)
				? []
				: filter.conditions.map((condition) => ({
						...condition,
						values: [...condition.values],
					})),
		);
	const query = search.trim().toLocaleLowerCase();
	const availableFields = fields.filter(
		(field) =>
			!quickFieldIds.includes(field.id) && !visibleIds.includes(field.id),
	);
	const results = availableFields.filter((field) =>
		field.label.toLocaleLowerCase().includes(query),
	);
	const visibleFields = [...quickFieldIds, ...visibleIds].flatMap(
		(id) => fields.find((field) => field.id === id) ?? [],
	);
	const activeCount = value.filter(
		(condition) => condition.values.length,
	).length;
	const canSave = activeCount > 0 && !jiraFiltersEqual(value, savedBaseline);
	const canSaveView = !jiraFiltersEqual(value, viewBaseline);
	const clearAll = () => {
		onChange([]);
		setDraft([]);
		setJql("");
		setJqlDirty(false);
		setJqlError(null);
	};

	return (
		<DropdownMenu
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) {
					setJql(serializeJiraFilter(value));
					setJqlDirty(false);
					setJqlError(null);
					setSavedBaseline(value);
				} else {
					setSearch("");
					setScrolled(false);
					setSavedOpen(false);
					setSaveFormOpen(false);
					setViewFormOpen(false);
				}
			}}
		>
			<ButterFilterTrigger compact={compact} triggerLabel={triggerLabel} activeCount={activeCount} open={open}
				onClear={() => {
					clearAll();
					setOpen(false);
				}} />
			<DropdownMenuContent
				align="start"
				role="dialog"
				aria-label="Project butter filters"
				className="flex max-h-[min(665px,var(--available-height))] w-56 flex-col overflow-hidden p-0"
			>
				<div className="relative z-10 shrink-0">
					<DropdownMenuSearchField
						label="Add filter"
						value={search}
						onValueChange={setSearch}
						onClear={() => setSearch("")}
						onEscape={() => (search ? setSearch("") : setOpen(false))}
					/>
					<StickyRowScrollFade
						className={scrolled ? "h-12 opacity-100" : "h-12"}
					/>
				</div>
				<div
					role="menu"
					aria-label="Filter options"
					className="min-h-0 overflow-y-auto px-1.5 pt-1.5"
					onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
				>
					{query ? (
						<div aria-label="Available filters">
							{results.map((field) => (
								<DropdownMenuItem
									key={field.id}
									closeOnClick={false}
									elemBeforeSize={16}
									elemBefore={
										getJiraFilterFieldIcon(field.id)
									}
									onClick={() => {
										setVisibleIds((current) => [field.id, ...current]);
										setSearch("");
									}}
								>
									{field.label}
								</DropdownMenuItem>
							))}
							{!results.length ? (
								<p className="px-2 py-1.5 text-sm text-text-subtlest">
									No filters match
								</p>
							) : null}
						</div>
					) : (
						<>
							{pins.length ? (
								<>
									<DropdownMenuSubheading className="px-2 py-1.5">Pinned</DropdownMenuSubheading>
									{pins.map((pin) => {
										if (pin.kind === "saved") {
											const filter = filters.find((item) => item.id === pin.id);
											return filter ? (
												<SavedRow
													key={`saved-${pin.id}`}
													filter={filter}
													selected={jiraFiltersEqual(value, filter.conditions)}
													pins={pins}
													onSelect={() => selectSaved(filter)}
													onPin={togglePin}
													onDelete={() => {
														changeFilters(
															filters.filter((item) => item.id !== filter.id),
														);
														setPins(pins.filter((item) => !samePin(item, pin)));
													}}
												/>
											) : null;
										}
										const field = fields.find((item) => item.id === pin.field);
										const option = field?.options.find(
											(item) => item.value === pin.value,
										);
										return field && option ? (
											<ValueRow
												key={`${pin.field}-${pin.value}`}
												field={field}
												option={option}
												selected={Boolean(
													value
														.find((item) => item.field === field.id)
														?.values.includes(option.value),
												)}
												pins={pins}
												onToggle={() => toggleValue(field, option.value)}
												onPin={togglePin}
											/>
										) : null;
									})}
									<DropdownMenuSeparator />
								</>
							) : null}
							<DropdownMenuSub open={savedOpen} onOpenChange={setSavedOpen}>
								<DropdownMenuSubTrigger
									elemBefore={jiraFilterMenuIcon(<PersonAvatarIcon label="" />)}
									elemBeforeSize={16}
								>
									Saved
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent
									aria-label="Saved filters"
									className="flex w-56 flex-col overflow-hidden p-0"
								>
									<div className="min-h-0 overflow-y-auto p-1.5">
										{filters.map((filter) => (
											<SavedRow
												key={filter.id}
												filter={filter}
												selected={jiraFiltersEqual(value, filter.conditions)}
												pins={pins}
												onSelect={() => selectSaved(filter)}
												onPin={togglePin}
												onDelete={() => {
													changeFilters(
														filters.filter((item) => item.id !== filter.id),
													);
													setPins(
														pins.filter(
															(pin) =>
																pin.kind !== "saved" || pin.id !== filter.id,
														),
													);
												}}
											/>
										))}
										{!filters.length ? (
											<p className="px-2 py-1.5 text-text-subtlest">
												No saved filters
											</p>
										) : null}
									</div>
									<div className="shrink-0 p-1.5 pt-0">
										<DropdownMenuSeparator className="mt-0" />
										<DropdownMenuItem
											closeOnClick={false}
											onClick={() => onChange([])}
										>
											Clear
										</DropdownMenuItem>
									</div>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
							<DropdownMenuSub
								onOpenChange={(next) => {
									if (next) setDraft([...value]);
								}}
							>
								<DropdownMenuSubTrigger
									aria-haspopup="dialog"
									elemBefore={jiraFilterMenuIcon(<FieldIcon label="" />)}
									elemBeforeSize={16}
								>
									Advanced
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent
									aria-label="Advanced filter"
									role="dialog"
									className="w-[min(460px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
								>
									<ButterAdvancedPanel
										fields={fields}
										draft={draft}
										onChange={(next) => {
											setDraft(next);
											onChange(
												next.filter((item) => item.field && item.values.length),
											);
										}}
									/>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
							<DropdownMenuSub
								onOpenChange={(next) => {
									if (next && !jqlDirty) setJql(serializeJiraFilter(value));
								}}
							>
								<DropdownMenuSubTrigger
									aria-haspopup="dialog"
									elemBefore={jiraFilterMenuIcon(<CurlyBracketsIcon label="" />)}
									elemBeforeSize={16}
								>
									JQL
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent
									aria-label="JQL filter"
									role="dialog"
									className="w-[min(460px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
								>
									<ButterJqlPanel
										fields={fields}
										value={value}
										jql={jql}
										error={jqlError}
										onDraftChange={(next) => {
											setJql(next);
											setJqlDirty(true);
											setJqlError(null);
										}}
										onApply={(next) => {
											onChange(next);
											setJqlDirty(false);
										}}
										onError={setJqlError}
										onClose={() => setOpen(false)}
									/>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
							<DropdownMenuSeparator />
							{visibleFields.map((field) => {
								const selected =
									value.find((item) => item.field === field.id)?.values ?? [];
								const searchable = field.id === "assignee" || field.id === "epic" || field.id === "sprint" || field.id === "label";
								const options = searchable ? field.options.filter((option) => option.label.toLowerCase().includes(optionSearch.trim().toLowerCase())) : field.options;
								return (
									<DropdownMenuSub key={field.id} onOpenChange={(next) => { if (!next && searchable) setOptionSearch(""); }}>
										<DropdownMenuSubTrigger
											elemBefore={
												getJiraFilterFieldIcon(field.id)
											}
											elemBeforeSize={16}
										>
											{field.label}
											{selected.length ? ` (${selected.length})` : ""}
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent
											aria-label={`${field.label} filter options`}
											className={field.id === "epic" || field.id === "sprint" || field.id === "label" ? "flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0" : "flex w-56 flex-col overflow-hidden p-0"}
										>
										{searchable ? <DropdownMenuSearchField autoFocus hostOwnsKeyNavigation iconContainerSize={field.id === "assignee" ? 24 : 16} label={field.id === "epic" ? `Search ${field.label.toLowerCase()}` : field.id === "sprint" ? "Search sprint" : field.id === "label" ? "Search labels" : "Search people"} onClear={() => setOptionSearch("")} onValueChange={setOptionSearch} value={optionSearch} onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); if (options[0]) toggleValue(field, options[0].value); }} /> : null}
											<div className={searchable ? "max-h-72 min-h-0 overflow-y-auto p-1.5" : "min-h-0 overflow-y-auto p-1.5"}>
												{options.map((option) => (
													<ValueRow
														key={option.value}
														field={field}
														option={option}
														selected={selected.includes(option.value)}
														pins={pins}
														onToggle={() => toggleValue(field, option.value)}
														onPin={togglePin}
													/>
												))}
											{searchable && !options.length ? <RichTextSuggestionEmptyState label={field.id === "epic" ? "No work items found" : field.id === "sprint" ? "No sprints found" : field.id === "label" ? "No labels found" : "No people found"} /> : null}
											</div>
											<div className="shrink-0 p-1.5 pt-0">
												<DropdownMenuSeparator className="mt-0" />
												<DropdownMenuItem
													closeOnClick={false}
													onClick={() =>
														onChange(
															value.filter((item) => item.field !== field.id),
														)
													}
												>
													Clear
												</DropdownMenuItem>
											</div>
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								);
							})}
						</>
					)}
				</div>
				{!query ? (
					<div
						role="menu"
						aria-label="Filter actions"
						className="shrink-0 p-1.5 pt-0"
					>
						<DropdownMenuSeparator />
						<DropdownMenuSub
							open={saveFormOpen}
							onOpenChange={(next) => {
								setSaveFormOpen(next);
								if (next) setSaveName("Saved filter");
							}}
						>
							<DropdownMenuSubTrigger
								aria-haspopup="dialog"
								disabled={!canSave}
							>
								Save filter
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent
								aria-label="Save filter"
								role="dialog"
								className="w-72"
							>
								<ButterNamePanel
									label="Filter name"
									value={saveName}
									onChange={setSaveName}
									onCancel={() => setSaveFormOpen(false)}
									onSave={() => {
										const name = saveName.trim();
										if (!name) return;
										let ordinal = filters.length + 1;
										while (
											filters.some((filter) => filter.id === `saved-${ordinal}`)
										)
											ordinal++;
										const id = `saved-${ordinal}`;
										changeFilters([
											{
												id,
												name,
												group: "personal",
												conditions: value.map((item) => ({
													...item,
													values: [...item.values],
												})),
											},
											...filters,
										]);
										setSavedBaseline(value);
										setSaveFormOpen(false);
										setSavedOpen(true);
									}}
								/>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
						<DropdownMenuItem
							disabled={!canSaveView}
							onClick={() => {
								setViewBaseline(value);
								onSaveView?.(value);
							}}
						>
							Save view
						</DropdownMenuItem>
						<DropdownMenuSub open={viewFormOpen} onOpenChange={setViewFormOpen}>
							<DropdownMenuSubTrigger
								aria-haspopup="dialog"
								disabled={!activeCount}
							>
								Save as view
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent
								aria-label="Save as view"
								role="dialog"
								className="w-72"
							>
								<ButterNamePanel
									label="View name"
									value={viewName}
									onChange={setViewName}
									onCancel={() => setViewFormOpen(false)}
									onSave={() => {
										if (!viewName.trim()) return;
										onSaveAsView?.(viewName.trim(), value);
										setOpen(false);
									}}
								/>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
						<DropdownMenuSeparator />
						<DropdownMenuItem closeOnClick={false} onClick={clearAll}>
							Clear all
						</DropdownMenuItem>
					</div>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
