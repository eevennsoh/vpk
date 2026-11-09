"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { AgentListItem } from "@/components/blocks/agent-list";
import { StickyRowScrollFade } from "@/components/visual/scroll-mask";
import { cn } from "@/lib/utils";

import { JIRA_ACTIVITY_CURRENT_USER, JIRA_ACTIVITY_ENTRIES } from "./data";
import { JiraActivityChangedFiles } from "./jira-activity-changed-files";
import { JiraActivityComment, type JiraActivityReplyComposerProps } from "./jira-activity-comment";
import type { JiraActivityCardProps } from "./jira-activity-card";
import { JiraActivityComposer } from "./jira-activity-composer";
import { JiraActivityEvent } from "./jira-activity-event";
import { JiraActivityHeader } from "./jira-activity-header";
import { JiraActivityNode } from "./jira-activity-node";
import type {
	JiraActivityActor,
	JiraActivityCommentEntry,
	JiraActivityEntry,
	JiraActivityEventEntry,
	JiraActivityFilter,
	JiraActivityReply,
	JiraActivitySortOrder,
} from "./jira-activity-types";
import { filterJiraActivityEntries } from "./lib/jira-activity-filter";
import {
	createCommentEntry,
	createReply,
	jiraActivityReducer,
} from "./lib/jira-activity-reducer";

