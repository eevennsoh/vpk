// iso/solids — part geometry for the iso kit, built on the vendored anatomy kit (MIT © 2026 Ryan,
// scripts/anatomy/vendor/LICENSE). Nothing here projects by itself: every point goes through the
// vendored iso()/pathOf(), so the kit and anatomy heroes share one camera (integration R2/K12).
//
// A piece is one DOM part (<g data-vpk-iso-part>). Most parts are one piece with one solid; a tray
// is two pieces (<id>:back painted early, <id>:front painted late) of several solids each.
//   piece = { id, of?, kind, depthPoint: [x, y, z], plan: [x0, y0, x1, y1][], solids: Solid[], detail, shapes, bottom, top }
// `detail` is the part's detail.mjs buckets (on its first piece); `shapes` are the vendored signed-distance shapes painter.mjs
// orders the piece by. New kinds (lathe, tube, sphere, ...) come from kinds.mjs.
// `plan` is the piece's footprint as plan boxes (a tray's front is its two near walls); the select lift re-sorts only pieces
// whose footprints overlap, because a part that rises straight up stays behind every part in front of it in plan.
//   Solid = { fill, top?, shade?, edge, crease? }   (path strings; fill uses only M/L/Z)

import {
	cylinder,
	depthOf,
	iso,
	pathOf,
	planOutline,
	ring as ringPath,
	ringOf,
	slabOf,
} from "../anatomy/vendor/kit/iso-kit.mjs";
import * as A from "../anatomy/vendor/kit/audit.mjs";
import { hull } from "./core.mjs";
import { SHADOW } from "./accent.mjs";
import { detailFor } from "./detail.mjs";
import { bodyShadows, boundsOf, castsShadow, flatPrism, footprint, isLegacy, trayWall } from "./geometry.mjs";
import { newKindPieces } from "./kinds.mjs";
import { isOpenTray, openTrayPieces, openTrayTop, trayOpening, wallOf } from "./tray.mjs";

export { castsShadow };

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
		back: { solids: back, depthPoint: [x, y, z], plan: [[x, y, x + w, y + d]], top: z + h },
		front: { solids: front, depthPoint: [x + w, y + d, z + h], plan: [[x + w - t, y, x + w, y + d], [x, y + d - t, x + w, y + d]], top: z + h },
		wall: t,
	};
}

// The vendored signed-distance shapes of a legacy piece (painter.mjs): boxes for slabs and tray walls, a disc for a cylinder.
const boxShape = (x, y, z, w, d, h) => A.box([x, y, z], [x + w, y + d, z + h]);
function legacyShapes(part, half) {
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	if (part.kind === "cylinder") return [A.cylinder(x, y, w, z, h)];
	if (part.kind !== "tray") return ["ring", "gap"].includes(part.kind) ? [] : [boxShape(x, y, z, w, d, h)];
	const t = trayWall(w, d);
	if (half === "back") return [boxShape(x, y, z, w, d, t), boxShape(x, y, z, w, t, h), boxShape(x, y, z, t, d, h)];
	return [boxShape(x + w - t, y, z, t, d, h), boxShape(x, y + d - t, z, w, t, h)];
}

// One brief part → one or more pieces; its detail rides on the first.
export function solidFor(part, P, style) {
	const pieces = isLegacy(part) ? legacyPieces(part, P, style) : newKindPieces(part, P, style);
	const detail = detailFor(part, P);
	if (detail) pieces[0].detail = detail;
	for (const piece of pieces) if (piece.rings) piece.detail = { ...(piece.detail ?? emptyDetail()), mark: [...(piece.detail?.mark ?? []), piece.rings] };
	return pieces;
}

const emptyDetail = () => ({ mark: [], dash: [], hatch: [], dot: [], recess: [], text: [], skipped: [] });

function legacyPieces(part, P, style) {
	const shading = style.shading;
	const r = part.r ?? style.radius;
	const bevel = part.bevel ?? style.bevel;
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	const box = part.kind === "cylinder" || part.kind === "ring" ? [x - w, y - w, x + w, y + w] : [x, y, x + w, y + d];
	const base = { of: undefined, kind: part.kind, plan: [box], shapes: legacyShapes(part) };
	switch (part.kind) {
		case "slab":
		case "plate":
		case "box": {
			const solid = solidOf(slabOf(planOf(part, r), z, h, P, 8, bevel), { shading });
			return [{ ...base, id: part.id, solids: [solid], depthPoint: [x + w / 2, y + d / 2, z + h / 2], bottom: z, top: z + h }];
		}
		case "cylinder": {
			const solid = solidOf(cylinder(x, y, w, z, h, P, 32, bevel), { shading });
			return [{ ...base, id: part.id, solids: [solid], depthPoint: [x, y, z + h / 2], bottom: z, top: z + h }];
		}
		case "ring":
			return [{ ...base, id: part.id, solids: [discFor(part, P, 64, style.ringFill !== false)], depthPoint: [x, y, z], bottom: z, top: z }];
		case "gap":
			return [{ ...base, id: part.id, solids: [gapOutline(part, P, r)], depthPoint: [x + w / 2, y + d / 2, z], bottom: z, top: z }];
		case "tray": {
			if (isOpenTray(part)) return openTrayPieces(part, P, { r, bevel, shading }, solidOf);
			const split = traySplit(part, P, { r, bevel, shading });
			return [
				{ ...base, id: `${part.id}:back`, of: part.id, plan: split.back.plan, solids: split.back.solids, shapes: legacyShapes(part, "back"), depthPoint: split.back.depthPoint, bottom: z, top: z + h },
				{ ...base, id: `${part.id}:front`, of: part.id, plan: split.front.plan, solids: split.front.solids, shapes: legacyShapes(part, "front"), depthPoint: split.front.depthPoint, bottom: z, top: z + h },
			];
		}
		default:
			throw new RangeError(`unknown part kind ${JSON.stringify(part.kind)}`);
	}
}

