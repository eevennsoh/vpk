// Face detail for the board chrome, the 23 story cards, the six bento tiles and the Team ’26 title.
// Each drawer works in its surface's plan units; content and labels follow the production board
// (components/projects/jira-team-eu26-end/data/keynote-board.ts) and the source's bento faces.
import { avatar, chip, glyph, lettering, logo, pen, SERIES, spread, textWidth } from "./eu26-face-pen.mjs";

// The outer group takes the per-frame matrix; the inner face group owns the colour variables and the accent amount,
// so a transform change restyles one element instead of re-resolving variables for every child.
const wrap = markup => `<g data-eu26-detail aria-hidden="true" pointer-events="none" style="display:none"><g data-eu26-face>${markup}</g></g>`;

// ---------- Board chrome ----------
const CHROME = {
	navigation(p) {
		glyph(p, "sidebar", 12, 14, 13);
		glyph(p, "grid", 32, 14, 13);
		logo(p, "jira", 52, 12, 17, "dw");
		p.text(74, 24.5, "Jira", 8.5, "dt", { weight: 600 });
		p.rect(262, 10, 338, 22, 5, "dwf");
		glyph(p, "search", 270, 15, 11);
		p.text(286, 24, "Search", 7, "dtm");
		glyph(p, "grid", 584, 16, 9);
		p.rect(608, 10, 58, 22, 4, "dd");
		glyph(p, "plus", 613, 15, 11);
		p.text(626, 24, "Create", 7.5, "dti", { weight: 600 });
		p.rect(708, 10, 58, 22, 5, "dwf");
		logo(p, "rovo", 713, 14, 13, "");
		p.text(729, 24, "Ask Rovo", 6.5, "dt", { weight: 500 });
		glyph(p, "bell", 774, 14, 13);
		glyph(p, "help", 792, 14, 13);
		glyph(p, "gear", 810, 14, 13);
		avatar(p, 840, 21, 8);
	},
	title(p) {
		p.text(16, 11, "Spaces", 6, "dtm");
		logo(p, "jira", 16, 16, 13, "dw");
		p.text(35, 27, "Team ’26 EU keynote", 11, "dt", { weight: 600 });
		glyph(p, "people", 152, 17, 11);
		glyph(p, "dots", 168, 17, 11);
		const tabs = [["globe", "Summary"], ["board", "Board"], ["list", "List"], ["form", "Forms"], ["page", "Docs"]];
		let x = 16;
		for (const [icon, label] of tabs) {
			glyph(p, icon, x, 38.5, 8);
			p.text(x + 11, 45, label, 6.5, label === "Board" ? "dt" : "dtm", { weight: label === "Board" ? 600 : 400 });
			const w = 11 + textWidth(label, 6.5) + 4;
			if (label === "Board") p.line(x - 2, 52, x + w, 52, "dk");
			x += w + 10;
		}
		p.line(0, 52.5, 860, 52.5, "df");
		p.rect(470, 36, 74, 13, 3, "dwf");
		glyph(p, "search", 474, 38.5, 8);
		p.text(485, 45.2, "Search board", 5.5, "dtm");
		for (let i = 0; i < 7; i += 1) avatar(p, 556 + i * 8, 42.5, 6);
		let cx = 622;
		for (const [icon, label] of [["filter", "Filter"], ["layers", "Group"], [null, "Needs input"]]) cx += chip(p, cx, 36, label, { size: 5.5, h: 13, c: "dwf", icon }) + 5;
		for (const [i, icon] of ["share", "bolt", "chat", "expand"].entries()) {
			p.rect(774 + i * 20, 11, 15, 15, 3, "dwf");
			glyph(p, icon, 777 + i * 20, 14, 9);
		}
		glyph(p, "filter", 818, 37, 11);
		glyph(p, "dots", 836, 37, 11);
	},
	column(p, index, count) {
		const label = ["Context", "Collaboration", "Confidence", "Done"][index];
		if (index === 3) glyph(p, "check", 10, 9, 9);
		p.text(index === 3 ? 23 : 10, 16.5, label, 6.5, "dt", { weight: 600 });
		const offset = (index === 3 ? 23 : 10) + textWidth(label, 6.5) + 5;
		if (count) {
			p.rect(offset, 9, 13, 9.5, 4.75, "dp");
			p.text(offset + 6.5, 16, String(count), 5.5, "dtm", { anchor: "middle" });
		}
		glyph(p, "dots", 172, 9, 10);
		p.rect(5, 462, 183, 12, 3, "dwf");
		glyph(p, "plus", 92, 464, 8);
	},
	chassis(p) {
		glyph(p, "sidebar", 12, 110, 12);
		for (let i = 0; i < 16; i += 1) p.circle(18, 132 + i * 20, 1.2, "dg");
		p.circle(18, 452, 1.2, "dg");
	},
};

