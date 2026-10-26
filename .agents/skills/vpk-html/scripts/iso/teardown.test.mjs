// iso teardown (illustrations.md § Teardown): the travel model, the exploded static art, the schema, and the runtime's
// Exploded / Assembled switch, Spread slider and part naming, driven in happy-dom with a fake frame loop.
// Assertions compare strings, numbers and booleans only.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { auditHtml } from "./audit.mjs";
import * as core from "./core.mjs";
import { renderRegion } from "./emit.mjs";
import { blink, tagLines } from "./manual-runtime.mjs";
import { createIsoRuntime } from "./runtime.mjs";
import { buildScene } from "./scene.mjs";
import { validateBrief } from "./schema.mjs";
import { explodedBrief, teardownTravel } from "./teardown.mjs";

const load = name => JSON.parse(fs.readFileSync(new URL(`./briefs/${name}.json`, import.meta.url), "utf8"));
const RECT = { left: 0, top: 0, right: 720, bottom: 450, width: 720, height: 450, x: 0, y: 0 };
const STACK = {
	schema: "vpk-iso-brief/1",
	id: "td-stack",
	figId: "FIG_001",
	title: "A small stack",
	label: "A base, a plate on it with a chip, and a lid.",
	parts: [
		{ id: "base", kind: "slab", at: [0, 0, 0], size: [60, 40, 4], label: "Base" },
		{ id: "plate", kind: "slab", at: [5, 5, 4], size: [50, 30, 2], label: "Plate" },
		{ id: "chip", kind: "box", at: [20, 12, 6], size: [10, 10, 2], label: "Chip" },
		{ id: "lid", kind: "slab", at: [0, 0, 8], size: [60, 40, 2], label: "Lid", explode: [10, 0, 40] },
	],
	focal: "chip",
	assemble: { layers: [["base"], ["plate", "chip"], ["lid"]] },
	interact: { behavior: "teardown", teardown: { gap: 20 } },
};

test("teardown travel: layer × gap straight up, a part rides a support in its own layer, an explode vector wins", () => {
	const travel = teardownTravel(STACK);
	assert.deepEqual(travel.get("base"), [0, 0, 0]);
	assert.deepEqual(travel.get("plate"), [0, 0, 20]);
	assert.deepEqual(travel.get("chip"), [0, 0, 20], "the chip rides the plate it sits on (same layer)");
	assert.deepEqual(travel.get("lid"), [10, 0, 40]);
});

test("explodedBrief moves each part by its travel, carries it as explode, drops the entry, and leaves non-teardown briefs alone", () => {
	const out = explodedBrief(STACK);
	const by = Object.fromEntries(out.parts.map(part => [part.id, part]));
	assert.deepEqual(by.plate.at, [5, 5, 24]);
	assert.deepEqual(by.lid.at, [10, 0, 48]);
	assert.deepEqual(by.lid.explode, [10, 0, 40]);
	assert.equal(out.assemble, undefined, "a teardown has no entry drop");
	const plain = { ...STACK, interact: { behavior: "select" } };
	assert.equal(explodedBrief(plain), plain);
	// Label anchors ride their target.
	const anchored = explodedBrief({ ...STACK, labels: [{ text: "Lid", target: "lid", anchor: [30, 20, 10] }] });
	assert.deepEqual(anchored.labels[0].anchor, [40, 20, 50]);
});

test("schema: teardown options validate; lift and explode do not apply", () => {
	assert.deepEqual(validateBrief(STACK), []);
	const bad = interact => validateBrief({ ...STACK, interact }).join("\n");
	assert.match(bad({ behavior: "teardown", teardown: { step: 2 } }), /teardown.step/);
	assert.match(bad({ behavior: "teardown", teardown: { start: "open" } }), /teardown.start/);
	assert.match(bad({ behavior: "teardown", teardown: { gap: -1 } }), /teardown.gap/);
	assert.match(bad({ behavior: "teardown", lift: 4 }), /lift does not apply/);
	assert.match(validateBrief({ ...STACK, parts: [{ ...STACK.parts[0], guides: true }, ...STACK.parts.slice(1)] }).join("\n"), /guides is false or absent/);
});

