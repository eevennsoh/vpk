"use client";

import type { ReactNode } from "react";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
import { ProjectButterCommentBar } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-bar";
import { ProjectButterDescription } from "@/components/blocks/jira-work-item/project-butter/project-butter-description";
import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

export function ProjectButterBody({ active, sidePanel, content, details, empty, onOpenSession, sessions }: Readonly<{
	active: boolean;
	sidePanel: boolean;
	content: ProjectButterContent;
	details?: ReactNode;
	empty: boolean;
	onOpenSession: (sessionId: string) => void;
	sessions: readonly ProjectButterSessionItem[];
}>) {
	return (
		<div className="flex min-w-0 flex-col gap-6">
			<ProjectButterDescription content={content} empty={empty} />
			{details}
			<ProjectButterRelatedWork content={content} empty={empty} />
			<ProjectButterActivity content={content} empty={empty} onOpenSession={onOpenSession} sessions={sessions} sidePanel={sidePanel} />
			<ProjectButterCommentBar active={active} content={content} empty={empty} sidePanel={sidePanel} />
		</div>
	);
}
