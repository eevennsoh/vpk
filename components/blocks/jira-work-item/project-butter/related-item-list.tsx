"use client";

import { useRef } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import { Button } from "@/components/ui/button";
import { ProjectButterRelatedCreateRow } from "@/components/blocks/jira-work-item/project-butter/related-create-row";
import { ProjectButterRelatedDisplayOptions } from "@/components/blocks/jira-work-item/project-butter/related-display-options";
import { RelatedEmptyState } from "@/components/blocks/jira-work-item/project-butter/related-empty-state";
import { ProjectButterRelatedItemRow } from "@/components/blocks/jira-work-item/project-butter/related-item-row";
import { RelatedListCard } from "@/components/blocks/jira-work-item/project-butter/related-list-card";
import { RelatedProgress } from "@/components/blocks/jira-work-item/project-butter/related-progress";
import { RelatedTooltip } from "@/components/blocks/jira-work-item/project-butter/related-tooltip";
import { RelatedWorkGroup } from "@/components/blocks/jira-work-item/project-butter/related-work-group";
import { relatedListWindow } from "@/components/blocks/jira-work-item/project-butter/related-work-model";
import { nextRelatedKey, normalizeRelatedSummary, orderRelatedItems, relatedKeyPrefix, relatedProgressLabel, relatedStatusCounts, type ProjectButterRelatedAddRequest, type ProjectButterRelatedItem, type ProjectButterRelatedListEditor, type ProjectButterRelatedWorkType, type RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";

const LIST_GROUPS = {
	children: { label: "Child work items", id: "section-subitems", relatedType: "subitems", add: "Add child work item", menu: "Child work item display options", shortcut: "Shift+C" },
	linked: { label: "Linked work", id: "section-linked-items", relatedType: "linked", add: "Add linked work", menu: "Linked work display options", shortcut: "Shift+K" },
} as const;

export function ProjectButterRelatedItemList({ asSectionHeader, editor, emptyState = false, items, kind, onAdd, onAddRequest, onChange, onDismissGroup, onEditorChange, openItem, ownKey, parentType }: Readonly<{
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
	/** Opens a related key in the host when it can be resolved; keys render as plain text otherwise. */
	openItem?: RelatedItemOpener;
	/** The open work item's key: excluded from matches and the prefix for created and cloned keys. */
	ownKey: string;
	parentType?: ProjectButterRelatedWorkType;
}>) {
	const addTrigger = useRef<HTMLButtonElement>(null);
	const { add, id, label, menu, relatedType, shortcut } = LIST_GROUPS[kind];
	const linked = kind === "linked";
	const ordered = orderRelatedItems(items, editor);
	const counts = relatedStatusCounts(items);
	const { shown } = relatedListWindow(ordered, { expanded: editor.expanded, composerOpen: editor.composerOpen });
	const editingId = shown.some((item) => item.id === editor.editingId) ? editor.editingId : null;
	const progressLabel = linked ? undefined : relatedProgressLabel(counts);
	function update(item: ProjectButterRelatedItem, patch: Partial<ProjectButterRelatedItem>) {
		onChange(items.map((candidate) => candidate.id === item.id ? { ...candidate, ...patch } : candidate));
	}
	function withoutDraft(item: ProjectButterRelatedItem) {
		const drafts = { ...editor.summaryDrafts };
		delete drafts[item.id];
		return drafts;
	}
	function finish(item: ProjectButterRelatedItem, save: boolean) {
		const summary = normalizeRelatedSummary(editor.summaryDrafts[item.id] ?? item.summary);
		// An empty summary reverts rather than saving.
		if (save && summary && summary !== item.summary) update(item, { summary });
		onEditorChange({ editingId: null, summaryDrafts: withoutDraft(item) });
	}
	function remove(item: ProjectButterRelatedItem) {
		onEditorChange({ summaryDrafts: withoutDraft(item), ...(editor.editingId === item.id ? { editingId: null } : {}) });
		onChange(items.filter((candidate) => candidate.id !== item.id));
	}
	function clone(item: ProjectButterRelatedItem) {
		const key = nextRelatedKey(relatedKeyPrefix(ownKey), new Set([ownKey, ...items.map((candidate) => candidate.key)]));
		const index = items.findIndex((candidate) => candidate.id === item.id);
		const copy = { ...item, id: `related-${crypto.randomUUID()}`, key };
		onChange([...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
	}
	return (
		<RelatedWorkGroup
			asSectionHeader={asSectionHeader}
			extra={<>
				<RelatedTooltip label={add}><Button aria-keyshortcuts={shortcut} aria-label={add} data-related-add onClick={onAddRequest} ref={addTrigger} size="icon-compact" type="button" variant="ghost"><AddIcon label="" size="small" /></Button></RelatedTooltip>
				<ProjectButterRelatedDisplayOptions editor={editor} menuLabel={menu} onChange={onEditorChange} />
			</>}
			headingGap={linked ? "default" : "wide"}
			id={id}
			indicator={progressLabel ? <RelatedProgress counts={counts} /> : undefined}
			indicatorLabel={progressLabel}
			label={label}
			relatedType={relatedType}
			revealKey={editor.createSignal}
		>
			{emptyState && items.length === 0 && !editor.composerOpen ? <RelatedEmptyState kind={kind} onAdd={onAddRequest} onDismiss={onDismissGroup} /> : (
				<RelatedListCard
					composer={editor.composerOpen ? <ProjectButterRelatedCreateRow dimmed={editingId !== null} editor={editor} items={items} linked={linked} onAdd={(request) => { onAdd(request); addTrigger.current?.focus(); }} onChange={onEditorChange} onDismiss={(reason) => { if (reason === "escape") addTrigger.current?.focus(); }} ownKey={ownKey} parentType={parentType} /> : null}
					empty={<li className="px-4 py-3 text-sm text-text-subtle">{items.length ? "No matching work items." : `No ${label.toLowerCase()}.`}</li>}
					expanded={editor.expanded}
					items={ordered}
					label={label}
					onExpandedChange={(expanded) => onEditorChange({ expanded })}
					renderItem={(item, { faded }) => (
						<ProjectButterRelatedItemRow
							actions={linked ? undefined : { onClone: () => clone(item), onDelete: () => remove(item) }}
							dimmed={editingId !== null && editingId !== item.id}
							draft={editor.summaryDrafts[item.id] ?? item.summary}
							editing={editingId === item.id}
							faded={faded}
							fields={editor.visibleFields}
							item={item}
							key={item.id}
							onChange={(patch) => update(item, patch)}
							onDraftChange={(summary) => onEditorChange({ summaryDrafts: { ...editor.summaryDrafts, [item.id]: summary } })}
							onEdit={() => onEditorChange({ editingId: item.id, summaryDrafts: { ...editor.summaryDrafts, [item.id]: editor.summaryDrafts[item.id] ?? item.summary } })}
							onFinish={(save) => finish(item, save)}
							openItem={openItem}
						/>
					)}
					toggleDisabled={editingId !== null}
				/>
			)}
		</RelatedWorkGroup>
	);
}
