// Phase 1 kinds and repeat (plan § 2 L, U, S, A): schema, geometry and emission of the turned, tube and ball kinds, and the
// repeat / instances / vary expansion.
import assert from "node:assert/strict";
import test from "node:test";
import { iso } from "../anatomy/vendor/kit/iso-kit.mjs";
import { auditHtml } from "./audit.mjs";
import { parsePolyPath } from "./core.mjs";
import { renderRegion } from "./emit.mjs";
import { expandBrief } from "./expand.mjs";
import { boundsOf } from "./geometry.mjs";
import { buildScene, validateBrief } from "./scene.mjs";

const brief = (parts, extra = {}) => ({ schema: "vpk-iso-brief/1", id: "kinds-p1", figId: "FIG_951", title: "Kinds", label: "New part kinds on a bench.", labels: "none", emphasis: "none", parts, ...extra });
const bench = { id: "bench", kind: "slab", at: [-10, -10, -6], size: [140, 90, 6] };
const errorsOf = parts => validateBrief(brief(parts)).join("\n");

test("lathe schema: 2–64 profile points, r ≥ 0, s not decreasing, a non-zero axis, up not parallel; no size", () => {
	const lathe = extra => ({ id: "shaft", kind: "lathe", at: [0, 0, 0], axis: "x", profile: [[0, 2], [10, 3]], ...extra });
	assert.equal(errorsOf([lathe()]), "");
	assert.match(errorsOf([lathe({ profile: [[0, 2]] })]), /profile must be 2–64/);
	assert.match(errorsOf([lathe({ profile: Array.from({ length: 65 }, (_, i) => [i, 1]) })]), /profile must be 2–64/);
	assert.match(errorsOf([lathe({ profile: [[0, -1], [4, 2]] })]), /r ≥ 0/);
	assert.match(errorsOf([lathe({ profile: [[4, 1], [0, 2]] })]), /s must not decrease/);
	assert.match(errorsOf([lathe({ axis: [0, 0, 0] })]), /axis must be x, y, z, -x, -y, -z or a non-zero/);
	assert.match(errorsOf([lathe({ up: [2, 0, 0] })]), /up must not be parallel to the axis/);
	assert.match(errorsOf([lathe({ size: [1, 1, 1] })]), /size does not apply to a lathe/);
	assert.match(errorsOf([lathe({ cutaway: { from: 0, to: 90 } })]), /cutaway\.wall must be > 0/);
	assert.match(errorsOf([{ id: "c", kind: "cone", at: [0, 0, 0], r0: 0, r1: 0, length: 4 }]), /a cone needs r0 or r1 > 0/);
	assert.match(errorsOf([{ id: "t", kind: "torus", at: [0, 0, 0], R: 3, r: 4 }]), /a torus needs r < R/);
	assert.match(errorsOf([{ id: "w", kind: "ring", at: [0, 0, 0], size: [5, 5, 0], thickness: 2, inner: 6 }]), /inner is the bore radius/);
});

test("cylinder axis sugar draws exactly the lathe with the same frame and profile", () => {
	const scene = parts => renderRegion(buildScene(brief(parts)));
	const body = html => /<g data-vpk-iso-part="d"[\s\S]*?\n\t*<\/g>/.exec(html)[0];
	const cylinder = scene([bench, { id: "d", kind: "cylinder", at: [10, 20, 8], size: [6, 6, 30], axis: "x" }]);
	const lathe = scene([bench, { id: "d", kind: "lathe", at: [10, 20, 8], axis: "x", profile: [[0, 6], [30, 6]] }]);
	assert.equal(body(cylinder), body(lathe));
	// An upright cylinder (axis "z" or omitted) keeps the legacy drawing.
	const upright = scene([bench, { id: "d", kind: "cylinder", at: [10, 20, 0], size: [6, 6, 10], axis: "z" }]);
	assert.equal(body(upright), body(scene([bench, { id: "d", kind: "cylinder", at: [10, 20, 0], size: [6, 6, 10] }])));
});

