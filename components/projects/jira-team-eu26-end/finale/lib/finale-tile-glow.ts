import { ROVO_SHADER_COLOR_HEX } from "@/lib/rovo-colors";

import { CUE } from "../data/finale-cues";
import type { FinaleRect } from "../data/finale-stories";
import { tileRevealStart, touchdownTime } from "./finale-card-motion";
import { EASE, clamp, hash01, lerp, parseRgb, progress } from "./finale-math";

/**
 * Paper's Pulsing Border, alive for one brief moment round each bento tile as
 * it settles. The whole rounded-rect border is lit at once — no trace, no
 * travelling head — and while it glows it moves the way Paper's does:
 *
 * - colour spots orbit the perimeter, each at its own speed, some
 *   counter-drifting, growing and shrinking, blending as they pass;
 * - each spot's mask flickers on its own phase, and a heartbeat pulse pulls
 *   some spots harder than others;
 * - smoke scrolls and evolves along the stroke;
 * - bloom, softness, core whiteness and hue drift throughout.
 *
 * The formulas are Paper's (`@paper-design/shaders` pulsing-border: sector
 * shape, spot angular motion, mask, beat, smoke scroll, blend-vs-add bloom),
 * with Paper's angle (a share of the lap) mapped to the perimeter parameter of
 * the tile's rounded rect, so spots follow the tile's shape. Shader time is the
 * finale clock, so it scrubs. It lights once: an envelope fades it up with the
 * motion already alive, and out to nothing before the heading has built.
 *
 * Every tile is seeded by its landing order. The GLSL mirrors
 * `perimeterParam`, `spotCentre` and `strokeProfile`.
 */

const [BLUE, ORANGE, PURPLE, LIME] = ROVO_SHADER_COLOR_HEX;

export const TILE_GLOW = {
	/** After touchdown, once the landing recoil has spent itself (s). */
	settle: 0.2,
	/** Start-delay jitter after `settle`. */
	delay: [0, 0.05],
	/** Whole glow, fade-up to gone (s). */
	duration: [1.5, 1.8],
	/** Share of the duration fading up (`EASE.outBold`)… */
	rise: [0.12, 0.2],
	/** …and fading out at the end (`EASE.in`). */
	fall: [0.3, 0.4],
	/** Spot orbit speed (laps per second), from Paper's `(.1 + .15·|…|) · 1.2`. */
	speed: [0.12, 0.3],
	/** Spot half-width as a share of the lap, before it breathes. */
	size: [0.07, 0.13],
	/** How far a spot grows and shrinks. */
	sizeSwing: 0.35,
	/** Spot mask flicker rate (rad/s) and the floor it never dims below. */
	maskRate: [1.4, 3.2],
	maskFloor: 0.3,
	/** Paper's `intensity`: sectors over 1 clip into plateaus. */
	intensity: [1.25, 1.6],
	/** Paper's `bloom`: blend (0) → additive (1) spot accumulation. */
	bloomMix: [0.2, 0.5],
	/** Paper's `pulse`: how hard the heartbeat pulls the spot masks. */
	pulse: [0.15, 0.3],
	/** Beat rate (beats of Paper's `beat()` per second). */
	pulseRate: [0.45, 0.75],
	/** Rate of the bloom / softness drift (rad/s). */
	modRate: [1.6, 2.6],
	/** How far each spot's hue slides towards its neighbour colour. */
	hueShift: [0.2, 0.45],
	/** How far a spot's core burns towards white at its peak. */
	white: [0.15, 0.5],
	/** Crisp stroke core width (stage px). */
	lineWidth: [0.6, 1.1],
	/** Dim floor between spots. */
	floor: [0.06, 0.18],
	/** Paper's `smoke`. */
	smoke: [0.35, 0.85],
	/** Smoke cell size along the stroke (stage px). */
	smokeSize: [70, 150],
	/** The quad drawn per tile overhangs it by this much (stage px). */
	pad: 36,
	/** Bloom opacity relative to the stroke core. */
	bloomOpacity: 0.6,
	/** Share of the bloom kept over the white face (it reads mostly outside). */
	innerBloom: 0.3,
	/** Rovo blue → purple → amber → green. */
	colors: [BLUE, PURPLE, ORANGE, LIME],
} as const;

