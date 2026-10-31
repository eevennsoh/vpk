"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import GrowVerticalIcon from "@atlaskit/icon/core/grow-vertical";

import type { AgentListItem } from "@/components/blocks/agent-list";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Lozenge } from "@/components/ui/lozenge";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { ArtifactList, type ArtifactListItem } from "@/components/ui-custom/artifact-list";
import type { RichTextMentionItem } from "@/components/ui-custom/rich-text-editor";
import { cn } from "@/lib/utils";

import { activityActorVpkLogo } from "./jira-activity-actor-mention";
import { JiraActivityAddToChatButton } from "./jira-activity-add-to-chat-button";
import { JiraActivityCard } from "./jira-activity-card";
import { JiraActivityCommentActions } from "./jira-activity-comment-actions";
import { JiraActivityComposer } from "./jira-activity-composer";
import { JiraActivityImagePreviewDialog } from "./jira-activity-image-preview-dialog";
import { JiraActivitySegments } from "./jira-activity-segments";
import type {
	JiraActivityActor,
	JiraActivityCommentEntry,
	JiraActivityImageAttachment,
	JiraActivityReaction,
	JiraActivityReply,
} from "./jira-activity-types";

function initialsOf(name: string): string {
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase())
			.join("") || "?"
	);
}

function imageAttachmentArtifact(attachment: JiraActivityImageAttachment): ArtifactListItem {
	return {
		id: attachment.filename,
		title: attachment.filename,
		// ArtifactList `source` is the object-type byline (e.g. "Confluence page").
		source: "Image",
		// Compact ArtifactList logo tiles are 24×24 — fill that tile with the
		// generated screenshot so activity evidence matches output rows.
		logoSrc: attachment.src,
		href: attachment.href ?? attachment.src,
	};
}

function commentArtifactItems(entry: JiraActivityCommentEntry): ArtifactListItem[] {
	return [
		...(entry.outputs ?? []),
		...(entry.imageAttachment ? [imageAttachmentArtifact(entry.imageAttachment)] : []),
	];
}

function openCommentArtifact(item: ArtifactListItem) {
	if (!item.href) return;
	window.open(item.href, "_blank", "noopener,noreferrer");
}

function getReplyMention(actor: JiraActivityActor): RichTextMentionItem {
	const category =
		actor.kind === "person" ? "human" : actor.kind === "agent" ? "subagent" : "app";
	const visual = actor.avatarSrc
		? {
				kind: "avatar" as const,
				shape:
					actor.kind === "person"
						? ("circle" as const)
						: actor.kind === "agent"
							? ("hexagon" as const)
							: ("square" as const),
				src: actor.avatarSrc,
			}
		: actor.brandName
			? { kind: "third-party" as const, name: actor.brandName }
			: undefined;

	return {
		category,
		id: `${category}:${actor.id}`,
		label: actor.name,
		visual,
	};
}

function ActivityActorAvatar({
	actor,
	sizePx = 32,
}: Readonly<{
	actor: JiraActivityActor;
	sizePx?: 16 | 32;
}>) {
	if (actor.kind === "person") {
		return (
			<Avatar aria-hidden size={sizePx === 16 ? "xs" : "default"}>
				{actor.avatarSrc ? <AvatarImage alt="" src={actor.avatarSrc} /> : null}
				<AvatarFallback>{initialsOf(actor.name)}</AvatarFallback>
			</Avatar>
		);
	}

	return (
		<AgentAvatarVisual
			avatarSrc={actor.avatarSrc}
			brandName={actor.brandName}
			fallbackText={initialsOf(actor.name)}
			label={actor.name}
			sizePx={sizePx}
			vpkLogo={activityActorVpkLogo(actor)}
		/>
	);
}

function reactionActorNames(
	reaction: JiraActivityReaction,
	actorsById: ReadonlyMap<string, JiraActivityActor>,
): { reactorNames?: readonly string[] } {
	const names = reaction.actorIds
		.map((actorId) => actorsById.get(actorId)?.name)
		.filter((name): name is string => Boolean(name));
	return names.length === reaction.actorIds.length ? { reactorNames: names } : {};
}

