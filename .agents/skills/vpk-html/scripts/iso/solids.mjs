// iso/solids — part geometry for the iso kit, built on the vendored anatomy kit (MIT © 2026 Ryan,
// scripts/anatomy/vendor/LICENSE). Nothing here projects by itself: every point goes through the
// vendored iso()/pathOf(), so the kit and anatomy heroes share one camera (integration R2/K12).
//
// A piece is one DOM part (<g data-vpk-iso-part>). Most parts are one piece with one solid; a tray
// is two pieces (<id>:back painted early, <id>:front painted late) of several solids each.
//   piece = { id, of?, kind, depthPoint: [x, y, z], solids: Solid[], marks: string[], bottom, top }
//   Solid = { fill, top?, shade?, edge, crease? }   (path strings; fill uses only M/L/Z)

import {
	circleRing,
	cylinder,
	depthOf,
	iso,
	lineOnTop,
	pathOf,
	planOutline,
	ring as ringPath,
	ringOf,
	slabOf,
} from "../anatomy/vendor/kit/iso-kit.mjs";
import { hull } from "./core.mjs";
import { SHADOW } from "./accent.mjs";

const joined = paths => paths.filter(Boolean).join("");

// Merge the vendored extrude() shade buckets: 2–3 are the light side, which the fill hull already
// paints, so they are dropped; 0–1 become one shade path. Every side face is a plain flat face (no hatch).
export function toneBuckets(extruded) {
	return joined((extruded.shades ?? []).slice(0, 2));
}

function solidOf(extruded, { shading }) {
	return {
		fill: extruded.fill,
		top: extruded.top,
		shade: shading ? toneBuckets(extruded) || null : null,
		edge: extruded.outline,
		crease: joined([extruded.crease, extruded.bevel]) || null,
	};
}

const planOf = (part, r) => ({ x: part.at[0], y: part.at[1], w: part.size[0], d: part.size[1], r });

// Disc on the plane z (the Done-flash ring). Flat: fill and edge only; `filled` false (the kit's style) keeps the edge
// alone, so the ring reads as a stroked arc (its hit polygon and window clip still come from the edge).
export function discFor(part, P, steps = 64, filled = true) {
	const [cx, cy, z] = part.at;
	const d = ringPath(cx, cy, part.size[0], z, P, steps);
	return { fill: filled ? d : null, top: null, shade: null, edge: d, crease: null };
}

// A clipped ring's window when `clipPad` grows its target: the padded plan outline on the ring's own plane.
export function clipWindowPath(part, window, P) {
	if (window.kind === "cylinder" || window.kind === "ring") return ringPath(window.at[0], window.at[1], window.size[0], part.at[2], P, 48);
	return planOutline({ x: window.at[0], y: window.at[1], w: window.size[0], d: window.size[1], r: 0 }, part.at[2], P);
}

// Reserved empty outline (a landing gap): stroke only; its hit polygon is the outline.
export function gapOutline(part, P, r) {
	return { fill: null, top: null, shade: null, edge: planOutline(planOf(part, r), part.at[2], P), crease: null };
}

// A tray split for painter order: floor + far walls (back) and near walls (front). At azimuth 45
// the viewer looks toward +x/+y, so the far walls sit at min x / min y.
const trayWall = (w, d) => Math.min(4, Math.max(1.2, Math.min(w, d) * 0.08));
export function traySplit(part, P, { r, bevel, shading }) {
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	const t = trayWall(w, d);
	const slab = (plan, z0, height, radius = 0) => solidOf(slabOf({ ...plan, r: radius }, z0, height, P, 8, 0), { shading });
	const back = [
		slab({ x, y, w, d }, z, t, r),
		slab({ x, y, w, d: t }, z, h),
		slab({ x, y, w: t, d }, z, h),
	];
	const front = [
		slab({ x: x + w - t, y, w: t, d }, z, h),
		slab({ x, y: y + d - t, w, d: t }, z, h),
	];
	if (bevel > 0) back[0] = solidOf(slabOf({ x, y, w, d, r }, z, t, P, 8, bevel), { shading });
	return {
		back: { solids: back, depthPoint: [x, y, z], top: z + h },
		front: { solids: front, depthPoint: [x + w, y + d, z + h], top: z + h },
		wall: t,
	};
}

// Top-face marks in part-local u,v (lineOnTop on the part's top plane).
function marksFor(part, zTop, P) {
	return (part.marks ?? []).map(([[u0, v0], [u1, v1]]) => lineOnTop([part.at[0] + u0, part.at[1] + v0], [part.at[0] + u1, part.at[1] + v1], zTop, P));
}

