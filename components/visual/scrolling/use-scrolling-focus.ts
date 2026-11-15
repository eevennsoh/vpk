"use client";

import { useEffect, type RefObject } from "react";

import { SCROLLING_FADE_PX } from "./data";
import { focusRevealOffset, isKeyboardFocus } from "./lib";
import type { ScrollingOffset, ScrollingTickerGeometry } from "./scrolling-offset-bridge";

/**
 * Clearance the focused control needs from each scrollport edge: the full edge
 * fade plus the 4px the cards' outward focus ring extends past their box.
 * Inside this band the indicator is either clipped or dimmed by the mask.
 */
const FOCUS_SAFE_INSET_PX = SCROLLING_FADE_PX + 4;

/**
 * Scrolls the keyboard-focused card action into the unmasked part of the
 * scrollport.
 *
 * Ticker ships its own version of this in `use-focus-navigation.mjs` and it
 * cannot work here. `applyFocusOffset()` scrolls with
 * `focusOffset.set(-element.offsetTop)`, but Ticker gives every `.ticker-item`
 * `<li>` an inline `position: relative` and the session card's `<article>` is
 * `relative` too, so `offsetTop` resolves against the CARD the control lives in
 * rather than the list. Measured in-browser at the default 480px viewport: all
 * 16 actions report `offsetTop === 18`, the ticker offset freezes at -18 for the
 * whole keyboard walk, and the last card's actions sit at y 516-540 inside a
 * 480px `overflow: clip` box — an entirely invisible focus indicator.
 *
 * So suppress that trap and do the scrolling here:
 *
 * 1. A CAPTURE-phase `focus` listener on the region. Capture runs
 *    outermost-first and the region is the parent of Ticker's own container, so
 *    stopping propagation means Ticker's `handleFocus` never fires and
 *    `startFocusTrap` never runs. `renderedOffset` then stays the wrapped
 *    `offset` this component already owns — which is also what makes the solver
 *    below valid, since a trapped Ticker swaps `renderedOffset` for its own
 *    `focusOffset`.
 * 2. A `focusin` listener that SOLVES for the target offset in the ticker's own
 *    coordinate space (see {@link focusRevealOffset}) and writes the exact
 *    difference — but only for KEYBOARD focus (see {@link isKeyboardFocus}).
 *
 * ## Why the reveal is keyboard-only
 *
 * A mouse press on a button raises `focusin` exactly like Tab does. Reacting to
 * both meant that pressing a card action inside the bottom fade scrolled the
 * list out from under the pointer between `pointerdown` and `pointerup`, so the
 * `click` never landed on the control and the press was silently swallowed —
 * the keyboard fix breaking the mouse. `isKeyboardFocus` is the same
 * discrimination `use-scrolling-gestures.ts` already applies before it engages
 * the wheel on focus, lifted into `lib.ts` so the two listeners cannot drift.
 *
 * Nothing is lost by skipping the pointer case: the user can see the control
 * they just pressed, and they chose to press it where it was.
 *
 * ## Why solving beats nudging
 *
 * The previous implementation measured the shortfall with
 * `getBoundingClientRect` and added it to `offset`. That is only valid while a
 * card's on-screen y is an affine function of `offset` with slope 1, which
 * Ticker guarantees ONLY while it renders no clones. From `viewportHeight` 540
 * up it clones, and the nudge overshot by exactly one loop period: measured at
 * 600, the first Tab stop landed 492px BELOW a 600px port, and the second Tab
 * computed a full-period delta, which the wrap makes a no-op, so the stop was
 * stuck off screen for good. With `depth="bottom"` three consecutive stops had
 * no focus indicator anywhere in the port.
 *
 * Only three things are still measured live, and each of them has to be:
 * `intraTop` (which absorbs the depth tail's scale, since it is taken from the
 * `<li>`'s rect rather than the card's laid-out box), the control's height, and
 * the port height. Everything else comes from Ticker's own measurement via
 * {@link ScrollingTickerGeometry}.
 *
 * ## The one bounded re-measure
 *
 * The depth tuck rescales a card as it moves, so `intraTop` and the control
 * height are both slightly stale the moment the list lands somewhere new —
 * measured at 480/`depth="bottom"`, six stops settled 6-21px past the safe
 * band. A single `requestAnimationFrame` pass after the write absorbs that.
 * Exactly one pass: unbounded iteration oscillates on the stops the loop simply
 * cannot place (see {@link focusRevealOffset}).
 *
 * The region and Ticker's container share one box (the region carries the
 * explicit height, the container is `h-full w-full`), so the region rect is the
 * scrollport rect.
 */
