// Face detail for the final wall: one drawer per source wall piece, in the piece's natural source pixels
// (0..w, 0..h from WALL_PIECES), plus the lanyard badge. Labels follow the production wall frames.
import { avatar, chip, glyph, lettering, logo, SERIES, spread, textWidth } from "./eu26-face-pen.mjs";

const card = (p, w, h, c = "dw") => p.rect(0, 0, w, h, 14, c);
const title = (p, x, y, value, size = 18, c = "dt") => p.text(x, y, value, size, c, { weight: 600 });
const caption = (p, x, y, value, size = 12, c = "dtm") => p.text(x, y, value, size, c);
const rule = (p, x1, y, x2) => p.line(x1, y, x2, y, "df");

// A list row: leading glyph or mark, label, optional caption and trailing value.
function row(p, x, y, w, { icon, mark, label, sub, value, size = 14 }) {
	if (mark) logo(p, mark, x, y - size * 0.9, size * 1.5, "dwf");
	else if (icon) glyph(p, icon, x, y - size * 0.85, size * 1.2);
	const tx = x + (mark || icon ? size * 2 : 0);
	p.text(tx, y, label, size, "dt");
	if (sub) p.text(tx, y + size * 1.1, sub, Math.max(10, size * 0.78), "dtm");
	if (value) p.text(x + w, y, value, size * 0.9, "dtm", { anchor: "end" });
}

// Pill toolbar with icons and a dark action button.
function toolbar(p, x, y, w, h, icons, action, actionW) {
	p.rect(x, y, w, h, h / 2, "dw");
	p.rect(x, y, w, h, h / 2, "dk");
	const s = h * 0.42;
	icons.forEach((icon, i) => glyph(p, icon, x + h * 0.45 + i * s * 1.9, y + (h - s) / 2, s));
	const bx = x + w - actionW - h * 0.12;
	p.rect(bx, y + h * 0.14, actionW, h * 0.72, h * 0.36, "dd");
	p.circle(bx + h * 0.36, y + h / 2, h * 0.24, "dwi");
	glyph(p, "spark", bx + h * 0.2, y + h * 0.34, h * 0.32);
	p.text(bx + h * 0.7, y + h / 2 + h * 0.13, action, h * 0.34, "dti", { weight: 600 });
}

function bars(p, x, y, w, h, stacks, gap = 0.3) {
	const bw = w / stacks.length;
	const max = Math.max(...stacks.map(s => s.reduce((a, b) => a + b, 0)));
	stacks.forEach((stack, i) => {
		let top = y + h;
		stack.forEach((v, k) => { if (!v) return; const bh = v / max * h; top -= bh; p.rect(x + i * bw + bw * gap / 2, top, bw * (1 - gap), bh, 0, SERIES[k % SERIES.length]); });
	});
}

function sparkline(p, x, y, w, h, seed, n = 14) {
	p.poly(Array.from({ length: n }, (_, i) => [x + i * w / (n - 1), y + h - (0.25 + spread(seed, i) * 0.55 + i / n * 0.2) * h]), "dk", false);
}

function terminal(p, w, h, lines, prompt = "$") {
	card(p, w, h, "dd");
	for (const [i, x] of [16, 30, 44].entries()) p.circle(x + 6, 16, 5, i ? "dg" : "dwi");
	lines.forEach((line, i) => p.text(20, 46 + i * 22, i === 0 ? `${prompt} ${line}` : line, 14, "dti dtx"));
}

function stamp(p, w, h, draw) {
	card(p, w, h);
	draw(p, w, h, Math.min(w, h));
}

function appTile(mark) {
	return (p, w) => logo(p, mark, 0, 0, w, "dw");
}

function glyphTile(icon, dark = false) {
	return (p, w, h) => {
		card(p, w, h, dark ? "dd" : "dw");
		p.rect(w * 0.22, h * 0.22, w * 0.56, h * 0.56, w * 0.14, dark ? "dg" : "dp");
		glyph(p, icon, w * 0.32, h * 0.32, w * 0.36);
	};
}

