"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";
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
import {
	CardGlowLayers,
	cardGlowSurfaceStyle,
	type CardGlowCSSProperties,
	type CardGlowSurfaceRef,
	useCardGlowPointer,
	useCardGlowSurface,
} from "@/components/visual/card-glow";
import { cn } from "@/lib/utils";

import {
	AGENT_SESSION_ARRIVAL_OFFSET_PX,
	AGENT_SESSION_ARRIVAL_TRANSITION,
} from "./agent-session-arrival-motion";
import { approveActionLabel } from "./agent-session-approve";
import { AGENT_SESSION_GLOW_STYLE } from "./agent-session-glow";
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
import { agentSessionAccentColor } from "./agent-session-transfer-member";
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

const STATUS_DEPARTURE_TRANSITION = { duration: 0.1, ease: [0.6, 0, 0.8, 0.6] as const }; // duration-fast + ease-in
const STATUS_GLOW_TRANSITION = {
	duration: 0.6, // duration-slowest: hold through the card arrival and glyph swap
	ease: [0.4, 1, 0.6, 1] as const, // ease-out-practical
	times: [0, 0.25, 0.65, 1],
};
const STATUS_GLOW_STYLE: CardGlowCSSProperties = {
	...AGENT_SESSION_GLOW_STYLE,
	"--card-glow-pointer-x": -1,
	"--card-glow-pointer-y": 0,
	"--card-glow-proximity": 1,
};

function AgentSessionStateChangeGlow({ item, onComplete }: Readonly<{
	item: AgentSessionItem;
	onComplete?: () => void;
}>) {
	return (
		<motion.span
			animate={{ opacity: [0, 1, 1, 0] }}
			aria-hidden
			className="pointer-events-none absolute inset-0 -z-[1] rounded-[inherit]"
			data-agent-session-status-glow=""
			initial={{ opacity: 0 }}
			onAnimationComplete={onComplete}
			style={{
				...STATUS_GLOW_STYLE,
				...cardGlowSurfaceStyle(agentSessionAccentColor(item)),
			}}
			transition={STATUS_GLOW_TRANSITION}
		>
			<CardGlowLayers baseBorder={false} />
		</motion.span>
	);
}

/** Keep row registration and focus restoration tied to the departing DOM owner. */
function useAgentSessionDepartureFocus({
	glowPlaneSurface,
	isDeparting,
	isOnGlowPlane,
}: Readonly<{
	glowPlaneSurface?: CardGlowSurfaceRef;
	isDeparting: boolean;
	isOnGlowPlane: boolean;
}>) {
	const rowRef = useRef<HTMLLIElement | null>(null);
	const focusedControlRef = useRef<HTMLElement | null>(null);
	const restoreFocusAfterDepartureRef = useRef(false);
	const setRowNode = useCallback((node: HTMLLIElement | null) => {
		rowRef.current = node;
		const unregisterGlow = isOnGlowPlane ? glowPlaneSurface?.(node) : undefined;
		return () => {
			if (rowRef.current === node) rowRef.current = null;
			unregisterGlow?.();
		};
	}, [glowPlaneSurface, isOnGlowPlane]);
	useLayoutEffect(() => {
		if (isDeparting || !restoreFocusAfterDepartureRef.current) return;
		// A viewer may have focused another row during the exit; do not steal it.
		const currentFocus = document.activeElement;
		if (currentFocus !== document.body && currentFocus !== document.documentElement) {
			restoreFocusAfterDepartureRef.current = false;
			return;
		}
		const previousControl = focusedControlRef.current;
		const focusTarget = previousControl?.isConnected && rowRef.current?.contains(previousControl)
			? previousControl
			: rowRef.current?.querySelector<HTMLElement>("article[tabindex], button[tabindex]");
		focusTarget?.focus({ preventScroll: true });
		restoreFocusAfterDepartureRef.current = false;
	}, [isDeparting]);
	return {
		setRowNode,
		onBlurCapture: () => {
			if (isDeparting) restoreFocusAfterDepartureRef.current = true;
		},
		onFocusCapture: (event: FocusEvent<HTMLLIElement>) => {
			focusedControlRef.current = event.target as HTMLElement;
		},
	};
}

