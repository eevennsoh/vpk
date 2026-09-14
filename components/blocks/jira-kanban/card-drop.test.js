const assert = require("node:assert/strict");
const test = require("node:test");
const { moveJiraKanbanCardsToDropTarget } = require("./card-drop.ts");

const card = (code, status) => ({ code, title: code, tags: [], priority: "medium", status });
const board = () => [
	{ title: "To do", count: 2, cards: [card("A"), card("B")] },
	{ title: "In progress", statuses: ["In progress", "Paused"], count: 2, cards: [card("C"), card("D")] },
];

test("a status drop inserts at the chosen anchor and preserves sessions", () => {
	const columns = board();
	columns[0].cards[0].agentActivities = [{ id: "session", state: "working" }];
	const next = moveJiraKanbanCardsToDropTarget(columns, ["A"], "In progress", { status: "Paused", beforeCardCode: "D" });
	assert.deepEqual(next.map((column) => column.cards.map((item) => item.code)), [["B"], ["C", "A", "D"]]);
	assert.equal(next[1].cards[1].status, "Paused");
	assert.equal(next[1].cards[1].agentActivities, columns[0].cards[0].agentActivities);
	assert.deepEqual(next.map((column) => column.count), [1, 3]);
	assert.equal(columns[0].cards.length, 2);
});

test("same-column drops reorder and can change the issue status", () => {
	const next = moveJiraKanbanCardsToDropTarget(board(), ["C"], "In progress", { status: "Paused", beforeCardCode: null });
	assert.deepEqual(next[1].cards.map((item) => item.code), ["D", "C"]);
	assert.equal(next[1].cards[1].status, "Paused");
});

test("bulk movement retains board order and supports empty columns", () => {
	const columns = [...board(), { title: "Done", count: 0, cards: [] }];
	const next = moveJiraKanbanCardsToDropTarget(columns, ["B", "A"], "Done", { beforeCardCode: null });
	assert.deepEqual(next[2].cards.map((item) => item.code), ["A", "B"]);
	assert.equal(next[2].cards[0].status, "Done");
});

test("invalid columns, statuses and stale anchors cannot lose cards", () => {
	const columns = board();
	for (const [title, target] of [["Missing", {}], ["To do", { status: "Paused" }], ["In progress", { beforeCardCode: "Missing" }]]) {
		assert.deepEqual(moveJiraKanbanCardsToDropTarget(columns, ["A"], title, target), columns);
	}
});
