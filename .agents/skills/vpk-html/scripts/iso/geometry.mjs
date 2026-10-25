// iso/geometry — one generic geometry model for every part kind (plan § 2 L, U, S): the primitive bodies a part is made of
// (lathe meridians, tube centrelines, balls, lines), and boundsOf(part) → { min, max, samples3, plan, bottom, top, centre }, which
// replaces the per-kind branches the scene used for the camera fit, supports, guides, anchors and shadows. The legacy kinds keep
// their exact old corners, so an old brief fits, sorts and shadows as before. Built on the vendored anatomy kit (MIT © 2026 Ryan,
// scripts/anatomy/vendor/LICENSE); nothing here projects except through the vendored iso().

import { circleRing, iso, ringOf, roundedPlan } from "../anatomy/vendor/kit/iso-kit.mjs";
import { add3, cross3, cut as cutPath, dot3, fillet, frameAlong, len3, mul3, pathLength, pointOf, sub3, unit3 } from "../anatomy/vendor/kit/lathe.mjs";
import { hull, pointInPolygon } from "./core.mjs";
import { ISO_PRESET } from "./palette.mjs";
import { convexParts, normalizePolygon, roundPolygon } from "./polygon.mjs";

export const LEGACY_KINDS = Object.freeze(["slab", "box", "plate", "cylinder", "tray", "ring", "gap"]);
export const NEW_KINDS = Object.freeze(["lathe", "cone", "torus", "tube", "rod", "leg", "spring", "catenary", "wire", "sphere", "pin", "prism"]);
export const BOX_KINDS = Object.freeze(["slab", "box", "plate"]);
// Kinds drawn from one tube centreline (chunked into pieces with `of` for painter order).
export const TUBE_KINDS = Object.freeze(["tube", "rod", "spring", "catenary", "torus"]);
const AXES = Object.freeze({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], "+x": [1, 0, 0], "+y": [0, 1, 0], "+z": [0, 0, 1], "-x": [-1, 0, 0], "-y": [0, -1, 0], "-z": [0, 0, -1] });
const TAU = Math.PI * 2;

export const axisVector = axis => (Array.isArray(axis) ? axis : AXES[axis ?? "z"] ?? null);
export const isZAxis = axis => {
	const a = axisVector(axis);
	return Boolean(a) && Math.abs(a[0]) < 1e-9 && Math.abs(a[1]) < 1e-9 && a[2] > 0;
};

// The lathe frame at `at` along `axis`; `up` fixes where angle 0 points. Along +z the frame is u = +x, v = +y (the legacy
// cylinder's), so detail angles read the same on an upright cylinder and an upright lathe.
export function frameFor(at, axis = "z", up = null) {
	const a = unit3(axisVector(axis));
	if (up) {
		const u = unit3(sub3(up, mul3(a, dot3(up, a))));
		return { o: at, a, u, v: cross3(a, u) };
	}
	if (Math.abs(a[0]) < 1e-9 && Math.abs(a[1]) < 1e-9) return { o: at, a, u: [1, 0, 0], v: cross3(a, [1, 0, 0]) };
	return frameAlong(at, a);
}

// The legacy tray wall (solids.mjs traySplit and the tray's floor detail share it).
export const trayWall = (w, d) => Math.min(4, Math.max(1.2, Math.min(w, d) * 0.08));

// --- prisms and turned boxes (plan § 2 P, R) ---
// A prism's frame: the polygon lies in (u, v) and is extruded along a, from s = 0 to its depth. v is `up` made perpendicular to the
// axis (default world z, or world y for a vertical axis) and u = v × a, so an axis-z prism draws its polygon in plan (u = x, v = y)
// and an axis "-y" prism draws it upright, u along +x. `yaw` (degrees about world z) turns the frame about `pivot` last.
const turnZ = ([x, y, z], deg) => {
	const c = Math.cos((deg * Math.PI) / 180);
	const s = Math.sin((deg * Math.PI) / 180);
	return [x * c - y * s, x * s + y * c, z];
};
function turnFrame(F, deg, pivot) {
	if (!deg) return F;
	return { o: add3(pivot, turnZ(sub3(F.o, pivot), deg)), a: turnZ(F.a, deg), u: turnZ(F.u, deg), v: turnZ(F.v, deg) };
}
export function prismFrame(at, axis = "z", up = null, yaw = 0, pivot = at) {
	const a = unit3(axisVector(axis ?? "z"));
	const upv = up ?? (Math.abs(a[2]) > 0.999 ? [0, 1, 0] : [0, 0, 1]);
	const v = unit3(sub3(upv, mul3(a, dot3(upv, a))));
	return turnFrame({ o: at, a, u: cross3(v, a), v }, yaw, pivot);
}

