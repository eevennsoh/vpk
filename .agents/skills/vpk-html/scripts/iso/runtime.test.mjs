// iso runtime: hairline clocks, the select/explode reducers, and createIsoRuntime driven in
// happy-dom with a fake frame loop (ticks are called by hand, so timing is deterministic).
// Assertions compare strings, numbers and booleans only.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as core from "./core.mjs";
import { renderRegion } from "./emit.mjs";
import { blink, tagLines } from "./manual-runtime.mjs";
import { REST_MOTION } from "./accent.mjs";
import { ISO_CSS } from "./runtime-css.mjs";
import { bezier, createIsoRuntime, REST_IDLE_MS, restMs, EASE_LIFT, explodeReducer, explodeTarget, selectDelay, selectReducer, slideFit, spring, stepS, tdone, tset, tval, tween } from "./runtime.mjs";
import { buildScene } from "./scene.mjs";

const SOURCE = fs.readFileSync(new URL("./runtime.mjs", import.meta.url), "utf8");
const EXEMPLAR = JSON.parse(fs.readFileSync(new URL("./briefs/exploded-stack.json", import.meta.url), "utf8"));
const SELECT = {
	schema: "vpk-iso-brief/1",
	id: "select-kinds",
	figId: "FIG_003",
	title: "Select kinds",
	label: "A tray of two cards beside a drum and a block; each lifts when pointed at.",
	parts: [
		{ id: "tray", kind: "tray", at: [0, 0, 0], size: [60, 100, 6], label: "tray" },
		{ id: "card-a", kind: "plate", at: [5, 8, 4], size: [50, 40, 2], label: "card a" },
		{ id: "card-b", kind: "plate", at: [5, 54, 4], size: [50, 40, 2], label: "card b" },
		{ id: "drum", kind: "cylinder", at: [110, 40, 0], size: [16, 16, 24], label: "drum" },
		{ id: "block", kind: "box", at: [90, 90, 0], size: [30, 24, 14], label: "block" },
	],
	focal: "drum",
	assemble: { layers: [["tray"], ["card-a", "card-b"], ["drum", "block"]] },
	interact: { behavior: "select", rest: "rest" },
};
const RECT = { left: 0, top: 0, right: 720, bottom: 450, width: 720, height: 450, x: 0, y: 0 };

// A reference cubic-bezier (Newton) to check the bisection port.
function referenceBezier(x1, y1, x2, y2) {
	const at = (a, b, u) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
	const dAt = (a, b, u) => 3 * a * (1 - u) ** 2 + 6 * (b - a) * u * (1 - u) + 3 * (1 - b) * u * u;
	return t => {
		let u = t;
		for (let i = 0; i < 50; i++) u -= (at(x1, x2, u) - t) / dAt(x1, x2, u);
		return at(y1, y2, u);
	};
}

test("runtime.mjs is import-free (it is inlined into the runtime block)", () => {
	assert.doesNotMatch(SOURCE, /^\s*import\b/m);
	assert.doesNotMatch(SOURCE, /requestAnimationFrame|setInterval/, "motion runs only through vpkFrameLoop ticks");
	// One timer: the motion-at-rest gate waits out the entrance and the idle delay, then flips an attribute (the CSS animates).
	assert.equal(SOURCE.match(/setTimeout/g).length, 1, "only the rest gate sets a timer");
});

test("spring/stepS reach the target within eps and land at once when reduced", () => {
	const sp = spring(0);
	sp.t = 1;
	let steps = 0;
	while (stepS(sp, 1 / 60) && steps < 600) steps++;
	assert.ok(steps > 5 && steps < 600, `settled after ${steps} frames`);
	assert.equal(sp.x, 1);
	const reduced = spring(0);
	reduced.t = 0.8;
	assert.equal(stepS(reduced, 1 / 60, true), false);
	assert.equal(reduced.x, 0.8);
});

test("tween clocks: tval at 350 ms ≈ EASE_LIFT(0.5); tset to the same target is a no-op; reduced lands", () => {
	const reference = referenceBezier(0.32, 0.72, 0, 1);
	for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) assert.ok(Math.abs(EASE_LIFT(t) - reference(t)) < 1e-6, `EASE_LIFT(${t})`);
	assert.equal(bezier(0.5, 0, 0.5, 1)(0), 0);
	assert.equal(bezier(0.5, 0, 0.5, 1)(1), 1);
	const tw = tween(0);
	tset(tw, 1, 1000, 0);
	assert.ok(Math.abs(tval(tw, 1350) - EASE_LIFT(0.5)) < 1e-9);
	assert.equal(tdone(tw, 1650), false);
	assert.equal(tdone(tw, 1700), true);
	const before = { ...tw };
	tset(tw, 1, 5000, 100);
	assert.deepEqual(tw, before, "same target: no-op");
	const calm = tween(0);
	tset(calm, 1, 0, 0, true);
	assert.equal(tval(calm, 0, true), 1);
	assert.equal(tdone(calm, 0, true), true);
});

