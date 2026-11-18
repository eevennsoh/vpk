// Cards on the Project Butter board (`/butter`) reorder by drag. A keyboard or screen-reader user
// gets the same within-column reorder from the card's More actions menu (Move up / Move down),
// and each move is announced through a polite live region.
const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const assignee = { id: "elena", name: "Elena" };
const card = (code, title) => ({ code, title, assignee, issueType: "task", priority: "medium", tags: [] });
const boardColumns = [
	{ title: "To do", count: 3, cards: [card("PAY-1", "First"), card("PAY-2", "Second"), card("PAY-3", "Third")] },
	{ title: "Done", count: 0, cards: [] },
];

// Chat surfaces the board can open import CSS modules, which this bundler does not load.
const mocks = {
	"@/components/projects/shared/components/chat-messages": "export function ChatMessages() { return null; } export function AwaitingUserResponseIndicator() { return null; }",
	"@/components/projects/sidebar-chat/components/chat-panel-conversation": "export function ChatPanelConversation() { return null; }",
};

async function renderBoard() {
	return renderComponent({
		mocks,
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import ExperimentalJiraKanbanPage from "@/components/blocks/jira-kanban/experimental/page";
			export default function BoardProbe({ initialColumns, ...props }) {
				const [columns, setColumns] = React.useState(initialColumns);
				return <ThemeWrapper><ExperimentalJiraKanbanPage {...props} boardColumns={columns} onBoardColumnsChange={setColumns} /></ThemeWrapper>;
			}`,
		props: { initialColumns: boardColumns, cardAppearance: "project-butter", headerAssignees: [assignee], insightsEnabled: false, issueSelectionAppearance: "fused-backdrop" },
	});
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
const columnOrder = (view) => view.getAllByRole("button", { hidden: true, name: /^More actions for / }).map((button) => button.getAttribute("aria-label").replace("More actions for ", ""));
const liveRegionText = (view) => [...view.container.ownerDocument.querySelectorAll("[aria-live=polite]")].map((region) => region.textContent).join(" ");

async function chooseMenuItem(view, cardCode, name) {
	const trigger = view.getByRole("button", { hidden: true, name: `More actions for ${cardCode}` });
	await view.click(trigger);
	await settle();
	const item = view.getByRole("menuitem", { name });
	return item;
}

test("Move down in a card's menu moves it below its neighbour and announces the new position", async () => {
	const view = await renderBoard();
	assert.deepEqual(columnOrder(view), ["PAY-1", "PAY-2", "PAY-3"]);

	await view.click(await chooseMenuItem(view, "PAY-1", "Move down"));
	await settle();

	assert.deepEqual(columnOrder(view), ["PAY-2", "PAY-1", "PAY-3"]);
	assert.equal(liveRegionText(view).includes("Moved PAY-1 to position 2 of 3 in To do."), true);
});

test("Move up in a card's menu moves it above its neighbour and announces the new position", async () => {
	const view = await renderBoard();

	await view.click(await chooseMenuItem(view, "PAY-3", "Move up"));
	await settle();

	assert.deepEqual(columnOrder(view), ["PAY-1", "PAY-3", "PAY-2"]);
	assert.equal(liveRegionText(view).includes("Moved PAY-3 to position 2 of 3 in To do."), true);
});

test("a card at the top of its column cannot move up, and the last card cannot move down", async () => {
	const view = await renderBoard();

	assert.equal((await chooseMenuItem(view, "PAY-1", "Move up")).getAttribute("aria-disabled"), "true");
	await view.press(null, "Escape");
	await settle();
	assert.equal((await chooseMenuItem(view, "PAY-3", "Move down")).getAttribute("aria-disabled"), "true");
});
