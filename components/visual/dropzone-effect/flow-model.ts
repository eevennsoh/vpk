import { lerp } from "@/lib/math";

/**
 * The river, as pure math.
 *
 * A sticker's whole journey is a closed-form function of one number: `u`, its
 * normalised progress from spawn to swallowed. Nothing is integrated frame to
 * frame, so the motion cannot drift, cannot explode, is identical at any frame
 * rate, and is trivially testable off-screen.
 *
 * The path is a log spiral into the orb, the shape the reference uses for its
 * drain:
 *
 *   r(u)     = r0 * (1 - (LEAN*u + (1 - LEAN)*u^JET))   a lean, then a jet
 *   theta(u) = theta0 + w * ln(r0 / r)                  same sign for everyone
 *
 * `ln(r0 / r)` is near zero for most of the run and blows up in the last few
 * percent, which is exactly the behaviour we want: a long graceful drift, then
 * a sudden twist into the drain.
 */


// ---------------------------------------------------------------------------
// Tuning
//
// These live here rather than in `tuning.ts` for two reasons: the river owns
// them, and Node's type-stripping test runner can only load a module with no
// runtime imports — keeping this file self-contained is what makes the motion
// contract testable at all.
// ---------------------------------------------------------------------------

/**
 * Resolved, viewport-dependent layout. Everything downstream reads these
 * instead of recomputing fractions.
 */
export interface DropzoneLayout {
	width: number;
	height: number;
	/** Camera distance that makes 1 world unit === 1 CSS px at z = 0. */
	cameraDistance: number;
	/** Orb centre in world space (z is always 0 — the orb defines the focal plane). */
	orbX: number;
	orbY: number;
	orbRadius: number;
	/** Half the viewport diagonal; the unit the spawn radius is expressed in. */
	halfDiagonal: number;
	stickerCount: number;
	stickerSizeMin: number;
	stickerSizeMax: number;
	depthNear: number;
	depthFar: number;
	starCount: number;
	starDepthNear: number;
	starDepthFar: number;
}

/**
 * Spawn radius, as a multiple of the distance from the orb to the viewport
 * edge *along the sticker's own bearing* — not of the half-diagonal.
 *
 * This matters more than it looks. A fixed multiple of the half-diagonal puts
 * a sticker spawning toward a short edge far further out than one spawning
 * toward a corner, and with `r = r0 (1 - u^2)` the excess is spent entirely
 * off-screen: at 1.06-1.62 half-diagonals, two thirds of every sticker's life
 * happened outside the frame. Measuring against the actual edge means a
 * sticker is on screen for nearly its whole run, which is what makes the river
 * read as continuous rather than as a trickle.
 */
export const SPAWN_RADIUS_MIN = 1.04;
export const SPAWN_RADIUS_MAX = 1.34;

/**
 * Spawn sector, in degrees, measured from the orb with 0 deg = screen right and
 * 90 deg = screen up.
 *
 * Narrow on purpose. A wide sector plus radial convergence produces an evenly
 * scattered field with black between every sticker; the reference is a *band* —
 * stickers nearly touching along one diagonal, with empty frame either side.
 * Width comes from the wander and from the strays, not from the sector.
 */
export const SPAWN_ANGLE_MIN = 14;
export const SPAWN_ANGLE_MAX = 74;
/** Pull of the sector toward its middle; 1 = uniform, >1 = clustered into a band. */
export const SPAWN_ANGLE_BIAS = 1.25;

/**
 * Radial profile: `r = r0 * (1 - (LEAN * u + (1 - LEAN) * u^JET))`.
 *
 * The reference documents `r = r0 (1 - u^2)` — a lean, then a jet. That is
 * right for its 0.3-0.6 s panic drain but wrong for a river, and the reason is
 * density: in a converging flow the on-screen population at radius r goes as
 * `N / v(r)`, so an 8x end-of-run acceleration thins the mid-field by 8x and
 * hollows a void around the orb.
 *
 * Pushing the exponent to 4 and raising the linear term keeps the same
 * silhouette — a long even drift, then a sudden jet — while cutting the
 * density falloff to about 4x, which is what keeps the frame populated all the
 * way in.
 */
