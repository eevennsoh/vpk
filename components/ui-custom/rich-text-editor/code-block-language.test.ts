import assert from "node:assert/strict";
import test from "node:test";

import { isMermaidCodeBlockLanguage, toMermaidFenceMarkdown } from "./code-block-language.ts";

test("isMermaidCodeBlockLanguage accepts mermaid and mmd aliases", () => {
	assert.equal(isMermaidCodeBlockLanguage("mermaid"), true);
	assert.equal(isMermaidCodeBlockLanguage("mmd"), true);
	assert.equal(isMermaidCodeBlockLanguage(" MERMAID "), true);
	assert.equal(isMermaidCodeBlockLanguage("javascript"), false);
	assert.equal(isMermaidCodeBlockLanguage(null), false);
	assert.equal(isMermaidCodeBlockLanguage(undefined), false);
});

test("toMermaidFenceMarkdown wraps trimmed source in a mermaid fence", () => {
	assert.equal(
		toMermaidFenceMarkdown("  flowchart TD\n\tA-->B\n  "),
		"```mermaid\nflowchart TD\n\tA-->B\n```",
	);
});
