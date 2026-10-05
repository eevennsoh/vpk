const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const {
	createJiraTeamEu26EndKeynoteBoardColumns,
	JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES,
	applyJiraTeamEu26EndClosingMove,
	moveJiraKanbanCardsToDropTarget,
	resolveJiraTeamEu26EndClosingAction,
} = loadCjsModuleFromText(esbuild.buildSync({
	stdin: {
		contents: `
			export * from "./keynote-closing";
			export { createJiraTeamEu26EndKeynoteBoardColumns, JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES } from "../data/keynote-board";
			export { moveJiraKanbanCardsToDropTarget } from "@/components/blocks/jira-kanban/card-drop";
		`,
		loader: "ts",
		resolveDir: __dirname,
	},
	bundle: true,
	format: "cjs",
	platform: "node",
	tsconfig: path.join(process.cwd(), "tsconfig.json"),
	write: false,
}).outputFiles[0].text, "jira-team-eu26-end-keynote-closing-harness.cjs");

function moveJiraTeamEu26EndKeynoteCardsToDone(columns) {
	const action = resolveJiraTeamEu26EndClosingAction(columns);
	assert.equal(action.kind, "move");
	return applyJiraTeamEu26EndClosingMove(columns, action.move);
}

function codesByColumn(columns) {
	return Object.fromEntries(columns.map((column) => [column.title, column.cards.map((card) => card.code)]));
}

test("Play closing moves every keynote card into Done in board order", () => {
	const columns = createJiraTeamEu26EndKeynoteBoardColumns();
	const next = moveJiraTeamEu26EndKeynoteCardsToDone(columns);
	const done = next.find((column) => column.title === "Done");

	assert.deepEqual(done.cards.map((card) => card.code), [...JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES]);
	assert.equal(done.count, JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES.length);
	assert.ok(done.cards.every((card) => card.status === "Done"));
	for (const column of next) {
		if (column.title === "Done") continue;
		assert.deepEqual(column.cards, []);
		assert.equal(column.count, 0);
	}
});

test("cards already in Done keep their order ahead of the bulk-moved cards", () => {
	// Two earlier drags: TEU-9 first, then TEU-2 dropped above it.
	let columns = createJiraTeamEu26EndKeynoteBoardColumns();
	columns = moveJiraKanbanCardsToDropTarget(columns, ["TEU-9"], "Done", { beforeCardCode: null });
	columns = moveJiraKanbanCardsToDropTarget(columns, ["TEU-2"], "Done", { beforeCardCode: "TEU-9" });

	const done = moveJiraTeamEu26EndKeynoteCardsToDone(columns).find((column) => column.title === "Done");
	assert.deepEqual(done.cards.map((card) => card.code), [
		"TEU-2",
		"TEU-9",
		...JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES.filter((code) => code !== "TEU-2" && code !== "TEU-9"),
	]);
});

test("board order follows the current column positions, not issue numbers", () => {
	let columns = createJiraTeamEu26EndKeynoteBoardColumns();
	// TEU-12 was dragged back to the top of Context.
	columns = moveJiraKanbanCardsToDropTarget(columns, ["TEU-12"], "Context", { beforeCardCode: "TEU-4" });

	const done = moveJiraTeamEu26EndKeynoteCardsToDone(columns).find((column) => column.title === "Done");
	assert.deepEqual(done.cards.map((card) => card.code).slice(0, 2), ["TEU-12", "TEU-4"]);
});

test("live-created work items stay where they are", () => {
	const columns = createJiraTeamEu26EndKeynoteBoardColumns().map((column) => (
		column.title === "Collaboration"
			? { ...column, cards: [...column.cards, { code: "TEU-14", title: "Live demo item", status: "Collaboration" }], count: column.cards.length + 1 }
			: column
	));

	const next = codesByColumn(moveJiraTeamEu26EndKeynoteCardsToDone(columns));
	assert.deepEqual(next.Collaboration, ["TEU-14"]);
	assert.equal(next.Done.length, JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES.length);
	assert.ok(!next.Done.includes("TEU-14"));
});

test("an incomplete board requests one cohort drop after the last Done card", () => {
	let columns = createJiraTeamEu26EndKeynoteBoardColumns();
	columns = moveJiraKanbanCardsToDropTarget(columns, ["TEU-5"], "Done", { beforeCardCode: null });

	assert.deepEqual(resolveJiraTeamEu26EndClosingAction(columns), {
		kind: "move",
		move: {
			cardCodes: JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES.filter((code) => code !== "TEU-5"),
			columnTitle: "Done",
			target: { beforeCardCode: null },
		},
	});
});

test("a complete board replays the finale instead of moving cards", () => {
	const complete = moveJiraTeamEu26EndKeynoteCardsToDone(createJiraTeamEu26EndKeynoteBoardColumns());
	assert.deepEqual(resolveJiraTeamEu26EndClosingAction(complete), { kind: "replay" });

	// Live-created cards outside Done do not block the replay.
	const withLiveCard = complete.map((column) => column.title === "Context"
		? { ...column, cards: [{ code: "TEU-14", title: "Live demo item", status: "Context" }], count: 1 }
		: column);
	assert.deepEqual(resolveJiraTeamEu26EndClosingAction(withLiveCard), { kind: "replay" });
});
