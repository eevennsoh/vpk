// Coincident-outline check for the figure's face detail. Two different outlines whose straight edges run along the
// same line (or within a hairline of it) draw a doubled, kinked line, worst at corners with different radii.
import { surfaceDetails } from './eu26-hero.hero.mjs';

const NEAR = 1.5; // plan units: closer than this reads as one thick or doubled line at wall scale
const attr = (tag, name) => Number((tag.match(new RegExp(`\\s${name}="([\\d.-]+)"`)) || [])[1] ?? NaN);

export function rectsOf(markup) {
	return [...markup.matchAll(/<rect\b[^>]*>/g)].map(([tag]) => ({ x: attr(tag, 'x'), y: attr(tag, 'y'), w: attr(tag, 'width'), h: attr(tag, 'height'), r: attr(tag, 'rx') || 0, tag }));
}

const same = (a, b) => ['x', 'y', 'w', 'h'].every(k => Math.abs(a[k] - b[k]) < 0.05);
// The straight run of each edge, without its corner arcs.
const edges = a => [
	{ axis: 'y', at: a.y, from: a.x + a.r, to: a.x + a.w - a.r },
	{ axis: 'y', at: a.y + a.h, from: a.x + a.r, to: a.x + a.w - a.r },
	{ axis: 'x', at: a.x, from: a.y + a.r, to: a.y + a.h - a.r },
	{ axis: 'x', at: a.x + a.w, from: a.y + a.r, to: a.y + a.h - a.r },
];

export function coincidentEdges(face) {
	const outline = { x: 0, y: 0, w: face.w, h: face.d, r: face.r ?? 0, tag: '<face outline>' };
	const rects = [outline, ...rectsOf(face.markup)];
	const hits = [];
	for (let i = 0; i < rects.length; i += 1) for (let j = i + 1; j < rects.length; j += 1) {
		const a = rects[i], b = rects[j];
		if (same(a, b)) continue; // an identical overlay (a fill or highlight on its base) draws one line
		for (const ea of edges(a)) for (const eb of edges(b)) {
			if (ea.axis !== eb.axis || Math.abs(ea.at - eb.at) >= NEAR) continue;
			const overlap = Math.min(ea.to, eb.to) - Math.max(ea.from, eb.from);
			if (overlap > 0.5) hits.push({ face: face.name, a: a.tag.slice(0, 90), b: b.tag.slice(0, 90), axis: ea.axis, at: +ea.at.toFixed(2), gap: +Math.abs(ea.at - eb.at).toFixed(2) });
		}
	}
	return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const hits = surfaceDetails().flatMap(coincidentEdges);
	const byFace = Object.groupBy(hits, hit => hit.face);
	for (const [face, list] of Object.entries(byFace)) console.log(face, list.length, list.slice(0, 3).map(h => `${h.axis}=${h.at} gap ${h.gap} | ${h.a} | ${h.b}`).join('\n    '));
	console.log(`${hits.length} coincident edges on ${Object.keys(byFace).length} faces`);
}

// ---------- Containment ----------
// Every shape on a story card or bento tile sits inside its parent: the smallest earlier rectangle that holds the
// shape's centre, or the face itself. It keeps at least `inset` clear of that parent's edges (dividers may run to
// them), and a shape that is nearly centred in its parent is centred exactly, so equal margins read as equal.
const INSET = 4, NEARLY = 6, EXACT = 0.5;
const numbers = text => (text.match(/-?[\d.]+/g) || []).map(Number);

