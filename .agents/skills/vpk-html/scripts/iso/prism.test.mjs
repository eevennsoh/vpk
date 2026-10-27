// Phase 3 (plan § 2 P, O, R, G): prisms with any polygon, axis, up, yaw and round; turned boxes; the convex decomposition of a
// concave footprint with its true outline; open trays with an opening axis and dividers; orientation validation; glass.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { iso } from "../anatomy/vendor/kit/iso-kit.mjs";
import { auditHtml } from "./audit.mjs";
import * as core from "./core.mjs";
import { renderRegion } from "./emit.mjs";
import { bodiesOf, boundsOf, castsShadow, yawPart } from "./geometry.mjs";
import { convexParts, frontOrder, normalizePolygon, selfIntersects, signedArea, triangulate } from "./polygon.mjs";
import { buildScene, validateBrief } from "./scene.mjs";
import { trayBoxes } from "./tray.mjs";

const brief = (parts, extra = {}) => ({ schema: "vpk-iso-brief/1", id: "p3", figId: "FIG_962", title: "Phase 3", label: "Prisms, trays and glass on a bench.", labels: "none", emphasis: "none", parts, ...extra });
const bench = { id: "bench", kind: "slab", at: [-10, -10, -6], size: [160, 120, 6] };
const errorsOf = parts => validateBrief(brief(parts)).join("\n");
const KEY = [[0, 0], [14, 0], [14, 4], [40, 4], [40, 8], [36, 8], [36, 11], [32, 8], [28, 11], [24, 8], [14, 8], [14, 12], [0, 12]];
const L = [[0, 0], [30, 0], [30, 6], [6, 6], [6, 30], [0, 30]];
const errorFindings = html => auditHtml(html).findings.filter(f => f.severity === "error");
const groupOf = (html, id) => new RegExp(`<g data-vpk-iso-part="${id}"[\\s\\S]*?\\n\\t*</g>`).exec(html)[0];
// A part group as core.partPoly reads it: its role paths' d and its own attributes (no DOM needed).
const dom = html => ({
	querySelector(selector) {
		const id = /data-vpk-iso-part="([^"]+)"/.exec(selector)[1];
		const group = groupOf(html, id);
		const head = /^<g [^>]*>/.exec(group)[0];
		return {
			getAttribute: name => new RegExp(` ${name}="([^"]*)"`).exec(head)?.[1] ?? null,
			querySelectorAll: sel => {
				const role = /data-vpk-iso-role="([^"]+)"/.exec(sel)[1];
				return [...group.matchAll(new RegExp(`data-vpk-iso-role="${role}"[^>]* d="([^"]+)"`, "g"))].map(m => ({ getAttribute: () => m[1] }));
			},
		};
	},
});

test("prism schema: 3–128 points, simple, depth > 0, round ≥ 0; yaw only on prisms and box-like parts", () => {
	const prism = extra => ({ id: "p", kind: "prism", at: [0, 0, 0], polygon: L, depth: 4, ...extra });
	assert.equal(errorsOf([prism()]), "");
	assert.equal(errorsOf([prism({ polygon: KEY, round: 0.5, axis: "-y", yaw: 30 })]), "");
	assert.match(errorsOf([prism({ polygon: [[0, 0], [1, 0]] })]), /polygon must be 3–128/);
	assert.match(errorsOf([prism({ polygon: Array.from({ length: 129 }, (_, i) => [Math.cos(i / 20), Math.sin(i / 20)]) })]), /polygon must be 3–128/);
	assert.match(errorsOf([prism({ polygon: [[0, 0], [10, 10], [10, 0], [0, 10]] })]), /polygon (?:must be simple|has no area)/, "a bow tie is rejected");
	assert.match(errorsOf([prism({ polygon: [[0, 0], [20, 0], [20, 10], [5, -5], [0, 10]] })]), /polygon must be simple/, "a doubled-back polygon is rejected");
	assert.match(errorsOf([prism({ polygon: [[0, 0], [5, 0], [10, 0]] })]), /no area/);
	assert.match(errorsOf([prism({ depth: 0 })]), /depth must be > 0/);
	assert.match(errorsOf([prism({ round: -1 })]), /round must be ≥ 0/);
	assert.match(errorsOf([prism({ size: [1, 1, 1] })]), /size does not apply to a prism/);
	assert.match(errorsOf([{ id: "c", kind: "cylinder", at: [0, 0, 0], size: [3, 3, 3], yaw: 10 }]), /yaw applies to prisms, boxes, slabs and plates/);
	assert.match(errorsOf([{ id: "b", kind: "box", at: [0, 0, 0], size: [3, 3, 3], yaw: 400 }]), /yaw must be degrees within ±360/);
});

