/**
 * Pure layout geometry for the Scrolling ticker's configurable deck behaviours.
 *
 * Three independent knobs live here, all of them plain functions so
 * `stack-layout.test.ts` can exercise them under `node --test`:
 *
 * 1. **Entrance origin** — where the collapsed deck sits before it unfurls
 *    ({@link fanAnchor}), and which DOM copies of an item join the unfurl at all
 *    ({@link fanSlack}, {@link fansIn}).
 * 2. **Stacking order** — which card paints on top while cards overlap
 *    ({@link stackZIndex}), derived from the card's live place in the loop
 *    ({@link cardLoopPositionFrom}) rather than from its static index.
 * 3. **Depth tail** — the gradual scale-and-tuck applied to cards approaching an
 *    edge of the scrollport ({@link depthProgress}, {@link depthScale},
 *    {@link depthLift}).
 *
 * ## Why every function is total
 *
 * Same hazard as `lib.ts`: these results are written straight into Motion
 * `MotionValue`s, and a single non-finite frame PERMANENTLY poisons one — once
 * `NaN` lands, every later read derives from the poisoned value and stays `NaN`
 * for the lifetime of the value, silently.
 *
 * The inputs really are untrustworthy. motion-plus' Ticker reports
 * `{ start: 0, end: 0 }` per item and `containerLength: 0` until it has
 * measured, and `useTickerItem().offset` is hard-coded to `0` before
 * measurement (`TickerItem.mjs`: `if ((!start && !end) || !listSize) return 0`).
 * So every function below returns a finite number for EVERY input, including
 * `NaN`, `Infinity`, `-Infinity` and `undefined`, and every one degrades to a
 * visible, unscaled, unmoved card rather than to a hidden or collapsed one.
 */

/** Where the collapsed deck sits before the entrance unfurls it. */
export type ScrollingEntranceOrigin = "centre" | "top" | "bottom";

/** Which card paints above its neighbours while cards overlap. */
export type ScrollingStackOrder = "last-on-top" | "first-on-top";

/** Which edges of the scrollport get the gradual scale-and-tuck tail. */
export type ScrollingDepth = "none" | "bottom" | "both";

export const SCROLLING_ENTRANCE_ORIGINS: readonly ScrollingEntranceOrigin[] = ["centre", "top", "bottom"];
export const SCROLLING_STACK_ORDERS: readonly ScrollingStackOrder[] = ["last-on-top", "first-on-top"];
export const SCROLLING_DEPTHS: readonly ScrollingDepth[] = ["none", "bottom", "both"];

function isFiniteNumber(value: number): boolean {
	return Number.isFinite(value);
}

/** Normalises `-0` to `0` so callers and tests never have to think about it. */
function unsigned(value: number): number {
	return value === 0 ? 0 : value;
}

function clamp01(value: number): number {
	if (!isFiniteNumber(value)) return 0;
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}

/**
 * Position, in the ticker list's own coordinate space, that a card collapses
 * onto while the deck is stacked.
 *
 * Anchors are expressed per-card rather than per-container so the collapsed deck
 * is always fully visible whatever the card's height:
 *
 * - `"centre"` — the middle of the scrollport. Cards above it fan down and cards
 *   below it fan up, so the deck opens symmetrically and matches the reference
 *   recording.
 * - `"top"` — the card's own top edge lands flush with the top of the
 *   scrollport, so the deck opens downward.
 * - `"bottom"` — the default. The card's own bottom edge lands flush with the
 *   bottom of the scrollport, so the deck opens upward.
 *
 * Anchoring on `cardHeight / 2` rather than on `0` / `containerLength` matters:
 * collapsing onto the raw edge would centre every card ON the edge, leaving half
 * the deck clipped outside the scrollport for the whole entrance.
 *
 * Returns `0` for any non-finite input and before measurement (when
 * `containerLength` is still `0`), which makes {@link fanOffset} a no-op.
 */
