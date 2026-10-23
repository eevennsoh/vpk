import assert from "node:assert/strict";
import test from "node:test";
import {
	EASE,
	clamp,
	clockAt,
	cubicBezier,
	cueAt,
	cueFilmTime,
	filmFromClock,
	fixed,
	ganttT,
	ganttX,
	hash01,
	keyframes,
	lerp,
	mulberry32,
	progress,
	segmentAt,
	signed,
	smooth,
	spring,
	springStats,
} from "./runtime/core.mjs";

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ""} ${actual} vs ${expected} ± ${tolerance}`);

test("clamp, lerp, progress and smooth keep the finale-math edge cases", () => {
	assert.equal(clamp(-1), 0);
	assert.equal(clamp(2), 1);
	assert.equal(clamp(5, 0, 10), 5);
	assert.equal(lerp(10, 20, 0.25), 12.5);
	assert.equal(progress(1, 0, 2), 0.5);
	assert.equal(progress(3, 2, 2), 1, "an empty window steps at its end");
	assert.equal(progress(1, 2, 2), 0);
	assert.equal(smooth(0, 1, 0.5), 0.5);
	assert.equal(smooth(0, 1, -1), 0);
	assert.equal(smooth(1, 1, 1), 1, "an empty smoothstep window steps instead of dividing by zero");
});

test("cubicBezier(0, 0.4, 0, 1) is monotone with fixed endpoints", () => {
	const ease = cubicBezier(0, 0.4, 0, 1);
	assert.equal(ease(0), 0);
	assert.equal(ease(1), 1);
	assert.equal(ease(-0.5), 0);
	assert.equal(ease(1.5), 1);
	let previous = 0;
	for (let index = 1; index <= 1000; index += 1) {
		const value = ease(index / 1000);
		assert.ok(value >= previous - 1e-9, `not monotone at ${index / 1000}: ${value} < ${previous}`);
		previous = value;
	}
});

test("EASE holds the vpk tokens next to the ADS curves, with the exit curve keyed `in`", () => {
	assert.deepEqual(Object.keys(EASE), ["vpkOut", "vpkInOut", "outBold", "inOut", "in", "outPractical", "unfold", "linear"]);
	assert.ok(Object.isFrozen(EASE));
	for (const [name, ease] of Object.entries(EASE)) {
		assert.equal(ease(0), 0, `${name}(0)`);
		assert.equal(ease(1), 1, `${name}(1)`);
	}
	assert.ok(EASE.vpkOut(0.5) > 0.9, "vpkOut is the skill's strong ease-out");
	assert.ok(EASE.in(0.5) < 0.5, "the exit curve starts slow");
	near(EASE.vpkInOut(0.5), 0.5, 1e-3, "vpkInOut is symmetric");
});

test("springStats(220, 20) puts the edge at 0.095 s ± 0.006 with a small overshoot", () => {
	const stats = springStats(220, 20);
	near(stats.edge, 0.095, 0.006, "edge");
	assert.ok(stats.overshoot > 0 && stats.overshoot < 0.1, `overshoot ${stats.overshoot}`);
	assert.deepEqual(springStats(100, 20).overshoot, 0, "critical damping never overshoots");
	assert.equal(springStats(60, 6, { horizon: 0.01 }).edge, null, "no edge inside a short horizon");
});

test("spring matches finale-math.ts: 0 at rest, critically damped for ratios of 1 or more", () => {
	assert.equal(spring(0), 0);
	assert.equal(spring(-1), 0);
	near(spring(5, 220, 20), 1, 1e-6, "settles at 1");
	const omega = Math.sqrt(60);
	near(spring(0.1, 60, 45), 1 - Math.exp(-omega * 0.1) * (1 + omega * 0.1), 1e-12, "overdamped uses the critical response");
});

test("mulberry32(2026) and hash01 are stable", () => {
	const random = mulberry32(2026);
	assert.deepEqual([random(), random(), random()], [0.45540769933722913, 0.30849614599719644, 0.6611574492417276]);
	for (let seed = 0; seed < 50; seed += 1) {
		const value = hash01(seed);
		assert.ok(value >= 0 && value < 1);
	}
	assert.equal(hash01(7), hash01(7));
});

test("keyframes: settle keys hold with zero slope; free keys follow Catmull-Rom tangents", () => {
	const keys = [{ time: 0, x: 0, y: 0 }, { time: 1, x: 10, y: 5, settle: true }, { time: 2, x: 20, y: 0 }, { time: 3, x: 30, y: 9 }];
	const at = keyframes(keys, ["x", key => key.y * 2]);
	assert.deepEqual(at(-1), [0, 0], "holds the first key before the range");
	assert.deepEqual(at(9), [30, 18], "holds the last key after the range");
	assert.deepEqual(at(1), [10, 10]);
	const slope = (t, channel) => (at(t + 1e-4)[channel] - at(t - 1e-4)[channel]) / 2e-4;
	near(slope(1, 0), 0, 1e-2, "settle key x slope");
	near(slope(1, 1), 0, 1e-2, "settle key y slope");
	near(slope(2, 0), 10, 1e-2, "free key takes the Catmull-Rom tangent (30 - 10) / 2");
	near(slope(0 + 1e-4, 0), 0, 1e-1, "the first key lands with zero slope");
	assert.deepEqual(keyframes([], ["x"])(1), []);
	assert.deepEqual(keyframes([{ time: 2, x: 1 }, { time: 0, x: 0 }], ["x"])(1), [0.5], "keys are sorted by time");
});

test("fixed and signed format with a true minus sign", () => {
	assert.equal(fixed(1.005, 1), "1.0");
	assert.equal(fixed("2"), "2.00");
	assert.equal(signed(-1.234), "−1.23");
	assert.equal(signed(2), "+2.00");
	assert.equal(signed(0.001), "0.00", "zero after rounding stays unsigned");
	assert.equal(signed(-0.004), "0.00");
});

const FILM = {
	fps: 30,
	duration: 10,
	segments: [
		{ id: "real", label: "live board", kind: "real", film: [0, 2] },
		{ id: "clock", label: "finale", kind: "hold", film: [2, 6], clock: { kind: "linear", start: 0.5, rate: 2 } },
		{ id: "show", label: "show", kind: "hold", film: [6, 8], clock: { kind: "samples", samples: [[0, 0], [0.5, 1], [1, 1], [2, 4]] } },
		{ id: "custom", label: "custom", kind: "hold", film: [8, 10], clock: { kind: "custom", fn: local => local * 10 } },
	],
};

test("segmentAt picks the segment that holds the film time", () => {
	assert.equal(segmentAt(FILM, -1).id, "real", "before the first segment falls back to the first");
	assert.equal(segmentAt(FILM, 0).id, "real");
	assert.equal(segmentAt(FILM, 1.999).id, "real");
	assert.equal(segmentAt(FILM, 2).id, "clock", "a boundary belongs to the segment it starts");
	assert.equal(segmentAt(FILM, 9.5).id, "custom");
	assert.equal(segmentAt(FILM, 99).id, "custom");
	assert.equal(segmentAt({ segments: [] }, 1), null);
	assert.equal(segmentAt(undefined, 1), null);
});

test("clockAt reads real, linear, samples and custom clocks", () => {
	assert.deepEqual(clockAt(FILM, 1.25), { segment: FILM.segments[0], value: 1.25, kind: "real", label: "live board" });
	assert.equal(clockAt(FILM, 3).value, 2.5, "linear: start + rate · local");
	assert.equal(clockAt(FILM, 6.25).value, 0.5, "samples interpolate");
	assert.equal(clockAt(FILM, 6.75).value, 1, "samples hold on a flat run");
	assert.equal(clockAt(FILM, 7.5).value, 2.5);
	assert.equal(clockAt(FILM, 9).value, 10, "custom calls fn(local)");
	assert.equal(clockAt(FILM, 1.5).label, "live board");
	assert.deepEqual(clockAt({}, 4), { segment: null, value: 4, kind: "real", label: "film" });
	assert.throws(() => clockAt({ segments: [{ id: "x", film: [0, 1], clock: { kind: "warp" } }] }, 0.5), /unknown clock kind "warp"/);
});

test("filmFromClock round-trips linear and samples, and throws for custom", () => {
	for (const film of [2, 2.4, 3.3, 5.99]) near(filmFromClock(FILM, "clock", clockAt(FILM, film).value), film, 1e-9, "linear");
	for (const film of [6, 6.1, 6.4, 7.2, 7.9]) near(filmFromClock(FILM, "show", clockAt(FILM, film).value), film, 1e-9, "samples");
	near(filmFromClock(FILM, "show", 1), 6.5, 1e-12, "a flat run inverts to its first crossing");
	near(filmFromClock(FILM, "real", 1.5), 1.5, 1e-12, "real");
	assert.equal(filmFromClock(FILM, "clock", 999), 6, "clamped to the segment's film range");
	assert.equal(filmFromClock(FILM, "clock", -999), 2);
	assert.throws(() => filmFromClock(FILM, "custom", 3), /custom clock/);
	assert.throws(() => filmFromClock(FILM, "nope", 3), /no film segment "nope"/);
	assert.throws(() => filmFromClock({ segments: [{ id: "z", film: [0, 1], clock: { kind: "linear", rate: 0 } }] }, "z", 1), /zero clock rate/);
});

test("cueAt returns the latest cue at or before t + 1e-3", () => {
	const cues = [{ id: "c", film: 4 }, { id: "a", film: 0.5 }, { id: "b", film: 2 }];
	assert.equal(cueAt(cues, 0.2), null, "before the first cue");
	assert.equal(cueAt(cues, 0.4995).id, "a", "within 1e-3 before a cue counts as that cue");
	assert.equal(cueAt(cues, 0.498), null, "just outside the tolerance");
	assert.equal(cueAt(cues, 0.5).id, "a");
	assert.equal(cueAt(cues, 1.999).id, "b");
	assert.equal(cueAt(cues, 3.9).id, "b", "unsorted input still picks the latest cue");
	assert.equal(cueAt(cues, 100).id, "c");
	assert.equal(cueAt([], 1), null);
	assert.equal(cueFilmTime(FILM, { film: 1.25 }), 1.25);
	near(cueFilmTime(FILM, { clock: "clock", t: 2.5 }), 3, 1e-12, "clock + t resolves through filmFromClock");
	assert.equal(cueFilmTime(FILM, { act: "x" }), null);
});

test("ganttX(ganttT(x)) === x across the mapped span, and both clamp outside it", () => {
	const map = { t0: 0, t1: 12, x0: 132, x1: 984 };
	for (let step = 0; step <= 2302; step += 1) {
		const x = Math.round((132 + step * 0.37) * 1e6) / 1e6;
		if (x > 984) break;
		assert.equal(ganttX(ganttT(x, map), map), x, `round trip at ${x}`);
	}
	assert.equal(ganttX(0, map), 132);
	assert.equal(ganttX(12, map), 984);
	assert.equal(ganttX(6, map), 558);
	assert.equal(ganttX(-3, map), 132, "clamped below");
	assert.equal(ganttX(30, map), 984, "clamped above");
	assert.equal(ganttT(0, map), 0);
	assert.equal(ganttT(2000, map), 12);
	near(ganttT(ganttX(4.92, map), map), 4.92, 1e-9);
	assert.equal(ganttX(1, { t0: 2, t1: 2, x0: 5, x1: 9 }), 5, "an empty time span maps to x0");
	assert.equal(ganttT(5, { t0: 1, t1: 3, x0: 7, x1: 7 }), 1, "an empty x span maps to t0");
});
