"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import DragHandleVerticalIcon from "@atlaskit/icon/core/drag-handle-vertical";
import { Icon } from "@/components/ui/icon";

import {
	AgentSessionColumn,
	AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX,
	AGENT_SESSION_COLUMN_WIDTH_PX,
	type AgentSessionColumnFrame,
	type AgentSessionColumnProps,
} from "@/components/blocks/agent-session-column";
import { JiraSessionFlyoutSuspensionProvider } from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import { SidebarResizeHandle } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import {
	IN_FLOW_AGENT_SESSION_COLUMN_EMBEDDED_OFFSET_PX,
	IN_FLOW_AGENT_SESSION_COLUMN_INSET_PX,
	IN_FLOW_AGENT_SESSION_COLUMN_SURFACE_LEADING_BORDER_PX,
	resolveInFlowAgentSessionColumnGapPx,
	resolveInFlowResizeHandleOffsetPx,
} from "../lib/in-flow-agent-session-column-geometry";
import {
	reduceInFlowSessionColumnAxes,
	resolveInFlowSessionColumnRest,
} from "../lib/in-flow-agent-session-column-interaction";
import { useInFlowGutterScrollMask } from "./use-in-flow-gutter-scroll-mask";
import { InFlowAgentSessionColumnCollapsedMenu } from "./in-flow-agent-session-column-collapsed-menu";
import { useSessionColumnReposition } from "./use-session-column-reposition";

// Extend the preview's 24px session targets to 56px, within the empty gutter.
// The 32px column footprint and marker axis stay fixed; To do remains clickable.
const IN_FLOW_AGENT_SESSION_COLUMN_RAIL_HIT_SLOP_PX = 16;
const IN_FLOW_AGENT_SESSION_COLUMN_TITLE = "Unlink sessions";
// Centers the rail's 16px dot axis in the 26px visible gutter (24px inset + border).
const IN_FLOW_AGENT_SESSION_COLUMN_GUTTER_OFFSET_PX = -5;
const IN_FLOW_AGENT_SESSION_COLUMN_MAX_WIDTH_PX = 560;
const IN_FLOW_AGENT_SESSION_COLUMN_WIDTH_TRANSITION =
	"width var(--duration-normal) var(--ease-out-practical)";
const IN_FLOW_AGENT_SESSION_COLUMN_SURFACE_TRANSITION =
	"transform var(--duration-normal) var(--ease-out-practical)";
const IN_FLOW_AGENT_SESSION_COLUMN_EXPANSION_TRANSITION =
	"width var(--duration-medium) var(--ease-in-out)";
const IN_FLOW_AGENT_SESSION_COLUMN_RESIZE_HANDLE_CLASS_NAME = [
	"right-auto -translate-x-1/2",
	"bg-transparent! hover:bg-transparent! data-[active]:bg-transparent! focus-visible:bg-transparent! focus-visible:outline-none focus-visible:ring-0",
	"duration-normal ease-out-practical",
	"[&>div]:h-16 [&>div]:origin-center [&>div]:transition-[opacity,background-color,scale]",
	"group-hover/in-flow-agent-session-column:[&>div]:opacity-100 hover:[&>div]:scale-105",
	"data-[active]:[&>div]:scale-105 focus-visible:[&>div]:scale-105 focus-visible:[&>div]:bg-bg-selected-bold focus-visible:[&>div]:opacity-100",
	"[&>div]:duration-medium [&>div]:ease-out-practical motion-reduce:transition-none motion-reduce:[&>div]:scale-100 motion-reduce:[&>div]:transition-none",
].join(" ");

export interface InFlowAgentSessionColumnProps {
	/** False keeps the timeline embedded and removes advanced placement/depth chrome. */
	advancedTimeline?: boolean;
	agentSessionColumn: AgentSessionColumnProps;
	className?: string;
	columnFrame: AgentSessionColumnFrame;
	paddingBottom?: CSSProperties["paddingBottom"];
	paddingTop?: CSSProperties["paddingTop"];
	/** Whether the expanded column exposes its width-resize separator. */
	resizable?: boolean;
	sessionFlyoutsSuspended: boolean;
	/** Elevates the column well above horizontally scrolled board content. */
	showTrailingShadow?: boolean;
	untrackedDropArmed: boolean;
}

