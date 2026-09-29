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

test("all keynote items, including retained and newly created ones, auto arrange to Done", async () => {
	const keynote = await loadKeynoteModule();
	const { getAutoArrangePlan, autoArrangeCards, withAutoArrangeDestinations } = loadCjsModuleFromText(esbuild.buildSync({
		entryPoints: ["components/blocks/jira-kanban/experimental/lib/board-auto-arrange.ts"],
		bundle: true, format: "cjs", platform: "node", write: false,
	}).outputFiles[0].text);
	const columns = withAutoArrangeDestinations(keynote.createJiraTeamEu26EndKeynoteBoardColumns());
	delete columns[3].scrollbarVisibility;
	const retained = columns[0].cards.shift();
	retained.status = "Confidence";
	retained.autoArrangeStatus = "Collaboration";
	columns[2].cards.unshift(retained);
	columns[0].cards.push({ ...columns[0].cards[0], code: "TEU-14", title: "New keynote item", autoArrangeStatus: undefined });
	const prepared = keynote.withJiraTeamEu26EndDoneDestinations(columns);
	assert.equal(prepared[3].scrollbarVisibility, "hidden");
	assert.ok(prepared.slice(0, 3).every((column) => column.scrollbarVisibility === undefined));
	const codes = new Set(prepared.flatMap((column) => column.cards.map((card) => card.code)));
	assert.equal(codes.size, 14);
	assert.ok(prepared.every((column) => column.cards.every((card) => card.autoArrangeStatus === "Done")));
	const plan = getAutoArrangePlan(prepared, codes);
	assert.equal(plan.length, 14);
	assert.ok(plan.every((move) => move.columnTitle === "Done" && move.status === "Done"));
	const moved = autoArrangeCards(prepared, codes);
	assert.deepEqual(moved.map((column) => column.cards.length), [0, 0, 0, 14]);
	assert.equal(moved[3].scrollbarVisibility, "hidden");
	assert.equal(moved[3].cards.find((card) => card.code === "TEU-14").title, "New keynote item");
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
		["Desktop Search & Chat", "MCB"],
		["Code Context", "MCB"],
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
		["Desktop Search & Chat", "Search across your work"],
		["Code Context", "Ground AI in your codebase"],
		["Rovo for Work & Mobile", "Pick up work anywhere"],
		["Rovo Artifacts", "Turn ideas into outputs"],
		["Loom Desktop Recording", "Record Share Collaborate"],
		["Whiteboard → Figma → Loom", "From ideas to shared outcomes"],
		["AI Planner", "Humans and agents One plan"],
		["Loom AI Overlays", "Make every video clearer"],
		["Loom PR Previews", "Preview code changes in video"],
		["Jira Agent Sessions", "See agent work as it happens"],
		["DX Session Quality & ROI", "Measure session quality and ROI"],
		["Strategy Collection", "Align talent and investment"],
		["Enterprise Governance & Guard", "Govern AI at every level"],
	]);
	for (const card of cards) {
		assert.equal(card.coverImage.heading.split("\n").length, 2);
		assert.equal(Object.hasOwn(card.coverImage, "subheading"), false);
		assert.equal(card.coverImage.src, undefined);
		assert.equal(card.coverImage.alt, undefined);
		assert.equal(card.coverImage.backgroundClassName, undefined);
		assert.equal(card.coverImage.maxHeight, 120);
		assert.equal(card.coverImage.backgroundPattern, "grid");
		assert.ok(card.coverImage.appSources.length > 0);
	}
	assert.deepEqual(cards[1].coverImage.appSources.map((app) => app.label), ["Bitbucket", "GitHub", "GitLab"]);
	assert.deepEqual(cards[8].coverImage.appSources.map((app) => app.label), ["Loom", "Bitbucket"]);
	assert.deepEqual(cards[11].coverImage.appSources.map((app) => app.label), ["Focus", "Talent"]);
	assert.deepEqual([cards[0], cards[4], cards[10], cards[12]].map((card) => card.coverImage.heading), [
		"Desktop\nSearch & Chat",
		"Loom\nDesktop Recording",
		"DX Session\nQuality & ROI",
		"Enterprise\nGovernance & Guard",
	]);
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
	assert.equal(second[0].cards[0].coverImage.heading, "Desktop\nSearch & Chat");
	assert.equal(second[0].cards[0].coverImage.appSources[0].label, "Rovo");
	assert.deepEqual(second[0].cards[0].tags, []);
});

