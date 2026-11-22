"use client";

import { useMemo, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import PersonIcon from "@atlaskit/icon/core/person";
import type { JiraKanbanAssigneeData, JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { ArtifactParentField } from "@/components/blocks/artifact-pane/artifact-parent-field";
import { ArtifactLabelsField } from "@/components/blocks/artifact-pane/artifact-labels-field";
import { getButterSubtaskProgress } from "@/components/blocks/jira-issue/project-butter-model";
import { PriorityRowField, PriorityValueIcon, type PriorityValue } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { MetadataSearchPicker } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { METADATA_PICKER_POPOVER_CLASS, METADATA_PICKER_POSITIONER_CLASS, METADATA_PICKER_SIDE_OFFSET, PERSON_PICKER_DROPDOWN_CLASS } from "@/components/blocks/jira-work-item/team-eu26/components/metadata-picker-styles";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage, AvatarUnassigned } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { JiraInlineCreateDraft } from "../types";
import { JiraInlineCreateSubtasks } from "./jira-inline-create-subtasks";

type Metadata = Omit<JiraInlineCreateDraft, "summary" | "issueType">;

const chipClass = "h-6 gap-1 border-border px-1.5 text-xs font-normal";
const BOARD_PRIORITY: Readonly<Record<PriorityValue, JiraKanbanCardData["priority"]>> = { Highest: "critical", High: "major", Medium: "medium", Low: "minor", Lowest: "trivial" };
const WORK_ITEM_PRIORITY: Readonly<Record<JiraKanbanCardData["priority"], PriorityValue>> = { critical: "Highest", major: "High", medium: "Medium", minor: "Low", trivial: "Lowest" };

function Chip({ label, children, ...props }: Readonly<React.ComponentProps<typeof Button> & { label: string }>) {
	return <Button {...props} aria-label={label} className={chipClass} size="compact" type="button" variant="outline">{children}</Button>;
}

export function JiraInlineCreateFields({ assignees: availableAssignees = [], columns, value, onChange, saveAction }: Readonly<{
	assignees?: readonly JiraKanbanAssigneeData[];
	columns: readonly JiraKanbanColumnData[];
	value: Metadata;
	onChange: (patch: Metadata) => void;
	saveAction: React.ReactNode;
}>) {
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
	const parentOptions = cards.filter((card) => card.issueType !== "subtask" && canBeParent(card)).map((card) => ({ key: card.code, summary: card.title }));
	const ancestors = new Set<string>();
	let ancestor = value.parentIssueKey;
	while (ancestor && !ancestors.has(ancestor)) {
		ancestors.add(ancestor);
		ancestor = cards.find((card) => card.code === ancestor)?.parentIssueKey;
	}
	const subtaskOptions = columns.flatMap((column) => column.cards.filter((card) => (card.issueType === "subtask" || card.parentIssueKey) && !ancestors.has(card.code)).map((card) => ({
		issueKey: card.code,
		summary: card.title,
		status: card.status ?? column.title,
		priority: card.priority,
		assigneeAvatarSrc: card.avatarSrc ?? card.assignee?.avatarSrc,
		assigneeAvatarLabel: card.assignee?.name,
		assigneeUnassignedKind: card.avatarUnassignedKind,
	})));
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
				<ArtifactParentField
					fieldName="epic"
					onChange={(parentIssueKey) => onChange({ parentIssueKey })}
					onClear={() => onChange({ parentIssueKey: undefined })}
					options={parentOptions}
					trigger={<Chip label={parent ? `Epic, ${parent.code} ${parent.title}` : "Add epic"}>{parent ? <span className="max-w-48 truncate">{parent.title}</span> : <><Icon render={<AddIcon label="" size="small" />} /> Epic</>}</Chip>}
					value={value.parentIssueKey ?? null}
				/>
			</div>
			<div className="contents">
				<ArtifactLabelsField
					hideSelected
					onChange={(tags) => onChange({ tags })}
					options={tags}
					trigger={<Chip label="Add labels"><Icon render={<AddIcon label="" size="small" />} /> Labels</Chip>}
					value={selectedTags}
				/>
				<JiraInlineCreateSubtasks
					options={subtaskOptions}
					selected={selectedSubtasks}
					onSelect={(id) => onChange({ subtaskKeys: toggle(selectedSubtasks, id) })}
					trigger={<Chip label={subtaskProgress.total ? `${subtaskProgress.completed} of ${subtaskProgress.total} subtasks complete` : "Add subtasks"}>{subtaskProgress.total ? <><ProgressCircle aria-hidden animated={false} segmented segments={subtaskProgress.segments} size="xs" /> {subtaskProgress.completed}/{subtaskProgress.total}</> : <><Icon render={<AddIcon label="" size="small" />} /> Subtasks</>}</Chip>}
				/>
			</div>
		</div>
		<div className="flex items-center gap-1 pt-1">
			<Popover open={dueOpen} onOpenChange={setDueOpen}><PopoverTrigger render={<Button aria-label={value.dueDate ? `Due date: ${value.dueDate}` : "Set due date"} size={dueLabel ? "compact" : "icon-compact"} type="button" variant="ghost"><Icon render={<CalendarIcon label="" size="small" />} />{dueLabel}</Button>} /><PopoverContent align="start" aria-label="Due date" className="w-auto p-2"><Calendar mode="single" defaultMonth={selectedDate} selected={selectedDate} onSelect={(date) => { onChange({ dueDate: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : undefined }); setDueOpen(false); }} />{value.dueDate ? <Button size="compact" type="button" variant="ghost" onClick={() => { onChange({ dueDate: undefined }); setDueOpen(false); }}>Clear date</Button> : null}</PopoverContent></Popover>
			<PriorityRowField modal={false} previewTrigger value={WORK_ITEM_PRIORITY[priority]} onChange={(next) => onChange({ priority: BOARD_PRIORITY[next] })} renderValue={(previewPriority, { open }) => <PriorityValueIcon colored={open} value={previewPriority} />} priorityTrigger={<Button aria-label={`Priority: ${WORK_ITEM_PRIORITY[priority]}`} size="icon-compact" type="button" variant="ghost" />} />
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
