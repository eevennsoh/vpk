import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MENTION_FLIGHT_OPTIONS, planSessionMentionFlight } from "./session-mention-flight.ts";

const source = { left: 480, top: 650, width: 124, height: 24 };
const destination = { left: 260, top: 250, width: 124, height: 24 };
const viewport = { width: 1_280, height: 800 };

function planFlight(from = source, to = destination, view = viewport) {
	const plan = planSessionMentionFlight({ source: from, destination: to, viewport: view });
	assert.ok(plan);
	return plan;
}

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.000_001, `${actual} should equal ${expected}`);

test("flight starts at the source and ends at the exact destination geometry", () => {
	const target = { ...destination, width: 132, height: 26 };
	const plan = planFlight(source, target);
	const first = plan.frames[0];
	const last = plan.frames.at(-1)!;
	assert.deepEqual([first.x, first.y, first.width, first.height, first.scale], [source.left, source.top, source.width, source.height, 1]);
	close(last.x, target.left); close(last.y, target.top);
	close(last.width, target.width); close(last.height, target.height); close(last.scale, 1);
	assert.ok(plan.durationMs >= 650 && plan.durationMs <= 750);
	assert.ok(plan.frames.every((frame) => frame.transform.startsWith("translate3d(") && frame.transform.includes("scale(")));
});

test("lift peaks while travel continues, then returns smoothly through a modest positional overshoot", () => {
	const plan = planFlight();
	const peak = plan.frames.reduce((best, frame) => frame.scale > best.scale ? frame : best);
	close(peak.scale, 1.15);
	assert.ok(peak.offset >= 0.45 && peak.offset <= 0.6);
	const dx = destination.left - source.left;
	const dy = destination.top - source.top;
	const distance = Math.hypot(dx, dy);
	const projectedDistance = (frame: typeof peak) => ((frame.x + frame.width / 2 - source.left - source.width / 2) * dx + (frame.y + frame.height / 2 - source.top - source.height / 2) * dy) / distance;
	assert.ok(projectedDistance(peak) / distance > 0.7 && projectedDistance(peak) / distance < 0.95);
	const overshoot = Math.max(...plan.frames.map(projectedDistance)) - distance;
	assert.ok(overshoot >= 12 && overshoot <= 16);
	const scaleReturn = plan.frames.filter((frame) => frame.offset >= peak.offset);
	assert.ok(scaleReturn.every((frame, index) => index === 0 || frame.scale <= scaleReturn[index - 1].scale));
	assert.ok(plan.traceOffset > 0 && plan.traceOffset < peak.offset && plan.traceOffset < plan.settleOffset);
	assert.ok((1 - plan.traceOffset) * plan.durationMs >= 350);
	const velocities = plan.frames.slice(1).map((frame, index) => {
		const previous = plan.frames[index];
		const elapsed = (frame.offset - previous.offset) * plan.durationMs;
		return { x: (frame.x - previous.x) / elapsed, y: (frame.y - previous.y) / elapsed };
	});
	assert.ok(velocities.every((velocity, index) => index === 0 || Math.hypot(velocity.x - velocities[index - 1].x, velocity.y - velocities[index - 1].y) < 0.16));
});

test("the full scaled pill stays inside viewport clearance on edge and narrow-screen paths", () => {
	for (const [from, to, view] of [
		[source, destination, viewport],
		[{ left: 8, top: 680, width: 124, height: 24 }, { left: 190, top: 16, width: 124, height: 24 }, { width: 328, height: 740 }],
		[{ left: 20, top: 20, width: 220, height: 24 }, { left: 14, top: 80, width: 220, height: 24 }, { width: 260, height: 160 }],
		[{ left: 800, top: 12, width: 124, height: 24 }, { left: 40, top: 12, width: 124, height: 24 }, viewport],
	] satisfies [typeof source, typeof source, typeof viewport][]) {
		const plan = planFlight(from, to, view);
		for (const frame of plan.frames) {
			assert.ok(frame.x >= 8 - 0.000_001 && frame.y >= 8 - 0.000_001);
			assert.ok(frame.x + frame.width <= view.width - 8 + 0.000_001 && frame.y + frame.height <= view.height - 8 + 0.000_001);
		}
	}
});

test("unusable or clipped endpoints skip the flight instead of landing outside the viewport", () => {
	assert.equal(planSessionMentionFlight({ source, destination: source, viewport }), null);
	for (const endpoint of [{ ...source, width: 0 }, { ...source, left: 0 }, { ...source, top: 790 }]) {
		assert.equal(planSessionMentionFlight({ source: endpoint, destination, viewport }), null);
		assert.equal(planSessionMentionFlight({ source, destination: endpoint, viewport }), null);
	}
});

test("configured flight changes timing and movement while preserving the endpoints", () => {
	const options = { ...DEFAULT_MENTION_FLIGHT_OPTIONS, durationMs: 1100, arc: 0, lift: 0, overshoot: 0, traceOffset: 0.7 };
	const plan = planSessionMentionFlight({ source, destination, viewport }, options);
	assert.ok(plan);
	assert.equal(plan.durationMs, 1100);
	assert.equal(plan.traceOffset, 0.7);
	assert.ok(plan.frames.every((frame) => frame.scale === 1));
	close(plan.frames[0].x, source.left);
	close(plan.frames.at(-1)!.x, destination.left);
	close(plan.frames.at(-1)!.y, destination.top);
});
