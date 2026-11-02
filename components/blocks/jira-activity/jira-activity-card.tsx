"use client";

import { useState, type ReactNode } from "react";

import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import {
	AgentListActivityHeader,
	type AgentListItem,
} from "@/components/blocks/agent-list";
import { Icon } from "@/components/ui/icon";
import { Tag, type TagColor } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

export interface JiraActivityCardProps {
	/** Session summary shown as the rich activity-card header. */
	item?: AgentListItem;
	/** Agent name shown in the activity-card header. */
	agentName?: string;
	/** Fixed sent timestamp shown before active runtime in agent-session headers. */
	timestamp?: string;
	/** Optional replacement for the timestamp in a plain comment header. */
	timestampContent?: ReactNode;
	/** Optional status tag shown in the activity-card header. */
	tag?: { text: string; color?: TagColor };
	/** Optional metadata rendered immediately after the plain-header timestamp. */
	timestampMeta?: ReactNode;
	/** Optional trailing header action supplied by the consuming surface. */
	action?: ReactNode;
	/** Optional leading identity shown in the plain activity-card header. */
	headerAvatar?: ReactNode;
	headerConnector?: ReactNode;
	/**
	 * When true, omit the leading avatar — the timeline node already owns the
	 * size-8 identity so the content column stays flush with event copy.
	 */
	hideLeadAvatar?: boolean;
	/** Header geometry for plain activity cards without a session summary. */
	headerLayout?: "inline" | "stacked";
	/** Draw the parent stem below its avatar, stopping before the branched replies. */
	threadConnector?: boolean;
	/** Named hover scope for cards nested inside another activity card. */
	activityGroup?: "activity-card" | "activity-reply";
	/** Called when the rich activity header's View button is activated. */
	onView?: (item: AgentListItem) => void;
	/** Main activity content rendered inside the card. */
	children: ReactNode;
	/** Optional expandable supporting detail, such as a prompt or investigation. */
	details?: { label: string; children: ReactNode };
	/** Optional action row (reply, reactions) rendered under the activity content. */
	footerActions?: ReactNode;
	/** Optional rendered replies shown below the activity content. */
	replies?: ReactNode;
	/** Optional reply composer shown at the bottom of the card. */
	replyComposer?: ReactNode;
	className?: string;
}

/**
 * Shared card shell for Jira Activity comments. It owns the human and agent
 * header treatments, expandable details, replies, and flush composer footer.
 * Agent List supplies only the session-specific header presentation.
 */
