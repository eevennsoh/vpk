import { FINALE_WALL_CURSOR_NAMES } from "../data/finale-wall-cursor-names";
import { projectLifted } from "./finale-camera";
import type { FinaleViewport } from "./finale-card-motion";
import { FINALE_CURSORS, finaleCursorBox } from "./finale-cursor-path";
import { EASE, hash01, lerp, progress, smoothstep as smooth } from "./finale-math";
import { TITLE_CARRY_PRESS, titleCarrierAt, titleCarrierGoneTime } from "./finale-title-drag";
import { WALL_SCALE, type FinaleWall, type WallGeometry, type WallPrintShapes, type WallSlot } from "./finale-wall-layout";
import {
	BREATH,
	DESCEND_SPAN,
	arrivalCardPose,
	dealDelay,
	perSlot,
	slotArrivals,
	slotDescent,
	slotOnScreen,
	titleCarryOf,
	visibleWallBuckets,
	wallActive,
	wallOffset,
	wallSpeed,
	type BentoDrop,
	type Descent,
	type WallArrival,
} from "./finale-wall-motion";

/*
 * Act III's cursors on the mega bento. First MCB, whose cursor placed the
 * bento's cards, drags "Team ’26" into its gap (`finale-title-drag.ts`) and
 * leaves. Then the teammates take over at the leading edge: now and then one
 * reaches in, catches a card coming down from the air by its middle, rides
 * it into its slot and lets go. The cards come down exactly as they would
 * alone (`finale-wall-motion.ts`); only who holds which card, and when, is
 * planned here, the same on every pass of the loop.
 */

export interface PageCursor {
	readonly key: string;
	/**
	 * Which of the wall's cursors draws it: an index into `FINALE_CURSORS`,
	 * whose colour it wears. A lane holds one card at a time.
	 */
	readonly lane: number;
	/** Who holds the card: a name from `FINALE_WALL_CURSOR_NAMES`, the slot's own on every pass. */
	readonly name: string;
	/** The tip, on screen. */
	readonly x: number;
	readonly y: number;
	/** Perspective: larger while the card is up near the lens (and a press, as MCB takes the title). */
	readonly scale: number;
	readonly opacity: number;
	/** Turned over, its arrow pointing down onto the card and its name above (a hand that came up from below). */
	readonly pillAbove: boolean;
}

/** Most arriving cards are a teammate's to set down (some give way to another's: `wallHold`). */
const HELD_SHARE = 0.85;
const GRAB_S = 0.6;
const RELEASE_S = 0.65;
/** The least a teammate rides a card down before letting go: a card they could only catch later comes down alone. */
const RIDE_S = 0.2;
/** How far inside the frame's edges a cursor stays, name pill and all, and how far apart two stay, in stage px. */
const CURSOR_MARGIN = 48;
const CURSOR_APART = 16;
/** A lane rests at least this long between letting one card go and taking the next. */
const LANE_REST_S = 0.15;
/** How often a cursor's path is checked against the frame and the other cursors, a second. */
const PLAN_RATE = 30;

/**
 * How a teammate's hand comes and goes, by where its card is in the frame: a
 * card in the top third is reached from above and let go on downward, its
 * cursor turned over (`pillAbove`: arrow down onto the card, name above);
 * one in the middle is swept in from the side and back out; one in the
 * bottom third is reached from below and let go upward. Each leans inward, away from the
 * leading edge, and the slot's seed swings it, sizes it and bows its path,
 * so no two hands move alike (stage px; angles in radians, y down).
 */
const HAND = {
	bands: [
		{ reach: -Math.PI / 2 - 0.4, leave: Math.PI / 2 + 0.45, pillAbove: true },
		{ reach: Math.PI - 0.35, leave: Math.PI + 0.5, pillAbove: false },
		{ reach: Math.PI / 2 + 0.4, leave: -Math.PI / 2 - 0.45, pillAbove: false },
	],
	swing: 0.3,
	reach: [40, 75],
	leave: [28, 55],
	bow: 0.2,
} as const;