export function chromeDetail(name) {
	const p = pen();
	if (name === "board.navigation") CHROME.navigation(p);
	else if (name === "board.title") CHROME.title(p);
	else if (name === "board.chassis") CHROME.chassis(p);
	else if (name.startsWith("board.column")) {
		const index = Number(name.slice(-1));
		CHROME.column(p, index, [8, 6, 9, 0][index]);
	}
	return wrap(p.markup());
}

// ---------- Story cards: a cover preview (170 x 74) above the title ----------
const COVERS = {
	"TEU-1"(p) { // Rovo Desktop
		p.rect(50, 7, 78, 67, 5, "dw");
		p.rect(56, 13, 66, 12, 6, "dp");
		glyph(p, "search", 60, 15.5, 7);
		p.text(69, 21.2, "Search", 5, "dtm");
		p.rect(90, 14.5, 30, 9, 4.5, "dw");
		glyph(p, "chat", 93, 15.8, 6.4);
		p.text(101, 21, "Chat", 5, "dt", { weight: 500 });
		const rows = [["clock", "For you"], ["compose", "New chat"], ["people", "Agents"], ["star", "Starred"]];
		rows.forEach(([icon, label], i) => {
			const y = 30 + i * 10.5;
			if (i === 1) p.rect(55, y - 1.5, 68, 10, 2.5, "dp");
			glyph(p, icon, 59, y, 6.5);
			p.text(69, y + 5.2, label, 5, i === 1 ? "dt" : "dtm");
		});
		glyph(p, "pointer", 104, 39, 9);
	},
	"TEU-101"(p) { // Data Context
		for (const [col, x, icon, title, rows] of [[0, 22, "table", "Data", [["databricks", "Databricks", "841 objects"], ["mixpanel", "Mixpanel", "1,150 objects"], ["graph", "Snowflake", "932 objects"]]], [1, 92, "code", "Code", [["github", "GitHub", "465 objects"], ["gitlab", "GitLab", "2,203 objects"], ["bitbucket", "Bitbucket", "318 objects"]]]]) {
			p.rect(x, 7, 64, 70, 4, "dw");
			glyph(p, icon, x + 6, 12, 7);
			p.text(x + 16, 17.6, title, 5.5, "dt", { weight: 600 });
			p.line(x, 23, x + 64, 23, "df");
			rows.forEach(([mark, name, sub], i) => {
				const y = 27 + i * 16;
				logo(p, mark, x + 5, y, 10, "dwf");
				p.text(x + 18, y + 4.4, name, 4.4, "dt");
				p.text(x + 18, y + 9.2, sub, 3.6, "dtm");
				p.circle(x + 57, y + 5, 2.2, "dg");
				glyph(p, "tick", x + 55.5, y + 3.5, 3);
			});
			void col;
		}
	},
	"TEU-2"(p) { // Code Context
		const indents = [0, 0, 10, 10, 0, 18, 18, 10, 0, 0, 10];
		indents.forEach((indent, i) => { p.text(4, 6 + i * 6.6, String(i + 1), 3.2, "dtx"); p.bar(12 + indent, 4 + i * 6.6, 40 + spread(3, i) * 70, 1.6, "db"); });
		p.rect(10, 26, 150, 28, 5, "dw");
		p.text(18, 37, "Searching Teamwork Graph", 6, "dt", { weight: 500 });
		p.text(18, 46, "Read through 4 sources", 5, "dtm");
		["guard", "jira", "github", "confluence"].forEach((mark, i) => logo(p, mark, 110 + i * 11.5, 34, 10, i === 0 ? "dg" : "dw"));
	},
	"TEU-4"(p) { // Artifacts
		[["Concept.html", 0], ["Design Studio", 1], ["AI Usage Report", 2]].forEach(([label, i]) => {
			const x = 4 + i * 56;
			p.rect(x, 6, 52, 48, 3, i === 1 ? "dg" : "dps");
			if (i === 1) { for (let k = 0; k < 3; k += 1) p.rect(x + 7 + k * 13.5, 20, 11, 18, 1.5, k === 1 ? "dd" : "dw"); p.text(x + 26, 15, "Where must you submit", 3.2, "dti", { anchor: "middle" }); }
			else if (i === 0) { glyph(p, "photo", x + 14, 14, 24); p.rect(x + 6, 44, 40, 4, 2, "dw"); }
			else { p.text(x + 5, 22, "AMSTERDAM", 6.2, "dt", { weight: 700 }); p.text(x + 5, 29, "ITINERARY", 6.2, "dt", { weight: 700 }); lettering(p, x + 5, 36, 38, 2, { gap: 3.6, h: 1.4, seed: 4 }); }
			p.rect(x, 54, 52, 16, 0, "dw");
			p.text(x + 3, 61, label, 3.8, "dt", { weight: 500 });
			p.bar(x + 3, 64.5, 30, 1.3, "db");
		});
		logo(p, "studio", 6, 8, 9, "dw");
	},
	"TEU-102"(p) { // Code Search App
		p.rect(14, 8, 142, 14, 7, "dw");
		glyph(p, "search", 19, 11, 8);
		p.text(30, 17.4, "repo:payments retry policy", 5, "dtx");
		["retry.ts", "policy.go", "gateway.yaml"].forEach((file, i) => {
			const y = 27 + i * 15;
			p.rect(14, y, 142, 13, 3, "dw");
			glyph(p, "file", 18, y + 2.5, 8);
			p.text(29, y + 8.2, file, 4.6, "dt", { weight: 500 });
			p.bar(70, y + 5.4, 50 + spread(9, i) * 30, 1.6, "db");
		});
	},
	"TEU-3"(p) { // Rovo For Work
		p.rect(20, 10, 130, 20, 5, "dwf");
		p.rect(14, 30, 142, 26, 5, "dw");
		p.circle(26, 43, 6.5, "dd");
		glyph(p, "tick", 22.5, 39.5, 7);
		p.text(37, 41, "Work", 6.5, "dt", { weight: 600 });
		chip(p, 57, 35.5, "Open Beta", { size: 4, h: 7.5, c: "dp" });
		p.text(37, 50, "Tackles complex work across your tools", 4.2, "dtm");
		glyph(p, "tick", 144, 39, 7);
		p.rect(20, 60, 130, 14, 5, "dwf");
	},
	"TEU-103"(p) { // People Context
		p.rect(12, 8, 66, 62, 4, "dw");
		avatar(p, 45, 26, 11);
		p.text(45, 46, "Priya Raman", 5.2, "dt", { anchor: "middle", weight: 600 });
		p.text(45, 53, "Payments platform lead", 3.8, "dtm", { anchor: "middle" });
		chip(p, 24, 58, "Works with 14", { size: 3.8, h: 7, c: "dp" });
		p.line(124, 18, 124, 30, "dl");
		p.line(98, 30, 150, 30, "dl");
		avatar(p, 124, 14, 7);
		for (const [x, label] of [[98, "Design"], [124, "Eng"], [150, "PM"]]) { p.line(x, 30, x, 38, "dl"); avatar(p, x, 45, 6.5); p.text(x, 59, label, 4, "dtm", { anchor: "middle" }); }
	},
	"TEU-104"(p) { // Communications Context
		const rows = [[true, "#launch-team", 0.8], [false, "Comms move to launch morning", 0.9], [true, "Slack · 4h", 0.6]];
		rows.forEach(([mine, label], i) => {
			const y = 8 + i * 22;
			avatar(p, mine ? 18 : 152, y + 7, 6);
			p.rect(mine ? 28 : 46, y, 96, 18, 5, mine ? "dw" : "dp");
			p.text(mine ? 33 : 51, y + 7.5, label, 4.6, "dt", { weight: 500 });
			lettering(p, mine ? 33 : 51, y + 11, 82, 1, { h: 1.5, seed: 7 + i, last: 0.7 });
		});
		logo(p, "slack", 152, 52, 12, "dw");
	},
	"TEU-105"(p) { // Atlassian MCP
		p.rect(14, 18, 142, 38, 6, "dw");
		["anthropic", "figma", "openai", "cursor", "canva", "slack", "notion"].forEach((mark, i) => logo(p, mark, 22 + i * 18.4, 28, 15, "dwf"));
		glyph(p, "pointer", 148, 34, 11);
	},
	"TEU-5"(p) { // Loom Desktop
		p.rect(26, 26, 118, 22, 11, "dw");
		["screen", "window", "crop", "cam"].forEach((icon, i) => { if (i === 0) p.rect(30.5 + i * 15, 30, 13, 14, 4, "dp"); glyph(p, icon, 32 + i * 15, 31.5, 10); });
		p.rect(94, 29.5, 46, 15, 7.5, "dd");
		logo(p, "loom", 97, 31.5, 11, "");
		p.text(110, 39.5, "Record", 5.4, "dti", { weight: 600 });
	},
	"TEU-106"(p) { // Loom Record for Agent
		p.rect(4, 26, 162, 22, 11, "dw");
		["crop", "window", "photo", "camoff", "mic", "lock", "dots"].forEach((icon, i) => glyph(p, icon, 9 + i * 12.5, 32, 9));
		p.rect(98, 29.5, 64, 15, 7.5, "dd");
		p.circle(106, 37, 5, "dwi");
		glyph(p, "spark", 102.6, 33.6, 6.8);
		p.text(114, 39.3, "Record for agent", 4.8, "dti", { weight: 600 });
	},
	"TEU-7"(p) { // Planner
		const lines = [["ine mode improvements will ", "make the mobile app more reliable"], ["nnectivity. The goal is to let users continue viewing", ""], ["", "fely sync changes once reconnected without losing work"]];
		lines.forEach(([plain, marked], i) => {
			const y = 14 + i * 11;
			if (marked) { const x = 4 + textWidth(plain, 4.6); p.rect(x - 1, y - 5, textWidth(marked, 4.6) + 2, 7, 1.5, "dg"); }
			if (i === 2) p.rect(3, y - 5, 54, 7, 1.5, "dp");
			p.text(4, y, plain + marked, 4.6, "dt");
		});
		chip(p, 56, 52, "Readiness: High", { size: 5.2, h: 13, c: "dw", icon: "ring", weight: 500 });
		logo(p, "jira", 4, 52, 9, "dw"); logo(p, "confluence", 14, 52, 9, "dw"); logo(p, "graph", 24, 52, 9, "dw");
	},
	"TEU-8"(p) { // Loom Overlay
		p.rect(10, 6, 150, 66, 4, "dg");
		p.text(20, 30, "AMSTERDAM", 13, "dti", { weight: 700 });
		p.text(20, 44, "ITINERARY", 13, "dti", { weight: 700 });
		p.rect(20, 52, 64, 12, 6, "dw");
		p.circle(27, 58, 3.5, "dd");
		p.text(34, 60, "Day 1 · Canals", 4.6, "dt");
		p.circle(146, 58, 9, "dw");
		avatar(p, 146, 58, 7.5);
	},
	"TEU-107"(p) { // ChatGPT Codex from Jira
		p.rect(6, 8, 76, 62, 4, "dw");
		glyph(p, "check", 11, 13, 7);
		p.text(21, 18.6, "TEU-214", 4.6, "dtx");
		p.text(11, 28, "Add retry to webhooks", 5, "dt", { weight: 600 });
		lettering(p, 11, 33, 64, 3, { gap: 4.4, h: 1.5, seed: 11 });
		chip(p, 11, 54, "Send to Codex", { size: 4.2, h: 9, c: "dd", text: "dti" });
		p.rect(88, 14, 76, 50, 4, "dd");
		logo(p, "openai", 93, 19, 9, "");
		p.text(105, 25.6, "Codex", 5, "dti", { weight: 600 });
		[0, 8, 8, 16, 8, 0].forEach((indent, i) => p.bar(94 + indent, 32 + i * 5, 30 + spread(12, i) * 30, 1.5, "dwi"));
	},
	"TEU-9"(p) { // Loom PR Reviews
		p.rect(14, 6, 142, 68, 4, "dw");
		p.line(14, 14, 156, 14, "df");
		for (const x of [19, 24, 29]) p.circle(x, 10, 1.4, "dg");
		p.rect(64, 20, 84, 36, 2, "dg");
		p.text(72, 48, "100%", 8, "dti", { weight: 600 });
		lettering(p, 20, 22, 38, 6, { gap: 5, h: 1.5, seed: 13 });
		p.text(20, 64, "packages/test.ts", 3.6, "dtx");
		p.text(64, 64, "MANUAL ACCEPTANCE NOT YET", 3.4, "dtx");
	},
	"TEU-10"(p) { // Agent Session Tracking (the subject)
		p.rect(36, 18, 120, 44, 5, "dw");
		p.rect(36, 18, 120, 44, 5, "dk");
		p.text(78, 31, "box key", 5.6, "dt");
		p.text(42, 40, "retention window before replay", 5.6, "dt");
		glyph(p, "check", 42, 45, 7);
		p.text(52, 50.6, "TEU-112", 5, "dt", { weight: 500 });
		avatar(p, 144, 51, 6);
		p.rect(44, 62, 104, 12, 0, "dp");
		p.text(96, 70.5, "Link agent session", 5.2, "dtm", { anchor: "middle" });
		p.rect(26, 10, 56, 15, 4, "dw");
		p.rect(26, 10, 56, 15, 4, "dk");
		logo(p, "rovo", 29, 13, 9, "");
		avatar(p, 43, 17.5, 4.4);
		p.text(50, 20.2, "Jordan Okafor", 5.2, "dt", { weight: 500 });
		glyph(p, "hand", 46, 21, 9);
	},
	"TEU-11"(p) { // Agent Effectiveness
		p.rect(26, 4, 140, 72, 4, "dw");
		p.text(32, 13, "Agent work by session", 5.2, "dt", { weight: 600 });
		["16K", "12K", "8K", "4K"].forEach((label, i) => { p.text(32, 22 + i * 12, label, 3.4, "dtx"); p.line(42, 21 + i * 12, 162, 21 + i * 12, "df"); });
		const stacks = [[10, 8, 0, 14], [8, 12, 6, 6], [0, 0, 8, 22], [16, 12, 8, 10], [18, 24, 14, 12], [26, 10, 6, 0]];
		stacks.forEach((stack, i) => { let y = 72; stack.forEach((h, k) => { if (!h) return; y -= h * 0.95; p.rect(46 + i * 19.5, y, 15, h * 0.95, 0, SERIES[k]); }); });
	},
	"TEU-109"(p) { // Change Risk Assessment
		for (const [x, title, badge, items] of [[8, "Compliance", "Low risk", ["Technical security policy breach", "Organization policy breach"]], [90, "Operational", "Medium", ["Scheduling conflicts", "Stakeholder impact"]]]) {
			p.rect(x, 8, 76, 62, 4, "dw");
			glyph(p, x === 8 ? "shieldline" : "gear", x + 5, 13, 7);
			p.text(x + 15, 18.6, title, 5.2, "dt", { weight: 600 });
			p.circle(x + 52, 16.8, 1.6, x === 8 ? "dd" : "dg");
			p.text(x + 55, 18.6, badge, 4.2, "dtm");
			items.forEach((item, i) => { p.rect(x + 5, 28 + i * 14, textWidth(item, 4.1) + 6, 10, 2, "dwf"); p.text(x + 8, 34.7 + i * 14, item, 4.1, "dt"); });
		}
	},
	"TEU-111"(p) { // Incident Command Center
		p.line(48, 12, 72, 36, "dl"); p.line(126, 16, 104, 36, "dl"); p.line(98, 46, 116, 66, "dl");
		chip(p, 24, 4, "Device manager", { size: 3.8, h: 8, c: "dwf", icon: "share" });
		chip(p, 106, 10, "session-manager", { size: 3.8, h: 8, c: "dwf", icon: "share" });
		chip(p, 104, 64, "feature-flag-service", { size: 3.6, h: 8, c: "dwf", icon: "share" });
		p.rect(30, 32, 112, 16, 4, "dw");
		p.rect(30, 32, 112, 16, 4, "dk");
		glyph(p, "share", 35, 36, 8);
		p.text(46, 42.4, "amer-payments-gateway", 5.4, "dt", { weight: 500 });
		chip(p, 112, 35, "Faulty", { size: 4.2, h: 10, c: "dps" });
	},
	"TEU-108"(p) { // EU AI Inference
		for (let y = 0; y < 9; y += 1) for (let x = 0; x < 26; x += 1) {
			const dx = (x - 13) / 13, dy = (y - 4) / 4.5;
			if (dx * dx + dy * dy * 0.9 > 1 || spread(x, y) > 0.82) continue;
			p.circle(30 + x * 4.4, 10 + y * 6.4, 1, dx * dx + dy * dy < 0.18 ? "dd" : "dg");
		}
		p.circle(86, 36, 5, "dk");
		chip(p, 96, 52, "EU region · Frankfurt", { size: 4, h: 9, c: "dw", icon: "globe" });
	},
	"TEU-112"(p) { // Employee Onboarding
		p.rect(30, 6, 110, 66, 4, "dw");
		p.text(36, 15, "Onboarding · Week 1", 5, "dt", { weight: 600 });
		p.bar(36, 19, 98, 2.4, "db"); p.bar(36, 19, 62, 2.4, "dd");
		["Laptop and accounts", "Meet your buddy", "Security training", "First pull request"].forEach((item, i) => {
			const y = 27 + i * 10.6;
			if (i < 2) { p.rect(36, y, 7, 7, 1.6, "dd"); glyph(p, "tick", 36.5, y + 0.5, 6); } else p.rect(36, y, 7, 7, 1.6, "dk");
			p.text(47, y + 5.4, item, 4.6, i < 2 ? "dtm" : "dt");
		});
	},
	"TEU-12"(p) { // AI Capital Management
		p.rect(24, 6, 122, 66, 4, "dw");
		donut(p, 52, 39, 22, 8, [0.42, 0.26, 0.18, 0.09, 0.05]);
		p.text(52, 41, "$5.6m", 6.4, "dt", { anchor: "middle", weight: 600 });
		["Anthropic", "OpenAI", "Cursor", "Canva"].forEach((label, i) => { const y = 20 + i * 10; p.circle(86, y, 1.8, SERIES[i]); p.text(91, y + 1.6, label, 4.2, "dt"); p.text(140, y + 1.6, ["$185.6K", "$148.2K", "$135.6K", "$000.0K"][i], 4, "dtx", { anchor: "end" }); });
	},
	"TEU-13"(p) { // Guard Scanning
		glyph(p, "shield", 18, 14, 40);
		p.rect(70, 8, 92, 62, 4, "dw");
		p.text(76, 17, "Guard scan", 5, "dt", { weight: 600 });
		[["Secrets in code", "0"], ["PII in prompts", "3"], ["Shadow AI apps", "12"], ["Risky agents", "1"]].forEach(([label, value], i) => {
			const y = 26 + i * 11;
			p.line(76, y - 3.4, 156, y - 3.4, "df");
			p.text(76, y + 2.6, label, 4.4, "dt");
			chip(p, 142, y - 2, value, { size: 4, h: 7, c: value === "0" ? "dp" : "dps" });
		});
	},
};

