const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

const source = `
	import { useState } from "react";
	import { useButterList } from "@/components/projects/butter-v1/hooks/use-butter-list";

	const columns = [{ title: "To do", count: 5, cards: [
		{ code: "PAY-113", title: "First parent", priority: "medium", tags: [] },
		{ code: "PAY-2", title: "Nested parent", priority: "medium", tags: [], parentIssueKey: "PAY-113" },
		{ code: "PAY-3", title: "Nested child", priority: "medium", tags: [], parentIssueKey: "PAY-2" },
		{ code: "PAY-4", title: "Second parent", priority: "medium", tags: [] },
		{ code: "PAY-5", title: "Second child", priority: "medium", tags: [], parentIssueKey: "PAY-4" },
	] }];

	export default function Probe() {
		const [boardColumns, setBoardColumns] = useState(columns);
		const { getProps } = useButterList({ boardColumns, setBoardColumns });
		const { hierarchyExpansion, onToggleExpand, rows } = getProps(boardColumns);
		return <>
			<button onClick={hierarchyExpansion.onToggleAll}>
				{hierarchyExpansion.allExpanded ? "Collapse all" : "Expand all"}
			</button>
			<button onClick={() => onToggleExpand("PAY-4")}>Toggle second parent</button>
			<output>{JSON.stringify(rows.map((row) => row.issueKey))}</output>
		</>;
	}
`;

test("expand all includes nested parents and restores partially collapsed hierarchies", async () => {
	const view = await renderComponent({ source });
	const visibleKeys = () => JSON.parse(view.container.querySelector("output").textContent);
	assert.deepEqual(visibleKeys(), ["PAY-113", "PAY-4"]);
	await view.click(view.getByRole("button", { name: "Expand all" }));
	assert.deepEqual(visibleKeys(), ["PAY-113", "PAY-2", "PAY-3", "PAY-4", "PAY-5"]);
	await view.click(view.getByRole("button", { name: "Toggle second parent" }));
	assert.deepEqual(visibleKeys(), ["PAY-113", "PAY-2", "PAY-3", "PAY-4"]);
	await view.click(view.getByRole("button", { name: "Expand all" }));
	assert.deepEqual(visibleKeys(), ["PAY-113", "PAY-2", "PAY-3", "PAY-4", "PAY-5"]);
	await view.click(view.getByRole("button", { name: "Collapse all" }));
	assert.deepEqual(visibleKeys(), ["PAY-113", "PAY-4"]);
	await view.unmount();
});

test("starting an agent keeps the list order while advancing its status", async () => {
	const view = await renderComponent({ source: `
		import { useState } from "react";
		import { useButterList } from "@/components/projects/butter-v1/hooks/use-butter-list";
		const initial = [
			{ title: "To do", count: 2, cards: [
				{ code: "PAY-1", title: "First", priority: "medium", tags: [] },
				{ code: "PAY-2", title: "Second", priority: "medium", tags: [] },
			] },
			{ title: "In progress", count: 1, cards: [{ code: "PAY-3", title: "Third", priority: "medium", tags: [] }] },
		];
		export default function Probe() {
			const [boardColumns, setBoardColumns] = useState(initial);
			const { getProps, onAssignedAgentIdsChange } = useButterList({ boardColumns, setBoardColumns });
			const { rows } = getProps(boardColumns);
			return <><button onClick={() => onAssignedAgentIdsChange("PAY-1", ["claude-code"])}>Start agent</button><output>{JSON.stringify(rows.map(({ issueKey, status }) => [issueKey, status]))}</output></>;
		}
	` });
	await view.click(view.getByRole("button", { name: "Start agent" }));
	assert.deepEqual(JSON.parse(view.container.querySelector("output").textContent), [["PAY-1", "In progress"], ["PAY-2", "To do"], ["PAY-3", "In progress"]]);
	await view.unmount();
});
