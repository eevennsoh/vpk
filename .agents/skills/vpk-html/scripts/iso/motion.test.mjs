import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildScene } from "./scene.mjs";
import { renderSvg } from "./emit.mjs";
import { ENTRY } from "./accent.mjs";
import { ENTRY_DROP_CLASS, ENTRY_REST_CLASS, ENTRY_WAIT_CLASS, enterAnimation, enterKeyframes, fadeAnimation, fadeStart, HOLD_SPLINE, layerClassAnimation, layerClassAt, layerClassFrames, MANUAL_HOLD_MS, MANUAL_PART_MS, MANUAL_STEP_MS, manualTiming, MAX_TOTAL_MS, MOVE_SPLINE, staggerFor } from "./motion.mjs";

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
// Any number of layers: past 7 the stagger shrinks, with no floor, so the total stays within 1.8 s.
test("manualTiming: 700 ms landings from the start, even overlapping gaps, total under 1.8 s, for any layer count", () => {
	assert.throws(() => manualTiming({ layers: 0 }), /at least one layer/);
	for (const n of [1, 2, 6, 7, 12, 24, 25, 60, 200]) {
		const timing = manualTiming({ layers: n });
		assert.equal(timing.part, MANUAL_PART_MS);
		assert.equal(timing.starts[0], 0, `${n} layers: the first layer drops at once (no ghost or arrow lead)`);
		assert.ok(timing.total <= MAX_TOTAL_MS, `${n} layers: ${timing.total} ms`);
		const gaps = timing.starts.slice(1).map((start, i) => start - timing.starts[i]);
		assert.ok(gaps.every(gap => gap === staggerFor(n)), `${n} layers: every gap is ${staggerFor(n)} ms (uniform), got ${gaps}`);
		assert.ok(staggerFor(n) < MANUAL_PART_MS, "the next layer starts before the previous one lands (overlap)");
	}
	assert.deepEqual(manualTiming({ layers: [["a"], ["b"]] }), manualTiming({ layers: 2 }));
});

test("staggerFor: 180 ms up to 7 layers, 157 ms at 8, 100 ms at 12, 47 ms at 24, shrinking with no floor", () => {
	for (const n of [1, 2, 6, 7]) assert.equal(staggerFor(n), MANUAL_STEP_MS, `${n} layers`);
	assert.equal(staggerFor(8), 157);
	assert.equal(staggerFor(12), 100);
	assert.equal(staggerFor(24), 47);
	assert.equal(staggerFor(111), 10, "no floor: the assembly still ends by 1.8 s");
	assert.equal(manualTiming({ layers: 12 }).total, 1800);
});

// The hand-off is layer-agnostic: each layer group steps its own class (wait → drop → set), so the CSS needs no per-layer rule.
test("layer class frames: wait until the start, drop in the accent for ACCENT_HOLD_MS, then rest; shadows and no-accent skip the drop", () => {
	assert.deepEqual([ENTRY_WAIT_CLASS, ENTRY_DROP_CLASS, ENTRY_REST_CLASS], ["vpk-iso-wait", "vpk-iso-drop", "vpk-iso-set"]);
	assert.equal(MANUAL_HOLD_MS, ENTRY.ACCENT_HOLD_MS);
	const timing = manualTiming({ layers: 3 });
	assert.deepEqual(layerClassFrames(0, timing), [[0, "vpk-iso-drop"], [180, "vpk-iso-set"]]);
	assert.deepEqual(layerClassFrames(2, timing), [[0, "vpk-iso-wait"], [360, "vpk-iso-drop"], [540, "vpk-iso-set"]]);
	assert.deepEqual(layerClassFrames(2, timing, { shadow: true }), [[0, "vpk-iso-wait"], [360, "vpk-iso-set"]]);
	assert.deepEqual(layerClassFrames(2, timing, { accent: false }), [[0, "vpk-iso-wait"], [360, "vpk-iso-set"]]);
	assert.equal(layerClassFrames(0, timing, { accent: false }), null, "a first layer without the accent never changes class");
	assert.equal(layerClassAnimation(0, timing, { shadow: true }), "");
	// Every layer, the last included, hands its accent back the same fixed time after it starts.
	for (const layers of [1, 3, 6, 24, 40]) {
		const t = manualTiming({ layers });
		for (let i = 0; i < layers; i++) {
			assert.equal(layerClassAt(i, t.starts[i], t), "vpk-iso-drop", `${layers}/${i} drops in the accent`);
			assert.equal(layerClassAt(i, t.starts[i] + MANUAL_HOLD_MS, t), "vpk-iso-set");
			if (t.starts[i] > 0) assert.equal(layerClassAt(i, t.starts[i] - 1, t), "vpk-iso-wait");
			assert.equal(layerClassAt(i, t.total, t), "vpk-iso-set", "rests on the class that paints nothing");
		}
	}
	assert.equal(layerClassAnimation(2, timing), '<animate data-vpk-begin="0s" attributeName="class" begin="indefinite" dur="1060ms" values="vpk-iso-wait;vpk-iso-drop;vpk-iso-set" keyTimes="0;0.34;0.509" calcMode="discrete" fill="freeze"/>');
});

test("the entry drops each layer from ENTRY.DROP_Z with a per-group hand-off and draws no ghost or arrow, for any layer count", () => {
	const brief = { ...structuredClone(EXEMPLAR), assemble: { layers: [["base"], ["core", "module"], ["shell"]] } };
	const scene = buildScene(brief);
	assert.equal(scene.timing.manual, true);
	const svg = renderSvg(scene);
	assert.doesNotMatch(svg, /data-vpk-iso-ghost|data-vpk-iso-cue|vpk-iso-[ah]\d/);
	assert.match(svg, /<g data-vpk-iso-enter="2">[\s\S]*?values="vpk-iso-wait;vpk-iso-drop;vpk-iso-set"/);
	assert.equal(scene.enterOffset[0], 0);
	assert.ok(scene.enterOffset[1] < -ENTRY.DROP_Z);
	// 30 layers (one part each) build: there is no layer cap.
	const many = { schema: "vpk-iso-brief/1", id: "many-layers", figId: "FIG_009", title: "Many layers", label: "Thirty boxes, one per layer.", labels: "none", emphasis: "none" };
	many.parts = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, kind: "box", at: [i * 6, 0, 0], size: [4, 4, 4] }));
	many.assemble = { layers: many.parts.map(part => [part.id]) };
	const big = renderSvg(buildScene(many));
	assert.equal([...big.matchAll(/<g data-vpk-iso-enter="\d+">/g)].length, 30);
	assert.doesNotMatch(big, /vpk-iso-drop/, "emphasis none: no accent step");
});
