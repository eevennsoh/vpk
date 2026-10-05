import { motionDuration } from "@/lib/motion";

import { FINALE_WALL_CURSOR_NAMES } from "../data/finale-wall-cursor-names";
import { projectLifted } from "./finale-camera";
import type { FinaleViewport } from "./finale-card-motion";
import { FINALE_CURSORS, finaleCursorBox } from "./finale-cursor-path";
import { EASE, hash01, progress } from "./finale-math";
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
/** How long after a hand could first hold its card it is on it, at most (it is always on it a beat before the card lands). */
const GRAB_S = 0.6;
/**
 * A hand glides in from off the frame onto its card over `ENTER_S`, easing
 * out (`--ease-out-practical`, as the presenters' cursors come in), and once
 * it lets go heads back off the frame over the quicker `LEAVE_S`, easing in
 * and fading out as it goes (`--ease-in`): `--duration-slowest` in,
 * `--duration-slower` out.
 */
const ENTER_S = motionDuration.slowest;
const LEAVE_S = motionDuration.slower;
/** The least a teammate rides a card down before letting go: a card they could only catch later comes down alone. */
const RIDE_S = 0.2;
/** How far inside the frame's edges a cursor stays on its card, name pill and all, and how far apart two stay, in stage px. */
const CURSOR_MARGIN = 48;
const CURSOR_APART = 16;
/** A lane rests at least this long between letting one card go and taking the next. */
const LANE_REST_S = 0.15;
/** How often a cursor's path is checked against the frame and the other cursors, a second. */
const PLAN_RATE = 30;

/**
 * Which way a teammate's hand comes and goes, by where its card is in the
 * frame: a card in the top third is reached from above, its cursor turned
 * over (`pillAbove`: arrow down onto the card, name above); one in the middle
 * from the leading edge, beside it; one in the bottom third from below. Each
 * comes in on one side and heads back out on the other, so it never retraces
 * its way in, and the slot's seed swings it and bows its path, so no two
 * hands move alike (angles in radians, y down). How far each way runs is the
 * frame's: from wholly off it, and back off it (`offFrame`).
 */
const HAND = {
	bands: [
		{ reach: -Math.PI / 2 - 0.4, leave: -Math.PI / 2 + 0.45, pillAbove: true },
		{ reach: 0.35, leave: -0.25, pillAbove: false },
		{ reach: Math.PI / 2 + 0.4, leave: Math.PI / 2 - 0.45, pillAbove: false },
	],
	swing: 0.3,
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

/** Which way a slot's hand comes in and goes out, and how far each bows (a share of its length), the same on every pass of the loop. */
interface HandWays {
	readonly reach: number;
	readonly leave: number;
	readonly reachBow: number;
	readonly leaveBow: number;
	readonly pillAbove: boolean;
}

function handLeg(angle: number, distance: number, bow: number): HandLeg {
	return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, bow: bow * distance };
}

function handWaysFor(slot: WallSlot, geometry: WallGeometry): HandWays {
	const middle = slot.rect.y + slot.rect.height / 2;
	const band = HAND.bands[Math.min(2, Math.max(0, Math.floor((middle / geometry.viewport.height) * 3)))];
	const swing = (seed: number) => (hash01(slot.seed * seed) - 0.5) * 2 * HAND.swing;
	const bow = (seed: number) => (hash01(slot.seed * seed) - 0.5) * 2 * HAND.bow;
	return { reach: band.reach + swing(2.17), leave: band.leave + swing(3.29), reachBow: bow(6.03), leaveBow: bow(7.19), pillAbove: band.pillAbove };
}

/** When a hand that could first hold its card at `from` is on it: `GRAB_S` on, or a beat before the card lands if that is sooner. */
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

/** Who holds a card, and how: their name and lane, their hand, when they set off for it from off the frame (`from`), and when they are on it (`arrive`). */
interface Holder {
	readonly name: string;
	readonly lane: number;
	readonly hand: Hand;
	readonly from: number;
	readonly arrive: number;
}

