import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildScene } from "./scene.mjs";
import { renderSvg } from "./emit.mjs";
import { ENTRY } from "./accent.mjs";
import { enterAnimation, enterKeyframes, entryClass, fadeAnimation, fadeStart, handoffTimes, HOLD_SPLINE, MANUAL_HOLD_MS, MANUAL_PART_MS, MANUAL_STEP_MS, manualTiming, MOVE_SPLINE } from "./motion.mjs";

const EXEMPLAR = JSON.parse(fs.readFileSync(new URL("./briefs/exploded-stack.json", import.meta.url), "utf8"));
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

test("enter keyframes: non-decreasing keyTimes without duplicates, one spline per segment, ends at rest", () => {
	for (const layers of [1, 2, 4, 6]) {
		const timing = manualTiming({ layers });
		for (let i = 0; i < layers; i++) {
			const { values, keyTimes, keySplines } = enterKeyframes(i, timing, [0, -20.8]);
			const times = keyTimes.split(";").map(Number);
			const list = values.split(";");
			const splines = keySplines.split(";");
			assert.equal(list.length, times.length, "values = keyTimes");
			assert.equal(splines.length, times.length - 1, "keySplines = keyTimes − 1");
			assert.equal(times[0], 0);
			assert.equal(times.at(-1), 1);
			for (let k = 1; k < times.length; k++) assert.ok(times[k] > times[k - 1], `strictly increasing ${keyTimes}`);
			assert.equal(list.at(-1), "0 0");
			assert.equal(list[0], "0 -20.8");
			assert.ok(splines.every(spline => spline === MOVE_SPLINE || spline === HOLD_SPLINE));
			assert.equal(splines.filter(spline => spline === MOVE_SPLINE).length, 1, "one move segment");
		}
	}
});

test("every element is begin=indefinite with data-vpk-begin=0s, and all layers share dur", () => {
	const timing = manualTiming({ layers: 3 });
	const tags = [0, 1, 2].map(i => enterAnimation(i, timing, [0, -10])).concat(fadeAnimation(fadeStart(timing), timing));
	for (const tag of tags) {
		assert.equal(attr(tag, "begin"), "indefinite");
		assert.equal(attr(tag, "data-vpk-begin"), "0s");
		assert.equal(attr(tag, "dur"), `${timing.total}ms`);
		assert.equal(attr(tag, "fill"), "freeze");
		assert.doesNotMatch(tag, /repeatCount|repeatDur/);
	}
	assert.match(tags[0], /^<animateTransform\b[^>]*attributeName="transform" type="translate"/);
	assert.match(tags[3], /attributeName="opacity"[^>]*values="0;0;1"/);
	const fade = fadeStart(timing);
	assert.ok(fade > 0 && fade < 1);
});

