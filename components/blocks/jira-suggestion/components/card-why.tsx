"use client";

import { useRef, type FocusEvent, type RefObject } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { WHY_CLOSE_DELAY, WHY_OPEN_DELAY } from "./constants";
import { WhyCard } from "./why-card";

/** Matches the shared PopoverContent enter/exit: opacity plus a short slide toward the deck it explains. */
const POPUP_MOTION =
	"origin-(--transform-origin) transition-[opacity,translate] duration-normal ease-out-practical data-ending-style:duration-fast data-ending-style:ease-in data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:translate-x-2 data-ending-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=right]:data-ending-style:-translate-x-2";

export interface CardWhyProps {
	suggestion: WorkItemSuggestion;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The suggestions popover: the reasoning card opens beside it so it never covers the card being judged. */
	anchor: RefObject<HTMLElement | null>;
	/** The preview's overlay layer: the card renders there so it pans and zooms with the canvas and stays inside the frame. */
	container: HTMLElement | null;
	/** "line" reads "Why · 2 sources" under the top card's value; "icon" is the list card's lightbulb. */
	appearance: "line" | "icon";
}

const TRIGGER: Readonly<Record<CardWhyProps["appearance"], string>> = {
	line: "-mx-1.5 h-6 any-pointer-coarse:min-h-8 gap-1 rounded-md px-1.5 text-xs text-text-subtlest hover:text-text-subtle focus-visible:text-text-subtle data-popup-open:text-text-subtle",
	icon: "size-7 any-pointer-coarse:size-8 justify-center rounded-full text-icon-subtlest hover:text-icon-subtle focus-visible:text-icon-subtle",
};

/**
 * The card's quiet "Why" affordance. Hover, keyboard focus or tap opens the reasoning card beside the deck.
 * Escape closes it and keeps focus on the trigger without reopening it; focus has to leave and come back first.
 */
export function CardWhy({ suggestion, open, onOpenChange, anchor, container, appearance }: Readonly<CardWhyProps>) {
	const reopenOnFocus = useRef(true);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popupRef = useRef<HTMLDivElement>(null);
	const sources = suggestion.reason.evidence.length;

	const onFocus = (event: FocusEvent<HTMLButtonElement>) => {
		if (reopenOnFocus.current && event.currentTarget.matches(":focus-visible")) onOpenChange(true);
	};
	const onBlur = (event: FocusEvent<HTMLButtonElement>) => {
		const next = event.relatedTarget as Node | null;
		if (next && popupRef.current?.contains(next)) return;
		reopenOnFocus.current = true;
	};
	const changeOpen = (next: boolean, details: PopoverPrimitive.Root.ChangeEventDetails) => {
		if (!next && details.reason === "escape-key") {
			details.event.preventDefault();
			details.event.stopPropagation();
		}
		// Closing while the trigger holds focus (Escape, or a tap outside the card) must not bounce straight back open.
		const active = document.activeElement;
		if (!next && active && (active === triggerRef.current || popupRef.current?.contains(active))) reopenOnFocus.current = false;
		onOpenChange(next);
	};

	return (
		<PopoverPrimitive.Root onOpenChange={changeOpen} open={open}>
			<PopoverPrimitive.Trigger
				aria-label={`Why ${suggestion.label.toLowerCase()} was suggested`}
				className={cn("inline-flex shrink-0 items-center outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-bg-neutral-subtle-hovered", TRIGGER[appearance])}
				closeDelay={WHY_CLOSE_DELAY}
				delay={WHY_OPEN_DELAY}
				onBlur={onBlur}
				onFocus={onFocus}
				openOnHover
				ref={triggerRef}
				type="button"
			>
				{appearance === "line" ? (
					<>
						<span className="flex text-icon-subtlest"><LightbulbIcon color="currentColor" label="" size="small" /></span>
						Why
						<span aria-hidden="true">·</span>
						<span>{sources} {sources === 1 ? "source" : "sources"}</span>
					</>
				) : <LightbulbIcon color="currentColor" label="" size="small" />}
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal container={container ?? undefined}>
				<PopoverPrimitive.Positioner
					align="start"
					anchor={anchor}
					className={cn("pointer-events-auto isolate", container ? "z-40" : "z-[700]")}
					collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "end" }}
					collisionBoundary={container ?? "clipping-ancestors"}
					collisionPadding={8}
					side="left"
					sideOffset={8}
				>
					<PopoverPrimitive.Popup
						className={`flex max-h-(--available-height) w-72 max-w-(--available-width) flex-col overflow-hidden rounded-xl bg-surface-overlay text-sm text-text outline-hidden ${POPUP_MOTION}`}
						finalFocus={(closeType) => (closeType === "keyboard" ? triggerRef.current : false)}
						initialFocus={false}
						ref={popupRef}
						style={{ boxShadow: token("elevation.shadow.overlay") }}
					>
						<WhyCard suggestion={suggestion} />
					</PopoverPrimitive.Popup>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}
