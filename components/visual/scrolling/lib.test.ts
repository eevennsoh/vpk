import assert from "node:assert/strict";
import test from "node:test";

import { fanOffset, fanOpacity, focusRevealOffset, isKeyboardFocus, shouldCaptureWheel, wheelDeltaPx, FAN_OPACITY_INPUT, FAN_OPACITY_OUTPUT } from "./lib.ts";

const NON_FINITE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined];

test("fanOffset pulls a card above the centre downward", () => {
	// Container centre 240, card centre 31 -> the card must travel down (+).
	assert.equal(fanOffset(1, 31, 240), 209);
	assert.ok(fanOffset(0.5, 31, 240) > 0);
});

test("fanOffset pulls a card below the centre upward", () => {
	// Container centre 240, card centre 420 -> the card must travel up (-).
	assert.equal(fanOffset(1, 420, 240), -180);
	assert.ok(fanOffset(0.5, 420, 240) < 0);
});

test("fanOffset leaves a card already on the centre alone", () => {
	assert.equal(fanOffset(1, 240, 240), 0);
	assert.equal(fanOffset(0.5, 240, 240), 0);
	assert.equal(fanOffset(0, 240, 240), 0);
});

test("fanOffset is symmetric about the container centre", () => {
	// Equal distances either side of the centre travel equal, opposite amounts:
	// that symmetry is what makes the deck unfurl rather than slide.
	assert.equal(fanOffset(1, 140, 240), -fanOffset(1, 340, 240));
});

test("fanOffset scales linearly with collapse and is a no-op at zero", () => {
	assert.equal(fanOffset(0.25, 40, 240), 50);
	assert.equal(fanOffset(0.5, 40, 240), 100);
	for (const centre of [-500, 0, 31, 240, 1200]) {
		assert.equal(fanOffset(0, centre, 240), 0, `centre=${centre}`);
	}
});

test("fanOffset returns 0 for every non-finite input", () => {
	for (const bad of NON_FINITE) {
		assert.equal(fanOffset(bad as number, 31, 240), 0, `collapse=${String(bad)}`);
		assert.equal(fanOffset(1, bad as number, 240), 0, `centre=${String(bad)}`);
		assert.equal(fanOffset(1, 31, bad as number), 0, `containerCentre=${String(bad)}`);
	}
	// 0 * Infinity is NaN; Infinity - Infinity is NaN. Both must be absorbed.
	assert.equal(fanOffset(0, Number.POSITIVE_INFINITY, 240), 0);
	assert.equal(fanOffset(1, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY), 0);
});

test("fanOpacity hits the documented knots", () => {
	const [inStart, inEnd] = FAN_OPACITY_INPUT;
	const [outStart, outEnd] = FAN_OPACITY_OUTPUT;
	assert.equal(fanOpacity(inStart), outStart);
	assert.equal(fanOpacity(inEnd), outEnd);
	// Cards resolve as they separate, so the halfway point is already visible.
	assert.ok(fanOpacity(0.775) > 0.49 && fanOpacity(0.775) < 0.51);
});
test("fanOpacity clamps outside the input range", () => {
	assert.equal(fanOpacity(0), 1);
	assert.equal(fanOpacity(-4), 1);
	assert.equal(fanOpacity(2), 0);
	for (let collapse = -1; collapse <= 2; collapse += 0.05) {
		const opacity = fanOpacity(collapse);
		assert.ok(opacity >= 0 && opacity <= 1, `collapse=${collapse} -> ${opacity}`);
	}
});

test("fanOpacity fails visible on every non-finite input", () => {
	for (const bad of NON_FINITE) {
		assert.equal(fanOpacity(bad as number), 1, `collapse=${String(bad)}`);
	}
});

test("the exported opacity knots are the contract the fan transform reads", () => {
	// `scrolling-card.tsx` calls `fanOpacity` per frame rather than handing
	// Motion a range pair, so a drift here silently changes the animation
	// without failing anything else.
	assert.deepEqual([...FAN_OPACITY_INPUT], [1, 0.55]);
	assert.deepEqual([...FAN_OPACITY_OUTPUT], [0, 1]);
	assert.equal(FAN_OPACITY_INPUT.length, FAN_OPACITY_OUTPUT.length);
});

test("shouldCaptureWheel never claims the wheel while disengaged", () => {
	// The whole point of the engagement gate: a reader whose pointer merely
	// crosses the component on the way down the page keeps their page scroll.
	assert.equal(shouldCaptureWheel(false, 0, 120), false);
	assert.equal(shouldCaptureWheel(false, 0, -120), false);
	assert.equal(shouldCaptureWheel(false, 120, 0), false);
});