// A box, slab or plate is drawn as a prism when it turns (yaw, an axis other than +z, an up) or is glass (whose hidden edges the
// prism path draws dashed). Yaw 0 and no axis keep the legacy drawing byte for byte.
export const isTurnedBox = part => BOX_KINDS.includes(part.kind) && (Boolean(part.yaw && part.yaw % 360) || (part.axis !== undefined && !(isZAxis(part.axis) && !part.up)) || part.tone === "glass");

// A turned box's frame: size [w, d, h] runs w along u, d along v and h along the axis from `at` (an axis-z box keeps u = x, v = y,
// so `at` is still its min corner); yaw turns it about its own centre.
export function boxFrame(part) {
	const [w, d, h] = part.size;
	const F = part.axis === undefined || (isZAxis(part.axis) && !part.up) ? { o: part.at, a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] } : prismFrame(part.at, part.axis, part.up);
	const centre = add3(add3(add3(F.o, mul3(F.u, w / 2)), mul3(F.v, d / 2)), mul3(F.a, h / 2));
	return turnFrame(F, part.yaw ?? 0, centre);
}

// The world point of polygon point [x, y] at s along a prism frame.
export const prismPoint = (F, s, [x, y]) => add3(add3(add3(F.o, mul3(F.a, s)), mul3(F.u, x)), mul3(F.v, y));

// Kinds that turn about world z through `yaw` (a polar repeat's `face`, a state's rotate about z).
export const YAW_KINDS = Object.freeze([...BOX_KINDS, "prism"]);
// The part turned `deg` degrees about the vertical line through `about` ([x, y]): a rigid turn, baked into `at` and `yaw`. A prism
// yaws about its `at`; a box about its centre, so its `at` moves by how far its centre turns.
export function yawPart(part, about, deg) {
	if (!deg) return part;
	const round = v => Math.round(v * 1e9) / 1e9;
	const turnAbout = p => {
		const q = turnZ([p[0] - about[0], p[1] - about[1], p[2]], deg);
		return [q[0] + about[0], q[1] + about[1], q[2]];
	};
	const pivot = part.kind === "prism" ? part.at : (() => {
		const [w, d, h] = part.size;
		const F = boxFrame({ ...part, yaw: 0 });
		return add3(add3(add3(F.o, mul3(F.u, w / 2)), mul3(F.v, d / 2)), mul3(F.a, h / 2));
	})();
	const moved = sub3(turnAbout(pivot), pivot);
	return { ...part, at: add3(part.at, moved).map(round), yaw: round((part.yaw ?? 0) + deg) };
}

function prismBody(F, polygon, depth) {
	const ring = normalizePolygon(polygon);
	return { type: "prism", F, ring, depth, parts: convexParts(ring), vertical: Math.abs(F.a[2]) > 0.999 };
}

const closedMeridian = profile => [[profile[0][0], 0], ...profile.map(point => [...point]), [profile.at(-1)[0], 0]];
const disc = (s0, s1, r) => [[s0, 0], [s0, r], [s1, r], [s1, 0]];

function helix(from, to, radius, turns) {
	const axis = sub3(to, from);
	const F = frameAlong(from, axis);
	const length = len3(axis);
	const n = Math.max(8, Math.ceil(turns * 24));
	return Array.from({ length: n + 1 }, (_, i) => pointOf(F, (length * i) / n, radius, (i / n) * turns * TAU));
}

// A rope hanging between two points: a parabola sagging `sag` world units below the chord at mid-span.
export function catenaryPoints(from, to, sag = 0, samples = 24) {
	return Array.from({ length: samples + 1 }, (_, i) => {
		const t = i / samples;
		const p = add3(from, mul3(sub3(to, from), t));
		return [p[0], p[1], p[2] - sag * 4 * t * (1 - t)];
	});
}

const memo = new WeakMap();

