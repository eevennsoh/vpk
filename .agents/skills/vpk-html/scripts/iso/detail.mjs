// iso/detail — part.detail[] generators (plan § 2 D and T): ticks, radial ticks, knurl, ribs, bands, spokes, bolts, dot grids,
// insets, recesses, hatch, spirals, lines and face text, each drawn on a named face of its part in part-local u, v, or around a
// lathe's axis frame. detailFor(part, P) returns the part's detail as one bucket per role:
//   { mark: d[], dash: d[], hatch: d[], dot: d[], recess: { fill, edge }[], text: { matrix, text, size, anchor }[], skipped: string[] }
// The emitter merges each bucket into one path. Legacy `marks` become `line` detail on the top face (same bytes as before).
// Built on the vendored anatomy kit's lathe helpers (MIT © 2026 Ryan, scripts/anatomy/vendor/LICENSE).

import { iso, pathOf, roundedPlan } from "../anatomy/vendor/kit/iso-kit.mjs";
import { add3, arcOf, dot3, mul3, ribsOf, scaleOf, viewOf } from "../anatomy/vendor/kit/lathe.mjs";
import { bodiesOf, BOX_KINDS, isLegacy, isTurnedBox, latheOf, prismPoint, radiusAt, slopeAt } from "./geometry.mjs";
import { trayOpening, wallOf } from "./tray.mjs";

export const DETAIL_TYPES = Object.freeze(["ticks", "radialTicks", "knurl", "ribs", "bands", "spokes", "bolts", "dots", "inset", "recess", "hatch", "spiral", "line", "text"]);
const LATHE_TYPES = new Set(["knurl", "ribs", "bands"]);
// Face text: ASCII plus the common typographic symbols, escaped by the emitter.
export const FACE_TEXT = /^[\x20-\x7E·×°±µ→←↑↓–—…’‘“”²³½¼¾≤≥≈∞Ωπ]{1,48}$/u;
const RECESS_SHAPES = ["circle", "rect", "stadium"];
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

const isNum = value => typeof value === "number" && Number.isFinite(value);
const isUV = value => Array.isArray(value) && value.length === 2 && value.every(isNum);

// The faces a part offers: { o, u, v, n, size: [W, D] } (rect: u, v from the corner o) or { o, u, v, n, radius } (a circular face
// centred on o). A box's top, ±x and ±y faces (side faces run u along the face, v up from the base); a tray's floor top; a
// cylinder's top cap; a lathe's start and end caps (top aliases the end on an upright lathe).
export function facesOf(part) {
	// A turned box (yaw, axis) or a prism names its faces in its own frame: `top` is the cap at the far end of its axis (the world
	// top of an upright one), the sides run u along the face and v along the axis. A prism's caps are the polygon's bounding rect.
	if (isTurnedBox(part) || part.kind === "prism") {
		const body = bodiesOf(part)[0];
		const { F, depth } = body;
		const xs = body.ring.map(([u]) => u);
		const ys = body.ring.map(([, v]) => v);
		const [u0, v0, u1, v1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
		const top = { o: prismPoint(F, depth, [u0, v0]), u: F.u, v: F.v, n: F.a, size: [u1 - u0, v1 - v0], top: F.a[2] > 0.999 };
		if (part.kind === "prism") return { top, end: top, start: { ...top, o: prismPoint(F, 0, [u0, v0]), n: mul3(F.a, -1), top: false } };
		const [w, d, h] = part.size;
		return {
			top,
			"+x": { o: prismPoint(F, 0, [w, 0]), u: F.v, v: F.a, n: F.u, size: [d, h] },
			"-x": { o: prismPoint(F, 0, [0, 0]), u: F.v, v: F.a, n: mul3(F.u, -1), size: [d, h] },
			"+y": { o: prismPoint(F, 0, [0, d]), u: F.u, v: F.a, n: F.v, size: [w, h] },
			"-y": { o: prismPoint(F, 0, [0, 0]), u: F.u, v: F.a, n: mul3(F.v, -1), size: [w, h] },
		};
	}
	if (BOX_KINDS.includes(part.kind) || part.kind === "tray") {
		const [x, y, z] = part.at;
		const [w, d, h] = part.size;
		const top = { o: [x, y, part.kind === "tray" ? z + (trayOpening(part) === "-z" ? 0 : wallOf(part)) : z + h], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], size: [w, d], top: true };
		if (part.kind === "tray") return { top };
		return {
			top,
			"+x": { o: [x + w, y, z], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0], size: [d, h] },
			"-x": { o: [x, y, z], u: [0, 1, 0], v: [0, 0, 1], n: [-1, 0, 0], size: [d, h] },
			"+y": { o: [x, y + d, z], u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0], size: [w, h] },
			"-y": { o: [x, y, z], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0], size: [w, h] },
		};
	}
	const lathe = latheOf(part);
	if (!lathe) return {};
	const { F, profile } = lathe;
	const cap = (s, sign) => ({ o: add3(F.o, mul3(F.a, s)), u: F.u, v: F.v, n: mul3(F.a, sign), radius: radiusAt(profile, s), s, top: F.a[2] > 0.999 && sign > 0 });
	const end = cap(profile.at(-1)[0], 1);
	const faces = { start: cap(profile[0][0], -1), end };
	if (end.top) faces.top = end;
	return faces;
}

