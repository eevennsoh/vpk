// Contract tests for the shared frame loop (integration K4): L1-L6 from ws4b section 4.5, plus calm
// passing, rest on beforeprint, stats(), the getFrameLoop singleton and inlining by text.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { FRAME_LOOP_VERSION, createFrameLoop, getFrameLoop } from "./frame-loop.mjs";

const SOURCE_PATH = new URL("./frame-loop.mjs", import.meta.url);
const SOURCE = fs.readFileSync(SOURCE_PATH, "utf8");
// ws4a kit.mjs and ws3 iso/inline.mjs strip exports with this pattern before inlining.
const STRIP_EXPORT = /^export (?=(async )?function|const|let|class)/gm;

// A deterministic stand-in for the browser: manual clock, queued rAF, a recording
// IntersectionObserver, a mutable reduced-motion query and captured timeouts.
function fakeEnv({ io = true, reduced = false } = {}) {
	let clock = 1000;
	let nextId = 1;
	const frames = new Map();
	const observers = [];
	const timeouts = [];
	const queries = [];
	const mqlListeners = new Set();
	const winListeners = new Map();
	const counts = { raf: 0, caf: 0 };
	class FakeIO {
		constructor(callback, options) {
			this.callback = callback;
			this.options = options;
			this.observed = new Set();
			this.disconnects = 0;
			observers.push(this);
		}
		observe(target) {
			this.observed.add(target);
		}
		unobserve(target) {
			this.observed.delete(target);
		}
		disconnect() {
			this.observed.clear();
			this.disconnects += 1;
		}
	}
	const mql = {
		matches: reduced,
		addEventListener(type, fn) {
			if (type === "change") mqlListeners.add(fn);
		},
		removeEventListener(type, fn) {
			mqlListeners.delete(fn);
		},
	};
	const global = {
		addEventListener(type, fn) {
			if (!winListeners.has(type)) winListeners.set(type, new Set());
			winListeners.get(type).add(fn);
		},
		removeEventListener(type, fn) {
			winListeners.get(type)?.delete(fn);
		},
	};
	const env = {
		global,
		now: () => clock,
		raf(fn) {
			counts.raf += 1;
			const id = nextId++;
			frames.set(id, fn);
			return id;
		},
		caf(id) {
			counts.caf += 1;
			frames.delete(id);
		},
		IO: io ? FakeIO : undefined,
		matchMedia(query) {
			queries.push(query);
			return mql;
		},
		setTimeout(fn) {
			timeouts.push(fn);
			return timeouts.length;
		},
	};
	return {
		env,
		counts,
		observers,
		timeouts,
		queries,
		winListeners,
		pending: () => frames.size,
		// Advance the clock and run every queued frame callback once; returns how many ran.
		flush(ms = 16) {
			clock += ms;
			const due = [...frames.values()];
			frames.clear();
			for (const fn of due) fn(clock);
			return due.length;
		},
		advance(ms) {
			clock += ms;
		},
		show(target, visible = true) {
			for (const observer of observers) {
				if (observer.observed.has(target)) observer.callback([{ target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }], observer);
			}
		},
		setMediaReduced(on) {
			mql.matches = on;
			for (const fn of [...mqlListeners]) fn({ matches: on });
		},
		dispatch(type) {
			for (const fn of [...(winListeners.get(type) ?? [])]) fn({ type });
		},
	};
}

// A board that records its ticks and keeps going while `keep()` says so.
function recorder(keep = () => true) {
	const calls = [];
	const tick = (dt, now, calm) => {
		calls.push({ dt, now, calm });
		return keep(calls.length);
	};
	return { calls, tick };
}