/** One leg of a hand's path, off the card's middle: where it ends (screen px), and how far it bows to its left as it goes. */
interface HandLeg {
	readonly x: number;
	readonly y: number;
	readonly bow: number;
}

/** A teammate's way in to their card and out again, and which way up their cursor is. */
interface Hand {
	readonly reach: HandLeg;
	readonly leave: HandLeg;
	readonly pillAbove: boolean;
}

function handLeg(angle: number, distance: number, bow: number): HandLeg {
	return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, bow: bow * distance };
}

/** A leg turned `by` radians toward the inward side (straight left), as when the frame's edge is in its way. */
function turnedIn(leg: HandLeg, by: number): HandLeg {
	const angle = Math.atan2(leg.y, leg.x);
	const length = Math.hypot(leg.x, leg.y);
	const toward = angle < 0 ? -1 : 1;
	const turned = Math.abs(angle) + by >= Math.PI ? Math.PI : angle + toward * by;
	return { x: Math.cos(turned) * length, y: Math.sin(turned) * length, bow: leg.bow };
}

/** A slot's hand, the same on every pass of the loop. */
function handFor(slot: WallSlot, geometry: WallGeometry): Hand {
	const fit = geometry.typeScale / WALL_SCALE;
	const middle = slot.rect.y + slot.rect.height / 2;
	const band = HAND.bands[Math.min(2, Math.max(0, Math.floor((middle / geometry.viewport.height) * 3)))];
	const swing = (seed: number) => (hash01(slot.seed * seed) - 0.5) * 2 * HAND.swing;
	const bow = (seed: number) => (hash01(slot.seed * seed) - 0.5) * 2 * HAND.bow;
	return {
		reach: handLeg(band.reach + swing(2.17), lerp(HAND.reach[0], HAND.reach[1], hash01(slot.seed * 4.41)) * fit, bow(6.03)),
		leave: handLeg(band.leave + swing(3.29), lerp(HAND.leave[0], HAND.leave[1], hash01(slot.seed * 5.87)) * fit, bow(7.19)),
		pillAbove: band.pillAbove,
	};
}

/** When a hand that reaches in at `from` has arrived on its card: `GRAB_S` on, or a beat before the card lands if that is sooner. */
function arrivedAt(from: number, descent: Descent): number {
	return from + Math.max(0.1, Math.min(GRAB_S, descent.touchdown - 0.05 - from));
}

/** Where along a leg the hand is (`along` 0 → 1), off its start: out along the leg, bowed to its left mid-way. */
function onLeg(leg: HandLeg, along: number): { readonly x: number; readonly y: number } {
	const length = Math.hypot(leg.x, leg.y) || 1;
	const bow = leg.bow * Math.sin(Math.PI * along);
	return { x: leg.x * along - (leg.y / length) * bow, y: leg.y * along + (leg.x / length) * bow };
}

/**
 * Who sets a slot's card down, the same on every pass of the loop: a teammate
 * from the avatar roster (the presenters' cursors belong to the bento, and
 * MCB's to the title), each always in the same one of the slide's four
 * cursor colours.
 */
function wallCursorHolder(seed: number): { readonly name: string; readonly lane: number } {
	const person = Math.floor(hash01(seed * 5.13 + 0.7) * FINALE_WALL_CURSOR_NAMES.length);
	return { name: FINALE_WALL_CURSOR_NAMES[person], lane: person % FINALE_CURSORS.length };
}

interface Box {
	readonly left: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
}

/** Who holds a card, and how: their name and lane, their hand, when they reach in, and how much of their reach in fits the frame (0: none, they fade in on the card). */
interface Holder {
	readonly name: string;
	readonly lane: number;
	readonly hand: Hand;
	readonly from?: number;
	readonly reachShare?: number;
}

