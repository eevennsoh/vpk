import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types runner requires explicit .ts extensions.
import { PEEL_DURATIONS, PEEL_MAX_DELTA, PEEL_PULSE_DURATION, PEEL_SWING_LIMIT, PEEL_TILT_REFERENCE_SPEED, createPeelState, dragPeel, firePeelImpulse, grabPeel, hoverPeel, isPeelIdle, nudgePeel, peelFlashEnergy, peelFlashProgress, peelImpulseEnergy, peelRecoilRate, peelPivotOffset, pulsePeel, releasePeel, startPeelFlash, stepPeel, type PeelState } from "./peel-model.ts";
// @ts-expect-error Node's strip-types runner requires explicit .ts extensions.
import { PEEL_CAMERA_DISTANCE, PEEL_CAMERA_FOV, PEEL_OVERSCAN, resolvePeelTuning } from "./data.ts";
// @ts-expect-error Node's strip-types runner requires explicit .ts extensions.
import { deformPeelSheet } from "./peel-geometry.ts";

test("the face flash shares the ripple's deadline and replays when requested", () => {
	const state = createPeelState(resolvePeelTuning("uv-gloss", { waveAmplitude: 0.1 }));
	assert.equal(PEEL_DURATIONS.flash, PEEL_DURATIONS.wave);
	assert.equal(peelFlashEnergy(state), 0, "preparation never spends a flash");
	grabPeel(state, 0.25, 0.1);
	assert.equal(peelFlashEnergy(state), 0, "ordinary stamps do not start a face flash");
	startPeelFlash(state);
	assert.equal(peelFlashEnergy(state), 1);
	assert.equal(peelFlashProgress(state), 0);
	run(state, PEEL_DURATIONS.flash / 2);
	assert.ok(peelFlashEnergy(state) > 0.9, "the broad light remains bright through its middle");
	assert.ok(Math.abs(peelFlashProgress(state) - 0.5) < 0.01);
	run(state, PEEL_DURATIONS.flash / 4);
	assert.ok(peelFlashEnergy(state) > 0, "the face light is still visible before its deadline");
	assert.ok(state.impulses.some((impulse) => Number.isFinite(impulse.age)), "the ripple is still active before the shared deadline");
	run(state, PEEL_DURATIONS.flash / 4 + 1 / 60);
	assert.equal(peelFlashEnergy(state), 0, "the face sweep fades out while the paper remains held");
	assert.equal(peelFlashProgress(state), 1);
	assert.ok(state.impulses.every((impulse) => !Number.isFinite(impulse.age)), "the original ripple retires at the shared deadline");
	releasePeel(state);
	grabPeel(state, 0.25, 0.1);
	startPeelFlash(state);
	assert.equal(peelFlashEnergy(state), 1, "a later gesture gets its full flash");
	assert.equal(peelFlashProgress(state), 0, "a later gesture starts its sweep from the lead edge again");
	state.reducedMotion = true;
	assert.equal(peelFlashEnergy(state), 0, "reduced motion suppresses the decorative flash");
});

test("the peel lens preserves the resting footprint and lifts without ballooning", () => {
	const viewport = 2 * PEEL_CAMERA_DISTANCE * Math.tan((PEEL_CAMERA_FOV * Math.PI) / 360);
	assert.ok(Math.abs(viewport - (1 + 2 * PEEL_OVERSCAN)) < 1e-6);
	const growth = PEEL_CAMERA_DISTANCE / (PEEL_CAMERA_DISTANCE - resolvePeelTuning().liftHeight);
	assert.ok(growth > 1 && growth < 1.01, "a flat detached sheet grows less than one percent, as in the reference");
});

test("the diagonal peel keeps the attached corner flat and curls the grabbed corner", () => {
	for (const angle of [Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4]) {
		const x = Math.sign(Math.cos(angle)) * 0.38;
		const y = Math.sign(Math.sin(angle)) * 0.5;
		const original = new Float32Array([-x, -y, 0, x, y, 0]);
		const positions = original.slice();
		const normals = new Float32Array(6);
		deformPeelSheet(original, positions, normals, 0.76, 0.3, angle, 0.32, 0.062);
		assert.ok(Math.abs(positions[2]) < 1e-6, "the far corner stays attached during lift-off");
		assert.ok(positions[5] > 0.02, "the grabbed corner leaves the page first");
		assert.ok(Math.hypot(positions[3] - x, positions[4] - y) > 0.002, "curl shortens the projected footprint");
		assert.ok(Math.abs(normals[3]) + Math.abs(normals[4]) > 0.05, "the fold turns the paper normal");
	}
});

