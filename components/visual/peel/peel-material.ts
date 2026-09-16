/**
 * Peel — the sheet material.
 *
 * One plane carries everything: the die-cut silhouette, the paper, the printed
 * artwork, the flex, and the foil. Compositing them in a single shader (rather
 * than stacking a photo, a gloss canvas and a highlight layer the way a DOM
 * implementation has to) is the whole reason the sheen bends correctly over a
 * fold — the foil is lit by the same normal that the wave just moved.
 *
 * Two conventions worth knowing before editing:
 *
 *   - "sheet space" is UV recentred on the middle of the sheet and scaled by
 *     aspect, so one unit is one sheet-height in both axes. Every distance,
 *     radius below is in sheet space; comparing raw UV distances on a non-square
 *     card would make the corner radius oval.
 *   - the shader works in linear light and converts once at the end. The
 *     artwork texture must therefore be tagged SRGBColorSpace by the caller.
 *
 * Do not put a backtick anywhere in these template literals, including inside a
 * comment: it closes the string early and TypeScript then parses the remaining
 * GLSL as TypeScript, with the error reported tens of lines from the cause.
 */

import * as THREE from "three";

import {
	PEEL_PAPER_MARGIN,
	PEEL_PERF_COLUMNS,
	PEEL_PERF_DEPTH_JITTER,
	PEEL_PERF_PHASE_JITTER,
	PEEL_PERF_RADIUS,
	PEEL_PERF_ROWS,
} from "./data";
import { PEEL_IMPULSE_SLOTS } from "./peel-model";

