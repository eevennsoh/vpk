/**
 * The Done column's "completion" flash, staged over the live Jira board before
 * its cards are tossed into the field. It follows reference clip 5
 * (a phone screen lit from its dynamic island), flipped to run bottom → top:
 *
 * The reference's opening build-up is omitted: completion begins on the sweep.
 * B. Ignition: a blinding disc floods out from the source; inside it the
 *    content is overexposed into glare, its soft leading edge fringed with
 *    the content's own colour (and a touch of Rovo).
 * C. Hollowing: the flood thins into a thick bright ring; behind it the
 *    content returns as a darker, magnified, fisheye-refracted lens that is
 *    bent into a bowl along the arc, then recoils gently and relaxes.
 * D. Travel: the ring decelerates up the column; its energy falls with
 *    distance, so the white core narrows and dims while a broad, softly
 *    blurred exposure wash takes over.
 * E. Highlight bloom: high-contrast marks (dark text and icons on this light
 *    UI) smear into soft, tinted halos as the band crosses them, and focus
 *    back to crisp behind it.
 * F. Ahead of the front nothing changes, and
 *    behind the recovered wake the column is crisp and identical.
 *
 * It is rendered as ONE full-column fragment-shader pass over the settled
 * column print, padded with its plain backdrop (never neighbouring UI): the pass
 * draws only where the field is active and is transparent everywhere else, so
 * the live board and the resting GL card sheets show through untouched.
 *
 * This file is the single owner of the flash: timing, the field (`flashLook`,
 * ported line for line to `FLASH_GLSL`), and the shading that turns the field
 * into pixels (`FLASH_PASS_GLSL`).
 *
 * ## Contract
 *
 * Space: viewport CSS px, y DOWN. `column` is `snapshot.column`.
 * Time: finale seconds; everything is a pure function of the finale clock.
 * - `flashIntensity(time)` is exactly 0 at and before `CUE.flash` (frame 0 is
 *   the board), at and after `CUE.flash + CUE.flashDuration`, and from
 *   `CUE.burst` on.
 * - `flashRadius(time, column)` is the outer (leading) edge's radius around
 *   the source; it grows immediately and monotonically: a
 *   fast flood decelerating to a steady travel, until the whole band and its
 *   recovery have cleared the column's top.
 * - `flashLook(time, x, y, column)` → every per-pixel quantity the pass uses:
 *   `cover` (where the pass draws), `dx`/`dy` (px the content is carried by
 *   the refraction; render by sampling at `p - (dx, dy)`), `blur` (px),
 *   `lift` (exposure toward white), `darken` (the dark lens), `halo`
 *   (highlight bloom) and `fringe` (coloured edge light), plus `feather`
 *   (1 inside the padded print, easing to 0 at its outer edge). The container's
 *   silhouette refracts too; the padded print replaces its stationary DOM edge.
 *   Shading follows only the refracted column surface; outside it only a
 *   faint, narrow bloom is allowed. `printPad` is texture sampling space,
 *   not a visible/shaded panel. Everything ahead of the front is unchanged.
 *
 * Shaders: include `FLASH_GLSL` (+ `FLASH_PASS_GLSL` for the full look) and set
 * `uFlashColumn` (x, y, w, h) and `uFlashState` (radius, intensity, time) from
 * `flashUniforms(time, column)`.
 */

import { CUE } from "../data/finale-cues";
import { EASE, clamp, progress } from "./finale-math";

