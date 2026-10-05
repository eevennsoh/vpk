import { ISSUE_DROP_REVEAL_PENDING_SELECTOR } from "@/components/blocks/jira-kanban/experimental/lib/issue-solitaire-drop";

import type { FinaleConfettiBox } from "./finale-confetti";
import {
	FINALE_ARRIVING_CARD_SELECTOR,
	finaleCardCode,
	finaleCornerRadius,
	queryFinaleCardList,
	queryJiraTeamEu26DoneCards,
	queryJiraTeamEu26DoneColumn,
} from "./capture-done-column";
import { waitForFinaleStillFrames } from "./finale-frame-wait";

/**
 * Longest a drop's puff waits for its cards to come to rest. The board reveals
 * a single card in its slot once its neighbours have reflowed (~150ms after
 * the move commits), and a bulk drop's stack is already down in its lead's
 * slot on the commit itself, so every board drop resolves well inside this.
 * The bound only catches slower arrivals (a created card's receipt flight, a
 * column scrolling its arrival into view) and a hidden tab, whose frames stop.
 * Past it the puff is skipped rather than thrown: dust where the card is not,
 * or long after it landed, reads as unrelated to the drop.
 */
export const FINALE_DROP_LANDING_TIMEOUT_MS = 1000;

/**
 * A card the board still holds back from its slot. The solitaire drop keeps a
 * single card inert and transparent (its reveal-pending marker) while its
 * neighbours make room; a created card waits on its receipt; an inline
 * flight keeps its slot inert and invisible until it lands. The slot already
 * has its final geometry, but nothing is there to throw dust yet.
 */
const HELD_CARD_SELECTOR = `${ISSUE_DROP_REVEAL_PENDING_SELECTOR}, [inert], ${FINALE_ARRIVING_CARD_SELECTOR}`;

/** Layout rounding is still a card at rest. */
const REST_EPSILON = 0.5;
/** Matrix entries this close to the identity's are a pure translation. */
const MATRIX_EPSILON = 1e-6;

/** Viewport px a box must stay inside to be seen. */
export interface FinaleConfettiClip {
	readonly left: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
}

/**
 * An element's box on the page, round its own bottom corners: where a column
 * gathers the finale's burst, and where a landing card meets the board.
 */
export function confettiBoxOf(element: Element, rect: DOMRect = element.getBoundingClientRect()): FinaleConfettiBox {
	const { x, y, width, height } = rect;
	return { x, y, width, height, radius: finaleCornerRadius(element, rect, "borderBottomLeftRadius") };
}

/**
 * What a drop's cards stand on, together: the union of their boxes, each first
 * trimmed to what the clip shows. A card scrolled out of its list is not on
 * the board as far as the eye can tell, so it neither widens nor lengthens the
 * footprint. The corners are the tightest any card has, never rounder than the
 * trimmed box can hold. Null when no card is visible.
 */
export function unionFinaleConfettiBoxes(boxes: readonly FinaleConfettiBox[], clip: FinaleConfettiClip): FinaleConfettiBox | null {
	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	let radius = Infinity;
	for (const box of boxes) {
		const boxLeft = Math.max(box.x, clip.left);
		const boxTop = Math.max(box.y, clip.top);
		const boxRight = Math.min(box.x + box.width, clip.right);
		const boxBottom = Math.min(box.y + box.height, clip.bottom);
		if (boxRight <= boxLeft || boxBottom <= boxTop) continue;
		left = Math.min(left, boxLeft);
		top = Math.min(top, boxTop);
		right = Math.max(right, boxRight);
		bottom = Math.max(bottom, boxBottom);
		radius = Math.min(radius, box.radius);
	}
	if (!(right > left && bottom > top)) return null;
	const width = right - left;
	const height = bottom - top;
	return { x: left, y: top, width, height, radius: Math.max(0, Math.min(radius, width / 2, height / 2)) };
}

/** One frame's reading of the cards a drop brought into Done. */
export interface FinaleDropLanding {
	/** Every arrived card the column renders is in its slot, and none is still held back by its drop. */
	readonly landed: boolean;
	/** Arrived cards with a layout box: a pair of frames compares like with like. */
	readonly measured: number;
	/** Their settled, visible footprint (see `settledRect`, `unionFinaleConfettiBoxes`), or null while none is on screen. */
	readonly box: FinaleConfettiBox | null;
}

/** Reads the live Done column (geometry, attributes and running animations; never a write). Null without one. */
export function readFinaleDropLanding(codes: readonly string[]): FinaleDropLanding | null {
	const column = queryJiraTeamEu26DoneColumn();
	if (!column) return null;
	const arrived = new Set(codes);
	const view = column.ownerDocument.defaultView;
	const list = queryFinaleCardList(column).getBoundingClientRect();
	const clip: FinaleConfettiClip = {
		left: Math.max(0, list.left),
		top: Math.max(0, list.top),
		right: Math.min(view?.innerWidth ?? Infinity, list.right),
		bottom: Math.min(view?.innerHeight ?? Infinity, list.bottom),
	};
	let present = 0;
	let held = false;
	const boxes: FinaleConfettiBox[] = [];
	for (const card of queryJiraTeamEu26DoneCards()) {
		if (!arrived.has(finaleCardCode(card))) continue;
		present += 1;
		// Only the card's own slot counts: an inert board (a dialog over it) is not a drop.
		const holder = card.closest(HELD_CARD_SELECTOR);
		if (holder && holder !== column && column.contains(holder)) held = true;
		const rect = settledRect(card, column);
		if (rect.width > 0 && rect.height > 0) boxes.push(confettiBoxOf(card, rect));
	}
	return { landed: present > 0 && !held, measured: boxes.length, box: unionFinaleConfettiBoxes(boxes, clip) };
}

