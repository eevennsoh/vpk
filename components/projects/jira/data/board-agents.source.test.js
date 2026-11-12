const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const BOARD_AGENTS_SOURCE = fs.readFileSync(path.join(__dirname, "board-agents.ts"), "utf8");
const JIRA_KANBAN_DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "../../../blocks/jira-kanban/page.tsx"), "utf8");

test("board agent selector data omits Rovo Dev", () => {
	assert.doesNotMatch(BOARD_AGENTS_SOURCE, /id:\s*"rovo-dev"/u);
	assert.doesNotMatch(BOARD_AGENTS_SOURCE, /name:\s*"Rovo Dev"/u);
	assert.doesNotMatch(JIRA_KANBAN_DEMO_SOURCE, /"rovo-dev"/u);
});