test("a complete peel relaxes to flat raised paper and reverses onto the original footprint", () => {
	const original = new Float32Array([-0.38, -0.5, 0, 0.38, 0.5, 0, 0, 0, 0]);
	const positions = original.slice();
	const normals = new Float32Array(9);
	for (const progress of [0, 0.2, 0.6, 0.9, 1, 0.9, 0.6, 0.2, 0]) {
		deformPeelSheet(original, positions, normals, 0.76, progress, Math.PI / 4, 0.32, 0.062);
		assert.ok(positions.every(Number.isFinite));
		if (progress === 0 || progress === 1) {
			for (let i = 0; i < positions.length; i += 3) {
				assert.equal(positions[i], original[i]);
				assert.ok(Math.abs(positions[i + 1] - original[i + 1] - progress * 0.031) < 1e-6);
				assert.ok(Math.abs(positions[i + 2] - progress * 0.062) < 1e-6);
				assert.ok(Math.abs(normals[i]) < 1e-6 && Math.abs(normals[i + 1]) < 1e-6);
				assert.equal(normals[i + 2], 1);
			}
		}
	}
	assert.deepEqual(positions, original, "landing restores every original vertex without accumulated deformation");
});

test("the fold can reverse during lift-off without jumping or overshooting its travel", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.2, 0.1);
	run(state, 0.2);
	assert.ok(state.fold > 0.2 && state.fold < 0.8);
	const before = state.fold;
	releasePeel(state);
	assert.equal(state.fold, before, "changing the target preserves the current pose");
	for (let i = 0; i < 180; i += 1) {
		stepPeel(state, 1 / 60);
		assert.ok(state.fold >= 0 && state.fold <= 1);
	}
	assert.equal(state.fold, 0);
});

test("a held sheet parks its frame loop once the fold and pointer have settled", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.2, 0.1);
	run(state, 3);
	assert.equal(state.fold, 1);
	assert.equal(isPeelIdle(state), true);
	dragPeel(state, 20, 0);
	assert.equal(isPeelIdle(state), false, "new pointer travel wakes the sheet");
});

test("reduced motion takes precedence over tuning and changes the fold without a sweep", () => {
	const tuning = resolvePeelTuning("foil", { flutter: 0.1, waveAmplitude: 0.2, swing: 0.5 }, true);
	assert.equal(tuning.flutter, 0);
	assert.equal(tuning.waveAmplitude, 0);
	assert.equal(tuning.swing, 0);
	const state = createPeelState(tuning);
	state.reducedMotion = true;
	grabPeel(state, 0.1, 0.9);
	dragPeel(state, 30, -20);
	stepPeel(state, 1 / 60);
	assert.equal(state.fold, 1);
	assert.equal(state.lift, 1);
	assert.equal(state.x, 30);
	releasePeel(state);
	stepPeel(state, 1 / 60);
	assert.equal(state.fold, 0);
	assert.equal(state.lift, 0);
});

/** Advances the model at a fixed 60Hz, the way a healthy frame loop would. */
function run(state: PeelState, seconds: number, dt = 1 / 60): void {
	const steps = Math.round(seconds / dt);
	for (let i = 0; i < steps; i += 1) {
		stepPeel(state, dt);
	}
}

function liveImpulses(state: PeelState) {
	return state.impulses.filter((impulse) => Number.isFinite(impulse.age));
}

test("grabbing lifts the sheet and releasing sets it back down", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	assert.equal(state.lift, 0);

	grabPeel(state, 0.2, 0.8);
	run(state, PEEL_DURATIONS.lift);
	assert.ok(state.lift > 0.7, `expected the sheet to be mostly lifted, got ${state.lift}`);

	releasePeel(state);
	run(state, 1);
	assert.ok(state.lift < 0.01, `expected the sheet back on the page, got ${state.lift}`);
});

