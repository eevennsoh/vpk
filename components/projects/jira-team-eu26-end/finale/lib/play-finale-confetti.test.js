const assert = require("node:assert/strict");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

async function build(contents, plugins = []) {
	const result = await esbuild.build({
		stdin: { contents, resolveDir: __dirname, loader: "ts" },
		bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent",
		define: { "import.meta.url": JSON.stringify("file:///finale/lib/play-finale-confetti.ts") },
		plugins,
	});
	return loadCjsModuleFromText(result.outputFiles[0].text, "play-finale-confetti-harness.cjs");
}

let player;
async function loadPlayer() {
	player ??= await build('export { createFinaleConfettiPlayer, FINALE_CONFETTI_LOOK, finaleConfettiGlowMask, finaleConfettiGlowMaskAt, FINALE_CONFETTI_GLOW_FRAGMENT } from "./finale-confetti-renderer"; export { FINALE_CONFETTI_TIMING, finaleConfettiRealTime, finaleConfettiShowTime } from "./finale-confetti"; export { TILE_GLOW_FRAGMENT, tileGlowShape } from "./finale-tile-glow"; export { FLASH_COLOR_GLSL } from "./finale-column-flash"; export { finaleConfettiFootHue } from "./finale-confetti-renderer";');
	return player;
}

/** The controller, with its main-thread player swapped for a probe (no GL in node). */
function loadController() {
	return build('export * from "./play-finale-confetti"; export { probe } from "./finale-confetti-renderer"; export { FINALE_CONFETTI_TIMING, finaleConfettiRealTime } from "./finale-confetti";', [{
		name: "renderer-probe",
		setup(context) {
			context.onResolve({ filter: /^\.\/finale-confetti-renderer$/ }, () => ({ path: "renderer", namespace: "probe" }));
			context.onLoad({ filter: /.*/, namespace: "probe" }, () => ({ contents: `
				export const probe = { players: [] };
				export function createFinaleConfettiPlayer(emit) {
					const player = { emit, commands: [], handle(command) { player.commands.push(command); } };
					probe.players.push(player);
					return player;
				}
			` }));
		},
	}]);
}

function fakeFrames() {
	const queue = [];
	return {
		queue,
		install() {
			const previous = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
			globalThis.requestAnimationFrame = (callback) => queue.push(callback);
			globalThis.cancelAnimationFrame = (handle) => { queue[handle - 1] = null; };
			return () => Object.assign(globalThis, previous);
		},
		/** Deliver the next pending frame. */
		step() {
			const index = queue.findIndex(Boolean);
			const callback = queue[index];
			queue[index] = null;
			callback?.();
		},
	};
}

function fakeRenderer() {
	const calls = [];
	return {
		calls,
		create: () => ({
			resize: (width, height, dpr) => calls.push(["resize", width, height, dpr]),
			play: (options) => calls.push(["play", options.id]),
			render: (time, release) => calls.push(["render", Math.round(time * 1000) / 1000, release]),
			clear: () => calls.push(["clear"]),
			dispose: () => calls.push(["dispose"]),
		}),
	};
}

