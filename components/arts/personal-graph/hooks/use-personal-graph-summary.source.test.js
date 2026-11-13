const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SUMMARY_HOOK_SOURCE = fs.readFileSync(
	path.join(__dirname, "use-personal-graph-summary.ts"),
	"utf8",
);
const SUMMARY_PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "personal-graph-summary-panel.tsx"),
	"utf8",
);

test("usePersonalGraphSummary tracks article HTML state and resets by graph revision", () => {
	assert.match(SUMMARY_HOOK_SOURCE, /articleMarkdown/);
	assert.match(SUMMARY_HOOK_SOURCE, /summaryHtml: document\?\.html \?\? ""/);
	assert.match(SUMMARY_HOOK_SOURCE, /exportFilename: document\?\.filename \?\? ""/);
	assert.match(SUMMARY_HOOK_SOURCE, /cacheStatus/);
	assert.match(SUMMARY_HOOK_SOURCE, /sourceFingerprint/);
	assert.match(SUMMARY_HOOK_SOURCE, /sourceNotice/);
	assert.match(SUMMARY_PANEL_SOURCE, /key=\{getExplorerRevision\(props\.explorer, props\.node\)\}/);
	assert.match(SUMMARY_HOOK_SOURCE, /setDocument\(null\);/);
	assert.match(SUMMARY_HOOK_SOURCE, /setArticleMarkdown\(""\);/);
});

test("usePersonalGraphSummary consumes article events and no longer calls deck or librarian actions", () => {
	assert.match(SUMMARY_HOOK_SOURCE, /event\.type === "article"/);
	assert.match(SUMMARY_HOOK_SOURCE, /buildPersonalGraphSummaryHtmlDocument/);
	assert.match(SUMMARY_HOOK_SOURCE, /bypassCache: options\.bypassCache/);
	assert.match(SUMMARY_HOOK_SOURCE, /workWindow: options\.workWindow/);
	assert.match(SUMMARY_HOOK_SOURCE, /abortRef\.current\?\.abort\(\);/);
	assert.match(SUMMARY_HOOK_SOURCE, /clientIdRef = useRef\(""\)/);
	assert.doesNotMatch(SUMMARY_HOOK_SOURCE, /streamLibrarian/);
	assert.doesNotMatch(SUMMARY_HOOK_SOURCE, /generateDeck/);
	assert.doesNotMatch(SUMMARY_HOOK_SOURCE, /confirmStatus/);
	assert.doesNotMatch(SUMMARY_HOOK_SOURCE, /takeaways/);
});
