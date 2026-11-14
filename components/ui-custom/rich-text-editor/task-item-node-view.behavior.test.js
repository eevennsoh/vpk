// Pressing a task-list checkbox must not move the caret out of the editor (TipTap's own
// TaskItem cancels the mousedown). The checkbox itself cancels it, so the keyboard path —
// Tab to the checkbox, Space to toggle — is the only other way in.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const TIPTAP_MOCK = `
export function NodeViewWrapper({ as: Tag = "div", children, ...props }) {
	return <Tag {...props}>{children}</Tag>;
}
export function NodeViewContent({ as: Tag = "div" }) {
	return <Tag />;
}
`;

async function renderTaskItem({ checked = false } = {}) {
	const updates = [];
	const view = await renderComponent({
		entry: "components/ui-custom/rich-text-editor/task-item-node-view.tsx",
		exportName: "RichTextTaskItemNodeView",
		mocks: { "@tiptap/react": TIPTAP_MOCK },
		props: {
			editor: { isEditable: true },
			extension: { options: {} },
			node: { attrs: { checked }, textContent: "Ship it" },
			updateAttributes: (attrs) => updates.push(attrs),
		},
	});
	return { checkbox: view.getByRole("checkbox", { name: "Task item checkbox for Ship it" }), updates, view };
}

test("a mousedown on the checkbox is cancelled so the editor keeps its selection", async () => {
	const { checkbox } = await renderTaskItem();
	const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });

	checkbox.dispatchEvent(mousedown);

	assert.equal(mousedown.defaultPrevented, true);
});

test("the checkbox is reachable by Tab and Space toggles it", async () => {
	const { checkbox, updates, view } = await renderTaskItem();

	assert.deepEqual(view.tabOrder(), ["Task item checkbox for Ship it"]);
	await view.focus(checkbox);
	await view.press(checkbox, " ");

	assert.deepEqual(updates, [{ checked: true }]);
});