test("orientation validation (R): axis non-zero, up not parallel to the axis, up needs an axis", () => {
	const box = extra => ({ id: "b", kind: "box", at: [0, 0, 0], size: [4, 4, 4], ...extra });
	assert.equal(errorsOf([box({ axis: "x", up: [0, 0, 1] })]), "");
	assert.match(errorsOf([box({ axis: [0, 0, 0] })]), /axis must be x, y, z, -x, -y, -z or a non-zero/);
	assert.match(errorsOf([box({ axis: "x", up: [3, 0, 0] })]), /up must not be parallel to the axis/);
	assert.match(errorsOf([box({ up: [0, 0, 1] })]), /up needs an axis/);
	assert.match(errorsOf([{ id: "p", kind: "prism", at: [0, 0, 0], polygon: L, depth: 1, axis: "y", up: [0, -2, 0] }]), /up must not be parallel/);
	assert.match(errorsOf([{ id: "t", kind: "tray", at: [0, 0, 0], size: [9, 9, 9], axis: "sideways" }]), /tray's open face/);
	assert.match(errorsOf([{ id: "t", kind: "tray", at: [0, 0, 0], size: [9, 9, 9], dividers: { x: [9] } }]), /dividers.x must list offsets within \(0, 9\)/);
	assert.match(errorsOf([{ id: "t", kind: "tray", at: [0, 0, 0], size: [9, 9, 9], dividers: { w: [3] } }]), /keys are x, y and z/);
	assert.match(errorsOf([{ id: "s", kind: "slab", at: [0, 0, 0], size: [9, 9, 9], dividers: { x: [3] } }]), /dividers apply to trays only/);
	assert.match(validateBrief(brief([{ id: "b", kind: "box", at: [0, 0, 0], size: [4, 4, 4], rotate: { axis: "x", deg: [0, 90] } }], { interact: { behavior: "step", states: [{ name: "a" }, { name: "b" }] } })).join("\n"), /turns about a vertical axis only/);
});

test("polygon helpers: normalised CCW, self-intersection, triangulation and convex parts cover the area", () => {
	const cw = [[0, 0], [0, 10], [10, 10], [10, 0]];
	assert.ok(signedArea(normalizePolygon(cw)) > 0);
	assert.equal(normalizePolygon([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]]).length, 4, "collinear points are dropped");
	assert.equal(selfIntersects(normalizePolygon(KEY)), false);
	for (const poly of [L, KEY]) {
		const ring = normalizePolygon(poly);
		assert.equal(triangulate(ring).length, ring.length - 2);
		const parts = convexParts(ring);
		assert.ok(parts.length >= 2 && parts.length < ring.length - 2, "diagonals merge into fewer convex pieces");
		const area = parts.reduce((sum, idx) => sum + signedArea(idx.map(i => ring[i])), 0);
		assert.ok(Math.abs(area - signedArea(ring)) < 1e-6, "the pieces tile the polygon");
		for (const idx of parts) assert.ok(convexParts(idx.map(i => ring[i])).length === 1, "each piece is convex");
	}
	assert.deepEqual(convexParts(normalizePolygon(cw)), [[0, 1, 2, 3]]);
	// Two squares side by side along +x, seen along +x: the one at smaller x is behind.
	assert.deepEqual(frontOrder([[[10, 0], [20, 0], [20, 10], [10, 10]], [[0, 0], [10, 0], [10, 10], [0, 10]]], [1, 0]), [1, 0]);
});

test("a concave prism: convex fills, the true outline (not the hull), the notch hits nothing, audit-clean", () => {
	const scene = buildScene(brief([bench, { id: "kerb", kind: "prism", at: [10, 10, 0], polygon: L, depth: 8 }]));
	const html = renderRegion(scene);
	assert.deepEqual(errorFindings(html), []);
	const group = groupOf(html, "kerb");
	assert.match(group, /data-vpk-iso-hit="solids"/);
	const fills = [...group.matchAll(/data-vpk-iso-role="fill"[^>]* d="([^"]+)"/g)].map(m => core.parsePolyPath(m[1]));
	assert.equal(fills.length, convexParts(normalizePolygon(L)).length);
	// The notch's top centre (inside the L's hull, outside the L) is inside no fill and hits nothing; a point on the arm hits.
	const notch = iso([10 + 18, 10 + 18, 8], scene.P);
	const arm = iso([10 + 20, 10 + 3, 8], scene.P);
	assert.ok(core.pointInPolygon(notch, core.hull(fills.flat())), "the notch lies inside the hull");
	assert.ok(fills.every(poly => !core.pointInPolygon(notch, core.hull(poly))));
	const poly = core.partPoly(dom(html).querySelector('[data-vpk-iso-part="kerb"]'));
	assert.equal(core.topmostHit([poly], notch), -1, "the notch hits nothing");
	assert.equal(core.topmostHit([poly], arm), 0, "the arm hits");
	// The edge path traces the inner corner of the L (the reflex vertex at [6, 6] on the visible top), which a hull never visits.
	const lines = [...group.matchAll(/data-vpk-iso-role="(?:edge|crease)" d="([^"]+)"/g)].flatMap(m => core.parsePolyPath(m[1]));
	const corner = iso([16, 16, 8], scene.P);
	assert.ok(lines.some(([x, y]) => Math.hypot(x - corner[0], y - corner[1]) < 0.2), "the reflex corner is on the outline");
	// The shadow keeps the notch: one hull per convex solid.
	const ground = /<g data-vpk-iso-shadows[\s\S]*?<\/g>/.exec(html)[0];
	assert.equal([...ground.matchAll(/data-vpk-iso-shadow-for="kerb"/g)].length, fills.length);
});