export function shapesOf(markup) {
	return [...markup.matchAll(/<(rect|circle|ellipse|path)\b[^>]*>/g)].map(([tag, kind]) => {
		const cls = (tag.match(/\sclass="([^"]*)"/) || [])[1] || '';
		if (kind === 'rect') return { kind, cls, tag, x0: attr(tag, 'x'), y0: attr(tag, 'y'), x1: attr(tag, 'x') + attr(tag, 'width'), y1: attr(tag, 'y') + attr(tag, 'height') };
		if (kind !== 'path') {
			const cx = attr(tag, 'cx'), cy = attr(tag, 'cy'), rx = attr(tag, kind === 'circle' ? 'r' : 'rx'), ry = attr(tag, kind === 'circle' ? 'r' : 'ry');
			return { kind, cls, tag, x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry };
		}
		const d = (tag.match(/\sd="([^"]*)"/) || [])[1] || '', xs = [], ys = [];
		// Half-circle arcs (rings) span their radius around the midpoint of their ends; M and L points are taken as is.
		let last = null;
		for (const [, op, args] of d.matchAll(/([MLAZ])([^MLAZ]*)/g)) {
			const v = numbers(args);
			if (op === 'A') {
				const [rx, ry, , , , x, y] = v, cx = (last[0] + x) / 2, cy = (last[1] + y) / 2;
				xs.push(cx - rx, cx + rx); ys.push(cy - ry, cy + ry); last = [x, y];
			} else if (v.length >= 2) for (let i = 0; i + 1 < v.length; i += 2) { xs.push(v[i]); ys.push(v[i + 1]); last = [v[i], v[i + 1]]; }
		}
		return { kind, cls, tag, line: !/Z/.test(d) && !/A/.test(d), x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
	});
}

export function containmentIssues(face) {
	const root = { tag: '<face>', x0: 0, y0: 0, x1: face.w, y1: face.d };
	const shapes = shapesOf(face.markup), issues = [];
	shapes.forEach((shape, index) => {
		const cx = (shape.x0 + shape.x1) / 2, cy = (shape.y0 + shape.y1) / 2;
		const parent = shapes.slice(0, index).filter(each => each.kind === 'rect' && each.x0 <= cx && cx <= each.x1 && each.y0 <= cy && cy <= each.y1 && (each.x1 - each.x0) * (each.y1 - each.y0) > (shape.x1 - shape.x0) * (shape.y1 - shape.y0))
			.sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0))[0] || root;
		const [left, top, right, bottom] = [shape.x0 - parent.x0, shape.y0 - parent.y0, parent.x1 - shape.x1, parent.y1 - shape.y1].map(value => Math.round(value * 100) / 100);
		const need = shape.line ? 0 : INSET, where = `${face.name}: ${shape.tag.slice(0, 80)} in ${parent.tag.slice(0, 60)}`;
		if (Math.min(left, top, right, bottom) < need - 0.01) issues.push(`${where} crosses or crowds its parent (margins ${left} ${top} ${right} ${bottom})`);
		if (!shape.line && Math.abs(left - right) > EXACT && Math.abs(left - right) <= NEARLY) issues.push(`${where} is nearly centred across (${left} / ${right})`);
		if (!shape.line && Math.abs(top - bottom) > EXACT && Math.abs(top - bottom) <= NEARLY) issues.push(`${where} is nearly centred down (${top} / ${bottom})`);
		// Outside a deliberately layered composition, a shape never straddles another rectangle's edge (a tab poking out of
		// the window it sits on): it is either inside it or clear of it.
		if (face.layered || shape.line) return;
		for (const other of shapes.slice(0, index)) {
			if (other.kind !== 'rect' || other === parent) continue;
			const clear = shape.x0 >= other.x1 || shape.x1 <= other.x0 || shape.y0 >= other.y1 || shape.y1 <= other.y0;
			const inside = shape.x0 >= other.x0 && shape.x1 <= other.x1 && shape.y0 >= other.y0 && shape.y1 <= other.y1;
			const around = other.x0 >= shape.x0 && other.x1 <= shape.x1 && other.y0 >= shape.y0 && other.y1 <= shape.y1;
			if (!clear && !inside && !around) issues.push(`${where} straddles the edge of ${other.tag.slice(0, 60)}`);
		}
	});
	return issues;
}
