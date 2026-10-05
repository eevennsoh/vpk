import { CUE, WALL_CUE } from "../data/finale-cues";
import { FINALE_BRAND, FINALE_COLORS } from "../data/finale-palette";
import type { FinaleRect } from "../data/finale-stories";
import { blendPose, cameraDistance, flatPose, landingSkew, turns, type FinaleCardPose, type FinaleViewport } from "./finale-card-motion";
import { EASE, clamp, hash01, lerp, progress } from "./finale-math";
import type { FinaleWall, WallContent, WallGeometry, WallSlot } from "./finale-wall-layout";

/*
 * Act III on the finale clock. Every beat is a pure function of the time, so
 * the mega bento scrubs, holds and loops like the rest of the finale.
 *
 * - The throw: "Team ’26" becomes a black tile, and the bento's seven cards,
 *   faces and all, are thrown at once like the Done column's deck. Each flies
 *   as paper does: up toward the lens on its own arc, turning whole turns that
 *   die away as the air catches it, banking into its travel and pitching with
 *   its rise and fall, then floating down more slowly than it rose into its
 *   gap in the mega bento, and landing as the bento's tiles landed on the
 *   slide (the same swoop, Peel's wave, the shadow, then the DOM hand-over).
 * - The reveal: the mega bento appears around the thrown cards, from the
 *   middle of the frame out, each card fading up as the air clears over it.
 * - The glide: the wall travels left at a steady pace once it has picked up
 *   speed, one period a loop, forever.
 * - Arrivals: a card coming in at the leading edge waits in the air above its
 *   slot, tilted and turned like a card in the field, breathing, filmed
 *   through the field's chromatic smear; each comes down at its own moment,
 *   so a column fills raggedly, never as a block. Now and then a presenter
 *   reaches in, takes a card by its corner and sets it down.
 *
 * Coordinates: screen px (x right, y down) for flat positions; z toward the
 * lens. Poses are `FinaleCardPose`s, filmed by the resting camera.
 */

/** The wall's pace: a share of the frame's width a second (the reference wall's glide). */
export const WALL_SPEED_SHARE = 0.042;

function smooth(edge0: number, edge1: number, value: number): number {
	const x = clamp((value - edge0) / (edge1 - edge0));
	return x * x * (3 - 2 * x);
}

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

/** Seconds of travel at full pace by `elapsed` into the ramp (the pace eases in on a smoothstep). */
function rampTravel(elapsed: number): number {
	const ramp: number = WALL_CUE.driftRamp;
	if (elapsed <= 0) return 0;
	if (elapsed >= ramp) return elapsed - ramp / 2;
	const x = elapsed / ramp;
	return ramp * (x ** 3 - x ** 4 / 2);
}

/** How far the wall has travelled left, in viewport px. */
export function wallOffset(time: number, geometry: WallGeometry): number {
	return wallSpeed(geometry) * rampTravel(wallSince(time) - WALL_CUE.driftAt);
}