test("an x-axis cone: shaded faces and an outline, wider at the r0 end, deterministic, audit-clean", () => {
	const cone = brief([bench, { id: "nozzle", kind: "cone", at: [10, 30, 10], axis: "x", r0: 8, r1: 3, length: 40 }]);
	const html = renderRegion(buildScene(cone));
	assert.equal(html, renderRegion(buildScene(structuredClone(cone))), "byte-identical across runs");
	const group = /<g data-vpk-iso-part="nozzle"[\s\S]*?\n\t*<\/g>/.exec(html)[0];
	for (const role of ["fill", "shade", "top", "edge"]) assert.match(group, new RegExp(`data-vpk-iso-role="${role}"`), role);
	assert.match(/data-vpk-iso-role="fill"[^>]* d="([^"]+)"/.exec(group)[1], /^M[\d.\s-]+(L[\d.\s-]+)+Z$/, "fill is M/L/Z");
	const scene = buildScene(cone);
	const P = scene.P;
	const span = s => {
		const a = iso([10 + s, 30, 10 + (s ? 3 : 8)], P);
		const b = iso([10 + s, 30, 10 - (s ? 3 : 8)], P);
		return Math.hypot(a[0] - b[0], a[1] - b[1]);
	};
	assert.ok(span(0) > span(40));
	assert.deepEqual(auditHtml(html).findings.filter(f => f.severity === "error"), []);
});

test("tube schema: fewer than 2 points or radius ≤ 0 fails; a wire has no radius", () => {
	assert.match(errorsOf([{ id: "p", kind: "tube", points: [[0, 0, 0]], radius: 1 }]), /points must be 2–512/);
	assert.match(errorsOf([{ id: "p", kind: "tube", points: [[0, 0, 0], [0, 0, 0]], radius: 1 }]), /each different from the one before/);
	assert.match(errorsOf([{ id: "p", kind: "tube", points: [[0, 0, 0], [5, 0, 0]], radius: 0 }]), /radius must be > 0/);
	assert.match(errorsOf([{ id: "r", kind: "rod", from: [0, 0, 0], to: [0, 0, 0], radius: 1 }]), /from and to must be two different/);
	assert.match(errorsOf([{ id: "s", kind: "spring", from: [0, 0, 0], to: [0, 0, 9], radius: 1, wire: 2, turns: 4 }]), /wire must be thinner/);
	assert.equal(errorsOf([bench, { id: "w", kind: "wire", from: [0, 0, 0], to: [10, 0, 0] }]), "");
	assert.match(errorsOf([{ id: "w", kind: "wire", from: [0, 0, 0], to: [10, 0, 0], radius: 1 }]), /radius does not apply to a wire/);
});

test("an L-pipe of length 80 is at least 3 chunks, each its own piece with `of`; hit polygons are per chunk", () => {
	const pipe = { id: "pipe", kind: "tube", points: [[0, 0, 2], [60, 0, 2], [60, 20, 2]], radius: 1.5 };
	const scene = buildScene(brief([bench, pipe]));
	const chunks = scene.pieces.filter(piece => piece.partId === "pipe");
	assert.ok(chunks.length >= 3, `${chunks.length} chunks`);
	assert.ok(chunks.every(piece => piece.of === "pipe" && /^pipe:\d+$/.test(piece.id)));
	const html = renderRegion(scene);
	assert.equal((html.match(/data-vpk-iso-of="pipe"/g) ?? []).length, chunks.length);
	assert.deepEqual(auditHtml(html).findings.filter(f => f.severity === "error"), []);
	// A thin straight wire still gets a hit polygon (padded), so an interactive figure never goes inert.
	const wired = buildScene(brief([bench, { id: "w", kind: "wire", from: [0, 0, 0], to: [30, 0, 0] }]));
	assert.ok(wired.pieces.find(piece => piece.partId === "w").hit.length >= 3);
});