test("a 45° yaw box: corners turn about its centre; yaw 0 keeps the legacy drawing byte for byte", () => {
	const part = { id: "b", kind: "box", at: [0, 0, 0], size: [20, 10, 4], yaw: 45 };
	const { samples3 } = boundsOf(part);
	const c = [10, 5];
	const turn = ([x, y]) => [c[0] + (x - c[0] - (y - c[1])) * Math.SQRT1_2, c[1] + (x - c[0] + (y - c[1])) * Math.SQRT1_2];
	for (const corner of [[0, 0], [20, 0], [20, 10], [0, 10]]) {
		const [ex, ey] = turn(corner);
		// The legacy corner radius (2) rounds each corner, so the sample nearest the sharp corner is about 0.83 units in.
		assert.ok(samples3.some(([x, y]) => Math.hypot(x - ex, y - ey) < 1), `corner ${corner} → ${ex.toFixed(2)} ${ey.toFixed(2)}`);
	}
	const legacy = renderRegion(buildScene(brief([bench, { id: "b", kind: "box", at: [20, 20, 0], size: [20, 10, 4] }])));
	assert.equal(renderRegion(buildScene(brief([bench, { id: "b", kind: "box", at: [20, 20, 0], size: [20, 10, 4], yaw: 0 }]))), legacy);
	assert.equal(renderRegion(buildScene(brief([bench, { id: "b", kind: "box", at: [20, 20, 0], size: [20, 10, 4], axis: "z" }]))), legacy);
	// A turned box still offers a flat top: it supports and receives like a box.
	const html = renderRegion(buildScene(brief([bench, { ...part, at: [20, 20, 0] }, { id: "lid", kind: "plate", at: [26, 22, 4], size: [6, 6, 1] }])));
	assert.match(groupOf(html, "b"), /data-vpk-iso-received/);
	assert.deepEqual(errorFindings(html), []);
	// yawPart turns a box rigidly about a vertical line: 90° about its own centre leaves its centre (and so its at) in place.
	assert.deepEqual(yawPart({ ...part, yaw: 0 }, [10, 5], 90).at.map(v => Math.round(v * 1e6) / 1e6), [0, 0, 0]);
	const fan = buildScene(brief([bench, { id: "f", kind: "box", at: [0, 0, 0], size: [8, 2, 2], repeat: { polar: { count: 4, centre: [60, 60], radius: 10, span: 360, face: true } } }]));
	assert.deepEqual(fan.brief.parts.filter(p => p.id.startsWith("f-")).map(p => p.yaw ?? 0), [0, 90, 180, 270]);
});

test("an upright prism (axis -y) stands its polygon in the x–z plane; a slab on axis x stands on edge", () => {
	const blade = { id: "blade", kind: "prism", at: [0, 0, 0], axis: "-y", polygon: [[0, 0], [24, 0], [12, 16]], depth: 2 };
	const b = boundsOf(blade);
	const r = v => Math.round(v * 1000) / 1000 + 0;
	// Axis -y: v is world z, u = v × a is +x, and the depth runs toward −y from at.
	assert.deepEqual([b.min.map(r), b.max.map(r)], [[0, -2, 0], [24, 0, 16]]);
	const slab = boundsOf({ id: "s", kind: "slab", at: [0, 0, 0], size: [10, 20, 3], axis: "x", r: 0 });
	assert.deepEqual([slab.max[0] - slab.min[0], slab.max[2] - slab.min[2]].map(v => Math.round(v * 1000) / 1000), [3, 20]);
	assert.deepEqual(errorFindings(renderRegion(buildScene(brief([bench, { ...blade, at: [20, 20, 0] }])))), []);
});

