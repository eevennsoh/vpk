const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

test("the default header keeps Group and Needs input inline", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-kanban/experimental/experimental-board-header.tsx",
		exportName: "ExperimentalJiraKanbanBoardHeader",
		props: { needsInputCount: 4, showCustomizeControl: true },
	});
	const needsInput = view.getByRole("button", { name: "Needs input: 4 agents" });
	const group = view.getByRole("button", { name: "Group" });
	const customize = view.getByRole("button", { name: "Customize" });
	assert.equal(group.nextElementSibling === needsInput, true);
	assert.equal(needsInput.parentElement === customize.parentElement, false);
});

for (const activeView of ["board", "list"]) {
	test(`${activeView} keeps Needs input as a separate text button in the trailing controls`, async () => {
		const selections = [];
		const view = await renderComponent({
			entry: "components/blocks/jira-kanban/experimental/experimental-board-header.tsx",
			exportName: "ExperimentalJiraKanbanBoardHeader",
			props: {
				activeView,
				headerControlsLayout: "trailing-icons",
				needsInputCount: 4,
				onAgentFilterIdChange: (id) => selections.push(id),
				showCustomizeControl: true,
			},
		});
		const needsInput = view.getByRole("button", { name: "Needs input: 4 agents" });
		const group = view.getByRole("button", { name: "Group" });
		const customize = view.getByRole("button", { name: "Customize" });
		assert.equal(needsInput.textContent, "Needs input");
		assert.equal(needsInput.parentElement === group.parentElement, true);
		assert.equal(needsInput.parentElement === customize.parentElement, true);
		assert.equal(needsInput.nextElementSibling === group, true);
		assert.equal(group.textContent, "");
		await view.press(needsInput, "Enter");
		assert.deepEqual(selections, ["needs-input"]);
	});
}
