import assert from "node:assert/strict";
import test from "node:test";

import { applyMarkdownFormat } from "./markdown-format.ts";

function select(value: string, selectionStart: number, selectionEnd: number) {
	return { value, selectionStart, selectionEnd };
}

test("bold wraps the selection and keeps the inner text selected", () => {
	const result = applyMarkdownFormat("bold", select("the quick fox", 4, 9));
	assert.equal(result.value, "the **quick** fox");
	assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "quick");
});

test("bold unwraps a selection that already contains the markers", () => {
	const result = applyMarkdownFormat("bold", select("the **quick** fox", 4, 13));
	assert.equal(result.value, "the quick fox");
	assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "quick");
});

test("bold unwraps when the markers sit just outside the selection", () => {
	const result = applyMarkdownFormat("bold", select("the **quick** fox", 6, 11));
	assert.equal(result.value, "the quick fox");
	assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "quick");
});

test("italic on an empty selection inserts markers with the caret between them", () => {
	const result = applyMarkdownFormat("italic", select("ab", 1, 1));
	assert.equal(result.value, "a**b");
	assert.equal(result.selectionStart, 2);
	assert.equal(result.selectionEnd, 2);
});

test("strikethrough wraps with double tildes", () => {
	const result = applyMarkdownFormat("strikethrough", select("done", 0, 4));
	assert.equal(result.value, "~~done~~");
});

test("underline wraps with an HTML u tag", () => {
	const result = applyMarkdownFormat("underline", select("word", 0, 4));
	assert.equal(result.value, "<u>word</u>");
});

test("h1 prefixes the current line", () => {
	const result = applyMarkdownFormat("h1", select("Title", 2, 2));
	assert.equal(result.value, "# Title");
	assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "# Title");
});

test("h2 replaces an existing heading prefix instead of stacking", () => {
	const result = applyMarkdownFormat("h2", select("# Title", 3, 3));
	assert.equal(result.value, "## Title");
});

test("h1 toggles off when the line is already that heading", () => {
	const result = applyMarkdownFormat("h1", select("# Title", 3, 3));
	assert.equal(result.value, "Title");
});

test("normal strips the leading block marker", () => {
	const result = applyMarkdownFormat("normal", select("> quote line", 4, 4));
	assert.equal(result.value, "quote line");
});

test("quote prefixes the line and toggles off again", () => {
	const quoted = applyMarkdownFormat("quote", select("note", 0, 4));
	assert.equal(quoted.value, "> note");
	const unquoted = applyMarkdownFormat("quote", select(quoted.value, 0, quoted.value.length));
	assert.equal(unquoted.value, "note");
});

test("bulleted list prefixes every selected line", () => {
	const value = "one\ntwo\nthree";
	const result = applyMarkdownFormat("bulletList", select(value, 0, value.length));
	assert.equal(result.value, "- one\n- two\n- three");
});

test("bulleted list does not format the next line when selection ends on a newline", () => {
	const result = applyMarkdownFormat("bulletList", select("one\ntwo", 0, 4));
	assert.equal(result.value, "- one\ntwo");
	assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "- one");
});

test("numbered list numbers each selected line sequentially", () => {
	const value = "one\ntwo\nthree";
	const result = applyMarkdownFormat("orderedList", select(value, 0, value.length));
	assert.equal(result.value, "1. one\n2. two\n3. three");
});

test("numbered list does not format the next line when selection ends on a newline", () => {
	const result = applyMarkdownFormat("orderedList", select("one\ntwo", 0, 4));
	assert.equal(result.value, "1. one\ntwo");
	assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "1. one");
});

test("numbered list toggles off when all lines are already numbered", () => {
	const value = "1. one\n2. two";
	const result = applyMarkdownFormat("orderedList", select(value, 0, value.length));
	assert.equal(result.value, "one\ntwo");
});

test("link wraps the selection and selects the link text", () => {
	const result = applyMarkdownFormat(
		"link",
		select("see docs", 4, 8),
		{ linkUrl: "https://x.dev" },
	);
	assert.equal(result.value, "see [docs](https://x.dev)");
	assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "docs");
});

test("link without a URL is a no-op", () => {
	const state = select("see docs", 4, 8);
	const result = applyMarkdownFormat("link", state);
	assert.deepEqual(result, state);
});

test("inline code wraps the selection with backticks", () => {
	const result = applyMarkdownFormat("inlineCode", select("call foo() now", 5, 10));
	assert.equal(result.value, "call `foo()` now");
	assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "foo()");
});

test("inline code unwraps a selection already wrapped with backticks", () => {
	const result = applyMarkdownFormat("inlineCode", select("call `foo()` now", 5, 12));
	assert.equal(result.value, "call foo() now");
	assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "foo()");
});

test("h4/h5/h6 each prefix the current line with the matching ATX heading", () => {
	const h4 = applyMarkdownFormat("h4", select("Notes", 0, 5));
	assert.equal(h4.value, "#### Notes");

	const h5 = applyMarkdownFormat("h5", select("Notes", 0, 5));
	assert.equal(h5.value, "##### Notes");

	const h6 = applyMarkdownFormat("h6", select("Notes", 0, 5));
	assert.equal(h6.value, "###### Notes");
});

test("code block wraps the selected lines in fences", () => {
	const value = "alpha\nbeta\ngamma";
	const result = applyMarkdownFormat("codeBlock", select(value, 0, value.length));
	assert.equal(result.value, "```\nalpha\nbeta\ngamma\n```");
});

test("code block strips the fences when the selection is already fenced", () => {
	const value = "```\nalpha\nbeta\n```";
	const result = applyMarkdownFormat("codeBlock", select(value, 0, value.length));
	assert.equal(result.value, "alpha\nbeta");
});

test("horizontal rule inserts a `---` block surrounded by blank lines", () => {
	const result = applyMarkdownFormat("horizontalRule", select("before", 6, 6));
	assert.equal(result.value, "before\n\n---\n\n");
	// The caret should land at the end of the inserted block.
	assert.equal(result.selectionStart, result.value.length);
	assert.equal(result.selectionEnd, result.value.length);
});

test("horizontal rule reuses an existing trailing newline", () => {
	const result = applyMarkdownFormat("horizontalRule", select("before\n", 7, 7));
	assert.equal(result.value, "before\n\n---\n\n");
});
