const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

test("rich text editor renders TipTap task items with VPK Checkbox NodeView", () => {
	const extensionsSource = readProjectFile(
		"components/ui-custom/rich-text-editor/extensions.ts",
	);
	const taskItemNodeSource = readProjectFile(
		"components/ui-custom/rich-text-editor/task-item-node.ts",
	);
	const nodeViewSource = readProjectFile(
		"components/ui-custom/rich-text-editor/task-item-node-view.tsx",
	);

	assert.match(extensionsSource, /RichTextTaskItem\.configure/u);
	assert.doesNotMatch(extensionsSource, /\bTaskItem\.configure/u);
	assert.match(taskItemNodeSource, /TaskItem\.extend/u);
	assert.match(
		taskItemNodeSource,
		/ReactNodeViewRenderer\(RichTextTaskItemNodeView\)/u,
	);
	assert.match(nodeViewSource, /from "@\/components\/ui\/checkbox"/u);
	assert.match(nodeViewSource, /RichTextTaskItemNodeView/u);
	assert.match(nodeViewSource, /data-type="taskItem"/u);
});

test("completed rich text task items use subtlest text without strikethrough", () => {
	const cssSource = readProjectFile(
		"components/ui-custom/rich-text-editor/rich-text-editor.css",
	);

	assert.match(
		cssSource,
		/\.tiptap-editor\s+\.rich-text-task-item\[data-checked="true"\]\s*>\s*div\s*\{[^}]*color:\s*var\(--ds-text-subtlest/u,
	);
	assert.match(
		cssSource,
		/\.tiptap-editor\s+\.rich-text-task-item\[data-checked="true"\]\s*>\s*div\s+:is\(strong,\s*a,\s*\.editor-link,\s*code\)\s*\{[^}]*color:\s*inherit/u,
	);
	assert.doesNotMatch(
		cssSource,
		/\.tiptap-editor\s+\.rich-text-task-item\[data-checked="true"\]\s*>\s*div\s*\{[^}]*text-decoration:\s*line-through/u,
	);
	assert.doesNotMatch(
		cssSource,
		/\.tiptap-editor\s+\.rich-text-task-item\[data-checked="true"\]\s*>\s*div\s*\{[^}]*color:\s*var\(--ds-text-disabled/u,
	);
});