export interface JiraActivityProps {
	/** Timeline entries, oldest first. Defaults to built-in sample data. */
	entries?: readonly JiraActivityEntry[];
	/** Initial entries when the timeline is uncontrolled. */
	defaultEntries?: readonly JiraActivityEntry[];
	/** Receives the complete next timeline after a comment or reply is submitted. */
	onEntriesChange?: (entries: readonly JiraActivityEntry[]) => void;
	/** The signed-in viewer; authors new comments and replies. */
	currentUser?: JiraActivityActor;
	/** Known actors used to resolve reaction hover details before they appear in the timeline. */
	actors?: readonly JiraActivityActor[];
	/** Override the bottom composer. Pass `null` to suppress it. */
	composer?: ReactNode | null;
	/** Connect every timeline entry, or draw branches only within comment threads. */
	connectorStyle?: "timeline" | "thread";
	/** Continue the last timeline stem into a decorative fade. */
	fadeAfterLast?: boolean;
	/** Plain comment and reply header layout. */
	commentHeaderLayout?: JiraActivityCardProps["headerLayout"];
	/** Optional trailing action for each comment card. */
	renderCommentAction?: (entry: JiraActivityCommentEntry) => ReactNode;
	/** Additional footer tools for comments and their nested replies. */
	renderCommentTools?: (entry: JiraActivityCommentEntry, reply?: JiraActivityReply) => ReactNode;
	/** Optional replacement for a plain comment or reply header's timestamp. */
	renderTimestamp?: (item: JiraActivityEntry | JiraActivityReply) => ReactNode;
	/** Rich reply content. Return undefined to use the plain-text body. */
	renderReplyBody?: (reply: JiraActivityReply) => ReactNode;
	/** Replace a reply card while retaining its thread position and visibility. */
	renderReply?: (reply: JiraActivityReply) => ReactNode | undefined;
	/** Optional persisted reply drafts keyed by the parent comment entry id. */
	replyDrafts?: Readonly<Record<string, string>>;
	onReplyDraftChange?: (entryId: string, value: string) => void;
	/** Rich domain-owned comment content, retaining the shared card and reply/reaction controls. */
	renderCommentBody?: (entry: JiraActivityCommentEntry) => ReactNode | undefined;
	/** Optional replacement for an entry's built-in body. Return undefined to use the default renderer. */
	renderEntry?: (entry: JiraActivityEntry) => ReactNode | undefined;
	/** Marks one timeline row as the current step without changing ordering or filtering. */
	activeEntryId?: string;
	/**
	 * Adds a comment to the sticky work-item activity composer as a pill (Code
	 * Review `CommentsComposerChip` / multi-comment path). Renders the "Add to
	 * chat" control left of expand/collapse.
	 */
	onAddCommentToChat?: (entry: JiraActivityCommentEntry) => void;
	/** Same as `onAddCommentToChat` for nested reply cards. */
	onAddReplyToChat?: (reply: JiraActivityReply, entry: JiraActivityCommentEntry) => void;
	/** Opens the rich agent-session summary shown by an agent comment. */
	onViewSession?: (item: AgentListItem) => void;
	/** Opens in-app pull-request detail for compact Activity PR rows. */
	onOpenPullRequest?: (entry: JiraActivityEventEntry) => void;
	/** Handles an inline reply externally instead of appending it to local timeline state. */
	onSubmitReply?: (entry: JiraActivityCommentEntry, body: string) => void;
	/**
	 * Handles Resolve / Unresolve for review discussion threads. When omitted,
	 * toggles are applied through the local reducer when `allowResolve` is set.
	 */
	onResolveComment?: (entry: JiraActivityCommentEntry) => void;
	/**
	 * Per-comment action row and composer disclosure.
	 * - "none": no action row; the composer stays mounted (legacy behavior).
	 * - "reactions": pills + Add reaction; the composer stays mounted.
	 * - "reply-and-reactions": Reply plus reactions; the composer is hidden until Reply.
	 */
	commentActions?: "none" | "reactions" | "reply-and-reactions";
	/**
	 * Where Reply / Add reaction / comment tools sit. `footer` keeps the
	 * always-visible row under the body; `hover` moves them into the header's
	 * hover- and focus-revealed action slot and leaves only existing reaction
	 * pills under the body.
	 */
	commentActionsPlacement?: "footer" | "hover";
	/** Replaces the threaded "Show more replies" label, e.g. with a count and participant faces. */
	renderEarlierRepliesLabel?: (hiddenReplies: readonly JiraActivityReply[], expanded: boolean) => ReactNode;
	/** Replaces every thread's default reply composer, e.g. with the surface's own comment box. */
	renderReplyComposer?: (composer: JiraActivityReplyComposerProps) => ReactNode;
	/** Handles a reaction toggle externally instead of applying it to local state. */
	onToggleReaction?: (entry: JiraActivityCommentEntry, emoji: string) => void;
	className?: string;
	/** Optional classes for the header wrapper, including consumer-owned sticky positioning. */
	headerClassName?: string;
	/** Adds a fade below the header while its wrapper is stuck to the top. */
	headerScrollFade?: boolean;
	/**
	 * When true, omit the built-in header entirely so a parent can host the
	 * activity count and view/sort control (e.g. MetadataRail toggle row).
	 */
	hideHeader?: boolean;
	/** Controlled timeline ordering. */
	sortOrder?: JiraActivitySortOrder;
	/** Initial ordering when uncontrolled. Defaults to `ascending` (oldest first). */
	defaultSortOrder?: JiraActivitySortOrder;
	/** Receives the next ordering when the header sort control changes. */
	onSortOrderChange?: (next: JiraActivitySortOrder) => void;
	/** Controlled timeline filter. */
	filter?: JiraActivityFilter;
	/** Initial filter when uncontrolled. Defaults to `all`. */
	defaultFilter?: JiraActivityFilter;
	/** Receives the next filter when the header view control changes. */
	onFilterChange?: (next: JiraActivityFilter) => void;
	/** Controlled collapsed state for the timeline body. */
	collapsed?: boolean;
}

/**
 * A chronological activity timeline documenting work done by humans and AI
 * agents on a Jira work item. Renders event rows, comment cards, and
 * changed-files cards on a shared connector spine, with a header and a bottom
 * comment composer. Comments and replies append to the feed via a pure reducer.
 */
