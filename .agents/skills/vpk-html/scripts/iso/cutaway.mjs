// iso/cutaway — a turned part with a window cut into it (plan § 2 C): `cutaway: { from, to, wall, hatch? }` on a lathe, cone or
// cylinder. `from` → `to` are degrees around the axis, measured from the frame's u towards v (geometry.mjs frameFor: an upright part
// has u = +x, v = +y); `wall` is the shell's thickness, so the part is drawn as a shell of that thickness and its inside shows
// through the window. It becomes several pieces of one unit (`of`):
//   <id>:back     the whole outer lathe plus the dark cavity (the inner wall seen through the window), painted before the contents;
//   <id>:front    the outer lathe again, clipped by the complement of the visible window (`window`; the emitter's even-odd clipPath),
//                 then the section faces at `from` and `to` that face the reader (role "cut", optional hatch), painted after the
//                 contents. Its detail rides here, so it is cut with the shell, and the runtime hits it outside the window only.
// Painter shapes: the front is the solid body (it stands in front of everything inside it), the back is the shell with the window
// and its near half removed (vendored sdf `cut`). Built on the vendored anatomy kit (MIT © 2026 Ryan,
// scripts/anatomy/vendor/LICENSE); the kit is imported, never edited.

import { iso, pathOf } from "../anatomy/vendor/kit/iso-kit.mjs";
import { add3, dot3, lathe, mul3, pointOf, tangentOf, viewOf } from "../anatomy/vendor/kit/lathe.mjs";
import * as A from "../anatomy/vendor/kit/audit.mjs";
import { hull } from "./core.mjs";
import { boundsOf, radiusAt } from "./geometry.mjs";

const RAD = Math.PI / 180;
// Window arcs are sampled at least every ARC_STEP degrees (the chord's sagitta stays far below a pixel).
const ARC_STEP = 5;
export const CUTAWAY_KINDS = Object.freeze(["lathe", "cone", "cylinder"]);
const KEYS = new Set(["from", "to", "wall", "hatch"]);
const isNum = value => typeof value === "number" && Number.isFinite(value);

// The outer profile [[s, r], …] of a cutaway kind and whether its ends are capped.
export function profileOf(part) {
	if (part.kind === "lathe") return { profile: part.profile.map(([s, r]) => [s, r]), closed: part.closed !== false };
	if (part.kind === "cone") return { profile: [[0, part.r0], [part.length, part.r1]], closed: true };
	return { profile: [[0, part.size[0]], [part.size[2], part.size[0]]], closed: true };
}

export function validateCutaway(part, at, push) {
	const c = part.cutaway;
	if (c === undefined) return;
	const where = `${at}.cutaway`;
	if (!CUTAWAY_KINDS.includes(part.kind)) return push(`${where} applies to turned parts (${CUTAWAY_KINDS.join(", ")})`);
	if (!c || typeof c !== "object" || Array.isArray(c)) return push(`${where} must be { from, to, wall, hatch? }`);
	for (const key of Object.keys(c)) if (!KEYS.has(key)) push(`${where}.${key} is not a cutaway field (from, to, wall, hatch)`);
	if (!isNum(c.from) || !isNum(c.to)) push(`${where}.from and to must be degrees around the axis`);
	else if (!(c.to > c.from && c.to - c.from < 360)) push(`${where} needs from < to and a window narrower than 360°`);
	if (!(isNum(c.wall) && c.wall > 0)) push(`${where}.wall must be > 0 (the shell's thickness)`);
	if (c.hatch !== undefined && !(isNum(c.hatch) && c.hatch >= 0.5)) push(`${where}.hatch is the section hatch spacing, ≥ 0.5`);
	if (part.tone === "glass") push(`${where}: a glass part shows its inside already; drop the cutaway or the tone`);
	if (part.hole !== undefined && part.hole !== null) push(`${where}: a cutaway shell takes wall, not hole`);
	if (part.kind === "lathe" && !Array.isArray(part.profile)) return;
	if (part.kind === "cone" && !(isNum(part.r0) && isNum(part.r1) && isNum(part.length))) return;
	if (part.kind === "cylinder" && !(Array.isArray(part.size) && part.size.every(isNum))) return;
	const { profile, closed } = profileOf(part);
	if (!isNum(c.wall)) return;
	if (!profile.some(([, r]) => r > c.wall)) push(`${where}.wall ${c.wall} leaves no cavity: it must be thinner than the widest radius`);
	if (closed && !(profile.at(-1)[0] - profile[0][0] > 2 * c.wall)) push(`${where}.wall ${c.wall} leaves no cavity between the capped ends`);
}