/** A teammate's hold on a slot's card: when it comes down, who holds it, and where their cursor paints. */
interface WallHold extends Holder {
	readonly descent: Descent;
	/** From the cursor setting off for its card to its being gone. */
	readonly to: number;
	/** Where its cursor may paint inside the frame at a time from `from` to `to`, whatever its card's breath (null: wholly off it). */
	readonly reach: (time: number) => Box | null;
}

/**
 * Where a hand holding `card` (of `slot`) has its tip at `time`: on the
 * card's middle, larger while the card is up near the lens, riding it down,
 * then on where it lands as the wall carries it on (`breathing`: as
 * `waitingPose`).
 */
function onCard(slot: WallSlot, card: WallArrival, time: number, geometry: WallGeometry, viewport: FinaleViewport, breathing = true): { readonly x: number; readonly y: number; readonly scale: number } {
	const pose = arrivalCardPose(slot, card, slotOnScreen(slot, wallOffset(time, geometry), geometry), Math.min(time, card.descent.touchdown), viewport, breathing);
	return projectLifted(pose, viewport);
}

/**
 * The cursor holding `card` (of `slot`) at `time`: from the hold's `from` its
 * hand glides in from off the frame along its reach (`Hand`), easing onto the
 * card's middle by `arrive`, and rides it down (`onCard`); as the card lands
 * it lets go and heads back off the frame along its leave, easing away and
 * fading out as it goes (`breathing`: as `waitingPose`).
 */
function heldCursor(slot: WallSlot, card: WallArrival, holder: Holder, time: number, geometry: WallGeometry, viewport: FinaleViewport, breathing = true): PageCursor {
	const { touchdown } = card.descent;
	const shown = onCard(slot, card, time, geometry, viewport, breathing);
	const coming = onLeg(holder.hand.reach, 1 - EASE.outPractical(progress(time, holder.from, holder.arrive)));
	const away = EASE.in(progress(time, touchdown, touchdown + LEAVE_S));
	const going = onLeg(holder.hand.leave, away);
	return { key: slot.key, lane: holder.lane, name: holder.name, x: shown.x + coming.x + going.x, y: shown.y + coming.y + going.y, scale: shown.scale, opacity: 1 - away, pillAbove: holder.hand.pillAbove };
}

/**
 * Where a held card's cursor may paint on screen: `finaleCursorBox` at the
 * stage fit and its perspective, with room for its card's breath (`cursor` is
 * planned on a card that holds its breath, the same on every pass). A print
 * slot's is planned on the slot's middle, before its cards are printed, so it
 * reaches as far up as its top card's middle may be.
 */
