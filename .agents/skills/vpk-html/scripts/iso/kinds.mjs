// iso/kinds — pieces for the new part kinds (plan § 2 L, U, S): lathes, cones, axis cylinders and thick rings through the
// vendored lathe(); tubes, rods, legs, springs, catenaries and tori through the vendored tubePieces() (one piece per chunk, with
// `of`, so painter order can interleave a long or bent tube with the parts it passes); spheres and pins through sphereOf(); wires
// as one stroke. Every piece also carries `shapes`: the vendored signed-distance shapes painter.mjs orders it by. Built on the
// vendored anatomy kit (MIT © 2026 Ryan, scripts/anatomy/vendor/LICENSE); the kit is imported, never edited.

import { iso, pathOf } from "../anatomy/vendor/kit/iso-kit.mjs";
import { dot3, lathe, pointOf, sphereOf, viewOf } from "../anatomy/vendor/kit/lathe.mjs";
import { tubePieces } from "../anatomy/vendor/kit/tube.mjs";
import * as A from "../anatomy/vendor/kit/audit.mjs";
import { bodiesOf, boundsOf, TUBE_KINDS } from "./geometry.mjs";
import { prismPieces } from "./prism.mjs";
import { cutawayPieces } from "./cutaway.mjs";

const joined = paths => paths.filter(Boolean).join("");

// lathe() → one solid: buckets 2–3 are the light side the fill already paints, 0–1 the shade (the legacy toneBuckets rule).
function latheSolid(body, P, { shading, bevel = 0, steps }) {
	let hole = body.hole;
	if (hole === "auto") {
		const s1 = body.meridian.at(-1)[0];
		hole = [dot3(body.F.a, viewOf(P)) > 0 ? s1 : body.meridian[0][0], body.rIn];
	}
	const paths = lathe(body.meridian, body.F, P, { hole, bevel, ...(steps ? { steps } : {}) });
	return {
		fill: paths.fill,
		top: paths.top || null,
		shade: shading ? joined(paths.shades.slice(0, 2)) || null : null,
		edge: paths.outline,
		crease: joined([paths.crease, paths.bevel]) || null,
		evenodd: Boolean(hole),
	};
}

// sphereOf's nested caps: the whole disc dark, the lit cap light, the brightest cap the top; the outline last, over both.
function ballSolids(body, P) {
	const paths = sphereOf(body.centre, body.r, P);
	return [
		{ fill: paths.outline, top: null, shade: paths.outline, edge: null, crease: null },
		{ fill: paths.shades[1] || null, top: paths.shades[3] || null, shade: null, edge: paths.outline, crease: null },
	];
}

// A tube chunk: body → the light fill, shine → the top, shade → the shade (both only on a tube wide enough on screen), edges.
// Corrugation rings come back from the kit with per-ring opacity; they are re-emitted as plain mark strokes (no opacity, A11),
// keeping the rings that face the viewer.
function tubeSolid(chunk, { shading }) {
	return {
		fill: chunk.body,
		top: chunk.wide ? chunk.shine : null,
		shade: chunk.wide && shading ? chunk.shade : null,
		edge: chunk.edges,
		crease: null,
		rings: joined((chunk.rings ?? []).filter(ring => ring.alpha >= 0.35).map(ring => ring.d)),
	};
}

const chunksOf = (body, P) => tubePieces(body.points, body.radius, P, { closed: body.closed, caps: body.caps, ...(body.spacing ? { spacing: body.spacing } : {}), rings: body.corrugate ? { pitch: body.corrugate.every } : null });

function shapeOfBody(body) {
	if (body.type === "lathe") return body.closed ? A.body(body.F, body.meridian) : A.solid(body.F, body.meridian);
	if (body.type === "ball") return A.ball(body.centre, body.r);
	if (body.type === "tube") return A.tube(body.points, body.radius);
	return A.tube(body.points, 0.3);
}

// One new-kind part → its pieces (same shape as solids.mjs pieces: { id, of, kind, solids, plan, depthPoint, bottom, top,
// shapes, chunk?, chunks?, loop? }).
export function newKindPieces(part, P, style) {
	const bodies = bodiesOf(part);
	if (bodies.length === 1 && bodies[0].type === "prism") return prismPieces(part, bodies[0], P, style);
	if (part.cutaway && bodies.length === 1 && bodies[0].type === "lathe") return cutawayPieces(part, bodies[0], P, style, { shape: shapeOfBody(bodies[0]), solidOf: latheSolid });
	const bounds = boundsOf(part);
	const base = { kind: part.kind, plan: [bounds.plan], bottom: bounds.bottom, top: bounds.top };
	const shading = style.shading;
	if (TUBE_KINDS.includes(part.kind) && bodies.length === 1) {
		const body = bodies[0];
		const chunks = chunksOf(body, P);
		const single = chunks.length === 1;
		return chunks.map((chunk, k) => {
			const solid = tubeSolid(chunk, { shading });
			const xs = chunk.points.map(p => p[0]);
			const ys = chunk.points.map(p => p[1]);
			return {
				...base,
				id: single ? part.id : `${part.id}:${k}`,
				of: single ? undefined : part.id,
				plan: [[Math.min(...xs) - body.radius, Math.min(...ys) - body.radius, Math.max(...xs) + body.radius, Math.max(...ys) + body.radius]],
				solids: [solid],
				rings: solid.rings || null,
				depthPoint: chunk.mid,
				shapes: [A.tube(chunk.points, body.radius)],
				chunk: k,
				chunks: chunks.length,
				loop: body.closed,
			};
		});
	}
	const solids = [];
	for (const body of bodies) {
		if (body.type === "lathe") solids.push(latheSolid(body, P, { shading, bevel: part.bevel ?? 0, steps: part.steps }));
		else if (body.type === "ball") solids.push(...ballSolids(body, P));
		else if (body.type === "tube") solids.push(...chunksOf(body, P).map(chunk => tubeSolid(chunk, { shading })));
		else if (body.type === "glow") solids.push({ fill: null, top: null, shade: null, edge: null, crease: null, glow: pathOf(Array.from({ length: 48 }, (_, j) => iso(pointOf(body.F, 0, body.r, (j / 48) * Math.PI * 2), P)), true) });
		else solids.push({ fill: null, top: null, shade: null, edge: pathOf(body.points.map(point => iso(point, P))), crease: null });
	}
	// A glow is light, not a solid: it hides nothing, so it carries no painter shape and keeps its depth-point order.
	return [{ ...base, id: part.id, of: undefined, solids, depthPoint: bounds.centre, shapes: part.kind === "glow" ? [] : bodies.map(shapeOfBody) }];
}
