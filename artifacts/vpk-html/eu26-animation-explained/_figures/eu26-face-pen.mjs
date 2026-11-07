// Face-detail pen: emits SVG line-work in a surface's local plan units (0..w across, 0..d down the face).
// The live renderer maps the whole group onto the projected face with one matrix per frame, so nothing here
// carries a transform. Colours come only from the detail classes in explorer.css (token-based, accent-aware).
//
// Classes: dl hairline · dk ink line · df faint line · dp panel fill · dps outlined panel · dw paper card ·
// dwf faint paper card · db lettering bar · dbd dark bar · dg mid fill · dd ink fill · dt text · dtm muted ·
// dtx mono muted · dti inverse text (on dd).

import { GLYPHS as FONTS } from "./eu26-glyphs.mjs";

const n = value => Math.round(value * 100) / 100;
const d1 = value => Math.round(value * 10) / 10;
// Geist ships as one variable font; the snapshot is wght 400, so heavier copy adds a same-colour stroke of the stem gain.
const WEIGHT_STROKE = { 400: 0, 500: 0.014, 600: 0.03, 700: 0.046 };
const fontOf = c => (/\bdtx\b/.test(c) ? FONTS.x : FONTS.r);
const advance = (font, value, spacing = 0) => [...String(value)].reduce((sum, ch) => sum + (font.glyphs[ch] || font.glyphs["?"])[0] + spacing, 0);

export function pen(ox = 0, oy = 0, sx = 1, sy = sx, out = []) {
	const X = v => n(ox + v * sx), Y = v => n(oy + v * sy), W = v => n(v * sx), H = v => n(v * sy), F = v => n(v * Math.min(sx, sy));
	const p = {
		out,
		sx, sy,
		rect(x, y, w, h, r = 0, c = "dl") {
			const rx = r ? ` rx="${F(Math.min(r, w / 2, h / 2))}"` : "";
			out.push(`<rect class="${c}" x="${X(x)}" y="${Y(y)}" width="${W(w)}" height="${H(h)}"${rx}/>`);
			return p;
		},
		line(x1, y1, x2, y2, c = "dl") {
			out.push(`<path class="${c}" d="M${X(x1)} ${Y(y1)}L${X(x2)} ${Y(y2)}"/>`);
			return p;
		},
		poly(points, c = "dl", close = true) {
			out.push(`<path class="${c}" d="M${points.map(([x, y]) => `${X(x)} ${Y(y)}`).join("L")}${close ? "Z" : ""}"/>`);
			return p;
		},
		circle(cx, cy, r, c = "dl") {
			if (Math.abs(sx - sy) < 1e-6) out.push(`<circle class="${c}" cx="${X(cx)}" cy="${Y(cy)}" r="${F(r)}"/>`);
			else out.push(`<ellipse class="${c}" cx="${X(cx)}" cy="${Y(cy)}" rx="${W(r)}" ry="${H(r)}"/>`);
			return p;
		},
		// Annular sector from angle a0 to a1 (radians, 0 = up, clockwise); inner radius 0 draws a pie slice or an open arc.
		sector(cx, cy, r, inner, a0, a1, c = "dg") {
			const at = (radius, angle) => `${X(cx + Math.sin(angle) * radius)} ${Y(cy - Math.cos(angle) * radius)}`;
			const large = a1 - a0 > Math.PI ? 1 : 0;
			const outer = `M${at(r, a0)}A${W(r)} ${H(r)} 0 ${large} 1 ${at(r, a1)}`;
			out.push(`<path class="${c}" d="${inner > 0 ? `${outer}L${at(inner, a1)}A${W(inner)} ${H(inner)} 0 ${large} 0 ${at(inner, a0)}Z` : `${outer}`}"/>`);
			return p;
		},
		// Copy is set as glyph outlines (one path per string), anchored like SVG text: x at start/middle/end, y on the baseline.
		text(x, y, value, size = 6, c = "dt", { anchor, weight = 400, spacing = 0 } = {}) {
			const font = fontOf(c), scale = Math.min(sx, sy) * size / font.em, track = spacing / size * font.em;
			const width = advance(font, value, track) - track;
			let cursor = X(x) - (anchor === "middle" ? width / 2 : anchor === "end" ? width : 0) * scale;
			const baseline = Y(y), parts = [];
			for (const ch of String(value)) {
				const [step, outline] = font.glyphs[ch] || font.glyphs["?"];
				if (outline) {
					let axis = 0;
					parts.push(outline.replace(/-?\d+(?:\.\d+)?/g, number => d1(axis++ % 2 ? baseline + Number(number) * scale : cursor + Number(number) * scale)));
				}
				cursor += (step + track) * scale;
			}
			const stroke = (WEIGHT_STROKE[weight] ?? 0) * size * Math.min(sx, sy);
			if (parts.length) out.push(`<path class="${c}" stroke-width="${n(stroke)}" d="${parts.join("")}"/>`);
			return p;
		},
		bar(x, y, w, h = 2.4, c = "db") {
			return p.rect(x, y, w, h, h / 2, c);
		},
		sub(x, y, s = 1, s2 = s) {
			return pen(ox + x * sx, oy + y * sy, sx * s, sy * s2, out);
		},
		markup() {
			return out.join("");
		},
	};
	return p;
}