test("module shape: no imports, three top-level names, exported API", () => {
	assert.doesNotMatch(SOURCE, /^\s*import\b/m);
	const topLevel = [...SOURCE.matchAll(/^(?:export )?(?:async )?(?:function\*?|const|let|var|class) ([A-Za-z_$][\w$]*)/gm)].map(match => match[1]);
	assert.deepEqual(topLevel, ["FRAME_LOOP_VERSION", "createFrameLoop", "getFrameLoop"]);
	assert.equal(FRAME_LOOP_VERSION, 1);
	const loop = createFrameLoop(fakeEnv().env);
	assert.equal(Object.isFrozen(loop), true);
	assert.equal(loop.version, 1);
	assert.deepEqual(Object.keys(loop).sort(), ["onReducedMotionChange", "reducedMotion", "register", "setReducedMotion", "stats", "version"]);
	const handle = loop.register({}, () => false);
	assert.deepEqual(Object.keys(handle).sort(), ["unregister", "wake"]);
	assert.throws(() => loop.register(null, () => false), TypeError);
	assert.throws(() => loop.register({}, "tick"), TypeError);
	assert.throws(() => loop.onReducedMotionChange(null), TypeError);
});

test("source stays safe to inline in check-html'd pages and small enough for the runtime budgets", () => {
	// ws3 section 4.8 forbidden text plus the colour scanners: no hex-like '#', rgb()/hsl(), {{, URL schemes, markup.
	for (const pattern of [/#/, /\brgba?\(/, /\bhsla?\(/, /\{\{/, /https?:/, /<svg|<animate|<set /, /\bease-in\b/, /\.repeat\(/]) {
		assert.doesNotMatch(SOURCE, pattern);
	}
	// The anatomy blocks share 40,960 B and the iso block 20,480 B with this text inlined.
	assert.ok(Buffer.byteLength(SOURCE) <= 5120, `frame-loop.mjs is ${Buffer.byteLength(SOURCE)} B; keep it at or under 5,120 B`);
});

test("inlined by stripping exports, getFrameLoop() keeps one loop per window (vm)", () => {
	const fake = fakeEnv();
	const context = vm.createContext({
		requestAnimationFrame: fake.env.raf,
		cancelAnimationFrame: fake.env.caf,
		IntersectionObserver: fake.env.IO,
		matchMedia: fake.env.matchMedia,
		performance: { now: fake.env.now },
		setTimeout: fake.env.setTimeout,
	});
	const stripped = SOURCE.replace(STRIP_EXPORT, "");
	assert.doesNotMatch(stripped, /^export /m);
	const block = `(() => {\n"use strict";\n${stripped}\nglobalThis.__loops = (globalThis.__loops || 0) + 1;\ngetFrameLoop();\n})();`;
	vm.runInContext(block, context);
	const first = context.vpkFrameLoop;
	vm.runInContext(block, context);
	assert.equal(context.__loops, 2);
	assert.equal(context.vpkFrameLoop, first, "a second runtime reuses the first loop");
	assert.equal(context.vpkFrameLoop.version, 1);
	for (const leaked of ["createFrameLoop", "getFrameLoop", "FRAME_LOOP_VERSION"]) assert.equal(leaked in context, false, `${leaked} leaked`);
	const stage = {};
	const board = recorder();
	const handle = context.vpkFrameLoop.register(stage, board.tick);
	fake.show(stage);
	handle.wake();
	assert.equal(fake.counts.raf, 1, "the loop uses the window's requestAnimationFrame");
	assert.equal(fake.observers.length, 1);
	assert.equal(fake.observers[0].options.rootMargin, "120px 0px");
	fake.flush(16);
	assert.equal(board.calls.length, 1);
});

test("a window with requestAnimationFrame but no cancelAnimationFrame still cancels safely", () => {
	const fake = fakeEnv();
	const ran = [];
	const win = { requestAnimationFrame: fn => (ran.push(fn), ran.length), IntersectionObserver: fake.env.IO, performance: { now: fake.env.now } };
	const loop = getFrameLoop(win);
	const stage = {};
	const board = recorder();
	loop.register(stage, board.tick).wake();
	fake.show(stage);
	assert.equal(ran.length, 1);
	fake.show(stage, false);
	ran.shift()(0);
	assert.equal(board.calls.length, 0, "a cancelled frame that still fires does nothing");
	assert.equal(loop.stats().frames, 0);
});

test("getFrameLoop(win) uses ??= and never replaces an existing loop", () => {
	const fake = fakeEnv();
	const win = { requestAnimationFrame: fake.env.raf, cancelAnimationFrame: fake.env.caf, IntersectionObserver: fake.env.IO, matchMedia: fake.env.matchMedia, performance: { now: fake.env.now } };
	const loop = getFrameLoop(win);
	assert.equal(win.vpkFrameLoop, loop);
	assert.equal(getFrameLoop(win), loop);
	assert.equal(fake.queries.length, 1, "matchMedia is resolved from the given window");
	const preset = { version: 1, stub: true };
	const other = { vpkFrameLoop: preset };
	assert.equal(getFrameLoop(other), preset);
	assert.equal("vpkFrameLoop" in globalThis, false, "getFrameLoop(win) leaves globalThis alone");
});

test("L1: three awake boards share one rAF per frame; no synchronous tick", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const stages = [{}, {}, {}];
	const boards = stages.map(() => recorder());
	const handles = stages.map((stage, i) => loop.register(stage, boards[i].tick));
	assert.equal(fake.observers.length, 1, "one IntersectionObserver for every board");
	assert.equal(fake.observers[0].observed.size, 3);
	for (const stage of stages) fake.show(stage);
	for (const handle of handles) handle.wake();
	assert.equal(boards.every(board => board.calls.length === 0), true, "register and wake never tick synchronously");
	assert.equal(fake.counts.raf, 1);
	assert.equal(fake.pending(), 1);
	assert.equal(fake.flush(16), 1);
	assert.deepEqual(boards.map(board => board.calls.length), [1, 1, 1]);
	assert.equal(fake.counts.raf, 2, "one rAF requested for the next frame, not three");
	fake.flush(16);
	assert.deepEqual(boards.map(board => board.calls.length), [2, 2, 2]);
	assert.equal(fake.counts.raf, 3);
	assert.deepEqual(loop.stats(), { boards: 3, visible: 3, awake: 3, frames: 2 });
});