export function JiraActivity({
	entries: controlledEntries,
	defaultEntries = JIRA_ACTIVITY_ENTRIES,
	onEntriesChange,
	currentUser = JIRA_ACTIVITY_CURRENT_USER,
	actors = [],
	composer,
	connectorStyle = "timeline",
	fadeAfterLast = false,
	commentHeaderLayout,
	renderCommentAction,
	renderCommentTools,
	renderTimestamp,
	renderReplyBody,
	renderReply,
	replyDrafts,
	onReplyDraftChange,
	renderCommentBody,
	renderEntry,
	activeEntryId,
	onAddCommentToChat,
	onAddReplyToChat,
	onViewSession,
	onOpenPullRequest,
	onSubmitReply,
	onResolveComment,
	commentActions = "reply-and-reactions",
	commentActionsPlacement = "footer",
	renderEarlierRepliesLabel,
	renderReplyComposer,
	onToggleReaction,
	className,
	headerClassName,
	headerScrollFade = false,
	hideHeader = false,
	sortOrder: controlledSortOrder,
	defaultSortOrder = "ascending",
	onSortOrderChange,
	filter: controlledFilter,
	defaultFilter = "all",
	onFilterChange,
	collapsed: controlledCollapsed,
}: Readonly<JiraActivityProps>) {
	const [uncontrolledEntries, setUncontrolledEntries] = useState(defaultEntries);
	const entries = controlledEntries ?? uncontrolledEntries;
	const [uncontrolledSortOrder, setUncontrolledSortOrder] = useState(defaultSortOrder);
	const sortOrder = controlledSortOrder ?? uncontrolledSortOrder;
	const [uncontrolledFilter, setUncontrolledFilter] = useState(defaultFilter);
	const filter = controlledFilter ?? uncontrolledFilter;
	const collapsed = controlledCollapsed ?? false;
	const actorsById = useMemo(() => {
		const actorDirectory = new Map<string, JiraActivityActor>();
		actorDirectory.set(currentUser.id, currentUser);
		for (const entry of entries) {
			actorDirectory.set(entry.actor.id, entry.actor);
			if (entry.kind === "comment") {
				for (const reply of entry.replies ?? []) {
					actorDirectory.set(reply.actor.id, reply.actor);
				}
			}
		}
		for (const actor of actors) actorDirectory.set(actor.id, actor);
		return actorDirectory;
	}, [actors, currentUser, entries]);

	function handleSortOrderChange(next: JiraActivitySortOrder) {
		if (controlledSortOrder === undefined) {
			setUncontrolledSortOrder(next);
		}
		onSortOrderChange?.(next);
	}

	function handleFilterChange(next: JiraActivityFilter) {
		if (controlledFilter === undefined) {
			setUncontrolledFilter(next);
		}
		onFilterChange?.(next);
	}

	function applyAction(action: Parameters<typeof jiraActivityReducer>[1]) {
		const nextState = jiraActivityReducer({ entries }, action);
		if (nextState.entries === entries) return;
		if (controlledEntries === undefined) {
			setUncontrolledEntries(nextState.entries);
		}
		onEntriesChange?.(nextState.entries);
	}

	// Entries are stored oldest-first; `descending` shows newest first without
	// mutating the canonical order the reducer appends to.
	const visibleEntries = useMemo(
		() => filterJiraActivityEntries(entries, filter),
		[entries, filter],
	);
	const orderedEntries = useMemo(
		() => (sortOrder === "descending" ? [...visibleEntries].reverse() : visibleEntries),
		[sortOrder, visibleEntries],
	);

	function handleAddComment(body: string) {
		applyAction({
			type: "add-comment",
			entry: createCommentEntry({
				id: crypto.randomUUID(),
				actor: currentUser,
				timestamp: "Just now",
				body,
			}),
		});
	}

	function handleAddReply(entry: JiraActivityCommentEntry, body: string) {
		if (onSubmitReply) {
			onSubmitReply(entry, body);
			return;
		}
		applyAction({
			type: "add-reply",
			entryId: entry.id,
			reply: createReply({
				id: crypto.randomUUID(),
				actor: currentUser,
				timestamp: "Just now",
				body,
			}),
		});
	}

	function handleToggleReaction(entry: JiraActivityCommentEntry, emoji: string) {
		if (onToggleReaction) {
			onToggleReaction(entry, emoji);
			return;
		}
		applyAction({
			type: "toggle-reaction",
			entryId: entry.id,
			emoji,
			actorId: currentUser.id,
		});
	}

	function handleResolveComment(entry: JiraActivityCommentEntry) {
		if (onResolveComment) {
			onResolveComment(entry);
			return;
		}
		applyAction({
			type: "toggle-resolved",
			entryId: entry.id,
		});
	}

	return (
		<div className={cn("group/activity flex w-full min-w-0 flex-col gap-4", className)}>
			{hideHeader ? null : (
				<div className={headerClassName} data-slot="jira-activity-header">
					<JiraActivityHeader
						count={visibleEntries.length}
						filter={filter}
						onFilterChange={handleFilterChange}
						onSortOrderChange={handleSortOrderChange}
						sortOrder={sortOrder}
					/>
					{headerScrollFade ? (
						<StickyRowScrollFade
							data-slot="jira-activity-header-scroll-fade"
						/>
					) : null}
				</div>
			)}

			{collapsed ? null : (
				<ol
					aria-label="Activity timeline"
					// Rail mode omits the sticky header; a little top pad keeps the
					// first mention chip clear of the metadata scrollport clip edge.
					className={cn("flex flex-col", hideHeader ? "pt-1" : null, fadeAfterLast && orderedEntries.length > 0 ? "pb-4" : null)}
				>
					{orderedEntries.map((entry, index) => {
						const customEntry = renderEntry?.(entry);
						const isLast = index === orderedEntries.length - 1;
						const isCardEntry = entry.kind !== "event";
						const isNestedComment = entry.kind === "comment" && Boolean(entry.parentId);
						const nextEntry = orderedEntries[index + 1];
						const isNextEntryCard = nextEntry?.kind !== "event" && !isLast;
						const isNextEntryThreadContinuation = nextEntry?.kind === "comment"
							&& (
								nextEntry.parentId === entry.id
								|| (
									entry.kind === "comment"
									&& entry.parentId != null
									&& nextEntry.parentId === entry.parentId
								)
							);
						// A nested review comment belongs to its parent card, and adjacent
						// nested siblings belong to the same thread group. Keep both seams
						// flush; each child owns the shared pt-3/pl-6 treatment.
						const spacingClassName = isNextEntryThreadContinuation
							? null
							: isLast
							? entry.kind === "comment" ? "pb-4" : "pb-3"
							: isCardEntry && isNextEntryCard
								? "pb-6"
								: isCardEntry || isNextEntryCard
									? "pb-5"
									: "pb-2";
						const defaultEntry = entry.kind === "event" ? (
							<JiraActivityEvent
								entry={entry}
								onOpenPullRequest={onOpenPullRequest}
							/>
						) : entry.kind === "comment" ? (
							<JiraActivityComment
								headerLayout={commentHeaderLayout}
								threaded={connectorStyle === "thread"}
								bodyContent={renderCommentBody?.(entry)}
								renderCommentTools={renderCommentTools}
								renderTimestamp={renderTimestamp}
								renderReplyBody={renderReplyBody}
								renderReply={renderReply}
								replyDraft={replyDrafts === undefined ? undefined : replyDrafts[entry.id] ?? ""}
								onReplyDraftChange={onReplyDraftChange ? (value) => onReplyDraftChange(entry.id, value) : undefined}
								actorsById={actorsById}
								commentActions={commentActions}
								commentActionsPlacement={commentActionsPlacement}
								renderEarlierRepliesLabel={renderEarlierRepliesLabel}
								renderReplyComposer={renderReplyComposer}
								currentUser={currentUser}
								entry={entry}
								onAddReplyToChat={
									onAddReplyToChat
										? (reply) => onAddReplyToChat(reply, entry)
										: undefined
								}
								onAddToChat={
									onAddCommentToChat
										? () => onAddCommentToChat(entry)
										: undefined
								}
								onViewSession={onViewSession}
								onResolve={
									entry.allowResolve
										? () => handleResolveComment(entry)
										: undefined
								}
								onSubmitReply={(body) => handleAddReply(entry, body)}
								onToggleReaction={(emoji) => handleToggleReaction(entry, emoji)}
								action={renderCommentAction?.(entry)}
							/>
						) : (
							<JiraActivityChangedFiles
								entry={entry}
								hideLeadAvatar
								onView={onViewSession}
							/>
						);

						return (
							<li
								aria-current={entry.id === activeEntryId ? "step" : undefined}
								className="group/activity-event relative flex min-w-0 gap-2"
								data-active={entry.id === activeEntryId ? "" : undefined}
								data-jira-activity-entry-id={entry.id}
								data-jira-activity-entry-kind={entry.kind}
								data-jira-activity-parent-id={
									entry.kind === "comment" ? entry.parentId : undefined
								}
								key={entry.id}
							>
								{/*
								 * Spine gaps come from JiraActivityNode's icon track (h-10 / h-6):
								 * the connector only starts below that track, so each node gets a
								 * clean 4px break without opaque color-matching covers.
								 */}
								{isNestedComment ? (
									<div
										aria-hidden
										className="flex w-8 shrink-0 justify-center"
										data-jira-activity-spine-continuation
									>
										<div className="w-px self-stretch bg-border" />
									</div>
								) : (
									<JiraActivityNode
										actor={entry.actor}
										icon={
											entry.kind === "event"
												? (entry.pullRequest ? "pull-request" : entry.icon)
												: undefined
										}
										// Threads keep one continuous spine: each stem runs on past its replies' branches to the next row.
										isLast={isLast && !fadeAfterLast}
										size={isCardEntry ? "card" : "event"}
										tone={connectorStyle === "thread" ? "thread" : "timeline"}
									/>
								)}
								<div
									className={cn(
										"min-w-0 flex-1",
										spacingClassName,
										isNestedComment ? "pt-3 pl-6" : null,
									)}
								>
									{customEntry !== undefined ? customEntry : defaultEntry}
								</div>
								{isLast && fadeAfterLast ? (
									<span aria-hidden className="absolute top-full left-0 flex w-8 justify-center" data-jira-activity-end-fade>
										<span className={cn("h-4 w-px [mask-image:linear-gradient(to_bottom,black,transparent)]", connectorStyle === "thread" ? "bg-bg-accent-gray-subtler" : "bg-border")} />
									</span>
								) : null}
							</li>
						);
					})}
				</ol>
			)}

			{collapsed || composer === null ? null : composer === undefined ? (
				<JiraActivityComposer
					author={currentUser}
					onSubmit={handleAddComment}
					placeholder="Leave a comment..."
					variant="comment"
				/>
			) : (
				composer
			)}
		</div>
	);
}

export { JIRA_ACTIVITY_CURRENT_USER, JIRA_ACTIVITY_ENTRIES } from "./data";
export { JiraActivityCard, type JiraActivityCardProps } from "./jira-activity-card";
export { JiraActivityComposer, type JiraActivityComposerProps } from "./jira-activity-composer";
export { JiraActivityEntryGlyph } from "./jira-activity-node";
export {
	JiraActivityHeader,
	JiraActivityViewControl,
} from "./jira-activity-header";
export type {
	JiraActivityActor,
	JiraActivityActorKind,
	JiraActivityChangedFilesEntry,
	JiraActivityCommentEntry,
	JiraActivityEntry,
	JiraActivityEventEntry,
	JiraActivityEventIcon,
	JiraActivityFilter,
	JiraActivityPriority,
	JiraActivityReaction,
	JiraActivityReply,
	JiraActivitySegment,
	JiraActivitySortOrder,
} from "./jira-activity-types";
export type { JiraActivityViewFilterMode } from "./jira-activity-header";
export {
	jiraActivitySegmentsToPlainText,
	serializeActivityCommentsContext,
	type ActivityChatCommentContext,
} from "./lib/jira-activity-comment-text";
export type { JiraActivityReplyComposerProps } from "./jira-activity-comment";