test("the player opens on frame 0 and starts its clock on the first delivered frame", async (t) => {
	const { createFinaleConfettiPlayer, FINALE_CONFETTI_TIMING: T, finaleConfettiRealTime: real } = await loadPlayer();
	const frames = fakeFrames();
	t.after(frames.install());
	let clock = 0;
	const events = [];
	const renderer = fakeRenderer();
	const show = createFinaleConfettiPlayer((event) => events.push(event), { now: () => clock, createRenderer: renderer.create });
	show.handle({ type: "init", canvas: {} });
	show.handle({ type: "play", id: 1, width: 1440, height: 900, dpr: 2, column: COLUMN });
	assert.deepEqual(renderer.calls, [["play", 1], ["render", 0, 0]], "frame 0 is drawn at once, sizing the canvas and uploading the burst");
	// However long that first draw took, the launch starts on the next frame.
	clock = 80;
	frames.step();
	assert.deepEqual(renderer.calls.at(-1), ["render", 0, 0]);
	// The show's clock runs at its own pace: it gathers at the real time of its gather cue.
	clock = 80 + real(T.gathered) * 1000 - 1;
	frames.step();
	assert.deepEqual(events, [], "no hand-off before every piece is in");
	clock += 2;
	frames.step();
	clock += 16;
	frames.step();
	assert.deepEqual(events, [{ type: "gathered", id: 1 }], "gathered is reported exactly once");
	show.handle({ type: "release", id: 2 });
	clock += 16;
	frames.step();
	assert.equal(renderer.calls.at(-1)[2], 0, "a command for another show changes nothing");
	show.handle({ type: "release", id: 1 });
	clock += T.release * 500;
	frames.step();
	assert.equal(renderer.calls.at(-1)[2], 0.5, "the ember blooms over the flash's rise");
	clock += T.release * 500;
	frames.step();
	assert.deepEqual(renderer.calls.slice(-2), [["render", renderer.calls.at(-2)[1], 1], ["clear"]]);
	assert.deepEqual(events.at(-1), { type: "done", id: 1 }, "done once the canvas is transparent again");
	assert.equal(frames.queue.filter(Boolean).length, 0, "and the loop stops");
});

test("rehearsal holds render at once, resume where they froze, and cancel clears", async (t) => {
	const { createFinaleConfettiPlayer, finaleConfettiRealTime: real, finaleConfettiShowTime: showTime } = await loadPlayer();
	const frames = fakeFrames();
	t.after(frames.install());
	let clock = 0;
	const events = [];
	const renderer = fakeRenderer();
	const show = createFinaleConfettiPlayer((event) => events.push(event), { now: () => clock, createRenderer: renderer.create });
	show.handle({ type: "init", canvas: {} });
	show.handle({ type: "play", id: 7, width: 800, height: 600, dpr: 1, column: COLUMN });
	show.handle({ type: "hold", id: 7, time: 0.45 });
	assert.deepEqual(renderer.calls.at(-1), ["render", 0.45, 0], "a hidden page may never deliver a frame, so the hold draws now");
	clock = 5000;
	frames.step();
	assert.deepEqual(renderer.calls.at(-1), ["render", 0.45, 0], "time stays frozen");
	show.handle({ type: "hold", id: 7, time: null });
	clock += 100;
	frames.step();
	const [, resumed] = renderer.calls.at(-1);
	// The fake renderer records times to the millisecond.
	assert.ok(Math.abs(resumed - showTime(real(0.45) + 0.1)) < 1e-3 && resumed > 0.45, "resuming continues from the held second, at the show's pace");
	show.handle({ type: "cancel", id: 7 });
	assert.deepEqual(renderer.calls.at(-1), ["clear"]);
	assert.deepEqual(events, [{ type: "done", id: 7 }]);
});

test("between shows the player parks a transparent canvas at the viewport's size; a live show keeps its own", async (t) => {
	const { createFinaleConfettiPlayer } = await loadPlayer();
	const frames = fakeFrames();
	t.after(frames.install());
	const renderer = fakeRenderer();
	const player = createFinaleConfettiPlayer(() => {}, { now: () => 0, createRenderer: renderer.create });
	player.handle({ type: "init", canvas: {} });
	player.handle({ type: "park", width: 1440, height: 900, dpr: 2 });
	assert.deepEqual(renderer.calls, [["resize", 1440, 900, 2], ["clear"]]);
	player.handle({ type: "play", id: 1, width: 1440, height: 900, dpr: 2, column: COLUMN });
	const drawn = renderer.calls.length;
	player.handle({ type: "park", width: 1280, height: 800, dpr: 2 });
	assert.equal(renderer.calls.length, drawn, "a resize mid-show is the controller's to cancel first");
});

