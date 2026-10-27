// iso camera tour (illustrations.md § Camera tour): the brief schema, the repeat expansion, the emitted stage model and controls,
// the pure reducer and framing, and the runtime in happy-dom with a fake frame loop (ticks by hand, so timing is deterministic).
// Assertions compare strings, numbers and booleans only.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { ENTRY } from "./accent.mjs";
import { auditHtml } from "./audit.mjs";
import * as core from "./core.mjs";
import { renderRegion, renderSvg } from "./emit.mjs";
import { blink, tagLines } from "./manual-runtime.mjs";
import { createIsoRuntime, LIVE_CLEAR_MS } from "./runtime.mjs";
import { ISO_CSS } from "./runtime-css.mjs";
import { buildScene, validateBrief } from "./scene.mjs";
import { mountStates } from "./state-runtime.mjs";
import { TOUR_PAD, tourConfig } from "./tour.mjs";
import { mountTour, TOUR_CAMERA_MS, TOUR_MAX_ZOOM, TOUR_TITLE_MS, tourFrame, tourReducer } from "./tour-runtime.mjs";

const SOURCE = fs.readFileSync(new URL("./tour-runtime.mjs", import.meta.url), "utf8");
const TOUR = {
	schema: "vpk-iso-brief/1",
	id: "tour-bench",
	figId: "FIG_901",
	title: "A bench with a camera tour",
	label: "A base plate with a drum, a block and a row of three pegs; a tour frames each in turn.",
	parts: [
		{ id: "base", kind: "slab", at: [0, 0, 0], size: [160, 100, 6], label: "base" },
		{ id: "drum", kind: "cylinder", at: [40, 40, 6], size: [16, 16, 24], label: "drum" },
		{ id: "block", kind: "box", at: [100, 20, 6], size: [30, 24, 14], label: "block" },
		{ id: "peg", kind: "cylinder", at: [100, 70, 6], size: [4, 4, 10], repeat: { linear: { count: 3, step: [12, 0, 0] } } },
	],
	focal: "drum",
	labels: [{ text: "Drum", target: "drum" }],
	tour: {
		overview: "The whole bench.",
		steps: [
			{ title: "Drum", text: "The drum turns on the base.", parts: ["drum"] },
			{ title: "Pegs", text: "Three pegs hold the work.", parts: ["peg"], pad: 12 },
			{ title: "Block and base", text: "The block sits on the base.", parts: ["block", "base"] },
		],
	},
};
const WITH_SELECT = { ...structuredClone(TOUR), id: "tour-select", interact: { behavior: "select", rest: "rest" } };
const RECT = { left: 0, top: 0, right: 720, bottom: 450, width: 720, height: 450, x: 0, y: 0 };

test("tour constants equal iso/accent.mjs ENTRY (tour-runtime.mjs is import-free, so it carries copies)", () => {
	assert.equal(TOUR_CAMERA_MS, ENTRY.STEP_CAMERA_MS);
	assert.equal(TOUR_TITLE_MS, ENTRY.TITLE_FADE_MS);
	assert.doesNotMatch(SOURCE, /^\s*import\b/m);
	assert.doesNotMatch(SOURCE, /requestAnimationFrame|setInterval|setTimeout/, "the camera moves only in vpkFrameLoop ticks");
});

test("schema: a valid tour passes; bad shapes, unknown parts and stray fields fail with named errors", () => {
	assert.deepEqual(validateBrief(TOUR), []);
	assert.deepEqual(validateBrief(WITH_SELECT), []);
	const bad = tour => validateBrief({ ...TOUR, tour }).join("\n");
	assert.match(bad([]), /tour must be an object/);
	assert.match(bad({ steps: [] }), /tour\.steps must be a non-empty list/);
	assert.match(bad({ steps: [{ title: "", text: "x", parts: ["drum"] }] }), /tour\.steps\[0\]\.title must be a non-empty string/);
	assert.match(bad({ steps: [{ title: "a", parts: ["drum"] }] }), /tour\.steps\[0\]\.text must be a non-empty string/);
	assert.match(bad({ steps: [{ title: "a", text: "b", parts: [] }] }), /tour\.steps\[0\]\.parts must be a non-empty list/);
	assert.match(bad({ steps: [{ title: "a", text: "b", parts: ["nope"] }] }), /tour\.steps\[0\]\.parts names unknown part "nope"/);
	assert.match(bad({ steps: [{ title: "a", text: "b", parts: ["drum", "drum"] }] }), /lists "drum" more than once/);
	assert.match(bad({ steps: [{ title: "a", text: "b", parts: ["drum"], pad: -1 }] }), /pad must be a number ≥ 0/);
	assert.match(bad({ steps: [{ title: "a", text: "b", parts: ["drum"], zoom: 2 }] }), /tour\.steps\[0\]\.zoom is not a step field/);
	assert.match(bad({ overview: "", steps: [{ title: "a", text: "b", parts: ["drum"] }] }), /tour\.overview must be a non-empty string/);
	assert.match(bad({ steps: [{ title: "a", text: "b", parts: ["drum"] }], loop: true }), /tour\.loop is not a tour field/);
});

