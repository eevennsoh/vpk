"use client";

import { use, useId, type CSSProperties } from "react";
import AddIcon from "@atlaskit/icon/core/add";

import { Icon } from "@/components/ui/icon";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import type { BoardCardInsertion } from "../lib/board-agent-session-drag";
import type { BoardCardInsertionSeam } from "../lib/board-card-insertion";
import { BoardCardHoverInsertionContext } from "./board-card-hover-insertion-context";

/**
 * The single insertion seam of a column that holds no cards.
 *
 * Card seams normally ride the per-card wrappers, so a column emptied by the
 * assignee filter — or one that simply has nothing in it — would emit no gap at
 * all and swallow the drop. This stand-in fills the card list, publishes the
 * one gap the column has, and draws the line for it.
 */
export function BoardEmptyColumnInsertionSlot({
	armed,
	columnTitle,
}: Readonly<{ armed: boolean; columnTitle: string }>) {
	const hoverInsertion = use(BoardCardHoverInsertionContext);
	const showLine = armed || hoverInsertion?.columnTitle === columnTitle;

	return (
		<div
			className="relative min-h-8 flex-1"
			data-board-agent-session-drop-zone="card-gap"
			data-board-column-title={columnTitle}
		>
			{showLine ? <BoardCardInsertionLine position="before" seam="edge" /> : null}
		</div>
	);
}


const EDGE_POSITION_CLASS_NAME: Record<BoardCardInsertion["position"], string> = {
	after: "bottom-0",
	before: "top-0",
};

/**
 * Half the gap, minus half the rule's own 2px height, so the rule's centre
 * line lands on the gap's centre line.
 *
 * `--board-card-gap` is published by the card list because the value is
 * chrome-dependent — 4px on the default well, 8px on simple — so there is no
 * single offset to hard-code here. The fallback matches the base `gap` the
 * card list declares before chrome overrides it.
 */
const GAP_CENTRED_OFFSET = "calc(var(--board-card-gap, 8px) / -2 - 1px)";

export function BoardCardInsertionLine({
	position,
	seam,
	marker = "add",
}: Readonly<{ position: BoardCardInsertion["position"]; seam: BoardCardInsertionSeam; marker?: "add" | "circle" }>) {
	const insertionAnchorId = useId().replaceAll(":", "");
	const anchorName = `--board-insertion-${insertionAnchorId}`;

	return (
		<div
			aria-hidden
			className={cn(
				"pointer-events-none absolute inset-x-0 z-30 h-0.5 bg-border-selected",
				seam === "edge" ? EDGE_POSITION_CLASS_NAME[position] : undefined,
			)}
			data-insertion-line={position}
			data-insertion-seam={seam}
			style={{
				anchorName,
				...(seam === "gap"
					? { [position === "before" ? "top" : "bottom"]: GAP_CENTRED_OFFSET }
					: undefined),
			} as CSSProperties}
		>
			{/*
			 * The "+" anchoring the rule's left end, matching the list view's
			 * `JiraListColumnBoundary` / `RowBoundaryCreateControls` treatment:
			 * a 24px outline square on the overlay surface with a subtle icon —
			 * not an accent-coloured circle, and no overlay shadow that would
			 * draw a second edge against the 1px grid border.
			 *
			 * Inert on purpose: hover paints the same affordance as a session
			 * drag, but the board does not mint a work item from a click here.
			 * The list's tooltip goes with its real create button. A focusable
			 * node inside `aria-hidden` would be an accessibility violation, so
			 * this stays a `span`.
			 *
			 * `fixed` + CSS anchors hang the marker halfway outside the card's
			 * left edge. The card list is a scrollport (`overflow-y-auto`
			 * computes `overflow-x` to `auto`), so an absolutely positioned
			 * half-outside marker would be clipped — the same reason the list
			 * column controls use `fixed`.
			 */}
			{marker === "circle" ? <span className="absolute left-0 top-1/2 size-2 -translate-y-1/2 rounded-full border-2 border-border-selected bg-surface" /> : <span
				className="fixed z-30 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-surface-overlay text-icon-subtle"
				data-board-insertion-marker={position}
				style={{
					// This node mounts in the same commit as its anchor. Until the
					// browser resolves that anchor, bare anchor() insets compute to
					// `auto` and paint the fixed node at its clipped static position.
					// Keep that unresolved frame offscreen and non-painting instead.
					left: "anchor(left, -100vw)",
					positionAnchor: anchorName,
					positionVisibility: "anchors-visible",
					top: "anchor(center, -100vh)",
				}}
			>
				{/*
				 * ADS icons ship unlayered Compiled CSS, so a Tailwind text colour
				 * utility on the wrapper loses the cascade — the colour has to be the
				 * icon's own prop.
				 */}
				<Icon render={<AddIcon color={token("color.icon.subtle")} label="" size="small" />} />
			</span>}
		</div>
	);
}
