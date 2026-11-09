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
