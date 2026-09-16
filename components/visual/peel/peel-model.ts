/**
 * Peel — the motion model.
 *
 * Pure state plus pure steppers: no React, no three, no DOM. The scene owns a
 * single instance, calls the verbs from pointer handlers, and calls `stepPeel`
 * once per frame before copying the result into shader uniforms and one DOM
 * transform. Keeping it separable is what makes the feel testable — the
 * contract suite drives a whole grab/drag/release cycle without a browser.
 *
 * Units are deliberately mixed and each field says which it uses:
 *   - `x` / `y` are CSS pixels, because they come from pointer deltas and end
 *     up in a `translate3d` on the lift element;
 *   - `lift`, `sheen` and impulse energies are normalised 0-1 weights that the
 *     scene scales by the tuning;
 *   - `tiltX` / `tiltY` are radians, applied to the mesh, and `swing` and `skew`
 *     are radians too but in-plane, applied to the DOM transform beside the
 *     sheet's resting angle.
 *
 * The only thing this module takes from `data.ts` is a type, deliberately: a
 * runtime import would make it unloadable by Node's type-stripping test runner,
 * which needs explicit file extensions on relative specifiers.
 */

import type { PeelTuning } from "./data";

/**
 * Visual durations, in seconds, each traced to the VPK motion token it matches.
 * These are springs rather than CSS transitions, so the token cannot be
 * referenced as a var() — `.agents/rules/motion-decisions.md` asks for the
 * resolved value annotated with its token name, which is what these are.
 */
export const PEEL_DURATIONS = {
	/** Lift rise — `--duration-medium`. */
	lift: 0.2,
	/** Settle after release — `--duration-slow`. */
	land: 0.25,
	/**
	 * How long a ripple takes to die away. Longer than `--duration-slowest`
	 * (0.6s) on purpose: a drag lasts seconds, and a ripple that is spent
	 * before the sheet has finished moving leaves the paper reading as a rigid
	 * board for most of the interaction.
	 */
	wave: 0.85,
	/** Face sweep matched to the paper's 0.85-second ripple. */
	flash: 0.85,
	/** Sheen catching up to the cursor — `--duration-normal`. */
	sheen: 0.15,
	/** Drag follow, deliberately the shortest — `--duration-fast`. */
	follow: 0.1,
	/**
	 * The pendulum swing, in-plane, while the sheet is carried.
	 *
	 * Identified off the reference recording as omega = 12.0 rad/s, i.e. 2 * PI /
	 * 12.0 = 0.52s. Two structurally independent fits agree — a pointer-driven fit
	 * over 244 frames (omega 12.0, rms 0.28 deg against a +-2.65 deg signal) and
	 * two free decays after the pointer stops while still held (omega 13.6 and
	 * 11.0).
	 *
	 * This is 0.355s, not 0.52s, and the difference is a cascade correction rather
	 * than a disagreement with that fit. The reference's omega was solved against
	 * the *pointer's* velocity as a single second-order stage; our swing target is
	 * `state.velocityX`, which is the follow spring's output, so a second stage of
	 * group delay 2 * 1.1 / 62.8 = 35ms sits in front of it. Running 0.52s here
	 * therefore reproduces neither observable:
	 *
	 *   swing   decay at 50/100/150/200/250ms after the pointer stops   lag
	 *   0.520s  0.93 / 0.73 / 0.52 / 0.32 / 0.18   rms 0.162            171ms
	 *   0.400s  0.91 / 0.66 / 0.43 / 0.23 / 0.11   rms 0.092            138ms
	 *   0.355s  0.87 / 0.56 / 0.31 / 0.13 / 0.04   rms 0.030            125ms
	 *   0.300s  0.83 / 0.47 / 0.22 / 0.07 / 0.01   rms 0.069            108ms
	 *   ref     0.82 / 0.55 / 0.30 / 0.17 / 0.06                        117ms
	 *
	 * 0.355 is the minimum of that rms over a 0.16-0.56s sweep and lands the
	 * cross-correlation lag within 8ms of the reference at the same time; 0.52 was
	 * measured on the live route at 140ms of lag with decay 0.90 / 0.69 / 0.47 /
	 * 0.28 / 0.16. The steady-state amplitude is untouched — a spring's DC gain
	 * does not depend on its frequency — so this moves only the timing.
	 *
	 * Coupled to `follow` / `PEEL_DAMPING.follow`: if the follow spring is
	 * retimed, this compensation has to be re-derived against it.
	 */
	swing: 0.355,
	/**
	 * The landing recoil — the in-plane shear the sheet takes as it touches down.
	 *
	 * 0.52s is the swing spring's own identified period, 2 * PI / 12.0 rad/s, used
	 * here UNCORRECTED. `swing` above runs at 0.355s only because it is driven by
	 * `state.velocityX`, which puts the follow spring's 35ms of group delay in
	 * front of it; the recoil is seeded directly at release with no input stage,
	 * so the identified value is the right one. That the two free-decay fits of
	 * the reference (omega 13.6 and 11.0) were themselves free decays of this very
	 * sheet is the point — the paper has one stiffness and this is it.
	 *
	 * The observable it has to hit: the reference's shear is back through zero
	 * about half a second after the sheet lands. With zeta 0.83 the seeded
	 * impulse peaks at 88ms and first crosses zero at PI / omega_d = 0.466s.
	 */
	recoil: 0.52,
} as const;

