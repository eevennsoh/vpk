// iso/manual-scene — part of the scene model for the kit's one style, `manual` (P5; split out of scene.mjs so every iso
// module stays under the 500-line rule). It holds the marks, dims and scale brief fields (validation and the scale bar's
// geometry), the two fit passes that shrink a figure to its frame (`fitNear` for the label gutters,
// `fitHeight` for the viewBox height) and `homePiece`. scene.mjs owns the build; the fit passes take its `rebuild(gutters,
// viewBox)` so this module never imports it.

import { iso } from "../anatomy/vendor/kit/iso-kit.mjs";
import { pointInPolygon } from "./core.mjs";
import { MANUAL_TAG_RADIUS, NARROW_STAGE_PX, NARROW_TEXT_FLOOR_PX, TAG_FONT } from "./emit.mjs";
import { hullExtent, labelBox, spread } from "./layout.mjs";

const isNum = value => typeof value === "number" && Number.isFinite(value);
const isVec = (value, n = 3) => Array.isArray(value) && value.length === n && value.every(isNum);

// Marks, dims and scale brief fields (illustrations.md § Style).
export const MAX_MARKS = 12;
export const MAX_DIMS = 8;

export function validateMarks(marks, known, push) {
	if (marks === undefined) return;
	if (!Array.isArray(marks) || marks.length > MAX_MARKS) return push(`marks must be an array of at most ${MAX_MARKS} marks`);
	const seen = new Set();
	marks.forEach((mark, index) => {
		const at = `marks[${index}]`;
		if (!mark || typeof mark !== "object") return push(`${at} must be an object`);
		if (!known.has(mark.target)) push(`${at}.target ${JSON.stringify(mark.target)} must name a part`);
		if (mark.at !== undefined && !isVec(mark.at)) push(`${at}.at must be [x, y, z]`);
		if (mark.offset !== undefined && !(isVec(mark.offset, 2) && mark.offset.every(value => Math.abs(value) <= 200))) push(`${at}.offset must be [dx, dy] within ±200`);
		if (mark.n !== undefined) {
			if (!(Number.isInteger(mark.n) && mark.n >= 1 && mark.n <= 99)) push(`${at}.n must be an integer within 1–99`);
			else if (seen.has(mark.n)) push(`${at}.n ${mark.n} is used by another mark`);
			else seen.add(mark.n);
		}
	});
}

export function validateDims(dims, push) {
	if (dims === undefined) return;
	if (!Array.isArray(dims) || dims.length > MAX_DIMS) return push(`dims must be an array of at most ${MAX_DIMS} dimensions`);
	dims.forEach((dim, index) => {
		const at = `dims[${index}]`;
		if (!dim || typeof dim !== "object") return push(`${at} must be an object`);
		if (!isVec(dim.from) || !isVec(dim.to)) push(`${at} needs from and to as [x, y, z]`);
		if (typeof dim.text !== "string" || !dim.text.trim() || dim.text.length > 40) push(`${at}.text must be a non-empty string of ≤ 40 chars`);
		if (dim.offset !== undefined && !(isNum(dim.offset) && Math.abs(dim.offset) <= 80)) push(`${at}.offset must be within ±80`);
	});
}

export function validateScale(scale, push) {
	if (scale === undefined) return;
	if (!scale || typeof scale !== "object") return push("scale must be an object { length, text }");
	if (!(isNum(scale.length) && scale.length > 0)) push("scale.length must be a positive number of world units");
	if (typeof scale.text !== "string" || !scale.text.trim() || scale.text.length > 24) push("scale.text must be a non-empty string of ≤ 24 chars (the real length, for example \"1,000 px\")");
	if (scale.at !== undefined && !isVec(scale.at)) push("scale.at must be [x, y, z]");
}

// The scale bar: `length` world units along +x from `at`, tick-ended, with its real length in mono after the far end.
export function scaleGeometry(spec, at, P, font) {
	const a = iso(at, P);
	const b = iso([at[0] + spec.length, at[1], at[2]], P);
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
	const n = [-u[1], u[0]];
	const text = spec.text;
	const textX = b[0] + 10;
	const textY = b[1];
	return { a, b, u, n, ticks: [a, b].map(([x, y]) => [[x - n[0] * 5, y - n[1] * 5], [x + n[0] * 5, y + n[1] * 5]]), text, textX, textY: textY + font.size * 0.35, box: labelBox({ x: textX, y: textY, text, anchor: "start" }, font) };
}

