const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const DETAIL_SOURCE = readFileSync(
	join(__dirname, "../../../app/data/details/blocks/jira-kanban.ts"),
	"utf8",
);
const DEMO_SOURCE = readFileSync(
	join(__dirname, "../../website/demos/blocks/jira-kanban-demo.tsx"),
	"utf8",
);
const VARIANT_REGISTRY_SOURCE = readFileSync(
	join(__dirname, "../../website/registry/blocks-variants.ts"),
	"utf8",
);

test("Jira kanban docs include a dedicated empty-column example", () => {
	assert.match(DETAIL_SOURCE, /title: "Empty columns"/u);
	assert.match(DETAIL_SOURCE, /demoSlug: "jira-kanban-demo-empty-columns"/u);
	assert.match(DEMO_SOURCE, /export function JiraKanbanDemoEmptyColumns\(\)/u);
	assert.match(DEMO_SOURCE, /cards: \[\]/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"jira-kanban-demo-empty-columns"/u);
});
