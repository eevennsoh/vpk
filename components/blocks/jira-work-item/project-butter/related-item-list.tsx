"use client";

import { useRef } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { ProjectButterRelatedCreateRow } from "@/components/blocks/jira-work-item/project-butter/related-create-row";
import { ProjectButterRelatedDisplayOptions } from "@/components/blocks/jira-work-item/project-butter/related-display-options";
import { RelatedEmptyState } from "@/components/blocks/jira-work-item/project-butter/related-empty-state";
import { ProjectButterRelatedItemRow } from "@/components/blocks/jira-work-item/project-butter/related-item-row";
import { RelatedListCard } from "@/components/blocks/jira-work-item/project-butter/related-list-card";
import { RelatedWorkGroup } from "@/components/blocks/jira-work-item/project-butter/related-work-group";
import { relatedListWindow } from "@/components/blocks/jira-work-item/project-butter/related-work-model";
import { orderRelatedItems, type ProjectButterRelatedAddRequest, type ProjectButterRelatedItem, type ProjectButterRelatedListEditor } from "@/components/blocks/jira-work-item/project-butter/related-model";

const LIST_GROUPS = {
	children: { label: "Child work items", id: "section-subitems", relatedType: "subitems", add: "Add child work item" },
	linked: { label: "Linked work", id: "section-linked-items", relatedType: "linked", add: "Add linked work" },
} as const;

export function ProjectButterRelatedItemList({ asSectionHeader, editor, emptyState = false, items, kind, onAdd, onAddRequest, onChange, onDismissGroup, onEditorChange }: Readonly<{
	asSectionHeader: boolean;
	editor: ProjectButterRelatedListEditor;
	/** Every related group is empty: render the empty state row instead of an empty card. */
	emptyState?: boolean;
	items: readonly ProjectButterRelatedItem[];
	kind: keyof typeof LIST_GROUPS;
	onAdd: (request: ProjectButterRelatedAddRequest) => void;
	/** Shared add path (content.openRelatedAdd). Never toggles the composer closed. */
	onAddRequest: () => void;
	onChange: (items: readonly ProjectButterRelatedItem[]) => void;
	onDismissGroup?: () => void;
	onEditorChange: (patch: Partial<ProjectButterRelatedListEditor>) => void;
}>) {
	const addTrigger = useRef<HTMLButtonElement>(null);
	const { add, id, label, relatedType } = LIST_GROUPS[kind];
	const linked = kind === "linked";
	const ordered = orderRelatedItems(items, editor);
	const done = items.filter((item) => item.status === "Done").length;
	const inProgress = items.filter((item) => item.status === "In progress").length;
	const { shown } = relatedListWindow(ordered, { expanded: editor.expanded, composerOpen: editor.composerOpen });
	const editingId = shown.some((item) => item.id === editor.editingId) ? editor.editingId : null;
	const progress = !linked && items.length > 0;
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
	function remove(item: ProjectButterRelatedItem) {
		const drafts = { ...editor.summaryDrafts };
		delete drafts[item.id];
		onEditorChange({ summaryDrafts: drafts, ...(editor.editingId === item.id ? { editingId: null } : {}) });
		onChange(items.filter((candidate) => candidate.id !== item.id));
	}
	function dismissComposer() {
		onEditorChange({ composerOpen: false });
		addTrigger.current?.focus();
	}
	return (
		<RelatedWorkGroup
			asSectionHeader={asSectionHeader}
			extra={<><Button aria-keyshortcuts={linked ? "Shift+K" : "Shift+C"} aria-label={add} data-related-add onClick={onAddRequest} ref={addTrigger} size="icon-compact" type="button" variant="ghost"><AddIcon label="" size="small" /></Button><ProjectButterRelatedDisplayOptions editor={editor} label={label} onChange={onEditorChange} /></>}
			headingGap={linked ? "default" : "wide"}
			id={id}
			indicator={progress ? (open) => <span className={cn("flex items-center gap-1 font-normal text-text-subtle", open ? "text-xs" : "text-sm")}><ProgressCircle label={`${done} of ${items.length} child work items done`} segmentGap="none" segmented segments={[{ status: "pending", weight: items.length - done - inProgress }, { status: "in-progress", weight: inProgress }, { status: "passed", weight: done }]} showCompleteIcon={false} size="xs" value={done / items.length * 100} /><span aria-hidden>{done}/{items.length}</span></span> : undefined}
			indicatorLabel={progress ? `${done} of ${items.length} done, ${inProgress} in progress, ${items.length - done - inProgress} to do` : undefined}
			label={label}
			relatedType={relatedType}
			revealKey={editor.createSignal}
		>
			{emptyState && items.length === 0 && !editor.composerOpen ? <RelatedEmptyState kind={kind} onAdd={onAddRequest} onDismiss={onDismissGroup} /> : (
				<RelatedListCard
					composer={editor.composerOpen ? <ProjectButterRelatedCreateRow dimmed={editingId !== null} editor={editor} items={items} linked={linked} onAdd={(request) => { onAdd(request); addTrigger.current?.focus(); }} onChange={onEditorChange} onDismiss={dismissComposer} /> : null}
					empty={<li className="px-4 py-3 text-sm text-text-subtle">{items.length ? "No matching work items." : `No ${label.toLowerCase()}.`}</li>}
					expanded={editor.expanded}
					items={ordered}
					label={label}
					onExpandedChange={(expanded) => onEditorChange({ expanded })}
					renderItem={(item, { faded }) => <ProjectButterRelatedItemRow dimmed={editingId !== null && editingId !== item.id} draft={editor.summaryDrafts[item.id] ?? item.summary} editing={editingId === item.id} faded={faded} fields={editor.visibleFields} item={item} key={item.id} onChange={(patch) => update(item, patch)} onDraftChange={(summary) => onEditorChange({ summaryDrafts: { ...editor.summaryDrafts, [item.id]: summary } })} onEdit={() => onEditorChange({ editingId: item.id, summaryDrafts: { ...editor.summaryDrafts, [item.id]: editor.summaryDrafts[item.id] ?? item.summary } })} onFinish={(save) => finish(item, save)} onRemove={() => remove(item)} />}
					toggleDisabled={editingId !== null}
				/>
			)}
		</RelatedWorkGroup>
	);
}
