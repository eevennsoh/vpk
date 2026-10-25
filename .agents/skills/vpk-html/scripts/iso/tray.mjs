// iso/tray — open containers (plan § 2 O): a tray is a box with one face open. `axis` names the opening: "+z" (default, the
// legacy floor tray), "-z", or a side ("+x", "-x", "+y", "-y") for a carcass, a cubby or a drawer seen through its open front. The
// camera at azimuth 45 looks toward −x/−y from the +x/+y side, so a side opening the reader can look into is "+x" or "+y".
// `dividers: { x: [u, …], y: [v, …], z: [w, …] }` adds thin internal walls at those offsets from `at` (u along x, v along y,
// w up z): x dividers run the full inner height and depth, y dividers sit between them, z dividers (shelves) between both, so no
// two walls cross.
//
// Painter order: the walls on the far side of the contents (each min-side wall: the floor at z0, the walls at x0 and y0) form
// `<id>:back`, painted before the contents; the near walls (x1, y1 and a roof at z1) form `<id>:front`, painted after them; every
// divider is its own piece `<id>:div-<axis><k>` (with `of`), so the vendored depth audit can slot it between the cubbies it
// separates. A "+z" tray without dividers keeps the legacy traySplit drawing byte for byte (solids.mjs).
// Built on the vendored slabOf() and the vendored box shapes (MIT © 2026 Ryan, scripts/anatomy/vendor/LICENSE).

import { ringOf, slabOf } from "../anatomy/vendor/kit/iso-kit.mjs";
import * as A from "../anatomy/vendor/kit/audit.mjs";
import { trayWall } from "./geometry.mjs";

export const TRAY_OPENINGS = Object.freeze(["+z", "-z", "+x", "-x", "+y", "-y"]);
const ALIASES = Object.freeze({ x: "+x", y: "+y", z: "+z" });
export const trayOpening = part => ALIASES[part.axis] ?? part.axis ?? "+z";
// A tray that needs the general builder: an opening other than +z, or dividers.
export const isOpenTray = part => part.kind === "tray" && (trayOpening(part) !== "+z" || Boolean(part.dividers));

// The wall thickness: the legacy rule on the two sides of the opening.
export function wallOf(part) {
	const [w, d, h] = part.size;
	const opening = trayOpening(part)[1];
	return opening === "z" ? trayWall(w, d) : opening === "x" ? trayWall(d, h) : trayWall(w, h);
}

// The tray's walls as axis-aligned boxes { min, max, side } (side: "back" | "front"), and its dividers { min, max, name }.
export function trayBoxes(part) {
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	const t = wallOf(part);
	const lo = [x, y, z];
	const hi = [x + w, y + d, z + h];
	const open = trayOpening(part);
	const walls = [];
	// Back: the floor first, then the y0 and x0 walls (the legacy order); front: x1, y1, then the roof (it caps the near walls).
	for (const [axis, sign, side] of [[2, -1, "back"], [1, -1, "back"], [0, -1, "back"], [0, 1, "front"], [1, 1, "front"], [2, 1, "front"]]) {
		if (open === `${sign > 0 ? "+" : "-"}${"xyz"[axis]}`) continue;
		const min = [...lo];
		const max = [...hi];
		if (sign < 0) max[axis] = lo[axis] + t;
		else min[axis] = hi[axis] - t;
		walls.push({ min, max, side, axis });
	}
	// The inner cavity (between the walls that exist).
	const inner = [lo.map((v, i) => (walls.some(wall => wall.axis === i && wall.side === "back") ? v + t : v)), hi.map((v, i) => (walls.some(wall => wall.axis === i && wall.side === "front") ? v - t : v))];
	const dividers = [];
	const cuts = axis => [...(part.dividers?.["xyz"[axis]] ?? [])].map(offset => lo[axis] + offset).sort((a, b) => a - b);
	const spans = (axis, list) => {
		const edges = [inner[0][axis], ...list.flatMap(c => [c - t / 2, c + t / 2]), inner[1][axis]];
		const out = [];
		for (let i = 0; i < edges.length; i += 2) out.push([edges[i], edges[i + 1]]);
		return out;
	};
	const xs = cuts(0);
	const ys = cuts(1);
	const zs = cuts(2);
	xs.forEach((c, k) => dividers.push({ min: [c - t / 2, inner[0][1], inner[0][2]], max: [c + t / 2, inner[1][1], inner[1][2]], name: `div-x${k}` }));
	ys.forEach((c, k) => spans(0, xs).forEach(([a, b], j) => dividers.push({ min: [a, c - t / 2, inner[0][2]], max: [b, c + t / 2, inner[1][2]], name: `div-y${k}${xs.length ? `-${j}` : ""}` })));
	zs.forEach((c, k) => spans(0, xs).forEach(([a, b], i) => spans(1, ys).forEach(([e, f], j) => dividers.push({ min: [a, e, c - t / 2], max: [b, f, c + t / 2], name: `div-z${k}${xs.length || ys.length ? `-${i}-${j}` : ""}` }))));
	return { walls, dividers, inner, wall: t };
}

const slabFor = ({ min, max }, P, radius, bevel = 0) => slabOf({ x: min[0], y: min[1], w: max[0] - min[0], d: max[1] - min[1], r: radius }, min[2], max[2] - min[2], P, 8, bevel);
const planOf = ({ min, max }) => [min[0], min[1], max[0], max[1]];

// The pieces of an open tray (solidOf is solids.mjs's face mapping, passed in to avoid an import cycle).
export function openTrayPieces(part, P, { r, bevel, shading }, solidOf) {
	const { walls, dividers } = trayBoxes(part);
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	// Only a floor or roof (a horizontal wall) takes the part's corner radius and bevel; side walls are square.
	const solid = box => solidOf(slabFor(box, P, box.axis === 2 ? r : 0, box.axis === 2 ? bevel : 0), { shading });
	const piece = (id, boxes, depthPoint) => ({ id, of: part.id, kind: "tray", plan: boxes.map(planOf), solids: boxes.map(solid), shapes: boxes.map(box => A.box(box.min, box.max)), depthPoint, bottom: z, top: z + h });
	const back = walls.filter(wall => wall.side === "back");
	const front = walls.filter(wall => wall.side === "front");
	const pieces = [];
	if (back.length) pieces.push(piece(`${part.id}:back`, back, [x, y, z]));
	for (const divider of dividers) pieces.push(piece(`${part.id}:${divider.name}`, [divider], divider.min.map((v, i) => (v + divider.max[i]) / 2)));
	if (front.length) pieces.push(piece(`${part.id}:front`, front, [x + w, y + d, z + h]));
	return pieces;
}

// The top face an open tray offers to shadows: its roof when it has one (a side-open carcass), else its floor inside the walls.
// `piece` and `solid` name where that face is drawn (the roof is the last solid of the front piece).
export function openTrayTop(part, r) {
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	const open = trayOpening(part);
	if (open !== "+z") {
		const front = trayBoxes(part).walls.filter(wall => wall.side === "front");
		return { z: z + h, ring: ringOf({ x, y, w, d, r }, 8), piece: "front", solid: front.length - 1 };
	}
	const t = wallOf(part);
	return { z: z + t, ring: ringOf({ x: x + t, y: y + t, w: w - 2 * t, d: d - 2 * t, r: Math.max(0, r - t) }, 8), piece: "back", solid: 0 };
}