test("the default start offset drops parts into place (dy < 0 at 45/30), and the SVG carries data-vpk-smil-arm", () => {
	const scene = buildScene(EXEMPLAR);
	assert.ok(scene.enterOffset[1] < 0);
	assert.equal(scene.enterOffset[0], 0);
	const svg = renderSvg(scene);
	assert.match(svg, /^<svg\b[^>]*\sdata-vpk-smil-arm[\s>]/);
	const durs = new Set([...svg.matchAll(/\sdur="([^"]+)"/g)].map(match => match[1]));
	assert.deepEqual([...durs], [`${scene.timing.total}ms`]);
	// One landing per motion group, plus one per layer's cast-shadow group (the shadows slide in on the ground with their layer).
	// A shadow received on a part's top slides in with its caster's layer too (one enter group per received shadow).
	const shadowLayers = new Set(scene.shadows.map(entry => entry.layer)).size;
	const received = scene.pieces.reduce((sum, piece) => sum + (piece.received?.shadows.length ?? 0), 0);
	assert.ok(received > 0, "the stack's upper parts shadow the tops below");
	assert.equal([...svg.matchAll(/<animateTransform\b/g)].length, scene.groups.length + shadowLayers + received);
	assert.equal([...svg.matchAll(/<g data-vpk-iso-shadow-enter="\d+">/g)].length, shadowLayers + received);
});

// Rule 10: 700 ms landings on an even stagger shorter than a drop (the drops overlap), under 1.8 s; the first layer drops at once.
test("manualTiming: 700 ms landings from the start, even overlapping gaps, total under 1.8 s", () => {
	assert.throws(() => manualTiming({ layers: 0 }), /at least one layer/);
	assert.throws(() => manualTiming({ layers: 7 }), /7 layers exceeds 6/);
	for (let n = 1; n <= 6; n++) {
		const timing = manualTiming({ layers: n });
		assert.equal(timing.part, MANUAL_PART_MS);
		assert.equal(timing.starts[0], 0, `${n} layers: the first layer drops at once (no ghost or arrow lead)`);
		assert.ok(timing.total <= 1800, `${n} layers: ${timing.total} ms`);
		const gaps = timing.starts.slice(1).map((start, i) => start - timing.starts[i]);
		assert.ok(gaps.every(gap => gap === MANUAL_STEP_MS), `${n} layers: every gap is ${MANUAL_STEP_MS} ms (uniform), got ${gaps}`);
		assert.ok(MANUAL_STEP_MS < MANUAL_PART_MS, "the next layer starts before the previous one lands (overlap)");
	}
	assert.deepEqual(manualTiming({ layers: [["a"], ["b"]] }), manualTiming({ layers: 2 }));
});

test("the entry drops each layer from ENTRY.DROP_Z with an accent hand-off, and draws no ghost or arrow", () => {
	const brief = { ...structuredClone(EXEMPLAR), assemble: { layers: [["base"], ["core", "module"], ["shell"]] } };
	const scene = buildScene(brief);
	assert.equal(scene.timing.manual, true);
	const svg = renderSvg(scene);
	assert.doesNotMatch(svg, /data-vpk-iso-ghost|data-vpk-iso-cue/);
	const handoff = /<animate [^>]*attributeName="class"[^>]*values="([^"]+)"[^>]*keyTimes="([^"]+)"/.exec(svg);
	// Starts 0, 180, 360; each hands back MANUAL_HOLD_MS (180) after its start: 180 and 360 coincide with the next start.
	assert.deepEqual(handoff[1].split(";"), ["vpk-iso-h0 vpk-iso-h1 vpk-iso-h2", "vpk-iso-a0 vpk-iso-h1 vpk-iso-h2", "vpk-iso-a1 vpk-iso-h2", "vpk-iso-a2", "vpk-iso-set"]);
	assert.equal(handoff[2].split(";").length, 5);
	// The drop is ENTRY.DROP_Z world units: straight down on screen at the dimetric camera.
	assert.equal(scene.enterOffset[0], 0);
	assert.ok(scene.enterOffset[1] < -ENTRY.DROP_Z, `a ${ENTRY.DROP_Z}-unit drop moves up the screen by more than its world length at this fit (${scene.enterOffset[1]})`);
});

// Redline 2b: every layer, the last included, hands its accent back the same fixed time after it starts (so the same point of
// its own drop): the last layer used to stay orange until it fully landed, 520 ms longer than the others.
test("the hand-off is uniform: every layer, the last included, loses the accent ENTRY.ACCENT_HOLD_MS after it starts", () => {
	assert.equal(MANUAL_HOLD_MS, ENTRY.ACCENT_HOLD_MS);
	for (const layers of [1, 2, 3, 6]) {
		const timing = manualTiming({ layers });
		const accentedAt = (i, t) => entryClass(t, timing).split(" ").includes(`vpk-iso-a${i}`);
		const ends = timing.starts.map((start, i) => {
			assert.ok(accentedAt(i, start), `layer ${i} is accented as it starts`);
			const events = handoffTimes(timing).filter(t => t > start && !accentedAt(i, t));
			return events[0] - start;
		});
		assert.deepEqual(ends, timing.starts.map(() => MANUAL_HOLD_MS), `${layers} layers: hand-off intervals ${ends}`);
		assert.ok(timing.lastStart + MANUAL_HOLD_MS + ENTRY.HANDOFF_MS <= timing.total, "the last fade ends inside the assembly");
		assert.equal(entryClass(timing.total, timing), "vpk-iso-set", "the scene rests on the class that paints nothing");
	}
	// The SMIL values follow the same events: in a 6-layer entry the last accent class drops at lastStart + hold.
	const timing = manualTiming({ layers: 6 });
	const svgTimes = handoffTimes(timing);
	assert.ok(svgTimes.includes(timing.lastStart + MANUAL_HOLD_MS));
	assert.ok(svgTimes.at(-1) < timing.total);
});