export function donut(p, cx, cy, r, thickness, shares) {
	let angle = 0;
	shares.forEach((share, i) => {
		const next = angle + share * Math.PI * 2;
		p.sector(cx, cy, r, r - thickness, angle + 0.03, next - 0.03, SERIES[i]);
		angle = next;
	});
}

export function cardDetail(card, story) {
	const [code, title, , kind] = story;
	const p = pen();
	p.rect(5, 5, card.w - 10, 74, 3, "dp");
	(COVERS[code] || COVERS["TEU-2"])(p.sub(5, 5));
	const mark = { desktop: "rovo", chat: "rovo", network: "graph", code: "graph", artifacts: "studio", search: "codesearch", people: "graph", video: "loom", record: "loom", planner: "jira", sessions: "jira", chart: "dx", cost: "talent", shield: "guard" }[kind] || "jira";
	logo(p, mark, 10, 10, 11, "dw");
	p.line(5, 79, card.w - 5, 79, "df");
	p.text(10, 93, title, 7.6, "dt", { weight: 500 });
	glyph(p, "check", 10, 99.5, 7);
	p.text(20, 105, code, 5, "dtx");
	glyph(p, "chevron", 134, 99, 8);
	p.text(146, 105, "2", 4.6, "dtx");
	avatar(p, card.w - 15, 102, 6.2);
	return wrap(p.markup());
}

