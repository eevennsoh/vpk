const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

test("rich text editor replaces StarterKit codeBlock with a Mermaid-aware NodeView", () => {
	const extensionsSource = readProjectFile(
		"components/ui-custom/rich-text-editor/extensions.ts",
	);
	const codeBlockNodeSource = readProjectFile(
		"components/ui-custom/rich-text-editor/code-block-node.ts",
	);
	const nodeViewSource = readProjectFile(
		"components/ui-custom/rich-text-editor/code-block-node-view.tsx",
	);

	assert.match(extensionsSource, /codeBlock:\s*false/u);
	assert.match(extensionsSource, /RichTextCodeBlock/u);
	assert.match(codeBlockNodeSource, /CodeBlock\.extend/u);
	assert.match(codeBlockNodeSource, /ReactNodeViewRenderer\(RichTextCodeBlockNodeView\)/u);
	assert.match(nodeViewSource, /isMermaidCodeBlockLanguage/u);
	assert.match(nodeViewSource, /MessageResponse/u);
	assert.match(nodeViewSource, /toMermaidFenceMarkdown/u);
	assert.match(nodeViewSource, /rich-text-mermaid-block/u);
});