export function fanAnchor(
	origin: ScrollingEntranceOrigin,
	containerLength: number,
	cardHeight: number,
): number {
	if (!isFiniteNumber(containerLength) || containerLength <= 0) return 0;
	const half = isFiniteNumber(cardHeight) && cardHeight > 0 ? cardHeight / 2 : 0;
	const raw =
		origin === "top" ? half : origin === "bottom" ? containerLength - half : containerLength / 2;
	if (!isFiniteNumber(raw)) return 0;
	// A card taller than the scrollport would otherwise anchor outside it.
	const clamped = raw < 0 ? 0 : raw > containerLength ? containerLength : raw;
	return unsigned(clamped);
}

/**
 * Half-width added to each end of the scrollport when deciding which DOM copies
 * of an item take part in the unfurl.
 *
 * Only non-zero when the loop period is LONGER than the scrollport, which is
 * exactly the case where Ticker renders no clones — so there is no competing
 * copy and a card just past an edge can safely fan.
 *
 * Returns `0` for any non-finite input, which reduces {@link fansIn} to a plain
 * "has pixels on screen" test.
 */
export function fanSlack(pitch: number, containerLength: number): number {
	if (!isFiniteNumber(pitch) || !isFiniteNumber(containerLength)) return 0;
	if (pitch <= containerLength) return 0;
	const slack = (pitch - containerLength) / 2;
	return isFiniteNumber(slack) ? unsigned(slack) : 0;
}

/**
 * Whether THIS DOM copy of an item takes part in the entrance unfurl.
 *
 * ## Why the gate is position-based and not `isClone`
 *
 * Ticker resolves `offset === 0` to `renderedOffset = -(totalItemLength + gap)`,
 * one whole loop period ABOVE the list. Which copy that leaves in the scrollport
 * depends entirely on the clone count:
 *
 * - No clones (scrollport shorter than one period): every ORIGINAL's projection
 *   fires, so the originals sit at their laid-out positions and fill the port.
 * - One or more clones: the originals are reprojected a full period BELOW the
 *   port and the first CLONE group occupies it instead.
 *
 * Measured in-browser at `viewportHeight` 720: the eight clone cards sat at
 * `y=0, opacity=1, scale=1` for every frame of the 600ms unfurl while the eight
 * originals ran the entire animation 592px below the port — a completely
 * invisible entrance. With `entranceOrigin="top"` it was worse: the originals
 * piled up at opacity 0.37 INSIDE the port, smearing translucent ghost cards
 * over the settled clones.
 *
 * Clone-ness is a DOM-ordering accident; occupancy is the real question. It
 * stays the right discriminator for `inert`/`aria-hidden` (a DOM-identity
 * concern) and the wrong one for the fan.
 *
 * `cardTop` is the card's laid-out top edge in SCROLLPORT coordinates
 * (`useCardTop()` plus the container's `inset`). Every copy with pixels on
 * screen fans, which is the whole point; {@link fanSlack} widens the window
 * past the edges only while the loop period exceeds the scrollport, and
 * anything it admits out there is clipped by the scrollport anyway — so a
 * second copy of the same item joining the fan can never be seen.
 *
 * Fails ANIMATED (`true`) for non-finite input and before measurement, so a
 * card can never be silently frozen out of its own entrance.
 */
export function fansIn(
	cardTop: number,
	cardHeight: number,
	containerLength: number,
	pitch: number,
): boolean {
	if (!isFiniteNumber(cardTop) || !isFiniteNumber(cardHeight)) return true;
	if (!isFiniteNumber(containerLength) || containerLength <= 0) return true;
	const slack = fanSlack(pitch, containerLength);
	return cardTop + cardHeight > -slack && cardTop < containerLength + slack;
}