test("open tray: a +y opening drops the near y wall, contents paint between back and front; a divider grid makes 8 cubbies", () => {
	const tray = { id: "cubby", kind: "tray", at: [0, 0, 0], size: [40, 30, 30], axis: "+y" };
	const { walls } = trayBoxes(tray);
	assert.ok(!walls.some(w => w.axis === 1 && w.side === "front"), "no near y wall");
	assert.ok(walls.some(w => w.axis === 1 && w.side === "back"), "the back panel stands");
	assert.ok(walls.some(w => w.axis === 2 && w.side === "front"), "a roof");
	const scene = buildScene(brief([bench, tray, { id: "book", kind: "box", at: [10, 8, 2.4], size: [6, 14, 18] }]));
	const ids = scene.pieces.map(p => p.id);
	assert.ok(ids.indexOf("cubby:back") < ids.indexOf("book") && ids.indexOf("book") < ids.indexOf("cubby:front"), ids.join(" "));
	assert.deepEqual(errorFindings(renderRegion(scene)), []);
	// The book stands on the floor, so it explodes with the cubby.
	const grid = { ...tray, axis: "+x", dividers: { x: [20], y: [15], z: [15] } };
	const { dividers, inner } = trayBoxes(grid);
	assert.equal(dividers.length, 1 + 2 + 4);
	// Cells: sample the centre of each octant of the cavity; each lies in no divider and no two share one cell bounded by dividers.
	const inside = (p, box) => p.every((v, i) => v > box.min[i] && v < box.max[i]);
	const mid = inner[0].map((v, i) => (v + inner[1][i]) / 2);
	let cells = 0;
	for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
		const p = mid.map((v, i) => v + [sx, sy, sz][i] * (inner[1][i] - inner[0][i]) / 4);
		if (!dividers.some(d => inside(p, d))) cells++;
	}
	assert.equal(cells, 8);
	const html = renderRegion(buildScene(brief([bench, grid])));
	assert.equal([...html.matchAll(/data-vpk-iso-part="cubby:div-/g)].length, 7);
	assert.deepEqual(errorFindings(html), []);
});

test("a recess on a turned box's top adds the recess fill; glass draws stroke-only with dashed creases and no shadow, still hoverable", () => {
	const turned = { id: "t", kind: "box", at: [10, 10, 0], size: [20, 12, 6], yaw: 20, detail: [{ type: "recess", face: "top", at: [10, 6], size: [8, 4], shape: "rect" }] };
	assert.match(groupOf(renderRegion(buildScene(brief([bench, turned]))), "t"), /data-vpk-iso-role="recess"/);
	const glass = { id: "case", kind: "box", at: [60, 40, 0], size: [24, 24, 20], tone: "glass" };
	assert.equal(castsShadow(glass), false);
	const scene = buildScene(brief([bench, { id: "block", kind: "box", at: [66, 46, 0], size: [10, 10, 8] }, glass], { emphasis: "ink", focal: "case", interact: { behavior: "select", rest: "rest" } }));
	const html = renderRegion(scene);
	const group = groupOf(html, "case");
	assert.doesNotMatch(group, /data-vpk-iso-role="(?:fill|top|shade)"/, "no face");
	assert.match(group, /data-vpk-iso-tone="glass"/);
	assert.match(group, /data-vpk-iso-role="crease"[^>]* stroke-dasharray="2 2"/, "hidden edges dashed");
	assert.match(group, /data-vpk-iso-role="edge"[^>]* stroke-width="2"/, "an ink focal outline");
	assert.doesNotMatch(html, /data-vpk-iso-shadow-for="case"/);
	const withoutGlass = renderRegion(buildScene(brief([bench, { id: "block", kind: "box", at: [66, 46, 0], size: [10, 10, 8] }], { emphasis: "ink", focal: "block" })));
	const fills = text => new Set([...text.matchAll(/data-vpk-iso-role="(?:fill|shade|top|recess)"[^>]* fill="([^"]+)"/g)].map(m => m[1])).size;
	assert.equal(fills(html), fills(withoutGlass), "glass adds no fill (A2)");
	assert.deepEqual(errorFindings(html), []);
	// The glass case is still hoverable: its hit polygon is the hull of its edges, and it paints over the block behind it.
	const poly = core.partPoly(dom(html).querySelector('[data-vpk-iso-part="case"]'));
	assert.ok(poly.length >= 3);
	const centre = iso([72, 52, 19], scene.P);
	assert.ok(core.pointInPolygon(centre, poly));
});

test("the p3-prisms fixture builds deterministically and audit-clean", () => {
	const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/p3-prisms.json", import.meta.url), "utf8"));
	const html = renderRegion(buildScene(fixture));
	assert.equal(html, renderRegion(buildScene(structuredClone(fixture))));
	assert.deepEqual(errorFindings(html), []);
	assert.ok(bodiesOf({ id: "k", kind: "prism", at: [0, 0, 0], polygon: KEY, depth: 3 })[0].parts.length > 1);
});