// The primitive bodies of a part, or null for a legacy kind drawn by the legacy path:
//   { type: "lathe", F, meridian, closed, hole }     hole: [s, r] | "auto" (the cap facing the viewer) | null
//   { type: "tube", points, radius, closed, caps, corrugate }
//   { type: "ball", centre, r }
//   { type: "line", points }
export function bodiesOf(part) {
	if (memo.has(part)) return memo.get(part);
	const bodies = buildBodies(part);
	memo.set(part, bodies);
	return bodies;
}

function buildBodies(part) {
	const at = part.at;
	if (isTurnedBox(part)) {
		const [w, d, h] = part.size;
		return [prismBody(boxFrame(part), roundedPlan({ x: 0, y: 0, w, d, r: part.r ?? ISO_PRESET.radius }, 8), h)];
	}
	switch (part.kind) {
		case "prism":
			return [prismBody(prismFrame(at, part.axis, part.up, part.yaw ?? 0), roundPolygon(normalizePolygon(part.polygon), part.round ?? 0), part.depth)];
		case "cylinder":
			if (part.axis === undefined || (isZAxis(part.axis) && !part.up)) return null;
			return [{ type: "lathe", F: frameFor(at, part.axis, part.up), meridian: disc(0, part.size[2], part.size[0]), closed: true, hole: null }];
		case "ring": {
			if (!part.thickness) return null;
			const rOut = part.size[0];
			const rIn = part.inner ?? rOut * 0.6;
			return [{ type: "lathe", F: frameFor(at, part.axis, part.up), meridian: [[0, rIn], [0, rOut], [part.thickness, rOut], [part.thickness, rIn]], closed: true, hole: "auto", rIn }];
		}
		case "lathe": {
			const closed = part.closed !== false;
			return [{ type: "lathe", F: frameFor(at, part.axis, part.up), meridian: closed ? closedMeridian(part.profile) : part.profile.map(point => [...point]), closed, hole: part.hole ?? null }];
		}
		case "cone":
			return [{ type: "lathe", F: frameFor(at, part.axis, part.up), meridian: closedMeridian([[0, part.r0], [part.length, part.r1]]), closed: true, hole: null }];
		case "torus": {
			const F = frameFor(at, part.axis, part.up);
			const points = Array.from({ length: 64 }, (_, i) => pointOf(F, 0, part.R, (i / 64) * TAU));
			return [{ type: "tube", points, radius: part.r, closed: true, caps: false, corrugate: null, spacing: Math.min(2.2, Math.max(0.3, (TAU * part.R) / 48)) }];
		}
		case "tube": {
			const points = part.fillet ? fillet(part.points, part.fillet) : part.points.map(point => [...point]);
			return [{ type: "tube", points, radius: part.radius, closed: Boolean(part.closed), caps: part.caps !== false, corrugate: part.corrugate ?? null }];
		}
		case "rod":
			return [{ type: "tube", points: [part.from, part.to], radius: part.radius, closed: false, caps: part.caps !== false, corrugate: null }];
		case "leg": {
			const [x, y, z] = at;
			const ground = part.ground ?? 0;
			const foot = part.foot ?? null;
			const base = foot ? ground + foot.h : ground;
			const bodies = [];
			if (foot) bodies.push({ type: "lathe", F: frameFor([x, y, ground], "z"), meridian: disc(0, foot.h, foot.r), closed: true, hole: null });
			bodies.push({ type: "tube", points: [[x, y, z], [x, y, base]], radius: part.radius, closed: false, caps: [false, true], corrugate: null });
			return bodies;
		}
		case "spring":
			// A coil resamples along its arc (2πR / 24 per sample), not the kit's 2.2 default, or each turn draws as an octagon.
			return [{ type: "tube", points: helix(part.from, part.to, part.radius, part.turns), radius: part.wire, closed: false, caps: true, corrugate: null, spacing: Math.max(0.2, (TAU * part.radius) / 24) }];
		case "catenary":
			return [{ type: "tube", points: catenaryPoints(part.from, part.to, part.sag ?? 0), radius: part.radius, closed: false, caps: true, corrugate: null }];
		case "wire":
			return [{ type: "line", points: part.points ? part.points.map(point => [...point]) : catenaryPoints(part.from, part.to, part.sag ?? 0, part.sag ? 24 : 1) }];
		case "sphere":
			return [{ type: "ball", centre: at, r: part.r }];
		case "pin": {
			const F = frameFor(at, part.axis ?? "z", part.up);
			const top = add3(at, mul3(F.a, part.length));
			return [{ type: "tube", points: [at, top], radius: part.r, closed: false, caps: [true, false], corrugate: null }, { type: "ball", centre: top, r: part.head }];
		}
		default:
			return null;
	}
}