// The [piece, index] whose group carries a tag or mark on `point`: the first of the target's pieces whose silhouette holds
// it, the last one in painter order, so a tag on a tray's near wall rides in the front piece instead of being painted under it.
export function homePiece(pieces, target, point) {
	const own = pieces.map((piece, at) => [piece, at]).filter(([piece]) => piece.partId === target);
	const holds = ([piece]) => piece.hit.length >= 3 && pointInPolygon(point, piece.hit);
	return own.filter(holds).at(-1) ?? own.at(-1);
}

const MARK_OFFSET = 34;
const round = (value, step = 10) => Math.round(value * step) / step;

// Numbered marks: a disc on a short leader to a visible point of the target; each rides inside its target's part group, so
// it moves with the part. A mark's n is its explicit `n`, else its place in the list. `anchorFor(spec)` is the scene's
// visible-point chooser ({ point, visible }).
export function buildMarks(specs, { pieces, hullCentre, warnings, anchorFor }) {
	return specs.map((spec, index) => {
		const choice = anchorFor(spec);
		if (!choice.visible) warnings.push(`marks[${index}]: no visible point on "${spec.target}"; anchored at its top centre (set marks[${index}].at)`);
		const point = choice.point;
		let offset = spec.offset;
		if (!offset) {
			const away = [point[0] - hullCentre[0], point[1] - hullCentre[1]];
			const length = Math.hypot(away[0], away[1]) || 1;
			offset = away[0] || away[1] ? [round((away[0] / length) * MARK_OFFSET), round((away[1] / length) * MARK_OFFSET)] : [0, -MARK_OFFSET];
		}
		const home = homePiece(pieces, spec.target, point);
		return { n: spec.n ?? index + 1, target: spec.target, point, disc: [point[0] + offset[0], point[1] + offset[1]], piece: home ? home[1] : -1 };
	});
}

const NEAR_FIT_PASSES = 4;

// Labels hug the figure, so reserving the widest label's width on both sides (the default gutter) leaves
// the drawing far smaller than the frame needs. After a first build, shrink each gutter by the free space between the
// outermost label or hull point and the camera pad, rebuild, and keep the last build in which no label crosses the pad.
export function fitNear(scene, rebuild) {
	const [width] = scene.viewBox;
	const room = built => {
		const xs = [...built.hull.map(([x]) => x), ...built.labels.flatMap(({ box }) => [box.x, box.x + box.w])];
		return { left: Math.min(...xs) - built.pad, right: width - built.pad - Math.max(...xs) };
	};
	const worst = built => Math.min(room(built).left, room(built).right);
	const fits = built => worst(built) >= -0.5;
	let current = scene;
	let best = scene;
	for (let pass = 0; pass < NEAR_FIT_PASSES; pass++) {
		const free = room(current);
		if (Math.abs(free.left) < 2 && Math.abs(free.right) < 2) break;
		current = rebuild({ left: Math.max(0, current.gutters.left - free.left), right: Math.max(0, current.gutters.right - free.right) }, scene.viewBox);
		if (fits(best) ? fits(current) && current.P.scale > best.P.scale : fits(current) || worst(current) > worst(best)) best = current;
	}
	return best;
}

// Everything a figure draws or can reach, top to bottom: the projected poses (explode, lift and the assembly start),
// the rest hull, and every label, dimension box, mark disc and scale bar.
const MARK_REACH = 13;
function drawnRange(built) {
	const ys = [
		...built.poseYs,
		...built.hull.map(([, y]) => y),
		...built.labels.flatMap(({ box }) => [box.y, box.y + box.h]),
		...built.dims.flatMap(({ box, a2, b2 }) => [box.y, box.y + box.h, a2[1], b2[1]]),
		...(built.scaleBar ? [built.scaleBar.box.y, built.scaleBar.box.y + built.scaleBar.box.h, built.scaleBar.a[1], built.scaleBar.b[1]] : []),
		...built.marks.flatMap(({ disc }) => [disc[1] - MARK_REACH, disc[1] + MARK_REACH]),
	];
	return [Math.min(...ys), Math.max(...ys)];
}

