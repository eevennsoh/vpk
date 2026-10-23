// iso/layout — label placement for iso-kit figures (illustrations.md R7, A7).
// Labels sit in gutter columns outside the scene, in uppercase Geist Mono, on 1px elbow leaders
// that end inside the target's rest silhouette. Placement is greedy and deterministic; crowded
// figures fail the audit (A7) instead of being moved silently, and briefs fix them with
// `side` / `anchor` overrides. The A7 geometry and the label-pose audit (auditLabelPoses: every slider
// stop of an explode figure) sit at the end of the file, shared by the model audit and the document audit.

import { pathOf } from "../anatomy/vendor/kit/iso-kit.mjs";
import { convexOverlap, hull, pointInPolygon } from "./core.mjs";

export const LABEL_GAP = 2;
export const MIN_SPACING = 16;

// Estimated advance: chars × size × 0.6 (Geist Mono) + letter-spacing × chars.
export function textWidth(text, { size = 11, spacingEm = 0.08 } = {}) {
	const chars = [...String(text)].length;
	return chars * size * 0.6 + spacingEm * size * chars;
}

// Box of a label centred on its leader row `y`; `anchor` is the SVG text-anchor.
export function labelBox({ x, y, text, anchor = "start" }, font) {
	const w = textWidth(text, font);
	const left = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
	return { x: left, y: y - font.size / 2, w, h: font.size };
}

export const boxPolygon = ({ x, y, w, h }) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

export function spread(rows, lo, hi, gap = MIN_SPACING) {
	rows.sort((a, b) => a.y - b.y || a.order - b.order);
	for (let i = 0; i < rows.length; i++) {
		rows[i].y = Math.max(rows[i].y, lo, i ? rows[i - 1].y + gap : lo);
	}
	for (let i = rows.length - 1; i >= 0; i--) {
		rows[i].y = Math.min(rows[i].y, hi, i < rows.length - 1 ? rows[i + 1].y - gap : hi);
	}
}

/* ---- labels hug the figure, dimension boxes and the scale bar (illustrations.md § Style) ---- */

export const NEAR_GAP = 16;
export const NEAR_SPACING = 28;
export const DIM_BOX_PAD = [6, 4];
const NEAR_TRIES = 8;

// Gutter widths for near labels: the text plus the gap to the figure (the camera pad supplies the rest).
export function gutterWidthsNear(labels, font) {
	const out = { left: 0, right: 0 };
	for (const label of labels) out[label.side] = Math.max(out[label.side], textWidth(label.text, font) + NEAR_GAP);
	return out;
}

const boxesOverlap = (a, b, pad = 1) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

// Horizontal extent of the convex `hull` inside the row band y ± half; falls back to the whole hull when the band misses it.
export function hullExtent(hull, y, half) {
	const band = clipConvex(hull, [[-1e5, y - half], [1e5, y - half], [1e5, y + half], [-1e5, y + half]]);
	const xs = (band.length >= 3 ? band : hull).map(([x]) => x);
	return [Math.min(...xs), Math.max(...xs)];
}

// A segment as a chain of small boxes (about `step` apart, each `step` square), so a label can route around a diagonal line
// (the motion arrow) without treating its whole bounding box as occupied.
export function segmentBoxes([ax, ay], [bx, by], step = 10) {
	const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
	return Array.from({ length: n + 1 }, (_, i) => ({ x: ax + ((bx - ax) * i) / n - step / 2, y: ay + ((by - ay) * i) / n - step / 2, w: step, h: step }));
}

// The side whose hull edge, on the anchor's row, is the nearer: a leader that crosses the figure to reach a far label is
// not the short leader of rule 5. The brief's side stays unless the other side is at least a third nearer.
export function nearerSide(hull, anchor, hint, font) {
	const [minX, maxX] = hullExtent(hull, anchor[1], font.size / 2 + 2);
	const left = Math.max(0, anchor[0] - minX);
	const right = Math.max(0, maxX - anchor[0]);
	if (left < right * 0.67) return "left";
	if (right < left * 0.67) return "right";
	return hint;
}

/**
 * Label placement: each label sits just outside the figure's hull on its anchor's row, on a short
 * straight leader that ends in a dot on the part (emit.mjs draws the dot as the leader's marker).
 * Rows are spread over the label band, then nudged off `avoid` boxes (dimension labels, the scale bar)
 * and off each other; a row that still collides is kept, and the audit reports it (A7) instead of moving it silently.
 * A label's `side` is a hint: it moves to the side nearer its anchor (`nearerSide`).
 */