/**
 * Half-width of the paint-order ladder, in px of loop position.
 *
 * {@link stackZIndex} turns a card's live loop position straight into a
 * `z-index`, so the ladder has to be wide enough that no reachable position is
 * ever clamped onto a neighbour's rung. A copy's position is bounded by twice
 * the list size — `start` spans one list and the loop reprojection adds at most
 * one more — and the tallest list this component can build is a handful of
 * card-heights per clone group, i.e. low thousands of px. `1e5` clears that by
 * more than an order of magnitude while leaving every rung six digits — three
 * orders of magnitude inside `z-index`'s 32-bit range.
 *
 * The absolute value never escapes: Ticker gives its `<ul>` a `y` transform,
 * which makes it a stacking context, so these layers only ever compete with
 * each other. Measured in-browser: the `<ul>` reports
 * `matrix(1, 0, 0, 1, 0, -592)`, and the viewport's own `z-10` hint chip — a
 * sibling of Ticker's root, outside that context — still paints above the
 * cards.
 */
const STACK_LADDER_SPAN_PX = 1e5;

/**
 * Paint order for one card, highest number on top, derived from the card's LIVE
 * position in the loop.
 *
 * Applies while cards overlap — during the collapsed entrance deck, and in the
 * depth tail where the tuck makes neighbours overlap.
 *
 * ## Why this cannot be the static item index
 *
 * The obvious ladder is `itemIndex` (and `itemCount - 1 - itemIndex` for the
 * mirror), which is what this function used to return. It is wrong on a list
 * that LOOPS. The index ladder climbs `0 … itemCount - 1` and then RESETS,
 * while the cards themselves keep marching in one direction forever — so once
 * per loop period the last item reprojects above the first and the pair paints
 * inverted, one adjacent seam per period, exactly where the depth tail has made
 * the two cards overlap. Clones make it worse: they are separate `<li>`
 * siblings in the same stacking context and the index ladder gives a clone the
 * same rung as the original it copies.
 *
 * `loopPosition` is `start + projection` — see `use-card-top.ts` for why that
 * is the cheap, tie-free way to ask for a card's live loop ORDER. It is
 * monotonic across the wrap by construction: reprojecting a card adds a whole
 * `listSize` to it, which lifts it past every copy that has not reprojected
 * yet, instead of resetting it to zero.
 *
 * The two orders stay EXACT mirrors: `first-on-top` returns
 * `2 * STACK_LADDER_SPAN_PX` minus what `last-on-top` returns, so their sum is
 * the same constant for every card and every position.
 *
 * Returns `0` for a non-finite position, which puts the card at the bottom of
 * the stack rather than dropping it out of the paint order.
 */
export function stackZIndex(order: ScrollingStackOrder, loopPosition: number): number {
	if (!isFiniteNumber(loopPosition)) return 0;
	const rank = Math.round(loopPosition);
	const clamped =
		rank < -STACK_LADDER_SPAN_PX
			? -STACK_LADDER_SPAN_PX
			: rank > STACK_LADDER_SPAN_PX
				? STACK_LADDER_SPAN_PX
				: rank;
	// Shifted so every rung is non-negative whichever way the ladder runs.
	const ranked = clamped + STACK_LADDER_SPAN_PX;
	return order === "first-on-top" ? 2 * STACK_LADDER_SPAN_PX - ranked : ranked;
}