test("a renderer that cannot start reports why, instead of drawing nothing", async () => {
	const { createFinaleConfettiPlayer } = await loadPlayer();
	const events = [];
	const show = createFinaleConfettiPlayer((event) => events.push(event), { createRenderer: () => { throw new Error("no WebGL2"); } });
	show.handle({ type: "init", canvas: {} });
	assert.deepEqual(events, [{ type: "failed", reason: "Error: no WebGL2" }]);
	// Regression: a shader failing inside the constructor's warm-up draw was once undone by the assignment.
	const later = [];
	const warmup = createFinaleConfettiPlayer((event) => later.push(event), {
		createRenderer: (canvas, onFailure) => {
			onFailure("shader rejected");
			return fakeRenderer().create();
		},
	});
	warmup.handle({ type: "init", canvas: {} });
	warmup.handle({ type: "play", id: 1, width: 800, height: 600, dpr: 1, column: COLUMN });
	assert.deepEqual(later, [{ type: "failed", reason: "shader rejected" }, { type: "failed", reason: "no renderer" }], "a failed renderer is never played");
});

test("the column's border glows with the bento tiles' own pulsing border, on the top of both sides, then traced down them to meet along its foot", async () => {
	const { FINALE_CONFETTI_GLOW_FRAGMENT: glow, FINALE_CONFETTI_LOOK: look, FLASH_COLOR_GLSL: flashColor, TILE_GLOW_FRAGMENT: tile, finaleConfettiFootHue: hue, finaleConfettiGlowMask: mask, finaleConfettiGlowMaskAt: at, tileGlowShape } = await loadPlayer();
	// Points in the trace, as shares of the way to where the two leads meet.
	const toMeet = (share) => look.glowMeet * share;
	const joined = look.glowMeet + (1 - look.glowMeet) / 2;
	// The tile shader is wrapped, not edited: every line of it but its entry point survives.
	assert.equal(glow.replace("void tileGlow() {", "void main() {").startsWith(tile), true);
	assert.equal(glow.match(/void main\(\)/g).length, 1, "one entry point");
	// The TS mirror used below is the shader's own expression, measured along the border.
	assert.match(glow, /float along = abs\(s - h\.x\);\s*along = min\(along, uLength - along\);\s*float band = smoothstep\(uBand\.x, uBand\.x \+ uBand\.y, along\) \* \(1\.0 - smoothstep\(uBand\.z, uBand\.z \+ uBand\.w, along\)\);/);
	assert.match(glow, /gl_FragColor = glow \* band;\s*\}\s*$/, "the band masks everything it draws");
	const shape = tileGlowShape(COLUMN, COLUMN.radius, 1, 2);
	const { rect, radius } = shape;
	const [left, right, top, bottom] = [rect.x, rect.x + rect.width, rect.y, rect.y + rect.height];
	const middle = top + rect.height / 2;
	const centre = left + rect.width / 2;
	const lit = (trace, x, y) => at(mask(shape, trace), shape, { x, y });
	// Each point on the right, with its mirror on the left: both sides trace together.
	const both = (trace, x, y) => {
		const value = lit(trace, x, y);
		assert.ok(Math.abs(lit(trace, centre - (x - centre), y) - value) < 1e-9, `mirrored at (${x}, ${y})`);
		return value;
	};
	assert.equal(both(0, right, top + radius + 2), 1, "it glows in on the top of both sides…");
	assert.equal(both(0, right, top + radius + rect.height * 0.1), 1);
	assert.equal(both(0, right, middle), 0);
	// Regression: it once lit a lip of the top edge by each corner, and before that the whole edge.
	for (let trace = 0; trace <= 1.001; trace += 0.05) {
		for (let x = centre; x <= right - radius; x += 8) assert.equal(both(trace, x, top), 0, "…never on the top edge");
	}
	// Regression: its tail held the top until the band had stretched to full length.
	assert.equal(both(toMeet(0.35), right, top + radius + 2), 0, "it lets go of the top as soon as it sets off…");
	assert.ok(both(toMeet(0.15), right, top + radius + 2) < both(0, right, top + radius + 2), "already fading there");
	assert.equal(both(toMeet(0.55), right, middle), 1);
	assert.equal(both(toMeet(0.83), right - radius - 6, bottom), 1, "…rounds the bottom corners…");
	assert.equal(both(toMeet(0.83), centre, bottom), 0, "…and runs in along the foot…");
	// Regression: the two leads met only at the very end, so their join in the middle stayed faint.
	for (let x = left + radius; x <= right - radius; x += 4) assert.equal(lit(joined, x, bottom), 1, "…meeting in its middle before the trace ends, joined end to end…");
	for (const share of [0, 0.25, 0.5, 0.75, 1]) {
		const x = left + radius + (rect.width - radius * 2) * share;
		assert.equal(lit(1, x, bottom), 1, "…until the whole foot glows, where the flash ignites");
	}
	assert.equal(both(1, right, middle), 0);
	// It burns stronger on the foot: at its own strength down the sides, rising as it rounds the bottom corners.
	assert.equal(mask(shape, toMeet(0.55)).foot, 0, "its own strength down the sides…");
	assert.ok(mask(shape, toMeet(0.83)).foot > 0.2 && mask(shape, toMeet(0.83)).foot < 0.8, "…strengthening as it rounds onto the foot…");
	assert.equal(mask(shape, look.glowMeet).foot, 1, "…at full strength once joined…");
	assert.equal(mask(shape, 1).foot, 1, "…and strongest once the whole foot glows, as the flash ignites");
	// Regression: the foot showed whichever one or two spot colours were passing (a red and a green).
	// Regression: only the orbiting spots lit the sides, so where none was passing the trace vanished.
	assert.match(glow, /float heart = mix\([\d.]+, [\d.]+, uFoot\.x\)/, "the whole band burns evenly under its spots, a touch stronger on the foot");
	assert.doesNotMatch(glow, /float even = uFoot\.x/, "not only once it reaches the foot");
	assert.doesNotMatch(glow.slice(glow.indexOf("void main() {")), /pow\(d /, "and squares the border distance without pow(), which is undefined below zero");
	assert.ok(glow.includes(flashColor), "on the foot it takes the flash's own four Rovo colours…");
	// Regression: they cycled every half column, so the foot showed the four colours three times over.
	const path = [];
	for (let y = bottom - 200; y < bottom - radius; y += 10) path.push({ x: left, y });
	for (let x = left + radius; x <= right - radius; x += 10) path.push({ x, y: bottom });
	for (let y = bottom - radius - 1; y >= bottom - 200; y -= 10) path.push({ x: right, y });
	const hues = path.map((point) => hue(shape, point));
	assert.equal(Math.min(...hues), 0, "…blue up the left of the foot…");
	assert.equal(Math.max(...hues), 0.75, "…to green up its right, never cycling back to blue…");
	hues.slice(1).forEach((value, index) => assert.ok(value >= hues[index], "…once each, left to right"));
	assert.ok(Math.abs(hue(shape, { x: centre, y: bottom }) - 0.375) < 1e-9, "purple into orange in the middle, where the flash ignites…");
	// Regression: a smooth blend spread purple-into-orange (a red) across the middle of the foot.
	const span = rect.width / 2 + radius;
	assert.equal(hue(shape, { x: centre - span * 0.3, y: bottom }), 0.25, "…each colour holding its own stretch…");
	assert.equal(hue(shape, { x: centre + span * 0.3, y: bottom }), 0.5, "…and blending only briefly into the next");
	let previous = mask(shape, 0);
	for (let trace = 0.05; trace <= 1.001; trace += 0.05) {
		const next = mask(shape, trace);
		assert.ok(next.lead.from > previous.lead.from, "its lead travels the whole way");
		assert.ok(next.tail.from >= previous.tail.from, "and its tail only ever follows it");
		assert.ok(next.foot >= previous.foot, "and it only ever strengthens");
		previous = next;
	}
	assert.deepEqual(mask(shape, 2), mask(shape, 1), "never past the foot");
});

