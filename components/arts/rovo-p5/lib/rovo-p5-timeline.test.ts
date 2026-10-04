import assert from "node:assert/strict";
import test from "node:test";

import {
	directRovoP5,
	ROVO_P5_CYCLE_SECONDS,
	ROVO_P5_FACET_CLOCKWISE,
	ROVO_P5_FACET_COUNT,
	ROVO_P5_STAGES,
} from "./rovo-p5-timeline.ts";

/** Midpoint of a named stage, in seconds from the start of the cycle. */
function midpointOf(id: string): number {
	let startedAt = 0;
	for (const stage of ROVO_P5_STAGES) {
		if (stage.id === id) return startedAt + stage.seconds / 2;
		startedAt += stage.seconds;
	}
	throw new Error(`unknown stage ${id}`);
}

function durationOf(id: string): number {
	for (const stage of ROVO_P5_STAGES) {
		if (stage.id === id) return stage.seconds;
	}
	throw new Error(`unknown stage ${id}`);
}

function startOf(id: string): number {
	let startedAt = 0;
	for (const stage of ROVO_P5_STAGES) {
		if (stage.id === id) return startedAt;
		startedAt += stage.seconds;
	}
	throw new Error(`unknown stage ${id}`);
}

test("the cycle runs graph first, mark second", () => {
	// The whole point of the reorder: the piece opens on the graph assembling
	// and resolves into the logo, not the other way round.
	const stages = ROVO_P5_STAGES.map((stage: { id: string }) => stage.id);
	assert.ok(
		stages.indexOf("assemble") < stages.indexOf("whip"),
		"the graph has to assemble before it is whipped around",
	);
	assert.ok(
		stages.indexOf("whip") < stages.indexOf("extrude"),
		"the mark's facets only lift once the graph has collapsed",
	);
	// The converge and the settle are one violent move, not two beats.
	assert.ok(!stages.includes("collapse") && !stages.includes("settle"));
	assert.equal(directRovoP5(midpointOf("assemble")).form, 1, "assemble shows the graph");
	assert.equal(directRovoP5(midpointOf("whole")).form, 0, "the cycle resolves on the mark");
});

test("the cycle loops seamlessly", () => {
	const atStart = directRovoP5(0);
	const atEnd = directRovoP5(ROVO_P5_CYCLE_SECONDS);
	assert.equal(atEnd.stage, atStart.stage);
	assert.equal(atEnd.form, atStart.form);
	assert.equal(atEnd.progress, atStart.progress);

	// Negative and multi-cycle times wrap rather than clamping, so scrubbing
	// backwards and long runs both stay on the rails.
	assert.equal(directRovoP5(-ROVO_P5_CYCLE_SECONDS + 1).stage, directRovoP5(1).stage);
	assert.equal(directRovoP5(ROVO_P5_CYCLE_SECONDS * 7 + 1).stage, directRovoP5(1).stage);
});

test("every channel stays inside its range across the whole cycle", () => {
	for (let step = 0; step <= 600; step++) {
		const at = (step / 600) * ROVO_P5_CYCLE_SECONDS;
		const direction = directRovoP5(at);

		for (const [name, value] of [
			["form", direction.form],
			["growth", direction.growth],
			["linkOpacity", direction.linkOpacity],
			["opacity", direction.opacity],
			["progress", direction.progress],
		]) {
			assert.ok(
				typeof value === "number" && value >= 0 && value <= 1,
				`${name} out of range at ${at.toFixed(2)}s: ${value}`,
			);
		}

		assert.ok(direction.extrude > 0 && direction.extrude <= 1, `extrude out of range: ${direction.extrude}`);
		assert.equal(direction.lift.length, ROVO_P5_FACET_COUNT);
		for (const lift of direction.lift) {
			assert.ok(lift >= 0 && lift <= 1.2, `lift out of range: ${lift}`);
		}
		assert.ok(Number.isFinite(direction.spin) && Number.isFinite(direction.tilt));
		assert.ok(direction.perspective > 0);
	}
});

test("only the extrude changes while facets unfold", () => {
	// A camera swing here skewed the mark and threw a facet off it; the lift
	// alone has to carry the beat.
	const seconds: number = durationOf("extrude");
	const base = startOf("extrude");

	for (let step = 0; step <= 200; step++) {
		const at = base + (step / 200) * seconds;
		const direction = directRovoP5(at);
		assert.equal(direction.spin, 0, `camera yawed at ${at.toFixed(2)}s`);
		assert.equal(direction.tilt, 0, `camera tilted at ${at.toFixed(2)}s`);
	}
});

