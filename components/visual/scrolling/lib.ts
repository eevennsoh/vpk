/**
 * Pure, dependency-free logic for the Scrolling ticker.
 *
 * NO React and NO Motion imports live here on purpose: every export is a plain
 * function so `lib.test.ts` can exercise it under `node --test`.
 *
 * Three separate concerns share the file, and they are genuinely unrelated to
 * each other — the header below about totality applies only to the first:
 *
 * 1. **Entrance fan geometry** — {@link fanOffset}, {@link fanOpacity} and the
 *    opacity knots. The rest of the entrance geometry (the anchor, and which
 *    DOM copies take part) lives in `stack-layout.ts`, because it is shared
 *    with the deck/depth knobs that file owns.
 * 2. **Input normalisation** — {@link shouldCaptureWheel} and
 *    {@link isKeyboardFocus} answer "is this input ours?" for a listener, and
 *    both are the single authority for a rule two hooks depend on;
 *    {@link wheelDeltaPx} then puts the claimed wheel delta into pixels.
 * 3. **The focus-reveal solver** — {@link focusRevealOffset} and its geometry
 *    record, used only by `use-scrolling-focus.ts`.
 *
 * ## Why every function is total
 *
 * These results are written straight into Motion `MotionValue`s. A single
 * non-finite frame PERMANENTLY poisons a `MotionValue`: once `NaN` lands, every
 * later spring/inertia read derives from the poisoned current value and stays
 * `NaN` for the lifetime of the value, with no visible error. The same hazard is
 * documented in `components/blocks/gallery/hooks/use-dock-magnification.ts` and
 * `components/blocks/agent-session/agent-session-notch-magnify.ts`.
 *
 * The inputs really are untrustworthy: motion-plus' Ticker reports
 * `{ start: 0, end: 0 }` for every item and `containerLength: 0` until it has
 * measured, and `parseInt` on a container padding string can yield `NaN`. So
 * every function below returns a finite number for EVERY input, including
 * `NaN`, `Infinity`, `-Infinity` and `undefined`.
 */

/**
 * Collapse values at which the fade knots sit, highest first.
 *
 * The shared collapse value animates `1` (perfectly stacked deck) to `0` (laid
 * out list). Cards resolve as they separate rather than after they land, so the
 * fade finishes at `0.55` — a little under halfway through the unfurl.
 */
export const FAN_OPACITY_INPUT: readonly [number, number] = [1, 0.55];

/** Opacities matching {@link FAN_OPACITY_INPUT}, knot for knot. */
export const FAN_OPACITY_OUTPUT: readonly [number, number] = [0, 1];

function isFiniteNumber(value: number): boolean {
	return Number.isFinite(value);
}

/** Normalises `-0` to `0` so callers and tests never have to think about it. */
function unsigned(value: number): number {
	return value === 0 ? 0 : value;
}

function clampTo(value: number, low: number, high: number): number {
	if (value < low) return low;
	if (value > high) return high;
	return value;
}

/**
 * Vertical offset that pulls a card from its laid-out position toward the
 * container centre.
 *
 * At `collapse === 1` every card sits exactly on `containerCentre`, which is the
 * perfectly stacked deck; at `collapse === 0` every card is at its laid-out
 * position. Cards ABOVE the centre get a positive (downward) offset, cards BELOW
 * get a negative (upward) one, and a card already on the centre never moves — so
 * the deck unfurls symmetrically.
 *
 * Returns `0` when any input is non-finite.
 */
export function fanOffset(collapse: number, centre: number, containerCentre: number): number {
	if (!isFiniteNumber(collapse) || !isFiniteNumber(centre) || !isFiniteNumber(containerCentre)) return 0;
	const offset = collapse * (containerCentre - centre);
	return isFiniteNumber(offset) ? unsigned(offset) : 0;
}

/**
 * Card opacity for a given collapse, clamped to `[0, 1]`.
 *
 * Interpolates {@link FAN_OPACITY_INPUT} onto {@link FAN_OPACITY_OUTPUT}.
 * `scrolling-card.tsx` calls this directly from its opacity transform rather
 * than handing the two ranges to Motion, because that transform also has to
 * decide — per frame, from the card's live position — whether this DOM copy is
 * taking part in the unfurl at all. See `fansIn` in `stack-layout.ts`.
 *
 * Returns `1` (fully visible) for a non-finite input — failing visible is always
 * preferable to a card that silently never appears.
 */
