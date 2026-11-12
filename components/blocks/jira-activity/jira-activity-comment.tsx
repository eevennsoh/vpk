"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import GrowVerticalIcon from "@atlaskit/icon/core/grow-vertical";
import ShrinkVerticalIcon from "@atlaskit/icon/core/shrink-vertical";

import type { AgentListItem } from "@/components/blocks/agent-list";
import { EmojiReactionBar } from "@/components/blocks/emoji-picker/components/emoji-reaction-bar";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Lozenge } from "@/components/ui/lozenge";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";
import { ArtifactList, type ArtifactListItem } from "@/components/ui-custom/artifact-list";
import type { RichTextMentionItem } from "@/components/ui-custom/rich-text-editor";
import { cn } from "@/lib/utils";

import { activityActorVpkLogo } from "./jira-activity-actor-mention";
import { JiraActivityAddToChatButton } from "./jira-activity-add-to-chat-button";
import { JiraActivityCard } from "./jira-activity-card";
import type { JiraActivityCardProps } from "./jira-activity-card";
import { JiraActivityCommentActions } from "./jira-activity-comment-actions";
import { JiraActivityComposer } from "./jira-activity-composer";
import { JiraActivityImagePreviewDialog } from "./jira-activity-image-preview-dialog";
import { JiraActivitySegments } from "./jira-activity-segments";
import { toggleReaction as toggleActivityReaction } from "./lib/jira-activity-reducer";
import type {
	JiraActivityActor,
	JiraActivityCommentEntry,
	JiraActivityEntry,
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

/** What a consumer-supplied reply composer receives; the thread keeps owning the draft, focus and submit flow. */
export type JiraActivityReplyComposerProps = Readonly<{
	/** True when the composer mounted from a Reply click and should take focus. */
	autoFocus: boolean;
	onSubmit: (body: string, mentionedAgentIds?: readonly string[]) => void;
	onValueChange: (value: string) => void;
	placeholder: string;
	/** Replying to a specific reply leads the draft with a mention of its author. */
	prefillMention?: Readonly<{ mention: RichTextMentionItem; textAfter: string }>;
	value: string;
}>;

function ActivityActorAvatar({
	actor,
	attributedBy,
	sizePx = 32,
}: Readonly<{
	actor: JiraActivityActor;
	attributedBy?: JiraActivityCommentEntry["attributedBy"];
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

	if (actor.kind === "agent" && attributedBy) {
		return <HumanAgentAvatar agent={{ name: actor.name, appearance: actor.appearance, avatarSrc: actor.avatarSrc, brandName: actor.brandName, fallbackText: initialsOf(actor.name), vpkLogo: activityActorVpkLogo(actor) }} human={attributedBy} sizePx={sizePx} />;
	}

	return (
		<AgentAvatarVisual
			appearance={actor.appearance}
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

function ThreadContinuation() {
	return <span aria-hidden className="pointer-events-none absolute -left-6 inset-y-0 w-px -translate-x-1/2 bg-bg-accent-gray-subtler" data-jira-activity-thread-continuation />;
}

function ThreadConnector({ continued, centered = false }: Readonly<{ continued: boolean; centered?: boolean }>) {
	return <>
		<span aria-hidden className={cn("pointer-events-none absolute -left-6 w-4 -translate-x-[0.5px] rounded-bl-xl border-b border-l border-bg-accent-gray-subtler", centered ? "-top-3 bottom-[calc(50%-0.5px)]" : "top-0 h-7")} data-jira-activity-thread-branch />
		{continued ? <ThreadContinuation /> : null}
	</>;
}

function ThreadReplyCard({
	reply,
	attributedBy,
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
	bodyContent,
	content,
	timestampContent,
	headerLayout,
	tools,
	hidden = false,
	threaded = false,
	continued = false,
	actionsPlacement = "footer",
}: Readonly<{
	reply: JiraActivityReply;
	attributedBy?: JiraActivityCommentEntry["attributedBy"];
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
	bodyContent?: ReactNode;
	content?: ReactNode;
	timestampContent?: ReactNode;
	headerLayout: JiraActivityCardProps["headerLayout"];
	tools?: ReactNode;
	hidden?: boolean;
	threaded?: boolean;
	continued?: boolean;
	actionsPlacement?: "footer" | "hover";
}>) {
	const [toggledReactions, setToggledReactions] = useState<readonly string[]>([]);
	const replyButtonRef = useRef<HTMLButtonElement>(null);

	function toggleReaction(emoji: string) {
		setToggledReactions((current) => current.includes(emoji) ? current.filter((item) => item !== emoji) : [...current, emoji]);
	}

	const reactions = toggledReactions.reduce((current, emoji) => toggleActivityReaction(current, emoji, currentUser.id), reply.reactions ?? []);
	const reactionSummaries = reactions.map((reaction) => ({
		emoji: reaction.emoji,
		count: reaction.actorIds.length,
		reacted: reaction.actorIds.includes(currentUser.id),
		...reactionActorNames(reaction, actorsById),
	}));

	const addToChatAction = onAddToChat ? (
		<JiraActivityAddToChatButton onClick={onAddToChat} />
	) : null;
	const hoverActions = actionsPlacement === "hover" && !resolved && commentActions !== "none";
	// One action row: the header hosts it in hover mode (pills stay below), the footer otherwise.
	const actionRow = (
		<JiraActivityCommentActions
			onReply={
				commentActions === "reply-and-reactions" && allowReply
					? () => onReply(replyButtonRef.current)
					: undefined
			}
			onToggleReaction={toggleReaction}
			reactions={hoverActions ? [] : reactionSummaries}
			replyComposerId={replySelected ? replyComposerId : undefined}
			replyExpanded={replySelected}
			replyRef={replyButtonRef}
			trailingActions={tools}
		/>
	);

	return (
		<div className={cn("relative pt-3", threaded ? "pb-3" : null, indented ? "pl-6" : null)} hidden={hidden}>
			{threaded && continued ? <ThreadContinuation /> : null}
			{content === undefined ? <JiraActivityCard
				action={hoverActions ? <>{addToChatAction}{actionRow}</> : addToChatAction ?? undefined}
				agentName={reply.actor.name}
				className="rounded-none"
				activityGroup="activity-reply"
				headerAvatar={<ActivityActorAvatar actor={reply.actor} attributedBy={attributedBy} />}
				headerConnector={threaded ? <ThreadConnector centered continued={false} /> : undefined}
				headerLayout={headerLayout}
				item={reply.sessionItem}
				onView={onViewSession}
				footerActions={
					resolved ? (
						onReopen ? <ReopenThreadAction onReopen={onReopen} /> : undefined
					) : commentActions === "none" ? undefined : hoverActions ? (
						reactionSummaries.length > 0 ? <EmojiReactionBar onToggleReaction={toggleReaction} reactions={reactionSummaries} showAddReaction={false} /> : undefined
					) : actionRow
				}
				timestamp={reply.timestamp}
				timestampContent={timestampContent}
				timestampMeta={
					showResolvedStatus ? <Lozenge variant="success">Resolved</Lozenge> : undefined
				}
			>
				{bodyContent === undefined ? <div className="text-sm leading-5 text-text">{reply.body}</div> : bodyContent}
			</JiraActivityCard> : <div className="relative">{threaded ? <ThreadConnector centered continued={false} /> : null}{content}</div>}
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
	renderCommentTools,
	renderTimestamp,
	renderReplyBody,
	renderReply,
	replyDraft: controlledReplyDraft,
	onReplyDraftChange,
	replyRequestId,
	commentActions = "reply-and-reactions",
	commentActionsPlacement = "footer",
	renderEarlierRepliesLabel,
	renderReplyComposer,
	threaded = false,
	headerLayout = "stacked",
}: Readonly<{
	entry: JiraActivityCommentEntry;
	bodyContent?: ReactNode;
	headerLayout?: JiraActivityCardProps["headerLayout"];
	currentUser: JiraActivityActor;
	actorsById: ReadonlyMap<string, JiraActivityActor>;
	onSubmitReply: (body: string, mentionedAgentIds?: readonly string[]) => void;
	onToggleReaction: (emoji: string) => void;
	/** Toggle resolve on review discussion threads (`allowResolve`). */
	onResolve?: () => void;
	onAddToChat?: () => void;
	onAddReplyToChat?: (reply: JiraActivityReply) => void;
	onViewSession?: (item: AgentListItem) => void;
	action?: ReactNode;
	renderCommentTools?: (entry: JiraActivityCommentEntry, reply?: JiraActivityReply) => ReactNode;
	renderTimestamp?: (item: JiraActivityEntry | JiraActivityReply) => ReactNode;
	renderReplyBody?: (reply: JiraActivityReply) => ReactNode;
	renderReply?: (reply: JiraActivityReply) => ReactNode | undefined;
	replyDraft?: string;
	onReplyDraftChange?: (value: string) => void;
	replyRequestId?: number;
	commentActions?: "none" | "reactions" | "reply-and-reactions";
	commentActionsPlacement?: "footer" | "hover";
	renderEarlierRepliesLabel?: (hiddenReplies: readonly JiraActivityReply[], expanded: boolean) => ReactNode;
	/** Replaces the default reply composer so a surface can reuse its own comment box. */
	renderReplyComposer?: (composer: JiraActivityReplyComposerProps) => ReactNode;
	threaded?: boolean;
}>) {
	const replies = entry.replies ?? [];
	const hasReplies = replies.length > 0;
	const hasReplyPreview = entry.replyPreviewCount !== undefined;
	const replyPreviewCount = Math.max(0, Math.floor(entry.replyPreviewCount ?? 0));
	const allowReply = entry.allowReply ?? true;
	const allowResolve = Boolean(entry.allowResolve);
	const resolved = Boolean(entry.resolved);
	const nested = Boolean(entry.parentId);
	const collapsible = commentActions === "reply-and-reactions";
	const [replyTarget, setReplyTarget] = useState<{
		key: string;
		actor: JiraActivityActor;
		initialDraft: string;
	} | null>(null);
	const [localReplyDraft, setLocalReplyDraft] = useState("");
	const replyDraft = controlledReplyDraft ?? localReplyDraft;
	const [handledReplyRequestId, setHandledReplyRequestId] = useState<number | undefined>();
	if (replyRequestId !== undefined && replyRequestId !== handledReplyRequestId) {
		setHandledReplyRequestId(replyRequestId);
		setReplyTarget({ key: entry.id, actor: entry.actor, initialDraft: replyDraft });
	}
	function setReplyDraft(value: string) {
		if (controlledReplyDraft === undefined) setLocalReplyDraft(value);
		onReplyDraftChange?.(value);
	}
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
			if (controlledReplyDraft === undefined) setReplyDraft("");
			return;
		}
		if (controlledReplyDraft !== undefined) {
			setReplyTarget({ key, actor, initialDraft: replyDraft });
			return;
		}
		setReplyTarget({ key, actor, initialDraft: "" });
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
	const repliesToggle = hasReplies && !hasReplyPreview ? (
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
			{repliesExpanded ? <ShrinkVerticalIcon label="" /> : <GrowVerticalIcon label="" />}
		</Button>
	) : null;
	const earlierRepliesToggle = hasReplyPreview && replies.length > replyPreviewCount ? (
		<Button
			aria-controls={repliesId}
			aria-expanded={repliesExpanded}
			// Threaded: trim the leading inset so faces and label start on the reply text column, while the hover plate stays clear of the connector curve.
			className={cn("relative justify-self-start", threaded ? "-ml-1 pl-1 font-normal text-text-subtle" : null)}
			onClick={() => setRepliesExpanded((expanded) => !expanded)}
			size="compact"
			type="button"
			variant={threaded ? "ghost" : "link"}
		>
			{threaded ? (
				<span aria-hidden className="absolute -left-[29px] flex h-5 w-4 items-center justify-center bg-surface text-icon-subtle [&>span]:inline-flex [&>span]:items-center [&>span]:justify-center" data-jira-activity-reply-toggle-icon>
					{repliesExpanded ? <ShrinkVerticalIcon label="" size="small" /> : <GrowVerticalIcon label="" size="small" />}
				</span>
			) : null}
			{renderEarlierRepliesLabel ? renderEarlierRepliesLabel(replies.slice(0, replies.length - replyPreviewCount), repliesExpanded) : <>
				{repliesExpanded ? "Hide earlier replies" : "Show more replies"}
			</>}
		</Button>
	) : null;
	const addToChatAction = onAddToChat ? (
		<JiraActivityAddToChatButton onClick={onAddToChat} />
	) : null;
	const hoverActions = commentActionsPlacement === "hover" && commentActions !== "none" && !resolved;
	const actionRow = (
		<JiraActivityCommentActions
			onReply={
				collapsible && allowReply
					? () => toggleReply(entry.id, entry.actor, replyButtonRef.current)
					: undefined
			}
			onResolve={!resolved && allowResolve && onResolve ? handleResolveToggle : undefined}
			onToggleReaction={onToggleReaction}
			reactions={hoverActions ? [] : reactionSummaries}
			replyComposerId={replyTarget?.key === entry.id ? composerId : undefined}
			replyExpanded={replyTarget?.key === entry.id}
			replyRef={replyButtonRef}
			trailingActions={renderCommentTools?.(entry)}
		/>
	);
	// Footer mode keeps the full row under the body; hover mode lifts Reply,
	// Add reaction, and tools into the header slot and leaves only pills below.
	const commentActionControls = commentActions === "none" ? null
		: hoverActions
			? reactionSummaries.length > 0 ? <EmojiReactionBar onToggleReaction={onToggleReaction} reactions={reactionSummaries} showAddReaction={false} /> : null
			: actionRow;
	// Far-right: optional consumer action, hover actions, Add to chat, then expand/collapse.
	const headerAction = action || repliesToggle || addToChatAction || hoverActions ? (
		<div className="flex shrink-0 items-center gap-1">
			{action}
			{hoverActions ? actionRow : null}
			{addToChatAction}
			{repliesToggle}
		</div>
	) : undefined;
	const collapsedThreadSummary = hasReplies && !repliesExpanded && !hasReplyPreview ? (
		<CollapsedThreadSummary
			onExpand={() => setRepliesExpanded(true)}
			replies={replies}
			resolved={resolved}
		/>
	) : null;
	const replyMentionRequest = useMemo(() => {
		if (!replyTarget) return undefined;
		const mention = getReplyMention(replyTarget.actor);
		const prefix = `@${mention.label}`;
		const draft = replyTarget.initialDraft;
		if (draft.trim() && !draft.startsWith(`${prefix} `)) return undefined;
		return { mention, requestKey: 1, textAfter: draft.slice(prefix.length) || " " };
	}, [replyTarget]);
	const replyPlaceholder = entry.sessionItem ? "Ask, @mention, or / for actions" : "Leave a reply...";
	function submitReply(body: string, mentionedAgentIds?: readonly string[]) {
		onSubmitReply(body, mentionedAgentIds);
		if (collapsible) {
			setReplyTarget(null);
			setReplyDraft("");
		}
	}
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
			agentName={entry.headerLabel ?? entry.actor.name}
			className={nested ? "rounded-none" : undefined}
			// Timeline node owns the size-8 avatar; nested replies keep pl-6. The
			// flush composer pulls back across w-8 + gap-2 so it lines up with the
			// parent avatar, not the indented reply column.
			headerAvatar={nested ? <ActivityActorAvatar actor={entry.actor} /> : undefined}
			hideLeadAvatar={!nested}
			headerLayout={headerLayout}
			threadConnector={threaded && (hasReplies || composerVisible)}
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
						className={threaded ? "relative py-3" : "-ml-10 w-[calc(100%+2.5rem)]"}
						id={composerId}
					>
						{/* Centered: the branch meets the composer at its vertical middle, whatever the composer's height. */}
						{threaded ? <ThreadConnector centered continued={false} /> : null}
						{renderReplyComposer ? (
							<Fragment key={`${replyTarget?.key ?? "thread-reply"}-${handledReplyRequestId ?? 0}`}>
								{renderReplyComposer({
									autoFocus: collapsible,
									onSubmit: submitReply,
									onValueChange: setReplyDraft,
									placeholder: replyPlaceholder,
									prefillMention: replyMentionRequest ? { mention: replyMentionRequest.mention, textAfter: replyMentionRequest.textAfter } : undefined,
									value: replyDraft,
								})}
							</Fragment>
						) : (
							<JiraActivityComposer
								author={currentUser}
								// In collapsible mode the composer only mounts on a Reply
								// click, so mounting is exactly the moment to take focus.
								autoFocus={collapsible}
								key={replyTarget?.key ?? "thread-reply"}
								onSubmit={submitReply}
								onValueChange={setReplyDraft}
								prefillMentionRequest={replyMentionRequest}
								placeholder={replyPlaceholder}
								value={replyDraft}
								variant="flush"
							/>
						)}
					</div>
				) : undefined
			}
			replies={
				hasReplies ? (
					<>
					{threaded && earlierRepliesToggle ? (
						<div className="relative py-3">
							<ThreadContinuation />
							<div className="relative flex">{earlierRepliesToggle}</div>
						</div>
					) : earlierRepliesToggle}
					<div
						aria-label="Replies"
						className={cn("grid", threaded ? "gap-0" : "gap-2", repliesExpanded || hasReplyPreview ? null : "hidden")}
						hidden={!repliesExpanded && !hasReplyPreview}
						id={repliesId}
						role="group"
					>
						{replies.map((reply, index) => (
							<ThreadReplyCard
								attributedBy={reply.actor.kind === "agent" && reply.actor.id === entry.actor.id ? entry.attributedBy : undefined}
								headerLayout={headerLayout}
								allowReply={allowReply}
								bodyContent={renderReplyBody?.(reply)}
								content={renderReply?.(reply)}
								commentActions={commentActions}
								currentUser={currentUser}
								actorsById={actorsById}
								key={reply.id}
								hidden={hasReplyPreview && !repliesExpanded && index < replies.length - replyPreviewCount}
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
								indented={!nested && !threaded}
								threaded={threaded}
								continued={index < replies.length - 1 || composerVisible}
								actionsPlacement={commentActionsPlacement}
								showResolvedStatus={resolved && index === replies.length - 1}
								timestampContent={renderTimestamp?.(reply)}
								tools={renderCommentTools?.(entry, reply)}
							/>
						))}
					</div>
					</>
				) : undefined
			}
			tag={entry.tag}
			timestamp={entry.timestamp}
			timestampContent={renderTimestamp?.(entry)}
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
