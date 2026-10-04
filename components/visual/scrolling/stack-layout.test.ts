import assert from "node:assert/strict";
import test from "node:test";

import { cardLoopPositionFrom, cardTopFrom, depthGate, depthLift, depthProgress, depthScale, fanAnchor, fansIn, fanSlack, stackZIndex, SCROLLING_DEPTHS, SCROLLING_ENTRANCE_ORIGINS, SCROLLING_STACK_ORDERS } from "./stack-layout.ts";

const NON_FINITE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined];

/** A 480px scrollport holding ~62px cards — the component's shipped defaults. */
const VIEWPORT = 480;
const CARD = 62;
/** One loop period at the shipped 8-item fixture: `totalItemLength + gap`. */
const PITCH = 592;

/** The eight cards' laid-out tops at the 480px default, in scrollport px. */
const TOPS_480 = [0, 74, 148, 222, 296, 370, 444, 518];
/**
 * At 720 Ticker clones once, and `offset === 0` puts the CLONES in the
 * scrollport with the originals a full period below it. Measured in-browser.
 */
const CLONE_TOPS_720 = TOPS_480.map((top) => top + 4);
const ORIGINAL_TOPS_720 = TOPS_480.map((top) => top + 4 + PITCH);

/* ------------------------------------------------------------------ anchor */

test("fanAnchor centres the deck in the scrollport by default", () => {
	assert.equal(fanAnchor("centre", VIEWPORT, CARD), 240);
	// The card's own height is irrelevant to a centred deck.
	assert.equal(fanAnchor("centre", VIEWPORT, 400), 240);
});

test("fanAnchor sits the deck flush against the top edge", () => {
	// Anchoring the card's CENTRE at half its height puts its TOP edge on 0, so
	// the collapsed deck is fully visible instead of half-clipped.
	assert.equal(fanAnchor("top", VIEWPORT, CARD), 31);
	assert.equal(fanAnchor("top", VIEWPORT, 100), 50);
});

test("fanAnchor sits the deck flush against the bottom edge", () => {
	assert.equal(fanAnchor("bottom", VIEWPORT, CARD), 449);
	assert.equal(fanAnchor("bottom", VIEWPORT, 100), 430);
});

test("fanAnchor keeps top and bottom symmetric about the centre", () => {
	const top = fanAnchor("top", VIEWPORT, CARD);
	const bottom = fanAnchor("bottom", VIEWPORT, CARD);
	assert.equal(VIEWPORT - bottom, top);
});

test("fanAnchor clamps a card taller than the scrollport into the scrollport", () => {
	// Half of 900 is 450, which would put the "top" anchor below the 300px
	// scrollport and the "bottom" anchor above its top edge.
	assert.equal(fanAnchor("top", 300, 900), 300);
	assert.equal(fanAnchor("bottom", 300, 900), 0);
});

test("fanAnchor is a no-op before Ticker has measured", () => {
	// containerLength 0 is Ticker's pre-measurement sentinel; a 0 anchor makes
	// fanOffset a no-op rather than slamming every card to the top edge.
	for (const origin of SCROLLING_ENTRANCE_ORIGINS) {
		assert.equal(fanAnchor(origin, 0, CARD), 0, origin);
		assert.equal(fanAnchor(origin, -10, CARD), 0, origin);
	}
});

test("fanAnchor returns 0 for every non-finite input", () => {
	for (const bad of NON_FINITE) {
		for (const origin of SCROLLING_ENTRANCE_ORIGINS) {
			assert.equal(fanAnchor(origin, bad as number, CARD), 0, `${origin} length=${String(bad)}`);
		}
	}
	// A non-finite card height must not poison an otherwise valid anchor.
	for (const bad of NON_FINITE) {
		assert.equal(fanAnchor("top", VIEWPORT, bad as number), 0, `height=${String(bad)}`);
		assert.equal(fanAnchor("bottom", VIEWPORT, bad as number), VIEWPORT, `height=${String(bad)}`);
		assert.equal(fanAnchor("centre", VIEWPORT, bad as number), 240, `height=${String(bad)}`);
	}
});

