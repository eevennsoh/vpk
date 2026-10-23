// T1 (ws5-xthread): twitter-text v3 weighted counting and URL extraction against the vendored
// conformance vectors, the local vectors and the pinned x-launch-thread eval posts.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CCTLDS, GTLDS } from "./tlds.mjs";
import {
	EMOJI_FALLBACK_PATTERN,
	EMOJI_PATTERN,
	X_TEXT_CONFIG,
	extractEmojiWithIndices,
	extractUrlsWithIndices,
	parseTweet,
	weightedLength,
} from "./twitter-text.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VECTORS = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "twitter-text-v3-vectors.json"), "utf8"));
const EXAMPLE_PATH = path.join(__dirname, "..", "..", "references", "schemas", "examples", "x-thread.content.json");
const RANGE_KEYS = ["weightedLength", "valid", "permillage", "validRangeStart", "validRangeEnd", "displayRangeStart", "displayRangeEnd"];
const PATTERNS = [["RGI_Emoji (v flag)", EMOJI_PATTERN], ["fallback (u flag)", EMOJI_FALLBACK_PATTERN]];
// Measured once with this module and pinned (integration K23); p4 is the over-limit post.
const EVAL_WEIGHTS = [205, 243, 191, 379, 197, 202];

const localText = vector => (vector.repeat === undefined ? vector.text : vector.repeat.repeat(vector.times));
const pick = (result, keys) => Object.fromEntries(keys.map(key => [key, result[key]]));

test("vendored vectors keep their provenance and every group listed in T1", () => {
	assert.equal(VECTORS._source.commit, "30e2430d90cff3b46393ea54caf511441983c260");
	assert.match(VECTORS._source.license, /^Apache-2\.0/);
	assert.match(VECTORS._source.copyright, /Copyright 2018 Twitter, Inc\./);
	assert.equal(VECTORS.weighted.WeightedTweetsWithDiscountedEmojiCounterTest.length, 22);
	assert.equal(VECTORS.weighted.UnicodeDirectionalMarkerCounterTest.length, 2);
	assert.equal(VECTORS.urls.urls.length, 91);
	const indexed = VECTORS.urls.urls_with_indices.length + VECTORS.urls.urls_with_directional_markers.length + VECTORS.urls.tco_urls_with_params.length;
	assert.equal(indexed, 17);
	assert.equal(VECTORS.local.urls.length, 16);
});

test("X_TEXT_CONFIG is the frozen twitter-text config/v3.json", () => {
	assert.deepEqual(JSON.parse(JSON.stringify(X_TEXT_CONFIG)), {
		version: 3,
		maxWeightedTweetLength: 280,
		scale: 100,
		defaultWeight: 200,
		emojiParsingEnabled: true,
		transformedURLLength: 23,
		ranges: [
			{ start: 0, end: 4351, weight: 100 },
			{ start: 8192, end: 8205, weight: 100 },
			{ start: 8208, end: 8223, weight: 100 },
			{ start: 8242, end: 8247, weight: 100 },
		],
	});
	assert.ok(Object.isFrozen(X_TEXT_CONFIG) && Object.isFrozen(X_TEXT_CONFIG.ranges) && Object.isFrozen(X_TEXT_CONFIG.ranges[0]));
});

for (const [label, pattern] of PATTERNS) {
	test(`weighted conformance vectors match with the ${label} emoji pattern`, () => {
		for (const [group, vectors] of Object.entries(VECTORS.weighted)) {
			for (const vector of vectors) {
				const result = parseTweet(vector.text, X_TEXT_CONFIG, { emojiPattern: pattern });
				assert.deepEqual(pick(result, RANGE_KEYS), pick(vector.expected, RANGE_KEYS), `${group}: ${vector.description}`);
			}
		}
	});

	test(`local vectors match with the ${label} emoji pattern`, () => {
		for (const vector of VECTORS.local.weighted) {
			const result = parseTweet(localText(vector), X_TEXT_CONFIG, { emojiPattern: pattern });
			const keys = Object.keys(vector.expected);
			assert.deepEqual(pick(result, keys), vector.expected, vector.description);
		}
	});
}