export function fanOpacity(collapse: number): number {
	if (!isFiniteNumber(collapse)) return 1;
	const [inStart, inEnd] = FAN_OPACITY_INPUT;
	const [outStart, outEnd] = FAN_OPACITY_OUTPUT;
	const span = inEnd - inStart;
	if (span === 0) return outEnd;
	const progress = (collapse - inStart) / span;
	const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
	const opacity = outStart + clamped * (outEnd - outStart);
	return isFiniteNumber(opacity) ? unsigned(opacity) : 1;
}

/**
 * Whether the scroller should claim a wheel event instead of letting the page
 * scroll.
 *
 * Two independent gates, both load-bearing:
 *
 * - `engaged`: passive hover must NEVER capture. A reader whose pointer merely
 *   crosses the component on the way down the page has to keep their scroll.
 *   See `use-scrolling-gestures.ts` for how engagement is established.
 * - Dominant axis: horizontal intent is never ours. A two-finger swipe-back
 *   arrives as `deltaX` with `deltaY === 0`; preventing it strands the user.
 *
 * Total for every input, including non-finite deltas, for the reasons in this
 * file's header.
 */
export function shouldCaptureWheel(engaged: boolean, deltaX: number, deltaY: number): boolean {
	if (!engaged) return false;
	if (!isFiniteNumber(deltaX) || !isFiniteNumber(deltaY)) return false;
	if (Math.abs(deltaX) > Math.abs(deltaY)) return false;
	return deltaY !== 0;
}

/**
 * `WheelEvent.deltaMode` values, written out because the named constants live on
 * the `WheelEvent` class and this file is deliberately DOM-library-free so
 * `lib.test.ts` can run it under bare `node --test`.
 */
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

/**
 * A wheel event's vertical delta converted to PIXELS.
 *
 * `deltaY` is only ever in pixels when `deltaMode` is `DOM_DELTA_PIXEL`. Firefox
 * on Windows and Linux reports `DOM_DELTA_LINE`, where a notch is 3 units, and
 * some devices and assistive/remote inputs report `DOM_DELTA_PAGE`, where a
 * notch is 1 unit meaning one scrollport. Subtracting the raw number from the
 * ticker offset treats those units as pixels, so a Firefox notch crawled the
 * list 3px and a page notch moved it 1px — and any input that scales its units
 * up the other way jumps whole loops per notch.
 *
 * `linePx` and `pagePx` are the caller's real measurements, not guesses:
 * `SCROLLING_WHEEL_LINE_PX` in `data.ts` for the line, and the scrollport's own
 * live `clientHeight` for the page.
 *
 * Total for every input — a non-finite delta, an unrecognised mode, or an
 * unmeasured scrollport all return `0` — for the reason in this file's header:
 * the result is subtracted straight into the ticker's offset `MotionValue`, and
 * one `NaN` frame poisons it permanently.
 */
export function wheelDeltaPx(
	deltaY: number,
	deltaMode: number,
	linePx: number,
	pagePx: number,
): number {
	if (!isFiniteNumber(deltaY)) return 0;
	// An unknown mode falls through to pixels, which is what every browser that
	// has never reported anything else is already sending.
	const scale = deltaMode === DOM_DELTA_LINE ? linePx : deltaMode === DOM_DELTA_PAGE ? pagePx : 1;
	// A missing or unmeasured scale means we cannot know how far the user asked
	// to travel. Refusing to move beats writing a guess into the offset.
	if (!isFiniteNumber(scale) || scale <= 0) return 0;
	const pixels = deltaY * scale;
	return isFiniteNumber(pixels) ? unsigned(pixels) : 0;
}

/**
 * Whether a `focusin` on `target` came from the KEYBOARD rather than a pointer.
 *
 * A mouse press on a button raises `focusin` exactly like Tab does, so any
 * listener that reacts to focus by MOVING something has to discriminate the two
 * or it will yank the UI out from under the pointer that is still mid-click.
 * `:focus-visible` is the browser's own answer to that question — the same
 * heuristic that decides whether to paint a focus ring — so it is used rather
 * than a hand-rolled "was there a recent pointerdown" latch: it already knows
 * about text inputs (always focus-visible, even on click), about keyboard
 * activation that follows a click, and about the platform's own conventions.
 *
 * Two listeners in this package depend on the rule and this is their single
 * authority:
 *
 * - `use-scrolling-gestures.ts` must not install wheel capture that outlives
 *   the pointer leaving, just because a click focused a card action.
 * - `use-scrolling-focus.ts` must not scroll the list on a mouse press. Its
 *   reveal exists so a Tab stop inside the edge fade becomes visible; running
 *   it on a click near the fade moved the list out from under the pointer and
 *   the click was silently swallowed — the keyboard fix breaking the mouse.
 *
 * Narrowing to `Element` is the caller's job (both listeners already do it),
 * which is what keeps this function DOM-library-free enough to unit test.
 */
