"use client";

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type RefCallback,
} from "react";
import { useReducedMotion, type Transition } from "motion/react";

import { isCodingAgentListItem, isLocalAgentListItem } from "@/components/blocks/agent-list";
import { AGENT_SESSION_ITEMS, AgentSession } from "@/components/blocks/agent-session";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
	CardGlowSurfaceContext,
	useCardGlowProximityPlane,
} from "@/components/visual/card-glow";
import { ScrollMaskEdgeOverlay } from "@/components/visual/scroll-mask";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { AgentSessionColumnFilterMenu } from "./agent-session-column-filter-menu";
import { AgentSessionColumnCountMorph, AgentSessionColumnCountSwap, useRisingSessionCount } from "./agent-session-column-count-swap";
import { AgentSessionColumnCollapsedExpandControl, AgentSessionColumnHeader } from "./agent-session-column-header";
import { AgentSessionColumnEndState } from "./agent-session-column-end-state";
import { AgentSessionColumnHiddenFooter } from "./agent-session-column-hidden-footer";
import { AgentSessionColumnOverflowMenu } from "./agent-session-column-overflow-menu";
import {
	AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS,
	AgentSessionColumnRail,
} from "./agent-session-column-rail";
import { toAgentSessionRailHitSlopStyle } from "./agent-session-column-rail-viewport";
import {
	DEFAULT_AGENT_SESSION_COLUMN_FRAME,
	resolveAgentSessionColumnLayout,
	type AgentSessionColumnLayout,
} from "./agent-session-column-frame";
import { CollapsedColumnLabel } from "./collapsed-column-label";
import { AgentSessionColumnSurface } from "./agent-session-column-surface";
import {
	AGENT_SESSION_UNDERLAP_SHADOW_ENTER,
	AGENT_SESSION_UNDERLAP_SHADOW_EXIT,
	AGENT_SESSION_UNDERLAP_SHADOW_REDUCED,
} from "./agent-session-column-underlap";
import type { AgentSessionColumnProps } from "./agent-session-column-types";
import {
	AGENT_SESSION_DECK_END_SPACE_PX,
	AGENT_SESSION_DECK_FLAT,
	AGENT_SESSION_DECK_STACKED,
} from "./deck/deck-model";
import { useAgentSessionDeck } from "./deck/use-agent-session-deck";
import { useAgentSessionArrivals } from "./use-agent-session-arrivals";
import { useAgentSessionColumnFilter } from "./use-agent-session-column-filter";
import { useAgentSessionColumnHidden } from "./use-agent-session-column-hidden";
import { useAgentSessionColumnInteraction } from "./use-agent-session-column-interaction";
import { useAgentSessionColumnEndSpace } from "./use-agent-session-column-end-space";
import { useUntrackedSelection } from "./use-untracked-selection";
import { focusAgentSessionRow } from "./untracked-selection-keyboard";

/** Expanded column width in px. Exported so a host surface can size itself to match. */
export const AGENT_SESSION_COLUMN_WIDTH_PX = 280;

/**
 * Collapsed rail width in px. Matches the board's collapsed status pill so the
 * two sit on one rhythm; declared here rather than imported, because a shared
 * block must not reach into a kanban variant's internals. Exported for the same
 * reason the expanded width is: a host that animates around the column has to
 * read the two widths from their owner rather than restate them.
 */
export const AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX = 32;

/**
 * Hover preview keeps this column collapsed, so the width transition runs only
 * after a deliberate expand/collapse action. Hosts mirror the same timing for
 * their reserved footprint.
 */
const AGENT_SESSION_COLUMN_TRANSITION = "width var(--duration-medium) var(--ease-in-out)";

/**
 * The filled plane that holds the sessions.
 *
 * Caption (simple / default omit): the header is a sibling of this plane so
 * it shares an inset and baseline with `To do`. Enclosed (default board
 * chrome): header and body share one painted well — expanded and collapsed
 * alike — matching the status columns that wrap title and cards in one
 * object. Gutter rest is the exception: the tucked rail stays unframed so
 * it can sit in the page inset without a 32px bordered capsule. Panel
 * ignores framing and keeps the fill without a nested well — the docked
 * chrome already draws the leading hairline.
 *
 * The list is the scrollport. Expanded in-flow caption, the plane is a
 * bordered well (`radius.xlarge`) that clips fades and the hidden-work
 * footer so they cannot paint over the 1px stroke. Enclosed moves
 * `overflow-hidden` onto the list/footer region so header focus rings are
 * not sliced, and that clip carries the well's bottom radius so the fade
 * cannot wash out the bottom corners. Collapsed enclosed (column
 * presentation) keeps the rail inside that same well so the count and
 * markers share one rounded object. Gutter rest leaves the rail in the
 * unframed fill. Cards are borderless. Expanded in-flow uses the same 4px
 * list inset and row gap as the panel; adjacent marked cards fuse across
 * that gap.
 */
const AGENT_SESSION_PLANE =
	"relative flex min-h-0 min-w-0 flex-1 flex-col bg-surface";

