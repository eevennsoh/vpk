// iso/manual-audit — audit rules for the kit's one style (P5; split out of audit.mjs so every iso module stays under the
// 500-line rule): A18 (the focal part renders something a reader can see), A19 (the detail budget), A20 (leader ink) and A21
// (cast shadows). Each reads the structures
// auditSvg already built, passed in as `ctx`:
//   { elements, parts, faces, facePart, hullOf, clipOf, focalUnits, push }

import { pointInPolygon } from "./core.mjs";
import { distanceToPolygon } from "./layout.mjs";
import { ancestor, attr, has, norm, partOf, pointsOf, unitName } from "./audit-markup.mjs";
import { SHADOW } from "./accent.mjs";
import { ISO_THRESHOLDS } from "./thresholds.mjs";

// A18: the share of a focal part's silhouette that must stay uncovered when no stroke of it shows.
export const FOCAL_MIN_VISIBLE = 0.3;
export const paintedValue = value => value !== undefined && !/^(none|transparent)$/i.test(String(value).trim());

// A 12 x 12 grid of cell centres inside a polygon, and points along a polyline (vertices and midpoints).
function gridInside(poly, count = 12) {
	const xs = poly.map(([x]) => x);
	const ys = poly.map(([, y]) => y);
	const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
	const [w, h] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
	const points = [];
	for (let i = 0; i < count; i++) for (let j = 0; j < count; j++) {
		const point = [x0 + (w * (i + 0.5)) / count, y0 + (h * (j + 0.5)) / count];
		if (pointInPolygon(point, poly)) points.push(point);
	}
	return points;
}

const strokeSamples = points => points.flatMap((point, i) => (i ? [[(point[0] + points[i - 1][0]) / 2, (point[1] + points[i - 1][1]) / 2], point] : [point]));

// A18 the focal part renders something a reader can see (B2 decision 28: a flash ring was once emitted, clipped away
// by a window it never crossed, and passed every other check). It needs a painted fill or stroke, and either a
// stroke point or at least FOCAL_MIN_VISIBLE of its silhouette inside its clip window and not covered by a part painted
// later. Rest pose only, like A5.
export function auditFocalVisible({ elements, parts, faces, facePart, hullOf, clipOf, focalUnits, push }) {
	for (const unit of focalUnits) {
		const members = parts.filter(part => unitName(part) === unit);
		let painted = false;
		let strokeSeen = false;
		let inside = 0;
		let shown = 0;
		for (const part of members) {
			const later = parts.slice(parts.indexOf(part) + 1).filter(other => unitName(other) !== unit && faces.some(face => facePart.get(face) === other && paintedValue(attr(face, "fill"))));
			const visibleAt = point => later.every(other => !pointInPolygon(point, hullOf.get(other)));
			const ownFaces = faces.filter(face => facePart.get(face) === part && paintedValue(attr(face, "fill")));
			const ownStrokes = elements.filter(el => partOf(el) === part && ["edge", "crease"].includes(attr(el, "data-vpk-iso-role")) && paintedValue(attr(el, "stroke")) && Number(attr(el, "stroke-width") ?? 1) > 0);
			if (ownFaces.length || ownStrokes.length) painted = true;
			const silhouette = hullOf.get(part);
			const window = clipOf(part);
			if (ownFaces.length && silhouette.length >= 3) {
				for (const point of gridInside(silhouette)) {
					// A window that misses the silhouette leaves hullOf at the whole shape; those points are clipped away.
					if (window && !pointInPolygon(point, window)) continue;
					inside++;
					if (visibleAt(point)) shown++;
				}
			}
			for (const stroke of ownStrokes) {
				for (const point of strokeSamples(pointsOf(stroke))) if ((!window || pointInPolygon(point, window)) && visibleAt(point)) strokeSeen = true;
			}
		}
		if (!painted) push("A18", `focal part "${unit}" paints nothing (every fill and stroke is none)`);
		else if (!strokeSeen && !(inside > 0 && shown / inside >= FOCAL_MIN_VISIBLE)) {
			push("A18", `focal part "${unit}" renders nothing a reader can see: ${inside ? `${Math.round((shown / inside) * 100)}% of its fill is uncovered and no stroke shows` : "its fill and strokes fall outside its clip window"}; fix clipTo, clipPad, the part order or the anchor`);
		}
	}
}