export function JiraActivityCard({
	item,
	agentName,
	timestamp,
	timestampContent,
	tag,
	timestampMeta,
	action,
	headerAvatar,
	headerConnector,
	hideLeadAvatar = false,
	headerLayout = "inline",
	threadConnector = false,
	activityGroup = "activity-card",
	onView,
	children,
	details,
	footerActions,
	replies,
	replyComposer,
	className,
}: Readonly<JiraActivityCardProps>) {
	const [detailsOpen, setDetailsOpen] = useState(false);
	const showFooter = replies != null || replyComposer != null;
	const detailsContent = details ? (
		<div className="grid gap-1">
			<button
				aria-expanded={detailsOpen}
				className="flex items-center gap-1 self-start rounded-xs text-sm font-medium text-text focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
				onClick={() => setDetailsOpen((previousOpen) => !previousOpen)}
				type="button"
			>
				<Icon
					aria-hidden
					className={cn(
						"text-icon-subtle transition-transform duration-fast ease-out-practical motion-reduce:transition-none",
						detailsOpen ? "rotate-90" : null,
					)}
					render={<ChevronRightIcon color="currentColor" label="" size="small" />}
				/>
				{details.label}
			</button>
			{detailsOpen ? details.children : null}
		</div>
	) : null;
	const hasStackedHeader = headerLayout === "stacked";
	const hasExpandedLayout = item != null || hasStackedHeader;
	const activityGroupClass = activityGroup === "activity-reply"
		? "group/activity-reply"
		: "group/activity-card";
	// One body owner for session cards and plain comments: copy, checklist, and
	// artifacts share text-sm / leading-5, with mt-3 between in-body blocks.
	const body = (
		<div className="min-w-0 text-sm leading-5 text-text">{children}</div>
	);
	// Revealed on hover, but kept in layout and in the tab order: a `display: none`
	// wrapper could never satisfy its own `:focus-visible` reveal condition.
	const actionVisibilityClass = activityGroup === "activity-reply"
		? "group-hover/activity-reply:pointer-events-auto group-hover/activity-reply:opacity-100 group-has-[:focus-visible]/activity-reply:pointer-events-auto group-has-[:focus-visible]/activity-reply:opacity-100"
		: "group-hover/activity-card:pointer-events-auto group-hover/activity-card:opacity-100 group-has-[:focus-visible]/activity-card:pointer-events-auto group-has-[:focus-visible]/activity-card:opacity-100";

	return (
		<div
			className={cn(
				// Hover/focus group wraps the full card (header, body, replies) so
				// header actions stay interactive while the pointer is anywhere on
				// the thread — including nested replies and the collapse control.
				activityGroupClass,
				// Visible so Avatar hover scale (1.12) is not clipped on the flush edge.
				// Transparent — comment chrome is borderless and inherits the feed surface.
				// min-w-0 keeps long checklist / artifact rows inside the metadata rail.
				"w-full min-w-0 overflow-visible bg-transparent",
				hasExpandedLayout ? "rounded-xl" : "rounded-lg",
				className,
			)}
		>
			<div
				className={cn(
					"relative grid min-w-0",
					hasExpandedLayout ? "gap-3" : "gap-2",
				)}
			>
				{threadConnector ? <span aria-hidden className="pointer-events-none absolute -left-6 bottom-0 top-10 w-px -translate-x-1/2 bg-bg-accent-gray-subtler" data-jira-activity-thread-stem /> : null}
				{item ? (
					<>
						<div className="relative min-w-0">
							{headerConnector}
							<AgentListActivityHeader
								action={action}
								activityGroup={activityGroup}
								hideAvatar={hideLeadAvatar}
								item={item}
								key={item.id}
								leadWithAgentName
								messageTimestamp={timestamp}
								onView={onView}
							/>
						</div>
						{body}
					</>
				) : (
					<>
						<div
							className={cn(
								"relative flex min-w-0 items-center gap-2",
								// Match the timeline node's h-10 card track so the
								// name/timestamp block optically centers with the
								// out-of-card size-8 avatar (same as items-center
								// when the avatar lived in this row).
								hideLeadAvatar ? "min-h-10" : null,
							)}
						>
							{headerConnector}
							{hideLeadAvatar ? null : headerAvatar}
							{hasStackedHeader ? (
								<div className="min-w-0 flex-1 overflow-hidden">
									<div className="flex min-w-0 items-center overflow-hidden">
										<span className="min-w-0 truncate text-sm font-medium text-text">
											{agentName}
										</span>
									</div>
									<div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs leading-4 text-text-subtle">
										{timestampContent === undefined ? <span className="shrink-0">{timestamp}</span> : <span className="shrink-0">{timestampContent}</span>}
										{timestampMeta}
										{tag ? <Tag color={tag.color ?? "gray"}>{tag.text}</Tag> : null}
									</div>
								</div>
							) : (
								<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5">
									<span className="font-medium text-text">{agentName}</span>
									<span className="inline-flex items-center text-text-subtle">{timestampContent === undefined ? timestamp : timestampContent}</span>
									{timestampMeta}
									{tag ? <Tag color={tag.color ?? "gray"}>{tag.text}</Tag> : null}
								</div>
							)}
							{action ? (
								<div
									className={cn(
										"relative z-10 pointer-events-none flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-normal ease-out-practical motion-reduce:transition-none",
										actionVisibilityClass,
									)}
								>
									{action}
								</div>
							) : null}
						</div>

						{body}
					</>
				)}
				{detailsContent}
				{/* Last child of the body grid: inherits the card's gap and sits flush
				under the content, while the footer keeps hosting replies. */}
				{footerActions}
			</div>

			{showFooter ? (
				<div className={cn("grid", threadConnector ? "gap-0" : "gap-3")}>
					{replies}
					{replyComposer}
				</div>
			) : null}
		</div>
	);
}
