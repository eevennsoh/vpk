const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const items = [
	{ id: "1", issueKey: "R1S-1", summary: "First item", issueType: "task", priority: "medium", status: "To do" },
	{ id: "2", issueKey: "R1S-2", summary: "Second item", issueType: "story", priority: "major", status: "Done" },
];

test("sprint hierarchy control toggles even when there are no subtasks", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-backlog/index.tsx",
		exportName: "JiraBacklog",
		props: { sprints: [{ id: "sprint", title: "Payments SDK sprint", items }], backlog: [] },
	});
	const expand = view.getByRole("button", { name: "Expand all subtasks in Payments SDK sprint" });
	assert.equal(expand.disabled, false);
	await view.focus(expand);
	await view.press(null, " ");
	const collapse = view.getByRole("button", { name: "Collapse all subtasks in Payments SDK sprint" });
	assert.equal(collapse.getAttribute("aria-expanded"), "true");
	assert.equal(view.isFocused(collapse), true);
	await view.press(null, "Enter");
	assert.equal(view.getByRole("button", { name: "Expand all subtasks in Payments SDK sprint" }).getAttribute("aria-expanded"), "false");
	await view.unmount();
});

test("selection is scoped to a section and collapse preserves it", async () => {
	const changes = [];
	const view = await renderComponent({ entry: "components/blocks/jira-backlog/index.tsx", exportName: "JiraBacklog", props: {
		sprints: [{ id: "sprint", title: "Sprint 1", items }], backlog: [], onSelectionChange: (ids) => changes.push([...ids]),
	} });
	await view.click(view.getByRole("checkbox", { name: "Select R1S-1" }));
	assert.deepEqual(changes.at(-1), ["1"]);
	assert.equal(view.getByRole("checkbox", { name: "Select all work items in Sprint 1" }).getAttribute("aria-checked"), "mixed");
	await view.click(view.getByRole("checkbox", { name: "Select all work items in Sprint 1" }));
	assert.deepEqual(changes.at(-1), ["1", "2"]);
	await view.click(view.getByRole("button", { name: "Collapse Sprint 1" }));
	await view.click(view.getByRole("button", { name: "Expand Sprint 1" }));
	assert.equal(view.getByRole("checkbox", { name: "Select R1S-2" }).getAttribute("aria-checked"), "true");
	await view.unmount();
});

test("search filters both sprint and backlog items", async () => {
	const view = await renderComponent({ entry: "components/blocks/jira-backlog/index.tsx", exportName: "JiraBacklog", props: {
		sprints: [{ id: "sprint", title: "Sprint 1", items: [items[0]] }], backlog: [items[1]],
	} });
	const search = view.getByRole("textbox", { name: "Search backlog" });
	await view.fill(search, "R1S-2");
	assert.equal(view.container.textContent.includes("First item"), false);
	assert.equal(view.container.textContent.includes("Second item"), true);
	await view.fill(search, "");
	assert.equal(view.container.textContent.includes("First item"), true);
	await view.unmount();
});