/** A teammate's hold on a slot's card: when it comes down, who holds it, and where their cursor paints. */
interface WallHold extends Holder {
	readonly descent: Descent;
	/** From the cursor reaching in to its leaving. */
	readonly from: number;
	readonly to: number;
	/** Where its cursor may paint on screen at a time from `from` to `to`, whatever its card's breath. */
	readonly reach: (time: number) => Box;
}

/**
 * The cursor holding `card` (of `slot`) at `time`: from the hold's `from` its
 * hand comes in along its reach (`Hand`), fading up, and settles its tip on
 * the middle of the card, larger while the card is up near the lens, riding
 * it down; then lets go and drifts off along its leave, fading out
 * (`breathing`: as `waitingPose`).
 */
function heldCursor(slot: WallSlot, card: WallArrival, holder: Holder, time: number, geometry: WallGeometry, viewport: FinaleViewport, breathing = true): PageCursor {
	const { descent } = card;
	const pose = arrivalCardPose(slot, card, slotOnScreen(slot, wallOffset(time, geometry), geometry), Math.min(time, descent.touchdown), viewport, breathing);
	const shown = projectLifted(pose, viewport);
	const from = holder.from ?? descent.start - GRAB_S;
	const enter = smooth(from, lerp(from, arrivedAt(from, descent), 0.7), time);
	const away = smooth(descent.touchdown, descent.touchdown + RELEASE_S, time);
	// Coming in: from the far end of its reach, easing onto the card.
	const coming = onLeg(holder.hand.reach, (1 - EASE.inOut(progress(time, from, arrivedAt(from, descent)))) * (holder.reachShare ?? 0));
	// Letting go: easing off along its leave.
	const going = onLeg(holder.hand.leave, EASE.inOut(progress(time, descent.touchdown, descent.touchdown + RELEASE_S)));
	return { key: slot.key, lane: holder.lane, name: holder.name, x: shown.x + coming.x + going.x, y: shown.y + coming.y + going.y, scale: shown.scale, opacity: Math.min(enter, 1 - away), pillAbove: holder.hand.pillAbove };
}

/**
 * Where a held card's cursor may paint on screen: `finaleCursorBox` at the
 * stage fit and its perspective, with room for its card's breath (`cursor` is
 * planned on a card that holds its breath, the same on every pass). A print
 * slot's is planned on the slot's middle, before its cards are printed, so it
 * reaches as far up as its top card's middle may be.
 */
function cursorReach(cursor: PageCursor, slot: WallSlot, fit: number): Box {
	const upright = finaleCursorBox(cursor.name);
	// Turned over about its tip, its name and arrow paint above the tip, not below.
	const box = cursor.pillAbove ? { ...upright, top: upright.bottom, bottom: upright.top } : upright;
	const scale = fit * cursor.scale;
	const { width, height } = slot.rect;
	const breath = (BREATH.x + BREATH.y + (width + height) * 0.03) * cursor.scale;
	const print = slot.content.kind === "print" ? cursor.scale : 0;
	return {
		left: cursor.x - box.left * scale - breath,
		top: cursor.y - box.top * scale - breath - (height / 2) * print,
		right: cursor.x + box.right * scale + breath,
		bottom: cursor.y + box.bottom * scale + breath,
	};
}

/** The times a hold's path is checked at: `PLAN_RATE` a second from `from`, and `to`. */
function planTimes(from: number, to: number): number[] {
	const times: number[] = [];
	for (let step = 0; from + step / PLAN_RATE < to; step += 1) times.push(from + step / PLAN_RATE);
	times.push(to);
	return times;
}

const holdCandidates = new WeakMap<FinaleWall, Map<string, WallHold | null>>();