const vertexShader = /* glsl */ `
precision highp float;

uniform float uAspect;
uniform float uLift;
uniform vec4 uImpulses[IMPULSE_SLOTS];
/** x: amplitude, y: wavelength in sheet-heights, z: speed. */
uniform vec3 uWave;
uniform float uFlutter;
/**
 * How hard out-of-plane bending pulls the surface in-plane. See the
 * contraction note in main().
 */
uniform float uShear;
/** Drag speed, normalised 0-1. Scales the flex of a sheet being carried. */
uniform float uSpeed;
uniform float uTime;
uniform vec2 uPointer;

varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vLightViewPos;
varying float vHeight;

const float TAU = 6.28318530718;

/** Finite-difference step. Matches the plane's vertex spacing at 48 segments. */
const float EPS = 0.0208333;

vec2 toSheet(vec2 uv) {
	return (uv - 0.5) * vec2(uAspect, 1.0);
}

/** Optional ripple accents over the cylindrical fold in peel-geometry.ts. */
vec2 peelHeight(vec2 uv) {
	vec2 p = toSheet(uv);
	// Wavelength is authored against the sheet's LONG edge, not its height.
	// The agent session card is about six times wider than it is tall, so a
	// wavelength in sheet-heights would run six ripples down it — a vibration,
	// where the reference bows the whole outline once. Scaling by the long edge
	// keeps "roughly one wave across the card" true at any aspect.
	float waveUnit = max(uWave.y * max(uAspect, 1.0), 0.05);

	float flex = 0.0;

	for (int i = 0; i < IMPULSE_SLOTS; i++) {
		vec4 impulse = uImpulses[i];
		if (impulse.w <= 0.0) {
			continue;
		}
		float dist = distance(p, toSheet(impulse.xy));
		// Radial falloff as well as temporal: a ripple loses height as it
		// spreads, so the far edge flexes less than the grabbed corner. Kept
		// gentle enough that the whole sheet takes part — a ripple confined to
		// the corner you grabbed is not a sheet of paper flexing.
		float spatial = exp(-dist * 1.3 / max(uAspect, 1.0));
		float phase = TAU * (dist / waveUnit - uWave.z * impulse.z);
		flex += uWave.x * impulse.w * spatial * sin(phase);
	}

	// --- sustained undulation ----------------------------------------------
	// The impulses above are accents: they fire on grab and on landing and
	// then decay. On their own they leave the sheet rigid for most of a drag,
	// which is exactly what a one-shot ripple looks like — a twitch, not
	// paper. The reference keeps undulating for the entire time the sticker is
	// held, so this term does not decay at all; it is gated purely on lift.
	//
	// Two waves crossing at an angle, at incommensurate rates, so the surface
	// never visibly repeats.
	float k = TAU / waveUnit;
	vec2 dirA = normalize(vec2(0.85, 0.52));
	vec2 dirB = normalize(vec2(-0.42, 0.91));
	float undulation =
		sin(dot(p, dirA) * k - uTime * uWave.z * 1.55) * 0.62 +
		sin(dot(p, dirB) * k * 0.73 + uTime * uWave.z * 1.12) * 0.38;
	// A high floor, not a fade to nothing: pausing mid-drag should not freeze
	// the paper solid, it should just stop driving it harder.
	flex += uFlutter * uLift * mix(0.7, 1.0, uSpeed) * undulation;

	return vec2(0.0, flex);
}

void main() {
	vUv = uv;

	vec2 parts = peelHeight(uv);
	vec2 partsU = peelHeight(uv + vec2(EPS, 0.0));
	vec2 partsV = peelHeight(uv + vec2(0.0, EPS));

	float height = parts.x + parts.y;
	float heightU = partsU.x + partsU.y;
	float heightV = partsV.x + partsV.y;
	// Only the flex drives the curl shading. Handing it the bulk lift instead
	// would just brighten the whole sheet as it rises.
	vHeight = parts.y;

	// The normal comes from differencing the displacement function itself, not
	// from sampling a height texture, so it stays exact as the wave moves and
	// costs two extra evaluations of a handful of instructions.
	vec3 tangentU = vec3(EPS * uAspect, 0.0, heightU - height);
	vec3 tangentV = vec3(0.0, EPS, heightV - height);
	vec3 rippleNormal = normalize(cross(tangentU, tangentV));
	vec3 objectNormal = normalize(normal + vec3(rippleNormal.xy, rippleNormal.z - 1.0));

	// --- in-plane contraction ----------------------------------------------
	// Paper does not stretch. When a sheet bows, the arc length it spends
	// going over the bulge has to come from somewhere, so its flat footprint
	// contracts and the material gathers toward the crests.
	//
	// This is the term that makes a wave legible. Displacing only in z on a
	// plane viewed face-on is very nearly invisible: the camera looks straight
	// down the displacement axis, so the outline stays a rigid rectangle and
	// the only evidence of a wave is shading. Moving each point along the
	// local gradient — toward the crest, by an amount that grows with how far
	// out of plane it already is — ripples the silhouette itself, which is
	// what the eye actually reads as a sheet of paper flexing.
	//
	// Clamped because at high amplitude an unbounded pull would fold the mesh
	// back through itself.
	vec2 flexGradient = vec2(
		(partsU.y - parts.y) / (EPS * uAspect),
		(partsV.y - parts.y) / EPS
	);
	vec2 gather = clamp(flexGradient * abs(parts.y) * uShear, -0.12, 0.12);

	vec3 displaced = position + vec3(gather, height);
	vec4 viewPos = modelViewMatrix * vec4(displaced, 1.0);

	vNormalV = normalize(normalMatrix * objectNormal);
	vViewPos = viewPos.xyz;

	// The cursor is treated as a small light floating just above the sheet.
	// The height is the single control over how big the hot spot is. A light
	// far above a flat plane subtends nearly the same angle everywhere, which
	// gives a highlight the size of the whole stamp; too close and it shrinks
	// to a dot. Three tenths of a sheet-height puts the bloom at roughly a
	// third of the stamp, which is where it reads as a coating catching a
	// light rather than as a spotlight pointed at it.
	vec3 lightLocal = vec3(toSheet(uPointer), 0.22);
	vLightViewPos = (modelViewMatrix * vec4(lightLocal, 1.0)).xyz;

	gl_Position = projectionMatrix * viewPos;
}
`;

/**
 * The die-cut silhouette, shared verbatim with the contact shadow.
 *
 * The shadow has to have exactly the stamp's outline — a soft rectangle under a
 * perforated stamp is the kind of mismatch you cannot unsee — so the two
 * shaders compile the same source rather than each keeping their own copy.
 * Requires uAspect to be declared by the host shader.
 */
