"use client";

import { SCROLLING_ITEMS, SCROLLING_VIEWPORT_PX } from "./data";
import { ScrollingViewport } from "@/components/visual/scrolling/scrolling-viewport";
import type { ScrollingProps } from "./scrolling-viewport";
import { ScrollingEntranceProvider } from "./use-scrolling-entrance";

export type {
	ScrollingDepth,
	ScrollingEntranceOrigin,
	ScrollingStackOrder,
} from "./stack-layout";
export type { ScrollingProps } from "./scrolling-viewport";

/**
 * Vertical, infinitely looping, drag-with-inertia scroller of agent-session
 * cards that unfurls once from a perfectly stacked deck.
 *
 * Scroll engine is motion-plus' `Ticker`. `drag="y"` plus `_dragY` set to the
 * ticker's own offset makes Ticker install its own pointer-down and drag-end
 * handlers — that drag-end IS the momentum throw, so `onDragEnd`,
 * `onPointerDown` and `dragMomentum` must never be passed to it. The one
 * deliberate exception is reduced motion; `use-scrolling-drag.ts` owns every
 * drag prop the viewport passes and explains both branches.
 *
 * ## Engaging the list
 *
 * Wheel, trackpad and touch scrolling all go to the PAGE until the list is
 * engaged with a click, a tap, or keyboard focus; Escape, a press outside, or
 * moving the pointer away hands scrolling back. Drag with a mouse always works.
 * The engagement model exists because the list loops forever and therefore
 * never scroll-chains back to the page at an end — see
 * `use-scrolling-gestures.ts`. On coarse pointers the first swipe is always the
 * page's (the browser latches `touch-action` when a gesture starts, so
 * engagement can only affect the next one), which is what the "Tap, then drag"
 * hint in `scrolling-viewport.tsx` signposts.
 *
 * ## Known limitation: keyboard focus above `viewportHeight` 540
 *
 * From 540px up Ticker starts cloning items to fill the scrollport, and its
 * items only ever reproject FORWARD. That leaves a hole in the set of positions
 * the FIRST item can reach, and between roughly 540 and 710 the unmasked band
 * falls inside it — the visible slot is held by an inert clone. Tabbing to the
 * first card's actions therefore parks them flush against an edge, visible but
 * inside the 72px fade, instead of fully clear. Every other stop lands in the
 * band. `use-scrolling-focus.ts` documents why `safeMargin` does not cure this;
 * a scrollport under 540 avoids it entirely.
 */
export function Scrolling({
	className = "",
	depth = "bottom",
	entranceOrigin = "bottom",
	items = SCROLLING_ITEMS,
	stackOrder = "first-on-top",
	viewportHeight = SCROLLING_VIEWPORT_PX,
	wheel = true,
}: Readonly<ScrollingProps>) {
	return (
		<ScrollingEntranceProvider>
			<ScrollingViewport
				className={className}
				depth={depth}
				entranceOrigin={entranceOrigin}
				items={items}
				stackOrder={stackOrder}
				viewportHeight={viewportHeight}
				wheel={wheel}
			/>
		</ScrollingEntranceProvider>
	);
}

export default Scrolling;