export const RADIAL_LEAN = 0.68;
export const RADIAL_JET_POWER = 4;

/**
 * Log-spiral winding: `theta = theta0 + w * ln(r0 / r)`. Same sign for every
 * sticker, so the whole river sweeps as one stream instead of scrambling.
 * The reference uses 0.42 - 0.72 for its panic drain; a continuous river wants
 * a gentler bend, with the tightening left to the `ln` blow-up at the very end.
 */
export const WINDING_MIN = 0.3;
export const WINDING_MAX = 0.58;

/** Seconds for one sticker to travel from spawn to swallowed. */
export const TRAVEL_DURATION_MIN = 5.2;
export const TRAVEL_DURATION_MAX = 9.4;

/** Final scale as a fraction of the sticker's own size (reference: 12 %). */
export const SWALLOW_SCALE = 0.12;

/**
 * Fraction of stickers that take the scenic route: a much wider spiral and a
 * longer run, so they arc around the periphery before coming in. The reference
 * calls these strays and gives them 1.8x the spread; without them the frame
 * outside the main band is dead, and the river reads as a single thread.
 */
export const STRAY_CHANCE = 0.2;
export const STRAY_WINDING_GAIN = 2.3;
export const STRAY_DURATION_GAIN = 1.45;

/** Wander amplitude in px, windowed at both ends of the run. */
export const WANDER_AMPLITUDE = 165;
/** Spatial frequency of the wander field, in 1/px. */
export const WANDER_FREQUENCY = 0.0016;
/** How fast the wander field itself evolves, in 1/s. */
export const WANDER_SPEED = 0.075;
/** Fraction of the run over which the wander ramps in from nothing. */
export const WANDER_RAMP_U = 0.16;

// ---------------------------------------------------------------------------
// Tumble
// ---------------------------------------------------------------------------

/**
 * Idle tumble rates, rad/s. Deliberately slow: measured off the reference, a
 * sticker turns roughly 8-15 deg per second, and the documented plume settles
 * into a 0.09 rad/s rock. Fast spin reads as confetti, not as stickers.
 */
export const TUMBLE_RATE_MIN = 0.1;
export const TUMBLE_RATE_MAX = 0.42;

/**
 * Hard limit on how far a sticker may tilt away from the camera, in degrees.
 * A die-cut sticker is flat; letting it go fully edge-on makes it vanish for a
 * frame. Staying inside this cone keeps the "catches light as it turns" read
 * without the disappearing act — and matches the reference, where no sticker
 * ever flips.
 */
export const TUMBLE_TILT_LIMIT = 58;

/** Extra spin as the drain takes hold: `SPIN_UP * u^2` rad/s^2 (reference: 26). */
export const SPIN_UP = 26;

/** Speed, in px/s, past which a sticker starts to smear along its heading. */
export const SMEAR_SPEED_THRESHOLD = 450;
/** Peak stretch along heading, and the matching thinning across it. */
export const SMEAR_STRETCH_MAX = 1.9;
export const SMEAR_THIN_MIN = 0.58;

const DEG = Math.PI / 180;
/** Sticker fades out inside this many orb radii, so nothing pops at the drain. */
const FADE_RADII = 0.55;
/**
 * Shrink to `SWALLOW_SCALE` starts this many orb radii out. The reference's
 * 5.9 R is measured against an orb that fills a fifth of a phone's width; at
 * our proportions that same figure starts the shrink a third of the frame away
 * and hollows a visible ring of miniatures around the sink.
 */
