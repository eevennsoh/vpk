const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../../scripts/lib/render-component.js");

const source = `
	import { useState } from "react";
	import { BoardFilterPopover } from "@/components/blocks/jira-kanban/experimental/components/board-filter-popover";
	import { useBoardFilter } from "@/components/blocks/jira-kanban/experimental/hooks/use-board-filter";
	import { filterBoardByJiraConditions } from "@/components/blocks/jira-kanban/experimental/lib/board-jira-filter";
	const assignees = [{ id: "venn", name: "Venn" }, { id: "priya", name: "Priya" }];
	const columns = [{ title: "To do", count: 2, cards: [
		{ code: "PAY-1", title: "First", assignee: assignees[0], priority: "medium", tags: [] },
		{ code: "PAY-2", title: "Second", assignee: assignees[1], priority: "medium", tags: [], agentActivities: [{ id: "a", state: "awaiting-input" }] },
	]}];
	export default function Probe() {
		const [scope, setScope] = useState("payments");
		const filter = useBoardFilter({ scopeKey: scope });
		return <>
			<BoardFilterPopover {...filter} assignees={assignees} columns={columns} compact />
			<button onClick={() => filter.actions.setAssigneeIds(new Set(["venn"]))}>Select Venn avatar</button>
			<button onClick={() => setScope(scope === "payments" ? "website" : "payments")}>Switch dataset</button>
			<output>{JSON.stringify({ conditions: filter.model.conditions, selected: [...filter.selectedAssigneeIds], cards: filterBoardByJiraConditions(columns, filter.model.conditions).flatMap(c => c.cards.map(c => c.code)) })}</output>
		</>;
	}
`;

test("the board uses Butter pinned filters and clears the cards through the shared control", async () => {
	const view = await renderComponent({ source });
	await view.click(view.getByRole("button", { name: "Filter board" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Needs input" }));
	assert.deepEqual(JSON.parse(view.container.querySelector("output").textContent).cards, ["PAY-2"]);
	await view.click(view.getByRole("menuitem", { name: "Clear all" }));
	assert.deepEqual(JSON.parse(view.container.querySelector("output").textContent).cards, ["PAY-1", "PAY-2"]);
	await view.unmount();
});

test("avatar selections are shared with the filter and restored per dataset", async () => {
	const view = await renderComponent({ source });
	await view.click(view.getByRole("button", { name: "Select Venn avatar" }));
	await view.click(view.getByRole("button", { name: "Filter board (1)" }));
	await view.press(view.getByRole("menuitem", { name: "Assignee (1)" }), "ArrowRight");
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Venn" }).getAttribute("aria-checked"), "true");
	await view.click(view.getByRole("menuitemcheckbox", { name: "Priya" }));
	assert.deepEqual(JSON.parse(view.container.querySelector("output").textContent).selected, ["venn", "priya"]);
	await view.click(view.getByRole("button", { name: "Switch dataset" }));
	assert.deepEqual(JSON.parse(view.container.querySelector("output").textContent).selected, []);
	await view.click(view.getByRole("button", { name: "Switch dataset" }));
	assert.deepEqual(JSON.parse(view.container.querySelector("output").textContent).selected, ["venn", "priya"]);
	await view.unmount();
});

test("board JQL applies exclusions and combines conditions against the actual cards", async () => {
	const view = await renderComponent({ source });
	await view.click(view.getByRole("button", { name: "Filter board" }));
	await view.press(view.getByRole("menuitem", { name: "JQL" }), "ArrowRight");
	await view.fill(view.getByRole("textbox", { name: "JQL query" }), 'assignee != "venn" AND label = "no-label"');
	await view.click(view.getByRole("button", { name: "Apply" }));
	assert.deepEqual(JSON.parse(view.container.querySelector("output").textContent).cards, ["PAY-2"]);
	await view.unmount();
});

test("scope options retain both the parent name and work item key", async () => {
	const view = await renderComponent({ source });
	await view.click(view.getByRole("button", { name: "Filter board" }));
	await view.press(view.getByRole("menuitem", { name: "Parent" }), "ArrowRight");
	await view.fill(view.getByRole("textbox", { name: "Search parent" }), "PAY-90");
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Retire LegacyGatewayAdapter (PAY-90)" }).textContent, "Retire LegacyGatewayAdapter");
	await view.unmount();
});

test("unassigned filter includes cards without an assignee even in presented columns", async () => {
	const view = await renderComponent({ source: `
		import { filterBoardByJiraConditions } from "@/components/blocks/jira-kanban/experimental/lib/board-jira-filter";
		export default function Probe() {
			const columns = [{ title: "To do", presenters: [{ id: "venn", name: "Venn" }], cards: [
				{ code: "unassigned", title: "Unassigned", tags: [] },
				{ code: "assigned", title: "Assigned", tags: [], assignee: { id: "venn", name: "Venn" } },
			] }];
			return <output>{filterBoardByJiraConditions(columns, [{ field: "assignee", operator: "is", values: ["unassigned"] }])[0].cards.map((card) => card.code).join(",")}</output>;
		}
	` });
	assert.equal(view.container.querySelector("output").textContent, "unassigned");
	await view.unmount();
});
