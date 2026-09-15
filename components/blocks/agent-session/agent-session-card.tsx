"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { motion, useReducedMotion } from "motion/react";

import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import {
	AgentListIdentity,
	AgentListRow,
	type AgentListRowHoverActions,
} from "@/components/blocks/agent-list/agent-list-card";
import {
	isLocalAgentListItem,
	toAgentListResumeCommand,
} from "@/components/blocks/agent-list/agent-list-session";
import type { JiraSidebarSessionItem } from "@/components/blocks/product-sidebar/variants/jira";
import {
	JiraSessionFlyoutTrigger,
	type JiraSessionFlyoutHandle,
} from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import type { JiraIssueAgentSessionDragBinding } from "@/components/blocks/jira-issue/agent-session-drag";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import {
	AGENT_SESSION_ARRIVAL_OFFSET_PX,
	AGENT_SESSION_ARRIVAL_TRANSITION,
} from "./agent-session-arrival-motion";
import { approveActionLabel } from "./agent-session-approve";
import { SESSION_DRAG_INTERACTIVE_SELECTOR } from "./agent-session-drag-interactive";
import {
	AgentSessionLifecycle,
	AgentSessionShortLifecycleIcon,
} from "./agent-session-lifecycle";
import { AgentSessionMediumDrag } from "./agent-session-medium-drag";
import {
	AgentSessionLongMetadata,
	AgentSessionShortMetadata,
} from "./agent-session-metadata";
import { AgentSessionMoreMenu } from "./agent-session-more-menu";
import { AgentSessionExpiredHint } from "./agent-session-expired-hint";
import { AgentSessionViewerHint } from "./agent-session-viewer-hint";
import { AgentSessionSelectMark } from "./agent-session-select-mark";
import { selectionGestureFromModifierKeys } from "./agent-session-selection-gesture";
import { isTransferSourceFaded } from "./session-cohort";
import {
	type AgentSessionDensity,
	type AgentSessionItem,
	type AgentSessionSelectionGesture,
	getAgentSessionRole,
	type AgentSessionTriageRow,
	type AgentSessionWorkItemDraft,
	type AgentSessionWorkItemOption,
} from "./agent-session-types";
import { useAgentSessionMenu } from "./use-agent-session-menu";