test("assignee and status filters compose without clearing selected work", async () => {
	const person = { id: "dirk", name: "Dirk Pink" };
	const view = await renderComponent({
		entry: "components/blocks/jira-backlog/index.tsx",
		exportName: "JiraBacklog",
		props: {
			sprints: [{ id: "sprint", title: "Sprint 1", items: [{ ...items[0], assignee: person }] }],
			backlog: [items[1]],
			people: [person],
		},
	});

	await view.click(view.getByRole("checkbox", { name: "Select R1S-2" }));
	await view.click(view.getByRole("button", { name: "Filter backlog by Dirk Pink" }));
	assert.match(view.container.textContent, /First item/);
	assert.doesNotMatch(view.container.textContent, /Second item/);
	assert.match(view.container.textContent, /1 of 2 work items/);

	await view.click(view.getByRole("button", { name: "Filter backlog by status" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Done" }));
	assert.doesNotMatch(view.container.textContent, /First item/);
	await view.press(null, "Escape");

	await view.click(view.getByRole("button", { name: "Filter backlog by Dirk Pink" }));
	assert.equal(view.getByRole("checkbox", { name: "Select R1S-2" }).getAttribute("aria-checked"), "true");
	assert.doesNotMatch(view.container.textContent, /First item/);
	await view.unmount();
});

test("the Agent sessions column starts and opens sessions for the right work items", async () => {
	const cursor = { id: "cursor", name: "Cursor", byline: "Coding agent" };
	const session = {
		...cursor,
		id: "cursor-session",
		sessionTitle: "Review the lighting prototype",
		statusKind: "needs-input",
		statusLabel: "Needs input",
	};
	const assigned = [];
	const opened = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-backlog/index.tsx",
		exportName: "JiraBacklog",
		props: {
			sprints: [{ id: "sprint", title: "Sprint 1", items: [items[0]] }],
			backlog: [{ ...items[1], agentSessions: [session] }],
			agentCatalog: [cursor],
			onAssignedAgentIdsChange: (key, ids) => assigned.push([key, ids]),
			onAssignedAgentSelect: (key, agent) => opened.push([key, agent.id]),
		},
	});

	assert.equal(view.getAllByRole("columnheader", { name: "Agent sessions" }).length, 2);
	await view.focus(view.getByRole("button", { name: "Add agent to R1S-1" }));
	await view.press(null, " ");
	await view.click(view.getByRole("option", { name: /Cursor/u }));
	assert.deepEqual(assigned, [["R1S-1", ["cursor"]]]);

	await view.click(view.getByRole("button", { name: "Cursor: Needs input" }));
	await view.click(view.getByText(session.sessionTitle));
	assert.deepEqual(opened, [["R1S-2", "cursor-session"]]);
	await view.unmount();
});

test("the sprint boundary menu moves adjacent items and stays unavailable when rows are hidden", async () => {
	const moves = [];
	const label = "Move work items between sprint and backlog";
	const view = await renderComponent({
		entry: "components/blocks/jira-backlog/index.tsx",
		exportName: "JiraBacklog",
		props: {
			sprints: [{ id: "sprint", title: "Sprint 1", items: [items[0]] }],
			backlog: [items[1]],
			sprintBoundary: { sprintId: "sprint", onMove: (move) => moves.push(move) },
		},
	});

	await view.click(view.getByRole("button", { name: label }));
	await view.click(view.getByRole("button", { name: "Move first backlog item into sprint" }));
	await view.click(view.getByRole("button", { name: label }));
	await view.click(view.getByRole("button", { name: "Move last sprint item to backlog" }));
	assert.deepEqual(moves, [
		{ sprintId: "sprint", itemIds: ["2"], destination: "sprint" },
		{ sprintId: "sprint", itemIds: ["1"], destination: "backlog" },
	]);

	await view.fill(view.getByRole("textbox", { name: "Search backlog" }), "R1S-2");
	assert.ok(view.queryByRole("button", { name: label }) === null);
	assert.match(view.container.textContent, /Clear filters to move work items/);
	await view.fill(view.getByRole("textbox", { name: "Search backlog" }), "");
	await view.click(view.getByRole("button", { name: "Collapse Backlog" }));
	assert.ok(view.queryByRole("button", { name: label }) === null);
	assert.match(view.container.textContent, /Expand both sections to move work items/);
	await view.unmount();
});

test("the catalog sprint boundary moves a subtask with its parent", async () => {
	const summary = "Check headlamp fit";
	const view = await renderComponent({ entry: "components/website/demos/blocks/jira-backlog-demo.tsx" });
	try {
		await view.click(view.getByRole("button", { name: "Create work item after R1S-8" }));
		const draft = view.getByRole("textbox", { name: "New work item summary" });
		await view.fill(draft, summary);
		await view.press(draft, "Tab");
		await view.press(draft, "Enter");
		await view.press(view.getByRole("textbox", { name: "New work item summary" }), "Escape");

		const sprint = view.getByRole("table", { name: "R1S Design Sprint 4 work items" });
		const backlog = view.getByRole("table", { name: "Backlog work items" });
		assert.ok(sprint.contains(view.getByText(summary)));

		await view.click(view.getByRole("button", { name: "Move work items between sprint and backlog" }));
		await view.click(view.getByRole("button", { name: "Move last sprint item to backlog" }));
		assert.ok(!sprint.textContent.includes(summary), "the subtask left the sprint with its parent");
		await view.click(view.getByRole("button", { name: "Expand R1S-8" }));
		assert.ok(backlog.contains(view.getByText(summary)));
	} finally {
		await view.unmount();
	}
});