function cursorReach(cursor: Pick<PageCursor, "x" | "y" | "scale" | "name" | "pillAbove">, slot: WallSlot, fit: number): Box {
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

/** How far a cursor painting `box` must move `angle`-wards to be wholly off the frame, by whichever edge it crosses first. */
function offFrame(box: Box, angle: number, viewport: FinaleViewport): number {
	const dx = Math.cos(angle);
	const dy = Math.sin(angle);
	const across = dx > 1e-6 ? (viewport.width - box.left) / dx : dx < -1e-6 ? box.right / -dx : Number.POSITIVE_INFINITY;
	const along = dy > 1e-6 ? (viewport.height - box.top) / dy : dy < -1e-6 ? box.bottom / -dy : Number.POSITIVE_INFINITY;
	return Math.max(0, Math.min(across, along));
}

/** The part of `box` inside the frame, or null if it is wholly off it. */
function inFrame(box: Box, viewport: FinaleViewport): Box | null {
	const clipped = { left: Math.max(0, box.left), top: Math.max(0, box.top), right: Math.min(viewport.width, box.right), bottom: Math.min(viewport.height, box.bottom) };
	return clipped.left < clipped.right && clipped.top < clipped.bottom ? clipped : null;
}

const holdCandidates = new WeakMap<FinaleWall, Map<string, WallHold | null>>();

/**
 * Whether a teammate would take a slot's card, before they make way for one
 * another: about `HELD_SHARE` of the arrivals, once the bento's own cards are
 * all down and MCB has left. The card comes down where it always does, and
 * its teammate holds it from the first moment their cursor on it, name pill
 * and all, stays `CURSOR_MARGIN` inside the frame until they let go, as long
 * as that leaves at least `RIDE_S` to ride it down. Their hand sets off from
 * wholly off the frame `ENTER_S` before it is on the card, and once it lets
 * go runs back off the frame, each leg as long as the frame makes it
 * (`offFrame`). Every pass of the loop plans it alike.
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
		const { name, lane } = wallCursorHolder(slot.seed);
		const ways = handWaysFor(slot, geometry);
		// A print slot's top card may come down a beat after the slot's first.
		const deal = slot.content.kind === "print" ? dealDelay(slot, slot.content.codes.length - 1) : 0;
		const inside = (box: Box) => box.left >= margin && box.top >= margin && box.right <= viewport.width - margin && box.bottom <= viewport.height - margin;
		const card: WallArrival = { key: slot.key, index: null, code: null, rect: { x: 0, y: 0, width: slot.rect.width, height: slot.rect.height }, radius: geometry.radius, descent };
		const boxAt = (time: number) => cursorReach({ ...onCard(slot, card, time, geometry, viewport, false), name, pillAbove: ways.pillAbove }, slot, fit);
		// The earliest moment from which its cursor on the card stays inside until it lets go: walk back from letting go.
		const times = planTimes(descent.start - GRAB_S, descent.touchdown + deal);
		let first = times.length;
		while (first > 0 && inside(boxAt(times[first - 1]))) first -= 1;
		const onFrom = times[first];
		if (onFrom === undefined || onFrom > descent.touchdown - RIDE_S) return null;
		const arrive = arrivedAt(onFrom, descent);
		const from = arrive - ENTER_S;
		if (from < titleCarrierGoneTime()) return null;
		// Each leg reaches from the card to wholly off the frame (with room to spare): in from where the card is as the hand sets off, out from where it is as the hand is gone.
		// It is never shorter than the cursor itself, so a hand whose card is still coming in over the frame's edge glides onto it rather than riding in on it.
		const spare = CURSOR_APART * fit;
		const leaveEnd = descent.touchdown + LEAVE_S;
		const legOff = (angle: number, bow: number, box: Box) => handLeg(angle, Math.max(offFrame(box, angle, viewport), box.right - box.left) + spare, bow);
		const hand: Hand = {
			reach: legOff(ways.reach, ways.reachBow, boxAt(from)),
			leave: legOff(ways.leave, ways.leaveBow, boxAt(leaveEnd)),
			pillAbove: ways.pillAbove,
		};
		const held: Holder = { name, lane, hand, from, arrive };
		const reach = (time: number) => inFrame(cursorReach(heldCursor(slot, card, held, Math.min(time, leaveEnd), geometry, viewport, false), slot, fit), viewport);
		return { ...held, descent, to: leaveEnd + deal, reach };
	});
}

/** Whether two teammates' holds would get in each other's way: one lane twice at once, or two cursors near or over each other in the frame. */
function holdsClash(a: WallHold, b: WallHold, apart: number): boolean {
	if (a.to + LANE_REST_S <= b.from || b.to + LANE_REST_S <= a.from) return false;
	if (a.lane === b.lane) return true;
	const from = Math.max(a.from, b.from);
	const to = Math.min(a.to, b.to);
	if (from > to) return false;
	return planTimes(from, to).some((time) => {
		const p = a.reach(time);
		const q = b.reach(time);
		return p !== null && q !== null && p.left < q.right + apart && q.left < p.right + apart && p.top < q.bottom + apart && q.top < p.bottom + apart;
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
 * edge: one glides in from off the frame (from above, the side or below, by
 * where the card is: `HAND`), takes a card coming down by its middle, rides it
 * into its slot, every cursor, name and all, well inside the frame, and lets
 * go, heading back off the frame along a path of its own as it fades out.
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
			if (!card || time < hold.from || time > card.descent.touchdown + LEAVE_S) continue;
			cursors.push(heldCursor(slot, card, hold, time, geometry, viewport));
		}
	}
	return cursors;
}
