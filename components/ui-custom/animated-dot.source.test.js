const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(join(__dirname, "animated-dot.tsx"), "utf8");
const GLOBALS_SOURCE = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

test("animation styles do not leak CSS into parent accessible names", () => {
	assert.doesNotMatch(SOURCE, /<style|DOT_REVEAL_KEYFRAMES/u);
	assert.match(GLOBALS_SOURCE, /@keyframes dot-reveal \{/u);
	assert.match(SOURCE, /<span[\s\S]*aria-hidden="true"/u);
});

test("neutral is the default variant and inherits surrounding text colour", () => {
	assert.match(SOURCE, /export type AnimatedDotVariant = "neutral" \| "color"/u);
	assert.match(SOURCE, /variant = "neutral"/u);
	assert.match(SOURCE, /case "neutral":[\s\S]*NEUTRAL_DOT_COLORS/u);
	assert.match(
		SOURCE,
		/className=\{cn\("shrink-0 inline-flex items-baseline", className\)\}/u,
	);
	assert.doesNotMatch(
		SOURCE,
		/className=\{cn\([\s\S]*text-text-subtlest/u,
	);
	assert.doesNotMatch(
		SOURCE,
		/variant = "neutral"[\s\S]*colors = COLOR_VARIANT_COLORS/u,
	);
});

test("color variant keeps the Rovo palette and custom colors override", () => {
	assert.match(
		SOURCE,
		/const COLOR_VARIANT_COLORS = \["#1868db", "#bf63f3", "#fca700"\]/u,
	);
	assert.match(SOURCE, /case "color":[\s\S]*colors \?\? COLOR_VARIANT_COLORS/u);
	assert.match(SOURCE, /colors != null \? "color" : variant/u);
});
