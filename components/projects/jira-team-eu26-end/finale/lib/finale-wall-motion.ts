import { CUE, WALL_CUE } from "../data/finale-cues";
import { FINALE_BRAND, FINALE_COLORS } from "../data/finale-palette";
import type { FinaleRect } from "../data/finale-stories";
import type { Vec3 } from "./finale-camera";
import { blendPose, cameraDistance, flatPose, landingWaveAge, turns, withLandingWave, type FinaleCardPose, type FinaleViewport } from "./finale-card-motion";
import { EASE, clamp, hash01, lerp, progress, smoothstep as smooth, spring } from "./finale-math";
import { wallPrintCards, wallPrintGap, type FinaleWall, type WallContent, type WallGeometry, type WallPrintShapes, type WallSlot } from "./finale-wall-layout";

/*
 * Act III on the finale clock. Every beat is a pure function of the time, so
 * the mega bento scrubs, holds and loops like the rest of the finale.
 *
 * - The flip: "Team ’26" gains a grey card, which hands over to its GL sheet
 *   and flips end over end, bowing like paper, onto its black back.
 * - The throw: the bento's seven cards, faces and all, are thrown at once
 *   like the Done column's deck. Each flies
 *   as paper does: up toward the lens on its own arc, turning whole turns that
 *   die away as the air catches it, banking into its travel and pitching with
 *   its rise and fall, then floating down more slowly than it rose into its
 *   gap in the mega bento, and landing as the bento's tiles landed on the
 *   slide (the same swoop, Peel's wave, the shadow, then the DOM hand-over).
 * - The reveal: the mega bento appears around the thrown cards, from the
 *   middle of the frame out, each card fading up as the air clears over it.
 * - The glide: the wall starts to travel left while the thrown cards are
 *   still coming down, easing up to its pace as they land in their moving
 *   gaps, then travels at that steady pace, one period a loop, forever.
 * - Arrivals: a card coming in at the leading edge waits in the air above its
 *   slot, tilted and turned like a card in the field, breathing, filmed
 *   through the field's chromatic smear; each comes down at its own moment,
 *   so a column fills raggedly, never as a block. Now and then a teammate
 *   reaches in, takes a card by its corner and sets it down.
 *
 * Coordinates: screen px (x right, y down) for flat positions; z toward the
 * lens. Poses are `FinaleCardPose`s, filmed by the resting camera.
 */

/** The wall's pace: a share of the frame's width a second (the reference wall's glide). */
export const WALL_SPEED_SHARE = 0.042;

const TAU = Math.PI * 2;

/** Seconds into the act (negative before the bento's final frame). */
export function wallSince(time: number): number {
	return time - WALL_CUE.start;
}

/**
 * Whether the mega bento exists yet: only once the clock is past the bento's
 * final frame, which is also what reduced motion holds (so it never mounts).
 */
export function wallActive(time: number): boolean {
	return time > WALL_CUE.start;
}

/** How far into the bento's held final frame the wall's DOM mounts, still hidden. */
const WALL_MOUNT_LEAD_S = 0.3;

/**
 * Whether the wall's columns are mounted: from a moment before it exists, on
 * the bento's still frame, so their ~100ms mount never stalls the title
 * card's first frame. Reduced motion never mounts the wall at all.
 */
export function wallMounted(time: number): boolean {
	return time > WALL_CUE.start - WALL_MOUNT_LEAD_S;
}

/* ─── The glide ───────────────────────────────────────────────────────── */

export function wallSpeed(geometry: WallGeometry): number {
	return WALL_SPEED_SHARE * geometry.viewport.width;
}

/**
 * When the wall starts to glide: partway through the throw, from the toss to
 * the first touchdown (`WALL_CUE.driftShare`), so it follows the landings
 * when they are retimed and every card lands in a gap already on the move.
 */
export function wallDriftStart(): number {
	return WALL_CUE.start + lerp(WALL_CUE.tossAt, WALL_CUE.landAt, WALL_CUE.driftShare);
}

/**
 * Seconds of travel at full pace by `elapsed` into the ramp. The pace eases in
 * on a smoothstep from rest, so it starts with neither a jump in speed nor a
 * kick of acceleration, and meets the steady pace as smoothly.
 */
function rampTravel(elapsed: number): number {
	const ramp: number = WALL_CUE.driftRamp;
	if (elapsed <= 0) return 0;
	if (elapsed >= ramp) return elapsed - ramp / 2;
	const x = elapsed / ramp;
	return ramp * (x ** 3 - x ** 4 / 2);
}

/** How far the wall has travelled left, in viewport px. */
export function wallOffset(time: number, geometry: WallGeometry): number {
	return wallSpeed(geometry) * rampTravel(time - wallDriftStart());
}

/** When the wall has travelled `offset` px (the inverse of `wallOffset`); `-Infinity` for none. */
export function wallTimeAt(offset: number, geometry: WallGeometry): number {
	if (offset <= 0) return Number.NEGATIVE_INFINITY;
	const travel = offset / wallSpeed(geometry);
	const ramp: number = WALL_CUE.driftRamp;
	const base = wallDriftStart();
	if (travel >= ramp / 2) return base + travel + ramp / 2;
	let low = 0;
	let high = ramp;
	for (let step = 0; step < 40; step += 1) {
		const mid = (low + high) / 2;
		if (rampTravel(mid) < travel) low = mid;
		else high = mid;
	}
	return base + high;
}

/** Seconds the wall takes to come round once at full pace: its loop. */
export function wallLoop(geometry: WallGeometry, period: number): number {
	return (geometry.pitch * period) / wallSpeed(geometry);
}