/**
 * How far a card has travelled into an edge zone, signed by which edge.
 *
 * Positive is the bottom edge, negative the top, `0` means the card is in open
 * space and the depth tail is inactive. The magnitude runs `0` at the zone
 * boundary through `1` at the scrollport edge.
 *
 * Deliberately a bare number rather than a `{ progress, edge }` record: this
 * runs inside a Motion `useTransform` on every animation frame for every card,
 * and Motion's own performance guidance is to avoid allocating in frame
 * callbacks. The sign carries the edge for free.
 *
 * `centre` is the card's midpoint in scrollport coordinates: `0` is the top of
 * the scrollport's content box and `containerLength` its bottom.
 *
 * ## Where `centre` must come from
 *
 * Compose it from {@link cardTopFrom} via the `useCardTop()` bridge in
 * `use-card-top.ts`, as `cardTop + cardHeight / 2 + inset`.
 *
 * Do NOT compose it inline from `useTickerItem()` as `offset + (end - start) /
 * 2`, even though `offset` is Ticker's own live top edge and the arithmetic is
 * identical. When motion-plus 2.x had its own Motion copy, Ticker's `offset`
 * was a motion 12 `MotionValue` while this package imported motion 13, and
 * reading one inside the zero-argument `useTransform(() => …)` DID NOT
 * SUBSCRIBE: dependency collection runs through motion-dom's module-level
 * `collectMotionValues` singleton, and a motion 12 `.get()` registered with
 * motion-dom 12's copy, which motion-dom 13 never read. The transform then
 * recomputed only when some motion 13 value it also touched changed, and froze
 * silently the moment that value settled.
 * That is not hypothetical — it is the exact bug that froze the whole depth
 * tail once the entrance landed, and it is why the crossing is done by hand,
 * once, with `.on("change", …)` in `use-card-top.ts`.
 *
 * The explicit `useTransform([value], fn)` form would subscribe correctly but
 * does not typecheck across the two nominally distinct `MotionValue` classes.
 * The bridge is the only supported route.
 *
 * With `depth: "both"` the zones overlap on a scrollport shorter than
 * `2 * zonePx`; the nearer edge wins so a card never fights two tucks at once.
 *
 * Returns `0` for any non-finite input, for `depth: "none"`, and before
 * measurement — the card stays full size and unmoved.
 */
export function depthProgress(
	centre: number,
	containerLength: number,
	zonePx: number,
	depth: ScrollingDepth,
): number {
	if (depth === "none") return 0;
	if (!isFiniteNumber(centre) || !isFiniteNumber(containerLength) || !isFiniteNumber(zonePx)) {
		return 0;
	}
	if (containerLength <= 0 || zonePx <= 0) return 0;

	const bottom = clamp01((centre - (containerLength - zonePx)) / zonePx);
	const top = depth === "both" ? clamp01((zonePx - centre) / zonePx) : 0;

	if (bottom <= 0 && top <= 0) return 0;
	// Nearer edge wins when the two zones overlap on a short scrollport.
	return bottom >= top ? unsigned(bottom) : unsigned(-top);
}

/**
 * Scale for a card at `progress` through an edge zone, easing `1` to `minScale`.
 *
 * Takes the signed {@link depthProgress} and uses its magnitude, so both edges
 * shrink identically.
 *
 * The ramp is quadratic (`progress ** 2`) rather than linear so the shrink stays
 * imperceptible while a card is merely near the edge and only bites as it
 * genuinely tucks away. A linear ramp reads as the whole list breathing.
 *
 * Returns `1` for any non-finite input — failing full-size is always preferable
 * to a card that silently collapses to nothing.
 */
export function depthScale(progress: number, minScale: number): number {
	if (!isFiniteNumber(progress) || !isFiniteNumber(minScale)) return 1;
	const eased = clamp01(Math.abs(progress)) ** 2;
	const floor = minScale < 0 ? 0 : minScale > 1 ? 1 : minScale;
	const scale = 1 - eased * (1 - floor);
	return isFiniteNumber(scale) ? unsigned(scale) : 1;
}

/**
 * Vertical tuck for a card at signed `progress` through an edge zone.
 *
 * Cards deeper into the zone are pulled further back toward the zone boundary,
 * so successive cards bunch up and overlap into a deck instead of continuing to
 * spread at a constant pitch. The direction follows the sign of `progress`: a
 * bottom-edge card (positive) lifts up, a top-edge card (negative) pushes down.
 *
 * Quadratic for the same reason as {@link depthScale}, and so the tuck stays in
 * step with the shrink rather than leading or trailing it.
 *
 * Returns `0` for any non-finite input, leaving the card at its laid-out spot.
 */
