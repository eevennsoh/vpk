// Wall piece faces: each production piece reduced to the containers it is built from (card, inputs, rows, media,
// bars, rings), drawn in the piece's natural source pixels. No text or lettering; a few large hairline shapes each.
import { pen } from "./eu26-face-pen.mjs";

const inset = (w, h) => Math.max(10, Math.min(w, h) * 0.12);
const card = (p, w, h) => p.rect(0, 0, w, h, 14, "dw");

const LAYOUTS = {
	// A product mark on its own: a rounded tile with one inner shape.
	app(p, w, h) { p.rect(0, 0, w, h, w * 0.22, "dw"); p.circle(w / 2, h / 2, w * 0.24); },
	// A single input or pill control with its leading and trailing affordances.
	pill(p, w, h) { card(p, w, h); const m = Math.min(h * 0.18, 14); p.pill(m, m, w - m * 2, h - m * 2, "dp"); },
	input(p, w, h) { card(p, w, h); const m = inset(w, h); p.rect(m, h * 0.45, w - m * 2, h * 0.4, 10, "dp"); p.pill(m, m, w * 0.3, h * 0.2); },
	// A list: header band and three to five rows.
	rows(p, w, h) {
		card(p, w, h);
		const m = inset(w, h), rows = Math.max(2, Math.min(5, Math.floor((h - m * 2) / 70)));
		p.rect(m, m, w - m * 2, h * 0.14, 6, "dp");
		const top = m + h * 0.2, step = (h - top - m) / rows;
		for (let i = 0; i < rows; i += 1) p.rect(m, top + i * step, w - m * 2, step * 0.72, 6);
	},
	// A table: summary tiles, then rows with a status pill each.
	table(p, w, h) {
		card(p, w, h);
		const m = inset(w, h);
		p.rect(m, m, (w - m * 3) / 2, h * 0.16, 8, "dp");
		p.rect(m * 2 + (w - m * 3) / 2, m, (w - m * 3) / 2, h * 0.16, 8, "dp");
		const top = m * 2 + h * 0.16, step = (h - top - m) / 4;
		for (let i = 0; i < 4; i += 1) p.pill(w * 0.5, top + i * step + step * 0.2, w * 0.14, step * 0.5);
	},
	// A chart: frame and outlined bars.
	chart(p, w, h) { card(p, w, h); const m = inset(w, h); p.bars(m * 1.5, m * 1.5, w - m * 3, h * 0.5, [0.5, 0.7, 0.45, 0.8, 1, 0.65]); p.rect(m, h * 0.68, w - m * 2, h * 0.32 - m, 6, "df"); },
	donut(p, w, h) { card(p, w, h); const r = Math.min(w * 0.22, h * 0.32); p.ring(w * 0.3, h / 2, r, r * 0.66); p.rect(w * 0.58, h * 0.25, w * 0.32, h * 0.5, 8, "df"); },
	// A big media area (photo, video, terminal, slide) inside the card.
	media(p, w, h) { card(p, w, h); const m = inset(w, h); p.rect(m, m, w - m * 2, h - m * 2, 8, "dp"); },
	slide(p, w, h) { card(p, w, h); const m = inset(w, h); p.rect(m, m, w - m * 2, h - m * 2, 8, "dp"); for (let i = 0; i < 3; i += 1) p.rect(w * (0.22 + i * 0.2), h * 0.36, w * 0.16, h * 0.36, 6, "dw"); },
	// A conversation: alternating bubbles.
	chat(p, w, h) { card(p, w, h); const m = inset(w, h), step = (h - m * 2) / 3; for (let i = 0; i < 3; i += 1) p.rect(i % 2 ? w * 0.38 : m, m + i * step, w * 0.55 - m, step * 0.7, 12, i % 2 ? "dp" : "dw"); },
	// A recorder or composer toolbar: long pill with a button pill.
	toolbar(p, w, h) { card(p, w, h); const m = Math.min(inset(w, h), h * 0.2); p.pill(m, h * 0.25, w - m * 2, h * 0.5); p.pill(w * 0.68, h * 0.32, w * 0.3 - m * 1.2, h * 0.36, "dp"); },
	// A profile card: header band, avatar ring, body panel.
	profile(p, w, h) { card(p, w, h); const m = inset(w, h); p.rect(m, m, w - m * 2, h * 0.3, 8, "dp"); p.circle(w / 2, h * 0.42, Math.min(w, h) * 0.13, "dw"); p.rect(m, h * 0.62, w - m * 2, h * 0.3, 8, "df"); },
	// A people cluster: overlapping avatar circles.
	people(p, w, h) { card(p, w, h); const r = Math.min(h * 0.22, w * 0.1); for (let i = 0; i < 4; i += 1) p.circle(w * 0.25 + i * r * 1.5, h / 2, r, "dw"); },
	// A centred glyph tile.
	glyph(p, w, h) { card(p, w, h); p.rect(w * 0.28, h * 0.28, w * 0.44, h * 0.44, w * 0.1); },
	ring(p, w, h) { card(p, w, h); p.ring(w / 2, h / 2, Math.min(w, h) * 0.3, Math.min(w, h) * 0.18); },
	shield(p, w, h) { card(p, w, h); const s = Math.min(w, h) * 0.5, x = (w - s) / 2, y = (h - s) / 2; p.poly([[x + s / 2, y], [x + s, y + s * 0.18], [x + s * 0.94, y + s * 0.6], [x + s / 2, y + s], [x + s * 0.06, y + s * 0.6], [x, y + s * 0.18]]); },
	// A sticker: one simple shape with no card.
	stamp(p, w, h) { p.rect(0, 0, w, h, Math.min(w, h) * 0.2, "dw"); p.circle(w / 2, h / 2, Math.min(w, h) * 0.28); },
	// Named cursors: small pointers with name pills, no card.
	cursors(p, w, h) {
		p.line(w * 0.08, h * 0.52, w * 0.92, h * 0.52, "df");
		for (const [x, y] of [[0.5, 0.18], [0.24, 0.42], [0.6, 0.56], [0.36, 0.78]]) {
			p.poly([[w * x, h * y], [w * x, h * y + 40], [w * x + 12, h * y + 30], [w * x + 28, h * y + 30]]);
			p.pill(w * x + 26, h * y + 34, 130, 44, "dp");
		}
	},
	// A phone with a chat thread.
	phone(p, w, h) { p.rect(0, 0, w, h, 40, "dw"); p.rect(w * 0.08, h * 0.06, w * 0.84, h * 0.82, 24, "dp"); p.pill(w * 0.1, h * 0.9, w * 0.8, h * 0.06); },
};

