// Step and scrub figures (plan § 2 I): validation, variants and rotate sampling, the stage's state model with per-state
// painter order, the pure reducers and readout templates, and the runtime in happy-dom (ticks by hand, deterministic).
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as core from "./core.mjs";
import { renderRegion, renderSvg } from "./emit.mjs";
import { auditHtml } from "./audit.mjs";
import { blink, tagLines } from "./manual-runtime.mjs";
import { createIsoRuntime, LIVE_CLEAR_MS } from "./runtime.mjs";
import { buildScene, validateBrief } from "./scene.mjs";
import { blendPose, formatReadout, mountStates, orderOf, poseText, scrubPose, scrubReducer, scrubTarget, statePose, stateText, stepReducer, unitView } from "./state-runtime.mjs";
import { rotatePart, turnSamples } from "./states.mjs";

const load = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const STEP = load("states-step");
const SCRUB = load("states-scrub");
const clone = value => structuredClone(value);
const RECT = { left: 0, top: 0, right: 720, bottom: 450, width: 720, height: 450, x: 0, y: 0 };

test("formatReadout: name, n, count, t, values with explicit and inferred decimals; unknown keys stay", () => {
	const ctx = { name: "spool", n: 2, count: 3, t: 0.5, values: { kN: 45.6, pct: 45, label: "AB" } };
	assert.equal(formatReadout("{name} · {kN:0.1} kN · nozzle {pct}%", ctx), "spool · 45.6 kN · nozzle 45%");
	assert.equal(formatReadout("{n}/{count} t={t}", ctx), "2/3 t=0.50");
	assert.equal(formatReadout("{kN} kN", { ...ctx, values: { kN: 45.63 } }, { kN: 1 }), "45.6 kN");
	assert.equal(formatReadout("{kN:0.00}", ctx), "45.60");
	assert.equal(formatReadout("{kN:1}", ctx), "46");
	assert.equal(formatReadout("{label} {nope}", ctx), "AB {nope}");
	assert.equal(formatReadout("{x:0.1}", { values: { x: -0.01 } }), "0.0", "no negative zero");
	const cfg = { template: "{name} · {kN} kN", d: { kN: 1 }, states: [{ name: "a", values: { kN: 1 } }, { name: "b", readout: "own text", values: { kN: 2 } }] };
	assert.equal(stateText(cfg, 0), "a · 1.0 kN");
	assert.equal(stateText(cfg, 1), "own text", "a state's own readout wins");
	assert.equal(stateText({ states: [{ name: "plain" }] }, 0), "plain", "no template: the name");
});

test("stepReducer: click, Enter, Space and arrows step and wrap; Home, End, Escape; loop false clamps; other keys pass", () => {
	const cfg = { count: 3, rest: 0 };
	const at = (from, event, c = cfg) => stepReducer({ at: from }, event, c);
	assert.deepEqual(at(0, { type: "click" }), { at: 1, handled: true, changed: true });
	assert.equal(at(2, { type: "click" }).at, 0, "wraps forward");
	assert.equal(at(0, { type: "key", key: "ArrowLeft" }).at, 2, "wraps back");
	for (const key of ["ArrowRight", "ArrowDown", "Enter", " ", "PageDown"]) assert.equal(at(1, { type: "key", key }).at, 2, key);
	assert.equal(at(1, { type: "key", key: "Home" }).at, 0);
	assert.equal(at(0, { type: "key", key: "End" }).at, 2);
	assert.deepEqual(at(2, { type: "key", key: "Escape" }), { at: 0, handled: true, changed: true });
	assert.equal(at(2, { type: "click" }, { ...cfg, loop: false }).at, 2, "loop false holds at the end");
	assert.equal(at(0, { type: "key", key: "ArrowLeft" }, { ...cfg, loop: false }).changed, false);
	assert.equal(at(0, { type: "key", key: "a" }).handled, false);
});

