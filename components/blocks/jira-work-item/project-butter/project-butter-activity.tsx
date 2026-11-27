"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import TimelineIcon from "@atlaskit/icon/core/timeline";
import { JiraActivity, jiraActivitySegmentsToPlainText, type JiraActivityEntry, type JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import type { JiraActivityActor, JiraActivityCommentEntry } from "@/components/blocks/jira-activity/jira-activity-types";
import { JiraActivityEvent } from "@/components/blocks/jira-activity/jira-activity-event";
import { mapAgentToMentionItem } from "@/components/blocks/editor-palette/data/mention-sources";
import { createJiraLinkingCardGlow } from "@/components/blocks/jira-linking/card-glow";
import { resolveJiraLinkingGlowColor } from "@/components/blocks/jira-linking/glow-motion";
import { resolveJiraLinkingIdentityTint } from "@/components/blocks/jira-linking/use-jira-linking-atlas";
import { agentSessionAccentColor, agentSessionTintSeed } from "@/components/blocks/agent-session/agent-session-transfer-member";
import { resolveAgentBrandTint, resolveAgentBrandTintVariable } from "@/components/blocks/agent-session/agent-brand-tint";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProjectButterActivitySessionThreads, renderProjectButterEarlierRepliesLabel } from "./activity-session-threads";
import { draftThreadInstruction, PINNED_THREAD_RAIL, summarizeReplies, SUMMARY_TRANSITION, THREAD_DISCLOSURE_SPACING, useWorkItemThreadSummaries } from "./activity-thread-summary";
import { matchingAgentSessions } from "@/components/blocks/agent-assignment/components/session-choice-items";
import { getAgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";
import { RovoGeneration } from "@/components/ui-custom/rovo-generation";
import { motionDuration } from "@/lib/motion";
import { ProjectButterCommentEditor } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-editor";
import { useProjectButterMentionAgents } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-mention-agents";
import { cn } from "@/lib/utils";
import {
	groupProjectButterUpdates,
	latestVisibleActivityReply,
	PROJECT_BUTTER_ACTIVITY_FILTERS_ALL,
	projectButterSessionIdFromEntry,
	pinProjectButterComments,
	selectProjectButterActivity,
	unpinProjectButterEntries,
	type ProjectButterUpdateGroups,
} from "@/components/blocks/jira-work-item/project-butter/activity-feed-model";
import {
	ProjectButterCommentTools,
	ProjectButterCopyCommentLink,
	ProjectButterPinComment,
	ProjectButterTimestamp,
} from "@/components/blocks/jira-work-item/project-butter/activity-comment-tools";
import { ProjectButterActivityFilterMenu } from "@/components/blocks/jira-work-item/project-butter/activity-filter-menu";
import { ProjectButterSessionStart, ProjectButterThreadEvents } from "@/components/blocks/jira-work-item/project-butter/activity-session-start";
import { AgentReplyProgress, ProjectButterAgentReplyAction } from "@/components/blocks/jira-work-item/project-butter/activity-agent-reply";
import { JiraWorkItemTimeline, useJiraWorkItemTimelineNavigation } from "@/components/blocks/jira-work-item-timeline";
import { activityDateLabel, activityDayLabel, activityHeaderTimeLabel } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import { ProjectButterUpdateGroup } from "@/components/blocks/jira-work-item/project-butter/activity-update-group";
import { activityScrollport } from "@/components/blocks/jira-activity/activity-scrollport";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { PROJECT_BUTTER_REFERENCE_HISTORY } from "@/components/blocks/jira-work-item/project-butter/reference-data";
import {
	ProjectButterHistoryChange,
	ProjectButterReferenceCommentBody,
} from "@/components/blocks/jira-work-item/project-butter/reference-activity-body";

const HISTORY = new Map(PROJECT_BUTTER_REFERENCE_HISTORY.map((item) => [item.id, item]));
const ACTIVITY_EVENT_TEXT = "text-xs text-text [&_[data-jira-activity-agent-mention]]:align-[-0.2em] [&_[data-jira-activity-user-mention]]:align-[-0.2em]";
/** Soft hover plate behind each comment thread, on its own isolated layer. Literal strings so Tailwind's scanner sees every class. */
const FEED_ROWS = [
	"[&>div>ol>li]:relative [&>div>ol>li]:isolate",
	"[&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:pointer-events-none [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:absolute [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:-inset-x-2 [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:-top-2 [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:bottom-3 [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:-z-10 [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:rounded-xl [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:transition-colors [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:duration-xxshort [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:ease-out-practical [&>div>ol>li[data-jira-activity-entry-kind=comment]]:hover:after:bg-bg-neutral-subtle-hovered",
	"[&>div>ol>li[data-jira-activity-entry-kind=comment]:has(>div.pb-6)]:after:bottom-4 [&>div>ol>li[data-jira-activity-entry-kind=comment]:has(>div.pb-4)]:after:bottom-2",
	"[&>div>ol>li[data-jira-activity-entry-kind=comment]:hover_[data-jira-activity-reply-toggle-icon]]:bg-linear-to-b [&>div>ol>li[data-jira-activity-entry-kind=comment]:hover_[data-jira-activity-reply-toggle-icon]]:from-bg-neutral-subtle-hovered [&>div>ol>li[data-jira-activity-entry-kind=comment]:hover_[data-jira-activity-reply-toggle-icon]]:to-bg-neutral-subtle-hovered",
].join(" ");

export function ProjectButterActivity({
	content,
	traceReplyId,
	pendingReplyId,
	replyFocusId,
	sidePanel,
	sessions,
	onOpenSession,
	onReplyHandoffInterrupt,
	onReplyTraceComplete,
	onReplySubmitted,
	onSelectReply,
	selectedReply,
	previewSessionId,
	replyRequest,
	startedSessionId,
	onStartedSessionRevealed,
	singleView = false,
	sessionView = false,
	onDraftSessionInstruction,
	latestReplyEntryIds,
	showAgentReplyProgress = false,
}: Readonly<{
	content: ProjectButterContent;
	traceReplyId?: number | null;
	pendingReplyId?: string | null;
	replyFocusId?: string | null;
	sidePanel: boolean;
	sessions: readonly ProjectButterSessionItem[];
	onOpenSession: (id: string) => void;
	onReplyHandoffInterrupt?: () => void;
	onReplyTraceComplete?: (id: number) => void;
	onReplySubmitted?: () => void;
	onSelectReply?: (entry: JiraActivityCommentEntry, targetId: string, actor: JiraActivityActor) => void;
	selectedReply?: Readonly<{ entryId: string; targetId: string }> | null;
	previewSessionId?: string | null;
	replyRequest?: Readonly<{ entryId: string; id: number; prefill?: Readonly<{ agentName: string; text: string; preserveContent: boolean }> }> | null;
	startedSessionId?: string | null;
	onStartedSessionRevealed?: () => void;
	singleView?: boolean;
	sessionView?: boolean;
	onDraftSessionInstruction?: (thread: Readonly<{ entry: JiraActivityCommentEntry; session: ProjectButterSessionItem }>, text: string) => void;
	latestReplyEntryIds?: ReadonlySet<string>;
	showAgentReplyProgress?: boolean;
}>) {
	const activityRef = useRef<HTMLElement>(null);
	const [expandedAudit, setExpandedAudit] = useState(false);
	const [limit, setLimit] = useState(10);
	const [view, setView] = useState<"timeline" | "sessions">("timeline");
	const [visitedSessions, setVisitedSessions] = useState(false);
	const [sessionsActivatedAtMs, setSessionsActivatedAtMs] = useState(0);
	const summaryFor = useWorkItemThreadSummaries();
	const [focusEntryId, setFocusEntryId] = useState(content.activityFocusId);
	if (content.activityFocusId !== focusEntryId) {
		setFocusEntryId(content.activityFocusId);
		if (content.activityFocusId && !projectButterSessionIdFromEntry(content.activityFocusId)) setView("timeline");
	}
	const showSessions = sessionView && view === "sessions";
	const canFilterTimeline = sessionView || !singleView;
	const filters = canFilterTimeline ? content.activityFilters : PROJECT_BUTTER_ACTIVITY_FILTERS_ALL;
	const sort = canFilterTimeline ? content.activitySort : "newest";
	const mentionAgents = useProjectButterMentionAgents(sessions);
	const activityMentionAgents = useMemo(() => [...sessions.map((session) => ({ ...session.agent, id: session.agent.id ?? session.id, byline: "Agent on this work item" })), ...mentionAgents], [sessions, mentionAgents]);
	const mentionAgentsById = useMemo(() => new Map(activityMentionAgents.map((agent) => [mapAgentToMentionItem(agent).id, agent])), [activityMentionAgents]);
	const ordered = useMemo(() => pinProjectButterComments(selectProjectButterActivity(content.activityEntries, filters, sort), content.pinnedCommentIds), [content.activityEntries, content.pinnedCommentIds, filters, sort]);
	const previewEntryId = previewSessionId ? ordered.find((entry) => entry.id === `invocation-${previewSessionId}`)?.id : undefined;
	const pullRequestStatus = content.activityEntries.some((entry) => entry.id === "merchant-merged") ? "Merged" : "Open";
	const { entries: allRows, groups } = useMemo<{ entries: readonly JiraActivityEntry[]; groups: ProjectButterUpdateGroups }>(() => groupProjectButterUpdates(ordered, (entry) => {
		const item = content.auditChanges[entry.id] ?? HISTORY.get(entry.id);
		return item?.changes.length ? item.changes.map((change) => change.label) : entry.icon === "status" ? ["status"] : [];
	}), [ordered, content.auditChanges]);
	// The page limit counts rendered rows, so an update group is one row however many changes it holds.
	const rowIndex = (id: string | null | undefined) => id ? allRows.findIndex((row) => row.id === id || groups.get(row.id)?.some((entry) => entry.id === id)) : -1;
	const startedEntryId = startedSessionId ? `invocation-${startedSessionId}` : null;
	const previewLimit = rowIndex(previewEntryId) + 1;
	const selectedLimit = rowIndex(selectedReply?.entryId) + 1;
	if (Math.max(previewLimit, selectedLimit) > limit) setLimit(Math.max(previewLimit, selectedLimit));
	const rows = allRows.slice(0, Math.max(limit, rowIndex(content.activityFocusId) + 1, rowIndex(replyRequest?.entryId) + 1, selectedLimit, previewLimit, rowIndex(startedEntryId) + 1)).map((row) => row.kind === "comment" && latestReplyEntryIds?.has(row.id) ? { ...row, replyPreviewCount: latestVisibleActivityReply(row, showAgentReplyProgress)?.actor.kind === "agent" ? 2 : 1 } : row);
	const visible = rows.flatMap<JiraActivityEntry>((row) => groups.get(row.id) ?? [row]);
	const { feedRef, headerRef, progress, scrollToEntry, seekToProgress, stuck, visibleId } = useJiraWorkItemTimelineNavigation(rows, { layoutKey: sidePanel, focusId: content.activityFocusId, viewKey: view });
	const visibleRow = rows.find((row) => row.id === visibleId) ?? rows[0];
	const startedSession = sessions.find((session) => session.id === startedSessionId);
	const tintSeed = startedSession ? agentSessionTintSeed(startedSession) : undefined;
	const startedVisible = rows.some((row) => row.id === startedEntryId);
	useEffect(() => {
		if (!startedSessionId || !startedEntryId || !startedVisible) return;
		const feed = feedRef.current;
		const entry = [...(feed?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])].find((node) => node.dataset.jiraActivityEntryId === startedEntryId);
		const card = entry?.querySelector<HTMLElement>("[data-variant='uncaptured-work']");
		const cardContainer = card?.closest<HTMLElement>("[data-project-butter-session-start]");
		if (!entry || !card || !cardContainer) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			onStartedSessionRevealed?.();
			return;
		}
		const tintVariable = resolveAgentBrandTintVariable(tintSeed);
		const color = resolveJiraLinkingGlowColor(resolveJiraLinkingIdentityTint({ id: startedSessionId, tintSeed, tintVariable, tint: tintVariable ? undefined : resolveAgentBrandTint(tintSeed) }));
		const effects = createJiraLinkingCardGlow({ haloRoot: cardContainer, backdropRoot: cardContainer, color, contained: true, direction: "left-to-right", trace: true });
		for (const effect of effects) effect.animation.onfinish = () => { effect.restore(); if (effect === effects.at(-1)) onStartedSessionRevealed?.(); };
		return () => { for (const effect of effects) { effect.animation.cancel(); effect.restore(); } };
	}, [feedRef, onStartedSessionRevealed, startedEntryId, startedSessionId, startedVisible, tintSeed]);
	useEffect(() => {
		if (!previewEntryId) return;
		const activity = activityRef.current;
		const root = activityScrollport(activity);
		const entry = [...(feedRef.current?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])].find((node) => node.dataset.jiraActivityEntryId === previewEntryId);
		if (!root || !entry) return;
		const offset = (headerRef.current?.getBoundingClientRect().height ?? 0) + 12;
		const target = root.scrollTop + entry.getBoundingClientRect().top - root.getBoundingClientRect().top - offset;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			root.scrollTo({ top: target, behavior: "auto" });
			return;
		}
		root.scrollTo({ top: target, behavior: "smooth" });
		const stop = () => root.scrollTo({ top: root.scrollTop, behavior: "instant" });
		root.addEventListener("wheel", stop, { passive: true });
		root.addEventListener("touchstart", stop, { passive: true });
		root.addEventListener("pointerdown", stop, { passive: true });
		return () => { stop(); root.removeEventListener("wheel", stop); root.removeEventListener("touchstart", stop); root.removeEventListener("pointerdown", stop); };
	}, [feedRef, headerRef, previewEntryId, rows.length, showSessions]);
	const sessionFor = (entryId: string) => {
		const id = projectButterSessionIdFromEntry(entryId);
		return id ? sessions.find((session) => session.id === id) : undefined;
	};
	const canSummarize = (entry: JiraActivityCommentEntry) => {
		const session = sessionFor(entry.id);
		return projectButterSessionIdFromEntry(entry.id) === null || (session !== undefined && getAgentSessionRole(session) === "owner");
	};
	const toggleTimelinePin = (entryId: string) => {
		const focused = document.activeElement instanceof HTMLButtonElement && document.activeElement.closest("[data-jira-activity-entry-id]")?.getAttribute("data-jira-activity-entry-id") === entryId;
		content.toggleCommentPin(entryId);
		if (!focused) return;
		requestAnimationFrame(() => {
			const row = [...(activityRef.current?.querySelectorAll<HTMLElement>("[data-project-butter-activity-feed] [data-jira-activity-entry-id]") ?? [])].find((node) => node.dataset.jiraActivityEntryId === entryId);
			row?.querySelector<HTMLButtonElement>('button[aria-label="Pin comment"], button[aria-label="Unpin comment"]')?.focus({ preventScroll: true });
		});
	};
	const renderEvent = (entry: JiraActivityEventEntry): ReactNode | undefined => {
		const item = content.auditChanges[entry.id] ?? HISTORY.get(entry.id);
		if (item && item.changes.length) return <ProjectButterHistoryChange actor={entry.actor} defaultOpen={expandedAudit} item={item} key={`${item.id}-${expandedAudit}`} timestamp={entry.timestamp} />;
		return entry.icon === "created" || entry.icon === "status" || entry.id.startsWith("merchant-agent-added-") ? <JiraActivityEvent className={ACTIVITY_EVENT_TEXT} entry={entry} /> : undefined;
	};
	const headerTime = visibleRow ? activityHeaderTimeLabel(visibleRow.timestamp || activityDayLabel(visibleRow)) : "";
	const header = (
		<JiraWorkItemTimeline
			actions={<div className="ml-auto flex items-center gap-1">
				<div className="flex items-center">
					<ProjectButterActivityFilterMenu
						expandDetails={expandedAudit}
						filters={filters}
						onExpandDetailsChange={setExpandedAudit}
						onFiltersChange={canFilterTimeline ? content.setActivityFilters : undefined}
						onSortChange={canFilterTimeline ? content.setActivitySort : undefined}
						sort={sort}
					/>
				</div>
				{sessionView ? (
					<div className="flex items-center" role="group" aria-label="Activity view">
					<Tooltip>
						<TooltipTrigger render={<Button aria-label="Timeline" aria-pressed={!showSessions} onClick={() => setView("timeline")} selectedAppearance="icon-only" size="icon" type="button" variant="ghost" />}><TimelineIcon label="" size="small" /></TooltipTrigger>
						<TooltipContent collisionAvoidance={{ side: "shift", align: "shift" }} positionerClassName="z-[650]" role="tooltip" side="top">Timeline</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger render={<Button aria-label="Agent sessions" aria-pressed={showSessions} onClick={() => {
							if (!showSessions) { setVisitedSessions(true); setSessionsActivatedAtMs(Date.now()); }
							setView("sessions");
						}} selectedAppearance="icon-only" size="icon" type="button" variant="ghost" />}><AiAgentIcon label="" size="small" /></TooltipTrigger>
						<TooltipContent collisionAvoidance={{ side: "shift", align: "shift" }} positionerClassName="z-[650]" role="tooltip" side="top">Agent sessions</TooltipContent>
					</Tooltip>
					</div>
				) : null}
			</div>}
			className="group/activity-header"
			data-project-butter-activity-header
			getPreviewLabel={activityDateLabel}
			headerTime={headerTime.charAt(0).toUpperCase() + headerTime.slice(1)}
			onSeek={seekToProgress}
			onSelect={scrollToEntry}
			progress={progress}
			ref={headerRef}
			rows={rows}
			showRail={false}
			stuck={!showSessions && stuck}
			visibleId={visibleId}
		/>
	);
	const views = (
		<>
			{header}
			<div hidden={showSessions}>
			<div hidden={showSessions} className={cn(FEED_ROWS, PINNED_THREAD_RAIL, SUMMARY_TRANSITION, THREAD_DISCLOSURE_SPACING, "[&_[data-jira-activity-entry-id]]:scroll-mt-28 [&_li:has([data-summary-inset='8'])_[data-slot=jira-activity-comment-header]:not([data-jira-activity-reply-header])]:ps-2 [&_li:has([data-summary-inset='24'])_[data-slot=jira-activity-comment-header]:not([data-jira-activity-reply-header])]:ps-6 [&_li:has([data-summary-inset='40'])_[data-slot=jira-activity-comment-header]:not([data-jira-activity-reply-header])]:ps-10", (previewEntryId || selectedReply) && "[&_[data-active]]:after:bg-bg-neutral-subtle-hovered! [&_[data-active]_[data-jira-activity-reply-toggle-icon]]:bg-linear-to-b [&_[data-active]_[data-jira-activity-reply-toggle-icon]]:from-bg-neutral-subtle-hovered [&_[data-active]_[data-jira-activity-reply-toggle-icon]]:to-bg-neutral-subtle-hovered")} data-project-butter-activity-feed data-project-butter-preview-session={previewSessionId ?? undefined} ref={showSessions ? null : feedRef}>
				<JiraActivity
					actorAvatarSize={24}
					actors={activityMentionAgents.map((agent) => ({ id: agent.id, name: agent.name, kind: "agent" as const, avatarSrc: agent.avatarSrc, brandName: agent.brandName }))}
					replyRequest={replyRequest}
					activeEntryId={selectedReply?.entryId ?? previewEntryId ?? visibleId ?? undefined}
					onSelectReply={onSelectReply}
					selectedReply={selectedReply}
					showReplySelection={false}
					commentActionsPlacement="hover"
					commentHeaderLayout="inline"
					earlierRepliesAppearance="link"
					earlierRepliesSelectedAppearance="icon-only"
					showEarlierRepliesIcon={false}
					composer={null}
					connectEntries
					fadeAfterLast={allRows.length > rows.length}
					connectorStyle="thread"
					positionLayoutKey={content.pinnedCommentIds.join("|")}
					separatorAfter={(entry, next) => content.pinnedCommentIds.includes(entry.id) && !content.pinnedCommentIds.includes(next.id) ? `${rows.filter((row) => content.pinnedCommentIds.includes(row.id)).length} pinned` : undefined}
					forceThreadConnector={(entry) => summaryFor(entry).summarized || content.pinnedCommentIds.includes(entry.id)}
					continueThreadAfterReplies={(entry) => summaryFor(entry).summarized}
					currentUser={content.currentUser}
					entries={rows.map((row) => row.kind === "comment" && canSummarize(row) && summaryFor(row).summarized ? { ...row, replyPreviewCount: 0 } : row)}
					hideHeader
					onEntriesChange={(entries) => {
						const ids = new Set(visible.map((entry) => entry.id));
						const createdAtMs = Date.now();
						const normalized = unpinProjectButterEntries(entries, content.activityEntries, content.pinnedCommentIds)
							.filter((entry) => !groups.has(entry.id))
							.map((entry) => entry.kind === "comment" ? { ...entry, replies: entry.replies?.map((reply) => ({ ...reply, createdAtMs: reply.createdAtMs ?? createdAtMs })) } : entry);
						const groupedEvents = rows.flatMap((row) => groups.get(row.id) ?? []);
						content.setActivityEntries((current) => [...current.filter((entry) => !ids.has(entry.id)), ...normalized, ...groupedEvents].sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0)));
					}}
					onReplyDraftChange={(entryId, value) => content.setReplyDrafts((current) => ({ ...current, [entryId]: value }))}
					onSubmitReply={(entry, body, mentionedAgentIds = []) => {
						const actorIds = [...new Set(mentionedAgentIds.flatMap((id) => {
							const agent = mentionAgentsById.get(id);
							return agent ? [agent.id] : [];
						}))];
						const session = sessionFor(entry.id);
						if (session && session.role !== "viewer") actorIds.push(session.agent.id ?? session.id);
						content.submitActivityReply(entry.id, body, [...new Set(actorIds)], { session });
						onReplySubmitted?.();
					}}
					onViewSession={(session) => onOpenSession(session.id)}
					renderCommentAction={(entry) => <><ProjectButterPinComment onToggle={() => toggleTimelinePin(entry.id)} pinned={content.pinnedCommentIds.includes(entry.id)} /><ProjectButterCopyCommentLink id={entry.id} /></>}
					renderCommentBody={(entry) => {
						const session = sessionFor(entry.id);
						if (session) return <><ProjectButterSessionStart hasReplies={Boolean(entry.replies?.length)} onOpen={onOpenSession} session={session} />{!entry.replies?.length ? <ProjectButterThreadEvents events={entry.activityEvents} /> : null}</>;
						return entry.body.every((segment) => segment.type === "text") ? <ProjectButterReferenceCommentBody agents={activityMentionAgents} markdown={jiraActivitySegmentsToPlainText(entry.body)} pullRequestStatus={entry.id === "merchant-merged" ? pullRequestStatus : undefined} /> : undefined;
					}}
					renderCommentAvatar={(entry, avatar) => canSummarize(entry) ? summaryFor(entry).renderAvatar(entry, avatar) : avatar}
					onRepliesExpandedChange={(entry, expanded) => { if (canSummarize(entry)) summaryFor(entry).setRepliesExpanded(expanded); }}
					renderCommentTools={(entry, reply, collapseReplies) => <><ProjectButterCommentTools content={content} entry={entry} reply={reply} />{reply || !canSummarize(entry) ? null : summaryFor(entry).renderAction(entry.replies ?? [], collapseReplies)}</>}
					renderCommentReplies={(entry, replies, expand, disclosure, expanded) => {
						if (!canSummarize(entry)) return <>{disclosure}{replies}<ProjectButterThreadEvents events={entry.activityEvents} /></>;
						const session = sessionFor(entry.id);
						const canDraft = session && onDraftSessionInstruction && matchingAgentSessions({ id: session.agent.id ?? session.id, name: session.agent.name }, [session], { includeCompleted: true }).length > 0;
						return <>{summaryFor(entry).renderReplies(replies, expand, summarizeReplies(entry.replies ?? []), canDraft ? (sources) => onDraftSessionInstruction({ entry, session }, draftThreadInstruction(sources)) : undefined, { disclosure, expanded })}<ProjectButterThreadEvents events={entry.activityEvents} /></>;
					}}
					renderEarlierRepliesLabel={renderProjectButterEarlierRepliesLabel}
					replyCollapseKey={(entry) => latestReplyEntryIds?.has(entry.id) ? `reply:${latestVisibleActivityReply(entry, showAgentReplyProgress)?.id}` : content.pinnedCommentIds.includes(entry.id) ? `pinned:${entry.id}` : undefined}
					renderReplyComposer={(composer) => {
						const request = replyRequest?.entryId === composer.entryId && replyRequest.id === composer.requestId ? replyRequest : undefined;
						const prefill = request?.prefill;
						const agent = prefill ? mentionAgents.find((candidate) => candidate.name === prefill.agentName) : undefined;
						const item = agent ? mapAgentToMentionItem(agent) : undefined;
						const mention = item && prefill && !composer.value.includes(`@[${item.id}]`) ? { mention: item, textAfter: prefill.preserveContent ? " " : prefill.text ? ` ${prefill.text}` : " ", preserveContent: prefill.preserveContent } : composer.prefillMention;
						const autoFocus = composer.autoFocus && (!request || replyFocusId === undefined || replyFocusId === composer.entryId);
						const editor = <ProjectButterCommentEditor agents={mentionAgents} ariaLabel="Reply editor" elevation="flat" focusRequest={autoFocus ? 1 : 0} handoffMentionId={item?.id} mentionHandoffPending={pendingReplyId === composer.entryId} onHandoffInterrupt={onReplyHandoffInterrupt} onSave={(body, _plainText, mentionedAgentIds) => composer.onSubmit(body, mentionedAgentIds)} onValueChange={composer.onValueChange} placeholder={composer.placeholder} prefillMention={mention} textboxLabel={composer.placeholder} value={composer.value} />;
						const session = request ? sessionFor(composer.entryId) : undefined;
						return session ? <RovoGeneration.Highlight active={traceReplyId === replyRequest?.id} className="block w-full" color={agentSessionAccentColor(session)} delay={0} duration={motionDuration.slowest * 2} onHighlightComplete={() => { if (replyRequest) onReplyTraceComplete?.(replyRequest.id); }} origin="left-center">{editor}</RovoGeneration.Highlight> : editor;
					}}
					renderEntry={(entry) => {
						if (entry.kind !== "event") return undefined;
						const group = groups.get(entry.id);
						return group ? (
							<ProjectButterUpdateGroup defaultOpen={expandedAudit} events={group} key={`${entry.id}-${expandedAudit}`} renderEvent={(event) => renderEvent(event) ?? <JiraActivityEvent className={ACTIVITY_EVENT_TEXT} entry={event} />} summary={jiraActivitySegmentsToPlainText(entry.segments)} timestamp={entry.timestamp} />
						) : renderEvent(entry);
					}}
					renderReplyBody={(reply) => <ProjectButterReferenceCommentBody agents={activityMentionAgents} markdown={reply.body} pullRequestStatus={reply.id === "merchant-pr" || reply.id === "merchant-fix" ? pullRequestStatus : undefined} />}
					renderReplyFooter={(reply) => reply.visibility === "private" && reply.generationStartedAtMs === undefined ? <ProjectButterAgentReplyAction reply={reply} onPublish={content.publishActivityReply} /> : null}
					renderReply={(reply) => reply.generationStartedAtMs === undefined ? undefined : showAgentReplyProgress ? <AgentReplyProgress startedAtMs={reply.generationStartedAtMs} /> : null}
					renderTimestamp={(item) => <ProjectButterTimestamp item={item} />}
					replyDrafts={content.replyDrafts}
					sortOrder="ascending"
				/>
			</div>
			{!showSessions && allRows.length > rows.length ? (
				<Button className="mt-3" onClick={() => setLimit(rows.length + 10)} type="button" variant="ghost">
					Show more activity
				</Button>
			) : null}
			</div>
			{sessionView && visitedSessions ? (
				<div hidden={!showSessions} ref={showSessions ? feedRef : null}>
					<ProjectButterActivitySessionThreads
						active={showSessions}
						activatedAtMs={sessionsActivatedAtMs}
						pinnedIds={content.pinnedCommentIds}
						onTogglePin={content.toggleCommentPin}
						entries={content.activityEntries.flatMap((entry) => {
							const session = entry.kind === "comment" ? sessionFor(entry.id) : undefined;
							return session && entry.kind === "comment" ? [{ entry, session }] : [];
						}).sort((a, b) => (b.entry.createdAtMs ?? 0) - (a.entry.createdAtMs ?? 0))}
						sessions={sessions}
						currentUser={content.currentUser}
						selectedReply={selectedReply}
						onSelectReply={onSelectReply}
						onDraft={onDraftSessionInstruction}
						onOpenSession={onOpenSession}
						latestReplyEntryIds={latestReplyEntryIds}
						showAgentReplyProgress={showAgentReplyProgress}
						onEntriesChange={([updated]) => {
							if (updated?.kind !== "comment") return;
							const [canonical] = unpinProjectButterEntries([updated], content.activityEntries, content.pinnedCommentIds);
							if (canonical?.kind !== "comment") return;
							const { replyPreviewCount: _preview, defaultRepliesExpanded: _expanded, ...changes } = canonical;
							content.setActivityEntries((entries) => entries.map((entry) => entry.id === updated.id ? { ...entry, ...changes } : entry));
						}}
						renderCommentTools={(entry, reply) => <ProjectButterCommentTools content={content} entry={entry} reply={reply} />}
						renderReplyBody={(reply) => <ProjectButterReferenceCommentBody agents={activityMentionAgents} markdown={reply.body} />}
						renderReplyFooter={(reply) => reply.visibility === "private" && reply.generationStartedAtMs === undefined ? <ProjectButterAgentReplyAction reply={reply} onPublish={content.publishActivityReply} /> : null}
						renderReply={(reply) => reply.generationStartedAtMs === undefined ? undefined : showAgentReplyProgress ? <AgentReplyProgress startedAtMs={reply.generationStartedAtMs} /> : null}
						renderTimestamp={(item) => <ProjectButterTimestamp item={item} />}
					/>
				</div>
			) : null}
		</>
	);
	return (
		<section aria-label="Activity" className="min-w-0" data-project-butter-activity ref={activityRef}>
			{views}
		</section>
	);
}
