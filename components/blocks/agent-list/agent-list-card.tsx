"use client";

import { useState, type ReactNode } from "react";

import ArchiveBoxIcon from "@atlaskit/icon/core/archive-box";
import DevicesIcon from "@atlaskit/icon/core/devices";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import StatusInformationIcon from "@atlaskit/icon/core/status-information";
import StatusWarningIcon from "@atlaskit/icon/core/status-warning";

import { AnimatedDots } from "@/components/ui-custom/animated-dots";
import { PixelLoader } from "@/components/ui-custom/pixel-loader";
import {
	AgentStates,
	type AgentStatesState,
} from "@/components/blocks/agent-states";
import {
	JiraSessionFlyoutTrigger,
	type JiraSessionFlyoutHandle,
} from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { Button } from "@/components/ui/button";
import { ElapsedTime, RelativeTime } from "@/components/ui/elapsed-time";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
	createHoverCardHandle,
} from "@/components/ui/hover-card";
import { IconTile } from "@/components/ui/icon-tile";
import { toCompactRelativeTimeLabel } from "@/lib/elapsed-time";
import { cn } from "@/lib/utils";

import { AgentListIdentity } from "./agent-list-identity";
import { InvokerBy } from "./agent-list-invoker";
import { AgentListCardActions } from "./agent-list-card-actions";
import type { AgentListRowAction } from "./agent-list-row-action";
import { isLocalAgentListItem, toAgentSessionFlyoutItem } from "./agent-list-session";
import type {
	AgentListCustomFlyoutActions,
	AgentListFlyout,
	AgentListItem,
	AgentListPrStatus,
	AgentListState,
	AgentListVariant,
} from "./agent-list-types";

export { AgentListIdentity } from "./agent-list-identity";

/**
 * State → title-line + lifecycle treatment. `running` shimmers the work title with a
 * trailing pixel loader; `needs-input` swaps the title for "Needs input"
 * (see {@link getSessionTitle}), adds animated dots, and shows a trailing info
 * icon; `attention` keeps the row's own title — it is already the news — and
 * shows a trailing warning icon; `complete` shows a solid title with no
 * lifecycle indicator.
 *
 * Activity headers that lead with the agent name move the needs-input treatment
 * onto the metadata status ("Needs input" + shimmer + dots) instead of trailing
 * dots after the agent identity.
 *
 * The trailing indicator itself is rendered by {@link LifecycleIndicator};
 * `showLifecycle` only gates whether the row reserves that trailing slot.
 */
const STATE_META: Record<
	AgentListState,
	{
		shimmerTitle: boolean;
		showDots: boolean;
		/** Whether the row renders a trailing lifecycle indicator. */
		showLifecycle: boolean;
	}
> = {
	running: {
		shimmerTitle: true,
		showDots: false,
		showLifecycle: true,
	},
	"needs-input": {
		shimmerTitle: true,
		showDots: true,
		showLifecycle: true,
	},
	attention: {
		shimmerTitle: false,
		showDots: false,
		showLifecycle: true,
	},
	complete: {
		shimmerTitle: false,
		showDots: false,
		showLifecycle: false,
	},
};

/** Status copy for activity headers while a session is blocked on the viewer. */
const NEEDS_INPUT_STATUS_LABEL = "Needs input";

/**
 * Pull-request status → icon + color, matching the Jira queue card
 * (`components/blocks/product-sidebar/variants/jira.tsx`).
 */
const PR_STATUS_META: Record<
	AgentListPrStatus,
	{ Icon: typeof PullRequestIcon; label: string; colorClass: string }
> = {
	created: {
		Icon: PullRequestIcon,
		label: "PR created",
		colorClass: "text-icon-success",
	},
	merged: {
		Icon: MergeSuccessIcon,
		label: "PR merged",
		colorClass: "text-icon-accent-purple",
	},
	failed: {
		Icon: MergeFailureIcon,
		label: "PR failed",
		colorClass: "text-icon-danger",
	},
};