test("the raised facet is emphasised and the rest drop back", () => {
	const stage = ROVO_P5_STAGES.find((entry: { id: string }) => entry.id === "extrude");
	assert.ok(stage, "the extrude stage must exist");
	const base = startOf("extrude");

	// Mid-solo, exactly one facet should be at full brightness.
	const mid = directRovoP5(base + stage.seconds * 0.12);
	const brightest = Math.max(...mid.emphasis);
	const dimmest = Math.min(...mid.emphasis);
	assert.ok(brightest > 0.9, `the raised facet should stay lit, saw ${brightest}`);
	assert.ok(dimmest < 0.6, `the others should drop back, saw ${dimmest}`);

	// And nothing is dimmed once they have all settled.
	for (const stageId of ["land", "whole"]) {
		const settled = directRovoP5(midpointOf(stageId));
		assert.ok(Math.min(...settled.emphasis) === 1, `${stageId} must be evenly lit`);
	}
});

test("the facet sequence is continuous, never stepping", () => {
	// The complaint this answers: facets used to rise over one slot each, hold
	// dead at the peak, and hand attention over with a hard cut, which read as
	// four discrete steps rather than one unfolding move.
	const seconds: number = durationOf("extrude");
	const base = startOf("extrude");
	const samples = 900;

	let previous = directRovoP5(base);
	let maxExtrudeJump = 0;
	let maxEmphasisJump = 0;
	let facetsInMotion = 0;

	for (let step = 1; step <= samples; step++) {
		const current = directRovoP5(base + (step / samples) * seconds);
		let moving = 0;
		for (let facet = 0; facet < ROVO_P5_FACET_COUNT; facet++) {
			const extrudeJump = Math.abs(current.lift[facet] - previous.lift[facet]);
			const emphasisJump = Math.abs(current.emphasis[facet] - previous.emphasis[facet]);
			maxExtrudeJump = Math.max(maxExtrudeJump, extrudeJump);
			maxEmphasisJump = Math.max(maxEmphasisJump, emphasisJump);
			if (extrudeJump > 1e-5) moving++;
		}
		facetsInMotion = Math.max(facetsInMotion, moving);
		previous = current;
	}

	// Per-sample deltas stay small: no channel teleports between frames.
	assert.ok(maxExtrudeJump < 0.01, `extrude stepped by ${maxExtrudeJump.toFixed(4)}`);
	assert.ok(maxEmphasisJump < 0.01, `emphasis cut by ${maxEmphasisJump.toFixed(4)}`);
	// And the rises overlap, so the sequence never stalls between facets.
	assert.ok(facetsInMotion >= 2, `only ${facetsInMotion} facet moved at a time`);
});

