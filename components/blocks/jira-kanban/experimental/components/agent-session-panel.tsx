"use client";

import { useLayoutEffect, type ReactElement, type Ref } from "react";

import { motion, useReducedMotion, type Variants } from "motion/react";

import {
	AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX,
	AgentSessionColumn,
	type AgentSessionColumnProps,
} from "@/components/blocks/agent-session-column";
import { useAgentSessionPanelResize } from "@/components/blocks/jira-kanban/experimental/hooks/use-agent-session-panel-resize";
import {
	PanelContainer,
	PanelContent,
} from "@/components/ui/panel";
import { SidebarResizeHandle } from "@/components/ui/sidebar";
import { ScrollMaskEdgeOverlay } from "@/components/visual/scroll-mask";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

/**
 * Default column title, mirrored from `AgentSessionColumn`'s own default so the
 * panel header and the column's `aria-label` cannot disagree when the host does
 * not supply one.
 */
const AGENT_SESSION_PANEL_TITLE = "Unlink sessions";

/**
 * Entrance slide distance in px.
 *
 * The panel is pinned to the right edge of the content region, so it enters
 * from that edge — spatial anchoring. It is deliberately a short offset rather
 * than a full `100%` off-canvas slide: the content region is not a clipping
 * container, so a full slide would paint the panel over whatever sits to the
 * right of the board for the length of the animation. 16px reads as "arrived
 * from the right" without leaving the region.
 */
const AGENT_SESSION_PANEL_SLIDE_PX = 16;

/**
 * The rail's entrance, played once on mount (design variant switched on, or a
 * fresh load with it already on): `duration-slow` + the bold `ease-out` curve,
 * for a medium, infrequent surface appearing. Two properties only — fade +
 * slide. There is no exit half: the rail is persistent, so `hidden` is purely
 * the `initial` state, never a destination.
 *
 * Motion cannot read `var()`, so the token curve is its resolved array.
 */
const AGENT_SESSION_PANEL_VARIANTS: Variants = {
	hidden: {
		opacity: 0,
		transform: `translateX(${AGENT_SESSION_PANEL_SLIDE_PX}px)`,
	},
	visible: {
		opacity: 1,
		transform: "translateX(0px)",
		transition: { duration: 0.25, ease: motionEase.out }, // duration-slow + ease-out
	},
};

/**
 * VPK's duration/easing tokens resolve to literal values and do not honour
 * `prefers-reduced-motion`, so the guard has to be explicit: same states, no
 * offset, no fade, zero duration.
 */
const AGENT_SESSION_PANEL_REDUCED_MOTION_VARIANTS: Variants = {
	hidden: { opacity: 1, transform: "translateX(0px)", transition: { duration: 0 } },
	visible: { opacity: 1, transform: "translateX(0px)", transition: { duration: 0 } },
};

/**
 * Minimising is an in-place resize, not an entrance, so it stays a CSS width
 * transition on the bold in-place profile — byte-for-byte the one
 * `AgentSessionColumn` runs on itself, so the two width owners move as one.
 */
const AGENT_SESSION_PANEL_WIDTH_TRANSITION = "width var(--duration-medium) var(--ease-in-out)";

export { AGENT_SESSION_PANEL_WIDTH_PX } from "@/components/blocks/jira-kanban/experimental/hooks/use-agent-session-panel-resize";

/**
 * Width of the docked rail's leading hairline.
 *
 * The host is `border-box` at `AGENT_SESSION_PANEL_WIDTH_PX`, so this pixel is
 * subtracted from the inner column rather than added to the host — otherwise
 * the well overflows the rail by 1px. Collapsed drops the border entirely.
 */
const AGENT_SESSION_PANEL_BORDER_PX = 1;

export interface AgentSessionPanelProps {
	agentSessionColumn: AgentSessionColumnProps;
	collapsed: boolean;
	onCollapsedChange: (collapsed: boolean) => void;
	ref?: Ref<HTMLDivElement>;
	/**
	 * True while a board session drag is in flight. The rail stops receiving
	 * hits so the captured pointer can drop on issue cards underneath it.
	 */
	sessionDragging?: boolean;
	/**
	 * True while an attached chin session is hovering the rail as a drop
	 * target. Coordinate hit-testing still uses the rail's box; this only
	 * paints the armed state.
	 */
	untrackedDropArmed?: boolean;
	/**
	 * Distance in px from the top of the positioning ancestor at which the rail
	 * starts — normally the bottom edge of the board's tab strip.
	 *
	 * This is a real `top` offset, not top padding: the element itself must stop
	 * at the tab strip rather than spanning the whole board root and relying on
	 * an opaque band to paint over its head. Padding would leave an invisible
	 * slab covering the tabs, swallowing pointer events and reading as a
	 * full-height overlay to anything that measures the DOM.
	 */
	topInset?: number;
	/**
	 * Live expanded width so the board can reserve the same trailing scroll
	 * inset and FAB offset the rail occupies. Collapsed width is not reported.
	 */
	onExpandedWidthChange?: (widthPx: number) => void;
	/**
	 * Fade content that continues beneath the collapsed rail's leading edge.
	 * The expanded panel already has a border separator, so it never fades.
	 */
	showLeadingScrollFade?: boolean;
}

