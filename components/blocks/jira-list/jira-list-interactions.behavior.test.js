const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const rows = [
	{ issueKey: "PAY-1", summary: "First item", issueType: "task", status: "To do", priority: "medium" },
	{ issueKey: "PAY-2", summary: "Second item", issueType: "task", status: "To do", priority: "medium" },
];

test("copying a work item link shows and clears feedback for that row", async () => {
	const copied = [];
	const props = { rows, onCopyLink: (row) => copied.push(row.issueKey) };
	const view = await renderComponent({
		entry: "components/blocks/jira-list/index.tsx",
		exportName: "JiraList",
		props,
	});
	await view.click(view.getByRole("button", { name: "Copy link for PAY-1" }));
	assert.deepEqual(copied, ["PAY-1"]);
	await view.rerender({ ...props, copiedIssueKey: "PAY-1" });
	assert.equal(Boolean(view.getByRole("button", { name: "Copied link for PAY-1" })), true);
	assert.equal(Boolean(view.getByRole("button", { name: "Copy link for PAY-2" })), true);
	await view.rerender({ ...props, copiedIssueKey: null });
	assert.equal(Boolean(view.getByRole("button", { name: "Copy link for PAY-1" })), true);
	await view.unmount();
});

test("an active work item does not select its checkbox", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-list/index.tsx",
		exportName: "JiraList",
		props: { activeIssueKey: "PAY-1", rows, selectedIssueKeys: new Set(["PAY-2"]) },
	});
	const first = view.getByRole("checkbox", { name: "Select PAY-1" });
	const second = view.getByRole("checkbox", { name: "Select PAY-2" });
	assert.equal(first.getAttribute("aria-checked"), "false");
	assert.equal(second.getAttribute("aria-checked"), "true");
	assert.equal(first.closest("tr").getAttribute("aria-selected"), "true");
	await view.unmount();
});

test("selection controls precede hierarchy controls and leave the issue type visible", async () => {
	const changes = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-list/index.tsx",
		exportName: "JiraList",
		props: {
			rows: [{ ...rows[0], hasChildren: true }],
			hierarchyExpansion: { allExpanded: false, disabled: false, onToggleAll() {} },
			onSelectRow: (key, checked) => changes.push([key, checked]),
			onToggleExpand() {},
		},
	});
	const checkbox = view.getByRole("checkbox", { name: "Select PAY-1" });
	const expand = view.getByRole("button", { name: "Expand PAY-1" });
	const headerCheckbox = view.getByRole("checkbox", { name: "Select all work items" });
	const expandAll = view.getByRole("button", { name: "Expand all subtasks" });
	assert.equal(Boolean(checkbox.compareDocumentPosition(expand) & Node.DOCUMENT_POSITION_FOLLOWING), true);
	assert.equal(Boolean(headerCheckbox.compareDocumentPosition(expandAll) & Node.DOCUMENT_POSITION_FOLLOWING), true);
	assert.equal(Boolean(view.getByRole("img", { name: "task" })), true);
	await view.click(checkbox);
	assert.deepEqual(changes, [["PAY-1", true]]);
	assert.equal(Boolean(view.getByRole("img", { name: "task" })), true);
	await view.unmount();
});

test("summary editing isolates other rows and saves or cancels the draft", async () => {
	const changes = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-list/index.tsx",
		exportName: "JiraList",
		props: { rows, onSummaryChange: (key, value) => changes.push([key, value]) },
	});
	const tableRows = Array.from(view.container.querySelectorAll("tbody tr"));
	const cells = Array.from(tableRows[0].cells);
	await view.click(view.getByRole("button", { name: "Edit summary for PAY-1: First item" }));
	assert.equal(tableRows[0].cells.length, cells.length);
	assert.equal(cells.every((cell) => cell.isConnected), true);
	assert.equal(Array.from(tableRows[0].cells).slice(2).every((cell) => cell.inert), true);
	assert.equal(view.container.querySelectorAll("tbody tr[inert]").length, 1);
	const input = view.getByRole("textbox", { name: "Summary for PAY-1" });
	await view.fill(input, "Updated item");
	await view.press(input, "Enter");
	assert.deepEqual(changes, [["PAY-1", "Updated item"]]);
	assert.equal(view.container.querySelectorAll("tbody tr[inert]").length, 0);
	await view.click(view.getByRole("button", { name: "Edit summary for PAY-1: First item" }));
	const cancelled = view.getByRole("textbox", { name: "Summary for PAY-1" });
	await view.fill(cancelled, "Discard this");
	await view.press(cancelled, "Escape");
	assert.deepEqual(changes, [["PAY-1", "Updated item"]]);
	const outside = document.createElement("button");
	let outsideClicks = 0;
	outside.addEventListener("click", () => outsideClicks++);
	document.body.appendChild(outside);
	await view.click(view.getByRole("button", { name: "Edit summary for PAY-1: First item" }));
	await view.click(outside);
	assert.equal(outsideClicks, 0);
	assert.equal(view.container.querySelector('[aria-label="Summary for PAY-1"]') === null, true);
	outside.remove();
});

test("point controls accept estimates and never step below zero", async () => {
	const changes = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-list/jira-list-points-cell.tsx",
		exportName: "JiraListPointsCell",
		props: { issueKey: "PAY-1", onChange: (value) => changes.push(value) },
	});
	await view.click(view.getByRole("button", { name: "Edit story points for PAY-1, no estimate" }));
	const input = view.container.querySelector('input[type="number"]');
	await view.fill(input, "3");
	await view.press(input, "Enter");
	assert.deepEqual(changes, [3]);
	await view.rerender({ issueKey: "PAY-1", points: 3, onChange: (value) => changes.push(value) });
	await view.click(view.getByRole("button", { name: "Increase story points for PAY-1" }));
	assert.deepEqual(changes, [3, 4]);
	await view.rerender({ issueKey: "PAY-1", points: 0, onChange: (value) => changes.push(value) });
	assert.equal(view.getByRole("button", { name: "Decrease story points for PAY-1" }).disabled, true);
});


