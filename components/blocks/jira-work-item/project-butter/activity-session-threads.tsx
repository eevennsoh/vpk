"use client";

import { Fragment, useId, useRef, useState, type ComponentProps, type CSSProperties } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { getAgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";
import { matchingAgentSessions } from "@/components/blocks/agent-assignment/components/session-choice-items";
import { TeammateSessionAvatars } from "@/components/blocks/agent-assignment/components/teammate-session-avatars";
import { JiraActivity, JiraActivityEntryGlyph, JiraActivityGroupSeparator, type JiraActivityCommentEntry, type JiraActivityReply } from "@/components/blocks/jira-activity";
import { Button } from "@/components/ui/button";
import { AvatarGroup } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { motionDuration, motionEase } from "@/lib/motion";
import { ProjectButterSessionStart, ProjectButterThreadEvents } from "./activity-session-start";
import { ProjectButterPinComment } from "./activity-comment-tools";
import { latestVisibleActivityReply, pinProjectButterComments, projectButterReplyParticipants } from "./activity-feed-model";
import { draftThreadInstruction, SESSION_THREAD_RAIL, summarizeReplies, SUMMARIZED_THREAD, SUMMARY_TRANSITION, useWorkItemThreadSummaries } from "./activity-thread-summary";
import type { ProjectButterSessionItem } from "./data";

type SessionThread = Readonly<{ entry: JiraActivityCommentEntry; session: ProjectButterSessionItem }>;
type DraftInstruction = (thread: SessionThread, text: string) => void;
type SummaryControl = ReturnType<ReturnType<typeof useWorkItemThreadSummaries>>;
type ThreadProps = Pick<ComponentProps<typeof JiraActivity>, "actors" | "currentUser" | "onEntriesChange" | "onSelectReply" | "renderCommentTools" | "renderReply" | "renderReplyBody" | "renderReplyFooter" | "renderTimestamp" | "selectedReply">;

export function renderProjectButterEarlierRepliesLabel(replies: readonly JiraActivityReply[], expanded: boolean) {
	return <EarlierRepliesLabel expanded={expanded} replies={replies} />;
}

function EarlierRepliesLabel({ replies, expanded }: Readonly<{ replies: readonly JiraActivityReply[]; expanded: boolean }>) {
	const [wasExpanded, setWasExpanded] = useState(expanded);
	const reduceMotion = useReducedMotion();
	if (expanded && !wasExpanded) setWasExpanded(true);
	if (expanded) return "Hide replies";
	const actors = projectButterReplyParticipants(replies).slice(0, 3);
	return (
		<>
			<span>Show {replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
			<AvatarGroup as="span" className="shrink-0" label={`Reply participants: ${actors.map(({ name }) => name).join(", ")}`} size="xs">
				{actors.map((actor, index) => <motion.span
					animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
					className="inline-flex"
					data-reply-participant-avatar
					initial={wasExpanded && !reduceMotion ? { opacity: 0, transform: "translateY(4px) scale(0.8)" } : false}
					key={actor.id}
					transition={{ duration: reduceMotion ? 0 : motionDuration.normal, ease: motionEase.outPractical, delay: reduceMotion ? 0 : index * motionDuration.xxshort }}
				><JiraActivityEntryGlyph actor={actor} animate={false} /></motion.span>)}
			</AvatarGroup>
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
				continueThreadAfterReplies={() => summary.summarized}
				commentHeaderLayout="inline"
				commentActionsPlacement="hover"
				renderCommentAction={() => <ProjectButterPinComment onToggle={() => onTogglePin(entry.id)} pinned={pinned} />}
				earlierRepliesAppearance="link"
				earlierRepliesSelectedAppearance="icon-only"
				showEarlierRepliesIcon={false}
				renderCommentBody={() => <><ProjectButterSessionStart hasReplies={Boolean(entry.replies?.length)} onOpen={onOpenSession} session={session} />{!entry.replies?.length ? <ProjectButterThreadEvents events={entry.activityEvents} /> : null}</>}
				renderCommentAvatar={canSummarize ? summary.renderAvatar : undefined}
				renderCommentTools={(entry, reply, collapseReplies) => (
					<>
						{activity.renderCommentTools?.(entry, reply, collapseReplies)}
						{reply || !canSummarize ? null : summary.renderAction(entry.replies ?? [], collapseReplies)}
					</>
				)}
				renderCommentReplies={(_entry, replies, expand, disclosure, expanded) => <>{canSummarize ? summary.renderReplies(replies, expand, summarizeReplies(entry.replies ?? []), canDraft ? (sources) => onDraft(thread, draftThreadInstruction(sources)) : undefined, { disclosure, expanded }) : <>{disclosure}{replies}</>}<ProjectButterThreadEvents events={entry.activityEvents} /></>}
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
	const reduceMotion = useReducedMotion();
	const pinLayoutKey = pinnedIds.join("|");
	const pinned = pinnedIds.flatMap((id) => entries.filter(({ entry }) => entry.id === id));
	const unpinned = entries.filter(({ entry }) => !pinnedIds.includes(entry.id));
	const mine = unpinned.filter(({ session }) => getAgentSessionRole(session) === "owner");
	const teammates = unpinned.filter(({ session }) => getAgentSessionRole(session) !== "owner");
	const teammatesSessions = teammates.map(({ session }) => session);
	function sessionSummary(thread: SessionThread, visible = true) {
		const previewLatest = props.latestReplyEntryIds?.has(thread.entry.id) && !pinnedIds.includes(thread.entry.id);
		const previewCount = previewLatest ? (latestVisibleActivityReply(thread.entry, props.showAgentReplyProgress ?? false)?.actor.kind === "agent" ? 2 : 1) : 0;
		return summaryFor(thread.entry, visible, previewCount);
	}
	function togglePin(entryId: string) {
		if (pinnedIds.includes(entryId) && pinned.some(({ entry, session }) => entry.id === entryId && getAgentSessionRole(session) !== "owner")) setExpanded(true);
		onTogglePin(entryId);
		requestAnimationFrame(() => {
			const row = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])].find((node) => node.dataset.jiraActivityEntryId === entryId);
			row?.querySelector<HTMLButtonElement>('button[aria-label="Pin comment"], button[aria-label="Unpin comment"]')?.focus({ preventScroll: true });
		});
	}
	return (
		<LayoutGroup id={id}>
		<div className="grid gap-3" ref={listRef}>
			{[...pinned, ...mine].map((thread, index) => <Fragment key={thread.entry.id}>
				<motion.div data-pin-motion-row layout={reduceMotion ? false : "position"} layoutId={reduceMotion ? undefined : thread.entry.id} layoutDependency={pinLayoutKey} transition={{ layout: { duration: motionDuration.slow, ease: motionEase.inOut } }}>
					<SessionThreadCard thread={thread} summary={sessionSummary(thread)} pinned={pinnedIds.includes(thread.entry.id)} onTogglePin={togglePin} {...props} />
				</motion.div>
				{index === pinned.length - 1 && (mine.length > 0 || teammates.length > 0) ? <JiraActivityGroupSeparator className="relative my-5" label={`${pinned.length} pinned`} /> : null}
			</Fragment>)}
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
						{teammates.map((thread) => <motion.div data-pin-motion-row key={thread.entry.id} layout={reduceMotion ? false : "position"} layoutId={reduceMotion ? undefined : thread.entry.id} layoutDependency={pinLayoutKey} transition={{ layout: { duration: motionDuration.slow, ease: motionEase.inOut } }}><SessionThreadCard thread={thread} summary={sessionSummary(thread, expanded)} pinned={false} onTogglePin={togglePin} {...props} /></motion.div>)}
					</div>
				</div>
			) : null}
			{!entries.length ? <p className="py-2 text-sm text-text-subtle">{sessions.length ? "No session activity yet" : "No agent sessions yet"}</p> : null}
		</div>
		</LayoutGroup>
	);
}