test("the lift overshoots, which is what reads as peeling rather than moving", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);

	let peak = 0;
	for (let i = 0; i < 120; i += 1) {
		stepPeel(state, 1 / 60);
		peak = Math.max(peak, state.lift);
	}

	assert.ok(peak > 1, `underdamped lift should pass 1 before settling, peaked at ${peak}`);
	assert.ok(peak < 1.4, `overshoot should stay restrained, peaked at ${peak}`);
});

test("a grab starts a ripple at the grab point and a release starts a softer one", () => {
	const state = createPeelState(resolvePeelTuning("foil"));

	grabPeel(state, 0.25, 0.75);
	const [grabRipple] = liveImpulses(state);
	assert.equal(grabRipple.originU, 0.25);
	assert.equal(grabRipple.originV, 0.75);
	assert.equal(grabRipple.amplitude, 1);

	releasePeel(state);
	const live = liveImpulses(state);
	assert.equal(live.length, 2, "the landing ripple should coexist with the lift-off one");
	// The sheet is set down, not torn off, so the landing flex is gentler.
	const landing = live.find((impulse) => impulse.amplitude < 1);
	assert.ok(landing, "expected a lower-amplitude landing ripple");
	assert.equal(landing.originU, 0.25);
	assert.equal(landing.originV, 0.75);
});

test("releasing without a grab does nothing", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	releasePeel(state);

	assert.equal(state.held, false);
	assert.equal(liveImpulses(state).length, 0);
});

test("a third ripple recycles the oldest slot, never the newest", () => {
	const state = createPeelState(resolvePeelTuning("foil"));

	firePeelImpulse(state, 0.1, 0.1, 1);
	run(state, 0.1);
	firePeelImpulse(state, 0.5, 0.5, 1);
	run(state, 0.05);
	firePeelImpulse(state, 0.9, 0.9, 1);

	const origins = liveImpulses(state)
		.map((impulse) => impulse.originU)
		.sort();
	assert.deepEqual(origins, [0.5, 0.9], "the oldest ripple should have been evicted");
});

test("a ripple decays to nothing and retires its slot within the wave duration", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	firePeelImpulse(state, 0.5, 0.5, 1);

	run(state, PEEL_DURATIONS.wave * 0.5);
	const midway = peelImpulseEnergy(state.impulses[0]);
	assert.ok(midway > 0.1 && midway < 0.5, `expected a decaying ripple, got ${midway}`);

	run(state, PEEL_DURATIONS.wave);
	assert.equal(liveImpulses(state).length, 0);
	assert.equal(peelImpulseEnergy(state.impulses[0]), 0);
});

test("Reduce Motion suppresses ripples but keeps the sheet draggable", () => {
	const tuning = resolvePeelTuning("foil", undefined, true);
	assert.equal(tuning.waveAmplitude, 0);
	assert.equal(tuning.flutter, 0);
	assert.equal(tuning.tilt, 0);

	const state = createPeelState(tuning);
	grabPeel(state, 0.5, 0.5);
	releasePeel(state);
	assert.equal(liveImpulses(state).length, 0, "no autonomous ripple under Reduce Motion");

	grabPeel(state, 0.5, 0.5);
	dragPeel(state, 120, -40);
	run(state, 0.5);
	assert.ok(Math.abs(state.x - 120) < 1, "dragging must still track the pointer");
	assert.ok(Math.abs(state.y + 40) < 1);
	assert.ok(state.lift > 0.9, "the sheet still comes off the page");
});

test("the sheet arrives at the drag target without oscillating around it", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);
	dragPeel(state, 200, 150);

	let maxX = 0;
	for (let i = 0; i < 120; i += 1) {
		stepPeel(state, 1 / 60);
		maxX = Math.max(maxX, state.x);
	}

	assert.ok(Math.abs(state.x - 200) < 0.5, `expected arrival at 200, got ${state.x}`);
	assert.ok(Math.abs(state.y - 150) < 0.5, `expected arrival at 150, got ${state.y}`);
	// An overdamped follow is the point: a cursor the sheet bounces around
	// feels broken rather than springy.
	assert.ok(maxX <= 200.5, `follow should not overshoot the cursor, reached ${maxX}`);
});

