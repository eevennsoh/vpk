// iso/prism — solids for a prism body (plan § 2 P, G): a polygon in a frame's (u, v) plane extruded along its axis, from a `prism`
// part or a box, slab or plate that turns (yaw, axis, up) or is glass. The vendored prismOf() draws a hull, so a concave polygon
// would read as a blob; here the polygon is split into convex solids (polygon.mjs convexParts), painted back to front along the
// camera's direction in the polygon's plane, each solid's opaque fill covering what it hides of the solids behind it. The true
// outline is line work: per solid its facing side faces, the hidden cap's edges under them and the vertical edges it owns; then
// the visible cap, last, with its whole outline (a prism never stands in front of its own visible cap). Internal diagonals draw
// nothing. Each convex fill reaches EPS_PX past its diagonals into its neighbour, so no paper shows along a seam.
// A concave prism is one piece with several fills: it carries data-vpk-iso-hit="solids", and the runtime hits it by the hull of
// each fill, so a point in a notch hits nothing.
// Glass (tone "glass") paints no face: its visible edges are the edge stroke, its hidden edges dashed creases.
// Projection only through the vendored iso() and pathOf() (MIT © 2026 Ryan, scripts/anatomy/vendor/LICENSE).

import { iso, pathOf } from "../anatomy/vendor/kit/iso-kit.mjs";
import { add3, bandOf, dot3, lightOf, mul3, scaleOf, unit3, viewOf } from "../anatomy/vendor/kit/lathe.mjs";
import * as A from "../anatomy/vendor/kit/audit.mjs";
import { hull } from "./core.mjs";
import { boundsOf, prismPoint } from "./geometry.mjs";
import { frontOrder } from "./polygon.mjs";

const joined = list => list.filter(Boolean).join("");
// A vertex is a crease when its two edges turn by more than 0.35 rad (the vendored prismOf rule), so a rounded corner draws none.
const SHARP = Math.cos(0.35);
// How far, in viewBox units, a convex fill reaches past an internal diagonal.
export const EPS_PX = 0.3;

// The convex pieces' polygons, each pushed `eps` past its internal diagonals (edges that are not ring edges).
function grown(ring, idx, eps) {
	const n = ring.length;
	const out = idx.map(i => [...ring[i]]);
	idx.forEach((v, k) => {
		const w = idx[(k + 1) % idx.length];
		if (w === (v + 1) % n) return;
		const [a, b] = [ring[v], ring[w]];
		const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		const push = [((b[1] - a[1]) / len) * eps, (-(b[0] - a[0]) / len) * eps];
		for (const j of [k, (k + 1) % idx.length]) {
			out[j][0] += push[0];
			out[j][1] += push[1];
		}
	});
	return out;
}