function useInFlowAgentSessionColumnInteraction(
	collapsed: AgentSessionColumnProps["collapsed"],
	onCollapsedChange: AgentSessionColumnProps["onCollapsedChange"],
	advancedTimeline: boolean,
) {
	const rest = resolveInFlowSessionColumnRest(collapsed);
	const [isHovered, setIsHovered] = useState(false);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [pinned, setPinned] = useState(rest.pinned);
	const [expanded, setExpanded] = useState(rest.expanded);
	const [previousCollapsed, setPreviousCollapsed] = useState(collapsed);
	if (previousCollapsed !== collapsed) {
		// Reset presentation axes when the board filter changes, preserving the
		// mounted column's session-arrival history and gutter introduction.
		setPreviousCollapsed(collapsed);
		setPinned(rest.pinned);
		setExpanded(rest.expanded);
		setIsHovered(false);
		setIsMenuOpen(false);
	}
	const isEmbedded = !advancedTimeline || isHovered || pinned || isMenuOpen;
	const isFullWidth = expanded && isEmbedded;
	const resolvedPinned = advancedTimeline ? pinned : true;

	const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType !== "touch") {
			setIsHovered(true);
		}
	};

	const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType !== "touch") {
			setIsHovered(false);
		}
	};

	const handlePinnedChange = (nextPinned: boolean) => {
		const next = reduceInFlowSessionColumnAxes({ expanded, pinned }, { type: "pin", pinned: nextPinned });
		setExpanded(next.expanded);
		setPinned(next.pinned);
		if (next.pinned) {
			setIsHovered(true);
		} else {
			setIsHovered(false);
			setIsMenuOpen(false);
		}
	};

	const handleExpand = () => {
		const next = reduceInFlowSessionColumnAxes({ expanded, pinned }, { type: "expand" });
		setExpanded(next.expanded);
		setPinned(next.pinned);
		setIsHovered(true);
		onCollapsedChange?.(false);
	};

	const handleCollapsedChange = (nextCollapsed: boolean) => {
		if (nextCollapsed) {
			const next = reduceInFlowSessionColumnAxes({ expanded, pinned }, { type: "collapse" });
			setExpanded(next.expanded);
			setPinned(next.pinned);
			setIsHovered(false);
			setIsMenuOpen(false);
			onCollapsedChange?.(true);
			return;
		}
		handleExpand();
	};

	const handleGutterPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType !== "touch") {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		handlePinnedChange(true);
	};

	const handleMenuOpenChange = (open: boolean) => {
		setIsMenuOpen(open);
		if (open) {
			setIsHovered(true);
		}
	};

	return {
		expanded,
		handleCollapsedChange,
		handleExpand,
		handleGutterPointerDown,
		handleMenuOpenChange,
		handlePinnedChange,
		handlePointerEnter,
		handlePointerLeave,
		isEmbedded,
		isFullWidth,
		isMenuOpen,
		pinned: resolvedPinned,
	};
}

function InFlowAgentSessionColumnFootprint({
	columnFrame,
	columnWidthPx,
	isEmbedded,
	isResizing,
	shouldReduceMotion,
}: Readonly<{
	columnFrame: AgentSessionColumnFrame;
	columnWidthPx: number;
	isEmbedded: boolean;
	isResizing: boolean;
	shouldReduceMotion: boolean | null;
}>) {
	const transition = shouldReduceMotion || isResizing
		? "none"
		: IN_FLOW_AGENT_SESSION_COLUMN_WIDTH_TRANSITION;
	const expansionTransition = shouldReduceMotion || isResizing
		? "none"
		: IN_FLOW_AGENT_SESSION_COLUMN_EXPANSION_TRANSITION;

	return (
		<>
			<div
				aria-hidden="true"
				className="shrink-0"
				data-agent-session-column-footprint="width"
				style={{
					transition,
					width: isEmbedded ? resolveInFlowAgentSessionColumnGapPx(columnFrame) : 0,
				}}
			/>
			<div
				aria-hidden="true"
				className="shrink-0"
				style={{
					transition: columnWidthPx === AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX ? transition : expansionTransition,
					width: isEmbedded ? columnWidthPx : 0,
				}}
			/>
		</>
	);
}