/**
 * Damping ratios. The lift is underdamped so the sheet overshoots a little when
 * it comes free — that overshoot is most of what sells "peeled" over "moved".
 * The drag follow is overdamped, because a cursor that the sheet oscillates
 * around feels broken rather than springy.
 */
export const PEEL_DAMPING = {
	lift: 0.62,
	follow: 1.1,
	tilt: 0.9,
	/**
	 * Swing. Measured zeta = 0.83 on the reference: the driven fit gives 0.80
	 * and the two free decays 0.87 and 0.82. Just under critical, so the stamp
	 * comes back to its resting angle with a 1.9% overshoot you cannot see —
	 * measured 0.037 deg on a 1.995 deg decay.
	 */
	swing: 0.83,
	/**
	 * Landing recoil. Same paper, same damping ratio as the swing — the reference
	 * gives no reason to think a sheet that decays at zeta 0.83 in one in-plane
	 * mode decays differently in the other, and 0.83 puts the shear's first zero
	 * crossing at 0.466s, which is the "unwinding over roughly half a second"
	 * the recoil was measured to do.
	 */
	recoil: 0.83,
} as const;

/**
 * Spring coefficients from a visual duration. `visualDuration` is the time the
 * spring appears to arrive, which is the number a designer actually reasons
 * about; the tail past it is what the damping ratio controls.
 */
export function peelSpring(
	visualDuration: number,
	damping: number,
): { stiffness: number; damping: number } {
	const omega = (2 * Math.PI) / Math.max(visualDuration, 1 / 240);
	return { stiffness: omega * omega, damping: 2 * damping * omega };
}

/**
 * Longest frame the model will honour. A backgrounded tab hands back a delta of
 * whole seconds on return, and without this the springs would integrate it in
 * one step and fling the sheet off screen.
 */
export const PEEL_MAX_DELTA = 1 / 20;

/**
 * Integration substep. The follow spring runs at omega ~= 63 rad/s, and
 * semi-implicit Euler only stays stable while `omega * dt` is well under 2, so
 * a single 50ms step would diverge. 120Hz substeps keep the worst case at 0.52.
 */
export const PEEL_SUBSTEP = 1 / 120;

/**
 * Concurrent ripples. Two is enough for the case that actually happens — a
 * landing ripple still running when the sheet is grabbed again — and keeps the
 * uniform a fixed-size `vec4[2]` rather than something that grows.
 */
export const PEEL_IMPULSE_SLOTS = 2;

/** Drag speed, in CSS pixels per second, that produces the full tilt. */
export const PEEL_TILT_REFERENCE_SPEED = 900;

/**
 * Hard stop on the in-plane swing, in radians.
 *
 * 0.14 rad = 8.0 deg. This is a safety bound rather than a measurement: the
 * reference never swung past 2.65 deg, so nothing in the footage evidences a
 * clamp. What it bounds is a fling — at the fastest pointer speed observed in
 * the clip (1650 CSS px/s) the uncapped steady-state target is 6.9 deg, so 8
 * deg never engages in normal use but keeps a thrown stamp from cartwheeling.
 */
export const PEEL_SWING_LIMIT = 0.14;

/**
 * Where the swing pivots, as a fraction of the way from the sheet's centre to
 * the point it was grabbed by. 0 rotates about the centre, 1 about the hand.
 *
 * 0.66 +- 0.19, measured. The pivot is not directly observable, but it is
 * recoverable: rotating a rigid body by theta about a pivot P moves every other
 * point by J*(point - P)*theta, so the centroid's displacement per radian gives
 * P. Regressing the reference stamp's centroid, in the POINTER's frame, on
 * pointer vx, pointer vy and theta together over the two carry segments with
 * real swing in them (185 frames, theta sd 1.14 deg, warp frames excluded)
 * separates the drag lag (the v terms) from the rotation (the theta term) —
 * they are near-orthogonal regressors, r = -0.11 at zero lag, because theta
 * trails v by 117ms. The theta slope comes out (71 +- 26, 49 +- 20) px/rad,
 * which puts the pivot at (-49 +- 20, +71 +- 26) px from the centroid against a
 * grab point at (-45.3, +126.5). As a fraction of the centroid-to-grab vector
 * that is 1.08 +- 0.44 on x and 0.56 +- 0.21 on y; inverse-variance weighted,
 * 0.66 +- 0.19.
 *
 * So the stamp hangs from the hand rather than spinning about its middle — a
 * centre pivot (0) is rejected at 3.5 sigma — but not quite rigidly from it,
 * which is what a sheet of paper flexing near the grab point would do. The two
 * usable segments agree without being pooled: on the better-determined y
 * channel they give 0.98 and 0.79. The third carry segment is excluded, not
 * cherry-picked — its theta only varies by 0.28 deg, a fifth of the others, and
 * it returns a nonsense pivot 477px out.
 */