export function useScrollingFocusScroll({
	containerRef,
	geometryRef,
	offset,
}: Readonly<{
	containerRef: RefObject<HTMLElement | null>;
	/** Ticker's measurement, `null` until it has measured. */
	geometryRef: RefObject<ScrollingTickerGeometry | null>;
	/** `null` until the ticker's offset has been lifted out of its context. */
	offset: ScrollingOffset | null;
}>): void {
	useEffect(() => {
		const region = containerRef.current;
		if (region === null || offset === null) return;

		let refineHandle: number | null = null;

		const suppressTickerFocusTrap = (event: FocusEvent) => {
			event.stopPropagation();
		};

		/** Solves for, and applies, the offset delta the focused control needs. */
		const reveal = (target: Element): void => {
			// Clones are `inert`, so this only ever matches a real item.
			const card = target.closest(".ticker-item");
			const geometry = geometryRef.current;
			if (card === null || geometry === null) return;
			const cards = Array.from(region.querySelectorAll(".ticker-item"));
			const bounds = geometry.itemPositions[cards.indexOf(card)];
			const itemCount = geometry.itemPositions.length;
			if (bounds === undefined || itemCount === 0) return;
			// Ticker does not publish its clone count, but it renders exactly
			// `cloneCount` copies of every item, so the DOM has it exactly.
			const cloneCount = region.querySelectorAll(".clone-item").length / itemCount;
			const pitch = geometry.totalItemLength + geometry.gap;
			const port = region.getBoundingClientRect();
			const focused = target.getBoundingClientRect();
			const delta = focusRevealOffset({
				controlHeight: focused.height,
				end: bounds.end,
				inset: geometry.inset,
				intraTop: focused.top - card.getBoundingClientRect().top,
				listSize: pitch * (cloneCount + 1),
				pitch,
				safeInset: FOCUS_SAFE_INSET_PX,
				start: bounds.start,
				viewportHeight: port.height,
				wrappedOffset: geometry.renderedOffset.get(),
			});
			if (delta === 0) return;
			// A drag throw is a running inertia animation writing `offset` every
			// frame; `set` alone would be overwritten immediately.
			offset.stop();
			// `set`, not `animate`: `offset` is owned by motion-plus's Ticker, which
			// once resolved its own Motion copy (see `scrolling-offset-bridge.ts`),
			// so an `animate()` from here could not be relied on to drive it. An instant reveal is
			// also the reduced-motion-safe default for scroll-into-view.
			offset.set(offset.get() + delta);
		};

		const revealFocusedAction = (event: FocusEvent) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			// A MOUSE press on a card action raises `focusin` too. Scrolling
			// there would move the control out from under the pointer before the
			// `click` resolved, silently swallowing the press. Only a genuine
			// keyboard stop can be hidden by the edge fade without the user
			// having chosen where it is.
			if (!isKeyboardFocus(target)) return;
			reveal(target);
			if (typeof requestAnimationFrame === "undefined") return;
			// One pass, and only the latest focus owns it — a fast Tab walk must
			// not queue a refine per stop against a control that has since blurred.
			if (refineHandle !== null) cancelAnimationFrame(refineHandle);
			// TWO frames, not one. The write above lands in a MotionValue owned by
			// Ticker (see `scrolling-offset-bridge.ts`), whose render loop applies
			// it on its own frame; a single frame can measure the old
			// transform and re-derive a delta that has already been applied.
			refineHandle = requestAnimationFrame(() => {
				refineHandle = requestAnimationFrame(() => {
					refineHandle = null;
					if (document.activeElement !== target) return;
					reveal(target);
				});
			});
		};

		region.addEventListener("focus", suppressTickerFocusTrap, true);
		region.addEventListener("focusin", revealFocusedAction);
		return () => {
			region.removeEventListener("focus", suppressTickerFocusTrap, true);
			region.removeEventListener("focusin", revealFocusedAction);
			if (refineHandle !== null) cancelAnimationFrame(refineHandle);
		};
	}, [containerRef, geometryRef, offset]);
}