export const defaultFace = part => (BOX_KINDS.includes(part.kind) || part.kind === "tray" || (part.kind === "cylinder" && isLegacy(part)) ? "top" : "end");

// Validates part.detail (schema errors only; geometry the face cannot show is skipped at build time with a warning).
export function validateDetail(part, at, push) {
	const list = part.detail;
	if (list === undefined) return;
	if (!Array.isArray(list)) return push(`${at}.detail must be an array`);
	const faces = facesOf(part);
	const hasLathe = Boolean(latheOf(part));
	list.forEach((spec, index) => {
		const where = `${at}.detail[${index}]`;
		if (!spec || typeof spec !== "object") return push(`${where} must be an object`);
		if (!DETAIL_TYPES.includes(spec.type)) return push(`${where}.type ${JSON.stringify(spec.type)} must be one of ${DETAIL_TYPES.join(", ")}`);
		if (LATHE_TYPES.has(spec.type) || (spec.type === "spokes" && spec.face === undefined && hasLathe)) {
			if (!hasLathe) return push(`${where}: ${spec.type} needs a turned part (cylinder, lathe, cone or a ring with thickness)`);
		} else if (!Object.keys(faces).length) return push(`${where}: a ${part.kind} has no faces for ${spec.type} detail`);
		else {
			const face = spec.face ?? defaultFace(part);
			if (!(face in faces)) return push(`${where}.face ${JSON.stringify(spec.face)} must be one of ${Object.keys(faces).join(", ")} on a ${part.kind}`);
			if (spec.type === "hatch" && !faces[face].top) push(`${where}: hatch is drawn on top faces only (side faces stay flat)`);
		}
		const need = (key, test, text) => {
			if (!test(spec[key])) push(`${where}.${key} ${text}`);
		};
		const opt = (key, test, text) => {
			if (spec[key] !== undefined && !test(spec[key])) push(`${where}.${key} ${text}`);
		};
		const pos = value => isNum(value) && value > 0;
		const count = (max, key = "count") => need(key, value => Number.isInteger(value) && value >= 1 && value <= max, `must be an integer within 1–${max}`);
		if (spec.type !== "bands") opt("at", isUV, "must be [u, v]");
		opt("s", isNum, "must be a number (along the axis)");
		switch (spec.type) {
			case "ticks":
				need("from", isUV, "must be [u, v]");
				need("to", isUV, "must be [u, v]");
				need("step", pos, "must be > 0");
				opt("every", value => Number.isInteger(value) && value >= 1, "must be a positive integer");
				opt("lengths", value => isUV(value) && value.every(item => item > 0), "must be [minor, major] lengths > 0");
				opt("side", value => value === 1 || value === -1, "must be 1 or -1");
				break;
			case "radialTicks":
				need("r", pos, "must be > 0");
				count(720);
				opt("every", value => Number.isInteger(value) && value >= 1, "must be a positive integer");
				opt("lengths", value => isUV(value) && value.every(item => item > 0), "must be [minor, major] lengths > 0");
				opt("from", isNum, "must be degrees");
				opt("span", value => isNum(value) && value > 0 && value <= 360, "must be degrees within (0, 360]");
				break;
			case "knurl":
			case "ribs":
				count(360);
				opt("s0", isNum, "must be a number");
				opt("s1", isNum, "must be a number");
				opt("phase", isNum, "must be degrees");
				break;
			case "bands":
				need("at", value => Array.isArray(value) && value.length >= 1 && value.length <= 64 && value.every(isNum), "must be a list of 1–64 positions along the axis");
				break;
			case "spokes":
				need("r1", pos, "must be > 0");
				opt("r0", value => isNum(value) && value >= 0, "must be ≥ 0");
				count(120);
				opt("phase", isNum, "must be degrees");
				break;
			case "bolts":
				need("r", pos, "must be > 0");
				count(120);
				opt("size", pos, "must be > 0");
				opt("phase", isNum, "must be degrees");
				break;
			case "dots": {
				need("grid", value => Array.isArray(value) && value.length === 2 && value.every(item => Number.isInteger(item) && item >= 1), "must be [columns, rows]");
				need("gap", pos, "must be > 0");
				opt("size", pos, "must be > 0");
				const n = Array.isArray(spec.grid) ? spec.grid[0] * spec.grid[1] : 0;
				opt("weights", value => Array.isArray(value) && value.length === n && value.every(item => isNum(item) && item >= 0 && item <= 1), `must list ${n} weights within 0–1`);
				break;
			}
			case "inset":
				need("by", pos, "must be > 0");
				opt("r", value => isNum(value) && value >= 0, "must be ≥ 0");
				break;
			case "recess":
				opt("shape", value => RECESS_SHAPES.includes(value), `must be one of ${RECESS_SHAPES.join(", ")}`);
				need("size", value => (isNum(value) && value > 0) || (isUV(value) && value.every(item => item > 0)), "must be a diameter or [w, d] > 0");
				opt("depth", pos, "must be > 0");
				break;
			case "hatch":
				need("spacing", value => isNum(value) && value >= 0.5, "must be ≥ 0.5");
				opt("angle", isNum, "must be degrees");
				break;
			case "spiral":
				need("r1", pos, "must be > 0");
				opt("r0", value => isNum(value) && value >= 0, "must be ≥ 0");
				need("turns", value => isNum(value) && value > 0 && value <= 40, "must be within (0, 40]");
				break;
			case "line":
				need("points", value => Array.isArray(value) && value.length >= 2 && value.length <= 256 && value.every(isUV), "must be 2–256 [u, v] points");
				opt("dash", value => typeof value === "boolean", "must be true or false");
				break;
			case "text":
				need("text", value => typeof value === "string" && FACE_TEXT.test(value), "must be 1–48 characters of ASCII or common symbols");
				opt("size", value => isNum(value) && value >= 2 && value <= 6, "must be within 2–6 world units");
				opt("anchor", value => ["start", "middle", "end"].includes(value), "must be start, middle or end");
				break;
		}
	});
}