/* ------------------------------------------------- entrance participation */

test("fanSlack widens the window only when the loop is longer than the port", () => {
	// A loop longer than the scrollport is exactly the case where Ticker renders
	// NO clones, so a card just past an edge has no competing copy.
	assert.equal(fanSlack(PITCH, 480), 56);
	// At 720 the loop fits inside the port, Ticker clones, and the window has to
	// close down to the port itself.
	assert.equal(fanSlack(PITCH, 720), 0);
	assert.equal(fanSlack(PITCH, PITCH), 0);
});

test("fanSlack returns 0 for every non-finite input", () => {
	for (const bad of NON_FINITE) {
		assert.equal(fanSlack(bad as number, 480), 0, `pitch=${String(bad)}`);
		assert.equal(fanSlack(PITCH, bad as number), 0, `length=${String(bad)}`);
	}
});

test("fansIn keeps every card in the 480px default unfurling", () => {
	// The verified-good baseline. The window is [-56, 536], and the last card's
	// box [518, 580] still overlaps it, so all eight originals fan — the same
	// set the old `isClone` gate selected, since 480 renders no clones at all.
	for (const [index, top] of TOPS_480.entries()) {
		assert.equal(fansIn(top, CARD, VIEWPORT, PITCH), true, `card ${index} @${top}`);
	}
});

test("fansIn selects the copies on screen once Ticker clones", () => {
	// Measured at viewportHeight 720: the eight clones hold the scrollport while
	// the eight originals sit a whole period below it. Gating on `isClone` ran
	// the entire unfurl on the off-screen copies.
	for (const [index, top] of CLONE_TOPS_720.entries()) {
		assert.equal(fansIn(top, CARD, 720, PITCH), true, `clone ${index} @${top}`);
	}
	const originals = ORIGINAL_TOPS_720.map((top) => fansIn(top, CARD, 720, PITCH));
	// Only the two originals with pixels in the 720px port join in; the rest are
	// pinned off screen and must stay put.
	assert.deepEqual(originals, [true, true, false, false, false, false, false, false]);
});

test("fansIn admits every copy with pixels on screen, and little else", () => {
	// The window is `max(containerLength, pitch)` plus the card, centred on the
	// scrollport. It always contains the whole scrollport — so nothing visible
	// is ever frozen out — and it only reaches past the edges while the loop is
	// longer than the port, where anything it admits is clipped anyway.
	for (const containerLength of [200, 480, 592, 720, 1200]) {
		const slack = fanSlack(PITCH, containerLength);
		assert.ok(slack >= 0, `containerLength=${containerLength}`);
		assert.equal(2 * slack + containerLength, Math.max(containerLength, PITCH));
		// Anything inside the scrollport qualifies whatever its height.
		assert.equal(fansIn(0, CARD, containerLength, PITCH), true, `top @${containerLength}`);
		assert.equal(
			fansIn(containerLength - 1, CARD, containerLength, PITCH),
			true,
			`bottom @${containerLength}`,
		);
		// Anything a full period clear of the window never does.
		assert.equal(fansIn(containerLength + slack + PITCH, CARD, containerLength, PITCH), false);
	}
});

test("fansIn excludes a card entirely past either edge", () => {
	// A card wholly above the window, and one wholly below it.
	assert.equal(fansIn(-200, CARD, 720, PITCH), false);
	assert.equal(fansIn(900, CARD, 720, PITCH), false);
	// Touching the edge by a single pixel still counts.
	assert.equal(fansIn(-CARD + 1, CARD, 720, PITCH), true);
	assert.equal(fansIn(719, CARD, 720, PITCH), true);
});