function fakeDom(t, { offscreen = true } = {}) {
	const previous = { document: globalThis.document, window: globalThis.window, Worker: globalThis.Worker };
	const topLayer = [];
	const listeners = new Map();
	const workers = [];
	const frames = [];
	/** Page changes that need a main-thread commit before a worker's frames can show. */
	const commits = { appends: 0, shows: 0 };
	const element = (tag) => {
		const attributes = new Map();
		const node = {
			tag, dataset: {}, style: {}, children: [], isConnected: false, inert: false, className: "",
			setAttribute: (name, value) => attributes.set(name, String(value)),
			getAttribute: (name) => attributes.get(name) ?? null,
			hasAttribute: (name) => attributes.has(name),
			append: (child) => node.children.push(child),
			remove: () => { node.isConnected = false; },
			matches: (selector) => selector === ":popover-open" && topLayer.includes(node),
			showPopover: () => { commits.shows++; topLayer.push(node); },
			hidePopover: () => { topLayer.splice(topLayer.indexOf(node), 1); },
		};
		if (tag === "canvas" && offscreen) node.transferControlToOffscreen = () => ({ offscreen: true });
		return node;
	};
	globalThis.document = { createElement: element, body: { append: (node) => { commits.appends++; node.isConnected = true; } } };
	globalThis.window = {
		innerWidth: 1440, innerHeight: 900, devicePixelRatio: 3,
		addEventListener: (name, handler) => listeners.set(name, new Set([...(listeners.get(name) ?? []), handler])),
		removeEventListener: (name, handler) => listeners.get(name)?.delete(handler),
		setTimeout: (...args) => setTimeout(...args),
		clearTimeout: (handle) => clearTimeout(handle),
		requestAnimationFrame: (callback) => frames.push(callback),
		cancelAnimationFrame: (handle) => { frames[handle - 1] = null; },
	};
	globalThis.Worker = class {
		constructor(url, options) {
			Object.assign(this, { url: String(url), options, messages: [] });
			workers.push(this);
		}
		postMessage(message, transfer) { this.messages.push({ message, transfer }); }
		terminate() { this.terminated = true; }
	};
	t.after(() => {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete globalThis[key];
			else globalThis[key] = value;
		}
	});
	return {
		topLayer, workers, commits,
		fire: (name) => { for (const handler of [...(listeners.get(name) ?? [])]) handler(); },
		listening: (name) => listeners.get(name)?.size ?? 0,
		/** Deliver every pending frame. */
		frame: () => frames.splice(0).forEach((callback) => callback?.()),
	};
}

