// ChatScrollerItem is the one owner of the VPK chat-row override for MessageScrollerItem's default
// `content-visibility: auto`. Rendered inside a real MessageScroller so the primitive's attributes are the real ones.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const HARNESS = `
import { MessageScroller, MessageScrollerContent, MessageScrollerItem, MessageScrollerViewport } from "@/components/ui/message-scroller";
import { ChatScrollerItem } from "@/components/projects/shared/components/chat-scroller-item";

export default function Harness() {
	return (
		<MessageScroller>
			<MessageScrollerViewport>
				<MessageScrollerContent>
					<ChatScrollerItem messageId="turn-1" scrollAnchor className="w-full px-3" data-testid="chat-row">Turn</ChatScrollerItem>
					<ChatScrollerItem data-testid="indicator-row">Thinking</ChatScrollerItem>
					<MessageScrollerItem messageId="plain" data-testid="plain-row">Plain</MessageScrollerItem>
				</MessageScrollerContent>
			</MessageScrollerViewport>
		</MessageScroller>
	);
}
`;

function classTokens(view, testId) {
	return (view.container.querySelector(`[data-testid="${testId}"]`)?.getAttribute("class") ?? "").split(/\s+/u);
}

test("chat rows drop the item-level content-visibility while keeping caller classes", async () => {
	const view = await renderComponent({ source: HARNESS });

	for (const testId of ["chat-row", "indicator-row"]) {
		const tokens = classTokens(view, testId);
		assert.ok(tokens.includes("[content-visibility:visible]"), `${testId} opts out of containment`);
		assert.ok(!tokens.includes("[content-visibility:auto]"), `${testId} has no competing auto value`);
		assert.ok(tokens.includes("min-w-0") && tokens.includes("shrink-0"), `${testId} keeps the item base classes`);
	}
	assert.ok(classTokens(view, "chat-row").includes("w-full") && classTokens(view, "chat-row").includes("px-3"));
	assert.ok(classTokens(view, "plain-row").includes("[content-visibility:auto]"), "the ui primitive default is untouched");
});

test("chat rows keep the Message Scroller data contract", async () => {
	const view = await renderComponent({ source: HARNESS });
	const row = view.container.querySelector('[data-testid="chat-row"]');
	const indicator = view.container.querySelector('[data-testid="indicator-row"]');

	assert.equal(row?.getAttribute("data-slot"), "message-scroller-item");
	assert.equal(row?.getAttribute("data-message-id"), "turn-1");
	assert.equal(row?.getAttribute("data-scroll-anchor"), "true");
	assert.equal(indicator?.getAttribute("data-scroll-anchor"), "false");
	assert.equal(row?.textContent, "Turn");
});