test("URL extraction matches all 91 urls vectors", () => {
	for (const vector of VECTORS.urls.urls) {
		const urls = extractUrlsWithIndices(vector.text).map(entity => entity.url);
		assert.deepEqual(urls, vector.expected, vector.description);
	}
});

test("URL extraction matches the 17 indexed, directional and t.co vectors", () => {
	for (const group of ["urls_with_indices", "urls_with_directional_markers", "tco_urls_with_params"]) {
		for (const vector of VECTORS.urls[group]) {
			const found = extractUrlsWithIndices(vector.text);
			const expected = vector.expected.map(entry => (typeof entry === "string" ? { url: entry } : entry));
			const actual = found.map((entity, index) => (expected[index]?.indices ? entity : { url: entity.url }));
			assert.deepEqual(actual, expected, `${group}: ${vector.description}`);
		}
	}
});

// Upstream's validUrlPathEndingChars is an ungrouped `[...]|(?:parens)`, so inside validUrlPath
// a parenthesised ending is its own alternative and never follows non-ending path characters.
// Expected values come from npm twitter-text 3.1.0, whose regexp/* equals the pinned commit.
test("URL paths end where upstream ends them around parentheses", () => {
	for (const vector of VECTORS.local.urls) {
		assert.deepEqual(extractUrlsWithIndices(vector.text), vector.expected, vector.description);
	}
});

test("the six x-launch-thread posts keep their pinned weighted lengths", () => {
	const posts = VECTORS.evalPosts.posts;
	assert.deepEqual(posts.map(post => post.id), ["p1", "p2", "p3", "p4", "p5", "p6"]);
	assert.deepEqual(posts.map(post => weightedLength(post.text)), EVAL_WEIGHTS);
	assert.deepEqual(posts.map(post => parseTweet(post.text).valid), [true, true, true, false, true, true]);
	const withUrl = posts.filter(post => extractUrlsWithIndices(post.text).length > 0);
	assert.equal(withUrl.length, 1, "exactly one post carries a URL");
	const url = extractUrlsWithIndices(withUrl[0].text)[0].url;
	assert.ok(url.length > 23);
	assert.equal(weightedLength(withUrl[0].text), withUrl[0].text.length - url.length + 23, "the URL counts 23");
	const japanese = posts.filter(post => /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(post.text));
	assert.equal(japanese.length, 1, "exactly one post carries Japanese text");
	assert.ok(posts.some(post => extractEmojiWithIndices(post.text).length > 0), "one post carries an emoji");
	assert.ok(weightedLength(posts[3].text) > 280 && weightedLength(posts[3].text) < 400, "p4 is about 380");
});

test("the x-thread schema example carries the eval posts byte-identically", t => {
	if (!fs.existsSync(EXAMPLE_PATH)) {
		t.skip("references/schemas/examples/x-thread.content.json is not written yet (ws5 P2)");
		return;
	}
	const example = JSON.parse(fs.readFileSync(EXAMPLE_PATH, "utf8"));
	assert.equal(example.type, "x-thread");
	assert.deepEqual(
		example.content.posts.map(post => [post.id, post.text]),
		VECTORS.evalPosts.posts.map(post => [post.id, post.text]),
	);
});

test("weightedLength is parseTweet().weightedLength", () => {
	const texts = [...VECTORS.local.weighted.map(localText), ...VECTORS.evalPosts.posts.map(post => post.text)];
	for (const text of texts) assert.equal(weightedLength(text), parseTweet(text).weightedLength);
});

test("emoji extraction reports UTF-16 indices and the twemoji text-presentation rule", () => {
	const thumbs = String.fromCodePoint(0x1f44d, 0x1f3fd);
	assert.deepEqual(extractEmojiWithIndices(`a${thumbs}b`), [{ text: thumbs, indices: [1, 5] }]);
	const copyright = String.fromCodePoint(0xa9);
	const vs16 = String.fromCodePoint(0xfe0f);
	for (const [, pattern] of PATTERNS) {
		assert.deepEqual(extractEmojiWithIndices(copyright, pattern), [], "bare (c) is text");
		assert.equal(extractEmojiWithIndices(copyright + vs16, pattern).length, 1, "(c) + VS16 is an emoji");
		assert.equal(extractEmojiWithIndices(String.fromCodePoint(0x2122), pattern).length, 0, "bare TM is text");
	}
	// A non-global pattern is accepted, and a shared global pattern is left reusable.
	assert.equal(extractEmojiWithIndices(`${thumbs}${thumbs}`, new RegExp(EMOJI_FALLBACK_PATTERN.source, "u")).length, 2);
	assert.equal(EMOJI_PATTERN.lastIndex, 0);
});

