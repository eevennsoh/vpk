"use client";

import type { Ref } from "react";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
import { ProjectButterCommentBar } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-bar";
import { ProjectButterDescription } from "@/components/blocks/jira-work-item/project-butter/project-butter-description";
import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
import type { ProjectButterRelatedScope, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

export function ProjectButterBody({ active, sidePanel, content, descriptionReveal, detailsSlotRef, empty, onDescriptionRevealComplete, onOpenSession, onPreviewSession, onStartAgent, openRelatedItem, previewSessionId, relatedScope, sessions, workItemKey }: Readonly<{
	active: boolean;
	sidePanel: boolean;
	content: ProjectButterContent;
	descriptionReveal?: { id: number; text: string } | null;
	detailsSlotRef: Ref<HTMLDivElement>;
	empty: boolean;
	onDescriptionRevealComplete?: () => void;
	onOpenSession: (sessionId: string, draft?: string) => boolean | void | Promise<boolean | void>;
	onPreviewSession: (sessionId: string | null) => void;
	onStartAgent: (agent: AgentSessionItem["agent"], prompt: string) => void;
	openRelatedItem?: RelatedItemOpener;
	previewSessionId: string | null;
	relatedScope?: ProjectButterRelatedScope;
	sessions: readonly ProjectButterSessionItem[];
	workItemKey?: string;
}>) {
	const emptyActivity = content.activityView === "Activity"
		&& !content.activityEntries.some((entry) => entry.kind === "comment")
		&& !sessions.some((session) => session.state === "needs-input");
	return (
		<div className="flex min-w-0 flex-col gap-6">
			<ProjectButterDescription content={content} empty={empty} onRevealComplete={onDescriptionRevealComplete} reveal={descriptionReveal} />
			<div className={sidePanel ? undefined : "@[860px]/butter:hidden"} ref={detailsSlotRef} />
			<ProjectButterRelatedWork active={active} content={content} empty={empty} openRelatedItem={openRelatedItem} scope={relatedScope} workItemKey={workItemKey} />
			<ProjectButterActivity content={content} empty={empty} onOpenSession={onOpenSession} previewSessionId={previewSessionId} sessions={sessions} sidePanel={sidePanel} />
			<ProjectButterCommentBar active={active} compact={emptyActivity} content={content} empty={empty} onOpenSession={onOpenSession} onPreviewSession={onPreviewSession} onStartAgent={onStartAgent} sessions={sessions} sidePanel={sidePanel} />
		</div>
	);
}
