const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const ISSUE_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const SUMMARY_SOURCE = readFileSync(join(__dirname, "summary.tsx"), "utf8");
const COVER_SOURCE = readFileSync(join(__dirname, "cover-image.tsx"), "utf8");

test("optional covers stay inside the issue content and leave the card in charge of dragging", () => {
	assert.match(ISSUE_SOURCE, /coverImage\?: JiraIssueCoverImage;/u);
	assert.match(ISSUE_SOURCE, /coverImage=\{coverImage\}/u);
	assert.match(SUMMARY_SOURCE, /coverImage \? <JiraIssueCover image=\{coverImage\} \/> : null/u);
	assert.match(COVER_SOURCE, /import Image from "next\/image"/u);
	assert.match(COVER_SOURCE, /className="relative aspect-video w-full overflow-hidden rounded-sm"/u);
	assert.match(COVER_SOURCE, /className="object-contain"/u);
	assert.match(COVER_SOURCE, /maxHeight: image\.maxHeight/u);
	assert.match(COVER_SOURCE, /alt=\{image\.alt\}/u);
	assert.match(COVER_SOURCE, /draggable=\{false\}/u);
	assert.match(COVER_SOURCE, /fill\s+sizes=/u);
});