test("a stalled frame is clamped instead of teleporting the sheet", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);
	dragPeel(state, 5000, 5000);

	stepPeel(state, 2);

	assert.ok(
		state.time <= PEEL_MAX_DELTA + 1e-9,
		`a 2s delta should advance at most ${PEEL_MAX_DELTA}s, advanced ${state.time}`,
	);
	assert.ok(state.x < 5000, "the sheet must not arrive in a single stalled frame");
	assert.ok(Number.isFinite(state.x) && Number.isFinite(state.velocityX));
});

test("the springs stay stable when every frame is the worst allowed frame", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);
	dragPeel(state, 300, -200);

	for (let i = 0; i < 400; i += 1) {
		stepPeel(state, PEEL_MAX_DELTA);
	}

	// Substepping is what buys this: integrated in one 50ms step the follow
	// spring would diverge rather than converge.
	assert.ok(Math.abs(state.x - 300) < 1, `diverged to ${state.x}`);
	assert.ok(Math.abs(state.y + 200) < 1, `diverged to ${state.y}`);
});

test("zero, negative and non-finite deltas are ignored", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);

	stepPeel(state, 0);
	stepPeel(state, -1);
	stepPeel(state, Number.NaN);

	assert.equal(state.time, 0);
	assert.equal(state.lift, 0);
});

test("a keyboard pulse lifts the sheet and lands it on its own", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	pulsePeel(state, 0.4, 0.6);
	assert.equal(liveImpulses(state).length, 1);

	run(state, PEEL_DURATIONS.lift);
	assert.ok(state.lift > 0.7, "the pulse should lift the sheet");

	// A second press mid-pulse must not restart it.
	pulsePeel(state, 0.1, 0.1);
	assert.equal(state.grabU, 0.4);

	run(state, PEEL_PULSE_DURATION);
	assert.equal(state.pulseRemaining, 0);
	assert.ok(
		state.impulses.some((impulse) => impulse.amplitude === 0.85),
		"ending a pulse should fire the landing ripple",
	);

	run(state, 1);
	assert.ok(state.lift < 0.01, "the sheet lands without any further input");
});

test("arrow-key nudges accumulate from wherever the sheet was dropped", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);
	dragPeel(state, 60, 0);
	releasePeel(state);
	run(state, 0.5);

	nudgePeel(state, 12, 0);
	nudgePeel(state, 12, 0);
	run(state, 0.5);

	assert.ok(Math.abs(state.x - 84) < 0.5, `expected 60 + 24, got ${state.x}`);
});

test("idle reports false while anything is still moving", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	assert.equal(isPeelIdle(state), true);

	hoverPeel(state, true);
	assert.equal(isPeelIdle(state), false, "a hovered sheet is still animating its sheen");

	hoverPeel(state, false);
	grabPeel(state, 0.5, 0.5);
	assert.equal(isPeelIdle(state), false);

	releasePeel(state);
	assert.equal(isPeelIdle(state), false, "ripples are still running");

	run(state, 2);
	assert.equal(isPeelIdle(state), true, "everything settles with no further input");
});

test("a dropped sheet stays where it was left", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);
	dragPeel(state, -140, 90);
	run(state, 0.4);
	releasePeel(state);
	run(state, 3);

	assert.ok(Math.abs(state.x + 140) < 0.5, `expected it to stay at -140, got ${state.x}`);
	assert.ok(Math.abs(state.y - 90) < 0.5, `expected it to stay at 90, got ${state.y}`);
});

/**
 * Drags the sheet at a constant speed by advancing the target every frame.
 * Returns the distance travelled, so a caller can keep dragging from there.
 */
function drag(state: PeelState, from: number, pxPerSecond: number, seconds: number): number {
	const dt = 1 / 60;
	const steps = Math.round(seconds / dt);
	let x = from;
	for (let i = 0; i < steps; i += 1) {
		x += pxPerSecond * dt;
		dragPeel(state, x, 0);
		stepPeel(state, dt);
	}
	return x;
}

/**
 * The swing is the pendulum, and it is the single biggest difference between
 * this component and the reference it is copied from: a carried stamp hangs
 * from the point you grabbed it by, so it lags the hand and leans into the
 * direction of travel. Everything asserted here is measured off stamp.mov and
 * documented at the constants — 0.066 rad (3.78 deg) at 900 CSS px/s, a 0.355s
 * visual duration, and 0.83 damping.
 */
