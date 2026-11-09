// Face detail for the board chrome, the 23 story cards, the six bento tiles and the Team ’26 title: a wireframe of
// containers only (panels, inputs, pills, chart bars, rings), modelled on the production board's layout.
// No text or lettering; a few large hairline shapes per surface.
import { pen } from "./eu26-face-pen.mjs";

const wrap = markup => `<g data-eu26-detail aria-hidden="true" pointer-events="none" style="display:none"><g data-eu26-face>${markup}</g></g>`;

// ---------- Board chrome ----------
// The chrome slabs already are the outlined top bar, header band and four columns, so they carry no inner detail.
export function chromeDetail() {
	return "";
}

// ---------- Story cards: a cover of a few containers (in a 170 x 74 box) above an empty title band ----------
// Within a column, the visible rows (0-3) each lead with a different container family (window, ring, split, stack,
// list, media, pill, bars, grid), so no two neighbours share a silhouette at thumbnail size.
export const COVERS = {
	"TEU-1": p => { p.rect(47, 7, 76, 60, 5, "dw"); p.pill(53, 13, 64, 12); p.rect(53, 35, 64, 11, 3, "dp"); },
	"TEU-101": p => { p.line(43, 37, 58, 37, "df"); p.line(112, 37, 127, 37, "df"); p.circle(30, 37, 13, "dw"); p.ring(85, 37, 27, 15, "dw"); p.circle(140, 37, 13, "dw"); },
	"TEU-2": p => { p.rect(8, 8, 38, 58, 4, "dw"); p.rect(52, 8, 110, 58, 4, "dw"); },
	"TEU-4": p => { p.rect(8, 22, 66, 44, 4, "dp"); p.rect(96, 8, 66, 44, 4, "dp"); p.rect(42, 13, 86, 48, 4, "dw"); },
	"TEU-102": p => { p.pill(14, 8, 142, 16, "dw"); p.rect(14, 29, 142, 16, 3, "dw"); p.rect(14, 50, 142, 16, 3, "dw"); },
	"TEU-3": p => { p.rect(14, 24, 142, 26, 6, "dw"); },
	"TEU-103": p => { p.rect(12, 8, 66, 58, 4, "dw"); p.circle(45, 30, 11); },
	"TEU-104": p => { p.rect(28, 8, 100, 16, 6, "dw"); p.rect(46, 29, 100, 16, 6, "dp"); p.rect(28, 50, 80, 16, 6, "dw"); },
	"TEU-105": p => { p.rect(22, 8, 126, 16, 4, "dw"); p.rect(22, 29, 126, 16, 4, "dw"); p.rect(22, 50, 126, 16, 4, "dw"); },
	"TEU-5": p => { p.rect(18, 6, 134, 62, 5, "dw"); p.circle(85, 37, 13, "dp"); p.circle(37, 51, 10, "dw"); },
	"TEU-106": p => { p.pill(6, 26, 158, 22, "dw"); p.pill(98, 30, 62, 14, "dp"); },
	"TEU-7": p => { p.rect(6, 8, 158, 36, 4, "dw"); p.rect(60, 14, 70, 8, 2, "dp"); p.pill(56, 52, 70, 14, "dw"); },
	"TEU-8": p => { p.rect(10, 6, 150, 62, 4, "dp"); p.pill(20, 50, 64, 12, "dw"); p.circle(144, 55, 9, "dw"); },
	"TEU-107": p => { p.rect(6, 8, 76, 58, 4, "dw"); p.pill(12, 52, 40, 9, "dp"); p.rect(88, 12, 76, 50, 4, "dp"); },
	"TEU-9": p => { p.rect(12, 8, 112, 58, 4, "dw"); p.line(12, 18, 124, 18, "df"); p.circle(128, 48, 19, "dp"); },
	"TEU-10": p => { p.rect(14, 8, 52, 9, 3, "dw"); p.rect(14, 21, 142, 32, 5, "dw"); p.rect(14, 57, 142, 9, 2, "dp"); },
	"TEU-11": p => { p.rect(26, 6, 140, 62, 4, "dw"); p.bars(44, 18, 116, 44, [0.5, 0.72, 0.95, 0.6]); },
	"TEU-109": p => { p.ring(40, 37, 26, 15, "dw"); p.rect(80, 14, 78, 18, 4, "dw"); p.rect(80, 42, 54, 18, 4, "dw"); },
	"TEU-111": p => { p.rect(10, 8, 86, 58, 4, "dw"); p.rect(102, 8, 58, 26, 4, "dw"); p.rect(102, 40, 58, 26, 4, "dp"); },
	"TEU-108": p => { p.ring(85, 37, 28, 22); p.pill(96, 54, 64, 10, "dw"); },
	"TEU-112": p => { p.rect(30, 6, 110, 62, 4, "dw"); p.pill(36, 16, 98, 6, "dp"); },
	"TEU-12": p => { p.rect(24, 6, 122, 62, 4, "dw"); p.ring(54, 37, 22, 14); p.rect(86, 20, 52, 34, 3, "df"); },
	"TEU-13": p => { p.poly([[38, 14], [58, 20], [56, 44], [38, 60], [20, 44], [18, 20]]); p.rect(70, 8, 92, 58, 4, "dw"); },
};