function resolveInFlowAgentSessionColumnAdvancedCapabilities({
	advancedTimeline,
	menuOpen,
	onExpand,
	onMenuOpenChange,
	onPinnedChange,
	pinned,
	title,
}: Readonly<{
	advancedTimeline: boolean;
	menuOpen: boolean;
	onExpand: () => void;
	onMenuOpenChange: (open: boolean) => void;
	onPinnedChange: (pinned: boolean) => void;
	pinned: boolean;
	title: string;
}>): Readonly<{
	collapsedMenu: AgentSessionColumnProps["collapsedMenu"];
	hasScrollingEffect: boolean;
	onPinnedChange: AgentSessionColumnProps["onPinnedChange"];
}> {
	if (!advancedTimeline) {
		return {
			collapsedMenu: undefined,
			hasScrollingEffect: false,
			onPinnedChange: undefined,
		};
	}

	return {
		collapsedMenu: ({ className, dragging }) => (
			<InFlowAgentSessionColumnCollapsedMenu
				className={className}
				dragging={dragging}
				open={menuOpen}
				onExpand={onExpand}
				onOpenChange={onMenuOpenChange}
				onPinnedChange={onPinnedChange}
				pinned={pinned}
				title={title}
			/>
		),
		hasScrollingEffect: true,
		onPinnedChange,
	};
}

function InFlowAgentSessionColumnResizeHandle({
	columnFrame,
	expandedWidthPx,
	resize,
	title,
	visible,
}: Readonly<{
	columnFrame: AgentSessionColumnFrame;
	expandedWidthPx: number;
	resize: ReturnType<typeof useSidebarResize>;
	title: string;
	visible: boolean;
}>) {
	if (!visible) return null;

	return (
		<SidebarResizeHandle
			aria-label={`Resize ${title} column`}
			aria-orientation="vertical"
			aria-valuemax={resize.maxWidth}
			aria-valuemin={resize.minWidth}
			aria-valuenow={expandedWidthPx}
			className={IN_FLOW_AGENT_SESSION_COLUMN_RESIZE_HANDLE_CLASS_NAME}
			data-active={resize.isResizing ? "" : undefined}
			data-testid="jira-kanban-agent-session-column-resize-handle"
			onDoubleClick={resize.onResizeHandleDoubleClick}
			onKeyDown={resize.onResizeHandleKeyDown}
			onPointerDown={resize.onResizeHandlePointerDown}
			role="separator"
			side="right"
			style={{
				left: `calc(100% + ${resolveInFlowResizeHandleOffsetPx(columnFrame)}px)`,
				right: "auto",
			}}
			tabIndex={0}
		/>
	);
}