export const PEEL_SWING_PIVOT = 0.66;

/**
 * Where the landing shear pivots, on the same scale as `PEEL_SWING_PIVOT`: the
 * fraction of the way from the sheet's centre to the point it was grabbed by.
 *
 * 1.0 — the shear leaves the grab point itself alone, so the corner under the
 * hand plants and the sheet folds away from it. It used to be 0, which is what
 * a bare CSS `skewX()` does, and a blind critique caught it immediately: the
 * rest-to-drop affine's fixed point sat 0.21 half-diagonals from the sheet's
 * centre, inside the artwork, with all four corners moving and the top pair
 * travelling one way while the bottom pair travelled the other. That
 * centro-symmetric signature is the giveaway for a transform applied about the
 * element origin, and the same critique put the reference's fixed point 1.22
 * half-diagonals out, ON a corner, which stayed put to 0.3px.
 *
 * What is actually determined here is the pivot's height, not its distance. A
 * skew has a fixed LINE, not a fixed point: every point on the horizontal
 * through the pivot stays where it is, so an affine solver's reported fixed
 * point is well constrained across that line and badly constrained along it.
 * The reference's came out at y = 348.5 in its crop against a sheet centre at
 * 187 and a bottom edge at 326, i.e. 1.16 half-heights below centre; the grab
 * sits at 0.98 half-heights below centre. Those agree, and 0 does not.
 *
 * Physically it is the contact line. The sheet is carried by one corner, that
 * corner touches down first, and everything still in the air lags behind it.
 *
 * The swing keeps its own measured 0.66 rather than sharing this, so the two
 * anchors sit 0.34 of the grab arm apart — 22 CSS px at the default sheet. The
 * same critique measured the reference's carry-to-drop anchor shift at 38px in
 * its own crop scale, against 153px for ours, so a small difference between the
 * phases is what the reference has; one anchor jumping across the sheet is not.
 */
export const PEEL_RECOIL_PIVOT = 1.0;

/**
 * Resting out-of-plane tilt about the sheet's own vertical axis, in radians.
 *
 * 0.0617 rad = 3.54 deg. The sheet is never square to the camera, even lying on
 * the page, and that residual projection is most of what separates "a sheet
 * lying in space" from "a rotated bitmap": ours used to render as a perfect 2D
 * rotation, top edge = bottom edge to 0.01 deg, left = right to a tenth of a
 * pixel. The reference is never that clean.
 *
 * Measured, and over-determined. A rotation about the vertical axis leaves both
 * of the silhouette tracker's warp channels at zero — the left and right edges
 * keep identical slopes, and the top and bottom chords keep identical widths —
 * which is exactly why three rounds of edge-slope tracking read the reference as
 * a rigid rectangle and missed it. What it does move is the two channels a
 * corner fit sees, and a blind measurement of the reference's resting frame
 * found both:
 *
 *   left edge 258.3px vs right 254.3px, a 1.6% keystone
 *   top edge -5.27 deg vs bottom -6.44 deg, 1.17 deg of convergence
 *
 * For a sheet of width w at camera distance D, the first gives
 * sin(tilt) = 0.0157 * D / w = 0.0620 and the second, independent of w,
 * sin(tilt) = 0.0204 * D = 0.0614. Two channels, one unknown, agreeing to 1%.
 * The mean is taken here. Sign: the LEFT edge is the longer one, so the left
 * side is nearer the camera, which is a positive rotation about Y.
 *
 * It is applied to the mesh rather than to the DOM transform, because it is a
 * real out-of-plane pose and the die-cut has to keystone with it. It is a pose
 * and not motion, so reduced motion keeps it.
 */
export const PEEL_REST_TILT_Y = 0.0617;

/**
 * Peak in-plane shear of the landing recoil, in radians, for a corner grab.
 *
 * 0.0369 rad = 2.11 deg. The reference does not land on its resting pose — its
 * touchdown frame is a clean sheared PARALLELOGRAM, top and bottom edges exactly
 * parallel at -5.27 deg (both 195.8px) while left and right sit at -7.21 deg
 * (both 255.0px). Decomposed against its own rest that is +0.60 deg of rotation,
 * which the swing spring already produces, and 1.94 deg of pure shear, which
 * nothing here produced: our drop landed on the rest pose to the pixel, all four
 * edge angles inside 0.3 deg of resting.
 *
 * It has to be a shear and not a rotation, and not an out-of-plane tilt either.
 * Both edge pairs stay exactly parallel and each pair keeps equal lengths, which
 * is an affine map; a rotation about an in-plane axis large enough to shear the
 * outline by 1.94 deg would be 14.8 deg of tilt and would keystone the edge
 * lengths by 4% at this camera distance. The measured frame has 0% of that.
 *
 * 2.11 rather than 1.94 because the constant is normalised to a corner grab and
 * the reference was grabbed at roughly (0.27, 0.01) in UV, which realises 0.902
 * of it. Simulated end to end — grab, drag, release, step — that lands the peak
 * at 1.94 deg, 83ms after the sheet touches down, back through zero at 0.52s.
 * See `peelLandingSkew` and `peelRecoilRate`.
 */
