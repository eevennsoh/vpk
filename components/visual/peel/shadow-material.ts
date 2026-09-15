/**
 * Peel — the contact shadow.
 *
 * A quad sitting on the page plane, behind the sheet. It reuses the sheet's own
 * signed-distance silhouette, which buys two things: the shadow is perforated
 * exactly like the stamp is, and the softening is free. A blurred shadow is
 * normally a multi-tap blur of an alpha mask, but with a real distance field on
 * hand the penumbra is a closed-form falloff of the distance — exact at any
 * radius, and the same cost whether the sheet is flat or fully peeled.
 *
 * It is two shadows summed, because the reference is two shadows. Profiling the
 * reference's page darkening per side, per pixel of distance, at rest and while
 * carried, the difference between the two states does not fit any single
 * widening term: what fits, to within 1-2 levels on four independent sides, is a
 * fixed CONTACT term (no lift dependence, exponential, gone by 10px) plus a CAST
 * term that is absent at rest and slides down-right as the sheet separates.
 *
 * The one thing the reference never shows is a plateau. On every side, at every
 * frame measured, the profile decays monotonically from the edge — the shadow's
 * solid core stays hidden under the sheet and only penumbra escapes. Anything
 * that exposes flat alpha outside the silhouette reads as a grey card, not a
 * shadow; this shader used to scale its silhouette to 110% on lift and did
 * exactly that, exposing a 226x292px slab around a 200x263px stamp.
 *
 * The same monotonicity has to hold THROUGH the die-cut. A notch is 4 device px
 * of page surrounded by paper on three sides, and the reference darkens it to
 * about half of the land beside it, falling outward the whole way: 31.7 / 21.4 /
 * 14.4 / 12.3 / 7.2 levels across the notch and out. Two separate mistakes here
 * broke that — a correction that emptied the notches to page white, and a
 * distance field that got shallower as it left one — and between them they put a
 * bead chain and a second contour around the entire silhouette. See
 * shadowField() and contactField below; ours now reads 22.0 / 16.1 / 13.7 /
 * 12.0 / 11.0 over the same span.
 *
 * Do not put a backtick anywhere in the template literal below — see the note
 * in peel-material.ts.
 */

import * as THREE from "three";

import { PEEL_CAMERA_DISTANCE } from "./data";
import { PEEL_SILHOUETTE_GLSL } from "./peel-material";
import { PEEL_REST_TILT_Y } from "./peel-model";

/**
 * Quad padding as a fraction of the sheet, per side. Has to comfortably exceed
 * the widest penumbra plus the furthest offset or the shadow clips square.
 *
 * Worst case is straight down under the hand at full lift: the seam follows the
 * sheet's own projection, which magnifies the grabbed corner by 1.079, so the
 * silhouette itself reaches 0.0395 past the die-cut there; add the cast term's
 * 0.0389 offset and its 0.062 blur and the total is 0.140 sheet-heights. On the
 * x axis the pad is scaled by the aspect, so 0.20 buys 0.152 against a 0.108
 * reach. It was 0.15, a 1.06x margin on the tighter axis once the seam started
 * tracking the projection — too close to clipping the penumbra square.
 */
export const PEEL_SHADOW_PAD = 0.2;

const vertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float uAspect;
uniform float uPad;
uniform float uLift;
uniform float uLiftHeight;
uniform float uPivot;
uniform vec2 uGrab;
uniform float uStrength;
uniform vec3 uColour;

varying vec2 vUv;

/** Camera distance to the page plane, in sheet-heights. PEEL_CAMERA_DISTANCE. */
const float CAMERA_DISTANCE = ${PEEL_CAMERA_DISTANCE.toFixed(5)};
/** sin() of the sheet's resting out-of-plane tilt. PEEL_REST_TILT_Y. */
const float REST_TILT = ${Math.sin(PEEL_REST_TILT_Y).toFixed(5)};

SILHOUETTE_CHUNK

