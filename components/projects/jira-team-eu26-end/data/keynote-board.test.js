const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

let keynoteModulePromise;

function loadKeynoteModule() {
	keynoteModulePromise ??= esbuild.build({
		entryPoints: [path.join(__dirname, "keynote-board.ts")],
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).then((result) => loadCjsModuleFromText(
		result.outputFiles[0].text,
		"jira-team-eu26-end-keynote-board-harness.cjs",
	));
	return keynoteModulePromise;
}

const EXPECTED_SECTIONS = [
	[
		["TEU-4", "Artifacts"],
		["TEU-1", "Rovo Desktop"],
		["TEU-101", "Data Context"],
		["TEU-2", "Code Context"],
		["TEU-102", "Code Search App"],
		["TEU-3", "Rovo For Work"],
		["TEU-103", "People Context"],
		["TEU-104", "Communications Context"],
	],
	[
		["TEU-105", "Atlassian MCP"],
		["TEU-5", "Loom Desktop"],
		["TEU-106", "Loom Record for Agent"],
		["TEU-7", "Planner"],
		["TEU-8", "Loom Overlay"],
		["TEU-107", "ChatGPT Codex from Jira"],
	],
	[
		["TEU-9", "Loom PR Reviews"],
		["TEU-108", "EU AI Inference"],
		["TEU-11", "Agent Effectiveness"],
		["TEU-109", "Change Risk Assessment"],
		["TEU-110", "Agent Identities"],
		["TEU-10", "Agent Session Tracking"],
		["TEU-111", "Incident Command Center"],
		["TEU-112", "Employee Onboarding"],
		["TEU-12", "AI Capital Management"],
		["TEU-13", "Guard Scanning"],
	],
	[],
];

function cardByCode(columns, code) {
	return columns.flatMap((column) => column.cards).find((card) => card.code === code);
}

test("Code Context is authored once and its extra work item is retired", async () => {
	const keynote = await loadKeynoteModule();
	const cards = keynote.createJiraTeamEu26EndKeynoteBoardColumns().flatMap((column) => column.cards);
	assert.deepEqual(cards.filter((card) => card.title === "Code Context").map((card) => card.code), ["TEU-2"]);
	assert.equal(keynote.JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES.includes("TEU-113"), false);
});

test("all keynote items, including retained and newly created ones, auto arrange to Done", async () => {
	const keynote = await loadKeynoteModule();
	const { getAutoArrangePlan, autoArrangeCards, withAutoArrangeDestinations } = loadCjsModuleFromText(esbuild.buildSync({
		entryPoints: ["components/blocks/jira-kanban/experimental/lib/board-auto-arrange.ts"],
		bundle: true, format: "cjs", platform: "node", write: false,
	}).outputFiles[0].text);
	const columns = withAutoArrangeDestinations(keynote.createJiraTeamEu26EndKeynoteBoardColumns());
	const retained = columns[0].cards.shift();
	retained.status = "Confidence";
	retained.autoArrangeStatus = "Collaboration";
	columns[2].cards.unshift(retained);
	columns[0].cards.push({ ...columns[0].cards[0], code: "TEU-14", title: "New keynote item", autoArrangeStatus: undefined });
	const prepared = keynote.withJiraTeamEu26EndDoneDestinations(columns);
	const codes = new Set(prepared.flatMap((column) => column.cards.map((card) => card.code)));
	assert.equal(codes.size, 25);
	assert.ok(prepared.every((column) => column.cards.every((card) => card.autoArrangeStatus === "Done")));
	const plan = getAutoArrangePlan(prepared, codes);
	assert.equal(plan.length, 25);
	assert.ok(plan.every((move) => move.columnTitle === "Done" && move.status === "Done"));
	const moved = autoArrangeCards(prepared, codes);
	assert.deepEqual(moved.map((column) => column.cards.length), [0, 0, 0, 25]);
	assert.equal(cardByCode(moved, "TEU-14").title, "New keynote item");
	assert.deepEqual(getAutoArrangePlan(moved, codes), []);
	assert.equal(keynote.withJiraTeamEu26EndDoneDestinations(prepared), prepared);
	assert.equal(retained.autoArrangeStatus, "Collaboration");
	assert.equal(retained.status, "Confidence");
});

test("the toolbar roster retains the four keynote presenters and all three coding agents", async () => {
	const keynote = await loadKeynoteModule();
	const roster = keynote.JIRA_TEAM_EU26_END_HEADER_ASSIGNEES;
	assert.deepEqual(roster.map((person) => person.name), ["MCB", "Tamar", "Sherif", "Taroon", "Claude", "Jira Coding Agent", "Cursor"]);
	assert.equal(new Set(roster.map((person) => person.id)).size, 7);
	for (const person of roster) {
		assert.ok(fs.existsSync(path.join(process.cwd(), "public", person.avatarSrc)));
	}
});

test("the reference groups all 24 stories in authored order with stable existing issue identities", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	assert.equal(keynote.JIRA_TEAM_EU26_END_KEYNOTE_BOARD_TITLE, "Team ’26 EU keynote");
	assert.deepEqual(columns.map((column) => column.title), ["Context", "Collaboration", "Confidence", "Done"]);
	assert.deepEqual(columns.map((column) => column.count), [8, 6, 10, 0]);
	assert.deepEqual(columns.map((column) => column.cards.map((card) => [card.code, card.title])), EXPECTED_SECTIONS);
	const cards = columns.flatMap((column) => column.cards);
	assert.deepEqual(keynote.JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES, EXPECTED_SECTIONS.flat().map(([code]) => code));
	assert.equal(new Set(cards.map((card) => card.code)).size, 24);
	assert.ok(columns.every((column) => column.cards.every((card) => card.status === column.title)));
	assert.equal(cards.some((card) => card.code === "TEU-6"), false);
	assert.equal(cards.some((card) => card.code === "TEU-14"), false, "previously live-created issues keep their numeric range");
});