// A19 the detail budget (rule 3), a segment count instead of a mark count: every part keeps all its detail, merged into one
// path per role, and A19 counts the drawn segments of its detail roles (each L after an M). A part warns above
// DETAIL_SEGMENTS.warn and fails above DETAIL_SEGMENTS.fail; the whole figure fails above DETAIL_SEGMENTS.figure.
export const DETAIL_ROLES = Object.freeze(["mark", "dot", "recess", "hatch"]);
export const DETAIL_SEGMENTS = Object.freeze({ warn: ISO_THRESHOLDS.detailSegmentsWarn, fail: ISO_THRESHOLDS.detailSegmentsFail, figure: ISO_THRESHOLDS.detailSegmentsFigureFail });
// Each L is a segment; a dot (detail.mjs: one closed pair of arcs, "a…a…") counts as one.
export const segmentCount = d => (String(d ?? "").match(/L/g) ?? []).length + Math.floor((String(d ?? "").match(/a/g) ?? []).length / 2);
export function auditDetailBudget({ elements, push }) {
	const segmentsOf = new Map();
	for (const el of elements.filter(item => DETAIL_ROLES.includes(attr(item, "data-vpk-iso-role")))) {
		const part = partOf(el);
		const name = part ? unitName(part) : "(figure)";
		segmentsOf.set(name, (segmentsOf.get(name) ?? 0) + segmentCount(attr(el, "d")));
	}
	let total = 0;
	for (const [name, count] of segmentsOf) {
		total += count;
		if (count > DETAIL_SEGMENTS.fail) push("A19", `part "${name}" draws ${count} detail segments; at most ${DETAIL_SEGMENTS.fail} per part`);
		else if (count > DETAIL_SEGMENTS.warn) push("A19", `part "${name}" draws ${count} detail segments, above the ${DETAIL_SEGMENTS.warn} per-part warning`, "warning");
	}
	if (total > DETAIL_SEGMENTS.figure) push("A19", `the figure draws ${total} detail segments; at most ${DETAIL_SEGMENTS.figure}`);
}