export function placeLabelsNear({ viewBox: [, height], hull, pad = 24, avoid = [] }, labels, font) {
	const rows = labels.map((label, order) => ({ ...label, order, side: nearerSide(hull, label.anchor, label.side, font), y: label.anchor[1] }));
	const lo = pad + font.size / 2;
	const hi = height - pad - font.size / 2;
	// Two labels never read as one stack (B keeps about 2.7 line heights between neighbours on a side).
	for (const side of ["left", "right"]) spread(rows.filter(row => row.side === side), lo, hi, NEAR_SPACING);
	const half = font.size / 2 + 2;
	const place = (row, y) => {
		const left = row.side === "left";
		const [minX, maxX] = hullExtent(hull, y, half);
		const textX = left ? minX - NEAR_GAP : maxX + NEAR_GAP;
		const anchor = left ? "end" : "start";
		return { y, textX, anchor, box: labelBox({ x: textX, y, text: row.text, anchor }, font) };
	};
	const placed = [];
	for (const row of rows.slice().sort((a, b) => a.y - b.y || a.order - b.order)) {
		let best = place(row, row.y);
		for (let k = 1; k <= NEAR_TRIES && [...avoid, ...placed.map(entry => entry.box)].some(box => boxesOverlap(best.box, box)); k++) {
			const options = [row.y + k * 6, row.y - k * 6].filter(y => y >= lo && y <= hi).map(y => place(row, y));
			const clear = options.find(option => [...avoid, ...placed.map(entry => entry.box)].every(box => !boxesOverlap(option.box, box)));
			if (clear) best = clear;
		}
		placed.push({ ...best, row });
	}
	return placed.sort((a, b) => a.row.order - b.row.order).map(({ row, y, textX, anchor, box }) => {
		const left = row.side === "left";
		const start = [left ? box.x + box.w + LABEL_GAP : box.x - LABEL_GAP, y];
		const points = [start, row.anchor];
		return { text: row.text, target: row.target, side: row.side, textX, textY: y + font.size * 0.35, textAnchor: anchor, rowY: y, box, leader: { d: pathOf(points), points } };
	});
}

// A tick-ended dimension line `a`→`b` pushed `offset` px sideways (away from `centre`) with a boxed mono label on its middle.
export function dimGeometry({ a, b, text, offset = 22, centre }, font) {
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
	let n = [-u[1], u[0]];
	const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	if ((mid[0] - centre[0]) * n[0] + (mid[1] - centre[1]) * n[1] < 0) n = [-n[0], -n[1]];
	const at = ([x, y], k) => [x + n[0] * k, y + n[1] * k];
	const a2 = at(a, offset);
	const b2 = at(b, offset);
	const middle = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2];
	const w = textWidth(text, font) + DIM_BOX_PAD[0] * 2;
	const h = font.size + DIM_BOX_PAD[1] * 2;
	return { a, b, u, n, a2, b2, extA: [at(a, 4), at(a, offset + 4)], extB: [at(b, 4), at(b, offset + 4)], middle, box: { x: middle[0] - w / 2, y: middle[1] - h / 2, w, h } };
}

// Every stroke of a boxed dimension as two-point segments: both extension lines, the line and the two end ticks (as emit draws them).
export function dimStrokes({ u, n, a2, b2, extA, extB }) {
	const tick = ([x, y]) => [[x - (u[0] + n[0]) * 3, y - (u[1] + n[1]) * 3], [x + (u[0] + n[0]) * 3, y + (u[1] + n[1]) * 3]];
	return [extA, extB, [a2, b2], tick(a2), tick(b2)];
}

