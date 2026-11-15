const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

for (const columnSizing of ["fill", "content"]) {
	for (const dropZoneLabel of [undefined, "Create work item"]) {
		test(`${columnSizing} column footer opens the same inline editor as its header (${dropZoneLabel ?? "no dropzone"})`, async () => {
			const view = await renderComponent({
				source: `
					import { useState } from "react";
					import { BoardColumn } from "@/components/blocks/jira-kanban/experimental/components/board-column";
					import { JiraInlineCreate } from "@/components/blocks/jira-inline-create";
					import { useBoardCreateCard } from "@/components/blocks/jira-kanban/experimental/hooks/use-board-create-card";
					import { resolveKanbanColumnChrome } from "@/components/blocks/jira-kanban/column-chrome";
					import { JiraDropzoneField } from "@/components/blocks/jira-dropzone/jira-dropzone-field";
					export default function Fixture() {
						const create = useBoardCreateCard();
						const [saved, setSaved] = useState("");
						return <JiraDropzoneField><BoardColumn title="To do" count={0} assignedAgentIds={[]} cardInsertion={null}
							chrome={resolveKanbanColumnChrome("default")} columnChrome="default" columnSizing="${columnSizing}"
							createWorkItemDropZoneLabel={${JSON.stringify(dropZoneLabel)}} sessionDragTransaction={null} onCollapse={() => {}}
							onStartCreate={trigger => create.start("To do", trigger)} creating={create.column === "To do"}
							createDraft={create.column === "To do" ? <JiraInlineCreate columns={[]} issueKey="PAY-1" onCancel={create.close} onSave={draft => { setSaved("To do: " + draft.summary); create.close(); }} /> : undefined}
						>{null}</BoardColumn><output>{saved}</output></JiraDropzoneField>;
					}
					`,
			});
			await view.click(view.getByRole("button", { name: "Create work item in To do" }));
			await view.press(view.getByRole("textbox", { name: "Work item summary" }), "Escape");
			assert.equal(view.queryByRole("textbox", { name: "Work item summary" }) === null, true);
			const footer = view.getByRole("button", { name: "Create in To do" });
			await view.click(footer);
			const summary = view.getByRole("textbox", { name: "Work item summary" });
			assert.equal(view.queryByRole("dialog") === null, true);
			assert.equal(footer.hasAttribute("aria-haspopup"), false);
			await view.fill(summary, "Footer task");
			await view.press(summary, "Enter");
			assert.equal(view.container.querySelector("output").textContent, "To do: Footer task");
			await view.press(footer, "Enter");
			await view.press(view.getByRole("textbox", { name: "Work item summary" }), "Escape");
			assert.equal(view.queryByRole("textbox", { name: "Work item summary" }) === null, true);
			await view.unmount();
		});
	}
}

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