test("Butter list uses the card agent picker to start a session", async () => {
	const assigned = [];
	const view = await renderComponent({
		entry: "components/projects/butter/components/butter-list-agent-cell.tsx",
		exportName: "ButterListAgentCell",
		props: {
			agentCatalog: [{ id: "claude", name: "Claude", byline: "Coding agent" }],
			onAssignedAgentIdsChange: (key, ids) => assigned.push([key, ids]),
			row: rows[0],
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PAY-1" }));
	await view.click(view.getByRole("option", { name: /Claude/u }));
	assert.deepEqual(assigned, [["PAY-1", ["claude"]]]);
});

test("Butter list forwards agent directory actions to the picker", async () => {
	const actions = [];
	const view = await renderComponent({
		entry: "components/projects/butter/components/butter-list-agent-cell.tsx",
		exportName: "ButterListAgentCell",
		props: {
			agentCatalog: [{ id: "claude", name: "Claude", byline: "Coding agent" }],
			onAssignedAgentIdsChange() {},
			onBrowseAgents: () => actions.push("browse"),
			onCreateAgent: () => actions.push("create"),
			row: rows[0],
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PAY-1" }));
	await view.click(view.getByRole("button", { name: "Browse agents" }));
	assert.deepEqual(actions, ["browse"]);
	await view.click(view.getByRole("button", { name: "Add agent to PAY-1" }));
	await view.click(view.getByRole("button", { name: "Create agent" }));
	assert.deepEqual(actions, ["browse", "create"]);
});

test("Butter list session menu hands Add agent to the shared picker", async () => {
	const assigned = [];
	const view = await renderComponent({
		entry: "components/projects/butter/components/butter-list-agent-cell.tsx",
		exportName: "ButterListAgentCell",
		props: {
			agentCatalog: [{ id: "claude", name: "Claude", byline: "" }, { id: "figma", name: "Figma", byline: "" }],
			onAssignedAgentIdsChange: (key, ids) => assigned.push([key, ids]),
			row: { ...rows[0], agentSessions: [{ id: "claude", name: "Claude", statusKind: "working", statusLabel: "Working" }] },
		},
	});
	await view.click(view.getByRole("button", { name: "Edit agents" }));
	await view.click(view.getByRole("button", { name: "Assign agent" }));
	assert.equal(view.getByRole("dialog", { name: "Agents" }) !== null, true);
	await view.click(view.getByRole("option", { name: /Figma/u }));
	assert.deepEqual(assigned, [["PAY-1", ["claude", "figma"]]]);
});

test("assigned list sessions forward agent directory actions", async () => {
	const actions = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-list/jira-list-cells.tsx",
		exportName: "JiraListAgentSessionsCell",
		props: {
			agentCatalog: [{ id: "claude", name: "Claude", byline: "Coding agent" }],
			agentSessions: [{ id: "claude", name: "Claude", statusKind: "working", statusLabel: "Working" }],
			onAssignedAgentIdsChange() {},
			onBrowseAgents: () => actions.push("browse"),
			onCreateAgent: () => actions.push("create"),
		},
	});
	await view.click(view.getByRole("button", { name: "Edit agents" }));
	await view.click(view.getByRole("button", { name: "Assign agent" }));
	await view.click(view.getByRole("button", { name: "Browse agents" }));
	assert.deepEqual(actions, ["browse"]);
});

test("starting a list session moves focus to its activity", async () => {
	const view = await renderComponent({ source: `
		import { useState } from "react";
		import { ButterListAgentCell } from "@/components/projects/butter/components/butter-list-agent-cell";
		export default function Probe() {
			const [sessions, setSessions] = useState([]);
			return <ButterListAgentCell
				agentCatalog={[{ id: "claude", name: "Claude", byline: "Coding agent" }]}
				onAssignedAgentIdsChange={() => setSessions([{ id: "claude", name: "Claude", byline: "Coding agent", statusKind: "working", statusLabel: "Working" }])}
				row={{ issueKey: "PAY-1", summary: "First item", issueType: "task", status: "To do", priority: "medium", agentSessions: sessions }}
			/>;
		}
	` });
	await view.click(view.getByRole("button", { name: "Add agent to PAY-1" }));
	await view.click(view.getByRole("option", { name: /Claude/u }));
	await new Promise((resolve) => setTimeout(resolve, 40));
	assert.equal(view.isFocused(view.getByRole("button", { name: "Claude: Working" })), true);
});

test("Jira List preview uses Butter data and restores edits on refresh", async () => {
	const view = await renderComponent({ entry: "components/website/demos/blocks/jira-list-demo.tsx" });
	assert.equal(Boolean(view.getByRole("button", { name: "Add agent to PAY-118" })), true);
	assert.equal(Boolean(view.getByRole("button", { name: "Edit story points for PAY-118, no estimate" })), true);
	await view.click(view.getByRole("button", { name: /Edit summary for PAY-118:/u }));
	const summary = view.getByRole("textbox", { name: "Summary for PAY-118" });
	await view.fill(summary, "Updated preview item");
	await view.press(summary, "Enter");
	assert.equal(view.container.textContent.includes("Updated preview item"), true);
	await view.click(view.getByRole("button", { name: "Refresh work items" }));
	assert.equal(view.container.textContent.includes("Updated preview item"), false);
	assert.equal(view.container.textContent.includes("Carry card-artwork metadata"), true);
});
