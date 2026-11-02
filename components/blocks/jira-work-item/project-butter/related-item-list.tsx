"use client";

import { AnimatePresence } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import AddIcon from "@atlaskit/icon/core/add";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { ProjectButterExpandControl } from "@/components/blocks/jira-work-item/project-butter/project-butter-expand-control";
import { ProjectButterRelatedCreateRow } from "@/components/blocks/jira-work-item/project-butter/related-create-row";
import { ProjectButterRelatedDisplayOptions } from "@/components/blocks/jira-work-item/project-butter/related-display-options";
import { ProjectButterRelatedItemRow } from "@/components/blocks/jira-work-item/project-butter/related-item-row";
import { orderRelatedItems, type ProjectButterRelatedAddRequest, type ProjectButterRelatedItem, type ProjectButterRelatedListEditor } from "@/components/blocks/jira-work-item/project-butter/related-model";

export function ProjectButterRelatedItemList({ editor, items, label, onAdd, onChange, onEditorChange }: Readonly<{
	editor: ProjectButterRelatedListEditor;
	items: readonly ProjectButterRelatedItem[];
	label: string;
	onAdd: (request: ProjectButterRelatedAddRequest) => void;
	onChange: (items: readonly ProjectButterRelatedItem[]) => void;
	onEditorChange: (patch: Partial<ProjectButterRelatedListEditor>) => void;
}>) {
	const [open, setOpen] = useState(true);
	const addTrigger = useRef<HTMLButtonElement>(null);
	const linked = label === "Linked work";
	const ordered = orderRelatedItems(items, editor);
	const shown = editor.expanded ? ordered : ordered.slice(0, editor.composerOpen ? 4 : 5);
	const remaining = ordered.length - shown.length;
	const done = items.filter((item) => item.status === "Done").length;
	const inProgress = items.filter((item) => item.status === "In progress" || item.status === "In review").length;
	const editingId = shown.some((item) => item.id === editor.editingId) ? editor.editingId : null;
	function update(item: ProjectButterRelatedItem, patch: Partial<ProjectButterRelatedItem>) {
		onChange(items.map((candidate) => candidate.id === item.id ? { ...candidate, ...patch } : candidate));
	}
	function finish(item: ProjectButterRelatedItem, save: boolean) {
		const draft = editor.summaryDrafts[item.id] ?? item.summary;
		if (save && !draft.trim()) return;
		if (save) update(item, { summary: draft.trim() });
		const drafts = { ...editor.summaryDrafts };
		delete drafts[item.id];
		onEditorChange({ editingId: null, summaryDrafts: drafts });
	}
	function dismissComposer() {
		onEditorChange({ composerOpen: false });
		addTrigger.current?.focus();
	}
	return (
		<Collapsible onOpenChange={setOpen} open={open}>
		<section aria-label={label} className="min-w-0">
			<div className="flex items-center justify-between gap-2"><h3><CollapsibleTrigger aria-label={!linked && items.length ? `${label}, ${done} of ${items.length} done` : label} className="group flex items-center gap-2 rounded-sm text-left text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}{!linked && items.length ? <span className={cn("flex items-center gap-1 font-normal text-text-subtle", open ? "text-xs" : "text-sm")}><ProgressCircle label={`${done} of ${items.length} child work items done`} segmentGap="none" segmented segments={[{ status: "pending", weight: items.length - done - inProgress }, { status: "in-progress", weight: inProgress }, { status: "passed", weight: done }]} showCompleteIcon={false} size="xs" value={done / items.length * 100} /><span aria-hidden>{done}/{items.length}</span></span> : null}<span className="text-icon-subtle group-data-[panel-open]:rotate-90"><ChevronRightIcon label="" size="small" /></span></CollapsibleTrigger></h3>{open ? <div className="flex items-center gap-1"><Button aria-label={linked ? "Add linked work" : "Add child work item"} data-related-add onClick={() => { onEditorChange({ composerOpen: true, editingId: null }); addTrigger.current?.closest("section")?.querySelector<HTMLInputElement>("[role=combobox]")?.focus(); }} ref={addTrigger} size="icon-compact" type="button" variant="ghost"><AddIcon label="" size="small" /></Button><ProjectButterRelatedDisplayOptions editor={editor} label={label} onChange={onEditorChange} /></div> : null}</div>
			<CollapsibleContent className="pt-2.5" hiddenUntilFound={false} keepMounted>
			<div className="relative rounded-lg border border-border py-1.5"><ul aria-label={label}>
				<AnimatePresence initial={false}>{editor.composerOpen ? <ProjectButterRelatedCreateRow dimmed={editingId !== null} editor={editor} items={items} key="create" linked={linked} onAdd={(request) => { onAdd(request); addTrigger.current?.focus(); }} onChange={onEditorChange} onDismiss={dismissComposer} /> : null}</AnimatePresence>
				{shown.map((item, index) => <ProjectButterRelatedItemRow dimmed={editingId !== null && editingId !== item.id} draft={editor.summaryDrafts[item.id] ?? item.summary} editing={editingId === item.id} faded={remaining > 0 && index === shown.length - 1} fields={editor.visibleFields} item={item} key={item.id} onChange={(patch) => update(item, patch)} onDraftChange={(summary) => onEditorChange({ summaryDrafts: { ...editor.summaryDrafts, [item.id]: summary } })} onEdit={() => onEditorChange({ editingId: item.id, summaryDrafts: { ...editor.summaryDrafts, [item.id]: editor.summaryDrafts[item.id] ?? item.summary } })} onFinish={(save) => finish(item, save)} onRemove={() => {
					const drafts = { ...editor.summaryDrafts };
					delete drafts[item.id];
					onEditorChange({ summaryDrafts: drafts, ...(editor.editingId === item.id ? { editingId: null } : {}) });
					onChange(items.filter((candidate) => candidate.id !== item.id));
				}} />)}
				{ordered.length === 0 && !editor.composerOpen ? <li className="px-4 py-3 text-sm text-text-subtle">{items.length ? "No matching work items." : `No ${label.toLowerCase()}.`}</li> : null}
			</ul>
				{remaining > 0 || editor.expanded && ordered.length > 5 ? <div className={cn(editingId !== null && "opacity-(--opacity-disabled)")} inert={editingId !== null || undefined}><ProjectButterExpandControl ariaLabel={editor.expanded ? `Show less ${label.toLowerCase()}` : `Show ${remaining} more ${label.toLowerCase()}`} expanded={editor.expanded} label={editor.expanded ? "Show less" : `Show ${remaining} more`} onClick={() => onEditorChange({ expanded: !editor.expanded })} /></div> : null}
			</div>
			</CollapsibleContent>
		</section>
		</Collapsible>
	);
}