// ---------- Bento tiles and the title ----------
const header = (p, label) => p.text(12, 17, label.toUpperCase(), 7, "dtx", { spacing: 0.9 });

const TILES = {
	sessions(p) {
		p.rect(14, 26, 192, 148, 6, "dp");
		p.rect(22, 44, 160, 56, 6, "dw");
		p.rect(22, 44, 160, 56, 6, "dk");
		p.text(86, 60, "box key retention", 8, "dt");
		p.text(30, 73, "window before replay", 8, "dt");
		glyph(p, "check", 30, 81, 9);
		p.text(43, 88.4, "TEU-112", 7, "dt", { weight: 600 });
		avatar(p, 168, 85, 8);
		p.rect(28, 100, 148, 22, 0, "dp");
		p.text(102, 115, "Link agent session", 7.4, "dtm", { anchor: "middle" });
		p.rect(28, 130, 148, 40, 6, "dwf");
		p.text(36, 145, "Publish and link the rollback", 7, "dtm");
		p.text(36, 158, "rehearsal runbook", 7, "dtm");
		p.rect(10, 32, 80, 22, 5, "dw");
		p.rect(10, 32, 80, 22, 5, "dk");
		logo(p, "rovo", 14, 37, 12, "");
		avatar(p, 32, 43, 6);
		p.text(41, 46.5, "Jordan Okafor", 7, "dt", { weight: 500 });
		glyph(p, "hand", 36, 50, 12);
		p.rect(190, 34, 26, 136, 6, "dwf");
	},
	artifacts(p) {
		p.rect(118, 24, 96, 64, 4, "dg");
		p.text(128, 62, "AMSTERDAM", 9.5, "dti", { weight: 700 });
		lettering(p, 128, 34, 50, 2, { gap: 4, h: 1.4, seed: 21, c: "dwi" });
		p.rect(12, 92, 92, 70, 4, "dps");
		glyph(p, "photo", 36, 106, 40);
		p.rect(62, 50, 112, 92, 5, "dw");
		p.rect(62, 50, 112, 92, 5, "dk");
		p.rect(66, 54, 104, 60, 3, "dg");
		p.text(118, 64, "Where must you submit all business expenses?", 4.2, "dti", { anchor: "middle" });
		for (let k = 0; k < 3; k += 1) { p.rect(80 + k * 26, 70, 22, 32, 2, k === 1 ? "dd" : "dw"); lettering(p, 83 + k * 26, 88, 15, 2, { gap: 3, h: 1.1, seed: 22 + k, c: k === 1 ? "dwi" : "db" }); }
		p.rect(96, 106, 16, 4, 2, "dw"); p.rect(116, 106, 20, 4, 2, "dd");
		glyph(p, "pointer", 82, 74, 10);
		p.text(68, 124, "Design Studio", 6.4, "dt", { weight: 600 });
		p.text(68, 133, "Tamar Yehoshua · Created 1h ago", 4.6, "dtm");
		logo(p, "anthropic", 160, 124, 10, "dw");
		p.text(14, 170, "Design Studio Concept.html", 5.6, "dt", { weight: 500 });
		p.text(14, 177, "Mike Cannon-Brookes · Created 1h ago", 4.2, "dtm");
	},
	chat(p) {
		p.rect(26, 24, 168, 16, 5, "dwf");
		p.rect(16, 44, 188, 36, 6, "dw");
		p.rect(16, 44, 188, 36, 6, "dk");
		p.circle(33, 62, 9, "dd");
		p.circle(33, 62, 5, "dki");
		glyph(p, "tick", 29, 58, 8);
		p.text(48, 59, "Work", 9, "dt", { weight: 600 });
		chip(p, 74, 51, "Open Beta", { size: 5.6, h: 11, c: "dp", weight: 500 });
		p.text(48, 72, "Tackles complex work across your tools", 6, "dtm");
		glyph(p, "tick", 184, 57, 10);
		p.rect(26, 86, 168, 28, 5, "dwf");
	},
	cost(p) {
		p.rect(16, 26, 188, 148, 6, "dw");
		p.text(24, 39, "Cost by provider", 6.2, "dt", { weight: 600 });
		donut(p, 58, 80, 30, 10, [0.42, 0.26, 0.18, 0.09, 0.05]);
		p.text(58, 82, "$5.6m", 10, "dt", { anchor: "middle", weight: 600 });
		p.text(58, 90, "Total cost", 4.6, "dtm", { anchor: "middle" });
		[["anthropic", "Anthropic", "$185.6K"], ["openai", "OpenAI", "$148.2K"], ["cursor", "Cursor", "$135.6K"], ["canva", "Canva", "$000.0K"], ["graph", "Other", "$000.0K"]].forEach(([mark, label, value], i) => {
			const y = 56 + i * 11.5;
			p.circle(102, y, 2, SERIES[i]);
			logo(p, mark, 107, y - 3.6, 7.2, "dwf");
			p.text(117, y + 2, label, 5.4, "dt");
			p.text(198, y + 2, value, 5.4, "dtx", { anchor: "end" });
		});
		p.text(24, 128, "Cost by model", 6.2, "dt", { weight: 600 });
		p.text(24, 145, "Opus 4.6: 20.03%", 10, "dt");
		[[0, 36, "dd"], [37, 30, "dg"], [68, 20, "dbd"], [89, 10, "db"], [100, 76, "dwf"]].forEach(([x, w, c]) => p.rect(24 + x, 154, w, 4, 1, c));
	},
	chart(p) {
		p.rect(16, 26, 188, 148, 6, "dw");
		p.text(24, 39, "Agent work by session", 6.2, "dt", { weight: 600 });
		["16K", "12K", "8K", "4K", "0"].forEach((label, i) => { p.text(24, 50 + i * 11, label, 4, "dtx"); p.line(36, 48.6 + i * 11, 198, 48.6 + i * 11, "df"); });
		const stacks = [[10, 8, 0, 12], [0, 2, 0, 18, 6], [0, 0, 8, 0, 20], [12, 12, 0, 4, 6], [10, 6, 8, 12, 8]];
		stacks.forEach((stack, i) => { let y = 92.6; stack.forEach((h, k) => { if (!h) return; y -= h; p.rect(42 + i * 31, y, 24, h, 0, SERIES[k]); }); });
		p.text(42, 101, "Jul 2026", 4, "dtx"); p.text(198, 101, "Oct 2026", 4, "dtx", { anchor: "end" });
		[["Bug fixes", "40.3K sessions"], ["Refactors and rewrites", "40.0K sessions"], ["Documentation", "37.5K sessions"], ["Code reviews", "28.5K sessions"]].forEach(([label, value], i) => {
			const y = 116 + i * 13;
			p.circle(26, y - 1.6, 2, SERIES[i]);
			p.text(32, y, label, 5.6, "dt");
			p.text(198, y, value, 5.6, "dtm", { anchor: "end" });
			p.line(24, y + 4.5, 198, y + 4.5, "df");
		});
	},
	record(p) {
		p.rect(12, 50, 196, 34, 17, "dw");
		p.rect(12, 50, 196, 34, 17, "dk");
		["camoff", "mic", "lock", "dots"].forEach((icon, i) => glyph(p, icon, 24 + i * 20, 61, 12));
		p.rect(108, 55, 94, 24, 12, "dd");
		p.circle(120, 67, 8, "dwi");
		glyph(p, "spark", 114.5, 61.5, 11);
		p.text(132, 69.6, "Record for agent", 7, "dti", { weight: 600 });
	},
};

export function tileDetail(feature, { sx = 1, sy = sx } = {}) {
	const p = pen(0, 0, sx, sy);
	header(p, feature.title);
	TILES[feature.kind](p);
	return p.markup();
}

export function titleDetail({ w = 220, d = 96, sx = 1, sy = sx } = {}) {
	const p = pen(0, 0, sx, sy);
	p.text(w / 2, d / 2 - 4, "Team ’26", 25, "dt dtd", { anchor: "middle", weight: 500 });
	p.text(w / 2, d / 2 + 22, "Europe", 25, "dt dtd", { anchor: "middle", weight: 500 });
	return p.markup();
}

export const wrapDetail = wrap;
