// hairline/runtime/faces — the iso kit's tone map and cast shadows (illustrations.md § 4) worked out for any outline a hairline
// figure fills, with no DOM. runtime/iso.mjs tags every projected point with the world point it came from, and every hull with
// the points it was taken over, so a filled outline still knows its solid; runtime/paint.mjs writes what this returns.
//   flat      every point on one plane (a card, a door, a panel): the face takes the tone of its normal;
//   solid     a hull whose points fall on two parallel planes (a prism, slab, bar, frustum or disc): its visible side bands,
//             swept from one outline to the other, toned by their normals, and its visible cap toned the same;
//   walls     an outline with its points on two parallel planes that is not a hull (a box's near walls, a non-convex plinth):
//             the run on the far plane swept to the near one.
// A face is a top when its normal is within 60° of up; otherwise the near side (tone 1) when its normal turns screen-left and
// the far side (tone 2) when it turns screen-right: the kit's top / light / dark. shadowPoints() is the kit's cast shadow
// (iso/solids.mjs castShadow): every point pushed along the light onto the ground; the caller takes their hull. LIGHT is
// SHADOW's light (iso/accent.mjs), restated because this module runs in the page and accent.mjs carries raw colours;
// hairline.test.mjs holds the two equal.

// Two side bands meeting sharper than this (degrees between their normals) meet at a corner, which gets its own line.
const CORNER = Math.cos((25 * Math.PI) / 180);
const RAD = Math.PI / 180;
export const LIGHT = Object.freeze({ LIGHT_AZIMUTH: 190, LIGHT_ELEVATION: 75 });

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = v => {
	const l = Math.hypot(v[0], v[1], v[2]);
	return l > 1e-9 ? mul(v, 1 / l) : null;
};
const centroid = pts => mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length);

/** A camera's view: its azimuth as cos and sin, k = sin(elevation), and V, the unit vector towards the viewer. */
export function viewOf(az, k) {
	const c = Math.cos(az), s = Math.sin(az);
	return { c, s, k, V: unit([s, c, k / Math.sqrt(1 - k * k)]) };
}

/** The tone of a face with outward normal n: "t" (top), "l" (near side, tone 1) or "r" (far side, tone 2). */
export function toneOf(n, view) {
	if (n[2] >= 0.5) return "t";
	return n[0] * view.c - n[1] * view.s < 0 ? "l" : "r";
}

// Newell's normal of a closed loop of points.
function newell(pts) {
	const n = [0, 0, 0];
	pts.forEach((a, i) => {
		const b = pts[(i + 1) % pts.length];
		n[0] += (a[1] - b[1]) * (a[2] + b[2]);
		n[1] += (a[2] - b[2]) * (a[0] + b[0]);
		n[2] += (a[0] - b[0]) * (a[1] + b[1]);
	});
	return unit(n);
}

// The points' levels along n: { one } when they share a plane, { lo, hi, A, B } (indices on each) when they fall on two.
function levels(pts, n, tol) {
	const d = pts.map(p => dot(p, n));
	const lo = Math.min(...d), hi = Math.max(...d);
	if (hi - lo <= tol) return { one: true };
	const A = [], B = [];
	for (let i = 0; i < d.length; i++) {
		if (d[i] - lo <= tol) A.push(i);
		else if (hi - d[i] <= tol) B.push(i);
		else return null;
	}
	return A.length > 1 && B.length > 1 ? { lo, hi, A, B } : null;
}