test("fansIn fails animated before measurement and on every non-finite input", () => {
	// containerLength 0 is Ticker's pre-measurement sentinel. `fanAnchor` is 0
	// there too, so the fan is a no-op — but a card must never be silently
	// frozen out of its own entrance.
	assert.equal(fansIn(0, CARD, 0, 0), true);
	assert.equal(fansIn(0, CARD, -10, PITCH), true);
	for (const bad of NON_FINITE) {
		assert.equal(fansIn(bad as number, CARD, VIEWPORT, PITCH), true, `top=${String(bad)}`);
		assert.equal(fansIn(0, bad as number, VIEWPORT, PITCH), true, `height=${String(bad)}`);
		assert.equal(fansIn(0, CARD, bad as number, PITCH), true, `length=${String(bad)}`);
		// A non-finite pitch degrades to a plain "has pixels on screen" test.
		assert.equal(fansIn(0, CARD, VIEWPORT, bad as number), true, `pitch=${String(bad)}`);
		assert.equal(fansIn(-900, CARD, VIEWPORT, bad as number), false, `pitch=${String(bad)}`);
	}
});

/* ------------------------------------------------------------- stack order */

/** The shipped fixture's eight `start` values, i.e. the originals' bounds. */
const STARTS = [0, 74, 148, 222, 296, 370, 444, 518];

/**
 * One frame of Ticker's loop, reproduced from `TickerItem.mjs`.
 *
 * Every copy is `{ start }`; `listSize` is `pitch * (cloneCount + 1)`. An item
 * reprojects — is teleported a whole `listSize` to the far end — once its
 * bottom edge has passed the top of the scrollport. Returns each copy's live
 * top edge alongside the loop position `stackZIndex` consumes, so a test can
 * check that the paint order agrees with what is actually on screen.
 */
function loopFrame(
	starts: readonly number[],
	scrollOffset: number,
	listSize: number,
): { top: number; loopPosition: number }[] {
	return starts.map((start) => {
		const end = start + CARD;
		const reprojection = scrollOffset + end <= 0 ? listSize : 0;
		return {
			loopPosition: cardLoopPositionFrom(start, reprojection),
			top: cardTopFrom(scrollOffset, start, reprojection),
		};
	});
}

test("stackZIndex paints later cards above earlier ones for last-on-top", () => {
	const layers = STARTS.map((start) => stackZIndex("last-on-top", start));
	for (let i = 1; i < layers.length; i += 1) {
		assert.ok(layers[i] > layers[i - 1], `index=${i}`);
	}
});

test("stackZIndex reverses the deck for first-on-top", () => {
	const layers = STARTS.map((start) => stackZIndex("first-on-top", start));
	for (let i = 1; i < layers.length; i += 1) {
		assert.ok(layers[i] < layers[i - 1], `index=${i}`);
	}
});

test("stackZIndex is a strict mirror between the two orders", () => {
	// Every pair must sum to the SAME constant, at every reachable position —
	// that is what makes the two orders exact reflections of each other.
	const positions = [...STARTS, ...STARTS.map((start) => start + PITCH), -40, 0, 12345];
	const sums = positions.map(
		(position) => stackZIndex("last-on-top", position) + stackZIndex("first-on-top", position),
	);
	assert.equal(new Set(sums).size, 1, "the mirror constant drifted");
});

test("stackZIndex gives every copy on the list a distinct layer, clones included", () => {
	// Clones are separate `<li>` siblings in the same stacking context, so a
	// ladder keyed on the item index would hand a clone its original's rung.
	const copies = [...STARTS, ...STARTS.map((start) => start + PITCH)];
	for (const order of SCROLLING_STACK_ORDERS) {
		const layers = copies.map((start) => stackZIndex(order, start));
		assert.equal(new Set(layers).size, copies.length, order);
	}
});

