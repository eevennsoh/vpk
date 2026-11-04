"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTransform } from "motion/react";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { AgentSession } from "@/components/blocks/agent-session";
import { JiraActivity, jiraActivitySegmentsToPlainText } from "@/components/blocks/jira-activity";
import { ScrubberRail } from "@/components/blocks/scrubber/components/scrubber-rail";
import type { ScrubberEntry } from "@/components/blocks/scrubber/lib/scrubber-entries";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	activityDateLabel,
	activityDayLabel,
} from "@/components/blocks/jira-work-item/project-butter/activity-data";
import {
	selectProjectButterActivity,
	type ProjectButterActivitySort,
} from "@/components/blocks/jira-work-item/project-butter/activity-feed-model";
import {
	ProjectButterCommentTools,
	ProjectButterCopyCommentLink,
	ProjectButterTimestamp,
} from "@/components/blocks/jira-work-item/project-butter/activity-comment-tools";
import { ProjectButterAgentResponse } from "@/components/blocks/jira-work-item/project-butter/activity-agent-response";
import { activityScrollport, useProjectButterActivityNavigation } from "@/components/blocks/jira-work-item/project-butter/use-activity-navigation";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { PROJECT_BUTTER_REFERENCE_HISTORY } from "@/components/blocks/jira-work-item/project-butter/reference-data";
import {
	ProjectButterHistoryChange,
	ProjectButterReferenceCommentBody,
} from "@/components/blocks/jira-work-item/project-butter/reference-activity-body";

const HISTORY = new Map(PROJECT_BUTTER_REFERENCE_HISTORY.map((item) => [item.id, item]));
const SORTS: readonly { value: ProjectButterActivitySort; label: string }[] = [
	{ value: "newest", label: "Newest first" },
	{ value: "oldest", label: "Oldest first" },
	{ value: "agents", label: "Agents first" },
	{ value: "comments", label: "Comments first" },
];

