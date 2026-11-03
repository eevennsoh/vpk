"use client";

import { useRef, useState, type FocusEvent, type KeyboardEvent, type RefObject } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import type { SuggestionEvidence, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { motionDuration } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { EvidenceMark } from "./evidence";
import { WhyBody } from "./why-body";

/** Hover intent: a deliberate rest opens the card, and a short grace lets the pointer cross the gap into it. */
const HOVER_OPEN_DELAY_MS = motionDuration.slow * 1000;
const HOVER_CLOSE_DELAY_MS = motionDuration.normal * 1000;

/** Shared popup enter/exit: opacity plus a short slide out of the card it explains (it opens to the left). */
const POPUP_MOTION =
	"origin-(--transform-origin) transition-[opacity,translate] duration-normal ease-out-practical data-ending-style:duration-fast data-ending-style:ease-in data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:translate-x-2 data-ending-style:translate-x-2";

/** Marks the why card so the popped card's outside-click tuck ignores presses inside it. */
export const WHY_POPUP_ATTR = "data-peek-why";

export interface CardReasonProps {
	suggestion: WorkItemSuggestion;
	/** "card": headline plus source chips (the popped card). "row": the headline alone, one quiet line (the list). */
	layout: "card" | "row";
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The surface the why card opens beside: always to its left, over the main column, never over the rail. */
	anchor: RefObject<HTMLElement | null>;
	maxHeight?: number;
}

function SourceChip({ evidence, onPoint }: Readonly<{ evidence: SuggestionEvidence; onPoint: (id: string) => void }>) {
	return (
		<span
			className="inline-flex max-w-full items-start gap-1.5 rounded-md bg-bg-neutral px-1.5 py-[3px] text-xs leading-4 text-pretty text-text-subtle transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-hovered hover:text-text"
			onPointerEnter={() => onPoint(evidence.id)}
		>
			<span className="flex h-4 shrink-0 items-center"><EvidenceMark decorative kind={evidence.kind} /></span>
			<span className="min-w-0">{evidence.title}</span>
			{evidence.duration ? <span className="shrink-0 text-text-subtlest tabular-nums">{evidence.duration}</span> : null}
		</span>
	);
}

/**
 * The reason on a card, and the one way into the full reasoning. The whole reason block is a single trigger: hover,
 * keyboard focus or tap opens the why card beside the surface. Hovering a source chip spotlights that source inside it.
 */
export function CardReason({ suggestion, layout, open, onOpenChange, anchor, maxHeight }: Readonly<CardReasonProps>) {
	const { reason } = suggestion;
	const popupRef = useRef<HTMLDivElement>(null);
	const previewRef = useRef(false);
	const [pointedId, setPointedId] = useState<string | null>(null);

	const onFocus = (event: FocusEvent<HTMLButtonElement>) => {
		// A pointer press also focuses the trigger; only keyboard focus previews the card.
		if (open || !event.currentTarget.matches(":focus-visible")) return;
		previewRef.current = true;
		setPointedId(null);
		onOpenChange(true);
	};
	const onBlur = (event: FocusEvent<HTMLButtonElement>) => {
		if (!previewRef.current) return;
		if (event.relatedTarget instanceof Node && popupRef.current?.contains(event.relatedTarget)) return;
		previewRef.current = false;
		onOpenChange(false);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		// Enter or Space on a previewed card steps into it, so its sources are one Tab away.
		if (!previewRef.current || !open || (event.key !== "Enter" && event.key !== " ")) return;
		event.preventDefault();
		previewRef.current = false;
		popupRef.current?.focus();
	};

	return (
		<PopoverPrimitive.Root
			onOpenChange={(next) => {
				if (!next) {
					previewRef.current = false;
					setPointedId(null);
				}
				onOpenChange(next);
			}}
			open={open}
		>
			<PopoverPrimitive.Trigger
				aria-label={`Why ${suggestion.label}: ${reason.headline}`}
				className={cn(
					"group/why -mx-1 flex flex-col items-start gap-2 rounded-md px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
					layout === "row" ? "-my-0.5" : null,
				)}
				closeDelay={HOVER_CLOSE_DELAY_MS}
				delay={HOVER_OPEN_DELAY_MS}
				onBlur={onBlur}
				onFocus={onFocus}
				onKeyDown={onKeyDown}
				openOnHover
				type="button"
			>
				{/* A dotted underline at rest says the reason opens something; hover and open firm it up. */}
				<span
					className={cn(
						"text-xs leading-[18px] text-pretty underline decoration-dotted underline-offset-[3px] transition-colors duration-xxshort ease-out-practical",
						"group-hover/why:text-text group-hover/why:decoration-icon-subtle group-data-popup-open/why:text-text group-data-popup-open/why:decoration-icon-subtle",
						layout === "card" ? "text-text-subtle decoration-border-bold" : "text-text-subtlest decoration-border",
					)}
				>
					{reason.headline}
					{layout === "row" ? (
						<span aria-hidden="true" className="ml-0.5 inline-flex translate-y-[3px] text-icon-subtlest group-hover/why:text-icon-subtle">
							<ChevronRightIcon color="currentColor" label="" size="small" />
						</span>
					) : null}
				</span>
				{layout === "card" ? (
					<span className="flex flex-wrap items-center gap-1">
						{reason.evidence.map((evidence) => <SourceChip evidence={evidence} key={evidence.id} onPoint={setPointedId} />)}
						<span aria-hidden="true" className="inline-flex h-[22px] items-center gap-0.5 pr-0.5 pl-1 text-xs text-text-subtlest transition-colors duration-xxshort ease-out-practical group-hover/why:text-text-subtle group-data-popup-open/why:text-text-subtle">
							Why
							<ChevronRightIcon color="currentColor" label="" size="small" />
						</span>
					</span>
				) : null}
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner
					align="start"
					anchor={anchor}
					className="isolate z-[200]"
					collisionAvoidance={{ side: "none", align: "shift" }}
					collisionPadding={8}
					side="left"
					// A row sits 8px inside the list, so its card clears the list edge by the same 10px as a popped card's.
					sideOffset={layout === "row" ? 18 : 10}
				>
					<PopoverPrimitive.Popup
						{...{ [WHY_POPUP_ATTR]: "" }}
						className={`flex max-h-(--available-height) w-[280px] flex-col overflow-hidden rounded-xl bg-surface-overlay text-sm text-text outline-hidden ${POPUP_MOTION}`}
						initialFocus={() => (previewRef.current ? false : popupRef.current)}
						ref={popupRef}
						style={{ boxShadow: token("elevation.shadow.overlay"), maxHeight }}
						tabIndex={-1}
					>
						<WhyBody pointedId={pointedId} suggestion={suggestion} />
					</PopoverPrimitive.Popup>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}
