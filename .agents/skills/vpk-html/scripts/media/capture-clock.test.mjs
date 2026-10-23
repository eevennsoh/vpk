// capture-clock.mjs (ws4a P1, items 14 and 15): the virtual clock script run in a vm context with a fake page, the
// cursor overlay in happy-dom, glide paths, cursor options and the init-script wiring. No browser. Assertions compare
// strings, numbers and booleans only. The real-Chromium proof is media/pipeline.browser.test.mjs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { CURSOR_DEFAULTS, CURSOR_OVERLAY_INIT_SCRIPT, VIRTUAL_CLOCK_INIT_SCRIPT, glidePath, installCaptureScripts, makeGlide, normalizeCursor, stepVirtual } from "./capture-clock.mjs";

const require = createRequire(import.meta.url);

/** A page the virtual clock can wrap: real rAF/timers are recorded, animations are plain objects. */
function fakePage({ animations = [] } = {}) {
	const real = { now: 5000, rafs: [], timers: [], cleared: [], thrown: [] };
	const timeline = { name: "document" };
	const sandbox = {
		performance: { now: () => real.now },
		document: { getAnimations: () => animations, timeline },
		requestAnimationFrame: fn => real.rafs.push(fn),
		cancelAnimationFrame: id => real.cleared.push(["raf", id]),
		setTimeout: (fn, ms) => { real.timers.push({ fn, ms }); return real.timers.length; },
		setInterval: (fn, ms) => { real.timers.push({ fn, ms, every: true }); return real.timers.length; },
		clearTimeout: id => real.cleared.push(["timeout", id]),
		clearInterval: id => real.cleared.push(["interval", id]),
	};
	sandbox.self = sandbox;
	vm.createContext(sandbox);
	vm.runInContext(VIRTUAL_CLOCK_INIT_SCRIPT, sandbox);
	return { real, timeline, sandbox, run: code => vm.runInContext(code, sandbox) };
}

test("the virtual clock script parses, installs once and runs on the real clock until armed", () => {
	assert.doesNotThrow(() => new vm.Script(VIRTUAL_CLOCK_INIT_SCRIPT));
	const page = fakePage();
	const first = page.sandbox.__vpkVirtual;
	vm.runInContext(VIRTUAL_CLOCK_INIT_SCRIPT, page.sandbox);
	assert.equal(page.sandbox.__vpkVirtual, first, "installing twice keeps one clock");
	assert.equal(first.armed, false);
	page.run("requestAnimationFrame(() => {}); setTimeout(() => {}, 20); setInterval(() => {}, 30);");
	assert.deepEqual([page.real.rafs.length, page.real.timers.length], [1, 2], "unarmed: rAF and timers go to the real functions");
	assert.equal(page.run("performance.now()"), 5000);
	assert.equal(first.now, 5000);
	assert.throws(() => first.step(16), /step before arm\(\)/);
});

test("armed: rAF waits for step(), runs as one batch with the virtual timestamp, and cancelAnimationFrame removes a callback", () => {
	const page = fakePage();
	const clock = page.sandbox.__vpkVirtual;
	clock.arm();
	page.run(`globalThis.log = []; globalThis.id1 = requestAnimationFrame(t => { log.push(["a", t]); requestAnimationFrame(t2 => log.push(["a2", t2])); });
		globalThis.id2 = requestAnimationFrame(t => log.push(["b", t])); cancelAnimationFrame(id2);`);
	assert.equal(page.real.rafs.length, 0, "no real rAF was scheduled while armed");
	assert.equal(page.run("log.length"), 0, "nothing runs until step()");
	page.real.now = 9999; // the real clock moving changes nothing
	assert.equal(clock.now, 5000);
	clock.step(1000 / 30);
	assert.equal(page.run("JSON.stringify(log)"), JSON.stringify([["a", 5000 + 1000 / 30]]), "one batch; a callback registered inside waits for the next step");
	clock.step(1000 / 30);
	assert.equal(page.run("JSON.stringify(log.map(entry => entry[0]))"), JSON.stringify(["a", "a2"]));
	assert.ok(Math.abs(page.run("performance.now()") - (5000 + 2000 / 30)) < 1e-9);
	assert.equal(page.run("Date.now() - " + page.run("Date.now()")), 0, "Date.now reads the same virtual instant twice");
});

