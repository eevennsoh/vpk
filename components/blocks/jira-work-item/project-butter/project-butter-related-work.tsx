"use client";

import AttachmentIcon from "@atlaskit/icon/core/attachment";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import LinkIcon from "@atlaskit/icon/core/link";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";

import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { ProjectButterAttachments } from "@/components/blocks/jira-work-item/project-butter/project-butter-attachments";
import { ProjectButterRelatedItemList } from "@/components/blocks/jira-work-item/project-butter/related-item-list";

export function ProjectButterRelatedWork({ content }: Readonly<{ content: ProjectButterContent }>) {
	function addItem(kind: "children" | "linked", summary: string) {
		content.setRelatedWork((work) => { const nextId = Math.max(100, ...[...work.children, ...work.linked].map((item) => Number(item.key.split("-").at(-1)) || 0)) + 1; return { ...work, [kind]: [...work[kind], { key: `VITA-${nextId}`, summary, status: "To do", priority: "Medium", assignee: "Automatic", ...(kind === "linked" ? { relationship: "Relates to" } : {}) }] }; });
	}
	return (
		<details className="group/related min-w-0" open>
			<summary className="flex w-fit cursor-pointer list-none flex-wrap items-center gap-3 rounded-sm py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
				<span className="font-semibold">Related work</span>
				<span className="text-icon-subtle group-open/related:rotate-90"><ChevronRightIcon label="" size="small" /></span>
				<span aria-label={`${content.attachments.length} attachments`} className="flex items-center gap-1 text-text-subtlest group-open/related:hidden"><AttachmentIcon label="" size="small" />{content.attachments.length}</span>
				<span aria-label={`${content.relatedWork.linked.length} linked work items`} className="flex items-center gap-1 text-text-subtlest group-open/related:hidden"><LinkIcon label="" size="small" />{content.relatedWork.linked.length}</span>
				<span aria-label={`${content.relatedWork.children.length} subtasks`} className="flex items-center gap-1 text-text-subtlest group-open/related:hidden"><SubtasksIcon label="" size="small" />{content.relatedWork.children.length}</span>
			</summary>
			<div className="space-y-4 pt-3">
				<ProjectButterAttachments content={content} />
				<ProjectButterRelatedItemList items={content.relatedWork.children} label="Child work items" onAdd={(summary) => addItem("children", summary)} onChange={(children) => content.setRelatedWork((work) => ({ ...work, children }))} />
				<ProjectButterRelatedItemList items={content.relatedWork.linked} label="Linked work" onAdd={(summary) => addItem("linked", summary)} onChange={(linked) => content.setRelatedWork((work) => ({ ...work, linked }))} />
			</div>
		</details>
	);
}