function CollapsedThreadSummary({
	onExpand,
	replies,
	resolved,
}: Readonly<{
	onExpand: () => void;
	replies: readonly JiraActivityReply[];
	resolved: boolean;
}>) {
	const actors = [...new Map(replies.map((reply) => [reply.actor.id, reply.actor])).values()];
	const replyCountLabel = `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`;
	const latestTimestamp = replies[replies.length - 1]?.timestamp;

	return (
		<div className="flex min-w-0 items-center gap-2">
			{resolved ? <Lozenge variant="success">Resolved</Lozenge> : null}
			<span aria-hidden className="text-text-subtlest">·</span>
			<AvatarGroup
				className="shrink-0 -space-x-1 *:data-[slot=avatar]:ring-1!"
				label={`Reply participants: ${actors.map((actor) => actor.name).join(", ")}`}
			>
				{actors.slice(0, 3).map((actor) => (
					<ActivityActorAvatar actor={actor} key={actor.id} sizePx={16} />
				))}
			</AvatarGroup>
			<Button
				aria-label={`View all comments, ${replyCountLabel}`}
				className="group/thread-summary h-auto min-w-0 gap-1.5 px-0 text-xs font-normal text-text hover:underline"
				onClick={onExpand}
				type="button"
				variant="link"
			>
				<span className="shrink-0 text-text-subtle">{replyCountLabel}</span>
				{latestTimestamp ? (
					<>
						<span aria-hidden className="shrink-0 text-text-subtlest">·</span>
						<span className="truncate text-text-subtlest group-hover/thread-summary:hidden group-focus-visible/thread-summary:hidden">
							{latestTimestamp}
						</span>
						<span className="hidden truncate group-hover/thread-summary:inline group-focus-visible/thread-summary:inline">
							View all comments
						</span>
					</>
				) : null}
			</Button>
		</div>
	);
}

function ReopenThreadAction({
	onReopen,
}: Readonly<{
	onReopen: () => void;
}>) {
	return (
		<div className="flex min-w-0 items-center gap-2">
			<Button
				aria-label="Reopen"
				className="h-auto px-0 text-xs text-text-subtle"
				onClick={onReopen}
				type="button"
				variant="link"
			>
				Reopen
			</Button>
		</div>
	);
}

function ThreadReplyCard({
	reply,
	currentUser,
	actorsById,
	onReply,
	commentActions,
	allowReply,
	replyComposerId,
	replySelected,
	onAddToChat,
	onViewSession,
	resolved,
	indented,
	showResolvedStatus,
	onReopen,
}: Readonly<{
	reply: JiraActivityReply;
	currentUser: JiraActivityActor;
	actorsById: ReadonlyMap<string, JiraActivityActor>;
	onReply: (button: HTMLButtonElement | null) => void;
	commentActions: "none" | "reactions" | "reply-and-reactions";
	allowReply: boolean;
	replyComposerId?: string;
	replySelected: boolean;
	onAddToChat?: () => void;
	onViewSession?: (item: AgentListItem) => void;
	resolved: boolean;
	indented: boolean;
	showResolvedStatus: boolean;
	onReopen?: () => void;
}>) {
	const [reactions, setReactions] = useState<readonly JiraActivityReaction[]>(reply.reactions ?? []);
	const replyButtonRef = useRef<HTMLButtonElement>(null);

	function toggleReaction(emoji: string) {
		setReactions((currentReactions) => {
			const existing = currentReactions.find((reaction) => reaction.emoji === emoji);
			if (!existing) return [...currentReactions, { emoji, actorIds: [currentUser.id] }];

			const actorIds = existing.actorIds.includes(currentUser.id)
				? existing.actorIds.filter((actorId) => actorId !== currentUser.id)
				: [...existing.actorIds, currentUser.id];
			if (actorIds.length === 0) {
				return currentReactions.filter((reaction) => reaction.emoji !== emoji);
			}
			return currentReactions.map((reaction) => (
				reaction.emoji === emoji ? { ...reaction, actorIds } : reaction
			));
		});
	}

	const reactionSummaries = reactions.map((reaction) => ({
		emoji: reaction.emoji,
		count: reaction.actorIds.length,
		reacted: reaction.actorIds.includes(currentUser.id),
		...reactionActorNames(reaction, actorsById),
	}));

	const addToChatAction = onAddToChat ? (
		<JiraActivityAddToChatButton onClick={onAddToChat} />
	) : null;

	return (
		<div className={cn("pt-3", indented ? "pl-6" : null)}>
			<JiraActivityCard
				action={addToChatAction ?? undefined}
				agentName={reply.actor.name}
				className="rounded-none"
				activityGroup="activity-reply"
				headerAvatar={<ActivityActorAvatar actor={reply.actor} />}
				headerLayout="stacked"
				item={reply.sessionItem}
				onView={onViewSession}
				footerActions={
					resolved ? (
						onReopen ? <ReopenThreadAction onReopen={onReopen} /> : undefined
					) : commentActions === "none" ? undefined : (
						<JiraActivityCommentActions
							onReply={
								commentActions === "reply-and-reactions" && allowReply
									? () => onReply(replyButtonRef.current)
									: undefined
							}
							onToggleReaction={toggleReaction}
							reactions={reactionSummaries}
							replyComposerId={replySelected ? replyComposerId : undefined}
							replyExpanded={replySelected}
							replyRef={replyButtonRef}
						/>
					)
				}
				timestamp={reply.timestamp}
				timestampMeta={
					showResolvedStatus ? <Lozenge variant="success">Resolved</Lozenge> : undefined
				}
			>
				<div className="text-sm leading-5 text-text">{reply.body}</div>
			</JiraActivityCard>
		</div>
	);
}