test("a board is not visible until its first IntersectionObserver entry", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const stage = {};
	const board = recorder();
	loop.register(stage, board.tick).wake();
	assert.equal(fake.counts.raf, 0, "hidden boards request no frames");
	assert.deepEqual(loop.stats(), { boards: 1, visible: 0, awake: 1, frames: 0 });
	fake.show(stage);
	assert.equal(fake.counts.raf, 1);
	fake.flush(16);
	assert.equal(board.calls.length, 1);
});

test("L2: zero frames once every board returns false or is hidden", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const a = {};
	const b = {};
	const settling = recorder(n => n < 2);
	const steady = recorder();
	loop.register(a, settling.tick).wake();
	const steadyHandle = loop.register(b, steady.tick);
	fake.show(a);
	fake.show(b);
	steadyHandle.wake();
	fake.flush(16);
	fake.flush(16);
	assert.equal(settling.calls.length, 2, "the settling board stopped after returning false");
	assert.equal(loop.stats().awake, 1);
	fake.show(b, false);
	assert.equal(fake.pending(), 0, "the pending frame is cancelled when no board is due");
	const framesBefore = loop.stats().frames;
	const rafBefore = fake.counts.raf;
	assert.equal(fake.flush(1000), 0);
	assert.equal(fake.counts.raf, rafBefore);
	assert.equal(loop.stats().frames, framesBefore);
	assert.equal(steady.calls.length, 2, "hidden boards never tick");
	fake.show(b, true);
	fake.flush(16);
	assert.equal(steady.calls.length, 3, "an awake board resumes when it comes back on screen");
	assert.ok(steady.calls[2].dt <= 0.016 + 1e-9, "dt restarts from the moment it became visible");
});

test("L2: an awake board that is hidden never ticks while another board keeps the loop running", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const seen = {};
	const offscreen = {};
	const visible = recorder();
	const hidden = recorder();
	loop.register(seen, visible.tick).wake();
	loop.register(offscreen, hidden.tick).wake();
	fake.show(seen);
	fake.show(offscreen);
	fake.flush(16);
	fake.show(offscreen, false);
	fake.flush(16);
	fake.flush(16);
	assert.equal(visible.calls.length, 3);
	assert.equal(hidden.calls.length, 1, "ticks stop the moment the stage leaves the screen");
	assert.deepEqual(loop.stats(), { boards: 2, visible: 1, awake: 2, frames: 3 });
});