/**
 * Whether a teammate would take a slot's card, before they make way for one
 * another: about `HELD_SHARE` of the arrivals, once the bento's own cards are
 * all down and MCB has left. The card comes down where it always does, and its teammate
 * catches it from the first moment their cursor, name pill and all, stays
 * `CURSOR_MARGIN` inside the frame from there to leaving, as long as that
 * leaves at least `RIDE_S` to ride it down. Every pass of the loop plans it alike.
 */
function holdCandidate(slot: WallSlot, wall: FinaleWall): WallHold | null {
	return perSlot(holdCandidates, wall, slot, () => {
		const { geometry } = wall;
		if (slot.reserved !== undefined || hash01(slot.seed * 3.71 + 0.2) >= HELD_SHARE) return null;
		const descent = slotDescent(slot, wall);
		if (!descent) return null;
		const { viewport } = geometry;
		const fit = geometry.typeScale / WALL_SCALE;
		const margin = CURSOR_MARGIN * fit;
		const holder: Holder = { ...wallCursorHolder(slot.seed), hand: handFor(slot, geometry) };
		// A print slot's top card may come down a beat after the slot's first.
		const deal = slot.content.kind === "print" ? dealDelay(slot, slot.content.codes.length - 1) : 0;
		const inside = (box: Box) => box.left >= margin && box.top >= margin && box.right <= viewport.width - margin && box.bottom <= viewport.height - margin;
		const to = descent.touchdown + deal + RELEASE_S;
		const card: WallArrival = { key: slot.key, index: null, code: null, rect: { x: 0, y: 0, width: slot.rect.width, height: slot.rect.height }, radius: geometry.radius, descent };
		const reachOf = (held: Holder) => (time: number) => cursorReach(heldCursor(slot, card, held, Math.min(time, descent.touchdown + RELEASE_S), geometry, viewport, false), slot, fit);
		// The earliest moment from which the whole rest of its path, on the card and letting go, stays inside: walk back from letting go.
		const settled = reachOf(holder);
		const times = planTimes(descent.start - GRAB_S, to);
		let first = times.length;
		while (first > 0 && inside(settled(times[first - 1]))) first -= 1;
		const from = times[first];
		if (from === undefined || from > descent.touchdown - RIDE_S || from < titleCarrierGoneTime()) return null;
		// Then its reach in, as the frame allows: turned a little inward, then shortened, before it would only fade in on the card.
		for (const turn of [0, 0.45, 0.9]) {
			for (const reachShare of [1, 0.6]) {
				const held = { ...holder, hand: { ...holder.hand, reach: turnedIn(holder.hand.reach, turn) }, from, reachShare };
				const reach = reachOf(held);
				if (planTimes(from, arrivedAt(from, descent)).every((time) => inside(reach(time)))) return { ...held, descent, to, reach };
			}
		}
		const held = { ...holder, from, reachShare: 0 };
		return { ...held, descent, to, reach: reachOf(held) };
	});
}

/** Whether two teammates' holds would get in each other's way: one lane twice at once, or two cursors near or over each other. */
function holdsClash(a: WallHold, b: WallHold, apart: number): boolean {
	if (a.to + LANE_REST_S <= b.from || b.to + LANE_REST_S <= a.from) return false;
	if (a.lane === b.lane) return true;
	const from = Math.max(a.from, b.from);
	const to = Math.min(a.to, b.to);
	if (from > to) return false;
	return planTimes(from, to).some((time) => {
		const p = a.reach(time);
		const q = b.reach(time);
		return p.left < q.right + apart && q.left < p.right + apart && p.top < q.bottom + apart && q.top < p.bottom + apart;
	});
}

const holds = new WeakMap<FinaleWall, Map<string, WallHold | null>>();

/**
 * A teammate's hold on a slot's card, or null: a candidate makes way for any
 * hold that reaches in before it (or with it, earlier on the wall) and would
 * clash with it, so no more hands are in than the wall has cursors, nobody
 * is in two places at once, and no two cursors ever cover each other. Only
 * holds that overlap in time can clash, so a hold depends on the few just
 * before it, never on the wall's run-up, and every pass of the loop is alike.
 */