export const PEEL_LANDING_SKEW = 0.0369;

/** How long a keyboard-triggered peel stays lifted before it lands. */
export const PEEL_PULSE_DURATION = 0.42;

export interface PeelImpulse {
	/** Where on the sheet the ripple started, in UV. */
	originU: number;
	originV: number;
	/** Seconds since it fired. `Infinity` marks the slot free. */
	age: number;
	/** Peak weight at age 0, before temporal decay. */
	amplitude: number;
}

export interface PeelState {
	/** Monotonic fold travel, separate from the contact-shadow spring. */
	fold: number;
	foldVelocity: number;
	foldAngle: number;
	foldAngleVelocity: number;
	reducedMotion: boolean;
	tuning: PeelTuning;

	/** True between `grabPeel` and `releasePeel`. */
	held: boolean;
	/** True while the pointer is over the sheet, independent of `held`. */
	hovered: boolean;
	/** Remaining seconds of a keyboard-triggered peel. */
	pulseRemaining: number;

	x: number;
	y: number;
	velocityX: number;
	velocityY: number;
	targetX: number;
	targetY: number;

	/** 0 flat on the page, 1 fully peeled. */
	lift: number;
	liftVelocity: number;

	tiltX: number;
	tiltY: number;
	tiltVelocityX: number;
	tiltVelocityY: number;

	/**
	 * In-plane lean, in radians, added to the sheet's resting angle. Positive is
	 * clockwise on screen, matching CSS `rotate()`. This is the pendulum: the
	 * stamp hangs from the grab point and lags the hand.
	 */
	swing: number;
	swingVelocity: number;

	/**
	 * In-plane shear, in radians, added on top of the rotation. Positive shears
	 * the top of the sheet to the left, matching CSS `skewX()`. Zero except
	 * during the half second after the sheet lands.
	 */
	skew: number;
	skewVelocity: number;

	/** Where the sheet was grabbed, in UV. Drives which corner comes up first. */
	grabU: number;
	grabV: number;

	/** Smoothed cursor position in UV — the sheen's light source. */
	pointerU: number;
	pointerV: number;
	pointerTargetU: number;
	pointerTargetV: number;

	/** Smoothed hover weight, 0-1. Fades the cursor-driven sheen in and out. */
	sheen: number;

	impulses: PeelImpulse[];
	/** Opt-in face flash age. Infinity until its preview owner starts one. */
	flashAge: number;
	/** Seconds since the state was created. Drives the idle flutter phase. */
	time: number;
}

function createImpulse(): PeelImpulse {
	return { originU: 0.5, originV: 0.5, age: Number.POSITIVE_INFINITY, amplitude: 0 };
}

export function createPeelState(tuning: PeelTuning): PeelState {
	return {
		fold: 0,
		foldVelocity: 0,
		foldAngle: Math.PI / 4,
		foldAngleVelocity: 0,
		reducedMotion: false,
		tuning,
		held: false,
		hovered: false,
		pulseRemaining: 0,
		x: 0,
		y: 0,
		velocityX: 0,
		velocityY: 0,
		targetX: 0,
		targetY: 0,
		lift: 0,
		liftVelocity: 0,
		tiltX: 0,
		tiltY: 0,
		tiltVelocityX: 0,
		tiltVelocityY: 0,
		swing: 0,
		swingVelocity: 0,
		skew: 0,
		skewVelocity: 0,
		grabU: 0.5,
		grabV: 0.5,
		pointerU: 0.5,
		pointerV: 0.5,
		pointerTargetU: 0.5,
		pointerTargetV: 0.5,
		sheen: 0,
		impulses: Array.from({ length: PEEL_IMPULSE_SLOTS }, createImpulse),
		flashAge: Number.POSITIVE_INFINITY,
		time: 0,
	};
}

/**
 * Starts a ripple at `u,v`. Free slots are used first; once both are live the
 * oldest is recycled, so the newest ripple is never the one that gets dropped.
 */
export function firePeelImpulse(state: PeelState, u: number, v: number, amplitude = 1): void {
	if (state.tuning.waveAmplitude <= 0) {
		return;
	}

	let slot = state.impulses[0];
	for (const candidate of state.impulses) {
		if (candidate.age > slot.age) {
			slot = candidate;
		}
	}

	slot.originU = u;
	slot.originV = v;
	slot.age = 0;
	slot.amplitude = amplitude;
}

/**
 * Current weight of a ripple: peak amplitude decayed over the wave duration.
 * At `age === PEEL_DURATIONS.wave` this is ~11% of peak, which is where the
 * stepper retires the slot. The decay is deliberately gentle — paper rings for
 * a while after it is flexed, and a ripple that vanishes in a couple of frames
 * is one the user never actually sees.
 */