export function AgentListPrStatusIcon({
	className,
	status,
}: Readonly<{ className?: string; status: AgentListPrStatus }>) {
	const { Icon: PrIcon, colorClass, label } = PR_STATUS_META[status];

	return (
		<span
			aria-label={label}
			className={cn("grid size-4 shrink-0 place-items-center", colorClass, className)}
			role="img"
			title={label}
		>
			<PrIcon color="currentColor" label="" size="small" />
		</span>
	);
}

function MetadataDot() {
	return (
		<span aria-hidden="true" className="text-text-subtlest">
			·
		</span>
	);
}

/** Copy shown on the title line while a session is blocked awaiting a reply. */
const AWAITING_INPUT_TITLE = "Needs input";

/**
 * Title-line text for a session row. `needs-input` swaps the work-item title for
 * "Needs input", mirroring the Jira queue card's `JiraSessionLabel`
 * (`components/blocks/product-sidebar/variants/jira.tsx`), so the shimmering line
 * names the state the session is blocked on. Other states show the task title.
 */
function getSessionTitle(item: AgentListItem): string {
	return item.state === "needs-input" ? AWAITING_INPUT_TITLE : item.title;
}

function getAgentStatesState(state: AgentListState): AgentStatesState {
	switch (state) {
		case "running":
			return "working";
		case "needs-input":
		case "attention":
			return "awaiting-input";
		case "complete":
			return "completed";
	}
}

/**
 * Trailing per-state lifecycle indicator: `running` shows the pixel loader,
 * `needs-input` an information icon, `attention` a warning icon, `complete`
 * nothing. Each indicator keeps a 24×24 trailing slot with a 12px visual
 * footprint.
 */
function LifecycleIndicator({
	state,
}: Readonly<{ state: AgentListState }>) {
	switch (state) {
		case "running":
			return (
				<span className="grid size-6 shrink-0 place-items-center text-icon">
					<PixelLoader
						className="size-3 justify-center"
						pattern="diagonal-top-left"
						shape="dot"
						size="small"
					/>
				</span>
			);
		case "needs-input":
			return (
				<IconTile
					icon={
						<span className="grid place-items-center leading-none text-icon-information">
							<StatusInformationIcon
								color="currentColor"
								label=""
								size="small"
							/>
						</span>
					}
					iconSize="small"
					label="Needs input"
					size="small"
					title="Needs input"
					variant="transparent"
				/>
			);
		case "attention":
			return (
				<IconTile
					icon={
						<span className="grid place-items-center leading-none text-icon-warning">
							<StatusWarningIcon color="currentColor" label="" size="small" />
						</span>
					}
					iconSize="small"
					label="Needs attention"
					size="small"
					title="Needs attention"
					variant="transparent"
				/>
			);
		case "complete":
			return null;
	}
}

/**
 * The row's time. A pre-formatted `timeLabel` wins outright — a historical row
 * states when something happened, and aging it once a second would both lie and
 * cost an interval per row. Local sessions are also static: they name a machine,
 * not a ticking runtime. Otherwise only genuinely live cloud states count up;
 * everything settled reads as a relative timestamp.
 */
export function AgentListTime({
	item,
	fallback = "Just now",
}: Readonly<{
	item: AgentListItem;
	fallback?: string;
}>) {
	const [seededStartedAtMs] = useState(
		() => Date.now() - Math.max(0, item.elapsedSeconds ?? 0) * 1000,
	);

	if (item.timeLabel !== undefined) {
		return <span>{toCompactRelativeTimeLabel(item.timeLabel)}</span>;
	}

	const isLive = !isLocalAgentListItem(item)
		&& (item.state === "running" || item.state === "needs-input");

	return isLive ? (
		<ElapsedTime startedAtMs={item.startedAtMs ?? seededStartedAtMs} />
	) : (
		<RelativeTime
			fallback={fallback}
			secondsAgo={item.completedSecondsAgo}
			timestampMs={item.completedAtMs}
		/>
	);
}

/**
 * Tooltip for the row's time slot. Only genuinely live states are counting up;
 * everything else is stating when the row last changed.
 */
function timeSlotTitle(item: AgentListItem): string {
	if (isLocalAgentListItem(item)) {
		return "Last update";
	}

	return item.state === "running" || item.state === "needs-input"
		? "Agent runtime"
		: "Last update";
}