// The 2D point on a closed outline (about the origin) in direction t, the farthest crossing.
function rayHit(ring, t) {
	const dx = Math.cos(t), dy = Math.sin(t);
	let best = -1;
	ring.forEach((p, i) => {
		const q = ring[(i + 1) % ring.length], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex;
		if (Math.abs(den) < 1e-12) return;
		const r = (p[0] * ey - p[1] * ex) / den, s = (p[0] * dy - p[1] * dx) / den;
		if (r > 0 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.max(best, r);
	});
	return best > 0 ? [dx * best, dy * best] : null;
}

// For each point of ring A, the step to its partner on ring B: by index when the steps agree (a prism, a taper, a sheared
// bar), else the point of B in the same direction from its centre (rings sampled differently). Null when B has no partner.
function partners(A, B, n, tol) {
	if (A.length === B.length) {
		const E = A.map((a, i) => sub(B[i], a)), mean = mul(E.reduce(add, [0, 0, 0]), 1 / E.length), len = Math.hypot(...mean);
		if (E.every(e => Math.hypot(...sub(e, mean)) <= 0.35 * len + tol)) return E;
	}
	const cA = centroid(A), cB = centroid(B);
	const u = unit(cross(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), w = cross(n, u);
	const flat = (p, c) => [dot(sub(p, c), u), dot(sub(p, c), w)];
	const ring = B.map(p => flat(p, cB));
	const E = [];
	for (const a of A) {
		const [x, y] = flat(a, cA), hit = rayHit(ring, Math.atan2(y, x));
		if (!hit) return null;
		E.push(sub(add(cB, add(mul(u, hit[0]), mul(w, hit[1]))), a));
	}
	return E;
}

// The visible bands of a strip of quads (a[i], a[i+1], b[i+1], b[i]) with outward normals N[i] (null: inherit), grouped into
// one polygon per run of one tone, and a line wherever two visible bands meet at a corner. `closed` strips wrap round.
function bands(a, b, N, view, P, closed) {
	const m = N.length, out = { l: [], r: [], t: [], lines: [] };
	let last = null;
	for (let k = 0; k < 2 * m && N.some(Boolean); k++) {
		const i = k % m;
		if (N[i]) last = N[i];
		else if (last && (closed || k < m)) N[i] = last;
	}
	const quad = N.map(n => (n && dot(n, view.V) > 1e-4 ? toneOf(n, view) : null));
	const at = i => a[i % a.length], bt = i => b[i % b.length];
	let start = 0;
	if (closed) {
		start = quad.findIndex((t, i) => t && quad[(i + m - 1) % m] !== t);
		if (start < 0) return out;
	}
	for (let k = 0; k < m; ) {
		const i = (start + k) % m, tone = quad[i];
		if (!tone) {
			k++;
			continue;
		}
		let j = k;
		while (j + 1 < m && quad[(start + j + 1) % m] === tone) j++;
		const run = [];
		for (let s = k; s <= j + 1; s++) run.push(P(...at(start + s)));
		for (let s = j + 1; s >= k; s--) run.push(P(...bt(start + s)));
		out[tone].push(run);
		k = j + 1;
	}
	for (let i = 0; i < m; i++) {
		const h = (i + m - 1) % m;
		if (!closed && i === 0) continue;
		if (quad[i] && quad[h] && dot(N[i], N[h]) < CORNER) out.lines.push([P(...at(i)), P(...bt(i))]);
	}
	return out;
}

function solid(A, B, n, P, view, tol) {
	const E = partners(A, B, n, tol);
	if (!E) return null;
	const m = A.length, cA = centroid(A), Bp = A.map((a, i) => add(a, E[i]));
	const N = A.map((a, i) => {
		const a1 = A[(i + 1) % m], edge = sub(a1, a);
		if (Math.hypot(...edge) < tol) return null;
		const nrm = unit(cross(edge, mul(add(E[i], E[(i + 1) % m]), 0.5)));
		if (!nrm) return null;
		const mid = sub(mul(add(a, a1), 0.5), cA), radial = sub(mid, mul(n, dot(mid, n)));
		return dot(nrm, radial) < 0 ? mul(nrm, -1) : nrm;
	});
	const out = bands(A, Bp, N, view, P, true);
	const facing = dot(n, view.V);
	if (Math.abs(facing) > 1e-4) {
		const cap = (facing > 0 ? B : A).map(p => P(...p)), tone = toneOf(facing > 0 ? n : mul(n, -1), view);
		if (tone !== "t") out[tone].push(cap);
		out.cap = cap;
	}
	return out;
}

function walls(W, lv, n, P, view) {
	const far = new Set(dot(n, view.V) > 0 ? lv.A : lv.B), m = W.length;
	const step = mul(n, (dot(n, view.V) > 0 ? 1 : -1) * (lv.hi - lv.lo));
	const out = { l: [], r: [], t: [], lines: [] };
	let start = [...Array(m).keys()].find(i => far.has(i) && !far.has((i + m - 1) % m));
	if (start === undefined) return null;
	for (let k = 0; k < m; ) {
		if (!far.has((start + k) % m)) {
			k++;
			continue;
		}
		const run = [];
		while (k < m && far.has((start + k) % m)) run.push(W[(start + k++) % m]);
		if (run.length < 2) continue;
		const N = run.slice(0, -1).map((p, i) => {
			const nrm = unit(cross(sub(run[i + 1], p), step));
			return nrm && dot(nrm, view.V) < 0 ? mul(nrm, -1) : nrm;
		});
		const part = bands(run, run.map(p => add(p, step)), N, view, P, false);
		for (const key of ["l", "r", "t", "lines"]) out[key].push(...part[key]);
	}
	return out;
}

/**
 * The faces of a filled outline. `pts` are its tagged points (each with `w`, its world point), `src` the points a hull was
 * taken over (or null), `P` the projector and `view` its viewOf(). Returns null when a point has no world point; otherwise
 * { world } plus either { tone } (a flat face) or { l, r, lines, cap } (2D polygons for the near and far side bands, the
 * corner lines and the visible cap outline). `world` is what casts the shadow.
 */
export function facesOf(pts, src, P, view) {
	const set = src ?? pts;
	if (!set.length || set.some(p => !p.w)) return null;
	const W = set.map(p => p.w);
	let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
	for (const p of W) {
		lo = lo.map((v, i) => Math.min(v, p[i]));
		hi = hi.map((v, i) => Math.max(v, p[i]));
	}
	const tol = 1e-3 * (1 + Math.hypot(...sub(hi, lo)));
	const own = newell(pts.map(p => p.w));
	if (own && levels(W, own, tol)?.one) return { world: W, tone: toneOf(dot(own, view.V) < 0 ? mul(own, -1) : own, view) };
	const half = W.length >> 1;
	const normals = [[0, 0, 1], [1, 0, 0], [0, 1, 0], newell(W.slice(0, half)), newell(W.filter((_, i) => i % 2 === 0))].filter(Boolean);
	for (const n of normals) {
		const lv = levels(W, n, tol);
		if (!lv || lv.one || lv.hi - lv.lo < 4 * tol) continue;
		const faces = src ? solid(lv.A.map(i => W[i]), lv.B.map(i => W[i]), n, P, view, tol) : walls(W, lv, n, P, view);
		if (faces) return { world: W, ...faces };
	}
	return { world: W };
}

/** The world step on the ground per unit of height, along the light, for a camera at any azimuth (the light keeps its
 *  place in the camera's frame, where the dimetric camera sits at azimuth 45: iso/solids.mjs shadowStep). */
export function shadowStep(view) {
	const a = LIGHT.LIGHT_AZIMUTH * RAD, k = 1 / Math.tan(LIGHT.LIGHT_ELEVATION * RAD);
	const x = -Math.cos(a) * k, y = -Math.sin(a) * k, t = 45 * RAD - Math.atan2(view.s, view.c);
	return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
}

/** Every world point pushed along the light onto the ground at z = ground, projected. A point below the ground stays put. */
export function shadowPoints(world, P, view, ground) {
	const [sx, sy] = shadowStep(view);
	return world.map(([x, y, z]) => {
		const h = Math.max(0, z - ground);
		return P(x + h * sx, y + h * sy, ground);
	});
}
