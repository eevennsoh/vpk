const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

test("inline creation saves a work item and Escape cancels", async () => {
	const view = await renderComponent({
		source: `
			import { useState } from "react";
			import { JiraInlineCreate } from "@/components/blocks/jira-inline-create";
			export default function Fixture() {
				const [created, setCreated] = useState("");
				const [open, setOpen] = useState(false);
				return <div><button onClick={() => setOpen(true)}>Create work item in To do</button>{open ? <JiraInlineCreate columns={[]} issueKey="PAY-1" onCancel={() => setOpen(false)} onSave={draft => { setCreated(draft.summary); setOpen(false); }} /> : null}<output>{created}</output></div>;
			}
		`,
	});
	assert.ok(view.tabOrder().includes("Create work item in To do"));
	const createButton = view.getByRole("button", { name: "Create work item in To do" });
	await view.press(null, "Tab");
	assert.equal(view.isFocused(createButton), true);
	await view.press(createButton, "Enter");
	const summary = view.getByRole("textbox", { name: "Work item summary" });
	await view.fill(summary, "New task");
	await view.press(summary, "Enter", { isComposing: true });
	assert.equal(view.container.querySelector("output").textContent, "");
	await view.press(summary, "Enter");
	assert.equal(view.container.querySelector("output").textContent, "New task");
	await view.click(createButton);
	await view.press(view.getByRole("textbox", { name: "Work item summary" }), "Escape");
	assert.equal(view.queryByRole("textbox", { name: "Work item summary" }) === null, true);
	await view.unmount();
});

test("priority fields without preview retain the committed trigger value", async () => {
	const changes = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-work-item/team-eu26/components/detail-field-editors.tsx",
		exportName: "PriorityRowField",
		props: { value: "Medium", onChange: (value) => changes.push(value) },
	});
	const trigger = view.getByRole("button", { name: "Change priority. Current priority: Medium" });
	await view.click(trigger);
	const low = view.getByRole("menuitem", { name: "Low" });
	await view.focus(low);
	assert.equal(trigger.textContent.includes("Medium"), true);
	assert.deepEqual(changes, []);
	await view.click(low);
	assert.deepEqual(changes, ["Low"]);
	await view.unmount();
});

