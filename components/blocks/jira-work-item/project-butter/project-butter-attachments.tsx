"use client";

import { useRef, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-actions-menu";
import { attachmentFromChoice, type AttachmentComposerChoice } from "@/components/blocks/jira-work-item/project-butter/attachment-catalog";
import { AttachmentComposer } from "@/components/blocks/jira-work-item/project-butter/attachment-composer";
import { AttachmentConfirmDialog, type AttachmentConfirmTarget } from "@/components/blocks/jira-work-item/project-butter/attachment-confirm-dialog";
import { AttachmentFilterTabs } from "@/components/blocks/jira-work-item/project-butter/attachment-filter-tabs";
import { AttachmentList } from "@/components/blocks/jira-work-item/project-butter/attachment-list";
import { AttachmentManageMenu } from "@/components/blocks/jira-work-item/project-butter/attachment-manage-menu";
import { ProjectButterAttachmentPiles } from "@/components/blocks/jira-work-item/project-butter/attachment-piles";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { attachmentDisplayName, attachmentFilterForType, attachmentType, effectiveAttachmentFilter, filterAttachments, mergeAttachments, sortAttachments, visibleAttachmentFilters, type ProjectButterAttachmentEditor } from "@/components/blocks/jira-work-item/project-butter/attachment-model";
import { RelatedEmptyState } from "@/components/blocks/jira-work-item/project-butter/related-empty-state";
import { RelatedWorkGroup } from "@/components/blocks/jira-work-item/project-butter/related-work-group";
import type { RelatedComposerDismissReason } from "@/components/blocks/jira-work-item/project-butter/related-composer";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

/** Revokes the object URL a dropped image used for its preview. */
function releasePreview(item: ProjectButterAttachment) {
	if (item.previewSrc?.startsWith("blob:")) URL.revokeObjectURL(item.previewSrc);
}

/**
 * Project Butter Attachments group: grid piles by default, a list view with filter tabs, the inline
 * create/search/paste composer, and the reference confirmations. Editor state lives in
 * `content.attachmentEditor` (never audited) so it survives close and reopen.
 */
export function ProjectButterAttachments({ asSectionHeader, content, emptyPreset = false, emptyState = false, onDismissGroup }: Readonly<{
	asSectionHeader: boolean;
	content: ProjectButterContent;
	/** The Empty preset: filter tabs only offer the types present. */
	emptyPreset?: boolean;
	/** Every related group is empty: show the empty state row. */
	emptyState?: boolean;
	onDismissGroup?: () => void;
}>) {
	const editor = content.attachmentEditor;
	const addTrigger = useRef<HTMLButtonElement>(null);
	const [confirm, setConfirm] = useState<AttachmentConfirmTarget | null>(null);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const sorted = sortAttachments(content.attachments);
	const filters = visibleAttachmentFilters(sorted, emptyPreset);
	const filter = effectiveAttachmentFilter(editor.filter, filters);
	// With nothing attached the composer always renders as a list (reference Attachments.jsx).
	const listView = editor.viewMode === "list" || sorted.length === 0;
	const attachedNames = sorted.map(attachmentDisplayName);
	function patch(next: Partial<ProjectButterAttachmentEditor>) {
		content.setAttachmentEditor((current) => ({ ...current, ...next }));
	}
	function commit(choice: AttachmentComposerChoice) {
		const item = attachmentFromChoice(choice, { id: `attachment-${crypto.randomUUID()}`, now: new Date().toISOString() });
		content.setAttachments((items) => mergeAttachments(items, [item]).items);
		// A new row of another type would be invisible under the active filter, so the filter returns to All.
		patch({ composerOpen: false, query: "", ...(filter !== "All" && attachmentFilterForType(attachmentType(item)) !== filter ? { filter: "All" } : {}) });
		addTrigger.current?.focus();
	}
	function dismiss(reason: RelatedComposerDismissReason) {
		patch({ composerOpen: false, query: "" });
		if (reason === "escape") addTrigger.current?.focus();
	}
	function requestRemove(target: AttachmentConfirmTarget) {
		setConfirm(target);
		setConfirmOpen(true);
	}
	function confirmRemove() {
		const target = confirm;
		setConfirmOpen(false);
		if (!target) return;
		const removed = target.kind === "all" ? content.attachments : content.attachments.filter((item) => item.id === target.item.id);
		content.setAttachments((items) => target.kind === "all" ? [] : items.filter((item) => item.id !== target.item.id));
		removed.forEach(releasePreview);
	}
	const composer = editor.composerOpen ? <AttachmentComposer attachedNames={attachedNames} createSignal={editor.createSignal} onCommit={commit} onDismiss={dismiss} onQueryChange={(query) => patch({ query })} query={editor.query} /> : null;
	const onRemove = (item: ProjectButterAttachment) => requestRemove({ kind: "item", item });
	return (
		<RelatedWorkGroup
			asSectionHeader={asSectionHeader}
			extra={<>
				<Tooltip>
					<TooltipTrigger render={<Button aria-keyshortcuts="Shift+A" aria-label="Add attachment" data-related-add onClick={() => content.openRelatedAdd("attachments")} ref={addTrigger} size="icon-compact" type="button" variant="ghost" />}><AddIcon label="" size="small" /></TooltipTrigger>
					<TooltipContent positionerClassName="z-[650]" side="bottom">Add attachment</TooltipContent>
				</Tooltip>
				<AttachmentManageMenu canDownload={sorted.some((item) => item.file)} onDeleteAll={() => requestRemove({ kind: "all" })} onDownloadAll={() => sorted.forEach(downloadAttachment)} onViewModeChange={(viewMode) => patch({ viewMode })} viewMode={editor.viewMode} />
			</>}
			id="section-attachments"
			label="Attachments"
			relatedType="attachments"
			revealKey={editor.createSignal + editor.revealSignal}
			tabs={listView && filters.length > 0 ? <AttachmentFilterTabs filters={filters} onChange={(next) => patch({ filter: next })} value={filter} /> : undefined}
			titleMeta={listView && filter !== "All" ? filter : undefined}
		>
			{emptyState && sorted.length === 0 && !editor.composerOpen ? <RelatedEmptyState kind="attachments" onAdd={() => content.openRelatedAdd("attachments")} onDismiss={onDismissGroup} /> : listView ? (
				sorted.length > 0 || composer ? <AttachmentList composer={composer} expanded={editor.expanded} items={filterAttachments(sorted, filter)} onExpandedChange={(expanded) => patch({ expanded })} onRemove={onRemove} /> : null
			) : (
				<>
					{composer ? <div className="relative mb-3 rounded-lg border border-border py-1.5"><ul aria-label="Add attachment">{composer}</ul></div> : null}
					<ProjectButterAttachmentPiles items={sorted} onRemove={onRemove} />
				</>
			)}
			<AttachmentConfirmDialog onConfirm={confirmRemove} onOpenChange={setConfirmOpen} open={confirmOpen} target={confirm} />
		</RelatedWorkGroup>
	);
}