test("shouldCaptureWheel claims a vertical wheel once engaged", () => {
	assert.equal(shouldCaptureWheel(true, 0, 120), true);
	assert.equal(shouldCaptureWheel(true, 0, -120), true);
	// A dominant vertical component still counts as ours.
	assert.equal(shouldCaptureWheel(true, 12, 120), true);
});

test("shouldCaptureWheel never swallows horizontal intent", () => {
	// A two-finger swipe-back arrives as deltaX with deltaY === 0; preventing
	// it would strand the user on the page.
	assert.equal(shouldCaptureWheel(true, 120, 0), false);
	assert.equal(shouldCaptureWheel(true, -120, 0), false);
	assert.equal(shouldCaptureWheel(true, 120, 60), false);
	// A perfect diagonal is a tie, and a tie is not "dominant horizontal", so
	// the list keeps it — matching the drag axis the component actually owns.
	assert.equal(shouldCaptureWheel(true, 120, 120), true);
});

test("shouldCaptureWheel ignores a wheel with no vertical delta", () => {
	assert.equal(shouldCaptureWheel(true, 0, 0), false);
});

test("shouldCaptureWheel refuses every non-finite delta", () => {
	for (const bad of NON_FINITE) {
		assert.equal(shouldCaptureWheel(true, bad as number, 120), false, `deltaX=${String(bad)}`);
		assert.equal(shouldCaptureWheel(true, 0, bad as number), false, `deltaY=${String(bad)}`);
	}
});

/* --------------------------------------------------- wheel delta conversion */

/** Matches `SCROLLING_WHEEL_LINE_PX` in `data.ts` (ADS `space.250`). */
const LINE_PX = 20;
/** The default scrollport, i.e. what one `DOM_DELTA_PAGE` unit is worth. */
const PAGE_PX = 480;

test("wheelDeltaPx passes a DOM_DELTA_PIXEL delta straight through", () => {
	assert.equal(wheelDeltaPx(120, 0, LINE_PX, PAGE_PX), 120);
	assert.equal(wheelDeltaPx(-53.5, 0, LINE_PX, PAGE_PX), -53.5);
	assert.equal(wheelDeltaPx(0, 0, LINE_PX, PAGE_PX), 0);
});

test("wheelDeltaPx scales a DOM_DELTA_LINE notch by the line height", () => {
	// Firefox reports 3 units per notch. Raw, that advanced the list 3px.
	assert.equal(wheelDeltaPx(3, 1, LINE_PX, PAGE_PX), 60);
	assert.equal(wheelDeltaPx(-3, 1, LINE_PX, PAGE_PX), -60);
});

test("wheelDeltaPx scales a DOM_DELTA_PAGE notch by the scrollport", () => {
	// One unit is one screenful, not one pixel.
	assert.equal(wheelDeltaPx(1, 2, LINE_PX, PAGE_PX), 480);
	assert.equal(wheelDeltaPx(-2, 2, LINE_PX, PAGE_PX), -960);
});

test("wheelDeltaPx treats an unrecognised mode as pixels", () => {
	// The safest reading of a mode we do not know: every browser that has only
	// ever sent one mode sends pixels.
	for (const mode of [3, -1, 99, Number.NaN, undefined]) {
		assert.equal(wheelDeltaPx(120, mode as number, LINE_PX, PAGE_PX), 120, `mode=${String(mode)}`);
	}
});

test("wheelDeltaPx returns 0 for every non-finite delta", () => {
	for (const bad of NON_FINITE) {
		for (const mode of [0, 1, 2]) {
			assert.equal(
				wheelDeltaPx(bad as number, mode, LINE_PX, PAGE_PX),
				0,
				`deltaY=${String(bad)} mode=${mode}`,
			);
		}
	}
});

test("wheelDeltaPx refuses a non-finite or unmeasured scale rather than guessing", () => {
	// `clientHeight` is 0 before layout, and a poisoned constant must never
	// reach the offset MotionValue: one NaN frame kills it for good.
	for (const bad of [...NON_FINITE, 0, -20]) {
		assert.equal(wheelDeltaPx(3, 1, bad as number, PAGE_PX), 0, `linePx=${String(bad)}`);
		assert.equal(wheelDeltaPx(1, 2, LINE_PX, bad as number), 0, `pagePx=${String(bad)}`);
	}
	// A finite delta against a finite scale can still overflow to Infinity.
	assert.equal(wheelDeltaPx(Number.MAX_VALUE, 1, LINE_PX, PAGE_PX), 0);
	// The unused scale never matters, in either direction.
	assert.equal(wheelDeltaPx(3, 1, LINE_PX, Number.NaN), 60);
	assert.equal(wheelDeltaPx(1, 2, Number.NaN, PAGE_PX), 480);
});

/* ------------------------------------------------------------- focus origin */