const COLUMN = { x: 1090, y: 240, width: 322, height: 640, radius: 8 };
const settled = async (promise) => {
	let done = false;
	void promise.then(() => { done = true; });
	await new Promise((resolve) => setImmediate(resolve));
	return done;
};

test("a worker owns the canvas, parked in the top layer at the viewport's size, so a launch changes nothing on the page", async (t) => {
	const dom = fakeDom(t);
	const { createFinaleConfetti } = await loadController();
	const confetti = createFinaleConfetti();
	confetti.prewarm();
	const [worker] = dom.workers;
	assert.equal(worker.options.type, "module");
	assert.match(worker.url, /finale-confetti\.worker\.ts$/);
	assert.deepEqual(worker.messages[0].message.type, "init");
	assert.deepEqual(worker.messages[0].transfer, [worker.messages[0].message.canvas], "the OffscreenCanvas is transferred, not copied");
	const [layer] = dom.topLayer;
	assert.equal(layer.isConnected, true, "parked on the page while the board is idle");
	assert.equal(layer.getAttribute("aria-hidden"), "true");
	assert.equal(layer.inert, true);
	assert.equal(layer.getAttribute("popover"), "manual");
	assert.equal(layer.dataset.finaleConfetti, "idle");
	assert.match(layer.className, /pointer-events-none/);
	assert.deepEqual(worker.messages.at(-1).message, { type: "park", width: 1440, height: 900, dpr: 2 }, "and sized to the viewport ahead of any show");
	const parked = { ...dom.commits };
	const show = confetti.play(COLUMN);
	// Regression: the layer was inserted, and its canvas resized from 1×1, only
	// as the burst launched. Either needs a main-thread commit before the worker's
	// frames can show, and the column print held the main thread, so the first
	// half-second of the launch never reached the screen.
	assert.deepEqual(dom.commits, parked, "the launch neither inserts nor re-shows the layer");
	assert.equal(layer.dataset.finaleConfetti, "playing");
	const play = worker.messages.at(-1).message;
	assert.deepEqual({ ...play, id: 0 }, { type: "play", id: 0, width: 1440, height: 900, dpr: 2, column: COLUMN }, "it drains onto the Done column's foot, at the parked size");
	worker.onmessage({ data: { type: "gathered", id: play.id + 1 } });
	assert.equal(await settled(show.gathered), false, "another show's report is ignored");
	worker.onmessage({ data: { type: "gathered", id: play.id } });
	assert.equal(await settled(show.gathered), true);
	// A modal dialog opens later in the top layer; raising re-enters above it.
	const dialog = {};
	dom.topLayer.push(dialog);
	show.raise();
	assert.deepEqual(dom.topLayer, [dialog, layer]);
	show.release();
	assert.deepEqual(worker.messages.at(-1).message, { type: "release", id: play.id });
	assert.equal(layer.dataset.finaleConfetti, "playing", "the ember stays up through its bloom");
	worker.onmessage({ data: { type: "done", id: play.id } });
	assert.equal(layer.dataset.finaleConfetti, "idle");
	assert.deepEqual(dom.topLayer, [dialog, layer], "then parks again, ready for a replay");
	confetti.dispose();
	assert.equal(worker.terminated, true);
	assert.equal(layer.isConnected, false, "disposing takes the layer off the page");
	assert.deepEqual(dom.topLayer, [dialog]);
	assert.equal(dom.listening("resize"), 0);
});