export function isKeyboardFocus(target: Element | null): boolean {
	if (target === null) return false;
	return target.matches(":focus-visible");
}

/**
 * Ticker geometry the focus solver needs, in the ticker's own coordinate space.
 *
 * Everything here is a plain number, deliberately: none of it is a Ticker-owned
 * MotionValue (see `scrolling-offset-bridge.ts`).
 */
export interface FocusRevealGeometry {
	/**
	 * Ticker's `renderedOffset`, i.e. `wrap(-(pitch + inset), -inset, offset)`.
	 * Every reachable position of every card is a function of this one number.
	 */
	wrappedOffset: number;
	/** The ticker container's `padding-top`: list space to scrollport space. */
	inset: number;
	/** The focused card's static bounds within the list. */
	start: number;
	end: number;
	/** One loop period, `totalItemLength + gap`. */
	pitch: number;
	/**
	 * `pitch * (cloneCount + 1)` — the distance Ticker teleports an item by when
	 * it reprojects it to the far end of the loop. Equal to `pitch` only while
	 * there are no clones.
	 */
	listSize: number;
	/** The focused control's top edge, measured from its own `<li>`'s top. */
	intraTop: number;
	/** The focused control's height. */
	controlHeight: number;
	/** Scrollport height. */
	viewportHeight: number;
	/** Clearance each scrollport edge needs: edge fade plus focus-ring reach. */
	safeInset: number;
}

/**
 * Sub-pixel gap kept from the open end of a reprojection branch.
 *
 * Branch A is the half-open interval `v ∈ (-end, 0)`: landing exactly on `0`
 * would be wrapped straight back to `-pitch` and flip the card a whole loop
 * away, and landing exactly on `-end` is branch B's. Invisible at 1/1000 px.
 */
const BRANCH_EPSILON_PX = 1e-3;

/**
 * Ticker offset delta that brings a focused control as far inside the UNMASKED
 * band of the scrollport as Ticker's loop allows, or `0` when it already is.
 *
 * ## Why this is a solver and not a DOM-measured nudge
 *
 * The obvious implementation — measure the control with `getBoundingClientRect`
 * and add the shortfall to `offset` — assumes the control's on-screen y is an
 * affine function of `offset` with slope 1. Ticker breaks that at two coincident
 * discontinuities: the offset is wrapped into `[-(pitch + inset), -inset)`, and
 * each item's projection flips between `0` and `listSize` the instant its bottom
 * passes the port's top edge. Those two cancel exactly while `listSize === pitch`
 * (no clones) and leave a residual of `pitch * cloneCount` otherwise.
 *
 * Measured in-browser before this solver existed: at `viewportHeight` 480 every
 * Tab stop landed exactly where the nudge predicted, but at 540 and above —
 * where `calcNumClones` starts cloning — the same nudge overshot by exactly one
 * `pitch` (592px), parking the focus ring 492px below a 600px port, and a
 * second Tab wrote a full period, which is a no-op, so the stop stayed stuck
 * off-screen permanently.
 *
 * So solve in the ticker's own space instead. A card's top edge, in scrollport
 * coordinates, is exactly
 *
 * ```text
 * cardTop(v) = start + v + (v + end <= 0 ? listSize : 0),  v = wrappedOffset + inset
 * ```
 *
 * which is the same model `stack-layout.ts`'s `cardTopFrom` encodes. That gives
 * one candidate per projection branch, each clamped to its own domain. Both are
 * scored by how many px of the control still fall outside the safe band and the
 * lower score wins, so an unreachable target degrades to the closest reachable
 * position rather than to a wild jump.
 *
 * ## The residual this cannot fix
 *
 * With `cloneCount >= 1` the reachable positions of an original `.ticker-item`
 * have a HOLE in them, and for the first item (`start === 0`) that hole swallows
 * the whole safe band between roughly 540 and 710px of viewport height — the
 * visible slot is occupied by an inert `.clone-item`. Ticker only ever
 * reprojects forward, so no offset exists that clears the fade for that stop,
 * and `safeMargin` does not help: its backward branch needs
 * `start >= visibleLength + safeMargin`, which the first item never satisfies.
 * The solver clamps to flush-top there — visible, inside the fade — which is the
 * best reachable position, verified by sweeping a full period in the browser.
 *
 * Returns `0` for any non-finite or pre-measurement input; a scroller that
 * refuses to move is always better than one that writes `NaN` into the offset
 * (see this file's header).
 */