test("selectReducer: hover, leave, keyboard; neighbours stagger by |rank − a| × 10 ms", () => {
	let s = { count: 5, active: null, last: null };
	s = selectReducer(s, { type: "hover", unit: 2 });
	assert.equal(s.active, 2);
	assert.equal(s.changed, true);
	s = selectReducer(s, { type: "leave" });
	assert.equal(s.active, null);
	assert.equal(s.last, 2, "leave remembers the reference rank for the return stagger");
	for (const [key, from, to] of [["ArrowRight", null, 0], ["ArrowDown", 3, 4], ["ArrowRight", 4, 4], ["ArrowLeft", null, 4], ["ArrowUp", 2, 1], ["Home", 3, 0], ["End", 0, 4], ["Escape", 2, null]]) {
		const next = selectReducer({ count: 5, active: from, last: null }, { type: "key", key });
		assert.equal(next.handled, true, key);
		assert.equal(next.active, to, `${key} from ${from}`);
	}
	assert.equal(selectReducer({ count: 5, active: null, last: null }, { type: "key", key: "Escape" }).handled, false, "Escape at rest passes through");
	assert.equal(selectReducer({ count: 5, active: 1, last: null }, { type: "key", key: "a" }).handled, false);
	assert.deepEqual([0, 1, 2, 3, 4].map(rank => selectDelay(rank, 2)), [20, 10, 0, 10, 20]);
	assert.equal(selectDelay(3, null), 0);
});

test("explodeReducer: hover opens the full gap, leave closes it, a tap toggles; the slider commits; change speaks", () => {
	const cfg = { rest: 0.6, max: 1, unit: "gap" };
	let s = { committed: 0.6, preview: null };
	s = explodeReducer(s, { type: "hover" }, cfg);
	assert.deepEqual([s.preview, s.committed, explodeTarget(s)], [1, 0.6, 1], "hover opens to the full gap, never commits");
	assert.equal(explodeReducer(s, { type: "hover" }, cfg).preview, 1, "pointer position plays no part");
	const left = explodeReducer(s, { type: "leave" }, cfg);
	assert.deepEqual([left.preview, explodeTarget(left)], [null, 0.6], "leave returns to the slider's gap");
	const tapped = explodeReducer({ committed: 0.6, preview: null }, { type: "toggle" }, cfg);
	assert.equal(tapped.preview, 1, "a tap opens");
	assert.equal(explodeReducer(tapped, { type: "toggle" }, cfg).preview, null, "the next tap closes");
	const input = explodeReducer(s, { type: "input", value: 0.9 }, cfg);
	assert.deepEqual([input.committed, input.preview, input.live], [0.9, null, null]);
	assert.equal(explodeReducer(input, { type: "change", value: 0.9 }, cfg).live, "gap 0.90");
});

async function withRuntime(region, run, setup = () => {}) {
	GlobalRegistrator.register({ url: "http://localhost/", width: 1280, height: 800 });
	for (const name of ["__vpkRehearsal", "__vpkIsoRehearsal", "vpkSmil"]) delete globalThis[name];
	try {
		setup(window);
		globalThis.Element.prototype.getBoundingClientRect = () => ({ ...RECT });
		document.body.innerHTML = `<main>${region}</main>`;
		const boards = [];
		let reduced = false;
		const loop = {
			register(stage, tick, opts) {
				const board = { stage, tick, rest: opts && opts.rest, wakes: 0 };
				boards.push(board);
				return { wake: () => void board.wakes++, unregister() {} };
			},
			reducedMotion: () => reduced,
			onReducedMotionChange(fn) {
				reducedListeners.push(fn);
			},
		};
		const reducedListeners = [];
		// The inlined block puts manual-runtime.mjs into the kit scope for every figure.
		const api = createIsoRuntime(window, loop, { ...core, blink, tagLines });
		api.scan();
		const step = (ms, { calm = false, from } = {}) => {
			const start = from ?? performance.now();
			let busy = false;
			for (let t = start; t <= start + ms; t += 16) busy = boards[0].tick(0.016, t, calm);
			return busy;
		};
		await run({ api, boards, step, setReduced: value => { reduced = value; reducedListeners.forEach(fn => fn(value)); } });
	} finally {
		await GlobalRegistrator.unregister();
	}
}

const pointer = (target, type, clientX, clientY, pointerType = "mouse") => target.dispatchEvent(new window.PointerEvent(type, { clientX, clientY, pointerType, bubbles: type === "pointermove" }));
const centroid = d => {
	const pts = core.hull(core.parsePolyPath(d));
	return [pts.reduce((sum, [x]) => sum + x, 0) / pts.length, pts.reduce((sum, [, y]) => sum + y, 0) / pts.length];
};

