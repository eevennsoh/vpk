const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../../scripts/lib/render-component.js");

const assignees = [{ id: "elena", name: "Elena" }, { id: "venn", name: "Venn" }];
const columns = [{ title: "To do", count: 2, cards: [
	{ code: "PAY-1", title: "First", assignee: assignees[0], issueType: "task", priority: "medium", tags: [] },
	{ code: "PAY-2", title: "Second", assignee: assignees[1], issueType: "bug", priority: "medium", tags: [] },
] }];
const mocks = {
	"@/components/blocks/jira-kanban/experimental/experimental-jira-kanban": `export function ExperimentalJiraKanban({ boardColumns }) { return <output data-testid="visible-cards">{boardColumns.flatMap(column => column.cards.map(card => card.code)).join(",")}</output>; }`,
	"@/components/blocks/jira-kanban/experimental-v2/experimental-v2-jira-kanban": `export function ExperimentalV2JiraKanban({ boardColumns, onCardSelect, selectedCardCodes }) { return <><button onClick={() => onCardSelect("PAY-1", "To do", 0, { source: "selection-control", shiftKey: false, metaOrCtrlKey: false })}>Select first card</button><output data-testid="selected-cards">{[...selectedCardCodes].join(",")}</output><output data-testid="visible-cards">{boardColumns.flatMap(column => column.cards.map(card => card.code)).join(",")}</output></>; }`,
	"@/components/blocks/jira-kanban/experimental/pulse/experimental-pulse": `export function ExperimentalPulse() { return <div>Insights opened</div>; }`,
};

for (const variant of ["experimental", "experimental-v2"]) {
	const entry = `components/blocks/jira-kanban/${variant}/page.tsx`;
	const props = { boardColumns: columns, headerAssignees: assignees, insightsDefaultAssigneeIds: ["venn"] };
	test(`${variant} supplies Status and Work type options and filters its cards`, async () => {
		const view = await renderComponent({ entry, mocks, props: { ...props, insightsEnabled: false } });
		if (variant === "experimental-v2") {
			await view.click(view.getByRole("button", { name: "Select first card" }));
			assert.equal(view.container.querySelector('[data-testid="selected-cards"]').textContent, "PAY-1");
		}
		await view.click(view.getByRole("button", { name: "Filter board" }));
		await view.press(view.getByRole("menuitem", { name: "Status" }), "ArrowRight");
		assert.equal(view.getByRole("menuitemcheckbox", { name: "To do" }).textContent.includes("To do"), true);
		await view.press(view.getByRole("menuitemcheckbox", { name: "To do" }), "Escape");
		await view.press(view.getByRole("menuitem", { name: "Work type" }), "ArrowRight");
		await view.click(view.getByRole("menuitemcheckbox", { name: "Bug" }));
		assert.equal(view.container.querySelector('[data-testid="visible-cards"]').textContent, "PAY-2");
		if (variant === "experimental-v2") assert.equal(view.container.querySelector('[data-testid="selected-cards"]').textContent, "");
		await view.unmount();
	});

	for (const operator of ["=", "!="]) {
		test(`${variant} preserves an incoming assignee ${operator} condition when a query opens Insights`, async () => {
			const view = await renderComponent({ entry, mocks, props });
			await view.click(view.getByRole("button", { name: "Filter board" }));
			await view.press(view.getByRole("menuitem", { name: "JQL" }), "ArrowRight");
			const scope = operator === "=" ? 'epic = "epic-pay-90"' : 'sprint = "sprint-24"';
			await view.fill(view.getByRole("textbox", { name: "JQL query" }), `assignee ${operator} "elena" AND ${scope}`);
			await view.click(view.getByRole("button", { name: "Apply" }));
			assert.equal(view.getByText("Insights opened").textContent, "Insights opened");
			await view.click(view.getByRole("button", { name: "Filter board (2)" }));
			await view.click(view.getByRole("button", { name: "Filter board (2)" }));
			await view.press(view.getByRole("menuitem", { name: "JQL" }), "ArrowRight");
			assert.equal(view.getByRole("textbox", { name: "JQL query" }).value.includes(`assignee ${operator} "elena"`), true);
			await view.unmount();
		});
	}

	test(`${variant} still applies the Insights default for a scope-only query`, async () => {
		const view = await renderComponent({ entry, mocks, props });
		await view.click(view.getByRole("button", { name: "Filter board" }));
		await view.press(view.getByRole("menuitem", { name: "JQL" }), "ArrowRight");
		await view.fill(view.getByRole("textbox", { name: "JQL query" }), 'epic = "epic-pay-90"');
		await view.click(view.getByRole("button", { name: "Apply" }));
		assert.equal(view.getByText("Insights opened").textContent, "Insights opened");
		await view.click(view.getByRole("button", { name: "Filter board (2)" }));
		await view.click(view.getByRole("button", { name: "Filter board (2)" }));
		await view.press(view.getByRole("menuitem", { name: "JQL" }), "ArrowRight");
		assert.equal(view.getByRole("textbox", { name: "JQL query" }).value.includes('assignee = "venn"'), true);
		await view.unmount();
	});
}
