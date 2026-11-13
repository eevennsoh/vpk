const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const SUBTASKS_SOURCE = readFileSync(join(__dirname, "subtasks.tsx"), "utf8");
const EXPERIMENTAL_KANBAN_CARD_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental/experimental-jira-kanban-card.tsx"),
	"utf8",
);

test("compact internals stay on when raised chrome is selected", () => {
	assert.match(SOURCE, /compact\?: boolean;/u);
	assert.match(SOURCE, /const usesStrokeChrome = chrome === "stroke";/u);
	assert.match(SOURCE, /const usesCompactVisual = compact \|\| usesStrokeChrome \|\| appearance === "project-butter";/u);
	assert.match(SOURCE, /<div className=\{appearance === "project-butter" \? cn\("px-3 pt-3", butterCardBottomPadding\) : usesCompactVisual \? "px-3 pt-3 pb-2" : "p-3"\}>/u);
	assert.match(SOURCE, /boxShadow: chromeStyles\.boxShadow,/u);
	assert.match(SOURCE, /const agentActivityRestBorderClassName = !hasActiveAgentActivityShell\s*\n\t\t\? agentSurfaceChromeClassName\s*\n\t\t: usesStrokeChrome\s*\n\t\t\t\? cn\("border-surface", chromeStyles\.agentSurfaceHoverClassName\)\s*\n\t\t\t: agentSurfaceChromeClassName;/u);
	assert.match(SUBTASKS_SOURCE, /const usesStrokeChrome = compact \|\| chrome === "stroke";/u);
	assert.match(PAGE_SOURCE, /<JiraIssueAgentActivityStatesDemo[\s\S]*chrome=\{chrome\}[\s\S]*compact[\s\S]*onChromeChange=\{setChrome\}/);
	assert.match(PAGE_SOURCE, /compact=\{compact\}/);
	assert.match(PAGE_SOURCE, /const experimentalPullRequest = compact\s*\n\t\t\? getExperimentalDemoPullRequest\(agentActivityState\)\s*\n\t\t: \{\};/);
	assert.doesNotMatch(PAGE_SOURCE, /if \(chrome !== "stroke"\)/);
});

test("experimental kanban cards keep compact internals while chrome follows the column recipe", () => {
	assert.match(EXPERIMENTAL_KANBAN_CARD_SOURCE, /<JiraIssue[\s\S]*chrome=\{chrome\}[\s\S]*compact/u);
});
