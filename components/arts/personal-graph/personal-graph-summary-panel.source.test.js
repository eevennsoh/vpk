const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SUMMARY_PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "personal-graph-summary-panel.tsx"),
	"utf8",
);

test("Personal Graph summary panel renders editorial HTML controls without retired actions", () => {
	assert.match(SUMMARY_PANEL_SOURCE, /Selected node summary/);
	assert.match(SUMMARY_PANEL_SOURCE, /Short/);
	assert.match(SUMMARY_PANEL_SOURCE, /Medium/);
	assert.match(SUMMARY_PANEL_SOURCE, /Long/);
	assert.match(SUMMARY_PANEL_SOURCE, /Regenerate/);
	assert.match(SUMMARY_PANEL_SOURCE, /Export HTML/);
	assert.match(SUMMARY_PANEL_SOURCE, /sandbox="allow-popups allow-scripts"/);
	assert.match(SUMMARY_PANEL_SOURCE, /srcDoc=\{summary\.summaryHtml\}/);
	assert.match(SUMMARY_PANEL_SOURCE, /title="Personal Graph summary article"/);
	assert.match(SUMMARY_PANEL_SOURCE, /text\/html;charset=utf-8/);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, /allow-same-origin/);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, />\s*Confirm\s*</);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, /Generate slides/);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, /Marp deck/);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, /Markdown summary/);
	assert.doesNotMatch(SUMMARY_PANEL_SOURCE, /Download \.md/);
});

test("Personal Graph summary panel supports TWG setup guidance and work window refresh", () => {
	assert.match(SUMMARY_PANEL_SOURCE, /TWG work window/);
	assert.match(SUMMARY_PANEL_SOURCE, /value: "7d"/);
	assert.match(SUMMARY_PANEL_SOURCE, /value: "14d"/);
	assert.match(SUMMARY_PANEL_SOURCE, /value: "30d"/);
	assert.match(SUMMARY_PANEL_SOURCE, /onWorkWindowChange\?\.\(event\.target\.value\)/);
	assert.match(SUMMARY_PANEL_SOURCE, /twg login/);
	assert.match(SUMMARY_PANEL_SOURCE, /never accepts passwords, OAuth tokens, API tokens, or Authorization headers/);
	assert.match(SUMMARY_PANEL_SOURCE, /articleFrameRef\.current\?\.contentWindow/);
	assert.match(SUMMARY_PANEL_SOURCE, /event\.source !== expectedSource/);
	assert.match(SUMMARY_PANEL_SOURCE, /event\.origin !== "null"/);
	assert.match(SUMMARY_PANEL_SOURCE, /type !== "personal-graph-select-node"/);
	assert.match(SUMMARY_PANEL_SOURCE, /handleSelectNode\(data\.nodeId\)/);
	assert.match(SUMMARY_PANEL_SOURCE, /ref=\{articleFrameRef\}/);
});
