// The Confluence page body is a tiptap contenteditable; assistive technology must hear it as a
// named multiline text field, the way the shared rich-text editor exposes itself.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { act } = require("react");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

test("the page body editor is a named multiline textbox", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import DocumentEditor from "@/components/projects/confluence/components/document-editor";
			export default function EditorProbe() {
				return <ThemeWrapper><DocumentEditor /></ThemeWrapper>;
			}`,
	});
	// The editor mounts after hydration (`immediatelyRender: false`), so wait for its view.
	const findEditable = () => view.container.querySelector(".ProseMirror[contenteditable=\"true\"]");
	for (let attempt = 0; attempt < 50 && findEditable() === null; attempt += 1) {
		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
	}
	const editable = findEditable();

	assert.equal(editable !== null, true, "the tiptap editable region rendered");
	assert.equal(editable.getAttribute("role"), "textbox");
	assert.equal(editable.getAttribute("aria-multiline"), "true");
	assert.equal(accessibleName(editable), "Page content");
});