export const isLegacy = part => bodiesOf(part) === null;

// The lathe-like kinds (one lathe body with an axis frame): cylinder with an axis, lathe, cone, ring with thickness.
export function latheOf(part) {
	if (part.kind === "cylinder" && isLegacy(part)) {
		const [x, y, z] = part.at;
		return { F: { o: [x, y, z], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, profile: [[0, part.size[0]], [part.size[2], part.size[0]]] };
	}
	const bodies = bodiesOf(part);
	if (!bodies || bodies.length !== 1 || bodies[0].type !== "lathe") return null;
	const meridian = bodies[0].meridian;
	const side = meridian.filter(([, r], i) => !(r <= 1e-9 && (i === 0 || i === meridian.length - 1)));
	return { F: bodies[0].F, profile: side.length >= 2 ? side : meridian };
}

// Profile radius and slope at s (linear between profile points, clamped to its ends).
export function radiusAt(profile, s) {
	if (s <= profile[0][0]) return profile[0][1];
	for (let i = 1; i < profile.length; i++) {
		const [s0, r0] = profile[i - 1];
		const [s1, r1] = profile[i];
		if (s <= s1) return s1 - s0 < 1e-9 ? r1 : r0 + ((r1 - r0) * (s - s0)) / (s1 - s0);
	}
	return profile.at(-1)[1];
}
export const slopeAt = (profile, s) => (radiusAt(profile, s + 0.05) - radiusAt(profile, s - 0.05)) / 0.1;

const BALL_DIRS = (() => {
	const out = [];
	for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) out.push(unit3([x, y, z]));
	return out;
})();
const TUBE_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function bodySamples(body) {
	if (body.type === "lathe") return body.meridian.flatMap(([s, r]) => Array.from({ length: r > 1e-9 ? 16 : 1 }, (_, j) => pointOf(body.F, s, r, (j / 16) * TAU)));
	if (body.type === "tube") return body.points.flatMap(p => TUBE_DIRS.map(d => add3(p, mul3(d, body.radius))));
	if (body.type === "ball") return BALL_DIRS.map(d => add3(body.centre, mul3(d, body.r)));
	if (body.type === "prism") return [0, body.depth].flatMap(s => body.ring.map(point => prismPoint(body.F, s, point)));
	return body.points.map(point => [...point]);
}

function legacyCorners(part) {
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	if (part.kind === "cylinder" || part.kind === "ring") return [[x - w, y - w], [x + w, y - w], [x + w, y + w], [x - w, y + w]].flatMap(([px, py]) => [[px, py, z], [px, py, z + h]]);
	return [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].flatMap(([px, py]) => [[px, py, z], [px, py, z + h]]);
}

const boundsMemo = new WeakMap();

// The part's world bounds. samples3 are points on (or around) the solid: a legacy part's eight plan-box corners (the old
// partCorners, unchanged), sampled profile circles for a lathe, offset centreline points for a tube, 26 points for a ball.
export function boundsOf(part) {
	if (boundsMemo.has(part)) return boundsMemo.get(part);
	const legacy = isLegacy(part);
	const samples3 = legacy ? legacyCorners(part) : bodiesOf(part).flatMap(bodySamples);
	const min = [0, 1, 2].map(i => Math.min(...samples3.map(p => p[i])));
	const max = [0, 1, 2].map(i => Math.max(...samples3.map(p => p[i])));
	let plan = [min[0], min[1], max[0], max[1]];
	let top = max[2];
	if (legacy) {
		const [x, y, z] = part.at;
		const [w, d, h] = part.size;
		plan = part.kind === "cylinder" || part.kind === "ring" ? [x - w, y - w, x + w, y + w] : [x, y, x + w, y + d];
		top = z + (part.kind === "ring" || part.kind === "gap" ? 0 : h);
	}
	const out = { min, max, samples3, plan, bottom: min[2], top, centre: [(plan[0] + plan[2]) / 2, (plan[1] + plan[3]) / 2, (min[2] + top) / 2], flatTop: (legacy && !["ring", "gap"].includes(part.kind)) || Boolean(flatPrism(part)) };
	boundsMemo.set(part, out);
	return out;
}