/** Tone ranges: understated tiles stay faint and tight, bright ones bloom. */
export const TILE_GLOW_TONES = {
	soft: { gain: [0.6, 0.72], opacity: [0.6, 0.7], bloom: [2.5, 4] },
	mid: { gain: [0.76, 0.88], opacity: [0.72, 0.82], bloom: [4, 6] },
	bright: { gain: [0.9, 1], opacity: [0.84, 0.94], bloom: [6, 8] },
} as const;

export type TileGlowTone = keyof typeof TILE_GLOW_TONES;

/** Maximum spots per tile (the shader's fixed array size). */
export const TILE_GLOW_MAX_SPOTS = 6;

/* ─── Per-tile variation ──────────────────────────────────────────────── */

export interface TileGlowSpot {
	/** Signed orbit speed, laps per second (negative runs anticlockwise). */
	readonly speed: number;
	/** Lap offset at time 0. */
	readonly phase: number;
	/** Half-width as a share of the lap. */
	readonly size: number;
	readonly sizeRate: number;
	readonly sizePhase: number;
	readonly maskRate: number;
	readonly maskPhase: number;
	/** Paper's per-spot `p`: how far the heartbeat takes over this spot's mask (0–0.5). */
	readonly pulseMix: number;
	/** How far its core burns towards white at its peak. */
	readonly white: number;
	readonly color: string;
	/** The colour its hue slides towards. */
	readonly shift: string;
	readonly huePhase: number;
}

export interface TileGlowLook {
	readonly tone: TileGlowTone;
	readonly spots: readonly TileGlowSpot[];
	/** Stroke core width (stage px). */
	readonly lineWidth: number;
	/** Bloom length at full heat (stage px). */
	readonly bloom: number;
	readonly bloomMix: number;
	readonly intensity: number;
	/** Overall brightness. */
	readonly gain: number;
	/** Overall opacity. */
	readonly opacity: number;
	readonly floor: number;
	readonly smoke: number;
	readonly smokeSize: number;
	readonly smokeSeed: number;
	readonly pulse: number;
	readonly pulseRate: number;
	readonly pulsePhase: number;
	readonly modRate: number;
	readonly modPhase: number;
	readonly hueShift: number;
	readonly delay: number;
	readonly duration: number;
	readonly rise: number;
	readonly fall: number;
}

function seeded(order: number, salt: number): number {
	return hash01(hash01((order + 1) * 92.821) * 91.7 + salt * 37.719);
}

/** A deterministic shuffle of `items`, keyed by `salt`. */
function shuffled<T>(items: readonly T[], salt: number): T[] {
	return items.map((item, index) => ({ item, key: seeded(index, salt) })).sort((a, b) => a.key - b.key).map((entry) => entry.item);
}

/** The hero is bright; the others share one more bright, two mid and two soft moods. */
const TONE_BY_ORDER: readonly TileGlowTone[] = ["bright", ...shuffled<TileGlowTone>(["bright", "mid", "mid", "soft", "soft"], 11)];
const SPOTS_BY_ORDER: readonly number[] = shuffled([4, 4, 5, 5, 6, 6], 12);
const TILE_COUNT = TONE_BY_ORDER.length;

function range(bounds: readonly [number, number], roll: number): number {
	return lerp(bounds[0], bounds[1], roll);
}

/**
 * Six random rolls clump; stratify the parameters whose spread should read:
 * each tile takes its own sixth of the range (in a shuffled order), jittered
 * within it.
 */
function spread(order: number, salt: number, bounds: readonly [number, number]): number {
	const rank = shuffled(Array.from({ length: TILE_COUNT }, (_, index) => index), salt).indexOf(order % TILE_COUNT);
	return range(bounds, (rank + 0.15 + 0.7 * seeded(order, salt + 50)) / TILE_COUNT);
}

