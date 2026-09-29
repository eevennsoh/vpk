"use client";

import { useId, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import AddIcon from "@atlaskit/icon/core/add";

import { Icon } from "@/components/ui/icon";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import type { BoardCardInsertion } from "../lib/board-agent-session-drag";
import type { BoardCardInsertionSeam } from "../lib/board-card-insertion";

/**
 * The drop geometry of a column that holds no cards.
 *
 * Card seams normally ride the per-card wrappers, so a column emptied by the
 * assignee filter — or one that simply has nothing in it — would emit no gap at
 * all and swallow the drop. This stand-in fills the card list and publishes
 * its single drop gap. Empty columns leave visible drag feedback to the
 * column dropzone instead of drawing an inline insertion control.
 */
export function BoardEmptyColumnInsertionSlot({
	columnTitle,
}: Readonly<{ columnTitle: string }>) {
	return (
		<div
			className="relative min-h-8 flex-1"
			data-board-agent-session-drop-zone="card-gap"
			data-board-column-title={columnTitle}
		/>
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
}: Readonly<{ position: BoardCardInsertion["position"]; seam: BoardCardInsertionSeam; marker?: "add" | "circle" | "none" }>) {
	const insertionAnchorId = useId().replaceAll(":", "");
	const anchorName = `--board-insertion-${insertionAnchorId}`;
	const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);

	return (
		<div
			aria-hidden
			ref={setAnchor}
			className={cn(
				"pointer-events-none absolute inset-x-0 z-30 h-0.5 rounded-full",
				marker === "none" ? "bg-border-selected" : null,
				// Start at the ring's rim so its transparent center shows the well below.
				marker === "circle" ? "before:absolute before:inset-y-0 before:left-1 before:right-0 before:rounded-full before:bg-border-selected" : null,
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
			{marker === "circle" ? <span className="absolute left-0 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-border-selected" /> : null}
			{/* Keep the rule and its inert + marker outside the viewport mask.
			    Hovering a seam must not reveal every faded card in the column. */}
			{marker === "add" && anchor ? createPortal(<div
				aria-hidden
				className="pointer-events-none fixed z-30 h-0.5 rounded-full bg-border-selected"
				data-board-insertion-overlay={position}
				style={{
					// Unresolved or fully clipped anchors must not paint a stray rule.
					left: "anchor(left, -100vw)",
					positionAnchor: anchorName,
					positionVisibility: "anchors-visible",
					top: "anchor(top, -100vh)",
					width: "anchor-size(width, 0px)",
				}}
			>
				<span
					className="absolute left-0 top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-surface-overlay text-icon-subtle"
					data-board-insertion-marker={position}
				>
					<Icon render={<AddIcon color={token("color.icon.subtle")} label="" size="small" />} />
				</span>
			</div>, anchor.ownerDocument.body) : null}
		</div>
	);
}