// The shell's meridian polygon (outer profile out, the inner wall back) and the cavity's meridian (the inner wall; capped to the
// axis when the ends are). Inner radii are the outer ones less the wall, at the outer profile's own points, so steps stay steps.
export function shellOf(profile, closed, wall) {
	const s0 = profile[0][0];
	const s1 = profile.at(-1)[0];
	const lo = closed ? s0 + wall : s0;
	const hi = closed ? s1 - wall : s1;
	const inside = r => Math.max(0, r - wall);
	const mid = profile.filter(([s]) => s > lo + 1e-9 && s < hi - 1e-9).map(([s, r]) => [s, inside(r)]);
	const inner = [[lo, inside(lo === s0 ? profile[0][1] : radiusAt(profile, lo))], ...mid, [hi, inside(hi === s1 ? profile.at(-1)[1] : radiusAt(profile, hi))]];
	const outer = closed ? [[s0, 0], ...profile, [s1, 0]] : profile.slice();
	const cavity = closed ? [[lo, 0], ...inner, [hi, 0]] : inner;
	return { section: [...outer, ...cavity.slice().reverse()], cavity, outer };
}

const arc = (a0, a1) => {
	const n = Math.max(1, Math.ceil((a1 - a0) / ARC_STEP));
	return Array.from({ length: n + 1 }, (_, i) => (a0 + ((a1 - a0) * i) / n) * RAD);
};

// The visible window on screen: the hull of the outer surface's points inside the window angles that face the reader (each meridian
// segment's facing test is the vendored lathe's), or null when the window faces away and nothing of it shows.
export function windowOf(F, outer, from, to, P) {
	const V = viewOf(P);
	const [aV, uV, vV] = [dot3(F.a, V), dot3(F.u, V), dot3(F.v, V)];
	const points = [];
	for (const angle of arc(from, to)) {
		const [c, n] = [Math.cos(angle), Math.sin(angle)];
		for (let i = 0; i + 1 < outer.length; i++) {
			const [s0, r0] = outer[i];
			const [s1, r1] = outer[i + 1];
			const facing = (s1 - s0) * (c * uV + n * vV) - (r1 - r0) * aV;
			if (facing > 1e-6 * (Math.hypot(s1 - s0, r1 - r0) || 1)) points.push(iso(pointOf(F, s0, r0, angle), P), iso(pointOf(F, s1, r1, angle), P));
		}
	}
	const out = hull(points);
	return out.length >= 3 ? out : null;
}

// Hatch lines across a polygon in its own plane: parallel lines `spacing` apart at `angle` degrees, each clipped to the polygon
// (even-odd, so a concave section is hatched only inside). [[a, b], …] in the polygon's coordinates.
export function hatchSegments(poly, spacing, angle = 45) {
	const d = [Math.cos(angle * RAD), Math.sin(angle * RAD)];
	const n = [-d[1], d[0]];
	const across = poly.map(([x, y]) => x * n[0] + y * n[1]);
	const out = [];
	for (let k = Math.ceil(Math.min(...across) / spacing + 1e-9); k * spacing < Math.max(...across) - 1e-9; k++) {
		const c = k * spacing;
		const ts = [];
		poly.forEach((p, i) => {
			const j = (i + 1) % poly.length;
			const [pa, qa] = [across[i] - c, across[j] - c];
			if (pa < 0 === qa < 0) return;
			const q = poly[j];
			const t = pa / (pa - qa);
			ts.push((p[0] + (q[0] - p[0]) * t) * d[0] + (p[1] + (q[1] - p[1]) * t) * d[1]);
		});
		ts.sort((a, b) => a - b);
		for (let i = 0; i + 1 < ts.length; i += 2) out.push([ts[i], ts[i + 1]].map(t => [n[0] * c + d[0] * t, n[1] * c + d[1] * t]));
	}
	return out;
}

