const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const MESSAGE_MARKDOWN_SOURCE = fs.readFileSync(path.join(__dirname, "message-markdown.tsx"), "utf8");

test("message markdown headings use typeset flow instead of Streamdown heading classes", () => {
	assert.match(MESSAGE_MARKDOWN_SOURCE, /!plain && "typeset typeset-chat"/u);
	assert.match(MESSAGE_MARKDOWN_SOURCE, /h1: bareEl\("h1"\)/u);
	assert.match(MESSAGE_MARKDOWN_SOURCE, /Dropping the class lets[\s\S]*typeset's zero-specificity `:where\(\)` rules own block typography/u);
	assert.match(MESSAGE_MARKDOWN_SOURCE, /\[&>\*:first-child\]:mt-0/u);
});

test("chat markdown anchors use ADS text-link chrome without default underline", () => {
	const anchorStart = MESSAGE_MARKDOWN_SOURCE.indexOf("function MarkdownAnchor");
	assert.ok(anchorStart > -1, "expected MarkdownAnchor");
	const anchorSource = MESSAGE_MARKDOWN_SOURCE.slice(
		anchorStart,
		MESSAGE_MARKDOWN_SOURCE.indexOf("Renders a bare HTML element", anchorStart),
	);
	assert.match(anchorSource, /void className/u);
	assert.match(
		anchorSource,
		/className="text-link no-underline hover:underline active:text-link-pressed"/u,
	);

	const globalsSource = fs.readFileSync(
		path.join(__dirname, "../../app/globals.css"),
		"utf8",
	);
	// Nested under `.typeset-chat` so the build keeps the rules (sibling
	// `.typeset-chat a` selectors were dropped from the compiled CSS).
	assert.match(globalsSource, /\.typeset-chat \{[\s\S]*& a,[\s\S]*color: var\(--color-link\);/u);
	assert.match(globalsSource, /& a:hover,[\s\S]*text-decoration: underline;/u);
});

test("MarkdownPre preserves Streamdown data-block so mermaid fences are not treated as inline code", () => {
	const preStart = MESSAGE_MARKDOWN_SOURCE.indexOf("function MarkdownPre");
	assert.ok(preStart > -1, "expected MarkdownPre");
	const preSource = MESSAGE_MARKDOWN_SOURCE.slice(
		preStart,
		MESSAGE_MARKDOWN_SOURCE.indexOf("export const streamdownComponents", preStart),
	);

	assert.match(preSource, /cloneElement/u);
	assert.match(preSource, /"data-block":\s*"true"/u);
	assert.match(MESSAGE_MARKDOWN_SOURCE, /inlineCode:\s*MarkdownInlineCode/u);
	assert.match(MESSAGE_MARKDOWN_SOURCE, /code:\s*MarkdownCodeBlock/u);
	assert.match(MESSAGE_MARKDOWN_SOURCE, /rawLanguage === "mermaid" \|\| rawLanguage === "mmd"/u);
});