function InFlowAgentSessionColumnSurface({
	advancedTimeline,
	agentSessionColumn,
	className,
	columnFrame,
	expanded,
	expandedWidthPx,
	isEmbedded,
	isFullWidth,
	pinned,
	resizable,
	resize,
	onCollapsedChange,
	onExpand,
	menuOpen,
	onGutterIntroComplete,
	onMenuOpenChange,
	onPinnedChange,
	paddingBottom,
	paddingTop,
	playGutterIntro,
	shouldReduceMotion,
	showTrailingShadow,
	untrackedDropArmed,
}: Readonly<InFlowAgentSessionColumnProps & {
	advancedTimeline: boolean;
	expanded: boolean;
	expandedWidthPx: number;
	isEmbedded: boolean;
	isFullWidth: boolean;
	pinned: boolean;
	resizable: boolean;
	resize: ReturnType<typeof useSidebarResize>;
	onCollapsedChange: (collapsed: boolean) => void;
	onExpand: () => void;
	menuOpen: boolean;
	onGutterIntroComplete: () => void;
	onMenuOpenChange: (open: boolean) => void;
	onPinnedChange: (pinned: boolean) => void;
	playGutterIntro: boolean;
	shouldReduceMotion: boolean | null;
}>) {
	const title = agentSessionColumn.title ?? IN_FLOW_AGENT_SESSION_COLUMN_TITLE;
	const {
		collapsedMenu,
		hasScrollingEffect,
		onPinnedChange: advancedOnPinnedChange,
	} = resolveInFlowAgentSessionColumnAdvancedCapabilities({
		advancedTimeline,
		menuOpen,
		onExpand,
		onMenuOpenChange,
		onPinnedChange,
		pinned,
		title,
	});

	return (
		<div
			className={cn(
				"group/in-flow-agent-session-column absolute inset-y-0 start-0 z-40 flex min-h-0 border-2 border-r-0",
				isEmbedded
					? "pointer-events-auto"
					: "pointer-events-none [&_[data-agent-session-notch]]:pointer-events-auto [&_[data-agent-session-column-expand-control]]:pointer-events-auto",
				untrackedDropArmed ? "border-ring" : "border-transparent",
				className,
			)}
			data-board-agent-session-drop-zone="untracked"
			data-board-agent-session-target={untrackedDropArmed ? "untracked" : undefined}
			style={{
				paddingTop,
				paddingBottom,
				willChange: shouldReduceMotion ? undefined : "transform",
				transform: `translateX(${isEmbedded ? IN_FLOW_AGENT_SESSION_COLUMN_EMBEDDED_OFFSET_PX : IN_FLOW_AGENT_SESSION_COLUMN_GUTTER_OFFSET_PX}px)`,
				transition: shouldReduceMotion ? "none" : IN_FLOW_AGENT_SESSION_COLUMN_SURFACE_TRANSITION,
			}}
		>
			<AgentSessionColumn
				{...agentSessionColumn}
				collapsed={!isFullWidth}
				collapsedMenu={collapsedMenu}
				hasScrollingEffect={hasScrollingEffect}
				collapsedPresentation={isEmbedded ? "column" : "gutter"}
				collapsedRailHitSlopPx={isEmbedded && !isFullWidth
					? IN_FLOW_AGENT_SESSION_COLUMN_RAIL_HIT_SLOP_PX
					: 0}
				columnFrame={columnFrame}
				expandedWidthPx={expandedWidthPx}
				widthTransitionDisabled={resize.isResizing}
				onCollapsedChange={onCollapsedChange}
				onGutterIntroComplete={onGutterIntroComplete}
				onPinnedChange={advancedOnPinnedChange}
				pinned={pinned}
				playGutterIntro={playGutterIntro}
				showTrailingShadow={Boolean(showTrailingShadow && isEmbedded)}
				toggleChangesWidth={expanded}
			/>
			<InFlowAgentSessionColumnResizeHandle
				columnFrame={columnFrame}
				expandedWidthPx={expandedWidthPx}
				resize={resize}
				title={title}
				visible={isFullWidth && resizable}
			/>
		</div>
	);
}

function resolveSessionColumnExpansion(
	isEmbedded: boolean,
	isFullWidth: boolean,
	pinned: boolean,
): "expanded" | "gutter" | "pinned" | "preview" {
	if (!isEmbedded) return "gutter";
	if (isFullWidth) return "expanded";
	return pinned ? "pinned" : "preview";
}

function InFlowAgentSessionColumnGutter({
	handleGutterPointerDown,
	handlePointerEnter,
	isEmbedded,
	showGutterScrollMask,
}: Readonly<{
	handleGutterPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
	handlePointerEnter: (event: PointerEvent<HTMLDivElement>) => void;
	isEmbedded: boolean;
	showGutterScrollMask: boolean;
}>) {
	if (isEmbedded) return null;

	return (
		<div
			aria-hidden="true"
			className="absolute inset-y-0 start-0 z-30"
			data-agent-session-column-hit-area=""
			onPointerEnter={handlePointerEnter}
			onPointerDown={handleGutterPointerDown}
			style={{
				width: IN_FLOW_AGENT_SESSION_COLUMN_INSET_PX
					+ IN_FLOW_AGENT_SESSION_COLUMN_SURFACE_LEADING_BORDER_PX,
			}}
		>
			{showGutterScrollMask ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 start-0 z-40 bg-surface"
					data-agent-session-column-gutter-fill=""
					style={{ width: IN_FLOW_AGENT_SESSION_COLUMN_INSET_PX }}
				/>
			) : null}
		</div>
	);
}