export function ProjectButterActivity({
	content,
	empty,
	sidePanel,
	sessions,
	onOpenSession,
	previewSessionId,
	singleView = false,
}: Readonly<{
	content: ProjectButterContent;
	empty: boolean;
	sidePanel: boolean;
	sessions: readonly ProjectButterSessionItem[];
	onOpenSession: (id: string) => void;
	previewSessionId?: string | null;
	singleView?: boolean;
}>) {
	const activityRef = useRef<HTMLElement>(null);
	const [expandedAudit, setExpandedAudit] = useState(false);
	const [limit, setLimit] = useState(10);
	const [hoverId, setHoverId] = useState<string | null>(null);
	const view = singleView ? "Activity" : content.activityView;
	const ordered = useMemo(
		() => selectProjectButterActivity(content.activityEntries, view, content.activitySort, singleView || content.showAuditInActivity),
		[content.activityEntries, view, content.activitySort, singleView, content.showAuditInActivity],
	);
	const previewEntryId = ordered.find((entry) => entry.id === `invocation-${previewSessionId}` || entry.kind === "comment" && (entry.sessionItem?.id === previewSessionId || entry.replies?.some((reply) => reply.sessionItem?.id === previewSessionId)))?.id;
	const visible = useMemo(
		() =>
			ordered.slice(
				0,
				Math.max(limit, ordered.findIndex((entry) => entry.id === content.activityFocusId) + 1, ordered.findIndex((entry) => entry.id === previewEntryId) + 1),
			),
		[ordered, limit, content.activityFocusId, previewEntryId],
	);
	const needsInput = sessions
		.filter((session) => session.state === "needs-input")
		.sort((a, b) => (b.invokedAtMs ?? 0) - (a.invokedAtMs ?? 0));
	const { feedRef, headerRef, timelineRef, progress, entryOffsets, scrollToEntry, seekToProgress, visibleId } = useProjectButterActivityNavigation(
		visible,
		sidePanel,
		content.activityFocusId,
		view,
	);
	useEffect(() => {
		if (!previewSessionId) return;
		const activity = activityRef.current;
		const root = activityScrollport(activity);
		const entry = previewEntryId
			? [...(activity?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])].find((node) => node.dataset.jiraActivityEntryId === previewEntryId)
			: [...(activity?.querySelectorAll<HTMLElement>("[data-project-butter-needs-input-session]") ?? [])].find((node) => node.dataset.projectButterNeedsInputSession === previewSessionId);
		if (!root || !entry) return;
		const offset = (headerRef.current?.getBoundingClientRect().height ?? 0) + (previewEntryId ? timelineRef.current?.getBoundingClientRect().height ?? 0 : 0) + 12;
		root.scrollTo({ top: root.scrollTop + entry.getBoundingClientRect().top - root.getBoundingClientRect().top - offset, behavior: "auto" });
	}, [headerRef, previewEntryId, previewSessionId, timelineRef, visible.length]);
	const activeOffset = useTransform(progress, (value) => 0.02 + value * 0.96);
	const activeIndex = Math.max(
		0,
		visible.findIndex((entry) => entry.id === visibleId),
	);
	const railEntries: ScrubberEntry[] = visible.map((entry, index) => ({
		id: entry.id,
		kind: "minor",
		offset: 0.02 + (entryOffsets[entry.id] ?? (visible.length < 2 ? 0 : index / (visible.length - 1))) * 0.96,
		heading: activityDateLabel(entry),
		label: `Go to step ${index + 1}: ${entry.actor.name}: ${entry.kind === "comment" ? jiraActivitySegmentsToPlainText(entry.body) : entry.kind === "event" ? jiraActivitySegmentsToPlainText(entry.segments) : entry.summary}`,
	}));
	const preview = railEntries.find((entry) => entry.id === hoverId);
	const feed = (
		<>
			{view === "Activity" && needsInput.length > 0 ? (
				<section aria-label="Needs input" className="mb-6 space-y-1">
					<h3 className="mb-2 text-xs font-medium text-text-subtle">Needs input</h3>
					{needsInput.map((session) => (
						<div className={cn("rounded-lg border border-border", previewSessionId === session.id && "bg-bg-selected ring-2 ring-border-focused")} data-project-butter-needs-input-session={session.id} key={session.id}>
							<AgentSession
								animateLayout={false}
								density="long"
								items={[session]}
								onView={(item) => onOpenSession(item.id)}
								showBranch
								showLinkWorkItemMenuItem={false}
								variant="large"
							/>
						</div>
					))}
				</section>
			) : null}
			{visible.length > 0 ? (
				<div className="sticky top-14 z-10 -mx-1 mb-5 flex h-11 shrink-0 items-center gap-6 bg-surface px-1 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-surface after:to-transparent" data-project-butter-activity-timeline ref={timelineRef}>
					<span className="shrink-0 text-xs text-text-subtle">
						{visible[activeIndex] ? activityDayLabel(visible[activeIndex]) : "Today"}
					</span>
					<div className="relative min-w-0 flex-1">
						{preview ? (
							<span className="pointer-events-none absolute -top-3 z-10 whitespace-nowrap rounded-sm bg-surface px-1 text-xs text-text-subtle"
								style={{ left: `${preview.offset * 100}%`, transform: `translateX(-${preview.offset * 100}%)` }}>
								{preview.heading}
							</span>
						) : null}
						<ScrubberRail
							activeIndex={activeIndex}
							activeOffset={activeOffset}
							appearance="dots"
							ariaLabel="Navigate activity"
							entries={railEntries}
							onFocusChange={setHoverId}
							onHoverChange={setHoverId}
							onSelect={scrollToEntry}
							onSeek={(offset) => seekToProgress((offset - 0.02) / 0.96)}
							selectionMode="drag"
							showPill={false}
						/>
					</div>
				</div>
			) : null}
			<div className={cn("[&_[data-jira-activity-entry-id]]:scroll-mt-28", previewEntryId && "[&_[data-active]]:rounded-md [&_[data-active]]:bg-bg-selected [&_[data-active]]:ring-2 [&_[data-active]]:ring-border-focused")} data-project-butter-activity-feed data-project-butter-preview-session={previewSessionId ?? undefined} ref={feedRef}>
				<JiraActivity
					activeEntryId={previewEntryId ?? visible[activeIndex]?.id}
					commentHeaderLayout="inline"
					composer={null}
				connectorStyle={view === "Activity" ? "thread" : "timeline"}
					currentUser={content.currentUser}
					entries={visible}
					hideHeader
					onViewSession={(session) => onOpenSession(session.id)}
					onEntriesChange={(entries) => {
						const ids = new Set(visible.map((entry) => entry.id));
						const createdAtMs = Date.now();
						const normalized = entries.map((entry) =>
							entry.kind === "comment"
								? {
										...entry,
										replies: entry.replies?.map((reply) => ({
											...reply,
											createdAtMs: reply.createdAtMs ?? createdAtMs,
										})),
									}
								: entry,
						);
						content.setActivityEntries((current) =>
							[...current.filter((entry) => !ids.has(entry.id)), ...normalized].sort(
								(a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0),
							),
						);
					}}
					onReplyDraftChange={(entryId, value) =>
						content.setReplyDrafts((current) => ({ ...current, [entryId]: value }))
					}
					replyDrafts={content.replyDrafts}
					renderCommentAction={(entry) => <ProjectButterCopyCommentLink id={entry.id} />}
					renderCommentBody={(entry) =>
						entry.body.every((segment) => segment.type === "text") ? (
							<ProjectButterReferenceCommentBody
								markdown={jiraActivitySegmentsToPlainText(entry.body)}
							/>
						) : undefined
					}
					renderCommentTools={(entry, reply) => (
						<ProjectButterCommentTools content={content} entry={entry} reply={reply} />
					)}
					renderEntry={(entry) => {
						const item = content.auditChanges[entry.id] ?? HISTORY.get(entry.id);
						return item && item.changes.length ? (
							<ProjectButterHistoryChange
								defaultOpen={expandedAudit}
								item={item}
								key={`${item.id}-${expandedAudit}`}
								timestamp={entry.timestamp}
							/>
						) : undefined;
					}}
					renderReply={(reply) => sessions.some((session) => `response-${session.id}` === reply.id) ? (
						<ProjectButterAgentResponse onOpen={onOpenSession} reply={reply} sessions={sessions} />
					) : undefined}
					renderReplyBody={(reply) => <ProjectButterReferenceCommentBody markdown={reply.body} />}
					renderTimestamp={(item) => <ProjectButterTimestamp item={item} />}
				/>
			</div>
			{view === "Audit" && ordered.length === 0 ? (
				<p className="py-4 text-sm text-text-subtle">No audit updates yet.</p>
			) : null}
			{ordered.length > visible.length ? (
				<Button
					className="mt-3"
					onClick={() => setLimit(visible.length + 10)}
					type="button"
					variant="ghost"
				>
					Show more {view === "Audit" ? "audit updates" : "activity"}
				</Button>
			) : null}
		</>
	);
	const header = (
				<div className="sticky top-0 z-20 -mx-1 flex h-14 shrink-0 items-center justify-between gap-3 bg-surface px-1 py-3" data-project-butter-activity-header ref={headerRef}>
					{singleView ? <h2 className="text-sm font-semibold text-text">Activity</h2> : <TabsList aria-label="Activity views">
						<TabsTrigger
							aria-label={`Activity${needsInput.length ? ` ${needsInput.length} need input` : ""}`}
							value="Activity"
						>
							Activity
							{needsInput.length ? (
								<span aria-hidden className="ml-1 inline-flex items-center gap-1">
									<span className="text-icon-information">
										<span className="block size-1.5 rounded-full bg-current" />
									</span>
									{needsInput.length}
								</span>
							) : null}
						</TabsTrigger>
						<TabsTrigger value="Audit">Audit</TabsTrigger>
					</TabsList>}
					<div className={cn("flex items-center gap-1", empty ? "pointer-events-none opacity-0 transition-opacity duration-normal ease-out group-hover/activity:pointer-events-auto group-hover/activity:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:opacity-100 has-[[aria-expanded=true]]:pointer-events-auto has-[[aria-expanded=true]]:opacity-100 motion-reduce:transition-none" : null)}>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										aria-label="More activity actions"
										className="[&_svg]:text-icon-subtle aria-expanded:[&_svg]:text-icon-subtle"
										size="icon-compact"
										type="button"
										variant="ghost"
									/>
								}
							>
								<ShowMoreHorizontalIcon label="" size="small" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" positionerClassName="z-[650]">
								<DropdownMenuRadioGroup
									onValueChange={(value) => {
										const selected = SORTS.find((sort) => sort.value === value);
										if (selected) content.setActivitySort(selected.value);
									}}
									value={content.activitySort}
								>
									{SORTS.map((sort) => (
										<DropdownMenuRadioItem key={sort.value} value={sort.value}>
											{sort.label}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
								{singleView || view === "Audit" ? (
									<DropdownMenuCheckboxItem
										checked={expandedAudit}
										onCheckedChange={setExpandedAudit}
									>
										{singleView ? "Expand change details" : "Expand audit details"}
									</DropdownMenuCheckboxItem>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
	);
	return (
		<section
			aria-label="Activity"
			className="group/activity min-w-0"
			data-project-butter-activity
			ref={activityRef}
		>
			{singleView ? <>{header}<div className="min-w-0">{feed}</div></> : <>
			<h2 className="sr-only">Activity</h2>
			<Tabs
				onValueChange={(value) => {
					if (value === "Activity" || value === "Audit") content.setActivityView(value);
				}}
				value={view}
			>
				{header}
				<TabsContent className="mt-0 min-w-0" value="Activity">
					{view === "Activity" ? feed : null}
				</TabsContent>
				<TabsContent className="mt-0 min-w-0" value="Audit">
					{view === "Audit" ? feed : null}
				</TabsContent>
			</Tabs></>}
		</section>
	);
}