test("scene: a repeat's base id names every instance; the model carries titles, text, parts and the default pad", () => {
	const scene = buildScene(TOUR);
	assert.deepEqual(scene.tour.s.map(s => s.p.join(" ")), ["drum", "peg-0 peg-1 peg-2", "block base"]);
	assert.deepEqual(scene.tour.s.map(s => s.d), [TOUR_PAD, 12, TOUR_PAD]);
	assert.equal(scene.tour.o, "The whole bench.");
	assert.equal(tourConfig({ steps: [{ title: "a", text: "b", parts: ["x"] }] }).o, "1 steps. Press Next step to begin.");
	assert.equal(buildScene({ ...TOUR, tour: undefined }).tour, null);
});

test("emit: a tour-only figure is a tour stage with the model, the Overview caption and the step controls; the svg is the plain static art", () => {
	const scene = buildScene(TOUR);
	const region = renderRegion(scene);
	assert.match(region, /data-vpk-iso-behavior="tour" role="group" aria-roledescription="interactive figure" aria-label="A bench with a camera tour\. A camera tour of 3 steps: [^"]*arrow keys[^"]*"/);
	assert.match(region, /data-vpk-iso-behavior="tour"[^>]*tabindex="0"[^>]*data-vpk-iso-tour="\{&quot;o&quot;:&quot;The whole bench\.&quot;/);
	assert.match(region, /data-vpkh-no-lightbox/);
	assert.match(region, /<p class="vpk-iso-tour__title" data-vpk-iso-tour-title>Overview<\/p><p class="vpk-iso-tour__text" data-vpk-iso-tour-text>The whole bench\.<\/p>/);
	assert.match(region, /<div class="vpk-iso-tour" role="group" aria-label="Camera tour" data-vpk-iso-tour-controls><button type="button" class="vpk-iso-tour__go" data-vpk-iso-tour-go="-1" aria-disabled="true">Previous step<\/button><span class="vpk-iso-tour__count" data-vpk-iso-tour-count>0 \/ 3<\/span><button type="button" class="vpk-iso-tour__go" data-vpk-iso-tour-go="1" aria-disabled="false">Next step<\/button><\/div>/);
	assert.doesNotMatch(region, /data-vpk-iso-readout/, "a tour-only figure has no behaviour readout");
	assert.match(region, /aria-live="polite"/, "the live region speaks the step");
	assert.equal(renderSvg(scene), renderSvg(buildScene({ ...TOUR, tour: undefined })), "step 0 / Overview is the static art: the tour adds nothing to the svg");
	assert.ok(region.indexOf("vpk-iso-tour__caption") < region.indexOf("data-vpk-iso-live"), "the caption leads the frame's foot");
	assert.ok(region.indexOf("data-vpk-iso-tour-controls") > region.indexOf("</svg>"));
	assert.deepEqual(auditHtml(region).findings.filter(f => f.severity === "error"), []);
	// With a behaviour: the behaviour keeps its stage, readout and keys; the tour adds its model, caption and controls.
	const both = renderRegion(buildScene(WITH_SELECT));
	assert.match(both, /data-vpk-iso-behavior="select"[^>]*aria-label="[^"]*Escape returns it to rest\. A camera tour of 3 steps: use the Next step and Previous step buttons to frame/);
	assert.match(both, /data-vpk-iso-readout/);
	assert.match(both, /data-vpk-iso-tour-controls/);
});

