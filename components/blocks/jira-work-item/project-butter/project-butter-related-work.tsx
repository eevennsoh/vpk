"use client";

import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { ProjectButterAttachments } from "@/components/blocks/jira-work-item/project-butter/project-butter-attachments";
import { ProjectButterRelatedItemList } from "@/components/blocks/jira-work-item/project-butter/related-item-list";
import type { ProjectButterRelatedAddRequest, ProjectButterRelatedListEditor } from "@/components/blocks/jira-work-item/project-butter/related-model";

export function ProjectButterRelatedWork({ content, empty = false }: Readonly<{ content: ProjectButterContent; empty?: boolean }>) {
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
	return (
		<>
				{!empty || content.attachments.length > 0 || content.attachmentComposerOpen ? <ProjectButterAttachments content={content} /> : null}
				{!empty || content.relatedWork.children.length > 0 || content.relatedEditor.children.composerOpen ? <ProjectButterRelatedItemList editor={content.relatedEditor.children} items={content.relatedWork.children} label="Child work items" onAdd={(request) => addItem("children", request)} onChange={(children) => content.setRelatedWork((work) => ({ ...work, children }))} onEditorChange={(patch) => updateEditor("children", patch)} /> : null}
				{!empty || content.relatedWork.linked.length > 0 || content.relatedEditor.linked.composerOpen ? <ProjectButterRelatedItemList editor={content.relatedEditor.linked} items={content.relatedWork.linked} label="Linked work" onAdd={(request) => addItem("linked", request)} onChange={(linked) => content.setRelatedWork((work) => ({ ...work, linked }))} onEditorChange={(patch) => updateEditor("linked", patch)} /> : null}
		</>
	);
}
