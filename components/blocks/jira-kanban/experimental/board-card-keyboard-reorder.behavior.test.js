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

// A host that reorders but does not remove cards, and renders a filtered view of its board: the
// board must still offer Move up / Move down (and no removal actions), each move placing only the
// chosen card relative to its rendered neighbours.
async function renderReorderOnlyBoard(hiddenCardCodes) {
	return renderComponent({
		mocks,
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ExperimentalJiraKanban } from "@/components/blocks/jira-kanban/experimental/experimental-jira-kanban";
			import { moveJiraKanbanCardsToDropTarget } from "@/components/blocks/jira-kanban/card-drop";
			export default function ReorderOnlyProbe({ initialColumns, hiddenCardCodes }) {
				const [columns, setColumns] = React.useState(initialColumns);
				const rendered = columns.map((column) => ({ ...column, cards: column.cards.filter((card) => !hiddenCardCodes.includes(card.code)) }));
				return (
					<ThemeWrapper>
						<output data-board-order="">{columns[0].cards.map((card) => card.code).join(" ")}</output>
						<ExperimentalJiraKanban boardColumns={rendered} onCardsReorder={(move) => setColumns((current) => moveJiraKanbanCardsToDropTarget(current, move.cardCodes, move.columnTitle, move.target))} />
					</ThemeWrapper>
				);
			}`,
		props: { initialColumns: [{ ...boardColumns[0], cards: [...boardColumns[0].cards, card("PAY-4", "Fourth")] }, boardColumns[1]], hiddenCardCodes },
	});
}
const boardOrder = (view) => view.container.ownerDocument.querySelector("[data-board-order]").textContent;
const menuItemNames = (view) => view.getAllByRole("menuitem").map((item) => item.textContent.trim());

test("a board with reorder but no removal callbacks offers Move up / Move down and no Archive or Delete", async () => {
	const view = await renderReorderOnlyBoard([]);

	await chooseMenuItem(view, "PAY-2", "Move down");
	const names = menuItemNames(view);
	assert.equal(names.includes("Move up") && names.includes("Move down"), true, `menu items: ${names.join(", ")}`);
	assert.equal(names.some((name) => ["Archive", "Delete"].includes(name)), false, `menu items: ${names.join(", ")}`);

	await view.click(view.getByRole("menuitem", { name: "Move down" }));
	await settle();
	assert.deepEqual(columnOrder(view), ["PAY-1", "PAY-3", "PAY-2", "PAY-4"]);
	assert.equal(boardOrder(view), "PAY-1 PAY-3 PAY-2 PAY-4");
});

test("in a filtered column, Move down and Move up step over the rendered neighbour and move only that card", async () => {
	// PAY-2 is filtered out: the column renders PAY-1, PAY-3, PAY-4.
	const view = await renderReorderOnlyBoard(["PAY-2"]);
	assert.deepEqual(columnOrder(view), ["PAY-1", "PAY-3", "PAY-4"]);

	await view.click(await chooseMenuItem(view, "PAY-1", "Move down"));
	await settle();
	assert.deepEqual(columnOrder(view), ["PAY-3", "PAY-1", "PAY-4"]);
	assert.equal(boardOrder(view), "PAY-2 PAY-3 PAY-1 PAY-4");
	assert.equal(liveRegionText(view).includes("Moved PAY-1 to position 2 of 3 in To do."), true);

	await view.click(await chooseMenuItem(view, "PAY-4", "Move up"));
	await settle();
	assert.deepEqual(columnOrder(view), ["PAY-3", "PAY-4", "PAY-1"]);
	assert.equal(boardOrder(view), "PAY-2 PAY-3 PAY-4 PAY-1");
});
