"use client";

import { useRef, useState, type RefObject } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { token } from "@/lib/tokens";

import type { ViewportRect } from "./use-overlay-placement";
import { WhyCardBody } from "./why-card-body";

/** How the card opened: keyboard focus previews it in place, anything else lets the reader step in. */
type OpenMode = "focus" | "press";

/** Same overlay surface as the panel: ADS overlay elevation, no border, fade plus a short slide away from the panel. */
const CARD_CLASS = "flex max-h-(--available-height) w-86 origin-(--transform-origin) flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground outline-hidden transition-[opacity,translate] duration-normal ease-out-practical motion-reduce:transition-none data-ending-style:duration-fast data-ending-style:ease-in data-starting-style:-translate-x-2 data-starting-style:opacity-0 data-ending-style:-translate-x-2 data-ending-style:opacity-0";

/** The previous or next keyboard stop inside the panel, relative to `from`. Skips Base UI's invisible focus guards. */
function adjacentControl(panel: Element | null, from: HTMLElement, step: 1 | -1): HTMLElement | null {
	if (!panel) return null;
	const stops = [...panel.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])")]
		.filter((stop) => !stop.hasAttribute("data-base-ui-focus-guard"));
	return stops[stops.indexOf(from) + step] ?? null;
}

/**
 * The card's lane: from just below the trigger (the rail card's top edge) down to the panel's bottom edge.
 * The card never grows past the panel it explains, and never covers the count you are changing.
 */
function capToPanel(frame: ViewportRect | undefined, panel: DOMRect | undefined): ViewportRect | undefined {
	if (!frame || !panel) return frame;
	const top = Math.max(frame.y, panel.top);
	const bottom = Math.min(frame.y + frame.height, panel.bottom);
	return { x: frame.x, y: top, width: frame.width, height: Math.max(0, bottom - top) };
}

/**
 * One deterministic rule for where the card's top edge lands: level with its row when the whole card fits in the
 * lane from there, otherwise pinned to the lane's top line, so it covers the rail cleanly from its top edge
 * instead of slicing through a line of text at whatever height a shift happened to leave it.
 */
function cardTop(lane: ViewportRect, rowTop: number, cardHeight: number): number {
	const fits = rowTop >= lane.y && rowTop + cardHeight <= lane.y + lane.height;
	return fits ? rowTop : lane.y;
}

export interface WhyPopoverProps {
	suggestion: WorkItemSuggestion;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The row that asked; the card top-aligns with it. */
	rowRef: RefObject<HTMLElement | null>;
	/** The popover surface; the card sits just past its edge rather than over its content. */
	panelRef: RefObject<HTMLElement | null>;
	/** The region the card must stay inside: the preview frame, below the trigger. */
	getBoundary: () => ViewportRect | undefined;
}

/**
 * The quiet "Why" affordance and its card. Opens on hover, tap, Enter, or keyboard focus. Focus opens
 * preview in place; Enter then moves into the card, landing on the card itself rather than a control inside it.
 */
export function WhyPopover({ suggestion, open, onOpenChange, rowRef, panelRef, getBoundary }: Readonly<WhyPopoverProps>) {
	const mode = useRef<OpenMode>("press");
	const skipNextFocus = useRef(false);
	const cardRef = useRef<HTMLDivElement>(null);
	const [boundary, setBoundary] = useState<ViewportRect | undefined>(undefined);

	const show = (next: OpenMode) => {
		mode.current = next;
		setBoundary(capToPanel(getBoundary(), panelRef.current?.getBoundingClientRect()));
		onOpenChange(true);
	};

	const handleOpenChange = (next: boolean, details: PopoverPrimitive.Root.ChangeEventDetails) => {
		if (next) {
			show("press");
			return;
		}
		if (details.reason === "trigger-press" && mode.current === "focus") {
			mode.current = "press";
			cardRef.current?.focus();
			return;
		}
		// Focus returns to Why after Escape; that return must not reopen the card.
		if (details.reason === "escape-key") skipNextFocus.current = true;
		onOpenChange(false);
	};

	// The card hangs off the panel's edge, at its row's height when it fits there, otherwise at the lane's top line.
	const anchor = () => ({
		getBoundingClientRect: () => {
			const panelRect = panelRef.current?.getBoundingClientRect();
			const row = rowRef.current?.getBoundingClientRect();
			if (!panelRect || !row) return new DOMRect();
			const lane = capToPanel(getBoundary(), panelRect);
			// The card's natural height is its scroller's full content, whatever cap it currently wears.
			const natural = cardRef.current?.querySelector("[data-why-scroll]")?.scrollHeight ?? Number.POSITIVE_INFINITY;
			const top = lane ? cardTop(lane, row.top, natural) : row.top;
			return new DOMRect(panelRect.left, top, panelRect.width, 0);
		},
		contextElement: rowRef.current ?? undefined,
	});

	return (
		<PopoverPrimitive.Root onOpenChange={handleOpenChange} open={open}>
			<PopoverPrimitive.Trigger
				aria-label={`Why ${suggestion.label} was suggested`}
				className="inline-flex h-6 shrink-0 items-center rounded-md px-1.5 text-xs text-text-subtlest outline-none transition-colors duration-xxshort ease-out-practical group-hover/row:text-text-subtle hover:bg-bg-neutral-subtle-hovered hover:text-text focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-bg-neutral-subtle-hovered data-popup-open:text-text"
				onBlur={(event) => {
					if (!open || mode.current !== "focus") return;
					const next = event.relatedTarget;
					if (next instanceof Node && cardRef.current?.contains(next)) return;
					onOpenChange(false);
				}}
				onKeyDown={(event) => {
					// A focus preview is a glance, not a stop: Tab carries on through the row, past the card.
					if (event.key !== "Tab" || !open || mode.current !== "focus") return;
					const next = adjacentControl(event.currentTarget.closest("[role=dialog]"), event.currentTarget, event.shiftKey ? -1 : 1);
					if (!next) return;
					event.preventDefault();
					onOpenChange(false);
					next.focus();
				}}
				onFocus={(event) => {
					if (skipNextFocus.current) {
						skipNextFocus.current = false;
						return;
					}
					if (!open && event.currentTarget.matches(":focus-visible")) show("focus");
				}}
				openOnHover
				type="button"
			>
				Why
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner
					align="start"
					anchor={anchor}
					className="isolate z-200"
					collisionAvoidance={{ side: "none", align: "none", fallbackAxisSide: "none" }}
					collisionBoundary={boundary ?? "clipping-ancestors"}
					collisionPadding={{ top: 0, right: 16, bottom: 0, left: 16 }}
					data-run-timeline-layer=""
					side="right"
					sideOffset={8}
				>
					<PopoverPrimitive.Popup
						aria-label={`Why ${suggestion.label} was suggested`}
						className={CARD_CLASS}
						finalFocus={() => mode.current === "press"}
						initialFocus={() => (mode.current === "focus" ? false : cardRef.current)}
						ref={cardRef}
						style={{ boxShadow: token("elevation.shadow.overlay") }}
						tabIndex={-1}
					>
						<WhyCardBody suggestion={suggestion} />
					</PopoverPrimitive.Popup>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}
