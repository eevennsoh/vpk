// Phase 4 (plan § 2 W, C, X): glow (tone "glow" and the glow halo kind), cutaways with section faces, and the `line` annotation
// with spectrum rays. Schema, geometry, emit, audit (A1, A3, A15, A18) and check-html, each on small briefs.
import assert from "node:assert/strict";
import test from "node:test";
import { collectColorTokenIssues, collectSvgGrammarIssues } from "../check-html.mjs";
import { auditSvg } from "./audit.mjs";
import { hatchSegments, shellOf, windowOf } from "./cutaway.mjs";
import { renderRegion, renderSvg } from "./emit.mjs";
import { frameFor } from "./geometry.mjs";
import { nearPolygon } from "./layout.mjs";
import { GLOW_STOPS, isAllowedIsoPaint } from "./palette.mjs";
import { ISO_CSS } from "./runtime-css.mjs";
import { buildScene, validateBrief } from "./scene.mjs";
import * as core from "./core.mjs";

const brief = (parts, extra = {}) => ({ schema: "vpk-iso-brief/1", id: "p4", figId: "FIG_401", title: "Phase 4", label: "Phase 4 test figure.", emphasis: "none", parts, ...extra });
const errorsOf = (parts, extra) => validateBrief(brief(parts, extra)).join("\n");
const svgOf = b => renderSvg(buildScene(b));
const audit = svg => auditSvg(svg, { figure: "p4" }).filter(f => f.severity === "error");
const GLOWING = brief([
	{ id: "base", kind: "slab", at: [-20, -20, 0], size: [40, 40, 4] },
	{ id: "nozzle", kind: "cone", at: [0, 0, 4], r0: 8, r1: 5, length: 12, tone: "glow" },
	{ id: "halo", kind: "glow", at: [0, 0, 22], r: 6 },
]);
const PUMP = brief([
	{ id: "base", kind: "slab", at: [-26, -26, 0], size: [52, 52, 4] },
	{ id: "casing", kind: "cylinder", at: [0, 0, 4], size: [20, 20, 30], cutaway: { from: -20, to: 110, wall: 2, hatch: 1.2 } },
	{ id: "impeller", kind: "cylinder", at: [0, 0, 14], size: [14, 14, 4] },
], { emphasis: "accent", focal: "impeller", labels: [{ text: "Impeller", target: "impeller" }] });
const RAYS = brief([{ id: "bench", kind: "slab", at: [-30, -10, 0], size: [80, 20, 3] }], {
	annotations: [
		{ kind: "line", from: [-30, 0, 9], to: [0, 0, 9], dash: "dotted" },
		{ kind: "line", from: [0, 0, 9], to: [50, 0, 20], spectrum: "r", ends: "dot" },
		{ kind: "line", from: [0, 0, 9], via: [[25, 0, 12]], to: [50, 0, 10], spectrum: "b" },
	],
});

test("W schema: tone glow is a part tone; a glow halo needs r > 0 and takes no tone or detail", () => {
	assert.deepEqual(validateBrief(GLOWING), []);
	assert.match(errorsOf([{ id: "h", kind: "glow", at: [0, 0, 0], r: 0 }]), /r must be > 0/);
	assert.match(errorsOf([{ id: "h", kind: "glow", at: [0, 0, 0], r: 3, tone: "ink" }]), /tone does not apply to a glow/);
	assert.match(errorsOf([{ id: "h", kind: "glow", at: [0, 0, 0], r: 3, size: [1, 1, 1] }]), /size does not apply/);
});