/** When the wall has travelled `offset` px (the inverse of `wallOffset`); `-Infinity` for none. */
export function wallTimeAt(offset: number, geometry: WallGeometry): number {
	if (offset <= 0) return Number.NEGATIVE_INFINITY;
	const travel = offset / wallSpeed(geometry);
	const ramp: number = WALL_CUE.driftRamp;
	const base = WALL_CUE.start + WALL_CUE.driftAt;
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

/** When a landed card's DOM content starts to build, as `tileRevealStart`. */
export function landingRevealStart(touchdown: number): number {
	return touchdown + CUE.handoff + 0.05;
}

/** When a landed card's accents (border glow, dot pulse) are over: its content has built. */
export function landingSettled(touchdown: number): number {
	return landingRevealStart(touchdown) + CUE.reveal;
}

/** A card resting in its slot, with the landing wave and recoil from `touchdown` on. */
function landedPose(rect: FinaleRect, touchdown: number, time: number, face = 1): FinaleCardPose {
	const age = time - touchdown;
	const pose = flatPose(rect, face);
	return { ...pose, waveAge: age >= 0 ? age : -1, rotateZ: pose.rotateZ + landingSkew(age) };
}

/* ─── The reveal ──────────────────────────────────────────────────────── */

/**
 * How far the mega bento has appeared over a point of the frame (0 → 1): from
 * the throw on, from the middle of the frame out, a little scattered, each
 * card fading up over `revealFadeS`.
 */
export function wallRevealAt(point: { readonly x: number; readonly y: number }, seed: number, time: number, viewport: FinaleViewport): number {
	const reach = Math.hypot(viewport.width / 2, viewport.height / 2);
	const distance = Math.hypot(point.x - viewport.width / 2, point.y - viewport.height / 2) / reach;
	const delay = WALL_CUE.revealAt + WALL_CUE.revealS * (0.72 * clamp(distance) + 0.28 * hash01(seed * 0.71 + 0.3));
	return EASE.outBold(progress(wallSince(time), delay, delay + WALL_CUE.revealFadeS));
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

/** The title card's share of its window: a white card forms under the type, then turns over. */
const TITLE_FORM_END = 0.38;
const TITLE_TURN_START = 0.26;

export interface BentoTitleFlip {
	/** 0 → 1: a white card, the bento tiles' own, rises under "Team ’26". */
	readonly form: number;
	/** 0 → 1: the card turns over, end to end, to its black back with the type in white. */
	readonly turn: number;
}

/**
 * "Team ’26" becomes a card of its own, as a card flips on the slide: a white
 * tile forms under the type, and before it has quite settled it turns over
 * to the black card the throw carries into the mega bento.
 */
export function bentoTitleFlip(time: number): BentoTitleFlip {
	const card = progress(wallSince(time), WALL_CUE.titleCardAt, WALL_CUE.titleCardAt + WALL_CUE.titleCardS);
	return { form: EASE.outBold(progress(card, 0, TITLE_FORM_END)), turn: EASE.inOut(progress(card, TITLE_TURN_START, 1)) };
}

/** When the DOM bento hands its cards to their GL sheets (the DOM cards hide). */
export function bentoTossTime(): number {
	return WALL_CUE.start + WALL_CUE.tossAt;
}

function launchTime(order: number): number {
	return bentoTossTime() + hash01(order * 7.7 + 3) * WALL_CUE.tossSpread;
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

/** When its last stretch begins: the swoop onto the wall, as onto the slide. */
export function bentoFallStart(drop: BentoDrop, drops: readonly BentoDrop[]): number {
	return bentoTouchdown(drop, drops) - WALL_CUE.fallS;
}

/** Where on its flight a card is (0 thrown → 1 down). */
function flightProgress(drop: BentoDrop, drops: readonly BentoDrop[], time: number): number {
	const launch = launchTime(drop.order);
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
		rotateX: turns(seed * 2.3, 0.35) * TAU * spin - (1 - 2 * u) * 0.42 * air + Math.sin(breath * 1.3) * 0.05 * air,
		rotateY: turns(seed * 3.7, 0.25) * TAU * spin + wobble * air + Math.cos(breath * 1.1) * 0.06 * air,
		rotateZ: turns(seed * 4.9, 0.3) * TAU * spin + (dx / span) * 0.38 * Math.sin(Math.PI * across) + (hash01(seed * 8.3) - 0.5) * 0.5 * air,
		lift: smooth(0, 0.06, u),
	};
}

/**
 * A bento card's GL sheet through the act, or null when the GL layer does not
 * draw it: before the throw (its DOM card shows) and once its landed DOM face
 * has taken over. Its last stretch is the slide's own swoop (`EASE.inOut`
 * over `CUE.tileFall`), so it lands exactly as the bento's tiles landed.
 */
export function bentoSheetPose(drop: BentoDrop, drops: readonly BentoDrop[], time: number, geometry: WallGeometry, viewport: FinaleViewport): FinaleCardPose | null {
	const touchdown = bentoTouchdown(drop, drops);
	if (time < bentoTossTime() || landingHandover(time, touchdown) >= 1) return null;
	const gap = slotOnScreen(drop.slot, wallOffset(time, geometry), geometry);
	if (time >= touchdown) return landedPose(gap, touchdown, time, 0);
	// Before its own launch it waits, in the air but seen exactly on its tile (a flat pose here would jolt its cloth at launch).
	const airborne = airbornePose(drop, gap, flightProgress(drop, drops, time), time, viewport);
	const start = bentoFallStart(drop, drops);
	const fall = EASE.inOut(progress(time, start, touchdown));
	if (fall <= 0) return airborne;
	const pose = blendPose(airborne, flatPose(gap, 0), fall);
	return { ...pose, lift: airborne.lift * (1 - fall), waveAge: -1 };
}

/* ─── Arrivals at the leading edge ────────────────────────────────────── */

/** Where across the frame a waiting card starts down: between these many pitches from the right edge. */
const DESCEND_FROM = 0.45;
const DESCEND_SPAN = 0.7;

interface Descent {
	readonly start: number;
	readonly touchdown: number;
}

const descents = new WeakMap<FinaleWall, Map<string, Descent | null>>();

/**
 * When a card at the leading edge comes down from the air into its slot:
 * each at its own place across the frame (so at its own moment), null for a
 * card already on the wall when it appeared.
 */
export function slotDescent(slot: WallSlot, wall: FinaleWall): Descent | null {
	let known = descents.get(wall);
	if (!known) {
		known = new Map();
		descents.set(wall, known);
	}
	const cached = known.get(slot.key);
	if (cached !== undefined) return cached;
	const { geometry } = wall;
	const line = geometry.viewport.width - geometry.pitch * (DESCEND_FROM + DESCEND_SPAN * hash01(slot.seed * 0.917 + 0.13));
	const start = wallTimeAt(slot.rect.x + geometry.originX + slot.rect.width / 2 - line, geometry);
	const descent = start === Number.NEGATIVE_INFINITY ? null : { start, touchdown: start + WALL_CUE.descendS * lerp(0.85, 1.25, hash01(slot.seed * 1.37 + 0.5)) };
	known.set(slot.key, descent);
	return descent;
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

/**
 * A card waiting in the air above its slot, as cards float in the field:
 * up toward the lens at its own height, tipped back and turned toward the
 * middle of the frame, a little off its slot, breathing.
 */
function waitingPose(slot: WallSlot, rect: FinaleRect, time: number, viewport: FinaleViewport, face: number): FinaleCardPose {
	const seed = slot.seed * 1.31 + 7;
	const distance = cameraDistance(viewport);
	const breath = time + seed * 1.7;
	return {
		...flatPose(rect, face),
		x: rect.x + rect.width / 2 + (hash01(seed * 2.7) - 0.5) * rect.width * 0.35 + Math.cos(breath * 0.7) * 8,
		y: rect.y + rect.height / 2 + (hash01(seed * 3.9) - 0.5) * rect.height * 0.45 + Math.sin(breath * 0.9) * 10,
		z: distance * lerp(0.1, 0.32, hash01(seed * 5.3)),
		rotateX: -lerp(0.2, 0.75, hash01(seed * 6.1)) + Math.sin(breath * 0.6) * 0.06,
		rotateY: lerp(-0.25, 0.8, hash01(seed * 7.3)) + Math.cos(breath * 0.5) * 0.08,
		rotateZ: (hash01(seed * 8.9) - 0.5) * 0.6,
		lift: 1,
	};
}

/** An arrival's pose at `time`: waiting, coming down, or landed. */
function arrivalPose(slot: WallSlot, descent: Descent, rect: FinaleRect, time: number, viewport: FinaleViewport): FinaleCardPose {
	const face = slot.content.kind === "print" ? 0 : 1;
	if (time >= descent.touchdown) return landedPose(rect, descent.touchdown, time, face);
	const waiting = waitingPose(slot, rect, time, viewport, face);
	const down = EASE.inOut(progress(time, descent.start, descent.touchdown));
	if (down <= 0) return waiting;
	const pose = blendPose(waiting, flatPose(rect, face), down);
	return { ...pose, lift: 1 - down, waveAge: -1 };
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
		case "terminal":
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
	/** The blank sheet's colour (`uTileColor`), and its back's. */
	readonly color: string;
	/**
	 * A printed face for the sheet (face 0), by key: `bento-<order>` for a bento
	 * tile's print, `title` for "Team ’26". Without it the sheet is blank (face 1).
	 */
	readonly texture: string | null;
	/** Done cards printed on the sheet, stacked as their DOM slot stacks them (face 0); else null. */
	readonly prints: readonly string[] | null;
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

function velocityOf(now: FinaleCardPose, before: FinaleCardPose): { x: number; y: number; z: number } {
	return { x: (now.x - before.x) / CLOTH_LAG, y: (before.y - now.y) / CLOTH_LAG, z: (now.z - before.z) / CLOTH_LAG };
}

/** How many pitches past the frame's right edge a waiting card is still drawn (it stands out toward the lens). */
const ARRIVAL_LEAD = 1.2;

/**
 * Every sheet the GL layer draws at `time`: the bento's seven cards from the
 * throw until their DOM faces take over, and each arriving card from when it
 * waits in view until its DOM card has taken over.
 */
export function wallSheetsAt(time: number, wall: FinaleWall, drops: readonly BentoDrop[], viewport: FinaleViewport): readonly WallSheet[] {
	if (!wallActive(time)) return [];
	const { geometry } = wall;
	const sheets: WallSheet[] = [];
	for (const drop of drops) {
		const pose = bentoSheetPose(drop, drops, time, geometry, viewport);
		if (!pose) continue;
		const before = bentoSheetPose(drop, drops, time - CLOTH_LAG, geometry, viewport) ?? pose;
		const touchdown = bentoTouchdown(drop, drops);
		const flight = progress(time, launchTime(drop.order), touchdown);
		sheets.push({
			key: `bento-${drop.order}`,
			kind: "bento",
			pose,
			color: drop.kind === "title" ? FINALE_BRAND.black : FINALE_COLORS.tile,
			texture: drop.kind === "title" ? "title" : `bento-${drop.order}`,
			prints: null,
			shadow: { start: bentoFallStart(drop, drops), settled: touchdown, pose },
			velocity: velocityOf(pose, before),
			// The bento card's radius, scaling down with it to the wall's.
			radius: (geometry.radius * pose.width) / drop.slot.rect.width,
			chroma: Math.sin(Math.PI * flight) ** 0.8,
		});
	}
	const offset = wallOffset(time, geometry);
	const { first, last } = visibleColumns(offset, geometry);
	const reach = Math.ceil(ARRIVAL_LEAD);
	for (let column = first; column <= last + reach; column += 1) {
		for (const slot of wall.column(column)) {
			if (slot.reserved !== undefined) continue;
			const descent = slotDescent(slot, wall);
			if (!descent || landingHandover(time, descent.touchdown) >= 1) continue;
			const rect = slotOnScreen(slot, offset, geometry);
			if (rect.x > viewport.width + geometry.pitch * ARRIVAL_LEAD) continue;
			const pose = arrivalPose(slot, descent, rect, time, viewport);
			const before = arrivalPose(slot, descent, slotOnScreen(slot, wallOffset(time - CLOTH_LAG, geometry), geometry), time - CLOTH_LAG, viewport);
			// Waiting cards appear with the rest of the wall, where they wait.
			const shown = wallRevealAt({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, slot.seed, time, viewport);
			sheets.push({
				key: `card-${slot.key}`,
				kind: "card",
				pose: { ...pose, opacity: pose.opacity * shown },
				color: slotSheetColor(slot.content),
				texture: null,
				prints: slot.content.kind === "print" ? slot.content.codes : null,
				shadow: { start: descent.start, settled: descent.touchdown, pose },
				velocity: velocityOf(pose, before),
				radius: geometry.radius,
				chroma: 1 - smooth(descent.start, descent.touchdown, time),
			});
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
}

/** How a slot's DOM card shows at `time`. */
export function wallSlotPresence(slot: WallSlot, wall: FinaleWall, drops: readonly BentoDrop[], time: number): WallSlotPresence {
	if (slot.reserved !== undefined) {
		// A bento card lands in it already built: no reveal to replay.
		return { opacity: landingHandover(time, slotTouchdown(slot, wall, drops)), scale: 1, revealStart: null };
	}
	const descent = slotDescent(slot, wall);
	if (descent) return { opacity: landingHandover(time, descent.touchdown), scale: 1, revealStart: landingRevealStart(descent.touchdown) };
	const { geometry } = wall;
	const rect = slotOnScreen(slot, wallOffset(time, geometry), geometry);
	const reveal = wallRevealAt({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, slot.seed, time, geometry.viewport);
	return { opacity: reveal, scale: lerp(0.94, 1, reveal), revealStart: null };
}

/* ─── Accents: border glow and dot pulse, as on the slide ─────────────── */

export interface WallLanding {
	readonly key: string;
	/** The landed card's rect on screen at `time`. */
	readonly rect: FinaleRect;
	readonly touchdown: number;
	/** Seeds its glow's look (as the bento's landing order did). */
	readonly seed: number;
}

/** Every card whose landing accents may still show at `time`: touched down, content not yet built. */
export function wallLandingsAt(time: number, wall: FinaleWall, drops: readonly BentoDrop[]): readonly WallLanding[] {
	if (!wallActive(time)) return [];
	const { geometry } = wall;
	const offset = wallOffset(time, geometry);
	const landings: WallLanding[] = [];
	const live = (touchdown: number) => time >= touchdown && time <= landingSettled(touchdown);
	for (const drop of drops) {
		const touchdown = bentoTouchdown(drop, drops);
		if (live(touchdown)) landings.push({ key: `bento-${drop.order}`, rect: slotOnScreen(drop.slot, offset, geometry), touchdown, seed: drop.order });
	}
	const { first, last } = visibleColumns(offset, geometry);
	for (let index = first; index <= last; index += 1) {
		for (const slot of wall.column(index)) {
			if (slot.reserved !== undefined) continue;
			const descent = slotDescent(slot, wall);
			if (descent && live(descent.touchdown)) landings.push({ key: slot.key, rect: slotOnScreen(slot, offset, geometry), touchdown: descent.touchdown, seed: slot.seed });
		}
	}
	return landings;
}

/* ─── The presenters setting cards down ───────────────────────────────── */

export interface PageCursor {
	readonly key: string;
	/** Which presenter it is (an index into the finale's four cursors). */
	readonly presenter: number;
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

/** About one arriving card in five is set down by a presenter. */
const HELD_SHARE = 0.2;
const GRAB_S = 0.4;
const RELEASE_S = 0.45;

/**
 * The presenters reaching in at the leading edge: one takes a waiting card by
 * its top-right corner, rides it down into its slot and lets go, drifting up
 * and away. Each presenter holds one card at a time.
 */
export function wallCursorsAt(time: number, wall: FinaleWall, viewport: FinaleViewport): readonly PageCursor[] {
	if (!wallActive(time)) return [];
	const { geometry } = wall;
	const offset = wallOffset(time, geometry);
	const { first, last } = visibleColumns(offset, geometry);
	const cursors: PageCursor[] = [];
	const busy = new Set<number>();
	for (let column = first; column <= last + 1; column += 1) {
		for (const slot of wall.column(column)) {
			if (slot.reserved !== undefined || hash01(slot.seed * 3.71 + 0.2) >= HELD_SHARE) continue;
			const descent = slotDescent(slot, wall);
			if (!descent || time < descent.start - GRAB_S || time > descent.touchdown + RELEASE_S) continue;
			const presenter = Math.floor(hash01(slot.seed * 5.13 + 0.7) * 4);
			if (busy.has(presenter)) continue;
			busy.add(presenter);
			const rect = slotOnScreen(slot, offset, geometry);
			const pose = arrivalPose(slot, descent, rect, Math.min(time, descent.touchdown), viewport);
			// The card's top-right corner, as its tilt carries it.
			const corner = {
				x: pose.x + (pose.width / 2) * Math.cos(pose.rotateY),
				y: pose.y - (pose.height / 2) * Math.cos(pose.rotateX),
				z: pose.z + (pose.width / 2) * Math.sin(-pose.rotateY) * 0.5 + (pose.height / 2) * Math.sin(-pose.rotateX) * 0.5,
			};
			const shown = projectLifted(corner, viewport);
			const enter = smooth(descent.start - GRAB_S, descent.start - GRAB_S * 0.3, time);
			const away = smooth(descent.touchdown, descent.touchdown + RELEASE_S, time);
			cursors.push({ key: slot.key, presenter, x: shown.x + away * 26, y: shown.y - away * 34, scale: shown.scale, opacity: Math.min(enter, 1 - away) });
		}
	}
	return cursors;
}