test("stackZIndex stays monotonic across the loop wrap, in both directions", () => {
	// The regression this ladder exists for. A ladder keyed on the static item
	// index climbs 0..n-1 and then RESETS, so once per period the card that has
	// just reprojected to the top of the list still outranks the card below it
	// and the pair paints inverted — one visible seam per loop, exactly where
	// the depth tail has made the two overlap.
	for (const cloneCount of [0, 1]) {
		const listSize = PITCH * (cloneCount + 1);
		// Ticker offsets each clone group's bounds by a whole period, so the
		// clones are just more copies with larger `start`s.
		const copies: number[] = [];
		for (let group = 0; group <= cloneCount; group += 1) {
			copies.push(...STARTS.map((start) => start + PITCH * group));
		}
		// A full period, sampled finely enough to catch every single reprojection.
		for (let step = 0; step <= 120; step += 1) {
			const scrollOffset = -(PITCH * step) / 120;
			const frame = loopFrame(copies, scrollOffset, listSize);
			const byPosition = [...frame].sort((a, b) => a.top - b.top);
			for (const order of SCROLLING_STACK_ORDERS) {
				const layers = byPosition.map((copy) => stackZIndex(order, copy.loopPosition));
				for (let i = 1; i < layers.length; i += 1) {
					const rising = layers[i] > layers[i - 1];
					assert.equal(
						rising,
						order === "last-on-top",
						`${order} inverted at offset=${scrollOffset.toFixed(1)} clones=${cloneCount} pair=${i}`,
					);
				}
			}
		}
	}
});

test("stackZIndex bottoms out rather than dropping a card out of the paint order", () => {
	for (const order of SCROLLING_STACK_ORDERS) {
		for (const bad of NON_FINITE) {
			assert.equal(stackZIndex(order, bad as number), 0, `${order} position=${String(bad)}`);
		}
		// Every reachable position must stay a usable, non-negative layer.
		for (const position of [-1e9, -40, 0, 1e9]) {
			const layer = stackZIndex(order, position);
			assert.ok(Number.isInteger(layer), `${order} position=${position} is not an integer`);
			assert.ok(layer >= 0, `${order} position=${position} went negative`);
		}
	}
});

/* ---------------------------------------------------------- depth progress */

test("depthProgress leaves a card in open space alone", () => {
	assert.equal(depthProgress(240, VIEWPORT, 160, "bottom"), 0);
});

test("depthProgress ramps 0 to 1 across the bottom zone", () => {
	// Zone spans 320..480 for a 160px zone in a 480px scrollport.
	assert.equal(depthProgress(320, VIEWPORT, 160, "bottom"), 0);
	assert.equal(depthProgress(400, VIEWPORT, 160, "bottom"), 0.5);
	assert.equal(depthProgress(480, VIEWPORT, 160, "bottom"), 1);
});

test("depthProgress clamps past the scrollport edge instead of overshooting", () => {
	assert.equal(depthProgress(2000, VIEWPORT, 160, "bottom"), 1);
});

test("depthProgress signs the top edge negative, and only for depth both", () => {
	// A card at the very top of the scrollport.
	assert.equal(depthProgress(10, VIEWPORT, 160, "bottom"), 0);
	const both = depthProgress(10, VIEWPORT, 160, "both");
	assert.ok(both < 0, `expected a negative (top-edge) progress, got ${both}`);
	assert.ok(Math.abs(both) > 0.9);
});

test("depthProgress picks the nearer edge when the zones overlap", () => {
	// A 200px scrollport with a 160px zone: the two zones overlap across 120px.
	assert.ok(depthProgress(150, 200, 160, "both") > 0, "nearer the bottom");
	assert.ok(depthProgress(50, 200, 160, "both") < 0, "nearer the top");
});

test("depthProgress is disabled entirely for depth none", () => {
	for (const centre of [0, 240, 470, 10_000]) {
		assert.equal(depthProgress(centre, VIEWPORT, 160, "none"), 0, `centre=${centre}`);
	}
});

test("depthProgress is inert before measurement and for a zero-width zone", () => {
	assert.equal(depthProgress(240, 0, 160, "bottom"), 0);
	assert.equal(depthProgress(240, VIEWPORT, 0, "bottom"), 0);
	assert.equal(depthProgress(240, VIEWPORT, -20, "bottom"), 0);
});