function buildSpots(order: number, count: number): TileGlowSpot[] {
	const h = (salt: number) => seeded(order, salt);
	const colorStart = Math.floor(h(2) * 4);
	// A step of 1 or 3 through four colours: adjacent spots start apart, and
	// every tile carries at least three of the four.
	const colorStep = h(3) < 0.5 ? 1 : 3;
	// Spread round the lap at time 0; at least one spot counter-drifts.
	const offset = h(1);
	const counter = Math.floor(h(4) * count) % count;
	return Array.from({ length: count }, (_, index): TileGlowSpot => {
		const roll = (salt: number) => seeded(order * 11 + index, salt);
		const direction = index === counter || roll(30) < 0.35 ? -1 : 1;
		const colorIndex = (colorStart + index * colorStep) % 4;
		const at = offset + (index + (roll(31) - 0.5) * 0.5) / count;
		return {
			speed: direction * range(TILE_GLOW.speed, roll(32)),
			phase: at - Math.floor(at),
			size: range(TILE_GLOW.size, roll(33)),
			sizeRate: lerp(1.2, 2.6, roll(34)),
			sizePhase: roll(35) * Math.PI * 2,
			maskRate: range(TILE_GLOW.maskRate, roll(36)),
			maskPhase: roll(37) * Math.PI * 2,
			pulseMix: clamp(2 * range(TILE_GLOW.pulse, h(20)) - roll(38), 0, 0.5),
			white: range(TILE_GLOW.white, roll(39)),
			color: TILE_GLOW.colors[colorIndex],
			shift: TILE_GLOW.colors[(colorIndex + 1) % 4],
			huePhase: roll(40) * Math.PI * 2,
		};
	});
}

function buildLook(order: number): TileGlowLook {
	const h = (salt: number) => seeded(order, salt);
	const slot = order % TILE_COUNT;
	const tone = TONE_BY_ORDER[slot];
	const toneRange = TILE_GLOW_TONES[tone];
	return {
		tone,
		spots: buildSpots(order, SPOTS_BY_ORDER[slot]),
		lineWidth: spread(order, 5, TILE_GLOW.lineWidth),
		bloom: range(toneRange.bloom, h(6)),
		bloomMix: spread(order, 21, TILE_GLOW.bloomMix),
		intensity: spread(order, 22, TILE_GLOW.intensity),
		gain: range(toneRange.gain, h(7)),
		opacity: range(toneRange.opacity, h(8)),
		floor: spread(order, 9, TILE_GLOW.floor),
		smoke: spread(order, 10, TILE_GLOW.smoke),
		smokeSize: range(TILE_GLOW.smokeSize, h(11)),
		smokeSeed: h(12) * 40,
		pulse: range(TILE_GLOW.pulse, h(20)),
		pulseRate: spread(order, 23, TILE_GLOW.pulseRate),
		pulsePhase: h(24),
		modRate: spread(order, 25, TILE_GLOW.modRate),
		modPhase: h(26) * Math.PI * 2,
		hueShift: spread(order, 27, TILE_GLOW.hueShift),
		delay: spread(order, 14, TILE_GLOW.delay),
		duration: spread(order, 15, TILE_GLOW.duration),
		rise: range(TILE_GLOW.rise, h(16)),
		fall: range(TILE_GLOW.fall, h(17)),
	};
}

const LOOKS = new Map<number, TileGlowLook>();

/** Deterministic per-tile look, seeded by landing order. */
export function tileGlowLook(order: number): TileGlowLook {
	let look = LOOKS.get(order);
	if (!look) {
		look = buildLook(order);
		LOOKS.set(order, look);
	}
	return look;
}

/* ─── Timing ──────────────────────────────────────────────────────────── */

export interface TileGlowWindow {
	readonly start: number;
	/** Fully up here… */
	readonly peak: number;
	/** …until the fade-out begins here. */
	readonly fallStart: number;
	/** Gone. */
	readonly end: number;
}

/** From just after touchdown (plus jitter); gone by the time the heading has built. */
export function tileGlowWindow(order: number): TileGlowWindow {
	const look = tileGlowLook(order);
	const start = touchdownTime(order) + TILE_GLOW.settle + look.delay;
	const latest = Math.min(tileRevealStart(order) + CUE.reveal, CUE.end);
	const end = Math.min(start + look.duration, latest);
	const span = end - start;
	return { start, peak: start + span * look.rise, fallStart: end - span * look.fall, end };
}

export interface TileGlowLevel {
	/** The tile is drawn this frame (only inside its window). */
	readonly active: boolean;
	/** Fade-up and fade-out (0–1); the motion itself runs on the clock. */
	readonly envelope: number;
}

const OFF: TileGlowLevel = { active: false, envelope: 0 };