test("armed: timers fire in due order at their own virtual time, intervals repeat, clearTimeout/clearInterval work, errors are rethrown outside", () => {
	const page = fakePage();
	const clock = page.sandbox.__vpkVirtual;
	clock.arm();
	page.run(`globalThis.log = [];
		setTimeout(() => log.push(["t10", performance.now()]), 10);
		setTimeout(() => log.push(["t5", performance.now()]), 5);
		globalThis.gone = setTimeout(() => log.push(["gone"]), 6);
		globalThis.every = setInterval(() => log.push(["i4", performance.now()]), 4);
		setTimeout((a, b) => log.push(["args", a + b]), 2, 3, 4);
		clearTimeout(gone);`);
	clock.step(13);
	const start = 5000;
	assert.equal(page.run("JSON.stringify(log)"), JSON.stringify([["args", 7], ["i4", start + 4], ["t5", start + 5], ["i4", start + 8], ["t10", start + 10], ["i4", start + 12]]));
	page.run("clearInterval(every)");
	clock.step(40);
	assert.equal(page.run("log.length"), 6, "a cleared interval stops");
	assert.equal(page.run("typeof setTimeout(() => {}, 1)"), "number", "virtual ids are numbers too");
	page.run("setTimeout(() => { throw new Error('boom'); }, 1)");
	clock.step(2);
	assert.equal(page.real.timers.length, 1, "the error is rethrown from a real timer, so the page sees it as an uncaught error");
	assert.throws(() => page.real.timers[0].fn(), /boom/);
	page.run("clearTimeout(12)");
	assert.deepEqual(page.real.cleared.at(-1), ["timeout", 12], "a real (small) id still reaches the real clearTimeout");
});

test("armed: Date.now advances with the virtual time from its real origin; disarm returns to the real clock", () => {
	const page = fakePage();
	const clock = page.sandbox.__vpkVirtual;
	const before = page.run("Date.now()");
	clock.arm();
	const armed = page.run("Date.now()");
	assert.ok(Math.abs(armed - before) < 50, "the virtual Date starts at the real one");
	clock.step(1000);
	assert.equal(page.run("Date.now()") - armed, 1000);
	clock.disarm();
	assert.equal(clock.armed, false);
	assert.equal(page.run("performance.now()"), 5000);
	page.run("requestAnimationFrame(() => {})");
	assert.equal(page.real.rafs.length, 1, "after disarm rAF is real again");
});

test("animations (CSS and Web Animations on the document timeline) are paused and set to their elapsed virtual time; scroll-driven ones are left alone", () => {
	const make = (timeline, currentTime) => ({ timeline, currentTime, playState: "running", pause() { this.playState = "paused"; }, play() { this.playState = "running"; } });
	const animations = [];
	const page = fakePage({ animations });
	const own = make(page.timeline, 50);
	const scroll = make({ name: "scroll" }, 25);
	animations.push(own, scroll);
	const clock = page.sandbox.__vpkVirtual;
	clock.arm();
	assert.deepEqual([own.playState, own.currentTime, scroll.playState, scroll.currentTime], ["paused", 50, "running", 25]);
	clock.step(100);
	assert.equal(own.currentTime, 150, "50 ms of its own time plus 100 ms of virtual time");
	const late = make(page.timeline, 0);
	animations.push(late);
	clock.step(40);
	assert.deepEqual([own.currentTime, late.currentTime, late.playState], [190, 40, "paused"], "an animation created mid-run starts at 0 for the step it was found in");
	assert.equal(scroll.currentTime, 25);
	clock.disarm();
	assert.deepEqual([own.playState, late.playState, scroll.playState], ["running", "running", "running"]);
});

test("stepVirtual steps and then waits two real frames inside the page", async () => {
	const calls = [];
	await stepVirtual({ evaluate: async (fn, arg) => {
		globalThis.__vpkVirtual = { step: ms => calls.push(["step", ms]), realFrame: async () => calls.push(["frame"]) };
		try { await fn(arg); } finally { delete globalThis.__vpkVirtual; }
	} }, 1000 / 30);
	assert.deepEqual(calls, [["step", 1000 / 30], ["frame"]]);
});

test("glidePath eases from one point to the next: n points ending exactly on the target, waits that sum to the duration", () => {
	const path = glidePath({ x: 0, y: 100 }, { x: 200, y: 0 }, 400);
	assert.equal(path.length, 25, "one point per 16 ms");
	assert.deepEqual([path.at(-1).x, path.at(-1).y], [200, 0], "ends exactly on the target");
	assert.ok(Math.abs(path.reduce((sum, point) => sum + point.wait, 0) - 400) < 1e-9);
	const xs = path.map(point => point.x);
	assert.ok(xs.every((x, index) => index === 0 || x >= xs[index - 1]), "monotone");
	assert.ok(xs[0] < 200 / 25, "smoothstep starts slower than linear");
	assert.ok(Math.abs(xs[11] - 100) < 8, `the middle is about halfway (${xs[11]})`);
	assert.equal(glidePath({ x: 1, y: 1 }, { x: 9, y: 9 }, 0).length, 1, "zero ms is one step");
	assert.deepEqual(glidePath({ x: 1, y: 1 }, { x: 9, y: 9 }, 0)[0], { x: 9, y: 9, wait: 0 });
});