test("tourReducer: next and previous clamp (no wrap); Home and Escape go to the Overview, End to the last step", () => {
	assert.deepEqual(tourReducer(0, { type: "go", by: 1 }, 3), { at: 1, handled: true, changed: true });
	assert.deepEqual(tourReducer(3, { type: "go", by: 1 }, 3), { at: 3, handled: true, changed: false });
	assert.deepEqual(tourReducer(0, { type: "go", by: -1 }, 3), { at: 0, handled: true, changed: false });
	assert.equal(tourReducer(1, { type: "key", key: "ArrowRight" }, 3).at, 2);
	assert.equal(tourReducer(2, { type: "key", key: "ArrowLeft" }, 3).at, 1);
	assert.equal(tourReducer(2, { type: "key", key: "Home" }, 3).at, 0);
	assert.equal(tourReducer(2, { type: "key", key: "Escape" }, 3).at, 0);
	assert.equal(tourReducer(0, { type: "key", key: "End" }, 3).at, 3);
	assert.equal(tourReducer(1, { type: "key", key: "x" }, 3).handled, false);
});

test("tourFrame: frames the points with the pad at the viewBox aspect, caps the zoom, stays inside, and no points is the Overview", () => {
	const vb = [0, 0, 720, 450];
	const [x, y, w, h] = tourFrame([[300, 200], [340, 220]], 10, vb);
	assert.ok(Math.abs(w / h - 720 / 450) < 1e-9, "keeps the aspect");
	assert.ok(x <= 290 && y <= 190 && x + w >= 350 && y + h >= 230, "the points and pad are inside");
	assert.ok(Math.abs(w - 720 / TOUR_MAX_ZOOM) < 1e-9, "a tiny part is framed at the zoom cap");
	const edge = tourFrame([[0, 0], [100, 100]], 0, vb);
	assert.ok(edge[0] >= 0 && edge[1] >= 0, "clamped inside the Overview");
	assert.deepEqual(tourFrame([], 10, vb), vb);
	assert.deepEqual(tourFrame([[-50, -50], [800, 500]], 0, vb), vb, "a frame as large as the Overview is the Overview");
});