test("L3: dt is in seconds, clamped to [0, 0.05], and now is the loop clock", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const stage = {};
	const board = recorder();
	const handle = loop.register(stage, board.tick);
	fake.show(stage);
	handle.wake();
	fake.flush(16);
	fake.flush(1000);
	fake.flush(0);
	assert.ok(Math.abs(board.calls[0].dt - 0.016) < 1e-9);
	assert.equal(board.calls[1].dt, 0.05);
	assert.equal(board.calls[2].dt, 0);
	assert.equal(board.calls[1].now, 1000 + 16 + 1000);
});

test("L4: a throwing tick is rethrown on setTimeout and the other boards keep running", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const stages = [{}, {}, {}];
	const first = recorder();
	const third = recorder();
	let thrown = 0;
	const failing = () => {
		thrown += 1;
		throw new Error("tick boom");
	};
	const ticks = [first.tick, failing, third.tick];
	stages.forEach((stage, i) => {
		const handle = loop.register(stage, ticks[i]);
		fake.show(stage);
		handle.wake();
	});
	fake.flush(16);
	assert.equal(first.calls.length, 1);
	assert.equal(third.calls.length, 1);
	assert.equal(fake.timeouts.length, 1);
	assert.throws(() => fake.timeouts[0](), /tick boom/);
	assert.equal(loop.stats().awake, 2, "the failing board goes to sleep instead of throwing every frame");
	fake.flush(16);
	assert.equal(thrown, 1);
	assert.equal(first.calls.length, 2);
	assert.equal(third.calls.length, 2);
});

test("L5: a reduced-motion change wakes every board, passes calm and fires listeners", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	assert.deepEqual(fake.queries, ["(prefers-reduced-motion: reduce)"]);
	assert.equal(loop.reducedMotion(), false);
	const stages = [{}, {}, {}];
	const boards = stages.map(() => recorder(() => false));
	stages.forEach((stage, i) => {
		loop.register(stage, boards[i].tick);
		fake.show(stage);
	});
	assert.equal(fake.counts.raf, 0, "nothing is awake yet");
	const heard = [];
	const unsubscribe = loop.onReducedMotionChange(calm => heard.push(calm));
	fake.setMediaReduced(true);
	assert.equal(loop.reducedMotion(), true);
	assert.deepEqual(heard, [true]);
	assert.equal(loop.stats().awake, 3);
	assert.equal(fake.counts.raf, 1, "one frame for all woken boards");
	fake.flush(16);
	assert.deepEqual(boards.map(board => board.calls.map(call => call.calm)), [[true], [true], [true]]);
	assert.equal(loop.stats().awake, 0);
	// An override wins over the media query; media changes under an override are silent.
	loop.setReducedMotion(false);
	assert.equal(loop.reducedMotion(), false);
	assert.deepEqual(heard, [true, false]);
	fake.flush(16);
	assert.deepEqual(boards[0].calls.map(call => call.calm), [true, false]);
	fake.setMediaReduced(false);
	fake.setMediaReduced(true);
	assert.deepEqual(heard, [true, false]);
	loop.setReducedMotion(false);
	assert.deepEqual(heard, [true, false], "setting the same effective value is not a change");
	loop.setReducedMotion(null);
	assert.equal(loop.reducedMotion(), true, "null clears the override");
	assert.deepEqual(heard, [true, false, true]);
	unsubscribe();
	loop.setReducedMotion(false);
	assert.deepEqual(heard, [true, false, true], "unsubscribed listeners are not called");
	const failing = loop.onReducedMotionChange(() => {
		throw new Error("listener boom");
	});
	loop.setReducedMotion(true);
	assert.throws(() => fake.timeouts.at(-1)(), /listener boom/);
	failing();
});