const SHRINK_RADII = 2.4;
/** Clamp on the inverse-square orb light, so it saturates instead of dividing by zero. */
const LIGHT_FLOOR_RADII = 0.55;
/** Finite-difference step for velocity, in seconds. */
const VELOCITY_DT = 1 / 60;

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Deterministic PRNG, so a seeded scene replays identically in tests. */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** One sticker's immutable trip plan. Regenerated when it is swallowed. */
export interface StickerSeed {
	/** Spawn distance from the orb, px. */
	radius: number;
	/** Spawn bearing from the orb, rad. 0 = screen right, +pi/2 = screen up. */
	angle: number;
	/** Log-spiral winding `w`. */
	winding: number;
	/** Seconds from spawn to swallowed. */
	duration: number;
	/** Scene time at which `u` was 0. */
	startTime: number;
	/** Spawn depth, world z. Converges to 0 (the orb plane) on arrival. */
	depth: number;
	/** On-screen size at the focal plane, px. */
	size: number;
	/** Index into the sticker atlas. */
	kind: number;
	/** In-plane spin rate, rad/s. Signed. */
	spinRate: number;
	spinPhase: number;
	/** Out-of-plane wobble: amplitude in rad, rate in rad/s, and a phase. */
	wobbleAmpX: number;
	wobbleAmpY: number;
	wobbleRateX: number;
	wobbleRateY: number;
	wobblePhaseX: number;
	wobblePhaseY: number;
	/** Decorrelates this sticker's wander from its neighbours'. */
	wanderPhase: number;
	/** Per-sticker holographic film thickness bias. */
	holoBias: number;
}

/** One sticker's state at one instant. */
export interface StickerFrame {
	x: number;
	y: number;
	z: number;
	/** Progress, 0 at spawn and 1 at the drain. */
	u: number;
	/** Multiplier on `seed.size` (the swallow shrink). */
	scale: number;
	opacity: number;
	/** Screen-plane speed, px/s. */
	speed: number;
	/** Screen-plane direction of travel, rad. */
	heading: number;
	/** Motion-smear along and across `heading`. */
	smearAlong: number;
	smearAcross: number;
	/** In-plane spin, rad. */
	spin: number;
	/** Out-of-plane tilt about the screen X and Y axes, rad. */
	tiltX: number;
	tiltY: number;
	/** Orb illumination on this sticker, 0-1, inverse-square. */
	orbLight: number;
}

/** `r / r0` at progress `u`. Monotonic, 1 at u=0, 0 at u=1. */
export function radiusFraction(u: number): number {
	const clamped = clamp01(u);
	return 1 - (RADIAL_LEAN * clamped + (1 - RADIAL_LEAN) * clamped ** RADIAL_JET_POWER);
}

/**
 * Smooth, non-repeating wander. Three sinusoids on incommensurate frequencies
 * beat curl noise here: it is branch-free, allocation-free, exactly
 * reproducible, and at this amplitude the difference is invisible.
 */
function wander(x: number, y: number, time: number, phase: number): [number, number] {
	const fx = x * WANDER_FREQUENCY;
	const fy = y * WANDER_FREQUENCY;
	const t = time * WANDER_SPEED;
	const ox =
		Math.sin(fy * 1.0 + t * 1.13 + phase) * 0.6 +
		Math.sin(fy * 2.31 - t * 0.71 + phase * 2.7) * 0.28 +
		Math.sin(fx * 1.77 + t * 1.61 + phase * 4.1) * 0.12;
	const oy =
		Math.cos(fx * 1.09 - t * 0.97 + phase * 1.9) * 0.6 +
		Math.cos(fx * 2.13 + t * 1.37 + phase * 3.3) * 0.28 +
		Math.cos(fy * 1.51 - t * 0.83 + phase * 5.7) * 0.12;
	return [ox, oy];
}

/**
 * Screen-plane position at progress `u`, before perspective. Split out so
 * `sampleFlow` can call it twice and difference the result for velocity.
 */
function positionAt(
	seed: StickerSeed,
	layout: DropzoneLayout,
	u: number,
	time: number,
): [number, number, number] {
	const fraction = Math.max(radiusFraction(u), 1e-4);
	const radius = seed.radius * fraction;
	const angle = seed.angle + seed.winding * -Math.log(fraction);

	let x = layout.orbX + radius * Math.cos(angle);
	let y = layout.orbY + radius * Math.sin(angle);

	// The wander is windowed at both ends. It fades out toward the drain so
	// arrival is exact, and it fades *in* over the first stretch because at full
	// strength it can displace a sticker by more than its off-screen margin and
	// pop it into frame — the spawn point has to be the spiral's, untouched.
	const progress = clamp01(u);
	const strength =
		WANDER_AMPLITUDE *
		smoothstep(clamp01(progress / WANDER_RAMP_U)) *
		(1 - progress) ** 1.25;
	if (strength > 0.01) {
		const [ox, oy] = wander(x, y, time, seed.wanderPhase);
		x += ox * strength;
		y += oy * strength;
	}

	// Depth has to reach zero at the drain — the orb defines the focal plane —
	// but it must not get there early. A `(1 - u)` decay is already 74 % gone by
	// the time a sticker is on screen, which flattens the field and takes the
	// depth-of-field and the perspective size spread with it.
	return [x, y, seed.depth * (1 - clamp01(u) ** 2.4)];
}