export const PEEL_SILHOUETTE_GLSL = /* glsl */ `
/** Rounded-rectangle signed distance, positive inside. */
float roundedRect(vec2 p, vec2 extent, float radius) {
	vec2 q = abs(p) - (extent - radius);
	return radius - (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0));
}

/** Bite radius, in sheet-heights. PEEL_PERF_RADIUS: 1.90 CSS px measured. */
const float PERF_RADIUS = ${PEEL_PERF_RADIUS.toFixed(5)};
/** Cells along a horizontal edge. One bite per cell, at its midpoint. */
const float PERF_COLUMNS = ${PEEL_PERF_COLUMNS.toFixed(1)};
/** Cells along a vertical edge. */
const float PERF_ROWS = ${PEEL_PERF_ROWS.toFixed(1)};
/** Peak of the along-edge scatter. PEEL_PERF_PHASE_JITTER: 0.35 device px sd. */
const float PERF_PHASE_JITTER = ${PEEL_PERF_PHASE_JITTER.toFixed(5)};
/** Peak of the radius scatter. PEEL_PERF_DEPTH_JITTER: 0.26 device px sd. */
const float PERF_DEPTH_JITTER = ${PEEL_PERF_DEPTH_JITTER.toFixed(5)};

/**
 * Signed offset from the nearest cell midpoint, given a coordinate measured from
 * the low edge. Clamped rather than wrapped so that the shadow quad, which samples
 * well outside the sheet, does not find phantom bites out there: past either end
 * the offset pins at half a cell, which is 0.027 sheet-heights and comfortably
 * larger than PERF_RADIUS even at full scatter.
 */
float perfCell(float along, float cells, float cell) {
	float t = clamp(along / cell, 0.0, cells);
	return (fract(t) - 0.5) * cell;
}

/**
 * Which cell that offset belongs to, on the same clamped ruler. Split out rather
 * than returned alongside the offset so that the exterior field in
 * shadow-material.ts, which wants only the offset, keeps its existing call.
 *
 * The scatter below is keyed on this index: a hole has to keep the same wander
 * from frame to frame and from the sheet to its shadow, so the only thing it can
 * be a function of is which hole it is.
 */
float perfIndex(float along, float cells, float cell) {
	return floor(clamp(along / cell, 0.0, cells));
}

/**
 * Deterministic per-hole noise in 0..1. Two arguments: which hole along the edge,
 * and which edge (plus an offset to draw a second, independent value for the same
 * hole). The same fract-sin idiom the rest of this file uses; both arguments stay
 * under 30 so it never reaches the range where that hash loses precision.
 */
float perfHash(float index, float seed) {
	return fract(sin(index * 12.9898 + seed * 78.233) * 43758.5453123);
}

/**
 * One bite, as a signed distance that is positive outside it, given the offset
 * along the edge from the cell midpoint, the distance across the edge, which hole
 * this is, and which edge it sits on.
 *
 * A circle of PERF_RADIUS at the cell midpoint, then moved and resized by a hair.
 * The scatter is measured, and measuring it took two passes to get right. A single
 * quiet frame says the reference's holes wander; a phase-fold of one edge says they
 * do not; the fold is wrong because folding is precisely the operation that averages
 * per-tooth variation away. What settles it is that the reference stamp is picked up
 * and put down, so two rest windows show the same 14 teeth on different pixel grids:
 * their per-tooth phase residuals correlate at 0.80 and their depths at 0.50, which
 * a codec artefact cannot do. Full numbers in data.ts.
 *
 * Both jitters stay well inside the land. Peak shift is 0.61 device px and peak
 * radius 4.26 px against a half-cell of 7.0, so every circle stays inside its own
 * cell and the nearest-midpoint lookup in perfCell() remains exact — no bite can
 * leak into a neighbour and be missed.
 *
 * The seeds differ per edge (0, 1, 2, 3) so opposite edges do not wander in step,
 * and the radius draws from seed + 4 so a hole's shift and its size are independent.
 *
 * Note for whoever owns the shadow: shadowField() in shadow-material.ts rebuilds
 * the bite mouth OUTSIDE the rectangle from PERF_RADIUS and the raw cell offset, so
 * out there it still assumes a perfect comb. The two fields agree exactly on the
 * edge line and inside; past it they can disagree by the peak shift plus the peak
 * swell, about 1 device px, on a contour that is then blurred by several. Worth
 * folding perfHash() into that term if the shadow ever reads hard.
 */
float perfBite(float along, float across, float index, float seed) {
	float shift = (perfHash(index, seed) * 2.0 - 1.0) * PERF_PHASE_JITTER;
	float swell = (perfHash(index, seed + 4.0) * 2.0 - 1.0) * PERF_DEPTH_JITTER;
	return length(vec2(along - shift, across)) - (PERF_RADIUS + swell);
}

/**
 * Silhouette as a signed distance in sheet space, positive inside the sheet.
 *
 * A rectangle with semicircular bites taken out of all four edges — the classic
 * stamp die-cut. Measured off the reference: 14 bites across, 18 down, one per
 * cell and centred on its midpoint, so every corner ends in a half-land (1.61 CSS
 * px of straight paper on the x edge, 1.67 on the y) and no bite lands on a
 * corner. Pitch works out at 7.01 CSS horizontally and 7.15 vertically.
 *
 * Verified on the live route at 2x against the same estimator run over the
 * reference recording: single-frequency pitch fit 13.978 / 14.298 device px
 * against the reference's 14.000 / 14.274, and the de-rotated paper measures
 * 195.7 x 257.6 device px against 197.6 x 258.4.
 *
 * Verified again by shape, not just by pitch, because three critics read these
 * bites as square castellations. Phase-folding every period of an edge and
 * comparing against an r = 3.80 semicircle chain convolved with a Gaussian:
 *
 *   top edge     ours apex +2.056 land -1.565 swing 3.621  -> model at sigma 1.05
 *                ref  apex +1.761 land -1.534 swing 3.295  -> model at sigma 1.60
 *   left edge    ours apex +2.158 land -1.511 swing 3.670
 *                ref  apex +1.582 land -1.573 swing 3.155
 *
 * Both sit on the same zero-jitter semicircle model; the only difference is
 * 1.0-1.2 device px of blur in the recording. That blur is the capture, not the
 * site: the reference's ARTWORK — the identical webp at the identical scale —
 * matches ours blurred by sigma 0.88 (mean gradient magnitude 28.2 against our
 * 41.2 sharp, 29.7 at sigma 0.8, 26.2 at sigma 1.0), and blurring our whole
 * screenshot by 0.95 reproduces the reference's fold to apex 1.893 / swing
 * 3.386. So the bites are already the right shape and must NOT be softened to
 * chase it, or the live stamp ends up blurrier than the real one.
 *
 * The bites are TRUE semicircles: their centres sit exactly on the paper edge, not
 * outside it. Folding the reference's 13 top-edge periods together gives a width
 * over depth of 1.740 against the sqrt(3) = 1.732 a zero-offset semicircle
 * predicts; a circle pushed outward would read above 2.
 *
 * Depth re-checked tooth by tooth, in LUMA rather than chroma so the recording's
 * 2x2 chroma blocks cannot bias it, on a de-rotated live screenshot against a
 * 151-frame average of the reference at rest:
 *
 *   ours  top 3.64  bottom 3.56  left 3.61  right 3.66 device px
 *   ref   top 3.49 (bottom, left and right unusable: its drop shadow crosses the
 *                   same luma threshold as the cream)
 *
 * and the edge cross-sections are the same width, ours 248/242/230/225 against the
 * reference's 248/243/233/227/225 walking inward. So the die-cut is neither shallow
 * nor soft at the source. A round of critics measured ours 25% shallow and twice as
 * feathered, but they were reading frames that had been through a JPEG screencast
 * AND an H.264 pass where the reference had been through H.264 only; measuring their
 * own crops in luma puts ours at 3.63 against the reference's 3.40. Do not deepen
 * the bites or sharpen the ramp to chase that.
 *
 * Positive-inside means min() is intersection, so subtracting a bite is
 * min(sheet, distanceToCentre - radius) — positive everywhere outside the circle.
 *
 * The corner radius is the one number here that is not measured. The reference is
 * square to within about 1 device px at 720x410, so anything up to 0.5 CSS px
 * fits the data; 0.004 sheet-heights is 0.52 CSS, the largest value inside that
 * uncertainty, and it still resolves the corner as a clean cut rather than as the
 * aliased point a true zero gives at this size. It was 0.008 (1.03 CSS), which ate
 * two thirds of the 1.61 CSS corner land once the bites arrived.
 */
float sheetDistance(vec2 p) {
	vec2 extent = vec2(uAspect, 1.0) * 0.5;
	float sheet = roundedRect(p, extent, 0.004);

	float cellX = uAspect / PERF_COLUMNS;
	float cellY = 1.0 / PERF_ROWS;
	float alongX = perfCell(p.x + extent.x, PERF_COLUMNS, cellX);
	float alongY = perfCell(p.y + extent.y, PERF_ROWS, cellY);
	float indexX = perfIndex(p.x + extent.x, PERF_COLUMNS, cellX);
	float indexY = perfIndex(p.y + extent.y, PERF_ROWS, cellY);

	sheet = min(sheet, perfBite(alongX, p.y - extent.y, indexX, 0.0));
	sheet = min(sheet, perfBite(alongX, p.y + extent.y, indexX, 1.0));
	sheet = min(sheet, perfBite(alongY, p.x - extent.x, indexY, 2.0));
	sheet = min(sheet, perfBite(alongY, p.x + extent.x, indexY, 3.0));

	return sheet;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float uAspect;
uniform vec3 uSurface;
uniform sampler2D uArt;
/** 0 until the artwork decodes; the sheet is bare stock until then. */
uniform float uArtReady;
/** 1 for captured DOM surfaces; 0 for printed, perforated stamps. */
uniform float uSurfaceMode;
/** Avatar-coloured light sweeping through the captured face, never outside it. */
uniform vec3 uFlashColor;
uniform float uFlashGain;
uniform float uFlashProgress;

uniform float uFilm;
uniform float uGloss;
uniform float uSheenGain;
uniform float uGrain;
uniform float uRestSheen;
uniform float uSheen;
uniform float uLift;
uniform float uTime;

varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vLightViewPos;
varying float vHeight;

const float TAU = 6.28318530718;

/**
 * Wavelengths for the three channels, in micrometres. Shared with
 * components/visual/dropzone-effect/sticker-material.ts so that foil in this
 * repo shifts hue the same way wherever it appears.
 */
const vec3 LAMBDA = vec3(0.62, 0.55, 0.465);

/** Cream paper showing around the print, in sheet-heights. 3.03 CSS px measured. */
const float MARGIN = ${PEEL_PAPER_MARGIN.toFixed(5)};

vec2 toSheet(vec2 uv) {
	return (uv - 0.5) * vec2(uAspect, 1.0);
}

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
		u.y
	);
}

SILHOUETTE_CHUNK

void main() {
	vec2 p = toSheet(vUv);
	if (uSurfaceMode > 0.5) {
		if (uArtReady < 0.5) discard;
		vec4 surface = texture2D(uArt, vUv);
		if (surface.a < 0.001) discard;
		vec3 light = normalize(vec3(-0.4, 0.6, 1.0));
		float diffuse = dot(normalize(vNormalV), light) / light.z;
		vec3 stock = surface.rgb * clamp(diffuse, 0.62, 1.08);
		float beamCenter = mix(0.55, 0.95, uFlashProgress);
		float beam = exp(-pow((vUv.x - beamCenter) / 0.24, 2.0));
		float face = smoothstep(0.85, 0.99, surface.a);
		// A soft pass through the face. The original alpha remains unchanged,
		// keeping the light inside the card and its drop shadow unchanged.
		stock = mix(stock, uFlashColor, uFlashGain * beam * face * 0.18);
		gl_FragColor = vec4(stock, surface.a);
		#include <colorspace_fragment>
		return;
	}

	float sheet = sheetDistance(p);
	// Antialiasing band for the die-cut, in sheet-heights. smoothstep spans
	// 2 x aa, so this expression IS the ramp width.
	//
	// Two things have to be true at once. fwidth tracks the fragment size, so
	// the ramp must follow it or the edge is wrong at any other render scale —
	// but fwidth is abs(dFdx) + abs(dFdy), which overstates the true footprint
	// by 1.0x on an axis-aligned edge and 1.41x on a diagonal one, and it also
	// balloons wherever the gather stretches the mesh, feathering a peeling
	// sheet exactly when it is most visible. Hence: scale fwidth down to the
	// real footprint, then cap it.
	//
	// 0.7 is the midpoint of that 1.0-1.41 orientation spread, so the ramp comes
	// out the same width whichever way the edge runs. The 0.0030 cap is where a
	// 45-degree edge would land anyway at the size this renders, so at rest the
	// cap and the scaled fwidth agree and only the gather ever hits the cap.
	//
	// Measured on the live route: the drawing buffer is 386 px tall for a 208.63
	// CSS px box, i.e. 238.7 buffer px per sheet-height, so one fragment is
	// 0.00419 of sheet and the ramp works out at 1.40 fragments = 1.51 device px
	// after the buffer's 1.081x upscale to the 2x display.
	//
	// It was clamp(fwidth(sheet), 0.0006, 0.0020) — a hard 1.03 device px ramp,
	// 0.92 of a fragment, i.e. slightly UNDER-antialiased, which is what made
	// the -5.9 degree die-cut visibly staircase. Widening it does not measurably
	// move the geometry: phase-folding the top edge over 13 periods gives apex
	// +2.056 / land -1.565 / swing 3.621 device px, and an r = 3.80 semicircle
	// chain at this pitch predicts +2.184 / -1.616 / 3.800 before blur, so the
	// fold already sits on the model at an effective sigma of 1.05 px and the
	// extra 0.14 px of ramp moves the apex by about 0.02 px.
	float aa = clamp(fwidth(sheet) * 0.7, 0.0006, 0.0030);
	float alpha = smoothstep(-aa, aa, sheet);
	if (alpha <= 0.001) {
		discard;
	}

	// --- print inside the paper margin ---------------------------------------
	// The print does NOT run edge to edge. Aligning the 384x512 source artwork to
	// the reference stamp by row and column luminance profiles converges, on both
	// axes independently, on a print box of 91.97 x 122.63 CSS inside a 98.12 x
	// 128.61 CSS paper: a uniform 3.03 CSS band of bare stock all the way round.
	// In world units that is PEEL_PAPER_MARGIN = 0.0236, and the print box that
	// falls out of it is 0.750 aspect — exactly the source image, unscaled on
	// either axis, which is the check that says the margin is really uniform
	// rather than fitted.
	//
	// In vUv terms the inset is u in [0.031, 0.969], v in [0.0236, 0.9764].
	vec2 printHalf = vec2(uAspect, 1.0) * 0.5 - MARGIN;
	vec2 artUv = (p + printHalf) / (2.0 * printHalf);
	vec2 inside = step(vec2(0.0), artUv) * step(artUv, vec2(1.0));
	float inPrint = inside.x * inside.y;
	vec4 art = texture2D(uArt, clamp(artUv, 0.0, 1.0));

	vec3 stock = mix(uSurface, art.rgb, uArtReady * inPrint);
	float fibre = valueNoise(p * 240.0) * 0.03 + valueNoise(p * 38.0) * 0.02;
	vec3 albedo = stock * (0.985 + fibre);
	// Inward edge darkening, one band's worth. 0.010 sheet-heights is 1.29 CSS px;
	// this was 0.035 (4.5 CSS), which is wider than the entire 3.03 CSS margin and
	// would tint the whole cream band the moment it existed.
	//
	// The depth is measured now too, and it was far too strong. Walking the green
	// channel inward from the die-cut along a land, de-rotated, ours read 225 225
	// 227 229 233 235 — a 10-level dark rim recovering to the margin's own tone.
	// The reference reads 220 216 213 211 210 over the same five px, and once you
	// subtract the page's blur bleeding back across the cut (30 levels of step at
	// sigma 0.88 lifts the first sample by 8.5 and the second by 1.3) that flattens
	// to 212 215 213 211 210 — flat, with at most a 2-3 level rim. 0.93 was a 7%
	// rim; 0.975 puts it at 2.5%, which lands on the reference.
	albedo *= mix(0.975, 1.0, smoothstep(0.0, 0.010, sheet));

	vec3 N = normalize(vNormalV);
	vec3 V = normalize(-vViewPos);
	vec3 L = normalize(vLightViewPos - vViewPos);
	vec3 H = normalize(L + V);
	float ndv = clamp(dot(N, V), 0.0, 1.0);
	float ndh = clamp(dot(N, H), 0.0, 1.0);
	float ndl = clamp(dot(N, L), 0.0, 1.0);

	// --- fold shading -------------------------------------------------------
	// A bent sheet reads as bent because its normal turns away from the key
	// light. Without this the wave would only distort the artwork and the eye
	// would read it as a warp filter rather than as paper flexing.
	vec3 keyDir = normalize(vec3(-0.28, 0.62, 0.73));
	float key = 0.5 + 0.5 * dot(N, keyDir);
	// Wide on purpose. The geometry of a fold is only a few percent of the
	// sheet's size, so most of what sells it is the tonal break across it.
	// Centred so a FLAT sheet lands on 1.0 and keeps the surface colour the
	// caller asked for. Biased above it — as this was — a plain grey sheet
	// renders brighter than the page it is lying on, which is how a subtle
	// grey square ends up looking white.
	albedo *= mix(0.72, 1.06, key);

	// --- spot gloss ---------------------------------------------------------
	// UV varnish is applied over the ink, not over the bare paper, so the mask
	// follows the dark parts of the artwork. uGloss opens it out to the whole
	// sheet for the finishes that really are flooded.
	// Spot varnish sits on the ink, not the bare stock — which is exactly what
	// the reference's separate "print" canvas encodes. With artwork loaded the
	// mask follows its luminance; without, coverage just scales a flat sheen.
	// Read off the composited stock rather than the raw texture so the paper
	// margin masks as unprinted paper instead of picking up whatever texel the
	// clamp landed on at the edge of the print.
	float luminance = dot(stock, vec3(0.2126, 0.7152, 0.0722));
	float ink = mix(1.0 - luminance, 1.0, uGloss);
	float gloss = mix(mix(0.5, 1.0, uGloss), ink, uArtReady);

	// --- thin-film interference ---------------------------------------------
	// Optical path length through the film varies with thickness and with the
	// angle light takes through it. The angle term uses the half-vector rather
	// than the view vector, which is the opposite of the usual formulation and
	// is the whole trick here: on a sheet this flat the view angle is nearly
	// constant across the surface, so driving interference with it would leave
	// grain noise as the only source of variation — and that reads as banding,
	// not as foil. Against a light sitting just above the cursor the
	// half-vector sweeps a wide range over a short distance, which is what
	// produces smooth spectral rings that travel with the pointer.
	//
	// Grain is demoted to a small perturbation for the same reason: it should
	// be the brushed texture of the coating, not the thing generating the hue.
	// Grain and hue travel are kept on separate controls. Folding the grain
	// into film thickness couples them: raising filmScale to get a proper
	// rainbow sweep also multiplies the noise, and the surface breaks into
	// hard stripes. As an additive phase offset the grain stays a fixed, gentle
	// mottle — the brushed texture of the coating — whatever filmScale does.
	float grain = valueNoise(vec2(p.x * uGrain * 0.12, p.y * uGrain));
	// The coating responds to the pointer and fold normals, and stays still
	// once lifted paper has settled, matching the reference's carried surface.
	vec3 phase = TAU * uFilm * (0.35 + 0.65 * ndh) / LAMBDA + grain * 1.4;
	vec3 iris = 0.5 + 0.5 * cos(phase);

	float shininess = mix(14.0, 40.0, clamp(uSheenGain, 0.0, 1.5) / 1.5);
	float specular = pow(ndh, shininess) * ndl;
	// A second, much broader lobe so the sheen has a soft halo around the hot
	// spot rather than a single hard dot sliding over the surface. Kept low:
	// on a flat sheet this lobe barely falls off at all, so any real weight
	// here lands as a uniform veil that washes the contrast out of the
	// artwork instead of reading as a highlight.
	specular += pow(ndh, 3.0) * ndl * 0.07;

	float fresnel = pow(1.0 - ndv, 4.0);

	// Rest sheen keeps a touch device from seeing a dead surface; the cursor
	// term rides on top of it and is what the pointer actually drives.
	float reach = uRestSheen + uSheen * (1.0 - uRestSheen);
	// The spectrum is the reward for moving the cursor. Untying it from the
	// cursor would leave a resting stamp permanently washed in green and
	// magenta, which reads as a broken render rather than as varnish — so at
	// rest the coating is a near-neutral satin and the hue arrives with the
	// pointer.
	vec3 tint = mix(vec3(1.0), 0.38 + 1.24 * iris, 0.2 + 0.8 * uSheen);
	// Budgeted so a hot spot over a bright face lifts it without clipping:
	// everything past 1.0 is detail thrown away, and a blown-out highlight
	// loses the artwork it is supposed to be varnishing.
	//
	// The lift term is the reference's behaviour: a sheet lying on the page is
	// a pale satin, and picking it up ramps it to a fully saturated spectrum.
	// The carried boost is kept small. At 1.55x it put a headlight in the
	// middle of the sheet — the brightest thing on screen, and nothing like
	// the reference's restrained sweep.
	vec3 sheen = tint * specular * uSheenGain * gloss * reach * 0.46 * (1.0 + uLift * 0.2);
	sheen += tint * fresnel * 0.14 * gloss * reach;
	// Roll the highlight off rather than letting it clip. A varnish hot spot
	// over a bright face goes past 1.0 easily, and everything past 1.0 is
	// thrown away — the spectrum collapses to a flat white blob exactly where
	// the effect is supposed to be most legible.
	sheen = sheen / (1.0 + sheen);

	vec3 colour = albedo + sheen;

	// The lifted sheet catches a little more ambient light, the way anything
	// coming off a surface picks up the room.
	colour *= 1.0 + uLift * 0.02;
	// Curl shading: the parts the wave pushed toward the viewer read brighter.
	colour *= 1.0 + clamp(vHeight, -0.4, 0.4) * 0.28;

	gl_FragColor = vec4(colour, alpha);

	#include <colorspace_fragment>
}
`;