export function peelImpulseEnergy(impulse: PeelImpulse): number {
	if (!Number.isFinite(impulse.age)) {
		return 0;
	}
	return impulse.amplitude * Math.exp((-2.2 * impulse.age) / PEEL_DURATIONS.wave);
}

/** Start only for a preview that supplies a face flash; ordinary stamps keep their existing lifetime. */
export function startPeelFlash(state: PeelState): void {
	state.flashAge = state.reducedMotion ? Number.POSITIVE_INFINITY : 0;
}

/** Sustain the broad avatar-coloured pass, then ease its trailing light away. */
export function peelFlashEnergy(state: PeelState): number {
	if (state.reducedMotion || !Number.isFinite(state.flashAge)) return 0;
	const tail = clamp((1 - peelFlashProgress(state)) / 0.55, 0, 1);
	return tail * tail * (3 - 2 * tail);
}

/** The face sweep shares the frame clock and finishes with the ripple. */
export function peelFlashProgress(state: PeelState): number {
	return clamp(state.flashAge / PEEL_DURATIONS.flash, 0, 1);
}

/**
 * Peak in-plane shear the sheet takes when it lands, for the point it is being
 * held by. Radians, positive shearing the top of the sheet to the left.
 *
 * Two factors, both read off the reference's touchdown frame:
 *
 *   how much lags — the half of the sheet AWAY from the grab is the half that is
 *   still in the air when the held corner plants, so a grab on the bottom edge
 *   shears the whole top and a grab through the middle shears nothing. That is
 *   the distance of the grab from the sheet's horizontal centreline, doubled so
 *   an edge grab saturates it.
 *
 *   which way — it lags toward the side the sheet is planted on, which for the
 *   reference's bottom-LEFT grab put the trailing top-left corner further left.
 *   Saturating at a quarter of the width from the centre, so the direction is
 *   settled well before the grab reaches an edge rather than flipping abruptly
 *   across the midline.
 *
 * The reference's grab, roughly (0.27, 0.01) in UV, gives -0.98 * -0.92 = 0.902
 * of `PEEL_LANDING_SKEW`.
 */
export function peelLandingSkew(state: PeelState): number {
	// Reduced motion zeroes `swing`; the recoil is the same in-plane compliance
	// of the same sheet, so it goes with it rather than needing its own switch.
	if (state.tuning.swing <= 0) {
		return 0;
	}

	const lagSpan = clamp(2 * (state.grabV - 0.5), -1, 1);
	const lagLean = clamp(4 * (state.grabU - 0.5), -1, 1);
	return PEEL_LANDING_SKEW * lagSpan * lagLean;
}

/**
 * Velocity that has to be handed to the recoil spring for it to peak at `peak`.
 *
 * The recoil is seeded as an impulse rather than as an initial displacement,
 * which is both what an impact does and what the reference shows: the shear is
 * not largest at the instant of contact, it builds over the first few frames and
 * is back through zero about half a second later. For x(0) = 0, x'(0) = v the
 * response is (v / omega_d) * exp(-zeta * omega * t) * sin(omega_d * t), so the
 * peak is v times a constant that depends only on the spring. Deriving that
 * constant here rather than writing it down keeps it from drifting if
 * `PEEL_DURATIONS.recoil` or `PEEL_DAMPING.recoil` is ever retuned.
 *
 * At the shipped spring the peak lands 88ms after release at 0.0343 * v.
 *
 * The last factor is discretisation, and it is not a rounding error. stepSpring
 * is semi-implicit Euler: it applies a whole step of damping to the seeded
 * velocity before that velocity has moved anything, which costs
 * 2 * zeta * omega * PEEL_SUBSTEP = 16.7% of it at the shipped numbers. Without
 * the correction the realised peak comes out at 0.85 of the constant above,
 * which is a 13% miss on a measured target. Deriving it from PEEL_SUBSTEP keeps
 * it true if the substep changes.
 */
export function peelRecoilRate(peak: number): number {
	const omega = (2 * Math.PI) / PEEL_DURATIONS.recoil;
	const zeta = PEEL_DAMPING.recoil;
	const damped = omega * Math.sqrt(1 - zeta * zeta);
	const atPeak = Math.atan(damped / (zeta * omega)) / damped;
	const continuous =
		(peak * damped) / (Math.exp(-zeta * omega * atPeak) * Math.sin(damped * atPeak));
	return continuous / Math.max(1 - 2 * zeta * omega * PEEL_SUBSTEP, 0.25);
}

/** Touchdown: the landing ripple and the shear that goes with it. */
function landPeel(state: PeelState, amplitude: number): void {
	firePeelImpulse(state, state.grabU, state.grabV, amplitude);
	state.skewVelocity += peelRecoilRate(peelLandingSkew(state));
}

export function grabPeel(state: PeelState, u: number, v: number): void {
	state.held = true;
	state.grabU = u;
	state.grabV = v;
	state.pointerTargetU = u;
	state.pointerTargetV = v;
	// The sheet comes free at the grab point, so that is where the flex starts.
	firePeelImpulse(state, u, v, 1);
}

