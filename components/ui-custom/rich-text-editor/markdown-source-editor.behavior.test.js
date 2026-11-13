// MarkdownSourceEditor takes `ref` as a regular prop (React 19), not through forwardRef: the
// rich-text editor and the editor-toolbar demo pass `ref={textareaRef}` to focus and measure the
// textarea, so the ref must land on that textarea.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

test("a ref passed to MarkdownSourceEditor receives the editable textarea", async () => {
	let textarea = null;
	const view = await renderComponent({
		entry: "components/ui-custom/rich-text-editor/markdown-source-editor.tsx",
		exportName: "MarkdownSourceEditor",
		props: {
			"aria-label": "Markdown source",
			onValueChange: () => {},
			ref: (node) => { textarea = node; },
			value: "# Title",
		},
	});
	assert.equal(textarea?.tagName, "TEXTAREA");
	assert.equal(textarea?.value, "# Title");
	assert.equal(textarea?.getAttribute("aria-label"), "Markdown source");
	textarea.focus();
	assert.ok(view.isFocused(textarea), "focusing through the ref focuses the textarea");
});