const PIECE_LAYOUT = {
	search: "pill", bubbles: "chat", twg: "rows", voice: "pill", picker: "rows", hold: "input",
	glyphSearch: "glyph", appConfluence: "app", mosaic: "slide", quizArtifact: "slide", rovoDevCli: "media",
	agentPresence: "cursors", loomRecordBar: "toolbar", governance: "rows", stampTyping: "stamp", agentIdentities: "table",
	searchDrop: "rows", composer: "input", reasoning: "rows", avatars: "people", compact: "chat", glyphChat: "glyph",
	appJira: "app", filmFacets: "slide", dashboardArtifact: "chart", codeCard: "media", mentions: "rows",
	loomTeleprompter: "phone", iso42001: "shield", stampPhotos: "stamp", atlassianMcp: "profile", filters: "pill",
	starters: "pill", workPill: "pill", badgeRovo: "profile", switch: "pill", glyphForYou: "glyph", appSlack: "app",
	artifactsLogo: "glyph", codeSearchLogo: "glyph", attribution: "rows", loomCameraBubble: "ring", statTokens: "chart",
	stampShapes: "stamp", redactedPrompt: "rows", skills: "rows", sources: "rows", scheduledTask: "rows", bloom: "pill",
	glyphAuto: "glyph", appFigma: "app", codeSearchQuery: "pill", shareSnapshot: "profile", loomOverlays: "media",
	stampShield: "shield", needsInput: "input", mobileChat: "phone", sourcesPopover: "rows", agentCard: "profile",
	ringsTile: "ring", appGithub: "app", twgSearchCli: "media", readiness: "donut", stampRovoMark: "stamp",
	agentSessions: "rows", appDrive: "app", highReadiness: "pill", stampTangle: "stamp", requestResolver: "table",
	appLoom: "app", stampLoops: "stamp", jiraList: "table", presenceFacepile: "people", stampRibbon: "stamp",
	riskStack: "rows", rovoWithYou: "chat", stampSignal: "stamp", costByModel: "chart", workflowCard: "rows",
	stampGrid: "stamp", spendCard: "donut", conversation: "chat", stampSparkle: "stamp", dimensions: "chart",
	stampFields: "stamp", potentialSavings: "chart", stampSquiggle: "stamp", sessionCard: "toolbar", stampSmile: "stamp",
	agentSessionStack: "rows",
};

export const PIECES = Object.fromEntries(Object.entries(PIECE_LAYOUT).map(([id, layout]) => [id, (p, w, h) => LAYOUTS[layout](p, w, h)]));

// The lanyard slot (360 x 480): a strap from the top, a clip, and the badge with its avatar ring.
export function lanyardDetail(p, w, h) {
	p.poly([[w * 0.42, 0], [w * 0.47, h * 0.36], [w * 0.53, h * 0.36], [w * 0.58, 0]], "dp");
	p.rect(w * 0.45, h * 0.36, w * 0.1, h * 0.06, 4);
	p.circle(w / 2, h * 0.46, w * 0.03);
	p.rect(w * 0.18, h * 0.5, w * 0.64, h * 0.46, 14, "dw");
	p.circle(w / 2, h * 0.64, w * 0.1);
}