export function focusRevealOffset({
	controlHeight,
	end,
	inset,
	intraTop,
	listSize,
	pitch,
	safeInset,
	start,
	viewportHeight,
	wrappedOffset,
}: Readonly<FocusRevealGeometry>): number {
	const inputs = [
		controlHeight,
		end,
		inset,
		intraTop,
		listSize,
		pitch,
		safeInset,
		start,
		viewportHeight,
		wrappedOffset,
	];
	for (const input of inputs) {
		if (!isFiniteNumber(input)) return 0;
	}
	// Ticker reports `{ start: 0, end: 0 }` and a zero total until it measures.
	if (pitch <= 0 || listSize <= 0 || viewportHeight <= 0) return 0;
	if (end <= start || end > pitch) return 0;

	/** The card's laid-out top edge, in scrollport px, at shifted offset `v`. */
	const cardTopAt = (v: number): number => start + v + (v + end <= 0 ? listSize : 0);
	/** How many px of the control fall out past the TOP of the unmasked band. */
	const missAbove = (v: number): number => {
		const over = safeInset - (cardTopAt(v) + intraTop);
		return over > 0 ? over : 0;
	};
	/** How many px fall out past the BOTTOM. */
	const missBelow = (v: number): number => {
		const under = cardTopAt(v) + intraTop + controlHeight - (viewportHeight - safeInset);
		return under > 0 ? under : 0;
	};

	const current = wrappedOffset + inset;
	const currentTop = cardTopAt(current);
	const lowTarget = safeInset - intraTop;
	const highTarget = viewportHeight - safeInset - controlHeight - intraTop;
	// A control taller than the unmasked band can satisfy neither edge; pinning
	// its TOP keeps the label and the start of the focus ring visible.
	const desired = lowTarget > highTarget ? lowTarget : clampTo(currentTop, lowTarget, highTarget);
	if (desired === currentTop) return 0;

	// One candidate per projection branch. `cardTopAt` re-derives the branch
	// itself, so a clamped candidate is scored at its TRUE position, never at
	// the position the inverse assumed. Branch B's domain `[-pitch, -end]` is
	// always non-empty here: `end > pitch` returned above.
	const candidates = [current, clampTo(desired - start - listSize, -pitch, -end)];
	const branchLow = -end + BRANCH_EPSILON_PX;
	const branchHigh = -BRANCH_EPSILON_PX;
	if (branchLow <= branchHigh) candidates.push(clampTo(desired - start, branchLow, branchHigh));

	/** Shortest signed travel from `current`; the offset wraps with period `pitch`. */
	const travel = (v: number): number => {
		const raw = v - current;
		const shortest = raw - pitch * Math.round(raw / pitch);
		return isFiniteNumber(shortest) ? shortest : 0;
	};

	// Ranked lexicographically:
	//
	// 1. Total px of the control outside the unmasked band. This is what makes
	//    an unreachable stop degrade to the closest reachable position instead
	//    of to a wild jump.
	// 2. Px outside the TOP specifically. Only ever separates candidates that
	//    are equally bad overall — a control taller than the band, where moving
	//    it just trades top clipping for bottom clipping — and there, pinning
	//    the top keeps the label and the start of the focus ring visible.
	// 3. Least motion, so an already-clear control and a genuine tie both leave
	//    the list where the user put it.
	let best = 0;
	let bestMiss = Number.POSITIVE_INFINITY;
	let bestAbove = Number.POSITIVE_INFINITY;
	for (const candidate of candidates) {
		const above = missAbove(candidate);
		const miss = above + missBelow(candidate);
		const moved = travel(candidate);
		const better =
			miss !== bestMiss
				? miss < bestMiss
				: above !== bestAbove
					? above < bestAbove
					: Math.abs(moved) < Math.abs(best);
		if (!better) continue;
		best = moved;
		bestMiss = miss;
		bestAbove = above;
	}

	return unsigned(isFiniteNumber(best) ? best : 0);
}