test("depthProgress returns 0 for every non-finite input", () => {
	for (const bad of NON_FINITE) {
		for (const depth of SCROLLING_DEPTHS) {
			assert.equal(depthProgress(bad as number, VIEWPORT, 160, depth), 0, `centre=${String(bad)}`);
			assert.equal(depthProgress(240, bad as number, 160, depth), 0, `length=${String(bad)}`);
			assert.equal(depthProgress(240, VIEWPORT, bad as number, depth), 0, `zone=${String(bad)}`);
		}
	}
});

/* ------------------------------------------------------------- depth scale */

test("depthScale eases from full size down to the floor", () => {
	assert.equal(depthScale(0, 0.88), 1);
	assert.equal(depthScale(1, 0.88), 0.88);
});

test("depthScale is quadratic, so the shrink bites late rather than early", () => {
	// Linear would put the halfway point at 0.94; quadratic keeps it near 0.97,
	// which is what stops the whole list reading as if it were breathing.
	const half = depthScale(0.5, 0.88);
	assert.ok(half > 0.96 && half < 0.98, `got ${half}`);
	assert.ok(depthScale(0.25, 0.88) > depthScale(0.5, 0.88));
	assert.ok(depthScale(0.5, 0.88) > depthScale(0.75, 0.88));
});

test("depthScale is symmetric across both edges", () => {
	// The sign carries the edge; the shrink must not care which one.
	assert.equal(depthScale(0.7, 0.88), depthScale(-0.7, 0.88));
});

test("depthScale never leaves the 0..1 band", () => {
	for (let p = -1; p <= 2; p += 0.05) {
		const scale = depthScale(p, 0.88);
		assert.ok(scale >= 0.88 && scale <= 1, `progress=${p} -> ${scale}`);
	}
	// A nonsense floor must still produce a usable scale.
	assert.equal(depthScale(1, -5), 0);
	assert.equal(depthScale(1, 9), 1);
});

test("depthScale fails full-size on every non-finite input", () => {
	for (const bad of NON_FINITE) {
		assert.equal(depthScale(bad as number, 0.88), 1, `progress=${String(bad)}`);
		assert.equal(depthScale(1, bad as number), 1, `minScale=${String(bad)}`);
	}
});

/* -------------------------------------------------------------- depth lift */

test("depthLift pulls a bottom-edge card up and a top-edge card down", () => {
	assert.ok(depthLift(1, 56) < 0, "bottom edge lifts up");
	assert.ok(depthLift(-1, 56) > 0, "top edge pushes down");
	assert.equal(depthLift(1, 56), -56);
	assert.equal(depthLift(-1, 56), 56);
});

test("depthLift is a no-op in open space", () => {
	assert.equal(depthLift(0, 56), 0);
});

test("depthLift stays in step with depthScale", () => {
	// Both ramps are quadratic so the tuck and the shrink land together; a card
	// that has shrunk halfway toward the floor has also tucked halfway.
	const p = 0.6;
	const scaleProgress = (1 - depthScale(p, 0.5)) / 0.5;
	const liftProgress = Math.abs(depthLift(p, 100)) / 100;
	assert.ok(Math.abs(scaleProgress - liftProgress) < 1e-9);
});

test("depthLift returns 0 for every non-finite input", () => {
	for (const bad of NON_FINITE) {
		assert.equal(depthLift(bad as number, 56), 0, `progress=${String(bad)}`);
		assert.equal(depthLift(1, bad as number), 0, `liftPx=${String(bad)}`);
	}
});

/* -------------------------------------------------------------- depth gate */

/**
 * The collapse at which the entrance's opacity ramp finishes, i.e. what
 * `scrolling-card.tsx` passes as `holdAbove`. Pinned to `FAN_OPACITY_INPUT[1]`
 * in `lib.ts`, which `lib.test.ts` guards.
 */