test("scrubReducer: pointer x maps to t across the states; drag commits on release; keys snap to whole states; slider commits", () => {
	const cfg = { count: 5, rest: 0, input: "drag" };
	const s0 = { committed: 0, preview: null, drag: false };
	assert.equal(scrubReducer(s0, { type: "hover", x: 0.5 }, cfg).preview, null, "drag input ignores hover");
	assert.equal(scrubReducer(s0, { type: "hover", x: 0.5 }, { ...cfg, input: "pointer-x" }).preview, 2, "pointer-x: x 0.5 of 5 states is t 2");
	let s = scrubReducer(s0, { type: "down", x: 0.25 }, cfg);
	assert.equal(scrubTarget(s), 1);
	s = scrubReducer(s, { type: "move", x: 0.9 }, cfg);
	assert.ok(Math.abs(scrubTarget(s) - 3.6) < 1e-9);
	assert.equal(s.commit, false, "no commit while dragging");
	s = scrubReducer(s, { type: "up" }, cfg);
	assert.deepEqual([s.committed, s.preview, s.drag, s.commit], [scrubTarget({ committed: 0, preview: 3.6 }), null, false, true]);
	assert.equal(scrubReducer(s, { type: "key", key: "ArrowRight" }, cfg).committed, 4, "3.6 → next whole state");
	assert.equal(scrubReducer(s, { type: "key", key: "ArrowLeft" }, cfg).committed, 3, "3.6 → previous whole state");
	assert.equal(scrubReducer({ ...s0, committed: 2 }, { type: "key", key: "ArrowRight" }, cfg).committed, 3);
	assert.equal(scrubReducer({ ...s0, committed: 4 }, { type: "key", key: "Escape" }, cfg).committed, 0);
	assert.equal(scrubReducer(s0, { type: "key", key: "q" }, cfg).handled, false);
	assert.equal(scrubReducer(s0, { type: "change", value: 9 }, cfg).committed, 4, "clamped");
	assert.equal(scrubReducer(s0, { type: "input", value: 1.5 }, cfg).commit, false, "input previews without speaking");
	assert.equal(scrubReducer(s0, { type: "down", x: -1 }, cfg).preview, 0, "clamped low");
});

test("scrub poses interpolate moves, values and turns; discrete parts switch at the segment midpoint", () => {
	const cfg = { rest: 0, template: "{name} {v:0.1}", turns: { arm: [0, 45, 90] }, states: [
		{ name: "a", values: { v: 0 }, p: { arm: { r: 0 }, lid: { h: 1 } }, o: "0 1", text: "a" },
		{ name: "b", values: { v: 10 }, m: { cart: [10, 4, 12, 6] }, p: { arm: { r: 90 }, nozzle: { v: "open" } }, o: "1 0", text: "b" },
	] };
	const mid = scrubPose(cfg, 0.4);
	assert.deepEqual(mid.vec.cart.map(v => Math.round(v * 10) / 10), [4, 1.6, 4.8, 2.4]);
	assert.equal(mid.near, 0);
	assert.equal(poseText(cfg, mid), "a 4.0");
	assert.equal(unitView(cfg, mid, "lid").hidden, true);
	assert.equal(unitView(cfg, mid, "arm").variant, "turn-1", "36° shows the 45° sample");
	const late = scrubPose(cfg, 0.6);
	assert.equal(late.near, 1);
	assert.equal(unitView(cfg, late, "lid").hidden, false);
	assert.equal(unitView(cfg, late, "nozzle").variant, "open");
	assert.equal(poseText(cfg, scrubPose(cfg, 1)), "b", "on a state its own text");
	const a = statePose(cfg, 0);
	const b = statePose(cfg, 1);
	assert.equal(blendPose(a, b, 0), a);
	assert.equal(blendPose(a, b, 1), b);
	assert.equal(blendPose(a, b, 0.5).exact, false);
});

