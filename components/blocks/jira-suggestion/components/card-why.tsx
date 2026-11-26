"use client";

import { useRef, type FocusEvent, type RefObject } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { WHY_CLOSE_DELAY, WHY_OPEN_DELAY } from "./constants";
import { WhyCard } from "./why-card";

/** Matches the shared PopoverContent enter/exit: opacity plus a short slide toward what it explains. */
const POPUP_MOTION =
	"origin-(--transform-origin) transition-[opacity,translate] duration-normal ease-out-practical data-ending-style:duration-fast data-ending-style:ease-in data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:translate-x-2 data-ending-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=right]:data-ending-style:-translate-x-2 data-[side=bottom]:data-starting-style:translate-x-0 data-[side=bottom]:data-ending-style:translate-x-0 data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=bottom]:data-ending-style:-translate-y-2";

export interface CardWhyProps {
	suggestion: WorkItemSuggestion;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The suggestions popover: the reasoning card opens beside it so it never covers the card being judged. */
	anchor: RefObject<HTMLElement | null>;
	/** The preview's overlay layer: the card renders there so it pans and zooms with the canvas and stays inside the frame. */
	container: HTMLElement | null;
	/** "line" reads "Why · 2 sources" under the top card's value; "icon" is the list card's lightbulb; "toolbar" is the
	 * inline suggestion toolbar's 24px square lightbulb. */
	appearance: "line" | "icon" | "toolbar";
	/** Which side of the anchor the reasoning opens on: beside the deck by default, under a toolbar. */
	side?: "left" | "bottom";
}

const TRIGGER: Readonly<Record<CardWhyProps["appearance"], string>> = {
	line: "-mx-1.5 h-6 any-pointer-coarse:min-h-8 gap-1 rounded-md px-1.5 text-xs text-text-subtlest hover:text-text-subtle focus-visible:text-text-subtle data-popup-open:text-text-subtle",
	icon: "size-7 any-pointer-coarse:size-8 justify-center rounded-full text-icon-subtlest hover:text-icon-subtle focus-visible:text-icon-subtle",
	toolbar: "size-6 any-pointer-coarse:size-8 justify-center rounded-md text-icon-subtle data-popup-open:bg-bg-selected data-popup-open:text-icon-selected data-popup-open:hover:bg-bg-selected-hovered",
};

/**
 * The card's quiet "Why" affordance. Hover, keyboard focus or tap opens the reasoning card beside the deck.
 * Escape closes it and keeps focus on the trigger without reopening it; focus has to leave and come back first.
 */
export function CardWhy({ suggestion, open, onOpenChange, anchor, container, appearance, side = "left" }: Readonly<CardWhyProps>) {
	// The toolbar sits on the field it explains: its lightbulb opens on a click and shows as selected, while hover only
	// names it with a tooltip. The deck's triggers open on hover or keyboard focus.
	const clickOnly = appearance === "toolbar";
	const reopenOnFocus = useRef(true);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popupRef = useRef<HTMLDivElement>(null);
	const sources = suggestion.reason.evidence.length;

	const onFocus = (event: FocusEvent<HTMLButtonElement>) => {
		if (!clickOnly && reopenOnFocus.current && event.currentTarget.matches(":focus-visible")) onOpenChange(true);
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

	const trigger = (
			<PopoverPrimitive.Trigger
				aria-label={`Why ${suggestion.label.toLowerCase()} was suggested`}
				className={cn("inline-flex shrink-0 items-center outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-bg-neutral-subtle-hovered", TRIGGER[appearance])}
				closeDelay={WHY_CLOSE_DELAY}
				delay={WHY_OPEN_DELAY}
				onBlur={onBlur}
				onFocus={onFocus}
				openOnHover={!clickOnly}
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
	);

	return (
		<PopoverPrimitive.Root onOpenChange={changeOpen} open={open}>
			{clickOnly ? (
				<Tooltip>
					<TooltipTrigger render={trigger} />
					{/* Above the toolbar's popover layer (z-650), or the tip renders behind the toolbar it labels. */}
					<TooltipContent positionerClassName="z-[700]">{open ? "Hide" : "Why this was suggested"}</TooltipContent>
				</Tooltip>
			) : trigger}
			<PopoverPrimitive.Portal container={container ?? undefined}>
				<PopoverPrimitive.Positioner
					align={side === "bottom" ? "end" : "start"}
					anchor={anchor}
					className={cn("pointer-events-auto isolate", container ? "z-40" : "z-[700]")}
					collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "end" }}
					collisionBoundary={container ?? "clipping-ancestors"}
					collisionPadding={8}
					side={side}
					sideOffset={side === "bottom" ? 4 : 8}
				>
					<PopoverPrimitive.Popup
						className={`flex max-h-(--available-height) w-72 max-w-(--available-width) flex-col overflow-hidden rounded-xl bg-surface-overlay text-sm text-text outline-hidden ${POPUP_MOTION}`}
						finalFocus={(closeType) => (closeType === "keyboard" ? triggerRef.current : false)}
						initialFocus={false}
						ref={popupRef}
						style={{ boxShadow: token("elevation.shadow.overlay") }}
					>
						<WhyCard compactSources={clickOnly} showField={!clickOnly} suggestion={suggestion} />
					</PopoverPrimitive.Popup>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}