/** Sets the drag target. `dx`/`dy` are CSS pixels from the resting position. */
export function dragPeel(state: PeelState, dx: number, dy: number): void {
	state.targetX = dx;
	state.targetY = dy;
}

export function releasePeel(state: PeelState): void {
	if (!state.held) {
		return;
	}
	state.held = false;
	// The sheet touches down where it was being carried, so the landing ripple
	// and the landing shear both start from under the grab point rather than
	// from the centre.
	landPeel(state, 0.85);
}

/** Moves the pointer without changing hold state. `u`/`v` are sheet UV. */
export function pointPeel(state: PeelState, u: number, v: number): void {
	state.pointerTargetU = u;
	state.pointerTargetV = v;
}

export function hoverPeel(state: PeelState, hovered: boolean): void {
	state.hovered = hovered;
}

/**
 * A complete peel-and-settle with no pointer — what the keyboard affordance
 * fires, so `Enter` on a focused stamp shows the effect instead of doing
 * nothing. The landing ripple is enqueued by the stepper when the timer ends.
 */
export function pulsePeel(state: PeelState, u = 0.5, v = 0.5): void {
	if (state.held || state.pulseRemaining > 0) {
		return;
	}
	state.grabU = u;
	state.grabV = v;
	state.pulseRemaining = PEEL_PULSE_DURATION;
	firePeelImpulse(state, u, v, 1);
}

/** Offsets the drag target, for arrow-key nudging. */
export function nudgePeel(state: PeelState, dx: number, dy: number): void {
	state.targetX += dx;
	state.targetY += dy;
}

function stepSpring(
	value: number,
	velocity: number,
	target: number,
	stiffness: number,
	damping: number,
	dt: number,
): [number, number] {
	const acceleration = stiffness * (target - value) - damping * velocity;
	const nextVelocity = velocity + acceleration * dt;
	return [value + nextVelocity * dt, nextVelocity];
}

/** Exponential approach — unconditionally stable, used where no overshoot is wanted. */
function approach(value: number, target: number, duration: number, dt: number): number {
	return value + (target - value) * (1 - Math.exp(-dt / Math.max(duration, 1e-4)));
}

/** Exact critically damped spring, matching the reference's fold rates. */
function stepFold(value: number, velocity: number, target: number, rate: number, dt: number): [number, number] {
	const offset = value - target;
	const carry = velocity + rate * offset;
	const decay = Math.exp(-rate * dt);
	const next = target + (offset + carry * dt) * decay;
	const nextVelocity = (velocity - rate * carry * dt) * decay;
	return Math.abs(next - target) < 0.0005 && Math.abs(nextVelocity) < 0.006
		? [target, 0]
		: [next, nextVelocity];
}