export function tileGlow(time: number, order: number): TileGlowLevel {
	const { start, peak, fallStart, end } = tileGlowWindow(order);
	if (time < start || time >= end) return OFF;
	const up = EASE.outBold(progress(time, start, peak));
	const down = 1 - EASE.in(progress(time, fallStart, end));
	return { active: true, envelope: Math.min(up, down) };
}

/* ─── Geometry ────────────────────────────────────────────────────────── */

export interface TileGlowShape {
	/** The line's centre: the tile's rect pushed out by half the line (viewport px). */
	readonly rect: FinaleRect;
	readonly radius: number;
	/** Perimeter of that rounded rect (viewport px). */
	readonly length: number;
}

/** The line sits just outside the white face, concentric with its corners. */
export function tileGlowShape(tile: FinaleRect, radius: number, scale: number, lineWidth: number): TileGlowShape {
	const out = (lineWidth * scale) / 2;
	const rect = { x: tile.x - out, y: tile.y - out, width: tile.width + out * 2, height: tile.height + out * 2 };
	const r = Math.min(radius + out, rect.width / 2, rect.height / 2);
	return { rect, radius: r, length: 2 * (rect.width - 2 * r) + 2 * (rect.height - 2 * r) + 2 * Math.PI * r };
}

/**
 * Perimeter parameter s ∈ [0, 1) of the closest point on a rounded rect
 * (viewport px, y down): 0 just past the top-left corner's arc, running
 * clockwise — top edge, top-right arc, right edge, bottom-right arc, bottom,
 * bottom-left arc, left, top-left arc — with exact straight and quarter-arc
 * lengths. This stands in for Paper's angle, so spots follow the tile's shape.
 */
export function perimeterParam(point: { readonly x: number; readonly y: number }, shape: TileGlowShape): number {
	const { rect, radius: r, length } = shape;
	const hx = rect.width / 2 - r;
	const hy = rect.height / 2 - r;
	const lx = point.x - (rect.x + rect.width / 2);
	const ly = point.y - (rect.y + rect.height / 2);
	const a = 2 * hx;
	const b = 2 * hy;
	const arc = (Math.PI * r) / 2;
	let s: number;
	if (Math.abs(lx) > hx && Math.abs(ly) > hy) {
		const kx = Math.sign(lx) * hx;
		const ky = Math.sign(ly) * hy;
		// Clockwise angle from "up" (y down): 0 up, π/2 right, π down, 3π/2 left.
		let phi = Math.atan2(lx - kx, -(ly - ky));
		if (phi < 0) phi += Math.PI * 2;
		const corner = Math.floor(phi / (Math.PI / 2));
		const along = r * (phi - corner * (Math.PI / 2));
		// Corners in clockwise order from the top-right: TR, BR, BL, TL.
		s = ([a, a + arc + b, 2 * a + b + arc * 2, 2 * a + 2 * b + arc * 3][corner] ?? 0) + along;
	} else if (Math.abs(lx) - hx > Math.abs(ly) - hy) {
		s = lx > 0 ? a + arc + (ly + hy) : 2 * a + b + arc * 3 + (hy - ly);
	} else {
		s = ly < 0 ? lx + hx : a + b + arc * 2 + (hx - lx);
	}
	const t = s / length;
	return t - Math.floor(t);
}

/* ─── Paper's dynamics along the stroke (mirrored in GLSL) ────────────── */

