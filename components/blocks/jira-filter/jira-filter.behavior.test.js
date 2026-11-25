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

test("Project butter supports pinned and field selections and clearing", async () => {
	const view = await renderComponent({
		source: `import Page from "@/components/blocks/jira-filter/page";
			export function Example() { return <Page variant="project-butter" />; }`,
		exportName: "Example",
	});
	await view.click(view.getByRole("button", { name: "Filter" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Needs input" }));
	assert.equal(view.getByRole("button", { name: "Filter (1)" }).getAttribute("aria-label"), "Filter (1)");
	await view.press(view.getByRole("menuitem", { name: "Pull request" }), "ArrowRight");
	await view.click(view.getByRole("menuitemcheckbox", { name: "Open" }));
	assert.equal(view.getByRole("button", { name: "Filter (2)" }).getAttribute("aria-label"), "Filter (2)");
	await view.click(view.getByRole("menuitem", { name: "Clear all" }));
	assert.equal(view.getByRole("button", { name: "Filter" }).textContent.includes("(2)"), false);
});

test("Project butter adds searched fields and saves a named filter", async () => {
	const view = await renderComponent({
		source: `import Page from "@/components/blocks/jira-filter/page";
			export function Example() { return <Page variant="project-butter" />; }`,
		exportName: "Example",
	});
	await view.click(view.getByRole("button", { name: "Filter" }));
	await view.fill(view.getByRole("textbox", { name: "Add filter" }), "priority");
	await view.click(view.getByRole("menuitem", { name: "Priority" }));
	await view.press(view.getByRole("menuitem", { name: "Priority" }), "ArrowRight");
	await view.click(view.getByRole("menuitemcheckbox", { name: "High" }));
	await view.press(view.getByRole("menuitem", { name: "Save filter" }), "ArrowRight");
	await view.fill(view.getByRole("textbox", { name: "Filter name" }), "My priorities");
	await view.click(view.getByRole("button", { name: "Save" }));
	assert.equal(view.getByRole("menuitemcheckbox", { name: "My priorities" }).getAttribute("aria-checked"), "true");
});

test("Project butter limits pins and keeps pinned shortcuts usable", async () => {
	const view = await renderComponent({
		source: `import Page from "@/components/blocks/jira-filter/page";
			export function Example() { return <Page variant="project-butter" />; }`,
		exportName: "Example",
	});
	await view.click(view.getByRole("button", { name: "Filter" }));
	await view.press(view.getByRole("menuitem", { name: "Pull request" }), "ArrowRight");
	await view.click(view.getByRole("menuitem", { name: "Pin Open" }));
	await view.click(view.getByRole("menuitem", { name: "Pin Merged" }));
	assert.equal(view.queryByRole("menuitem", { name: "Pin Closed" }) === null, true);
	await view.click(view.getByRole("menuitem", { name: "Unpin Needs input" }));
	await view.press(view.getByRole("menuitem", { name: "Pull request" }), "ArrowRight");
	assert.equal(view.getByRole("menuitem", { name: "Pin Closed" }).getAttribute("aria-label"), "Pin Closed");
});

test("Project butter JQL validates before applying and keeps the prior selection", async () => {
	const view = await renderComponent({
		source: `import Page from "@/components/blocks/jira-filter/page";
			export function Example() { return <Page variant="project-butter" />; }`,
		exportName: "Example",
	});
	await view.click(view.getByRole("button", { name: "Filter" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Needs input" }));
	await view.press(view.getByRole("menuitem", { name: "JQL" }), "ArrowRight");
	const input = view.getByRole("textbox", { name: "JQL query" });
	assert.equal(input.value, 'agentStatus = "needsInput"');
	await view.fill(input, "unknown = value");
	await view.click(view.getByRole("button", { name: "Apply" }));
	assert.equal(view.getByRole("alert").textContent, "“unknown” is not a supported filter field.");
	assert.equal(view.getByRole("button", { name: "Filter (1)" }).getAttribute("aria-label"), "Filter (1)");
	await view.fill(input, 'status = "done"');
	await view.press(input, "Enter", { shiftKey: true });
	assert.equal(view.queryByRole("alert"), null);
	assert.equal(view.getByRole("button", { name: "Filter (1)" }).getAttribute("aria-label"), "Filter (1)");
	assert.equal(input.value, 'status = "done"');
});

test("Project butter retains unsaved view changes after reopening and clears from the split trigger", async () => {
	const view = await renderComponent({
		source: `import Page from "@/components/blocks/jira-filter/page";
			export function Example() { return <Page variant="project-butter" />; }`,
		exportName: "Example",
	});
	await view.click(view.getByRole("button", { name: "Filter" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Needs input" }));
	await view.click(view.getByRole("button", { name: "Filter (1)" }));
	await view.click(view.getByRole("button", { name: "Filter (1)" }));
	await view.click(view.getByRole("menuitem", { name: "Save view" }));
	assert.equal(view.getByRole("status").textContent, "View saved");
	await view.click(view.getByRole("button", { name: "Clear all filters" }));
	assert.equal(view.getByRole("button", { name: "Filter" }).getAttribute("aria-label"), "Filter");
});

test("the Jira Filter preview switches between both variants", async () => {
	const view = await renderComponent({ entry: "components/website/demos/blocks/jira-filter-demo.tsx" });
	assert.equal(view.getByRole("button", { name: "Project butter" }).getAttribute("aria-pressed"), "true");
	await view.click(view.getByRole("button", { name: "Filter" }));
	assert.equal(view.getByRole("dialog", { name: "Project butter filters" }).getAttribute("role"), "dialog");
	await view.click(view.getByRole("button", { name: "Filter" }));
	await view.click(view.getByRole("button", { name: "Default" }));
	await view.click(view.getByRole("button", { name: "Filter" }));
	assert.equal(view.getByRole("tab", { name: "Saved" }).getAttribute("role"), "tab");
});

test("clearing from the split trigger resets an unfinished field search", async () => {
	const view = await renderComponent({
		source: `import Page from "@/components/blocks/jira-filter/page";
			export function Example() { return <Page variant="project-butter" />; }`,
		exportName: "Example",
	});
	await view.click(view.getByRole("button", { name: "Filter" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Needs input" }));
	await view.fill(view.getByRole("textbox", { name: "Add filter" }), "priority");
	await view.click(view.getByRole("button", { name: "Clear all filters" }));
	await view.click(view.getByRole("button", { name: "Filter" }));
	assert.equal(view.getByRole("textbox", { name: "Add filter" }).value, "");
	assert.equal(view.getByRole("menuitem", { name: "Saved" }).textContent.includes("Saved"), true);
});

test("saving a view can persist clearing its last filter", async () => {
	const view = await renderComponent({
		source: `import { useState } from "react";
			import { JiraFilter } from "@/components/blocks/jira-filter";
			export function Example() {
				const [value, setValue] = useState([]);
				const [saves, setSaves] = useState(0);
				return <><JiraFilter variant="project-butter" fields={[{id:"agentStatus",label:"Agent status",multiple:true,options:[{value:"needsInput",label:"Needs input"}]}]} value={value} onChange={setValue} onSaveView={() => setSaves(saves + 1)} /><p role="status">{saves}</p></>;
			}`,
		exportName: "Example",
	});
	await view.click(view.getByRole("button", { name: "Filter" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Needs input" }));
	await view.click(view.getByRole("menuitem", { name: "Save view" }));
	assert.equal(view.getByRole("status").textContent, "1");
	await view.click(view.getByRole("button", { name: "Filter (1)" }));
	await view.click(view.getByRole("menuitem", { name: "Clear all" }));
	await view.click(view.getByRole("menuitem", { name: "Save view" }));
	assert.equal(view.getByRole("status").textContent, "2");
});

test("Project butter preview lists the same field flyouts as the butter-v1 board", async () => {
	const view = await renderComponent({
		source: `import Page from "@/components/blocks/jira-filter/page";
			export function Example() { return <Page variant="project-butter" />; }`,
		exportName: "Example",
	});
	await view.click(view.getByRole("button", { name: "Filter" }));
	const options = view.getByRole("menu", { name: "Filter options" });
	const labels = [...options.querySelectorAll("[role=menuitem]")].map((item) => item.textContent.trim()).filter(Boolean);
	assert.deepEqual(labels, ["Saved", "Advanced", "JQL", "Agent status", "Pull request", "Assignee", "Epic", "Sprint", "Work type", "Labels", "Status"]);
});