function stepOnce(state: PeelState, dt: number): void {
	state.time += dt;
	if (Number.isFinite(state.flashAge)) {
		state.flashAge += dt;
		if (state.flashAge >= PEEL_DURATIONS.flash) state.flashAge = Number.POSITIVE_INFINITY;
	}

	for (const impulse of state.impulses) {
		if (!Number.isFinite(impulse.age)) {
			continue;
		}
		impulse.age += dt;
		if (impulse.age > PEEL_DURATIONS.wave) {
			impulse.age = Number.POSITIVE_INFINITY;
			impulse.amplitude = 0;
		}
	}

	if (state.pulseRemaining > 0) {
		state.pulseRemaining -= dt;
		if (state.pulseRemaining <= 0) {
			state.pulseRemaining = 0;
			landPeel(state, 0.85);
		}
	}

	const lifted = state.held || state.pulseRemaining > 0;
	const foldTarget = lifted ? 1 : 0;
	// The curl sweeps across the sheet in ~400ms (duration-slower), then relaxes.
	// Rates 7 on lift and 9 on landing come from the reference's scene module.
	[state.fold, state.foldVelocity] = state.reducedMotion
		? [foldTarget, 0]
		: stepFold(state.fold, state.foldVelocity, foldTarget, lifted ? 7 : 9, dt);
	const angleTarget = Math.atan2(state.grabV < 0.5 ? -1 : 1, state.grabU < 0.5 ? -1 : 1);
	const angleDelta = Math.atan2(Math.sin(angleTarget - state.foldAngle), Math.cos(angleTarget - state.foldAngle));
	[state.foldAngle, state.foldAngleVelocity] = state.reducedMotion || state.fold < 0.015 || state.fold > 0.985
		? [angleTarget, 0]
		: stepFold(state.foldAngle, state.foldAngleVelocity, state.foldAngle + angleDelta, 24, dt);

	const liftSpring = peelSpring(
		lifted ? PEEL_DURATIONS.lift : PEEL_DURATIONS.land,
		PEEL_DAMPING.lift,
	);
	[state.lift, state.liftVelocity] = stepSpring(
		state.lift,
		state.liftVelocity,
		lifted ? 1 : 0,
		liftSpring.stiffness,
		liftSpring.damping,
		dt,
	);

	const followSpring = peelSpring(PEEL_DURATIONS.follow, PEEL_DAMPING.follow);
	[state.x, state.velocityX] = stepSpring(
		state.x,
		state.velocityX,
		state.targetX,
		followSpring.stiffness,
		followSpring.damping,
		dt,
	);
	[state.y, state.velocityY] = stepSpring(
		state.y,
		state.velocityY,
		state.targetY,
		followSpring.stiffness,
		followSpring.damping,
		dt,
	);

	// A sheet dragged left leans left: tilt follows velocity, not position, and
	// only while the sheet is off the page. `tiltY` answers horizontal travel
	// because it is a rotation about the vertical axis.
	const speedScale = state.tuning.tilt / PEEL_TILT_REFERENCE_SPEED;
	const tiltTargetY = lifted
		? clamp(state.velocityX * speedScale, -state.tuning.tilt, state.tuning.tilt)
		: 0;
	const tiltTargetX = lifted
		? clamp(-state.velocityY * speedScale, -state.tuning.tilt, state.tuning.tilt)
		: 0;
	const tiltSpring = peelSpring(PEEL_DURATIONS.land, PEEL_DAMPING.tilt);
	[state.tiltY, state.tiltVelocityY] = stepSpring(
		state.tiltY,
		state.tiltVelocityY,
		tiltTargetY,
		tiltSpring.stiffness,
		tiltSpring.damping,
		dt,
	);
	[state.tiltX, state.tiltVelocityX] = stepSpring(
		state.tiltX,
		state.tiltVelocityX,
		tiltTargetX,
		tiltSpring.stiffness,
		tiltSpring.damping,
		dt,
	);

	// The swing is the other half of that, and it is the one the reference
	// actually shows: a carried stamp hangs from the grab point and lags the
	// hand, so dragging right leans it clockwise and dragging left leans it
	// back. Gain measured at 0.00420 deg per CSS px/s, which the tuning stores
	// as radians at PEEL_TILT_REFERENCE_SPEED.
	//
	// Note the sign is the opposite convention from `tiltTargetX` above: a
	// positive `velocityX` must produce a positive (clockwise) rotation, as the
	// reference does when dragged right (-5.99 deg to -3.22 deg). Vertical drag
	// contributes nothing — adding a velocityY term to the fit moved the rms by
	// 0.3% (0.2809 to 0.2800), i.e. nothing.
	const swingTarget = lifted
		? clamp(
				state.velocityX * (state.tuning.swing / PEEL_TILT_REFERENCE_SPEED),
				-PEEL_SWING_LIMIT,
				PEEL_SWING_LIMIT,
			)
		: 0;
	const swingSpring = peelSpring(PEEL_DURATIONS.swing, PEEL_DAMPING.swing);
	[state.swing, state.swingVelocity] = stepSpring(
		state.swing,
		state.swingVelocity,
		swingTarget,
		swingSpring.stiffness,
		swingSpring.damping,
		dt,
	);

	// The landing recoil. Nothing drives it — it is seeded once, by the impact
	// in landPeel(), and springs back to zero from there. A held sheet has no
	// shear, which is what the reference shows: its carry frames are rectangles
	// and only the touchdown frame is a parallelogram.
	const recoilSpring = peelSpring(PEEL_DURATIONS.recoil, PEEL_DAMPING.recoil);
	[state.skew, state.skewVelocity] = stepSpring(
		state.skew,
		state.skewVelocity,
		0,
		recoilSpring.stiffness,
		recoilSpring.damping,
		dt,
	);

	state.pointerU = approach(state.pointerU, state.pointerTargetU, PEEL_DURATIONS.sheen, dt);
	state.pointerV = approach(state.pointerV, state.pointerTargetV, PEEL_DURATIONS.sheen, dt);
	state.sheen = approach(
		state.sheen,
		state.hovered || lifted ? 1 : 0,
		PEEL_DURATIONS.sheen,
		dt,
	);
}

/**
 * Advances the whole model by `dt` seconds. The delta is clamped and then split
 * into fixed substeps, so the result is frame-rate independent and the springs
 * cannot blow up on a long frame.
 */
export function stepPeel(state: PeelState, dt: number): void {
	if (!Number.isFinite(dt) || dt <= 0) {
		return;
	}

	let remaining = Math.min(dt, PEEL_MAX_DELTA);
	while (remaining > 0) {
		const step = Math.min(remaining, PEEL_SUBSTEP);
		stepOnce(state, step);
		remaining -= step;
	}
	if (state.reducedMotion) {
		state.lift = state.held ? 1 : 0;
		state.liftVelocity = 0;
		state.x = state.targetX;
		state.y = state.targetY;
		state.velocityX = state.velocityY = 0;
	}
}