function useInFlowAgentSessionColumnModel({
	advancedTimeline = true,
	agentSessionColumn,
	sessionFlyoutsSuspended,
}: Readonly<Pick<InFlowAgentSessionColumnProps, "advancedTimeline" | "agentSessionColumn" | "sessionFlyoutsSuspended">>) {
	const shouldReduceMotion = useReducedMotion();
	const hostRef = useRef<HTMLDivElement>(null);
	const showGutterScrollMask = useInFlowGutterScrollMask(hostRef);
	const [playGutterIntro, setPlayGutterIntro] = useState(true);
	useEffect(() => {
		if (shouldReduceMotion) {
			setPlayGutterIntro(false);
		}
	}, [shouldReduceMotion]);
	const interaction = useInFlowAgentSessionColumnInteraction(
		agentSessionColumn.collapsed,
		agentSessionColumn.onCollapsedChange,
		advancedTimeline,
	);
	const resize = useSidebarResize({
		defaultWidth: agentSessionColumn.expandedWidthPx ?? AGENT_SESSION_COLUMN_WIDTH_PX,
		maxWidth: IN_FLOW_AGENT_SESSION_COLUMN_MAX_WIDTH_PX,
		minWidth: AGENT_SESSION_COLUMN_WIDTH_PX,
		minWidthResistance: true,
	});
	const expandedWidthPx = resize.sidebarWidth;
	const columnWidthPx = interaction.isFullWidth
		? expandedWidthPx
		: AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX;
	const reposition = useSessionColumnReposition({
		hostRef,
		width: columnWidthPx,
		disabled: sessionFlyoutsSuspended || resize.isResizing,
		onStart: () => {
			interaction.handleMenuOpenChange(false);
			if (!interaction.pinned && !interaction.isFullWidth) interaction.handlePinnedChange(true);
		},
	});
	const handlePinnedPlacementChange = (nextPinned: boolean) => {
		interaction.handlePinnedChange(nextPinned);
		if (!nextPinned) reposition.moveToLeadingGutter();
	};
	const isEmbedded = interaction.isEmbedded || reposition.shifted || reposition.dragging;
	const dragHandle = reposition.available ? (
		<button
			aria-label={`Move ${agentSessionColumn.title ?? IN_FLOW_AGENT_SESSION_COLUMN_TITLE} column`}
			className="me-1 inline-flex size-3 shrink-0 cursor-grab touch-none items-center justify-center text-icon-disabled active:cursor-grabbing [&_svg]:text-icon-disabled"
			data-session-column-move-handle=""
			title={reposition.dragging ? undefined : "Drag to move column. Use arrow keys, Home or End to reposition."}
			type="button"
		>
			<Icon className="size-3 text-icon-disabled" render={<DragHandleVerticalIcon color="currentColor" label="" size="small" />} />
		</button>
	) : undefined;

	return {
		columnWidthPx,
		dragHandle,
		expandedWidthPx,
		handlePinnedPlacementChange,
		hostRef,
		interaction,
		isEmbedded,
		playGutterIntro,
		reposition,
		resize,
		setPlayGutterIntro,
		shouldReduceMotion,
		showGutterScrollMask,
	};
}

/**
 * The Untracked rail starts pinned in the board as a compact timeline. In the
 * simple mode it remains embedded, uses a flat list without an end cap, and
 * reuses AgentSessionColumn's dedicated expand/collapse control. Advanced mode
 * restores deck depth, its end-state, and the optional placement axis: Unpin
 * tucks the rail into the leading gutter, hover previews it in place, and the
 * column can be repositioned between status columns. The full-height gutter
 * target sits behind each session row so a row can own its whole 24px band
 * while empty gutter space still opens the advanced preview.
 */
