// The shared user turn: attachments, the prompt bubble, and the Copy/Edit prompt actions,
// rendered on the ui Message (align="end") with the VPK user bubble.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const ENTRY = "components/projects/shared/components/user-message-bubble.tsx";
const ATTACHMENTS = [
	{ type: "file", mediaType: "image/png", filename: "diagram.png", url: "https://example.com/diagram.png" },
	{ type: "file", mediaType: "application/pdf", filename: "brief.pdf", url: "https://example.com/brief.pdf" },
];

test("a user turn renders end-aligned with its attachments, bubble, and prompt actions", async () => {
	const view = await renderComponent({
		entry: ENTRY,
		exportName: "UserMessageBubble",
		props: { attachments: ATTACHMENTS, messageText: "Plain prompt", onEdit: () => {}, onStartEdit: () => {}, showPromptActions: true },
	});
	const message = view.container.querySelector('[data-slot="message"]');
	assert.equal(message?.getAttribute("data-align"), "end");
	assert.equal(view.container.querySelectorAll('[data-slot="attachment"]').length, 2);
	assert.equal(view.getByRole("img", { name: "diagram.png" }).getAttribute("src"), "https://example.com/diagram.png");
	assert.ok(view.container.querySelector('[data-slot="bubble"][data-align="end"]'), "prompt sits in an end-aligned bubble");
	assert.ok(view.getByRole("button", { name: "Copy" }));
	assert.ok(view.getByRole("button", { name: "Edit" }));
	await view.unmount();
});

test("editing swaps the bubble for the inline editor and hides the prompt actions", async () => {
	const view = await renderComponent({
		entry: ENTRY,
		exportName: "UserMessageBubble",
		props: { isEditing: true, messageText: "Plain prompt", onEdit: () => {}, onStartEdit: () => {}, showPromptActions: true },
	});
	assert.equal(view.container.querySelector('[data-slot="bubble"]'), null);
	assert.equal(view.queryByRole("button", { name: "Edit" }), null);
	await view.unmount();
});