export const planCentre = part => boundsOf(part).centre.slice(0, 2);

// Plan containment with a half-unit tolerance: circles by radius, legacy boxes by their plan. New kinds never support a part
// (a tube or wire is no shelf; risk 2), so they contain nothing.
export function contains(part, [px, py], tolerance = 0.5) {
	const flat = flatPrism(part);
	if (flat) return pointInPolygon([px, py], flat.ring) || flat.ring.some((a, i) => segmentGap([px, py], a, flat.ring[(i + 1) % flat.ring.length]) <= tolerance);
	if (!isLegacy(part)) return false;
	if (part.kind === "cylinder" || part.kind === "ring") return Math.hypot(px - part.at[0], py - part.at[1]) <= part.size[0] + tolerance;
	const [x0, y0, x1, y1] = boundsOf(part).plan;
	return px >= x0 - tolerance && px <= x1 + tolerance && py >= y0 - tolerance && py <= y1 + tolerance;
}

// Which kinds cast a shadow: everything with faces. A gap, a flat ring and a wire are line work; tubes thinner than 0.8 cast none.
export function castsShadow(part) {
	// Glass is drawn as line work over what stands behind it: it casts no shadow and receives none.
	if (part.tone === "glass") return false;
	if (part.kind === "gap" || part.kind === "wire" || (part.kind === "ring" && !part.thickness)) return false;
	const tube = (bodiesOf(part) ?? []).find(body => body.type === "tube");
	if (tube && TUBE_KINDS.includes(part.kind) && tube.radius < 0.8) return false;
	return true;
}

// The shadow polygons of a new-kind part on the plane z = ground: the convex hull of its samples pushed along the light. A long
// tube casts one hull per run of at most 30 units, so a bent pipe's shadow follows the bend.
export function bodyShadows(part, P, { ground = 0, step }) {
	const push = ([x, y, z]) => iso([x + (z - ground) * step[0], y + (z - ground) * step[1], ground], P);
	const out = [];
	const loose = [];
	for (const body of bodiesOf(part)) {
		if (body.type === "prism") {
			// One hull per convex solid, so a key's or an L kerb's shadow keeps its notches.
			for (const idx of body.parts) out.push(hull([0, body.depth].flatMap(s => idx.map(i => push(prismPoint(body.F, s, body.ring[i]))))));
			continue;
		}
		if (body.type !== "tube") {
			loose.push(...bodySamples(body));
			continue;
		}
		const total = pathLength(body.points);
		const runs = Math.max(1, Math.ceil(total / 30));
		for (let k = 0; k < runs; k++) {
			const points = cutPath(body.points, (total * k) / runs, (total * (k + 1)) / runs);
			if (points.length >= 2) out.push(hull(bodySamples({ ...body, points }).map(push)));
		}
	}
	if (loose.length) out.unshift(hull(loose.map(push)));
	return out.filter(poly => poly.length >= 3);
}

// Plan ring of a legacy footprint (guides, legacy shadows): rounded plan, or the circle of a cylinder or ring.
export function footprint(part, r) {
	if (part.kind === "cylinder" || part.kind === "ring") return circleRing(part.at[0], part.at[1], part.size[0], 32);
	return ringOf({ x: part.at[0], y: part.at[1], w: part.size[0], d: part.size[1], r }, 8);
}

const segmentGap = ([px, py], [ax, ay], [bx, by]) => {
	const dx = bx - ax;
	const dy = by - ay;
	const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

// A prism standing upright with one flat, convex, horizontal top (a turned box, an upright convex prism) offers that top like a
// legacy box: it supports the parts resting on it (explode vectors, guides) and receives shadows. { z, ring } (plan points) or null.
export function flatPrism(part) {
	if (part.tone === "glass") return null;
	const bodies = bodiesOf(part);
	const body = bodies?.length === 1 && bodies[0].type === "prism" ? bodies[0] : null;
	if (!body || !body.vertical || body.parts.length !== 1 || !(body.depth > 0)) return null;
	const ring = body.ring.map(point => prismPoint(body.F, body.F.a[2] > 0 ? body.depth : 0, point));
	return { z: ring[0][2], ring: ring.map(([x, y]) => [x, y]) };
}
