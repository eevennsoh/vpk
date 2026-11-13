"use client";

import { useMemo, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import PersonIcon from "@atlaskit/icon/core/person";
import type { JiraKanbanAssigneeData, JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { ButterPriorityIcon } from "@/components/blocks/jira-issue/priority";
import { getButterSubtaskProgress } from "@/components/blocks/jira-issue/project-butter-model";
import { PriorityRowField, type PriorityValue } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { MetadataSearchPicker } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { METADATA_PICKER_POPOVER_CLASS, METADATA_PICKER_POSITIONER_CLASS, METADATA_PICKER_SIDE_OFFSET, PERSON_PICKER_DROPDOWN_CLASS } from "@/components/blocks/jira-work-item/team-eu26/components/metadata-picker-styles";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage, AvatarUnassigned } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BoardWorkItemDraft } from "../lib/board-work-item-options";

type Metadata = Omit<BoardWorkItemDraft, "summary" | "issueType">;

const chipClass = "h-6 gap-1 border-border px-1.5 text-xs font-normal";
const BOARD_PRIORITY: Readonly<Record<PriorityValue, JiraKanbanCardData["priority"]>> = { Highest: "critical", High: "major", Medium: "medium", Low: "minor", Lowest: "trivial" };
const WORK_ITEM_PRIORITY: Readonly<Record<JiraKanbanCardData["priority"], PriorityValue>> = { critical: "Highest", major: "High", medium: "Medium", minor: "Low", trivial: "Lowest" };

function Chip({ label, children, ...props }: Readonly<React.ComponentProps<typeof Button> & { label: string }>) {
	return <Button {...props} aria-label={label} className={chipClass} size="compact" type="button" variant="outline">{children}</Button>;
}

function SearchChoices({ label, options, selected, multiple, onSelect }: Readonly<{
	label: string;
	options: readonly { id: string; label: string }[];
	selected: readonly string[];
	multiple?: boolean;
	onSelect: (id: string) => void;
}>) {
	const [query, setQuery] = useState("");
	const visible = options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
	return <>
		<input aria-label={`Search ${label.toLowerCase()}`} className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm" onChange={(event) => setQuery(event.target.value)} value={query} />
		<div aria-label={label} className="max-h-48 overflow-auto" role="group">
			{visible.length ? visible.map((option) => <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-neutral-subtle-hovered" key={option.id}>
				<input checked={selected.includes(option.id)} onChange={() => onSelect(option.id)} type={multiple ? "checkbox" : "radio"} name={multiple ? undefined : label} />
				<span className="min-w-0 truncate">{option.label}</span>
			</label>) : <p className="px-2 py-1 text-text-subtlest">No {label.toLowerCase()} match</p>}
		</div>
	</>;
}

