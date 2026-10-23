// makeLoop over the shared frame loop (runtime/frame-loop.mjs, integration K4/R1), with a fake rAF,
// IntersectionObserver and matchMedia injected through createFrameLoop's env.
import assert from "node:assert/strict";
import test from "node:test";
import { createFrameLoop } from "../runtime/frame-loop.mjs";
import { getLoop, makeLoop, reducedMotion } from "./runtime/loop-adapter.mjs";

function fakeEnv({ reduce = false } = {}) {
	const frames = [];
	const observers = [];
	let clock = 0;
	const query = { matches: reduce, listeners: new Set(), addEventListener(_, fn) { this.listeners.add(fn); } };
	class IO {
		constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
		observe(target) { this.targets.add(target); }
		unobserve(target) { this.targets.delete(target); }
		disconnect() { this.targets.clear(); }
	}
	const env = {
		raf: fn => { frames.push(fn); return frames.length; },
		now: () => clock,
		IO,
		matchMedia: () => query,
		setTimeout: fn => fn(),
	};
	return {
		env, frames, observers, query,
		/** Run the pending frame callbacks once, advancing the clock by `ms`. Returns how many ran. */
		flush(ms = 16) {
			clock += ms;
			const due = frames.splice(0);
			due.forEach(fn => fn(clock));
			return due.length;
		},
		show(target, visible = true) {
			for (const io of observers) if (io.targets.has(target)) io.callback([{ target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]);
		},
	};
}

test("start() never calls step synchronously, then each frame calls it with dt", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const stage = {};
	const calls = [];
	const lab = makeLoop(stage, dt => { calls.push(dt); }, { loop });
	assert.equal(lab.running, false);
	lab.start();
	assert.equal(lab.running, true);
	assert.deepEqual(calls, [], "no step at start()");
	fake.show(stage);
	assert.deepEqual(calls, [], "no step on becoming visible either");
	fake.flush(16);
	fake.flush(16);
	assert.equal(calls.length, 2);
	assert.ok(calls.every(dt => dt > 0 && dt <= 0.05), "dt is positive and clamped to 0.05 s");
	fake.flush(1000);
	assert.equal(calls.at(-1), 0.05, "a long gap is clamped (K4)");
});

test("step returning false stops the board; stop() lets the next frame sleep it", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const stage = {};
	let n = 0;
	const lab = makeLoop(stage, () => (n += 1) < 3, { loop });
	lab.start();
	fake.show(stage);
	for (let i = 0; i < 6; i += 1) fake.flush();
	assert.equal(n, 3, "the third step returned false");
	assert.equal(lab.running, false);
	assert.equal(loop.stats().awake, 0);
	assert.equal(fake.frames.length, 0, "nothing left scheduled");

	let m = 0;
	const other = makeLoop(stage, () => { m += 1; }, { loop });
	other.start();
	fake.flush();
	assert.equal(m, 1);
	other.stop();
	assert.equal(other.running, false);
	fake.flush();
	fake.flush();
	assert.equal(m, 1, "stopped boards are not stepped");
	assert.equal(loop.stats().awake, 0);
	lab.start();
	assert.equal(lab.running, true, "a stopped loop restarts");
});

test("off screen the step pauses and resumes on screen", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const stage = {};
	let n = 0;
	const lab = makeLoop(stage, () => { n += 1; }, { loop });
	lab.start();
	fake.flush();
	assert.equal(n, 0, "not visible before the first intersection entry");
	fake.show(stage, true);
	fake.flush();
	assert.equal(n, 1);
	fake.show(stage, false);
	fake.flush();
	fake.flush();
	assert.equal(n, 1, "hidden boards never tick");
	assert.equal(lab.running, true, "still running, just paused");
	fake.show(stage, true);
	fake.flush();
	assert.equal(n, 2, "resumes on screen");
});

test("two makeLoops and a third board share one scheduled frame", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const [a, b, c] = [{}, {}, {}];
	const counts = { a: 0, b: 0, c: 0 };
	const la = makeLoop(a, () => { counts.a += 1; }, { loop });
	const lb = makeLoop(b, () => { counts.b += 1; }, { loop });
	const board = loop.register(c, () => { counts.c += 1; return true; });
	la.start();
	lb.start();
	board.wake();
	[a, b, c].forEach(stage => fake.show(stage));
	assert.equal(fake.frames.length, 1, "one pending frame for three awake boards");
	assert.equal(fake.flush(), 1);
	assert.deepEqual(counts, { a: 1, b: 1, c: 1 });
	assert.equal(fake.frames.length, 1, "and one again for the next frame");
	assert.equal(loop.stats().boards, 3);
});

test("reducedMotion follows the shared loop's calm, and the tick receives it", () => {
	const fake = fakeEnv({ reduce: false });
	const loop = createFrameLoop(fake.env);
	const env = { vpkFrameLoop: loop };
	assert.equal(getLoop(env), loop);
	assert.equal(reducedMotion(env), false);
	loop.setReducedMotion(true);
	assert.equal(reducedMotion(env), true);
	const seen = [];
	const stage = {};
	const lab = makeLoop(stage, (dt, now, calm) => { seen.push(calm); return false; }, { loop });
	lab.start();
	fake.show(stage);
	fake.flush();
	assert.deepEqual(seen, [true]);
	loop.setReducedMotion(null);
	assert.equal(reducedMotion(env), false);
});

test("without a shared loop: getLoop is null, labs degrade to no motion, reducedMotion reads the media query", () => {
	assert.equal(getLoop({}), null);
	assert.equal(reducedMotion({ matchMedia: () => ({ matches: true }) }), true);
	assert.equal(reducedMotion({}), false);
	let n = 0;
	const lab = makeLoop({}, () => { n += 1; }, { loop: null });
	lab.start();
	assert.equal(lab.running, false);
	assert.equal(n, 0);
	lab.destroy();
});

test("destroy() unregisters the board and rest() runs on beforeprint", () => {
	const fake = fakeEnv();
	const listeners = {};
	fake.env.global = { addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; } };
	const loop = createFrameLoop(fake.env);
	let rested = 0;
	const lab = makeLoop({}, () => true, { loop, rest: () => { rested += 1; } });
	lab.start();
	assert.equal(loop.stats().boards, 1);
	listeners.beforeprint?.();
	assert.equal(rested, 1);
	lab.destroy();
	assert.equal(loop.stats().boards, 0);
	assert.equal(lab.running, false);
});