// A deterministic spread of lettering-bar lengths, so grey copy reads as copy and stays stable across builds.
export const spread = (seed, index) => {
	const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
	return value - Math.floor(value);
};

// Width of a string at a font size, for laying out chips and right-aligned values.
export const textWidth = (value, size, mono = false) => advance(mono ? FONTS.x : FONTS.r, value) * size / 1000;

// Unit-box glyphs (0..1). glyph(p, name, x, y, size).
const GLYPHS = {
	check(q) { q.rect(0.08, 0.08, 0.84, 0.84, 0.18, "dk"); q.poly([[0.28, 0.52], [0.44, 0.68], [0.74, 0.34]], "dk", false); },
	tick(q) { q.poly([[0.18, 0.54], [0.4, 0.76], [0.84, 0.28]], "dk", false); },
	search(q) { q.circle(0.42, 0.42, 0.26, "dk"); q.line(0.62, 0.62, 0.88, 0.88, "dk"); },
	chat(q) { q.poly([[0.1, 0.16], [0.9, 0.16], [0.9, 0.7], [0.46, 0.7], [0.24, 0.9], [0.27, 0.7], [0.1, 0.7]], "dk"); },
	plus(q) { q.line(0.5, 0.2, 0.5, 0.8, "dk"); q.line(0.2, 0.5, 0.8, 0.5, "dk"); },
	dots(q) { for (const x of [0.22, 0.5, 0.78]) q.circle(x, 0.5, 0.07, "dd"); },
	grid(q) { for (const [x, y] of [[0.14, 0.14], [0.56, 0.14], [0.14, 0.56], [0.56, 0.56]]) q.rect(x, y, 0.3, 0.3, 0.06, "dk"); },
	sidebar(q) { q.rect(0.1, 0.16, 0.8, 0.68, 0.12, "dk"); q.line(0.38, 0.16, 0.38, 0.84, "dk"); },
	bell(q) { q.poly([[0.24, 0.7], [0.3, 0.38], [0.5, 0.2], [0.7, 0.38], [0.76, 0.7]], "dk"); q.line(0.18, 0.7, 0.82, 0.7, "dk"); q.circle(0.5, 0.82, 0.06, "dd"); },
	help(q) { q.circle(0.5, 0.5, 0.38, "dk"); q.poly([[0.38, 0.4], [0.44, 0.3], [0.56, 0.3], [0.62, 0.4], [0.5, 0.52], [0.5, 0.6]], "dk", false); q.circle(0.5, 0.72, 0.04, "dd"); },
	gear(q) { q.circle(0.5, 0.5, 0.3, "dk"); q.circle(0.5, 0.5, 0.12, "dk"); for (let i = 0; i < 8; i += 1) { const a = i * Math.PI / 4; q.line(0.5 + Math.sin(a) * 0.3, 0.5 - Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.42, 0.5 - Math.cos(a) * 0.42, "dk"); } },
	avatar(q) { q.circle(0.5, 0.5, 0.46, "dw"); q.circle(0.5, 0.4, 0.15, "dg"); q.sector(0.5, 0.92, 0.3, 0, -Math.PI / 2, Math.PI / 2, "dg"); },
	people(q) { q.circle(0.36, 0.36, 0.14, "dk"); q.poly([[0.12, 0.84], [0.16, 0.62], [0.36, 0.54], [0.56, 0.62], [0.6, 0.84]], "dk", false); q.circle(0.68, 0.3, 0.12, "dk"); q.poly([[0.66, 0.5], [0.84, 0.56], [0.88, 0.76]], "dk", false); },
	share(q) { q.circle(0.26, 0.5, 0.1, "dk"); q.circle(0.74, 0.24, 0.1, "dk"); q.circle(0.74, 0.76, 0.1, "dk"); q.line(0.34, 0.45, 0.66, 0.29, "dk"); q.line(0.34, 0.55, 0.66, 0.71, "dk"); },
	bolt(q) { q.poly([[0.56, 0.08], [0.22, 0.56], [0.48, 0.56], [0.42, 0.92], [0.78, 0.42], [0.52, 0.42]], "dk"); },
	expand(q) { q.poly([[0.56, 0.16], [0.84, 0.16], [0.84, 0.44]], "dk", false); q.poly([[0.44, 0.84], [0.16, 0.84], [0.16, 0.56]], "dk", false); q.line(0.84, 0.16, 0.56, 0.44, "dk"); q.line(0.16, 0.84, 0.44, 0.56, "dk"); },
	filter(q) { q.line(0.14, 0.3, 0.86, 0.3, "dk"); q.line(0.28, 0.5, 0.72, 0.5, "dk"); q.line(0.42, 0.7, 0.58, 0.7, "dk"); },
	layers(q) { q.poly([[0.5, 0.14], [0.88, 0.34], [0.5, 0.54], [0.12, 0.34]], "dk"); q.poly([[0.12, 0.52], [0.5, 0.72], [0.88, 0.52]], "dk", false); q.poly([[0.12, 0.68], [0.5, 0.88], [0.88, 0.68]], "dk", false); },
	list(q) { for (const y of [0.28, 0.5, 0.72]) { q.circle(0.18, y, 0.05, "dd"); q.line(0.32, y, 0.86, y, "dk"); } },
	board(q) { q.rect(0.1, 0.16, 0.8, 0.68, 0.1, "dk"); q.line(0.37, 0.16, 0.37, 0.84, "dk"); q.line(0.63, 0.16, 0.63, 0.84, "dk"); },
	globe(q) { q.circle(0.5, 0.5, 0.38, "dk"); q.line(0.12, 0.5, 0.88, 0.5, "dk"); q.circle(0.5, 0.5, 0.38, "dk"); q.poly([[0.5, 0.12], [0.34, 0.5], [0.5, 0.88], [0.66, 0.5]], "dk"); },
	page(q) { q.poly([[0.22, 0.1], [0.62, 0.1], [0.8, 0.28], [0.8, 0.9], [0.22, 0.9]], "dk"); for (const y of [0.42, 0.58, 0.74]) q.line(0.34, y, 0.68, y, "dk"); },
	form(q) { q.rect(0.18, 0.12, 0.64, 0.76, 0.08, "dk"); for (const y of [0.34, 0.52, 0.7]) q.line(0.3, y, 0.7, y, "dk"); },
	mic(q) { q.rect(0.38, 0.12, 0.24, 0.46, 0.12, "dk"); q.poly([[0.24, 0.46], [0.3, 0.64], [0.5, 0.72], [0.7, 0.64], [0.76, 0.46]], "dk", false); q.line(0.5, 0.72, 0.5, 0.88, "dk"); },
	camoff(q) { q.rect(0.1, 0.3, 0.56, 0.42, 0.08, "dk"); q.poly([[0.66, 0.44], [0.9, 0.3], [0.9, 0.72], [0.66, 0.58]], "dk"); q.line(0.12, 0.16, 0.86, 0.86, "dk"); },
	cam(q) { q.rect(0.1, 0.3, 0.56, 0.42, 0.08, "dk"); q.poly([[0.66, 0.44], [0.9, 0.3], [0.9, 0.72], [0.66, 0.58]], "dk"); },
	screen(q) { q.rect(0.1, 0.18, 0.8, 0.54, 0.08, "dk"); q.line(0.36, 0.86, 0.64, 0.86, "dk"); q.line(0.5, 0.72, 0.5, 0.86, "dk"); },
	window(q) { q.rect(0.1, 0.2, 0.8, 0.6, 0.08, "dk"); q.line(0.1, 0.36, 0.9, 0.36, "dk"); },
	crop(q) { q.rect(0.16, 0.16, 0.68, 0.68, 0.06, "df"); q.poly([[0.16, 0.36], [0.16, 0.16], [0.36, 0.16]], "dk", false); q.poly([[0.64, 0.84], [0.84, 0.84], [0.84, 0.64]], "dk", false); },
	photo(q) { q.rect(0.1, 0.18, 0.8, 0.64, 0.08, "dk"); q.circle(0.68, 0.36, 0.07, "dk"); q.poly([[0.1, 0.74], [0.38, 0.46], [0.6, 0.68], [0.7, 0.58], [0.9, 0.76]], "dk", false); },
	lock(q) { q.rect(0.22, 0.44, 0.56, 0.44, 0.08, "dk"); q.poly([[0.34, 0.44], [0.34, 0.28], [0.5, 0.14], [0.66, 0.28], [0.66, 0.36]], "dk", false); },
	spark(q) { q.poly([[0.5, 0.08], [0.6, 0.4], [0.92, 0.5], [0.6, 0.6], [0.5, 0.92], [0.4, 0.6], [0.08, 0.5], [0.4, 0.4]], "dk"); },
	send(q) { q.circle(0.5, 0.5, 0.44, "dd"); q.poly([[0.5, 0.74], [0.5, 0.28]], "dki", false); q.poly([[0.32, 0.44], [0.5, 0.26], [0.68, 0.44]], "dki", false); },
	shield(q) { q.poly([[0.5, 0.08], [0.86, 0.22], [0.82, 0.56], [0.5, 0.92], [0.18, 0.56], [0.14, 0.22]], "dd"); q.poly([[0.32, 0.5], [0.46, 0.64], [0.7, 0.38]], "dki", false); },
	shieldline(q) { q.poly([[0.5, 0.08], [0.86, 0.22], [0.82, 0.56], [0.5, 0.92], [0.18, 0.56], [0.14, 0.22]], "dk"); q.poly([[0.32, 0.5], [0.46, 0.64], [0.7, 0.38]], "dk", false); },
	ring(q) { q.circle(0.5, 0.5, 0.36, "df"); q.sector(0.5, 0.5, 0.36, 0, 0, Math.PI * 1.45, "dk"); },
	pointer(q) { q.poly([[0.1, 0.06], [0.1, 0.84], [0.32, 0.64], [0.48, 0.96], [0.62, 0.9], [0.46, 0.58], [0.76, 0.58]], "dpointer"); },
	hand(q) { q.poly([[0.3, 0.9], [0.18, 0.56], [0.24, 0.5], [0.34, 0.6], [0.34, 0.2], [0.44, 0.16], [0.48, 0.44], [0.52, 0.12], [0.62, 0.14], [0.62, 0.44], [0.68, 0.2], [0.78, 0.24], [0.76, 0.5], [0.84, 0.36], [0.9, 0.42], [0.8, 0.9]], "dw"); },
	link(q) { q.rect(0.08, 0.36, 0.48, 0.28, 0.14, "dk"); q.rect(0.44, 0.36, 0.48, 0.28, 0.14, "dk"); },
	clock(q) { q.circle(0.5, 0.5, 0.38, "dk"); q.poly([[0.5, 0.26], [0.5, 0.5], [0.66, 0.6]], "dk", false); },
	file(q) { q.poly([[0.22, 0.1], [0.6, 0.1], [0.8, 0.3], [0.8, 0.9], [0.22, 0.9]], "dk"); q.poly([[0.6, 0.1], [0.6, 0.3], [0.8, 0.3]], "dk", false); },
	code(q) { q.poly([[0.34, 0.28], [0.12, 0.5], [0.34, 0.72]], "dk", false); q.poly([[0.66, 0.28], [0.88, 0.5], [0.66, 0.72]], "dk", false); q.line(0.56, 0.2, 0.44, 0.8, "dk"); },
	table(q) { q.rect(0.12, 0.18, 0.76, 0.64, 0.06, "dk"); q.line(0.12, 0.4, 0.88, 0.4, "dk"); q.line(0.4, 0.18, 0.4, 0.82, "dk"); },
	calendar(q) { q.rect(0.12, 0.2, 0.76, 0.68, 0.08, "dk"); q.line(0.12, 0.4, 0.88, 0.4, "dk"); q.line(0.32, 0.1, 0.32, 0.28, "dk"); q.line(0.68, 0.1, 0.68, 0.28, "dk"); },
	node(q) { q.circle(0.5, 0.5, 0.34, "dk"); q.circle(0.5, 0.5, 0.12, "dd"); },
	shuffle(q) { q.poly([[0.12, 0.3], [0.4, 0.3], [0.62, 0.7], [0.88, 0.7]], "dk", false); q.poly([[0.12, 0.7], [0.4, 0.7], [0.62, 0.3], [0.88, 0.3]], "dk", false); },
	compose(q) { q.rect(0.12, 0.2, 0.62, 0.66, 0.08, "dk"); q.line(0.5, 0.52, 0.86, 0.14, "dk"); },
	video(q) { q.circle(0.5, 0.5, 0.4, "dk"); q.poly([[0.42, 0.34], [0.66, 0.5], [0.42, 0.66]], "dd"); },
	close(q) { q.line(0.28, 0.28, 0.72, 0.72, "dk"); q.line(0.72, 0.28, 0.28, 0.72, "dk"); },
	chevron(q) { q.poly([[0.3, 0.4], [0.5, 0.6], [0.7, 0.4]], "dk", false); },
	star(q) { q.poly(Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5, r = i % 2 ? 0.2 : 0.44; return [0.5 + Math.sin(a) * r, 0.52 - Math.cos(a) * r]; }), "dk"); },
	sessions(q) { q.rect(0.14, 0.16, 0.72, 0.5, 0.08, "dk"); q.line(0.32, 0.84, 0.68, 0.84, "dk"); q.circle(0.5, 0.41, 0.1, "dk"); },
};
export function glyph(p, name, x, y, size) {
	GLYPHS[name](p.sub(x, y, size));
	return p;
}