/**
 * Distance from the orb to the viewport edge along `angle`, in world units at
 * the focal plane. Spawning against this rather than against the half-diagonal
 * is what keeps a sticker on screen for its whole run — see `SPAWN_RADIUS_MIN`.
 */
export function edgeDistance(layout: DropzoneLayout, angle: number): number {
	const dx = Math.cos(angle);
	const dy = Math.sin(angle);
	const halfWidth = layout.width / 2;
	const halfHeight = layout.height / 2;
	const toX =
		Math.abs(dx) < 1e-6
			? Number.POSITIVE_INFINITY
			: ((dx > 0 ? halfWidth : -halfWidth) - layout.orbX) / dx;
	const toY =
		Math.abs(dy) < 1e-6
			? Number.POSITIVE_INFINITY
			: ((dy > 0 ? halfHeight : -halfHeight) - layout.orbY) / dy;
	return Math.min(toX, toY);
}

/** Builds a fresh trip plan. `now` is the scene time the sticker starts at. */
export function createSeed(
	rng: () => number,
	layout: DropzoneLayout,
	now: number,
	kindCount: number,
): StickerSeed {
	// Bias the bearing toward the middle of the sector so the river reads as a
	// band rather than an even ring.
	const centred = (rng() + rng() + rng()) / 3;
	const biased = 0.5 + (centred - 0.5) * (2 / SPAWN_ANGLE_BIAS);
	const angle = lerp(SPAWN_ANGLE_MIN, SPAWN_ANGLE_MAX, clamp01(biased)) * DEG;

	// Skew sizes small: a few hero stickers, many small ones, which is what
	// gives the field its depth.
	const sizeMix = rng() ** 1.55;
	// A true tumble needs two axes, but a flat die-cut that reaches edge-on
	// vanishes for a frame. So: unbounded spin in the sticker's own plane, plus
	// a *bounded* out-of-plane wobble. The two amplitudes are budgeted against
	// `TUMBLE_TILT_LIMIT` together, so the worst-case combined tilt still keeps
	// the face toward the camera — which is also what the reference does.
	const tiltBudget = ((TUMBLE_TILT_LIMIT * DEG) / Math.SQRT2) * (0.45 + rng() * 0.55);
	const split = 0.25 + rng() * 0.5;

	const depth = lerp(layout.depthFar, layout.depthNear, rng());
	// A sticker at depth `z` projects to `camDist / (camDist - z)` of its world
	// radius. Undoing that here means "just past the edge of frame" is true at
	// every depth: without it, far stickers spawn already on screen and near
	// ones start a screen and a half away.
	const perspective = (layout.cameraDistance - depth) / layout.cameraDistance;

	const stray = rng() < STRAY_CHANCE;

	return {
		radius:
			edgeDistance(layout, angle) *
			lerp(SPAWN_RADIUS_MIN, SPAWN_RADIUS_MAX, rng()) *
			perspective,
		angle,
		winding: lerp(WINDING_MIN, WINDING_MAX, rng()) * (stray ? STRAY_WINDING_GAIN : 1),
		duration:
			lerp(TRAVEL_DURATION_MIN, TRAVEL_DURATION_MAX, rng()) *
			(stray ? STRAY_DURATION_GAIN : 1),
		startTime: now,
		depth,
		size: lerp(layout.stickerSizeMin, layout.stickerSizeMax, sizeMix),
		kind: Math.min(kindCount - 1, Math.floor(rng() * kindCount)),
		spinRate: lerp(TUMBLE_RATE_MIN, TUMBLE_RATE_MAX, rng()) * (rng() < 0.5 ? -1 : 1),
		spinPhase: rng() * Math.PI * 2,
		wobbleAmpX: tiltBudget * split,
		wobbleAmpY: tiltBudget * (1 - split),
		wobbleRateX: lerp(0.18, 0.55, rng()) * (rng() < 0.5 ? -1 : 1),
		wobbleRateY: lerp(0.18, 0.55, rng()) * (rng() < 0.5 ? -1 : 1),
		wobblePhaseX: rng() * Math.PI * 2,
		wobblePhaseY: rng() * Math.PI * 2,
		wanderPhase: rng() * Math.PI * 2,
		holoBias: rng(),
	};
}