test("W emit: one radialGradient per glowing piece plus one halo gradient, ids vpk-iso-<id>-glow-*, stops accent or grey only", () => {
	const svg = svgOf(GLOWING);
	const ids = [...svg.matchAll(/<radialGradient id="([^"]+)"/g)].map(m => m[1]);
	assert.deepEqual(ids, ["vpk-iso-p4-glow-0", "vpk-iso-p4-glow-halo"]);
	assert.match(svg, /data-vpk-iso-role="top" data-vpk-iso-tone="glow"[^>]*fill="url\(#vpk-iso-p4-glow-0\)"/);
	assert.match(svg, /data-vpk-iso-role="glow" d="[^"]+" fill="url\(#vpk-iso-p4-glow-halo\)"/);
	for (const [, color] of [...GLOW_STOPS.body, ...GLOW_STOPS.halo]) assert.ok(isAllowedIsoPaint(color), color);
	assert.doesNotMatch(svg, /gradientTransform|opacity=|<filter/);
	// The halo is light, not a solid: it casts no shadow.
	assert.doesNotMatch(svg, /data-vpk-iso-shadow-for="halo"/);
	assert.deepEqual(audit(svg), []);
	const region = renderRegion(buildScene(GLOWING));
	assert.deepEqual(collectSvgGrammarIssues(region), []);
	assert.deepEqual(collectColorTokenIssues(region, "glow"), []);
});

test("W audit: a gradient stop off the palette fails A1; a non-glow gradient id or a glow url on line work fails A15; glow paints accent under emphasis none", () => {
	const svg = svgOf(GLOWING);
	assert.ok(!audit(svg).some(f => f.rule === "A3"), "glow may paint the accent under emphasis none");
	assert.ok(audit(svg.replace('stop-color="var(--ill-accent)"', 'stop-color="#ff0000"')).some(f => f.rule === "A1"));
	assert.ok(audit(svg.replace('id="vpk-iso-p4-glow-0"', 'id="vpk-iso-p4-sunset"')).some(f => f.rule === "A15"));
	assert.ok(audit(svg.replace(/(data-vpk-iso-role="edge" d="[^"]+" stroke=")[^"]+/, "$1url(#vpk-iso-p4-glow-0)")).some(f => f.rule === "A15"));
});

test("W: an accent focal keeps its accent faces over tone glow; a glow variant swaps in with its own gradient", () => {
	const focal = svgOf({ ...GLOWING, emphasis: "accent", focal: "nozzle" });
	assert.doesNotMatch(focal, /glow-0/);
	const stepped = brief([
		{ id: "nozzle", kind: "cone", at: [0, 0, 0], r0: 8, r1: 5, length: 12, variants: { hot: { tone: "glow" } } },
	], { interact: { behavior: "step", states: [{ name: "spool" }, { name: "ab", parts: { nozzle: { variant: "hot" } } }] } });
	const svg = svgOf(stepped);
	assert.match(svg, /data-vpk-iso-variant="hot" display="none"/);
	assert.match(svg, /fill="url\(#vpk-iso-p4-glow-0\)"/);
	assert.deepEqual(audit(svg), []);
});

test("C schema: cutaway on turned parts only, from < to, a wall thinner than the radius; glass and hole conflict", () => {
	assert.deepEqual(validateBrief(PUMP), []);
	assert.match(errorsOf([{ id: "b", kind: "box", at: [0, 0, 0], size: [4, 4, 4], cutaway: { from: 0, to: 90, wall: 1 } }]), /cutaway applies to turned parts/);
	assert.match(errorsOf([{ id: "c", kind: "cylinder", at: [0, 0, 0], size: [5, 5, 9], cutaway: { from: 90, to: 10, wall: 1 } }]), /from < to/);
	assert.match(errorsOf([{ id: "c", kind: "cylinder", at: [0, 0, 0], size: [5, 5, 9], cutaway: { from: 0, to: 90, wall: 6 } }]), /leaves no cavity/);
	assert.match(errorsOf([{ id: "c", kind: "cylinder", at: [0, 0, 0], size: [5, 5, 9], tone: "glass", cutaway: { from: 0, to: 90, wall: 1 } }]), /glass part shows its inside/);
	assert.match(errorsOf([{ id: "c", kind: "cylinder", at: [0, 0, 0], size: [5, 5, 9], cutaway: { from: 0, to: 90, wall: 1, depth: 2 } }]), /depth is not a cutaway field/);
});

test("C geometry: the shell section, the visible window inside the hull, hatch clipped to the section", () => {
	const { section, cavity } = shellOf([[0, 10], [20, 10]], true, 2);
	assert.deepEqual(cavity, [[2, 0], [2, 8], [18, 8], [18, 0]]);
	assert.equal(section.length, 8);
	const P = { origin: [0, 0], scale: 4, azimuth: 45, elevation: 30 };
	const F = frameFor([0, 0, 0], "z");
	const front = windowOf(F, [[0, 10], [20, 10]], -20, 110, P);
	assert.ok(front && front.length >= 3, "a window facing the reader shows");
	assert.equal(windowOf(F, [[0, 10], [20, 10]], 160, 290, P), null, "a window turned away shows nothing");
	const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
	const lines = hatchSegments(square, 2);
	assert.ok(lines.length > 5);
	for (const segment of lines) for (const [x, y] of segment) assert.ok(x >= -1e-6 && x <= 10 + 1e-6 && y >= -1e-6 && y <= 10 + 1e-6);
});

test("C emit: back shell before the contents, clipped front after, section faces in the cut role; audit clean", () => {
	const scene = buildScene(PUMP);
	const order = scene.pieces.map(piece => piece.id);
	assert.ok(order.indexOf("casing:back") < order.indexOf("impeller") && order.indexOf("impeller") < order.indexOf("casing:front"), order.join(" "));
	const front = scene.pieces.find(piece => piece.id === "casing:front");
	for (const point of front.window) assert.ok(nearPolygon(point, front.hit, 0.5), "the window lies inside the hull");
	const svg = renderSvg(scene);
	assert.match(svg, /<clipPath id="vpk-iso-p4-win-casing">\s*<path d="M0 0L720 0L720 450L0 450Z[^"]+" clip-rule="evenodd"\/>/);
	assert.match(svg, /data-vpk-iso-part="casing:front"[^>]*data-vpk-iso-window="/);
	assert.equal((svg.match(/data-vpk-iso-role="cut"/g) ?? []).length, 2);
	assert.match(svg, /data-vpk-iso-role="hatch"/);
	assert.match(svg, /data-vpk-iso-role="recess"/, "the cavity reads as the inner wall");
	assert.deepEqual(audit(svg), [], "A5, A7 and A18 see the impeller through the window");
	assert.deepEqual(collectSvgGrammarIssues(renderRegion(scene)), []);
});

test("C audit: the cut role outside a cutaway is still A15; a cut face filled with a pattern is A15", () => {
	const svg = svgOf(PUMP);
	assert.ok(audit(svg.replace(/ data-vpk-iso-window="[^"]+"/, "")).some(f => f.rule === "A15" && /outside a cutaway/.test(f.message)));
	assert.ok(audit(svg.replace(/(data-vpk-iso-role="cut"[^>]*fill=")[^"]+/, "$1url(#vpk-iso-p4-glow-0)")).some(f => f.rule === "A15"));
});

test("C runtime: a point in the window hits the part inside, not the shell", () => {
	const shell = [[0, 0], [100, 0], [100, 100], [0, 100]];
	shell.window = [[20, 20], [80, 20], [80, 80], [20, 80]];
	const inner = [[30, 30], [70, 30], [70, 70], [30, 70]];
	assert.equal(core.topmostHit([inner, shell], [50, 50]), 0);
	assert.equal(core.topmostHit([inner, shell], [5, 5]), 1);
});

test("C: a window turned away from the reader draws the part as a plain solid (an open shell: no cap to notch)", () => {
	const away = brief([{ id: "drum", kind: "lathe", at: [0, 0, 0], profile: [[0, 10], [12, 10]], closed: false, cutaway: { from: 160, to: 290, wall: 1 } }]);
	assert.deepEqual(buildScene(away).pieces.map(piece => piece.id), ["drum"]);
	// A capped drum with the same back window still shows the notch the window cuts in its top.
	const capped = brief([{ id: "drum", kind: "cylinder", at: [0, 0, 0], size: [10, 10, 12], cutaway: { from: 160, to: 290, wall: 1 } }]);
	assert.deepEqual(buildScene(capped).pieces.map(piece => piece.id), ["drum:back", "drum:front"]);
});

test("C dark theme: the cut tone has a dark override", () => {
	assert.match(ISO_CSS, /\[data-vpk-iso-tone="cut"\]\) \{ fill: color-mix/);
});

test("X schema: line takes via, dash, spectrum and ends; text and of do not apply", () => {
	assert.deepEqual(validateBrief(RAYS), []);
	assert.match(errorsOf(RAYS.parts, { annotations: [{ kind: "line", from: [0, 0, 0], to: [1, 0, 0], spectrum: "y" }] }), /spectrum must be one of r, g, b/);
	assert.match(errorsOf(RAYS.parts, { annotations: [{ kind: "line", from: [0, 0, 0], to: [1, 0, 0], dash: "wavy" }] }), /dash must be one of/);
	assert.match(errorsOf(RAYS.parts, { annotations: [{ kind: "line", from: [0, 0, 0], to: [1, 0, 0], text: "x" }] }), /text does not apply to a line/);
	assert.match(errorsOf(RAYS.parts, { annotations: [{ kind: "ray", from: [0, 0, 0], to: [1, 0, 0] }] }), /kind must be one of "dimension", "arrow", "line"/);
});

test("X emit: a spectrum ray marks the root, strokes a ray token in role ray; a plain line takes the guide tone", () => {
	const svg = svgOf(RAYS);
	assert.match(svg, /<svg [^>]*data-vpk-iso-spectrum/);
	assert.match(svg, /data-vpk-iso-role="ray" d="M[^"]+" stroke="var\(--ill-ray-r\)"/);
	assert.match(svg, /data-vpk-iso-role="ray-end" d="[^"]+" fill="var\(--ill-ray-r\)"/);
	assert.match(svg, /data-vpk-iso-role="guide-line" d="[^"]+" stroke="[^"]+" stroke-width="1" stroke-dasharray="1 2"/);
	assert.match(svg, /stroke="var\(--ill-ray-b\)"/);
	assert.deepEqual(audit(svg), []);
	const region = renderRegion(buildScene(RAYS));
	assert.deepEqual(collectSvgGrammarIssues(region), []);
	assert.doesNotMatch(svgOf({ ...RAYS, annotations: RAYS.annotations.slice(0, 1) }), /data-vpk-iso-spectrum/, "no ray, no spectrum root");
});

test("X audit: a ray token without the spectrum root, or outside a ray, fails A1", () => {
	const svg = svgOf(RAYS);
	assert.ok(audit(svg.replace(" data-vpk-iso-spectrum", "")).some(f => f.rule === "A1"));
	assert.ok(audit(svg.replace(/(data-vpk-iso-role="edge" d="[^"]+" stroke=")[^"]+/, "$1var(--ill-ray-g)")).some(f => f.rule === "A1"));
	assert.notDeepEqual(collectSvgGrammarIssues(renderRegion(buildScene(RAYS)).replace(" data-vpk-iso-spectrum", "")), []);
});

test("X: labels route around rays, so no label box sits on a ray", () => {
	const labelled = { ...RAYS, labels: [{ text: "Bench", target: "bench" }] };
	assert.deepEqual(audit(svgOf(labelled)), []);
});

test("painter: a shapeless gap above a tray stays in front of the tray's walls (an-press-and-pull regression)", () => {
	const scene = buildScene(brief([
		{ id: "base", kind: "tray", at: [0, 0, 0], size: [150, 52, 3] },
		{ id: "rest", kind: "gap", at: [20, 16, 7], size: [76, 20, 0] },
	]));
	const order = scene.pieces.map(piece => piece.id);
	assert.ok(order.indexOf("rest") > order.indexOf("base:front"), order.join(" "));
});