export function depthLift(progress: number, liftPx: number): number {
	if (!isFiniteNumber(progress) || !isFiniteNumber(liftPx)) return 0;
	const eased = clamp01(Math.abs(progress)) ** 2;
	const direction = progress > 0 ? -1 : progress < 0 ? 1 : 0;
	const lift = direction * eased * liftPx;
	return isFiniteNumber(lift) ? unsigned(lift) : 0;
}

/**
 * A card's laid-out top edge in the ticker list's coordinate space.
 *
 * This is Ticker's own `itemOffset` formula. The y-axis layout strategy is
 * always `ltrStrategy` with `sign: 1` (RTL only ever flips the x axis), so the
 * three inputs are a plain sum:
 *
 * - `scrollOffset` — the list's rendered scroll offset, shared by every card.
 * - `start` — this card's static offset within the list.
 * - `reprojection` — ±`listSize` while the loop has teleported this card to the
 *   other end, `0` otherwise.
 *
 * Returns `0` for any non-finite input. See {@link depthProgress} for why every
 * function in this module is total.
 */
export function cardTopFrom(scrollOffset: number, start: number, reprojection: number): number {
	if (!isFiniteNumber(scrollOffset) || !isFiniteNumber(start) || !isFiniteNumber(reprojection)) {
		return 0;
	}
	const top = scrollOffset + start + reprojection;
	return isFiniteNumber(top) ? unsigned(top) : 0;
}

/**
 * A DOM copy's place in the loop: {@link cardTopFrom} with the term every copy
 * shares — the list's rendered scroll offset — left out.
 *
 * Cards sort identically by this and by their live top edge, because the term
 * that is missing is the same number for all of them. It is the input
 * {@link stackZIndex} wants: `start` is static per copy and `reprojection` only
 * steps, so the result moves a handful of times per loop rather than every
 * frame. `use-card-top.ts` publishes it.
 *
 * Returns `0` for any non-finite input, matching every other function here.
 */
export function cardLoopPositionFrom(start: number, reprojection: number): number {
	if (!isFiniteNumber(start) || !isFiniteNumber(reprojection)) return 0;
	const position = start + reprojection;
	return isFiniteNumber(position) ? unsigned(position) : 0;
}

/**
 * Fraction of the depth tail that should be applied, given the entrance state.
 *
 * Two jobs, and they are both about the ~600ms unfurl:
 *
 * 1. **Keeping the entrance readable.** Mid-unfurl every card is piled on the
 *    anchor, so a card whose LAID-OUT home is inside an edge zone would arrive
 *    already tucked and shrunk, through no fault of the user's scrolling.
 *    Ramping the tail in hands the cards over to the depth effect only once
 *    they have landed.
 * 2. **Holding the animating-property count to two.** `holdAbove` is the
 *    collapse at which the entrance's own opacity ramp finishes (see
 *    `FAN_OPACITY_INPUT` in `lib.ts`). Above it the gate is a hard `0`, so
 *    `scale` is EXACTLY 1 and the only two properties in flight are `y` and
 *    `opacity`; below it `opacity` is pinned at 1 and the pair becomes `y` and
 *    `scale`. `.agents/rules/motion-decisions.md` caps a transition at two
 *    animating properties, and without this split the shipped default config
 *    ran all three at once for the first ~45% of the entrance.
 *
 * The ramp is continuous at the knot (it is `0` on both sides of it), so
 * nothing jumps as the tail engages.
 *
 * `holdAbove` at or below `0` disables the hold and restores the plain
 * `1 - collapse` ramp. Returns `1` (tail fully applied) for a non-finite
 * `collapse`, matching the settled steady state that dominates the component's
 * life.
 */
export function depthGate(collapse: number, holdAbove: number): number {
	if (!isFiniteNumber(collapse)) return 1;
	const collapsed = clamp01(collapse);
	const knot = isFiniteNumber(holdAbove) ? clamp01(holdAbove) : 0;
	if (knot <= 0) return unsigned(1 - collapsed);
	if (collapsed >= knot) return 0;
	return unsigned(clamp01((knot - collapsed) / knot));
}