test("section presenter rosters and existing announcement ownership remain stable", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	assert.deepEqual(columns.map((column) => (column.presenters ?? []).map((person) => person.name)), [
		["MCB", "Tamar"], ["MCB", "Sherif"], ["MCB", "Taroon"], [],
	]);
	assert.deepEqual([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13].map((id) => cardByCode(columns, `TEU-${id}`).assignee.id), [
		"mike", "mike", "tamar", "tamar", "mike", "sherif", "taroon", "taroon", "mike", "taroon", "mike", "mike",
	]);
	assert.ok(columns.every((column) => column.title !== "Intro"));
});

test("all story covers use reference image assets and the same 140px cover height", async () => {
	const keynote = await loadKeynoteModule();
	const cards = keynote.createJiraTeamEu26EndKeynoteBoardColumns().flatMap((column) => column.cards);
	const slugs = [
		"artifacts", "rovo-desktop", "data-context", "code-context", "code-search-app", "rovo-for-work", "people-context", "communications-context",
		"atlassian-mcp", "loom-desktop", "loom-record-for-agent", "planner", "loom-overlay", "chatgpt-codex-from-jira",
		"loom-pr-reviews", "eu-ai-inference", "agent-effectiveness", "change-risk-assessment", "agent-identities", "agent-session-tracking",
		"incident-command-center", "employee-onboarding", "ai-capital-management", "guard-scanning",
	];
	const artworkSources = slugs.map((slug) => `/illustration/jira-team-eu26-end/${slug}.jpeg`);
	assert.deepEqual(cards.map((card) => card.coverImage.src), artworkSources);
	for (const card of cards) {
		assert.equal(card.coverImage.maxHeight, 140);
		assert.equal(card.coverImage.fit, "cover");
		assert.equal(card.coverImage.alt, `${card.title} preview`);
		assert.equal(card.coverImage.heading, undefined);
		assert.equal(card.coverImage.subheading, undefined);
		assert.equal(card.coverImage.backgroundPattern, undefined);
		assert.equal(card.coverImage.backgroundClassName, undefined);
		assert.equal(card.coverImage.mask, undefined);
		assert.equal(card.coverImage.zoom, undefined);
		assert.ok(fs.existsSync(path.join(process.cwd(), "public", card.coverImage.src)), card.coverImage.src);
	}
});

