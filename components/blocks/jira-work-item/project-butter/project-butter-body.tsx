"use client";

import { useRef, type ReactNode } from "react";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { AttachmentDropZone } from "@/components/blocks/jira-work-item/project-butter/attachment-drop-overlay";
import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
import { ProjectButterCommentBar } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-bar";
import { ProjectButterDescription } from "@/components/blocks/jira-work-item/project-butter/project-butter-description";
import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
import type { RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

export function ProjectButterBody({ active, sidePanel, content, details, empty, onOpenSession, openRelatedItem, sessions, workItemKey }: Readonly<{
	active: boolean;
	sidePanel: boolean;
	content: ProjectButterContent;
	details?: ReactNode;
	empty: boolean;
	onOpenSession: (sessionId: string) => void;
	openRelatedItem?: RelatedItemOpener;
	sessions: readonly ProjectButterSessionItem[];
	workItemKey?: string;
}>) {
	const columnRef = useRef<HTMLDivElement>(null);
	return (
		<div className="relative flex min-w-0 flex-col gap-6" ref={columnRef}>
			<AttachmentDropZone content={content} targetRef={columnRef} />
			<ProjectButterDescription content={content} empty={empty} />
			{details}
			<ProjectButterRelatedWork active={active} content={content} empty={empty} openRelatedItem={openRelatedItem} workItemKey={workItemKey} />
			<ProjectButterActivity content={content} empty={empty} onOpenSession={onOpenSession} sessions={sessions} sidePanel={sidePanel} />
			<ProjectButterCommentBar active={active} content={content} empty={empty} sidePanel={sidePanel} />
		</div>
	);
}
