// Phase 1 detail (plan § 2 D, T): part.detail[] validation, generators, emission, the A11 face-text exception and A19 counts.
import assert from "node:assert/strict";
import test from "node:test";
import { iso } from "../anatomy/vendor/kit/iso-kit.mjs";
import { auditHtml } from "./audit.mjs";
import { detailFor, faceMatrix, facesOf } from "./detail.mjs";
import { renderRegion } from "./emit.mjs";
import { segmentCount } from "./manual-audit.mjs";
import { DARK_RECESS_OVERRIDES } from "./palette.mjs";
import { ISO_CSS } from "./runtime-css.mjs";
import { buildScene, validateBrief } from "./scene.mjs";

const P = { origin: [0, 0], scale: 3, azimuth: 45, elevation: 30 };
const brief = parts => ({ schema: "vpk-iso-brief/1", id: "detail", figId: "FIG_950", title: "Detail", label: "A plate and a dial with detail.", labels: "none", emphasis: "none", parts });
const plate = detail => ({ id: "plate", kind: "box", at: [0, 0, 0], size: [40, 30, 6], detail });
const dial = detail => ({ id: "dial", kind: "cylinder", at: [70, 15, 0], size: [12, 12, 4], detail });
const errorsOf = parts => validateBrief(brief(parts)).join("\n");

test("detail schema: unknown type, bad face, face a kind lacks and bad face text fail; dot and tick counts are unbounded", () => {
	assert.equal(errorsOf([plate([{ type: "ticks", face: "top", from: [0, 0], to: [10, 0], step: 1 }])]), "");
	assert.match(errorsOf([plate([{ type: "sparkle" }])]), /detail\[0\]\.type "sparkle" must be one of/);
	assert.match(errorsOf([plate([{ type: "line", face: "front", points: [[0, 0], [1, 1]] }])]), /detail\[0\]\.face "front" must be one of top, \+x, -x, \+y, -y/);
	assert.match(errorsOf([plate([{ type: "knurl", count: 10 }])]), /knurl needs a turned part/);
	assert.equal(errorsOf([plate([{ type: "dots", grid: [80, 51], gap: 0.5 }])]), "", "no dot cap");
	assert.equal(errorsOf([plate([{ type: "ticks", face: "top", from: [0, 0], to: [10, 0], step: 0.001 }])]), "", "no tick cap");
	assert.equal(errorsOf([plate([{ type: "dots", grid: [80, 50], gap: 0.5 }])]), "");
	assert.match(errorsOf([plate([{ type: "hatch", face: "+x", spacing: 2 }])]), /hatch is drawn on top faces only/);
	assert.match(errorsOf([plate([{ type: "text", text: "<script>" + "x".repeat(60) }])]), /text must be 1–48 characters/);
	assert.match(errorsOf([plate([{ type: "text", text: "ok", size: 9 }])]), /size must be within 2–6/);
	assert.match(errorsOf([{ id: "ball", kind: "sphere", at: [0, 0, 0], r: 3, detail: [{ type: "line", points: [[0, 0], [1, 1]] }] }]), /a sphere has no faces/);
});

test("golden: radialTicks with count 60 draws 60 segments; ticks every 2 along 20 draw 11", () => {
	const ticks = detailFor(dial([{ type: "radialTicks", r: 11, count: 60, every: 5, lengths: [1, 2] }]), P);
	assert.equal(segmentCount(ticks.mark.join("")), 60);
	assert.equal((ticks.mark.join("").match(/M/g) ?? []).length, 60);
	const ruler = detailFor(plate([{ type: "ticks", face: "+y", from: [0, 3], to: [20, 3], step: 2, every: 5 }]), P);
	assert.equal(segmentCount(ruler.mark.join("")), 11);
	const open = detailFor(dial([{ type: "radialTicks", r: 11, count: 10, span: 90 }]), P);
	assert.equal(segmentCount(open.mark.join("")), 11, "an open arc draws count + 1 ticks, both ends included");
});

test("face text: the matrix maps the text baseline onto the face plane, never mirrored", () => {
	const faces = facesOf(plate());
	for (const name of ["top", "+x", "+y"]) {
		const { matrix, base, down, origin } = faceMatrix(faces[name], [4, 2], P);
		const [a, b, c, d, e, f] = /matrix\(([^)]+)\)/.exec(matrix)[1].split(" ").map(Number);
		const at = ([x, y]) => [a * x + c * y + e, b * x + d * y + f];
		const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01;
		assert.ok(near(at([0, 0]), iso(origin, P)), `${name}: the text origin is the face point`);
		assert.ok(near(at([1, 0]), iso(origin.map((v, i) => v + base[i]), P)), `${name}: one unit of baseline is one world unit along the face`);
		assert.ok(near(at([0, 1]), iso(origin.map((v, i) => v + down[i]), P)), `${name}: text down lies in the face`);
		assert.ok(Math.abs(base.reduce((s, v, i) => s + v * faces[name].n[i], 0)) < 1e-9, `${name}: the baseline lies in the face plane`);
		assert.ok(a * d - b * c > 0, `${name}: not mirrored`);
		assert.ok(a > 0, `${name}: reads left to right on screen`);
	}
});

