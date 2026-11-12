const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("the editorial pane derives selection and navigation from the shared Insights context", () => {
	const source = fs.readFileSync(path.join(__dirname, "jira-insight-editorial-pane.tsx"), "utf8");

	assert.match(source, /useJiraInsight\(\)/u);
	assert.match(source, /getJiraInsightEditorialSelection\(/u);
	assert.match(source, /selectCheckpoint\(selection\.previousCheckpointId\)/u);
	assert.match(source, /selectCheckpoint\(selection\.nextCheckpointId\)/u);
	assert.doesNotMatch(source, /useState/u);
});

test("the pane exposes accessible previous and next controls with boundary states", () => {
	const source = fs.readFileSync(path.join(__dirname, "jira-insight-editorial-pane.tsx"), "utf8");

	assert.match(source, /aria-label="Show previous decision"/u);
	assert.match(source, /aria-label="Show next decision"/u);
	assert.match(source, /disabled=\{selection\.previousCheckpointId == null\}/u);
	assert.match(source, /disabled=\{selection\.nextCheckpointId == null\}/u);
});

test("the pane renders editorial summary, source actions, and decision metadata", () => {
	const source = fs.readFileSync(path.join(__dirname, "jira-insight-editorial-pane.tsx"), "utf8");

	assert.match(source, /Current summary/u);
	assert.match(source, /JiraInsightSources/u);
	assert.match(source, /<dl/u);
	assert.match(source, /Date/u);
	assert.match(source, /Sources/u);
	assert.match(source, /Position/u);
	assert.match(source, /Category/u);
});