test("parseTweet tolerates missing text and honours emojiParsingEnabled", () => {
	assert.equal(parseTweet().weightedLength, 0);
	assert.equal(parseTweet(null).weightedLength, 0);
	assert.equal(parseTweet(undefined).valid, false);
	const thumbs = String.fromCodePoint(0x1f44d, 0x1f3fd);
	assert.equal(parseTweet(thumbs).weightedLength, 2);
	assert.equal(parseTweet(thumbs, { ...X_TEXT_CONFIG, emojiParsingEnabled: false }).weightedLength, 4);
	assert.equal(parseTweet("abc", {}).weightedLength, 3, "an empty config falls back to v3");
});

test("labels longer than 63 characters after punycode are not URLs", () => {
	const accent = String.fromCodePoint(0xe9);
	assert.equal(extractUrlsWithIndices(`go http://${accent.repeat(20)}.com now`).length, 1);
	assert.equal(extractUrlsWithIndices(`go http://${accent.repeat(60)}.com now`).length, 0);
	assert.equal(extractUrlsWithIndices(`go http://${"a".repeat(63)}.com now`).length, 1);
	assert.equal(extractUrlsWithIndices(`go http://${"a".repeat(64)}.com now`).length, 0);
});

test("module sources stay dependency-free, validator-safe and attributed", () => {
	const counter = fs.readFileSync(path.join(__dirname, "twitter-text.mjs"), "utf8");
	const tlds = fs.readFileSync(path.join(__dirname, "tlds.mjs"), "utf8");
	assert.deepEqual(counter.match(/^import .*$/gm), ['import { GTLDS, CCTLDS } from "./tlds.mjs";']);
	assert.equal(/^import /m.test(tlds), false);
	for (const source of [counter, tlds]) {
		assert.match(source, /Apache License, Version 2\.0/);
		assert.match(source, /Copyright 2018 Twitter, Inc\./);
		assert.match(source, /30e2430d90cff3b46393ea54caf511441983c260/);
		assert.equal(source.includes('URL("http'), false);
		assert.equal(/\{\{/.test(source), false);
		assert.equal(/<!--|-->|<\/?script|<\/body/i.test(source), false, "no HTML comment or script delimiters in inlined code");
		assert.equal(/#[0-9A-Fa-f]{3,8}\b/.test(source), false, "no hex-colour-like literals");
		assert.equal(/\b(?:rgba?|hsla?)\(/.test(source), false);
		assert.equal(/console\.|window\.open|new Function|\beval\(/.test(source), false);
	}
	assert.equal(/[^\x00-\x7F]/.test(counter), false, "the counter source is ASCII (invisible characters as escapes)");
	assert.match(counter, /Changes \(vpk-html/);
	// ws5 spec §5 budgets (acceptance A14), counted like scripts/verify-file-size-budget.js.
	const lines = source => (source.match(/\n/g)?.length ?? 0) + (source.endsWith("\n") ? 0 : 1);
	assert.ok(lines(counter) <= 260, `twitter-text.mjs has ${lines(counter)} lines; the budget is 260`);
	assert.ok(lines(tlds) <= 200, `tlds.mjs has ${lines(tlds)} lines; the budget is 200`);
});

test("TLD data matches tld_lib.yml shape", () => {
	assert.equal(GTLDS.length, 1259);
	assert.equal(CCTLDS.length, 315);
	assert.ok(Object.isFrozen(GTLDS) && Object.isFrozen(CCTLDS));
	assert.equal(new Set(GTLDS).size, GTLDS.length);
	assert.equal(new Set(CCTLDS).size, CCTLDS.length);
	for (const tld of [...GTLDS, ...CCTLDS]) assert.match(tld, /^[^\s|.]+$/u);
	for (const tld of ["com", "dev", "app", "onion"]) assert.ok(GTLDS.includes(tld), tld);
	for (const tld of ["co", "uk", "jp", "au"]) assert.ok(CCTLDS.includes(tld), tld);
});
