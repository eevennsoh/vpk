// iso/polygon — plane polygon helpers for prisms (plan § 2 P): normalising a footprint, rejecting self-intersections, rounding
// corners (the vendored fillet, one corner at a time), a convex decomposition (ear clipping, then Hertel–Mehlhorn merging of the
// diagonals whose removal keeps a piece convex) and a back-to-front order of the convex pieces along the camera's direction in
// the polygon's plane. The vendored prismOf() draws its fill and outline as the convex hull, so a concave footprint (a key bow,
// zigzag bitting, an L kerb) is drawn as several convex solids in one piece (prism.mjs). Pure maths, no projection.

import { fillet } from "../anatomy/vendor/kit/lathe.mjs";

const EPS = 1e-9;

export const signedArea = poly => poly.reduce((sum, [x, y], i) => sum + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0) / 2;
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const scaleOf = poly => Math.max(1e-6, ...poly.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));

// Counter-clockwise, with repeated and collinear points removed.
export function normalizePolygon(poly) {
	const tol = scaleOf(poly) * 1e-9;
	let ring = poly.map(([x, y]) => [x, y]).filter((p, i, all) => Math.hypot(p[0] - all[(i + 1) % all.length][0], p[1] - all[(i + 1) % all.length][1]) > tol);
	let changed = true;
	while (changed && ring.length > 3) {
		changed = false;
		for (let i = 0; i < ring.length; i++) {
			const prev = ring[(i + ring.length - 1) % ring.length];
			const next = ring[(i + 1) % ring.length];
			const span = Math.hypot(next[0] - prev[0], next[1] - prev[1]) || 1;
			if (Math.abs(cross(prev, ring[i], next)) / span <= tol) {
				ring.splice(i, 1);
				changed = true;
				break;
			}
		}
	}
	return signedArea(ring) < 0 ? ring.reverse() : ring;
}

function segmentsCross(a, b, c, d) {
	const d1 = cross(c, d, a);
	const d2 = cross(c, d, b);
	const d3 = cross(a, b, c);
	const d4 = cross(a, b, d);
	if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return true;
	const on = (p, q, r) => Math.abs(cross(p, q, r)) <= EPS && Math.min(p[0], q[0]) - EPS <= r[0] && r[0] <= Math.max(p[0], q[0]) + EPS && Math.min(p[1], q[1]) - EPS <= r[1] && r[1] <= Math.max(p[1], q[1]) + EPS;
	return on(c, d, a) || on(c, d, b) || on(a, b, c) || on(a, b, d);
}

// True when two edges that are not neighbours touch or cross (a figure eight, a bow tie, a polygon that doubles back).
export function selfIntersects(poly) {
	const n = poly.length;
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			if (j === i + 1 || (i === 0 && j === n - 1)) continue;
			if (segmentsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true;
		}
	}
	return false;
}

// Each corner rounded with radius r (the vendored fillet on the corner and its two neighbours, so arcs never overlap: each cuts at
// most 0.48 of an edge). A straight corner keeps its point.
export function roundPolygon(poly, r) {
	if (!(r > 0)) return poly.map(p => [...p]);
	const n = poly.length;
	const out = [];
	for (let i = 0; i < n; i++) {
		const three = [poly[(i + n - 1) % n], poly[i], poly[(i + 1) % n]].map(([x, y]) => [x, y, 0]);
		for (const [x, y] of fillet(three, r).slice(1, -1)) out.push([x, y]);
	}
	return out;
}

const inTriangle = (p, a, b, c) => cross(a, b, p) >= -EPS && cross(b, c, p) >= -EPS && cross(c, a, p) >= -EPS;

// Ear clipping of a CCW ring → triangles as index triples. Only reflex vertices can sit inside an ear, so only they are tested.
export function triangulate(ring) {
	const n = ring.length;
	if (n < 3) return [];
	const left = ring.map((_, i) => i);
	const tris = [];
	let guard = 0;
	while (left.length > 3 && guard++ < n * n) {
		const m = left.length;
		const corner = k => [left[(k + m - 1) % m], left[k], left[(k + 1) % m]];
		const reflex = left.filter((_, k) => cross(...corner(k).map(i => ring[i])) <= EPS);
		// An ear: a convex corner with no reflex vertex inside its triangle. Numerically stuck rings clip the sharpest convex corner.
		let ear = -1;
		let sharpest = -1;
		for (let k = 0; k < m && ear < 0; k++) {
			const [a, b, c] = corner(k);
			const turn = cross(ring[a], ring[b], ring[c]);
			if (turn <= EPS) continue;
			if (sharpest < 0 || turn > cross(...corner(sharpest).map(i => ring[i]))) sharpest = k;
			if (!reflex.some(v => v !== a && v !== b && v !== c && inTriangle(ring[v], ring[a], ring[b], ring[c]))) ear = k;
		}
		const k = ear >= 0 ? ear : Math.max(0, sharpest);
		tris.push(corner(k));
		left.splice(k, 1);
	}
	if (left.length === 3) tris.push([...left]);
	return tris;
}