/**
 * The 1px well inset keeps To-do count alignment. Expanded rest paints a
 * `border-border-disabled` stroke; collapsed and elevated states use padding
 * for the same inset without retaining a transparent border.
 */
const AGENT_SESSION_WELL_PAINT = cn(
	AGENT_SESSION_PLANE,
	"rounded-xl border border-solid border-transparent",
);

const AGENT_SESSION_WELL = cn(
	AGENT_SESSION_PLANE,
	"overflow-hidden rounded-xl border border-solid border-transparent",
);

/**
 * Row gap and leading inset share `space.050` (4px). The trailing edge
 * stays flush with the header action slot after the row's own padding.
 * Adjacent marked cards close the row gap (`-mt-1`) and flatten the shared corners.
 * Panel hosts pass the same class via `listClassName`.
 */
const AGENT_SESSION_LIST_SPACING = "gap-1 py-1 ps-1";
const AGENT_SESSION_LIST_GAP_PX = 4;

/**
 * Enclosed clips the list/footer region instead of the well, so the clip is a
 * plain rectangle inside the 1px inset (stroke at rest, padding otherwise).
 * At rest, straight border runs survive the clip, but `radius.xlarge` curves
 * inward from the bottom corners. The arc and the last ~12px of each side
 * stroke fall inside the rectangle,
 * where the opaque end of the bottom scroll fade paints over them and the
 * corner reads as clipped. Matching the well's radius on the clip keeps the
 * fade off the arc. The clip's true inner curve is 11px; rounding to the full
 * 12px only ever clips further from the edge, and the well paints behind it.
 */
const AGENT_SESSION_ENCLOSED_BODY =
	"flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-b-xl";

/** ADS overlay depth layer, omitting its two perimeter layers. */
const AGENT_SESSION_UNDERLAP_DEPTH_SHADOW =
	"0px 8px 12px light-dark(#1E1F2126, #0104045C)";
const AGENT_SESSION_WELL_STROKE = token("color.border.disabled");
/**
 * space.100 — the painted well grows this far above and below its slot
 * while status columns underlap, so the well is 16px taller, not shorter.
 */
const AGENT_SESSION_UNDERLAP_GROW_PX = 8;

function resolveAgentSessionPlaneClassName(
	layout: AgentSessionColumnLayout,
	collapsed: boolean,
	isGutterCollapsed: boolean,
): string {
	switch (layout) {
		case "panel":
			return AGENT_SESSION_PLANE;
		case "caption":
			return collapsed ? AGENT_SESSION_PLANE : AGENT_SESSION_WELL;
		case "enclosed":
			return isGutterCollapsed ? AGENT_SESSION_PLANE : AGENT_SESSION_WELL_PAINT;
		default: {
			const exhaustive: never = layout;
			return exhaustive;
		}
	}
}

function renderAgentSessionColumnFrame({
	allowCollapsedRailOverflow,
	body,
	bodyHidden,
	borderColor,
	boxShadow,
	header,
	isGutterCollapsed,
	layout,
	marginBlock,
	planeClassName,
	shadowTransition,
}: Readonly<{
	allowCollapsedRailOverflow: boolean;
	body: ReactNode;
	bodyHidden: boolean;
	borderColor: string;
	boxShadow: string;
	header: ReactNode;
	isGutterCollapsed: boolean;
	layout: AgentSessionColumnLayout;
	marginBlock: number;
	planeClassName: string;
	shadowTransition: Transition;
}>): ReactNode {
	const plane = (
		<AgentSessionColumnSurface
			borderColor={borderColor}
			boxShadow={boxShadow}
			className={planeClassName}
			hidden={bodyHidden}
			marginBlock={marginBlock}
			transition={shadowTransition}
		>
			{body}
		</AgentSessionColumnSurface>
	);
	switch (layout) {
		case "panel":
		case "caption":
			return (
				<>
					{header}
					{plane}
				</>
			);
		case "enclosed":
			return isGutterCollapsed ? (
				<>
					{header}
					{plane}
				</>
			) : (
				<AgentSessionColumnSurface
					borderColor={borderColor}
					boxShadow={boxShadow}
					className={planeClassName}
					marginBlock={marginBlock}
					transition={shadowTransition}
				>
					{header}
					<div
						aria-hidden={bodyHidden || undefined}
						className={cn(
							AGENT_SESSION_ENCLOSED_BODY,
							allowCollapsedRailOverflow ? "overflow-visible" : null,
							bodyHidden ? "invisible" : null,
						)}
						inert={bodyHidden || undefined}
					>
						{body}
					</div>
				</AgentSessionColumnSurface>
			);
		default: {
			const exhaustive: never = layout;
			return exhaustive;
		}
	}
}

function resolveCollapsedHeaderStyle(
	layout: AgentSessionColumnLayout,
): { paddingBottom: string; paddingTop?: string } {
	switch (layout) {
		case "panel":
		case "enclosed":
			return {
				paddingBottom: token("space.100"),
				paddingTop: token("space.100"),
			};
		case "caption":
			return { paddingBottom: token("space.100") };
		default: {
			const exhaustive: never = layout;
			return exhaustive;
		}
	}
}

