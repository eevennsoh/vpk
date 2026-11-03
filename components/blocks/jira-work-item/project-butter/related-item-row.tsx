"use client";

import { motion } from "motion/react";
import { RelatedRowActions } from "@/components/blocks/jira-work-item/project-butter/related-row-actions";
import { RelatedAssigneeField, RelatedDueDateField, RelatedEstimateField, RelatedPriorityField, RelatedRelationshipField } from "@/components/blocks/jira-work-item/project-butter/related-row-fields";
import { RelatedStatusField } from "@/components/blocks/jira-work-item/project-butter/related-status-field";
import { RelatedSummaryField } from "@/components/blocks/jira-work-item/project-butter/related-summary-field";
import type { ProjectButterRelatedFields, ProjectButterRelatedItem, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

const FADE = "related-row-fade group-has-[:focus-visible]/work-row:mask-none group-has-[[aria-expanded=true]]/work-row:mask-none";

export function ProjectButterRelatedItemRow({ actions, dimmed, draft, editing, faded, fields, item, onChange, onDraftChange, onEdit, onFinish, openItem }: Readonly<{
	/** Child rows get Change parent / Clone / Move / Archive / Delete; linked rows have no menu. */
	actions?: { onClone: () => void; onDelete: () => void };
	dimmed: boolean;
	draft: string;
	editing: boolean;
	faded: boolean;
	fields: ProjectButterRelatedFields;
	item: ProjectButterRelatedItem;
	onChange: (patch: Partial<ProjectButterRelatedItem>) => void;
	onDraftChange: (summary: string) => void;
	onEdit: () => void;
	onFinish: (save: boolean) => void;
	openItem?: RelatedItemOpener;
}>) {
	const open = openItem?.(item.key);
	const keyClass = cn("ml-1 shrink-0 whitespace-nowrap text-sm text-text-subtlest", faded && !editing && FADE);
	return (
		<motion.li
			className={cn(
				"group/work-row flex h-10 min-w-0 items-center gap-1.5 px-4 transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered has-[:focus-visible]:bg-bg-neutral-subtle-hovered has-[[aria-expanded=true]]:bg-bg-neutral-subtle-hovered",
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
			{item.relationship ? <span className={cn("flex shrink-0", faded && !editing && FADE)}><RelatedRelationshipField label={`Edit relationship for ${item.key}: ${item.relationship}. Edit`} onChange={(relationship) => onChange({ relationship })} value={item.relationship} /></span> : null}
			{fields.status ? <RelatedStatusField itemKey={item.key} onChange={(status) => onChange({ status })} status={item.status} /> : null}
			{fields.id ? open ? (
				<button className={cn(keyClass, "rounded-sm outline-none hover:text-text-subtle hover:underline focus-visible:ring-2 focus-visible:ring-border-focused")} onClick={open} type="button">{item.key}</button>
			) : <span className={keyClass}>{item.key}</span> : null}
			<RelatedSummaryField draft={draft} editing={editing} faded={faded} itemKey={item.key} onDraftChange={onDraftChange} onEdit={onEdit} onFinish={onFinish} summary={item.summary} />
			{editing ? null : (
				<div className="flex shrink-0 items-center gap-3 pr-1">
					{fields.labels && item.labels?.length ? <span className={cn("max-w-24 truncate text-xs text-text-subtle", faded && FADE)}>{item.labels.join(", ")}</span> : null}
					{fields.dueDate ? <span className={cn("flex", faded && FADE)}><RelatedDueDateField item={item} onChange={(dueDate) => onChange({ dueDate })} /></span> : null}
					{fields.estimate ? <RelatedEstimateField item={item} onChange={(estimate) => onChange({ estimate })} /> : null}
					{fields.priority ? <RelatedPriorityField item={item} onChange={(priority) => onChange({ priority })} /> : null}
					{fields.assignee ? <RelatedAssigneeField item={item} onChange={(assignee) => onChange({ assignee })} /> : null}
					{actions ? <RelatedRowActions itemKey={item.key} onClone={actions.onClone} onDelete={actions.onDelete} /> : null}
				</div>
			)}
		</motion.li>
	);
}