test("tour CSS: accent faces on the step's parts, the focal part neutral while touring, labels hidden, the title fade on TITLE_FADE_MS", () => {
	assert.match(ISO_CSS, /\[data-vpk-iso-touring\] > svg:not\(\[data-vpk-iso-emphasis\]\) \.is-tour > \[data-vpk-iso-role="top"\] \{ fill: var\(--ill-accent\); \}/);
	assert.match(ISO_CSS, /\[data-vpk-iso-focal\]:not\(\.is-tour\) > \[data-vpk-iso-role="top"\] \{ fill: var\(--surface-raised\); \}/);
	assert.match(ISO_CSS, /\[data-vpk-iso-touring\] > svg :is\(\[data-vpk-iso-label-for\], \[data-vpk-iso-tag\][^{]*\{ visibility: hidden; \}/);
	assert.match(ISO_CSS, new RegExp(`\\.vpk-iso-tour__title\\[data-vpk-iso-tour-fade="1"\\] \\{ animation: vpk-iso-tour-fade-1 ${ENTRY.TITLE_FADE_MS}ms`));
	assert.match(ISO_CSS, /@keyframes vpk-iso-tour-fade-2 \{ from \{ color: var\(--muted-text\); \} to \{ color: var\(--ink\); \} \}/);
	assert.match(ISO_CSS, /prefers-reduced-motion: reduce\) \{[^\n]*\.vpk-iso-tour__title \{ animation-name: none !important; \}/);
	assert.doesNotMatch(ISO_CSS.slice(ISO_CSS.indexOf("vpk-iso-tour")), /#[0-9a-f]{3,8}\b/i, "tokens only");
});

// The runtime with every board ticked (a tour stage registers the tour board, plus the behaviour's own when it has one).
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
		const api = createIsoRuntime(window, loop, { ...core, blink, tagLines, mountStates, mountTour });
		api.scan();
		let clock = 0;
		const step = (ms, { calm = false } = {}) => {
			const start = Math.max(clock, performance.now());
			let busy = false;
			for (let t = start; t <= start + ms; t += 16) {
				busy = false;
				for (const board of boards) busy = board.tick(0.016, (clock = t), calm) || busy;
			}
			return busy;
		};
		await run({ boards, step, setReduced: value => (reduced = value) });
	} finally {
		await GlobalRegistrator.unregister();
	}
}

const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const key = (el, k) => el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const box = svg => svg.getAttribute("viewBox").split(" ").map(Number);

test("tour runtime: Next eases the viewBox over STEP_CAMERA_MS to frame the step, accents its parts, updates caption and counter; Overview is the static art", async () => {
	await withRuntime(renderRegion(buildScene(TOUR)), async ({ boards, step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const snapshot = svg.outerHTML;
		const home = svg.getAttribute("viewBox");
		const [next, prev] = ["1", "-1"].map(by => document.querySelector(`[data-vpk-iso-tour-go="${by}"]`));
		const title = document.querySelector("[data-vpk-iso-tour-title]");
		const text = document.querySelector("[data-vpk-iso-tour-text]");
		const count = document.querySelector("[data-vpk-iso-tour-count]");
		assert.equal(boards.length, 1, "a tour-only stage has the one tour board");
		assert.equal(svg.outerHTML, snapshot, "mounting writes nothing");
		click(next);
		assert.ok(boards[0].wakes > 0, "a click wakes the board");
		step(TOUR_CAMERA_MS / 2);
		const mid = box(svg);
		assert.notEqual(svg.getAttribute("viewBox"), home, "mid-ease the camera has moved");
		assert.equal(step(TOUR_CAMERA_MS), false, "the ease settles and sleeps");
		const end = box(svg);
		assert.ok(end[2] < mid[2] && mid[2] < 720, "the camera zooms in monotonically");
		const drum = svg.querySelector('[data-vpk-iso-part="drum"]');
		const poly = core.partPoly(drum);
		assert.ok(poly.every(([x, y]) => x >= end[0] && x <= end[0] + end[2] && y >= end[1] && y <= end[1] + end[3]), "the drum is inside the frame");
		assert.ok(drum.classList.contains("is-tour"), "the step's part takes the accent class");
		assert.ok(!svg.querySelector('[data-vpk-iso-part="block"]').hasAttribute("class"), "other parts stay neutral");
		assert.ok(stage.hasAttribute("data-vpk-iso-touring"));
		assert.equal(title.textContent, "Drum");
		assert.equal(title.getAttribute("data-vpk-iso-tour-fade"), "1", "the title starts its grey-to-ink fade");
		assert.equal(text.textContent, "The drum turns on the base.");
		assert.equal(count.textContent, "1 / 3");
		assert.equal(prev.getAttribute("aria-disabled"), "false");
		click(next);
		step(TOUR_CAMERA_MS + 50);
		assert.equal(title.getAttribute("data-vpk-iso-tour-fade"), "2", "a new step restarts the fade under the other keyframe name");
		assert.equal([...svg.querySelectorAll(".is-tour")].map(el => el.getAttribute("data-vpk-iso-part")).join(" "), "peg-0 peg-1 peg-2", "a repeated part's instances all take the accent");
		assert.ok(!drum.hasAttribute("class"), "the last step's part hands its accent back");
		key(document.querySelector("[data-vpk-iso-tour-controls]"), "End");
		step(TOUR_CAMERA_MS + 50);
		assert.equal(count.textContent, "3 / 3");
		assert.equal(next.getAttribute("aria-disabled"), "true", "Next is disabled on the last step");
		key(stage, "Home");
		step(TOUR_CAMERA_MS + 50);
		assert.equal(count.textContent, "0 / 3");
		assert.equal(title.textContent, "Overview");
		assert.equal(text.textContent, "The whole bench.");
		assert.equal(svg.getAttribute("viewBox"), home, "the Overview frames the whole figure");
		assert.equal(stage.hasAttribute("data-vpk-iso-touring"), false);
		assert.equal(svg.outerHTML, snapshot, "back on the Overview the SVG equals the static art (R9)");
	});
});

test("tour runtime under reduced motion jumps in one tick with no title fade; print shows the Overview and afterprint brings the step back", async () => {
	await withRuntime(renderRegion(buildScene(TOUR)), async ({ boards, step, setReduced }) => {
		setReduced(true);
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const snapshot = svg.outerHTML;
		const title = document.querySelector("[data-vpk-iso-tour-title]");
		click(document.querySelector('[data-vpk-iso-tour-go="1"]'));
		assert.equal(step(0, { calm: true }), false, "one tick, no further frames");
		const framed = svg.getAttribute("viewBox");
		assert.ok(box(svg)[2] < 720, "the camera is on the step at once");
		assert.equal(title.hasAttribute("data-vpk-iso-tour-fade"), false, "no title fade under reduced motion");
		boards[0].rest();
		assert.equal(svg.outerHTML, snapshot, "the print pose is the static art (the Overview)");
		assert.equal(step(16, { calm: true }), false, "printing holds: tick writes nothing");
		assert.equal(svg.outerHTML, snapshot);
		window.dispatchEvent(new window.Event("afterprint"));
		step(0, { calm: true });
		assert.equal(svg.getAttribute("viewBox"), framed, "after printing the step is framed again");
		assert.ok(svg.querySelector('[data-vpk-iso-part="drum"]').classList.contains("is-tour"));
	});
});

test("tour runtime: the live region announces a step once, then empties", async () => {
	await withRuntime(renderRegion(buildScene(TOUR)), async ({ step }) => {
		const live = document.querySelector("[data-vpk-iso-live]");
		const figure = live.closest("figure");
		const next = document.querySelector('[data-vpk-iso-tour-go="1"]');
		click(next);
		step(TOUR_CAMERA_MS + 50);
		const said = "Step 1 of 3: Drum. The drum turns on the base.";
		assert.equal(live.textContent, said);
		step(TOUR_CAMERA_MS);
		assert.equal(live.textContent, said, "ticks after the commit do not speak again");
		await new Promise(resolve => setTimeout(resolve, LIVE_CLEAR_MS + 50));
		assert.equal(live.textContent, "", "the live region empties after speaking");
		assert.equal(figure.textContent.split("The drum turns on the base.").length - 1, 1, "the figure text holds the step text once");
		click(document.querySelector('[data-vpk-iso-tour-go="-1"]'));
		step(50);
		assert.equal(live.textContent, "Overview. The whole bench.");
	});
});

test("tour with a behaviour: two boards; the stage's arrow keys stay the behaviour's, the tour's buttons and keys drive the camera, and hover maps through the zoomed viewBox", async () => {
	await withRuntime(renderRegion(buildScene(WITH_SELECT)), async ({ boards, step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const snapshot = svg.outerHTML;
		const count = document.querySelector("[data-vpk-iso-tour-count]");
		assert.equal(boards.length, 2, "the tour board and the select board");
		key(stage, "ArrowRight");
		step(400);
		assert.equal(count.textContent, "0 / 3", "the stage's arrows select a part, not a step");
		key(stage, "Escape");
		step(800);
		key(document.querySelector("[data-vpk-iso-tour-controls]"), "ArrowRight");
		step(TOUR_CAMERA_MS + 50);
		assert.equal(count.textContent, "1 / 3", "arrows on the tour controls step the camera");
		// The drum's centre in viewBox units, mapped to the client rect through the zoomed viewBox, hits the drum.
		const [x, y, w, h] = box(svg);
		const pts = core.partPoly(svg.querySelector('[data-vpk-iso-part="drum"]'));
		const [cx, cy] = pts.reduce(([sx, sy], [px, py]) => [sx + px / pts.length, sy + py / pts.length], [0, 0]);
		const s = Math.min(720 / w, 450 / h);
		const clientX = (cx - x) * s + (720 - w * s) / 2;
		const clientY = (cy - y) * s + (450 - h * s) / 2;
		stage.dispatchEvent(new window.PointerEvent("pointermove", { clientX, clientY, pointerType: "mouse", bubbles: true }));
		step(400);
		assert.equal(document.querySelector("[data-vpk-iso-readout]").textContent, "drum", "hover hits what the zoomed camera shows");
		stage.dispatchEvent(new window.PointerEvent("pointerleave", { clientX: 0, clientY: 0, pointerType: "mouse", bubbles: true }));
		step(800);
		key(document.querySelector("[data-vpk-iso-tour-controls]"), "Home");
		step(TOUR_CAMERA_MS + 50);
		// The select lift's re-sort moves part groups without the whitespace between them (runtime.mjs resort, not the tour).
		const tags = html => html.replace(/>\s+</g, "><");
		assert.equal(tags(svg.outerHTML), tags(snapshot), "Overview and rest: the static art");
	});
});