// Covers and tiles drawn as a deliberate overlapping stack (windows fanned over each other, a badge over its window);
// everywhere else a container sits wholly inside or wholly clear of every other one (face-overlap.test.mjs).
export const LAYERED = new Set(["TEU-4", "TEU-9", "artifacts"]);

export function cardDetail(card, story) {
	const [code] = story;
	const p = pen();
	p.rect(5, 5, card.w - 10, 74, 3, "dp");
	(COVERS[code] || COVERS["TEU-2"])(p.sub(5, 5));
	p.circle(card.w - 15, 99, 6);
	return wrap(p.markup());
}

// ---------- Bento tiles and the title ----------
export const TILES = {
	sessions(p) { p.rect(16, 26, 188, 148, 6, "dp"); p.rect(24, 34, 72, 18, 5, "dw"); p.rect(24, 58, 172, 50, 6, "dw"); p.rect(24, 114, 172, 16, 0, "df"); p.rect(24, 136, 172, 30, 6, "dw"); },
	artifacts(p) { p.rect(118, 24, 96, 64, 4, "dp"); p.rect(12, 92, 92, 70, 4, "dp"); p.rect(62, 50, 112, 92, 5, "dw"); p.rect(66, 54, 104, 60, 3, "dp"); },
	chat(p) { p.rect(26, 22, 168, 14, 5, "df"); p.rect(16, 42, 188, 36, 6, "dw"); p.circle(33, 60, 9); p.rect(26, 84, 168, 28, 5, "df"); },
	cost(p) { p.rect(16, 26, 188, 148, 6, "dw"); p.ring(54, 80, 30, 20); p.rect(100, 50, 96, 60, 4, "df"); p.pill(24, 150, 172, 8); },
	chart(p) { p.rect(16, 26, 188, 148, 6, "dw"); p.bars(28, 46, 164, 48, [0.62, 0.55, 0.6, 0.72, 0.92]); p.rect(24, 108, 172, 58, 4, "df"); },
	record(p) { p.pill(12, 50, 196, 34, "dw"); p.pill(108, 55, 94, 24, "dp"); },
};

export function tileDetail(feature, { sx = 1, sy = sx } = {}) {
	const p = pen(0, 0, sx, sy);
	TILES[feature.kind](p);
	return p.markup();
}

// The one lettered face: the Team ’26 lockup, two bold lines centred on the tile both ways. Two static <text> nodes
// inside the tile's matrix group cost a negligible relayout, so no glyph table is needed. Line spacing is set from the
// type size, not the plate's y scale, so the wall slot's copy matches the dragged tile exactly; data-cx/cy name the
// block centre the scene counter-scales about while the plate changes shape.
export function titleDetail({ w = 220, d = 96, sx = 1, sy = sx } = {}) {
	const p = pen(0, 0, sx, sy), size = Math.round(d * 0.3 * Math.min(sx, sy) * 100) / 100;
	const [cx, cy] = p.at(w / 2, d / 2), lead = size * 1.08, cap = size * 0.72;
	const first = Math.round((cy - (lead + cap) / 2 + cap) * 100) / 100, second = Math.round((first + lead) * 100) / 100;
	const attrs = `class="dtt" text-anchor="middle" x="${cx}" font-size="${size}" data-cx="${cx}" data-cy="${cy}"`;
	return `<text ${attrs} y="${first}">Team ’26</text><text ${attrs} y="${second}">Europe</text>`;
}

export const wrapDetail = wrap;