/** Progress of a seed at a given scene time. Values >= 1 mean "swallowed". */
export function progressOf(seed: StickerSeed, time: number): number {
	return (time - seed.startTime) / seed.duration;
}

/** Everything the renderer needs about one sticker at one instant. */
export function sampleFlow(
	seed: StickerSeed,
	layout: DropzoneLayout,
	time: number,
	out: StickerFrame,
): StickerFrame {
	const u = clamp01(progressOf(seed, time));
	const [x, y, z] = positionAt(seed, layout, u, time);

	// Velocity by central-ish difference: correct even with wander mixed in,
	// and one extra evaluation is far cheaper than an analytic derivative of
	// the spiral-plus-noise composite.
	const ahead = Math.min(1, u + VELOCITY_DT / seed.duration);
	const [nx, ny] = positionAt(seed, layout, ahead, time + VELOCITY_DT);
	const dx = nx - x;
	const dy = ny - y;
	const step = Math.hypot(dx, dy);
	const speed = step / VELOCITY_DT;

	const radius = Math.hypot(x - layout.orbX, y - layout.orbY);
	const shrinkK = smoothstep(clamp01(1 - radius / (layout.orbRadius * SHRINK_RADII)));
	const over = clamp01((speed - SMEAR_SPEED_THRESHOLD) / SMEAR_SPEED_THRESHOLD);

	// Inverse-square illumination from the orb. This — not a keyframe — is what
	// makes the light catch an object right before it is swallowed.
	const lightRadius = Math.max(radius, layout.orbRadius * LIGHT_FLOOR_RADII);
	const orbLight = clamp01((layout.orbRadius / lightRadius) ** 2);

	out.x = x;
	out.y = y;
	out.z = z;
	out.u = u;
	out.scale = lerp(1, SWALLOW_SCALE, shrinkK);
	out.opacity = smoothstep(clamp01(radius / (layout.orbRadius * FADE_RADII) - 0.05));
	out.speed = speed;
	out.heading = step > 1e-5 ? Math.atan2(dy, dx) : 0;
	out.smearAlong = lerp(1, SMEAR_STRETCH_MAX, over);
	out.smearAcross = lerp(1, SMEAR_THIN_MIN, over);
	// Idle spin plus the drain's spin-up. The spin-up is integrated in closed
	// form: the integral of SPIN_UP * u^2 over the run is SPIN_UP * u^3 * T / 3.
	const elapsed = time - seed.startTime;
	// The drain's spin-up is integrated in closed form: the integral of
	// SPIN_UP * u^2 over the run is SPIN_UP * u^3 * T / 3.
	const spinUp = Math.sign(seed.spinRate) * ((SPIN_UP * u * u * u * seed.duration) / 3);
	out.spin = seed.spinPhase + seed.spinRate * elapsed + spinUp;
	out.tiltX = Math.sin(elapsed * seed.wobbleRateX + seed.wobblePhaseX) * seed.wobbleAmpX;
	out.tiltY = Math.sin(elapsed * seed.wobbleRateY + seed.wobblePhaseY) * seed.wobbleAmpY;
	out.orbLight = orbLight;
	return out;
}

/** A zeroed frame, for reuse across ticks (this runs per sticker per frame). */
export function createFrame(): StickerFrame {
	return {
		x: 0,
		y: 0,
		z: 0,
		u: 0,
		scale: 1,
		opacity: 1,
		speed: 0,
		heading: 0,
		smearAlong: 1,
		smearAcross: 1,
		spin: 0,
		tiltX: 0,
		tiltY: 0,
		orbLight: 0,
	};
}