export interface FlashColumn {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** Everything the column pass needs at one pixel. */
export interface FlashLook {
	readonly cover: number;
	readonly feather: number;
	readonly dx: number;
	readonly dy: number;
	readonly blur: number;
	readonly lift: number;
	readonly darken: number;
	readonly halo: number;
	readonly fringe: number;
	/** Chromatic split, px: red sampled at +split, blue at −split, radially. */
	readonly chroma: number;
}

/**
 * Rovo brand colours for the touch of colour in the fringe and halos (as in
 * `components/projects/shared/components/rovo-app-composer-response-gradient.tsx`).
 */
export const FLASH_ROVO_COLORS = ["#1868DB", "#AF59E1", "#FCA700", "#6A9A23"] as const;

/** The reference's sweep and recovery, with the opening anticipation omitted. */
export const FLASH_TIMING = {
	/** Faster full-column pass; spatial bulge/bloom/blur remain one coherent field. */
	sweepRate: 1.5,
	/** The envelope fades in this fast, and out over this long before the window ends. */
	rise: 0.1,
	fall: 0.14,
} as const;

/**
 * Geometry and energy, as shares of the column height `H` (the refs' screen
 * maps almost 1:1 onto the Done column) unless marked px.
 */
export const FLASH_SHAPE = {
	/** The source sits just inside the column's foot, centred (the refs' dynamic island). */
	sourceInset: 0.02,
	/** Leading-edge speed: a flood (`floodSpeed`) decaying (τ s) to a steady travel. */
	floodSpeed: 4,
	travelSpeed: 1.15,
	speedDecay: 0.08,
	/** The soft leading edge. */
	edge: 0.065,
	/** The white core: thick near the source, narrowing as it travels. */
	coreNear: 0.3,
	coreFar: 0.07,
	/** C. The dark, magnified lens behind the core, and how it relaxes. */
	lens: 0.4,
	/** Fisheye carry: `lensGain · r`, capped at `lensMax · H`. */
	lensGain: 0.3,
	lensMax: 0.095,
	/** Energy left once the front has crossed the column. */
	energyFar: 0.4,
	/** Past the column the light falls off (Gaussian σ, px) and is cut to exactly 0 by `glowCut` px. */
	glow: 4,
	glowCut: 8,
	/** Texture overscan for Gaussian sampling; it is never a shaded panel. */
	printPad: 40,
	/** Maximum displacement at the container silhouette, px. */
	edgeBulge: 8,
	/** Pixel antialiasing around the moving silhouette, per side. */
	silhouetteFeather: 1.5,
	/**
	 * No partial blend of a print that differs from the undistorted content
	 * (it would double against the live DOM beneath). So at every boundary the
	 * ramps are ordered in space: the content's alpha fades only where it is
	 * undistorted (within `feather` px of the padded print's edge, `frontFade` px
	 * behind the front, and after the tail), and displacement, blur, halo and
	 * the chromatic split start only beyond those zones (from `distortionInset`
	 * px inside the edge and `distortionFront` px behind the front), easing in
	 * over a wide band: the softness is in the distortion, not the alpha.
	 */
	feather: 16,
	frontFade: 8,
	distortionInset: 20,
	distortionFront: 10,
	/** The easing band for blur, halo and the split past those starts, px. */
	distortionBand: 60,
	/** Displacement eases in no faster than this per px (slope < 1: it never folds). */
	edgeCarry: 0.6,
} as const;

/** Look tuning (shading amounts; px where marked). */
export const FLASH_LOOK = {
	/** Peak exposure lift toward white in the core (× energy). */
	glare: 0.92,
	/** The broad wash that takes over as the energy falls. */
	wash: 0.3,
	/** Darkening in the lens (× energy). */
	darken: 0.16,
	/** Band blur, px, and how quickly it clears behind the core (share of the lens). */
	blur: 14,
	blurClear: 0.6,
	/** Highlight halo strength near and far. */
	haloNear: 0.5,
	haloFar: 1.8,
	/** Coloured edge light. */
	fringe: 0.22,
	/** Chromatic split at the edges, px. */
	chroma: 2.5,
} as const;

/** Gaussian focus levels in CSS px, made once from the immutable column print. */
export const FLASH_BLUR_LEVELS = [4, 12, 28] as const;

export function flashWindow(): { readonly start: number; readonly end: number } {
	return { start: CUE.flash, end: CUE.flash + CUE.flashDuration };
}

/** The flood begins with the sequence, without a separate anticipation. */
export function flashIgnition(): number {
	return CUE.flash;
}

/** Shared capture/texture/canvas bounds, including space for the container to bend. */
export function flashPrintRect(column: FlashColumn): FlashColumn {
	const reach = FLASH_SHAPE.printPad + 4;
	const x = Math.floor(column.x - reach);
	const y = Math.floor(column.y - reach);
	return { x, y, width: Math.ceil(column.x + column.width + reach) - x, height: Math.ceil(column.y + column.height + reach) - y };
}

/**
 * 0 → 1 → 0 over the window; exactly 0 at and outside its edges, and from the
 * toss on (the window ends by `CUE.burst`; this guards the invariant).
 */
export function flashIntensity(time: number): number {
	const { start, end } = flashWindow();
	if (time <= start || time >= end || time >= CUE.burst) return 0;
	const rise = EASE.outBold(progress(time, start, start + FLASH_TIMING.rise));
	const fall = 1 - EASE.in(progress(time, end - FLASH_TIMING.fall, end));
	return clamp(rise * fall);
}

/**
 * The GL card sheets stay hidden until the toss: until then the live DOM
 * cards are what shows (prints rasterise text a hair differently on real
 * displays), and the swap happens as the sheets start to move.
 */
export function finaleCardSheetsShown(time: number): boolean {
	return time >= CUE.burst;
}

/** Whether the pass draws at all: only inside its window, never from the toss on. */
export function flashVisible(time: number): boolean {
	return time < CUE.burst && flashIntensity(time) > 0;
}

export function flashSource(column: FlashColumn): { readonly x: number; readonly y: number } {
	return { x: column.x + column.width / 2, y: column.y + column.height * (1 - FLASH_SHAPE.sourceInset) };
}

/** Radius at which the leading edge reaches the column's top corners. */
export function flashCornerRadius(column: FlashColumn): number {
	const source = flashSource(column);
	return Math.hypot(column.width / 2, source.y - column.y);
}

/**
 * The leading edge's radius: an immediate pulse whose
 * speed decays from a flood to a steady travel (it decelerates, like the refs'
 * ring losing energy): r(t) = v∞·t + (v0 − v∞)·τ·(1 − e^(−t/τ)).
 */
export function flashRadius(time: number, column: FlashColumn): number {
	const elapsed = (time - flashIgnition()) * FLASH_TIMING.sweepRate;
	if (elapsed <= 0) return 0;
	const { floodSpeed, travelSpeed, speedDecay } = FLASH_SHAPE;
	const h = column.height;
	return h * (travelSpeed * elapsed + (floodSpeed - travelSpeed) * speedDecay * (1 - Math.exp(-elapsed / speedDecay)));
}

/** 0 → 1 as the leading edge travels from the source to the top corners. */
export function flashTravel(radius: number, column: FlashColumn): number {
	return clamp(radius / flashCornerRadius(column));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
	const t = clamp((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

/** Energy of the ring: 1 at the source, `energyFar` once it has crossed the column. */
export function flashEnergy(radius: number, column: FlashColumn): number {
	return 1 - (1 - FLASH_SHAPE.energyFar) * smoothstep(0.15, 1, flashTravel(radius, column));
}

/** Width (px) of the white core: the whole disc while it floods, then a narrowing ring. */
export function flashCoreWidth(radius: number, column: FlashColumn): number {
	const h = column.height;
	const target = h * (FLASH_SHAPE.coreNear + (FLASH_SHAPE.coreFar - FLASH_SHAPE.coreNear) * smoothstep(0.2, 0.9, flashTravel(radius, column)));
	return clamp(radius - FLASH_SHAPE.edge * h, 0, target);
}

/** Where the active region ends behind the leading edge (px): edge + core + lens. */
export function flashTail(radius: number, column: FlashColumn): number {
	const h = column.height;
	return FLASH_SHAPE.edge * h + flashCoreWidth(radius, column) + FLASH_SHAPE.lens * h;
}

/** The pass's full sweep is over (the tail has cleared the column's top) by this radius. */
export function flashDoneRadius(column: FlashColumn): number {
	return flashCornerRadius(column) + flashTail(flashCornerRadius(column), column) + 40;
}

/** Signed distance (px) behind the leading edge: negative ahead of it, positive behind. */
export function flashDistance(time: number, x: number, y: number, column: FlashColumn): number {
	const source = flashSource(column);
	return flashRadius(time, column) - Math.hypot(x - source.x, y - source.y);
}

/** Height of the leading edge at viewport `x` (the arc), or the source height where it has not reached yet. */
export function flashFrontY(time: number, x: number, column: FlashColumn): number {
	const source = flashSource(column);
	const radius = flashRadius(time, column);
	const dx = Math.abs(x - source.x);
	return dx >= radius ? source.y : source.y - Math.sqrt(radius * radius - dx * dx);
}

const ZERO: FlashLook = { cover: 0, feather: 0, dx: 0, dy: 0, blur: 0, lift: 0, darken: 0, halo: 0, fringe: 0, chroma: 0 };

/** A floating element painted over the column (the Rovo FAB, a toolbar): the pass leaves it on top. */
export interface FlashOccluder {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly radius: number;
}

export const FLASH_MAX_OCCLUDERS = 4;

/** 0 over an occluder (the pass is transparent there, so it stays on top), 1 elsewhere, with a ~2px soft rim. */
export function flashOcclusion(x: number, y: number, occluders: readonly FlashOccluder[]): number {
	let open = 1;
	for (const occluder of occluders.slice(0, FLASH_MAX_OCCLUDERS)) {
		const hx = occluder.width / 2;
		const hy = occluder.height / 2;
		const r = Math.min(occluder.radius, hx, hy);
		const qx = Math.abs(x - (occluder.x + hx)) - hx + r;
		const qy = Math.abs(y - (occluder.y + hy)) - hy + r;
		const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
		open = Math.min(open, smoothstep(0.5, 2.5, sdf));
	}
	return open;
}

/** Signed distance to the column rect's edge (px): positive inside, negative outside. */
export function flashInset(x: number, y: number, column: FlashColumn): number {
	const inset = Math.min(x - column.x, column.x + column.width - x, y - column.y, column.y + column.height - y);
	if (inset >= 0) return inset;
	const outX = Math.max(column.x - x, x - (column.x + column.width), 0);
	const outY = Math.max(column.y - y, y - (column.y + column.height), 0);
	return -Math.hypot(outX, outY);
}

/** How much of the light carries past the column: 1 at its edge, softly to exactly 0 by `glowCut`. */
export function flashGlowFalloff(outside: number): number {
	if (outside <= 0) return 1;
	return Math.exp(-((outside / S.glow) ** 2)) * (1 - smoothstep(S.glowCut * 0.66, S.glowCut, outside));
}

/**
 * The field at a viewport point (see the contract). Mirrors `flashLook` in
 * `FLASH_GLSL` line for line.
 */
export function flashLook(time: number, x: number, y: number, column: FlashColumn): FlashLook {
	const intensity = flashIntensity(time);
	if (intensity <= 0) return ZERO;
	const h = column.height;
	const source = flashSource(column);
	const rx = x - source.x;
	const ry = y - source.y;
	const dist = Math.hypot(rx, ry);
	const ux = dist > 1e-6 ? rx / dist : 0;
	const uy = dist > 1e-6 ? ry / dist : 0;
	const radius = flashRadius(time, column);
	const d = radius - dist;
	const columnInset = flashInset(x, y, column);
	const inset = columnInset + S.printPad;
	if (d < 0 || inset < 0) return ZERO;
	// Alpha ramps outside the column, in the undistorted margin of its padded print.
	const feather = smoothstep(0, S.feather, inset);
	// …and distortion only begins past it (a slope-limited carry, and a wide ease for blur/halo/split).
	const edgeRoom = Math.max(inset - S.distortionInset, 0);
	const edgeTaper = smoothstep(S.distortionInset, S.distortionInset + S.distortionBand, inset);

	const energy = flashEnergy(radius, column);
	const edge = S.edge * h;
	const core = flashCoreWidth(radius, column);
	const lens = S.lens * h;
	const tail = edge + core + lens;
	// Past the tail (plus its fade), the column is itself again.
	if (d >= tail + 40) return ZERO;
	// Band structure behind the leading edge.
	const inEdge = smoothstep(0, edge, d);
	const coreEnd = edge + core;
	const lensU = clamp((d - coreEnd) / lens);
	const lensShape = 1 - smoothstep(0, 1, lensU);
	// One damped return lobe: outward magnification, smaller inward recoil, then exactly rest.
	const elasticLens = lensShape * Math.cos(Math.PI * 1.5 * lensU);
	// The core's inner edge is soft too (the refs' ring has no hard rim inside).
	const band = inEdge * (1 - smoothstep(coreEnd - edge * 0.5, coreEnd + edge * 0.5, d));
	// Distortion's taper toward the front and the tail (zero before the alpha starts to drop there).
	const frontRoom = Math.max(d - S.distortionFront, 0);
	const tailRoom = Math.max(tail - d, 0);
	const taper = edgeTaper * smoothstep(S.distortionFront, S.distortionFront + 30, d) * (1 - smoothstep(tail - 40, tail - 6, d));
	// C. Refraction: a fisheye carry outward from the source, ramping in over the
	// edge and core, relaxing through the lens; slope-limited in from every boundary.
	const lensCarry = Math.min(S.lensGain * radius, S.lensMax * h) * (0.5 + 0.5 * energy) * smoothstep(0, coreEnd, d) * elasticLens * intensity;
	const outlineLimit = S.edgeBulge + S.edgeCarry * Math.max(columnInset, 0);
	const carry = Math.sign(lensCarry) * Math.min(Math.abs(lensCarry), outlineLimit, S.edgeCarry * edgeRoom, S.edgeCarry * frontRoom, S.edgeCarry * tailRoom);
	const sourceInset = flashInset(x - ux * carry, y - uy * carry, column);
	const sourceMask = smoothstep(-S.silhouetteFeather, S.silhouetteFeather, sourceInset);
	const surfaceMask = Math.max(sourceMask, smoothstep(-S.silhouetteFeather, S.silhouetteFeather, columnInset));
	const lightFall = flashGlowFalloff(-columnInset);
	// Blur through the band, clearing quickly behind the core.
	const clear = 1 - smoothstep(0, L.blurClear, lensU);
	const blur = L.blur * inEdge * (d <= coreEnd ? 1 : clear * clear) * intensity * taper;
	// B/D. Exposure: glare in the core (falling with energy) plus a broad wash as the energy falls.
	const glare = L.glare * energy * band;
	const wash = L.wash * (1 - energy) * inEdge * (d <= coreEnd ? 1 : (1 - lensU) ** 3);
	const lift = clamp(glare + wash) * intensity;
	// C. The dome's shade comes on softly across the core's inner edge: no hard rim.
	const darken = L.darken * energy * energy * lensShape * smoothstep(coreEnd - edge * 0.3, coreEnd + edge * 0.6, d) * intensity;
	// E. Highlight halos: gentle near the source, strongest on the far, broad band.
	const haloBand = inEdge * (d <= coreEnd ? 1 : clear);
	const halo = haloBand * (L.haloNear + (L.haloFar - L.haloNear) * (1 - energy) / (1 - S.energyFar)) * intensity * taper;
	// Coloured edge light: on the leading edge and the core's inner edge (a colour, not a displacement).
	const bell = (value: number, width: number) => Math.exp(-((value / width) ** 2));
	const fringe = L.fringe * (inEdge * bell(d - edge * 0.5, edge * 0.45) + 0.6 * bell(d - coreEnd, edge * 0.35)) * (0.4 + 0.6 * energy) * intensity;
	if (surfaceMask <= 0) {
		return { ...ZERO, lift: lift * lightFall * 0.15, fringe: fringe * lightFall * 0.5 };
	}
	const chroma = L.chroma * Math.min(fringe * lightFall / L.fringe, 1) * taper;
	// Opaque through the band; it fades only where the print is undistorted.
	const cover = feather * smoothstep(0, S.frontFade, d) * (1 - smoothstep(tail, tail + 40, d)) * surfaceMask;
	return { cover, feather, dx: ux * carry, dy: uy * carry, blur: blur * sourceMask, lift: lift * sourceMask, darken: darken * sourceMask, halo: halo * sourceMask, fringe: fringe * sourceMask, chroma: chroma * sourceMask };
}

/** Per-frame shader inputs for `FLASH_GLSL`. */
export function flashUniforms(time: number, column: FlashColumn): {
	readonly column: readonly [number, number, number, number];
	readonly state: readonly [number, number, number];
} {
	return {
		column: [column.x, column.y, column.width, column.height],
		state: [flashRadius(time, column), flashIntensity(time), time],
	};
}

function glslFloat(value: number): string {
	return Number.isInteger(value) ? `${value}.0` : String(value);
}

function glslColor(hex: string): string {
	const channel = (offset: number) => glslFloat(Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
	return `vec3(${channel(1)}, ${channel(3)}, ${channel(5)})`;
}

const f = glslFloat;
const S = FLASH_SHAPE;
const L = FLASH_LOOK;

/**
 * GLSL port of the field: `flashLook(p)` fills a `FlashLook` for viewport px
 * `p` (y down), line for line with the JS. Declares `uFlashColumn`,
 * `uFlashState` and `uFlashRing` (the per-frame ring scalars the JS derives
 * from `time`: see `flashRingUniforms`).
 */
export const FLASH_GLSL = /* glsl */ `
uniform vec4 uFlashColumn;
uniform vec3 uFlashState;
/** The ring's energy, core width and travel for this frame. */
uniform vec3 uFlashRing;

struct FlashLook {
	float cover;
	float feather;
	vec2 carry;
	float blur;
	float lift;
	float darken;
	float halo;
	float fringe;
	float chroma;
	float d;
};

vec2 flashSource() {
	return vec2(uFlashColumn.x + uFlashColumn.z * 0.5, uFlashColumn.y + uFlashColumn.w * ${f(1 - S.sourceInset)});
}

float flashInset(vec2 p) {
	vec2 lo = p - uFlashColumn.xy;
	vec2 hi = uFlashColumn.xy + uFlashColumn.zw - p;
	float inset = min(min(lo.x, hi.x), min(lo.y, hi.y));
	if (inset >= 0.0) return inset;
	return -length(max(max(-lo, -hi), 0.0));
}

float flashGlowFalloff(float outside) {
	if (outside <= 0.0) return 1.0;
	float u = outside / ${f(S.glow)};
	return exp(-u * u) * (1.0 - smoothstep(${f(S.glowCut * 0.66)}, ${f(S.glowCut)}, outside));
}

float flashBell(float value, float width) {
	float u = value / width;
	return exp(-u * u);
}

FlashLook flashLook(vec2 p) {
	FlashLook look = FlashLook(0.0, 0.0, vec2(0.0), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -1.0);
	float intensity = uFlashState.y;
	if (intensity <= 0.0) return look;
	float h = uFlashColumn.w;
	vec2 offset = p - flashSource();
	float dist = length(offset);
	vec2 dir = dist > 1e-6 ? offset / dist : vec2(0.0);
	float radius = uFlashState.x;
	float d = radius - dist;
	look.d = d;
	float columnInset = flashInset(p);
	float inset = columnInset + ${f(S.printPad)};
	if (d < 0.0 || inset < 0.0) return look;
	float feather = smoothstep(0.0, ${f(S.feather)}, inset);
	float edgeRoom = max(inset - ${f(S.distortionInset)}, 0.0);
	float edgeTaper = smoothstep(${f(S.distortionInset)}, ${f(S.distortionInset + S.distortionBand)}, inset);

	float energy = uFlashRing.x;
	float edge = ${f(S.edge)} * h;
	float core = uFlashRing.y;
	float lens = ${f(S.lens)} * h;
	float tail = edge + core + lens;
	if (d >= tail + 40.0) return look;
	look.feather = feather;
	float inEdge = smoothstep(0.0, edge, d);
	float coreEnd = edge + core;
	float lensU = clamp((d - coreEnd) / lens, 0.0, 1.0);
	float lensShape = 1.0 - smoothstep(0.0, 1.0, lensU);
	float elasticLens = lensShape * cos(3.14159265 * 1.5 * lensU);
	float band = inEdge * (1.0 - smoothstep(coreEnd - edge * 0.5, coreEnd + edge * 0.5, d));
	float frontRoom = max(d - ${f(S.distortionFront)}, 0.0);
	float tailRoom = max(tail - d, 0.0);
	float taper = edgeTaper * smoothstep(${f(S.distortionFront)}, ${f(S.distortionFront + 30)}, d) * (1.0 - smoothstep(tail - 40.0, tail - 6.0, d));
	float carry = min(${f(S.lensGain)} * radius, ${f(S.lensMax)} * h) * (0.5 + 0.5 * energy) * smoothstep(0.0, coreEnd, d) * elasticLens * intensity;
	float outlineLimit = ${f(S.edgeBulge)} + ${f(S.edgeCarry)} * max(columnInset, 0.0);
	carry = sign(carry) * min(outlineLimit, min(min(abs(carry), ${f(S.edgeCarry)} * edgeRoom), min(${f(S.edgeCarry)} * frontRoom, ${f(S.edgeCarry)} * tailRoom)));
	look.carry = dir * carry;
	float sourceMask = smoothstep(-${f(S.silhouetteFeather)}, ${f(S.silhouetteFeather)}, flashInset(p - look.carry));
	float surfaceMask = max(sourceMask, smoothstep(-${f(S.silhouetteFeather)}, ${f(S.silhouetteFeather)}, columnInset));
	float clearing = 1.0 - smoothstep(0.0, ${f(L.blurClear)}, lensU);
	look.blur = ${f(L.blur)} * inEdge * (d <= coreEnd ? 1.0 : clearing * clearing) * intensity * taper;
	float glare = ${f(L.glare)} * energy * band;
	float wash = ${f(L.wash)} * (1.0 - energy) * inEdge * (d <= coreEnd ? 1.0 : pow(1.0 - lensU, 3.0));
	look.lift = clamp(glare + wash, 0.0, 1.0) * intensity;
	look.darken = ${f(L.darken)} * energy * energy * lensShape * smoothstep(coreEnd - edge * 0.3, coreEnd + edge * 0.6, d) * intensity;
	float haloBand = inEdge * (d <= coreEnd ? 1.0 : clearing);
	look.halo = haloBand * (${f(L.haloNear)} + ${f(L.haloFar - L.haloNear)} * (1.0 - energy) / ${f(1 - S.energyFar)}) * intensity * taper;
	look.fringe = ${f(L.fringe)} * (inEdge * flashBell(d - edge * 0.5, edge * 0.45) + 0.6 * flashBell(d - coreEnd, edge * 0.35)) * (0.4 + 0.6 * energy) * intensity;
	float lightFall = flashGlowFalloff(-columnInset);
	if (surfaceMask <= 0.0) {
		FlashLook glow = FlashLook(0.0, 0.0, vec2(0.0), 0.0, look.lift * lightFall * 0.15, 0.0, 0.0, look.fringe * lightFall * 0.5, 0.0, d);
		return glow;
	}
	look.chroma = ${f(L.chroma)} * min(look.fringe * lightFall / ${f(L.fringe)}, 1.0) * taper;
	look.blur *= sourceMask;
	look.lift *= sourceMask;
	look.darken *= sourceMask;
	look.halo *= sourceMask;
	look.fringe *= sourceMask;
	look.chroma *= sourceMask;
	look.cover = feather * smoothstep(0.0, ${f(S.frontFade)}, d) * (1.0 - smoothstep(tail, tail + 40.0, d)) * surfaceMask;
	return look;
}

vec3 flashColor(float s) {
	float k = fract(s) * 4.0;
	float i = floor(k);
	float t = smoothstep(0.0, 1.0, k - i);
	vec3 c0 = ${glslColor(FLASH_ROVO_COLORS[0])};
	vec3 c1 = ${glslColor(FLASH_ROVO_COLORS[1])};
	vec3 c2 = ${glslColor(FLASH_ROVO_COLORS[2])};
	vec3 c3 = ${glslColor(FLASH_ROVO_COLORS[3])};
	vec3 from = i < 0.5 ? c0 : i < 1.5 ? c1 : i < 2.5 ? c2 : c3;
	vec3 to = i < 0.5 ? c1 : i < 1.5 ? c2 : i < 2.5 ? c3 : c0;
	return mix(from, to, t);
}
`;

/** Per-frame ring uniforms for `FLASH_GLSL` (`uFlashRing`): energy, core width, travel. */
export function flashRingUniforms(time: number, column: FlashColumn): readonly [number, number, number] {
	const radius = flashRadius(time, column);
	return [flashEnergy(radius, column), flashCoreWidth(radius, column), flashTravel(radius, column)];
}

/**
 * The column pass: turns the field into pixels over the column print
 * (`uPrint`, premultiplied, y-up texture of the padded column print). Include after
 * `FLASH_GLSL`. `flashPass(p)` returns premultiplied RGBA, transparent where
 * the field is not active.
 */
export const FLASH_PASS_GLSL = /* glsl */ `
uniform sampler2D uPrint;
uniform vec4 uPrintRect;
uniform vec3 uBackdrop;
uniform sampler2D uPrintSoft;
uniform sampler2D uPrintBlur;
uniform sampler2D uPrintBloom;
/** Floating elements over the column (x, y, w, h in viewport px), their corner radii, and how many. */
uniform vec4 uOccluders[${FLASH_MAX_OCCLUDERS}];
uniform vec4 uOccluderRadii;
uniform int uOccluderCount;

float flashOcclusion(vec2 p) {
	float open = 1.0;
	for (int i = 0; i < ${FLASH_MAX_OCCLUDERS}; i++) {
		if (i >= uOccluderCount) break;
		vec4 box = uOccluders[i];
		vec2 halfSize = box.zw * 0.5;
		float r = min(uOccluderRadii[i], min(halfSize.x, halfSize.y));
		vec2 q = abs(p - (box.xy + halfSize)) - halfSize + r;
		float sdf = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
		open = min(open, smoothstep(0.5, 2.5, sdf));
	}
	return open;
}

vec4 flashPrint(vec2 q) {
	vec2 uv = (q - uPrintRect.xy) / uPrintRect.zw;
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
	return texture2D(uPrint, vec2(uv.x, 1.0 - uv.y));
}

// Interpolate real Gaussian focus levels, rather than sparse taps that duplicate glyphs.
// The print is immutable: filtering happens once at capture, never per fragment/frame.
vec4 flashBlurred(vec2 q, float radius) {
	// Refraction can uncover the old outline, but never samples a neighbouring column.
	if (flashInset(q) < 0.0) return vec4(uBackdrop, 1.0);
	vec2 uv = (q - uPrintRect.xy) / uPrintRect.zw;
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
	uv.y = 1.0 - uv.y;
	vec4 crisp = texture2D(uPrint, uv);
	vec4 blurred;
	if (radius <= ${f(FLASH_BLUR_LEVELS[0])}) {
		blurred = mix(crisp, texture2D(uPrintSoft, uv), clamp(radius / ${f(FLASH_BLUR_LEVELS[0])}, 0.0, 1.0));
	} else if (radius <= ${f(FLASH_BLUR_LEVELS[1])}) {
		blurred = mix(texture2D(uPrintSoft, uv), texture2D(uPrintBlur, uv), (radius - ${f(FLASH_BLUR_LEVELS[0])}) / ${f(FLASH_BLUR_LEVELS[1] - FLASH_BLUR_LEVELS[0])});
	} else {
		blurred = mix(texture2D(uPrintBlur, uv), texture2D(uPrintBloom, uv), clamp((radius - ${f(FLASH_BLUR_LEVELS[1])}) / ${f(FLASH_BLUR_LEVELS[2] - FLASH_BLUR_LEVELS[1])}, 0.0, 1.0));
	}
	// Focus must never reveal the live, crisp lettering beneath the print.
	return vec4(blurred.rgb / max(blurred.a, 1e-4) * crisp.a, crisp.a);
}

float flashLuma(vec3 c) {
	return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec4 flashOver(vec4 top, vec4 bottom) {
	return top + bottom * (1.0 - top.a);
}

// The light alone, as a premultiplied overlay on the untouched board: glare,
// the dark lens's shade and the coloured edge light, matching what the
// content pass does to the column (so the two cross-fade seamlessly).
vec4 flashLightOverlay(FlashLook look, vec3 tint) {
	vec4 shade = vec4(vec3(0.1, 0.16, 0.32) * look.darken, look.darken);
	vec4 glare = vec4(vec3(look.lift), look.lift);
	float edge = look.fringe * 0.6;
	return flashOver(vec4(tint * edge, edge), flashOver(glare, shade));
}

vec4 flashPass(vec2 p) {
	FlashLook look = flashLook(p);
	vec2 offset = p - flashSource();
	vec2 dir = length(offset) > 1e-6 ? normalize(offset) : vec2(0.0);
	float along = atan(offset.x, -offset.y) / 3.14159265 + 0.5;
	vec3 tint = flashColor(along * 0.6 - uFlashState.z * 0.4);
	// Near and past the column's edge the refracted content eases out and the light carries on alone.
	// Wherever the print is not drawn, the light alone rides over the live DOM.
	float open = flashOcclusion(p);
	vec4 light = flashLightOverlay(look, tint) * (1.0 - look.cover) * open;
	if (look.cover <= 0.0) return light;
	vec2 q = p - look.carry;

	// Refracted, band-blurred content, with a slight chromatic split at the edges.
	vec4 colour = flashBlurred(q, look.blur);
	float split = look.chroma;
	if (split > 0.05) {
		colour.r = flashBlurred(q + dir * split, look.blur).r;
		colour.b = flashBlurred(q - dir * split, look.blur).b;
	}
	float a = max(colour.a, 1e-4);
	vec3 straight = colour.rgb / a;

	// E. Highlight bloom: dark marks smear into a soft, tinted halo (ink = how dark the neighbourhood is).
	if (look.halo > 0.001) {
		vec4 wide = flashBlurred(q, ${f(FLASH_BLUR_LEVELS[2])});
		vec3 wideStraight = wide.rgb / max(wide.a, 1e-4);
		float ink = clamp((0.96 - flashLuma(wideStraight)) * 3.0, 0.0, 1.0);
		vec3 halo = mix(wideStraight, mix(tint, vec3(1.0), 0.35), 0.55);
		straight = mix(straight, halo, clamp(ink * look.halo * 0.7, 0.0, 1.0));
	}
	// Coloured edge light: the content's own hue saturated, plus a touch of Rovo.
	float luma = flashLuma(straight);
	straight = mix(vec3(luma), straight, 1.0 + 1.6 * look.fringe);
	straight += tint * look.fringe * 0.55;
	// C. The dark lens, toward the ADS shadow blue.
	straight = mix(straight, straight * vec3(0.82, 0.85, 0.9), look.darken / ${f(L.darken)});
	// B/D. Exposure lift into glare: pure white in the hot core; as the energy
	// falls the wash carries a faint tint, so the far band still reads as light on white cards.
	float warmth = (1.0 - uFlashRing.x) / ${f(1 - S.energyFar)};
	straight = mix(straight, mix(vec3(1.0), mix(tint, vec3(1.0), 0.55), 0.18 * warmth), look.lift);
	colour = vec4(clamp(straight, 0.0, 1.0) * colour.a, colour.a);
	return colour * look.cover * open + light;
}
`;