test("explode: hover previews the gap, leave restores the static art, the slider commits and speaks", async () => {
	await withRuntime(renderRegion(buildScene(EXEMPLAR)), async ({ api, boards, step }) => {
		assert.equal(api.version, 1);
		assert.equal(boards.length, 1, "one board per interactive stage");
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const readout = document.querySelector("[data-vpk-iso-readout]");
		const control = document.querySelector("[data-vpk-iso-control]");
		const live = document.querySelector("[data-vpk-iso-live]");
		const shell = svg.querySelector('[data-vpk-iso-part="shell"]');
		const guide = svg.querySelector('[data-vpk-iso-role="guide"]');
		const snapshot = svg.outerHTML;
		const guideRest = guide.getAttribute("d");
		pointer(stage, "pointermove", 0.85 * 720, 200);
		step(800);
		assert.ok(Number(readout.textContent.split(" ")[1]) > 0.6, readout.textContent);
		assert.ok(shell.hasAttribute("transform"), "the top part moved");
		assert.notEqual(guide.getAttribute("d"), guideRest, "guides follow their parts");
		assert.equal(control.value, "0.6", "the pointer never writes the slider");
		pointer(stage, "pointerleave", 0, 0);
		assert.equal(step(1200), false, "settles and sleeps");
		assert.equal(readout.textContent, "gap 0.60");
		assert.equal(svg.querySelectorAll("[transform]").length, 0, "no transforms at rest");
		assert.equal(svg.outerHTML, snapshot, "at rest the SVG equals the static art");
		control.value = "0.9";
		control.dispatchEvent(new window.Event("input", { bubbles: true }));
		control.dispatchEvent(new window.Event("change", { bubbles: true }));
		step(1200);
		assert.equal(readout.textContent, "gap 0.90");
		assert.equal(live.textContent, "gap 0.90");
		pointer(stage, "pointermove", 0.1 * 720, 200);
		step(600);
		pointer(stage, "pointerleave", 0, 0);
		step(1200);
		assert.equal(readout.textContent, "gap 0.90", "leave settles back at the committed value");
	});
});

test("explode under reduced motion lands in one tick", async () => {
	await withRuntime(renderRegion(buildScene(EXEMPLAR)), async ({ step, setReduced }) => {
		setReduced(true);
		const stage = document.querySelector("[data-vpk-iso-stage]");
		pointer(stage, "pointermove", 0.85 * 720, 200);
		assert.equal(step(0, { calm: true }), false, "one tick, no further frames");
		assert.equal(document.querySelector("[data-vpk-iso-readout]").textContent, "gap 1.00");
	});
});

test("select: rest-polygon hits, one active part, staggered lift, keyboard isolation, exact rest restore", async () => {
	await withRuntime(renderRegion(buildScene(SELECT)), async ({ step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const readout = document.querySelector("[data-vpk-iso-readout]");
		const live = document.querySelector("[data-vpk-iso-live]");
		const drum = svg.querySelector('[data-vpk-iso-part="drum"]');
		const snapshot = svg.outerHTML;
		const fill = drum.querySelector('[data-vpk-iso-role="fill"]').getAttribute("d");
		const [cx, cy] = centroid(fill);
		pointer(stage, "pointermove", cx, cy);
		step(16);
		assert.equal(svg.querySelectorAll(".is-active").length, 1);
		assert.equal(drum.getAttribute("class"), "is-active");
		assert.equal(readout.textContent, "drum");
		assert.equal(live.textContent, "drum");
		step(800);
		assert.ok(drum.hasAttribute("transform"), "the active part lifts");
		const lowest = Math.max(...core.parsePolyPath(fill).map(([, y]) => y));
		pointer(stage, "pointermove", cx, lowest - 3);
		step(16);
		assert.equal(drum.getAttribute("class"), "is-active", "hit testing uses the rest silhouette, not the lifted pose");
		pointer(stage, "pointerleave", 0, 0);
		assert.equal(step(1600), false);
		assert.equal(svg.querySelectorAll("[class]").length, 0, "no class attribute left");
		assert.equal(svg.querySelectorAll("[transform]").length, 0);
		assert.equal(readout.textContent, "rest");
		assert.equal(svg.outerHTML, snapshot);

		const seen = [];
		document.addEventListener("keydown", event => seen.push(event.key));
		const key = name => {
			const event = new window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });
			stage.dispatchEvent(event);
			return event.defaultPrevented;
		};
		assert.equal(key("ArrowRight"), true);
		step(16);
		assert.equal(svg.querySelector(".is-active")?.getAttribute("data-vpk-iso-part"), "tray:back", "first unit in painter order");
		assert.equal(svg.querySelectorAll(".is-active").length, 2, "tray halves activate together");
		assert.equal(key("Escape"), true);
		step(1600);
		assert.equal(svg.querySelectorAll(".is-active").length, 0);
		assert.equal(key("a"), false);
		assert.deepEqual(seen, ["a"], "handled keys stop at the stage; others pass through");
		assert.equal(svg.outerHTML, snapshot);
	});
});

