"use client";

import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { toast } from "sonner";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
import { ProjectButterCommentBar } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-bar";
import { ProjectButterDescription } from "@/components/blocks/jira-work-item/project-butter/project-butter-description";
import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
import type { ProjectButterRelatedScope, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { useSessionMentionFlight, type MentionFlightSource } from "@/components/blocks/jira-work-item/project-butter/use-session-mention-flight";

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
	const [replyRequest, setReplyRequest] = useState<Readonly<{ entryId: string; id: number; prefill: Readonly<{ agentName: string; text: string; preserveContent: boolean }>; source: MentionFlightSource | null }> | null>(null);
	const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
	const [traceReplyId, setTraceReplyId] = useState<number | null>(null);
	const [settledReplyId, setSettledReplyId] = useState<number | null>(null);
	const bodyRef = useRef<HTMLDivElement>(null);
	const settleHandoff = useCallback((id: number, reason?: "landed" | "interrupted") => { setSettledReplyId(id); if (reason === "interrupted") setTraceReplyId(null); }, []);
	const interruptHandoff = useCallback(() => { setActiveReplyId(null); setTraceReplyId(null); }, []);
	const completeTrace = useCallback((id: number) => { setTraceReplyId((current) => current === id ? null : current); }, []);
	if (!active && activeReplyId !== null) setActiveReplyId(null);
	if (!active && traceReplyId !== null) setTraceReplyId(null);
	const mentionFlight = useSessionMentionFlight(bodyRef, replyRequest, active && activeReplyId !== null, setTraceReplyId, settleHandoff);
	const pendingReplyId = active && replyRequest?.source && activeReplyId === replyRequest.entryId && settledReplyId !== replyRequest.id ? replyRequest.entryId : null;
	useEffect(() => {
		if (!activeReplyId) return;
		function onOutside(event: PointerEvent) {
			const entry = [...(bodyRef.current?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])].find((node) => node.dataset.jiraActivityEntryId === activeReplyId);
			if (event.target instanceof Element && (entry?.querySelector("[data-project-butter-comment-editor]")?.contains(event.target) || event.target.closest("[data-suggestion-option], [role=listbox], [role=menu], [data-slot=popover-content]"))) return;
			interruptHandoff();
		}
		document.addEventListener("pointerdown", onOutside);
		return () => document.removeEventListener("pointerdown", onOutside);
	}, [activeReplyId, interruptHandoff]);
	function replyToSession(session: ProjectButterSessionItem, draft: string, source: MentionFlightSource | null) {
		const entryId = `invocation-${session.id}`;
		if (!content.activityEntries.some((entry) => entry.id === entryId && entry.kind === "comment")) {
			toast.error("Could not find the session's activity thread. Your comment is still here.");
			return false;
		}
		const existingDraft = content.replyDrafts[entryId]?.trim();
		content.setReplyDrafts((current) => {
			const existing = current[entryId]?.trim();
			const text = [existing, draft].filter(Boolean).join(" ");
			return { ...current, [entryId]: text };
		});
		content.setActivityFilters((current) => ({ ...current, agents: true }));
		setTraceReplyId(null);
		setActiveReplyId(entryId);
		setReplyRequest((current) => ({ entryId, id: (current?.id ?? 0) + 1, prefill: { agentName: session.agent.name, text: draft, preserveContent: Boolean(existingDraft) }, source }));
		return true;
	}
	return (
		<div className={compact ? "flex min-w-0 flex-col gap-4" : "flex min-w-0 flex-col gap-6"} ref={bodyRef}>
			{mentionFlight}
			<ProjectButterDescription content={content} empty={empty} onRevealComplete={onDescriptionRevealComplete} reveal={descriptionReveal} />
			<div className={sidePanel ? undefined : "@[860px]/butter:hidden"} ref={detailsSlotRef} />
			<ProjectButterRelatedWork active={active} content={content} empty={empty} openRelatedItem={openRelatedItem} scope={relatedScope} workItemKey={workItemKey} />
			<ProjectButterActivity content={content} empty={empty} onOpenSession={onOpenSession} onReplyHandoffInterrupt={interruptHandoff} onReplySubmitted={interruptHandoff} onReplyTraceComplete={completeTrace} onStartedSessionRevealed={onStartedSessionRevealed} pendingReplyId={pendingReplyId} previewSessionId={previewSessionId} replyFocusId={activeReplyId} replyRequest={replyRequest} startedSessionId={startedSessionId} sessions={sessions} sidePanel={sidePanel} singleView={singleActivityView} traceReplyId={traceReplyId} />
			<ProjectButterCommentBar active={active} activityRows={activityRows} content={content} keepVisible={activeReplyId !== null} empty={empty} onOpenSession={onOpenSession} onReplyToSession={inlineSessionReplies ? replyToSession : undefined} onPreviewSession={onPreviewSession} onStartAgent={onStartAgent} sessions={sessions} sidePanel={sidePanel} />
		</div>
	);
}