const HOLD_ABOVE = 0.55;

test("depthGate holds the tail off entirely while the entrance is still fading", () => {
	// collapse 1 is the fully stacked deck, 0 the laid-out list. Anywhere at or
	// above the knot the gate must be EXACTLY 0, so `scale` is exactly 1 and
	// only `y` and `opacity` are in flight. Two properties, never three.
	assert.equal(depthGate(1, HOLD_ABOVE), 0);
	assert.equal(depthGate(0.8, HOLD_ABOVE), 0);
	assert.equal(depthGate(HOLD_ABOVE, HOLD_ABOVE), 0);
});

test("depthGate ramps the tail in continuously below the knot", () => {
	assert.equal(depthGate(HOLD_ABOVE / 2, HOLD_ABOVE), 0.5);
	assert.equal(depthGate(0, HOLD_ABOVE), 1);
	// Continuous at the knot: no jump as the tail engages.
	assert.ok(depthGate(HOLD_ABOVE - 1e-6, HOLD_ABOVE) < 1e-5);
	// And monotonic all the way down.
	let previous = -1;
	for (let collapse = 1; collapse >= 0; collapse -= 0.02) {
		const gate = depthGate(collapse, HOLD_ABOVE);
		assert.ok(gate >= previous, `gate fell at collapse=${collapse.toFixed(2)}`);
		previous = gate;
	}
});

test("depthGate clamps outside the collapse range", () => {
	assert.equal(depthGate(-3, HOLD_ABOVE), 1);
	assert.equal(depthGate(4, HOLD_ABOVE), 0);
});

test("depthGate falls back to a plain ramp when nothing is held back", () => {
	assert.equal(depthGate(0.5, 0), 0.5);
	assert.equal(depthGate(1, 0), 0);
	assert.equal(depthGate(0, 0), 1);
	for (const bad of NON_FINITE) {
		assert.equal(depthGate(0.5, bad as number), 0.5, `holdAbove=${String(bad)}`);
	}
});

test("depthGate fails fully-applied on a non-finite collapse", () => {
	// The settled list is the state this component spends its life in.
	for (const bad of NON_FINITE) {
		assert.equal(depthGate(bad as number, HOLD_ABOVE), 1, `collapse=${String(bad)}`);
	}
});

/* -------------------------------------------------------------- contracts */

test("the exported option lists are the contract the props and demo share", () => {
	assert.deepEqual([...SCROLLING_ENTRANCE_ORIGINS], ["centre", "top", "bottom"]);
	assert.deepEqual([...SCROLLING_STACK_ORDERS], ["last-on-top", "first-on-top"]);
	assert.deepEqual([...SCROLLING_DEPTHS], ["none", "bottom", "both"]);
});

test("a full bottom-zone sweep is monotonic in both scale and lift", () => {
	// The guarantee that makes the tail read as a deck rather than a jitter.
	let lastScale = Number.POSITIVE_INFINITY;
	let lastLift = Number.POSITIVE_INFINITY;
	for (let centre = 320; centre <= 480; centre += 8) {
		const progress = depthProgress(centre, VIEWPORT, 160, "bottom");
		const scale = depthScale(progress, 0.88);
		const lift = depthLift(progress, 56);
		assert.ok(scale <= lastScale, `scale rose at centre=${centre}`);
		assert.ok(lift <= lastLift, `lift rose at centre=${centre}`);
		lastScale = scale;
		lastLift = lift;
	}
	assert.ok(lastScale < 1, "the deepest card must actually be scaled");
	assert.ok(lastLift < 0, "the deepest card must actually be tucked");
});