test("carrying the sheet swings it into the direction of travel", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);

	drag(state, 0, PEEL_TILT_REFERENCE_SPEED, 0.5);

	// 900 CSS px/s is the reference speed, so the steady state is the tuning's
	// own gain: 0.066 rad = 3.78 deg.
	assert.ok(
		Math.abs(state.swing - 0.066) < 0.01,
		`expected the swing to settle near +0.066 rad, got ${state.swing}`,
	);
	assert.ok(state.swing > 0, "dragging right must lean the sheet clockwise");
});

test("dragging the other way swings it the other way", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);

	drag(state, 0, -PEEL_TILT_REFERENCE_SPEED, 0.5);

	assert.ok(
		Math.abs(state.swing + 0.066) < 0.01,
		`expected the swing to settle near -0.066 rad, got ${state.swing}`,
	);
});

test("the swing lags the hand rather than tracking it", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);

	// The reference's angle peaks 7 frames (117ms) after the pointer speed
	// does, so a sixth of the way into a constant-speed drag the lean must
	// still be well short of where it is heading.
	drag(state, 0, PEEL_TILT_REFERENCE_SPEED, 0.08);
	assert.ok(
		state.swing < 0.066 * 0.5,
		`the swing should still be catching up at 80ms, got ${state.swing}`,
	);
});

test("the swing settles back to rest without a visible overshoot", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);

	const x = drag(state, 0, PEEL_TILT_REFERENCE_SPEED, 0.5);
	const peak = state.swing;

	// Hand stops, sheet still held. The reference is visually parked by ~0.35s;
	// its two free decays reached 5% at 0.253s and 0.332s. Measured here:
	// 1.00 / 0.87 (50ms) / 0.56 (100) / 0.31 (150) / 0.13 (200) / 0.04 (250),
	// i.e. 5% at ~0.24s, inside that bracket.
	dragPeel(state, x, 0);
	let overshoot = 0;
	for (let i = 0; i < Math.round(0.35 * 60); i += 1) {
		stepPeel(state, 1 / 60);
		overshoot = Math.min(overshoot, state.swing);
	}

	assert.ok(
		Math.abs(state.swing) < 0.05 * peak,
		`expected the swing within 5% of rest after 0.35s, got ${state.swing} against ${peak}`,
	);
	// zeta 0.83 predicts 1.2% and the reference measured 1.9%; anything the eye
	// can see here would read as a wobble the reference does not have. Measured
	// here: 0.4% of peak.
	assert.ok(
		overshoot > -0.03 * peak,
		`the swing should barely cross rest, dipped to ${overshoot} against ${peak}`,
	);
});

/**
 * The decay shape, not just the settle time. This is what the swing's 0.355s
 * visual duration is actually solved for: the reference's free decay, sampled
 * every 50ms after the pointer stops while the stamp is still held, runs
 * 1.00 / 0.82 / 0.55 / 0.30 / 0.17 / 0.06.
 *
 * Locking it matters because the obvious value for that constant is wrong. The
 * reference's spring was identified against *pointer* velocity as a single
 * stage (omega 12.0, i.e. 0.52s), but our swing is driven by `state.velocityX`,
 * the follow spring's output, so a 35ms stage sits in front of it. At 0.52s
 * this table reads 0.93 / 0.73 / 0.52 / 0.32 / 0.18 — rms 0.162 against the
 * reference, and 171ms of lag versus its 117ms. At 0.355s it is rms 0.030.
 */
test("the swing decays on the reference's measured curve", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);

	const x = drag(state, 0, PEEL_TILT_REFERENCE_SPEED, 0.9);
	const peak = state.swing;
	dragPeel(state, x, 0);

	const reference = [0.82, 0.55, 0.3, 0.17, 0.06];
	const dt = 1 / 240;
	let elapsed = 0;
	let squared = 0;
	for (const [index, expected] of reference.entries()) {
		while (elapsed < (index + 1) * 0.05 - dt / 2) {
			stepPeel(state, dt);
			elapsed += dt;
		}
		squared += (state.swing / peak - expected) ** 2;
	}

	const rms = Math.sqrt(squared / reference.length);
	// 0.030 measured. The bound is deliberately well inside 0.09, which is what
	// a 0.4s duration scores and the nearest value that visibly drags.
	assert.ok(rms < 0.05, `swing decay is off the reference curve, rms ${rms}`);
});

