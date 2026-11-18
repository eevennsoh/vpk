"use client";

import { useId, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import AddIcon from "@atlaskit/icon/core/add";

import { Button } from "@/components/ui/button";
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
	onCreate,
	onControlLeave,
	createLabel,
}: Readonly<{
	position: BoardCardInsertion["position"];
	seam: BoardCardInsertionSeam;
	marker?: "add" | "circle" | "none";
	onCreate?: (trigger: HTMLElement, returnFocus: HTMLElement | null) => void;
	onControlLeave?: (next: EventTarget | null) => void;
	createLabel?: string;
}>) {
	const insertionAnchorId = useId().replaceAll(":", "");
	const anchorName = `--board-insertion-${insertionAnchorId}`;
	const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
	const overlayHost = anchor?.closest("[data-jira-auto-arrange-scope]") ?? anchor?.ownerDocument.body;

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
			{/* Keep the rule and marker outside the viewport mask. */}
			{marker === "add" && overlayHost ? createPortal(<div
				aria-hidden={onCreate ? undefined : true}
				className="pointer-events-none fixed z-20 h-0.5 rounded-full bg-border-selected"
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
				{onCreate ? <Button
					aria-label={createLabel}
					className="pointer-events-auto absolute left-0 top-1/2 isolate size-5 -translate-x-1/2 -translate-y-1/2 border-border bg-surface-overlay text-icon-subtle before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-full hover:bg-surface-overlay hover:before:bg-bg-neutral-subtle-hovered active:bg-surface-overlay active:before:bg-bg-neutral-subtle-pressed [&_[data-slot=icon]]:relative [&_[data-slot=icon]]:z-10"
					data-board-gap-create=""
					data-board-insertion-marker={position}
					onClick={(event) => {
						const card = anchor?.closest('[data-board-agent-session-drop-zone="issue"]');
						onCreate(event.currentTarget, card?.querySelector<HTMLElement>("button") ?? null);
					}}
					onPointerLeave={(event) => onControlLeave?.(event.relatedTarget)}
					onBlur={(event) => onControlLeave?.(event.relatedTarget)}
					shape="circle"
					size="icon-compact"
					type="button"
					variant="outline"
				><Icon render={<AddIcon color={token("color.icon.subtle")} label="" size="small" />} /></Button> : <span
					className="absolute left-0 top-1/2 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-overlay text-icon-subtle"
					data-board-insertion-marker={position}
				>
					<Icon render={<AddIcon color={token("color.icon.subtle")} label="" size="small" />} />
				</span>}
			</div>, overlayHost) : null}
		</div>
	);
}