const HEIGHT_MARGIN = 16;
const MIN_HEIGHT = 160;

// A figure fills its frame like B's: a wide, shallow figure in the brief's 720 × 450 viewBox leaves a band of
// empty paper above and below it. After the gutters are fitted, shrink the viewBox height to the drawing plus a margin and
// rebuild (the scale stays: the width, not the height, limits a figure that has slack). A rebuild re-centres the poses,
// not the labels, so a build whose labels come within half a margin of an edge is rejected and the height grows.
export function fitHeight(scene, rebuild) {
	const [width, original] = scene.viewBox;
	// The camera pad is the margin the projection itself keeps around the poses, so a smaller one would shrink the scale.
	const margin = Math.max(HEIGHT_MARGIN, scene.pad);
	let best = scene;
	let extra = 0;
	for (let pass = 0; pass < 4; pass++) {
		const [lo, hi] = drawnRange(best);
		const want = Math.min(original, Math.max(MIN_HEIGHT, Math.ceil(hi - lo + 2 * margin + extra)));
		if (Math.abs(want - best.viewBox[1]) <= 2) break;
		const next = rebuild(scene.gutters, [width, want]);
		const [nlo, nhi] = drawnRange(next);
		if (nlo >= margin / 2 && nhi <= want - margin / 2 && next.P.scale >= scene.P.scale - 1e-6) best = next;
		else extra += 2 * Math.max(margin / 2 - nlo, nhi - (want - margin / 2), 2);
	}
	return best;
}

// Narrow stage (r1.7/r1.8): each numbered tag is an ink disc in the free gutter beside the hull, on a straight 1 px
// leader that ends in a dot on the part; it is drawn in the labels layer (never inside a part group or a clip window) and
// the runtime drags the leader's last point with the part. The crop and the disc size depend on each other (the disc grows
// with the zoom the crop gives, and the crop must hold the disc), so they are settled together in a few passes.
const TAG_GAP = 10;
const TAG_PASSES = 3;
export function narrowTagLayout({ tags, labels, hull, width, height, xs, cropPad, minZoom }) {
	if (!labels.length) return { tags, crop: null };
	let pad = cropPad;
	let box = [0, width];
	let scale = 1;
	for (let pass = 0; pass < TAG_PASSES; pass++) {
		box = [Math.max(0, Math.min(...xs) - pad), Math.min(width, Math.max(...xs) + pad)];
		scale = Math.max(1, Math.ceil(((NARROW_TEXT_FLOOR_PX * 1.05) / (TAG_FONT * (NARROW_STAGE_PX / (box[1] - box[0])))) * 100) / 100);
		pad = Math.max(cropPad, 2 * MANUAL_TAG_RADIUS * scale + TAG_GAP + 4);
	}
	const radius = MANUAL_TAG_RADIUS * scale;
	const rows = labels.map((label, order) => ({ side: label.side, order, y: label.rowY }));
	for (const side of ["left", "right"]) spread(rows.filter(row => row.side === side), radius + 2, height - radius - 2, 2 * radius + 4);
	const placed = tags.map((tag, index) => {
		const row = rows[index];
		const [minX, maxX] = hullExtent(hull, row.y, radius + 2);
		const cx = row.side === "left" ? minX - radius - TAG_GAP : maxX + radius + TAG_GAP;
		const disc = [Math.min(box[1] - radius - 2, Math.max(box[0] + radius + 2, cx)), row.y];
		const [px, py] = tag.point;
		const length = Math.hypot(px - disc[0], py - disc[1]) || 1;
		const start = [disc[0] + ((px - disc[0]) / length) * (radius + 1), disc[1] + ((py - disc[1]) / length) * (radius + 1)];
		return { ...tag, piece: -1, disc, start };
	});
	const crop = width / (box[1] - box[0]) >= minZoom ? { width: Math.round((width / (box[1] - box[0])) * 1e3) / 10, offset: Math.round((-box[0] / (box[1] - box[0])) * 1e3) / 10 } : null;
	return { tags: placed, crop };
}