test("older open boards recover cover artwork without resetting moved items or edits", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = columns[0].cards.shift();
	card.title = "Edited rehearsal title";
	card.status = "Confidence";
	card.coverImage = { heading: "Desktop Search & Chat", maxHeight: 144, backgroundPattern: "dots" };
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
	assert.equal(upgraded.coverImage.heading, "Desktop\nSearch & Chat");
	assert.equal(upgraded.coverImage.backgroundPattern, "grid");
	assert.equal(upgraded.coverImage.maxHeight, 120);
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

test("retained keynote covers adopt the shorter height without resetting board edits", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const card = columns[0].cards.shift();
	card.title = "Edited rehearsal title";
	card.status = "Done";
	card.coverImage.heading = "Custom rehearsal cover";
	card.coverImage.maxHeight = 144;
	columns[3].cards.push(card);

	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	const resized = restored[3].cards[0];
	assert.equal(resized.coverImage.maxHeight, 120);
	assert.equal(resized.coverImage.heading, "Custom rehearsal cover");
	assert.equal(resized.title, "Edited rehearsal title");
	assert.equal(resized.status, "Done");
	assert.equal(resized.assignee, card.assignee);
	assert.equal(resized.coverImage.appSources, card.coverImage.appSources);
	assert.equal(restored[0], columns[0]);
	assert.equal(card.coverImage.maxHeight, 144);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
});

test("authored line breaks reach retained covers without replacing custom cover copy", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	columns[0].cards[0].coverImage.heading = "Desktop search\n& chat";
	columns[0].cards[3].coverImage.heading = "Artifacts";
	columns[1].cards[0].coverImage.heading = "Loom Desktop\nrecording";
	columns[2].cards[3].coverImage.heading = "DX: session quality\n& ROI";
	columns[2].cards[5].coverImage.heading = "Enterprise governance\n& Guard";
	const custom = columns[0].cards[1];
	custom.coverImage.heading = "Custom rehearsal cover";
	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	assert.equal(restored[0].cards[0].coverImage.heading, "Desktop\nSearch & Chat");
	assert.equal(restored[0].cards[3].coverImage.heading, "Rovo\nArtifacts");
	assert.equal(restored[1].cards[0].coverImage.heading, "Loom\nDesktop Recording");
	assert.equal(restored[2].cards[3].coverImage.heading, "DX Session\nQuality & ROI");
	assert.equal(restored[2].cards[5].coverImage.heading, "Enterprise\nGovernance & Guard");
	assert.equal(restored[0].cards[1], custom);
	assert.equal(custom.coverImage.heading, "Custom rehearsal cover");
	assert.equal(columns[0].cards[0].coverImage.heading, "Desktop search\n& chat");
});

test("retained sentence-case headings adopt title case while preserving board edits", async () => {
	const keynote = await loadKeynoteModule();
	const columns = keynote.createJiraTeamEu26EndKeynoteBoardColumns();
	const legacyHeadings = {
		"TEU-1": "Desktop\nsearch & chat",
		"TEU-2": "Code\ncontext",
		"TEU-5": "Loom\ndesktop recording",
		"TEU-8": "Loom\nAI overlays",
		"TEU-9": "Loom\nPR previews",
		"TEU-11": "DX session\nquality & ROI",
		"TEU-13": "Enterprise\ngovernance & Guard",
	};
	const cards = columns.flatMap((column) => column.cards);
	const expectedHeadings = new Map(cards.map((card) => [card.code, card.coverImage.heading]));
	for (const card of cards) {
		if (legacyHeadings[card.code]) card.coverImage.heading = legacyHeadings[card.code];
	}
	const moved = columns[0].cards.shift();
	moved.status = "Done";
	moved.title = "Edited rehearsal title";
	columns[3].cards.push(moved);

	const restored = keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(columns);
	for (const card of restored.flatMap((column) => column.cards)) {
		assert.equal(card.coverImage.heading, expectedHeadings.get(card.code), card.code);
	}
	assert.equal(restored[3].cards[0].title, moved.title);
	assert.equal(restored[3].cards[0].status, "Done");
	assert.equal(restored[3].cards[0].assignee, moved.assignee);
	assert.equal(moved.coverImage.heading, legacyHeadings["TEU-1"]);
	assert.equal(keynote.restoreJiraTeamEu26EndKeynoteCoverArtwork(restored), restored);
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