test("releasing returns the sheet to exactly its resting angle", () => {	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);
	drag(state, 0, PEEL_TILT_REFERENCE_SPEED, 0.4);
	assert.ok(state.swing > 0.03, "precondition: the sheet is leaning");

	releasePeel(state);
	run(state, 2);

	// The reference puts the stamp down at the same angle it picked it up,
	// within 0.05 deg across three windows.
	assert.ok(Math.abs(state.swing) < 1e-4, `expected the lean gone, got ${state.swing}`);
	assert.equal(isPeelIdle(state), true, "and nothing left running");
});

test("Reduce Motion drops the swing entirely", () => {
	const state = createPeelState(resolvePeelTuning("foil", undefined, true));
	assert.equal(state.tuning.swing, 0);

	grabPeel(state, 0.5, 0.5);
	drag(state, 0, PEEL_TILT_REFERENCE_SPEED, 0.5);

	assert.equal(state.swing, 0, "no autonomous lean under Reduce Motion");
});

test("a fling is bounded rather than cartwheeling", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.5, 0.5);

	// Far past the fastest pointer speed in the reference clip (1650 CSS px/s).
	drag(state, 0, 12000, 0.6);

	// The clamp is on the spring's target, so the spring itself still carries
	// its 1.2% overshoot past it. Measured peak: 0.1403 rad against a 0.14 limit.
	assert.ok(
		state.swing <= PEEL_SWING_LIMIT * 1.02,
		`the swing must not pass its limit, reached ${state.swing}`,
	);
});

/**
 * The swing pivots near the hand, not the sheet's middle. Measured on the
 * reference at 0.66 +- 0.19 of the way from centre to grab — see
 * `PEEL_SWING_PIVOT`. The scene cannot express that through transform-origin
 * without moving the sheet on grab, so it comes out as a translation that has
 * to vanish exactly when the swing does.
 */
test("the swing pivots toward the grab point, not the sheet's centre", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	const width = 98;
	const height = 129;

	// Nothing to compensate before the sheet leans.
	assert.deepEqual(peelPivotOffset(state, width, height, 0), { x: 0, y: 0 });

	// Grabbed at the bottom edge, dragged right: the pivot sits below the
	// centre, so a clockwise lean pushes the sheet's centre to the right.
	grabPeel(state, 0.5, 0);
	drag(state, 0, PEEL_TILT_REFERENCE_SPEED, 0.4);
	assert.ok(state.swing > 0.03, "precondition: the sheet is leaning");

	const offset = peelPivotOffset(state, width, height, 0);
	// 0.5 * 129 * 0.66 = 42.6px below centre, leaned 0.066 rad: 42.6 * sin =
	// 2.81px across and 42.6 * (1 - cos) = 0.09px down.
	assert.ok(
		Math.abs(offset.x - 2.81) < 0.3,
		`expected about 2.8px of pivot shift, got ${offset.x}`,
	);
	assert.ok(Math.abs(offset.y) < 0.3, `and almost none vertically, got ${offset.y}`);

	// A centre grab has no pivot arm at all, so it rotates about the centre.
	const centred = createPeelState(resolvePeelTuning("foil"));
	grabPeel(centred, 0.5, 0.5);
	drag(centred, 0, PEEL_TILT_REFERENCE_SPEED, 0.4);
	const none = peelPivotOffset(centred, width, height, 0);
	assert.ok(
		Math.abs(none.x) < 1e-9 && Math.abs(none.y) < 1e-9,
		`a centre grab needs no compensation, got ${none.x},${none.y}`,
	);

	// And the resting angle rotates the arm into the page's frame rather than
	// being ignored: at -90 deg the same bottom grab points left, so the shift
	// turns with it.
	const turned = peelPivotOffset(state, width, height, -Math.PI / 2);
	assert.ok(
		Math.abs(turned.y + 2.81) < 0.3,
		`expected the shift to follow the resting angle, got ${turned.x},${turned.y}`,
	);
});

