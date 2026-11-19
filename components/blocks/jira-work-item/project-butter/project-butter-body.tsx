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
import type { JiraActivityActor, JiraActivityCommentEntry } from "@/components/blocks/jira-activity/jira-activity-types";

export function ProjectButterBody({ active, compact, sidePanel, content, descriptionReveal, detailsSlotRef, empty, inlineSessionReplies = false, onDescriptionRevealComplete, onOpenSession, onPreviewSession, onStartAgent, onStartedSessionRevealed, openRelatedItem, previewSessionId, startedSessionId, relatedScope, sessions, singleActivityView = false, workItemKey }: Readonly<{
	active: boolean;
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
	const [replyTarget, setReplyTarget] = useState<Readonly<{ entryId: string; targetId: string; actor: JiraActivityActor }> | null>(null);
	const [replyFocusRequest, setReplyFocusRequest] = useState(0);
	function selectReply(entry: JiraActivityCommentEntry, targetId: string, actor: JiraActivityActor) {
		if (replyTarget?.entryId === entry.id && replyTarget.targetId === targetId) { setReplyTarget(null); return; }
		setReplyTarget({ entryId: entry.id, targetId, actor });
		setReplyFocusRequest((current) => current + 1);
	}
	function replyToSession(session: ProjectButterSessionItem, draft: string) {
		const entryId = `invocation-${session.id}`;
		if (!content.activityEntries.some((entry) => entry.id === entryId && entry.kind === "comment")) {
			toast.error("Could not find the session's activity thread. Your comment is still here.");
			return false;
		}
		content.setCommentDraft(draft);
		content.setActivityFilters((current) => ({ ...current, agents: true }));
		setReplyTarget({ entryId, targetId: entryId, actor: { id: session.agent.id ?? session.id, name: session.agent.name, kind: "agent" } });
		setReplyFocusRequest((current) => current + 1);
		return true;
	}
	const replySession = replyTarget ? sessions.find((session) => `invocation-${session.id}` === replyTarget.entryId) : undefined;
	return (
		<div className={compact ? "flex min-w-0 flex-col gap-4" : "flex min-w-0 flex-col gap-6"}>
			<ProjectButterDescription content={content} empty={empty} onRevealComplete={onDescriptionRevealComplete} reveal={descriptionReveal} />
			<div className={sidePanel ? undefined : "@[860px]/butter:hidden"} ref={detailsSlotRef} />
			<ProjectButterRelatedWork active={active} content={content} empty={empty} openRelatedItem={openRelatedItem} scope={relatedScope} workItemKey={workItemKey} />
			<ProjectButterActivity content={content} empty={empty} onOpenSession={onOpenSession} onSelectReply={selectReply} selectedReply={replyTarget} onStartedSessionRevealed={onStartedSessionRevealed} previewSessionId={previewSessionId} startedSessionId={startedSessionId} sessions={sessions} sidePanel={sidePanel} singleView={singleActivityView} />
			<ProjectButterCommentBar active={active} activityRows={activityRows} content={content} empty={empty} onOpenSession={onOpenSession} onReplyToSession={inlineSessionReplies ? replyToSession : undefined} onPreviewSession={onPreviewSession} onStartAgent={onStartAgent} replyFocusRequest={replyFocusRequest} replySession={replySession} replyTarget={replyTarget} onClearReply={() => setReplyTarget(null)} sessions={sessions} sidePanel={sidePanel} />
		</div>
	);
}