test("inline creation preserves parent, tags, subtasks and footer choices", async () => {
	const view = await renderComponent({
		source: `
			import { useState } from "react";
			import { JiraInlineCreate } from "@/components/blocks/jira-inline-create";
			const columns = [{ title: "To do", count: 2, cards: [
				{ code: "PAY-1", title: "Parent item", issueType: "epic", priority: "medium", tags: [{ text: "checkout", color: "standard" }], assignee: { id: "venn", name: "Venn" } },
				{ code: "PAY-2", title: "Child item", parentIssueKey: "PAY-1", priority: "major", tags: [], assignee: { id: "maya", name: "Maya", avatarSrc: "/maya.png" } },
			] }];
			export default function Fixture() {
				const [saved, setSaved] = useState("");
				return <><JiraInlineCreate columns={columns} issueKey="PAY-3" onCancel={() => {}} onSave={draft => setSaved(JSON.stringify(draft))} /><output>{saved}</output></>;
			}
		`,
	});
	await view.fill(view.getByRole("textbox", { name: "Work item summary" }), "New work");
	await view.click(view.getByRole("button", { name: "Work item type: task" }));
	assert.equal(view.queryByRole("textbox", { name: "Search work item types" }) === null, true);
	assert.equal(view.getByRole("menu", { name: "Choose work item type" }).querySelectorAll('[role="menuitem"]').length, 4);
	const story = view.getByRole("menuitem", { name: "Story" });
	await view.focus(story);
	assert.equal(view.isFocused(story), true);
	await view.press(story, "Enter");
	assert.equal(view.queryByRole("button", { name: "Work item type: story" }) !== null, true);
	assert.equal(view.container.querySelector("output").textContent, "");
	await view.click(view.getByRole("button", { name: "Add subtasks" }));
	assert.equal(view.getByRole("dialog", { name: "Choose subtasks" }).contains(view.getByRole("menu", { name: "Subtasks" })), true);
	assert.equal(view.isFocused(view.getByRole("textbox", { name: "Search subtasks" })), true);
	await view.fill(view.getByRole("textbox", { name: "Search subtasks" }), "missing child");
	assert.equal(view.queryByRole("menuitemcheckbox", { name: "PAY-2 Child item" }) === null, true);
	assert.equal(view.getByRole("status").textContent, "No subtasks match");
	assert.equal(view.queryByRole("menu", { name: "Subtasks" }) === null, true);
	await view.fill(view.getByRole("textbox", { name: "Search subtasks" }), "PAY-2");
	const child = view.getByRole("menuitemcheckbox", { name: "PAY-2 Child item" });
	assert.equal(child.textContent.includes("PAY-2"), true);
	assert.equal(child.textContent.includes("Child item"), true);
	assert.equal(child.querySelector("[role=progressbar]") !== null, true);
	assert.equal(child.querySelector('[aria-label="major priority"]') !== null, true);
	assert.equal(child.querySelector('[data-slot="avatar"][aria-label="Maya"]') !== null, true);
	await view.click(view.getByRole("menuitemcheckbox", { name: "PAY-2 Child item" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "PAY-2 Child item" }));
	assert.equal(view.queryByRole("button", { name: "Add subtasks" }) !== null, true);
	await view.click(view.getByRole("menuitemcheckbox", { name: "PAY-2 Child item" }));
	assert.equal(view.getByRole("menuitemcheckbox", { name: "PAY-2 Child item" }).getAttribute("aria-checked"), "true");
	await view.press(view.getByRole("textbox", { name: "Search subtasks" }), "Escape");
	assert.equal(view.queryByRole("textbox", { name: "Work item summary" }) !== null, true);
	await view.click(view.getByRole("button", { name: "0 of 1 subtasks complete" }));
	assert.equal(view.getByRole("textbox", { name: "Search subtasks" }).value, "");
	assert.equal(view.getByRole("menuitemcheckbox", { name: "PAY-2 Child item" }).getAttribute("aria-checked"), "true");
	await view.press(view.getByRole("textbox", { name: "Search subtasks" }), "Escape");
	await view.click(view.getByRole("button", { name: "Add labels" }));
	await view.click(view.getByRole("option", { name: "Add checkout" }));
	assert.equal(view.queryByRole("option", { name: "Add checkout" }) === null, true);
	await view.click(view.getByRole("button", { name: "Remove checkout" }));
	await view.click(view.getByRole("option", { name: "Add checkout" }));
	await view.fill(view.getByRole("textbox", { name: "Search labels" }), "new tag");
	await view.press(view.getByRole("textbox", { name: "Search labels" }), "Enter");
	await view.press(view.getByRole("textbox", { name: "Search labels" }), "Escape");
	assert.equal(view.queryByRole("textbox", { name: "Work item summary" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Add parent" }));
	await view.fill(view.getByRole("textbox", { name: "Search work items" }), "PAY-1");
	await view.click(view.getByRole("option", { name: /Parent item/u }));
	await view.click(view.getByRole("button", { name: "Parent, PAY-1 Parent item" }));
	await view.click(view.getByRole("option", { name: "Remove parent" }));
	await view.click(view.getByRole("button", { name: "Add parent" }));
	await view.press(view.getByRole("textbox", { name: "Search work items" }), "Escape");
	assert.equal(view.queryByRole("textbox", { name: "Work item summary" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Add parent" }));
	await view.click(view.getByRole("option", { name: /Parent item/u }));
	await view.click(view.getByRole("button", { name: "Priority: Medium" }));
	await view.click(view.getByRole("menuitem", { name: "Lowest" }));
	await view.click(view.getByRole("button", { name: "Set assignee" }));
	await view.fill(view.getByRole("textbox", { name: "Search people" }), "Venn");
	await view.click(view.getByRole("option", { name: "Venn" }));
	await view.click(view.getByRole("button", { name: "Assignee: Venn" }));
	await view.click(view.getByRole("option", { name: "Unassigned" }));
	await view.click(view.getByRole("button", { name: "Set assignee" }));
	await view.press(view.getByRole("textbox", { name: "Search people" }), "Escape");
	assert.equal(view.queryByRole("textbox", { name: "Work item summary" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Set assignee" }));
	await view.click(view.getByRole("option", { name: "Venn" }));
	await view.click(view.getByRole("button", { name: "Set due date" }));
	const today = new Date();
	const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
	await view.click(document.querySelector(`button[data-day="${dueDate}"]`));
	await view.click(view.getByRole("button", { name: `Due date: ${dueDate}` }));
	await view.click(view.getByRole("button", { name: "Clear date" }));
	await view.click(view.getByRole("button", { name: "Set due date" }));
	await view.click(document.querySelector(`button[data-day="${dueDate}"]`));
	await view.click(view.getByRole("button", { name: "Save work item" }));
	const saved = JSON.parse(view.container.querySelector("output").textContent);
	assert.deepEqual(saved, { summary: "New work", issueType: "story", subtaskKeys: ["PAY-2"], tags: ["checkout", "new tag"], parentIssueKey: "PAY-1", priority: "trivial", assignee: { id: "venn", name: "Venn" }, dueDate });
});