/**
 * Primary action copy. Person rows are comments and @mentions, so they Reply;
 * local sessions Resume on the viewer's machine; cloud agent sessions are
 * inspected with View. A row can override any of those with `actionLabel`.
 */
function rowPrimaryActionLabel(item: AgentListItem): string {
	if (item.actionLabel !== undefined) {
		return item.actionLabel;
	}

	if (item.agent.kind === "person") {
		return "Reply";
	}

	return isLocalAgentListItem(item) ? "Resume" : "View";
}

/**
 * Identity on the metadata line. Cloud rows name the agent; local rows name the
 * machine beside a devices glyph, matching the Jira session flyout host chip's
 * machine copy. The invoker face belongs on InvokerBy / activity headers, not
 * next to the machine name.
 */
function AgentListMetadataIdentity({ item }: Readonly<{ item: AgentListItem }>) {
	if (isLocalAgentListItem(item) && item.machineName) {
		return (
			<span className="flex min-w-0 items-center gap-1 overflow-visible">
				<span
					aria-hidden="true"
					className="grid size-4 shrink-0 place-items-center"
				>
					<DevicesIcon color="currentColor" label="" size="small" />
				</span>
				<span className="min-w-0 truncate">{item.machineName}</span>
			</span>
		);
	}

	return <span className="min-w-0 truncate">{item.agent.name}</span>;
}

