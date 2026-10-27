import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { collectColorTokenIssues, collectSvgGrammarIssues } from "../check-html.mjs";
import { renderFigure, renderRegion } from "./emit.mjs";
import { buildScene, validateBrief } from "./scene.mjs";
import { ISO_PRESET } from "./palette.mjs";

const EXEMPLAR = JSON.parse(fs.readFileSync(new URL("./briefs/exploded-stack.json", import.meta.url), "utf8"));
const KINDS = {
	schema: "vpk-iso-brief/1",
	id: "kinds",
	figId: "FIG_002",
	title: "Kinds",
	label: "A tray holding two cards, a flash ring, a drum and a reserved slot.",
	texture: "dots",
	parts: [
		{ id: "tray", kind: "tray", at: [0, 0, 0], size: [60, 100, 6] },
		{ id: "card-a", kind: "plate", at: [5, 8, 4], size: [50, 32, 2], marks: [[[4, 6], [30, 6]]] },
		{ id: "ring", kind: "ring", at: [30, 90, 6], size: [8, 8, 0], clipTo: "tray" },
		{ id: "drum", kind: "cylinder", at: [100, 30, 0], size: [14, 14, 20] },
		{ id: "slot", kind: "gap", at: [80, 70, 0], size: [30, 24, 0] },
	],
	focal: "ring",
	labels: [{ text: "Drum", target: "drum" }],
	annotations: [{ kind: "dimension", from: [0, 100, 0], to: [60, 100, 0], text: "60 mm" }, { kind: "arrow", from: [80, 110, 0], to: [70, 100, 0] }],
	assemble: { layers: [["tray", "slot"], ["card-a"], ["ring", "drum"]] },
	interact: { behavior: "select" },
};
const STATIC = { ...structuredClone(EXEMPLAR), id: "static-stack", interact: null, assemble: null };
const CASES = [];
for (const brief of [EXEMPLAR, KINDS, STATIC]) CASES.push({ brief, name: brief.id, region: renderRegion(buildScene(brief)) });

const tags = (html, pattern) => [...html.matchAll(pattern)].map(match => match[0]);

test("check-html's SVG grammar and colour scans pass on every case (with the S1 local-pattern rule)", () => {
	for (const { name, region } of CASES) {
		assert.deepEqual(collectSvgGrammarIssues(region), [], name);
		assert.deepEqual(collectColorTokenIssues(region, name), [], name);
	}
});

test("forbidden output: no transform=, patternTransform, nested <svg>, opacity= or escape hatches", () => {
	for (const { name, region } of CASES) {
		assert.doesNotMatch(region.replace(/<animate(?:Transform)?\b[^>]*>/g, ""), /\stransform=/, name);
		assert.doesNotMatch(region, /patternTransform|\sopacity=|data-vpk-external-asset|data-vpk-raw-colors-allowed/, name);
		assert.equal(tags(region, /<svg\b/g).length, 1, `${name}: one svg`);
	}
});

test("every id carries the vpk-iso-<id>- prefix (no hex-like fragments)", () => {
	for (const { brief, name, region } of CASES) {
		const svg = region.slice(region.indexOf("<svg"), region.indexOf("</svg>"));
		for (const [, id] of svg.matchAll(/\sid="([^"]+)"/g)) assert.ok(id.startsWith(`vpk-iso-${brief.id}-`), `${name}: ${id}`);
		for (const [, ref] of region.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ref.startsWith(`vpk-iso-${brief.id}-`), `${name}: url(#${ref})`);
	}
});