const isConvex = (ring, idx) => idx.every((v, k) => cross(ring[idx[(k + idx.length - 1) % idx.length]], ring[v], ring[idx[(k + 1) % idx.length]]) >= -1e-7 * scaleOf(ring) ** 2);

// Convex pieces of a CCW ring, as CCW index lists into it. A convex ring is one piece; a concave ring is triangulated and the
// diagonals are removed greedily while the merged piece stays convex (Hertel–Mehlhorn: at most 4× the fewest pieces).
export function convexParts(ring) {
	const all = ring.map((_, i) => i);
	if (isConvex(ring, all)) return [all];
	let parts = triangulate(ring);
	let merged = true;
	while (merged) {
		merged = false;
		const owner = new Map();
		parts.forEach((idx, p) => idx.forEach((v, k) => owner.set(`${v},${idx[(k + 1) % idx.length]}`, p)));
		search: for (let p = 0; p < parts.length; p++) {
			const idx = parts[p];
			for (let k = 0; k < idx.length; k++) {
				const [a, b] = [idx[k], idx[(k + 1) % idx.length]];
				const q = owner.get(`${b},${a}`);
				if (q === undefined || q === p) continue;
				const from = (list, start) => {
					const at = list.indexOf(start);
					return [...list.slice(at), ...list.slice(0, at)];
				};
				const P = from(idx, b);
				const Q = from(parts[q], a);
				const union = [...P, ...Q.slice(1, -1)];
				if (!isConvex(ring, union)) continue;
				parts = parts.filter((_, i) => i !== p && i !== q).concat([union]);
				merged = true;
				break search;
			}
		}
	}
	return parts;
}

// The extent along `d` of a convex polygon on the line { x · p = m } (p ⟂ d), or null when the line misses it.
function spanOn(poly, d, p, m) {
	let lo = Infinity;
	let hi = -Infinity;
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i];
		const b = poly[(i + 1) % poly.length];
		const pa = a[0] * p[0] + a[1] * p[1] - m;
		const pb = b[0] * p[0] + b[1] * p[1] - m;
		if ((pa > 0 && pb > 0) || (pa < 0 && pb < 0)) continue;
		const t = Math.abs(pa - pb) < EPS ? 0 : pa / (pa - pb);
		for (const q of Math.abs(pa - pb) < EPS ? [a, b] : [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]]) {
			const along = q[0] * d[0] + q[1] * d[1];
			lo = Math.min(lo, along);
			hi = Math.max(hi, along);
		}
	}
	return lo <= hi ? [lo, hi] : null;
}

// Back-to-front order of disjoint convex polygons seen along `d` (the camera direction in their plane, pointing at the viewer):
// a polygon goes before every polygon that lies in front of it on a common line along d. Disjoint convex sets in the plane always
// have such an order (no cycles), so a topological sort finds it; ties keep the input order.
export function frontOrder(polys, d) {
	const n = polys.length;
	const len = Math.hypot(d[0], d[1]);
	if (n < 2 || len < 1e-6) return polys.map((_, i) => i);
	const u = [d[0] / len, d[1] / len];
	const p = [-u[1], u[0]];
	const range = poly => {
		const values = poly.map(([x, y]) => x * p[0] + y * p[1]);
		return [Math.min(...values), Math.max(...values)];
	};
	const ranges = polys.map(range);
	const after = polys.map(() => []);
	const need = polys.map(() => 0);
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const lo = Math.max(ranges[i][0], ranges[j][0]);
			const hi = Math.min(ranges[i][1], ranges[j][1]);
			if (hi - lo <= 1e-7) continue;
			const m = (lo + hi) / 2;
			const a = spanOn(polys[i], u, p, m);
			const b = spanOn(polys[j], u, p, m);
			if (!a || !b) continue;
			if (a[1] <= b[0] + 1e-7) {
				after[i].push(j);
				need[j]++;
			} else if (b[1] <= a[0] + 1e-7) {
				after[j].push(i);
				need[i]++;
			}
		}
	}
	const order = [];
	const done = new Set();
	while (order.length < n) {
		let next = -1;
		for (let i = 0; i < n; i++) if (!done.has(i) && need[i] === 0) {
			next = i;
			break;
		}
		if (next < 0) next = [...Array(n).keys()].find(i => !done.has(i));
		done.add(next);
		order.push(next);
		for (const j of after[next]) need[j]--;
	}
	return order;
}