/** The one method `isKeyboardFocus` uses, so a stub is a faithful element. */
function elementMatching(selectors: readonly string[]): Element {
	return { matches: (selector: string) => selectors.includes(selector) } as unknown as Element;
}

test("isKeyboardFocus accepts a control the browser would ring", () => {
	assert.equal(isKeyboardFocus(elementMatching([":focus", ":focus-visible"])), true);
});

test("isKeyboardFocus rejects focus a mouse press produced", () => {
	// A click on a button focuses it WITHOUT `:focus-visible`. Both listeners
	// that consume this rule must ignore that focus: one would install wheel
	// capture the pointer never asked for, the other would scroll the list out
	// from under the pointer before the click resolved.
	assert.equal(isKeyboardFocus(elementMatching([":focus"])), false);
});

test("isKeyboardFocus rejects a missing target rather than throwing", () => {
	assert.equal(isKeyboardFocus(null), false);
});

/* ------------------------------------------------------- focus reveal solver */

/**
 * The component's measured defaults at the shipped 8-item fixture: 62px cards,
 * a 12px gap, 4px of container padding, and a card action 18px down its own
 * `<li>`. `pitch` is `totalItemLength (580) + gap (12)`.
 */
const CARD_HEIGHT = 62;
const PITCH = 592;
const INSET = 4;
/** `SCROLLING_FADE_PX + 4`, the outward reach of the cards' focus ring. */
const SAFE = 76;
const INTRA_TOP = 18;
const CONTROL_HEIGHT = 24;
const CARD_COUNT = 8;

function cardBounds(index: number): { start: number; end: number } {
	const start = index * (CARD_HEIGHT + 12);
	return { end: start + CARD_HEIGHT, start };
}

/** Ticker's own wrap: `wrap(-(pitch + inset), -inset, offset)`. */
function wrapOffset(offset: number): number {
	const min = -(PITCH + INSET);
	return ((((offset - min) % PITCH) + PITCH) % PITCH) + min;
}

/** Ticker's own item model, in scrollport px. */
function cardTopAt(index: number, wrapped: number, cloneCount: number): number {
	const { end, start } = cardBounds(index);
	const shifted = wrapped + INSET;
	return start + shifted + (shifted + end <= 0 ? PITCH * (cloneCount + 1) : 0);
}

function solve(index: number, wrapped: number, cloneCount: number, viewportHeight: number) {
	const { end, start } = cardBounds(index);
	const delta = focusRevealOffset({
		controlHeight: CONTROL_HEIGHT,
		end,
		inset: INSET,
		intraTop: INTRA_TOP,
		listSize: PITCH * (cloneCount + 1),
		pitch: PITCH,
		safeInset: SAFE,
		start,
		viewportHeight,
		wrappedOffset: wrapped,
	});
	const settled = wrapOffset(wrapped + delta);
	const top = cardTopAt(index, settled, cloneCount) + INTRA_TOP;
	return { bottom: top + CONTROL_HEIGHT, delta, top };
}

test("focusRevealOffset reproduces the verified no-clone deltas exactly", () => {
	// Measured in-browser at viewportHeight 480 (where Ticker renders no clones):
	// the last card's Resume/Hide sat at y 516-540, entirely outside a 480px box,
	// and the old DOM-nudge implementation moved the offset by -136.
	assert.equal(solve(7, -24, 0, 480).delta, -136);
	// Measured: the first Tab stop landed at y 5-29, inside the top fade band.
	// The solver reaches the same rendered position; the raw candidate is a whole
	// period away, so the returned delta is normalised to the shorter equivalent.
	assert.equal(solve(0, -17, 0, 480).delta, 71);
});

test("focusRevealOffset leaves an already-clear control alone", () => {
	// Card 3 sitting mid-port with its action well inside the unmasked band.
	const wrapped = -24;
	assert.ok(cardTopAt(3, wrapped, 0) + INTRA_TOP > SAFE);
	assert.equal(solve(3, wrapped, 0, 480).delta, 0);
});

test("focusRevealOffset clears the safe band from every offset with no clones", () => {
	// The verified-good 480 behaviour, swept rather than sampled: with no clones
	// the wrap and the reprojection cancel, so every stop is reachable.
	for (let index = 0; index < CARD_COUNT; index += 1) {
		for (let wrapped = -(PITCH + INSET); wrapped < -INSET; wrapped += 7) {
			const { bottom, top } = solve(index, wrapped, 0, 480);
			assert.ok(top >= SAFE - 1e-6, `card ${index} offset ${wrapped} -> top ${top}`);
			assert.ok(bottom <= 480 - SAFE + 1e-6, `card ${index} offset ${wrapped} -> bottom ${bottom}`);
		}
	}
});