export const depthKey = (piece, P) => depthOf(piece.depthPoint, P);

// The part's two extreme base corners: min and max projected x of its bottom ring (plan points).
// A new kind has no flat base ring: its plan-box corners float off a tilted lathe or a ball, so its guides start from the two
// samples on the solid with the least and greatest screen x (the silhouette's sides), as [x, y, z] (guideSegments drops each
// from its own z).
export function guideCorners(part, P, r) {
	if (!isLegacy(part)) {
		const sx = point => iso(point, P)[0];
		const samples = boundsOf(part).samples3;
		return [samples.reduce((a, b) => (sx(b) < sx(a) ? b : a)), samples.reduce((a, b) => (sx(b) > sx(a) ? b : a))];
	}
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
// z1, the top of the part below that corner (a corner given as [x, y, z] drops from its own z). Returns null when the gap is
// under one world unit.
export function guideSegments(corners, z0, z1, P) {
	if (z0 - z1 < 1 || !corners.length) return null;
	const ends = corners.map(([px, py, pz = z0]) => ({ from: iso([px, py, pz], P), to: iso([px, py, z1], P) }));
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

// The parts that cast a shadow (geometry.mjs castsShadow): every kind with faces. A gap, a flat ring and a wire are line work, and
// tubes thinner than 0.8 cast none.

// The world ground displacement of a shadow when its part moves by `move` ([x, y, z]): the plan move plus the lift along the light.
export const shadowMove = ([x, y, z], step = shadowStep()) => [x + z * step[0], y + z * step[1], 0];

// The top face a part offers to shadows from layers above it: its plan at its top, or a tray's floor inside its walls (the
// walls stand on the floor's edge, so a shadow clipped to the inner floor never paints over them), or an open-fronted tray's roof;
// an upright convex prism (a turned box) its top polygon. `piece` names the piece suffix the face is drawn in. Null for line work.
export function receivingTop(part, r = 0) {
	if (!castsShadow(part)) return null;
	if (!isLegacy(part)) {
		const flat = flatPrism(part);
		return flat ? { z: flat.z, ring: flat.ring } : null;
	}
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	if (part.kind !== "tray") return { z: z + h, ring: footprint(part, r) };
	if (isOpenTray(part)) return openTrayTop(part, r);
	const t = trayWall(w, d);
	return { z: z + t, ring: ringOf({ x: x + t, y: y + t, w: w - 2 * t, d: d - 2 * t, r: Math.max(0, r - t) }, 8), piece: "back" };
}

// The heights a part may support another part at (explode vectors and guides): its receiving top, and a tray's floor too (the
// contents of an open-fronted cubby stand on its floor, under its roof).
export function supportZs(part) {
	const top = receivingTop(part, 0);
	const out = top ? [top.z] : [];
	if (part.kind === "tray" && isOpenTray(part) && trayOpening(part) !== "-z") out.push(part.at[2] + wallOf(part));
	return out;
}

// A part's shadow on the ground plane z = `ground`: its plan outline at its bottom and at its top, each pushed along the light by
// its height above the ground, and the convex hull of the two projected (the shadow of a convex prism). A screen polygon.
export function castShadow(part, P, { ground = 0, r = 0, step = shadowStep() } = {}) {
	if (!isLegacy(part)) return hull(castShadows(part, P, { ground, r, step }).flat());
	const [z0, z1] = [part.at[2], part.at[2] + part.size[2]];
	const ring = footprint(part, r);
	const points = [z0, z1].flatMap(z => ring.map(([x, y]) => iso([x + (z - ground) * step[0], y + (z - ground) * step[1], ground], P)));
	return hull(points);
}

// Every shadow polygon of a part: the legacy part's one hull, or a new kind's sample hulls (a long tube casts one per run).
export function castShadows(part, P, { ground = 0, r = 0, step = shadowStep() } = {}) {
	if (isLegacy(part)) return [castShadow(part, P, { ground, r, step })];
	return bodyShadows(part, P, { ground, step });
}
