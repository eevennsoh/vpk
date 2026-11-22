const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

test("Create markup wires full-width and hover classes to its column shell without horizontal wrapper padding", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-kanban/experimental/experimental-jira-kanban.tsx",
		exportName: "ExperimentalJiraKanban",
		props: { boardColumns: [{ title: "Intake", count: 0, cards: [] }] },
	});
	const create = view.getByRole("button", { name: "Create in Intake" });
	assert.equal(create.classList.contains("w-full"), true);
	assert.equal(create.closest('[data-jira-kanban-column="Intake"]')?.classList.contains("group/board-column"), true);
	assert.equal(create.classList.contains("group-hover/board-column:opacity-100"), true);
	assert.equal(create.classList.contains("group-hover/board-column:pointer-events-auto"), true);
	const wrapper = create.closest("[data-board-work-item-create]");
	assert.equal(Boolean(wrapper), true);
	assert.doesNotMatch(wrapper.className, /(?:^|\s)(?:\S*:)?!?-?p(?:[xrlse])?-\S+/u);
	for (const property of ["padding", "padding-inline", "padding-inline-start", "padding-inline-end", "padding-left", "padding-right"]) {
		assert.equal(wrapper.style.getPropertyValue(property), "", property);
	}
});