/**
 * Translation, in CSS pixels, that moves the sheet's in-plane pose off the
 * element's centre and onto the points it should actually turn about.
 *
 * A CSS `rotate()` and a CSS `skewX()` both work about the element's own
 * centre, and neither of the two things this model does is centred there: the
 * carried stamp hangs from the hand (`PEEL_SWING_PIVOT`) and the landing shear
 * folds away from the corner that has just planted (`PEEL_RECOIL_PIVOT`).
 * Applying a transform T about a pivot P is the same as applying it about the
 * centre C and then translating by P - T(P - C), which is what this sums, so
 * the scene keeps writing one plain `translate3d(...) rotate(...) skewX(...)`
 * and the element's transform-origin is left alone. Moving the origin instead
 * would jump the sheet at the instant of the grab, before it had turned at all.
 *
 * The baseline is the RESTING pose, not the identity: at rest the element is
 * already rotated by the sheet's resting angle, and only what the swing and the
 * shear add on top of that is allowed to move it. Hence
 *
 *   swing:  R(rest) * A - R(rest + swing) * A
 *   shear:  -R(rest + swing) * (tan(skew) * A.y, 0)
 *
 * with A the pivot in the sheet's own frame, taken at each channel's own
 * fraction of the way to the grab. `rotation` is that resting angle in radians.
 * Returns exactly zero whenever both channels are zero, which is every frame
 * the sheet is neither being carried nor settling.
 *
 * At the default 98x129 sheet and a bottom-left grab, the swing term is about
 * 3.0 CSS px at the full 3.78 deg lean and the shear term about 2.0 CSS px at
 * the 1.8 deg the landing peaks at.
 */
export function peelPivotOffset(
	state: PeelState,
	width: number,
	height: number,
	rotation: number,
): { x: number; y: number } {
	if (state.swing === 0 && state.skew === 0) {
		return { x: 0, y: 0 };
	}

	// Grab point relative to the centre, in the sheet's own frame, y down. UV
	// runs bottom-up, hence the flip on v.
	const armX = (state.grabU - 0.5) * width;
	const armY = (0.5 - state.grabV) * height;

	const restCos = Math.cos(rotation);
	const restSin = Math.sin(rotation);
	const pivotX = armX * PEEL_SWING_PIVOT * restCos - armY * PEEL_SWING_PIVOT * restSin;
	const pivotY = armX * PEEL_SWING_PIVOT * restSin + armY * PEEL_SWING_PIVOT * restCos;

	const swingCos = Math.cos(state.swing);
	const swingSin = Math.sin(state.swing);

	// The shear runs in the sheet's own frame — CSS composes left to right, so
	// the skew is applied before the rotate — and skewX moves a point by
	// tan(skew) * y along the sheet's x. Undoing that at the shear's pivot means
	// one horizontal step in that frame, turned into the page by the total
	// angle the rotate is about to apply.
	const total = rotation + state.swing;
	const shear = -Math.tan(state.skew) * armY * PEEL_RECOIL_PIVOT;

	return {
		x: pivotX - (pivotX * swingCos - pivotY * swingSin) + shear * Math.cos(total),
		y: pivotY - (pivotX * swingSin + pivotY * swingCos) + shear * Math.sin(total),
	};
}

/**
 * True when nothing is moving and nothing will move without new input, so the
 * scene can drop to an on-demand frame loop. A page of resting stamps should
 * cost no frames at all.
 */
export function isPeelIdle(state: PeelState): boolean {
	if (!state.reducedMotion && Number.isFinite(state.flashAge)) return false;
	if (state.pulseRemaining > 0 || (state.tuning.flutter > 0 && state.held)) {
		return false;
	}
	if (state.impulses.some((impulse) => Number.isFinite(impulse.age))) {
		return false;
	}

	const settled =
		Math.abs(state.fold - (state.held ? 1 : 0)) < 1e-4 &&
		Math.abs(state.foldVelocity) < 1e-3 &&
		Math.abs(state.lift - (state.held ? 1 : 0)) < 1e-3 &&
		Math.abs(state.liftVelocity) < 1e-3 &&
		Math.abs(state.sheen - (state.hovered || state.held ? 1 : 0)) < 1e-3 &&
		Math.abs(state.pointerU - state.pointerTargetU) < 1e-4 &&
		Math.abs(state.pointerV - state.pointerTargetV) < 1e-4 &&
		Math.abs(state.tiltX) < 1e-4 &&
		Math.abs(state.tiltY) < 1e-4 &&
		// The swing needs 0.29s to reach 5% and is visually parked by ~0.35s;
		// without this the canvas can drop to the demand loop mid-swing and
		// freeze the stamp at whatever angle the last frame left it on.
		Math.abs(state.swing) < 1e-4 &&
		Math.abs(state.swingVelocity) < 1e-3 &&
		// Same for the recoil. The landing ripple happens to outlast it — the
		// impulse slot is held for 0.85s against the shear's 0.5s — so this
		// never decides the question today, but the two are independent and a
		// shorter wave should not be able to park the canvas mid-shear.
		Math.abs(state.skew) < 1e-4 &&
		Math.abs(state.skewVelocity) < 1e-3 &&
		Math.abs(state.x - state.targetX) < 0.05 &&
		Math.abs(state.y - state.targetY) < 0.05 &&
		Math.abs(state.velocityX) < 0.05 &&
		Math.abs(state.velocityY) < 0.05;

	return settled;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