/**
 * Hover/focus swap on the collapsed header slot: the count or local monitor at
 * rest, the expand control once the pointer or keyboard arrives. Both sit in
 * the same 24px row the expanded collapse control uses, so the status does not
 * move. Gutter rest keeps this pair hidden; `focus-visible` still unfades the
 * control so keyboard users can expand without a pointer.
 */
const HEADER_COUNT_AT_REST = cn(
	"pointer-events-none transition-opacity duration-normal ease-out-practical",
	"peer-hover/expand-control:opacity-0 peer-focus-visible/expand-control:opacity-0",
	"peer-data-popup-open/expand-control:opacity-0",
	"motion-reduce:transition-none",
);

const HEADER_CONTROL_ON_REVEAL = cn(
	"peer/expand-control opacity-0 transition-opacity duration-normal ease-out-practical",
	"hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100",
	"motion-reduce:transition-none",
);

const HEADER_CONTROL_IN_GUTTER = cn(
	HEADER_CONTROL_ON_REVEAL,
	"hover:opacity-0",
);

/** Outlined overlay chip while the collapsed header is the live drag preview. */
const COLLAPSED_REPOSITION_CHIP_CLASS_NAME =
	"peer/expand-control relative z-50 cursor-grabbing border border-border bg-surface-overlay! text-icon-subtle opacity-100 transition-none hover:bg-surface-overlay! active:bg-surface-overlay!";

/**
 * Expanded header actions: overflow + collapse, revealed together. Stay
 * painted while the overflow menu is open so the trigger does not vanish
 * under the portalled popup.
 */
/** The edge fades follow the plane's base surface color. */
const AGENT_SESSION_PLANE_FADE_COLOR = "var(--color-surface)";

const AGENT_SESSION_PLANE_TOP_FADE_SIZE = "3rem";
const AGENT_SESSION_PLANE_BOTTOM_FADE_SIZE = `${AGENT_SESSION_DECK_END_SPACE_PX}px`;

/**
 * A kanban column of agent sessions that never became work items.
 *
 * The board's status columns are unfilled under simple chrome — they read as
 * regions of the board surface. This one wraps its list in a `bg-surface`
 * plane that is also a 1px well when expanded in-flow: the outer stroke and
 * `radius.xlarge` live on the plane so scroll masks cannot wash them out.
 * Caption framing leaves the header on the host surface so it shares an
 * inset and a baseline with the status titles. Enclosed framing (default
 * board chrome) moves that same title row inside the well, matching the
 * status columns that wrap header and cards in one painted object. The well
 * rests on `bg-surface` and becomes `bg-surface-overlay` with its shadow when
 * Kanban content scrolls beneath it. Untracked never uses a sunken surface.
 * Everything below the header is the Agent Session block verbatim, so a card's
 * untracked-work flyout, captured state, and resume gating behave identically
 * here and in the standalone block.
 *
 * The list is the scrollport. Fades sit on the list wrapper, already inside
 * the well's padding box, so they stop at the inner edge of the stroke.
 *
 * It collapses like the status columns beside it, but not *into* the same thing:
 * a status pill is a rotated label, while this becomes a full-height rail of
 * per-session markers. Circular user dots are the default; `notchShape="line"`
 * preserves the original horizontal marks. Both open the session flyout on
 * hover or keyboard focus. See
 * {@link AgentSessionColumnRail}. Enclosed collapsed keeps the well so
 * the count and rail share one rounded object with the status columns;
 * gutter rest drops that well so the tucked rail can sit in the page inset.
 * `collapsedPresentation="gutter"` hides that count and the expand icon at
 * rest, while keeping the expand control in the same slot for keyboard.
 * Hover preview uses `"column"` so both return.
 * Hosts that supply `collapsedMenu` replace that Expand button with their
 * own control (in-flow: a "…" options menu). `onPinnedChange` adds a pin
 * affordance to the expanded header; omit it and the pin control stays off.
 *
 * Two capabilities exist for hosts that dock the column into their own surface
 * rather than stand it on the board: `collapsed` makes the rail state
 * controlled, and `headerSurface="panel"` wears the docked header skin. Both
 * are generic options — the column knows nothing about who is hosting it.
 * `columnFrame` is in-flow only; panel ignores it.
 */
