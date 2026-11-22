const assert = require("node:assert/strict");
const test = require("node:test");

const { BOARD_GROUP_DEFAULT_ID, BOARD_GROUP_OPTIONS, BOARD_SWIMLANE_OPTIONS } = require("./board-group-options.ts");
const { groupBoardColumns, inlineCreateSwimlaneDefaults } = require("../lib/board-swimlanes.ts");

test("Group picker lists the production Jira dimensions in order", () => {
	assert.deepEqual(
		BOARD_GROUP_OPTIONS.map((option) => option.label),
		["Agent", "Assignee", "Atlassian Project", "Epic", "Labels", "Priority", "Subtask"],
	);
});

test("Group picker default is ungrouped", () => {
	assert.equal(BOARD_GROUP_DEFAULT_ID, "");
	assert.ok(BOARD_GROUP_OPTIONS.every((option) => option.id !== BOARD_GROUP_DEFAULT_ID));
});

function card(code, fields = {}) {
	return { code, title: code, priority: "medium", tags: [], ...fields };
}

function column(title, cards = []) {
	return { title, count: cards.length, cards };
}

test("Assignee lanes preserve status columns, filtered card order, and unassigned work", () => {
	const jamie = { id: "j-1", name: "Jamie" };
	const anotherJamie = { id: "j-2", name: "Jamie" };
	const first = card("PAY-1", { assignee: jamie });
	const second = card("PAY-2", { assignee: jamie });
	const other = card("PAY-3", { assignee: anotherJamie });
	const unassigned = card("PAY-4");
	const todo = { ...column("To do", [second, first, other]), statuses: ["Open", "Planning"] };
	const done = column("Done", [unassigned]);
	const lanes = groupBoardColumns([todo, done], "assignee");

	assert.deepEqual(lanes.map(({ label, count }) => [label, count]), [["Jamie", 2], ["Jamie", 1], ["Unassigned", 1]]);
	assert.equal(new Set(lanes.map(({ id }) => id)).size, 3);
	assert.deepEqual(lanes[0].columns.map(({ title, count }) => [title, count]), [["To do", 2], ["Done", 0]]);
	assert.deepEqual(lanes[0].columns[0].statuses, ["Open", "Planning"]);
	assert.deepEqual(lanes[0].columns[0].cards, [second, first]);
	assert.deepEqual(inlineCreateSwimlaneDefaults(lanes[0]), { assignee: jamie });
	assert.deepEqual(todo.cards, [second, first, other]);
});

test("Agent and Labels use one primary value per card and Agent omits work without sessions", () => {
	const full = card("PAY-1", {
		agentActivities: [{ id: "session-1", name: "Rovo" }, { id: "session-2", name: "Claude" }],
		tags: [{ text: "migration" }, { text: "sdk" }],
	});
	const visible = card("PAY-1", { tags: full.tags });
	const done = card("PAY-2", { agentDoneRuns: [{ id: "session-3", agentName: "Rovo" }] });
	const unassigned = card("PAY-3");
	const columns = [column("To do", [visible, unassigned]), column("Done", [done])];
	const fullColumns = [column("To do", [full, unassigned]), columns[1]];
	const groups = groupBoardColumns(columns, "agent", fullColumns);

	assert.deepEqual(groups.map(({ label, count }) => [label, count]), [["Rovo", 2]]);
	assert.equal(groups[0].columns[0].cards[0], visible);
	assert.deepEqual(groupBoardColumns(columns, "labels").map(({ label, count }) => [label, count]), [["migration", 1], ["Uncategorised", 2]]);
});

test("Epic and Subtask resolve parents outside the filtered board; Priority follows severity", () => {
	const epic = card("PAY-1", { title: "Payments", issueType: "epic" });
	const parent = card("PAY-2", { parentIssueKey: epic.code });
	const child = card("PAY-3", { issueType: "subtask", parentIssueKey: parent.code, priority: "critical" });
	const visibleColumns = [column("To do", [parent, child])];
	const allColumns = [...visibleColumns, column("Done", [epic])];

	assert.deepEqual(groupBoardColumns(visibleColumns, "epic", allColumns).map(({ label }) => label), ["PAY-1 Payments", "Uncategorised"]);
	assert.deepEqual(groupBoardColumns(visibleColumns, "subtask", allColumns).map(({ label }) => label), ["PAY-2 PAY-2", "Uncategorised"]);
	assert.deepEqual(groupBoardColumns(visibleColumns, "priority").map(({ label }) => label), ["Critical", "Medium"]);
	assert.deepEqual(BOARD_SWIMLANE_OPTIONS.map(({ id }) => id), ["agent", "assignee", "epic", "labels", "priority", "subtask"]);
});