test("region markers and root attributes follow the DOM contract (C-iso-2, K11, R20)", () => {
	const region = renderRegion(buildScene(EXEMPLAR), { src: "_figures/exploded-stack.iso.json" });
	assert.ok(region.startsWith('<!-- vpk-figure:begin engine="iso-kit" id="exploded-stack" src="_figures/exploded-stack.iso.json" -->'));
	assert.ok(region.endsWith('<!-- vpk-figure:end id="exploded-stack" -->'));
	const root = /<figure\b[^>]*>/.exec(region)[0];
	for (const attr of ['class="vpk-iso-plate vpk-iso-plate--manual"', 'data-vpk-engine="iso-kit"', 'data-vpk-figure="exploded-stack"', 'data-vpk-fig-id="FIG_001"', 'data-vpk-camera="45 30"', " data-vpk-block", " data-vpkh-no-lightbox"]) assert.ok(root.includes(attr), attr);
	for (const cls of ["vpk-iso-frame", "vpk-iso-stage", "vpk-iso-plate__foot"]) assert.match(region, new RegExp(`class="${cls}"[^>]*data-vpk-review-ignore`), cls);
	assert.match(region, /<figcaption data-vpk-review-ignore>/);
	assert.doesNotMatch(region, /data-vpk-id=|data-vpk-revision=/, "the kit never mints ws1 ids");
	const svg = /<svg\b[^>]*>/.exec(region)[0];
	for (const attr of ["data-vpk-illustration", "data-vpk-iso ", 'data-vpk-iso-id="exploded-stack"', 'data-vpk-iso-style="manual"', 'data-vpk-iso-zdepth="0.5"', "data-vpk-smil-arm", 'role="img"', "aria-label="]) assert.ok(svg.includes(attr), attr);
	assert.match(region, /data-vpk-iso-behavior="explode" role="group" aria-roledescription="interactive figure"/);
	// autocomplete="off": history traversal must not restore a committed gap after the runtime has read the slider.
	assert.match(region, /<input type="range" data-vpk-iso-control="explode" min="0.4" max="1" step="0.05" value="0.6" autocomplete="off">/);
	assert.match(region, /<output class="vpk-iso-readout" data-vpk-iso-readout aria-live="off">gap 0\.60<\/output>/);
	assert.throws(() => renderRegion(buildScene(EXEMPLAR), { src: "../escape.json" }), /relative path/);
	assert.throws(() => renderRegion(buildScene(EXEMPLAR), { src: "/abs/brief.json" }), /relative path/);
});

test("fill paths carry no stroke and use only M/L/Z; stroked roles carry no fill", () => {
	for (const { name, region } of CASES) {
		for (const tag of tags(region, /<path data-vpk-iso-role="(?:fill|shade|top|cut)"[^>]*>/g)) {
			assert.doesNotMatch(tag, /\sstroke=/, `${name}: ${tag.slice(0, 60)}`);
		}
		for (const tag of tags(region, /<path data-vpk-iso-role="fill"[^>]*>/g)) assert.match(/\sd="([^"]*)"/.exec(tag)[1], /^M[\d.\s-]+(?:L[\d.\s-]+)*Z$/, name);
		for (const tag of tags(region, /<path data-vpk-iso-role="(?:edge|crease|mark|guide|leader)"[^>]*>/g)) assert.doesNotMatch(tag, /\sfill=/, `${name}: ${tag.slice(0, 60)}`);
	}
});

test("one focal part per figure; attribute stroke widths are 1, 1.5 (paper ring) or 2 (focal outline)", () => {
	for (const { brief, name, region } of CASES) {
		const focal = new Set(tags(region, /data-vpk-iso-part="[^"]+"[^>]*data-vpk-iso-focal/g).map(tag => /data-vpk-iso-part="([^"]+)"/.exec(tag)[1].split(":")[0]));
		assert.deepEqual([...focal], [brief.focal], name);
		assert.doesNotMatch(region, /stroke-width="(?!1"|1\.5"|2")/, name);
		assert.doesNotMatch(region, /data-vpk-iso-active="stroke2"|vpk-iso-plate__chrome/, `${name}: no other-preset markup`);
	}
});

test("static figures carry no behaviour, controls or lightbox opt-out; no assembly means no SMIL", () => {
	const region = renderRegion(buildScene(STATIC));
	assert.doesNotMatch(region, /data-vpk-iso-behavior|data-vpkh-no-lightbox|role="group"|<input|<output|data-vpk-iso-explode|data-vpk-iso-lift/);
	assert.doesNotMatch(region, /<animate|data-vpk-smil-arm|data-vpk-iso-enter/);
	assert.match(region, /class="vpk-iso-stage" data-vpk-iso-stage data-vpk-review-ignore>/);
});

test("select figures: focusable stage, lift vectors, a rest readout, no slider", () => {
	const region = renderRegion(buildScene(KINDS));
	assert.match(region, /data-vpk-iso-behavior="select"[^>]*tabindex="0"/);
	assert.match(region, /data-vpk-iso-lift="0 -[\d.]+"/);
	assert.match(region, /data-vpk-iso-of="tray"/);
	assert.match(region, /data-vpk-iso-rest="rest"[^>]*>rest<\/output>/);
	assert.doesNotMatch(region, /<input/);
	assert.match(region, /clip-path="url\(#vpk-iso-kinds-clip-ring\)"/);
	assert.doesNotMatch(region, /<pattern|data-vpk-iso-role="cut"|hatch/, "side faces are plain flat faces: no hatch pattern, no cut role");
	assert.doesNotMatch(region, /<rect data-vpk-iso-texture/, "the style draws no dot texture (preset.texture is null)");
});

