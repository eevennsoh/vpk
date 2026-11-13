const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const DOC_HERO_SOURCE = fs.readFileSync(path.join(__dirname, "doc-hero.tsx"), "utf8");

test("DocHero import paths wrap instead of widening the component docs page", () => {
	assert.match(DOC_HERO_SOURCE, /display:\s*"block"/);
	assert.match(DOC_HERO_SOURCE, /maxWidth:\s*"100%"/);
	assert.match(DOC_HERO_SOURCE, /overflowWrap:\s*"anywhere"/);
	assert.match(DOC_HERO_SOURCE, /wordBreak:\s*"break-word"/);
});