export const PIECES = {
	search(p, w, h) {
		card(p, w, h, "dw"); p.rect(0, 0, w, h, h / 2, "dk");
		glyph(p, "search", 18, 15, 24);
		p.text(54, 33, "Search across your apps and the web", 18, "dtm");
		chip(p, w - 150, 12, "All apps", { size: 13, h: 30, c: "dp", icon: "grid" });
		logo(p, "rovo", w - 44, 12, 30, "");
	},
	bubbles(p, w, h) {
		card(p, w, h);
		const rows = [[false, "Can you summarise the launch risks?", 300], [true, "Three blockers: pricing copy, the", 340], [true, "webhook retries and legal sign-off.", 310], [false, "Create Jira tasks for each", 230]];
		rows.forEach(([bot, text, bw], i) => {
			const y = 22 + i * 54, x = bot ? 58 : w - bw - 20;
			if (bot && i === 1) logo(p, "rovo", 16, y + 4, 30, "");
			p.rect(x, y, bw, 42, 16, bot ? "dp" : "dd");
			p.text(x + 16, y + 26, text, 14, bot ? "dt" : "dti");
		});
	},
	twg(p, w, h) {
		card(p, w, h);
		title(p, 22, 36, "Teamwork Graph", 18);
		caption(p, 22, 56, "Connected across 42 apps");
		const nodes = [[215, 130, "graph"], [90, 110, "jira"], [140, 175, "confluence"], [300, 100, "slack"], [350, 165, "github"], [250, 180, "drive"], [370, 60, "figma"]];
		nodes.slice(1).forEach(([x, y]) => p.line(215, 130, x, y, "dl"));
		nodes.forEach(([x, y, mark], i) => logo(p, mark, x - (i ? 16 : 22), y - (i ? 16 : 22), i ? 32 : 44, i ? "dw" : "dps"));
	},
	voice(p, w, h) {
		card(p, w, h); p.rect(0, 0, w, h, h / 2, "dk");
		p.circle(28, 28, 18, "dd"); glyph(p, "mic", 18, 18, 20);
		for (let i = 0; i < 34; i += 1) { const bh = 6 + spread(5, i) * 26; p.rect(60 + i * 7, 28 - bh / 2, 3.4, bh, 1.7, i < 22 ? "dd" : "db"); }
		p.text(w - 20, 33, "0:14", 14, "dtx", { anchor: "end" });
	},
	picker(p, w, h) {
		card(p, w, h);
		caption(p, 18, 30, "Agents", 13);
		["Rovo", "Code Reviewer", "My Agent", "Brief Writer", "Blocker checker", "Brand voice", "Request resolver"].forEach((label, i) => {
			const y = 62 + i * 36;
			if (i === 2) p.rect(8, y - 22, w - 16, 32, 8, "dp");
			logo(p, i === 0 ? "rovo" : "graph", 16, y - 18, 22, "dwf");
			p.text(48, y - 2, label, 14, "dt");
			if (i === 2) glyph(p, "tick", w - 36, y - 18, 18);
		});
		rule(p, 12, 316, w - 12);
		row(p, 18, 342, w, { icon: "people", label: "View profile", size: 13 });
	},
	hold(p, w, h) {
		card(p, w, h);
		chip(p, 60, 22, "Q3 launch plan", { size: 13, h: 28, c: "dwf", icon: "table" });
		glyph(p, "close", 214, 28, 16);
		p.rect(40, 70, w - 80, 64, 32, "dw"); p.rect(40, 70, w - 80, 64, 32, "dk");
		logo(p, "rovo", 58, 88, 28, "");
		p.text(98, 108, "What are the open risks?", 17, "dt");
		glyph(p, "plus", w - 132, 90, 24);
		glyph(p, "send", w - 96, 84, 36);
		glyph(p, "pointer", 120, 104, 20);
	},
	glyphSearch: glyphTile("search"),
	appConfluence: appTile("confluence"),
	mosaic(p, w, h) {
		card(p, w, h);
		const cells = [[0, 0, 1, 1, "dd", "node"], [1, 0, 1, 1, "dg", "chat"], [2, 0, 2, 2, "dp", "chat"], [0, 1, 2, 2, "dbd", "search"], [2, 2, 2, 1, "dd", null]];
		const cw = (w - 30) / 4, ch = (h - 30) / 3;
		cells.forEach(([cx, cy, sw, sh, c, icon]) => {
			const x = 15 + cx * cw, y = 15 + cy * ch;
			p.rect(x + 3, y + 3, sw * cw - 6, sh * ch - 6, 10, c);
			if (icon) glyph(p, icon, x + sw * cw / 2 - 24, y + sh * ch / 2 - 24, 48);
		});
		for (let i = 0; i < 6; i += 1) for (let j = 0; j < 4; j += 1) p.circle(30 + i * 22, 140 + j * 22, 2.4, "dwi");
		p.text(15 + 2 * cw + 18, 15 + 3 * ch - 30, "t Rovo", 64, "dti dtd", { weight: 700 });
	},
	quizArtifact(p, w, h) {
		card(p, w, h);
		p.rect(14, 14, w - 28, 26, 6, "dp");
		for (const [i, x] of [26, 40, 54].entries()) p.circle(x, 27, 4, i ? "dg" : "dd");
		p.rect(14, 46, w - 28, h - 60, 8, "dg");
		p.text(w / 2, 104, "Where must you submit all business expenses?", 24, "dti dtd", { anchor: "middle" });
		["You don’t have to submit expenses", "Through Atlassian’s designated expense tool", "Directly to your personal credit card"].forEach((label, i) => {
			const x = w / 2 - 210 + i * 145;
			p.rect(x, 140, 128, 170, 10, i === 1 ? "dd" : "dw");
			p.circle(x + 20, 162, 9, i === 1 ? "dwi" : "dk");
			lettering(p, x + 14, 230, 100, 4, { gap: 14, h: 6, seed: 30 + i, c: i === 1 ? "dwi" : "db" });
			void label;
		});
		chip(p, w / 2 - 120, 350, "Skip ahead", { size: 13, h: 30, c: "dw" });
		chip(p, w / 2 + 10, 350, "Next question", { size: 13, h: 30, c: "dd", text: "dti" });
	},
	rovoDevCli(p, w, h) {
		card(p, w, h, "dd");
		for (let i = 0; i < 18; i += 1) for (let j = 0; j < 18; j += 1) {
			const dx = i - 8.5, dy = j - 8.5, r = Math.hypot(dx, dy);
			if (r > 8.6 || r < 3.4 || spread(i, j) > 0.86) continue;
			p.circle(48 + i * 9, 70 + j * 9, 2.2, "dg");
		}
		p.text(250, 110, "Welcome to Rovo!", 16, "dti dtx");
		p.text(250, 150, "Working in ~/Bitbucket/devai-ui-lab/", 13, "dti dtx");
		p.text(250, 174, "Billing site: hello.atlassian.net", 13, "dti dtx");
		p.text(250, 230, "> _", 14, "dti dtx");
	},
	agentPresence(p, w, h) {
		p.line(w * 0.5, 0, w * 0.5, h, "df"); p.line(0, h * 0.85, w, h * 0.85, "df"); p.line(0, h * 0.15, w, h * 0.15, "df");
		[[0.5, 0.18, "Rovo", "dd", "dti", "rovo"], [0.18, 0.42, "Liam", "dg", "dti", null], [0.62, 0.55, "Roshini", "dps", "dt", null], [0.3, 0.74, "Claude", "dbd", "dti", "anthropic"]].forEach(([fx, fy, name, c, t, mark]) => {
			const x = w * fx, y = h * fy;
			glyph(p, "pointer", x - 30, y - 34, 32);
			const bw = 40 + textWidth(name, 22) + (mark ? 30 : 30);
			p.rect(x, y, bw, 44, 22, c);
			if (mark) logo(p, mark, x + 10, y + 9, 26, "");
			else avatar(p, x + 22, y + 22, 13);
			p.text(x + 42, y + 30, name, 22, t, { weight: 600 });
		});
	},
	loomRecordBar(p, w, h) {
		card(p, w, h);
		toolbar(p, 40, h / 2 - 50, w - 80, 100, ["close", "screen", "window", "crop", "photo", "camoff", "mic", "lock", "dots"], "Record for agent", 400);
	},
	governance(p, w, h) {
		card(p, w, h);
		glyph(p, "shield", 20, 18, 40);
		title(p, 72, 44, "AI governance", 18);
		[["Model access", "Restricted"], ["Data residency", "EU only"], ["Agent permissions", "Reviewed"], ["Audit log", "On"]].forEach(([label, value], i) => {
			const y = 100 + i * 46;
			rule(p, 20, y - 28, w - 20);
			p.text(24, y, label, 15, "dt");
			chip(p, w - 30 - textWidth(value, 12) - 22, y - 18, value, { size: 12, h: 26, c: "dp" });
		});
	},
	stampTyping: (p, w, h) => stamp(p, w, h, (q, W, H, s) => { q.rect(W * 0.14, H * 0.32, W * 0.72, H * 0.36, H * 0.18, "dd"); [0.32, 0.5, 0.68].forEach(fx => q.circle(W * fx, H * 0.5, s * 0.06, "dwi")); }),
	agentIdentities(p, w, h) {
		card(p, w, h);
		[[14, "1,366", "Active non-human identities", "globe"], [292, "652", "Delegated by user", "people"]].forEach(([x, big, label, icon]) => {
			p.rect(x, 14, 258, 62, 10, "dwf");
			glyph(p, icon, x + 14, 32, 22);
			p.text(x + 48, 42, big, 18, "dt", { weight: 600 });
			p.text(x + 48, 62, label, 11, "dtm");
		});
		const cols = [24, 272, 440];
		["Name", "Account status", "Mode"].forEach((label, i) => p.text(cols[i], 106, label, 12, "dtm", { weight: 600 }));
		rule(p, 14, 116, w - 14);
		[["rovo", "Rovo", "Autonomous"], ["graph", "Blocker checker", "Delegated"], ["service", "Brand voice creator", "Delegated"], ["talent", "Brief builder", "Delegated"], ["studio", "Brief extraction", "Delegated"]].forEach(([mark, name, mode], i) => {
			const y = 146 + i * 44;
			logo(p, mark, cols[0], y - 16, 22, "dwf");
			p.text(cols[0] + 32, y, name, 14, "dt");
			chip(p, cols[1], y - 15, "Active", { size: 11, h: 22, c: "dg", text: "dti", icon: "tick" });
			chip(p, cols[2], y - 15, mode, { size: 11, h: 22, c: "dwf", icon: mode === "Autonomous" ? "spark" : "people" });
			if (i < 4) rule(p, 14, y + 18, w - 14);
		});
	},
	searchDrop(p, w, h) {
		card(p, w, h);
		glyph(p, "search", 16, 12, 18); p.text(44, 27, "launch", 14, "dt"); glyph(p, "close", w - 34, 12, 18);
		rule(p, 0, 42, w);
		let x = 16;
		[["All apps", "dd", "dti"], ["Jira", "dwf", "dt"], ["Confluence", "dwf", "dt"], ["Google Drive", "dwf", "dt"], ["Slack", "dwf", "dt"]].forEach(([label, c, t]) => { x += chip(p, x, 52, label, { size: 11, h: 22, c, text: t }) + 8; });
		row(p, 16, 104, w - 40, { icon: "search", label: "Search all apps · \"launch\"", size: 12 });
		p.text(16, 140, "SEARCH RESULTS", 10, "dtx", { spacing: 1 });
		[["confluence", "Q3 launch plan", "Page · Product Strategy", "2d"], ["jira", "Ship the pricing page", "LAUNCH-214 · Mobile Launch", "1h"], ["drive", "Launch announcement draft", "Google Docs · Launch", "1d"], ["slack", "Comms move to launch morning", "Message · #launch-team", "4h"]].forEach(([mark, label, sub, age], i) => {
			row(p, 16, 172 + i * 48, w - 40, { mark, label, sub, value: age, size: 13 });
		});
	},
	composer(p, w, h) {
		card(p, w, h);
		p.text(22, 36, "Draft the launch update for Friday", 16, "dt");
		glyph(p, "plus", 20, 70, 20);
		p.rect(52, 68, 44, 24, 6, "dp"); logo(p, "jira", 56, 71, 18, ""); logo(p, "confluence", 74, 71, 18, "");
		p.text(104, 86, "+10", 13, "dtm");
		glyph(p, "screen", 144, 70, 20);
		glyph(p, "shuffle", w - 120, 70, 20); p.text(w - 96, 86, "Auto", 13, "dtm");
		glyph(p, "send", w - 50, 64, 32);
	},
	reasoning(p, w, h) {
		card(p, w, h);
		[["shuffle", "Let Rovo decide", "Rovo picks reasoning for the job"], ["bolt", "Quick answers", "Faster replies with lighter reasoning"], ["tick", "Work", "The do-it-all mode for complex, evolving tasks"]].forEach(([icon, label, sub], i) => {
			const y = 16 + i * 42;
			if (i === 2) { p.circle(26, y + 16, 12, "dd"); p.circle(26, y + 16, 7, "dki"); } else glyph(p, icon, 14, y + 4, 24);
			p.text(50, y + 15, label, 13, "dt", { weight: 600 });
			p.text(50, y + 31, sub, 10, "dtm");
			if (i === 2) glyph(p, "tick", w - 30, y + 6, 18);
		});
	},
	avatars(p, w, h) {
		card(p, w, h);
		for (let i = 0; i < 6; i += 1) { avatar(p, 50 + i * 38, 52, 26); }
		chip(p, 24, 88, "+18 collaborating", { size: 12, h: 26, c: "dp" });
	},
	compact(p, w, h) {
		card(p, w, h);
		["compose", "expand", "dots"].forEach((icon, i) => glyph(p, icon, w - 96 + i * 28, 14, 18));
		rule(p, 0, 46, w);
		p.rect(w - 360, 70, 336, 40, 14, "dd");
		p.text(w - 342, 96, "Draft an agenda for our sprint retro", 15, "dti");
		p.text(28, 150, "Here is a 45-minute agenda you can run as is:", 15, "dt");
		["Check-in (5 min): one word on how the sprint felt", "What went well (10 min): wins worth repeating", "What slowed us down (15 min): blockers and surprises", "Pick two improvements (15 min)"].forEach((item, i) => {
			const y = 190 + i * 34;
			p.text(36, y, `${i + 1}.`, 14, "dt", { weight: 600 });
			p.text(58, y, item, 14, "dt");
		});
		lettering(p, 28, 340, 520, 5, { gap: 26, h: 8, seed: 44 });
		p.rect(20, h - 70, w - 40, 50, 25, "dwf");
		logo(p, "rovo", 34, h - 59, 28, ""); p.text(72, h - 40, "Ask a follow-up…", 14, "dtm");
		p.text(w - 120, h - 40, "Auto", 12, "dtm"); glyph(p, "send", w - 66, h - 61, 32);
	},
	glyphChat(p, w, h) {
		card(p, w, h, "dd");
		p.poly([[w * 0.2, h * 0.26], [w * 0.8, h * 0.26], [w * 0.8, h * 0.66], [w * 0.46, h * 0.66], [w * 0.3, h * 0.8], [w * 0.32, h * 0.66], [w * 0.2, h * 0.66]], "dwi");
		[0.38, 0.5, 0.62].forEach(fx => p.circle(w * fx, h * 0.46, w * 0.04, "dd"));
	},
	appJira: appTile("jira"),
	filmFacets(p, w, h) {
		card(p, w, h);
		title(p, 18, 34, "Facets", 16);
		[0, 1, 2].forEach(i => { p.rect(18 + i * 110, 52, 100, 150, 8, i === 1 ? "dg" : "dps"); glyph(p, "photo", 38 + i * 110, 100, 60); });
		for (let i = 0; i < 14; i += 1) p.rect(18 + i * 23.5, 214, 16, 10, 2, "db");
		["Speaker", "Slides", "B-roll"].forEach((label, i) => chip(p, 18 + i * 110, 242, label, { size: 12, h: 26, c: i === 1 ? "dd" : "dwf", text: i === 1 ? "dti" : "dt" }));
	},
	dashboardArtifact(p, w, h) {
		card(p, w, h);
		title(p, 20, 36, "Launch readiness dashboard", 17);
		[["Open risks", "7"], ["Tasks done", "82%"], ["Sign-offs", "4/6"]].forEach(([label, value], i) => {
			const x = 20 + i * 178;
			p.rect(x, 56, 166, 76, 10, "dwf");
			caption(p, x + 14, 80, label, 12);
			p.text(x + 14, 116, value, 26, "dt", { weight: 600 });
		});
		p.rect(20, 148, 340, 252, 10, "dwf");
		bars(p, 40, 180, 300, 190, [[3, 2, 1], [4, 2, 2], [2, 3, 1], [5, 2, 2], [6, 3, 1], [4, 4, 2]]);
		p.rect(372, 148, 176, 252, 10, "dwf");
		caption(p, 386, 174, "By team", 12);
		["Mobile", "Web", "Platform", "Legal", "Comms"].forEach((label, i) => { const y = 206 + i * 38; p.text(386, y, label, 12, "dt"); p.bar(386, y + 8, 40 + spread(50, i) * 110, 6, SERIES[i % 4]); });
	},
	codeCard(p, w, h) {
		card(p, w, h, "dd");
		["const session = await", "  agent.track(issue)", "session.link(\"TEU-112\")", "// replay window: 48h"].forEach((line, i) => p.text(16, 32 + i * 26, line, 13, "dti dtx"));
	},
	mentions(p, w, h) {
		card(p, w, h);
		title(p, 24, 40, "Launch retro notes", 20);
		caption(p, 24, 62, "Confluence · Edited 5m ago");
		[0, 1, 2, 3].forEach(i => {
			const y = 100 + i * 70;
			avatar(p, 40, y + 10, 14);
			p.text(64, y + 6, ["@Liam Chen", "@Roshini Patel", "@Rovo", "@Eduardo Silva"][i], 14, "dt", { weight: 600 });
			lettering(p, 64, y + 20, 500, 2, { gap: 14, h: 7, seed: 60 + i });
			if (i === 2) p.rect(60, y - 10, 70, 22, 6, "dp");
		});
	},
	loomTeleprompter(p, w, h) {
		card(p, w, h);
		p.rect(30, 30, w - 60, h - 60, 24, "dd");
		["Today we are", "launching agent", "sessions in Jira,", "so every team can", "see agent work", "as it happens."].forEach((line, i) => p.text(64, 120 + i * 62, line, 40, i === 2 ? "dti dtd" : "dti dtd", { weight: i === 2 ? 700 : 400 }));
		p.rect(54, h - 120, w - 108, 48, 24, "dg");
		logo(p, "loom", 70, h - 112, 32, "");
		p.text(116, h - 88, "Teleprompter · 0:42", 18, "dti");
	},
	iso42001(p, w, h) {
		card(p, w, h);
		p.circle(120, h / 2, 90, "dk"); p.circle(120, h / 2, 74, "dp");
		glyph(p, "shieldline", 88, h / 2 - 40, 64);
		p.text(120, h / 2 + 52, "CERTIFIED", 12, "dtx", { anchor: "middle", spacing: 2 });
		title(p, 240, 110, "ISO/IEC 42001", 30);
		caption(p, 240, 142, "AI management system", 16);
		lettering(p, 240, 170, 300, 3, { gap: 18, h: 8, seed: 70 });
	},
	stampPhotos: (p, w, h) => stamp(p, w, h, (q, W, H) => { q.rect(W * 0.18, H * 0.16, W * 0.64, H * 0.6, 8, "dps"); glyph(q, "photo", W * 0.26, H * 0.2, W * 0.48); q.rect(W * 0.12, H * 0.08, W * 0.16, H * 0.06, 2, "dg"); }),
	atlassianMcp(p, w, h) {
		card(p, w, h);
		p.text(28, 56, "ATLASSIAN MCP", 22, "dtx", { spacing: 1.5 });
		p.text(28, 110, "Enhanced", 22, "dt");
		p.text(28, 140, "performance and", 22, "dt");
		p.text(28, 170, "enterprise security", 22, "dt");
		logo(p, "anthropic", w - 150, 30, 50, "dwf");
		logo(p, "figma", w - 90, 30, 50, "dwf");
	},
	filters(p, w, h) {
		card(p, w, h);
		let x = 6;
		[["All apps", "dd", "dti"], ["Jira", null, "dt"], ["Confluence", null, "dt"], ["Google Drive", null, "dt"], ["GitHub", null, "dt"], ["More", null, "dt"]].forEach(([label, c, t]) => { x += chip(p, x, 4, label, { size: 12, h: 24, c: c || "dwf", text: t }) + 10; });
		glyph(p, "filter", w - 30, 6, 20);
	},
	starters(p, w, h) {
		card(p, w, h); p.rect(0, 0, w, h, h / 2, "dk");
		glyph(p, "spark", 12, 9, 18); p.text(38, 24, "Summarise my week", 13, "dt"); glyph(p, "chevron", w - 30, 9, 18);
	},
	workPill(p, w, h) {
		card(p, w, h); p.rect(0, 0, w, h, h / 2, "dk");
		p.circle(22, 18, 10, "dk"); glyph(p, "tick", 15, 11, 14);
		p.text(42, 24, "Work", 15, "dt");
	},
	badgeRovo(p, w, h) {
		card(p, w, h);
		p.rect(14, 14, w - 28, 112, 10, "dd");
		p.bar(w / 2 - 20, 22, 40, 5, "dg");
		logo(p, "rovo", w / 2 - 22, 50, 44, "dg");
		p.text(22, 158, "Rovo", 16, "dt", { weight: 600 }); p.circle(70, 152, 7, "dd"); glyph(p, "tick", 64, 146, 12);
		caption(p, 22, 178, "Atlassian", 12);
		p.text(22, 208, "Rovo is Atlassian’s AI-", 12, "dt");
		p.text(22, 224, "powered teammate.", 12, "dt");
		glyph(p, "chat", 22, 246, 18); glyph(p, "dots", 48, 246, 18);
	},
	switch(p, w, h) {
		card(p, w, h);
		p.text(14, 29, "Agents", 14, "dt");
		p.rect(w - 64, 10, 50, 26, 13, "dd"); p.circle(w - 27, 23, 9, "dwi");
	},
	glyphForYou: glyphTile("clock"),
	appSlack: appTile("slack"),
	artifactsLogo(p, w, h) {
		card(p, w, h);
		logo(p, "studio", 30, 30, 76, "dd");
		p.text(130, 92, "Artifacts", 52, "dt dtd", { weight: 600 });
	},
	codeSearchLogo(p, w, h) {
		card(p, w, h);
		logo(p, "codesearch", 30, 32, 78, "dps");
		p.text(130, 94, "Code Search", 52, "dt dtd", { weight: 600 });
	},
	attribution(p, w, h) {
		card(p, w, h);
		title(p, 20, 36, "Content attribution", 16);
		lettering(p, 20, 56, 320, 3, { gap: 16, h: 7, seed: 80 });
		[["confluence", "Q3 launch plan"], ["jira", "LAUNCH-214"], ["slack", "#launch-team"]].forEach(([mark, label], i) => row(p, 20, 128 + i * 32, w - 40, { mark, label, size: 13, value: `[${i + 1}]` }));
	},
	loomCameraBubble(p, w, h) {
		card(p, w, h);
		p.circle(w / 2, 190, 150, "dg"); p.circle(w / 2, 190, 150, "dk");
		p.circle(w / 2, 160, 50, "dwi"); p.sector(w / 2, 320, 100, 0, -1.2, 1.2, "dwi");
		p.rect(w / 2 - 110, 370, 220, 50, 25, "dw"); p.rect(w / 2 - 110, 370, 220, 50, 25, "dk");
		logo(p, "loom", w / 2 - 96, 380, 30, ""); p.text(w / 2 - 56, 402, "Recording · 1:08", 15, "dt");
	},
	statTokens(p, w, h) {
		card(p, w, h);
		caption(p, 24, 42, "Tokens this month", 15);
		p.text(24, 110, "2.4B", 56, "dt dtd", { weight: 600 });
		chip(p, 170, 76, "+18% vs Sept", { size: 12, h: 26, c: "dp", icon: "spark" });
		rule(p, 24, 280, w - 24);
		sparkline(p, 24, 150, w - 48, 120, 81, 20);
		["Jul", "Aug", "Sep", "Oct"].forEach((m, i) => p.text(24 + i * (w - 60) / 3, 304, m, 11, "dtx"));
	},
	stampShapes: (p, w, h) => stamp(p, w, h, (q, W, H) => { q.circle(W * 0.3, H * 0.5, H * 0.2, "dd"); q.rect(W * 0.48, H * 0.3, H * 0.4, H * 0.4, 4, "dg"); q.poly([[W * 0.8, H * 0.3], [W * 0.92, H * 0.7], [W * 0.68, H * 0.7]], "dk"); }),
	redactedPrompt(p, w, h) {
		card(p, w, h);
		glyph(p, "lock", 20, 18, 24); title(p, 56, 38, "Prompt (redacted)", 16);
		[[0, 420, 0], [0, 200, 210], [0, 470, 0], [0, 120, 300], [0, 380, 0], [0, 240, 140]].forEach(([, len, redact], i) => {
			const y = 80 + i * 36;
			p.bar(24, y, len, 9, "db");
			if (redact) p.rect(24 + len + 10, y - 5, Math.min(redact, w - 60 - len), 18, 3, "dd");
		});
		chip(p, 24, 300, "PII removed · 3", { size: 12, h: 26, c: "dp", icon: "shieldline" });
	},
	skills(p, w, h) {
		card(p, w, h);
		title(p, 22, 38, "Skills", 18); caption(p, 90, 38, "12 enabled", 12);
		let x = 22, y = 64;
		["Summarise", "Create Jira tasks", "Draft page", "Search code", "Translate", "Find owners", "Write release notes", "Triage requests", "Plan sprint"].forEach((label, i) => {
			const cw = textWidth(label, 13) + 50;
			if (x + cw > w - 22) { x = 22; y += 44; }
			chip(p, x, y, label, { size: 13, h: 32, c: i % 3 === 0 ? "dp" : "dwf", icon: ["spark", "check", "page", "code", "globe", "people", "file", "list", "calendar"][i] });
			x += cw + 10;
		});
	},
	sources(p, w, h) {
		card(p, w, h);
		title(p, 20, 36, "Sources", 16); caption(p, w - 70, 36, "6 found", 11);
		[["confluence", "Q3 launch plan"], ["jira", "LAUNCH-214"], ["slack", "#launch-team"], ["drive", "Pricing deck"], ["github", "pricing-api"], ["figma", "Launch page"]].forEach(([mark, label], i) => row(p, 20, 80 + i * 42, w - 40, { mark, label, size: 13 }));
	},
	scheduledTask(p, w, h) {
		card(p, w, h);
		glyph(p, "calendar", 20, 18, 28); title(p, 58, 40, "Scheduled task", 17);
		caption(p, 20, 74, "Every Friday · 9:00 AM", 13);
		p.rect(20, 92, w - 40, 230, 10, "dwf");
		["M", "T", "W", "T", "F", "S", "S"].forEach((d, i) => p.text(44 + i * 58, 118, d, 12, "dtx", { anchor: "middle" }));
		for (let r = 0; r < 4; r += 1) for (let c = 0; c < 7; c += 1) {
			const x = 44 + c * 58, y = 148 + r * 44;
			if (c === 4) { p.circle(x, y, 15, "dd"); p.text(x, y + 4, String(r * 7 + c + 1), 11, "dti", { anchor: "middle" }); }
			else p.text(x, y + 4, String(r * 7 + c + 1), 11, "dtm", { anchor: "middle" });
		}
		title(p, 20, 360, "Send weekly launch update", 15);
		lettering(p, 20, 380, w - 60, 4, { gap: 18, h: 7, seed: 90 });
		chip(p, 20, 470, "Rovo · Work", { size: 13, h: 30, c: "dp", icon: "tick" });
		chip(p, 180, 470, "#launch-team", { size: 13, h: 30, c: "dwf", icon: "chat" });
		p.rect(20, 530, w - 40, 40, 20, "dd"); p.text(w / 2, 556, "Save schedule", 15, "dti", { anchor: "middle", weight: 600 });
	},
	bloom(p, w, h) {
		card(p, w, h); p.rect(0, 0, w, h, h / 2, "dk");
		glyph(p, "spark", 16, 14, 32); p.text(60, 38, "Thinking deeply…", 17, "dt");
		for (let i = 0; i < 4; i += 1) p.circle(214 + i * 10, 30, 3, i === 0 ? "dd" : "dg");
	},
	glyphAuto: glyphTile("shuffle"),
	appFigma: appTile("figma"),
	codeSearchQuery(p, w, h) {
		card(p, w, h, "dd");
		glyph(p, "search", 18, 18, 26);
		p.text(60, 40, "repo:payments-gateway lang:ts \"retryPolicy\" path:src/webhooks", 18, "dti dtx");
		chip(p, w - 130, 16, "142 results", { size: 12, h: 30, c: "dg", text: "dti" });
	},
	shareSnapshot(p, w, h) {
		card(p, w, h);
		title(p, 22, 38, "Share snapshot", 17); glyph(p, "close", w - 40, 20, 20);
		p.rect(22, 56, w - 44, 120, 8, "dp"); bars(p, 40, 70, 260, 90, [[2, 1], [3, 1], [2, 2], [4, 1], [5, 2]]); lettering(p, 320, 80, 150, 4, { gap: 16, h: 6, seed: 95 });
		p.rect(22, 192, w - 160, 36, 8, "dwf"); glyph(p, "link", 32, 200, 20); p.text(60, 215, "atlassian.net/s/q3-launch", 13, "dtm");
		p.rect(w - 126, 192, 104, 36, 8, "dd"); p.text(w - 74, 215, "Copy link", 13, "dti", { anchor: "middle", weight: 600 });
		for (let i = 0; i < 4; i += 1) avatar(p, 40 + i * 26, 258, 13);
		caption(p, 160, 263, "Shared with 4 people", 12);
	},
	loomOverlays(p, w, h) {
		card(p, w, h);
		p.rect(20, 20, w - 40, h - 40, 14, "dg");
		p.text(70, 160, "Q3 roadmap", 64, "dti dtd", { weight: 700 });
		p.rect(70, 200, 420, 60, 30, "dw"); p.circle(100, 230, 16, "dd"); p.text(130, 238, "Chapter 2 · Agent sessions", 22, "dt");
		p.circle(w - 160, h - 160, 100, "dw"); avatar(p, w - 160, h - 160, 88);
		p.rect(70, h - 110, 640, 52, 10, "dd");
		p.text(92, h - 76, "“Agents now show their work inside Jira.”", 22, "dti");
		for (let i = 0; i < 40; i += 1) p.rect(70 + i * 16, h - 40, 10, 6, 2, i < 18 ? "dwi" : "db");
	},
	stampShield: (p, w, h) => stamp(p, w, h, (q, W, H) => { q.rect(W * 0.12, H * 0.12, W * 0.76, H * 0.76, 10, "dwf"); glyph(q, "shield", W * 0.26, H * 0.26, W * 0.48); }),
	needsInput(p, w, h) {
		card(p, w, h);
		chip(p, 22, 20, "Needs input", { size: 13, h: 30, c: "dd", text: "dti", icon: "help" });
		title(p, 22, 92, "Confirm the rollback window", 20);
		lettering(p, 22, 116, w - 60, 3, { gap: 18, h: 8, seed: 100 });
		["24 hours", "48 hours", "72 hours"].forEach((label, i) => {
			const y = 190 + i * 52;
			p.rect(22, y, w - 44, 42, 10, i === 1 ? "dps" : "dwf");
			p.circle(46, y + 21, 9, "dk"); if (i === 1) p.circle(46, y + 21, 5, "dd");
			p.text(68, y + 27, label, 15, "dt");
		});
		p.rect(w - 172, h - 62, 150, 40, 20, "dd"); p.text(w - 97, h - 36, "Send to agent", 14, "dti", { anchor: "middle", weight: 600 });
	},
	mobileChat(p, w, h) {
		card(p, w, h, "dd");
		p.rect(14, 14, w - 28, h - 28, 40, "dw");
		p.bar(w / 2 - 50, 30, 100, 18, "dd");
		title(p, 40, 110, "Rovo", 22); glyph(p, "dots", w - 80, 90, 28);
		[[true, 260], [false, 300], [true, 220], [false, 320], [true, 260]].forEach(([mine, bw], i) => {
			const y = 150 + i * 120, x = mine ? w - bw - 40 : 40;
			p.rect(x, y, bw, 90, 22, mine ? "dd" : "dp");
			lettering(p, x + 20, y + 26, bw - 40, 3, { gap: 18, h: 8, seed: 110 + i, c: mine ? "dwi" : "db" });
		});
		p.rect(40, h - 110, w - 80, 56, 28, "dwf"); p.text(70, h - 76, "Message Rovo", 18, "dtm"); glyph(p, "send", w - 100, h - 104, 44);
	},
	sourcesPopover(p, w, h) {
		card(p, w, h);
		title(p, 24, 42, "Answer sources", 18); glyph(p, "close", w - 44, 22, 22);
		rule(p, 0, 64, w);
		[["confluence", "Q3 launch plan", "Product Strategy · Updated 2d ago"], ["jira", "LAUNCH-214 Ship the pricing page", "Mobile Launch · In progress"], ["slack", "Comms move to launch morning", "#launch-team · 4h ago"], ["drive", "Launch announcement draft", "Google Docs · 1d ago"], ["github", "pricing-api #482", "Merged · 6h ago"]].forEach(([mark, label, sub], i) => {
			row(p, 24, 106 + i * 74, w - 60, { mark, label, sub, value: `${i + 1}`, size: 16 });
			if (i < 4) rule(p, 24, 140 + i * 74, w - 24);
		});
	},
	agentCard(p, w, h) {
		card(p, w, h);
		p.rect(20, 20, w - 40, 170, 12, "dp");
		logo(p, "graph", w / 2 - 50, 55, 100, "dw");
		title(p, 30, 236, "Blocker checker", 26);
		caption(p, 30, 266, "Agent · Created by Liam Chen", 15);
		lettering(p, 30, 296, w - 80, 3, { gap: 22, h: 9, seed: 120 });
		p.text(30, 392, "Skills", 15, "dt", { weight: 600 });
		let x = 30;
		["Jira", "Confluence", "Slack"].forEach(label => { x += chip(p, x, 408, label, { size: 14, h: 32, c: "dwf" }) + 10; });
		p.text(30, 480, "Recent runs", 15, "dt", { weight: 600 });
		["Checked LAUNCH-214", "Flagged 2 blockers"].forEach((label, i) => row(p, 30, 520 + i * 36, w - 70, { icon: "tick", label, value: `${i + 2}h`, size: 14 }));
	},
	ringsTile(p, w, h) {
		card(p, w, h);
		p.circle(w * 0.42, h * 0.52, w * 0.22, "dk"); p.circle(w * 0.58, h * 0.48, w * 0.22, "dk");
		glyph(p, "spark", w * 0.66, h * 0.18, w * 0.18);
	},
	appGithub: appTile("github"),
	twgSearchCli(p, w, h) {
		terminal(p, w, h, ["twg search \"launch risks\" --sources all", "✓ 4 sources · 12 results in 380ms", "  Q3 launch plan          confluence", "  LAUNCH-214               jira"]);
		void w;
	},
	readiness(p, w, h) {
		card(p, w, h);
		title(p, 24, 40, "Launch readiness", 17);
		p.sector(w / 2, 220, 130, 104, -Math.PI / 2, Math.PI / 2, "db");
		p.sector(w / 2, 220, 130, 104, -Math.PI / 2, Math.PI * 0.28, "dd");
		p.text(w / 2, 200, "86", 52, "dt dtd", { anchor: "middle", weight: 600 });
		p.text(w / 2, 228, "High", 15, "dtm", { anchor: "middle" });
		[["Scope", "Done"], ["Risks", "2 open"], ["Sign-off", "Pending"]].forEach(([label, value], i) => { const y = 280 + i * 34; rule(p, 24, y - 22, w - 24); p.text(24, y, label, 14, "dt"); p.text(w - 24, y, value, 13, "dtm", { anchor: "end" }); });
	},
	stampRovoMark: (p, w, h) => stamp(p, w, h, (q, W, H) => { logo(q, "rovo", W * 0.18, H * 0.2, W * 0.64, ""); }),
	agentSessions(p, w, h) {
		card(p, w, h);
		title(p, 24, 44, "Agent sessions", 20); chip(p, w - 110, 22, "Live · 3", { size: 13, h: 30, c: "dd", text: "dti" });
		[["Rovo", "Drafting release notes", "Running"], ["Claude", "Fixing webhook retries", "Needs input"], ["Codex", "Writing tests for TEU-112", "Running"], ["Blocker checker", "Scanning LAUNCH board", "Done"]].forEach(([agent, task, status], i) => {
			const y = 80 + i * 112;
			p.rect(20, y, w - 40, 96, 12, i === 1 ? "dps" : "dwf");
			logo(p, i === 0 ? "rovo" : i === 1 ? "anthropic" : i === 2 ? "openai" : "graph", 36, y + 16, 34, "dw");
			p.text(84, y + 36, agent, 16, "dt", { weight: 600 });
			p.text(84, y + 60, task, 14, "dtm");
			p.bar(84, y + 74, w - 200, 6, "db"); p.bar(84, y + 74, (w - 200) * (0.3 + i * 0.2), 6, "dd");
			p.text(w - 36, y + 36, status, 13, "dtm", { anchor: "end" });
		});
	},
	appDrive: appTile("drive"),
	highReadiness(p, w, h) {
		card(p, w, h); p.rect(10, 14, w - 20, h - 28, (h - 28) / 2, "dk");
		glyph(p, "ring", 26, 26, 34);
		p.text(70, 50, "High readiness", 20, "dt", { weight: 500 });
	},
	stampTangle: (p, w, h) => stamp(p, w, h, (q, W, H) => { q.poly(Array.from({ length: 24 }, (_, i) => [W * (0.5 + Math.sin(i * 2.3) * 0.34), H * (0.5 + Math.cos(i * 1.7) * 0.32)]), "dk", false); }),
	requestResolver(p, w, h) {
		card(p, w, h);
		logo(p, "service", 24, 20, 40, "dwf"); title(p, 78, 48, "Request resolver", 20); caption(p, 300, 48, "Jira Service Management", 13);
		rule(p, 0, 80, w);
		[["HR-482", "Laptop not enrolling in MDM", "Resolved by agent"], ["IT-1193", "Access to pricing-api repo", "Awaiting approval"], ["HR-490", "Update parental leave dates", "Resolved by agent"], ["IT-1201", "VPN drops on hotel Wi-Fi", "Suggested fix sent"]].forEach(([key, label, status], i) => {
			const y = 126 + i * 64;
			glyph(p, "check", 24, y - 18, 22);
			p.text(58, y, key, 14, "dtx");
			p.text(150, y, label, 16, "dt");
			chip(p, w - 230, y - 20, status, { size: 12, h: 28, c: status.startsWith("Resolved") ? "dg" : "dwf", text: status.startsWith("Resolved") ? "dti" : "dt" });
			if (i < 3) rule(p, 24, y + 26, w - 24);
		});
	},
	appLoom: appTile("loom"),
	stampLoops: (p, w, h) => stamp(p, w, h, (q, W, H) => { [0.3, 0.5, 0.7].forEach(fx => q.circle(W * fx, H * 0.5, W * 0.16, "dk")); }),
	jiraList(p, w, h) {
		card(p, w, h);
		const cols = [24, 130, 520, 700, 860];
		["Key", "Summary", "Status", "Assignee", "Agent"].forEach((label, i) => p.text(cols[i], 34, label, 13, "dtm", { weight: 600 }));
		rule(p, 14, 46, w - 14);
		[["TEU-10", "Agent Session Tracking", "Done"], ["TEU-11", "Agent Effectiveness", "Done"], ["TEU-109", "Change Risk Assessment", "In review"], ["TEU-111", "Incident Command Center", "In progress"], ["TEU-13", "Guard Scanning", "To do"]].forEach(([key, summary, status], i) => {
			const y = 80 + i * 44;
			glyph(p, "check", cols[0], y - 15, 18); p.text(cols[0] + 26, y, key, 13, "dtx");
			p.text(cols[1], y, summary, 15, "dt");
			chip(p, cols[2], y - 16, status, { size: 11, h: 22, c: status === "Done" ? "dg" : "dwf", text: status === "Done" ? "dti" : "dt" });
			avatar(p, cols[3] + 12, y - 5, 12);
			logo(p, i % 2 ? "rovo" : "anthropic", cols[4], y - 17, 22, "dwf");
			if (i < 4) rule(p, 14, y + 18, w - 14);
		});
	},
	presenceFacepile(p, w, h) {
		card(p, w, h);
		title(p, 24, 44, "In this page now", 18);
		for (let i = 0; i < 7; i += 1) avatar(p, 54 + i * 58, 112, 32);
		chip(p, 24, 170, "Rovo is editing · Section 3", { size: 14, h: 34, c: "dd", text: "dti", icon: "compose" });
	},
	stampRibbon: (p, w, h) => stamp(p, w, h, (q, W, H) => { q.poly([[W * 0.06, H * 0.3], [W * 0.94, H * 0.3], [W * 0.86, H * 0.5], [W * 0.94, H * 0.7], [W * 0.06, H * 0.7], [W * 0.14, H * 0.5]], "dd"); q.text(W / 2, H * 0.56, "SHIPPED", H * 0.16, "dti dtx", { anchor: "middle", spacing: 3 }); }),
	riskStack(p, w, h) {
		card(p, w, h);
		title(p, 24, 44, "Change risk", 20); chip(p, w - 140, 20, "Low risk", { size: 14, h: 32, c: "dp", icon: "shieldline" });
		[["Compliance", ["Technical security policy breach", "Organization policy breach"]], ["Operational", ["Scheduling conflicts", "Stakeholder impact"]], ["Technical", ["Database migration", "Feature flag rollout"]]].forEach(([group, items], i) => {
			const y = 80 + i * 168;
			p.rect(20, y, w - 40, 152, 12, "dwf");
			glyph(p, ["shieldline", "gear", "code"][i], 36, y + 16, 22);
			p.text(68, y + 34, group, 16, "dt", { weight: 600 });
			items.forEach((item, k) => { p.rect(36, y + 56 + k * 44, textWidth(item, 14) + 24, 34, 8, "dw"); p.text(48, y + 78 + k * 44, item, 14, "dt"); });
		});
	},
	rovoWithYou(p, w, h) {
		card(p, w, h);
		logo(p, "rovo", 24, 24, 48, "dp");
		p.text(24, 120, "Rovo, with you", 26, "dt dtd", { weight: 600 });
		p.text(24, 150, "wherever you work", 26, "dt dtd");
		[["chat", "Chat"], ["search", "Search"], ["people", "Agents"]].forEach(([icon, label], i) => chip(p, 24 + i * 116, 200, label, { size: 14, h: 34, c: "dwf", icon }));
		lettering(p, 24, 262, 320, 2, { gap: 16, h: 7, seed: 130 });
	},
	stampSignal: (p, w, h) => stamp(p, w, h, (q, W, H) => { [0.2, 0.32, 0.44].forEach(r => q.sector(W * 0.3, H * 0.76, H * r * 1.4, 0, 0.1, 1.45, "dk")); q.circle(W * 0.3, H * 0.76, 4, "dd"); }),
	costByModel(p, w, h) {
		card(p, w, h);
		title(p, 28, 50, "Cost by model", 22); caption(p, 28, 78, "October 2026", 15);
		[["Opus 4.6", "$1.12m", 0.92], ["GPT-5.2", "$0.84m", 0.7], ["Sonnet 4.6", "$0.61m", 0.52], ["Gemini 3", "$0.38m", 0.32], ["Codex", "$0.22m", 0.2], ["Other", "$0.11m", 0.1]].forEach(([label, value, share], i) => {
			const y = 140 + i * 82;
			logo(p, ["anthropic", "openai", "anthropic", "graph", "openai", "admin"][i], 28, y - 24, 30, "dwf");
			p.text(72, y, label, 17, "dt");
			p.text(w - 28, y, value, 16, "dtx", { anchor: "end" });
			p.bar(72, y + 16, w - 100, 10, "db"); p.bar(72, y + 16, (w - 100) * share, 10, SERIES[i % 3]);
		});
	},
	workflowCard(p, w, h) {
		card(p, w, h);
		title(p, 24, 44, "Release workflow", 20);
		[["To do", 40], ["In progress", 220], ["In review", 400]].forEach(([label, x]) => { p.rect(x, 90, 150, 50, 10, "dwf"); p.text(x + 75, 121, label, 15, "dt", { anchor: "middle" }); });
		p.line(190, 115, 220, 115, "dk"); p.line(370, 115, 400, 115, "dk");
		p.rect(220, 200, 150, 50, 10, "dd"); p.text(295, 231, "Done", 15, "dti", { anchor: "middle", weight: 600 });
		p.poly([[475, 140], [475, 225], [370, 225]], "dk", false);
		chip(p, 40, 290, "Rule: when PR merges, move to Done", { size: 14, h: 34, c: "dp", icon: "bolt" });
		lettering(p, 40, 350, 500, 3, { gap: 18, h: 8, seed: 140 });
	},
	stampGrid: (p, w, h) => stamp(p, w, h, (q, W, H) => { for (let i = 0; i < 8; i += 1) for (let j = 0; j < 3; j += 1) q.rect(W * 0.08 + i * W * 0.108, H * 0.2 + j * H * 0.22, W * 0.08, H * 0.16, 2, (i + j) % 3 ? "db" : "dd"); }),
	spendCard(p, w, h) {
		card(p, w, h);
		caption(p, 24, 42, "AI spend this quarter", 15);
		p.text(24, 110, "$5.6m", 56, "dt dtd", { weight: 600 });
		chip(p, 200, 76, "On budget", { size: 13, h: 30, c: "dp", icon: "tick" });
		bars(p, 24, 150, w - 48, 180, [[3, 2, 1], [3, 3, 1], [4, 3, 2], [5, 3, 2], [5, 4, 2], [6, 4, 3]]);
		[["Anthropic", "$185.6K"], ["OpenAI", "$148.2K"], ["Cursor", "$135.6K"]].forEach(([label, value], i) => { const y = 370 + i * 32; p.circle(30, y - 5, 5, SERIES[i]); p.text(44, y, label, 14, "dt"); p.text(w - 24, y, value, 14, "dtx", { anchor: "end" }); });
	},
	conversation(p, w, h) {
		card(p, w, h);
		[[false, "Liam", "Can we move comms to launch morning?"], [true, "Rovo", "Done. I updated the plan and told #launch-team."], [false, "Roshini", "Great, ping legal for the final sign-off."]].forEach(([bot, name, text], i) => {
			const y = 30 + i * 102;
			if (bot) logo(p, "rovo", 24, y, 36, "dp"); else avatar(p, 42, y + 18, 18);
			p.text(76, y + 16, name, 14, "dt", { weight: 600 });
			p.rect(76, y + 26, w - 100, 48, 12, bot ? "dp" : "dwf");
			p.text(90, y + 56, text, 14, "dt");
		});
	},
	stampSparkle: (p, w, h) => stamp(p, w, h, (q, W, H) => { glyph(q, "spark", W * 0.16, H * 0.2, W * 0.6); glyph(q, "spark", W * 0.62, H * 0.12, W * 0.26); }),
	dimensions(p, w, h) {
		card(p, w, h);
		title(p, 24, 44, "Agent effectiveness", 20);
		[["Accuracy", 0.86], ["Time saved", 0.72], ["Adoption", 0.64], ["Rework avoided", 0.58], ["Satisfaction", 0.9]].forEach(([label, v], i) => {
			const y = 100 + i * 50;
			p.text(24, y, label, 15, "dt");
			p.bar(200, y - 12, w - 300, 12, "db"); p.bar(200, y - 12, (w - 300) * v, 12, SERIES[i % 3]);
			p.text(w - 24, y, `${Math.round(v * 100)}%`, 14, "dtx", { anchor: "end" });
		});
	},
	stampFields: (p, w, h) => stamp(p, w, h, (q, W, H) => { for (let i = 0; i < 4; i += 1) { q.rect(W * 0.1, H * 0.12 + i * H * 0.2, W * 0.8, H * 0.14, 6, "dwf"); q.bar(W * 0.14, H * 0.17 + i * H * 0.2, W * (0.3 + spread(150, i) * 0.4), H * 0.04, "dbd"); } }),
	potentialSavings(p, w, h) {
		card(p, w, h);
		glyph(p, "spark", 24, 30, 40);
		caption(p, 84, 56, "Potential savings", 18);
		p.text(84, 112, "$1.2m", 48, "dt dtd", { weight: 600 });
		sparkline(p, 380, 40, 330, 90, 160);
		chip(p, 260, 82, "-21% cost", { size: 13, h: 30, c: "dp" });
	},
	stampSquiggle: (p, w, h) => stamp(p, w, h, (q, W, H) => { q.poly(Array.from({ length: 16 }, (_, i) => [W * (0.1 + i * 0.053), H * (0.5 + (i % 2 ? -0.2 : 0.2))]), "dk", false); }),
	sessionCard(p, w, h) {
		card(p, w, h);
		logo(p, "rovo", 24, 32, 70, "dp");
		p.text(120, 64, "Agent session · TEU-112", 28, "dt", { weight: 600 });
		p.text(120, 100, "Rovo is linking the rollback runbook to the release", 20, "dtm");
		for (let i = 0; i < 12; i += 1) { const x = 800 + i * 58; p.circle(x, 68, 9, i < 8 ? "dd" : "dk"); if (i < 11) p.line(x + 9, 68, x + 49, 68, i < 7 ? "dk" : "df"); }
		chip(p, w - 220, 46, "Running · 4m", { size: 18, h: 44, c: "dd", text: "dti", icon: "clock" });
	},
	stampSmile: (p, w, h) => stamp(p, w, h, (q, W, H, s) => { q.circle(W / 2, H / 2, s * 0.36, "dd"); q.circle(W * 0.42, H * 0.44, s * 0.04, "dwi"); q.circle(W * 0.58, H * 0.44, s * 0.04, "dwi"); q.sector(W / 2, H * 0.5, s * 0.2, 0, Math.PI * 0.62, Math.PI * 1.38, "dki"); }),
	agentSessionStack(p, w, h) {
		card(p, w, h);
		title(p, 30, 56, "Agent sessions on TEU-112", 26);
		chip(p, w - 200, 26, "Link agent session", { size: 15, h: 40, c: "dwf", icon: "link" });
		[["Jordan Okafor", "box key retention window before replay", "rovo"], ["Claude", "Publish and link the rollback rehearsal runbook", "anthropic"], ["Codex", "Add retries to the webhook consumer", "openai"]].forEach(([who, task, mark], i) => {
			const y = 100 + i * 180;
			p.rect(30 + i * 24, y, w - 60 - i * 48, 160, 16, i === 0 ? "dw" : "dwf");
			if (i === 0) p.rect(30, y, w - 60, 160, 16, "dk");
			logo(p, mark, 54 + i * 24, y + 24, 44, "dp");
			p.text(116 + i * 24, y + 54, who, 20, "dt", { weight: 600 });
			p.text(116 + i * 24, y + 90, task, 20, "dt");
			glyph(p, "check", 116 + i * 24, y + 110, 22); p.text(146 + i * 24, y + 128, "TEU-112", 16, "dtx");
			avatar(p, w - 100 - i * 24, y + 70, 24);
		});
	},
};