// Product marks, simplified to a few strokes inside a unit tile (logo(p, name, x, y, size, tile)).
const MARKS = {
	jira(q) { q.poly([[0.5, 0.16], [0.84, 0.5], [0.5, 0.84], [0.16, 0.5]], "dk"); q.poly([[0.5, 0.36], [0.64, 0.5], [0.5, 0.64], [0.36, 0.5]], "dd"); },
	rovo(q) { q.sector(0.5, 0.5, 0.34, 0.16, 0.2, 1.4, "dd"); q.sector(0.5, 0.5, 0.34, 0.16, 1.77, 2.97, "dg"); q.sector(0.5, 0.5, 0.34, 0.16, 3.34, 4.54, "dd"); q.sector(0.5, 0.5, 0.34, 0.16, 4.91, 6.11, "dg"); },
	loom(q) { for (let i = 0; i < 8; i += 1) { const a = i * Math.PI / 4; q.line(0.5 + Math.sin(a) * 0.14, 0.5 - Math.cos(a) * 0.14, 0.5 + Math.sin(a) * 0.36, 0.5 - Math.cos(a) * 0.36, "dk"); } q.circle(0.5, 0.5, 0.1, "dk"); },
	confluence(q) { q.poly([[0.16, 0.66], [0.36, 0.5], [0.62, 0.62], [0.84, 0.5]], "dk", false); q.poly([[0.16, 0.42], [0.38, 0.3], [0.64, 0.42], [0.84, 0.28]], "dk", false); },
	github(q) { q.circle(0.5, 0.5, 0.36, "dd"); q.circle(0.5, 0.48, 0.14, "dwi"); q.poly([[0.38, 0.36], [0.36, 0.24], [0.46, 0.32]], "dwi"); q.poly([[0.62, 0.36], [0.64, 0.24], [0.54, 0.32]], "dwi"); },
	slack(q) { q.line(0.38, 0.16, 0.38, 0.84, "dk"); q.line(0.62, 0.16, 0.62, 0.84, "dk"); q.line(0.16, 0.38, 0.84, 0.38, "dk"); q.line(0.16, 0.62, 0.84, 0.62, "dk"); },
	figma(q) { q.rect(0.3, 0.12, 0.2, 0.24, 0.1, "dg"); q.rect(0.5, 0.12, 0.2, 0.24, 0.1, "dk"); q.rect(0.3, 0.38, 0.2, 0.24, 0.1, "dd"); q.circle(0.6, 0.5, 0.1, "dk"); q.rect(0.3, 0.64, 0.2, 0.24, 0.1, "dg"); },
	drive(q) { q.poly([[0.38, 0.16], [0.62, 0.16], [0.88, 0.62], [0.76, 0.84], [0.24, 0.84], [0.12, 0.62]], "dk"); q.line(0.38, 0.16, 0.24, 0.84, "dk"); q.line(0.12, 0.62, 0.88, 0.62, "dk"); },
	openai(q) { for (let i = 0; i < 6; i += 1) { const a = i * Math.PI / 3; q.sector(0.5 + Math.sin(a) * 0.12, 0.5 - Math.cos(a) * 0.12, 0.22, 0, a + 0.5, a + 2.4, "dk"); } },
	anthropic(q) { for (let i = 0; i < 6; i += 1) { const a = i * Math.PI / 6; q.line(0.5 + Math.sin(a) * 0.36, 0.5 - Math.cos(a) * 0.36, 0.5 - Math.sin(a) * 0.36, 0.5 + Math.cos(a) * 0.36, "dk"); } },
	cursor(q) { q.poly([[0.5, 0.14], [0.84, 0.32], [0.84, 0.68], [0.5, 0.86], [0.16, 0.68], [0.16, 0.32]], "dd"); q.poly([[0.16, 0.32], [0.5, 0.5], [0.84, 0.32]], "dki", false); q.line(0.5, 0.5, 0.5, 0.86, "dki"); },
	notion(q) { q.rect(0.18, 0.16, 0.64, 0.68, 0.08, "dk"); q.poly([[0.36, 0.7], [0.36, 0.3], [0.64, 0.7], [0.64, 0.3]], "dk", false); },
	canva(q) { q.circle(0.5, 0.5, 0.36, "dg"); q.sector(0.5, 0.5, 0.16, 0, 0.6, 5.7, "dki"); },
	databricks(q) { q.poly([[0.5, 0.2], [0.84, 0.36], [0.5, 0.52], [0.16, 0.36]], "dk"); q.poly([[0.16, 0.5], [0.5, 0.66], [0.84, 0.5]], "dk", false); q.poly([[0.16, 0.64], [0.5, 0.8], [0.84, 0.64]], "dk", false); },
	mixpanel(q) { q.line(0.24, 0.24, 0.76, 0.76, "dk"); q.line(0.76, 0.24, 0.24, 0.76, "dk"); },
	gitlab(q) { q.poly([[0.5, 0.84], [0.14, 0.44], [0.24, 0.16], [0.34, 0.44], [0.66, 0.44], [0.76, 0.16], [0.86, 0.44]], "dg"); },
	graph(q) { q.circle(0.3, 0.3, 0.1, "dk"); q.circle(0.72, 0.38, 0.1, "dk"); q.circle(0.42, 0.74, 0.1, "dk"); q.line(0.38, 0.33, 0.62, 0.36, "dk"); q.line(0.34, 0.4, 0.4, 0.64, "dk"); q.line(0.66, 0.46, 0.5, 0.68, "dk"); },
	dx(q) { q.text(0.5, 0.64, "DX", 0.38, "dt", { anchor: "middle", weight: 700 }); },
	loomsun(q) { MARKS.loom(q); },
	studio(q) { q.rect(0.2, 0.2, 0.6, 0.6, 0.14, "dk"); q.circle(0.5, 0.5, 0.14, "dd"); },
	bitbucket(q) { q.poly([[0.14, 0.2], [0.86, 0.2], [0.74, 0.84], [0.26, 0.84]], "dk"); q.rect(0.4, 0.42, 0.2, 0.2, 0.02, "dk"); },
	service(q) { q.poly([[0.5, 0.12], [0.84, 0.5], [0.5, 0.88], [0.16, 0.5]], "dk"); q.bar(0.36, 0.46, 0.28, 0.08, "dd"); },
	guard(q) { GLYPHS.shieldline(q); },
	talent(q) { q.circle(0.5, 0.36, 0.14, "dk"); q.poly([[0.22, 0.84], [0.28, 0.6], [0.5, 0.54], [0.72, 0.6], [0.78, 0.84]], "dk", false); },
	admin(q) { GLYPHS.gear(q); },
	codesearch(q) { GLYPHS.search(q); q.poly([[0.32, 0.36], [0.24, 0.42], [0.32, 0.48]], "dk", false); },
};
export function logo(p, name, x, y, size, tile = "dw") {
	if (tile) p.rect(x, y, size, size, size * 0.22, tile);
	const inset = tile ? size * 0.14 : 0;
	MARKS[name](p.sub(x + inset, y + inset, size - inset * 2));
	return p;
}