test("focusRevealOffset is never off by a whole list length once clones exist", () => {
	// The bug this solver replaces: at viewportHeight 600 Ticker renders one
	// clone group, so a DOM-measured nudge overshot by exactly one pitch and
	// parked the focus ring 492px below a 600px port. Every card except the
	// first is genuinely reachable, and must land in the band.
	for (let index = 1; index < CARD_COUNT; index += 1) {
		for (let wrapped = -(PITCH + INSET); wrapped < -INSET; wrapped += 7) {
			const { bottom, top } = solve(index, wrapped, 1, 600);
			assert.ok(top >= SAFE - 1e-6, `card ${index} offset ${wrapped} -> top ${top}`);
			assert.ok(bottom <= 600 - SAFE + 1e-6, `card ${index} offset ${wrapped} -> bottom ${bottom}`);
		}
	}
});

test("focusRevealOffset clamps the unreachable first card to flush top", () => {
	// With one clone group the reachable positions of ORIGINAL card 0 are
	// cardTop in (-62, 0) or [592, 1122] — the safe band falls in the hole
	// between them, and the visible slot is held by an inert `.clone-item`.
	// Ticker only reprojects forward, so the best available answer is flush
	// against the top edge: visible, but inside the fade. Proven in-browser by
	// sweeping a full period. What must NEVER happen again is parking the ring
	// entirely outside the port.
	for (let wrapped = -(PITCH + INSET); wrapped < -INSET; wrapped += 7) {
		const { bottom, top } = solve(0, wrapped, 1, 600);
		assert.ok(top >= 0, `offset ${wrapped} -> top ${top}`);
		assert.ok(top < SAFE, `offset ${wrapped} -> top ${top} (should be unreachable)`);
		assert.ok(bottom <= 600, `offset ${wrapped} -> bottom ${bottom}`);
	}
});

test("focusRevealOffset never lands a reachable control worse than it started", () => {
	const missBy = (top: number, viewportHeight: number) =>
		Math.max(0, SAFE - top) + Math.max(0, top + CONTROL_HEIGHT - (viewportHeight - SAFE));
	for (const cloneCount of [0, 1, 2]) {
		for (let index = 0; index < CARD_COUNT; index += 1) {
			for (let wrapped = -(PITCH + INSET); wrapped < -INSET; wrapped += 11) {
				const before = missBy(cardTopAt(index, wrapped, cloneCount) + INTRA_TOP, 600);
				const after = missBy(solve(index, wrapped, cloneCount, 600).top, 600);
				assert.ok(after <= before + 1e-6, `clones ${cloneCount} card ${index} @${wrapped}`);
			}
		}
	}
});

test("focusRevealOffset pins the top of a control taller than the band", () => {
	// Taller than the unmasked band, so neither edge can be satisfied. Pinning
	// the TOP keeps the label and the start of the ring visible.
	const { end, start } = cardBounds(0);
	const delta = focusRevealOffset({
		controlHeight: 480,
		end,
		inset: INSET,
		intraTop: 0,
		listSize: PITCH,
		pitch: PITCH,
		safeInset: SAFE,
		start,
		viewportHeight: 480,
		wrappedOffset: -INSET - 1,
	});
	assert.equal(cardTopAt(0, wrapOffset(-INSET - 1 + delta), 0), SAFE);
});

test("focusRevealOffset refuses to move before Ticker has measured", () => {
	const base = {
		controlHeight: CONTROL_HEIGHT,
		end: CARD_HEIGHT,
		inset: INSET,
		intraTop: INTRA_TOP,
		listSize: PITCH,
		pitch: PITCH,
		safeInset: SAFE,
		start: 0,
		viewportHeight: 480,
		wrappedOffset: -INSET - 1,
	};
	// Ticker's pre-measurement sentinels.
	assert.equal(focusRevealOffset({ ...base, end: 0, start: 0 }), 0);
	assert.equal(focusRevealOffset({ ...base, listSize: 0, pitch: 0 }), 0);
	assert.equal(focusRevealOffset({ ...base, viewportHeight: 0 }), 0);
	// An item taller than a whole loop period is not a geometry we can solve.
	assert.equal(focusRevealOffset({ ...base, end: PITCH + 1 }), 0);
});

test("focusRevealOffset returns 0 for every non-finite input", () => {
	const base = {
		controlHeight: CONTROL_HEIGHT,
		end: CARD_HEIGHT,
		inset: INSET,
		intraTop: INTRA_TOP,
		listSize: PITCH,
		pitch: PITCH,
		safeInset: SAFE,
		start: 0,
		viewportHeight: 480,
		wrappedOffset: -INSET - 1,
	};
	for (const key of Object.keys(base) as (keyof typeof base)[]) {
		for (const bad of NON_FINITE) {
			assert.equal(
				focusRevealOffset({ ...base, [key]: bad as number }),
				0,
				`${key}=${String(bad)}`,
			);
		}
	}
});
