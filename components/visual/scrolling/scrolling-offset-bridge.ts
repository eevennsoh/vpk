"use client";

import { useEffect, type RefObject } from "react";
import { useTicker, type TickerProps } from "motion-plus/react";

/**
 * The `MotionValue` the ticker scrolls. It must be one Ticker created itself.
 *
 * History: motion-plus 2.x pinned `motion ^12` and pnpm gave it its own copy,
 * so every MotionValue it made belonged to motion 12 while this repo imported
 * motion 13. That split was NOT cosmetic. Ticker derives its rendered offset
 * with the zero-argument `useTransform(() => … offset.get())`, whose dependency
 * tracking runs through a module-level `collectMotionValues` singleton inside
 * motion-dom: a motion 13 value registered with motion-dom 13's singleton while
 * motion-plus read motion-dom 12's, so a value created here was never
 * subscribed to and the list never moved. Verified in-browser before this
 * bridge existed — the wheel handler wrote the offset and called
 * `preventDefault`, and the list's transform stayed at its initial value
 * through drag and wheel alike. Motion's React contexts were split for the
 * same reason.
 *
 * Since motion-plus 3 (which takes `motion` as a peer dependency) only one
 * Motion copy is installed, and `scripts/motion-single-copy.test.js` fails if a
 * second one comes back. The "cross-copy" notes elsewhere in this package
 * describe that former split: the explicit `.on("change", …)` subscriptions
 * and duck-typed shapes it motivated are still correct with a single copy, so
 * they stay until a separate, browser-verified change simplifies them.
 */
export type TickerOffset = NonNullable<TickerProps["offset"]>;

/**
 * The ONE structural description of a ticker-owned `MotionValue` in this
 * package. Every consumer that only reads or writes a ticker value types
 * against this (or a `Pick` of it) rather than declaring its own shape.
 *
 * Deliberately NOT `MotionValue` from `motion/react`: the values being read and
 * written here are created by motion-plus (see {@link TickerOffset}), and when
 * it resolved its own Motion copy naming either package's class forced a cast.
 * Any MotionValue satisfies this shape.
 *
 * {@link TickerOffset} is the other, NOMINAL half of the same story and is not
 * interchangeable with this one: it is Ticker's own prop type, needed wherever
 * a value is handed back to motion-plus (`_dragY`) or wherever the full
 * `MotionValue` API — `jump`, subscriptions — is used.
 */
export interface ScrollingOffset {
	get(): number;
	set(value: number): void;
	stop(): void;
}

/**
 * The plain-number slice of Ticker's measurement that
 * `use-scrolling-focus.ts` needs to solve for a target offset.
 *
 * All of it is ordinary state on the ticker context, so nothing here is a
 * MotionValue. The one exception is `renderedOffset`, which is
 * read-only here and therefore typed as the read half of
 * {@link ScrollingOffset}.
 */
export interface ScrollingTickerGeometry {
	/** The ticker container's `padding-top`, in px. */
	inset: number;
	/** Flex gap between items, in px. */
	gap: number;
	/** First item's `start` to last item's `end`, in px. */
	totalItemLength: number;
	/** Per-item `{ start, end }` within the list, indexed by item index. */
	itemPositions: readonly { start: number; end: number }[];
	/** The wrapped offset the list is actually rendered at. */
	renderedOffset: Pick<ScrollingOffset, "get">;
}

/**
 * Lifts Ticker's own offset — and a live snapshot of its measurement — out of
 * the ticker context so the wheel handler, `_dragY` and the focus solver can
 * use them.
 *
 * Render it as a `<Ticker>` child: children are rendered inside
 * `TickerContext`, which is the only place those values are reachable. The
 * offset lift settles on the first commit, long before any pointer or wheel
 * input, and cannot loop — Ticker keeps handing back the same value as long as
 * we never pass an `offset` prop of our own.
 *
 * The geometry goes into a REF rather than state on purpose. It changes on
 * every remeasure (resize, viewport-height change), and routing that through
 * `useState` would re-render `<Ticker>` itself — the component whose gesture
 * must not be disturbed. Nothing renders from it; the focus listener reads it
 * on demand.
 */
export function ScrollingOffsetBridge({
	geometryRef,
	onOffset,
}: Readonly<{
	geometryRef: RefObject<ScrollingTickerGeometry | null>;
	onOffset: (offset: TickerOffset) => void;
}>): null {
	const { gap, inset, itemPositions, offset, renderedOffset, totalItemLength } = useTicker();
	useEffect(() => {
		onOffset(offset);
	}, [offset, onOffset]);
	useEffect(() => {
		geometryRef.current = { gap, inset, itemPositions, renderedOffset, totalItemLength };
		return () => {
			geometryRef.current = null;
		};
	}, [gap, geometryRef, inset, itemPositions, renderedOffset, totalItemLength]);
	return null;
}
