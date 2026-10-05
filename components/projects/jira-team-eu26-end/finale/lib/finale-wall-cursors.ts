import { FINALE_WALL_CURSOR_NAMES } from "../data/finale-wall-cursor-names";
import { cameraDistance, type FinaleViewport } from "./finale-card-motion";
import { FINALE_CURSORS, finaleCursorBox } from "./finale-cursor-path";
import { hash01, smoothstep as smooth } from "./finale-math";
import { WALL_SCALE, type FinaleWall, type WallGeometry, type WallPrintShapes, type WallSlot } from "./finale-wall-layout";
import {
	BREATH,
	DESCEND_SPAN,
	arrivalCardPose,
	bentoLandedTime,
	dealDelay,
	perSlot,
	slotArrivals,
	slotDescent,
	slotOnScreen,
	visibleColumns,
	wallActive,
	wallOffset,
	wallSpeed,
	type Descent,
	type WallArrival,
} from "./finale-wall-motion";

/*
 * Act III's teammates at the mega bento's leading edge: now and then one
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
	/** Perspective: larger while the card is up near the lens. */
	readonly scale: number;
	readonly opacity: number;
}

/** Where a point lifted `z` toward the lens shows on screen, filmed by the resting camera. */
export function projectLifted(point: { readonly x: number; readonly y: number; readonly z: number }, viewport: FinaleViewport): { x: number; y: number; scale: number } {
	const distance = cameraDistance(viewport);
	const scale = distance / Math.max(1, distance - point.z);
	return { x: viewport.width / 2 + (point.x - viewport.width / 2) * scale, y: viewport.height / 2 + (point.y - viewport.height / 2) * scale, scale };
}

/** Most arriving cards are a teammate's to set down (some give way to another's: `wallHold`). */
const HELD_SHARE = 0.85;
const GRAB_S = 0.4;
const RELEASE_S = 0.45;
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
 * Who sets a slot's card down, the same on every pass of the loop: a teammate
 * from the avatar roster (the presenters' cursors belong to the bento), each
 * always in the same one of the slide's four cursor colours.
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

/** A teammate's hold on a slot's card: when it comes down, who holds it, and where their cursor paints. */
interface WallHold {
	readonly descent: Descent;
	readonly name: string;
	readonly lane: number;
	/** From the cursor reaching in to its leaving. */
	readonly from: number;
	readonly to: number;
	/** Where its cursor may paint on screen at a time from `from` to `to`, whatever its card's breath. */
	readonly reach: (time: number) => Box;
}

/**
 * The cursor holding `card` (of `slot`) at `time`: its tip on the middle of
 * the card, larger while the card is up near the lens, riding it down; then
 * letting go, drifting up and away inward (`breathing`: as `waitingPose`). It shows from
 * the hold's `from`, where it catches the card as it swoops in from the edge.
 */
function heldCursor(slot: WallSlot, card: WallArrival, holder: { readonly name: string; readonly lane: number; readonly from?: number }, time: number, geometry: WallGeometry, viewport: FinaleViewport, breathing = true): PageCursor {
	const { descent } = card;
	const pose = arrivalCardPose(slot, card, slotOnScreen(slot, wallOffset(time, geometry), geometry), Math.min(time, descent.touchdown), viewport, breathing);
	const shown = projectLifted(pose, viewport);
	const from = holder.from ?? descent.start - GRAB_S;
	const enter = smooth(from, from + GRAB_S * 0.7, time);
	const away = smooth(descent.touchdown, descent.touchdown + RELEASE_S, time);
	const fit = geometry.typeScale / WALL_SCALE;
	return { key: slot.key, lane: holder.lane, name: holder.name, x: shown.x - away * 26 * fit, y: shown.y - away * 34 * fit, scale: shown.scale, opacity: Math.min(enter, 1 - away) };
}

/**
 * Where a held card's cursor may paint on screen: `finaleCursorBox` at the
 * stage fit and its perspective, with room for its card's breath (`cursor` is
 * planned on a card that holds its breath, the same on every pass). A print
 * slot's is planned on the slot's middle, before its cards are printed, so it
 * reaches as far up as its top card's middle may be.
 */
function cursorReach(cursor: PageCursor, slot: WallSlot, fit: number): Box {
	const box = finaleCursorBox(cursor.name);
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
 * all down. The card comes down where it always does, and its teammate
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
		const holder = wallCursorHolder(slot.seed);
		// A print slot's top card may come down a beat after the slot's first.
		const deal = slot.content.kind === "print" ? dealDelay(slot, slot.content.codes.length - 1) : 0;
		const inside = (box: Box) => box.left >= margin && box.top >= margin && box.right <= viewport.width - margin && box.bottom <= viewport.height - margin;
		const to = descent.touchdown + deal + RELEASE_S;
		const card: WallArrival = { key: slot.key, index: null, code: null, rect: { x: 0, y: 0, width: slot.rect.width, height: slot.rect.height }, radius: geometry.radius, descent };
		const reach = (time: number) => cursorReach(heldCursor(slot, card, holder, Math.min(time, descent.touchdown + RELEASE_S), geometry, viewport, false), slot, fit);
		// The earliest moment from which the whole rest of its path stays inside: walk back from letting go.
		const times = planTimes(descent.start - GRAB_S, to);
		let first = times.length;
		while (first > 0 && inside(reach(times[first - 1]))) first -= 1;
		const from = times[first];
		if (from === undefined || from > descent.touchdown - RIDE_S || from < bentoLandedTime(wall.gaps.length)) return null;
		return { descent, ...holder, from, to, reach };
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
		// Any hold that can overlap this one in time is within this many columns of it (its line up to the deepest away; a wide cell belongs to its left column).
		const around = Math.ceil(((own.to - own.from + LANE_REST_S) * wallSpeed(geometry)) / geometry.pitch + DESCEND_SPAN) + 2;
		for (let column = slot.column - around; column <= slot.column + around; column += 1) {
			for (const other of wall.column(column)) {
				if (other.key === slot.key) continue;
				const theirs = holdCandidate(other, wall);
				if (!theirs || theirs.from > own.from || (theirs.from === own.from && other.key > slot.key)) continue;
				if (holdsClash(theirs, own, apart) && wallHold(other, wall)) return null;
			}
		}
		return own;
	});
}

/**
 * Teammates reaching in at the leading edge: one takes a card waiting in the
 * air by its middle, rides it down into its slot and lets go,
 * drifting up and away, every cursor, name and all, well inside the frame.
 * Each lane holds one card at a time, so no more hands are in than the wall
 * has cursors, nobody is in two places at once, and no two cursors cover each
 * other (`wallHold`). A print slot's stack is held by its top card's middle
 * (`prints`: the prints' shapes, as `wallSheetsAt` takes them).
 */
export function wallCursorsAt(time: number, wall: FinaleWall, viewport: FinaleViewport, prints?: WallPrintShapes): readonly PageCursor[] {
	if (!wallActive(time)) return [];
	const { geometry } = wall;
	const { first, last } = visibleColumns(wallOffset(time, geometry), geometry);
	const cursors: PageCursor[] = [];
	for (let column = first; column <= last + 1; column += 1) {
		for (const slot of wall.column(column)) {
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