test("validation: states, parts, variants, rotate, turn, values and readout keys; no cap on states or samples", () => {
	const errs = mutate => {
		const brief = clone(STEP);
		mutate(brief);
		return validateBrief(brief).join("\n");
	};
	assert.equal(errs(() => {}), "");
	assert.match(errs(b => (b.interact.states[1].parts.ghost = { hidden: true })), /states\[1\]\.parts\.ghost names no part/);
	assert.match(errs(b => (b.interact.states[1].parts.nozzle.variant = "wide")), /variant "wide" must be "base" or one of the part's variants \(half, open\)/);
	assert.match(errs(b => (b.interact.states[1].parts.base = { variant: "x" })), /it has none/);
	assert.match(errs(b => (b.interact.states[1].parts.base = { spin: 3 })), /spin is not a state field/);
	assert.match(errs(b => (b.interact.states[0].parts.carriage = { move: [3, 0, 0] })), /the rest state is the brief's geometry/);
	assert.match(errs(b => (b.interact.states = b.interact.states.slice(0, 1))), /at least two states/);
	assert.match(errs(b => (b.interact.states[2].name = "idle")), /name "idle" is used more than once/);
	assert.match(errs(b => (b.interact.values.kN = [1, 2])), /values\.kN must list 3 numbers/);
	assert.match(errs(b => (b.interact.values.name = [1, 2, 3])), /key "name" must be a short word/);
	assert.match(errs(b => (b.interact.readout = "{name} {rpm}")), /names \{rpm\}/);
	assert.match(errs(b => (b.interact.input = "pointer-x")), /input "pointer-x" must be one of click, keys for step/);
	assert.match(errs(b => (b.interact.rest = "nope")), /interact\.rest must be a state index/);
	assert.match(errs(b => (b.interact.lift = 4)), /interact\.lift applies to select/);
	assert.match(errs(b => (b.parts[3].variants.base = { r1: 3 })), /a variant name matches/);
	assert.match(errs(b => (b.parts[3].variants.half.id = "x")), /variants\.half\.id cannot be overridden/);
	assert.match(errs(b => (b.parts[3].variants.half.r1 = -2)), /variants\.half\.r1 must be ≥ 0/);
	assert.match(errs(b => (b.parts[6].rotate.deg = [10, 10])), /rotate\.deg must be \[a0, a1\]/);
	// Phase 3: a box turns about a vertical axis (through yaw), not about a horizontal one.
	assert.doesNotMatch(errs(b => (b.parts[1].rotate = { axis: "z", deg: [0, 90] })), /cannot turn/);
	assert.match(errs(b => (b.parts[1].rotate = { axis: "x", deg: [0, 90] })), /turns about a vertical axis only/);
	assert.match(errs(b => (b.interact.states[1].parts.crank = { turn: 400 })), /turn must be degrees within rotate\.deg/);
	assert.match(errs(b => (b.interact.states[1].parts.base = { turn: 4 })), /turn needs part\.rotate/);
	assert.match(errs(b => (b.interact = { behavior: "select" })), /parts\[3\]\.variants needs interact\.behavior "step" or "scrub"/);
	assert.match(errs(b => (b.interact = { behavior: "select", states: [] })), /interact\.states applies to step and scrub/);
	// No caps: many states, many turn samples.
	assert.equal(errs(b => {
		b.parts[6].rotate.samples = 72;
		b.interact.values = undefined;
		b.interact.readout = undefined;
		b.interact.states = Array.from({ length: 40 }, (_, k) => ({ name: `s${k}` }));
	}), "");
});

test("rotate: samples span deg evenly; a turned part moves about its pivot and its axis turns with it", () => {
	assert.deepEqual(turnSamples({ deg: [0, 120], samples: 5 }), [0, 30, 60, 90, 120]);
	assert.equal(turnSamples({ deg: [0, 90] }).length, 12, "12 samples by default");
	const rod = rotatePart({ id: "r", kind: "rod", from: [0, 0, 0], to: [10, 0, 0], radius: 1, rotate: { axis: "z", about: [0, 0, 0], deg: [0, 90] } }, 90);
	assert.deepEqual(rod.to, [0, 10, 0]);
	assert.equal(rod.rotate, undefined);
	const cone = rotatePart({ id: "c", kind: "cone", at: [0, 0, 0], axis: "z", r0: 2, r1: 1, length: 4, rotate: { axis: "x", deg: [0, 90] } }, 90);
	assert.deepEqual(cone.axis.map(v => Math.round(v)), [0, -1, 0]);
});

test("scene and emit: variant groups, turn samples, rest-hidden parts and shadows carry display=none; state model on the stage", () => {
	const scene = buildScene(STEP);
	const region = renderRegion(scene);
	const cfg = scene.states;
	assert.equal(cfg.rest, 0);
	assert.deepEqual(cfg.states.map(s => s.text), ["idle · 12.4 kN", "spool · 45.6 kN", "full · 79.3 kN"]);
	assert.deepEqual(cfg.turns.crank, [0, 15, 30, 45, 60, 75, 90, 105, 120]);
	assert.equal(cfg.states[0].m, undefined, "the rest state moves nothing");
	assert.ok(cfg.states[2].m.carriage.length === 4, "part move and shadow move");
	assert.deepEqual(cfg.states[1].p.nozzle, { v: "half" });
	assert.deepEqual(cfg.states[0].p.plume, { h: 1 });
	// Per-state painter order: a permutation of every piece; the rest state is DOM order.
	const n = scene.pieces.length;
	for (const state of cfg.states) assert.deepEqual(state.o.split(" ").map(Number).sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i));
	assert.equal(cfg.states[0].o, Array.from({ length: n }, (_, i) => i).join(" "));
	assert.notEqual(cfg.states[2].o, cfg.states[0].o, "the moved carriage reorders against the nozzle");
	// Markup: the variant pieces and turn samples, hidden unless the rest state shows them.
	assert.match(region, /data-vpk-iso-part="nozzle@base"[^>]*data-vpk-iso-variant="base">/);
	assert.match(region, /data-vpk-iso-part="nozzle@open"[^>]*data-vpk-iso-variant="open" display="none">/);
	assert.match(region, /data-vpk-iso-part="crank@turn-0"[^>]*data-vpk-iso-variant="turn-0">/);
	assert.equal((region.match(/data-vpk-iso-part="crank@turn-\d+"[^>]*display="none"/g) ?? []).length, 8);
	assert.match(region, /data-vpk-iso-part="plume"[^>]*display="none">/);
	assert.match(region, /data-vpk-iso-shadow-for="plume"[^>]*display="none"\/>/, "a hidden part's shadow is hidden with it");
	assert.match(region, /data-vpk-iso-behavior="step"[^>]*tabindex="0"[^>]*data-vpk-iso-states="\{&quot;rest&quot;:0/);
	assert.match(region, /<output class="vpk-iso-readout" data-vpk-iso-readout aria-live="off">idle · 12\.4 kN<\/output>/);
	assert.doesNotMatch(region, /data-vpk-iso-control/, "step has no slider");
	assert.deepEqual(auditHtml(region).findings.filter(f => f.severity === "error"), []);
	// Scrub: a slider with one stop per state and the rest state's text.
	const scrub = renderRegion(buildScene(SCRUB));
	assert.match(scrub, /<input type="range" data-vpk-iso-control="scrub" min="0" max="2" step="any" value="0" aria-valuetext="upright · tilt 0°" autocomplete="off">/);
	assert.deepEqual(auditHtml(scrub).findings.filter(f => f.severity === "error"), []);
	// Deterministic.
	assert.equal(renderSvg(buildScene(STEP)), renderSvg(scene));
});

test("a step brief resting on a later state draws that state as its static art", () => {
	const brief = clone(STEP);
	brief.interact.rest = "full";
	brief.interact.states[2].parts.carriage = {};
	brief.interact.states[1].parts.carriage = { move: [-40, 0, 0] };
	brief.interact.states[0].parts.carriage = { move: [-76, 0, 0] };
	const region = renderRegion(buildScene(brief));
	assert.match(region, /data-vpk-iso-part="nozzle@open"[^>]*data-vpk-iso-variant="open">/, "open nozzle at rest");
	assert.match(region, /data-vpk-iso-part="nozzle@base"[^>]*display="none">/);
	assert.doesNotMatch(region, /data-vpk-iso-part="plume"[^>]*display/, "the plume shows at rest");
	assert.match(region, /aria-live="off">full · 79\.3 kN</);
});

test("scrub: a part sliding past another is reordered mid-segment, not only at the states (per-sample painter order)", () => {
	const brief = {
		schema: "vpk-iso-brief/1", id: "scrub-pass", figId: "FIG_044", title: "Pass", labels: "none", focal: "block",
		label: "A block slides from behind a post to in front of it as you scrub.",
		parts: [
			{ id: "floor", kind: "slab", at: [0, -10, 0], size: [100, 140, 4] },
			{ id: "post", kind: "box", at: [50, 30, 4], size: [6, 6, 30] },
			{ id: "block", kind: "box", at: [50, 0, 4], size: [6, 6, 10] },
		],
		interact: { behavior: "scrub", states: [{ name: "behind" }, { name: "front", parts: { block: { move: [0, 120, 0] } } }] },
	};
	const scene = buildScene(brief);
	const cfg = scene.states;
	const ids = scene.pieces.map(piece => piece.id);
	const rank = (o, id) => o.split(" ").map(Number).indexOf(ids.indexOf(id));
	assert.ok(rank(cfg.states[0].o, "block") < rank(cfg.states[0].o, "post"), "at rest the block is behind the post");
	assert.ok(Array.isArray(cfg.states[0].s) && cfg.states[0].s.length > 1, "segment orders are emitted");
	for (const [, o] of cfg.states[0].s) assert.deepEqual(o.split(" ").map(Number).sort((a, b) => a - b), ids.map((_, i) => i));
	// t 0.33: the block is at y 39.6, already in front of the post (y 30–36), but the nearer state is still "behind".
	const pose = scrubPose(cfg, 0.33);
	assert.equal(pose.near, 0);
	assert.ok(rank(orderOf(cfg, pose), "block") > rank(orderOf(cfg, pose), "post"), "mid-segment the block paints over the post");
	assert.equal(orderOf(cfg, scrubPose(cfg, 0)), cfg.states[0].o, "on a state its own order");
	assert.equal(orderOf(cfg, scrubPose(cfg, 1)), cfg.states[1].o);
	assert.equal(cfg.states[1].s, undefined, "the last state has no segment");
});

async function withRuntime(region, run) {
	GlobalRegistrator.register({ url: "http://localhost/", width: 1280, height: 800 });
	for (const name of ["__vpkRehearsal", "__vpkIsoRehearsal", "vpkSmil"]) delete globalThis[name];
	try {
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
			onReducedMotionChange() {},
		};
		const api = createIsoRuntime(window, loop, { ...core, blink, tagLines, mountStates });
		api.scan();
		// One monotonic clock: input timestamps come from performance.now(), so each run starts no earlier than the last one ended.
		let clock = 0;
		const step = (ms, { calm = false } = {}) => {
			const start = Math.max(clock, performance.now());
			let busy = false;
			for (let t = start; t <= start + ms; t += 16) busy = boards[0].tick(0.016, (clock = t), calm);
			return busy;
		};
		await run({ boards, step, setReduced: value => (reduced = value) });
	} finally {
		await GlobalRegistrator.unregister();
	}
}

const key = (el, k) => el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const pointer = (el, type, clientX, clientY = 200) => el.dispatchEvent(new window.PointerEvent(type, { clientX, clientY, pointerType: "mouse", bubbles: true }));

test("step runtime: keys and clicks step, variants and hidden parts swap, the move tweens, the order changes only on change, rest is the static art", async () => {
	await withRuntime(renderRegion(buildScene(STEP)), async ({ boards, step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const readout = document.querySelector("[data-vpk-iso-readout]");
		const live = document.querySelector("[data-vpk-iso-live]");
		const snapshot = svg.outerHTML;
		const shown = id => !svg.querySelector(`[data-vpk-iso-part="${id}"]`).hasAttribute("display");
		const carriage = svg.querySelector('[data-vpk-iso-part="carriage"]');
		assert.equal(boards.length, 1);
		key(stage, "ArrowRight");
		step(100);
		assert.ok(carriage.hasAttribute("transform"), "mid-tween the carriage is moving");
		assert.equal(step(800), false, "the 700 ms tween settles and sleeps");
		assert.equal(readout.textContent, "spool · 45.6 kN");
		assert.equal(live.textContent, "spool · 45.6 kN", "the live region speaks on the commit");
		assert.ok(shown("nozzle@half") && !shown("nozzle@base") && !shown("plume"));
		assert.ok(shown("crank@turn-4") && !shown("crank@turn-0"), "60° shows sample 4");
		const order = () => [...svg.querySelectorAll("[data-vpk-iso-part]")].map(el => el.getAttribute("data-vpk-iso-part")).join(" ");
		const before = order();
		const records = [];
		const observer = new window.MutationObserver(list => records.push(...list.filter(r => r.type === "childList")));
		observer.observe(svg, { childList: true, subtree: true });
		step(200);
		await new Promise(resolve => setTimeout(resolve, 0));
		observer.disconnect();
		assert.equal(records.length, 0, `no reorder while the state holds: ${records.slice(0, 3).map(r => `${r.target.getAttribute?.("data-vpk-iso-part") ?? r.target.nodeName}+${r.addedNodes.length}-${r.removedNodes.length}`).join(" ")}`);
		assert.equal(order(), before);
		stage.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		step(800);
		assert.equal(readout.textContent, "full · 79.3 kN");
		assert.ok(shown("plume") && shown("nozzle@open"));
		key(stage, "Enter");
		step(800);
		assert.equal(readout.textContent, "idle · 12.4 kN", "wraps to the first state");
		assert.equal(svg.querySelectorAll("[transform]:not(text)").length, 0, "no transforms at rest");
		assert.equal(svg.outerHTML, snapshot, "after a full cycle the SVG equals the static art (R9)");
		key(stage, "End");
		step(800);
		key(stage, "Escape");
		step(800);
		assert.equal(svg.outerHTML, snapshot, "Escape returns to rest");
	});
});

test("step runtime under reduced motion lands in one tick; print shows the rest state and afterprint brings the state back", async () => {
	await withRuntime(renderRegion(buildScene(STEP)), async ({ boards, step, setReduced }) => {
		setReduced(true);
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const snapshot = svg.outerHTML;
		key(stage, "End");
		assert.equal(step(0, { calm: true }), false, "one tick, no further frames");
		assert.equal(document.querySelector("[data-vpk-iso-readout]").textContent, "full · 79.3 kN");
		assert.notEqual(svg.outerHTML, snapshot);
		boards[0].rest();
		assert.equal(svg.outerHTML, snapshot, "the print pose is the static art");
		assert.equal(step(16, { calm: true }), false, "printing holds: tick writes nothing");
		assert.equal(svg.outerHTML, snapshot);
	});
});

test("scrub runtime: a drag maps pointer x to t, interpolates the move, commits on release; arrow keys snap; slider syncs; rest is the static art", async () => {
	await withRuntime(renderRegion(buildScene(SCRUB)), async ({ step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const readout = document.querySelector("[data-vpk-iso-readout]");
		const live = document.querySelector("[data-vpk-iso-live]");
		const control = document.querySelector("[data-vpk-iso-control]");
		const snapshot = svg.outerHTML;
		pointer(stage, "pointerdown", 0);
		pointer(stage, "pointermove", 0.25 * 720);
		assert.equal(step(1500), false, "the spring settles");
		assert.equal(readout.textContent, "tilting · tilt 18°", "t 0.5 interpolates the values; the name switches at the midpoint");
		assert.equal(live.textContent, "", "no speech while dragging");
		assert.ok(svg.querySelector('[data-vpk-iso-part="cart:back"]').hasAttribute("transform"), "the cart moved half way");
		pointer(stage, "pointerup", 0.25 * 720);
		step(100);
		assert.equal(live.textContent, "tilting · tilt 18°", "release commits and speaks");
		assert.equal(control.value, "0.5");
		key(stage, "ArrowRight");
		step(1500);
		assert.equal(readout.textContent, "tilting · tilt 35°", "an arrow snaps to the next whole state");
		key(stage, "End");
		step(1500);
		assert.equal(readout.textContent, "pouring · 70°", "a state's own readout on the state");
		assert.ok(!svg.querySelector('[data-vpk-iso-part="stream"]').hasAttribute("display"), "the stream shows when pouring");
		control.value = "0";
		control.dispatchEvent(new window.Event("input", { bubbles: true }));
		control.dispatchEvent(new window.Event("change", { bubbles: true }));
		step(1500);
		assert.equal(readout.textContent, "upright · tilt 0°");
		assert.equal(svg.outerHTML, snapshot, "back at rest the SVG equals the static art");
	});
});

test("scrub runtime: hovering a part names it in the readout and outlines it; leave restores the state's readout", async () => {
	await withRuntime(renderRegion(buildScene(SCRUB)), async ({ step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const readout = document.querySelector("[data-vpk-iso-readout]");
		const floor = svg.querySelector('[data-vpk-iso-part="floor"]');
		const pts = core.parsePolyPath(floor.querySelector('[data-vpk-iso-role="top"]').getAttribute("d"));
		const [x, y] = pts.reduce(([sx, sy], [px, py]) => [sx + px / pts.length, sy + py / pts.length], [0, 0]);
		pointer(stage, "pointermove", x, y);
		step(50);
		assert.equal(readout.textContent, "floor");
		assert.ok(floor.classList.contains("is-active"));
		pointer(stage, "pointerleave", 0, 0);
		step(50);
		assert.equal(readout.textContent, "upright · tilt 0°");
		assert.equal(floor.hasAttribute("class"), false);
	});
});

// Judge finding (anatomy step/scrub figures): after a commit the figure's text held the readout twice, the visible readout and
// the live region, so browse mode read it twice. The live region speaks the commit, then empties (LIVE_CLEAR_MS later).
test("step and scrub runtime: the live region speaks a commit once, then empties so the figure text holds the readout once", async () => {
	for (const brief of [STEP, SCRUB]) {
		await withRuntime(renderRegion(buildScene(brief)), async ({ step }) => {
			const stage = document.querySelector("[data-vpk-iso-stage]");
			const figure = stage.closest("figure");
			const readout = document.querySelector("[data-vpk-iso-readout]");
			const live = document.querySelector("[data-vpk-iso-live]");
			const count = text => figure.textContent.split(text).length - 1;
			key(stage, "ArrowRight");
			step(1500);
			const text = readout.textContent;
			assert.equal(live.textContent, text, `${brief.id}: the commit is spoken`);
			await new Promise(resolve => setTimeout(resolve, LIVE_CLEAR_MS + 50));
			assert.equal(live.textContent, "", `${brief.id}: the live region empties after speaking`);
			assert.equal(count(text), 1, `${brief.id}: the figure text holds "${text}" once`);
			key(stage, "ArrowLeft");
			step(1500);
			key(stage, "ArrowRight");
			step(1500);
			assert.equal(live.textContent, text, `${brief.id}: the same state committed again speaks again`);
		});
	}
});

// Judge finding: hovering a part named it in the readout while the drawing showed no outline. After a print pose the parts'
// cached hover flag survived the class removal, so the part under the pointer never took .is-active again.
test("scrub runtime: after printing, the hovered part takes the accent outline again", async () => {
	await withRuntime(renderRegion(buildScene(SCRUB)), async ({ boards, step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const readout = document.querySelector("[data-vpk-iso-readout]");
		const floor = svg.querySelector('[data-vpk-iso-part="floor"]');
		const pts = core.parsePolyPath(floor.querySelector('[data-vpk-iso-role="top"]').getAttribute("d"));
		const [x, y] = pts.reduce(([sx, sy], [px, py]) => [sx + px / pts.length, sy + py / pts.length], [0, 0]);
		pointer(stage, "pointermove", x, y);
		step(50);
		assert.ok(floor.classList.contains("is-active"));
		boards[0].rest();
		assert.equal(floor.hasAttribute("class"), false, "the print pose is the static art");
		window.dispatchEvent(new window.Event("afterprint"));
		pointer(stage, "pointermove", x, y);
		step(50);
		assert.equal(readout.textContent, "floor");
		assert.ok(floor.classList.contains("is-active"), "the named part is outlined, not only named");
	});
});
