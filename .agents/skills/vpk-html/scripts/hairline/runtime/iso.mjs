// hairline/runtime/iso — stands in for vendored core/iso.ts inside the bundle, so a filled outline still knows the solid it was
// drawn from. proj() tags every projected point with its world point (`w`) and its projector (`p`, which carries the camera's
// view); hull() keeps the points it was taken over (`src`); poly() hands each closed path it writes to runtime/paint.mjs with
// those points, and paint.mjs tones and shadows any filled path whose `d` is made of them (runtime/faces.mjs). A figure that moves
// a drawn outline up the screen by hand (sieve: a drum drawn once, then shifted) writes untagged points; under this camera a
// shift straight up the screen is a lift in z, so poly() finds the tagged hull it is a shift of and tags its points lifted. The
// strings, and so the geometry, are upstream's. prism() is upstream's own body, restated so it calls these hull() and poly():
// inside the vendored module it would reach the untagged ones. The bundle resolves every vendored `core/iso` import here.
import { hull as vendorHull, open, poly as vendorPoly, proj as vendorProj, ringAt, run } from "../vendor/packages/hairline/src/core/iso.ts";
import { viewOf } from "./faces.mjs";
import { remember } from "./paint.mjs";

export * from "../vendor/packages/hairline/src/core/iso.ts";

// The latest projectors (turntable makes one a frame), each with the tagged hulls drawn through it, keyed by shape.
const projectors = [];
const PROJECTORS = 8, SHAPES = 400;

export function proj(C) {
	const base = vendorProj(C);
	const P = (x, y, z) => {
		const q = base(x, y, z);
		q.w = [x, y, z];
		q.p = P;
		return q;
	};
	P.view = viewOf(C.az, C.k);
	P.shapes = new Map();
	projectors.unshift(P);
	if (projectors.length > PROJECTORS) projectors.pop();
	return P;
}

// A shape's key up to a translation: its points relative to the first, to a hundredth.
const shapeKey = pts => pts.map(p => `${Math.round((p[0] - pts[0][0]) * 100)},${Math.round((p[1] - pts[0][1]) * 100)}`).join(" ");

export function hull(input) {
	const out = vendorHull(input);
	out.src = input;
	const shapes = out[0]?.p?.shapes;
	if (shapes && input.every(p => p.w)) {
		const key = shapeKey(out);
		shapes.delete(key);
		shapes.set(key, out);
		if (shapes.size > SHAPES) shapes.delete(shapes.keys().next().value);
	}
	return out;
}

// The tagged hull `pts` is a shift of straight up or down the screen, re-tagged at the lifted height; else pts as they are.
function lifted(pts) {
	if (pts.length < 3 || pts[0].w) return pts;
	const key = shapeKey(pts);
	for (const P of projectors) {
		const base = P.shapes.get(key);
		if (!base || Math.abs(base[0][0] - pts[0][0]) > 0.01) continue;
		const dz = (pts[0][1] - base[0][1]) / (P(0, 0, 1)[1] - P(0, 0, 0)[1]);
		const lift = q => P(q.w[0], q.w[1], q.w[2] + dz);
		const out = base.map(lift);
		out.src = base.src.map(lift);
		return out;
	}
	return pts;
}

export function poly(pts) {
	const d = vendorPoly(pts);
	remember(d, lifted(pts));
	return d;
}

export function prism(P, front, ring, inner, z0, z1) {
	return {
		sil: poly(hull(ringAt(P, ring, z1).concat(ringAt(P, ring, z0)))),
		crease: inner ? open(ringAt(P, run(inner, front), z1)) : "",
	};
}