test("the camera unwinds so the mark is seen square-on", () => {
	// The complaint this fixes: the logo used to arrive at whatever angle the
	// drift happened to reach, reading as a distorted shape.
	const spinning = directRovoP5(midpointOf("orbit"));
	assert.ok(Math.abs(spinning.spin) > 0.5, "the graph should be spinning");

	for (const stage of ["land", "whole"]) {
		const settled = directRovoP5(midpointOf(stage));
		assert.equal(settled.spin, 0, `${stage} must be square-on`);
		assert.equal(settled.tilt, 0, `${stage} must be untilted`);
	}

	// The whip throws harder than the orbit before it lands.
	const whipStart = startOf("whip");
	const whipStage = ROVO_P5_STAGES.find((entry: { id: string }) => entry.id === "whip");
	assert.ok(whipStage, "the whip stage must exist");

	let peakTilt = 0;
	for (let step = 0; step <= 200; step++) {
		const at = whipStart + (step / 200) * whipStage.seconds;
		peakTilt = Math.max(peakTilt, Math.abs(directRovoP5(at).tilt));
	}
	// Measured against the drift's own range rather than one sampled instant:
	// the throw has to go somewhere the idle camera never does.
	let driftPeak = 0;
	for (let step = 0; step <= 400; step++) {
		driftPeak = Math.max(driftPeak, Math.abs(directRovoP5((step / 400) * whipStart).tilt));
	}
	assert.ok(
		peakTilt > driftPeak * 1.5,
		`the whip should throw past the drift, saw ${peakTilt.toFixed(3)} against ${driftPeak.toFixed(3)}`,
	);

	// And it lands on a whole number of turns, so the mark faces the camera.
	const landed = directRovoP5(whipStart + whipStage.seconds - 0.001);
	const offAxis = Math.abs(((landed.spin % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
	assert.ok(
		offAxis < 0.08 || Math.abs(offAxis - Math.PI * 2) < 0.08,
		`the whip should land square-on, off by ${offAxis}`,
	);
});

test("perspective flattens for the mark and returns for the graph", () => {
	// A strong perspective divide is what distorts the flat logo; the graph
	// wants it, the mark does not.
	assert.ok(directRovoP5(midpointOf("orbit")).perspective > directRovoP5(midpointOf("whole")).perspective);
	assert.ok(directRovoP5(midpointOf("assemble")).perspective > 0.8);
	assert.ok(directRovoP5(midpointOf("whole")).perspective < 0.4);
});

test("facets extrude clockwise, one after another, then settle together", () => {
	const stage = ROVO_P5_STAGES.find((entry: { id: string }) => entry.id === "extrude");
	assert.ok(stage, "the extrude stage must exist");
	const base = startOf("extrude");

	// Thresholds are relative to the peak the director actually reaches, so
	// retuning how far a facet lifts does not break the ordering contract.
	let peakLift = 0;
	for (let step = 0; step <= 400; step++) {
		const { lift } = directRovoP5(base + (step / 400) * stage.seconds);
		peakLift = Math.max(peakLift, ...lift);
	}
	const liftThreshold = peakLift * 0.5;

	// Sample the rise and record when each facet first lifts appreciably.
	const liftedAt = new Array(ROVO_P5_FACET_COUNT).fill(Infinity);
	for (let step = 0; step <= 400; step++) {
		const local = (step / 400) * stage.seconds;
		const { lift } = directRovoP5(base + local);
		for (let facet = 0; facet < ROVO_P5_FACET_COUNT; facet++) {
			if (lift[facet] > liftThreshold && local < liftedAt[facet]) liftedAt[facet] = local;
		}
	}

	for (let facet = 0; facet < ROVO_P5_FACET_COUNT; facet++) {
		assert.ok(Number.isFinite(liftedAt[facet]), `facet ${facet} never lifted`);
	}
	// Clockwise from the top, not in the sampler's painter order: the unfolding
	// should read as travelling around the mark.
	for (let slot = 1; slot < ROVO_P5_FACET_COUNT; slot++) {
		const facet = ROVO_P5_FACET_CLOCKWISE[slot];
		const previous = ROVO_P5_FACET_CLOCKWISE[slot - 1];
		assert.ok(
			liftedAt[facet] > liftedAt[previous],
			`facet ${facet} lifted at ${liftedAt[facet]}, not after facet ${previous} at ${liftedAt[previous]}`,
		);
	}

	// Every facet is up together before they come back down.
	const peak = directRovoP5(base + stage.seconds * 0.72);
	assert.ok(Math.min(...peak.lift) > liftThreshold, `facets not all raised: ${peak.lift}`);

	// And the cycle resolves on the flat mark, not a raised facet.
	const whole = directRovoP5(midpointOf("whole"));
	assert.ok(Math.max(...whole.lift) < 0.05, `mark should be flat: ${whole.lift}`);
});

test("links fade in with the graph and leave before the mark lands", () => {
	// They used to pop in fully formed, which was the jarring part.
	const early = directRovoP5(startOf("assemble") + 0.2);
	const formed = directRovoP5(midpointOf("orbit"));
	assert.ok(early.growth < 0.2, "the graph should still be accreting");
	assert.equal(formed.growth, 1, "the graph should be complete before it spins");

	assert.equal(formed.linkOpacity, 1);
	assert.ok(directRovoP5(midpointOf("whip")).linkOpacity < 0.5, "links should be leaving");
	assert.equal(directRovoP5(midpointOf("extrude")).linkOpacity, 0, "no links over the mark");
});

test("the cycle fades out and back in at the seam", () => {
	assert.ok(directRovoP5(0).opacity < 0.2, "the cycle opens from black");
	assert.ok(directRovoP5(1.2).opacity > 0.9, "and is fully up shortly after");
	assert.ok(directRovoP5(ROVO_P5_CYCLE_SECONDS - 0.05).opacity < 0.1, "and fades before repeating");
});

test("the camera does not stall or lurch handing off to the whip", () => {
	// Regression: the whip used a smoothstep, which has zero derivative at its
	// start — so the yaw froze at the seam and then rushed, which read as a
	// jarring burst of speed rather than a build-up.
	const seam = startOf("whip");
	const step = 1 / 120;
	const rateAt = (at: number) => (directRovoP5(at + step).spin - directRovoP5(at).spin) / step;

	const orbiting = rateAt(seam - 0.4);
	const leaving = rateAt(seam + step);
	assert.ok(
		Math.abs(leaving - orbiting) < orbiting * 0.5,
		`yaw rate jumps ${orbiting.toFixed(3)} -> ${leaving.toFixed(3)} rad/s at the seam`,
	);

	// And it only ever speeds up on the way in, never dips first.
	let previous = orbiting;
	for (let at = seam; at < seam + 1; at += step) {
		const rate = rateAt(at);
		assert.ok(rate > previous - 0.05, `yaw rate dipped to ${rate.toFixed(3)} at ${at.toFixed(2)}s`);
		previous = rate;
	}

	// Acceleration has to be continuous too, not just velocity. A cubic Hermite
	// gave a smooth speed but opened at 7.7 rad/s² against the orbit's zero, and
	// that instant onset still read as a burst; the quintic pins it to zero.
	const accelAt = (at: number) => (rateAt(at + step) - rateAt(at)) / step;
	assert.ok(
		Math.abs(accelAt(seam + step)) < 1,
		`yaw acceleration opens at ${accelAt(seam + step).toFixed(2)} rad/s^2`,
	);
	// It should still build to a real throw, just not instantly.
	let peak = 0;
	for (let at = seam; at < seam + 2; at += step) peak = Math.max(peak, Math.abs(accelAt(at)));
	assert.ok(peak > 3, `the whip should still accelerate hard, peaked at ${peak.toFixed(2)}`);
});

test("the tilt hands over from the drift without stopping dead", () => {
	// Regression: the whip froze the drift's *value* and layered its throw on
	// top, so the tilt stopped at the seam and the throw snapped in. The rate
	// jumped 0.27 -> 1.45 rad/s.
	const seam = startOf("whip");
	const step = 1 / 120;
	const rateAt = (at: number) => (directRovoP5(at + step).tilt - directRovoP5(at).tilt) / step;

	const before = rateAt(seam - 2 * step);
	const after = rateAt(seam + step);
	assert.ok(
		Math.abs(after - before) < 0.15,
		`tilt rate jumps ${before.toFixed(3)} -> ${after.toFixed(3)} at the seam`,
	);
});

test("the mark is held still and square-on before the facets unfold", () => {
	const base = startOf("land");
	const stage = ROVO_P5_STAGES.find((entry: { id: string }) => entry.id === "land");
	assert.ok(stage, "the land stage must exist");

	for (let step = 0; step <= 20; step++) {
		const held = directRovoP5(base + (step / 20) * stage.seconds * 0.99);
		assert.equal(held.form, 0, "the mark should be fully formed");
		assert.equal(held.tilt, 0, "the camera should be level");
		assert.ok(Math.max(...held.lift) < 0.05, `facets should be down: ${held.lift}`);
		assert.ok(Math.min(...held.emphasis) === 1, "nothing should be dimmed yet");
	}
});

test("perspective is continuous across every stage seam", () => {
	// A step here reads as the mark suddenly changing shape.
	const step = 1 / 60;
	let previous = directRovoP5(0).perspective;
	for (let at = 0; at < ROVO_P5_CYCLE_SECONDS; at += step) {
		const current = directRovoP5(at).perspective;
		assert.ok(
			Math.abs(current - previous) < 0.05,
			`perspective jumped ${previous.toFixed(3)} -> ${current.toFixed(3)} at ${at.toFixed(2)}s`,
		);
		previous = current;
	}
});

test("brightness and lift ease in rather than cutting at the facet seam", () => {
	// Regression: emphasis was applied at full strength on the extrude stage's
	// first frame, so facets dropped from full brightness to dimmed instantly —
	// the most visible part of the hand-off from the held mark. The lift had the
	// matching problem, a back-out curve's steep slope at t=0.
	const seam = startOf("extrude");
	const step = 1 / 60;

	const before = directRovoP5(seam - step);
	const after = directRovoP5(seam + step);
	for (let facet = 0; facet < ROVO_P5_FACET_COUNT; facet++) {
		assert.ok(
			Math.abs(after.emphasis[facet] - before.emphasis[facet]) < 0.02,
			`facet ${facet} brightness jumped ${before.emphasis[facet]} -> ${after.emphasis[facet]}`,
		);
	}

	// And nothing lurches into motion: the lift rate builds from a standstill.
	// Lift spans 0..1 over roughly 0.6s, so a facet in full flight moves at
	// about 1.7/s — the first frame has to be a small fraction of that.
	const rateAt = (at: number) =>
		Math.max(
			...directRovoP5(at + step).lift.map((v, f) => Math.abs(v - directRovoP5(at).lift[f])),
		) / step;
	assert.ok(rateAt(seam + step) < 0.2, `facets lift at ${rateAt(seam + step).toFixed(3)}/s on frame one`);
});

test("the facets resolve straight onto the whole mark, then fade", () => {
	// There is no colour cycle between them any more: unfolding hands directly
	// to the settled logo, which holds and then fades out.
	const ids = ROVO_P5_STAGES.map((stage: { id: string }) => stage.id);
	assert.ok(!ids.includes("flow"), "the colour-cycle stage should be gone");
	assert.deepEqual(ids.slice(-3), ["extrude", "whole", "fade"]);

	const whole = directRovoP5(midpointOf("whole"));
	assert.ok(Math.max(...whole.lift) < 0.05, `mark should be flat: ${whole.lift}`);
	assert.equal(Math.min(...whole.emphasis), 1, "every facet should be at full brightness");
	assert.equal(whole.opacity, 1, "the mark should be fully visible before it fades");

	// And the fade actually resolves to nothing before the loop repeats.
	assert.ok(directRovoP5(ROVO_P5_CYCLE_SECONDS - 0.02).opacity < 0.05, "the cycle should fade out");
});

test("the spotlight follows the facet that is actually moving", () => {
	// Regression: the lift and the brightness kept separate schedules and drifted
	// by up to 0.75s, so a facet could be dimmest at the moment it was most
	// raised and the last one got no emphasis at all — which read as a pause
	// before the final facet.
	const base = startOf("extrude");
	const stage = ROVO_P5_STAGES.find((entry: { id: string }) => entry.id === "extrude");
	assert.ok(stage, "the extrude stage must exist");

	const handover: { facet: number; at: number }[] = [];
	let previous = -1;
	for (let step = 0; step <= 1200; step++) {
		const at = (step / 1200) * stage.seconds;
		const { emphasis } = directRovoP5(base + at);
		let brightest = 0;
		for (let facet = 1; facet < ROVO_P5_FACET_COUNT; facet++) {
			if (emphasis[facet] > emphasis[brightest]) brightest = facet;
		}
		if (brightest !== previous) {
			handover.push({ facet: brightest, at });
			previous = brightest;
		}
	}

	// One pass around the mark, clockwise, before it releases.
	const sequence = handover.slice(0, ROVO_P5_FACET_COUNT).map((entry) => entry.facet);
	assert.deepEqual(sequence, [...ROVO_P5_FACET_CLOCKWISE], `spotlight order was ${sequence}`);

	// Evenly spaced: an uneven gap is exactly what reads as a stall. The first
	// hold is skipped because it also covers the effect fading in, and anything
	// past the fourth is the release handing back rather than a facet's turn.
	const gaps: number[] = [];
	for (let index = 2; index < Math.min(handover.length, ROVO_P5_FACET_COUNT); index++) {
		gaps.push(handover[index].at - handover[index - 1].at);
	}
	assert.ok(gaps.length >= 2, "expected a handover between each of the later facets");
	const widest = Math.max(...gaps);
	const tightest = Math.min(...gaps);
	assert.ok(
		widest - tightest < 0.15,
		`handover gaps uneven: ${gaps.map((gap) => gap.toFixed(2)).join(", ")}`,
	);

	// And each facet is genuinely brightest while it is the one travelling.
	for (const { facet, at } of handover.slice(0, ROVO_P5_FACET_COUNT)) {
		const lifting = directRovoP5(base + at + 0.1);
		const settled = directRovoP5(base + at - 0.1);
		assert.ok(
			lifting.lift[facet] > settled.lift[facet],
			`facet ${facet} took the spotlight while not moving`,
		);
	}
});
