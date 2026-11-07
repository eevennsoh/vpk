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
const two = p => { p.rect(22, 8, 62, 62, 4, "dw"); p.rect(90, 8, 62, 62, 4, "dw"); };
const toolbar = p => { p.pill(22, 26, 126, 22, "dw"); p.pill(96, 30, 48, 14, "dp"); };
const COVERS = {
	"TEU-1": p => { p.rect(50, 8, 76, 66, 5, "dw"); p.pill(56, 14, 64, 12); p.rect(56, 36, 64, 11, 3, "dp"); },
	"TEU-101": two,
	"TEU-2": p => { p.rect(12, 24, 146, 28, 5, "dw"); },
	"TEU-4": p => { for (let i = 0; i < 3; i += 1) p.rect(6 + i * 54, 8, 50, 60, 3, i === 1 ? "dp" : "dw"); },
	"TEU-102": p => { p.pill(14, 8, 142, 14, "dw"); p.rect(14, 28, 142, 16, 3, "dw"); p.rect(14, 50, 142, 16, 3, "dw"); },
	"TEU-3": p => { p.rect(14, 24, 142, 26, 6, "dw"); },
	"TEU-103": p => { p.rect(12, 8, 66, 62, 4, "dw"); p.circle(45, 30, 11); },
	"TEU-104": p => { p.rect(28, 8, 100, 18, 6, "dw"); p.rect(46, 32, 100, 18, 6, "dp"); p.rect(28, 56, 80, 14, 6, "dw"); },
	"TEU-105": p => { p.rect(14, 18, 142, 38, 6, "dw"); },
	"TEU-5": toolbar,
	"TEU-106": p => { p.pill(6, 26, 158, 22, "dw"); p.pill(98, 30, 62, 14, "dp"); },
	"TEU-7": p => { p.rect(6, 8, 158, 36, 4, "dw"); p.rect(60, 14, 70, 8, 2, "dp"); p.pill(56, 52, 70, 14, "dw"); },
	"TEU-8": p => { p.rect(10, 6, 150, 64, 4, "dp"); p.pill(20, 50, 64, 12, "dw"); p.circle(144, 56, 9, "dw"); },
	"TEU-107": p => { p.rect(6, 8, 76, 62, 4, "dw"); p.pill(12, 54, 40, 9, "dp"); p.rect(88, 14, 76, 50, 4, "dp"); },
	"TEU-9": p => { p.rect(14, 6, 142, 66, 4, "dw"); p.line(14, 14, 156, 14, "df"); p.rect(64, 20, 84, 36, 2, "dp"); },
	"TEU-10": p => { p.rect(36, 18, 120, 44, 5, "dw"); p.rect(44, 62, 104, 12, 0, "dp"); p.rect(26, 10, 56, 15, 4, "dw"); },
	"TEU-11": p => { p.rect(26, 4, 140, 70, 4, "dw"); p.bars(44, 18, 116, 52, [0.5, 0.72, 0.95, 0.6]); },
	"TEU-109": two,
	"TEU-111": p => { p.pill(28, 30, 116, 18, "dw"); p.pill(108, 34, 30, 10, "dp"); },
	"TEU-108": p => { p.ring(86, 38, 28, 22); p.pill(96, 54, 64, 10, "dw"); },
	"TEU-112": p => { p.rect(30, 6, 110, 66, 4, "dw"); p.pill(36, 16, 98, 6, "dp"); },
	"TEU-12": p => { p.rect(24, 6, 122, 66, 4, "dw"); p.ring(54, 39, 22, 14); p.rect(86, 22, 52, 34, 3, "df"); },
	"TEU-13": p => { p.poly([[38, 14], [58, 20], [56, 44], [38, 60], [20, 44], [18, 20]]); p.rect(70, 8, 92, 62, 4, "dw"); },
};

export function cardDetail(card, story) {
	const [code] = story;
	const p = pen();
	p.rect(5, 5, card.w - 10, 74, 3, "dp");
	(COVERS[code] || COVERS["TEU-2"])(p.sub(5, 5));
	p.circle(card.w - 15, 99, 6);
	return wrap(p.markup());
}

// ---------- Bento tiles and the title ----------
const TILES = {
	sessions(p) { p.rect(14, 26, 192, 148, 6, "dp"); p.rect(22, 44, 160, 56, 6, "dw"); p.rect(28, 100, 148, 22, 0, "df"); p.rect(28, 130, 148, 40, 6, "dw"); p.rect(10, 32, 80, 22, 5, "dw"); },
	artifacts(p) { p.rect(118, 24, 96, 64, 4, "dp"); p.rect(12, 92, 92, 70, 4, "dp"); p.rect(62, 50, 112, 92, 5, "dw"); p.rect(66, 54, 104, 60, 3, "dp"); },
	chat(p) { p.rect(26, 24, 168, 16, 5, "df"); p.rect(16, 44, 188, 36, 6, "dw"); p.circle(33, 62, 9); p.rect(26, 86, 168, 28, 5, "df"); },
	cost(p) { p.rect(16, 26, 188, 148, 6, "dw"); p.ring(58, 80, 30, 20); p.rect(100, 50, 98, 60, 4, "df"); p.pill(24, 150, 176, 8); },
	chart(p) { p.rect(16, 26, 188, 148, 6, "dw"); p.bars(36, 46, 164, 48, [0.62, 0.55, 0.6, 0.72, 0.92]); p.rect(24, 108, 174, 58, 4, "df"); },
	record(p) { p.pill(12, 50, 196, 34, "dw"); p.pill(108, 55, 94, 24, "dp"); },
};

export function tileDetail(feature, { sx = 1, sy = sx } = {}) {
	const p = pen(0, 0, sx, sy);
	TILES[feature.kind](p);
	return p.markup();
}

// The one lettered face: the Team ’26 lockup, two bold left-aligned lines like the source's title tile. Two static
// <text> nodes inside the tile's matrix group cost a negligible relayout, so no glyph table is needed.
export function titleDetail({ d = 96, sx = 1, sy = sx } = {}) {
	const p = pen(0, 0, sx, sy), size = Math.round(d * 0.3 * Math.min(sx, sy) * 100) / 100;
	const [x, first] = p.at(16, d * 0.46), [, second] = p.at(16, d * 0.8);
	return `<text class="dtt" x="${x}" y="${first}" font-size="${size}">Team ’26</text><text class="dtt" x="${x}" y="${second}" font-size="${size}">Europe</text>`;
}

export const wrapDetail = wrap;