/** Motion targets stay pure; focus and lifecycle effects live in their hooks. */
function resolveAgentSessionCardMotion({
	animateLayout,
	arrivalDelaySeconds,
	isDeparting,
	isStateChanged,
	isTransferSource,
	shouldPlayArrival,
	shouldPlayDeparture,
	shouldPlayStatusReentry,
	shouldReduceMotion,
}: Readonly<{
	animateLayout: boolean;
	arrivalDelaySeconds?: number;
	isDeparting: boolean;
	isStateChanged: boolean;
	isTransferSource: boolean;
	shouldPlayArrival: boolean;
	shouldPlayDeparture: boolean;
	shouldPlayStatusReentry: boolean;
	shouldReduceMotion: boolean | null;
}>) {
	return {
		animate: shouldPlayDeparture ? { opacity: 0 }
			: shouldPlayStatusReentry
				? { opacity: [0, 1], y: [AGENT_SESSION_ARRIVAL_OFFSET_PX, 0] }
				: shouldPlayArrival ? { opacity: 1, y: 0 } : undefined,
		ariaHidden: isTransferSource || isDeparting || undefined,
		departing: isDeparting || undefined,
		initial: shouldPlayArrival && !isStateChanged ? { opacity: 0, y: AGENT_SESSION_ARRIVAL_OFFSET_PX } : false,
		layout: shouldReduceMotion || !animateLayout || isDeparting || isStateChanged ? false : "position" as const,
		transition: shouldPlayDeparture
			? STATUS_DEPARTURE_TRANSITION
			: { ...AGENT_SESSION_ARRIVAL_TRANSITION, delay: arrivalDelaySeconds ?? 0 },
		willChange: shouldPlayDeparture ? "opacity" : shouldPlayArrival ? "opacity, transform" : undefined,
	};
}

/** Hold the old lifecycle through reentry and derive the row's motion targets. */
function useAgentSessionCardTransition({
	animateLayout,
	arrivalDelaySeconds,
	glow,
	isArriving,
	isDeparting,
	isStateChanged,
	isTransferSource,
	item,
	onArrivalComplete,
	showWorkingSpinner,
	shouldReduceMotion,
}: Readonly<{
	animateLayout: boolean;
	arrivalDelaySeconds?: number;
	glow: boolean;
	isArriving: boolean;
	isDeparting: boolean;
	isStateChanged: boolean;
	isTransferSource: boolean;
	item: AgentSessionItem;
	onArrivalComplete?: () => void;
	showWorkingSpinner: boolean;
	shouldReduceMotion: boolean | null;
}>) {
	const [lifecycleState, setLifecycleState] = useState<AgentSessionItem["state"]>(item.state);
	useEffect(() => {
		if (!isStateChanged) setLifecycleState(item.state);
	}, [isStateChanged, item.state]);
	// The beat, not the mark: remounting an unreviewed card must not replay it.
	const shouldPlayArrival = isArriving && !isDeparting && !shouldReduceMotion;
	const shouldPlayDeparture = isDeparting && !shouldReduceMotion;
	const shouldPlayStatusReentry = shouldPlayArrival && isStateChanged;
	const shouldPlayStateChangeGlow = isStateChanged && !isDeparting && !shouldReduceMotion;
	// A first-place change has no card arrival; swap its lifecycle glyph in place.
	const shownLifecycleState = shouldPlayStatusReentry ? lifecycleState : item.state;
	const handleArrivalComplete = () => {
		if (shouldPlayArrival) {
			if (isStateChanged) {
				setLifecycleState(item.state);
			}
			onArrivalComplete?.();
		}
	};
	return {
		handleArrivalComplete,
		paintsGlow: glow || shouldPlayStateChangeGlow,
		shouldPlayDeparture,
		shouldPlayStateChangeGlow,
		shownLifecycleState,
		stateAwareTitle: showWorkingSpinner && item.state === "running" && !shouldReduceMotion,
		rowMotion: resolveAgentSessionCardMotion({
			animateLayout,
			arrivalDelaySeconds,
			isDeparting,
			isStateChanged,
			isTransferSource,
			shouldPlayArrival,
			shouldPlayDeparture,
			shouldPlayStatusReentry,
			shouldReduceMotion,
		}),
	};
}

