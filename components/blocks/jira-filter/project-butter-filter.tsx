"use client";

import { useState, type ReactNode } from "react";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import CrossIcon from "@atlaskit/icon/core/cross";
import CurlyBracketsIcon from "@atlaskit/icon/core/curly-brackets";
import EpicIcon from "@atlaskit/icon/core/epic";
import FieldIcon from "@atlaskit/icon/core/field";
import FilterIcon from "@atlaskit/icon/core/filter";
import LinkBrokenIcon from "@atlaskit/icon/core/link-broken";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PersonAvatarIcon from "@atlaskit/icon/core/person-avatar";
import PinIcon from "@atlaskit/icon/core/pin";
import PinFilledIcon from "@atlaskit/icon/core/pin-filled";
import DeleteIcon from "@atlaskit/icon/core/delete";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import ReleaseIcon from "@atlaskit/icon/core/release";
import SearchIcon from "@atlaskit/icon/core/search";
import SprintIcon from "@atlaskit/icon/core/sprint";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import StoryIcon from "@atlaskit/icon/core/story";
import TagIcon from "@atlaskit/icon/core/tag";
import TaskIcon from "@atlaskit/icon/core/task";
import WorkItemIcon from "@atlaskit/icon/core/work-item";
import PersonAssigneeIcon from "@atlaskit/icon-lab/core/person-assignee";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Lozenge } from "@/components/ui/lozenge";
import { StickyRowScrollFade } from "@/components/visual/scroll-mask";
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
const fieldIcons: Record<string, ReactNode> = {
	agentStatus: <AiAgentIcon label="" />,
	prStatus: <PullRequestIcon label="" />,
	assignee: <PersonAssigneeIcon label="" />,
	fixVersion: <ReleaseIcon label="" />,
	epic: <EpicIcon label="" />,
	sprint: <SprintIcon label="" />,
	type: <WorkItemIcon label="" />,
	label: <TagIcon label="" />,
	status: <CheckCircleIcon label="" />,
};

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
			className={`absolute ${saved ? "right-7" : "right-1"} size-6 p-0 opacity-0 group-hover/filter-row:opacity-100 group-focus-within/filter-row:opacity-100 data-[highlighted]:opacity-100 [&>span]:items-center`}
			aria-label={`${pinned ? "Unpin" : "Pin"} ${name}`}
			onClick={() => onToggle(pin)}
		>
			{pinned ? <PinFilledIcon label="" /> : <PinIcon label="" />}
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
	if (field.id === "status" || field.id === "sprint") {
		const tone =
			option.value === "done"
				? "success"
				: option.value === "in-review"
					? "discovery"
					: option.value === "in-progress"
						? "information"
						: option.value === "planning"
							? "warning"
							: "neutral";
		return <Lozenge variant={tone}>{option.label}</Lozenge>;
	}
	let icon: ReactNode = null;
	if (field.id === "agentStatus") {
		icon =
			option.value === "needsInput" ? (
				<span className="size-1.5 rounded-full bg-icon-information" />
			) : option.value === "finished" ? (
				<StatusSuccessIcon label="" />
			) : (
				<AiAgentIcon label="" />
			);
	} else if (field.id === "prStatus") {
		icon =
			option.value === "merged" ? (
				<MergeSuccessIcon label="" />
			) : option.value === "closed" ? (
				<MergeFailureIcon label="" />
			) : option.value === "none" ? (
				<LinkBrokenIcon label="" />
			) : (
				<PullRequestIcon label="" />
			);
	} else if (field.id === "assignee") {
		icon = (
			<Avatar size="xs" label={option.label}>
				<AvatarFallback>
					{option.label
						.split(" ")
						.map((part) => part[0])
						.join("")
						.slice(0, 2)}
				</AvatarFallback>
			</Avatar>
		);
	} else if (field.id === "type") {
		icon =
			option.value === "story" ? (
				<StoryIcon label="" />
			) : option.value === "epic" ? (
				<EpicIcon label="" />
			) : (
				<TaskIcon label="" />
			);
	}
	return (
		<span className="flex min-w-0 items-center gap-3">
			{icon ? (
				<span
					aria-hidden="true"
					className="inline-flex size-6 shrink-0 items-center justify-center text-icon-subtle"
				>
					{icon}
				</span>
			) : null}
			<span className="truncate">{option.label}</span>
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
	return (
		<div className="group/filter-row relative flex items-center rounded-lg hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered">
			<DropdownMenuCheckboxItem
				className="group-hover/filter-row:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:opacity-0 group-focus-within/filter-row:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:opacity-0"
				checked={selected}
				closeOnClick={false}
				indicatorPlacement="end"
				onCheckedChange={onToggle}
			>
				<ValueLabel field={field} option={option} />
			</DropdownMenuCheckboxItem>
			<PinButton
				pin={{ kind: "value", field: field.id, value: option.value }}
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
	return (
		<div className="group/filter-row relative flex items-center rounded-lg hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered">
			<DropdownMenuCheckboxItem
				className="group-hover/filter-row:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:opacity-0 group-focus-within/filter-row:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:opacity-0"
				checked={selected}
				closeOnClick={false}
				indicatorPlacement="end"
				onCheckedChange={onSelect}
			>
				{filter.name}
			</DropdownMenuCheckboxItem>
			<PinButton
				saved
				pin={{ kind: "saved", id: filter.id }}
				name={filter.name}
				pins={pins}
				onToggle={onPin}
			/>
			<DropdownMenuItem
				closeOnClick={false}
				className="absolute right-1 size-6 p-0 opacity-0 group-hover/filter-row:opacity-100 group-focus-within/filter-row:opacity-100 data-[highlighted]:opacity-100 [&>span]:items-center"
				aria-label={`Delete ${filter.name}`}
				onClick={onDelete}
			>
				<DeleteIcon label="" />
			</DropdownMenuItem>
		</div>
	);
}

export function ProjectButterFilter({
	fields,
	value,
	onChange,
	initialSavedFilters = [],
	onSavedFiltersChange,
	onSaveView,
	onSaveAsView,
}: Readonly<JiraFilterProps>) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
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
			<ButtonGroup aria-label="Filter controls" variant="split">
				<DropdownMenuTrigger
					aria-haspopup="dialog"
					aria-label={activeCount ? `Filter (${activeCount})` : "Filter"}
					render={<Button variant="secondary" />}
				>
					<FilterIcon label="" /> Filter{" "}
					{activeCount ? <Badge>{activeCount}</Badge> : null}
				</DropdownMenuTrigger>
				{activeCount ? (
					<Button
						variant="secondary"
						size="icon"
						aria-label="Clear all filters"
						onClick={() => {
							clearAll();
							setOpen(false);
						}}
					>
						<CrossIcon label="" />
					</Button>
				) : null}
			</ButtonGroup>
			<DropdownMenuContent
				align="start"
				role="dialog"
				aria-label="Project butter filters"
				className="flex max-h-[min(665px,var(--available-height))] w-56 flex-col overflow-hidden p-0"
			>
				<div className="relative z-10 shrink-0">
					<DropdownMenuSearchField
						icon={<SearchIcon label="" />}
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
									elemBefore={fieldIcons[field.id] ?? <FieldIcon label="" />}
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
									<DropdownMenuSubheading>Pinned</DropdownMenuSubheading>
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
									elemBefore={<PersonAvatarIcon label="" />}
								>
									Saved
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent
									aria-label="Saved filters"
									className="flex w-56 flex-col overflow-hidden p-0"
								>
									<div className="min-h-0 overflow-y-auto px-1.5 pt-1.5">
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
										<DropdownMenuSeparator />
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
									elemBefore={<FieldIcon label="" />}
								>
									Advanced
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent
									aria-label="Advanced filter"
									role="dialog"
									className="w-[min(460px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]"
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
									elemBefore={<CurlyBracketsIcon label="" />}
								>
									JQL
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent
									aria-label="JQL filter"
									role="dialog"
									className="w-[min(460px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]"
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
									/>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
							<DropdownMenuSeparator />
							{visibleFields.map((field) => {
								const selected =
									value.find((item) => item.field === field.id)?.values ?? [];
								return (
									<DropdownMenuSub key={field.id}>
										<DropdownMenuSubTrigger
											elemBefore={
												fieldIcons[field.id] ?? <FieldIcon label="" />
											}
										>
											{field.label}
											{selected.length ? ` (${selected.length})` : ""}
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent
											aria-label={`${field.label} filter options`}
											className="flex w-56 flex-col overflow-hidden p-0"
										>
											<div className="min-h-0 overflow-y-auto px-1.5 pt-1.5">
												{field.options.map((option) => (
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
											</div>
											<div className="shrink-0 p-1.5 pt-0">
												<DropdownMenuSeparator />
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
