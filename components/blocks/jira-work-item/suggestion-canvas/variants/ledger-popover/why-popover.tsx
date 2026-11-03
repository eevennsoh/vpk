"use client";

import { useRef, type FocusEvent, type KeyboardEvent, type RefObject } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { motionDuration } from "@/lib/motion";
import { token } from "@/lib/tokens";

import { WHY_CARD_ATTRIBUTE } from "./use-ledger-panel";
import { WhyCardBody } from "./why-card";

/** The panel's 6px body inset plus an 8px gap past the panel edge. */
const SIDE_OFFSET = 14;

/** Hover intent: a deliberate rest opens the card, and a short grace lets the pointer cross the gap into it. */
const HOVER_OPEN_DELAY_MS = motionDuration.slow * 1000;
const HOVER_CLOSE_DELAY_MS = motionDuration.normal * 1000;

/** Matches the shared PopoverContent enter/exit: opacity plus a short slide from the row. */
const POPUP_MOTION =
	"origin-(--transform-origin) transition-[opacity,translate] duration-normal ease-out-practical data-ending-style:duration-fast data-ending-style:ease-in data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:-translate-x-2 data-ending-style:-translate-x-2";

export interface WhyPopoverProps {
	suggestion: WorkItemSuggestion;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The row this card explains: the card opens level with it, past the panel's right edge. */
	row: RefObject<HTMLElement | null>;
	/** The free area of the preview below the trigger banner. The card shifts to stay inside it. */
	boundary: Element | null;
}

/** Real tab stops only: the card's portal focus guards (aria-hidden spans beside the trigger) would bounce focus into it. */
const TAB_STOPS = ":is(button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])):not([aria-hidden='true'], [data-base-ui-focus-guard])";

/** The previous or next tab stop inside the ledger panel. */
function siblingTabStop(from: HTMLElement, step: 1 | -1): HTMLElement | null {
	const scope = from.closest("[role='dialog']");
	if (!scope) return null;
	const stops = [...scope.querySelectorAll<HTMLElement>(TAB_STOPS)];
	return stops[stops.indexOf(from) + step] ?? null;
}

/**
 * A row's "Why" link and its reasoning card. Hover, keyboard focus or tap opens it.
 * Keyboard focus previews the card in place; Enter steps onto the card itself, so Tab then walks sources and feedback in order.
 */
export function WhyPopover({ suggestion, open, onOpenChange, row, boundary }: Readonly<WhyPopoverProps>) {
	const popupRef = useRef<HTMLDivElement>(null);
	/** The card opened as a keyboard-focus preview: focus stays on "Why" until Enter steps into the card. */
	const previewRef = useRef(false);
	/** Focus is on the card, so closing it (Escape, toggle) hands focus back to "Why" instead of dropping it to the page. */
	const focusInsideRef = useRef(false);
	/** Opened or confirmed by a click: hover-out no longer closes it. */
	const pinnedRef = useRef(false);
	/** Focus is coming back from the card: that return must not reopen it as a preview. */
	const returningRef = useRef(false);

	const onFocus = (event: FocusEvent<HTMLButtonElement>) => {
		// A pointer press also focuses the trigger; only keyboard focus (focus-visible) previews the card.
		const returning = returningRef.current;
		returningRef.current = false;
		if (returning || open || !event.currentTarget.matches(":focus-visible")) return;
		previewRef.current = true;
		onOpenChange(true);
	};
	const onBlur = (event: FocusEvent<HTMLButtonElement>) => {
		if (!previewRef.current) return;
		if (event.relatedTarget instanceof Node && popupRef.current?.contains(event.relatedTarget)) return;
		previewRef.current = false;
		onOpenChange(false);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		// Base UI merges this handler with its own and may hand it a re-targeted event, so locate the trigger via target.
		if (!previewRef.current || !open) return;
		if (event.key === "Tab") {
			// Tab walks on through the ledger as if no card were open: the preview closes without pulling focus back.
			const next = event.target instanceof HTMLElement ? siblingTabStop(event.target, event.shiftKey ? -1 : 1) : null;
			if (!next) return;
			event.preventDefault();
			previewRef.current = false;
			onOpenChange(false);
			next.focus();
			// The card's focus guards unmount as it closes and can drop focus to the page; land it again once they have.
			requestAnimationFrame(() => {
				if (document.activeElement !== next) next.focus();
			});
			return;
		}
		// Enter or Space on a previewed card steps into it, so its sources are one Tab away; on an open card it toggles closed.
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		previewRef.current = false;
		popupRef.current?.focus();
	};

	return (
		<PopoverPrimitive.Root
			onOpenChange={(next, details) => {
				if (next) {
					pinnedRef.current = details.reason === "trigger-press";
				} else if (details.reason === "trigger-press" && !pinnedRef.current) {
					// A click on a card that hover opened pins it and steps onto it, rather than toggling it shut.
					pinnedRef.current = true;
					previewRef.current = false;
					popupRef.current?.focus();
					return;
				} else if (details.reason === "trigger-hover" && pinnedRef.current) {
					// A pinned card stays put when the pointer wanders off; Escape, a click outside or "Why" again closes it.
					return;
				}
				if (!next) {
					previewRef.current = false;
					pinnedRef.current = false;
				}
				onOpenChange(next);
			}}
			open={open}
		>
			<PopoverPrimitive.Trigger
				aria-label={`Why ${suggestion.label} was suggested`}
				className="inline-flex h-6 shrink-0 items-center rounded-md px-1.5 text-xs text-text-subtlest underline decoration-transparent decoration-dotted underline-offset-[3px] outline-none transition-colors duration-xxshort ease-out-practical group-hover/row:decoration-border-bold hover:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-bg-neutral-subtle-hovered data-popup-open:text-text data-popup-open:decoration-transparent"
				closeDelay={HOVER_CLOSE_DELAY_MS}
				delay={HOVER_OPEN_DELAY_MS}
				onBlur={onBlur}
				onFocus={onFocus}
				onKeyDown={onKeyDown}
				openOnHover
				type="button"
			>
				Why
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner
					align="start"
					alignOffset={-4}
					anchor={row}
					className="isolate z-[200]"
					collisionAvoidance={{ side: "none", align: "shift" }}
					collisionBoundary={boundary ?? "clipping-ancestors"}
					collisionPadding={0}
					side="right"
					sideOffset={SIDE_OFFSET}
				>
					<PopoverPrimitive.Popup
						{...{ [WHY_CARD_ATTRIBUTE]: "" }}
						className={`flex max-h-(--available-height) w-[344px] flex-col overflow-hidden rounded-xl bg-surface-overlay text-sm text-text outline-hidden ${POPUP_MOTION}`}
						// A focus preview leaves focus on "Why"; a click, tap or Enter moves it onto the card.
						initialFocus={() => (previewRef.current ? false : popupRef.current)}
						// Focus returns to "Why" only when it was inside the card; a preview closing never moves it.
						finalFocus={() => {
							returningRef.current = focusInsideRef.current;
							return focusInsideRef.current;
						}}
						onBlur={(event) => {
							focusInsideRef.current = event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget);
						}}
						onFocus={() => {
							focusInsideRef.current = true;
						}}
						ref={popupRef}
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