// A sector of the frame's (u, v) plane from a0 to a1 degrees, radius R: the polygon of a vendored prism that cuts the shell.
const sector = (a0, a1, R) => [[0, 0], ...arc(a0, a1).map(a => [R * Math.cos(a), R * Math.sin(a)])];

// One cutaway part → its pieces (kinds.mjs calls it with the part's lathe body, its solid shape and latheSolid()).
export function cutawayPieces(part, body, P, style, { shape, solidOf }) {
	const { F } = body;
	const { from, to, wall, hatch } = part.cutaway;
	const { profile, closed } = profileOf(part);
	const shell = shellOf(profile, closed, wall);
	const bounds = boundsOf(part);
	const base = { kind: part.kind, plan: [bounds.plan], bottom: bounds.bottom, top: bounds.top };
	const outer = solidOf(body, P, { shading: style.shading, bevel: part.bevel ?? 0, steps: part.steps });
	const window = windowOf(F, shell.outer, from, to, P);
	// A window turned away from the reader shows nothing: the part draws as the plain solid it is.
	if (!window) return [{ ...base, id: part.id, of: undefined, solids: [outer], depthPoint: bounds.centre, shapes: [shape] }];
	const V = viewOf(P);
	const reach = Math.hypot(...bounds.max.map((v, i) => v - bounds.min[i])) / 2;
	const cavityPaths = lathe(shell.cavity, F, P, part.steps ? { steps: part.steps } : {});
	const cavity = { fill: null, top: null, shade: null, edge: null, recess: cavityPaths.fill, crease: cavityPaths.outline || null };
	const s0 = profile[0][0] - 1;
	const s1 = profile.at(-1)[0] + 1;
	const R = Math.max(...profile.map(([, r]) => r)) * 2 + 4;
	const plane = { o: F.o, a: F.a, u: F.u, v: F.v };
	const facingAt = Math.atan2(dot3(V, F.v), dot3(V, F.u)) / RAD;
	const cuts = [A.prism(plane, sector(from, to, R), s0, s1)];
	if (Math.hypot(dot3(V, F.u), dot3(V, F.v)) > 1e-3) cuts.push(A.prism(plane, sector(facingAt - 90, facingAt + 90, R), s0, s1));
	const pieces = [{ ...base, id: `${part.id}:back`, of: part.id, solids: [outer, cavity], depthPoint: add3(bounds.centre, mul3(V, -reach)), shapes: [{ ...A.body(F, shell.section), cut: cuts }], cutaway: "back" }];
	// The front: the outer lathe clipped to everything but the window (the emitter's clip group, with the part's detail), then the
	// section faces that face the reader, unclipped, last. The face at `from` bounds the material below it, so its outward normal is
	// +tangent; the face at `to`, −tangent. One piece, so its painter shape is the solid body: it stands in front of all it holds.
	const solids = [{ ...outer, clipped: true }];
	[[from, 1], [to, -1]].forEach(([deg, sign]) => {
		const angle = deg * RAD;
		if (dot3(mul3(tangentOf(F, angle), sign), V) <= 1e-6) return;
		const at = ([s, r]) => pointOf(F, s, r, angle);
		const poly = shell.section.map(point => iso(at(point), P));
		const hatched = hatch ? hatchSegments(shell.section, hatch).map(([a, b]) => pathOf([iso(at(a), P), iso(at(b), P)])).join("") : "";
		solids.push({ fill: null, top: null, shade: null, edge: null, cut: pathOf(poly, true), crease: pathOf([...poly, poly[0]]), hatch: hatched || null });
	});
	pieces.push({ ...base, id: `${part.id}:front`, of: part.id, solids, depthPoint: add3(bounds.centre, mul3(V, reach)), shapes: [shape], cutaway: "front", window, detailHost: true });
	return pieces;
}
