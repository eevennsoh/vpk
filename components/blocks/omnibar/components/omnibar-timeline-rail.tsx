"use client";

import { motion } from "motion/react";

import { ScrubberRail } from "@/components/blocks/scrubber/components/scrubber-rail";
import type { ScrubberEntry } from "@/components/blocks/scrubber/lib/scrubber-entries";
import { cn } from "@/lib/utils";

import {
	OMNIBAR_RAIL_ENTER,
	OMNIBAR_RAIL_EXIT,
	resolveOmnibarTransition,
} from "../omnibar-motion";

/**
 * The card the vertical rail floats in.
 *
 * No border: overlay elevation already defines the surface, and stacking a border on
 * top of `shadow-2xl` double-outlines it (`.agents/rules/gotchas-ui.md`).
 *
 * The width is load-bearing rather than taste. A vertical mark draws its rule rightward
 * from the rail's left edge and swells to 46px, so the rail column (24px) plus the gap
 * has to clear that before the pill column starts — `gap-5` puts the pill at 44px, two
 * short of the peak, which is the closest the two can sit without a swollen major
 * reaching under a label. 184px then leaves the pill column 116px, enough for the
 * longest heading the demo timeline carries.
 *
 * The rail is deliberately *not* reversed onto the other side of the card even though
 * the card docks to the right edge: reversing it would point the swell at the screen
 * edge, where the card's own padding would clip it.
 */
const RAIL_CARD = "w-[184px] rounded-lg bg-surface-overlay p-3 shadow-2xl";

export interface OmnibarTimelineRailProps {
	activeIndex: number;
	entries: readonly ScrubberEntry[];
	onSelect: (id: string) => void;
	positioning: "container" | "viewport";
	shouldReduceMotion: boolean | null;
}

/**
 * The `timelineAxis="y"` geometry: a full-height scrubbable rail docked to the right
 * edge, running alongside a bar that keeps its editor.
 *
 * A sibling of the bottom rail rather than a child of it, for the same reason the docked
 * panel is: that rail is a bottom-anchored strip with pointer events disabled, so a
 * nested full-height card would be both mispositioned and inert.
 *
 * `data-omnibar-surface` is what keeps scrubbing from dismissing the bar — see
 * `OMNIBAR_SURFACE_SELECTOR` in `use-omnibar-state`.
 */
export function OmnibarTimelineRail({
	activeIndex,
	entries,
	onSelect,
	positioning,
	shouldReduceMotion,
}: Readonly<OmnibarTimelineRailProps>) {
	return (
		<motion.div
			animate={{ opacity: 1, x: 0 }}
			className={cn(
				"z-[510] inset-y-16 right-4",
				positioning === "container" ? "absolute" : "fixed",
				RAIL_CARD,
			)}
			data-omnibar-surface=""
			data-slot="omnibar-timeline-rail"
			exit={{
				opacity: 0,
				x: 8,
				transition: resolveOmnibarTransition(OMNIBAR_RAIL_EXIT, shouldReduceMotion),
			}}
			// Slides in from the edge it docks to, so the rail reads as having come from
			// there rather than materialising mid-screen.
			initial={{ opacity: 0, x: 8 }}
			style={{ willChange: "transform, opacity" }}
			transition={resolveOmnibarTransition(OMNIBAR_RAIL_ENTER, shouldReduceMotion)}
		>
			<ScrubberRail
				activeIndex={activeIndex}
				ariaLabel="Timeline"
				axis="y"
				className="gap-5"
				entries={entries}
				onSelect={onSelect}
			/>
		</motion.div>
	);
}