// One brief part → one or two pieces.
export function solidFor(part, P, style) {
	const shading = style.shading;
	const r = part.r ?? style.radius;
	const bevel = part.bevel ?? style.bevel;
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	const base = { of: undefined, kind: part.kind, marks: [] };
	switch (part.kind) {
		case "slab":
		case "plate":
		case "box": {
			const solid = solidOf(slabOf(planOf(part, r), z, h, P, 8, bevel), { shading });
			return [{ ...base, id: part.id, solids: [solid], marks: marksFor(part, z + h, P), depthPoint: [x + w / 2, y + d / 2, z + h / 2], bottom: z, top: z + h }];
		}
		case "cylinder": {
			const solid = solidOf(cylinder(x, y, w, z, h, P, 32, bevel), { shading });
			return [{ ...base, id: part.id, solids: [solid], marks: marksFor(part, z + h, P), depthPoint: [x, y, z + h / 2], bottom: z, top: z + h }];
		}
		case "ring":
			return [{ ...base, id: part.id, solids: [discFor(part, P, 64, style.ringFill !== false)], depthPoint: [x, y, z], bottom: z, top: z }];
		case "gap":
			return [{ ...base, id: part.id, solids: [gapOutline(part, P, r)], depthPoint: [x + w / 2, y + d / 2, z], bottom: z, top: z }];
		case "tray": {
			const split = traySplit(part, P, { r, bevel, shading });
			return [
				{ ...base, id: `${part.id}:back`, of: part.id, solids: split.back.solids, marks: marksFor(part, z + split.wall, P), depthPoint: split.back.depthPoint, bottom: z, top: z + h },
				{ ...base, id: `${part.id}:front`, of: part.id, solids: split.front.solids, depthPoint: split.front.depthPoint, bottom: z, top: z + h },
			];
		}
		default:
			throw new RangeError(`unknown part kind ${JSON.stringify(part.kind)}`);
	}
}

export const depthKey = (piece, P) => depthOf(piece.depthPoint, P);

// The plan ring of a part's footprint (for guides): rounded plan, circle, or the ring itself.
function footprint(part, r) {
	if (part.kind === "cylinder" || part.kind === "ring") return circleRing(part.at[0], part.at[1], part.size[0], 32);
	return ringOf(planOf(part, r), 8);
}

// The part's two extreme base corners: min and max projected x of its bottom ring (plan points).
export function guideCorners(part, P, r) {
	const z0 = part.at[2];
	const ringPoints = footprint(part, r);
	const sx = ([px, py]) => iso([px, py, z0], P)[0];
	let lo = ringPoints[0];
	let hi = ringPoints[0];
	for (const point of ringPoints) {
		if (sx(point) < sx(lo)) lo = point;
		if (sx(point) > sx(hi)) hi = point;
	}
	return [lo, hi];
}

// Explode guide segments: from each plan corner at the part's base (z0) straight down in world z to
// z1, the top of the part below that corner. Returns null when the gap is under one world unit.
export function guideSegments(corners, z0, z1, P) {
	if (z0 - z1 < 1 || !corners.length) return null;
	const ends = corners.map(([px, py]) => ({ from: iso([px, py, z0], P), to: iso([px, py, z1], P) }));
	return { d: ends.map(({ from, to }) => pathOf([from, to])).join(""), ends };
}

// Cast shadows (iso/accent.mjs SHADOW). The ground vector is how far, in world x and y, a point's shadow moves per world unit of
// height above the ground: away from the light, 1 / tan(elevation) long. Light at azimuth 190 / elevation 45 puts it down and
// to the right on screen at the dimetric camera, as long as the part is high.
export function shadowStep(light = SHADOW) {
	const a = (light.LIGHT_AZIMUTH * Math.PI) / 180;
	const k = 1 / Math.tan((light.LIGHT_ELEVATION * Math.PI) / 180);
	return [-Math.cos(a) * k, -Math.sin(a) * k];
}

// The parts that cast a shadow: every kind with faces. A gap (a dashed outline) and a ring (a stroked arc) are line work.
export const castsShadow = part => !["gap", "ring"].includes(part.kind);

// The world ground displacement of a shadow when its part moves by `move` ([x, y, z]): the plan move plus the lift along the light.
export const shadowMove = ([x, y, z], step = shadowStep()) => [x + z * step[0], y + z * step[1], 0];

// The top face a part offers to shadows from layers above it: its plan at its top, or a tray's floor inside its walls (the
// walls stand on the floor's edge, so a shadow clipped to the inner floor never paints over them). Null for line work.
export function receivingTop(part, r = 0) {
	if (!castsShadow(part)) return null;
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	if (part.kind !== "tray") return { z: z + h, ring: footprint(part, r) };
	const t = trayWall(w, d);
	return { z: z + t, ring: ringOf({ x: x + t, y: y + t, w: w - 2 * t, d: d - 2 * t, r: Math.max(0, r - t) }, 8) };
}

// A part's shadow on the ground plane z = `ground`: its plan outline at its bottom and at its top, each pushed along the light by
// its height above the ground, and the convex hull of the two projected (the shadow of a convex prism). A screen polygon.
export function castShadow(part, P, { ground = 0, r = 0, step = shadowStep() } = {}) {
	const [z0, z1] = [part.at[2], part.at[2] + part.size[2]];
	const ring = footprint(part, r);
	const points = [z0, z1].flatMap(z => ring.map(([x, y]) => iso([x + (z - ground) * step[0], y + (z - ground) * step[1], ground], P)));
	return hull(points);
}