// Sutherland–Hodgman: `subject` clipped to the convex polygon `window` (either winding).
export function clipConvex(subject, window) {
	if (subject.length < 3 || window.length < 3) return [];
	const area = window.reduce((sum, [x, y], i) => sum + x * window[(i + 1) % window.length][1] - window[(i + 1) % window.length][0] * y, 0);
	const sign = area >= 0 ? 1 : -1;
	let out = subject;
	for (let i = 0; i < window.length && out.length; i++) {
		const [ax, ay] = window[i];
		const [bx, by] = window[(i + 1) % window.length];
		const side = ([x, y]) => sign * ((bx - ax) * (y - ay) - (by - ay) * (x - ax));
		const input = out;
		out = [];
		input.forEach((point, index) => {
			const prev = input[(index + input.length - 1) % input.length];
			const [sp, sc] = [side(prev), side(point)];
			if (sc >= 0 !== sp >= 0) {
				const t = sp / (sp - sc);
				out.push([prev[0] + (point[0] - prev[0]) * t, prev[1] + (point[1] - prev[1]) * t]);
			}
			if (sc >= 0) out.push(point);
		});
	}
	return out;
}

/* ---- A7 geometry and the label poses (shared by audit.mjs: the model audit and the document audit) ---- */

export function segmentHitsBox([ax, ay], [bx, by], { x, y, w, h }) {
	if (Math.max(ax, bx) < x || Math.min(ax, bx) > x + w || Math.max(ay, by) < y || Math.min(ay, by) > y + h) return false;
	const inside = ([px, py]) => px > x && px < x + w && py > y && py < y + h;
	if (inside([ax, ay]) || inside([bx, by])) return true;
	const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
	const corners = boxPolygon({ x, y, w, h });
	for (let i = 0; i < 4; i++) {
		const c = corners[i];
		const d = corners[(i + 1) % 4];
		if (cross([ax, ay], [bx, by], c) * cross([ax, ay], [bx, by], d) < 0 && cross(c, d, [ax, ay]) * cross(c, d, [bx, by]) < 0) return true;
	}
	return false;
}

export function distanceToPolygon([px, py], poly) {
	let best = Infinity;
	for (let i = 0; i < poly.length; i++) {
		const [ax, ay] = poly[i];
		const [bx, by] = poly[(i + 1) % poly.length];
		const dx = bx - ax;
		const dy = by - ay;
		const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
		best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
	}
	return best;
}

export const nearPolygon = (point, poly, tolerance) => poly.length >= 3 && (pointInPolygon(point, poly) || distanceToPolygon(point, poly) <= tolerance);

// The poses a reader can set: rest, plus every Gap slider stop from min to max on an explode figure.
export function scenePoses(scene) {
	const ex = scene.explode;
	const poses = [{ gap: ex ? ex.rest : null, k: 0 }];
	if (!ex) return poses;
	const gaps = Array.from({ length: Math.floor((ex.max - ex.min) / ex.step + 1e-9) + 1 }, (_, i) => Math.round((ex.min + i * ex.step) * 1e6) / 1e6);
	if (ex.max - gaps.at(-1) > 1e-9) gaps.push(ex.max);
	for (const gap of gaps) if (Math.abs(gap - ex.rest) > 1e-9) poses.push({ gap, k: gap - ex.rest });
	return poses.sort((a, b) => a.gap - b.gap);
}

// Clearance between a leader's end and any part painted over its target (chooseAnchor keeps it at rest).
const LEADER_CLEAR = 4;

function leadersCross(a, b) {
	const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
	for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++) {
		const [p, q, r, s] = [a[i - 1], a[i], b[j - 1], b[j]];
		if (side(p, q, r) * side(p, q, s) < 0 && side(r, s, p) * side(r, s, q) < 0) return true;
	}
	return false;
}

/**
 * Labels and leaders (A7) in every pose a reader can set. Shared by the model audit (auditScene,
 * before emitting) and the document audit (auditSvg reads the same model back from the emitted
 * HTML, so a figure that fails at a slider stop cannot pass --check-iso). The runtime moves each
 * part by its screen explode vector × (gap − rest) and drags only the last point of each leader
 * with its target; labels and painter order stay put. So at each pose every leader must end on a
 * visible point of its target (no part painted after it within LEADER_CLEAR px), clear the other
 * labels and cross no other leader, and no label may touch the moved figure. A failure off the rest
 * pose names the stops and asks for a narrower explode range.
 *
 * model = { figure, explode: { rest, min, max, step, unit } | null, hull,
 *           pieces: { partId, hit, explode, paints? }[] (painter order; paints false = stroke only, so a dimension may cross its silhouette), labels: { text, target, box, points }[],
 *           dims?: { text, box, line: [a, b] }[] }
 * A boxed dimension does not move, so at every stop its box and its line must stay clear of every posed part.
 */
