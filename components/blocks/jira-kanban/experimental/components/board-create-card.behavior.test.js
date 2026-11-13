const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

test("inline creation saves a work item and Escape cancels", async () => {
	const view = await renderComponent({
		source: `
			import { useState } from "react";
			import { BoardCreateCard } from "@/components/blocks/jira-kanban/experimental/components/board-create-card";
			export default function Fixture() {
				const [created, setCreated] = useState("");
				const [open, setOpen] = useState(false);
				return <div><button onClick={() => setOpen(true)}>Create work item in To do</button>{open ? <BoardCreateCard columns={[]} issueKey="PAY-1" onCancel={() => setOpen(false)} onSave={draft => { setCreated(draft.summary); setOpen(false); }} /> : null}<output>{created}</output></div>;
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

test("inline creation preserves parent, tags, subtasks and footer choices", async () => {
	const view = await renderComponent({
		source: `
			import { useState } from "react";
			import { BoardCreateCard } from "@/components/blocks/jira-kanban/experimental/components/board-create-card";
			const columns = [{ title: "To do", count: 2, cards: [
				{ code: "PAY-1", title: "Parent item", issueType: "epic", priority: "medium", tags: [{ text: "checkout", color: "standard" }], assignee: { id: "venn", name: "Venn" } },
				{ code: "PAY-2", title: "Child item", parentIssueKey: "PAY-1", priority: "medium", tags: [] },
			] }];
			export default function Fixture() {
				const [saved, setSaved] = useState("");
				return <><BoardCreateCard columns={columns} issueKey="PAY-3" onCancel={() => {}} onSave={draft => setSaved(JSON.stringify(draft))} /><output>{saved}</output></>;
			}
		`,
	});
	await view.fill(view.getByRole("textbox", { name: "Work item summary" }), "New work");
	await view.click(view.getByRole("button", { name: "Work item type: task" }));
	await view.click(view.getByRole("menuitem", { name: "Story" }));
	await view.click(view.getByRole("button", { name: "Add subtasks" }));
	await view.click(view.getByRole("checkbox", { name: "PAY-2 Child item" }));
	await view.click(view.getByRole("checkbox", { name: "PAY-2 Child item" }));
	assert.equal(view.queryByRole("button", { name: "Add subtasks" }) !== null, true);
	await view.click(view.getByRole("checkbox", { name: "PAY-2 Child item" }));
	await view.click(view.getByRole("button", { name: "Add tags" }));
	await view.click(view.getByRole("checkbox", { name: "checkout" }));
	await view.click(view.getByRole("checkbox", { name: "checkout" }));
	await view.click(view.getByRole("checkbox", { name: "checkout" }));
	await view.fill(view.getByRole("textbox", { name: "Add tag" }), "new tag");
	await view.press(view.getByRole("textbox", { name: "Add tag" }), "Enter");
	await view.click(view.getByRole("button", { name: "Add parent" }));
	await view.click(view.getByRole("radio", { name: "PAY-1 Parent item" }));
	await view.click(view.getByRole("button", { name: "Parent, PAY-1 Parent item" }));
	await view.click(view.getByRole("button", { name: "Remove parent" }));
	await view.click(view.getByRole("button", { name: "Add parent" }));
	await view.click(view.getByRole("radio", { name: "PAY-1 Parent item" }));
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

test("creating a board item commits its metadata and reparents selected subtasks", () => {
	const { appendBoardCardFromDraft, indexBoardSubtasks } = require("../lib/board-work-item-options.ts");
	const columns = [{ title: "To do", count: 2, cards: [
		{ code: "PAY-1", title: "Parent", priority: "medium", tags: [] },
		{ code: "PAY-2", title: "Child", priority: "medium", tags: [], parentIssueKey: "PAY-1" },
	] }, { title: "Done", count: 0, cards: [] }];
	const result = appendBoardCardFromDraft(columns, { summary: "New work", issueType: "story", tags: ["checkout"], parentIssueKey: "PAY-1", subtaskKeys: ["PAY-2"], priority: "major", dueDate: "2026-12-01", assignee: { id: "venn", name: "Venn" } }, "To do");
	assert.equal(result.issueKey, "PAY-3");
	assert.equal(result.columns[1], columns[1]);
	assert.equal(result.columns[0].cards[1].parentIssueKey, "PAY-3");
	const created = result.columns[0].cards[2];
	assert.equal(created.parentIssueKey, "PAY-1");
	assert.deepEqual(created.tags, [{ text: "checkout", color: "standard" }]);
	assert.equal(created.issueType, "story");
	assert.equal(created.priority, "major");
	assert.equal(created.dueDate, "2026-12-01");
	assert.equal(created.assignee.name, "Venn");
	assert.equal(created.avatarUnassignedKind, undefined);
	const children = indexBoardSubtasks(result.columns).get("PAY-3");
	assert.deepEqual(children.map((item) => item.subtask.issueKey), ["PAY-2"]);
	assert.equal(children[0].subtask.status, "To do");
	const { butterRelatedCatalog } = require(process.cwd() + "/components/projects/butter-v1/data/related-scope.ts");
	const lowest = appendBoardCardFromDraft(columns, { summary: "Lowest", issueType: "task", priority: "trivial" }, "To do");
	assert.equal(butterRelatedCatalog(lowest.columns).find((item) => item.summary === "Lowest").priority, "Lowest");
});