export function AgentSessionCard({
	animateLayout = true,
	arrivalDelaySeconds,
	captured = false,
	density = "short",
	flyoutHandle,
	flyoutSession,
	getResumeCommand,
	glowBloom = false,
	glowStroke = false,
	isArriving = false,
	isDeparting = false,
	isStateChanged = false,
	isFlyoutActive = false,
	isHighlighted = false,
	isNew = false,
	isResumable,
	isSelected = false,
	item,
	moreMenuPortalled,
	moreMenuPositionerClassName,
	onArrivalComplete,
	onDepartureComplete,
	onStateChangeComplete,
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
	showWorkingSpinner = false,
	triageRow,
	draggingIds,
	visibilityLabel = "Archive",
	workItemOptions,
}: Readonly<{
	animateLayout?: boolean;
	arrivalDelaySeconds?: number;
	captured?: boolean;
	/** Row shape — see {@link AgentSessionDensity}. Defaults to the avatar-led short row. */
	density?: AgentSessionDensity;
	/** Omit on long density — those rows have no hover flyout. */
	flyoutHandle?: JiraSessionFlyoutHandle;
	flyoutSession?: JiraSidebarSessionItem;
	getResumeCommand?: (item: AgentSessionItem) => string | undefined;
	/**
	 * Wash the agent's accent behind the row on hover. Independent of
	 * {@link glowStroke} so the two halves of the treatment can be judged
	 * separately. Requires the host list to carry `CARD_GLOW_EFFECT_STYLE`.
	 */
	glowBloom?: boolean;
	/**
	 * Trace the agent's accent along the card edge on hover. Independent of
	 * {@link glowBloom}. Both default off: the list host that wants the
	 * treatment turns it on, so picker menus and attached rows stay flat.
	 */
	glowStroke?: boolean;
	/** Play the one-shot arrival beat. A remounted card must not re-arm it. */
	isArriving?: boolean;
	/** Fade the old lifecycle at its previous slot before the row moves to the top. */
	isDeparting?: boolean;
	/** Replay a visible lifecycle revision without re-keying the interactive row. */
	isStateChanged?: boolean;
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
	onDepartureComplete?: () => void;
	onStateChangeComplete?: () => void;
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
	/** Shows the experimental Working indicator in the short row's lifecycle slot. */
	showWorkingSpinner?: boolean;
	triageRow?: AgentSessionTriageRow | null;
	draggingIds?: ReadonlySet<string>;
	/** Accessible name for the menu's dismiss row. Archive in the active list, Unarchive in the archived view. */
	visibilityLabel?: string;
	/** Work items the menu's Link work item submenu offers. */
	workItemOptions?: readonly AgentSessionWorkItemOption[];
}>) {
	const shouldReduceMotion = useReducedMotion();
	// The glow reads the pointer on the list item, not the article: the article
	// spreads the drag binding, which owns `onPointerMove`. Custom properties
	// inherit, so the layers inside still see what the item writes.
	//
	// Two ways in. A host that encloses its rows in a proximity plane — the
	// session column does — drives every row from one window-level pointer, so
	// the stroke is already tracing as the cursor approaches the column. Without
	// a plane the row tracks its own hover and lights only under the pointer.
	// Either layer needs the accent, the stacking context and a pointer, so the
	// mounting decision is their union; which layer actually paints is decided
	// in `CardGlowLayers`.
	const glow = glowStroke || glowBloom;
	const glowPlaneSurface = useCardGlowSurface();
	const isOnGlowPlane = glow && glowPlaneSurface !== undefined;
	const cardGlow = useCardGlowPointer({ reduceMotion: shouldReduceMotion });
	const tracksOwnPointer = glow && !isOnGlowPlane;
	const departureFocus = useAgentSessionDepartureFocus({ glowPlaneSurface, isDeparting, isOnGlowPlane });
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

	const approve = triageRow?.approve;
	const mark = triageRow?.mark;
	const isMarked = mark?.isMarked ?? false;
	const isLead = mark?.isLead ?? false;
	const isTransferSource = Boolean(draggingIds?.has(item.id));
	const showSelectedFill = isMarked || (isSelected && mark == null);
	const {
		handleArrivalComplete,
		paintsGlow,
		rowMotion,
		shouldPlayDeparture,
		shouldPlayStateChangeGlow,
		shownLifecycleState,
		stateAwareTitle,
	} = useAgentSessionCardTransition({
		animateLayout,
		arrivalDelaySeconds,
		glow,
		isArriving,
		isDeparting,
		isStateChanged,
		isTransferSource,
		item,
		onArrivalComplete,
		showWorkingSpinner,
		shouldReduceMotion,
	});

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
			: <AgentSessionLifecycle
				accessibleState={item.state}
				showLabel={showLifecycleLabel}
				state={shownLifecycleState}
			/>
		: <AgentSessionShortLifecycleIcon
			accessibleState={item.state}
			animateTransition={isStateChanged}
			showWorkingSpinner={showWorkingSpinner}
			state={shownLifecycleState}
		/>;
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
			animate={rowMotion.animate}
			aria-hidden={rowMotion.ariaHidden}
			aria-selected={mark == null ? undefined : isMarked}
			className={cn(
				isMarked ? "has-[+[data-marked]]:[&_article]:rounded-b-none" : null,
				"[[data-marked]+&[data-marked]]:[&_article]:rounded-t-none",
				"[[data-marked]+&[data-marked]]:in-[.gap-1]:-mt-1",
			)}
			data-marked={isMarked || undefined}
			data-departing={rowMotion.departing}
			data-testid={"agent-session-row-" + item.id}
			inert={rowMotion.ariaHidden}
			onBlurCapture={departureFocus.onBlurCapture}
			onFocusCapture={departureFocus.onFocusCapture}
			role={mark == null ? undefined : "row"}
			onAnimationComplete={shouldPlayDeparture ? onDepartureComplete : handleArrivalComplete}
			onPointerEnter={(event) => {
				isHoveredRef.current = true;
				onItemHover?.(item);
				if (tracksOwnPointer) {
					cardGlow.onPointerEnter(event);
				}
			}}
			onPointerLeave={(event) => {
				isHoveredRef.current = false;
				onItemHover?.(null);
				if (tracksOwnPointer) {
					cardGlow.onPointerLeave(event);
				}
			}}
			onPointerMove={tracksOwnPointer ? cardGlow.onPointerMove : undefined}
			ref={departureFocus.setRowNode}
			// `false` for a settled card, so nothing replays when the list re-renders
			// or the watermark clears the mark. Only an arrival animates.
			initial={rowMotion.initial}
			// Standalone lists move siblings for arrivals. The in-flow column opts
			// out so board filter changes place sessions immediately.
			layout={rowMotion.layout}
			style={{
				...(paintsGlow ? cardGlowSurfaceStyle(agentSessionAccentColor(item)) : null),
				willChange: rowMotion.willChange,
			}}
			transition={rowMotion.transition}
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
						// The glow layers sit at `-z-[1]`; without a stacking context
						// here they would escape behind the list surface.
						paintsGlow && "isolate",
						padding === "compact" ? "px-3 py-2" : "p-3",
						// Borderless tiles, 8px radius — same chrome as editor-palette
						// suggestion rows. The list owns the gap between them.
						// Hover and the retained flyout highlight must paint immediately;
						// fading the fill flashes transparent frames between nearby rows.
						"transition-[border-radius] duration-xxshort ease-out-practical",
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
							{/*
								No resting ring: the session list is a flush stack of
								borderless tiles, so only the traced accent appears, and
								only under the pointer. The bloom falls back to the accent
								colour because these identities are brand glyphs — blurring
								a monochrome mark would return grey.
							*/}
							{glow ? (
								<CardGlowLayers baseBorder={false} bloom={glowBloom} stroke={glowStroke} />
							) : null}
							{shouldPlayStateChangeGlow ? (
								<AgentSessionStateChangeGlow item={item} key={item.state} onComplete={onStateChangeComplete} />
							) : null}
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
								stateAwareTitle={stateAwareTitle}
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