const unitV = v => {
	const length = Math.hypot(...v) || 1;
	return v.map(c => c / length);
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// A face point at u, v (a top face adds them straight to the corner, so legacy marks keep their exact coordinates).
export const onFace = (face, [u, v]) => (face.top && face.u[0] === 1 && face.v[1] === 1 ? [face.o[0] + u, face.o[1] + v, face.o[2]] : add3(add3(face.o, mul3(face.u, u)), mul3(face.v, v)));
const facing = (face, P) => dot3(face.n, viewOf(P)) > 1e-6;
const fmt = value => {
	const text = (Math.round(value * 1000) / 1000).toString();
	return text === "-0" ? "0" : text;
};

// The text matrix for a face: text x runs along the baseline b = down × n and text y along `down` (world −z projected on a
// vertical face, world +y on a horizontal one), so face text is never mirrored on a face that looks at the viewer. Its columns
// are projected world unit vectors, so font-size is in world units (the vendored topMatrix/sideMatrix convention).
export function faceMatrix(face, uv, P) {
	const n = unitV(face.n);
	const raw = Math.abs(n[2]) < 0.7 ? [0, 0, -1] : [0, 1, 0];
	const down = unitV(add3(raw, mul3(n, -dot3(raw, n))));
	const base = cross(down, n);
	const origin = onFace(face, uv);
	const o = iso(origin, P);
	const col = dir => {
		const p = iso(add3(origin, dir), P);
		return [p[0] - o[0], p[1] - o[1]];
	};
	const [a, b] = col(base);
	const [c, d] = col(down);
	return { matrix: `matrix(${[a, b, c, d, o[0], o[1]].map(fmt).join(" ")})`, base, down, origin };
}

const dotPath = ([x, y], r) => {
	const rr = Math.max(0.3, Math.round(r * 10) / 10);
	const d = n => (Math.round(n * 10) / 10).toString();
	return `M${d(x - rr)} ${d(y)}a${rr} ${rr} 0 1 0 ${d(2 * rr)} 0a${rr} ${rr} 0 1 0 ${d(-2 * rr)} 0Z`;
};

function faceCentre(face) {
	return face.size ? [face.size[0] / 2, face.size[1] / 2] : [0, 0];
}

// Clip the line p + t·dir (uv) to a convex polygon (uv); returns [t0, t1] or null.
function clipLine(p, dir, poly) {
	let t0 = -Infinity;
	let t1 = Infinity;
	let area = 0;
	for (let i = 0; i < poly.length; i++) area += poly[i][0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * poly[i][1];
	const sign = area >= 0 ? 1 : -1;
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i];
		const b = poly[(i + 1) % poly.length];
		const nx = -(b[1] - a[1]) * sign;
		const ny = (b[0] - a[0]) * sign;
		const denom = nx * dir[0] + ny * dir[1];
		const dist = nx * (p[0] - a[0]) + ny * (p[1] - a[1]);
		if (Math.abs(denom) < 1e-12) {
			if (dist < 0) return null;
			continue;
		}
		const t = -dist / denom;
		if (denom > 0) t0 = Math.max(t0, t);
		else t1 = Math.min(t1, t);
	}
	return t0 < t1 ? [t0, t1] : null;
}