test("sphere: the outline is a circle on screen and the hit polygon is that disc; a pin is a rod and a head in one piece", () => {
	const scene = buildScene(brief([bench, { id: "ball", kind: "sphere", at: [30, 30, 8], r: 6 }, { id: "pin", kind: "pin", at: [60, 30, 0], length: 8, r: 0.8, head: 2 }]));
	const ball = scene.pieces.find(piece => piece.id === "ball");
	const centre = iso([30, 30, 8], scene.P);
	const radii = ball.hit.map(([x, y]) => Math.hypot(x - centre[0], y - centre[1]));
	assert.ok(Math.max(...radii) - Math.min(...radii) < 0.3, `circle: ${Math.min(...radii)}–${Math.max(...radii)}`);
	const outline = parsePolyPath(ball.solids.at(-1).edge);
	assert.ok(outline.every(([x, y]) => Math.abs(Math.hypot(x - centre[0], y - centre[1]) - radii[0]) < 0.3));
	const pins = scene.pieces.filter(piece => piece.partId === "pin");
	assert.equal(pins.length, 1);
	assert.ok(pins[0].solids.length >= 3, "rod solid plus the two sphere solids");
	assert.equal(boundsOf({ id: "pin", kind: "pin", at: [60, 30, 0], length: 8, r: 0.8, head: 2 }).top, 10);
});

test("a washer (ring with thickness) leaves its bore open (even-odd), a torus is a closed tube in chunks; both are audit-clean", () => {
	const scene = buildScene(brief([bench, { id: "washer", kind: "ring", at: [20, 20, 0], size: [8, 8, 0], thickness: 2, inner: 4 }, { id: "donut", kind: "torus", at: [60, 30, 4], R: 10, r: 3 }]));
	const html = renderRegion(scene);
	assert.match(/<g data-vpk-iso-part="washer"[\s\S]*?<\/g>/.exec(html)[0], /data-vpk-iso-role="fill"[^>]*d="M[^"]*ZM[^"]*Z"[^>]*fill-rule="evenodd"/);
	assert.ok(scene.pieces.filter(piece => piece.partId === "donut").length >= 2);
	assert.deepEqual(auditHtml(html).findings.filter(f => f.severity === "error"), []);
});

test("repeat: linear, grid and polar counts; instance ids; base-id references expand; vary sets per-instance fields", () => {
	const keys = { id: "key", kind: "box", at: [0, 0, 0], size: [4, 4, 2], repeat: { grid: { count: [4, 3], step: [6, 6] } }, vary: { field: "size.2", values: Array.from({ length: 12 }, (_, i) => 1 + i) } };
	const pins = { id: "pin", kind: "pin", at: [50, 50, 0], length: 4, r: 0.5, head: 1, repeat: { polar: { count: 8, centre: [50, 50], radius: 10 } } };
	const rails = { id: "rail", kind: "rod", from: [0, 60, 1], to: [40, 60, 1], radius: 0.6, repeat: { linear: { count: 3, step: [0, 4, 0] } } };
	const input = brief([bench, keys, pins, rails], { emphasis: "ink", focal: "key", labels: [{ text: "Pins", target: "pin" }], assemble: { layers: [["bench"], ["key", "pin", "rail"]] } });
	assert.deepEqual(validateBrief(input), []);
	const flat = expandBrief(input);
	assert.equal(flat.parts.length, 1 + 12 + 8 + 3);
	assert.deepEqual(flat.parts.filter(part => part.id.startsWith("key-")).map(part => part.size[2]), Array.from({ length: 12 }, (_, i) => 1 + i));
	assert.deepEqual(flat.focal, Array.from({ length: 12 }, (_, i) => `key-${i}`), "a focal base id names every instance");
	assert.equal(flat.labels[0].target, "pin-0", "a label names the first instance");
	assert.equal(flat.assemble.layers[1].length, 23);
	assert.deepEqual(flat.parts.find(part => part.id === "key-5").at, [6, 6, 0]);
	const pin2 = flat.parts.find(part => part.id === "pin-2").at;
	assert.ok(Math.abs(pin2[0] - 50) < 1e-9 && Math.abs(pin2[1] - 60) < 1e-9, `the third of eight polar pins sits at 90°: ${pin2}`);
	const scene = buildScene(input);
	assert.equal(scene.brief.parts.length, 24);
	assert.equal(scene.pieces.filter(piece => piece.focal).length, 12);
	// Gauss variation: the centre instance keeps the base value, the corners fall towards the floor.
	const gauss = expandBrief(brief([{ ...keys, vary: { field: "size.2", fn: "gauss", sigma: 1, floor: 0.5 }, repeat: { grid: { count: [3, 3], step: [6, 6] } } }]));
	const heights = gauss.parts.map(part => part.size[2]);
	assert.equal(heights[4], 2);
	assert.ok(heights[0] < heights[1] && heights[1] < heights[4]);
});