/**
 * The untracked-work column as a persistent docked rail.
 *
 * Same `AgentSessionColumn` the board renders in flow — only the host changes.
 * It is `absolute`, so it leaves the flow entirely and the board or list
 * scrolls underneath it, and it sizes itself from the column's own exported
 * widths so the panel edge and the column edge can never disagree.
 *
 * Two states, and only two: expanded (360px panel) and collapsed (32px notch
 * rail). There is no closed state — the rail is always on the board's trailing
 * edge, which is exactly what lets it be its own entry point. The column owns
 * the expanded header (`headerSurface="panel"`) and the collapsed rail, so
 * this host does not draw a second title bar.
 *
 * It is a persistent side surface, not a modal: no focus lock
 * (`isFocusLockEnabled` stays off) and no backdrop, so the board behind it
 * stays fully operable.
 */
export function AgentSessionPanel({
	agentSessionColumn,
	collapsed,
	onCollapsedChange,
	onExpandedWidthChange,
	ref,
	sessionDragging = false,
	showLeadingScrollFade = false,
	topInset = 0,
	untrackedDropArmed = false,
}: Readonly<AgentSessionPanelProps>): ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const title = agentSessionColumn.title ?? AGENT_SESSION_PANEL_TITLE;
	const panelResize = useAgentSessionPanelResize();
	const expandedWidthPx = panelResize.sidebarWidth;

	useLayoutEffect(() => {
		onExpandedWidthChange?.(expandedWidthPx);
	}, [expandedWidthPx, onExpandedWidthChange]);

	return (
		<motion.div
			animate="visible"
			// z-40 clears the board's dragged card (z-30) while staying under
			// the portalled session flyout and drag chip, so both keep working
			// over the panel.
			//
			// No host `border-l`: SidebarResizeHandle paints the leading
			// hairline the same way Ask Rovo chat does. A second `border-l`
			// would stack two translucent `color.border` lines.
			className={cn(
				"absolute bottom-0 right-0 z-40 rounded-none",
				sessionDragging ? "pointer-events-none" : null,
			)}
			data-board-agent-session-drop-zone="untracked"
			data-board-agent-session-target={untrackedDropArmed ? "untracked" : undefined}
			// No `AnimatePresence`/`exit`: the rail is persistent, so the only
			// unmount is the design variant being switched off — a mode change,
			// not a dismissal, and nothing for an exit animation to narrate.
			initial="hidden"
			ref={ref}
			style={{
				// A real `top`, not top padding: the rail must END at the tab
				// strip, not merely look like it does. `bottom: 0` with no radius
				// so it is flush to the page — no floating inset under the rail.
				top: topInset,
				transition:
					shouldReduceMotion || panelResize.isResizing
						? undefined
						: AGENT_SESSION_PANEL_WIDTH_TRANSITION,
				width: collapsed
					? AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX
					: expandedWidthPx,
				willChange: shouldReduceMotion ? undefined : "opacity, transform",
			}}
			variants={
				shouldReduceMotion
					? AGENT_SESSION_PANEL_REDUCED_MOTION_VARIANTS
					: AGENT_SESSION_PANEL_VARIANTS
			}
		>
			{showLeadingScrollFade && collapsed ? (
				<ScrollMaskEdgeOverlay
					className="right-full"
					edge="right"
					fadeSize="3rem"
				/>
			) : null}
			<PanelContainer
				// Named for the surface, not the list: the column's own
				// `<section>` already announces "{title}, N sessions", and two
				// nested regions must not share one name.
				aria-label={`${title} panel`}
				className={cn(
					"h-full",
					untrackedDropArmed ? "bg-bg-accent-blue-subtlest" : "bg-surface",
				)}
				tabIndex={-1}
			>
				<PanelContent className={collapsed ? "pt-1" : "pt-0"}>
					{/*
					 * `flex-1` because the column sizes itself to its content — it is
					 * built to stand on a board, not to fill a docked surface — and
					 * the list has to reach the bottom of the panel. Row gap and
					 * side inset share `space.050` (`gap-1 p-1`, 4px). The in-flow
					 * column applies the same spacing when `headerSurface="column"`.
					 */}
					<AgentSessionColumn
						{...agentSessionColumn}
						className="flex-1"
						collapsed={collapsed}
						expandedWidthPx={expandedWidthPx - AGENT_SESSION_PANEL_BORDER_PX}
						headerSurface="panel"
						listClassName={cn("gap-1 p-1", agentSessionColumn.listClassName)}
						onCollapsedChange={onCollapsedChange}
					/>
				</PanelContent>
			</PanelContainer>
			{collapsed ? null : (
				<SidebarResizeHandle
					aria-label={`Resize ${title} panel`}
					aria-orientation="vertical"
					aria-valuemax={panelResize.maxWidth}
					aria-valuemin={panelResize.minWidth}
					aria-valuenow={expandedWidthPx}
					data-active={panelResize.isResizing ? "" : undefined}
					onDoubleClick={panelResize.onResizeHandleDoubleClick}
					onKeyDown={panelResize.onResizeHandleKeyDown}
					onPointerDown={panelResize.onResizeHandlePointerDown}
					onPointerEnter={panelResize.onResizeHandlePointerEnter}
					onPointerLeave={panelResize.onResizeHandlePointerLeave}
					role="separator"
					side="left"
					tabIndex={0}
				/>
			)}
		</motion.div>
	);
}