const facePolygon = face => (face.size ? [[0, 0], [face.size[0], 0], [face.size[0], face.size[1]], [0, face.size[1]]] : Array.from({ length: 48 }, (_, i) => [face.radius * Math.cos((i / 48) * TAU), face.radius * Math.sin((i / 48) * TAU)]));

function outlineUV(shape, [cu, cv], [w, d]) {
	if (shape === "rect") return [[cu - w / 2, cv - d / 2], [cu + w / 2, cv - d / 2], [cu + w / 2, cv + d / 2], [cu - w / 2, cv + d / 2]];
	if (shape === "stadium") {
		const r = Math.min(w, d) / 2;
		return roundedPlan({ x: cu - w / 2, y: cv - d / 2, w, d, r }, 8);
	}
	return Array.from({ length: 40 }, (_, i) => [cu + (w / 2) * Math.cos((i / 40) * TAU), cv + (d / 2) * Math.sin((i / 40) * TAU)]);
}

// The detail of one part, projected. `marks` (legacy) are line detail on the top face.
export function detailFor(part, P) {
	const out = { mark: [], dash: [], hatch: [], dot: [], recess: [], text: [], skipped: [] };
	const specs = [...(part.marks ?? []).map(points => ({ type: "line", points, legacy: true })), ...(part.detail ?? [])];
	if (!specs.length) return null;
	const faces = facesOf(part);
	const lathe = latheOf(part);
	const k = scaleOf(P);
	const flat = p => iso(p, P);
	const seg = (face, a, b) => pathOf([flat(onFace(face, a)), flat(onFace(face, b))]);
	for (const spec of specs) {
		if (lathe && LATHE_TYPES.has(spec.type)) {
			const { F, profile } = lathe;
			const s0 = spec.s0 ?? profile[0][0];
			const s1 = spec.s1 ?? profile.at(-1)[0];
			if (spec.type === "bands") out.mark.push(...spec.at.map(s => arcOf(F, s, radiusAt(profile, s), P, { slope: slopeAt(profile, s) })));
			else {
				const inset = spec.type === "knurl" ? Math.min(0.4, (s1 - s0) / 4) : 0;
				out.mark.push(ribsOf(F, s0 + inset, s1 - inset, radiusAt(profile, s0 + inset), spec.count, P, { phase: (spec.phase ?? 0) * RAD, r1: radiusAt(profile, s1 - inset) }));
			}
			continue;
		}
		const name = spec.face ?? defaultFace(part);
		let face = faces[name];
		if (!face) continue;
		if (spec.s !== undefined && lathe && face.radius !== undefined) face = { ...face, o: add3(lathe.F.o, mul3(lathe.F.a, spec.s)), radius: radiusAt(lathe.profile, spec.s) };
		if (!spec.legacy && !facing(face, P)) {
			out.skipped.push(`${spec.type} on face ${name} faces away from the camera`);
			continue;
		}
		const centre = spec.at ?? faceCentre(face);
		switch (spec.type) {
			case "line":
				(spec.dash ? out.dash : out.mark).push(spec.legacy && spec.points.length === 2 ? seg(face, spec.points[0], spec.points[1]) : pathOf(spec.points.map(uv => flat(onFace(face, uv)))));
				break;
			case "ticks": {
				const [a, b] = [spec.from, spec.to];
				const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
				const dir = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
				const side = spec.side ?? 1;
				const normal = [-dir[1] * side, dir[0] * side];
				const [minor, major] = spec.lengths ?? [1, 2.5];
				const every = spec.every ?? 5;
				for (let i = 0; i * spec.step <= length + 1e-9; i++) {
					const p = [a[0] + dir[0] * i * spec.step, a[1] + dir[1] * i * spec.step];
					const len = i % every === 0 ? major : minor;
					out.mark.push(seg(face, p, [p[0] + normal[0] * len, p[1] + normal[1] * len]));
				}
				break;
			}
			case "radialTicks": {
				const span = (spec.span ?? 360) * RAD;
				const closed = Math.abs(span - TAU) < 1e-9;
				const [minor, major] = spec.lengths ?? [0.8, 1.6];
				const every = spec.every ?? 5;
				for (let i = 0; i < (closed ? spec.count : spec.count + 1); i++) {
					const angle = (spec.from ?? 0) * RAD + (i / spec.count) * span;
					const dir = [Math.cos(angle), Math.sin(angle)];
					const inner = spec.r - (i % every === 0 ? major : minor);
					out.mark.push(seg(face, [centre[0] + dir[0] * inner, centre[1] + dir[1] * inner], [centre[0] + dir[0] * spec.r, centre[1] + dir[1] * spec.r]));
				}
				break;
			}
			case "spokes":
				for (let i = 0; i < spec.count; i++) {
					const angle = (spec.phase ?? 0) * RAD + (i / spec.count) * TAU;
					const dir = [Math.cos(angle), Math.sin(angle)];
					out.mark.push(seg(face, [centre[0] + dir[0] * (spec.r0 ?? 0), centre[1] + dir[1] * (spec.r0 ?? 0)], [centre[0] + dir[0] * spec.r1, centre[1] + dir[1] * spec.r1]));
				}
				break;
			case "bolts":
				for (let i = 0; i < spec.count; i++) {
					const angle = (spec.phase ?? 0) * RAD + (i / spec.count) * TAU;
					out.dot.push(dotPath(flat(onFace(face, [centre[0] + Math.cos(angle) * spec.r, centre[1] + Math.sin(angle) * spec.r])), (spec.size ?? 0.6) * k));
				}
				break;
			case "dots": {
				const origin = spec.at ?? [0, 0];
				const [nx, ny] = spec.grid;
				for (let row = 0; row < ny; row++) for (let col = 0; col < nx; col++) {
					const weight = spec.weights ? spec.weights[row * nx + col] : 1;
					if (weight <= 0.05) continue;
					out.dot.push(dotPath(flat(onFace(face, [origin[0] + col * spec.gap, origin[1] + row * spec.gap])), (spec.size ?? 0.5) * k * weight));
				}
				break;
			}
			case "inset": {
				const ring = face.size
					? roundedPlan({ x: spec.by, y: spec.by, w: face.size[0] - 2 * spec.by, d: face.size[1] - 2 * spec.by, r: spec.r ?? 0 }, 8)
					: Array.from({ length: 48 }, (_, i) => [(face.radius - spec.by) * Math.cos((i / 48) * TAU), (face.radius - spec.by) * Math.sin((i / 48) * TAU)]);
				out.mark.push(pathOf(ring.map(uv => flat(onFace(face, uv))), true));
				break;
			}
			case "recess": {
				const size = Array.isArray(spec.size) ? spec.size : [spec.size, spec.size];
				const ring = outlineUV(spec.shape ?? "circle", centre, size);
				const world = ring.map(uv => onFace(face, uv));
				out.recess.push({ fill: pathOf(world.map(flat), true) });
				out.mark.push(pathOf(world.map(flat), true));
				// The far inner wall: outline points whose wall faces the viewer, pushed into the face by the recess depth.
				const depth = spec.depth ?? Math.min(1.2, Math.min(...size) / 4);
				const V = viewOf(P);
				const area = ring.reduce((sum, [u0, v0], i) => sum + u0 * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * v0, 0);
				const sign = area >= 0 ? 1 : -1;
				const run = [];
				const runs = [];
				ring.forEach((_, i) => {
					const next = ring[(i + 1) % ring.length];
					const prev = ring[(i + ring.length - 1) % ring.length];
					const outward = mul3(add3(mul3(face.u, next[1] - prev[1]), mul3(face.v, -(next[0] - prev[0]))), sign);
					if (dot3(outward, V) < 0) run.push(flat(add3(world[i], mul3(face.n, -depth))));
					else if (run.length) runs.push(run.splice(0));
				});
				if (run.length) runs.push(run);
				for (const points of runs) if (points.length >= 2) out.mark.push(pathOf(points));
				break;
			}
			case "hatch": {
				const poly = facePolygon(face);
				const angle = (spec.angle ?? 45) * RAD;
				const dir = [Math.cos(angle), Math.sin(angle)];
				const normal = [-dir[1], dir[0]];
				const along = poly.map(([u, v]) => u * normal[0] + v * normal[1]);
				const [lo, hi] = [Math.min(...along), Math.max(...along)];
				for (let t = lo + spec.spacing / 2; t < hi; t += spec.spacing) {
					const p = [normal[0] * t, normal[1] * t];
					const span = clipLine(p, dir, poly);
					if (span) out.hatch.push(seg(face, [p[0] + dir[0] * span[0], p[1] + dir[1] * span[0]], [p[0] + dir[0] * span[1], p[1] + dir[1] * span[1]]));
				}
				break;
			}
			case "spiral": {
				const turns = spec.turns;
				const n = Math.max(12, Math.ceil(turns * 24));
				const points = [];
				for (let i = 0; i <= n; i++) {
					const t = i / n;
					const r = (spec.r0 ?? 0) + (spec.r1 - (spec.r0 ?? 0)) * t;
					const angle = (spec.phase ?? 0) * RAD + t * turns * TAU;
					points.push(flat(onFace(face, [centre[0] + r * Math.cos(angle), centre[1] + r * Math.sin(angle)])));
				}
				out.mark.push(pathOf(points));
				break;
			}
			case "text":
				out.text.push({ matrix: faceMatrix(face, spec.at ?? [0, 0], P).matrix, text: spec.text, size: spec.size ?? 3, anchor: spec.anchor ?? "start" });
				break;
		}
	}
	return out;
}
