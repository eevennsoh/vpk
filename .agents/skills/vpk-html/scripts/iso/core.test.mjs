import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { pathOf } from "../anatomy/vendor/kit/iso-kit.mjs";
import { convexOverlap, hull, isoClamp, isoLerp, parsePolyPath, parseVec, pointInPolygon, topmostHit } from "./core.mjs";

const SOURCE = fs.readFileSync(new URL("./core.mjs", import.meta.url), "utf8");
const square = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];

test("core.mjs is import-free (it is inlined into the runtime block)", () => {
	assert.doesNotMatch(SOURCE, /^\s*import\b/m);
});

test("clamp and lerp", () => {
	assert.equal(isoClamp(5, 0, 1), 1);
	assert.equal(isoClamp(-5, 0, 1), 0);
	assert.equal(isoLerp(10, 20, 0.25), 12.5);
});

test("hull drops interior and collinear points", () => {
	const points = [...square(0, 0, 10), [5, 5], [5, 0], [2, 3]];
	const out = hull(points);
	assert.equal(out.length, 4);
	for (const corner of square(0, 0, 10)) assert.ok(out.some(([x, y]) => x === corner[0] && y === corner[1]), `keeps ${corner}`);
	assert.deepEqual(hull([[1, 1], [2, 2]]), [[1, 1], [2, 2]]);
});

test("pointInPolygon on a square and a triangle", () => {
	assert.equal(pointInPolygon([5, 5], square(0, 0, 10)), true);
	assert.equal(pointInPolygon([15, 5], square(0, 0, 10)), false);
	assert.equal(pointInPolygon([1, 1], [[0, 0], [10, 0], [0, 10]]), true);
	assert.equal(pointInPolygon([9, 9], [[0, 0], [10, 0], [0, 10]]), false);
});

test("convexOverlap: overlapping, separate, touching", () => {
	assert.equal(convexOverlap(square(0, 0, 10), square(5, 5, 10)), true);
	assert.equal(convexOverlap(square(0, 0, 10), square(20, 0, 10)), false);
	assert.equal(convexOverlap(square(0, 0, 10), square(10, 0, 10)), false, "shared edge is not an overlap");
	assert.equal(convexOverlap(square(0, 0, 10), [[2, 2], [3, 2], [2, 3]]), true, "contained");
	assert.equal(convexOverlap([[0, 0], [1, 1]], square(0, 0, 10)), false, "degenerate input");
});

test("parsePolyPath round-trips the vendored pathOf output", () => {
	assert.deepEqual(parsePolyPath("M10 20L30 40Z"), [[10, 20], [30, 40]]);
	assert.deepEqual(parsePolyPath("M-1.5 2L3 -4.5L-0.1-0.2Z"), [[-1.5, 2], [3, -4.5], [-0.1, -0.2]]);
	const points = [[1.25, -3.44], [10.06, 20.55], [-7, 0]];
	assert.deepEqual(parsePolyPath(pathOf(points, true)), [[1.3, -3.4], [10.1, 20.6], [-7, 0]]);
	assert.deepEqual(parsePolyPath("M1 2L3 4M5 6L7 8"), [[1, 2], [3, 4], [5, 6], [7, 8]], "multiple subpaths");
});

test("parsePolyPath rejects anything but absolute M/L/Z", () => {
	for (const bad of ["m1 2l3 4", "M1 2C3 4 5 6 7 8", "M1 2L3", "", "L1 2", null, "M1 2Lx 4", "M1 2A3 3 0 0 1 4 4"]) assert.equal(parsePolyPath(bad), null, String(bad));
});

test("parseVec accepts two numbers and rejects garbage", () => {
	assert.deepEqual(parseVec("0 -20.8"), [0, -20.8]);
	assert.deepEqual(parseVec("1,2"), [1, 2]);
	assert.deepEqual(parseVec("  3.5   -4 "), [3.5, -4]);
	for (const bad of ["a b", "1", "1 2 3", "", "NaN 1", "1e400 0", "1px 2", undefined, null]) assert.equal(parseVec(bad), null, String(bad));
});

test("topmostHit tests in reverse painter order", () => {
	const polys = [square(0, 0, 10), square(5, 5, 10), null];
	assert.equal(topmostHit(polys, [7, 7]), 1, "the later polygon wins where they overlap");
	assert.equal(topmostHit(polys, [1, 1]), 0);
	assert.equal(topmostHit(polys, [50, 50]), -1);
});