test("the depth tail is inert until the entrance has finished fading", () => {
	// The two-property budget in `.agents/rules/motion-decisions.md`, expressed
	// as the property it is actually about: while `opacity` is still ramping,
	// `scale` must not move at all. `depthScale(0) === 1` exactly.
	const progress = depthProgress(470, VIEWPORT, 160, "bottom");
	assert.ok(progress > 0, "the sample card is genuinely inside the zone");
	for (let collapse = 1; collapse >= HOLD_ABOVE; collapse -= 0.05) {
		const tail = depthGate(collapse, HOLD_ABOVE) * progress;
		assert.equal(tail, 0, `tail engaged at collapse=${collapse.toFixed(2)}`);
		assert.equal(depthScale(tail, 0.88), 1, `scale moved at collapse=${collapse.toFixed(2)}`);
		assert.equal(depthLift(tail, 56), 0, `lift moved at collapse=${collapse.toFixed(2)}`);
	}
	assert.equal(depthGate(0, HOLD_ABOVE) * progress, progress, "laid-out list -> full tail");
});

/* ---------------------------------------------------------------- card top */

test("cardTopFrom sums the scroll offset, the static start and the loop reprojection", () => {
	assert.equal(cardTopFrom(0, 0, 0), 0);
	assert.equal(cardTopFrom(-120, 296, 0), 176);
	// A reprojected card has been teleported a whole list length to the far end.
	assert.equal(cardTopFrom(-120, 296, -592), -416);
	assert.equal(cardTopFrom(-120, 296, 592), 768);
});

test("cardTopFrom tracks the scroll offset one-for-one", () => {
	// The whole point of the bridge: as the list scrolls, every card's top moves
	// with it. A frozen result here is the bug this function exists to prevent.
	const start = 296;
	const tops = [0, -100, -200, -300].map((offset) => cardTopFrom(offset, start, 0));
	assert.deepEqual(tops, [296, 196, 96, -4]);
});

test("cardTopFrom is total for every non-finite input", () => {
	for (const bad of NON_FINITE) {
		assert.equal(cardTopFrom(bad as number, 100, 0), 0);
		assert.equal(cardTopFrom(-120, bad as number, 0), 0);
		assert.equal(cardTopFrom(-120, 100, bad as number), 0);
	}
	// Infinities that would otherwise cancel to NaN.
	assert.equal(cardTopFrom(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0), 0);
});

test("cardTopFrom normalises negative zero", () => {
	assert.equal(Object.is(cardTopFrom(-100, 100, 0), -0), false);
	assert.equal(cardTopFrom(-100, 100, 0), 0);
});

/* ------------------------------------------------------------ loop position */

test("cardLoopPositionFrom is cardTopFrom without the shared scroll offset", () => {
	assert.equal(cardLoopPositionFrom(296, 0), 296);
	assert.equal(cardLoopPositionFrom(296, 592), 888);
	assert.equal(cardLoopPositionFrom(0, 0), 0);
});

test("cardLoopPositionFrom sorts the copies exactly as their live tops do", () => {
	// The whole justification for using it in place of the live top: the term
	// that is missing is the same number for every copy, so the ORDER cannot
	// differ — and unlike the top, this one only moves when a card reprojects.
	for (const listSize of [PITCH, PITCH * 2]) {
		for (let step = 0; step <= 60; step += 1) {
			const scrollOffset = -(PITCH * step) / 60;
			const frame = loopFrame(STARTS, scrollOffset, listSize);
			const byTop = [...frame].sort((a, b) => a.top - b.top);
			const byLoop = [...frame].sort((a, b) => a.loopPosition - b.loopPosition);
			assert.deepEqual(byLoop, byTop, `diverged at offset=${scrollOffset.toFixed(1)}`);
		}
	}
});

test("cardLoopPositionFrom is total for every non-finite input", () => {
	for (const bad of NON_FINITE) {
		assert.equal(cardLoopPositionFrom(bad as number, 0), 0);
		assert.equal(cardLoopPositionFrom(296, bad as number), 0);
	}
	assert.equal(cardLoopPositionFrom(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY), 0);
	assert.equal(Object.is(cardLoopPositionFrom(-100, 100), -0), false);
});