test("cancel and resize clear at once; a stale report cannot touch the next show", async (t) => {
	const dom = fakeDom(t);
	const { createFinaleConfetti } = await loadController();
	const confetti = createFinaleConfetti();
	// Without a prewarm, the first show parks the layer itself.
	const first = confetti.play(COLUMN);
	const [worker] = dom.workers;
	const [layer] = dom.topLayer;
	const firstId = worker.messages.at(-1).message.id;
	first.cancel();
	assert.deepEqual(worker.messages.at(-1).message, { type: "cancel", id: firstId });
	assert.equal(layer.dataset.finaleConfetti, "idle");
	assert.equal(await settled(first.gathered), false, "a cancelled show never hands over");
	const second = confetti.play(COLUMN);
	assert.deepEqual(dom.topLayer, [layer], "one canvas serves every show");
	worker.onmessage({ data: { type: "done", id: firstId } });
	assert.equal(layer.dataset.finaleConfetti, "playing", "the first show's late done leaves the second alone");
	globalThis.window.innerWidth = 1280;
	dom.fire("resize");
	assert.equal(layer.dataset.finaleConfetti, "idle", "a resize clears the burst");
	assert.equal(await settled(second.gathered), true, "and lets the finale go on with fresh geometry");
	dom.fire("resize");
	dom.frame();
	assert.deepEqual(worker.messages.at(-1).message, { type: "park", width: 1280, height: 900, dpr: 2 }, "the parked canvas follows the viewport, once per frame");
	assert.equal(worker.messages.filter(({ message }) => message.type === "park").length, 1);
	confetti.dispose();
});