export function AgentSessionCard({
	arrivalDelaySeconds,
	captured = false,
	density = "short",
	flyoutHandle,
	flyoutSession,
	getResumeCommand,
	isArriving = false,
	isFlyoutActive = false,
	isHighlighted = false,
	isNew = false,
	isResumable,
	isSelected = false,
	item,
	moreMenuPortalled,
	moreMenuPositionerClassName,
	onArrivalComplete,
	onContinueInAgent,
	onCopyResume,
	onCreateWorkItemFromDraft,
	onDeleteSession,
	onItemHover,
	onLinkWorkItem,
	onMoreMenuOpenChange,
	onRenameSession,
	onToggleVisibility,
	onView,
	padding = "default",
	sessionDrag,
	showMoreMenu = true,
	showLifecycleLabel = true,
	showLinkWorkItemMenuItem = true,
	triageRow,
	draggingIds,
	visibilityLabel = "Archive",
	workItemOptions,
}: Readonly<{
	arrivalDelaySeconds?: number;
	captured?: boolean;
	/** Row shape — see {@link AgentSessionDensity}. Defaults to the avatar-led short row. */
	density?: AgentSessionDensity;
	/** Omit on long density — those rows have no hover flyout. */
	flyoutHandle?: JiraSessionFlyoutHandle;
	flyoutSession?: JiraSidebarSessionItem;
	getResumeCommand?: (item: AgentSessionItem) => string | undefined;
	/** Play the one-shot arrival beat. A remounted card must not re-arm it. */
	isArriving?: boolean;
	/** Keep the row's hover treatment while its portalled flyout chain is active. */
	isFlyoutActive?: boolean;
	/** Light this row for a pointer hovering its matching board session. */
	isHighlighted?: boolean;
	/** Carry the persistent unreviewed mark. Outlives the beat. */
	isNew?: boolean;
	isResumable?: (item: AgentSessionItem) => boolean;
	/** Single-select highlight owned by the list, not this card. */
	isSelected?: boolean;
	item: AgentSessionItem;
	onArrivalComplete?: () => void;
	/** Reopen a local session in its own agent. Omit to disable the menu row. */
	onContinueInAgent?: (item: AgentSessionItem) => void;
	onCopyResume?: (item: AgentSessionItem) => void;
	/** Create a work item named in the menu's Create new tab. Omit to disable that tab. */
	onCreateWorkItemFromDraft?: (item: AgentSessionItem, draft: AgentSessionWorkItemDraft) => void;
	/** Delete a cloud session record. Omit to disable the menu row. */
	onDeleteSession?: (item: AgentSessionItem) => void;
	onItemHover?: (item: AgentSessionItem | null) => void;
	/** Link the session to a work item picked in the menu. Omit to disable that tab. */
	onLinkWorkItem?: (item: AgentSessionItem, workItemKey?: string) => void;
	/** Rename a cloud session. Omit to disable the menu row. */
	onRenameSession?: (item: AgentSessionItem) => void;
	onToggleVisibility?: (item: AgentSessionItem) => void;
	onView?: (item: AgentSessionItem) => void;
	/**
	 * Article inset. Assignment pickers use `compact` (`px-3 py-2` / 8px
	 * vertical) so stacked menu rows sit tighter than catalog cards.
	 */
	padding?: "default" | "compact";
	/**
	 * Overlay stacking for the owner more-menu. Assignment's picker sits above
	 * the default dropdown tier, so it passes a higher `z-` or the menu opens
	 * behind the picker.
	 */
	moreMenuPositionerClassName?: string;
	/**
	 * Portal the more-menu. Nested clipped overlays can pass `false`;
	 * assignment uses the default portal so Rename / Delete escape the picker.
	 */
	moreMenuPortalled?: boolean;
	/** Tell a host overlay when the portalled more-menu is open so it can stay mounted. */
	onMoreMenuOpenChange?: (open: boolean) => void;
	sessionDrag?: JiraIssueAgentSessionDragBinding;
	showMoreMenu?: boolean;
	/** Keep false only for compact consumers that borrow long-density title geometry. */
	showLifecycleLabel?: boolean;
	/** Shows the Link work item row without changing the underlying link capabilities. */
	showLinkWorkItemMenuItem?: boolean;
	triageRow?: AgentSessionTriageRow | null;
	draggingIds?: ReadonlySet<string>;
	/** Accessible name for the menu's dismiss row. Archive in the active list, Unarchive in the archived view. */
	visibilityLabel?: string;
	/** Work items the menu's Link work item submenu offers. */
	workItemOptions?: readonly AgentSessionWorkItemOption[];
}>) {
	const shouldReduceMotion = useReducedMotion();
	const onItemHoverRef = useRef(onItemHover);
	// Whether the pointer is on *this* row, so unmount cleanup can tell "I was
	// the hovered row" from "a sibling went away".
	const isHoveredRef = useRef(false);

	useEffect(() => {
		onItemHoverRef.current = onItemHover;
	}, [onItemHover]);

	useEffect(() => () => {
		// Hide / filter can unmount the hovered row before pointerleave fires.
		// Only the row that owns the hover may clear it: a filter or capture that
		// unmounts a sibling must not wipe a highlight the pointer still rests on,
		// because no pointerenter would fire to put it back.
		if (isHoveredRef.current) {
			onItemHoverRef.current?.(null);
		}
	}, []);

	const resumeCommand = getResumeCommand?.(item) ?? toAgentListResumeCommand(item);
	// Resume is an affordance, not just a callback: a row the host cannot resume
	// must not render an enabled control, because the button copies the command to
	// the clipboard before `onCopyResume` ever runs.
	const canResume = (isResumable?.(item) ?? true) && resumeCommand.length > 0;
	// The beat, not the mark: a card remounted while still unreviewed keeps the
	// information dot but must not replay its entrance.
	const shouldPlayArrival = isArriving && !shouldReduceMotion;
	const handleArrivalComplete = () => {
		if (shouldPlayArrival) {
			onArrivalComplete?.();
		}
	};

	const approve = triageRow?.approve;
	const mark = triageRow?.mark;
	const isMarked = mark?.isMarked ?? false;
	const isLead = mark?.isLead ?? false;
	const isTransferSource = Boolean(draggingIds?.has(item.id));
	const showSelectedFill = isMarked || (isSelected && mark == null);

	// The same hover/focus-revealed pair Agent List rows use, with Archive /
	// Unarchive in the slot Agent List gives to Archive. The control always
	// renders; the column supplies `onToggleVisibility` so Archive removes the card.
	// The article is the hit area. RowBody would otherwise wrap only the title
	// column, leaving avatar and padding inert. A triage mark uses that same
	// path so selection is not avatar-only. Hover actions stay buttons so they
	// can stop the article from changing the selection.
	const role = getAgentSessionRole(item);
	const viewSession = role === "owner" ? onView : undefined;
	const activateCard = viewSession === undefined && mark == null
		? undefined
		: (gesture: AgentSessionSelectionGesture) => {
			if (mark != null) {
				mark.onActivate(gesture);
				return;
			}
			viewSession?.(item);
		};
	const handleArticleClick = activateCard === undefined
		? undefined
		: (event: MouseEvent<HTMLElement>) => {
			if (
				event.target instanceof Element
				&& event.target.closest(SESSION_DRAG_INTERACTIVE_SELECTOR) !== null
			) {
				return;
			}
			activateCard(selectionGestureFromModifierKeys(event));
		};
	const handleArticleKeyDown = activateCard === undefined
		? undefined
		: (event: KeyboardEvent<HTMLElement>) => {
			if (event.target !== event.currentTarget) {
				return;
			}
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				activateCard(selectionGestureFromModifierKeys(event));
			}
		};
	const articleRole = mark == null ? undefined : "gridcell";
	const articleTabIndex = mark == null ? undefined : isLead ? 0 : -1;

	// One trailing affordance instead of a Resume/Archive pair: everything a row
	// can do now lives behind "…". Approve is the exception — it is a triage
	// decision the column surfaces inline, not a session action, so it keeps its
	// own button.
	const isCloudSession = !isLocalAgentListItem(item);
	const menu = useAgentSessionMenu({
		canResume,
		isCloud: isCloudSession,
		item,
		onContinueInAgent,
		onCopyResume,
		onCreateWorkItemFromDraft,
		onDeleteSession,
		onItemHover,
		onLinkWorkItem,
		onMoreMenuOpenChange,
		onRenameSession,
		onToggleVisibility,
		resumeCommand,
	});
	// The more-actions popup is portalled, so moving into it ends CSS `:hover`
	// on the article. Keep the row's complete hover treatment tied to the
	// controlled overlay state until that popup closes.
	const isHoverStateActive = isFlyoutActive || menu.isOpen;
	// Every density keeps lifecycle state outside the authored title and byline.
	// Short rows use a settled-state glyph in the same slot the hover/focus menu
	// replaces; long rows keep their full trailing progression control.
	const isLongDensity = density === "long";
	const trailingControl = (() => {
		if (!showMoreMenu) {
			return undefined;
		}

		switch (role) {
			case "expired":
				// Long rows keep the hint in the resting lifecycle slot it shares with
				// the status glyph. A short row has no resting slot, so its one control
				// moves into the hover-revealed column beside "…" and the viewer hint.
				return isLongDensity ? undefined : <AgentSessionExpiredHint />;
			case "viewer":
				return <AgentSessionViewerHint />;
			case "owner":
				return (
					<AgentSessionMoreMenu
						actions={menu.actions}
						copied={menu.copied}
						// Only the legacy "Archive" default becomes "Dismiss". Any other
						// label is caller-authored copy for this row and passes through.
						dismissLabel={visibilityLabel === "Archive" ? "Dismiss" : visibilityLabel}
						isCloud={isCloudSession}
						item={item}
						onOpenChange={menu.setIsOpen}
						open={menu.isOpen}
						portalled={moreMenuPortalled}
						positionerClassName={moreMenuPositionerClassName}
						showLinkWorkItemMenuItem={showLinkWorkItemMenuItem}
						workItemOptions={workItemOptions}
					/>
				);
			default: {
				const exhaustiveRole: never = role;
				return exhaustiveRole;
			}
		}
	})();
	// `null`, not `undefined`: the shared row treats `undefined` as "no opinion"
	// and falls back to its own `STATE_META` indicator.
	const lifecycleIndicator = isLongDensity
		? role === "expired"
			? <AgentSessionExpiredHint />
			: <AgentSessionLifecycle showLabel={showLifecycleLabel} state={item.state} />
		: item.state === "needs-input" || item.state === "complete"
			? <AgentSessionShortLifecycleIcon state={item.state} />
			: null;
	const hoverActions: AgentListRowHoverActions = {
		// The reveal must outlive the pointer: a portalled popup and a post-click
		// confirmation both take the cursor off the row.
		pinned: isFlyoutActive || (showMoreMenu && role === "owner" && (menu.isOpen || menu.copied)),
		primary: approve
			? {
				disabled: approve.target.kind === "unavailable",
				icon: <Icon render={<CheckMarkIcon label="" size="small" />} />,
				label: approveActionLabel(approve.target),
				onClick: approve.onApprove,
			}
			: undefined,
		menu: trailingControl,
	};

	// A triage mark lives on the leading avatar, so a markable row keeps its
	// identity column even in the title-led density — losing multi-select would
	// cost more than the horizontal space it buys back.
	const hideIdentity = isLongDensity && mark == null;

	// Arrival layout lives on the list item, not the flyout trigger. Base UI
	// closes a preview card when its active trigger unmounts, and Motion's layout
	// projection can replace that host — which made each row open its own flyout
	// instead of sliding the list's shared popup. The catalog demo uses a stable
	// `div` as the trigger host so hovering down the list crossfades in place.
	return (
		<motion.li
			animate={shouldPlayArrival ? { opacity: 1, y: 0 } : undefined}
			aria-hidden={isTransferSource || undefined}
			aria-selected={mark == null ? undefined : isMarked}
			className={cn(
				isMarked ? "has-[+[data-marked]]:[&_article]:rounded-b-none" : null,
				"[[data-marked]+&[data-marked]]:[&_article]:rounded-t-none",
				"[[data-marked]+&[data-marked]]:in-[.gap-1]:-mt-1",
			)}
			data-marked={isMarked || undefined}
			data-testid={"agent-session-row-" + item.id}
			inert={isTransferSource || undefined}
			role={mark == null ? undefined : "row"}
			onAnimationComplete={handleArrivalComplete}
			onPointerEnter={() => {
				isHoveredRef.current = true;
				onItemHover?.(item);
			}}
			onPointerLeave={() => {
				isHoveredRef.current = false;
				onItemHover?.(null);
			}}
			// `false` for a settled card, so nothing replays when the list re-renders
			// or the watermark clears the mark. Only an arrival animates.
			initial={shouldPlayArrival ? { opacity: 0, y: AGENT_SESSION_ARRIVAL_OFFSET_PX } : false}
			// Siblings slide down to make room instead of jumping. `"position"` so a
			// displaced card is never scaled, only moved.
			layout={shouldReduceMotion ? false : "position"}
			style={{ willChange: shouldPlayArrival ? "opacity, transform" : undefined }}
			transition={{ ...AGENT_SESSION_ARRIVAL_TRANSITION, delay: arrivalDelaySeconds ?? 0 }}
		>
			<AgentSessionMediumDrag
				cohort={triageRow?.drag?.cohort}
				cohortFollower={isTransferSourceFaded(item.id, draggingIds, false)}
				item={item}
				preserveSourceFootprint
				sessionDrag={sessionDrag}
				shouldReduceMotion={shouldReduceMotion}
				source="untracked"
			>
				{(bind) => {
					const card = (
						<article
							{...bind}
							aria-current={isSelected ? "true" : undefined}
							aria-roledescription={bind ? "Draggable agent session" : undefined}
							className={cn(
						"group/agent-row relative flex w-full min-w-0 cursor-default rounded-lg text-left text-text",
						padding === "compact" ? "px-3 py-2" : "p-3",
						// Borderless tiles, 8px radius — same chrome as editor-palette
						// suggestion rows. The list owns the gap between them.
						"transition-[background-color,border-radius] duration-xxshort ease-out-practical",
						"motion-reduce:transition-none",
						showSelectedFill && "bg-bg-selected",
						!showSelectedFill && (isHighlighted || isHoverStateActive) && "bg-surface-hovered",
						!showSelectedFill && !isHighlighted && !isHoverStateActive && "bg-transparent hover:bg-surface-hovered",
						activateCard === undefined
							? null
							: "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
							)}
							data-captured={captured || undefined}
							data-hovered={isHoverStateActive || undefined}
							data-highlighted={isHighlighted || undefined}
							data-marked={isMarked || undefined}
							data-new={isNew || undefined}
							data-selected={isSelected || undefined}
							data-variant="uncaptured-work"
							onClick={handleArticleClick}
							onKeyDown={handleArticleKeyDown}
							role={articleRole}
							tabIndex={articleTabIndex ?? (bind !== undefined && activateCard !== undefined ? 0 : undefined)}
						>
							{isNew ? (
						<>
							{/* Colour never carries it alone. */}
							<span className="sr-only">Newly synced, not yet reviewed</span>
							{/* Parked in the body's 12px padding, vertically centered
							    with the avatar + two text lines. */}
							<span
								aria-hidden="true"
								className="absolute left-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-icon-information"
							/>
						</>
							) : null}
							<AgentListRow
								hideIdentity={hideIdentity}
								hoverActions={hoverActions}
								isCompact={false}
								isSelected={showSelectedFill}
								item={item}
								// Agent Session owns lifecycle outside the title and byline. The
								// shared trailing slot lets hover actions replace it in place.
								lifecycle={lifecycleIndicator}
								metadata={
									isLongDensity
										? <AgentSessionLongMetadata item={item} />
										: <AgentSessionShortMetadata item={item} />
								}
								onView={mark == null && bind === undefined ? viewSession : undefined}
								renderIdentity={() => {
									const sessionIdentity = (
										<AgentListIdentity
											agent={item.agent}
											attributedBy={item.invokedBy}
											attributionOrder="agent-first"
											sizePx={32}
										/>
									);

									// The travelling drag chip measures this box on
									// pointerdown and flies out of it. Marked outside the
									// select-mark branch so the origin exists in both.
									return (
										<span className="block" data-session-drag-identity="">
											{mark === undefined || mark === null
												? sessionIdentity
												: (
													<AgentSessionSelectMark
														identity={sessionIdentity}
														isMarked={mark.isMarked}
														label={`Select "${item.title}"`}
														onActivate={activateCard ?? mark.onActivate}
													/>
												)}
										</span>
									);
								}}
								showHoverActionsWhenSelected
								stateAwareTitle={false}
							/>
						</article>
					);

					if (isLongDensity || flyoutHandle === undefined || flyoutSession === undefined) {
						return card;
					}

					return (
						<JiraSessionFlyoutTrigger
							closeDelay={160}
							data-session-id={item.id}
							handle={flyoutHandle}
							render={<div className="w-full" />}
							session={flyoutSession}
						>
							{card}
						</JiraSessionFlyoutTrigger>
					);
				}}
			</AgentSessionMediumDrag>
		</motion.li>
	);
}
