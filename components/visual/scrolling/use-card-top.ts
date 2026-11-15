"use client";

import { useEffect } from "react";
import { useMotionValue, type MotionValue } from "motion/react";
import { useTicker, useTickerItem } from "motion-plus/react";

import { cardLoopPositionFrom, cardTopFrom } from "./stack-layout";

/**
 * The card's laid-out top edge in the ticker list's coordinate space, published
 * as a motion 13 value this package can safely derive from.
 *
 * ## Why this bridge has to exist
 *
 * When motion-plus 2.x resolved its own Motion copy, Ticker's values belonged to
 * motion 12 while this package imported motion 13 (see
 * `scrolling-offset-bridge.ts`; one copy is installed since motion-plus 3).
 * Neither of the two ways motion 13 would normally consume them worked across
 * that boundary:
 *
 * 1. `useTransform(() => tickerValue.get())` — the zero-argument form discovers
 *    dependencies through motion-dom's module-level `collectMotionValues`
 *    singleton. A motion 12 `.get()` registered with motion-dom 12's singleton,
 *    which motion-dom 13 never read, so NOTHING was collected and the derived
 *    value silently never recomputed.
 * 2. `useTransform([tickerValue], fn)` — the explicit form subscribes correctly
 *    at runtime, but motion 12's `MotionValue` was a nominally distinct class
 *    from motion 13's, so it did not satisfy the overload's `MotionValue<T>[]`
 *    parameter and the call failed to typecheck without a cast.
 *
 * So the crossing is done by hand exactly once, here: `.on("change", …)` is a
 * plain duck-typed method that both runtimes implement identically, and the
 * value it feeds is created by motion 13 and therefore composes normally with
 * every `useTransform` downstream.
 *
 * ## The bug this fixes
 *
 * The depth tail used form (1). It captured only `collapse` (a motion 13 value),
 * which stops changing once the entrance lands — so the scale-and-tuck was
 * computed for wherever each card happened to sit when the unfurl finished and
 * then froze there permanently. Measured in-browser before this bridge existed:
 * after a 280px drag every card's scale was byte-identical while the cards had
 * moved a third of the scrollport, and forcing a React re-render snapped them
 * all to the correct values for their new positions.
 */
export function useCardTop(): MotionValue<number> {
	const { renderedOffset } = useTicker();
	const { projection, start } = useTickerItem();
	const cardTop = useMotionValue(0);

	useEffect(() => {
		const sync = () => {
			// `cardTopFrom` is total: a single non-finite frame would PERMANENTLY
			// poison this value, and every consumer derives a transform from it.
			cardTop.set(cardTopFrom(renderedOffset.get(), start, projection.get()));
		};
		sync();
		const unsubscribe = [renderedOffset.on("change", sync), projection.on("change", sync)];
		return () => {
			for (const stop of unsubscribe) stop();
		};
	}, [cardTop, projection, renderedOffset, start]);

	return cardTop;
}

/**
 * The same live position, with the term every copy shares removed: this DOM
 * copy's place in the LOOP, published as a motion 13 value.
 *
 * `cardTop` is `renderedOffset + start + projection` and `renderedOffset` is one
 * number shared by every copy on the list, so ORDERING cards by `cardTop` and
 * ordering them by `start + projection` give exactly the same sequence. What
 * differs is how often the number moves: `cardTop` changes every frame the list
 * scrolls, while `start` is static per copy (Ticker offsets each clone group's
 * bounds by a whole period, so it is unique and monotonic in DOM order) and
 * `projection` only ever steps between `0` and `listSize` as the loop teleports
 * a card to the far end.
 *
 * That makes this the right input for anything that needs the cards' live
 * ORDER rather than their live position — {@link stackZIndex} above all, whose
 * result has to be written to the DOM and would otherwise be rewritten for
 * every card on every frame of a drag.
 *
 * Subscribes to Ticker's values exactly the same way, and for exactly the same
 * reasons, as {@link useCardTop}.
 */
export function useCardLoopPosition(): MotionValue<number> {
	const { projection, start } = useTickerItem();
	const loopPosition = useMotionValue(0);

	useEffect(() => {
		const sync = () => {
			// Total, for the reason spelled out in `useCardTop`.
			loopPosition.set(cardLoopPositionFrom(start, projection.get()));
		};
		sync();
		return projection.on("change", sync);
	}, [loopPosition, projection, start]);

	return loopPosition;
}