test("each cover reuses the app-stack sources for its reference product marks", async () => {
	const keynote = await loadKeynoteModule();
	const cards = keynote.createJiraTeamEu26EndKeynoteBoardColumns().flatMap((column) => column.cards);
	assert.deepEqual(cards.map((card) => card.coverImage.appSources.map((app) => app.label)), [
		["Artifacts"], ["Rovo"], ["Teamwork Graph"], ["Teamwork Graph"], ["Code Search"], ["Rovo"], ["Teamwork Graph"], ["Teamwork Graph"],
		["Teamwork Graph"], ["Loom"], ["Loom"], ["Jira", "Confluence", "Teamwork Graph"], ["Loom"], ["Jira"],
		["Loom"], ["European Union"], ["DX"], ["Jira Service Management"], [], ["Jira"], ["Jira Service Management"], ["Jira Service Management"], ["Talent"], ["Guard"],
	]);
});

test("separate keynote board instances do not share mutable card or cover data", async () => {
	const keynote = await loadKeynoteModule();
	const first = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const second = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = first[0].cards.shift();
	card.title = "Updated in rehearsal";
	card.status = "Done";
	card.coverImage.src = "/custom.png";
	card.coverImage.appSources[0].label = "Updated app";
	card.tags.push({ text: "Updated", color: "blue" });
	first[3].cards.push(card);
	assert.equal(second[0].cards.length, 8);
	assert.equal(second[3].cards.length, 0);
	assert.equal(second[0].cards[0].title, "Artifacts");
	assert.equal(second[0].cards[0].status, "Context");
	assert.equal(second[0].cards[0].coverImage.src, "/illustration/jira-team-eu26-end/artifacts.jpeg");
	assert.equal(second[0].cards[0].coverImage.appSources[0].label, "Artifacts");
	assert.deepEqual(second[0].cards[0].tags, []);
});