export function InFlowAgentSessionColumn({
	advancedTimeline = true,
	agentSessionColumn,
	className,
	columnFrame,
	paddingBottom,
	paddingTop,
	resizable = true,
	sessionFlyoutsSuspended,
	showTrailingShadow,
	untrackedDropArmed,
}: Readonly<InFlowAgentSessionColumnProps>): ReactNode {
	const {
		columnWidthPx,
		dragHandle,
		expandedWidthPx,
		handlePinnedPlacementChange,
		hostRef,
		interaction: {
			expanded,
			handleCollapsedChange,
			handleExpand,
			handleGutterPointerDown,
			handleMenuOpenChange,
			handlePointerEnter,
			handlePointerLeave,
			isFullWidth,
			isMenuOpen,
			pinned,
		},
		isEmbedded,
		playGutterIntro,
		reposition,
		resize,
		setPlayGutterIntro,
		shouldReduceMotion,
		showGutterScrollMask,
	} = useInFlowAgentSessionColumnModel({
		advancedTimeline,
		agentSessionColumn,
		sessionFlyoutsSuspended,
	});

	return (
		<JiraSessionFlyoutSuspensionProvider
			suspended={sessionFlyoutsSuspended || reposition.dragging || isMenuOpen || !isEmbedded}
		>
			<div
				ref={hostRef}
				{...reposition.bindings}
				data-agent-session-column-expansion={resolveSessionColumnExpansion(isEmbedded, isFullWidth, pinned)}
				data-agent-session-column-pinned={pinned ? "" : undefined}
				data-session-column-dragging={reposition.dragging || undefined}
				className={cn(
					"z-30 flex min-h-0 shrink-0 self-stretch",
					reposition.shifted ? "pointer-events-none absolute inset-y-0 left-0" : "relative",
					reposition.enabled
						? "[&_[data-agent-session-column-options]]:cursor-grab [&_[data-agent-session-column-options]]:touch-pan-y"
						: null,
					reposition.dragging ? "z-50" : null,
				)}
				style={reposition.shifted ? { width: columnWidthPx + 42 } : undefined}
				onPointerDown={isEmbedded ? undefined : handleGutterPointerDown}
				onPointerEnter={handlePointerEnter}
				onPointerLeave={handlePointerLeave}
			>
				<InFlowAgentSessionColumnGutter
					handleGutterPointerDown={handleGutterPointerDown}
					handlePointerEnter={handlePointerEnter}
					isEmbedded={isEmbedded}
					showGutterScrollMask={showGutterScrollMask}
				/>
				{reposition.shifted ? null : <InFlowAgentSessionColumnFootprint
					columnFrame={columnFrame}
					columnWidthPx={columnWidthPx}
					isEmbedded={isEmbedded}
					isResizing={resize.isResizing}
					shouldReduceMotion={shouldReduceMotion}
				/>}
				<InFlowAgentSessionColumnSurface
					advancedTimeline={advancedTimeline}
					agentSessionColumn={{ ...agentSessionColumn, headerDragHandle: dragHandle, isRepositioning: reposition.dragging }}
					className={className}
					columnFrame={columnFrame}
					expanded={expanded}
					expandedWidthPx={expandedWidthPx}
					isEmbedded={isEmbedded}
					isFullWidth={isFullWidth}
					menuOpen={isMenuOpen}
					pinned={pinned}
					resizable={resizable}
					resize={resize}
					onCollapsedChange={handleCollapsedChange}
					onExpand={handleExpand}
					onGutterIntroComplete={() => setPlayGutterIntro(false)}
					onMenuOpenChange={handleMenuOpenChange}
					onPinnedChange={handlePinnedPlacementChange}
					paddingBottom={paddingBottom}
					paddingTop={paddingTop}
					playGutterIntro={playGutterIntro}
					sessionFlyoutsSuspended={sessionFlyoutsSuspended}
					shouldReduceMotion={shouldReduceMotion}
					showTrailingShadow={showTrailingShadow}
					untrackedDropArmed={untrackedDropArmed}
				/>
			</div>
		</JiraSessionFlyoutSuspensionProvider>
	);
}
