// Painter order (plan § 2 cross-cutting): the vendored depth audit orders overlapping pieces by which is in front, where the
// old single depth point mis-ordered long and offset solids.
import assert from "node:assert/strict";
import test from "node:test";
import { depthOf } from "../anatomy/vendor/kit/iso-kit.mjs";
import { renderRegion } from "./emit.mjs";
import { auditHtml } from "./audit.mjs";
import { buildScene } from "./scene.mjs";

const brief = parts => ({ schema: "vpk-iso-brief/1", id: "painter", figId: "FIG_952", title: "Painter", label: "Parts that overlap on screen.", labels: "none", emphasis: "none", parts });
const orderOf = scene => scene.pieces.map(piece => piece.id);
const before = (order, a, b) => assert.ok(order.indexOf(a) < order.indexOf(b), `${a} paints before ${b}: ${order.join(" ")}`);
const floor = { id: "floor", kind: "slab", at: [-30, -30, -2], size: [130, 90, 2] };

test("a horizontal lathe between two posts paints after the far post and before the near one (centre depth gets both wrong)", () => {
	const parts = [
		floor,
		{ id: "far-post", kind: "box", at: [53, -14, 0], size: [4, 6, 24] },
		{ id: "near-post", kind: "box", at: [-13, 8, 0], size: [4, 6, 24] },
		{ id: "shaft", kind: "lathe", at: [-20, 0, 10], axis: "x", profile: [[0, 3], [100, 3]] },
	];
	const scene = buildScene(brief(parts));
	const order = orderOf(scene);
	before(order, "far-post", "shaft");
	before(order, "shaft", "near-post");
	const centre = part => depthOf(part, scene.P);
	assert.ok(centre([55, -11, 12]) > centre([30, 0, 10]), "by centre depth the far post would paint over the shaft");
	assert.deepEqual(auditHtml(renderRegion(scene)).findings.filter(f => f.rule === "A5"), []);
});

test("a horizontal cylinder through a gantry: behind the crossbeam's far leg, under the beam, in front of the far leg", () => {
	const parts = [
		floor,
		{ id: "leg-far", kind: "box", at: [20, -12, 0], size: [4, 4, 30] },
		{ id: "leg-near", kind: "box", at: [20, 12, 0], size: [4, 4, 30] },
		{ id: "beam", kind: "box", at: [20, -12, 30], size: [4, 28, 4] },
		{ id: "roller", kind: "cylinder", at: [-10, 2, 12], size: [5, 5, 80], axis: "x" },
	];
	const order = orderOf(buildScene(brief(parts)));
	before(order, "leg-far", "roller");
	before(order, "roller", "leg-near");
});

test("a card inside a tray paints between the tray's back and front", () => {
	const parts = [{ id: "tray", kind: "tray", at: [0, 0, 0], size: [60, 40, 10] }, { id: "card", kind: "slab", at: [10, 18, 2], size: [40, 2, 24] }];
	const order = orderOf(buildScene(brief(parts)));
	before(order, "tray:back", "card");
	before(order, "card", "tray:front");
});

test("a cubby grid with letters: each letter after the back panel and its far divider, before its near divider", () => {
	const parts = [{ id: "back", kind: "box", at: [0, 0, 0], size: [40, 2, 20] }];
	for (let i = 0; i <= 4; i++) parts.push({ id: `div-${i}`, kind: "box", at: [i * 10, 2, 0], size: [1, 14, 20] });
	for (let i = 0; i < 4; i++) parts.push({ id: `letter-${i}`, kind: "slab", at: [i * 10 + 3, 4, 0], size: [5, 1, 14] });
	const order = orderOf(buildScene(brief(parts)));
	for (let i = 0; i < 4; i++) {
		before(order, "back", `letter-${i}`);
		before(order, `div-${i}`, `letter-${i}`);
		before(order, `letter-${i}`, `div-${i + 1}`);
	}
});

// Regression: an open tray's walls and dividers were one "run" the audit skipped, so once contents moved some divider keys, a
// shelf and the x divider in front of it tied and sorted by id (the shelf painted over the divider). The bench under the grid
// lifts every grid piece to one key, which is what made them tie.
test("an open cubby grid with contents keeps each shelf behind the x divider in front of it", () => {
	const parts = [
		{ id: "bench", kind: "slab", at: [-10, -10, -4], size: [180, 120, 4] },
		{ id: "grid", kind: "tray", at: [0, 0, 0], size: [60, 20, 40], axis: "+y", dividers: { x: [20, 40], z: [20] } },
		{ id: "card1", kind: "box", at: [4, 14, 2], size: [12, 1, 14] },
		{ id: "card2", kind: "box", at: [24, 16, 22], size: [12, 1, 14], yaw: 8 },
		{ id: "card3", kind: "box", at: [44, 18, 2], size: [12, 1, 14] },
	];
	const order = orderOf(buildScene(brief(parts)));
	before(order, "grid:div-z0-0-0", "grid:div-x0");
	before(order, "grid:div-x0", "grid:div-z0-1-0");
	before(order, "grid:div-z0-1-0", "grid:div-x1");
	before(order, "grid:div-x1", "grid:div-z0-2-0");
	before(order, "grid:back", "card1");
	before(order, "card3", "grid:front");
});

// The card regression: a long upright card and a small box at the same height. By centre depth the box (far along x) paints
// last, but the long card's near end stands in front of it.
test("two overlapping cards at the same height are ordered by which is in front, not by their centres", () => {
	const parts = [floor, { id: "long-card", kind: "slab", at: [0, 20, 0], size: [100, 2, 10] }, { id: "block", kind: "box", at: [90, 10, 0], size: [5, 4, 10] }];
	const scene = buildScene(brief(parts));
	assert.ok(depthOf([92.5, 12, 5], scene.P) > depthOf([50, 21, 5], scene.P), "centre depth would paint the block over the card");
	before(orderOf(scene), "block", "long-card");
	const depth = id => scene.pieces.find(piece => piece.id === id).depth;
	assert.ok(depth("block") < depth("long-card"), "data-vpk-iso-depth follows painter order (A5 holds)");
});