test("L6: one IntersectionObserver, unobserved per stage and disconnected after the last unregister", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const shared = {};
	const alone = {};
	const one = loop.register(shared, () => true);
	const two = loop.register(shared, () => true);
	const three = loop.register(alone, () => true);
	assert.equal(fake.observers.length, 1);
	const [observer] = fake.observers;
	assert.equal(observer.observed.size, 2, "a stage is observed once however many boards share it");
	fake.show(shared);
	one.wake();
	two.wake();
	assert.equal(fake.pending(), 1);
	one.unregister();
	assert.equal(observer.observed.has(shared), true, "still observed while a peer board remains");
	two.unregister();
	assert.equal(observer.observed.has(shared), false);
	assert.equal(fake.pending(), 0, "the pending frame is cancelled when nothing is due");
	assert.equal(observer.disconnects, 0);
	three.unregister();
	assert.equal(observer.disconnects, 1);
	three.unregister();
	three.wake();
	assert.equal(observer.disconnects, 1, "unregister and wake after unregister are no-ops");
	assert.deepEqual(loop.stats(), { boards: 0, visible: 0, awake: 0, frames: 0 });
	const again = loop.register(alone, () => false);
	assert.equal(fake.observers.length, 2, "a later registration creates a fresh observer");
	again.unregister();
	assert.equal(fake.observers[1].disconnects, 1);
});

test("a board added to an already-visible stage inherits its visibility", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const stage = {};
	loop.register(stage, () => false);
	fake.show(stage);
	const late = recorder(() => false);
	loop.register(stage, late.tick).wake();
	assert.equal(fake.counts.raf, 1);
	fake.flush(16);
	assert.equal(late.calls.length, 1);
});

test("beforeprint calls each registration's rest and the listener goes with the last board", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const rested = [];
	const a = loop.register({}, () => false, { rest: () => rested.push("a") });
	const b = loop.register({}, () => false);
	const c = loop.register({}, () => false, { rest: () => rested.push("c") });
	assert.equal(fake.winListeners.get("beforeprint")?.size, 1, "one beforeprint listener for the page");
	fake.dispatch("beforeprint");
	assert.deepEqual(rested, ["a", "c"]);
	const d = loop.register({}, () => false, {
		rest: () => {
			throw new Error("rest boom");
		},
	});
	fake.dispatch("beforeprint");
	assert.deepEqual(rested, ["a", "c", "a", "c"], "a throwing rest does not stop the others");
	assert.throws(() => fake.timeouts.at(-1)(), /rest boom/);
	for (const handle of [a, b, c, d]) handle.unregister();
	assert.equal(fake.winListeners.get("beforeprint")?.size, 0);
	fake.dispatch("beforeprint");
	assert.equal(rested.length, 4);
});

test("stats() counts boards, visible, awake and frames", () => {
	const fake = fakeEnv();
	const loop = createFrameLoop(fake.env);
	const seen = {};
	const unseen = {};
	const settled = loop.register(seen, recorder(() => false).tick);
	loop.register(seen, recorder().tick).wake();
	loop.register(unseen, recorder().tick).wake();
	fake.show(seen);
	assert.deepEqual(loop.stats(), { boards: 3, visible: 2, awake: 2, frames: 0 });
	fake.flush(16);
	assert.deepEqual(loop.stats(), { boards: 3, visible: 2, awake: 2, frames: 1 });
	settled.unregister();
	assert.deepEqual(loop.stats(), { boards: 2, visible: 1, awake: 2, frames: 1 });
});

test("without IntersectionObserver every board counts as visible", () => {
	const fake = fakeEnv({ io: false });
	const loop = createFrameLoop(fake.env);
	const board = recorder(() => false);
	loop.register({}, board.tick).wake();
	assert.equal(fake.observers.length, 0);
	assert.equal(fake.counts.raf, 1);
	fake.flush(16);
	assert.equal(board.calls.length, 1);
});

test("starts calm when the media query already matches", () => {
	const fake = fakeEnv({ reduced: true });
	const loop = createFrameLoop(fake.env);
	assert.equal(loop.reducedMotion(), true);
	const board = recorder(() => false);
	const stage = {};
	loop.register(stage, board.tick).wake();
	fake.show(stage);
	fake.flush(16);
	assert.equal(board.calls[0].calm, true);
});