test("select: a lifted part keeps its painter order, so it never jumps in front of a nearer part", async () => {
	await withRuntime(renderRegion(buildScene(SELECT)), async ({ step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const order = () => [...svg.querySelectorAll("[data-vpk-iso-part]")].map(el => el.getAttribute("data-vpk-iso-part")).join(" ");
		const rest = order();
		assert.ok(rest.indexOf("card-a") < rest.indexOf("card-b"), "card-a is drawn behind the nearer card-b at rest");
		const cardA = svg.querySelector('[data-vpk-iso-part="card-a"]');
		const [cx, cy] = centroid(cardA.querySelector('[data-vpk-iso-role="fill"]').getAttribute("d"));
		pointer(stage, "pointermove", cx, cy);
		step(800);
		assert.equal(cardA.getAttribute("class"), "is-active");
		assert.ok(cardA.hasAttribute("transform"), "card-a lifts");
		assert.equal(order(), rest, "lifting does not reorder the parts");
		assert.equal(svg.hasAttribute("data-vpk-iso-lift-z"), false, "no lift-height re-sort input is emitted");
	});
});

// A plinth (tray) under a floating card and a pillar: the plinth is the figure's support, so it is fixed; the card's guide ends on
// the tray, which is drawn as plinth:back and plinth:front; the pillar grows.
const GROUND = {
	schema: "vpk-iso-brief/1",
	id: "ground-kinds",
	figId: "FIG_004",
	title: "Ground kinds",
	label: "A card floating over a plinth beside a pillar.",
	parts: [
		{ id: "plinth", kind: "tray", at: [0, 0, 0], size: [120, 80, 4], label: "plinth" },
		{ id: "card", kind: "slab", at: [10, 10, 20], size: [40, 40, 3], label: "card" },
		{ id: "pillar", kind: "box", at: [70, 20, 4], size: [12, 12, 10], r: 0, label: "pillar", liftMode: "grow" },
	],
	focal: "card",
	interact: { behavior: "select", rest: "rest", guides: true },
};

test("select guides: an end named by a tray's id follows by unit name, and the guide moves with its lifted part", async () => {
	await withRuntime(renderRegion(buildScene(GROUND)), async ({ step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const guide = svg.querySelector('[data-vpk-iso-role="guide"]');
		assert.ok(guide, "the select figure draws its guide");
		assert.equal(guide.getAttribute("data-vpk-iso-to"), "plinth", "the guide names the tray by its id");
		assert.equal(svg.querySelector('[data-vpk-iso-part="plinth"]'), null, "no part carries the bare tray id");
		const rest = guide.getAttribute("d");
		const card = svg.querySelector('[data-vpk-iso-part="card"]');
		const [cx, cy] = centroid(card.querySelector('[data-vpk-iso-role="fill"]').getAttribute("d"));
		pointer(stage, "pointermove", cx, cy);
		step(800);
		assert.equal(card.getAttribute("class"), "is-active");
		const [dx, dy] = card.getAttribute("data-vpk-iso-lift").split(" ").map(Number);
		const a = core.parsePolyPath(rest);
		const b = core.parsePolyPath(guide.getAttribute("d"));
		assert.equal(b.length, a.length);
		for (let k = 0; k < a.length; k++) {
			const moved = k % 2 ? [0, 0] : [dx, dy];
			assert.ok(Math.abs(b[k][0] - a[k][0] - moved[0]) < 0.11 && Math.abs(b[k][1] - a[k][1] - moved[1]) < 0.11, `guide point ${k}: the upper end rides the lift, the lower stays on the plinth`);
		}
		pointer(stage, "pointerleave", 0, 0);
		step(1600);
		assert.equal(guide.getAttribute("d"), rest, "back at rest");
	});
});

test("fixed: the support never lifts, takes no outline, is no keyboard stop and blocks the pointer in front of it", async () => {
	await withRuntime(renderRegion(buildScene(GROUND)), async ({ step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const halves = [...svg.querySelectorAll('[data-vpk-iso-of="plinth"]')];
		assert.equal(halves.length, 2);
		assert.ok(halves.every(el => el.hasAttribute("data-vpk-iso-fixed") && !el.hasAttribute("data-vpk-iso-lift")), "both tray halves are fixed, with no lift vector");
		// A point on the plinth's floor, clear of the card and the pillar.
		const floor = core.parsePolyPath(halves[0].querySelector('[data-vpk-iso-role="fill"]').getAttribute("d"));
		const xs = floor.map(([x]) => x);
		const ys = floor.map(([, y]) => y);
		const corner = [Math.min(...xs) + 12, ys[xs.indexOf(Math.min(...xs))]];
		pointer(stage, "pointermove", corner[0], corner[1]);
		step(800);
		assert.equal(svg.querySelectorAll(".is-active").length, 0, "hovering the plinth selects nothing");
		assert.equal(svg.querySelectorAll("[transform]").length, 0, "nothing lifts");
		const key = name => stage.dispatchEvent(new window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
		const stops = [];
		for (let n = 0; n < 3; n++) {
			key("ArrowRight");
			step(16);
			stops.push([...svg.querySelectorAll(".is-active")].map(el => el.getAttribute("data-vpk-iso-part")).join("+"));
		}
		assert.deepEqual(stops.slice(0, 2).sort(), ["card", "pillar"], "the keyboard visits the card and the pillar only");
		assert.equal(stops[2], stops[1], "and stops at the last selectable part, never on the plinth");
		key("Home");
		step(16);
		assert.ok(["card", "pillar"].includes(svg.querySelector(".is-active")?.getAttribute("data-vpk-iso-part")), "Home lands on a selectable part");
		assert.ok(halves.every(el => !el.classList.contains("is-active")));
	});
});

test("grow: a grown part keeps its base points and raises only its top-face points; at rest its paths are the static art", async () => {
	await withRuntime(renderRegion(buildScene(GROUND)), async ({ step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const snapshot = svg.outerHTML;
		const pillar = svg.querySelector('[data-vpk-iso-part="pillar"]');
		assert.ok(pillar.hasAttribute("data-vpk-iso-grow"));
		const path = role => pillar.querySelector(`[data-vpk-iso-role="${role}"]`).getAttribute("d");
		const fill0 = core.parsePolyPath(path("fill"));
		const top0 = new Set(core.parsePolyPath(path("top")).map(point => point.join(" ")));
		const [dx, dy] = pillar.getAttribute("data-vpk-iso-lift").split(" ").map(Number);
		const [cx, cy] = centroid(path("fill"));
		pointer(stage, "pointermove", cx, cy);
		step(800);
		assert.equal(pillar.getAttribute("class"), "is-active");
		assert.equal(pillar.hasAttribute("transform"), false, "a grown part is not translated");
		const fill1 = core.parsePolyPath(path("fill"));
		assert.equal(fill1.length, fill0.length);
		let kept = 0;
		fill0.forEach((point, k) => {
			const up = top0.has(point.join(" "));
			if (!up) kept++;
			assert.ok(Math.abs(fill1[k][0] - point[0] - (up ? dx : 0)) < 0.11 && Math.abs(fill1[k][1] - point[1] - (up ? dy : 0)) < 0.11, `fill point ${k} ${up ? "rides the lift" : "stays on the base"}`);
		});
		assert.ok(kept >= 2, "the bottom edge stays put");
		assert.equal(Math.max(...fill1.map(([, y]) => y)), Math.max(...fill0.map(([, y]) => y)), "the lowest point does not move");
		pointer(stage, "pointerleave", 0, 0);
		step(1600);
		assert.equal(svg.outerHTML, snapshot, "back at rest the SVG is the static art");
	});
});

// Verifier round 2: guide/leader `d` and the active class are runtime writes the print CSS cannot
// reach, so the loop's `rest` (beforeprint) writes one rest frame and holds it; afterprint wakes.
test("print: rest() lands guides, leaders, transforms and the active stroke at rest; afterprint brings the state back", async () => {
	await withRuntime(renderRegion(buildScene(EXEMPLAR)), async ({ boards, step }) => {
		const svg = document.querySelector("svg[data-vpk-iso-id]");
		const lines = () => [...svg.querySelectorAll('[data-vpk-iso-role="guide"], [data-vpk-iso-role="leader"]')].map(node => node.getAttribute("d")).join("|");
		const snapshot = svg.outerHTML;
		const rest = lines();
		const control = document.querySelector("[data-vpk-iso-control]");
		control.value = "1";
		control.dispatchEvent(new window.Event("input", { bubbles: true }));
		step(1200);
		const exploded = lines();
		assert.notEqual(exploded, rest, "the committed gap moved the guides and leaders");
		assert.equal(typeof boards[0].rest, "function", "the board registers a rest for the loop's beforeprint");
		boards[0].rest();
		assert.equal(svg.outerHTML, snapshot, "the print pose is the static art");
		assert.equal(step(100), false, "ticks write nothing while printing");
		assert.equal(svg.outerHTML, snapshot);
		const wakes = boards[0].wakes;
		window.dispatchEvent(new window.Event("afterprint"));
		assert.equal(boards[0].wakes, wakes + 1, "afterprint wakes the board");
		step(16);
		assert.equal(lines(), exploded, "the next tick writes the committed state back");
		assert.equal(control.value, "1");
	});
	const labelled = { ...SELECT, labels: [{ text: "Drum", target: "drum", side: "right" }] };
	await withRuntime(renderRegion(buildScene(labelled)), async ({ boards, step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const snapshot = svg.outerHTML;
		stage.dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
		step(900);
		const active = svg.querySelector(".is-active")?.getAttribute("data-vpk-iso-part");
		assert.ok(active, "End selects the last unit");
		const lifted = svg.outerHTML;
		assert.notEqual(lifted, snapshot);
		boards[0].rest();
		assert.equal(svg.querySelectorAll("[class], [transform]").length, 0, "no active stroke, no lift");
		assert.equal(svg.outerHTML, snapshot, "leaders and painter order are back at rest");
		window.dispatchEvent(new window.Event("afterprint"));
		// The tweens run on absolute time; the first step simulated 900 ms ahead of the real clock.
		step(16, { from: performance.now() + 2000 });
		assert.equal(svg.querySelector(".is-active")?.getAttribute("data-vpk-iso-part"), active, "the selection survives printing");
		assert.equal(svg.outerHTML, lifted);
	});
});

// P5 (ws3-manual, rule 11): a select figure blinks the part once as it becomes active. The blink is the lift
// tween's progress written as the part's opacity, and the rest art carries no opacity (A11).
test("select: the active part blinks once while it lifts, rest and reduced motion write no opacity", async () => {
	const region = renderRegion(buildScene(SELECT));
	assert.match(region, /<svg [^>]*data-vpk-iso-blink/);
	await withRuntime(region, async ({ step, setReduced }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const drum = svg.querySelector('[data-vpk-iso-part="drum"]');
		const snapshot = svg.outerHTML;
		const [cx, cy] = centroid(drum.querySelector('[data-vpk-iso-role="fill"]').getAttribute("d"));
		pointer(stage, "pointermove", cx, cy);
		const seen = [];
		for (let i = 0; i < 80; i++) {
			step(0, { from: performance.now() + i * 16 });
			seen.push(drum.hasAttribute("opacity") ? Number(drum.getAttribute("opacity")) : 1);
		}
		assert.equal(drum.getAttribute("class"), "is-active");
		assert.ok(Math.min(...seen) >= 0.4 && Math.min(...seen) < 0.7, `the part dips to a partial opacity (${Math.min(...seen)})`);
		assert.ok(seen.every(value => value > 0 && value <= 1), "never hidden");
		assert.ok(seen.slice(0, 8).some(value => value < 1), "the dip happens as the lift starts");
		assert.equal(seen.at(-1), 1, "the blink is over once the lift lands");
		assert.equal(drum.hasAttribute("opacity"), false, "a part at full opacity carries no attribute");
		const dipped = seen.findIndex(value => value < 1);
		const settled = seen.findIndex((value, at) => at > dipped && value === 1);
		assert.ok(seen.slice(settled).every(value => value === 1), "one blink, not a pulse");
		pointer(stage, "pointerleave", 0, 0);
		assert.equal(step(1600, { from: performance.now() + 4000 }), false);
		assert.equal(svg.querySelectorAll("[opacity]").length, 0, "no element keeps an opacity attribute");
		assert.equal(svg.outerHTML, snapshot, "back at rest the art is the static art");
		setReduced(true);
		pointer(stage, "pointermove", cx, cy);
		step(160, { from: performance.now() + 8000 });
		assert.equal(drum.getAttribute("class"), "is-active");
		assert.equal(drum.hasAttribute("opacity"), false, "reduced motion never blinks");
	});
});

test("rehearsal delegates to window.vpkSmil and is defined once", async () => {
	await withRuntime(renderRegion(buildScene(EXEMPLAR)), async ({ api }) => {
		const calls = [];
		window.vpkSmil = { hold: (t, svg) => calls.push(["hold", t, svg.getAttribute("data-vpk-iso-id")]), land: svg => calls.push(["land", svg.getAttribute("data-vpk-iso-id")]), duration: () => 1.44 };
		assert.equal(window.__vpkIsoRehearsal, api.rehearsal);
		assert.equal(window.__vpkRehearsal, api.rehearsal, "first definer wins when none existed");
		api.rehearsal.hold(0.3);
		api.rehearsal.release();
		assert.deepEqual(calls, [["hold", 0.3, "exploded-stack"], ["land", "exploded-stack"]]);
		assert.equal(api.rehearsal.time(), 0.3);
		assert.equal(api.rehearsal.duration, 1.44);
	});
});

test("slideFit: no write when the slide fits; the whole flow while every SVG keeps half; else the plate only, floored at half", () => {
	assert.deepEqual(slideFit(-4, -20, [400]), [null], "fits: nothing written");
	assert.deepEqual(slideFit(0.4, 0.4, [400]), [null], "sub-pixel overflow is ignored");
	assert.deepEqual(slideFit(150, 150, [400]), [250], "flow fit");
	assert.deepEqual(slideFit(260, 40, [400]), [360], "the flow would need 140 < 200: fit the plate, trailing content is the author's");
	assert.deepEqual(slideFit(300, 260, [400]), [200], "never below half");
	assert.deepEqual(slideFit(100, 100, [400, 300]), [350, 250], "two SVGs split the overflow");
	assert.deepEqual(slideFit(150, -3, [300]), [150], "the flow still fits at exactly half");
	assert.deepEqual(slideFit(250.06, 0, [400]), [null], "flow beyond half and the plate already fits: no write");
});

// Deck host (round-3 verifier): slides.html's fixed 158 mm slide, scaled by a transform. happy-dom
// has no layout, so the geometry is stubbed in CSS px at scale 2: slide content box ends at 540
// (600 − 60 padding), the plate runs from 200 to 640 with a 400 px SVG.
test("deck fit: a slide's ResizeObserver writes the SVG max-height in CSS px; pinned children below the plate cut the room", async () => {
	GlobalRegistrator.register({ url: "http://localhost/", width: 1280, height: 800 });
	try {
		const observers = [];
		window.ResizeObserver = class {
			constructor(callback) {
				this.callback = callback;
				this.targets = [];
				observers.push(this);
			}
			observe(target) {
				this.targets.push(target);
			}
		};
		const page = trailing => `<section class="slide" style="padding-bottom: 60px"><h2>T</h2>${renderRegion(buildScene(EXEMPLAR))}${trailing}<div class="page-num" style="position: absolute">01</div><aside style="display: none">n</aside></section>`;
		const k = 2;
		const at = (el, top, bottom) => {
			el.getBoundingClientRect = () => ({ left: 0, right: 100, width: 100, top: 100 + top * k, bottom: 100 + bottom * k, height: (bottom - top) * k, x: 0, y: 100 + top * k });
		};
		const run = (trailing, place) => {
			document.body.innerHTML = page(trailing);
			const slide = document.querySelector(".slide");
			for (const [name, value] of [["offsetHeight", 600], ["clientHeight", 600], ["clientTop", 0]]) Object.defineProperty(slide, name, { configurable: true, value });
			at(slide, 0, 600);
			at(slide.querySelector("h2"), 0, 60);
			at(slide.querySelector("figure"), 200, 640);
			at(slide.querySelector("svg[data-vpk-iso-id]"), 240, 640);
			at(slide.querySelector(".page-num"), 560, 575);
			at(slide.querySelector("aside"), 0, 0);
			place(slide);
			const loop = { register: () => ({ wake() {}, unregister() {} }), reducedMotion: () => false };
			createIsoRuntime(window, loop, core).scan();
			const fitters = observers.filter(observer => observer.targets.includes(slide));
			assert.equal(fitters.length, 1, "one observer on the slide");
			fitters[0].callback([{ target: slide }]);
			return slide.querySelector("svg[data-vpk-iso-id]").style.maxHeight;
		};
		assert.equal(run("", () => {}), "300px", "the plate ends on the 540 px content line: 400 − 100");
		assert.equal(run('<p class="note">n</p>', slide => at(slide.querySelector(".note"), 640, 680)), "260px", "a short trailing note fits too: 400 − 140");
		assert.equal(run('<p class="c2">n</p>', slide => at(slide.querySelector(".c2"), 640, 900)), "300px", "trailing content that cannot fit at half: only the plate is fitted");
		assert.equal(run('<div class="co" style="position: absolute">c</div>', slide => at(slide.querySelector(".co"), 500, 530)), "260px", "a pinned callout at 500 cuts the room");
		assert.equal(run("", slide => Object.defineProperty(slide, "offsetHeight", { value: 0 })), "", "a hidden slide is left alone");
	} finally {
		await GlobalRegistrator.unregister();
	}
});

// Run 8: a second iso figure on the same slide inside a hidden container (an inactive tab panel, a
// narrow-screen variant, a closed <details>) measured 0 px, took half the overflow share, so the
// visible plate still ran 91 px past the slide, and was written max-height: 0px, so it stayed
// invisible when shown. Only rendered SVGs share the room now.
test("deck fit: a hidden iso SVG on the slide neither takes a share of the room nor gets a max-height", async () => {
	GlobalRegistrator.register({ url: "http://localhost/", width: 1280, height: 800 });
	try {
		const observers = [];
		window.ResizeObserver = class {
			constructor(callback) {
				this.callback = callback;
				this.targets = [];
				observers.push(this);
			}
			observe(target) {
				this.targets.push(target);
			}
		};
		const alt = renderRegion(buildScene({ ...EXEMPLAR, id: "alt-stack", figId: "FIG_002" }));
		document.body.innerHTML = `<section class="slide" style="padding-bottom: 60px"><h2>T</h2>${renderRegion(buildScene(EXEMPLAR))}<div class="alt" style="display: none">${alt}</div><div class="page-num" style="position: absolute">01</div></section>`;
		const slide = document.querySelector(".slide");
		for (const [name, value] of [["offsetHeight", 600], ["clientHeight", 600], ["clientTop", 0]]) Object.defineProperty(slide, name, { configurable: true, value });
		const at = (el, top, bottom) => {
			el.getBoundingClientRect = () => ({ left: 0, right: 100, width: 100, top: 100 + top * 2, bottom: 100 + bottom * 2, height: (bottom - top) * 2, x: 0, y: 100 + top * 2 });
		};
		at(slide, 0, 600);
		at(slide.querySelector("h2"), 0, 60);
		at(slide.querySelector("#vpk-iso-exploded-stack"), 200, 640);
		at(slide.querySelector("#vpk-iso-exploded-stack svg"), 240, 640);
		at(slide.querySelector(".page-num"), 560, 575);
		const hidden = slide.querySelector("#vpk-iso-alt-stack svg");
		hidden.style.maxHeight = "123px";
		const loop = { register: () => ({ wake() {}, unregister() {} }), reducedMotion: () => false };
		createIsoRuntime(window, loop, core).scan();
		observers.find(observer => observer.targets.includes(slide)).callback([{ target: slide }]);
		assert.equal(slide.querySelector("#vpk-iso-exploded-stack svg").style.maxHeight, "300px", "the visible SVG takes the whole overflow: 400 − 100");
		assert.equal(hidden.style.maxHeight, "", "the hidden SVG is reset and left unfitted");
	} finally {
		await GlobalRegistrator.unregister();
	}
});

// Motion at rest (accent.mjs REST_MOTION; prototype SPEC 17.3): the runtime only flips data-vpk-iso-rest; the CSS animates.
test("rest motion: on after the entrance and IDLE_RESUME_MS without input; off on input, off screen, hidden tab, reduced motion and print", async () => {
	assert.equal(REST_IDLE_MS, REST_MOTION.IDLE_RESUME_MS, "runtime.mjs (import-free) carries accent.mjs's idle delay");
	assert.deepEqual([restMs("1800ms"), restMs("2s"), restMs("0.5s"), restMs("indefinite")], [1800, 2000, 500, 0]);
	let clock = 0;
	const timers = [];
	let io = null;
	const setup = win => {
		Object.defineProperty(win.performance, "now", { configurable: true, value: () => clock });
		win.setTimeout = (fn, ms) => (timers.push({ fn, at: clock + ms }), timers.length);
		win.clearTimeout = id => { if (timers[id - 1]) timers[id - 1].fn = null; };
		win.IntersectionObserver = class { constructor(cb) { io = cb; } observe() {} };
	};
	const advance = ms => {
		clock += ms;
		for (const timer of timers.filter(entry => entry.fn && entry.at <= clock)) {
			const fn = timer.fn;
			timer.fn = null;
			fn();
		}
	};
	await withRuntime(renderRegion(buildScene(SELECT)), async ({ boards, setReduced }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const resting = () => stage.getAttribute("data-vpk-iso-rest") === "";
		const art = svg.outerHTML;
		const entrance = Math.max(...[...svg.querySelectorAll("[dur]")].map(el => restMs(el.getAttribute("dur"))));
		assert.ok(entrance > 0, "the select figure has a SMIL entrance");
		io([{ isIntersecting: true }]);
		assert.equal(resting(), false, "not during the entrance");
		advance(entrance + REST_IDLE_MS - 100);
		assert.equal(resting(), false, "not until IDLE_RESUME_MS after the entrance (the 3D prototype waits the same after its entry)");
		advance(200);
		assert.equal(resting(), true, "on once the entrance has run, the idle delay has passed and the figure is on screen");
		assert.equal(svg.hasAttribute("data-vpk-iso-rest"), false, "the attribute sits on the stage, so the svg stays the static art");
		assert.equal(svg.outerHTML, art);
		pointer(stage, "pointermove", 10, 10);
		assert.equal(resting(), false, "any input stops it at once");
		assert.equal(stage.getAttribute("data-vpk-iso-rest"), "paused", "paused in place, so the drawing does not snap back");
		advance(REST_IDLE_MS - 100);
		assert.equal(resting(), false, "still off before the idle delay");
		advance(200);
		assert.equal(resting(), true, `back ${REST_IDLE_MS} ms after the last input`);
		io([{ isIntersecting: false }]);
		assert.equal(resting(), false, "off screen");
		io([{ isIntersecting: true }]);
		assert.equal(resting(), true);
		Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
		document.dispatchEvent(new window.Event("visibilitychange"));
		assert.equal(resting(), false, "hidden tab");
		Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
		document.dispatchEvent(new window.Event("visibilitychange"));
		assert.equal(resting(), true);
		setReduced(true);
		assert.equal(resting(), false, "reduced motion");
		setReduced(false);
		assert.equal(resting(), true);
		boards[0].rest();
		assert.equal(resting(), false, "print pose");
	}, setup);
});

test("rest motion CSS: keyframes from REST_MOTION, gated on the attribute, screen and no-preference only, no frame callback", () => {
	const gated = /@media screen and \(prefers-reduced-motion: no-preference\) \{\n([^}]+\}\n[^}]+\}\n[^}]+\})\n\}/.exec(ISO_CSS);
	assert.ok(gated, "the animation rules sit in one screen + no-preference block");
	assert.match(gated[1], new RegExp(`\\[data-vpk-iso-rest\\] > svg \\{ animation: vpk-iso-drift-x ${REST_MOTION.DRIFT_X_MS}ms cubic-bezier\\([^)]+\\) infinite, vpk-iso-drift-y ${REST_MOTION.DRIFT_Y_MS}ms`));
	assert.match(gated[1], new RegExp(`\\[data-vpk-iso-focal\\] \\{ animation: vpk-iso-bob ${REST_MOTION.BOB_PERIOD_MS}ms`));
	assert.match(ISO_CSS, new RegExp(`translate: 0 -${REST_MOTION.BOB_PX}px`));
	assert.match(ISO_CSS, new RegExp(`translate: ${REST_MOTION.DRIFT_PX}px 0`));
	assert.match(gated[1], /\[data-vpk-iso-rest="paused"\] > svg, [^{]+\{ animation-play-state: paused; \}/, "input pauses the drift in place");
	assert.equal([...ISO_CSS.matchAll(/animation:/g)].length, 2, "no other animation rule");
});

// Cast shadows follow their part (illustrations.md § Shadows): a lifted or exploded part's shadow moves by its cast vector times
// the part's motion, so it offsets along the light and stays on the ground; at rest no shadow carries a transform.
test("shadows follow lift and explode through the same write; at rest none carries a transform", async () => {
	const translate = el => (el.getAttribute("transform") || "translate(0 0)").match(/-?[\d.]+/g).map(Number);
	await withRuntime(renderRegion(buildScene(SELECT)), async ({ step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const drum = svg.querySelector('[data-vpk-iso-part="drum"]');
		const shadow = svg.querySelector('[data-vpk-iso-shadow-for="drum"]');
		const cast = svg.querySelector("[data-vpk-iso-shadows]").getAttribute("data-vpk-iso-cast").split(" ").map(Number);
		const [cx, cy] = centroid(drum.querySelector('[data-vpk-iso-role="fill"]').getAttribute("d"));
		pointer(stage, "pointermove", cx, cy);
		step(900);
		const [px, py] = translate(drum);
		const [sx, sy] = translate(shadow);
		assert.ok(py < 0, "the part lifts");
		assert.deepEqual([sx, sy], cast, "the lifted part's shadow moves by its cast vector");
		assert.ok(sy > py && sx > px, "the shadow stays below and to the right of the lifted part");
		assert.equal(svg.querySelector('[data-vpk-iso-shadow-for="block"]').hasAttribute("transform"), false, "other shadows stay put");
		pointer(stage, "pointerleave", 0, 0);
		step(1600);
		assert.equal(svg.querySelectorAll("[data-vpk-iso-shadows] [transform]").length, 0, "no shadow transform at rest");
	});
	await withRuntime(renderRegion(buildScene(EXEMPLAR)), async ({ step }) => {
		const control = document.querySelector("[data-vpk-iso-control]");
		const shadow = document.querySelector('[data-vpk-iso-shadow-for="shell"]');
		const cast = shadow.getAttribute("data-vpk-iso-cast").split(" ").map(Number);
		control.value = "1";
		control.dispatchEvent(new window.Event("input", { bubbles: true }));
		step(1600);
		const [sx, sy] = translate(shadow);
		assert.ok(Math.abs(sx - cast[0] * 0.4) <= 0.1 && Math.abs(sy - cast[1] * 0.4) <= 0.1, `the exploded shell's shadow moves by 0.4 Gap units of its cast (${sx} ${sy})`);
		assert.equal(document.querySelector('[data-vpk-iso-shadow-for="base"]').hasAttribute("transform"), false, "the still base keeps its shadow");
	});
});