export function AgentListActivityHeader({
	item,
	action,
	activityGroup = "activity-card",
	hideAvatar = false,
	leadWithAgentName = false,
	messageTimestamp,
	metadataPrefix,
	onView,
	timeFallback,
}: Readonly<{
	item: AgentListItem;
	action?: ReactNode;
	activityGroup?: "activity-card" | "activity-reply";
	/** When true, omit the leading avatar (e.g. timeline node already shows it). */
	hideAvatar?: boolean;
	leadWithAgentName?: boolean;
	messageTimestamp?: string;
	metadataPrefix?: ReactNode;
	onView?: (item: AgentListItem) => void;
	timeFallback?: string;
}>) {
	const stateMeta = STATE_META[item.state];
	const prMeta = item.prStatus ? PR_STATUS_META[item.prStatus] : null;
	const PrIcon = prMeta?.Icon ?? null;
	const title = leadWithAgentName ? item.agent.name : getSessionTitle(item);
	const needsInput = item.state === "needs-input";
	const activityTimeTitle = item.state === "running"
		? "Agent runtime"
		: needsInput
			? NEEDS_INPUT_STATUS_LABEL
			: "Last update";
	const hasTrailingActions = Boolean(onView || action);
	// When the title already leads with the agent name, keep dots off that line —
	// the needs-input status in metadata owns the Rovo animated-dots indicator.
	const showTitleDots = stateMeta.showDots && !leadWithAgentName;
	// Revealed on hover/focus, but kept in the tab order: a `display: none`
	// wrapper could never satisfy its own `:focus-visible` reveal condition.
	// Width collapses via `0fr`/`1fr` so the lifecycle indicator sits flush
	// right at rest and only shifts inward when actions expand.
	const actionVisibilityClass = activityGroup === "activity-reply"
		? "group-hover/activity-reply:pointer-events-auto group-hover/activity-reply:opacity-100 group-has-[:focus-visible]/activity-reply:pointer-events-auto group-has-[:focus-visible]/activity-reply:opacity-100"
		: "group-hover/activity-card:pointer-events-auto group-hover/activity-card:opacity-100 group-has-[:focus-visible]/activity-card:pointer-events-auto group-has-[:focus-visible]/activity-card:opacity-100";
	const actionWidthClass = activityGroup === "activity-reply"
		? "grid-cols-[0fr] group-hover/activity-reply:grid-cols-[1fr] group-has-[:focus-visible]/activity-reply:grid-cols-[1fr]"
		: "grid-cols-[0fr] group-hover/activity-card:grid-cols-[1fr] group-has-[:focus-visible]/activity-card:grid-cols-[1fr]";

	return (
		<div
			className={cn(
				"flex min-w-0 items-center gap-2",
				// Timeline node owns the size-8 avatar in an h-10 track; keep this
				// two-line header on the same first-row height for optical center.
				hideAvatar ? "min-h-10" : null,
			)}
		>
			{hideAvatar ? null : (
				<AgentListIdentity
					agent={item.agent}
					className="shrink-0"
					sizePx={32}
				/>
			)}
			<div className="min-w-0 flex-1 overflow-hidden">
				<div className="flex min-w-0 items-center overflow-hidden">
					{stateMeta.shimmerTitle && !leadWithAgentName ? (
						<Shimmer
							as="span"
							className="min-w-0 truncate text-sm font-medium"
							duration={1.4}
							spread={2}
						>
							{title}
						</Shimmer>
					) : (
						<span className="min-w-0 truncate text-sm font-medium text-text">
							{title}
						</span>
					)}
					{showTitleDots ? <AnimatedDots /> : null}
				</div>
				{/* Fixed chips stay shrink-0; Working for… owns the ellipsis when
				    hover actions expand and steal width from this flex-1 column. */}
				<div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs leading-4 text-text-subtle">
					{metadataPrefix ? (
						<>
							{metadataPrefix}
							<MetadataDot />
						</>
					) : null}
					{messageTimestamp ? (
						<span className="shrink-0" title="Message sent">
							{messageTimestamp}
						</span>
					) : null}
					{messageTimestamp && item.invokedBy ? (
						<InvokerBy invoker={item.invokedBy} />
					) : null}
					{messageTimestamp && item.state !== "complete" ? <MetadataDot /> : null}
					{needsInput ? (
						<span
							className="inline-flex min-w-0 shrink-0 items-baseline"
							title={NEEDS_INPUT_STATUS_LABEL}
						>
							<Shimmer as="span" duration={1.4} spread={2}>
								{NEEDS_INPUT_STATUS_LABEL}
							</Shimmer>
							<AnimatedDots />
						</span>
					) : !messageTimestamp || item.state !== "complete" ? (
						<span
							className="min-w-0 truncate"
							title={activityTimeTitle}
						>
							{messageTimestamp ? "Working for " : null}
							<AgentListTime fallback={timeFallback} item={item} />
						</span>
					) : null}
					{!messageTimestamp && item.invokedBy ? (
						<InvokerBy invoker={item.invokedBy} />
					) : null}
					{leadWithAgentName ? null : (
						<>
							<MetadataDot />
							<span className="min-w-0 truncate">{item.agent.name}</span>
						</>
					)}
					{prMeta && PrIcon ? (
						<>
							<MetadataDot />
							<span className="flex shrink-0 items-center gap-1">
								<span className={cn("grid size-4 place-items-center", prMeta.colorClass)}>
									<PrIcon color="currentColor" label="" size="small" />
								</span>
								<span>{prMeta.label}</span>
							</span>
						</>
					) : null}
				</div>
			</div>
			{stateMeta.showLifecycle || hasTrailingActions ? (
				<div className="relative z-10 ml-auto flex shrink-0 items-center">
					{stateMeta.showLifecycle ? <LifecycleIndicator state={item.state} /> : null}
					{hasTrailingActions ? (
						<div
							className={cn(
								"grid transition-[grid-template-columns] duration-normal ease-out-practical motion-reduce:transition-none",
								actionWidthClass,
							)}
						>
							<div className="min-w-0 overflow-hidden has-[:focus-visible]:overflow-visible">
								<div
									className={cn(
										"pointer-events-none flex shrink-0 items-center gap-1 pl-2 opacity-0 transition-opacity duration-normal ease-out-practical motion-reduce:transition-none",
										actionVisibilityClass,
									)}
								>
									{onView ? (
										<Button onClick={() => onView(item)} size="compact" type="button" variant="outline">
											View
										</Button>
									) : null}
									{action}
								</div>
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

/**
 * The row's title/metadata column: a button when the consumer gave it somewhere
 * to go, a plain box otherwise. Keeping the choice here means the two branches
 * cannot drift in layout, and a read-only list adds nothing to the tab order.
 */
function RowBody({
	children,
	className,
	isSelected,
	onView,
}: Readonly<{
	children: ReactNode;
	className: string;
	isSelected: boolean;
	onView?: () => void;
}>) {
	if (onView === undefined) {
		return <div className={className}>{children}</div>;
	}

	return (
		<button
			aria-pressed={isSelected}
			className={className}
			onClick={onView}
			type="button"
		>
			{children}
		</button>
	);
}

export type { AgentListRowAction };

/**
 * The controls a row owner reveals on hover/focus. The row stays generic about
 * what they do: Agent List builds View / Resume + Archive, Agent Session builds
 * a single "…" menu. Omit all of them to reveal nothing.
 */
export type AgentListRowHoverActions = Readonly<{
	primary?: AgentListRowAction;
	secondary?: AgentListRowAction;
	/**
	 * Caller-owned trailing control rendered after the button pair, for an
	 * affordance the `{icon,label,onClick}` record cannot express — a dropdown
	 * trigger, say, which needs to own its own element.
	 */
	menu?: ReactNode;
	/**
	 * Hold the reveal open regardless of pointer position. A portalled menu popup
	 * takes the pointer off the row, and a post-click confirmation outlives the
	 * hover that produced it; either would otherwise collapse this back to `0fr`
	 * mid-interaction.
	 */
	pinned?: boolean;
}>;

/** Class list for the `<li>` each flyout variant renders through its trigger. */
function rowClassName(isCompact: boolean, isSelected: boolean): string {
	return cn(
		"group/agent-row relative transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered",
		isCompact ? "px-3 py-1.5" : "p-3",
		isSelected && "bg-bg-selected hover:bg-bg-selected-hovered",
	);
}

/**
 * The row body, identical across both flyout variants. It is a single element so
 * `JiraSessionFlyoutTrigger` can clone its focus-capture handler onto it and open
 * the session flyout from the keyboard.
 */
export function AgentListRow({
	hideIdentity = false,
	hoverActions,
	isCompact,
	isSelected,
	item,
	lifecycle,
	metadata,
	onView,
	renderIdentity,
	showHoverActionsWhenSelected = false,
	stateAwareTitle = true,
	trailingAlign = "center",
}: Readonly<{
	/**
	 * Drop the leading identity column entirely. A title-led row puts the agent
	 * mark inside its own metadata line instead, and an empty wrapper would still
	 * spend its 12px right margin. Mirrors `hideAvatar` on
	 * {@link AgentListActivityHeader}.
	 */
	hideIdentity?: boolean;
	/** Controls revealed on hover/focus. Omit to render a row with no actions. */
	hoverActions?: AgentListRowHoverActions;
	isCompact: boolean;
	isSelected: boolean;
	item: AgentListItem;
	/**
	 * Caller-owned trailing lifecycle indicator, replacing the built-in one and
	 * its `STATE_META` gate. Symmetric with {@link metadata}: a specialized row
	 * states its own vocabulary, and `null` omits the slot entirely.
	 */
	lifecycle?: ReactNode;
	/** Caller-owned metadata. Pass `null` to omit the default metadata line. */
	metadata?: ReactNode;
	onView?: (item: AgentListItem) => void;
	/**
	 * Wrap the row's leading identity. Agent List never passes it.
	 */
	renderIdentity?: (identity: ReactNode) => ReactNode;
	/**
	 * Whether a blocked session takes over the title line with "Needs input" plus
	 * the shimmer-and-dots treatment. On by default, because on a plain row the
	 * state *is* the news. A row whose caller-owned {@link metadata} already
	 * states the lifecycle should turn this off — otherwise the state is said
	 * twice and the actual work name is nowhere on the card.
	 */
	stateAwareTitle?: boolean;
	/** Align the lifecycle and its replacement actions with a title-led metadata line. */
	trailingAlign?: "center" | "metadata";
	/**
	 * Keep Resume / Hide visible on a selected row. Agent List leaves this off
	 * because a selected list row is already the destination; session cards still
	 * need the hover pair after the article is highlighted.
	 */
	showHoverActionsWhenSelected?: boolean;
}>) {
	const stateMeta = STATE_META[item.state];
	const prMeta = item.prStatus ? PR_STATUS_META[item.prStatus] : null;
	const PrIcon = prMeta?.Icon ?? null;
	const hasSummary = Boolean(item.summary);
	// A selected Agent List row is already the destination, so it keeps its
	// lifecycle indicator. Session cards opt back in because Archive / Resume
	// still apply after the article is highlighted.
	const showHoverActions = (!isSelected || showHoverActionsWhenSelected) &&
		(hoverActions?.primary !== undefined
			|| hoverActions?.secondary !== undefined
			|| hoverActions?.menu !== undefined);
	const titleClassName = cn(
		"min-w-0 font-medium",
		hasSummary ? "text-pretty" : "truncate",
		isCompact ? "text-xs" : "text-sm",
	);

	const viewItem = onView === undefined ? undefined : () => onView(item);
	// A menu-only reveal (session "..." / viewer hint) must occupy the same
	// 24px trailing slot as the lifecycle glyph. Expanding a sibling `0fr`
	// column would move the trigger when hover, focus, or open swaps them.
	const overlayHoverActions = showHoverActions
		&& hoverActions?.primary === undefined
		&& hoverActions?.secondary === undefined
		&& hoverActions?.menu !== undefined;
	// `undefined` is "no opinion" and falls back to the `STATE_META` gate; an
	// explicit `null` means "no indicator". `??` silently collapsed the two.
	const lifecycleNode = lifecycle === undefined
		? (stateMeta.showLifecycle ? <LifecycleIndicator state={item.state} /> : null)
		: lifecycle;
	const identity = (
		<AgentListIdentity
			agent={item.agent}
			className={hasSummary ? "mt-0.5" : undefined}
			sizePx={isCompact ? 24 : 32}
		/>
	);

	return (
		<div
			className={cn(
				"flex w-full min-w-0 gap-0",
				// A summary makes the row taller than one line; the identity and the
				// trailing controls then belong beside the title, not floating in the
				// middle of a paragraph.
				hasSummary ? "items-start" : "items-center",
			)}
		>
			{hideIdentity ? null : (
				<div className="mr-3 shrink-0">
					{renderIdentity === undefined ? identity : renderIdentity(identity)}
				</div>
			)}
			<div
				className={cn(
					"flex min-w-0 flex-1 flex-col",
					overlayHoverActions && !lifecycleNode
						? [
							"group-hover/agent-row:pr-9 group-has-[:focus-visible]/agent-row:pr-9",
							"group-has-[[aria-expanded=true]]/agent-row:pr-9",
							hoverActions?.pinned ? "pr-9" : null,
						]
						: null,
				)}
			>
				<div
					className={cn(
						"flex min-w-0",
						hasSummary ? "items-start" : "items-center",
					)}
				>
					{/*
					 * The body is only a button when there is somewhere to go. A list
					 * without `onView` — a read-out of comments and @mentions, say —
					 * would otherwise put one focusable no-op in the tab order per row.
					 */}
					<RowBody
						className="flex min-w-0 flex-1 flex-col items-start justify-center rounded-xs text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
						isSelected={isSelected}
						onView={viewItem}
					>
						<span
							className={cn(
								"flex w-full min-w-0 items-center gap-0",
								hasSummary ? null : "overflow-hidden",
							)}
						>
							{stateAwareTitle && stateMeta.shimmerTitle ? (
								<Shimmer
									as="span"
									className={titleClassName}
									duration={1.4}
									spread={2}
								>
									{getSessionTitle(item)}
								</Shimmer>
							) : (
								<span
									className={cn(titleClassName, "text-text")}
									data-agent-list-title=""
								>
									{stateAwareTitle ? getSessionTitle(item) : item.title}
								</span>
							)}
							{stateAwareTitle && stateMeta.showDots ? <AnimatedDots /> : null}
						</span>
						{metadata === undefined ? (
							<span className="flex w-full min-w-0 items-center gap-1 text-xs text-text-subtlest">
								{item.metadataPrefix ? (
									<>
										<span className="shrink-0">{item.metadataPrefix}</span>
										<MetadataDot />
									</>
								) : null}
								<AgentListMetadataIdentity item={item} />
								{prMeta && PrIcon ? (
									<>
										<MetadataDot />
										<span className="flex min-w-0 shrink items-center gap-1">
											<span
												className={cn(
													"grid size-4 shrink-0 place-items-center",
													prMeta.colorClass,
												)}
											>
												<PrIcon color="currentColor" label="" size="small" />
											</span>
											<span className="truncate text-text-subtle">{prMeta.label}</span>
										</span>
									</>
								) : null}
								<MetadataDot />
								<span className="shrink-0" title={timeSlotTitle(item)}>
									<AgentListTime item={item} />
								</span>
							</span>
						) : metadata}
					</RowBody>
					{lifecycleNode ? (
						// A `div`, not a `span`: every non-running indicator is an
						// `IconTile`, whose root is a block element. Phrasing content
						// cannot contain it, and the invalid nesting surfaces as a
						// hydration recovery on server-rendered session lists.
						<div
							className={cn(
								"relative ml-3 flex min-h-6 min-w-6 shrink-0 items-center justify-end overflow-visible",
								// The 24px control is 4px taller than the metadata's 16px line.
								trailingAlign === "metadata" && "self-end -mb-1",
								!overlayHoverActions && "pointer-events-none",
								!overlayHoverActions && showHoverActions &&
									"group-hover/agent-row:hidden group-has-[:focus-visible]/agent-row:hidden",
								!overlayHoverActions && showHoverActions && hoverActions?.pinned && "hidden",
							)}
						>
							{lifecycleNode ? (
								<div
									className={cn(
										"flex items-center leading-none",
										overlayHoverActions
											? "group-hover/agent-row:pointer-events-none group-hover/agent-row:invisible group-has-[[data-agent-list-card-actions]:focus-within]/agent-row:pointer-events-none group-has-[[data-agent-list-card-actions]:focus-within]/agent-row:invisible group-has-[[aria-expanded=true]]/agent-row:pointer-events-none group-has-[[aria-expanded=true]]/agent-row:invisible"
											: "pointer-events-none",
										overlayHoverActions && hoverActions?.pinned && "pointer-events-none invisible",
									)}
								>
									{lifecycleNode}
								</div>
							) : null}
							{overlayHoverActions ? (
								<AgentListCardActions
									menu={hoverActions?.menu}
									overlay
									pinned={hoverActions?.pinned}
								/>
							) : null}
						</div>
					) : null}
					{overlayHoverActions && !lifecycleNode ? (
						<div className="pointer-events-none absolute inset-y-0 right-3 flex w-6 items-center justify-center">
							<AgentListCardActions
								menu={hoverActions?.menu}
								overlay
								pinned={hoverActions?.pinned}
							/>
						</div>
					) : null}
					{showHoverActions && !overlayHoverActions ? (
						<AgentListCardActions
							menu={hoverActions?.menu}
							pinned={hoverActions?.pinned}
							primary={hoverActions?.primary}
							secondary={hoverActions?.secondary}
						/>
					) : null}
				</div>
				{/* Own column under the title row: hover actions steal width from
				    title/metadata only. A summary cut off at one line is not a
				    summary, so this wraps rather than truncates. */}
				{item.summary ? (
					<span
						className={cn(
							"mt-2 w-full min-w-0 text-pretty text-text",
							isCompact ? "text-xs leading-4" : "text-sm leading-5",
						)}
					>
						{item.summary}
					</span>
				) : null}
			</div>
		</div>
	);
}

export function AgentListCard({
	flyout,
	flyoutHandle,
	isSelected = false,
	item,
	onArchive,
	onFlyoutSubmit,
	onView,
	renderFlyout,
	variant,
}: Readonly<{
	/** Which flyout this row opens — see {@link AgentListFlyout}. */
	flyout: AgentListFlyout;
	/** Shared payload handle for the list's single Jira session flyout. */
	flyoutHandle: JiraSessionFlyoutHandle;
	isSelected?: boolean;
	item: AgentListItem;
	onArchive?: (item: AgentListItem) => void;
	/** Composer variant only: called when the Agent States composer submits. */
	onFlyoutSubmit?: (prompt: string) => void;
	onView?: (item: AgentListItem) => void;
	renderFlyout?: (item: AgentListItem, actions: AgentListCustomFlyoutActions) => ReactNode;
	variant: AgentListVariant;
}>) {
	const [customFlyoutHandle] = useState(createHoverCardHandle);
	const isCompact = variant === "compact";
	// Agent List's own adapter onto the row's generic action slot. A list without
	// `onView` has nowhere to go, so it reveals nothing rather than putting a
	// no-op control in the tab order once per row.
	const hoverActions: AgentListRowHoverActions | undefined = onView === undefined
		? undefined
		: {
			primary: {
				label: rowPrimaryActionLabel(item),
				onClick: () => onView(item),
			},
			secondary: onArchive === undefined
				? undefined
				: {
					icon: <ArchiveBoxIcon label="" size="small" />,
					label: "Archive",
					onClick: () => onArchive(item),
				},
		};
	const row = (
		<AgentListRow
			hoverActions={hoverActions}
			isCompact={isCompact}
			isSelected={isSelected}
			item={item}
			onView={onView}
		/>
	);
	if (renderFlyout) {
		return (
			<HoverCard handle={customFlyoutHandle}>
				<HoverCardTrigger
					closeDelay={80}
					delay={120}
					render={(
						<li
							aria-current={isSelected ? "true" : undefined}
							className={rowClassName(isCompact, isSelected)}
							data-testid={"agent-list-custom-" + item.id}
						/>
					)}
				>
					{row}
				</HoverCardTrigger>
				<HoverCardContent
					align="start"
					alignOffset={0}
					className="w-auto max-w-[calc(100vw-48px)] bg-transparent p-0 shadow-none data-ending-style:transition-none"
					positionerClassName="z-[575] after:pointer-events-auto after:absolute after:-inset-2 after:-z-10 after:content-['']"
					side="right"
					sideOffset={8}
				>
					{renderFlyout(item, { close: () => customFlyoutHandle.close() })}
				</HoverCardContent>
			</HoverCard>
		);
	}

	// Rows that are not agent sessions — a teammate's comment, an @mention —
	// have no session to preview, so they render the row and nothing else.
	if (flyout === "none") {
		return (
			<li
				aria-current={isSelected ? "true" : undefined}
				className={rowClassName(isCompact, isSelected)}
				data-testid={"agent-list-row-" + item.id}
			>
				{row}
			</li>
		);
	}

	// The composer variant keeps a per-row Agent States card: it owns local
	// composer state, so it cannot share a single popup across the list the way
	// the payload-driven session flyout does.
	if (flyout === "composer") {
		return (
			<HoverCard closeDelay={80} openDelay={120}>
				<HoverCardTrigger
					closeDelay={80}
					delay={120}
					render={(
						<li
							aria-current={isSelected ? "true" : undefined}
							className={rowClassName(isCompact, isSelected)}
						/>
					)}
				>
					{row}
				</HoverCardTrigger>
				<HoverCardContent
					align="start"
					alignOffset={0}
					className="w-auto max-w-[calc(100vw-32px)] bg-transparent p-0 shadow-none"
					data-testid={"agent-list-state-" + item.id}
					positionerClassName="z-[575] after:pointer-events-auto after:absolute after:-inset-2 after:-z-10 after:content-['']"
					side="left"
					sideOffset={12}
				>
					<AgentStates
						agent={{
							avatarSrc: item.agent.avatarSrc,
							brandName: item.agent.brandName,
							id: item.agent.id ?? item.id,
							name: item.agent.name,
						}}
						initialElapsedSeconds={item.elapsedSeconds}
						onSubmit={onFlyoutSubmit}
						onView={() => onView?.(item)}
						startedAtMs={item.startedAtMs}
						state={getAgentStatesState(item.state)}
					/>
				</HoverCardContent>
			</HoverCard>
		);
	}

	return (
		<JiraSessionFlyoutTrigger
			handle={flyoutHandle}
			render={(
				<li
					aria-current={isSelected ? "true" : undefined}
					className={rowClassName(isCompact, isSelected)}
					data-testid={"agent-list-session-" + item.id}
				/>
			)}
			session={toAgentSessionFlyoutItem(item)}
		>
			{row}
		</JiraSessionFlyoutTrigger>
	);
}