test("a failing worker hands the running show to the main thread; a second failure never holds the finale", async (t) => {
	const dom = fakeDom(t);
	const { createFinaleConfetti, probe } = await loadController();
	const confetti = createFinaleConfetti();
	const warn = console.warn;
	console.warn = () => {};
	t.after(() => { console.warn = warn; });
	const show = confetti.play(COLUMN);
	const [worker] = dom.workers;
	const [workerLayer] = dom.topLayer;
	const { id } = worker.messages.at(-1).message;
	worker.onerror({ message: "worker WebGL unavailable" });
	assert.equal(worker.terminated, true);
	assert.equal(workerLayer.isConnected, false, "the failed canvas leaves the page");
	// Regression: the show once resolved empty here, so the keynote's only run lost its confetti.
	const [main] = probe.players;
	assert.ok(main, "the fallback starts at once, not on a later replay");
	assert.equal(main.commands[0].type, "init");
	assert.deepEqual({ ...main.commands.at(-1), column: null }, { type: "play", id, width: 1440, height: 900, dpr: 2, column: null }, "the same show restarts there");
	assert.equal(dom.topLayer.length, 1, "on its own top-layer canvas");
	assert.equal(await settled(show.gathered), false, "and the finale still waits for its pieces");
	main.emit({ type: "gathered", id });
	assert.equal(await settled(show.gathered), true);
	show.release();
	assert.deepEqual(main.commands.at(-1), { type: "release", id }, "the handle drives whichever renderer is drawing");
	// With no renderer left, the next show releases the finale at once and draws nothing.
	const next = confetti.play(COLUMN);
	main.emit({ type: "failed", reason: "no WebGL2" });
	assert.equal(await settled(next.gathered), true);
	assert.equal(dom.topLayer.length, 0);
	const last = confetti.play(COLUMN);
	assert.equal(await settled(last.gathered), true, "after two failures the finale simply runs without confetti");
	assert.equal(dom.topLayer.length, 0);
	assert.equal(dom.workers.length, 1, "and no worker is retried");
	confetti.dispose();
});

test("a rehearsal hold pauses the stall backstop, and resuming re-arms it from the held second", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	fakeDom(t);
	const { createFinaleConfetti, FINALE_CONFETTI_TIMING: T, finaleConfettiRealTime: real } = await loadController();
	const confetti = createFinaleConfetti();
	const show = confetti.play(COLUMN);
	let released = false;
	void show.gathered.then(() => { released = true; });
	confetti.hold(1.5);
	// Regression: a held rehearsal tripped the backstop, which released the show mid-inspection.
	t.mock.timers.tick(T.gathered * 1000 + 10000);
	await Promise.resolve();
	assert.equal(released, false, "a frozen show is not a stalled one");
	confetti.hold(null);
	t.mock.timers.tick((real(T.gathered) - real(1.5)) * 1000 + 2400);
	await Promise.resolve();
	assert.equal(released, false, "resumed, its gather is due from the held second…");
	t.mock.timers.tick(200);
	await Promise.resolve();
	assert.equal(released, true, "…and the backstop still releases a stall after that");
});

test("a stalled renderer holds the flash for at most a short grace", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	fakeDom(t);
	const { createFinaleConfetti, FINALE_CONFETTI_TIMING: T, finaleConfettiRealTime: real } = await loadController();
	const show = createFinaleConfetti().play(COLUMN);
	let released = false;
	void show.gathered.then(() => { released = true; });
	t.mock.timers.tick(real(T.gathered) * 1000 + 2400);
	await Promise.resolve();
	assert.equal(released, false);
	t.mock.timers.tick(200);
	await Promise.resolve();
	assert.equal(released, true);
});