/**
 * The translation of a computed `transform` (`none`, `matrix()` or
 * `matrix3d()`), or null when it also scales, rotates or skews: then the
 * offset alone cannot say where the box will rest.
 */
export function finaleTransformTranslation(transform: string): { readonly x: number; readonly y: number } | null {
	const value = transform.trim();
	if (value === "" || value === "none") return { x: 0, y: 0 };
	const match = /^matrix(3d)?\(([^)]*)\)$/.exec(value);
	if (!match) return null;
	const entries = match[2].split(",").map(Number);
	const is = (index: number, expected: number) => Math.abs(entries[index] - expected) <= MATRIX_EPSILON;
	if (match[1]) {
		// Column-major 4×4: the plane's linear part, no perspective, translation in m41/m42.
		if (entries.length !== 16 || !(is(0, 1) && is(1, 0) && is(4, 0) && is(5, 1) && is(3, 0) && is(7, 0) && is(15, 1))) return null;
		return { x: entries[12], y: entries[13] };
	}
	if (entries.length !== 6 || !(is(0, 1) && is(1, 0) && is(2, 0) && is(3, 1))) return null;
	return { x: entries[4], y: entries[5] };
}

/** An element whose `transform` is driven by a Web Animation right now (delay and backwards fill included). */
function animatesTransform(element: Element): boolean {
	if (typeof element.getAnimations !== "function") return false;
	return element.getAnimations().some((animation) => {
		const effect = animation.effect as KeyframeEffect | null;
		return effect?.getKeyframes?.().some((keyframe) => "transform" in keyframe) ?? false;
	});
}

/**
 * Where a card's box will rest: its rect with the running offset of any
 * transform animation between it and its column taken back out. A bulk drop
 * commits every card into its own slot and then plays the unfolding as a FLIP
 * from the lead's slot, whose resting state is no offset; layout is final from
 * the commit. Measured this way the footprint is the same from touch-down to
 * the end of the unfolding, so the cards slide out into the dust ring rather
 * than under it. An animation that does more than translate is left in: the
 * box then keeps changing, and the wait holds until it stops. Reads only: it
 * never finishes, pauses or restyles an animation.
 */
function settledRect(card: HTMLElement, column: HTMLElement): DOMRect {
	const rect = card.getBoundingClientRect();
	let x = 0;
	let y = 0;
	for (let node: HTMLElement | null = card; node && node !== column; node = node.parentElement) {
		if (!animatesTransform(node)) continue;
		const offset = finaleTransformTranslation(getComputedStyle(node).transform);
		if (!offset) return rect;
		x += offset.x;
		y += offset.y;
	}
	return x === 0 && y === 0 ? rect : new DOMRect(rect.x - x, rect.y - y, rect.width, rect.height);
}

/** The same footprint on consecutive frames: nothing (a scroll, a projection, a reveal) is still carrying it. */
function sameBox(previous: FinaleConfettiBox, next: FinaleConfettiBox): boolean {
	return Math.abs(previous.x - next.x) <= REST_EPSILON
		&& Math.abs(previous.y - next.y) <= REST_EPSILON
		&& Math.abs(previous.width - next.width) <= REST_EPSILON
		&& Math.abs(previous.height - next.height) <= REST_EPSILON;
}

/**
 * The footprint a drop's cards rest on in Done, on the frame they touch down.
 *
 * Board state commits before the cards are visibly down, so the commit cannot
 * time the dust. A single card's slot is reserved at once but its face only
 * appears after its neighbours reflow; a bulk drop lands as one stack in its
 * lead's slot, which then unfolds into the cards' own slots. Waiting for the
 * board to settle would put the dust after the unfolding, when the impact is
 * long gone. So each frame reads the arrived cards (geometry, attributes and
 * running animations, never a write), and resolves once none is held back and
 * their settled footprint (see `settledRect`) is unchanged since the previous
 * frame. For a stack that is a frame after it lands, with the footprint of the
 * cards' final slots, which the unfolding then fills. The same reading covers
 * a move with no drop motion at all (a status menu, a keyboard move, a skipped
 * trace): its cards are simply there and still, a frame after the commit.
 *
 * Null when aborted (a newer owner, unmount), when there is no Done column, or
 * when no visible landing settles within `FINALE_DROP_LANDING_TIMEOUT_MS`. The
 * frame loop runs only while one drop is waiting, and never past the bound.
 */
export function waitForFinaleDropLanding(codes: readonly string[], signal?: AbortSignal): Promise<FinaleConfettiBox | null> {
	return waitForFinaleStillFrames<FinaleDropLanding, FinaleConfettiBox>(
		() => readFinaleDropLanding(codes),
		(previous, next) => next.landed && next.box && previous?.box && previous.measured === next.measured && sameBox(previous.box, next.box) ? next.box : null,
		{ signal, timeoutMs: FINALE_DROP_LANDING_TIMEOUT_MS },
	);
}