test("putting the sheet down leaves no pivot offset behind", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.2, 0);
	drag(state, 0, PEEL_TILT_REFERENCE_SPEED, 0.4);
	assert.ok(Math.abs(peelPivotOffset(state, 98, 129, 0).x) > 1, "precondition: shifted");

	releasePeel(state);
	run(state, 2);

	// Not asserted as exactly zero: the spring decays to ~1e-16 rad rather than
	// snapping, so what matters is that the residual is far below a pixel. The
	// exact-zero path is the `state.swing === 0` early return, covered above.
	const landed = peelPivotOffset(state, 98, 129, 0);
	assert.ok(
		Math.abs(landed.x) < 1e-6 && Math.abs(landed.y) < 1e-6,
		`the landed sheet must sit where an unswung one would, got ${landed.x},${landed.y}`,
	);
});

/**
 * The landing recoil.
 *
 * The reference does not put the stamp down on its resting pose. Its touchdown
 * frame is a sheared parallelogram — top and bottom edges exactly parallel at
 * -5.27 deg, left and right at -7.21 deg, which against its own rest is +0.60
 * deg of rotation and 1.94 deg of pure in-plane shear. Ours used to land on the
 * rest pose to the pixel: all four edge angles inside 0.3 deg of resting, no
 * follow-through at all. The constants are documented at PEEL_LANDING_SKEW,
 * PEEL_DURATIONS.recoil and PEEL_DAMPING.recoil.
 */
test("the sheet lands with a shear rather than snapping onto its resting pose", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	// The reference's own grab point, near the bottom-left corner.
	grabPeel(state, 0.27, 0.01);
	drag(state, 0, PEEL_TILT_REFERENCE_SPEED / 4, 0.667);

	releasePeel(state);

	let peak = 0;
	let atPeak = 0;
	for (let i = 1; i <= 30; i += 1) {
		stepPeel(state, 1 / 60);
		if (Math.abs(state.skew) > Math.abs(peak)) {
			peak = state.skew;
			atPeak = i / 60;
		}
	}

	const degrees = (peak * 180) / Math.PI;
	assert.ok(
		Math.abs(degrees - 1.94) < 0.1,
		`expected the reference's measured 1.94 deg of shear, got ${degrees}`,
	);
	// An impact imparts a rate, not a displacement, so the shear builds over the
	// first few frames instead of being largest at the instant of contact.
	assert.ok(
		atPeak > 0.05 && atPeak < 0.12,
		`expected the shear to peak just under 0.1s after touchdown, got ${atPeak}`,
	);
});

test("the landing shear unwinds in about half a second and leaves nothing behind", () => {
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.27, 0.01);
	drag(state, 0, PEEL_TILT_REFERENCE_SPEED / 4, 0.667);
	releasePeel(state);

	let crossed = 0;
	let time = 0;
	for (let i = 0; i < 120; i += 1) {
		stepPeel(state, 1 / 60);
		time += 1 / 60;
		if (crossed === 0 && time > 0.2 && state.skew <= 0) {
			crossed = time;
		}
	}

	assert.ok(
		crossed > 0.45 && crossed < 0.6,
		`the shear should be back through zero around 0.5s, crossed at ${crossed}`,
	);

	run(state, 1);
	assert.ok(Math.abs(state.skew) < 1e-4, `expected the shear gone, got ${state.skew}`);
	assert.equal(isPeelIdle(state), true, "and the canvas free to park");});

/**
 * The shear has to hold the planted corner still.
 *
 * A bare CSS skewX holds the element's horizontal centreline instead, which
 * swings the sheet's two halves in opposite directions about its middle. A
 * blind critique read exactly that off our drop frame — the rest-to-drop
 * affine's fixed point 0.21 half-diagonals from centre, inside the artwork,
 * with the top pair of corners translating one way and the bottom pair the
 * other — against the reference's fixed point 1.22 half-diagonals out, sitting
 * on a corner that stayed put to 0.3px. See PEEL_RECOIL_PIVOT.
 */