/** A slot's rect on screen at `offset`. */
export function slotOnScreen(slot: WallSlot, offset: number, geometry: WallGeometry): FinaleRect {
	return { ...slot.rect, x: slot.rect.x + geometry.originX - offset };
}

/** The columns that reach into the frame at `offset`, with one to spare either side. */
export function visibleColumns(offset: number, geometry: WallGeometry): { readonly first: number; readonly last: number } {
	const { originX, pitch, columnWidth, viewport } = geometry;
	// A wide cell belongs to its left column, so reach one column further left.
	const first = Math.floor((offset - originX - columnWidth * 2) / pitch) - 1;
	const last = Math.ceil((offset - originX + viewport.width) / pitch) + 1;
	return { first, last };
}

/* ─── Landing (shared by the bento's cards and the arrivals) ──────────── */

/** A landed card hands over from its GL sheet to its DOM face (0 GL → 1 DOM), as `tileHandoff`. */
export function landingHandover(time: number, touchdown: number): number {
	const at = touchdown + CUE.handoff;
	return progress(time, at, at + 0.12);
}

/**
 * The DOM card comes up under its still opaque sheet over the hand-over's
 * first `faceUp`, and the sheet dissolves off it from `sheetFrom` on. They
 * overlap only while the face is nearly up, so the swap never dips through
 * to the page (it stays over 98% covered), and what only the sheet shows (a
 * neighbour's smear through the lens) fades out rather than vanishing in a frame.
 */
const HANDOVER = { faceUp: 0.6, sheetFrom: 0.4 } as const;

/** A landed card's DOM face through its hand-over (0 → 1), up before its sheet has gone. */
export function landingFaceShown(time: number, touchdown: number): number {
	return progress(landingHandover(time, touchdown), 0, HANDOVER.faceUp);
}

/** A landed card's GL sheet through its hand-over (1 → 0), dissolving off its DOM face, gone as the hand-over ends. */
export function landingSheetShown(time: number, touchdown: number): number {
	return 1 - smooth(HANDOVER.sheetFrom, 1, landingHandover(time, touchdown));
}

/** When a landed card's DOM content starts to build, as `tileRevealStart`. */
export function landingRevealStart(touchdown: number): number {
	return touchdown + CUE.handoff + 0.05;
}

/** When a landed card's accents (border glow, dot pulse) are over: its content has built. */
export function landingSettled(touchdown: number): number {
	return landingRevealStart(touchdown) + CUE.reveal;
}

/** A card resting in its slot, its landing wave relaxing from `touchdown` on (`LANDING`), until its sheet has handed over. */
function landedPose(rect: FinaleRect, touchdown: number, time: number, face = 1): FinaleCardPose {
	return withLandingWave({ ...flatPose(rect, face), opacity: landingSheetShown(time, touchdown) }, touchdown, time);
}

/* ─── The reveal ──────────────────────────────────────────────────────── */

/**
 * How far the mega bento has appeared over a point of the frame (0 → 1): from
 * the throw on, from the middle of the frame out, a little scattered, each
 * card fading up over `revealFadeS`.
 */
export function wallRevealAt(point: { readonly x: number; readonly y: number }, seed: number, time: number, viewport: FinaleViewport): number {
	const delay = revealDelay(point, seed, viewport);
	return EASE.outBold(progress(wallSince(time), delay, delay + WALL_CUE.revealFadeS));
}

/** Seconds into the act at which a point of the frame starts to appear. */
function revealDelay(point: { readonly x: number; readonly y: number }, seed: number, viewport: FinaleViewport): number {
	const reach = Math.hypot(viewport.width / 2, viewport.height / 2);
	const distance = Math.hypot(point.x - viewport.width / 2, point.y - viewport.height / 2) / reach;
	return WALL_CUE.revealAt + WALL_CUE.revealS * (0.72 * clamp(distance) + 0.28 * hash01(seed * 0.71 + 0.3));
}

/**
 * When a card already on the wall as it appears starts to fade up
 * (`wallRevealAt` leaves 0), on the finale clock. The wall may already be
 * gliding, so its centre is read where it is then: two passes settle it.
 */