test("scene and emit: the static art is exploded, the plate carries the switch and the Spread slider, and the audit is clean", () => {
	const scene = buildScene(STACK);
	assert.equal(scene.behavior, "teardown");
	assert.deepEqual([scene.explode.min, scene.explode.rest, scene.explode.max], [0, 1, 1]);
	assert.ok(scene.pieces.every(piece => Number.isFinite(piece.depth0)), "every piece knows its assembled painter order");
	const html = renderRegion(scene);
	assert.match(html, /data-vpk-iso-behavior="teardown"/);
	assert.match(html, /<button type="button" data-vpk-iso-pose="1" aria-pressed="true">Exploded<\/button>/);
	assert.match(html, /<button type="button" data-vpk-iso-pose="0" aria-pressed="false">Assembled<\/button>/);
	assert.match(html, /Spread <input type="range" data-vpk-iso-control="explode" min="0" max="1"/);
	assert.match(html, /<svg [^>]*data-vpk-iso-blink/);
	assert.deepEqual(auditHtml(html).findings.filter(finding => finding.severity === "error"), []);
});

test("every teardown example brief builds with no audit errors", () => {
	for (const name of fs.readdirSync(new URL("./briefs/", import.meta.url)).filter(file => /^td-.*\.json$/.test(file))) {
		const html = renderRegion(buildScene(load(name.replace(/\.json$/, ""))));
		const errors = auditHtml(html).findings.filter(finding => finding.severity === "error");
		assert.deepEqual(errors.map(finding => `${finding.rule} ${finding.message}`), [], name);
	}
});

async function withRuntime(region, run) {
	GlobalRegistrator.register({ url: "http://localhost/", width: 1280, height: 800 });
	try {
		globalThis.Element.prototype.getBoundingClientRect = () => ({ ...RECT });
		document.body.innerHTML = `<main>${region}</main>`;
		const boards = [];
		const loop = {
			register(stage, tick, opts) {
				const board = { stage, tick, rest: opts && opts.rest };
				boards.push(board);
				return { wake() {}, unregister() {} };
			},
			reducedMotion: () => false,
			onReducedMotionChange() {},
		};
		createIsoRuntime(window, loop, { ...core, blink, tagLines }).scan();
		const step = ms => {
			const start = performance.now();
			let busy = false;
			for (let t = start; t <= start + ms; t += 16) busy = boards[0].tick(0.016, t, false);
			return busy;
		};
		await run({ step });
	} finally {
		await GlobalRegistrator.unregister();
	}
}

test("runtime: Assembled closes the stack and hides labels, Exploded reopens it to the static art, hover names a part", async () => {
	const brief = { ...STACK, labels: [{ text: "Lid", target: "lid", side: "right" }] };
	await withRuntime(renderRegion(buildScene(brief)), async ({ step }) => {
		const stage = document.querySelector("[data-vpk-iso-stage]");
		const svg = stage.querySelector("svg");
		const readout = document.querySelector("[data-vpk-iso-readout]");
		const control = document.querySelector("[data-vpk-iso-control]");
		const [exploded, assembled] = [...document.querySelectorAll("[data-vpk-iso-pose]")];
		const snapshot = svg.outerHTML;
		assert.equal(readout.textContent, "exploded");
		assembled.click();
		assert.equal(step(1500), false, "settles and sleeps");
		assert.equal(control.value, "0");
		assert.equal(readout.textContent, "assembled");
		assert.equal(assembled.getAttribute("aria-pressed"), "true");
		assert.equal(exploded.getAttribute("aria-pressed"), "false");
		assert.ok(svg.classList.contains("vpk-iso-assembling"), "labels hide off the exploded pose");
		assert.ok(svg.querySelector('[data-vpk-iso-part="lid"]').hasAttribute("transform"), "the lid moved down");
		// The lid paints last in both poses, and the assembled order puts the chip under it.
		const order = () => [...svg.querySelectorAll("[data-vpk-iso-part]")].map(el => el.getAttribute("data-vpk-iso-part"));
		assert.equal(order().at(-1), "lid");
		exploded.click();
		step(1500);
		assert.equal(readout.textContent, "exploded");
		assert.equal(svg.querySelectorAll("[data-vpk-iso-part][transform]").length, 0, "no transforms at rest");
		assert.equal(svg.outerHTML, snapshot, "back at the static art");
		const chip = svg.querySelector('[data-vpk-iso-part="chip"] [data-vpk-iso-role="top"]');
		const pts = core.hull(core.parsePolyPath(chip.getAttribute("d")));
		const [cx, cy] = [pts.reduce((s, [x]) => s + x, 0) / pts.length, pts.reduce((s, [, y]) => s + y, 0) / pts.length];
		stage.dispatchEvent(new window.PointerEvent("pointermove", { clientX: cx, clientY: cy, pointerType: "mouse", bubbles: true }));
		step(400);
		assert.equal(readout.textContent, "Chip");
		assert.ok(svg.querySelector('[data-vpk-iso-part="chip"]').classList.contains("is-active"));
	});
});
