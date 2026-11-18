// The Jira Dragging playground reorders cards by drag. Keyboard and screen-reader users get the
// same within-column reorder from each card's More actions menu, committed by the drop handler.
const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

// Chat surfaces the board can open import CSS modules, which this bundler does not load.
const mocks = {
	"@/components/projects/shared/components/chat-messages": "export function ChatMessages() { return null; } export function AwaitingUserResponseIndicator() { return null; }",
	"@/components/projects/sidebar-chat/components/chat-panel-conversation": "export function ChatPanelConversation() { return null; }",
};

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
const cardOrder = (view) => view.getAllByRole("button", { hidden: true, name: /^More actions for / }).map((button) => button.getAttribute("aria-label").replace("More actions for ", ""));

test("Move down in a Jira Dragging card's menu moves the card below its neighbour", async () => {
	const view = await renderComponent({
		mocks,
		source: `import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { JiraDragging } from "@/components/blocks/jira-dragging";
			export default function DraggingProbe() { return <ThemeWrapper><JiraDragging /></ThemeWrapper>; }`,
	});
	const [first, second, ...rest] = cardOrder(view);
	assert.equal(typeof second, "string", "the playground starts with at least two cards");

	await view.click(view.getByRole("button", { hidden: true, name: `More actions for ${first}` }));
	await settle();
	await view.click(view.getByRole("menuitem", { name: "Move down" }));
	await settle();

	assert.deepEqual(cardOrder(view), [second, first, ...rest]);
});
