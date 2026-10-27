const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

const source = `
	import { useLayoutEffect, useState } from "react";
	import { useButterList } from "@/components/projects/butter/hooks/use-butter-list";

	const columns = [
		{ title: "To do", count: 2, cards: [
			{ code: "PAY-118", title: "First", priority: "medium", tags: [] },
			{ code: "PAY-107", title: "Second", priority: "medium", tags: [] },
		] },
		{ title: "In progress", count: 1, cards: [
			{ code: "PAY-101", title: "Third", priority: "medium", tags: [] },
		] },
	];

	export default function Probe() {
		const [boardColumns, setBoardColumns] = useState(columns);
		const list = useButterList({ boardColumns, setBoardColumns });
		const rows = list.getProps(boardColumns).rows;
		useLayoutEffect(() => list.onVisibleRowsChange(rows), [list.onVisibleRowsChange, rows]);

		const dropCohort = () => {
			list.createFromAgentSession({
				activity: { id: "session-a", name: "Claude", state: "complete" },
				insertion: { insertAtIndex: 1, position: "after", relativeToIssueKey: "PAY-118" },
				session: { id: "session-a", title: "First session" },
			});
			list.createFromAgentSession({
				activity: { id: "session-b", name: "Claude", state: "complete" },
				insertion: { insertAtIndex: 2, position: "after", relativeToIssueKey: "PAY-118" },
				session: { id: "session-b", title: "Second session" },
			});
		};

		return <>
			<button onClick={dropCohort}>Drop two sessions</button>
			<output>{JSON.stringify(rows.map((row) => ({
				assignedAgentIds: row.agentSessions?.map((agent) => agent.id) ?? [],
				issueKey: row.issueKey,
				summary: row.summary,
			})))}</output>
		</>;
	}
`;

test("a batched multi-session drop creates distinct adjacent rows in drag order", async () => {
	const view = await renderComponent({ source });
	assert.deepEqual(JSON.parse(view.container.querySelector("output").textContent).map((row) => row.issueKey), [
		"PAY-118",
		"PAY-107",
		"PAY-101",
	]);

	await view.click(view.getByRole("button", { name: "Drop two sessions" }));

	const rows = JSON.parse(view.container.querySelector("output").textContent);
	assert.deepEqual(rows.map((row) => row.issueKey), [
		"PAY-118",
		"PAY-119",
		"PAY-120",
		"PAY-107",
		"PAY-101",
	]);
	assert.deepEqual(rows.slice(1, 3).map(({ issueKey, summary, assignedAgentIds }) => [
		issueKey,
		summary,
		assignedAgentIds,
	]), [
		["PAY-119", "First session", ["claude-code"]],
		["PAY-120", "Second session", ["claude-code"]],
	]);
	await view.unmount();
});