test("repeat errors: id collisions, bad shapes, face on a box, vary length; the instance count is what the cap and warning see", async () => {
	const twin = [{ id: "a", kind: "box", at: [0, 0, 0], size: [2, 2, 2], repeat: { linear: { count: 2, step: [4, 0, 0] } } }, { id: "a-1", kind: "box", at: [20, 0, 0], size: [2, 2, 2] }];
	assert.match(validateBrief(brief(twin)).join("\n"), /part id "a-1" is used more than once/);
	assert.match(validateBrief(brief([{ id: "a", kind: "box", at: [0, 0, 0], size: [2, 2, 2], repeat: { spiral: {} } }])).join("\n"), /exactly one of linear, grid or polar/);
	// Phase 3: a box turns towards the angle through yaw; a tray still cannot.
	assert.equal(validateBrief(brief([{ id: "a", kind: "box", at: [0, 0, 0], size: [2, 2, 2], repeat: { polar: { count: 4, centre: [0, 0], radius: 5, face: true } } }])).join("\n"), "");
	assert.match(validateBrief(brief([{ id: "a", kind: "tray", at: [0, 0, 0], size: [2, 2, 2], repeat: { polar: { count: 4, centre: [0, 0], radius: 5, face: true } } }])).join("\n"), /face turns the part, which a tray cannot do yet/);
	assert.match(validateBrief(brief([{ id: "a", kind: "box", at: [0, 0, 0], size: [2, 2, 2], repeat: { linear: { count: 3, step: [4, 0, 0] } }, vary: { field: "size.2", values: [1, 2] } }])).join("\n"), /values must list 3 values/);
	assert.match(validateBrief(brief([{ id: "a", kind: "box", at: [0, 0, 0], size: [2, 2, 2], instances: [{ id: "x" }] }])).join("\n"), /instances\[0\]\.id cannot be overridden/);
	// The part count is taken after expansion: 256 instances are 256 parts. partsMax (and now partsWarn) may be null in
	// checks-thresholds.json, so the warning follows whatever the threshold says.
	const many = brief([{ id: "a", kind: "box", at: [0, 0, 0], size: [1, 1, 1], repeat: { grid: { count: [16, 16], step: [2, 2] } } }]);
	assert.deepEqual(validateBrief(many), []);
	const { WARN_PARTS } = await import("./scene.mjs");
	const warned = /256 parts; above \d+ a figure gets heavy/.test(buildScene(many).warnings.join("\n"));
	assert.equal(warned, 256 > WARN_PARTS);
	assert.equal(buildScene(many).pieces.length, 256);
	const instances = expandBrief(brief([{ id: "a", kind: "box", at: [0, 0, 0], size: [1, 1, 1], tone: "ink", instances: [{ at: [5, 0, 0] }, { at: [9, 0, 0], tone: undefined, size: [2, 2, 2] }] }]));
	assert.deepEqual(instances.parts.map(part => [part.id, part.at[0], part.size[0]]), [["a-0", 5, 1], ["a-1", 9, 2]]);
});

test("explode guides on a tilted lathe start on its silhouette, not at plan-box corners floating off the solid", () => {
	const nozzle = { id: "nozzle", kind: "lathe", at: [10, 25, 14], axis: [1, 0, 0.3], explode: [0, 0, 20], profile: [[0, 6], [20, 6], [30, 3], [40, 2]] };
	const deck = { id: "deck", kind: "slab", at: [0, 0, 0], size: [80, 50, 4] };
	const scene = buildScene(brief([deck, nozzle], { interact: { behavior: "explode", explode: { rest: 0, min: 0, max: 1, step: 0.1 } } }));
	const guides = scene.guides.filter(guide => guide.from === "nozzle");
	assert.equal(guides.length, 1);
	const samples = boundsOf(scene.brief.parts.find(part => part.id === "nozzle")).samples3.map(point => iso(point, scene.P));
	for (const { from } of guides[0].ends) {
		const nearest = Math.min(...samples.map(([x, y]) => Math.hypot(x - from[0], y - from[1])));
		assert.ok(nearest < 1e-6, `guide starts ${nearest.toFixed(2)} units off the solid`);
	}
});
