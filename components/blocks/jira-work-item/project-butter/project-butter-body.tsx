"use client";

import { use, useState, type Ref } from "react";
import { toast } from "sonner";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { CardValue } from "@/components/blocks/jira-suggestion/components/card-value";
import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
import { ProjectButterCommentBar, type ProjectButterReplyTarget } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-bar";
import { ProjectButterDescription } from "@/components/blocks/jira-work-item/project-butter/project-butter-description";
import { CriteriaReveal, SuggestionFieldFeedback, useIsSuggestionTarget } from "./suggestion-targets";
import { ProjectButterEmptyActions } from "@/components/blocks/jira-work-item/project-butter/project-butter-empty-actions";
import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
import type { ProjectButterRelatedScope, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import type { JiraActivityActor, JiraActivityCommentEntry } from "@/components/blocks/jira-activity/jira-activity-types";
import { cn } from "@/lib/utils";

function AcceptanceCriteria({ items }: Readonly<{ items: readonly string[] }>) {
	const targeted = useIsSuggestionTarget("acceptanceCriteria");
	const reveal = use(CriteriaReveal);
	if (!items.length && !targeted) return null;
	return (
		<section className="relative flex flex-col gap-2" aria-label="Acceptance criteria">
			<h2 className="text-sm font-medium text-text">Acceptance criteria</h2>
			<div className="min-h-7">{items.length ? <CardValue revealChecklist={items.length === reveal?.length && items.every((item, index) => item === reveal[index])} value={{ kind: "checklist", items }} /> : null}</div>
			<SuggestionFieldFeedback field="acceptanceCriteria" />
		</section>
	);
}

export function ProjectButterBody({ active, compact, sidePanel, content, descriptionReveal, detailsSlotRef, empty, inlineSessionReplies = false, onDescriptionRevealComplete, onOpenSession, onPreviewSession, onStartAgent, onStartedSessionRevealed, openRelatedItem, previewSessionId, startedSessionId, relatedScope, sessions, sessionActivityView = false, showAgentReplyProgress = false, singleActivityView = false, workItemKey }: Readonly<{
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
	sessionActivityView?: boolean;
	showAgentReplyProgress?: boolean;
	workItemKey?: string;
}>) {
	// The bar keeps 24px below the Activity header with no rows, and 24px below the lone "created" row of a new item.
	const activityRows = content.activityEntries.length === 0 ? "none" : content.activityEntries.every((entry) => entry.kind === "event" && entry.icon === "created") ? "origin" : "feed";
	const [replyTarget, setReplyTarget] = useState<ProjectButterReplyTarget | null>(null);
	const [replyFocusRequest, setReplyFocusRequest] = useState(0);
	const [latestReplyEntryIds, setLatestReplyEntryIds] = useState<ReadonlySet<string>>(() => new Set());
	const [instructionDraft, setInstructionDraft] = useState<string | null>(null);
	function selectReply(entry: JiraActivityCommentEntry, targetId: string, actor: JiraActivityActor) {
		if (instructionDraft === null && replyTarget?.entryId === entry.id && replyTarget.targetId === targetId) {
			setReplyTarget(null);
			return;
		}
		setInstructionDraft(null);
		setReplyTarget({ entryId: entry.id, targetId, actor, mentionAgent: targetId === entry.id });
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
		setReplyTarget({ entryId, targetId: entryId, actor: { id: session.agent.id ?? session.id, name: session.agent.name, kind: "agent" }, mentionAgent: true });
		setReplyFocusRequest((current) => current + 1);
		return true;
	}
	const replySession = replyTarget ? sessions.find((session) => `invocation-${session.id}` === replyTarget.entryId) : undefined;
	const composerContent: ProjectButterContent = instructionDraft === null ? content : {
		...content,
		commentDraft: instructionDraft,
		setCommentDraft: (update) => setInstructionDraft((draft) => typeof update === "function" ? update(draft ?? "") : update),
	};
	return (
		<div className={cn("flex min-w-0 flex-col", compact ? "gap-4" : "gap-6", activityRows === "feed" && "min-h-full")}>
			<div className={empty ? "group/empty-actions -mb-4 flex flex-col" : undefined}>
				<ProjectButterDescription content={content} empty={empty} onRevealComplete={onDescriptionRevealComplete} reveal={descriptionReveal} />
				{empty && !sidePanel ? <ProjectButterEmptyActions content={content} /> : null}
			</div>
			<AcceptanceCriteria items={content.detailFields.acceptanceCriteria} />
			<div className={sidePanel ? undefined : "@[860px]/butter:hidden"} ref={detailsSlotRef} />
			<ProjectButterRelatedWork active={active} content={content} empty={empty} openRelatedItem={openRelatedItem} scope={relatedScope} workItemKey={workItemKey} />
			<ProjectButterActivity content={content} onOpenSession={onOpenSession} onSelectReply={selectReply} selectedReply={replyTarget} onStartedSessionRevealed={onStartedSessionRevealed} previewSessionId={previewSessionId} startedSessionId={startedSessionId} sessions={sessions} sidePanel={sidePanel} singleView={singleActivityView} sessionView={sessionActivityView} showAgentReplyProgress={showAgentReplyProgress} latestReplyEntryIds={latestReplyEntryIds} onDraftSessionInstruction={({ entry }, text) => {
				if (replyTarget?.entryId !== entry.id || instructionDraft === null) setInstructionDraft(text);
				setReplyTarget({ entryId: entry.id, targetId: entry.id, actor: entry.actor, mentionAgent: true });
				setReplyFocusRequest((current) => current + 1);
			}} />
			{/* Fill short feeds while canceling the extra flex gap introduced by the spacer. */}
			{activityRows === "feed" ? <div aria-hidden className={cn("mt-auto", compact ? "-mb-4" : "-mb-6")} /> : null}
			<ProjectButterCommentBar active={active} activityRows={activityRows} content={composerContent} empty={empty} onOpenSession={onOpenSession} onReplyToSession={inlineSessionReplies ? replyToSession : undefined} onPreviewSession={onPreviewSession} onStartAgent={onStartAgent} replyFocusRequest={replyFocusRequest} replySession={replySession} replyTarget={replyTarget} onClearReply={() => { if (instructionDraft !== null) content.setCommentDraft(instructionDraft); setReplyTarget(null); setInstructionDraft(null); }} onActivityReplySubmitted={(entryId) => setLatestReplyEntryIds((current) => new Set(current).add(entryId))} sessions={sessions} sidePanel={sidePanel} />
		</div>
	);
}