test("older authored covers upgrade without resetting moved items, edits or agent drafts", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = cardByCode(columns, "TEU-1");
	columns[0].cards = columns[0].cards.filter((item) => item !== card);
	card.title = "Edited rehearsal title";
	card.status = "Confidence";
	card.tags = [{ text: "Draft", color: "blue" }];
	card.agentActivities = [{ id: "live-agent", draft: "Keep this draft" }];
	card.coverImage = { heading: "Desktop Search & Chat", maxHeight: 144, backgroundPattern: "dots" };
	columns[2].cards.unshift(card);
	const untouchedCard = columns[2].cards[1];
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	const updated = restored[2].cards[0];
	assert.equal(updated.code, "TEU-1");
	assert.equal(updated.title, "Edited rehearsal title");
	assert.equal(updated.status, "Confidence");
	assert.equal(updated.tags, card.tags);
	assert.equal(updated.agentActivities, card.agentActivities);
	assert.equal(updated.assignee, card.assignee);
	assert.equal(updated.coverImage.src, "/illustration/jira-team-eu26-end/rovo-desktop.jpeg");
	assert.equal(updated.coverImage.heading, undefined);
	assert.equal(restored[2].cards[1], untouchedCard);
	assert.equal(restored[1], columns[1]);
	assert.equal(card.coverImage.backgroundPattern, "dots");
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("known old benefit titles refresh while custom card copy stays untouched", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	cardByCode(columns, "TEU-1").title = "Search across your work";
	cardByCode(columns, "TEU-9").title = "Preview code changes in video";
	cardByCode(columns, "TEU-11").title = "Custom session analysis";
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	assert.equal(cardByCode(restored, "TEU-1").title, "Rovo Desktop");
	assert.equal(cardByCode(restored, "TEU-9").title, "Loom PR Reviews");
	assert.equal(cardByCode(restored, "TEU-11"), cardByCode(columns, "TEU-11"));
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("the original gray placeholders upgrade while custom images and live-created issues remain intact", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const placeholder = cardByCode(columns, "TEU-1");
	placeholder.coverImage = { backgroundClassName: "bg-bg-accent-gray-subtler", maxHeight: 120 };
	const customImage = cardByCode(columns, "TEU-2");
	customImage.coverImage = { src: "/illustration-ai/code/light.svg", alt: "Custom artwork" };
	const created = { ...customImage, code: "TEU-14", title: "Live demo", coverImage: { heading: "New item" } };
	columns[0].cards.push(created);
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	assert.equal(cardByCode(restored, "TEU-1").coverImage.src, "/illustration/jira-team-eu26-end/rovo-desktop.jpeg");
	assert.equal(cardByCode(restored, "TEU-1").assignee, placeholder.assignee);
	assert.equal(cardByCode(restored, "TEU-2"), customImage);
	assert.equal(restored[0].cards.at(-1), created);
	assert.deepEqual(placeholder.coverImage, { backgroundClassName: "bg-bg-accent-gray-subtler", maxHeight: 120 });
});

test("custom typographic cover copy survives the height and product-mark refresh", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = cardByCode(columns, "TEU-1");
	const apps = card.coverImage.appSources;
	card.coverImage = { heading: "Custom rehearsal cover", appSources: apps, maxHeight: 144, backgroundPattern: "grid" };
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	const updated = cardByCode(restored, "TEU-1");
	assert.equal(updated.coverImage.heading, "Custom rehearsal cover");
	assert.equal(updated.coverImage.maxHeight, 140);
	assert.equal(updated.coverImage.appSources, apps);
	assert.equal(updated.title, card.title);
	assert.equal(card.coverImage.maxHeight, 144);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("historical heading line breaks and case refresh to the corresponding reference artwork", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const legacyHeadings = {
		"TEU-1": "Desktop search\n& chat",
		"TEU-4": "Artifacts",
		"TEU-5": "Loom Desktop\nrecording",
		"TEU-8": "Loom\nAI overlays",
		"TEU-11": "DX: session quality\n& ROI",
		"TEU-13": "Enterprise governance\n& Guard",
	};
	const expectedSources = new Map(columns.flatMap((column) => column.cards).map((card) => [card.code, card.coverImage.src]));
	for (const [code, heading] of Object.entries(legacyHeadings)) {
		cardByCode(columns, code).coverImage = { heading, maxHeight: 140, backgroundPattern: "grid" };
	}
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	for (const code of Object.keys(legacyHeadings)) {
		assert.equal(cardByCode(restored, code).coverImage.src, expectedSources.get(code), code);
	}
	assert.equal(cardByCode(columns, "TEU-1").coverImage.heading, legacyHeadings["TEU-1"]);
});

test("a retained reference cover repairs stale product marks even when source IDs match", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const planner = cardByCode(columns, "TEU-7");
	planner.coverImage.appSources[2].provider = "twg";
	planner.coverImage.fit = "contain";
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	assert.deepEqual(cardByCode(restored, "TEU-7").coverImage.appSources.map((app) => app.provider), ["jira", "confluence", "teamwork-graph"]);
	assert.equal(cardByCode(restored, "TEU-7").coverImage.fit, "cover");
	assert.equal(planner.coverImage.appSources[2].provider, "twg");
	assert.equal(restored[0], columns[0]);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("a retained EU AI Inference cover gains the European flag mark without resetting live edits", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const inference = cardByCode(columns, "TEU-108");
	inference.title = "EU AI Inference (rehearsal)";
	inference.coverImage.appSources = [];
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	const [flag] = cardByCode(restored, "TEU-108").coverImage.appSources;
	assert.equal(flag.label, "European Union");
	assert.equal(flag.iconSrc, "/illustration/jira-team-eu26-end/eu-flag.svg");
	assert.ok(fs.existsSync(path.join(process.cwd(), "public", flag.iconSrc)), flag.iconSrc);
	assert.equal(cardByCode(restored, "TEU-108").title, "EU AI Inference (rehearsal)");
	assert.equal(restored[0], columns[0]);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("retained artwork removes obsolete image geometry without changing live board edits", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = cardByCode(columns, "TEU-1");
	columns[0].cards = columns[0].cards.filter((item) => item !== card);
	card.title = "Edited desktop demo";
	card.status = "Done";
	card.agentActivities = [{ id: "live-agent", draft: "Keep this draft" }];
	card.coverImage = {
		...card.coverImage,
		src: "/illustration/jira-team-eu26-end/rovo-desktop.jpeg",
		alt: "Rehearsal desktop preview",
		zoom: 379 / 371,
		mask: { src: "/illustration/jira-team-eu26-end/app-badge-mask.svg", backgroundColor: "#f8f8f8" },
	};
	columns[3].cards.push(card);
	const untouched = columns[0].cards[0];
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	const updated = cardByCode(restored, "TEU-1");
	assert.equal(updated.coverImage.src, "/illustration/jira-team-eu26-end/rovo-desktop.jpeg");
	assert.equal(updated.coverImage.mask, undefined);
	assert.equal(updated.coverImage.zoom, undefined);
	assert.equal(updated.coverImage.fit, "cover");
	assert.equal(updated.coverImage.alt, "Rehearsal desktop preview");
	assert.equal(updated.coverImage.maxHeight, 140);
	assert.deepEqual(updated.coverImage.appSources.map((app) => app.label), ["Rovo"]);
	assert.equal(updated.title, card.title);
	assert.equal(updated.status, "Done");
	assert.equal(updated.agentActivities, card.agentActivities);
	assert.equal(cardByCode(restored, untouched.code), untouched);
	assert.equal(card.coverImage.zoom, 379 / 371);
	assert.equal(card.coverImage.mask.src, "/illustration/jira-team-eu26-end/app-badge-mask.svg");
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("previous People sources and planner images refresh with obsolete image geometry", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	cardByCode(columns, "TEU-103").coverImage.src = "/illustration/jira-team-eu26-end/people-context-solid.svg";
	const planner = cardByCode(columns, "TEU-7");
	planner.coverImage.mask = { src: "/illustration/jira-team-eu26-end/app-stack-mask.svg", backgroundColor: "#f8f8f8" };
	planner.coverImage.zoom = 379 / 371;
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	for (const [code, source] of [
		["TEU-103", "people-context.jpeg"],
		["TEU-7", "planner.jpeg"],
	]) {
		const image = cardByCode(restored, code).coverImage;
		assert.equal(image.src, `/illustration/jira-team-eu26-end/${source}`);
		assert.equal(image.mask, undefined);
		assert.equal(image.zoom, undefined);
	}
	assert.equal(planner.coverImage.zoom, 379 / 371);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("the original Artifacts fade returns on an existing card without replacing board state", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = cardByCode(columns, "TEU-4");
	card.coverImage.src = "/illustration/jira-team-eu26-end/artifacts-no-fade.png";
	card.title = "My artifact draft";
	const unrelated = cardByCode(columns, "TEU-1");
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	assert.equal(cardByCode(restored, "TEU-4").coverImage.src, "/illustration/jira-team-eu26-end/artifacts.jpeg");
	assert.equal(cardByCode(restored, "TEU-4").title, "My artifact draft");
	assert.equal(cardByCode(restored, "TEU-1"), unrelated);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("placeholder captions and the gridded People cover refresh without resetting the board", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const people = cardByCode(columns, "TEU-103");
	const communications = cardByCode(columns, "TEU-104");
	people.title = "People Context (Confirm Visual)";
	people.coverImage.src = "/illustration/jira-team-eu26-end/people-context.jpeg";
	people.coverImage.alt = "People Context (Confirm Visual) preview";
	communications.title = "Communications Context (Confirm Visual)";
	communications.coverImage.alt = "Communications Context (Confirm Visual) preview";
	const unrelated = cardByCode(columns, "TEU-1");
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	assert.equal(cardByCode(restored, "TEU-103").title, "People Context");
	assert.equal(cardByCode(restored, "TEU-103").coverImage.src, "/illustration/jira-team-eu26-end/people-context.jpeg");
	assert.equal(cardByCode(restored, "TEU-103").coverImage.alt, "People Context preview");
	assert.equal(cardByCode(restored, "TEU-104").title, "Communications Context");
	assert.equal(cardByCode(restored, "TEU-104").coverImage.alt, "Communications Context preview");
	assert.equal(cardByCode(restored, "TEU-1"), unrelated);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("cover refresh never resurrects removed items or rewrites retired and live-created issues", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	columns[0].cards = columns[0].cards.filter((card) => card.code !== "TEU-101" && card.code !== "TEU-1");
	const retired = { ...columns[1].cards[0], code: "TEU-6", title: "Edited whiteboard demo", coverImage: { heading: "Custom whiteboard" } };
	columns[3].cards.push(retired);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns), columns);
	assert.equal(cardByCode(columns, "TEU-101"), undefined);
	assert.equal(cardByCode(columns, "TEU-1"), undefined);
	assert.equal(cardByCode(columns, "TEU-6"), retired);
});
