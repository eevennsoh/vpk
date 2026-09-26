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

test("the toolbar roster contains only the four keynote presenters", async () => {
	const keynote = await loadKeynoteModule();
	const roster = keynote.JIRA_TEAM_EU26_END_HEADER_ASSIGNEES;
	assert.deepEqual(roster.map((person) => person.name), ["MCB", "Tamar", "Sherif", "Taroon"]);
	assert.equal(new Set(roster.map((person) => person.id)).size, 4);
	for (const person of roster) {
		assert.ok(fs.existsSync(path.join(process.cwd(), "public", person.avatarSrc)));
	}
});

test("the keynote groups all thirteen stories into Context, Collaboration, and Confidence with an empty Done column", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();

	assert.equal(keynote.JIRA_TEAM_EU26_END_KEYNOTE_BOARD_TITLE, "Team ’26 EU keynote");
	assert.deepEqual(columns.map((column) => column.title), ["Context", "Collaboration", "Confidence", "Done"]);
	assert.deepEqual(columns.map((column) => column.count), [4, 3, 6, 0]);
	assert.deepEqual(columns.map((column) => column.cards.map((card) => card.title)), [
		["Desktop search & chat", "Code context", "Rovo for Work & Mobile", "Artifacts"],
		["Loom Desktop recording", "Whiteboard → Figma → Loom collaboration", "AI Planner & human–agent collaboration"],
		["Loom AI overlays", "Loom PR previews", "Jira Agent Sessions & real-time boards", "DX: session quality & comparative ROI", "Strategy Collection: Focus & Talent", "Enterprise governance & Guard"],
		[],
	]);
	const cards = columns.flatMap((column) => column.cards);
	assert.deepEqual(cards.map((card) => card.code), [...keynote.JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES]);
	assert.deepEqual(cards.map((card) => card.code), Array.from({ length: 13 }, (_, index) => `TEU-${index + 1}`));
	assert.equal(new Set(cards.map((card) => card.code)).size, 13);
	assert.ok(columns.every((column) => column.cards.every((card) => card.status === column.title)));
});

test("each section retains its presenter ownership and no Intro column", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	assert.deepEqual(columns.map((column) => (column.presenters ?? []).map((person) => person.name)), [
		["MCB", "Tamar"],
		["MCB", "Sherif"],
		["MCB", "Taroon"],
		[],
	]);
	assert.ok(columns.every((column) => column.title !== "Intro"));
});

test("MCB owns search and code context while Tamar owns work and artifacts", async () => {
	const keynote = await loadKeynoteModule();
	const context = keynote.createJiraTeamEu26EndKeynoteBoardColumns()[0];
	assert.deepEqual(context.cards.map((card) => [card.title, card.assignee.name]), [
		["Desktop search & chat", "MCB"],
		["Code context", "MCB"],
		["Rovo for Work & Mobile", "Tamar"],
		["Artifacts", "Tamar"],
	]);
});

test("every story has one fixed owner from its section presenter pair", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const cards = columns.flatMap((column) => column.cards);
	assert.equal(cards.length, 13);
	assert.ok(columns.every((column) => column.cards.every((card) => column.presenters.some((person) => person.id === card.assignee.id))));
	assert.equal(cards.find((card) => card.code === "TEU-8").assignee.id, "taroon");
	assert.equal(cards.find((card) => card.code === "TEU-10").assignee.id, "mcb");
	assert.deepEqual(cards.map((card) => card.assignee.id), keynote.createJiraTeamEu26EndKeynoteBoardColumns().flatMap((column) => column.cards.map((card) => card.assignee.id)));
});

test("every keynote story retains an existing local cover capped at 120px", async () => {
	const keynote = await loadKeynoteModule();
	const cards = keynote.createJiraTeamEu26EndKeynoteBoardColumns().flatMap((column) => column.cards);

	assert.equal(cards.length, 13);
	for (const card of cards) {
		assert.ok(card.coverImage.src.startsWith("/"));
		assert.ok(card.coverImage.alt.trim().length > 0);
		assert.equal(card.coverImage.maxHeight, 120);
		assert.ok(fs.existsSync(path.join(process.cwd(), "public", card.coverImage.src)));
	}
});

test("separate keynote board instances do not share mutable card or column data", async () => {
	const keynote = await loadKeynoteModule();
	const first = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const second = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = first[0].cards.shift();
	card.title = "Updated in rehearsal";
	card.status = "Done";
	card.coverImage.alt = "Changed cover description";
	card.tags.push({ text: "Updated", color: "blue" });
	first[3].cards.push(card);

	assert.equal(second[0].cards.length, 4);
	assert.equal(second[3].cards.length, 0);
	assert.equal(second[0].cards[0].title, "Desktop search & chat");
	assert.equal(second[0].cards[0].status, "Context");
	assert.notEqual(second[0].cards[0].coverImage.alt, "Changed cover description");
	assert.deepEqual(second[0].cards[0].tags, []);
});
