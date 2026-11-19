// Open in Chat as a consumer renders it: an outline trigger with the shared trailing chevron, and
// provider rows built from the dropdown menu's own slots (brand icon before, external-link glyph
// after) on a link that keeps the menu row's text colour instead of the global link styling.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import {
	OpenIn,
	OpenInChatGPT,
	OpenInClaude,
	OpenInContent,
	OpenInLabel,
	OpenInSeparator,
	OpenInTrigger,
} from "@/components/ui-custom/open-in-chat";

export default function Probe({ open = false }) {
	return (
		<OpenIn open={open} query="What is TypeScript?">
			<OpenInTrigger />
			<OpenInContent>
				<OpenInLabel>AI Assistants</OpenInLabel>
				<OpenInSeparator />
				<OpenInChatGPT />
				<OpenInClaude />
			</OpenInContent>
		</OpenIn>
	);
}
`;

test("the trigger is an outline button with the shared trailing chevron", async () => {
	const view = await renderComponent({ source: PROBE });
	const trigger = view.getByRole("button");
	assert.equal(accessibleName(trigger), "Open in chat");
	assert.equal(trigger.getAttribute("data-variant"), "outline");
	assert.ok(trigger.querySelector('[data-icon="inline-end"]'), "chevron sits in the button's inline-end icon slot");
	await view.unmount();
});

test("provider rows are menu-item links laid out with the dropdown menu slots", async () => {
	const view = await renderComponent({ props: { open: true }, source: PROBE });
	const rows = [...document.querySelectorAll("[data-slot=dropdown-menu-item]")];
	assert.deepEqual(rows.map((row) => row.tagName), ["A", "A"]);
	assert.deepEqual(rows.map((row) => accessibleName(row)), ["Open in ChatGPT", "Open in Claude"]);

	const [chatgpt] = rows;
	assert.equal(chatgpt.getAttribute("target"), "_blank");
	assert.match(chatgpt.getAttribute("href"), /^https:\/\/chatgpt\.com\/\?.*prompt=What\+is\+TypeScript%3F/u);
	// Each row is one horizontal line: brand icon slot, label, then the trailing external-link glyph.
	assert.equal(chatgpt.children.length, 3);
	assert.ok(chatgpt.children[0].querySelector("svg"), "brand icon is in the leading slot");
	assert.equal(chatgpt.children[1].textContent, "Open in ChatGPT");
	assert.match(chatgpt.children[2].className, /\bml-auto\b/u);
	// A link row keeps the row's text colour, not the global link blue and hover underline.
	assert.match(chatgpt.className, /\btext-text\b/u);
	assert.match(chatgpt.className, /\bhover:no-underline\b/u);
	await view.unmount();
});
