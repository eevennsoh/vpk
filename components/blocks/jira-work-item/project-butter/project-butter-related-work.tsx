"use client";

import { useRef } from "react";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { ProjectButterAttachments } from "@/components/blocks/jira-work-item/project-butter/project-butter-attachments";
import { ProjectButterRelatedItemList } from "@/components/blocks/jira-work-item/project-butter/related-item-list";
import { RelatedWorkCollapsedSummary } from "@/components/blocks/jira-work-item/project-butter/related-work-collapsed-summary";
import { relatedGroupVisibility, relatedSummaryItems } from "@/components/blocks/jira-work-item/project-butter/related-work-model";
import { RelatedWorkSection, useRelatedAddShortcuts, useRelatedHeaderReveal } from "@/components/blocks/jira-work-item/project-butter/related-work-section";
import type { ProjectButterRelatedAddRequest, ProjectButterRelatedKind, ProjectButterRelatedListEditor } from "@/components/blocks/jira-work-item/project-butter/related-model";

export function ProjectButterRelatedWork({ active = false, content, empty = false }: Readonly<{
	/** The visible work item: enables the Shift+A/C/K add shortcuts. */
	active?: boolean;
	content: ProjectButterContent;
	empty?: boolean;
}>) {
	const sectionRef = useRef<HTMLElement>(null);
	const counts = { attachments: content.attachments.length, children: content.relatedWork.children.length, linked: content.relatedWork.linked.length };
	const visibility = relatedGroupVisibility({
		counts,
		composerOpen: { attachments: content.attachmentEditor.composerOpen, children: content.relatedEditor.children.composerOpen, linked: content.relatedEditor.linked.composerOpen },
		dismissed: content.relatedDismissed,
		empty,
	});
	const reveal = useRelatedHeaderReveal(visibility.count);
	useRelatedAddShortcuts(active, sectionRef, content.openRelatedAdd);
	function addItem(kind: "children" | "linked", request: ProjectButterRelatedAddRequest) {
		const id = `related-${crypto.randomUUID()}`;
		content.setRelatedWork((work) => {
			const nextId = Math.max(100, ...[...work.children, ...work.linked].map((item) => Number(item.key.split("-").at(-1)) || 0)) + 1;
			const item = request.kind === "existing" ? { ...request.item, id } : { id, key: `VITA-${nextId}`, summary: request.summary, status: "To do" as const, priority: "Medium" as const, assignee: "Unassigned" };
			return { ...work, [kind]: [{ ...item, ...(kind === "linked" ? { relationship: request.relationship ?? "Clones" } : { relationship: undefined }) }, ...work[kind]] };
		});
	}
	function updateEditor(kind: "children" | "linked", patch: Partial<ProjectButterRelatedListEditor>) {
		content.setRelatedEditor((editor) => ({ ...editor, [kind]: { ...editor[kind], ...patch } }));
	}
	function dismissGroup(kind: ProjectButterRelatedKind) {
		content.setRelatedDismissed((dismissed) => dismissed.includes(kind) ? dismissed : [...dismissed, kind]);
	}
	if (visibility.count === 0) return null;
	const asSectionHeader = !reveal.ready;
	return (
		<RelatedWorkSection
			animated={reveal.animated}
			collapsedSummary={<RelatedWorkCollapsedSummary items={relatedSummaryItems(counts, visibility.shown)} />}
			onOpenChange={content.setRelatedSectionOpen}
			open={content.relatedSectionOpen}
			ready={reveal.ready}
			sectionRef={sectionRef}
		>
			{visibility.shown.attachments ? <ProjectButterAttachments asSectionHeader={asSectionHeader} content={content} emptyState={visibility.allEmpty} onDismissGroup={() => dismissGroup("attachments")} /> : null}
			{visibility.shown.children ? <ProjectButterRelatedItemList asSectionHeader={asSectionHeader} editor={content.relatedEditor.children} emptyState={visibility.allEmpty} items={content.relatedWork.children} kind="children" onAdd={(request) => addItem("children", request)} onAddRequest={() => content.openRelatedAdd("children")} onChange={(children) => content.setRelatedWork((work) => ({ ...work, children }))} onDismissGroup={() => dismissGroup("children")} onEditorChange={(patch) => updateEditor("children", patch)} /> : null}
			{visibility.shown.linked ? <ProjectButterRelatedItemList asSectionHeader={asSectionHeader} editor={content.relatedEditor.linked} emptyState={visibility.allEmpty} items={content.relatedWork.linked} kind="linked" onAdd={(request) => addItem("linked", request)} onAddRequest={() => content.openRelatedAdd("linked")} onChange={(linked) => content.setRelatedWork((work) => ({ ...work, linked }))} onDismissGroup={() => dismissGroup("linked")} onEditorChange={(patch) => updateEditor("linked", patch)} /> : null}
		</RelatedWorkSection>
	);
}