/**
 * Adapts Jira Activity comment data to the expanded Agent List card.
 * Human comments repeat their identity inside the card header; agent-session
 * cards continue to use the session identity supplied by their item. Both carry
 * an always-visible action row, with the prompt composer disclosed by Reply.
 */
export function JiraActivityComment({
	entry,
	bodyContent,
	currentUser,
	actorsById,
	onSubmitReply,
	onToggleReaction,
	onResolve,
	onAddToChat,
	onAddReplyToChat,
	onViewSession,
	action,
	commentActions = "reply-and-reactions",
}: Readonly<{
	entry: JiraActivityCommentEntry;
	bodyContent?: ReactNode;
	currentUser: JiraActivityActor;
	actorsById: ReadonlyMap<string, JiraActivityActor>;
	onSubmitReply: (body: string) => void;
	onToggleReaction: (emoji: string) => void;
	/** Toggle resolve on review discussion threads (`allowResolve`). */
	onResolve?: () => void;
	onAddToChat?: () => void;
	onAddReplyToChat?: (reply: JiraActivityReply) => void;
	onViewSession?: (item: AgentListItem) => void;
	action?: ReactNode;
	commentActions?: "none" | "reactions" | "reply-and-reactions";
}>) {
	const replies = entry.replies ?? [];
	const hasReplies = replies.length > 0;
	const allowReply = entry.allowReply ?? true;
	const allowResolve = Boolean(entry.allowResolve);
	const resolved = Boolean(entry.resolved);
	const nested = Boolean(entry.parentId);
	const collapsible = commentActions === "reply-and-reactions";
	const [replyTarget, setReplyTarget] = useState<{
		key: string;
		actor: JiraActivityActor;
	} | null>(null);
	const [replyDraft, setReplyDraft] = useState("");
	const [previewAttachment, setPreviewAttachment] = useState<JiraActivityImageAttachment | null>(null);
	const [repliesExpanded, setRepliesExpanded] = useState(
		entry.defaultRepliesExpanded ?? !nested,
	);
	const composerId = useId();
	const repliesId = useId();
	const composerVisible = allowReply && (!collapsible || replyTarget !== null);
	const replyButtonRef = useRef<HTMLButtonElement>(null);
	const activeReplyButtonRef = useRef<HTMLButtonElement | null>(null);
	// Only move focus once the viewer has actually toggled Reply, so the initial
	// mount never steals focus from the page.
	const replyToggledRef = useRef(false);

	// Reactions are stored as actor ids; the picker block wants counts, so the
	// view model is derived here at the boundary.
	const reactionSummaries = (entry.reactions ?? []).map((reaction) => ({
		emoji: reaction.emoji,
		count: reaction.actorIds.length,
		reacted: reaction.actorIds.includes(currentUser.id),
		...reactionActorNames(reaction, actorsById),
	}));

	function toggleReply(key: string, actor: JiraActivityActor, button: HTMLButtonElement | null) {
		replyToggledRef.current = true;
		activeReplyButtonRef.current = button;
		if (replyTarget?.key === key) {
			setReplyTarget(null);
			setReplyDraft("");
			return;
		}
		setReplyTarget({ key, actor });
		setReplyDraft("");
	}

	function handleResolveToggle() {
		if (!resolved) {
			setReplyTarget(null);
			setReplyDraft("");
		}
		onResolve?.();
	}

	function handleOpenArtifact(item: ArtifactListItem) {
		if (entry.imageAttachment?.filename === item.id) {
			setPreviewAttachment(entry.imageAttachment);
			return;
		}
		openCommentArtifact(item);
	}

	const repliesToggleLabel = repliesExpanded ? "Hide all replies" : "Show all replies";
	const repliesToggle = hasReplies ? (
		<Button
			aria-controls={repliesId}
			aria-expanded={repliesExpanded}
			aria-label={repliesToggleLabel}
			className="aria-expanded:border-border aria-expanded:bg-bg-neutral-subtle aria-expanded:text-text-subtle aria-expanded:hover:bg-bg-neutral-subtle-hovered"
			onClick={() => setRepliesExpanded((expanded) => !expanded)}
			size="icon-compact"
			title={repliesToggleLabel}
			type="button"
			variant="outline"
		>
			<GrowVerticalIcon label="" />
		</Button>
	) : null;
	const addToChatAction = onAddToChat ? (
		<JiraActivityAddToChatButton onClick={onAddToChat} />
	) : null;
	// Far-right: optional consumer action, Add to chat, then expand/collapse.
	const headerAction = action || repliesToggle || addToChatAction ? (
		<div className="flex shrink-0 items-center gap-1">
			{action}
			{addToChatAction}
			{repliesToggle}
		</div>
	) : undefined;
	const commentActionControls = commentActions === "none" ? null : (
		<JiraActivityCommentActions
			onReply={
				collapsible && allowReply
					? () => toggleReply(entry.id, entry.actor, replyButtonRef.current)
					: undefined
			}
			onResolve={!resolved && allowResolve && onResolve ? handleResolveToggle : undefined}
			onToggleReaction={onToggleReaction}
			reactions={reactionSummaries}
			replyComposerId={replyTarget?.key === entry.id ? composerId : undefined}
			replyExpanded={replyTarget?.key === entry.id}
			replyRef={replyButtonRef}
		/>
	);
	const collapsedThreadSummary = hasReplies && !repliesExpanded ? (
		<CollapsedThreadSummary
			onExpand={() => setRepliesExpanded(true)}
			replies={replies}
			resolved={resolved}
		/>
	) : null;
	const replyMention = replyTarget ? getReplyMention(replyTarget.actor) : undefined;
	const artifactItems = commentArtifactItems(entry);
	const reviewStatus = entry.statusLozenge ? (
		<Lozenge variant={entry.statusLozenge.variant}>{entry.statusLozenge.text}</Lozenge>
	) : null;
	const parentResolvedStatus = resolved && !hasReplies ? (
		<Lozenge variant="success">Resolved</Lozenge>
	) : null;

	// Only the collapse direction is handled here. Opening is covered by the
	// composer's own `autoFocus`: the comment variant is a contentEditable tiptap
	// editor that mounts asynchronously, so focusing it from this effect would
	// race the editor's initialisation and silently no-op.
	useEffect(() => {
		if (!replyToggledRef.current || replyTarget !== null) return;
		activeReplyButtonRef.current?.focus();
	}, [replyTarget]);

	return (
		<JiraActivityCard
			action={headerAction}
			agentName={entry.actor.name}
			className={nested ? "rounded-none" : undefined}
			// Timeline node owns the size-8 avatar; nested replies keep pl-6. The
			// flush composer pulls back across w-8 + gap-2 so it lines up with the
			// parent avatar, not the indented reply column.
			headerAvatar={nested ? <ActivityActorAvatar actor={entry.actor} /> : undefined}
			hideLeadAvatar={!nested}
			headerLayout="stacked"
			item={entry.sessionItem}
			onView={onViewSession}
			details={
				entry.sessionItem
					? undefined
					: entry.collapsible
						? {
								label: entry.collapsible.label,
								children: (
									<JiraActivitySegments
										className="pl-5 text-sm leading-5 text-text-subtle"
										segments={entry.collapsible.content}
									/>
								),
							}
						: undefined
			}
			footerActions={
				commentActionControls || collapsedThreadSummary ? (
					<div className="flex min-w-0 items-center gap-2">
						{commentActionControls}
						{collapsedThreadSummary}
					</div>
				) : undefined
			}
			replyComposer={
				composerVisible ? (
					<div
						className="-ml-10 w-[calc(100%+2.5rem)]"
						id={composerId}
					>
						<JiraActivityComposer
							author={currentUser}
							// In collapsible mode the composer only mounts on a Reply
							// click, so mounting is exactly the moment to take focus.
							autoFocus={collapsible}
							key={replyTarget?.key ?? "thread-reply"}
							onSubmit={(body) => {
								onSubmitReply(body);
								if (collapsible) {
									setReplyTarget(null);
									setReplyDraft("");
								}
							}}
							onValueChange={setReplyDraft}
							prefillMentionRequest={
								replyMention ? { mention: replyMention, requestKey: 1 } : undefined
							}
							placeholder={entry.sessionItem ? "Ask, @mention, or / for actions" : "Leave a reply..."}
							value={replyDraft}
							variant="flush"
						/>
					</div>
				) : undefined
			}
			replies={
				hasReplies ? (
					<div
						aria-label="Replies"
						className={cn("grid gap-2", repliesExpanded ? null : "hidden")}
						hidden={!repliesExpanded}
						id={repliesId}
						role="group"
					>
						{replies.map((reply, index) => (
							<ThreadReplyCard
								allowReply={allowReply}
								commentActions={commentActions}
								currentUser={currentUser}
								actorsById={actorsById}
								key={reply.id}
								onAddToChat={
									onAddReplyToChat ? () => onAddReplyToChat(reply) : undefined
								}
								onReopen={
									resolved && index === replies.length - 1 && allowResolve && onResolve
										? handleResolveToggle
										: undefined
								}
								onReply={(button) => toggleReply(reply.id, reply.actor, button)}
								onViewSession={onViewSession}
								reply={reply}
								replyComposerId={composerId}
								replySelected={replyTarget?.key === reply.id}
								resolved={resolved}
								indented={!nested}
								showResolvedStatus={resolved && index === replies.length - 1}
							/>
						))}
					</div>
				) : undefined
			}
			tag={entry.tag}
			timestamp={entry.timestamp}
			timestampMeta={
				reviewStatus || parentResolvedStatus ? (
					<>
						{reviewStatus}
						{parentResolvedStatus}
					</>
				) : undefined
			}
		>
			{bodyContent === undefined ? <JiraActivitySegments
				className="text-sm leading-5 text-text"
				segments={entry.body}
			/> : bodyContent}
			{entry.progressChecklist?.length ? (
				<ul aria-label="Agent progress" className="mt-3 grid min-w-0 gap-1.5">
					{entry.progressChecklist.map((item) => (
						<li className="flex min-w-0 items-start gap-2 text-sm leading-5 text-text" key={item.id}>
							<Checkbox
								aria-label={`${item.label}: ${item.completed ? "complete" : "incomplete"}`}
								checked={item.completed}
								className="mt-0.5 shrink-0 disabled:opacity-100"
								disabled
							/>
							<span className={cn("min-w-0 wrap-break-word", item.completed ? "text-text-subtlest" : null)}>
								{item.label}
							</span>
						</li>
					))}
				</ul>
			) : null}
			{artifactItems.length > 0 ? (
				<ArtifactList
					className="mt-3 min-w-0 max-w-full border border-border bg-transparent shadow-none"
					items={artifactItems}
					onOpen={handleOpenArtifact}
					openLabel="Open"
					style={{ boxShadow: "none" }}
					variant="compact"
				/>
			) : null}
			<JiraActivityImagePreviewDialog
				attachment={previewAttachment}
				onOpenChange={(open) => {
					if (!open) setPreviewAttachment(null);
				}}
			/>
		</JiraActivityCard>
	);
}