export function AgentSessionColumn({
	animateLayout = true,
	headerSurface = "column",
	columnFrame = DEFAULT_AGENT_SESSION_COLUMN_FRAME,
	className,
	headerDragHandle,
	isRepositioning = false,
	collapsed: collapsedProp,
	collapsedPresentation = "column",
	collapsedMenu,
	collapsedRailHitSlopPx = 0,
	collapsedExpandLeadingHitSlopPx = 0,
	count,
	defaultCollapsed = false,
	emptyLabel = "No sessions to unlink",
	expandedWidthPx = AGENT_SESSION_COLUMN_WIDTH_PX,
	glowBloom = true,
	glowReach = true,
	glowStroke = true,
	hasScrollingEffect = false,
	showTrailingShadow = false,
	widthTransitionDisabled = false,
	items = AGENT_SESSION_ITEMS,
	listClassName,
	multiSelect = true,
	newItemIds,
	stateChangeVersions,
	notchShape = "circle",
	onCollapsedChange,
	onGutterIntroComplete,
	onInteractionChange,
	onArchiveSession: onArchiveSessionProp,
	onPinnedChange,
	onSelectedItemIdChange,
	onToggleVisibility,
	pinned = false,
	playGutterIntro = false,
	selectedItemId: selectedItemIdProp,
	showFilter = true,
	showLinkAction = true,
	showOverflow = true,
	title = "Unlink sessions",
	triage,
	toggleChangesWidth = true,
	...sessionProps
}: Readonly<AgentSessionColumnProps>) {
	const shouldReduceMotion = useReducedMotion();
	// Collapse mirrors the selection contract below: the host owns the value
	// when it supplies one, and the column falls back to its own state
	// otherwise. Same idiom the board uses for `collapsedColumns`.
	const isCollapsedControlled = collapsedProp !== undefined;
	const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed);
	const collapsed = collapsedProp ?? uncontrolledCollapsed;
	const columnRef = useRef<HTMLElement>(null);
	// The column is the glow's pointer plane. Rows register with it and are all
	// driven from one window-level pointer, so the accent stroke is already
	// tracing as the cursor approaches the column instead of snapping on at each
	// row's own edge — the continuity the agent bento gets from a wide grid, on
	// a narrow column that has no gutter to spare.
	//
	// Collapsed the rows are not rendered at all (the rail replaces them), and
	// under reduced motion a column-wide sweep is exactly the large-area motion
	// that setting rules out. In both cases the plane must also stop advertising
	// itself: a row that sees a plane hands its pointer tracking over, so
	// leaving the context populated while the plane is switched off would leave
	// the glow with no driver at all.
	//
	// Reach also requires a layer to drive: the plane exists only to start the
	// accent tracing early, so with both layers off it would drive nothing.
	const glowPlaneEnabled = (glowStroke || glowBloom)
		&& glowReach
		&& !collapsed
		&& shouldReduceMotion !== true;
	const { registerSurface: registerGlowSurface, setPlaneRef: setGlowPlaneRef } =
		useCardGlowProximityPlane({ enabled: glowPlaneEnabled });
	const setColumnNode = useCallback((node: HTMLElement | null) => {
		columnRef.current = node;
		setGlowPlaneRef(node);
	}, [setGlowPlaneRef]);
	const {
		handleColumnBlurCapture,
		handleColumnFocusCapture,
		handleColumnPointerEnter,
		handleColumnPointerLeave,
	} = useAgentSessionColumnInteraction(onInteractionChange, columnRef, collapsed);
	// Collapse remounts `AgentSession`, so the column keeps the selected id the
	// same way it keeps arrival-beat history. `multiSelect={false}` also opts
	// out of that singleton chrome — article click still views, but the row
	// never takes `bg-bg-selected`.
	const isSelectionControlled = selectedItemIdProp !== undefined;
	const [uncontrolledSelectedItemId, setUncontrolledSelectedItemId] = useState<string | null>(
		null,
	);
	const selectedItemId = multiSelect
		? isSelectionControlled ? selectedItemIdProp : uncontrolledSelectedItemId
		: null;
	const canViewItem = sessionProps.canViewItem;
	const onViewSession = sessionProps.onView;
	const {
		closeHiddenView,
		hideHidden,
		hiddenCount,
		hiddenItems,
		openHiddenView,
		toggleHidden,
		view,
		visibleItems,
	} = useAgentSessionColumnHidden(items);
	const viewItems = view === "hidden" ? hiddenItems : visibleItems;
	const {
		filter,
		filteredViewItems,
		selectedCount: selectedFilterCount,
		setFilter,
	} = useAgentSessionColumnFilter({
		getSuggestedWorkItemKey: sessionProps.getSuggestedWorkItemKey,
		getSuggestedWorkItemKeys: sessionProps.getSuggestedWorkItemKeys,
		viewItems,
	});
	const displayedItems = showFilter ? filteredViewItems : viewItems;
	// Header Archive, the untracked-work flyout Archive, and the rail flyout
	// all hide into the column-owned well the footer reads. In the archived
	// view the same control Unarchives, matching the row.
	const handleArchiveSession = useCallback((session: AgentSessionItem) => {
		switch (view) {
			case "hidden":
				toggleHidden(session);
				break;
			case "active":
				hideHidden(session);
				break;
			default: {
				const exhaustive: never = view;
				return exhaustive;
			}
		}
		onToggleVisibility?.(session);
		onArchiveSessionProp?.(session);
	}, [hideHidden, onArchiveSessionProp, onToggleVisibility, toggleHidden, view]);
	const selectionTriage = useMemo(() => {
		if (triage === undefined) {
			return undefined;
		}

		return {
			...triage,
			archive: handleArchiveSession,
		};
	}, [handleArchiveSession, triage]);
	const displayTitle = view === "hidden" ? "Archived" : title;
	// The rail and the card list have very different intrinsic widths, so the
	// overflow has to be clipped for the duration of the width transition. Any
	// longer and it would clip the 4px focus rings on the cards inside.
	const [isResizing, setIsResizing] = useState(false);
	const { ref: endSpaceRef, showEndSpace } = useAgentSessionColumnEndSpace(
		hasScrollingEffect,
		displayedItems,
	);
	const deck = hasScrollingEffect && showEndSpace
		? AGENT_SESSION_DECK_STACKED
		: AGENT_SESSION_DECK_FLAT;
	const deckListRef = useAgentSessionDeck(deck);
	const {
		hasScrolledToBottom,
		ref: overflowListRef,
		showBottomScrollMask,
		showTopScrollMask,
	} = useHasVerticalOverflow<HTMLDivElement>();
	const listRef = useCallback<RefCallback<HTMLDivElement>>((node) => {
		overflowListRef(node);
		deckListRef(node);
		endSpaceRef(node);
	}, [deckListRef, endSpaceRef, overflowListRef]);
	const untrackedCount = count ?? visibleItems.length;
	const showWellFooter = view === "hidden" || hiddenCount > 0;
	const hasActiveFilters = showFilter && selectedFilterCount > 0;
	const sessionCount = hasActiveFilters
		? displayedItems.length
		: (view === "hidden" ? hiddenItems.length : untrackedCount);
	const risingCount = useRisingSessionCount(sessionCount);
	const allLocalSessions = displayedItems.length > 0 && viewItems.every(isLocalAgentListItem);
	const showRisingCount = !allLocalSessions || risingCount;
	// Coding sessions are always activatable; person rows only when `canViewItem`
	// allows it. Selection, notches, and board spotlight share this gate.
	const canActivateItem = useCallback((item: AgentSessionItem) => (
		isCodingAgentListItem(item) || (canViewItem?.(item) ?? true)
	), [canViewItem]);
	const handleSelectedItemIdChange = useCallback((itemId: string | null) => {
		if (!isSelectionControlled) {
			setUncontrolledSelectedItemId(itemId);
		}
		onSelectedItemIdChange?.(itemId);
	}, [isSelectionControlled, onSelectedItemIdChange]);
	const handleLeadItem = useCallback((item: AgentSessionItem | null) => {
		if (item === null) {
			handleSelectedItemIdChange(null);
			return;
		}
		handleSelectedItemIdChange(item.id);
		if (canActivateItem(item)) {
			onViewSession?.(item);
		}
	}, [canActivateItem, handleSelectedItemIdChange, onViewSession]);
	const handleFocusRow = useCallback((itemId: string | null) => {
		focusAgentSessionRow(columnRef.current, itemId);
	}, []);
	const untrackedSelection = useUntrackedSelection({
		capturedItemIds: sessionProps.capturedItemIds,
		count: sessionCount,
		focusRow: handleFocusRow,
		getSuggestedWorkItemKey: sessionProps.getSuggestedWorkItemKey,
		getSuggestedWorkItemKeys: sessionProps.getSuggestedWorkItemKeys,
		multiSelect,
		onLeadItem: handleLeadItem,
		showLinkAction,
		title: displayTitle,
		triage: selectionTriage,
		visibilityLabel: view === "hidden" ? "Unarchive" : "Archive",
		visibleItems: displayedItems,
	});
	const overflowMenu = showOverflow ? (
		<AgentSessionColumnOverflowMenu
			capturedItemIds={sessionProps.capturedItemIds}
			getSuggestedWorkItemKey={sessionProps.getSuggestedWorkItemKey}
			getSuggestedWorkItemKeys={sessionProps.getSuggestedWorkItemKeys}
			items={displayedItems}
			onLinkWorkItem={sessionProps.onLinkWorkItem}
			size={headerSurface === "column" ? "icon-compact" : "icon"}
			title={title}
		/>
	) : undefined;
	const filterMenu = showFilter ? (
		<AgentSessionColumnFilterMenu
			filter={filter}
			items={viewItems}
			onFilterChange={setFilter}
			size={headerSurface === "column" ? "icon-compact" : "icon"}
		/>
	) : undefined;
	const newCount = newItemIds === undefined
		? 0
		: visibleItems.reduce((total: number, item: AgentSessionItem) => (
			newItemIds.has(item.id) ? total + 1 : total
		), 0);
	const {
		arrivingItemIds,
		stateChangedItemIds,
		onArrivalComplete: handleArrivalComplete,
		onStateChangeComplete: handleStateChangeComplete,
	} = useAgentSessionArrivals({
		items: displayedItems,
		newItemIds,
		stateChangeVersions,
		presentation: collapsed ? notchShape : `expanded:${sessionProps.variant ?? "large"}:${sessionProps.density ?? "short"}`,
		reduceMotion: shouldReduceMotion === true,
	});
	// A controlled host can flip `collapsed` from its own affordance, which never
	// runs `handleToggleCollapsed`. React to the committed change so an external
	// collapse behaves like an internal one: clip the overflow for the width
	// transition, and leave the hidden view, which the rail cannot render.
	const lastCollapsedRef = useRef(collapsed);
	useEffect(() => {
		if (lastCollapsedRef.current === collapsed) {
			return;
		}
		lastCollapsedRef.current = collapsed;
		if (!shouldReduceMotion) {
			setIsResizing(true);
		}
		if (collapsed) {
			closeHiddenView();
		}
	}, [closeHiddenView, collapsed, shouldReduceMotion]);
	const handleNotchView = onViewSession === undefined
		? undefined
		: (item: AgentSessionItem) => {
			if (canActivateItem(item)) {
				onViewSession(item);
			}
		};

	const handleToggleCollapsed = () => {
		const nextCollapsed = !collapsed;
		if (nextCollapsed) {
			columnRef.current?.focus();
		}
		if (!shouldReduceMotion && toggleChangesWidth) {
			setIsResizing(true);
		}
		if (nextCollapsed) {
			closeHiddenView();
		}
		// Only own the state when the host has not claimed it, so a controlled
		// host stays the single source of truth.
		if (!isCollapsedControlled) {
			setUncontrolledCollapsed(nextCollapsed);
		}
		onCollapsedChange?.(nextCollapsed);
	};

	const handleToggleVisibility = (item: AgentSessionItem) => {
		toggleHidden(item);
		onToggleVisibility?.(item);
	};

	const handleTransitionEnd = (event: React.TransitionEvent<HTMLElement>) => {
		if (event.target === event.currentTarget && event.propertyName === "width") {
			setIsResizing(false);
		}
	};

	const layout = resolveAgentSessionColumnLayout(headerSurface, columnFrame);
	const isEmptyCollapsed = collapsed && displayedItems.length === 0 && !showWellFooter && layout !== "panel";
	const isGutterCollapsed = collapsed && collapsedPresentation === "gutter";
	const wearEnclosedWell = layout === "enclosed" && !isGutterCollapsed;
	const elevatePlane = showTrailingShadow && !isGutterCollapsed;
	// Expanded rest uses the 1px disabled stroke. Underlap swaps that stroke
	// for overlay shadow — stacking both reads as a double edge. Collapsed
	// never paints a stroke. The color snaps (transparent ↔ token does not
	// interpolate); Motion still tweens the shadow and grow.
	const paintWellStroke = wearEnclosedWell && !collapsed && !elevatePlane;
	const replaceWellBorderWithInset = !paintWellStroke
		&& (wearEnclosedWell || (layout === "caption" && elevatePlane && !collapsed));
	// Rest keeps the in-flow hover band so the expand control is easy to hit
	// beside the 32px rail — that rect may sit outside the painted well.
	// Underlap elevates the well into the container; the same band would hang
	// the trigger off that container, so the hit area shrinks to the well.
	const collapsedHitSlopPx = wearEnclosedWell && elevatePlane ? 0 : collapsedRailHitSlopPx;
	// Theme colors snap with the board; underlap still animates its shadow and footprint.
	const planeClassName = cn(
		resolveAgentSessionPlaneClassName(layout, collapsed, isGutterCollapsed),
		isGutterCollapsed ? "bg-transparent" : null,
		elevatePlane ? "bg-surface-overlay" : null,
		paintWellStroke ? "border-border-disabled" : null,
		replaceWellBorderWithInset ? "border-0 p-px" : null,
		collapsed && isRepositioning && !wearEnclosedWell ? "invisible" : null,
	);
	const planeBorderColor = paintWellStroke ? AGENT_SESSION_WELL_STROKE : "transparent";
	const planeBoxShadow = elevatePlane ? AGENT_SESSION_UNDERLAP_DEPTH_SHADOW : "none";
	const planeMarginBlock = elevatePlane && wearEnclosedWell
		? -AGENT_SESSION_UNDERLAP_GROW_PX
		: 0;
	const planeShadowTransition = shouldReduceMotion
		? AGENT_SESSION_UNDERLAP_SHADOW_REDUCED
		: elevatePlane
			? AGENT_SESSION_UNDERLAP_SHADOW_ENTER
			: AGENT_SESSION_UNDERLAP_SHADOW_EXIT;
	// Gutter rest hides the count/monitor and the expand icon so the rail can sit
	// in the page inset. Hover preview switches to column presentation, so
	// the same 24px slot shows the count and the expand control again.
	// Screen-reader copy still names the pool count.
	const hideGutterCount = isGutterCollapsed && !isEmptyCollapsed;
	const collapsedCountLabel = newCount > 0
		? `${sessionCount} ${allLocalSessions ? "local " : ""}sessions, ${newCount} newly synced`
		: `${sessionCount} ${allLocalSessions ? "local " : ""}sessions`;
	const collapsedControlClassName = isRepositioning
		? COLLAPSED_REPOSITION_CHIP_CLASS_NAME
		: isGutterCollapsed && !isEmptyCollapsed ? HEADER_CONTROL_IN_GUTTER : HEADER_CONTROL_ON_REVEAL;
	const collapsedExpandControl = collapsedMenu === undefined
		? (
			<AgentSessionColumnCollapsedExpandControl
				canReposition={Boolean(headerDragHandle)}
				className={collapsedControlClassName}
				isRepositioning={isRepositioning}
				leadingHitSlopPx={collapsedExpandLeadingHitSlopPx}
				onExpand={handleToggleCollapsed}
				title={title}
			/>
		)
		: collapsedMenu({ className: collapsedControlClassName, dragging: isRepositioning });
	const collapsedHeader = (
		<div
			data-agent-session-column-header=""
			className={cn("flex min-w-0 items-center gap-1.5", isEmptyCollapsed ? "w-full" : null)}
			style={isEmptyCollapsed ? undefined : resolveCollapsedHeaderStyle(layout)}
		>
			<div
				className="relative flex h-6 w-full min-w-0 items-center justify-center px-1"
				style={collapsedHitSlopPx === 0
					? undefined
					: toAgentSessionRailHitSlopStyle(collapsedHitSlopPx)}
			>
				{collapsedExpandControl}
				<span
					aria-hidden="true"
					className={cn(
						"absolute inset-x-1 inset-y-0 flex items-center justify-center text-xs font-normal",
						"text-text-subtlest",
						HEADER_COUNT_AT_REST,
						hideGutterCount || isRepositioning ? "opacity-0" : "opacity-100",
					)}
					data-agent-session-column-count=""
					data-agent-session-column-counter-state={showRisingCount ? "count" : "local"}
				>
					<AgentSessionColumnCountSwap reducedMotion={shouldReduceMotion} rising={showRisingCount}>
							<AgentSessionColumnCountMorph count={sessionCount} />
					</AgentSessionColumnCountSwap>
				</span>
				<span className="sr-only">{collapsedCountLabel}</span>
			</div>
		</div>
	);
	const expandedHeader = (
		<AgentSessionColumnHeader
			dragHandle={headerDragHandle}
			collapseLabel={headerSurface === "panel"
				? "Collapse panel"
				: `Collapse ${title} column`}
			filter={filterMenu}
			frame={columnFrame}
			hasActiveFilters={hasActiveFilters}
			model={untrackedSelection.header}
			onAction={untrackedSelection.onHeaderAction}
			onCollapse={handleToggleCollapsed}
			onPinToggle={onPinnedChange === undefined
				? undefined
				: () => {
					onPinnedChange(!pinned);
				}}
			overflow={overflowMenu}
			pinLabel={onPinnedChange === undefined
				? undefined
				: `${pinned ? "Unpin" : "Pin"} ${title} column`}
			pinned={pinned}
			surface={headerSurface}
		/>
	);
	const body = collapsed ? (
		<AgentSessionColumnRail
			animateLayout={animateLayout}
			arrivingItemIds={arrivingItemIds}
			capturedItemIds={sessionProps.capturedItemIds}
			getSuggestedWorkItemKey={sessionProps.getSuggestedWorkItemKey}
			getSuggestedWorkItemKeys={sessionProps.getSuggestedWorkItemKeys}
			highlightedItemId={sessionProps.highlightedItemId}
			hitSlopPx={collapsedHitSlopPx}
			items={displayedItems}
			maxVisibleItems={isGutterCollapsed && collapsedRailHitSlopPx === 0
				? AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS
				: undefined}
			newItemIds={newItemIds}
			stateChangeVersions={stateChangeVersions}
			notchShape={notchShape}
			onArrivalComplete={handleArrivalComplete}
			onArchiveSession={handleArchiveSession}
			onCreateWorkItem={sessionProps.onCreateWorkItem}
			onItemHover={sessionProps.onItemHover}
			onIntroComplete={onGutterIntroComplete}
			onLinkWorkItem={sessionProps.onLinkWorkItem}
			onSubtasks={sessionProps.onSubtasks}
			onView={handleNotchView}
			playIntro={isGutterCollapsed ? playGutterIntro : false}
			sessionDrag={sessionProps.sessionDrag}
			showUntrackedWorkFooter={sessionProps.showUntrackedWorkFooter}
		/>
	) : (
		<>
			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
				{displayedItems.length === 0 ? (
					hasActiveFilters ? (
						<Empty width="narrow">
							<EmptyHeader>
								<EmptyTitle headingSize="xsmall">No matching sessions</EmptyTitle>
							</EmptyHeader>
						</Empty>
					) : (
						<p className="text-xs text-text-subtlest">{emptyLabel}</p>
					)
				) : (
					<div
						ref={listRef}
						data-agent-session-column-scrollport=""
						className="min-h-0 min-w-0 flex-1 overflow-y-auto has-[:focus-visible]:overflow-visible relative z-0 scrollbar-auto-hide [&[data-scrolling]>ul]:pointer-events-none"
					>
						{/* Omit newItemIds so expanded rows skip the unreviewed blue dot; arrival still uses arrivingItemIds. */}
						<AgentSession
							animateLayout={animateLayout}
							arrivalRowGapPx={AGENT_SESSION_LIST_GAP_PX}
							arrivingItemIds={arrivingItemIds}
							stateChangedItemIds={stateChangedItemIds}
							stateChangeVersions={stateChangeVersions}
							className={cn(
								headerSurface === "column" ? AGENT_SESSION_LIST_SPACING : null,
								listClassName,
							)}
							items={displayedItems}
							onArrivalComplete={handleArrivalComplete}
							onStateChangeComplete={handleStateChangeComplete}
							{...sessionProps}
							glowBloom={glowBloom}
							glowStroke={glowStroke}
							onArchiveSession={handleArchiveSession}
							onSelectedItemIdChange={multiSelect ? handleSelectedItemIdChange : undefined}
							onToggleVisibility={handleToggleVisibility}
							rowTriage={untrackedSelection.rows}
							selectedItemId={selectedItemId}
							visibilityLabel={view === "hidden" ? "Unarchive" : "Archive"}
						/>
						{showEndSpace ? (
							<AgentSessionColumnEndState
								count={sessionCount}
								visible={view === "active" && hasScrolledToBottom}
							/>
						) : null}
					</div>
				)}
				{showTopScrollMask || showBottomScrollMask ? (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 z-10"
						style={{ color: elevatePlane ? "var(--color-surface-overlay)" : AGENT_SESSION_PLANE_FADE_COLOR }}
					>
						{showTopScrollMask ? (
							<ScrollMaskEdgeOverlay
								color="currentColor"
								edge="top"
								fadeSize={AGENT_SESSION_PLANE_TOP_FADE_SIZE}
							/>
						) : null}
						{showBottomScrollMask ? (
							<ScrollMaskEdgeOverlay
								color="currentColor"
								edge="bottom"
								fadeSize={hasScrollingEffect
									? AGENT_SESSION_PLANE_BOTTOM_FADE_SIZE
									: AGENT_SESSION_PLANE_TOP_FADE_SIZE}
							/>
						) : null}
					</div>
				) : null}
			</div>
			{showWellFooter ? (
				<AgentSessionColumnHiddenFooter
					count={view === "hidden" ? untrackedCount : hiddenCount}
					mode={view === "hidden" ? "back" : "hidden"}
					onClick={view === "hidden" ? closeHiddenView : openHiddenView}
					title={title}
				/>
			) : null}
		</>
	);

	return (
		<section
			ref={setColumnNode}
			aria-label={`${displayTitle}, ${sessionCount} sessions`}
			className={cn(
				"group/session-column relative flex min-h-0 shrink-0 flex-col",
				!elevatePlane && ((collapsed && collapsedRailHitSlopPx === 0) || isResizing)
					? "overflow-hidden"
					: null,
				className,
			)}
			data-agent-session-column={title}
			data-collapsed={collapsed || undefined}
			data-column-frame={layout === "panel" ? undefined : layout}
			onBlurCapture={handleColumnBlurCapture}
			onFocusCapture={handleColumnFocusCapture}
			onKeyDown={multiSelect ? untrackedSelection.onKeyDown : undefined}
			onPointerEnter={handleColumnPointerEnter}
			onPointerLeave={handleColumnPointerLeave}
			onTransitionEnd={handleTransitionEnd}
			tabIndex={-1}
			style={{
				transition:
					shouldReduceMotion || widthTransitionDisabled
						? "none"
						: AGENT_SESSION_COLUMN_TRANSITION,
				width: collapsed
					? `${AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX}px`
					: `${expandedWidthPx}px`,
			}}
		>
			{isEmptyCollapsed ? (
				<CollapsedColumnLabel
					appearance={{
						pillClassName: "border border-solid border-border-disabled",
						captionPaddingBottom: token("space.100"),
						countPaddingTop: token("space.100"),
						pillRadius: token("radius.large"),
						pillPaddingBlock: token("space.150"),
					}}
					countRow={collapsedHeader}
					headerFrame={layout}
					title={title}
				/>
			) : renderAgentSessionColumnFrame({
				allowCollapsedRailOverflow: collapsed && collapsedHitSlopPx > 0,
				body: (
					<CardGlowSurfaceContext value={glowPlaneEnabled ? registerGlowSurface : undefined}>
						{body}
					</CardGlowSurfaceContext>
				),
				bodyHidden: collapsed && isRepositioning,
				borderColor: planeBorderColor,
				boxShadow: planeBoxShadow,
				header: collapsed ? collapsedHeader : expandedHeader,
				isGutterCollapsed,
				layout,
				marginBlock: planeMarginBlock,
				planeClassName,
				shadowTransition: planeShadowTransition,
			})}
		</section>
	);
}

export { AgentSessionColumnRail } from "./agent-session-column-rail";
export {
	DEFAULT_AGENT_SESSION_COLUMN_FRAME,
	resolveAgentSessionColumnLayout,
} from "./agent-session-column-frame";
export type {
	AgentSessionColumnFrame,
	AgentSessionColumnLayout,
} from "./agent-session-column-frame";
export type {
	AgentSessionColumnNotchShape,
	AgentSessionColumnProps,
} from "./agent-session-column-types";
