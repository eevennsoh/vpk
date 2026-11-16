"use client";

import { motion } from "motion/react";
import { JiraListTableCell } from "@/components/blocks/jira-list/jira-list-table";
import { IssueTypeGlyph } from "@/components/blocks/jira-list/jira-list-cells";
import type { JiraListIssueType } from "@/components/blocks/jira-list/jira-list-types";
import { RelatedRowActions } from "@/components/blocks/jira-work-item/project-butter/related-row-actions";
import { RelatedAssigneeField, RelatedDueDateField, RelatedEstimateField, RelatedPriorityField, RelatedRelationshipField } from "@/components/blocks/jira-work-item/project-butter/related-row-fields";
import { RelatedStatusField } from "@/components/blocks/jira-work-item/project-butter/related-status-field";
import { RelatedSummaryField } from "@/components/blocks/jira-work-item/project-butter/related-summary-field";
import type { RelatedTableColumn } from "@/components/blocks/jira-work-item/project-butter/related-table-columns";
import type { ProjectButterRelatedFields, ProjectButterRelatedItem, ProjectButterRelatedWorkType, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

const FADE = "related-row-fade group-has-[:focus-visible]/work-row:mask-none group-has-[[aria-expanded=true]]/work-row:mask-none";
const WORK_TYPES = { Epic: "epic", Story: "story", Task: "task", Bug: "bug", Subtask: "subtask" } as const satisfies Record<ProjectButterRelatedWorkType, JiraListIssueType>;

export function ProjectButterRelatedItemRow({ actions, columns, dimmed, draft, editing, faded, fields, item, linked, onChange, onDraftChange, onEdit, onFinish, openItem }: Readonly<{
	actions?: { onClone: () => void; onDelete: () => void };
	columns: readonly RelatedTableColumn[];
	dimmed: boolean;
	draft: string;
	editing: boolean;
	faded: boolean;
	fields: ProjectButterRelatedFields;
	item: ProjectButterRelatedItem;
	linked: boolean;
	onChange: (patch: Partial<ProjectButterRelatedItem>) => void;
	onDraftChange: (summary: string) => void;
	onEdit: () => void;
	onFinish: (save: boolean) => void;
	openItem?: RelatedItemOpener;
}>) {
	const open = openItem?.(item.key);
	function renderCell(column: RelatedTableColumn) {
		switch (column.id) {
			case "relationship":
				return <RelatedRelationshipField label={`Edit relationship for ${item.key}: ${item.relationship ?? "Relates to"}. Edit`} onChange={(relationship) => onChange({ relationship })} value={item.relationship ?? "Relates to"} />;
			case "work":
				return <div className="flex min-w-0 items-center gap-1.5">
					<IssueTypeGlyph issueType={WORK_TYPES[item.workType ?? (linked ? "Story" : "Subtask")]} large />
					{fields.id ? open ? <button className="shrink-0 rounded-sm text-sm text-text-subtlest outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focused" onClick={open} type="button">{item.key}</button> : <span className="shrink-0 text-sm text-text-subtlest">{item.key}</span> : null}
					<RelatedSummaryField draft={draft} editing={editing} faded={false} itemKey={item.key} onDraftChange={onDraftChange} onEdit={onEdit} onFinish={onFinish} summary={item.summary} />
				</div>;
			case "status":
				return <RelatedStatusField itemKey={item.key} onChange={(status) => onChange({ status })} status={item.status} />;
			case "assignee":
				return <RelatedAssigneeField item={item} onChange={(assignee) => onChange({ assignee })} showName={linked} />;
			case "priority":
				return <RelatedPriorityField item={item} onChange={(priority) => onChange({ priority })} />;
			case "labels":
				return <span className="block truncate text-xs text-text-subtle">{item.labels?.join(", ") || "—"}</span>;
			case "dueDate":
				return <RelatedDueDateField item={item} onChange={(dueDate) => onChange({ dueDate })} />;
			case "estimate":
				return <RelatedEstimateField item={item} onChange={(estimate) => onChange({ estimate })} />;
			case "actions":
				return actions && !editing ? <RelatedRowActions itemKey={item.key} onClone={actions.onClone} onDelete={actions.onDelete} /> : null;
		}
	}
	return (
		<motion.tr
			className={cn(
				"group/row group/work-row h-10 border-0 transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered has-[:focus-visible]:bg-bg-neutral-subtle-hovered has-[[aria-expanded=true]]:bg-bg-neutral-subtle-hovered",
				dimmed && "pointer-events-none opacity-(--opacity-disabled)",
				editing && "relative z-10",
			)}
			data-related-id={item.id}
			data-summary-editing={editing || undefined}
			inert={dimmed || undefined}
			layout="position"
			onBlur={(event) => { if (editing && !(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) onFinish(true); }}
			transition={{ duration: motionDuration.medium, ease: motionEase.outPractical }}
		>
			{columns.map((column) => <JiraListTableCell className={cn(faded && !editing && FADE, editing && column.id !== "work" && "opacity-(--opacity-disabled)")} inert={editing && column.id !== "work" || undefined} key={column.id}>{renderCell(column)}</JiraListTableCell>)}
		</motion.tr>
	);
}
