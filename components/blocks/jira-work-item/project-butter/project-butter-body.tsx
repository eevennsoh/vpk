"use client";

import { useState, type Ref } from "react";
import { toast } from "sonner";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
import { ProjectButterCommentBar } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-bar";
import { ProjectButterDescription } from "@/components/blocks/jira-work-item/project-butter/project-butter-description";
import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
import type { ProjectButterRelatedScope, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

export function ProjectButterBody({ active, alwaysCollapsibleRelatedWork, compact, sidePanel, content, descriptionReveal, detailsSlotRef, empty, inlineSessionReplies = false, onDescriptionRevealComplete, onOpenSession, onPreviewSession, onStartAgent, onStartedSessionRevealed, openRelatedItem, previewSessionId, startedSessionId, relatedScope, sessions, singleActivityView = false, workItemKey }: Readonly<{
	active: boolean;
	alwaysCollapsibleRelatedWork?: boolean;
	compact?: boolean;
	sidePanel: boolean;
	content: ProjectButterContent;
	descriptionReveal?: { id: number; text: string } | null;
	detailsSlotRef: Ref<HTMLDivElement>;
	empty: boolean;
	inlineSessionReplies?: boolean;
	onDescriptionRevealComplete?: () => void;
	onOpenSession: (sessionId: string, draft?: string) => boolean | void | Promise<boolean | void>;
	onPreviewSession: (sessionId: string | null) => void;
	onStartAgent: (agent: AgentSessionItem["agent"], prompt: string) => void;
	onStartedSessionRevealed: () => void;
	openRelatedItem?: RelatedItemOpener;
	previewSessionId: string | null;
	startedSessionId: string | null;
	relatedScope?: ProjectButterRelatedScope;
	sessions: readonly ProjectButterSessionItem[];
	singleActivityView?: boolean;
	workItemKey?: string;
}>) {
	// The bar keeps 24px below the Activity header with no rows, and 24px below the lone "created" row of a new item.
	const activityRows = content.activityEntries.length === 0 ? "none" : content.activityEntries.every((entry) => entry.kind === "event" && entry.icon === "created") ? "origin" : "feed";
	const [replyRequest, setReplyRequest] = useState<Readonly<{ entryId: string; id: number }> | null>(null);
	function replyToSession(session: ProjectButterSessionItem, draft: string) {
		const entryId = `invocation-${session.id}`;
		if (!content.activityEntries.some((entry) => entry.id === entryId && entry.kind === "comment")) {
			toast.error("Could not find the session's activity thread. Your comment is still here.");
			return false;
		}
		content.setReplyDrafts((current) => {
			const existing = current[entryId]?.trim();
			const text = [existing, draft].filter(Boolean).join(" ");
			return { ...current, [entryId]: existing ? text : `@${session.agent.name} ${draft}` };
		});
		content.setActivityFilters((current) => ({ ...current, agents: true }));
		content.setActivityFocusId(entryId);
		setReplyRequest((current) => ({ entryId, id: (current?.id ?? 0) + 1 }));
		return true;
	}
	return (
		<div className={compact ? "flex min-w-0 flex-col gap-4" : "flex min-w-0 flex-col gap-6"}>
			<ProjectButterDescription content={content} empty={empty} onRevealComplete={onDescriptionRevealComplete} reveal={descriptionReveal} />
			<div className={sidePanel ? undefined : "@[860px]/butter:hidden"} ref={detailsSlotRef} />
			<ProjectButterRelatedWork active={active} alwaysCollapsible={alwaysCollapsibleRelatedWork} content={content} empty={empty} openRelatedItem={openRelatedItem} scope={relatedScope} workItemKey={workItemKey} />
			<ProjectButterActivity content={content} empty={empty} onOpenSession={onOpenSession} onStartedSessionRevealed={onStartedSessionRevealed} previewSessionId={previewSessionId} replyRequest={replyRequest} startedSessionId={startedSessionId} sessions={sessions} sidePanel={sidePanel} singleView={singleActivityView} />
			<ProjectButterCommentBar active={active} activityRows={activityRows} content={content} empty={empty} onOpenSession={onOpenSession} onReplyToSession={inlineSessionReplies ? replyToSession : undefined} onPreviewSession={onPreviewSession} onStartAgent={onStartAgent} sessions={sessions} sidePanel={sidePanel} />
		</div>
	);
}
