"use client";

import { useId, useRef, useState, type ComponentProps, type CSSProperties } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { getAgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";
import { matchingAgentSessions } from "@/components/blocks/agent-assignment/components/session-choice-items";
import { TeammateSessionAvatars } from "@/components/blocks/agent-assignment/components/teammate-session-avatars";
import { JiraActivity, JiraActivityEntryGlyph, type JiraActivityCommentEntry, type JiraActivityReply } from "@/components/blocks/jira-activity";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { ProjectButterSessionStart } from "./activity-session-start";
import { ProjectButterPinComment } from "./activity-comment-tools";
import { latestVisibleActivityReply, pinProjectButterComments } from "./activity-feed-model";
import { draftThreadInstruction, SESSION_THREAD_RAIL, summarizeReplies, SUMMARIZED_THREAD, SUMMARY_TRANSITION, useWorkItemThreadSummaries } from "./activity-thread-summary";
import type { ProjectButterSessionItem } from "./data";

type SessionThread = Readonly<{ entry: JiraActivityCommentEntry; session: ProjectButterSessionItem }>;
type DraftInstruction = (thread: SessionThread, text: string) => void;
type SummaryControl = ReturnType<ReturnType<typeof useWorkItemThreadSummaries>>;
type ThreadProps = Pick<ComponentProps<typeof JiraActivity>, "actors" | "currentUser" | "onEntriesChange" | "onSelectReply" | "renderCommentTools" | "renderReply" | "renderReplyBody" | "renderReplyFooter" | "renderTimestamp" | "selectedReply">;

export function renderProjectButterEarlierRepliesLabel(replies: readonly JiraActivityReply[], expanded: boolean) {
	if (expanded) return "Hide replies";
	const actors = [...new Map(replies.map(({ actor }) => [actor.id, actor])).values()].slice(-3).reverse();
	return (
		<>
			<span>Show {replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
			<span aria-label={`Reply participants: ${actors.map(({ name }) => name).join(", ")}`} className="flex shrink-0 gap-0.5" role="group">
				{actors.map((actor) => <JiraActivityEntryGlyph actor={actor} animate={false} key={actor.id} />)}
			</span>
		</>
	);
}

function SessionThreadCard({ thread, summary, onDraft, onOpenSession, onTogglePin, pinned, latestReplyEntryIds, showAgentReplyProgress = false, ...activity }: ThreadProps & Readonly<{
	thread: SessionThread;
	summary: SummaryControl;
	onDraft?: DraftInstruction;
	onOpenSession: (id: string) => void;
	onTogglePin: (id: string) => void;
	pinned: boolean;
	latestReplyEntryIds?: ReadonlySet<string>;
	showAgentReplyProgress?: boolean;
}>) {
	const { entry, session } = thread;
	const canSummarize = getAgentSessionRole(session) === "owner";
	const canDraft = onDraft && matchingAgentSessions({ id: session.agent.id ?? session.id, name: session.agent.name }, [session], { includeCompleted: true }).length > 0;
	const previewLatest = latestReplyEntryIds?.has(entry.id) ?? false;
	const previewCount = latestVisibleActivityReply(entry, showAgentReplyProgress)?.actor.kind === "agent" ? 2 : 1;

	return (
		<div style={{ "--summary-header-inset": `${summary.showAvatarStack ? summary.headerInset : 0}px` } as CSSProperties}>
			<JiraActivity
				actorAvatarSize={24}
				{...activity}
				showReplySelection={false}
				className={cn(SESSION_THREAD_RAIL, SUMMARY_TRANSITION, summary.showAvatarStack && SUMMARIZED_THREAD)}
				onRepliesExpandedChange={canSummarize ? (_entry, expanded) => summary.setRepliesExpanded(expanded) : undefined}
				entries={pinProjectButterComments([{ ...entry, defaultRepliesExpanded: false, replyPreviewCount: previewLatest ? previewCount : 0 }], pinned ? [entry.id] : []).map((item) => previewLatest && item.kind === "comment" ? { ...item, replyPreviewCount: previewCount } : item)}
				replyCollapseKey={(item) => previewLatest ? `reply:${latestVisibleActivityReply(item, showAgentReplyProgress)?.id}` : pinned ? `pinned:${item.id}` : undefined}
				activeEntryId={activity.selectedReply?.entryId}
				composer={null}
				hideHeader
				connectorStyle="thread"
				forceThreadConnector={() => summary.summarized || pinned}
				commentHeaderLayout="inline"
				commentActionsPlacement="hover"
				renderCommentAction={() => <ProjectButterPinComment onToggle={() => onTogglePin(entry.id)} pinned={pinned} />}
				earlierRepliesAppearance="link"
				earlierRepliesSelectedAppearance="icon-only"
				showEarlierRepliesIcon={false}
				renderCommentBody={() => <ProjectButterSessionStart onOpen={onOpenSession} session={session} />}
				renderCommentAvatar={canSummarize ? summary.renderAvatar : undefined}
				renderCommentTools={(entry, reply, collapseReplies) => (
					<>
						{activity.renderCommentTools?.(entry, reply, collapseReplies)}
						{reply || !canSummarize ? null : summary.renderAction(entry.replies ?? [], collapseReplies)}
					</>
				)}
				renderCommentReplies={(_entry, replies, expand, disclosure, expanded) => canSummarize ? summary.renderReplies(replies, expand, summarizeReplies(entry.replies ?? []), canDraft ? (sources) => onDraft(thread, draftThreadInstruction(sources)) : undefined, { disclosure, expanded }) : <>{disclosure}{replies}</>}
				renderEarlierRepliesLabel={renderProjectButterEarlierRepliesLabel}
			/>
		</div>
	);
}

export function ProjectButterActivitySessionThreads({ entries, sessions, pinnedIds, onTogglePin, active, activatedAtMs, ...props }: ThreadProps & Readonly<{
	entries: readonly SessionThread[];
	sessions: readonly ProjectButterSessionItem[];
	active: boolean;
	activatedAtMs: number;
	pinnedIds: readonly string[];
	onTogglePin: (id: string) => void;
	onDraft?: DraftInstruction;
	onOpenSession: (id: string) => void;
	latestReplyEntryIds?: ReadonlySet<string>;
	showAgentReplyProgress?: boolean;
}>) {
	const [expanded, setExpanded] = useState(false);
	const summaryFor = useWorkItemThreadSummaries({ entries: entries.filter(({ session }) => getAgentSessionRole(session) === "owner").map(({ entry }) => entry), active, activatedAtMs, latestReplyEntryIds: props.latestReplyEntryIds });
	const listRef = useRef<HTMLDivElement>(null);
	const id = useId();
	const pinned = pinnedIds.flatMap((id) => entries.filter(({ entry }) => entry.id === id));
	const unpinned = entries.filter(({ entry }) => !pinnedIds.includes(entry.id));
	const mine = unpinned.filter(({ session }) => getAgentSessionRole(session) === "owner");
	const teammates = unpinned.filter(({ session }) => getAgentSessionRole(session) !== "owner");
	const teammatesSessions = teammates.map(({ session }) => session);
	function togglePin(entryId: string) {
		if (pinnedIds.includes(entryId) && pinned.some(({ entry, session }) => entry.id === entryId && getAgentSessionRole(session) !== "owner")) setExpanded(true);
		onTogglePin(entryId);
		requestAnimationFrame(() => {
			const row = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])].find((node) => node.dataset.jiraActivityEntryId === entryId);
			row?.querySelector<HTMLButtonElement>('button[aria-label="Pin comment"], button[aria-label="Unpin comment"]')?.focus({ preventScroll: true });
		});
	}
	return (
		<div className="grid gap-3" ref={listRef}>
			{[...pinned, ...mine].map((thread) => <SessionThreadCard key={thread.entry.id} thread={thread} summary={summaryFor(thread.entry)} pinned={pinnedIds.includes(thread.entry.id)} onTogglePin={togglePin} {...props} />)}
			{teammates.length ? (
				<div>
					<Button
						aria-controls={id}
						aria-expanded={expanded}
						className="-ms-1 -me-1 gap-2 border-0 ps-2"
						onClick={() => setExpanded((open) => !open)}
						selectedAppearance="icon-only"
						variant="ghost"
					>
						<span className="flex min-w-7 shrink-0"><TeammateSessionAvatars items={teammatesSessions} sizePx={24} /></span>
						Other agent activity
						<Icon className={expanded ? "rotate-90" : undefined} render={<ChevronRightIcon label="" size="small" />} />
					</Button>
					<div className={expanded ? "grid gap-3 pt-3" : undefined} hidden={!expanded} id={id}>
						{teammates.map((thread) => <SessionThreadCard key={thread.entry.id} thread={thread} summary={summaryFor(thread.entry, expanded)} pinned={false} onTogglePin={togglePin} {...props} />)}
					</div>
				</div>
			) : null}
			{!entries.length ? <p className="py-2 text-sm text-text-subtle">{sessions.length ? "No session activity yet" : "No agent sessions yet"}</p> : null}
		</div>
	);
}