export function auditLabelPoses({ figure: name, explode, hull: restHull, pieces: base, labels, dims = [] }) {
	const findings = [];
	const push = message => void findings.push({ rule: "A7", figure: name, severity: "error", message });
	const failed = new Map();
	const fail = (message, gap) => {
		if (!failed.has(message)) failed.set(message, []);
		failed.get(message).push(gap);
	};
	const poses = scenePoses({ explode });
	const vectorOf = new Map(base.map(piece => [piece.partId, piece.explode]));
	for (const { gap, k } of poses) {
		const move = (point, vec) => (vec && k ? [point[0] + vec[0] * k, point[1] + vec[1] * k] : point);
		const pieces = base.map(piece => ({ partId: piece.partId, paints: piece.paints, hit: piece.hit.map(point => move(point, piece.explode)) }));
		const figure = k ? hull(pieces.flatMap(piece => piece.hit)) : restHull;
		const leaders = labels.map(label => [...label.points.slice(0, -1), move(label.points.at(-1), vectorOf.get(label.target))]);
		labels.forEach((label, i) => {
			const pts = leaders[i];
			const end = pts.at(-1);
			if (convexOverlap(boxPolygon(label.box), figure)) fail(`label "${label.text}" overlaps the figure; set labels[].side or move the part`, gap);
			const own = pieces.filter(piece => piece.partId === label.target);
			if (!nearPolygon(end, hull(own.flatMap(piece => piece.hit)), 2)) fail(`label "${label.text}" cannot reach "${label.target}"; set labels[].anchor`, gap);
			else {
				const after = pieces.slice(Math.max(...own.map(piece => pieces.indexOf(piece))) + 1);
				const cover = after.find(piece => piece.partId !== label.target && piece.hit.length >= 3 && (pointInPolygon(end, piece.hit) || distanceToPolygon(end, piece.hit) < LEADER_CLEAR));
				if (cover) fail(`label "${label.text}" leader ends under "${cover.partId}", not on a visible point of "${label.target}"; set labels[].anchor`, gap);
			}
			labels.forEach((other, j) => {
				if (j === i) return;
				for (let s = 1; s < pts.length; s++) if (segmentHitsBox(pts[s - 1], pts[s], other.box)) fail(`label "${label.text}" leader crosses "${other.text}"; set labels[].side`, gap);
				if (j > i && leadersCross(pts, leaders[j])) fail(`leaders of "${label.text}" and "${other.text}" cross; set labels[].side or labels[].anchor`, gap);
			});
		});
		for (const dim of dims) {
			const line = dim.line ? Array.from({ length: 17 }, (_, i) => [dim.line[0][0] + ((dim.line[1][0] - dim.line[0][0]) * i) / 16, dim.line[0][1] + ((dim.line[1][1] - dim.line[0][1]) * i) / 16]) : [];
			const hit = pieces.find(piece => piece.paints !== false && piece.hit.length >= 3 && (convexOverlap(boxPolygon(dim.box), piece.hit) || line.some(point => pointInPolygon(point, piece.hit))));
			if (hit) fail(`dimension "${dim.text}" overlaps "${hit.partId}"; move the dimension (dims[].offset or its from/to) or narrow interact.explode`, gap);
			// The dimension's extension lines, line and ticks (dim.strokes: polylines) must never cross a label's text box.
			const strokes = dim.strokes ?? (dim.line ? [dim.line] : []);
			const struck = labels.find(label => strokes.some(pts => pts.slice(1).some((point, s) => segmentHitsBox(pts[s], point, label.box))));
			if (struck) fail(`dimension "${dim.text}" runs through the label "${struck.text}"; route that label's leader elsewhere (labels[].side or labels[].anchor) or move the dimension`, gap);
		}
	}
	const fmt = gap => gap.toFixed(2);
	for (const [message, gaps] of failed) {
		const unique = [...new Set(gaps)];
		if (!explode || (unique.length === 1 && unique[0] === explode.rest)) push(message);
		else push(`${message.replace(/; set [^;]*$/, "")} at ${explode.unit} ${unique.length <= 3 ? unique.map(fmt).join(", ") : `${fmt(unique[0])}…${fmt(unique.at(-1))} (${unique.length} of ${poses.length} slider stops)`}; narrow interact.explode (min ${fmt(explode.min)}, max ${fmt(explode.max)}) or set labels[].anchor`);
	}
	return findings;
}