export function BoardCreateCardFields({ assignees: availableAssignees = [], columns, value, onChange, saveAction }: Readonly<{
	assignees?: readonly JiraKanbanAssigneeData[];
	columns: readonly JiraKanbanColumnData[];
	value: Metadata;
	onChange: (patch: Metadata) => void;
	saveAction: React.ReactNode;
}>) {
	const [tagQuery, setTagQuery] = useState("");
	const [tagsOpen, setTagsOpen] = useState(false);
	const [parentOpen, setParentOpen] = useState(false);
	const [dueOpen, setDueOpen] = useState(false);
	const [assigneeOpen, setAssigneeOpen] = useState(false);
	const cards = useMemo(() => columns.flatMap((column) => column.cards), [columns]);
	const selectedSubtaskSet = new Set(value.subtaskKeys ?? []);
	const canBeParent = (card: JiraKanbanCardData) => {
		const visited = new Set<string>();
		let key: string | undefined = card.code;
		while (key && !visited.has(key)) {
			if (selectedSubtaskSet.has(key)) return false;
			visited.add(key);
			key = cards.find((entry) => entry.code === key)?.parentIssueKey;
		}
		return true;
	};
	const parentOptions = cards.filter((card) => card.issueType !== "subtask" && canBeParent(card)).map((card) => ({ id: card.code, label: `${card.code} ${card.title}` }));
	const ancestors = new Set<string>();
	let ancestor = value.parentIssueKey;
	while (ancestor && !ancestors.has(ancestor)) {
		ancestors.add(ancestor);
		ancestor = cards.find((card) => card.code === ancestor)?.parentIssueKey;
	}
	const subtaskOptions = cards.filter((card) => (card.issueType === "subtask" || card.parentIssueKey) && !ancestors.has(card.code)).map((card) => ({ id: card.code, label: `${card.code} ${card.title}` }));
	const assignees = [...new Map([...availableAssignees, ...cards.flatMap((card) => card.assignee ? [card.assignee] : [])].map((assignee) => [assignee.id, assignee])).values()];
	const selectedTags = value.tags ?? [];
	const tags = [...new Set([...cards.flatMap((card) => card.tags.map((tag) => tag.text)), ...selectedTags])];
	const selectedSubtasks = value.subtaskKeys ?? [];
	const subtaskProgress = getButterSubtaskProgress(columns.flatMap((column) => column.cards.filter((card) => selectedSubtasks.includes(card.code)).map((card) => ({ status: card.status ?? column.title }))));
	const toggle = (items: readonly string[], item: string) => items.includes(item) ? items.filter((entry) => entry !== item) : [...items, item];
	const parent = cards.find((card) => card.code === value.parentIssueKey);
	const dueLabel = value.dueDate ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value.dueDate}T12:00:00`)) : undefined;
	const selectedDate = value.dueDate ? new Date(`${value.dueDate}T00:00:00`) : undefined;
	const priority = value.priority ?? "medium";

	return <>
		<div className="flex flex-wrap items-center gap-1 pt-3">
			<div className={parent ? "w-full min-w-0" : undefined}>
				<Popover open={parentOpen} onOpenChange={setParentOpen}>
					<PopoverTrigger render={<Chip label={parent ? `Parent, ${parent.code} ${parent.title}` : "Add parent"}>{parent ? <span className="max-w-48 truncate">{parent.title}</span> : <><Icon render={<AddIcon label="" size="small" />} /> Parent</>}</Chip>} />
					<PopoverContent align="start" aria-label="Choose parent">
						<SearchChoices label="Parents" options={parentOptions} selected={value.parentIssueKey ? [value.parentIssueKey] : []} onSelect={(id) => { onChange({ parentIssueKey: id }); setParentOpen(false); }} />
						{parent ? <Button size="compact" type="button" variant="ghost" onClick={() => { onChange({ parentIssueKey: undefined }); setParentOpen(false); }}>Remove parent</Button> : null}
					</PopoverContent>
				</Popover>
			</div>
			<div className="contents">
				{selectedTags.map((tag) => <span className="rounded-sm border border-border px-1 text-xs text-text-subtle" key={tag}>{tag}</span>)}
				<Popover open={tagsOpen} onOpenChange={(open) => { setTagsOpen(open); if (!open) setTagQuery(""); }}>
					<PopoverTrigger render={<Chip label="Add tags"><Icon render={<AddIcon label="" size="small" />} /> Tags</Chip>} />
					<PopoverContent align="start" aria-label="Choose tags">
						<input aria-label="Add tag" className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm" onChange={(event) => setTagQuery(event.target.value)} onKeyDown={(event) => {
							if (event.key !== "Enter" || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
							event.preventDefault();
							const query = tagQuery.trim();
							const exact = tags.find((tag) => tag.toLowerCase() === query.toLowerCase());
							const tag = query && !exact ? query : exact ?? tags.find((item) => item.toLowerCase().includes(query.toLowerCase()));
							if (tag) onChange({ tags: toggle(selectedTags, tag) });
							setTagQuery("");
						}} value={tagQuery} />
						{tagQuery.trim() && !tags.some((tag) => tag.toLowerCase() === tagQuery.trim().toLowerCase()) ? <Button size="compact" type="button" variant="ghost" onClick={() => { onChange({ tags: [...selectedTags, tagQuery.trim()] }); setTagQuery(""); }}>Create “{tagQuery.trim()}”</Button> : null}
						<div aria-label="Tags" className="max-h-48 overflow-auto" role="group">{tags.filter((tag) => tag.toLowerCase().includes(tagQuery.trim().toLowerCase())).map((tag) => <label className="flex items-center gap-2 px-2 py-1.5" key={tag}><input checked={selectedTags.includes(tag)} onChange={() => onChange({ tags: toggle(selectedTags, tag) })} type="checkbox" />{tag}</label>)}</div>
					</PopoverContent>
				</Popover>
				<Popover>
					<PopoverTrigger render={<Chip label={subtaskProgress.total ? `${subtaskProgress.completed} of ${subtaskProgress.total} subtasks complete` : "Add subtasks"}>{subtaskProgress.total ? <><ProgressCircle aria-hidden animated={false} segmented segments={subtaskProgress.segments} size="xs" /> {subtaskProgress.completed}/{subtaskProgress.total}</> : <><Icon render={<AddIcon label="" size="small" />} /> Subtasks</>}</Chip>} />
					<PopoverContent align="start" aria-label="Choose subtasks"><SearchChoices label="Subtasks" multiple options={subtaskOptions} selected={selectedSubtasks} onSelect={(id) => onChange({ subtaskKeys: toggle(selectedSubtasks, id) })} /></PopoverContent>
				</Popover>
			</div>
		</div>
		<div className="flex items-center gap-1 pt-1">
			<Popover open={dueOpen} onOpenChange={setDueOpen}><PopoverTrigger render={<Button aria-label={value.dueDate ? `Due date: ${value.dueDate}` : "Set due date"} size={dueLabel ? "compact" : "icon-compact"} type="button" variant="ghost"><Icon render={<CalendarIcon label="" size="small" />} />{dueLabel}</Button>} /><PopoverContent align="start" aria-label="Due date" className="w-auto p-2"><Calendar mode="single" defaultMonth={selectedDate} selected={selectedDate} onSelect={(date) => { onChange({ dueDate: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : undefined }); setDueOpen(false); }} />{value.dueDate ? <Button size="compact" type="button" variant="ghost" onClick={() => { onChange({ dueDate: undefined }); setDueOpen(false); }}>Clear date</Button> : null}</PopoverContent></Popover>
			<PriorityRowField modal={false} value={WORK_ITEM_PRIORITY[priority]} onChange={(next) => onChange({ priority: BOARD_PRIORITY[next] })} renderValue={() => <ButterPriorityIcon priority={priority} />} priorityTrigger={<Button aria-label={`Priority: ${WORK_ITEM_PRIORITY[priority]}`} size="icon-compact" type="button" variant="ghost" />} />
			<Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
				<PopoverTrigger render={<Button aria-label={value.assignee ? `Assignee: ${value.assignee.name}` : "Set assignee"} size="icon-compact" type="button" variant="ghost">{value.assignee ? <Avatar label={value.assignee.name} size="xs">{value.assignee.avatarSrc ? <AvatarImage alt="" src={value.assignee.avatarSrc} /> : null}<AvatarFallback>{value.assignee.name.slice(0, 1)}</AvatarFallback></Avatar> : <Icon render={<PersonIcon label="" size="small" />} />}</Button>} />
				<PopoverContent align="start" aria-label="Choose assignee" className={METADATA_PICKER_POPOVER_CLASS} positionerClassName={METADATA_PICKER_POSITIONER_CLASS} sideOffset={METADATA_PICKER_SIDE_OFFSET} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}>
					<MetadataSearchPicker
						className={PERSON_PICKER_DROPDOWN_CLASS}
						emptyLabel="No people found"
						items={[
							{ id: "", label: "Unassigned", icon: <PersonIcon label="" size="small" />, leadingVisual: <AvatarUnassigned label="" size="sm" /> },
							...assignees.map((person) => ({ id: person.id, label: person.name, icon: <PersonIcon label="" size="small" />, visual: person.avatarSrc ? { kind: "avatar" as const, shape: "circle" as const, src: person.avatarSrc } : undefined })),
						]}
						onEscape={() => setAssigneeOpen(false)}
						onSelect={(person) => { onChange({ assignee: assignees.find((assignee) => assignee.id === person.id) }); setAssigneeOpen(false); }}
						placeholder="Search people"
					/>
				</PopoverContent>
			</Popover>
			<div className="ml-auto">{saveAction}</div>
		</div>
	</>;
}
