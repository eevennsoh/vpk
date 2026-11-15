const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

test("view settings update and survive closing, and fields can be removed and added", async () => {
	const view = await renderComponent({ entry: "components/blocks/jira-view-configuration/page.tsx" });
	assert.equal(view.getByRole("combobox", { name: "Hide done work items after" }).value, "14 days");
	assert.equal(view.getByRole("combobox", { name: "Mute agent sessions after" }).value, "1 week");
	await view.click(view.getByRole("button", { name: "Fixed" }));
	await view.click(view.getByRole("button", { name: "Whole board" }));
	assert.equal(view.getByRole("button", { name: "Fixed" }).getAttribute("aria-pressed"), "true");
	assert.equal(view.getByRole("button", { name: "Whole board" }).getAttribute("aria-pressed"), "true");
	await view.click(view.getByRole("button", { name: "Remove Assignee" }));
	assert.equal(view.queryByRole("button", { name: "Remove Assignee" }), null);
	const fields = view.getByRole("combobox", { name: "Fields" });
	await view.click(fields);
	await view.fill(fields, "priority");
	await view.click(view.getByRole("option", { name: "Priority" }));
	assert.equal(Boolean(view.getByRole("button", { name: "Remove Priority" })), true);
	await view.click(view.getByRole("button", { name: "Close view settings" }));
	assert.equal(view.queryByRole("heading", { name: "View settings" }), null);
	await view.click(view.getByRole("button", { name: "View settings" }));
	assert.equal(view.getByRole("button", { name: "Fixed" }).getAttribute("aria-pressed"), "true");
	assert.equal(Boolean(view.getByRole("button", { name: "Remove Priority" })), true);
});

test("all timing and field choices can be selected, searched, and restored", async () => {
	const view = await renderComponent({ entry: "components/blocks/jira-view-configuration/page.tsx" });
	const done = view.getByRole("combobox", { name: "Hide done work items after" });
	for (const label of ["Never", "1 day", "7 days", "14 days", "30 days"]) {
		await view.click(done);
		await view.click(view.getByRole("option", { name: label }));
		assert.equal(done.value, label);
	}
	const mute = view.getByRole("combobox", { name: "Mute agent sessions after" });
	for (const label of ["1 day", "2 days", "3 days", "4 days", "5 days", "6 days", "7 days", "1 week", "2 weeks", "3 weeks", "4 weeks"]) {
		await view.click(mute);
		await view.click(view.getByRole("option", { name: label }));
		assert.equal(mute.value, label);
	}
	const fields = view.getByRole("combobox", { name: "Fields" });
	for (const label of ["Agent sessions", "Assignee", "Development", "Due date", "Flagged", "Work type", "Priority", "Status", "Labels"]) {
		const remove = view.queryByRole("button", { name: `Remove ${label}` });
		if (remove) await view.click(remove);
		await view.click(fields);
		await view.fill(fields, label);
		await view.click(view.getByRole("option", { name: label }));
		assert.equal(Boolean(view.getByRole("button", { name: `Remove ${label}` })), true);
	}
	await view.click(fields);
	await view.fill(fields, "not a field");
	assert.equal(Boolean(view.getByText("No fields found")), true);
	await view.press(fields, "Escape");
	assert.equal(Boolean(view.getByRole("heading", { name: "View settings" })), true);
	await view.press(fields, "Escape");
	assert.equal(view.queryByRole("heading", { name: "View settings" }), null);
});

test("save and reset use the host's last saved settings", async () => {
	const view = await renderComponent({ entry: "components/blocks/jira-view-configuration/page.tsx" });
	await view.click(view.getByRole("button", { name: "Fixed" }));
	await view.click(view.getByRole("button", { name: "More" }));
	await view.click(view.getByRole("menuitem", { name: "Save board view" }));
	await view.click(view.getByRole("button", { name: "View settings" }));
	await view.click(view.getByRole("button", { name: "Flexible" }));
	await view.click(view.getByRole("button", { name: "More" }));
	await view.click(view.getByRole("menuitem", { name: "Reset to last view" }));
	await view.click(view.getByRole("button", { name: "View settings" }));
	assert.equal(view.getByRole("button", { name: "Fixed" }).getAttribute("aria-pressed"), "true");
});