// A chip: rounded label, optional leading glyph. Returns its width so callers can flow chips.
export function chip(p, x, y, label, { size = 5, h = size * 2, c = "dw", text = "dt", icon, weight, pad = size * 0.9 } = {}) {
	const iconW = icon ? size * 1.5 : 0;
	const w = pad * 2 + iconW + textWidth(label, size);
	p.rect(x, y, w, h, h / 2, c);
	if (icon) glyph(p, icon, x + pad - size * 0.15, y + (h - size * 1.2) / 2, size * 1.2);
	p.text(x + pad + iconW, y + h / 2 + size * 0.36, label, size, text, { weight });
	return w;
}

// Grey lettering lines for copy too small to read.
export function lettering(p, x, y, w, rows, { gap = 4, h = 1.8, seed = 1, c = "db", last = 0.55 } = {}) {
	for (let i = 0; i < rows; i += 1) {
		const length = i === rows - 1 ? last : 0.72 + spread(seed, i) * 0.28;
		p.bar(x, y + i * gap, w * length, h, c);
	}
	return p;
}

export function avatar(p, cx, cy, r) {
	return glyph(p, "avatar", cx - r, cy - r, r * 2);
}

// Neutral fills for chart series, darkest first.
export const SERIES = ["dg", "dbd", "db", "dwf", "dd"];