export function prismSolids(body, P, { shading = true, glass = false } = {}) {
	const { F, ring, depth } = body;
	const n = ring.length;
	const V = viewOf(P);
	const L = lightOf(P);
	const at = (s, point) => iso(prismPoint(F, s, point), P);
	const low = ring.map(point => at(0, point));
	const high = ring.map(point => at(depth, point));
	const normals = ring.map(([x0, y0], j) => {
		const [x1, y1] = ring[(j + 1) % n];
		return unit3(add3(mul3(F.u, y1 - y0), mul3(F.v, -(x1 - x0))));
	});
	const facing = normals.map(nrm => dot3(nrm, V) > 1e-6);
	const band = nrm => bandOf(dot3(nrm, L));
	const capNormals = [mul3(F.a, -1), F.a];
	const caps = [low, high];
	const seen = dot3(capNormals[1], V) > 1e-6 ? 1 : dot3(capNormals[0], V) > 1e-6 ? 0 : -1;
	const hiddenCaps = [0, 1].filter(k => k !== seen);
	const sharp = i => {
		const prev = ring[(i + n - 1) % n];
		const next = ring[(i + 1) % n];
		const a = [ring[i][0] - prev[0], ring[i][1] - prev[1]];
		const b = [next[0] - ring[i][0], next[1] - ring[i][1]];
		return (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) || 1) < SHARP;
	};
	const sideFace = j => pathOf([low[j], low[(j + 1) % n], high[(j + 1) % n], high[j]], true);
	const capLine = (k, j) => pathOf([caps[k][j], caps[k][(j + 1) % n]]);
	const vertical = i => pathOf([low[i], high[i]]);

	if (glass) {
		const visible = [];
		const hidden = [];
		for (let j = 0; j < n; j++) {
			if (seen >= 0) visible.push(capLine(seen, j));
			for (const k of hiddenCaps) (facing[j] ? visible : hidden).push(capLine(k, j));
			if (facing[(j + n - 1) % n] !== facing[j]) visible.push(vertical(j));
			else if (sharp(j)) (facing[j] ? visible : hidden).push(vertical(j));
		}
		return [{ fill: null, top: null, shade: null, edge: joined(visible), crease: joined(hidden) || null }];
	}

	// Which convex solid owns each ring edge, and the paint order of the solids (back to front).
	const pieces = body.parts;
	const ownerOf = new Array(n).fill(0);
	pieces.forEach((idx, p) => idx.forEach((v, k) => {
		if (idx[(k + 1) % idx.length] === (v + 1) % n) ownerOf[v] = p;
	}));
	const order = frontOrder(pieces.map(idx => idx.map(i => ring[i])), [dot3(V, F.u), dot3(V, F.v)]);
	const rank = new Array(pieces.length);
	order.forEach((p, r) => (rank[p] = r));
	const eps = pieces.length > 1 ? EPS_PX / scaleOf(P) : 0;
	const solids = order.map(p => {
		const shades = [];
		const tops = [];
		const edges = [];
		const creases = [];
		for (let j = 0; j < n; j++) {
			if (ownerOf[j] !== p || !facing[j]) continue;
			const b = band(normals[j]);
			if (b <= 1 && shading) shades.push(sideFace(j));
			else if (b === 4) tops.push(sideFace(j));
			for (const k of hiddenCaps) edges.push(capLine(k, j));
		}
		// A vertical edge belongs to the later painted of the solids owning its two ring edges.
		for (let i = 0; i < n; i++) {
			const prev = (i + n - 1) % n;
			if ((rank[ownerOf[prev]] > rank[ownerOf[i]] ? ownerOf[prev] : ownerOf[i]) !== p) continue;
			if (facing[prev] !== facing[i]) edges.push(vertical(i));
			else if (facing[i] && sharp(i)) creases.push(vertical(i));
		}
		const poly = grown(ring, pieces[p], eps);
		return { fill: pathOf(hull(poly.flatMap(point => [at(0, point), at(depth, point)])), true), top: joined(tops) || null, shade: joined(shades) || null, edge: joined(edges) || null, crease: joined(creases) || null };
	});
	// The visible cap with its outline: an edge whose side faces the viewer is the crease between cap and side.
	if (seen >= 0) {
		const capPath = pathOf(caps[seen], true);
		const b = band(capNormals[seen]);
		const edges = [];
		const creases = [];
		for (let j = 0; j < n; j++) (facing[j] ? creases : edges).push(capLine(seen, j));
		const cap = { top: b === 4 ? capPath : null, shade: b <= 1 && shading ? capPath : null, edge: joined(edges) || null, crease: joined(creases) || null };
		if (solids.length === 1) {
			const [only] = solids;
			solids[0] = { fill: only.fill, top: joined([only.top, cap.top]) || null, shade: joined([only.shade, cap.shade]) || null, edge: joined([only.edge, cap.edge]) || null, crease: joined([only.crease, cap.crease]) || null };
		} else solids.push({ fill: null, ...cap });
	}
	return solids;
}

// One prism part (or turned or glass box) → its one piece. Its signed-distance shape is the vendored prism of the whole polygon
// (concave is fine there), so painter order sees the notches.
export function prismPieces(part, body, P, style) {
	const bounds = boundsOf(part);
	const glass = part.tone === "glass";
	const solids = prismSolids(body, P, { shading: style.shading, glass });
	return [{
		kind: part.kind,
		id: part.id,
		of: undefined,
		plan: [bounds.plan],
		bottom: bounds.bottom,
		top: bounds.top,
		solids,
		depthPoint: bounds.centre,
		shapes: [A.prism(body.F, body.ring, 0, body.depth)],
		hitSolids: !glass && body.parts.length > 1,
	}];
}