// A20 a label's leader dot sits on visible ink of its target: inside a painted fill face, or within INK_REACH of a
// stroke, in both cases inside the target's clip window. A dot that floats beside a stroke-only part (the flash ring's arc)
// names nothing. `labels` = [{ g, target, end }] in viewBox units.
export const INK_REACH = 2.5;
const segmentGap = ([px, py], [ax, ay], [bx, by]) => {
	const dx = bx - ax;
	const dy = by - ay;
	const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
export function auditLeaderInk({ elements, parts, faces, facePart, clipOf, labels, push }) {
	for (const { target, end, text } of labels) {
		let inked = false;
		for (const part of parts.filter(item => unitName(item) === target)) {
			const window = clipOf(part);
			if (window && !pointInPolygon(end, window) && distanceToPolygon(end, window) > 0.5) continue;
			if (faces.some(face => facePart.get(face) === part && paintedValue(attr(face, "fill")) && !/^url\(/.test(attr(face, "fill")) && pointInPolygon(end, pointsOf(face)))) inked = true;
			for (const el of elements.filter(item => partOf(item) === part && ["edge", "crease"].includes(attr(item, "data-vpk-iso-role")) && paintedValue(attr(item, "stroke")))) {
				const points = pointsOf(el);
				for (let i = 1; i < points.length; i++) if (segmentGap(end, points[i - 1], points[i]) <= INK_REACH + Number(attr(el, "stroke-width") ?? 1) / 2) inked = true;
			}
		}
		if (!inked) push("A7", `label "${text}" leader dot is not on visible ink of "${target}" (a stroke or painted fill inside its clip window); set labels[].anchor to a point on the stroke`);
	}
}

// A21 cast shadows (illustrations.md § Shadows). Two kinds, each a flat path with no stroke, filter, opacity or transform of its
// own (one opaque fill per group, so overlaps merge instead of darkening):
// - ground shadows sit in the one g[data-vpk-iso-shadows], filled SHADOW.TONE, painted before every part;
// - received shadows (a part above blocks the light from a part's top face) sit in a g[data-vpk-iso-received] directly inside
//   the receiving part's group, filled SHADOW.RECEIVED and clipped to that part's top face (clip-path to a local clipPath), and
//   the caster stands above the receiver (its part paints later, or is the same unit's front).
// A shadow names a part with faces; line-only parts (a gap outline, a ring) cast none. A figure without shadows only warns.
const SHADOW_FORBIDDEN = ["stroke", "stroke-width", "stroke-dasharray", "filter", "opacity", "fill-opacity", "transform", "style", "mask", "clip-path"];
const RECEIVED_FORBIDDEN = SHADOW_FORBIDDEN.filter(name => name !== "clip-path");
export function auditShadows({ elements, parts, faces, facePart, push }) {
	// A shadow with display="none" belongs to a variant, turn sample or part the rest state does not show (step and scrub figures).
	const shadows = elements.filter(el => attr(el, "data-vpk-iso-role") === "shadow" && attr(el, "display") !== "none");
	const casters = parts.filter(part => faces.some(face => facePart.get(face) === part));
	if (!shadows.length) {
		if (casters.length) push("A21", "no cast shadows; every part with faces casts a flat shadow onto the ground (rebuild with build-figure.mjs)", "warning");
		return;
	}
	const groups = elements.filter(el => has(el, "data-vpk-iso-shadows"));
	const firstPart = parts.length ? Math.min(...parts.map(part => part.index)) : Infinity;
	if (groups.length !== 1) push("A21", `${groups.length} shadow groups; one g[data-vpk-iso-shadows] holds every ground shadow`);
	else if (groups[0].index > firstPart) push("A21", "the shadow group paints after a part; ground shadows sit under every part (paint the group first)");
	if (groups.length === 1) {
		if (norm(attr(groups[0], "fill") ?? SHADOW.TONE) !== SHADOW.TONE) push("A21", `the shadow group is filled ${attr(groups[0], "fill")}, not the one shadow tone ${SHADOW.TONE}`);
		for (const name of SHADOW_FORBIDDEN) if (has(groups[0], name)) push("A21", `the shadow group carries ${name}; shadows are one flat fill with no stroke, filter, opacity or transform`);
	}
	for (const group of elements.filter(el => has(el, "data-vpk-iso-received"))) {
		const owner = partOf(group);
		const where = owner ? `on "${unitName(owner)}"` : "outside every part";
		if (!owner || group.parent !== owner) push("A21", `received shadows ${where} must sit directly inside the receiving part's group`);
		if (norm(attr(group, "fill") ?? "") !== SHADOW.RECEIVED) push("A21", `received shadows ${where} are filled ${attr(group, "fill")}, not the one received tone ${SHADOW.RECEIVED}`);
		for (const name of RECEIVED_FORBIDDEN) if (has(group, name)) push("A21", `received shadows ${where} carry ${name}; a shadow is one flat fill with no stroke, filter, opacity or transform`);
		const clip = /^url\(#([\w-]+)\)$/.exec(attr(group, "clip-path") ?? "")?.[1];
		const window = clip ? elements.find(el => el.name.toLowerCase() === "clippath" && attr(el, "id") === clip)?.children.find(el => el.name === "path") : null;
		const top = owner ? elements.find(el => partOf(el) === owner && attr(el, "data-vpk-iso-role") === "top") : null;
		if (!window) push("A21", `received shadows ${where} are not clipped to the receiving top face (clip-path to a local clipPath)`);
		else if (top && !pointsOf(window).every(point => pointInPolygon(point, pointsOf(top)) || distanceToPolygon(point, pointsOf(top)) <= 1)) push("A21", `received shadows ${where} are clipped to a window outside that part's top face`);
	}
	const faceless = new Set(parts.filter(part => !casters.includes(part)).map(unitName));
	const named = new Set(casters.map(unitName));
	for (const el of shadows) {
		const of = attr(el, "data-vpk-iso-shadow-for");
		const received = ancestor(el, item => has(item, "data-vpk-iso-received"));
		if (el.name !== "path") push("A21", `<${el.name} data-vpk-iso-role="shadow">: a shadow is a flat path`);
		for (const name of SHADOW_FORBIDDEN) if (has(el, name)) push("A21", `shadow for "${of}" carries ${name}; a shadow is one flat fill with no stroke, filter, opacity or transform`);
		if (faceless.has(of) && !named.has(of)) push("A21", `"${of}" is line work (a gap outline or a ring) and casts no shadow`);
		else if (!named.has(of)) push("A21", `shadow names "${of}", which is no part with faces`);
		if (received) {
			if (has(el, "fill")) push("A21", `received shadow for "${of}" carries its own fill; it takes the group's received tone`);
			const owner = partOf(received);
			const caster = parts.find(part => unitName(part) === of && part !== owner);
			if (owner && unitName(owner) === of) push("A21", `"${of}" receives its own shadow`);
			else if (owner && caster && Math.max(...parts.filter(part => unitName(part) === of).map(part => part.index)) < owner.index) push("A21", `"${of}" paints before "${unitName(owner)}", so it does not stand above it to shadow its top`);
			continue;
		}
		const fill = attr(el, "fill") ?? attr(ancestor(el, item => has(item, "fill")) ?? el, "fill");
		if (norm(fill ?? "") !== SHADOW.TONE) push("A21", `shadow for "${of}" is filled ${fill}, not the one shadow tone ${SHADOW.TONE}`);
		if (partOf(el)) push("A21", `shadow for "${of}" sits inside part "${unitName(partOf(el))}" outside a received group; ground shadows belong to the shadow group, under every part`);
		if (!ancestor(el, item => has(item, "data-vpk-iso-shadows"))) push("A21", `shadow for "${of}" is outside g[data-vpk-iso-shadows]`);
	}
}
