"use client";

import { useRef } from "react";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { ProjectButterAttachments } from "@/components/blocks/jira-work-item/project-butter/project-butter-attachments";
import { ProjectButterRelatedItemList } from "@/components/blocks/jira-work-item/project-butter/related-item-list";
import { useAttachmentRemoval } from "@/components/blocks/jira-work-item/project-butter/use-attachment-removal";
import { RelatedWorkToggles } from "@/components/blocks/jira-work-item/project-butter/related-work-toggles";
import { relatedGroupVisibility, relatedSummaryItems } from "@/components/blocks/jira-work-item/project-butter/related-work-model";
import { useRelatedAddShortcuts } from "@/components/blocks/jira-work-item/project-butter/use-related-add-shortcuts";
import { nextRelatedKey, relatedItemFromRequest, relatedKeyPrefix, type ProjectButterRelatedAddRequest, type ProjectButterRelatedKind, type ProjectButterRelatedListEditor } from "@/components/blocks/jira-work-item/project-butter/related-model";
import type { ProjectButterRelatedScope, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";

export function ProjectButterRelatedWork({ active = false, content, empty = false, openRelatedItem, scope, workItemKey = "VITA-1" }: Readonly<{
	/** The visible work item: enables the Shift+A/C/K add shortcuts. */
	active?: boolean;
	content: ProjectButterContent;
	empty?: boolean;
	/** Host lookup from a related key to an opener (Butter board cards). Unresolved keys render as plain text. */
	openRelatedItem?: RelatedItemOpener;
	/** Host project scope: composer match pool and the open work item's type. */
	scope?: ProjectButterRelatedScope;
	/** The open work item's key: never offered as a match, and the prefix for created keys. */
	workItemKey?: string;
}>) {
	const sectionRef = useRef<HTMLDivElement>(null);
	const counts = { attachments: content.attachments.length, children: content.relatedWork.children.length, linked: content.relatedWork.linked.length };
	const visibility = relatedGroupVisibility({
		counts,
		composerOpen: { attachments: content.attachmentEditor.composerOpen, children: content.relatedEditor.children.composerOpen, linked: content.relatedEditor.linked.composerOpen },
		dismissed: content.relatedDismissed,
		empty,
		parentIsSubtask: scope?.parentType === "Subtask",
	});
	useRelatedAddShortcuts(active, sectionRef, content.openRelatedAdd);
	const removal = useAttachmentRemoval(content, sectionRef);
	function addItem(kind: "children" | "linked", request: ProjectButterRelatedAddRequest) {
		const id = `related-${crypto.randomUUID()}`;
		const taken = new Set([workItemKey, ...content.relatedWork.children.map((item) => item.key), ...content.relatedWork.linked.map((item) => item.key)]);
		const item = relatedItemFromRequest(request, { id, key: nextRelatedKey(relatedKeyPrefix(workItemKey), taken), kind, parentType: scope?.parentType });
		content.setRelatedWork((work) => ({ ...work, [kind]: [item, ...work[kind]] }));
	}
	function updateEditor(kind: "children" | "linked", patch: Partial<ProjectButterRelatedListEditor>) {
		content.setRelatedEditor((editor) => ({ ...editor, [kind]: { ...editor[kind], ...patch } }));
	}
	function dismissGroup(kind: ProjectButterRelatedKind) {
		content.setRelatedDismissed((dismissed) => dismissed.includes(kind) ? dismissed : [...dismissed, kind]);
	}
	const asSectionHeader = true;
	function setOpen(kind: ProjectButterRelatedKind, open: boolean) {
		content.setRelatedGroupsOpen((groups) => ({ ...groups, [kind]: open }));
	}
	// One tree shape whether or not groups show, so the confirm dialog never remounts mid-exit.
	return (
		<>
		{visibility.count === 0 ? null : <div className="flex min-w-0 flex-col gap-3" id="section-linked-content" ref={sectionRef}>
			<RelatedWorkToggles items={relatedSummaryItems(counts, visibility.shown)} onOpenChange={setOpen} open={content.relatedGroupsOpen} />
			{visibility.shown.attachments ? <ProjectButterAttachments asSectionHeader={asSectionHeader} content={content} emptyPreset={empty} emptyState={visibility.allEmpty} onDismissGroup={() => dismissGroup("attachments")} onOpenChange={(open) => setOpen("attachments", open)} onRequestRemove={removal.requestRemove} open={content.relatedGroupsOpen.attachments || visibility.allEmpty} /> : null}
			{visibility.shown.children ? <ProjectButterRelatedItemList asSectionHeader={asSectionHeader} editor={content.relatedEditor.children} emptyState={visibility.allEmpty} items={content.relatedWork.children} kind="children" openItem={openRelatedItem} ownKey={workItemKey} scope={scope} onAdd={(request) => addItem("children", request)} onAddRequest={() => content.openRelatedAdd("children")} onChange={(children) => content.setRelatedWork((work) => ({ ...work, children }))} onDismissGroup={() => dismissGroup("children")} onEditorChange={(patch) => updateEditor("children", patch)} onOpenChange={(open) => setOpen("children", open)} open={content.relatedGroupsOpen.children || visibility.allEmpty} /> : null}
			{visibility.shown.linked ? <ProjectButterRelatedItemList asSectionHeader={asSectionHeader} editor={content.relatedEditor.linked} emptyState={visibility.allEmpty} items={content.relatedWork.linked} kind="linked" openItem={openRelatedItem} ownKey={workItemKey} scope={scope} onAdd={(request) => addItem("linked", request)} onAddRequest={() => content.openRelatedAdd("linked")} onChange={(linked) => content.setRelatedWork((work) => ({ ...work, linked }))} onDismissGroup={() => dismissGroup("linked")} onEditorChange={(patch) => updateEditor("linked", patch)} onOpenChange={(open) => setOpen("linked", open)} open={content.relatedGroupsOpen.linked || visibility.allEmpty} /> : null}
		</div>}
		{removal.dialog}
		</>
	);
}