// G2 J4: narrow-stage callouts. Each label has a numbered gutter tag on a leader to its target, hidden by attribute until
// the CSS shows it, plus a hidden legend and the crop variables; figures without labels carry none of it.
test("labelled figures carry hidden numbered tags, a hidden legend and the crop (narrow-stage callouts)", () => {
	const region = CASES.find(c => c.name === "exploded-stack").region;
	const dots = tags(region, /<g data-vpk-iso-tag="\d" data-vpk-iso-tag-for="[^"]+" display="none">/g);
	assert.deepEqual(dots.map(dot => /data-vpk-iso-tag="(\d)"/.exec(dot)[1]), ["1", "2", "3", "4"]);
	assert.match(region, /<svg [^>]*\bdata-vpk-iso-narrow\b/);
	const legend = /<ol class="vpk-iso-legend" hidden data-vpk-review-ignore>([\s\S]*?)<\/ol>/.exec(region)[1];
	assert.deepEqual([...legend.matchAll(/<li><span aria-hidden="true">(\d)<\/span>([^<]+)<\/li>/g)].map(m => [m[1], m[2]]), [["1", "Top shell"], ["2", "Module"], ["3", "Core board"], ["4", "Base plate"]]);
	assert.ok(region.indexOf("vpk-iso-legend") > region.indexOf("</svg>") && region.indexOf("vpk-iso-legend") < region.indexOf("vpk-iso-plate__foot"), "the legend sits between the stage and the foot");
	const kinds = CASES.find(c => c.name === "kinds").region;
	assert.equal(tags(kinds, /data-vpk-iso-tag="/g).length, 1);
	assert.doesNotMatch(renderRegion(buildScene({ ...structuredClone(EXEMPLAR), labels: [] })), /data-vpk-iso-tag|data-vpk-iso-narrow|vpk-iso-legend/);
});

// P4 item 11: a flow arrow is not a label leader. It takes the edge stroke, the heavier width from CSS and its own
// arrowhead; label leaders end in the ink dot marker.
test("every label sits on an unpainted chip in ink; only the focal label's leader dot takes the accent", () => {
	const groups = [...MANUAL_EXEMPLAR.matchAll(/<g data-vpk-iso-label-for="([^"]+)"([^>]*)>([\s\S]*?)<\/g>/g)];
	assert.ok(groups.length >= 2);
	for (const [, target, attrs, body] of groups) {
		assert.match(body, /<rect data-vpk-iso-chip x="[\d.-]+" y="[\d.-]+" width="[\d.]+" height="[\d.]+" rx="2" fill="none"\/>/, `${target} has an unpainted chip`);
		const focal = target === "module";
		assert.equal(attrs.includes("data-vpk-iso-accent"), focal, `${target} accent flag`);
		assert.doesNotMatch(body, /var\(--ill-accent/, `${target} label text and chip stay ink`);
		assert.equal(/marker-end="url\(#[^)]+-arrow-accent\)"/.test(body), focal, `${target} leader dot`);
	}
	assert.match(MANUAL_EXEMPLAR, /<marker id="[^"]+-arrow-accent"[^>]*>\s*<circle cx="4" cy="4" r="3" fill="var\(--ill-accent\)" stroke="var\(--ill-line\)" stroke-width="1"\/>/);
});

test("arrow annotations draw with their own arrowhead; label leaders end in the dot marker", () => {
	const kinds = CASES.find(c => c.name === "kinds").region;
	assert.match(kinds, /<g data-vpk-iso-annotation="arrow" data-vpk-iso-weight="2">\s*<path d="[^"]+" stroke="[^"]+" stroke-width="1" marker-end="url\(#vpk-iso-kinds-flow\)"\/>/);
	assert.match(kinds, /<marker id="vpk-iso-kinds-flow"[^>]*>\s*<path d="[^"]+" fill="[^"]+"\/>/);
	assert.match(kinds, /<marker id="vpk-iso-kinds-arrow"[^>]*>\s*<circle cx="4" cy="4" r="3" fill="var\(--ill-line\)"\/>/);
	assert.doesNotMatch(/<g data-vpk-iso-annotation="arrow"[\s\S]*?<\/g>/.exec(kinds)[0], /vpk-iso-kinds-arrow/, "the arrow does not reuse the leader's marker");
});

// P4 items 10 and 22: the narrow-stage CSS hides the callouts and keeps the arrows; the legend's type wins over a
// host page's unlayered `li { font-size: ... !important }`.
test("narrow-stage CSS hides labels and dimension notes only, and pins the legend type", async () => {
	const { ISO_CSS } = await import("./runtime-css.mjs");
	const rule = selector => ISO_CSS.split("\n").find(line => line.startsWith(selector));
	const hide = rule(".vpk-iso-stage svg[data-vpk-iso-narrow] :is(");
	assert.ok(hide, "a narrow-stage hide rule exists");
	assert.match(hide, /\[data-vpk-iso-label-for\]/);
	assert.match(hide, /\[data-vpk-iso-annotation="dimension"\]/);
	assert.doesNotMatch(ISO_CSS, /\[data-vpk-iso-labels\]/, "the label group is never hidden as a whole: it also holds the arrows");
	assert.match(rule(".vpk-iso-legend li"), /font: 11px\/1\.4 var\(--font-mono\) !important;/);
	assert.match(rule(".vpk-iso-legend span"), /line-height: 1 !important;/);
	assert.match(rule("[data-vpk-iso-weight=\"2\"] path"), /stroke-width: 2;/);
});

test("output is byte-identical across runs; sizes are reported", () => {
	for (const brief of [EXEMPLAR, KINDS]) {
		const a = renderFigure(buildScene(brief));
		const b = renderFigure(buildScene(structuredClone(brief)));
		assert.equal(a.region, b.region);
		assert.equal(a.sizes.region, Buffer.byteLength(a.region));
		assert.ok(a.sizes.svg > 1000 && a.sizes.svg < 60 * 1024, `${brief.id}: ${a.sizes.svg} B`);
	}
});

// P5 (ws3-manual): the kit's markup. KINDS gains marks, dims and a scale bar; the exemplar supplies a pale focal part
// with faces.
const MANUAL_KINDS = {
	...structuredClone(KINDS),
	id: "manual-kinds",
	marks: [{ target: "card-a" }, { target: "tray", at: [10, 10, 6], offset: [12, -8], n: 7 }],
	dims: [{ from: [0, 0, 0], to: [60, 0, 0], text: "Tray · 60 px", offset: 14 }],
	scale: { length: 50, text: "50 px" },
};
const manualRegion = brief => renderRegion(buildScene(brief));
const MANUAL_REGION = manualRegion(MANUAL_KINDS);
const MANUAL_EXEMPLAR = manualRegion({ ...structuredClone(EXEMPLAR), id: "manual-stack" });

test("frame: no chrome corners, the frame holds stage, legend and readout, the Gap row sits under it", () => {
	for (const region of [MANUAL_REGION, MANUAL_EXEMPLAR]) {
		assert.match(region, /<figure class="vpk-iso-plate vpk-iso-plate--manual"/);
		assert.doesNotMatch(region, /vpk-iso-plate__chrome/, "no corner chrome");
		const frame = /<div class="vpk-iso-frame" data-vpk-review-ignore>([\s\S]*?)\n\t<\/div>/.exec(region)[1];
		for (const part of ['class="vpk-iso-stage"', "</svg>", 'class="vpk-iso-legend"', "data-vpk-iso-readout"]) assert.ok(frame.includes(part), `the frame holds ${part}`);
		assert.doesNotMatch(frame, /<input|<figcaption/, "the slider and the caption sit outside the frame");
	}
	assert.match(MANUAL_EXEMPLAR, /<\/div>\n\t<div class="vpk-iso-plate__foot" data-vpk-review-ignore>\s*<label class="vpk-iso-control">Gap <input type="range" data-vpk-iso-control="explode"/, "the Gap row is the foot after the frame");
	assert.doesNotMatch(MANUAL_REGION, /<input|vpk-iso-control/, "a select figure has no slider row");
	assert.match(MANUAL_EXEMPLAR, /<svg [^>]*data-vpk-iso-style="manual"/);
	assert.match(MANUAL_EXEMPLAR, /<svg [^>]* style="[^"]*--vpk-iso-w: \d+px/, "the drawing's width cap rides the svg");
});

test("leaders are straight two-point lines that end in a dot", () => {
	const leaders = tags(MANUAL_REGION, /<g data-vpk-iso-label-for[^>]*>\s*<path data-vpk-iso-role="leader"[^>]*>/g);
	assert.equal(leaders.length, 1);
	assert.match(leaders[0], /\sd="M[\d.]+ [\d.]+L[\d.]+ [\d.]+"/, "one segment, no elbow");
	assert.match(leaders[0], /marker-end="url\(#vpk-iso-manual-kinds-arrow\)"/);
	assert.match(MANUAL_REGION, /<marker id="vpk-iso-manual-kinds-arrow"[^>]*>\s*<circle cx="4" cy="4" r="3" fill="var\(--ill-line\)"\/>\s*<\/marker>/, "the leader marker is a dot, not an arrowhead");
	assert.doesNotMatch(MANUAL_REGION, /<marker id="vpk-iso-manual-kinds-arrow"[^>]*>\s*<path/);
});

test("dimensions sit in a paper box; the scale bar and numbered mark discs are drawn", () => {
	const dimensions = tags(MANUAL_REGION, /<g data-vpk-iso-annotation="dimension">[\s\S]*?<\/g>/g);
	assert.equal(dimensions.length, 2, "the brief's dims entry and its dimension annotation");
	for (const dim of dimensions) {
		assert.match(dim, /<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="19" fill="var\(--paper\)" stroke="var\(--ill-line\)" stroke-width="1"\/>\s*<text /, "the label sits in a boxed paper rect");
	}
	assert.deepEqual(dimensions.map(dim => />([^<]+)<\/text>/.exec(dim)[1]).sort(), ["60 mm", "Tray · 60 px"]);
	const scale = tags(MANUAL_REGION, /<g data-vpk-iso-annotation="scale">[\s\S]*?<\/g>/g);
	assert.equal(scale.length, 1);
	assert.match(scale[0], /<path d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+M[^"]*" stroke="[^"]+" stroke-width="1"\/>\s*<text [^>]*>50 px<\/text>/, "a bar with end ticks and its text");
	const marks = tags(MANUAL_REGION, /<g data-vpk-iso-mark="\d+">[\s\S]*?<\/g><\/g>/g);
	assert.deepEqual(marks.map(mark => /data-vpk-iso-mark="(\d+)"/.exec(mark)[1]).sort(), ["1", "7"], "an explicit n is kept; the other takes the next free number");
	for (const mark of marks) {
		assert.match(mark, /<g data-vpk-iso-mark-disc><circle [^>]*r="10" fill="var\(--ill-line\)"\/>/, "an ink disc");
		assert.match(mark, /<text [^>]*fill="var\(--paper\)"[^>]*>\d+<\/text>/, "paper numeral");
	}
	// Every mark rides inside its target's part group, so it lifts and explodes with the part.
	for (const [n, part] of [["7", "tray"], ["1", "card-a"]]) {
		assert.match(MANUAL_REGION, new RegExp(`<g data-vpk-iso-part="${part}[^"]*"[^>]*>(?:(?!<g data-vpk-iso-part=)[\\s\\S])*?<g data-vpk-iso-mark="${n}">`), `mark ${n} rides in ${part}`);
	}
});

test("focal faces take the accent with the neutral line work at rest (the accent outline is hover only); a focal ring is a 2 px accent arc with no fill", () => {
	// The part group closes at its own indent (a received-shadow group nests inside it); its line work is outside that group.
	const focalGroup = /(\t*)<g data-vpk-iso-part="module"[^>]*data-vpk-iso-focal>([\s\S]*?)\n\1<\/g>/.exec(MANUAL_EXEMPLAR);
	const focal = focalGroup[2];
	assert.equal(tags(focal, /data-vpk-iso-tone="accent"/g).length, 3, "left, right and top faces take the accent");
	assert.match(focal, /data-vpk-iso-role="top" data-vpk-iso-tone="accent" d="[^"]+" fill="var\(--ill-accent\)"/, "the top is the accent itself");
	assert.doesNotMatch(focal, /data-vpk-iso-tone="(?:light|dark|top)"/);
	// Every line on the focal at rest (edge, crease, mark) is the neutral line work of every part: no accent stroke, no 2 px.
	const lines = tags(focal, /<path data-vpk-iso-role="(?:edge|crease|mark)"[^>]*>/g);
	assert.ok(lines.length >= 2, "the focal draws its outline and at least one crease");
	for (const line of lines) assert.ok(!line.includes("--ill-accent") && line.includes('stroke-width="1"'), `neutral 1 px stroke on ${line.slice(0, 60)}`);
	assert.match(focal, new RegExp(`<path data-vpk-iso-role="edge" d="[^"]+" stroke="${ISO_PRESET.edge.replace(/[()]/g, "\\$&")}" stroke-width="1"/>`), "the neutral edge");
	assert.doesNotMatch(MANUAL_EXEMPLAR, /stroke-width="2"/, "no part carries a heavy outline at rest");
	const ring = /<g data-vpk-iso-part="ring"[^>]*data-vpk-iso-focal[^>]*>([\s\S]*?)<\/g>/.exec(MANUAL_REGION)[1];
	assert.doesNotMatch(ring, /data-vpk-iso-role="(?:fill|shade|top)"|\sfill="(?!none)/, "the flash ring paints no fill");
	assert.match(ring, /<path data-vpk-iso-role="edge" d="[^"]+" stroke="var\(--ill-accent\)" stroke-width="2"\/>/, "a faceless focal takes the accent on its 2 px arc");
});

test("assemblies draw no entry ghost or arrow (the user's redline), and the select blink is declared once", () => {
	for (const region of [MANUAL_REGION, MANUAL_EXEMPLAR]) {
		assert.doesNotMatch(region, /data-vpk-iso-ghost|data-vpk-iso-cue|data-vpk-iso-role="cue"/, "no ghost or entry arrow");
		// The hand-off is one class animation per layer group (layer-agnostic: no per-layer CSS); nothing paints over a dropping part.
		const groups = tags(region, /<g data-vpk-iso-enter="\d+">/g).length;
		assert.ok(tags(region, /<animate [^>]*attributeName="class"/g).length >= groups);
		assert.doesNotMatch(region, /<g data-vpk-iso-scene>\s*<animate [^>]*attributeName="class"/, "the scene group carries no class animation");
		assert.match(region, /<g data-vpk-iso-enter="1">[\s\S]*?<animate [^>]*attributeName="class"[^>]*values="vpk-iso-wait;vpk-iso-drop;vpk-iso-set"[^>]*calcMode="discrete"/);
		assert.doesNotMatch(region, /vpk-iso-[ah]\d/, "no per-layer class names");
	}
	assert.match(MANUAL_REGION, /<svg [^>]*data-vpk-iso-blink/, "select figures arm the blink");
	assert.doesNotMatch(MANUAL_EXEMPLAR, /data-vpk-iso-blink/, "explode figures do not");
	// The grammar stays: no opacity= attribute anywhere.
	assert.doesNotMatch(MANUAL_REGION, /\sopacity=/);
});

test("output obeys the SVG grammar and colour scans and is byte-identical across runs", () => {
	for (const [name, region] of [["kinds", MANUAL_REGION], ["exemplar", MANUAL_EXEMPLAR]]) {
		assert.deepEqual(collectSvgGrammarIssues(region), [], name);
		assert.deepEqual(collectColorTokenIssues(region, name), [], name);
		assert.doesNotMatch(region.replace(/<animate(?:Transform)?\b[^>]*>/g, ""), /\stransform=|patternTransform|data-vpk-external-asset/, name);
		assert.equal(tags(region, /<svg\b/g).length, 1, `${name}: one svg`);
	}
	assert.equal(manualRegion(structuredClone(MANUAL_KINDS)), MANUAL_REGION);
});

// Cast shadows (illustrations.md § Shadows): one group painted before every part, filled once with the shadow tone; each shadow
// is a closed M/L/Z path with no stroke, filter, gradient, opacity or transform; gaps and rings cast none.
test("cast shadows: one flat group under every part, one fill, no stroke, filter or opacity; gaps and rings cast none", async () => {
	const { SHADOW } = await import("./accent.mjs");
	for (const { name, region } of CASES) {
		const group = /<g data-vpk-iso-shadows fill="([^"]+)"[^>]*>([\s\S]*?)\n\t*<\/g>\n\t*<g data-vpk-iso-(?:enter|part)/.exec(region);
		assert.ok(group, `${name}: a shadow group`);
		assert.equal(group[1], SHADOW.TONE, `${name}: the group carries the one shadow tone`);
		assert.ok(region.indexOf("data-vpk-iso-shadows") < region.indexOf("data-vpk-iso-part="), `${name}: shadows paint before every part`);
		const shadows = tags(group[2], /<path data-vpk-iso-role="shadow"[^>]*\/>/g);
		assert.ok(shadows.length > 0, name);
		for (const shadow of shadows) {
			assert.doesNotMatch(shadow, /\s(stroke|stroke-width|filter|opacity|fill-opacity|transform|style|fill)=/, `${name}: ${shadow}`);
			assert.match(shadow, / d="M[\d. -]+(L[\d. -]+)+Z"/, `${name}: a closed flat polygon`);
		}
		const casters = CASES.find(c => c.name === name).brief.parts.filter(part => !["gap", "ring"].includes(part.kind)).map(part => part.id);
		assert.deepEqual(shadows.map(shadow => /data-vpk-iso-shadow-for="([^"]+)"/.exec(shadow)[1]).sort(), casters.sort(), `${name}: one ground shadow per part with faces`);
		for (const shadow of tags(region, /<path data-vpk-iso-role="shadow"[^>]*\/>/g)) {
			assert.doesNotMatch(shadow, /\s(stroke|stroke-width|filter|opacity|fill-opacity|transform|style|fill)=/, `${name}: ${shadow}`);
			assert.match(shadow, / d="M[\d. -]+(L[\d. -]+)+Z"/, `${name}: a closed flat polygon`);
		}
		assert.doesNotMatch(region, /<(filter|linearGradient|radialGradient|feGaussianBlur)\b/, name);
	}
	const select = CASES.find(c => c.name === "kinds").region;
	assert.match(select, /<g data-vpk-iso-shadows fill="[^"]+" data-vpk-iso-cast="[\d. -]+">/, "a select figure's shadows share one cast vector on the group");
	const exploded = CASES.find(c => c.name === EXEMPLAR.id).region;
	const ground = /<g data-vpk-iso-shadows[\s\S]*?\n\t*<\/g>\n\t*<g data-vpk-iso-(?:enter|part)/.exec(exploded)[0];
	assert.ok(tags(ground, /data-vpk-iso-role="shadow"[^>]*data-vpk-iso-cast="/g).length === 4, "an explode figure's ground shadows each carry their own cast vector");
	assert.match(exploded, /<g data-vpk-iso-shadow-enter="0">/, "an assembled figure slides each layer's shadows in");
	assert.doesNotMatch(CASES.find(c => c.name === "static-stack").region, /data-vpk-iso-cast|data-vpk-iso-shadow-enter/, "a static figure's shadows never move");
});

// Selective colour: a motion arrow that names its part (`of`) is drawn in the accent when that part is the focal one; the runtime
// accents it while its part is active. An arrow without an owner stays neutral.
test("an owned motion arrow takes the accent with its focal part; an unowned arrow stays neutral", () => {
	const brief = structuredClone(KINDS);
	brief.annotations[1].of = "ring";
	brief.annotations.push({ kind: "arrow", from: [100, 70, 0], to: [100, 50, 0], of: "drum" });
	const region = renderRegion(buildScene(brief));
	const focalArrow = /<g data-vpk-iso-annotation="arrow" data-vpk-iso-arrow-for="ring" data-vpk-iso-accent[^>]*>([\s\S]*?)<\/g>/.exec(region);
	assert.ok(focalArrow, "the focal part's arrow carries the owner and the accent flag");
	assert.match(focalArrow[1], /stroke="var\(--ill-accent\)"/);
	assert.match(focalArrow[1], /data-vpk-iso-role="arrowhead"[^>]*fill="var\(--ill-accent\)"/);
	const other = /<g data-vpk-iso-annotation="arrow" data-vpk-iso-arrow-for="drum"(?! data-vpk-iso-accent)[^>]*>([\s\S]*?)<\/g>/.exec(region);
	assert.ok(other, "a non-focal owner's arrow is neutral at rest");
	assert.doesNotMatch(other[1], /--ill-accent/);
	assert.doesNotMatch(CASES.find(c => c.name === "kinds").region, /data-vpk-iso-arrow-for/, "an arrow without `of` stays neutral");
	assert.deepEqual(validateBrief({ ...structuredClone(KINDS), annotations: [{ kind: "arrow", from: [0, 0, 0], to: [1, 1, 0], of: "nope" }] }), ["annotations[0].of must name a part, on an arrow"]);
});