export interface PeelMaterialOptions {
	aspect: number;
	surfaceColor: THREE.ColorRepresentation;
	shape?: "stamp" | "surface";
}

/**
 * Builds the sheet material. Uniform values are placeholders — the scene writes
 * every frame-varying one from the motion model before the first render.
 */
export function createPeelMaterial({
	aspect,
	surfaceColor,
	shape = "stamp",
}: Readonly<PeelMaterialOptions>): THREE.ShaderMaterial {
	const slots = `${PEEL_IMPULSE_SLOTS}`;

	return new THREE.ShaderMaterial({
		vertexShader: vertexShader.replace(/IMPULSE_SLOTS/gu, slots),
		fragmentShader: fragmentShader.replace("SILHOUETTE_CHUNK", PEEL_SILHOUETTE_GLSL),
		transparent: true,
		// The sheet is the only transparent thing in front of the shadow quad
		// and never overlaps itself, so skipping depth writes avoids sorting
		// artefacts along the die-cut edge without costing correctness.
		depthWrite: false,
		side: THREE.DoubleSide,
		uniforms: {
			uAspect: { value: aspect },
			uSurface: { value: new THREE.Color(surfaceColor) },
			uArt: { value: null },
			uArtReady: { value: 0 },
			uSurfaceMode: { value: shape === "surface" ? 1 : 0 },
			uFlashColor: { value: new THREE.Color() },
			uFlashGain: { value: 0 },
			uFlashProgress: { value: 0 },

			uLift: { value: 0 },
			uImpulses: {
				value: Array.from({ length: PEEL_IMPULSE_SLOTS }, () => new THREE.Vector4(0, 0, 0, 0)),
			},
			uWave: { value: new THREE.Vector3(0.16, 0.62, 1.9) },
			uFlutter: { value: 0.05 },
			uShear: { value: 1.6 },
			uSpeed: { value: 0 },
			uTime: { value: 0 },
			uPointer: { value: new THREE.Vector2(0.5, 0.5) },

			uFilm: { value: 2.3 },
			uGloss: { value: 0.35 },
			uSheenGain: { value: 1 },
			uGrain: { value: 34 },
			uRestSheen: { value: 0.18 },
			uSheen: { value: 0 },
		},
	});
}
