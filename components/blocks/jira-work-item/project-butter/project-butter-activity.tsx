"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { JiraActivity, jiraActivitySegmentsToPlainText, type JiraActivityEntry, type JiraActivityEventEntry, type JiraActivityReply } from "@/components/blocks/jira-activity";
import { JiraActivityEvent } from "@/components/blocks/jira-activity/jira-activity-event";
import { mapAgentToMentionItem } from "@/components/blocks/editor-palette/data/mention-sources";
import { createJiraLinkingCardGlow } from "@/components/blocks/jira-linking/card-glow";
import { resolveJiraLinkingGlowColor } from "@/components/blocks/jira-linking/glow-motion";
import { resolveJiraLinkingIdentityTint } from "@/components/blocks/jira-linking/use-jira-linking-atlas";
import { agentSessionTintSeed } from "@/components/blocks/agent-session/agent-session-transfer-member";
import { resolveAgentBrandTint, resolveAgentBrandTintVariable } from "@/components/blocks/agent-session/agent-brand-tint";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { ProjectButterCommentEditor } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-editor";
import { useProjectButterMentionAgents } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-mention-agents";
import { cn } from "@/lib/utils";
import {
	groupProjectButterUpdates,
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
import { ProjectButterSessionStart } from "@/components/blocks/jira-work-item/project-butter/activity-session-start";
import { ProjectButterActivityTimeline } from "@/components/blocks/jira-work-item/project-butter/activity-timeline";
import { activityDayLabel, activityHeaderTimeLabel } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import { ProjectButterUpdateGroup } from "@/components/blocks/jira-work-item/project-butter/activity-update-group";
import { activityScrollport, useProjectButterActivityNavigation } from "@/components/blocks/jira-work-item/project-butter/use-activity-navigation";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { PROJECT_BUTTER_REFERENCE_HISTORY } from "@/components/blocks/jira-work-item/project-butter/reference-data";
import {
	ProjectButterHistoryChange,
	ProjectButterReferenceCommentBody,
} from "@/components/blocks/jira-work-item/project-butter/reference-activity-body";

const HISTORY = new Map(PROJECT_BUTTER_REFERENCE_HISTORY.map((item) => [item.id, item]));
const ACTIVITY_EVENT_TEXT = "text-sm text-text [&_[data-jira-activity-agent-mention]]:align-[-0.2em] [&_[data-jira-activity-user-mention]]:align-[-0.2em]";
/** Soft hover plate behind each comment thread, on its own isolated layer. Literal strings so Tailwind's scanner sees every class. */
const FEED_ROWS = [
	"[&>div>ol>li]:relative [&>div>ol>li]:isolate",
	"[&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:pointer-events-none [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:absolute [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:-inset-x-2 [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:-top-2 [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:bottom-3 [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:-z-10 [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:rounded-lg [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:transition-colors [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:duration-xxshort [&>div>ol>li[data-jira-activity-entry-kind=comment]]:after:ease-out-practical [&>div>ol>li[data-jira-activity-entry-kind=comment]]:hover:after:bg-bg-neutral-subtle-hovered",
	"[&>div>ol>li[data-jira-activity-entry-kind=comment]:has(>div.pb-6)]:after:bottom-4 [&>div>ol>li[data-jira-activity-entry-kind=comment]:has(>div.pb-4)]:after:bottom-2",
	"[&>div>ol>li[data-jira-activity-entry-kind=comment]:hover_[data-jira-activity-reply-toggle-icon]]:bg-linear-to-b [&>div>ol>li[data-jira-activity-entry-kind=comment]:hover_[data-jira-activity-reply-toggle-icon]]:from-bg-neutral-subtle-hovered [&>div>ol>li[data-jira-activity-entry-kind=comment]:hover_[data-jira-activity-reply-toggle-icon]]:to-bg-neutral-subtle-hovered",
].join(" ");

/**
 * Hidden-reply participants, side by side with a 2px gap. An overlapping AvatarGroup paints a
 * page-colored separator behind each face, which shows as a white rim on the thread's hover plate.
 */
function ReplyFaces({ replies }: Readonly<{ replies: readonly JiraActivityReply[] }>) {
	const actors = [...new Map(replies.map((reply) => [reply.actor.id, reply.actor])).values()].slice(-3).reverse();
	return (
		<span aria-label={`Reply participants: ${actors.map((actor) => actor.name).join(", ")}`} className="flex shrink-0 gap-0.5" role="group">
			{actors.map((actor) => actor.kind === "person" ? (
				<Avatar animate={false} aria-hidden key={actor.id} size="xs">
					{actor.avatarSrc ? <AvatarImage alt="" src={actor.avatarSrc} /> : null}
					<AvatarFallback>{actor.name.slice(0, 1)}</AvatarFallback>
				</Avatar>
			) : (
				<AgentAvatarVisual animate={false} appearance={actor.appearance} avatarSrc={actor.avatarSrc} brandName={actor.brandName} fallbackText={actor.name.slice(0, 1)} key={actor.id} label={actor.name} sizePx={16} vpkLogo={actor.vpkLogo} />
			))}
		</span>
	);
}

function earlierRepliesLabel(hidden: readonly JiraActivityReply[], expanded: boolean): ReactNode {
	return expanded ? "Hide replies" : <><ReplyFaces replies={hidden} /><span>Show {hidden.length} more {hidden.length === 1 ? "reply" : "replies"}</span></>;
}

export function ProjectButterActivity({
	content,
	empty,
	sidePanel,
	sessions,
	onOpenSession,
	previewSessionId,
	replyRequest,
	startedSessionId,
	onStartedSessionRevealed,
	singleView = false,
}: Readonly<{
	content: ProjectButterContent;
	empty: boolean;
	sidePanel: boolean;
	sessions: readonly ProjectButterSessionItem[];
	onOpenSession: (id: string) => void;
	previewSessionId?: string | null;
	replyRequest?: Readonly<{ entryId: string; id: number }> | null;
	startedSessionId?: string | null;
	onStartedSessionRevealed?: () => void;
	singleView?: boolean;
}>) {
	const activityRef = useRef<HTMLElement>(null);
	const [expandedAudit, setExpandedAudit] = useState(false);
	const [limit, setLimit] = useState(10);
	const filters = singleView ? PROJECT_BUTTER_ACTIVITY_FILTERS_ALL : content.activityFilters;
	const sort = singleView ? "newest" : content.activitySort;
	const mentionAgents = useProjectButterMentionAgents(sessions);
	const activityMentionAgents = useMemo(() => [...sessions.map((session) => ({ ...session.agent, id: session.agent.id ?? session.id, byline: "Agent on this work item" })), ...mentionAgents], [sessions, mentionAgents]);
	const mentionAgentsById = useMemo(() => new Map(activityMentionAgents.map((agent) => [mapAgentToMentionItem(agent).id, agent])), [activityMentionAgents]);
	const ordered = useMemo(() => pinProjectButterComments(selectProjectButterActivity(content.activityEntries, filters, sort), content.pinnedCommentIds), [content.activityEntries, content.pinnedCommentIds, filters, sort]);
	const previewEntryId = previewSessionId ? ordered.find((entry) => entry.id === `invocation-${previewSessionId}`)?.id : undefined;
	const pullRequestStatus = content.activityEntries.some((entry) => entry.id === "merchant-merged") ? "Merged" : "Open";
	// The work item feed folds adjacent updates; the Butter project's scripted journey (single view) keeps each step on its own row.
	const { entries: allRows, groups } = useMemo<{ entries: readonly JiraActivityEntry[]; groups: ProjectButterUpdateGroups }>(() => singleView ? { entries: ordered, groups: new Map() } : groupProjectButterUpdates(ordered, (entry) => {
		const item = content.auditChanges[entry.id] ?? HISTORY.get(entry.id);
		return item?.changes.length ? item.changes.map((change) => change.label) : entry.icon === "status" ? ["status"] : [];
	}), [ordered, content.auditChanges, singleView]);
	// The page limit counts rendered rows, so an update group is one row however many changes it holds.
	const rowIndex = (id: string | null | undefined) => id ? allRows.findIndex((row) => row.id === id || groups.get(row.id)?.some((entry) => entry.id === id)) : -1;
	const startedEntryId = startedSessionId ? `invocation-${startedSessionId}` : null;
	const previewLimit = rowIndex(previewEntryId) + 1;
	if (previewLimit > limit) setLimit(previewLimit);
	const rows = allRows.slice(0, Math.max(limit, rowIndex(content.activityFocusId) + 1, previewLimit, rowIndex(startedEntryId) + 1));
	const visible = rows.flatMap<JiraActivityEntry>((row) => groups.get(row.id) ?? [row]);
	const { feedRef, headerRef, progress, scrollToEntry, seekToProgress, stuck, visibleId } = useProjectButterActivityNavigation(rows, sidePanel, content.activityFocusId);
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
		const entry = [...(activity?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])].find((node) => node.dataset.jiraActivityEntryId === previewEntryId);
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
	}, [headerRef, previewEntryId, rows.length]);
	const sessionFor = (entryId: string) => {
		const id = projectButterSessionIdFromEntry(entryId);
		return id ? sessions.find((session) => session.id === id) : undefined;
	};
	const renderEvent = (entry: JiraActivityEventEntry): ReactNode | undefined => {
		const item = content.auditChanges[entry.id] ?? HISTORY.get(entry.id);
		if (item && item.changes.length) return <ProjectButterHistoryChange actor={entry.actor} defaultOpen={expandedAudit} item={item} key={`${item.id}-${expandedAudit}`} timestamp={entry.timestamp} />;
		if (entry.id.startsWith("merchant-agent-added-")) return (
			<div className="flex min-w-0 flex-wrap items-center">
				<JiraActivityEvent className={ACTIVITY_EVENT_TEXT} entry={{ ...entry, showTimestamp: false }} />
				<span className="ml-2 shrink-0 text-xs text-text-subtlest">{entry.timestamp}</span>
			</div>
		);
		return entry.icon === "created" || entry.icon === "status" ? <JiraActivityEvent className={ACTIVITY_EVENT_TEXT} entry={entry} /> : undefined;
	};
	const headerTime = visibleRow ? activityHeaderTimeLabel(visibleRow.timestamp || activityDayLabel(visibleRow)) : "";
	const header = (
		<div className="sticky top-0 z-20 -mx-1 mb-3 flex shrink-0 items-center gap-4 bg-surface px-1 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-surface after:to-transparent" data-project-butter-activity-header data-stuck={stuck || undefined} ref={headerRef}>
			{/* Once the header sticks, the visible row's relative time stands in for the title; the h2 keeps its name for assistive tech. */}
			<div className="shrink-0 text-sm font-medium text-text">
				{/* Classes sit on the h2 itself: the base h2 heading font would otherwise win over the wrapper's inherited text-sm. */}
				<h2 className={cn("text-sm font-medium text-text", stuck && visibleRow ? "sr-only" : undefined)}>Activity</h2>
				{stuck && visibleRow ? <span aria-hidden data-project-butter-activity-header-time>{headerTime.charAt(0).toUpperCase() + headerTime.slice(1)}</span> : null}
			</div>
			<ProjectButterActivityTimeline onSeek={seekToProgress} onSelect={scrollToEntry} progress={progress} rows={rows} visibleId={visibleId} />
			<div className={cn("ml-auto flex items-center gap-1", empty ? "pointer-events-none opacity-0 transition-opacity duration-normal ease-out group-hover/activity:pointer-events-auto group-hover/activity:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:opacity-100 has-[[aria-expanded=true]]:pointer-events-auto has-[[aria-expanded=true]]:opacity-100" : null)}>
				<ProjectButterActivityFilterMenu
					expandDetails={expandedAudit}
					filters={filters}
					onExpandDetailsChange={setExpandedAudit}
					onFiltersChange={singleView ? undefined : content.setActivityFilters}
					onSortChange={singleView ? undefined : content.setActivitySort}
					sort={sort}
				/>
			</div>
		</div>
	);
	return (
		<section aria-label="Activity" className="group/activity min-w-0" data-project-butter-activity ref={activityRef}>
			{header}
			<div className={cn(FEED_ROWS, "[&_[data-jira-activity-entry-id]]:scroll-mt-28", previewEntryId && "[&_[data-active]]:after:bg-bg-neutral-subtle-hovered! [&_[data-active]_[data-jira-activity-reply-toggle-icon]]:bg-linear-to-b [&_[data-active]_[data-jira-activity-reply-toggle-icon]]:from-bg-neutral-subtle-hovered [&_[data-active]_[data-jira-activity-reply-toggle-icon]]:to-bg-neutral-subtle-hovered")} data-project-butter-activity-feed data-project-butter-preview-session={previewSessionId ?? undefined} ref={feedRef}>
				<JiraActivity
					actors={activityMentionAgents.map((agent) => ({ id: agent.id, name: agent.name, kind: "agent" as const, avatarSrc: agent.avatarSrc, brandName: agent.brandName }))}
					replyRequest={replyRequest}
					activeEntryId={previewEntryId ?? visibleId ?? undefined}
					commentActionsPlacement="hover"
					commentHeaderLayout="inline"
					composer={null}
					connectorStyle="thread"
					currentUser={content.currentUser}
					entries={rows}
					fadeAfterLast
					hideHeader
					onEntriesChange={(entries) => {
						const ids = new Set(visible.map((entry) => entry.id));
						const createdAtMs = Date.now();
						// Pinned rows are presentation clones; restore their stored tag before writing back.
						const normalized = unpinProjectButterEntries(entries, content.activityEntries)
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
						content.submitActivityReply(entry.id, body, actorIds);
					}}
					onViewSession={(session) => onOpenSession(session.id)}
					renderCommentAction={(entry) => <><ProjectButterPinComment onToggle={() => content.toggleCommentPin(entry.id)} pinned={content.pinnedCommentIds.includes(entry.id)} /><ProjectButterCopyCommentLink id={entry.id} /></>}
					renderCommentBody={(entry) => {
						const session = sessionFor(entry.id);
						if (session) return <ProjectButterSessionStart onOpen={onOpenSession} session={session} />;
						return entry.body.every((segment) => segment.type === "text") ? <ProjectButterReferenceCommentBody agents={activityMentionAgents} markdown={jiraActivitySegmentsToPlainText(entry.body)} pullRequestStatus={entry.id === "merchant-merged" ? pullRequestStatus : undefined} /> : undefined;
					}}
					renderCommentTools={(entry, reply) => <ProjectButterCommentTools content={content} entry={entry} reply={reply} />}
					renderEarlierRepliesLabel={earlierRepliesLabel}
					renderReplyComposer={(composer) => <ProjectButterCommentEditor agents={mentionAgents} ariaLabel="Reply editor" elevation="flat" focusRequest={composer.autoFocus ? 1 : 0} onSave={(body, _plainText, mentionedAgentIds) => composer.onSubmit(body, mentionedAgentIds)} onValueChange={composer.onValueChange} placeholder={composer.placeholder} prefillMention={composer.prefillMention} textboxLabel={composer.placeholder} value={composer.value} />}
					renderEntry={(entry) => {
						if (entry.kind !== "event") return undefined;
						const group = groups.get(entry.id);
						return group ? (
							<ProjectButterUpdateGroup defaultOpen={expandedAudit} events={group} key={`${entry.id}-${expandedAudit}`} renderEvent={(event) => renderEvent(event) ?? <JiraActivityEvent className={ACTIVITY_EVENT_TEXT} entry={event} />} summary={jiraActivitySegmentsToPlainText(entry.segments)} timestamp={entry.timestamp} />
						) : renderEvent(entry);
					}}
					renderReplyBody={(reply) => <ProjectButterReferenceCommentBody agents={activityMentionAgents} markdown={reply.body} pullRequestStatus={reply.id === "merchant-pr" || reply.id === "merchant-fix" ? pullRequestStatus : undefined} />}
					renderTimestamp={(item) => <ProjectButterTimestamp item={item} />}
					replyDrafts={content.replyDrafts}
					sortOrder="ascending"
				/>
			</div>
			{allRows.length > rows.length ? (
				<Button className="mt-3" onClick={() => setLimit(rows.length + 10)} type="button" variant="ghost">
					Show more activity
				</Button>
			) : null}
		</section>
	);
}
