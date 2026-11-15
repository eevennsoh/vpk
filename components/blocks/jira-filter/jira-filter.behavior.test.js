const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

test("filter modes share conditions, reject invalid JQL, and save personal filters", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-filter/page.tsx",
	});
	await view.click(view.getByRole("button", { name: "Filter" }));
	await view.click(view.getByRole("tab", { name: "Basic" }));
	await view.click(view.getByRole("button", { name: "Imani" }));
	assert.equal(
		view
			.getByRole("button", { name: "Filter (1)" })
			.textContent.includes("(1)"),
		true,
	);
	await view.click(view.getByRole("tab", { name: "Advanced" }));
	assert.equal(
		view.getByRole("combobox", { name: "Field 1" }).value,
		"assignee",
	);
	await view.click(view.getByRole("tab", { name: "JQL" }));
	assert.equal(
		view.getByRole("textbox", { name: "JQL query" }).value,
		'assignee = "imani"',
	);
	await view.fill(
		view.getByRole("textbox", { name: "JQL query" }),
		"unknown = value",
	);
	await view.click(view.getByRole("button", { name: "Apply" }));
	assert.equal(
		view.getByRole("alert").textContent,
		"“unknown” is not a supported filter field.",
	);
	assert.equal(
		view
			.getByRole("button", { name: "Filter (1)" })
			.textContent.includes("(1)"),
		true,
	);
	await view.fill(
		view.getByRole("textbox", { name: "JQL query" }),
		'status = "done"',
	);
	await view.click(view.getByRole("button", { name: "Apply" }));
	await view.click(view.getByRole("tab", { name: "Basic" }));
	await view.click(view.getByRole("button", { name: "Save" }));
	assert.equal(
		view
			.getByRole("button", { name: "Saved filter 7" })
			.getAttribute("aria-pressed"),
		"true",
	);
	await view.click(view.getByRole("button", { name: "Delete Saved filter 7" }));
	assert.equal(view.queryByRole("button", { name: "Saved filter 7" }), null);
});

test("Escape from filter search dismisses the popover", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-filter/page.tsx",
	});
	const trigger = view.getByRole("button", { name: "Filter" });
	await view.click(trigger);
	await view.press(
		view.getByRole("textbox", { name: "Search saved filters" }),
		"Escape",
	);
	assert.equal(trigger.getAttribute("aria-expanded"), "false");
	await view.click(trigger);
	await view.click(view.getByRole("tab", { name: "Basic" }));
	await view.press(
		view.getByRole("textbox", { name: "Search Assignee values" }),
		"Escape",
	);
	assert.equal(trigger.getAttribute("aria-expanded"), "false");
});

test("saved directories and search show the matching groups and counts", async () => {
	const filters = [
		{
			id: "team",
			name: "Team backlog",
			group: "team",
			conditions: [{ field: "status", operator: "is", values: ["todo"] }],
		},
		{
			id: "mine",
			name: "My reviews",
			group: "personal",
			conditions: [{ field: "status", operator: "is", values: ["review"] }],
		},
	];
	const source = `import { useState } from "react";
		import { SavedPanel } from "@/components/blocks/jira-filter/saved-panel";
		export function Example() {
			const [directory, setDirectory] = useState("all"); const [search, setSearch] = useState("");
			const [value, setValue] = useState([]); const [pinned, setPinned] = useState([]);
			return <SavedPanel filters={${JSON.stringify(filters)}} value={value} pinned={pinned} recent={[]} directory={directory} search={search} onDirectoryChange={setDirectory} onSearchChange={setSearch} onSelect={(item) => setValue(item.conditions)} onPin={(id) => setPinned([id])} onDelete={() => {}} onClear={() => setValue([])} onDismiss={() => {}} />;
		}`;
	const view = await renderComponent({ source, exportName: "Example" });
	assert.equal(
		view.getByRole("button", { name: "All 2" }).getAttribute("aria-pressed"),
		"true",
	);
	await view.click(view.getByRole("button", { name: "Team 1" }));
	assert.equal(view.queryByRole("button", { name: "My reviews" }), null);
	await view.click(view.getByRole("button", { name: "Team backlog" }));
	assert.equal(
		view
			.getByRole("button", { name: "Team backlog" })
			.getAttribute("aria-pressed"),
		"true",
	);
	await view.click(view.getByRole("button", { name: "Pin Team backlog" }));
	assert.equal(
		view.getByRole("button", { name: "Pinned 1" }).textContent.includes("1"),
		true,
	);
	await view.fill(
		view.getByRole("textbox", { name: "Search saved filters" }),
		"missing",
	);
	assert.equal(
		view.getByText("No filters match your search").textContent,
		"No filters match your search",
	);
});
