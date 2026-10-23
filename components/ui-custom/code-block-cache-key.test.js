import assert from "node:assert/strict";
import test from "node:test";
import { getTokensCacheKey } from "./code-block-cache-key.ts";

test("code-block cache distinguishes equal-length snippets with matching outer text", () => {
	const prefix = "// shared prefix\n".padEnd(100, " ");
	const suffix = "// shared suffix\n".padEnd(100, " ");
	const first = `${prefix}first${suffix}`;
	const second = `${prefix}other${suffix}`;
	assert.equal(first.length, second.length);
	assert.notEqual(getTokensCacheKey(first, "javascript"), getTokensCacheKey(second, "javascript"));
	const cache = new Map([[getTokensCacheKey(first, "javascript"), first]]);
	assert.equal(cache.get(getTokensCacheKey(second, "javascript")), undefined);
});

test("cache identity stays stable for identical source and separates languages", () => {
	const source = "const value = 1;";
	assert.equal(getTokensCacheKey(source, "javascript"), getTokensCacheKey(source, "javascript"));
	assert.notEqual(getTokensCacheKey(source, "javascript"), getTokensCacheKey(source, "typescript"));
});

test("cache identity preserves whitespace, Unicode and delimiter-containing source", () => {
	const sources = ["", " ", "\n", "lambda: λ", "lambda: λ ", "😀", "\\uD83D\\uDE00", ':["javascript","code"]'];
	assert.equal(new Set(sources.map((source) => getTokensCacheKey(source, "javascript"))).size, sources.length);
});
