// iso/core — import-free polygon helpers shared by the build-time audit and the browser runtime.
// iso/inline.mjs inlines this file by text (exports stripped, full-line comments dropped), so it
// must keep: no imports, no module state, top-level names that do not collide with
// runtime/frame-loop.mjs or iso/runtime.mjs.
// hull() follows hairline packages/hairline/src/core/iso.ts (MIT © 2026 Lucas Marques). See NOTICE.md.

export const isoClamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

export const isoLerp = (a, b, t) => a + (b - a) * t;

// Convex hull of [x, y] points (monotone chain), counter-clockwise in screen space.
export function hull(input) {
	const pts = input.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	if (pts.length < 3) return pts;
	const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const lo = [];
	const up = [];
	for (const p of pts) {
		while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
		lo.push(p);
	}
	for (let i = pts.length - 1; i >= 0; i--) {
		const p = pts[i];
		while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
		up.push(p);
	}
	lo.pop();
	up.pop();
	return lo.concat(up);
}

// Even-odd ray cast; points on an edge may land either way.
export function pointInPolygon([x, y], poly) {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

// Separating-axis test for two convex polygons; touching edges do not count as overlap.
export function convexOverlap(a, b, eps = 1e-6) {
	if (a.length < 3 || b.length < 3) return false;
	for (const poly of [a, b]) {
		for (let i = 0; i < poly.length; i++) {
			const [x1, y1] = poly[i];
			const [x2, y2] = poly[(i + 1) % poly.length];
			const nx = y1 - y2;
			const ny = x2 - x1;
			let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
			for (const [x, y] of a) {
				const d = x * nx + y * ny;
				aMin = Math.min(aMin, d);
				aMax = Math.max(aMax, d);
			}
			for (const [x, y] of b) {
				const d = x * nx + y * ny;
				bMin = Math.min(bMin, d);
				bMax = Math.max(bMax, d);
			}
			const scale = Math.hypot(nx, ny) || 1;
			if (aMax <= bMin + eps * scale || bMax <= aMin + eps * scale) return false;
		}
	}
	return true;
}

// Points of an absolute M/L/Z path (the vendored pathOf output, e.g. "M10 20L30 40Z"). Returns
// null for anything else, so callers can mark a figure inert instead of throwing.
export function parsePolyPath(d) {
	if (typeof d !== "string") return null;
	const body = d.trim();
	if (!/^M/.test(body) || /[^MLZ0-9.,\s+-]/.test(body)) return null;
	const points = [];
	const NUM = /[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;
	for (const chunk of body.split(/[MLZ]/).filter(part => part.trim() !== "")) {
		if (chunk.replace(NUM, "").replace(/[\s,]/g, "") !== "") return null;
		const nums = (chunk.match(NUM) || []).map(Number);
		if (nums.length % 2 || nums.some(n => !Number.isFinite(n))) return null;
		for (let i = 0; i < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
	}
	return points.length ? points : null;
}

// "dx dy" (or "dx,dy") → [dx, dy]; anything else → null.
export function parseVec(text) {
	const parts = String(text ?? "").trim().split(/[\s,]+/);
	if (parts.length !== 2) return null;
	const out = parts.map(Number);
	return out.every(Number.isFinite) && parts.every(part => /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(part)) ? out : null;
}

// A hit polygon for line work whose own hull is degenerate (a straight wire): the hull of each point padded by `pad` units.
export function padHull(points, pad = 2) {
	return hull(points.flatMap(([x, y]) => [[x - pad, y - pad], [x + pad, y - pad], [x + pad, y + pad], [x - pad, y + pad]]));
}

// Index of the topmost polygon (latest in painter order) containing the point, or -1. A polygon may carry `solids` (a concave
// prism's convex fills, partPoly): then the point must fall inside one of them, so a notch in a key or an L hits nothing.
export function topmostHit(polys, point) {
	for (let i = polys.length - 1; i >= 0; i--) {
		const poly = polys[i];
		if (poly && (poly.solids ? poly.solids.some(q => pointInPolygon(point, q)) : pointInPolygon(point, poly))) return i;
	}
	return -1;
}

// A part group's hit polygon: the hull of its fills (else of its edges; a straight wire's degenerate hull is padded). A group with
// data-vpk-iso-hit="solids" also keeps each fill's own hull as `solids`.
export function partPoly(el) {
	const paths = role => [...el.querySelectorAll(`[data-vpk-iso-role="${role}"]`)].map(p => parsePolyPath(p.getAttribute("d")) || []).filter(points => points.length);
	let lists = paths("fill");
	if (!lists.length) lists = paths("edge");
	const points = lists.flat();
	let poly = hull(points);
	if (poly.length < 3 && points.length) poly = padHull(points);
	if (el.getAttribute("data-vpk-iso-hit") === "solids") poly.solids = lists.map(hull).filter(q => q.length >= 3);
	return poly;
}
