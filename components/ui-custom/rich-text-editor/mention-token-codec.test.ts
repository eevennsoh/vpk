import assert from "node:assert/strict";
import test from "node:test";

import { createMentionTokenParser, MENTION_MARKDOWN_TOKEN_NAME, mentionMarkdownTokenizer, parseMentionTokenId, serializeMentionNode, type MentionTokenResolver } from "./mention-token-codec.ts";

// Minimal stand-ins for the tiptap-markdown helper + resolver. The codec only
// touches `createTextNode` / `createNode` from helpers, so we model just those.
const helpers = {
	createTextNode: (text: string) => ({ type: "text", text }),
	createNode: (type: string, attrs?: Record<string, unknown>) => ({ type, attrs }),
} as never;

// Fake directory: knows two ids, resolving label + a visual attr so we can assert
// resolved attrs flow through. Unknown ids return undefined (passthrough path).
const KNOWN: Record<string, { label: string; attrs: Record<string, unknown> }> = {
	"skill:web-search": { label: "Web search", attrs: { visualKind: "icon", visualIconKey: "search" } },
	"knowledge:slack:all": { label: "Slack - all content", attrs: { visualKind: "logo", visualLogoName: "slack" } },
};
const resolve: MentionTokenResolver = (_category, id) => KNOWN[id];
const parse = createMentionTokenParser(resolve);

function tokenize(src: string) {
	return mentionMarkdownTokenizer.tokenize(src, [], {} as never);
}

test("parseMentionTokenId splits category from the full id payload", () => {
	assert.deepEqual(parseMentionTokenId("skill:web-search"), {
		category: "skill",
		id: "skill:web-search",
	});
	// Nested knowledge ids keep every colon-joined segment in the id.
	assert.deepEqual(parseMentionTokenId("knowledge:slack:all"), {
		category: "knowledge",
		id: "knowledge:slack:all",
	});
});

test("parseMentionTokenId rejects non-body categories and malformed payloads", () => {
	assert.equal(parseMentionTokenId("human:alice"), null);
	assert.equal(parseMentionTokenId("team:design"), null);
	assert.equal(parseMentionTokenId("skill"), null); // no colon
	assert.equal(parseMentionTokenId("skill:"), null); // empty id
	assert.equal(parseMentionTokenId(":web-search"), null); // empty category
});

test("serializeMentionNode emits @[category:id] from the stored id", () => {
	assert.equal(
		serializeMentionNode({ attrs: { id: "skill:web-search", label: "Web search" } }),
		"@[skill:web-search]",
	);
	assert.equal(
		serializeMentionNode({ attrs: { id: "knowledge:slack:all", label: "Slack - all content" } }),
		"@[knowledge:slack:all]",
	);
});

test("serializeMentionNode falls back to @label for non-body ids so nothing is lost", () => {
	assert.equal(
		serializeMentionNode({ attrs: { id: "human:alice", label: "Alice" } }),
		"@Alice",
	);
	assert.equal(serializeMentionNode({ attrs: { label: "Alice" } }), "@Alice");
});

test("tokenizer matches a valid token at the start of the source", () => {
	const token = tokenize("@[skill:web-search] rest");
	assert.equal(token?.type, MENTION_MARKDOWN_TOKEN_NAME);
	assert.equal(token?.raw, "@[skill:web-search]");
	assert.equal(token?.payload, "skill:web-search");
});

test("tokenizer yields (returns undefined) for invalid or non-anchored input", () => {
	assert.equal(tokenize("text @[skill:web-search]"), undefined); // not at start
	assert.equal(tokenize("@[human:alice]"), undefined); // non-body category
	assert.equal(tokenize("plain text"), undefined);
});

test("tokenizer.start finds the next token offset for marked", () => {
	// `start` is typed `string | fn` on MarkdownTokenizer; the codec defines the
	// function form, so narrow before calling.
	const { start } = mentionMarkdownTokenizer;
	assert.equal(typeof start, "function");
	if (typeof start !== "function") {
		return;
	}
	assert.equal(start("a @[skill:web-search] b"), 2);
	assert.equal(start("no token here"), -1);
});

test("parseMarkdown builds a mention node with resolved label + visual attrs", () => {
	const result = parse(
		{ type: MENTION_MARKDOWN_TOKEN_NAME, raw: "@[skill:web-search]", payload: "skill:web-search" },
		helpers,
	) as { type: string; attrs: Record<string, unknown> };

	assert.equal(result.type, "mention");
	assert.equal(result.attrs.id, "skill:web-search");
	assert.equal(result.attrs.category, "skill");
	assert.equal(result.attrs.label, "Web search");
	assert.equal(result.attrs.mentionSuggestionChar, "@");
	assert.equal(result.attrs.visualKind, "icon");
	assert.equal(result.attrs.visualIconKey, "search");
});

test("parseMarkdown passes an unknown id through as the literal token text", () => {
	const result = parse(
		{ type: MENTION_MARKDOWN_TOKEN_NAME, raw: "@[skill:ghost]", payload: "skill:ghost" },
		helpers,
	) as { type: string; text: string };

	assert.equal(result.type, "text");
	assert.equal(result.text, "@[skill:ghost]");
});

test("round-trips losslessly: serialize(parse(token)) === token for known ids", () => {
	for (const payload of ["skill:web-search", "knowledge:slack:all"]) {
		const node = parse(
			{ type: MENTION_MARKDOWN_TOKEN_NAME, raw: `@[${payload}]`, payload },
			helpers,
		) as { type: string; attrs: Record<string, unknown> };

		assert.equal(node.type, "mention");
		assert.equal(serializeMentionNode(node), `@[${payload}]`);
	}
});

test("round-trips losslessly: parse(serialize(node)) preserves id + label", () => {
	const node = { type: "mention", attrs: { id: "knowledge:slack:all", label: "Slack - all content" } };
	const markdown = serializeMentionNode(node);
	assert.equal(markdown, "@[knowledge:slack:all]");

	const token = tokenize(markdown);
	assert.equal(token?.payload, "knowledge:slack:all");

	const reparsed = parse(token as never, helpers) as { attrs: Record<string, unknown> };
	assert.equal(reparsed.attrs.id, "knowledge:slack:all");
	assert.equal(reparsed.attrs.label, "Slack - all content");
});