function wallHold(slot: WallSlot, wall: FinaleWall): WallHold | null {
	return perSlot(holds, wall, slot, () => {
		const own = holdCandidate(slot, wall);
		if (!own) return null;
		const { geometry } = wall;
		const apart = (CURSOR_APART * geometry.typeScale) / WALL_SCALE;
		// Search every spatial bucket whose card width and travel time can overlap this hold.
		const around = Math.ceil(((own.to - own.from + LANE_REST_S) * wallSpeed(geometry)) / geometry.bucketWidth + DESCEND_SPAN + geometry.maxTileWidth / geometry.bucketWidth) + 1;
		for (let column = slot.bucket - around; column <= slot.bucket + around; column += 1) {
			for (const other of wall.bucket(column)) {
				if (other.key === slot.key) continue;
				const theirs = holdCandidate(other, wall);
				if (!theirs || theirs.from > own.from || (theirs.from === own.from && other.key > slot.key)) continue;
				if (holdsClash(theirs, own, apart) && wallHold(other, wall)) return null;
			}
		}
		return own;
	});
}

/** MCB's lane: his own colour and name, from the slide. */
const CARRIER_LANE = Math.max(0, FINALE_CURSORS.findIndex((cursor) => cursor.id === "mcb"));

/**
 * MCB's cursor dragging the title (`drops`' title card) into its gap, as a
 * wall cursor: in his lane, named as on the slide, upright, its press about its tip.
 */
function titleCarrierCursor(time: number, wall: FinaleWall, drops: readonly BentoDrop[], viewport: FinaleViewport): PageCursor | null {
	const title = drops.find((drop) => drop.kind === "title");
	const carrier = title ? titleCarrierAt(titleCarryOf(title, wall.geometry, viewport), time) : null;
	if (!carrier) return null;
	const { label } = FINALE_CURSORS[CARRIER_LANE];
	return { key: "title", lane: CARRIER_LANE, name: label, x: carrier.x, y: carrier.y, scale: carrier.scale * (1 - TITLE_CARRY_PRESS * carrier.pressed), opacity: carrier.opacity, pillAbove: false };
}

/**
 * Every cursor on the wall at `time`. MCB first, dragging the title into its
 * gap (`drops`: the bento's cards). Then teammates reaching in at the leading
 * edge: one reaches in (from above, the side or below, by where the card is:
 * `HAND`), takes a card coming down by its middle, rides it into its slot and
 * lets go, drifting off along a path of its own, every cursor, name and all,
 * well inside the frame.
 * Each lane holds one card at a time, so no more hands are in than the wall
 * has cursors, nobody is in two places at once, and no two cursors cover each
 * other (`wallHold`); none reaches in until MCB has left. A print slot's
 * stack is held by its top card's middle (`prints`: the prints' shapes, as
 * `wallSheetsAt` takes them).
 */
export function wallCursorsAt(time: number, wall: FinaleWall, drops: readonly BentoDrop[], viewport: FinaleViewport, prints?: WallPrintShapes): readonly PageCursor[] {
	if (!wallActive(time)) return [];
	const { geometry } = wall;
	const { first, last } = visibleWallBuckets(wallOffset(time, geometry), geometry);
	const carrier = titleCarrierCursor(time, wall, drops, viewport);
	const cursors: PageCursor[] = carrier ? [carrier] : [];
	for (let column = first; column <= last + 1; column += 1) {
		for (const slot of wall.bucket(column)) {
			const hold = wallHold(slot, wall);
			if (!hold) continue;
			// The card it takes: the slot's own, or the top one of a print slot's stack.
			const card = slotArrivals(slot, wall, prints)[0];
			if (!card || time < hold.from || time > card.descent.touchdown + RELEASE_S) continue;
			cursors.push(heldCursor(slot, card, hold, time, geometry, viewport));
		}
	}
	return cursors;
}
