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
	player ??= await build('export { createFinaleConfettiPlayer, finaleConfettiGlowMask, finaleConfettiGlowMaskAt, FINALE_CONFETTI_GLOW_FRAGMENT } from "./finale-confetti-renderer"; export { FINALE_CONFETTI_TIMING } from "./finale-confetti"; export { TILE_GLOW_FRAGMENT } from "./finale-tile-glow";');
	return player;
}

/** The controller, with its main-thread player swapped for a probe (no GL in node). */
function loadController() {
	return build('export * from "./play-finale-confetti"; export { probe } from "./finale-confetti-renderer"; export { FINALE_CONFETTI_TIMING } from "./finale-confetti";', [{
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
			play: (options) => calls.push(["play", options.id]),
			render: (time, release) => calls.push(["render", Math.round(time * 1000) / 1000, release]),
			clear: () => calls.push(["clear"]),
			dispose: () => calls.push(["dispose"]),
		}),
	};
}

test("the player opens on frame 0 and starts its clock on the first delivered frame", async (t) => {
	const { createFinaleConfettiPlayer, FINALE_CONFETTI_TIMING: T } = await loadPlayer();
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
	clock = 80 + T.gathered * 1000 - 1;
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
	const { createFinaleConfettiPlayer } = await loadPlayer();
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
	assert.deepEqual(renderer.calls.at(-1), ["render", 0.55, 0], "resuming continues from the held second");
	show.handle({ type: "cancel", id: 7 });
	assert.deepEqual(renderer.calls.at(-1), ["clear"]);
	assert.deepEqual(events, [{ type: "done", id: 7 }]);
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

test("the column's border glows with the bento tiles' own pulsing border, pulled up from its foot to its top", async () => {
	const { FINALE_CONFETTI_GLOW_FRAGMENT: glow, TILE_GLOW_FRAGMENT: tile, finaleConfettiGlowMask: mask, finaleConfettiGlowMaskAt: at } = await loadPlayer();
	// The tile shader is wrapped, not edited: every line of it but its entry point survives.
	assert.equal(glow.replace("void tileGlow() {", "void main() {").startsWith(tile), true);
	assert.equal(glow.match(/void main\(\)/g).length, 1, "one entry point");
	// The TS mirror used below is the shader's own expression.
	assert.match(glow, /tileGlow\(\);\s*gl_FragColor \*= smoothstep\(uBand\.x, uBand\.x \+ uBand\.y, vPoint\.y\) \* \(1\.0 - smoothstep\(uBand\.z, uBand\.z \+ uBand\.w, vPoint\.y\)\);/);
	const top = COLUMN.y;
	const middle = COLUMN.y + COLUMN.height / 2;
	const bottom = COLUMN.y + COLUMN.height;
	const lit = (trace, y) => at(mask(COLUMN, trace), y);
	assert.equal(lit(0, bottom), 1, "it lights on the foot…");
	assert.equal(lit(0, middle), 0);
	assert.equal(lit(0.5, bottom), 0, "…is pulled off it as it climbs…");
	assert.equal(lit(0.5, middle), 1);
	assert.equal(lit(1, top), 1, "…and ends round the top");
	assert.equal(lit(1, middle), 0);
	assert.equal(lit(1, bottom), 0);
	let previous = mask(COLUMN, 0);
	for (let trace = 0.05; trace <= 1.001; trace += 0.05) {
		const next = mask(COLUMN, trace);
		assert.ok(next.lead.from < previous.lead.from, "its top edge rises the whole way");
		assert.ok(next.tail.from <= previous.tail.from, "and its bottom only ever follows it up");
		previous = next;
	}
	assert.deepEqual(mask(COLUMN, 2), mask(COLUMN, 1), "never past the top");
});

function fakeDom(t, { offscreen = true } = {}) {
	const previous = { document: globalThis.document, window: globalThis.window, Worker: globalThis.Worker };
	const topLayer = [];
	const listeners = new Map();
	const workers = [];
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
			showPopover: () => { topLayer.push(node); },
			hidePopover: () => { topLayer.splice(topLayer.indexOf(node), 1); },
		};
		if (tag === "canvas" && offscreen) node.transferControlToOffscreen = () => ({ offscreen: true });
		return node;
	};
	globalThis.document = { createElement: element, body: { append: (node) => { node.isConnected = true; } } };
	globalThis.window = {
		innerWidth: 1440, innerHeight: 900, devicePixelRatio: 3,
		addEventListener: (name, handler) => listeners.set(name, handler),
		removeEventListener: (name) => listeners.delete(name),
		setTimeout: (...args) => setTimeout(...args),
		clearTimeout: (handle) => clearTimeout(handle),
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
	return { topLayer, listeners, workers };
}

const COLUMN = { x: 1090, y: 240, width: 322, height: 640, radius: 8 };
const settled = async (promise) => {
	let done = false;
	void promise.then(() => { done = true; });
	await new Promise((resolve) => setImmediate(resolve));
	return done;
};

test("a worker owns the canvas; the layer sits in the top layer and hands over on the worker's word", async (t) => {
	const dom = fakeDom(t);
	const { createFinaleConfetti } = await loadController();
	const confetti = createFinaleConfetti();
	confetti.prewarm();
	const [worker] = dom.workers;
	assert.equal(worker.options.type, "module");
	assert.match(worker.url, /finale-confetti\.worker\.ts$/);
	assert.deepEqual(worker.messages[0].message.type, "init");
	assert.deepEqual(worker.messages[0].transfer, [worker.messages[0].message.canvas], "the OffscreenCanvas is transferred, not copied");
	const show = confetti.play(COLUMN);
	const [layer] = dom.topLayer;
	assert.equal(layer.getAttribute("aria-hidden"), "true");
	assert.equal(layer.inert, true);
	assert.equal(layer.getAttribute("popover"), "manual");
	assert.equal(layer.dataset.finaleConfetti, "");
	assert.match(layer.className, /pointer-events-none/);
	const play = worker.messages.at(-1).message;
	assert.deepEqual({ ...play, id: 0 }, { type: "play", id: 0, width: 1440, height: 900, dpr: 2, column: COLUMN }, "it drains onto the Done column's foot");
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
	assert.equal(layer.isConnected, true, "the ember stays up through its bloom");
	worker.onmessage({ data: { type: "done", id: play.id } });
	assert.equal(layer.isConnected, false);
	assert.deepEqual(dom.topLayer, [dialog]);
	confetti.dispose();
	assert.equal(worker.terminated, true);
});

test("cancel and resize clear at once; a stale report cannot touch the next show", async (t) => {
	const dom = fakeDom(t);
	const { createFinaleConfetti } = await loadController();
	const confetti = createFinaleConfetti();
	const first = confetti.play(COLUMN);
	const [worker] = dom.workers;
	const firstId = worker.messages.at(-1).message.id;
	first.cancel();
	assert.deepEqual(worker.messages.at(-1).message, { type: "cancel", id: firstId });
	assert.equal(dom.topLayer.length, 0);
	assert.equal(await settled(first.gathered), false, "a cancelled show never hands over");
	const second = confetti.play(COLUMN);
	const [layer] = dom.topLayer;
	worker.onmessage({ data: { type: "done", id: firstId } });
	assert.equal(layer.isConnected, true, "the first show's late done leaves the second alone");
	dom.listeners.get("resize")();
	assert.equal(layer.isConnected, false, "a resize clears the burst");
	assert.equal(await settled(second.gathered), true, "and lets the finale go on with fresh geometry");
});

test("a failing worker falls back to the main thread, then to no confetti; the finale is never held", async (t) => {
	const dom = fakeDom(t);
	const { createFinaleConfetti, probe } = await loadController();
	const confetti = createFinaleConfetti();
	t.after(() => confetti.dispose());
	const warn = console.warn;
	console.warn = () => {};
	t.after(() => { console.warn = warn; });
	const first = confetti.play(COLUMN);
	dom.workers[0].onerror({ message: "module workers unavailable" });
	assert.equal(await settled(first.gathered), true, "the show goes on");
	assert.equal(dom.topLayer.length, 0);
	assert.equal(dom.workers[0].terminated, true);
	const second = confetti.play(COLUMN);
	assert.equal(dom.workers.length, 1, "no second worker");
	const [main] = probe.players;
	assert.equal(main.commands[0].type, "init");
	assert.equal(main.commands.at(-1).type, "play");
	main.emit({ type: "failed", reason: "no WebGL2" });
	assert.equal(await settled(second.gathered), true);
	const third = confetti.play(COLUMN);
	assert.equal(await settled(third.gathered), true, "after two failures the finale simply runs without confetti");
	assert.equal(dom.topLayer.length, 0);
});

test("a stalled renderer holds the flash for at most a short grace", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	fakeDom(t);
	const { createFinaleConfetti, FINALE_CONFETTI_TIMING: T } = await loadController();
	const show = createFinaleConfetti().play(COLUMN);
	let released = false;
	void show.gathered.then(() => { released = true; });
	t.mock.timers.tick(T.gathered * 1000 + 2400);
	await Promise.resolve();
	assert.equal(released, false);
	t.mock.timers.tick(200);
	await Promise.resolve();
	assert.equal(released, true);
});
