"use client";

import type { MouseEvent, RefObject } from "react";
import type { MotionValue } from "motion/react";

import { ScrubberRule } from "@/components/blocks/scrubber/components/scrubber-rule";
import {
	toScrubberMarkLabel,
	type ScrubberEntry,
} from "@/components/blocks/scrubber/lib/scrubber-entries";
import { RULE_WEIGHT, type ScrubberMarkState } from "@/components/blocks/scrubber/lib/scrubber-geometry";
import { cn } from "@/lib/utils";

export interface ScrubberMarkProps {
	axis: "x" | "y";
	entry: ScrubberEntry;
	isActive: boolean;
	showActiveIndicator?: boolean;
	magnify: MotionValue<number>;
	markRef: (node: HTMLButtonElement | null) => void;
	onFocusChange: (id: string | null) => void;
	onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
	pointerOffset: MotionValue<number>;
	railSizeRef: RefObject<number>;
	state: ScrubberMarkState;
	/** The one mark Tab reaches — see `ScrubberRail`. */
	tabbable: boolean;
	appearance?: "notches" | "dots";
}

/** One selectable mark: a major or one of the minors inside its gap. */
export function ScrubberMark({
	axis,
	entry,
	isActive,
	showActiveIndicator = true,
	magnify,
	markRef,
	onFocusChange,
	onSelect,
	pointerOffset,
	railSizeRef,
	state,
	tabbable,
	appearance = "notches",
}: Readonly<ScrubberMarkProps>) {
	return (
		<button
			ref={markRef}
			type="button"
			role="option"
			aria-selected={isActive}
			tabIndex={tabbable ? 0 : -1}
			onBlur={() => onFocusChange(null)}
			onClick={onSelect}
			onFocus={() => onFocusChange(entry.id)}
			// Position comes straight off the entry — nothing re-derives geometry
			// or reads a clock between the model and the pixel.
			style={axis === "y" ? { top: `${entry.offset * 100}%` } : { left: `${entry.offset * 100}%` }}
			// The active pill paints after the marks, so a focused mark has to be
			// lifted above it or its ring is half-covered.
			className={cn(
				"group/mark focus-visible:ring-ring absolute flex rounded-xs outline-none focus-visible:z-10 focus-visible:ring-2",
				appearance === "dots" ? "left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center" : axis === "y"
					? "left-0 h-5 w-full -translate-y-1/2 items-center"
					: "bottom-0 h-6 w-6 -translate-x-1/2 flex-col justify-end",
			)}
		>
			<span className="sr-only">{toScrubberMarkLabel(entry)}</span>
			{appearance === "dots" ? <><span aria-hidden className="absolute size-5 rounded-full bg-bg-neutral opacity-0 group-hover/mark:opacity-100 group-focus-visible/mark:opacity-100" /><span aria-hidden className={cn("relative size-1.5 rounded-full bg-current", isActive && showActiveIndicator ? "opacity-100" : "opacity-0")} /></> : <ScrubberRule
				axis={axis}
				// The button is the hit target; the rule overflows it at full swell
				// and must not stretch the target into whatever sits beside the rail.
				// `bg-current` rather than a fixed colour: the rail root owns the tone,
				// so an inverse host repaints every rule by changing one class.
				className={cn(
					"pointer-events-none absolute bg-current",
					axis === "y" ? "left-0 h-px" : "bottom-0 left-1/2 w-px -translate-x-1/2",
				)}
				magnify={magnify}
				offset={entry.offset}
				pointerOffset={pointerOffset}
				railSizeRef={railSizeRef}
				weight={RULE_WEIGHT[entry.kind][state]}
			/>}
		</button>
	);
}