export function wallSlotRevealTime(slot: WallSlot, geometry: WallGeometry): number {
	let time = WALL_CUE.start + WALL_CUE.revealAt;
	for (let pass = 0; pass < 2; pass += 1) {
		const rect = slotOnScreen(slot, wallOffset(time, geometry), geometry);
		time = WALL_CUE.start + revealDelay({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, slot.seed, geometry.viewport);
	}
	return time;
}

/* ─── The bento's cards: thrown, flown, landed ────────────────────────── */

/** A bento card and the gap it is thrown into. `order` 0–5 are the tiles; the title is the last. */
export interface BentoDrop {
	readonly order: number;
	readonly kind: "tile" | "title";
	/** Its rect on the slide (viewport px). */
	readonly from: FinaleRect;
	/** Its gap in the wall's first copy. */
	readonly slot: WallSlot;
}

/** The bento's tiles and its title, each paired with its gap. */
export function bentoDrops(wall: FinaleWall, bentoRects: readonly FinaleRect[], titleRect: FinaleRect): readonly BentoDrop[] {
	return wall.gaps.flatMap((gap): BentoDrop[] => {
		if (gap.kind === "title") return [{ order: gap.order, kind: "title", from: titleRect, slot: gap.slot }];
		const from = bentoRects[gap.order];
		return from ? [{ order: gap.order, kind: "tile", from, slot: gap.slot }] : [];
	});
}

/** 0 → 1: a grey card, the bento tiles' own, rises under "Team ’26" on the DOM slide. */
export function bentoTitleForm(time: number): number {
	return EASE.outBold(progress(wallSince(time), WALL_CUE.titleCardAt, WALL_CUE.titleFlipAt));
}

/** When the formed title card hands over to its GL sheet and flips: from here its DOM title hides. */
export function bentoTitleFlipTime(): number {
	return WALL_CUE.start + WALL_CUE.titleFlipAt;
}

/** When the DOM bento hands its cards to their GL sheets (the DOM cards hide). */
export function bentoTossTime(): number {
	return WALL_CUE.start + WALL_CUE.tossAt;
}

/**
 * The title card's flip, after the field's cards tumbling end over end
 * through the rush: a spring that whips it through edge-on in about a tenth
 * of a second and lets it overshoot flat a little before it settles; a hop
 * toward the lens (camera distances) and up the frame (frame heights) that
 * peaks as it turns edge-on, which its cloth answers by bowing; a little
 * roll, as a flicked card never turns quite square; and how long the throw
 * takes to win it over from the flip once it is thrown.
 */
const TITLE_FLIP = { stiffness: 220, damping: 20, hopS: 0.5, leap: 0.07, rise: 0.025, roll: 0.06, blendS: 0.3 } as const;

/**
 * The hop's height through it (0 → 1 → 0 by `hopS`): it leaves the slide at
 * the flick's speed, peaks a little after edge-on, and floats back down
 * slower than it rose, coming to rest as the air lets it go.
 */
function titleHop(since: number): number {
	const x = progress(since, 0, TITLE_FLIP.hopS);
	return Math.sin(Math.PI * (1 - (1 - x) ** 2));
}

/**
 * The title card's flip, from its hand-over on: exactly where its DOM card
 * lay, grey side up (its back: the sheet's front is the black face the
 * throw carries), and turning over end to end, top edge away first, onto
 * that black front. Before the hand-over it is that resting pose.
 */
function titleFlipPose(drop: BentoDrop, time: number, viewport: FinaleViewport): FinaleCardPose {
	const since = Math.max(0, time - bentoTitleFlipTime());
	const over = 1 - spring(since, TITLE_FLIP.stiffness, TITLE_FLIP.damping);
	const hop = titleHop(since);
	const rest = flatPose(drop.from, 0);
	return {
		...rest,
		y: rest.y - hop * TITLE_FLIP.rise * viewport.height,
		z: hop * TITLE_FLIP.leap * cameraDistance(viewport),
		rotateX: Math.PI * over,
		rotateZ: hop * TITLE_FLIP.roll,
		lift: hop,
	};
}

/** When a card leaves: the title straight out of its flip, the tiles within a hair of it. */
function launchTime(drop: BentoDrop): number {
	return drop.kind === "title" ? bentoTossTime() : bentoTossTime() + hash01(drop.order * 7.7 + 3) * WALL_CUE.tossSpread;
}

const landingRanks = new WeakMap<readonly BentoDrop[], Map<number, number>>();

/** The shortest throws land first, then the longer ones, a beat apart. */
function landingRank(drop: BentoDrop, drops: readonly BentoDrop[]): number {
	let ranks = landingRanks.get(drops);
	if (!ranks) {
		const travel = (each: BentoDrop) => Math.hypot(each.slot.rect.x - each.from.x, each.slot.rect.y - each.from.y);
		ranks = new Map([...drops].sort((a, b) => travel(a) - travel(b) || a.order - b.order).map((each, rank) => [each.order, rank]));
		landingRanks.set(drops, ranks);
	}
	return ranks.get(drop.order) ?? drop.order;
}

/** When bento card `drop` touches down in its gap. */
export function bentoTouchdown(drop: BentoDrop, drops: readonly BentoDrop[]): number {
	return WALL_CUE.start + WALL_CUE.landAt + landingRank(drop, drops) * WALL_CUE.landStagger;
}

/** When the last of the bento's cards is down, `count` of them (`wall.gaps`): the latest `bentoTouchdown`. */
export function bentoLandedTime(count: number): number {
	return WALL_CUE.start + WALL_CUE.landAt + Math.max(0, count - 1) * WALL_CUE.landStagger;
}

/** When its last stretch begins: the swoop onto the wall, as onto the slide. */
export function bentoFallStart(drop: BentoDrop, drops: readonly BentoDrop[]): number {
	return bentoTouchdown(drop, drops) - WALL_CUE.fallS;
}

/** Where on its flight a card is (0 thrown → 1 down). */
function flightProgress(drop: BentoDrop, drops: readonly BentoDrop[], time: number): number {
	const launch = launchTime(drop);
	return clamp((time - launch) / (bentoTouchdown(drop, drops) - launch));
}

/** How the air treats a sheet: its turns die away early, and it falls away fastest as it leaves the hand. */
const SPIN_DONE = 0.58;
const AWAY_SKEW = 1.8;
/**
 * How near the lens a thrown card starts, as its apparent scale there (the
 * camera distance over its depth), and the rest of its shrink to the gap is
 * the sheet's own, so the tumbling sheet never reaches the lens's fade.
 */
const NEAR_SCALE = 2.4;

/**
 * A thrown card in the air, falling away from the lens onto the wall. The
 * wall lies far below the bento (its cards are a fraction of the bento's
 * size), so a card thrown at it starts near the lens, where it covers its
 * bento tile exactly, and descends to the wall's plane, perspective shrinking
 * it into its gap as it goes: fast as it leaves, then floating down. It never
 * comes toward the viewer. On screen it travels most of the way across early
 * and comes down nearly straight, as paper does once the throw is spent. Its
 * whole turns (the Done column's deck: some flip end over end, some spin, the
 * rest only tilt) are spent early, and on top of them it banks into its
 * travel, pitches into the throw and flares before it lands, and wobbles.
 */
function airbornePose(drop: BentoDrop, gap: FinaleRect, u: number, time: number, viewport: FinaleViewport): FinaleCardPose {
	const seed = drop.order * 13.1 + 1;
	const distance = cameraDistance(viewport);
	const centre = { x: viewport.width / 2, y: viewport.height / 2 };
	const from = { x: drop.from.x + drop.from.width / 2, y: drop.from.y + drop.from.height / 2 };
	const to = { x: gap.x + gap.width / 2, y: gap.y + gap.height / 2 };
	const across = 1 - (1 - u) ** 2.4;
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const span = Math.max(1, Math.hypot(dx, dy));
	// Off the straight line, to one side: no two cards fly the same path.
	const side = (hash01(seed * 2.1) - 0.5) * 2;
	const sway = Math.sin(Math.PI * across) * span * 0.22 * side;
	const screenX = from.x + dx * across - (dy / span) * sway;
	const screenY = from.y + dy * across + (dx / span) * sway - Math.sin(Math.PI * across) * viewport.height * lerp(0.04, 0.12, hash01(seed * 3.3));
	// Its apparent size over its gap's, from the tile's down to 1, eased in log space so it reads as steady travel away.
	const start = Math.max(1, Math.sqrt((drop.from.width * drop.from.height) / (gap.width * gap.height)));
	const away = 1 - (1 - u) ** AWAY_SKEW;
	const apparent = start ** (1 - away);
	// Depth carries the same share of that shrink throughout; the sheet itself the rest.
	const share = start > 1 ? Math.log(Math.min(start, NEAR_SCALE)) / Math.log(start) : 1;
	const near = apparent ** share;
	const own = apparent / near;
	// Its shape turns from the tile's to the gap's on the way.
	const shape = smooth(0.05, 0.7, u);
	const spin = u >= SPIN_DONE ? 0 : 1 - (1 - u / SPIN_DONE) ** 2.6;
	// The title has just flipped to its black face: it may spin, but never turns its pale back up again.
	const over = drop.kind === "title" ? 0 : spin;
	const air = Math.sin(Math.PI * u);
	const wobble = (hash01(seed * 9.7) - 0.5) * 1.2;
	const breath = time + seed * 1.7;
	return {
		...flatPose(drop.from, 0),
		// Where it must be in the air to be seen on its path.
		x: centre.x + (screenX - centre.x) / near,
		y: centre.y + (screenY - centre.y) / near,
		z: distance * (1 - 1 / near),
		width: lerp(drop.from.width / start, gap.width, shape) * own,
		height: lerp(drop.from.height / start, gap.height, shape) * own,
		rotateX: turns(seed * 2.3, 0.35) * TAU * over - (1 - 2 * u) * 0.42 * air + Math.sin(breath * 1.3) * 0.05 * air,
		rotateY: turns(seed * 3.7, 0.25) * TAU * over + wobble * air + Math.cos(breath * 1.1) * 0.06 * air,
		rotateZ: turns(seed * 4.9, 0.3) * TAU * spin + (dx / span) * 0.38 * Math.sin(Math.PI * across) + (hash01(seed * 8.3) - 0.5) * 0.5 * air,
		lift: smooth(0, 0.06, u),
	};
}

/**
 * A bento card's GL sheet through the act, or null when the GL layer does not
 * draw it: before the throw (its DOM card shows; the title's only until it
 * flips) and once its landed DOM face has taken over.
 */
export function bentoSheetPose(drop: BentoDrop, drops: readonly BentoDrop[], time: number, geometry: WallGeometry, viewport: FinaleViewport): FinaleCardPose | null {
	if (drop.kind === "title") return time < bentoTitleFlipTime() ? null : titleSheetPose(drop, drops, time, geometry, viewport);
	return time < bentoTossTime() ? null : thrownPose(drop, drops, time, geometry, viewport);
}

/** When the throw has won the title wholly over from its flip. */
export function bentoTitleFlownTime(): number {
	return bentoTossTime() + TITLE_FLIP.blendS;
}

/** How far the throw has won the title over from its flip (0 at the throw → 1). */
function titleInto(time: number): number {
	return smooth(bentoTossTime(), bentoTitleFlownTime(), time);
}

/**
 * The title from its flip on: turning over in its box until it is thrown,
 * then flying on out of the flip, its turn and hop giving way to the throw's
 * flight, so it never comes to rest in the bento.
 */
function titleSheetPose(drop: BentoDrop, drops: readonly BentoDrop[], time: number, geometry: WallGeometry, viewport: FinaleViewport): FinaleCardPose | null {
	const flip = titleFlipPose(drop, time, viewport);
	if (time < bentoTossTime()) return flip;
	const thrown = thrownPose(drop, drops, time, geometry, viewport);
	const into = titleInto(time);
	return !thrown || into >= 1 ? thrown : blendPose(flip, thrown, into);
}

/**
 * A card from its throw on, or null once its landed DOM face has taken over.
 * Its last stretch is the slide's own swoop (`EASE.inOut` over
 * `CUE.tileFall`), so it lands exactly as the bento's tiles landed.
 */
function thrownPose(drop: BentoDrop, drops: readonly BentoDrop[], time: number, geometry: WallGeometry, viewport: FinaleViewport): FinaleCardPose | null {
	const touchdown = bentoTouchdown(drop, drops);
	if (landingHandover(time, touchdown) >= 1) return null;
	const gap = slotOnScreen(drop.slot, wallOffset(time, geometry), geometry);
	if (time >= touchdown) return landedPose(gap, touchdown, time, 0);
	// Before its own launch it waits, in the air but seen exactly on its tile (a flat pose here would jolt its cloth at launch).
	const airborne = airbornePose(drop, gap, flightProgress(drop, drops, time), time, viewport);
	const start = bentoFallStart(drop, drops);
	const fall = EASE.inOut(progress(time, start, touchdown));
	if (fall <= 0) return airborne;
	const pose = blendPose(airborne, flatPose(gap, 0), fall);
	return { ...pose, lift: airborne.lift * (1 - fall), waveAge: landingWaveAge(time, touchdown) };
}

/* ─── Arrivals at the leading edge ────────────────────────────────────── */

/** Where across the frame a waiting card starts down: between these many pitches from the right edge. */
const DESCEND_FROM = 0.45;
export const DESCEND_SPAN = 0.7;

export interface Descent {
	readonly start: number;
	readonly touchdown: number;
}

/** `compute`'s value for a slot of `wall`, worked out once. */
export function perSlot<T>(store: WeakMap<FinaleWall, Map<string, T>>, wall: FinaleWall, slot: WallSlot, compute: () => T): T {
	let known = store.get(wall);
	if (!known) {
		known = new Map();
		store.set(wall, known);
	}
	if (known.has(slot.key)) return known.get(slot.key) as T;
	const value = compute();
	known.set(slot.key, value);
	return value;
}

/**
 * A slot's descent when its card starts down as its centre crosses a line
 * `from` to `from + span` pitches in from the frame's right edge (where, by
 * the slot's seed); null if it was already on the wall when it appeared.
 */
function descentFrom(slot: WallSlot, geometry: WallGeometry, from: number, span: number): Descent | null {
	const line = geometry.viewport.width - geometry.pitch * (from + span * hash01(slot.seed * 0.917 + 0.13));
	const start = wallTimeAt(slot.rect.x + geometry.originX + slot.rect.width / 2 - line, geometry);
	return start === Number.NEGATIVE_INFINITY ? null : { start, touchdown: start + WALL_CUE.descendS * lerp(0.85, 1.25, hash01(slot.seed * 1.37 + 0.5)) };
}

const descents = new WeakMap<FinaleWall, Map<string, Descent | null>>();

/**
 * When a card at the leading edge comes down from the air into its slot:
 * each at its own place across the frame (so at its own moment), whether or
 * not a teammate sets it down; null for a card already on the wall when it
 * appeared.
 */
export function slotDescent(slot: WallSlot, wall: FinaleWall): Descent | null {
	return perSlot(descents, wall, slot, () => descentFrom(slot, wall.geometry, DESCEND_FROM, DESCEND_SPAN));
}

/**
 * When a slot's card lands: a gap's when its bento card touches down, an
 * arrival's when it settles from the air; `-Infinity` for a card already
 * there when the wall appeared.
 */
export function slotTouchdown(slot: WallSlot, wall: FinaleWall, drops: readonly BentoDrop[]): number {
	if (slot.reserved !== undefined) {
		const drop = drops.find((each) => each.order === slot.reserved);
		return drop ? bentoTouchdown(drop, drops) : Number.NEGATIVE_INFINITY;
	}
	return slotDescent(slot, wall)?.touchdown ?? Number.NEGATIVE_INFINITY;
}

/** How far a waiting card's breath carries it: px across and down, and radians of tip and turn. */
export const BREATH = { x: 8, y: 10, tip: 0.06, turn: 0.08 } as const;

/**
 * A card waiting in the air above its slot, as cards float in the field:
 * up toward the lens at its own height, tipped back and turned toward the
 * middle of the frame, a little off its slot, breathing (`breathing`: off,
 * it holds the middle of its breath, the same on every pass of the loop).
 */
function waitingPose(slot: WallSlot, rect: FinaleRect, time: number, viewport: FinaleViewport, face: number, breathing = true): FinaleCardPose {
	const seed = slot.seed * 1.31 + 7;
	const distance = cameraDistance(viewport);
	const breath = time + seed * 1.7;
	const sway = breathing ? 1 : 0;
	return {
		...flatPose(rect, face),
		x: rect.x + rect.width / 2 + (hash01(seed * 2.7) - 0.5) * rect.width * 0.35 + Math.cos(breath * 0.7) * BREATH.x * sway,
		y: rect.y + rect.height / 2 + (hash01(seed * 3.9) - 0.5) * rect.height * 0.45 + Math.sin(breath * 0.9) * BREATH.y * sway,
		z: distance * lerp(0.1, 0.32, hash01(seed * 5.3)),
		rotateX: -lerp(0.2, 0.75, hash01(seed * 6.1)) + Math.sin(breath * 0.6) * BREATH.tip * sway,
		rotateY: lerp(-0.25, 0.8, hash01(seed * 7.3)) + Math.cos(breath * 0.5) * BREATH.turn * sway,
		rotateZ: (hash01(seed * 8.9) - 0.5) * 0.6,
		lift: 1,
	};
}

/** An arrival's pose at `time`: waiting, coming down, or landed (`breathing`: as `waitingPose`). */
function arrivalPose(slot: WallSlot, descent: Descent, rect: FinaleRect, time: number, viewport: FinaleViewport, stack?: FinaleRect, breathing = true): FinaleCardPose {
	const face = slot.content.kind === "print" ? 0 : 1;
	if (time >= descent.touchdown) return landedPose(rect, descent.touchdown, time, face);
	// One of a print slot's cards (`rect`) waits in its stack (`stack`, the slot on screen), carried as the stack turns.
	const waiting = stack ? carried(waitingPose(slot, stack, time, viewport, face, breathing), rect, stack) : waitingPose(slot, rect, time, viewport, face, breathing);
	const down = EASE.inOut(progress(time, descent.start, descent.touchdown));
	if (down <= 0) return waiting;
	const pose = blendPose(waiting, flatPose(rect, face), down);
	return { ...pose, lift: 1 - down, waveAge: landingWaveAge(time, descent.touchdown) };
}

/* ─── A print slot's Done cards, each a card of its own ───────────────── */

/** Down a print slot's stack, each card starts down about this long after the one above it. */
const PRINT_DEAL_S = 0.09;

/**
 * A card that comes down at the leading edge, as the GL layer, the DOM and the
 * accents all see it: a slot's own card, or one of a print slot's Done cards.
 * Those are cards of their own (each its own sheet, shadow, landing wave and
 * accents, on exactly the rect its print fills: `wallPrintCards`): they wait
 * in the air as the stack they form, and peel off it one after another, top
 * first, so a stack never lands as a block.
 */
export interface WallArrival {
	/** The slot's key, or `<slot key>#<index>` for one of a print slot's cards. */
	readonly key: string;
	/** Its place in a print slot's `codes`, and its code; null for the slot's own card. */
	readonly index: number | null;
	readonly code: string | null;
	/** In the slot: px from its top left. */
	readonly rect: FinaleRect;
	/** Its corner radius, px. */
	readonly radius: number;
	readonly descent: Descent;
}

const wholeArrivals = new WeakMap<WallSlot, readonly WallArrival[]>();

/** How long after its slot's descent card `index` of a print stack comes down: the cards above it, each a beat apart. */
export function dealDelay(slot: WallSlot, index: number): number {
	let delay = 0;
	for (let step = 1; step <= index; step += 1) delay += PRINT_DEAL_S * lerp(0.7, 1.3, hash01(slot.seed * 2.39 + step * 0.61));
	return delay;
}

/**
 * The cards that come down into a slot, top to bottom: its own card, or a
 * print slot's printed Done cards (one card over the whole slot until any of
 * them is printed, as its DOM stand-in fills it); none for a slot already on
 * the wall when it appeared.
 */
export function slotArrivals(slot: WallSlot, wall: FinaleWall, prints?: WallPrintShapes): readonly WallArrival[] {
	const descent = slotDescent(slot, wall);
	if (!descent) return [];
	const cards = slot.content.kind === "print" && prints ? wallPrintCards(slot.rect, slot.content.codes, prints, wallPrintGap(wall.geometry)) : [];
	if (cards.length > 0) {
		return cards.map((card): WallArrival => {
			const delay = dealDelay(slot, card.index);
			return { key: `${slot.key}#${card.index}`, index: card.index, code: card.code, rect: card.rect, radius: card.radius, descent: { start: descent.start + delay, touchdown: descent.touchdown + delay } };
		});
	}
	const known = wholeArrivals.get(slot);
	if (known) return known;
	const whole: readonly WallArrival[] = [{ key: slot.key, index: null, code: null, rect: { x: 0, y: 0, width: slot.rect.width, height: slot.rect.height }, radius: wall.geometry.radius, descent }];
	wholeArrivals.set(slot, whole);
	return whole;
}

/** A card's rect on screen, its slot on screen at `slot`. */
function arrivalOnScreen(card: WallArrival, slot: FinaleRect): FinaleRect {
	return card.index === null ? slot : { x: slot.x + card.rect.x, y: slot.y + card.rect.y, width: card.rect.width, height: card.rect.height };
}

/** A card's pose at `time`, its slot on screen at `slot`: a print slot's cards wait in their stack. */
export function arrivalCardPose(slot: WallSlot, card: WallArrival, onScreen: FinaleRect, time: number, viewport: FinaleViewport, breathing = true): FinaleCardPose {
	return arrivalPose(slot, card.descent, arrivalOnScreen(card, onScreen), time, viewport, card.index === null ? undefined : onScreen, breathing);
}

/**
 * Card `rect` of a stack (`stack`, both on screen) as the stack's pose carries
 * it: its centre where it lies on the stack's turned plane, turned as the
 * stack is (the sheet's own turn, as `poseSheet` applies it: x, then y, then
 * −z, in world axes with y up), at its own size.
 */
function carried(pose: FinaleCardPose, rect: FinaleRect, stack: FinaleRect): FinaleCardPose {
	const dx = rect.x + rect.width / 2 - (stack.x + stack.width / 2);
	const dy = stack.y + stack.height / 2 - (rect.y + rect.height / 2);
	const z = -pose.rotateZ;
	const x1 = dx * Math.cos(z) - dy * Math.sin(z);
	const y1 = dx * Math.sin(z) + dy * Math.cos(z);
	const x2 = x1 * Math.cos(pose.rotateY);
	const z2 = -x1 * Math.sin(pose.rotateY);
	const y3 = y1 * Math.cos(pose.rotateX) - z2 * Math.sin(pose.rotateX);
	const z3 = y1 * Math.sin(pose.rotateX) + z2 * Math.cos(pose.rotateX);
	return { ...pose, x: pose.x + x2, y: pose.y - y3, z: pose.z + z3, width: rect.width, height: rect.height };
}

/* ─── What a slot's card looks like as a blank sheet ──────────────────── */

const CHAPTER_TINT = { Context: "#DAF0AF", Collaboration: "#E9D8F8", Confidence: "#D0E1FD" } as const;

/** A card's blank colour: its tile's own fill, before its content builds. */
export function slotSheetColor(content: WallContent): string {
	switch (content.kind) {
		case "poster":
			return FINALE_BRAND[content.fill];
		case "benefit":
			return CHAPTER_TINT[content.story.chapter];
		case "title":
			return FINALE_BRAND.black;
		default:
			return FINALE_COLORS.tile;
	}
}

/* ─── The GL layer's sheets, frame by frame ───────────────────────────── */

export interface WallSheet {
	/** Stable for the sheet's whole flight. */
	readonly key: string;
	readonly kind: "bento" | "card";
	readonly pose: FinaleCardPose;
	/** The blank sheet's colour (`uTileColor`). */
	readonly color: string;
	/** Its back's (`uBackColor`): its own colour, but for the title card, whose back is the grey card it formed as. */
	readonly back: string;
	/**
	 * A printed face for the sheet (face 0), by key: `bento-<order>` for a bento
	 * tile's print, `title` for "Team ’26". Without it the sheet is blank (face 1).
	 */
	readonly texture: string | null;
	/**
	 * A Done card printed on the sheet, by code (face 0): one of a print slot's
	 * cards, the sheet its rect, the print filling it as its DOM card is
	 * painted (`paintWallPrint`). Else null.
	 */
	readonly print: string | null;
	/** Its landing shadow: when it exists and the pose to cast it from; null for none. */
	readonly shadow: { readonly start: number; readonly settled: number; readonly pose: FinaleCardPose } | null;
	/** World px/s (x right, y up, z toward the lens), for the cloth. */
	readonly velocity: { readonly x: number; readonly y: number; readonly z: number };
	/** Corner radius, sheet px. */
	readonly radius: number;
	/** How much of the field's chromatic smear films it (0–1): while it flies or waits in the air. */
	readonly chroma: number;
}

const CLOTH_LAG = 0.12;

const STILL: Vec3 = { x: 0, y: 0, z: 0 };

function velocityOf(now: FinaleCardPose, before: FinaleCardPose): Vec3 {
	return { x: (now.x - before.x) / CLOTH_LAG, y: (before.y - now.y) / CLOTH_LAG, z: (now.z - before.z) / CLOTH_LAG };
}

/** A thrown card's motion for its cloth: still as it leaves the hand, then its flight's. */
function thrownVelocity(drop: BentoDrop, drops: readonly BentoDrop[], time: number, pose: FinaleCardPose, geometry: WallGeometry, viewport: FinaleViewport): Vec3 {
	const before = time - CLOTH_LAG;
	if (before < bentoTossTime()) return STILL;
	return velocityOf(pose, thrownPose(drop, drops, before, geometry, viewport) ?? pose);
}

/**
 * A bento sheet's motion for its cloth. The title's flip feels its hop from
 * rest, and hands that over to its flight's as the throw wins it over. Each
 * is measured in its own space: the throw carries a card from near the lens
 * (`airbornePose`), and a blend across the two depths would read as a rush
 * toward the lens that is never seen.
 */
function bentoSheetVelocity(drop: BentoDrop, drops: readonly BentoDrop[], time: number, pose: FinaleCardPose, geometry: WallGeometry, viewport: FinaleViewport): Vec3 {
	if (drop.kind !== "title") return thrownVelocity(drop, drops, time, pose, geometry, viewport);
	const flip = titleFlipPose(drop, time, viewport);
	const flipping = velocityOf(flip, titleFlipPose(drop, time - CLOTH_LAG, viewport));
	const into = titleInto(time);
	if (into <= 0) return flipping;
	const thrown = thrownPose(drop, drops, time, geometry, viewport) ?? pose;
	const flying = thrownVelocity(drop, drops, time, thrown, geometry, viewport);
	return { x: lerp(flipping.x, flying.x, into), y: lerp(flipping.y, flying.y, into), z: lerp(flipping.z, flying.z, into) };
}

/** How many pitches past the frame's right edge a waiting card is still drawn (it stands out toward the lens). */
const ARRIVAL_LEAD = 1.2;

/** How long a thrown card's smear takes to swell in as it leaves the hand. */
const BENTO_SMEAR_IN_S = 0.4;

/**
 * Every sheet the GL layer draws at `time`: the title card from its flip,
 * the bento's six tiles from the throw, each until its DOM face takes over,
 * and each arriving card from when it waits in view until its DOM card has
 * taken over: a print slot's Done cards each a sheet of its own, on its
 * printed card's rect (`prints`: the prints' shapes; without it, or before
 * any is printed, the slot comes down as one blank card).
 */
export function wallSheetsAt(time: number, wall: FinaleWall, drops: readonly BentoDrop[], viewport: FinaleViewport, prints?: WallPrintShapes): readonly WallSheet[] {
	if (!wallActive(time)) return [];
	const { geometry } = wall;
	const sheets: WallSheet[] = [];
	for (const drop of drops) {
		const pose = bentoSheetPose(drop, drops, time, geometry, viewport);
		if (!pose) continue;
		const touchdown = bentoTouchdown(drop, drops);
		const launch = launchTime(drop);
		const title = drop.kind === "title";
		sheets.push({
			key: `bento-${drop.order}`,
			kind: "bento",
			pose,
			color: title ? FINALE_BRAND.black : FINALE_COLORS.tile,
			back: FINALE_COLORS.tile,
			texture: title ? "title" : `bento-${drop.order}`,
			print: null,
			// The flip hops in place, over its own box: only the throw casts a landing shadow.
			shadow: time < bentoTossTime() ? null : { start: bentoFallStart(drop, drops), settled: touchdown, pose },
			velocity: bentoSheetVelocity(drop, drops, time, pose, geometry, viewport),
			// The bento card's radius, scaling down with it to the wall's.
			radius: (geometry.radius * pose.width) / drop.slot.rect.width,
			// It swells in as it leaves the hand and clears over its swoop down, landing crisp: eased at both ends, so it never snaps.
			chroma: smooth(launch, launch + BENTO_SMEAR_IN_S, time) * (1 - smooth(bentoFallStart(drop, drops), touchdown, time)),
		});
	}
	const offset = wallOffset(time, geometry);
	const { first, last } = visibleColumns(offset, geometry);
	const reach = Math.ceil(ARRIVAL_LEAD);
	for (let column = first; column <= last + reach; column += 1) {
		for (const slot of wall.column(column)) {
			if (slot.reserved !== undefined) continue;
			const cards = slotArrivals(slot, wall, prints);
			if (cards.length === 0) continue;
			const rect = slotOnScreen(slot, offset, geometry);
			if (rect.x > viewport.width + geometry.pitch * ARRIVAL_LEAD) continue;
			const earlier = slotOnScreen(slot, wallOffset(time - CLOTH_LAG, geometry), geometry);
			// Waiting cards appear with the rest of the wall, where they wait.
			const shown = wallRevealAt({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, slot.seed, time, viewport);
			const color = slotSheetColor(slot.content);
			for (const card of cards) {
				const { descent } = card;
				if (landingHandover(time, descent.touchdown) >= 1) continue;
				const pose = arrivalCardPose(slot, card, rect, time, viewport);
				const before = arrivalCardPose(slot, card, earlier, time - CLOTH_LAG, viewport);
				sheets.push({
					key: `card-${card.key}`,
					kind: "card",
					// A print slot with nothing printed yet comes down as the blank tile its stand-in builds on.
					pose: { ...pose, opacity: pose.opacity * shown, face: slot.content.kind === "print" && card.code === null ? 1 : pose.face },
					color,
					back: color,
					texture: null,
					print: card.code,
					shadow: { start: descent.start, settled: descent.touchdown, pose },
					velocity: velocityOf(pose, before),
					radius: card.radius,
					chroma: 1 - smooth(descent.start, descent.touchdown, time),
				});
			}
		}
	}
	return sheets;
}

/* ─── The DOM's side ──────────────────────────────────────────────────── */

export interface WallSlotPresence {
	/** The DOM slot's opacity: the wall's reveal, or its hand-over from the GL sheet. */
	readonly opacity: number;
	/** The reveal's settle: a card comes up a hair small. */
	readonly scale: number;
	/** When its content builds (it lands blank), or null: it is there already, built. */
	readonly revealStart: number | null;
	/**
	 * A print slot whose Done cards land one by one: each card's own hand-over
	 * (0 → 1), by its place in the slot's `codes` (`wallPrintOpacity`), while
	 * the slot itself shows whenever any of them does. Else null: the slot
	 * shows as one card.
	 */
	readonly cards: readonly number[] | null;
}

/** How a slot's DOM card shows at `time` (`prints`: the prints' shapes, as `wallSheetsAt` takes them). */
export function wallSlotPresence(slot: WallSlot, wall: FinaleWall, drops: readonly BentoDrop[], time: number, prints?: WallPrintShapes): WallSlotPresence {
	if (slot.reserved !== undefined) {
		// A bento card lands in it already built: no reveal to replay.
		return { opacity: landingFaceShown(time, slotTouchdown(slot, wall, drops)), scale: 1, revealStart: null, cards: null };
	}
	const descent = slotDescent(slot, wall);
	if (descent) {
		const revealStart = landingRevealStart(descent.touchdown);
		const arrivals = slotArrivals(slot, wall, prints);
		if (slot.content.kind !== "print" || arrivals.every((card) => card.index === null)) return { opacity: landingFaceShown(time, descent.touchdown), scale: 1, revealStart, cards: null };
		const cards = slot.content.codes.map(() => 0);
		for (const card of arrivals) if (card.index !== null) cards[card.index] = landingFaceShown(time, card.descent.touchdown);
		return { opacity: cards.some((shown) => shown > 0) ? 1 : 0, scale: 1, revealStart, cards };
	}
	const { geometry } = wall;
	const rect = slotOnScreen(slot, wallOffset(time, geometry), geometry);
	const reveal = wallRevealAt({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, slot.seed, time, geometry.viewport);
	return { opacity: reveal, scale: lerp(0.94, 1, reveal), revealStart: null, cards: null };
}

/* ─── Accents: border glow and dot pulse, as on the slide ─────────────── */

export interface WallLanding {
	readonly key: string;
	/** The landed card's rect on screen at `time`. */
	readonly rect: FinaleRect;
	readonly touchdown: number;
	/** Seeds its glow's look (as the bento's landing order did). */
	readonly seed: number;
	/** The landed card's corner radius, px: its glow and dot pulse trace its own rounded rect. */
	readonly radius: number;
}

/**
 * Every card whose landing accents may still show at `time`: touched down,
 * content not yet built; each of a print slot's Done cards on its own
 * (`prints`: the prints' shapes, as `wallSheetsAt` takes them).
 */
export function wallLandingsAt(time: number, wall: FinaleWall, drops: readonly BentoDrop[], prints?: WallPrintShapes): readonly WallLanding[] {
	if (!wallActive(time)) return [];
	const { geometry } = wall;
	const offset = wallOffset(time, geometry);
	const landings: WallLanding[] = [];
	const live = (touchdown: number) => time >= touchdown && time <= landingSettled(touchdown);
	for (const drop of drops) {
		const touchdown = bentoTouchdown(drop, drops);
		if (live(touchdown)) landings.push({ key: `bento-${drop.order}`, rect: slotOnScreen(drop.slot, offset, geometry), touchdown, seed: drop.order, radius: geometry.radius });
	}
	const { first, last } = visibleColumns(offset, geometry);
	for (let index = first; index <= last; index += 1) {
		for (const slot of wall.column(index)) {
			if (slot.reserved !== undefined) continue;
			for (const card of slotArrivals(slot, wall, prints)) {
				const { touchdown } = card.descent;
				if (!live(touchdown)) continue;
				// Each of a stack's cards glows with a look of its own.
				const seed = card.index === null ? slot.seed : slot.seed + card.index * 0.37;
				landings.push({ key: card.key, rect: arrivalOnScreen(card, slotOnScreen(slot, offset, geometry)), touchdown, seed, radius: card.radius });
			}
		}
	}
	return landings;
}