test("the landing shear pivots at the planted corner, not the sheet's centre", () => {
	const width = 98;
	const height = 129;
	const state = createPeelState(resolvePeelTuning("foil"));
	grabPeel(state, 0.27, 0.01);
	run(state, 0.3);
	releasePeel(state);
	run(state, 0.083);

	assert.ok(state.swing === 0, "precondition: this is the shear alone, with no swing");
	assert.ok(Math.abs(state.skew) > 0.02, "precondition: the sheet is sheared");

	// The grab sits 0.49 of the height below centre. skewX moves a point there
	// by tan(skew) * 63.2px along the sheet's own x, so the compensation is the
	// same distance back, turned into the page by the resting angle.
	const arm = (0.5 - 0.01) * height;
	const expected = -Math.tan(state.skew) * arm;
	const offset = peelPivotOffset(state, width, height, 0);
	assert.ok(
		Math.abs(offset.x - expected) < 1e-9 && Math.abs(offset.y) < 1e-9,
		`expected ${expected}px of shear compensation, got ${offset.x},${offset.y}`,
	);
	assert.ok(
		Math.abs(offset.x) > 1.5,
		`and it has to be worth seeing — about 2px at the shipped peak, got ${offset.x}`,
	);

	// Rotating the sheet turns the compensation with it rather than leaving it
	// in the page's frame: at -90 deg the sheet's own x points up the screen.
	const turned = peelPivotOffset(state, width, height, -Math.PI / 2);
	assert.ok(
		Math.abs(turned.x) < 1e-9 && Math.abs(turned.y + expected) < 1e-9,
		`expected the compensation to follow the resting angle, got ${turned.x},${turned.y}`,
	);

	// A grab through the middle has no arm, so there is nothing to hold still.
	const centred = createPeelState(resolvePeelTuning("foil"));
	grabPeel(centred, 0.27, 0.5);
	run(centred, 0.3);
	releasePeel(centred);
	run(centred, 0.083);
	assert.deepEqual(peelPivotOffset(centred, width, height, 0), { x: 0, y: 0 });
});

test("the half of the sheet away from the grab is the half that lags", () => {
	function land(u: number, v: number): number {
		const state = createPeelState(resolvePeelTuning("foil"));
		grabPeel(state, u, v);
		run(state, 0.3);
		releasePeel(state);
		run(state, 0.083);
		return state.skew;
	}

	// Positive skewX shears the top of the sheet to the left. Held at the
	// bottom-left, as the reference is, the top is the half still in the air and
	// it trails toward the planted side.
	assert.ok(land(0.27, 0.01) > 0.02, "bottom-left grab must trail the top to the left");
	// Mirror the grab in either axis and the trailing corner mirrors with it.
	assert.ok(land(0.73, 0.01) < -0.02, "bottom-right grab must trail the top to the right");
	assert.ok(land(0.27, 0.99) < -0.02, "top-left grab must trail the bottom");
	// Held through the middle there is no far half to lag, and nothing shears.
	assert.equal(land(0.5, 0.5), 0, "a centre grab lands flat");
});

test("Reduce Motion drops the landing recoil with the swing", () => {
	const state = createPeelState(resolvePeelTuning("foil", undefined, true));
	grabPeel(state, 0.27, 0.01);
	run(state, 0.3);
	releasePeel(state);
	run(state, 0.1);

	assert.equal(state.skew, 0, "no shear under Reduce Motion");
	assert.equal(state.skewVelocity, 0, "and nothing seeded to decay");
});

/**
 * The recoil is seeded as a velocity and read back as a peak angle, and the
 * conversion has to survive a retune of either spring constant. It also has to
 * survive the integrator: stepSpring is semi-implicit Euler, which spends a
 * whole step of damping on the seeded velocity before it has moved anything.
 */
test("the recoil seed reproduces the peak it is asked for at any tuning", () => {
	for (const peak of [0.01, 0.0369, 0.08]) {
		const state = createPeelState(resolvePeelTuning("foil"));
		state.skewVelocity = peelRecoilRate(peak);

		let reached = 0;
		for (let i = 0; i < 30; i += 1) {
			stepPeel(state, 1 / 60);
			reached = Math.max(reached, state.skew);
		}

		assert.ok(
			Math.abs(reached - peak) < peak * 0.05,
			`asked for a peak of ${peak}, reached ${reached}`,
		);
	}
});