// The lanyard badge that hangs into the wall from above.
export function lanyardDetail(p, w, h) {
	const cx = w / 2;
	p.poly([[cx - 90, 0], [cx - 56, 0], [cx - 8, 150], [cx - 22, 150]], "dp");
	p.poly([[cx + 90, 0], [cx + 56, 0], [cx + 8, 150], [cx + 22, 150]], "dp");
	p.line(cx - 90, 0, cx - 22, 150, "dl"); p.line(cx - 56, 0, cx - 8, 150, "dl");
	p.line(cx + 90, 0, cx + 22, 150, "dl"); p.line(cx + 56, 0, cx + 8, 150, "dl");
	p.rect(cx - 16, 146, 32, 40, 6, "dg");
	p.circle(cx, 198, 12, "dk"); p.circle(cx, 214, 8, "dk");
	p.rect(cx - 104, 222, 208, 250, 14, "dw");
	p.rect(cx - 104, 222, 208, 250, 14, "dk");
	for (let i = 1; i < 10; i += 1) p.line(cx - 104 + i * 20.8, 222, cx - 104 + i * 20.8, 472, "df");
	for (let i = 1; i < 12; i += 1) p.line(cx - 104, 222 + i * 20.8, cx + 104, 222 + i * 20.8, "df");
	p.rect(cx - 30, 234, 60, 8, 4, "dg");
	p.circle(cx, 300, 40, "dw");
	avatar(p, cx, 300, 36);
	p.text(cx - 84, 384, "Taroon", 22, "dt", { weight: 600 });
	p.text(cx - 84, 410, "Mandhana", 22, "dt", { weight: 600 });
	p.text(cx - 84, 440, "CTO, AI AND TEAMWORK", 11, "dtx", { spacing: 1 });
}