/**
 * Distance to the paper, positive inside — sheetDistance() with an exterior
 * that is a true distance instead of the min() of a rectangle and a circle.
 *
 * Inside the rectangle that min() is exact, bites included. Outside it, it is
 * not: on the axis of a bite it reads -PERF_RADIUS on the edge line, then only
 * -1.9px half a radius further out, because the circle term stops dominating
 * and the rectangle takes over. The field gets SHALLOWER as the sample leaves
 * the notch, so the shadow grows a dark crescent two pixels outside every bite.
 * Profiled at rest along the bottom edge, ours read 13.0 / 16.1 / 18.0 levels at
 * d = 0 / 1 / 2 out from the die-cut envelope — a second contour outside the
 * first, and non-monotonic — where the reference falls 14.4 / 12.3 / 7.2.
 *
 * Outside the rectangle the nearest paper is either straight in (a sample
 * beside a land) or the corner where the flanking land meets the edge line (a
 * sample out in front of a bite). Both are length(vec2(mouth, away)), where
 * mouth is how far inside the bite's own span along the edge the sample sits.
 * That is exact for this geometry, and on the edge line it agrees with
 * sheetDistance() bite for bite, so the two halves meet without a step.
 */
float shadowField(vec2 p) {
	vec2 extent = vec2(uAspect, 1.0) * 0.5;
	vec2 q = abs(p) - extent;

	float cellX = uAspect / PERF_COLUMNS;
	float cellY = 1.0 / PERF_ROWS;
	float alongX = perfCell(p.x + extent.x, PERF_COLUMNS, cellX);
	float alongY = perfCell(p.y + extent.y, PERF_ROWS, cellY);

	vec2 away = max(q, 0.0);

	// Half-chord of the bite the sample stands in front of, and only for the
	// pair of edges it is actually outside of: the steps switch each term off
	// unless the sample is past that edge and still within the other axis.
	float mouthX = max(PERF_RADIUS - abs(alongX), 0.0) * step(q.x, 0.0) * step(0.0, q.y);
	float mouthY = max(PERF_RADIUS - abs(alongY), 0.0) * step(q.y, 0.0) * step(0.0, q.x);

	return max(q.x, q.y) < 0.0
		? sheetDistance(p)
		: -length(away + vec2(mouthX, mouthY));
}

/**
 * Height of the sheet above the page, in sheet-heights, at the page point the
 * sheet projects onto. This is peel-material's own bulk displacement, repeated
 * here rather than shared, because the two shaders disagree about what they are
 * given: the sheet evaluates it on a mesh vertex in the sheet's undeformed
 * frame, and this one has a point on the page and no mesh at all.
 *
 * Two terms, and both of them move the seam:
 *
 *   the peel — uLift * (uLiftHeight * raised + uPivot * (raised - 0.55)), with
 *   raised running 0.12 at the far corner to 1.0 under the hand. At the shipped
 *   tuning the grabbed corner stands 0.219 sheet-heights off the page and the
 *   far corner 0.002, so the sheet's projection is magnified 1.079 at one end
 *   of the same frame and 1.001 at the other.
 *
 *   the resting tilt — a rotation about the vertical axis puts the sheet's west
 *   edge REST_TILT nearer the camera and its east edge the same distance
 *   further, a linear height ramp in x that never switches off. See
 *   PEEL_REST_TILT_Y.
 *
 * Not reproduced: the wave, the flutter and the in-plane gather. They are
 * bending rather than bulk, they average to nothing across the sheet, and their
 * peak is a fifth of the peel's.
 */
float sheetHeight(vec2 p) {
	vec2 grab = (uGrab - 0.5) * vec2(uAspect, 1.0);
	float reach = sqrt(uAspect * uAspect + 1.0);
	float bias = 1.0 - smoothstep(0.0, reach, distance(p, grab));
	float raised = mix(0.12, 1.0, bias * bias);
	return uLift * (uLiftHeight * raised + uPivot * (raised - 0.55)) - p.x * REST_TILT;
}

