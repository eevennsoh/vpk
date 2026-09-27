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
	assert.deepEqual(columns.map((column) => column.cards.map((card) => card.code)), [
		["TEU-1", "TEU-2", "TEU-3", "TEU-4"],
		["TEU-5", "TEU-6", "TEU-7"],
		["TEU-8", "TEU-9", "TEU-10", "TEU-11", "TEU-12", "TEU-13"],
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
	assert.deepEqual(context.cards.map((card) => [card.coverImage.heading.replaceAll("\n", " "), card.assignee.name]), [
		["Desktop search & chat", "MCB"],
		["Code context", "MCB"],
		["Rovo for Work & Mobile", "Tamar"],
		["Rovo Artifacts", "Tamar"],
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

test("every keynote story pairs its feature cover heading with a benefit title and no cover subheading", async () => {
	const keynote = await loadKeynoteModule();
	const cards = keynote.createJiraTeamEu26EndKeynoteBoardColumns().flatMap((column) => column.cards);

	assert.equal(cards.length, 13);
	assert.equal(new Set(cards.map((card) => card.coverImage.heading)).size, 13);
	assert.deepEqual(cards.map((card) => [card.coverImage.heading.replaceAll("\n", " "), card.title]), [
		["Desktop search & chat", "Search across your work"],
		["Code context", "Ground AI in your codebase"],
		["Rovo for Work & Mobile", "Pick up work anywhere"],
		["Rovo Artifacts", "Turn ideas into outputs"],
		["Loom desktop recording", "Record. Share. Collaborate."],
		["Whiteboard → Figma → Loom", "From ideas to shared outcomes"],
		["AI Planner", "Humans and agents. One plan."],
		["Loom AI overlays", "Make every video clearer"],
		["Loom PR previews", "Preview code changes in video"],
		["Jira Agent Sessions", "See agent work as it happens"],
		["DX session quality & ROI", "Measure session quality and ROI"],
		["Strategy Collection", "Align talent and investment"],
		["Enterprise governance & Guard", "Govern AI at every level"],
	]);
	for (const card of cards) {
		assert.equal(card.coverImage.heading.split("\n").length, 2);
		assert.equal(Object.hasOwn(card.coverImage, "subheading"), false);
		assert.equal(card.coverImage.src, undefined);
		assert.equal(card.coverImage.alt, undefined);
		assert.equal(card.coverImage.backgroundClassName, undefined);
		assert.equal(card.coverImage.maxHeight, 144);
		assert.equal(card.coverImage.backgroundPattern, "grid");
		assert.ok(card.coverImage.appSources.length > 0);
	}
	assert.deepEqual(cards[1].coverImage.appSources.map((app) => app.label), ["Bitbucket", "GitHub", "GitLab"]);
	assert.deepEqual(cards[8].coverImage.appSources.map((app) => app.label), ["Loom", "Bitbucket"]);
	assert.deepEqual(cards[11].coverImage.appSources.map((app) => app.label), ["Focus", "Talent"]);
});

test("separate keynote board instances do not share mutable card or column data", async () => {
	const keynote = await loadKeynoteModule();
	const first = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const second = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = first[0].cards.shift();
	card.title = "Updated in rehearsal";
	card.status = "Done";
	card.coverImage.heading = "Updated cover";
	card.coverImage.appSources[0].label = "Updated app";
	card.tags.push({ text: "Updated", color: "blue" });
	first[3].cards.push(card);

	assert.equal(second[0].cards.length, 4);
	assert.equal(second[3].cards.length, 0);
	assert.equal(second[0].cards[0].title, "Search across your work");
	assert.equal(second[0].cards[0].status, "Context");
	assert.equal(second[0].cards[0].coverImage.heading, "Desktop search\n& chat");
	assert.equal(second[0].cards[0].coverImage.appSources[0].label, "Rovo");
	assert.deepEqual(second[0].cards[0].tags, []);
});

test("older open boards recover cover artwork without resetting moved items or edits", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = columns[0].cards.shift();
	card.title = "Edited rehearsal title";
	card.status = "Confidence";
	card.coverImage = { heading: "Desktop search & chat", maxHeight: 144, backgroundPattern: "dots" };
	columns[2].cards.unshift(card);
	const untouchedCard = columns[2].cards[1];

	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	const restoredCard = restored[2].cards[0];
	assert.equal(restoredCard.code, "TEU-1");
	assert.equal(restoredCard.title, "Edited rehearsal title");
	assert.equal(restoredCard.status, "Confidence");
	assert.equal(restoredCard.coverImage.backgroundPattern, "grid");
	assert.deepEqual(restoredCard.coverImage.appSources.map((app) => app.label), ["Rovo"]);
	assert.equal(restored[2].cards[1], untouchedCard);
	assert.equal(restored[1], columns[1]);
	assert.equal(card.coverImage.backgroundPattern, "dots");
	assert.equal(card.coverImage.appSources, undefined);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("the original gray placeholder covers upgrade without resetting board edits", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = columns[0].cards.shift();
	card.title = "Edited before the cover update";
	card.status = "Done";
	card.coverImage = { backgroundClassName: "bg-bg-accent-gray-subtler", maxHeight: 120 };
	columns[3].cards.push(card);
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	const upgraded = restored[3].cards[0];
	assert.equal(upgraded.title, "Edited before the cover update");
	assert.equal(upgraded.status, "Done");
	assert.equal(upgraded.assignee, card.assignee);
	assert.equal(upgraded.coverImage.heading, "Desktop search\n& chat");
	assert.equal(upgraded.coverImage.backgroundPattern, "grid");
	assert.equal(upgraded.coverImage.maxHeight, 144);
	assert.deepEqual(upgraded.coverImage.appSources.map((app) => app.label), ["Rovo"]);
	assert.deepEqual(card.coverImage, { backgroundClassName: "bg-bg-accent-gray-subtler", maxHeight: 120 });
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("cover repair leaves newly created items and supplied image covers untouched", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const customImage = columns[0].cards[0];
	customImage.coverImage = { src: "/illustration-ai/code/light.svg", alt: "Custom artwork" };
	const created = { ...columns[0].cards[1], code: "TEU-14", coverImage: { heading: "New item" } };
	columns[0].cards.push(created);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns), columns);
	assert.equal(columns[0].cards[0], customImage);
	assert.equal(columns[0].cards.at(-1), created);
});

test("authored line breaks reach retained covers without replacing custom cover copy", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	columns[0].cards[0].coverImage.heading = "Desktop search & chat";
	columns[0].cards[3].coverImage.heading = "Artifacts";
	columns[1].cards[0].coverImage.heading = "Loom Desktop\nrecording";
	columns[2].cards[3].coverImage.heading = "DX: session quality\n& ROI";
	const custom = columns[0].cards[1];
	custom.coverImage.heading = "Custom rehearsal cover";
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	assert.equal(restored[0].cards[0].coverImage.heading, "Desktop search\n& chat");
	assert.equal(restored[0].cards[3].coverImage.heading, "Rovo\nArtifacts");
	assert.equal(restored[1].cards[0].coverImage.heading, "Loom desktop\nrecording");
	assert.equal(restored[2].cards[3].coverImage.heading, "DX session quality\n& ROI");
	assert.equal(restored[0].cards[1], custom);
	assert.equal(custom.coverImage.heading, "Custom rehearsal cover");
	assert.equal(columns[0].cards[0].coverImage.heading, "Desktop search & chat");
});

test("AI Planner uses one Jira logo and replaces the older retained app stack", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const planner = columns[1].cards[2];
	assert.deepEqual(planner.coverImage.appSources.map((app) => app.label), ["Jira"]);
	planner.coverImage.appSources.push(
		{ id: "confluence", label: "Confluence", provider: "confluence" },
		{ id: "rovo", label: "Rovo", provider: "rovo" },
	);
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	assert.deepEqual(restored[1].cards[2].coverImage.appSources.map((app) => app.label), ["Jira"]);
	assert.equal(restored[1].cards[2].title, planner.title);
	assert.equal(planner.coverImage.appSources.length, 3);
	assert.equal(restored[0], columns[0]);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});