test("makeGlide places the mouse at its start once, then glides from wherever the last glide ended", async () => {
	const moves = [];
	const waits = [];
	const page = { mouse: { move: async (x, y) => moves.push([Math.round(x), Math.round(y)]) }, waitForTimeout: async ms => waits.push(ms) };
	const glide = makeGlide(page, { start: [10, 20] });
	await glide(110, 20, 64);
	assert.deepEqual(moves[0], [10, 20], "placed at the start first");
	assert.equal(moves.length, 1 + 4, "4 points for 64 ms");
	assert.deepEqual(moves.at(-1), [110, 20]);
	assert.deepEqual(waits, [16, 16, 16, 16]);
	await glide(110, 120, 32);
	assert.deepEqual(moves[5], [110, Math.round(20 + 100 * (0.5 * 0.5 * (3 - 1)))], "the second glide starts from the first one's end (no re-placing)");
	assert.deepEqual(moves.at(-1), [110, 120]);
	assert.equal(moves.length, 5 + 2);
});

test("normalizeCursor: off by default, true gives a 24 px arrow at the viewport centre, options are validated", () => {
	const viewport = { width: 1280, height: 720 };
	assert.equal(normalizeCursor(undefined, viewport), false);
	assert.equal(normalizeCursor(false, viewport), false);
	assert.deepEqual(normalizeCursor(true, viewport), { size: CURSOR_DEFAULTS.size, start: [640, 360] });
	assert.deepEqual(normalizeCursor({ size: 40, start: [5, 6] }, viewport), { size: 40, start: [5, 6] });
	assert.throws(() => normalizeCursor({ size: 3 }, viewport), /size must be 8–96 px/);
	assert.throws(() => normalizeCursor({ start: ["a", 1] }, viewport), /start must be \[x, y\]/);
	assert.throws(() => normalizeCursor({ start: [1, 2, 3] }, viewport, message => { throw new Error(`custom ${message}`); }), /custom start must be \[x, y\]/);
});

test("installCaptureScripts adds the virtual clock only for virtual segments and the cursor overlay only when asked", async () => {
	const added = [];
	const page = { addInitScript: async script => added.push(script) };
	await installCaptureScripts(page, { segments: [{ kind: "hold" }, { kind: "screencast" }], cursor: false });
	assert.deepEqual(added, []);
	await installCaptureScripts(page, { segments: [{ kind: "hold" }, { kind: "virtual" }], cursor: false });
	assert.deepEqual(added, [VIRTUAL_CLOCK_INIT_SCRIPT]);
	added.length = 0;
	await installCaptureScripts(page, { segments: [{ kind: "screencast" }], cursor: { size: 32, start: [1, 1] } });
	assert.deepEqual(added, [CURSOR_OVERLAY_INIT_SCRIPT(32)]);
	assert.match(CURSOR_OVERLAY_INIT_SCRIPT(32), /\)\(\{"size":32\}\);$/);
	assert.doesNotThrow(() => new vm.Script(CURSOR_OVERLAY_INIT_SCRIPT()));
});

test("the cursor overlay follows the mouse, appears on the first move, rings on press, stays grayscale and ignores pointer events", async () => {
	const { GlobalRegistrator } = require("@happy-dom/global-registrator");
	GlobalRegistrator.register({ url: "http://localhost/" });
	try {
		globalThis.self ??= globalThis;
		globalThis.document.body.innerHTML = "<main><button id='b'>Go</button></main>";
		new Function(CURSOR_OVERLAY_INIT_SCRIPT(28))();
		const host = document.querySelector("[data-vpk-capture-cursor]");
		assert.ok(host, "the overlay is added");
		assert.equal(host.parentElement === document.documentElement, true, "outside <body>, so the enhancer's body observer never sees it");
		assert.equal(host.style.opacity, "0", "hidden until the first mouse move");
		assert.match(host.getAttribute("style"), /pointer-events:\s*none/);
		assert.match(host.getAttribute("style"), /width:\s*28px/);
		window.dispatchEvent(new MouseEvent("mousemove", { clientX: 100, clientY: 200 }));
		assert.equal(host.style.opacity, "1");
		assert.equal(host.style.transform, "translate(97px, 198px)", "the arrow tip (3, 2) sits on the pointer");
		assert.deepEqual([globalThis.__vpkCursor.x, globalThis.__vpkCursor.y], [100, 200]);
		const rings = [];
		const ring = host.querySelector("div");
		ring.animate = (frames, options) => rings.push([frames.length, options.duration]);
		window.dispatchEvent(new MouseEvent("mousedown", { clientX: 120, clientY: 210 }));
		assert.deepEqual(rings, [[2, 350]], "one press ring");
		assert.equal(host.style.transform, "translate(117px, 208px)");
		const markup = host.outerHTML;
		assert.doesNotMatch(markup, /#[0-9a-f]{3,8}\b|rgb|hsl/i, "no colour literals");
		for (const colour of markup.match(/\b(?:white|black)\b/g) ?? []) assert.ok(["white", "black"].includes(colour));
		assert.doesNotMatch(markup, /\b(?:red|green|blue|orange|purple|yellow|teal)\b/i, "grayscale only");
		new Function(CURSOR_OVERLAY_INIT_SCRIPT(28))();
		assert.equal(document.querySelectorAll("[data-vpk-capture-cursor]").length, 1, "installing twice adds one");
	} finally {
		delete globalThis.__vpkCursor;
		GlobalRegistrator.unregister();
	}
});