void main() {
	// The quad is larger than the sheet, so undo the padding to land back in
	// the sheet space the silhouette function expects.
	vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * (1.0 + 2.0 * uPad);

	float lift = clamp(uLift, 0.0, 1.0);

	// Where the sheet's projected outline sits, as a displacement of the sample
	// point. A point standing h off the page projects out from the sheet's
	// centre by CAMERA_DISTANCE / (CAMERA_DISTANCE - h), so the page point p is
	// covered by the sheet point p * (1 - h / CAMERA_DISTANCE); this is that
	// second factor written as a shift, so the silhouette is still translated
	// and never scaled by a figure of its own.
	//
	// This replaces a single constant dilation of 0.0159 — half the sheet's MEAN
	// linear growth — and the two are not close. The growth is not uniform: the
	// grabbed corner grows 7.9% and the far corner 0.1%, and the flat dilation
	// split the difference everywhere, which left the seam 9 device px inside
	// the paper under the hand and 4 px outside it at the far end. Profiled on
	// the live route that showed up as a carried sheet whose darkest shadow had
	// slid off the bottom edge into the bottom-right corner (S 20.0 levels
	// against SE 42.0, where the reference holds S 38.5 against SE 28.3): with
	// the seam buried under the lifted end, the first page pixel outside the
	// paper there was already several pixels down the falloff.
	//
	// The resting tilt did the same thing at rest, on the other axis. It leans
	// the sheet about its vertical, which pulls the east edge 0.9 device px in
	// and pushes the west edge 0.65 px out; against a fixed seam that exposed
	// near-peak contact on the east and buried it on the west, and our rest
	// profile came out backwards — east 11.6 levels against west 8.2, where the
	// reference and this shader's own facing() both want west the darker side.
	vec2 seam = p * (sheetHeight(p) / CAMERA_DISTANCE);

	// The lift spring is underdamped (zeta 0.62), so setting the sheet down
	// undershoots past flat before settling — uLift reaches about -0.12 a
	// quarter-period after touchdown. That is the impact, and it is free: read
	// it here as a compression term instead of clamping it away. The reference's
	// landing frame is 14-22% darker at the seam than its own resting frame on
	// every edge, with the shadow tucked up under the sheet; ours used to go the
	// other way, 18-25% LIGHTER than rest, because the lifted shadow simply
	// faded down through rest. A sheet that loses contact as it touches the page
	// reads as dissolving in mid-air.
	float squash = max(-uLift, 0.0);
	// 2.6 x the undershoot. The lift spring's own step overshoot is 8.4%, but a
	// release taken mid-drag rather than from a fully settled lift undershoots
	// 6.1% — simulated end to end, and the same either way — so 2.6 puts the
	// seam 16% darker than rest at the peak, inside the measured 14-22%. It
	// rides the lift spring, so its timing needs no constant of its own.
	float impact = 1.0 + 2.6 * squash;

	// 1 sheet-height = 263 device px on the reference recording and 277 on the
	// live route at the zoom every number below was profiled at (the land-edge
	// envelope of the die-cut, fitted the same way on both, so ratios and
	// falloff lengths transfer even though the two stamps differ 5% in size).

	// CONTACT. The dark seam where the sheet meets the page. It does not widen
	// with lift, and — measured, against the first thing you would try — it has
	// no offset either. A rigidly offset silhouette would hold near peak for the
	// length of the offset and only then decay; the reference's rest profile
	// below the edge falls from its first pixel (29.0 17.6 10.6 7.8 5.3 ...), so
	// the shadow's edge is under the die-cut on every side. What is asymmetric
	// is its amplitude, not its position.
	//
	// The seam rides the sheet's projection — see the derivation of the seam
	// displacement above. It used to ride a single constant, half the sheet's
	// MEAN linear growth, which is right nowhere on a sheet held by one corner.
	//
	// What used to be here as well: a 0.0105 push applied wherever the sample
	// sat inside the un-bitten body, meant to keep the notches from pooling
	// shadow. It emptied them instead — profiled at rest, our notch interiors
	// read 8.0 / 6.6 levels at d = -2 / -1 against the reference's 31.7 / 21.4,
	// a chain of page-white beads around the whole die-cut — and its own rim was
	// the step that let the crescent in shadowField() show. The corrected
	// exterior distance makes both unnecessary.
	float contactField = shadowField(p - seam);

	// Contact amplitude by direction. Fitted, not reasoned, and fitted on eight
	// compass sectors rather than four sides — the four-side fit that came
	// before it was blind to the corners, which is where the whole error was.
	//
	// Estimator: warm-pixel silhouette, span-filled per row, a 3/4 chamfer
	// distance outward from it, then the MEDIAN page darkening per (45-degree
	// sector x distance ring), so the reference's mouse cursor cannot move a
	// number. Run identically over two reference rest frames far apart in the
	// clip (40 and 530, at different screen positions, agreeing inside 1.5
	// levels) and over the live route at the same 2 device px per CSS px.
	//
	// Reference rest at one pixel out, normalised to the bottom:
	//   S 1.000  SE 0.528  E 0.373  NE 0.311  N 0.075  NW 0.427  W 0.582  SW 0.639
	// Ours read S 1.000 SE 0.770 E 0.345 NE 0.042 N 0.038 NW 0.184 W 0.425
	// SW 0.912 — a tight lobe pointing south-south-east where the reference
	// carries a broad pedestal all the way round with one sharp notch at the
	// top. Both corner critiques ("no ambient contact wrap", "the corner loses
	// its contact anchor") were about that pedestal, and the old four-side fit
	// had put the two shallow corners at 0.009 and 0.130 of the bottom.
	//
	// The targets below are the reference's own readings, transferred by closing
	// the loop on the live route rather than by a model of the falloff: render,
	// profile, multiply each coefficient direction by reference/ours, refit.
	// Two passes converged. S 1.000, SE 0.437, E 0.344, NE 0.284, N 0.045,
	// NW 0.404, W 0.489, SW 0.549.
	//
	// The old basis — a quadratic in the vertical cosine plus a linear lean —
	// cannot fit that shape at all; least squares over the eight sectors leaves
	// rms 0.122, with the top corners 0.15 high and the bottom 0.19 low, because
	// one quadratic has to carry both the broad pedestal and the narrow notch.
	// Adding a cube separates them: the cube is flat through the middle of its
	// range and steep at both ends, which is exactly a sheet that is dark under
	// its whole perimeter and abruptly not above its top edge. rms 0.026 over
	// the same eight, worst residual 0.031 at the top-right corner.
	//
	// max() does engage now, in a narrow cap around straight up where the fit
	// runs to -0.036. Clamping there is the right behaviour and not a fudge: the
	// reference reads 2 levels above its top edge at rest and 2 held, which is
	// its own antialiased paper edge rather than shadow.
	float below = -p.y / max(length(p), 1e-4);
	float west = -p.x / max(length(p), 1e-4);
	float facing = max(
		0.4015 - 0.2746 * below + 0.1093 * below * below + 0.7657 * below * below * below
			+ 0.0794 * west,
		0.0
	);

	// CAST. Zero in contact, and it slides down-right as the sheet separates.
	// Held extents: x = (19.0 - 11.5) / 2 = +3.75px, y = (26.0 - 6.0) / 2 =
	// +10.0px -> (0.0156, -0.0389) at full lift. 10.8px at 69 degrees below
	// horizontal, consistent with the upper-left key light in peel-material.ts.
	//
	// The offset alone is not all the directionality this term needs. Held minus
	// rest on the reference, per compass sector at one pixel out (frames 280 and
	// 460), leaves a cast of S 10.0 SE 13.7 E 14.6 NE 12.6 N 0.0 NW 1.6 W 5.4
	// SW 5.8 levels. That lobe points EAST-south-east, not south: the sheet is
	// lit from the upper left, so what separation buys is shadow escaping on the
	// far side, and the offset (which is mostly downward) only accounts for part
	// of it. Refitted on the live route the same way facing was, closing the
	// loop rather than modelling it, the amplitudes come out S 0.585 SE 1.180
	// E 1.164 NE 0.808 N 0.000 NW 0.055 W 0.202 SW 0.294 — the same
	// quadratic-plus-lean shape as before with a much harder east lean, rms
	// 0.070 over the eight. It replaces 1.000 / 1.029 / 0.800 / 0.622 / 0.240 /
	// 0.132 / 0.310 / 0.683, which was fitted on four sides only and so had the
	// whole lobe a sector and a half too far south: measured against the
	// reference that ran the carried bottom 71% heavy and the carried east 31%
	// light at the same time.
	//
	// Note what is NOT here, twice over. The silhouette is sampled at sheet
	// scale: it used to be divided by 1.0 + uLift * 0.1, growing the shadow 10%
	// in every direction while the sheet itself grows 1%, which pushed 9.9px of
	// solid out of the sides and 12.9px out of the top and bottom. And the cast
	// offset is NOT modulated by the local height, which is the obvious next
	// idea and is wrong: the reference's carried penumbra reaches 12px past the
	// grabbed corner and 18px past the planted one (frames 280 / 460, grab
	// tracked at the stamp's bottom left in both). A height-driven offset would
	// invert that. The lit direction is fixed, so the cast slides the same way
	// everywhere and only the seam it starts from rides the sheet.
	float castField = shadowField(p - seam - lift * vec2(0.0156, -0.0389));
	float castFacing = max(
		0.6016 + 0.3223 * below - 0.1875 * below * below - 0.4734 * west
			- 0.2320 * below * west,
		0.0
	);

	// Contact falloff is exponential, not a smoothstep, and its length is
	// directional. Fitting ln(darkness) against distance on the reference at
	// rest gives 2.39px below the die-cut (29.0 17.6 10.6 7.8 5.3 over d = 1..5,
	// three frames) and 1.6px everywhere else — west runs 8.7 4.0 2.2 1.4 1.0,
	// about half per pixel where the bottom holds 0.66. 2.39 / 263 = 0.0091,
	// 1.6 / 263 = 0.0062. The bottom was 0.0106, fitted over d = 1..8 where the
	// reference's own quantisation floor flattens the tail; our render measured
	// 2.88 device px of falloff against the reference's 2.52 at the same scale.
	//
	// A smoothstep is wrong in either direction — smoothstep(-0.022, 0.0066)
	// predicts 1.00 .66 .39 .19 .07 .00 and is dead by 6px on a side that
	// measures .68 .44 .32 .27 .17 out to 11.
	//
	// min() on the argument holds it at exactly 1 inside the die-cut and keeps
	// exp() away from overflow out in the middle of the sheet.
	float contactLength = mix(0.0062, 0.0091, clamp(below, 0.0, 1.0));
	float contactTerm = exp(min(contactField, 0.0) / contactLength) * facing;

	// Cast penumbra. Four sides of the held reference independently put the
	// outward reach 15-16px past the geometric edge: S zero at 26px on a +10px
	// offset, E 19 on +4, W 11.5 on -4, N 6 on -10. 16.0 / 257 = 0.062. The
	// inner shoulder stays at 0.3 x that, since the cast term's core is under
	// the sheet and never visible.
	float castTerm = smoothstep(-0.062, 0.0186, castField) * lift * castFacing;

	// Summed, not mixed. uStrength is the contact amplitude at the bottom edge
	// and is the single authored knob; the cast amplitude is derived from it.
	//
	// 0.44 comes from the carried profile below the sheet, where the two terms
	// separate by distance. At one pixel out the contact term is at 29 levels
	// and the reference reads 43.5 (frames 280 / 400 / 470), which wants 0.405;
	// at eight pixels out the contact is down to 1.8 and the reference still
	// reads 18.3, which wants 0.478. The reference's cast is not flat the way a
	// blurred silhouette is — it climbs from about 15 levels at the edge to 20
	// three pixels out — so no single amplitude fits both ends, and 0.44 splits
	// the difference to within 1.3 levels at each.
	//
	// The lift spring overshoots past 1, hence the clamp on lift above:
	// extrapolating would drive the shadow darker than the measurement. Its
	// undershoot past 0 is not thrown away though — impact is that same
	// overshoot, read on the other side, and it only ever multiplies the contact
	// term because the cast term is already scaled by a lift of zero there.
	float opacity = uStrength * impact * contactTerm + uStrength * 0.44 * castTerm;

	gl_FragColor = vec4(uColour, min(opacity, 1.0));

	#include <colorspace_fragment>
}
`;

export interface PeelShadowMaterialOptions {
	aspect: number;
}

export function createPeelShadowMaterial({
	aspect,
}: Readonly<PeelShadowMaterialOptions>): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		vertexShader,
		fragmentShader: fragmentShader.replace("SILHOUETTE_CHUNK", PEEL_SILHOUETTE_GLSL),
		transparent: true,
		depthWrite: false,
		uniforms: {
			uAspect: { value: aspect },
			uPad: { value: PEEL_SHADOW_PAD },
			uLift: { value: 0 },
			// The peel's shape, mirrored from the sheet material so the seam can
			// sit under the sheet's projected outline rather than under a
			// sheet-wide average of it. The scene writes all three from the same
			// tuning and state it writes the sheet's from.
			uLiftHeight: { value: 0 },
			uPivot: { value: 0 },
			uGrab: { value: new THREE.Vector2(0.5, 0.5) },
			uStrength: { value: 0.193 },
			// Neutral with a whisper of warmth, and measured rather than
			// reasoned. Mean per-channel darkening under the reference over
			// d = 8..24px, 5 frames, n = 1507: R 11.00 G 11.05 B 11.26, a ratio
			// of 0.977 : 0.981 : 1.000 — it absorbs 2% more blue than red.
			// (1 - C) for this colour is 0.900 : 0.904 : 0.922 = 0.976 : 0.980 :
			// 1.000. Only the ratio matters; scale all three together to nudge
			// the level.
			//
			// This was (0.05, 0.06, 0.10), a cool shadow argued for on the
			// grounds that the fill comes from the sky; it measured 1.090 :
			// 1.090 : 1.000, the opposite sign. The fill on this page is bounce
			// off warm cream paper, not sky. Authored in sRGB and converted,
			// because this shader tone-maps on output the same way the sheet
			// does — leaving one of the two unconverted is the kind of mismatch
			// that only shows up as "the shadow went grey" after someone edits
			// the other.
			uColour: { value: new THREE.Color(0.1, 0.096, 0.078).convertSRGBToLinear() },
		},
	});
}
