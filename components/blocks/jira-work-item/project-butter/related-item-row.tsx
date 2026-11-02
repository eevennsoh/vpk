"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Lozenge } from "@/components/ui/lozenge";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { statusVariant } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editor-data";
import { RelatedAssigneeField, RelatedDueDateField, RelatedEstimateField, RelatedPriorityField, RelatedRelationshipField } from "@/components/blocks/jira-work-item/project-butter/related-row-fields";
import type { ProjectButterRelatedFields, ProjectButterRelatedItem, ProjectButterRelatedStatus } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: readonly ProjectButterRelatedStatus[] = ["To do", "In progress", "In review", "Done"];

export function ProjectButterRelatedItemRow({ dimmed, draft, editing, faded, fields, item, onChange, onDraftChange, onEdit, onFinish, onRemove }: Readonly<{
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
	onRemove: () => void;
}>) {
	const summaryTrigger = useRef<HTMLButtonElement>(null);
	const restoreFocus = useRef(false);
	useEffect(() => {
		if (!editing && restoreFocus.current) {
			restoreFocus.current = false;
			summaryTrigger.current?.focus();
		}
	}, [editing]);
	function finish(save: boolean) {
		restoreFocus.current = true;
		onFinish(save);
	}
	return (
		<motion.li className={cn("group/work-row flex h-10 min-w-0 items-center gap-1.5 px-4 transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered", dimmed && "pointer-events-none opacity-(--opacity-disabled)", editing && "relative z-10")} data-related-id={item.id} data-summary-editing={editing || undefined} inert={dimmed || undefined} layout="position" onKeyDown={(event) => { if (editing && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(false); } }} transition={{ duration: motionDuration.medium, ease: motionEase.outPractical }}>
			{item.relationship ? <RelatedRelationshipField label={`Edit relationship for ${item.key}: ${item.relationship}`} onChange={(relationship) => onChange({ relationship })} value={item.relationship} /> : null}
			{fields.status ? <DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`Edit status for ${item.key}, ${item.status}`} size="icon-compact" type="button" variant="ghost" />}><span aria-hidden><ProgressCircle animated colorByProgress label="" size="xs" value={item.status === "Done" ? 100 : item.status === "In progress" ? 50 : item.status === "In review" ? 75 : 0} variant="filled" /></span></DropdownMenuTrigger><DropdownMenuContent onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]">{STATUS_OPTIONS.map((status) => <DropdownMenuItem key={status} onSelect={() => onChange({ status })} selected={status === item.status}><Lozenge variant={statusVariant(status)}>{status}</Lozenge></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> : null}
			{fields.id ? <span className={cn("ml-1 shrink-0 text-sm text-text-subtle", faded && !editing && "opacity-50")}>{item.key}</span> : null}
			<div className="flex min-w-0 flex-1 items-center gap-2">
				{editing ? <><input aria-label={`Edit summary for ${item.key}`} autoFocus className="min-w-0 flex-1 rounded-sm bg-transparent py-1 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring" onChange={(event) => onDraftChange(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Escape" || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); if (event.key === "Escape" || draft.trim()) finish(event.key === "Enter"); } }} value={draft} /><div className="flex shrink-0 items-center gap-1"><Button aria-label={`Save summary for ${item.key}`} disabled={!draft.trim()} onClick={() => finish(true)} size="icon-compact" type="button" variant="secondary"><CheckMarkIcon label="" size="small" /></Button><Button aria-label={`Cancel summary for ${item.key}`} onClick={() => finish(false)} size="icon-compact" type="button" variant="secondary"><CrossIcon label="" size="small" /></Button></div></> : <button aria-label={`Edit summary for ${item.key}`} className={cn("min-w-0 flex-1 cursor-text truncate rounded-sm py-1 text-left text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring", faded && "opacity-50 focus:opacity-100")} onClick={onEdit} ref={summaryTrigger} type="button">{item.summary}</button>}
			</div>
			{editing ? null : <div className="flex shrink-0 items-center gap-2"><span className="opacity-0 group-hover/work-row:opacity-100 group-focus-within/work-row:opacity-100 has-[[aria-expanded=true]]:opacity-100"><DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`More actions for ${item.key}`} size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]"><DropdownMenuItem onSelect={onRemove}>Remove from work item</DropdownMenuItem></DropdownMenuContent></DropdownMenu></span>{fields.labels && item.labels?.length ? <span className={cn("max-w-24 truncate text-xs text-text-subtle", faded && "opacity-50")}>{item.labels.join(", ")}</span> : null}{fields.dueDate ? <RelatedDueDateField item={item} onChange={(dueDate) => onChange({ dueDate })} /> : null}{fields.estimate ? <RelatedEstimateField item={item} onChange={(estimate) => onChange({ estimate })} /> : null}{fields.priority ? <RelatedPriorityField item={item} onChange={(priority) => onChange({ priority })} /> : null}{fields.assignee ? <RelatedAssigneeField item={item} onChange={(assignee) => onChange({ assignee })} /> : null}</div>}
		</motion.li>
	);
}