test("emit: one path per detail role, legacy marks keep their exact path, dots are closed arcs, face text is projected", () => {
	const scene = buildScene(brief([
		plate([
			{ type: "ticks", face: "+y", from: [2, 3], to: [38, 3], step: 2 },
			{ type: "line", face: "top", points: [[2, 2], [10, 2], [10, 8]] },
			{ type: "line", face: "top", points: [[2, 20], [30, 20]], dash: true },
			{ type: "dots", face: "top", at: [20, 10], grid: [4, 3], gap: 2 },
			{ type: "recess", face: "top", at: [8, 22], size: 5 },
			{ type: "hatch", face: "top", spacing: 3 },
			{ type: "text", face: "+y", at: [2, 1], text: "m 16 · k 3", size: 2.5 },
		]),
		{ ...dial(), marks: [[[0, 0], [8, 0]]] },
	]));
	const html = renderRegion(scene);
	const group = id => new RegExp(`<g data-vpk-iso-part="${id}"[^>]*>[\\s\\S]*?\\n\\t*</g>`).exec(html)[0];
	const plateGroup = group("plate");
	assert.equal((plateGroup.match(/data-vpk-iso-role="mark"/g) ?? []).length, 2, "solid marks in one path, dashed lines in a second");
	assert.match(plateGroup, /data-vpk-iso-role="mark" d="[^"]*" stroke="[^"]*" stroke-width="1" stroke-dasharray="2 2"/);
	for (const role of ["dot", "recess", "hatch"]) assert.equal((plateGroup.match(new RegExp(`data-vpk-iso-role="${role}"`, "g")) ?? []).length, 1, role);
	assert.match(plateGroup, /data-vpk-iso-role="dot" d="(M[\d.-]+ [\d.-]+a[^Z]+Z){12}"/);
	assert.match(plateGroup, /<text data-vpk-iso-role="face-text" class="iso-face-text" transform="matrix\([^)]+\)" font-family="Geist Mono, monospace" font-size="2.5" fill="[^"]+">m 16 · k 3<\/text>/);
	// The legacy mark is the same lineOnTop segment it always was.
	const legacy = buildScene(brief([plate(), { ...dial(), marks: [[[0, 0], [8, 0]]] }]));
	const markOf = s => /<g data-vpk-iso-part="dial"[\s\S]*?data-vpk-iso-role="mark" d="([^"]+)"/.exec(renderRegion(s))[1];
	assert.equal(markOf(scene), markOf(legacy));
	assert.match(markOf(scene), /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/);
	const findings = auditHtml(html).findings.filter(f => f.severity === "error");
	assert.deepEqual(findings, []);
});

test("A11: a face-text matrix passes; a transform on a fill path, or on text without the face-text role, is still A11", () => {
	const html = renderRegion(buildScene(brief([plate([{ type: "text", face: "top", at: [4, 4], text: "49 × 49" }])])));
	assert.deepEqual(auditHtml(html).findings.filter(f => f.rule === "A11"), []);
	const onFill = html.replace(/<path data-vpk-iso-role="fill"/, '<path transform="matrix(1 0 0 1 0 0)" data-vpk-iso-role="fill"');
	assert.ok(auditHtml(onFill).findings.some(f => f.rule === "A11" && /<path> has a transform/.test(f.message)));
	const bare = html.replace('data-vpk-iso-role="face-text" ', "");
	assert.ok(auditHtml(bare).findings.some(f => f.rule === "A11" && /<text> has a transform/.test(f.message)));
});

test("a recess adds one fill tone (A2 counts it), with a dark override; detail facing away is skipped with a warning", () => {
	const base = buildScene(brief([plate()]));
	const withRecess = buildScene(brief([plate([{ type: "recess", face: "top", at: [10, 10], size: [8, 4], shape: "rect" }])]));
	const fillsOf = html => new Set([...html.matchAll(/data-vpk-iso-role="(?:fill|shade|top|recess)"[^>]* fill="([^"]+)"/g)].map(m => m[1])).size;
	assert.equal(fillsOf(renderRegion(withRecess)), fillsOf(renderRegion(base)) + 1);
	assert.ok(ISO_CSS.includes(`:where([data-vpk-iso-tone="recess"]) { fill: ${DARK_RECESS_OVERRIDES.recess}; }`));
	const away = buildScene(brief([plate([{ type: "line", face: "-x", points: [[1, 1], [5, 5]] }])]));
	assert.match(away.warnings.join("\n"), /line on face -x faces away from the camera; skipped/);
});