function fract(value: number): number {
	return value - Math.floor(value);
}
/** GLSL-style hash: `fract(sin(n) * 43758.5453)`. */
function hash1(n: number): number {
	return fract(Math.sin(n) * 43758.5453);
}
function noise1(x: number): number {
	const i = Math.floor(x);
	const f = x - i;
	const u = f * f * (3 - 2 * f);
	return lerp(hash1(i), hash1(i + 1), u);
}
function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = clamp((x - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}
/** Paper's heartbeat: two sharp beats per cycle. */
export function beat(x: number): number {
	const first = Math.abs(Math.sin(x * Math.PI * 2)) ** 10;
	const second = Math.abs(Math.sin((x - 0.15) * Math.PI * 2)) ** 10;
	return clamp(first + 0.6 * second);
}

/**
 * The glow's motion clock (spot orbits, flicker, heartbeat, hue and smoke) for
 * finale `time`, anchored to the toss. Every tile's look was tuned with the
 * toss at `TILE_GLOW_EPOCH`; anchoring keeps each glow frame-identical however
 * the flash before the toss is retimed. The shader's `uTime` is this clock.
 */
const TILE_GLOW_EPOCH = 0.87;

export function tileGlowClock(time: number): number {
	return time - CUE.burst + TILE_GLOW_EPOCH;
}

function centreAt(spot: TileGlowSpot, clock: number): number {
	return fract(0.5 - spot.speed * clock - spot.phase);
}

/** Where a spot's centre is on the lap at finale `time`: Paper's `atg1 = fract(angle + time)` peaks at 0.5. */
export function spotCentre(spot: TileGlowSpot, time: number): number {
	return centreAt(spot, tileGlowClock(time));
}

/** Tile-wide values that drift while it glows. */
export interface TileGlowPulse {
	/** Paper's `beat()` at this moment. */
	readonly beat: number;
	/** Slow drift in [-1, 1] for bloom and softness. */
	readonly drift: number;
}

export function tileGlowPulse(look: TileGlowLook, time: number): TileGlowPulse {
	const clock = tileGlowClock(time);
	return {
		beat: beat(look.pulseRate * clock + look.pulsePhase),
		drift: Math.sin(look.modRate * clock + look.modPhase),
	};
}

export interface StrokeProfile {
	/** Brightness of the stroke here, before the envelope. */
	readonly brightness: number;
	/** Accumulated spot heat: drives bloom length and stroke thickening. */
	readonly heat: number;
	/** How far the core burns towards white here (0–1). */
	readonly white: number;
	/** Colour here (0–1 rgb). */
	readonly color: readonly [number, number, number];
}

function rgb01(hex: string): [number, number, number] {
	const [r, g, b] = parseRgb(hex);
	return [r / 255, g / 255, b / 255];
}

/** One spot's sector at share `u` and `time`, after its mask and Paper's intensity clip. */
export function spotSector(u: number, spot: TileGlowSpot, look: TileGlowLook, time: number, pulse: TileGlowPulse = tileGlowPulse(look, time)): number {
	const clock = tileGlowClock(time);
	const size = spot.size * (1 + TILE_GLOW.sizeSwing * Math.sin(spot.sizeRate * clock + spot.sizePhase));
	const a = fract(u - centreAt(spot, clock) + 0.5);
	const shape = smoothstep(0.5 - size, 0.5, a) * (1 - smoothstep(0.5, 0.5 + size, a));
	let mask = 0.5 + 0.5 * Math.sin(spot.maskRate * clock + spot.maskPhase);
	mask = lerp(TILE_GLOW.maskFloor, 1, mask);
	mask = lerp(mask, pulse.beat, spot.pulseMix);
	return clamp(shape * mask * look.intensity);
}

/**
 * The stroke's look at perimeter share `u` and finale `time`: Paper's sectors
 * blended over each other (and partly added, by `bloomMix`), mottled by the
 * scrolling smoke, over a flowing dim floor. Lengths are stage px, scaled to
 * viewport px by `scale`.
 */
export function strokeProfile(u: number, time: number, look: TileGlowLook, perimeter: number, scale: number): StrokeProfile {
	const pulse = tileGlowPulse(look, time);
	const clock = tileGlowClock(time);
	let blend = 0;
	let add = 0;
	let white = 0;
	let weight = 0;
	const color: [number, number, number] = [0, 0, 0];
	for (const spot of look.spots) {
		const sector = spotSector(u, spot, look, time, pulse);
		blend += (1 - blend) * sector;
		add += sector;
		white += spot.white * sector * sector * (0.6 + 0.4 * pulse.beat);
		const slide = look.hueShift * (0.5 + 0.5 * Math.sin(0.9 * clock + spot.huePhase));
		const from = rgb01(spot.color);
		const to = rgb01(spot.shift);
		const w = sector + 1e-3;
		for (let channel = 0; channel < 3; channel++) color[channel] += lerp(from[channel], to[channel], slide) * w;
		weight += w;
	}
	const heat = lerp(blend, Math.min(add, 1.5), look.bloomMix);
	// Paper's smoke, scrolling both ways along the stroke.
	const t = 1.2 * clock;
	const x = (u * perimeter) / (look.smokeSize * scale) + look.smokeSeed;
	const haze = clamp(3 * noise1(2.7 * x + 0.5 * t)) - noise1(3.4 * x - 0.5 * t);
	const smokeGlow = 0.35 * clamp(30 * haze * haze * 0.5 * look.smoke * look.smoke);
	const mottle = lerp(1, 0.55 + 0.9 * noise1(1.3 * x - 0.35 * t + 7), 0.6 * look.smoke);
	const flow = 0.35 + 0.65 * noise1(0.6 * x + 0.4 * t + 3);
	return {
		brightness: look.gain * (heat * mottle + smokeGlow + look.floor * flow),
		heat: heat * mottle,
		white: clamp(white),
		color: [color[0] / weight, color[1] / weight, color[2] / weight],
	};
}

/* ─── Per-frame draw list ─────────────────────────────────────────────── */

export interface TileGlowDraw {
	readonly order: number;
	/** Quad to draw (viewport px). */
	readonly quad: FinaleRect;
	readonly shape: TileGlowShape;
	readonly level: TileGlowLevel;
	readonly look: TileGlowLook;
}

/** Tiles glowing this frame; empty (draw nothing) outside every window. */
export function tileGlowDraws(time: number, tiles: readonly FinaleRect[], radius: number, scale: number): readonly TileGlowDraw[] {
	const pad = TILE_GLOW.pad * scale;
	return tiles.flatMap((tile, order): TileGlowDraw[] => {
		const level = tileGlow(time, order);
		if (!level.active || level.envelope <= 0) return [];
		const look = tileGlowLook(order);
		const shape = tileGlowShape(tile, radius, scale, look.lineWidth);
		const quad = { x: tile.x - pad, y: tile.y - pad, width: tile.width + pad * 2, height: tile.height + pad * 2 };
		return [{ order, quad, shape, level, look }];
	});
}

export interface TileGlowUniforms {
	/** `uSpotA[6]`: signed speed, phase, size, white. Unused spots have size 0. */
	readonly spotA: Float32Array;
	/** `uSpotB[6]`: size rate, size phase, mask rate, mask phase. */
	readonly spotB: Float32Array;
	/** `uSpotC[6]`: rgb, pulse mix. */
	readonly spotC: Float32Array;
	/** `uSpotD[6]`: shifted rgb, hue phase. */
	readonly spotD: Float32Array;
	/** `uLook`: line width px, bloom px, floor, smoke. */
	readonly look: readonly [number, number, number, number];
	/** `uLook2`: smoke size px, smoke seed, gain, opacity. */
	readonly look2: readonly [number, number, number, number];
	/** `uLook3`: bloom mix, intensity, pulse rate, pulse phase. */
	readonly look3: readonly [number, number, number, number];
	/** `uLook4`: drift rate, drift phase, hue shift, unused. */
	readonly look4: readonly [number, number, number, number];
}

const UNIFORMS = new WeakMap<TileGlowLook, Map<number, TileGlowUniforms>>();

/** The per-tile uniforms for one draw (viewport px); cached per tile and scale. */
export function tileGlowUniforms(look: TileGlowLook, scale: number): TileGlowUniforms {
	const byScale = UNIFORMS.get(look) ?? new Map<number, TileGlowUniforms>();
	UNIFORMS.set(look, byScale);
	const cached = byScale.get(scale);
	if (cached) return cached;
	const spotA = new Float32Array(TILE_GLOW_MAX_SPOTS * 4);
	const spotB = new Float32Array(TILE_GLOW_MAX_SPOTS * 4);
	const spotC = new Float32Array(TILE_GLOW_MAX_SPOTS * 4);
	const spotD = new Float32Array(TILE_GLOW_MAX_SPOTS * 4);
	look.spots.slice(0, TILE_GLOW_MAX_SPOTS).forEach((spot, index) => {
		spotA.set([spot.speed, spot.phase, spot.size, spot.white], index * 4);
		spotB.set([spot.sizeRate, spot.sizePhase, spot.maskRate, spot.maskPhase], index * 4);
		spotC.set([...rgb01(spot.color), spot.pulseMix], index * 4);
		spotD.set([...rgb01(spot.shift), spot.huePhase], index * 4);
	});
	const uniforms: TileGlowUniforms = {
		spotA,
		spotB,
		spotC,
		spotD,
		look: [look.lineWidth * scale, look.bloom * scale, look.floor, look.smoke],
		look2: [look.smokeSize * scale, look.smokeSeed, look.gain, look.opacity],
		look3: [look.bloomMix, look.intensity, look.pulseRate, look.pulsePhase],
		look4: [look.modRate, look.modPhase, look.hueShift, 0],
	};
	byScale.set(scale, uniforms);
	return uniforms;
}

/* ─── Shader ──────────────────────────────────────────────────────────── */

export const TILE_GLOW_VERTEX = /* glsl */ `
attribute vec2 aCorner;
uniform vec4 uQuad;
uniform vec2 uViewport;
varying vec2 vPoint;
void main() {
	vPoint = uQuad.xy + aCorner * uQuad.zw;
	vec2 clip = vPoint / uViewport * 2.0 - 1.0;
	gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const f = (value: number) => value.toFixed(3);
const N = TILE_GLOW_MAX_SPOTS;

/** One tile per draw; see `strokeProfile` for the model. `uTime` is the finale clock. */
export const TILE_GLOW_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vPoint;
uniform vec4 uRect;
uniform float uRadius;
uniform float uLength;
uniform vec4 uSpotA[${N}]; // speed, phase, size, white
uniform vec4 uSpotB[${N}]; // size rate, size phase, mask rate, mask phase
uniform vec4 uSpotC[${N}]; // rgb, pulse mix
uniform vec4 uSpotD[${N}]; // shifted rgb, hue phase
uniform vec4 uLook; // line width px, bloom px, floor, smoke
uniform vec4 uLook2; // smoke size px, smoke seed, gain, opacity
uniform vec4 uLook3; // bloom mix, intensity, pulse rate, pulse phase
uniform vec4 uLook4; // drift rate, drift phase, hue shift, -
uniform float uEnvelope;
uniform float uTime;
uniform float uScale;

const float PI = 3.14159265;
const float TAU = 6.2831853;

float hash1(float n) { return fract(sin(n) * 43758.5453); }
float noise1(float x) {
	float i = floor(x);
	float t = fract(x);
	return mix(hash1(i), hash1(i + 1.0), t * t * (3.0 - 2.0 * t));
}
// Paper's heartbeat.
float beat(float x) {
	float first = pow(abs(sin(x * TAU)), 10.0);
	float second = pow(abs(sin((x - 0.15) * TAU)), 10.0);
	return clamp(first + 0.6 * second, 0.0, 1.0);
}

// Mirrors perimeterParam() in lib/finale-tile-glow.ts: Paper's angle, on the tile's shape.
float perimeterParam(vec2 l, vec2 h, float r) {
	float a = 2.0 * h.x;
	float b = 2.0 * h.y;
	float arc = 0.5 * PI * r;
	float s;
	if (abs(l.x) > h.x && abs(l.y) > h.y) {
		vec2 k = sign(l) * h;
		vec2 v = l - k;
		float phi = atan(v.x, -v.y);
		if (phi < 0.0) phi += TAU;
		float corner = floor(phi / (0.5 * PI));
		float along = r * (phi - corner * 0.5 * PI);
		float base = corner < 0.5 ? a : corner < 1.5 ? a + arc + b : corner < 2.5 ? 2.0 * a + b + 2.0 * arc : 2.0 * a + 2.0 * b + 3.0 * arc;
		s = base + along;
	} else if (abs(l.x) - h.x > abs(l.y) - h.y) {
		s = l.x > 0.0 ? a + arc + (l.y + h.y) : 2.0 * a + b + 3.0 * arc + (h.y - l.y);
	} else {
		s = l.y < 0.0 ? l.x + h.x : a + b + 2.0 * arc + (h.x - l.x);
	}
	return fract(s / uLength);
}

void main() {
	vec2 centre = uRect.xy + 0.5 * uRect.zw;
	vec2 l = vPoint - centre;
	vec2 h = 0.5 * uRect.zw - uRadius;
	vec2 q = abs(l) - h;
	float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
	float u = perimeterParam(l, h, uRadius);
	float time = uTime;

	// Mirrors tileGlowPulse().
	float pulseBeat = beat(uLook3.z * time + uLook3.w);
	float drift = sin(uLook4.x * time + uLook4.y);

	// Mirrors spotSector() / strokeProfile(): Paper's sectors, orbiting.
	float blend = 0.0;
	float add = 0.0;
	float white = 0.0;
	float weight = 0.0;
	vec3 colour = vec3(0.0);
	for (int index = 0; index < ${N}; index++) {
		vec4 a4 = uSpotA[index];
		vec4 b4 = uSpotB[index];
		vec4 c4 = uSpotC[index];
		vec4 d4 = uSpotD[index];
		float used = step(0.0001, a4.z);
		float size = a4.z * (1.0 + ${f(TILE_GLOW.sizeSwing)} * sin(b4.x * time + b4.y));
		float spotAt = fract(0.5 - a4.x * time - a4.y);
		float at = fract(u - spotAt + 0.5);
		float shape = smoothstep(0.5 - size, 0.5, at) * (1.0 - smoothstep(0.5, 0.5 + size, at));
		float mask = 0.5 + 0.5 * sin(b4.z * time + b4.w);
		mask = mix(${f(TILE_GLOW.maskFloor)}, 1.0, mask);
		mask = mix(mask, pulseBeat, c4.w);
		float sector = used * clamp(shape * mask * uLook3.y, 0.0, 1.0);
		blend += (1.0 - blend) * sector;
		add += sector;
		white += a4.w * sector * sector * (0.6 + 0.4 * pulseBeat);
		float slide = uLook4.z * (0.5 + 0.5 * sin(0.9 * time + d4.w));
		float w = used * (sector + 0.001);
		colour += mix(c4.rgb, d4.rgb, slide) * w;
		weight += w;
	}
	colour /= max(weight, 0.0001);
	float heat = mix(blend, min(add, 1.5), uLook3.x);

	// Paper's smoke, scrolling both ways along the stroke.
	float t = 1.2 * time;
	float x = u * uLength / uLook2.x + uLook2.y;
	float haze = clamp(3.0 * noise1(2.7 * x + 0.5 * t), 0.0, 1.0) - noise1(3.4 * x - 0.5 * t);
	float smokeGlow = 0.35 * clamp(30.0 * haze * haze * 0.5 * uLook.w * uLook.w, 0.0, 1.0);
	float mottle = mix(1.0, 0.55 + 0.9 * noise1(1.3 * x - 0.35 * t + 7.0), 0.6 * uLook.w);
	float flow = 0.35 + 0.65 * noise1(0.6 * x + 0.4 * t + 3.0);
	float hot = heat * mottle;
	float brightness = uLook2.z * (hot + smokeGlow + uLook.z * flow);
	white = clamp(white, 0.0, 1.0);

	// Softness and bloom drift, and the beat widens the bloom.
	float width = uLook.x * (1.0 + 0.15 * drift + 0.25 * clamp(hot, 0.0, 1.0));
	float core = exp(-pow(d / (0.6 * width), 2.0));
	float bloomLength = uScale * 0.8 + uLook.y * clamp(hot, 0.0, 1.2) * (0.8 + 0.2 * drift + 0.4 * pulseBeat);
	float bloom = exp(-abs(d) / max(bloomLength, 0.0001));
	// Held back over the white face, and spent well inside the quad.
	bloom *= mix(${f(TILE_GLOW.innerBloom)}, 1.0, smoothstep(-2.0 * width, 0.0, d));
	bloom *= 1.0 - smoothstep(0.5, 0.9, abs(d) / (${f(TILE_GLOW.pad)} * uScale));

	float opacity = uLook2.w;
	float envelope = uEnvelope;
	float coreAlpha = opacity * core * clamp(brightness * envelope, 0.0, 1.0);
	float bloomAlpha = ${f(TILE_GLOW.bloomOpacity)} * opacity * bloom * clamp(hot * uLook2.z * envelope, 0.0, 1.3);
	// Hot cores burn towards white; their blooms stay coloured.
	vec3 coreColour = mix(colour, vec3(1.0), white * envelope);
	float alpha = coreAlpha + bloomAlpha * (1.0 - coreAlpha);
	vec3 premultiplied = coreColour * coreAlpha + colour * bloomAlpha * (1.0 - coreAlpha);
	gl_FragColor = vec4(premultiplied, clamp(alpha, 0.0, 1.0));
}
`;
