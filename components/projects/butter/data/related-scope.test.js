const assert = require("node:assert/strict");
const test = require("node:test");
const { butterRelatedCatalog, butterRelatedStatus, butterWorkType } = require("./related-scope.ts");

test("board cards become related-work matches in the open project", () => {
	const catalog = butterRelatedCatalog([
		{ title: "In Progress", cards: [{ code: "PAY-104", title: "Port checkout", priority: "major", issueType: "story", assignee: { name: "Sia Vale" } }] },
		{ title: "Done", cards: [{ code: "PAY-120", title: "Ship receipts", priority: "minor", status: "Done" }] },
	]);
	assert.deepEqual(catalog.map((item) => [item.key, item.status, item.priority, item.workType, item.assignee]), [
		["PAY-104", "In progress", "High", "Story", "Sia Vale"],
		["PAY-120", "Done", "Low", "Task", "Unassigned"],
	]);
});

test("statuses fold into the three related statuses and types default to Task", () => {
	assert.equal(butterRelatedStatus("To Do"), "To do");
	assert.equal(butterRelatedStatus("In review"), "In progress");
	assert.equal(butterWorkType({ issueType: "subtask" }), "Subtask");
	assert.equal(butterWorkType({}), "Task");
});
