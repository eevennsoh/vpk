const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readProjectFile(relativePath) {
	return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const PAGE_SOURCE = readProjectFile("components/projects/jira-team-eu26/page.tsx");
const LIST_HOOK_SOURCE = readProjectFile(
	"components/projects/jira-team-eu26/hooks/use-jira-team-eu26-list.ts",
);
const LIST_ROWS_SOURCE = readProjectFile(
	"components/projects/jira-team-eu26/lib/list-rows.ts",
);
const EXPERIMENTAL_PAGE_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/page.tsx",
);
const ARRIVAL_HOOK_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/hooks/use-created-card-arrival.ts",
);

test("a gap drop reuses the create-well path with a slot rather than a second creator", () => {
	// One owner for "a board drop makes a work item". The create well omits the
	// index and appends; a gap drop names the slot it landed in.
	assert.match(LIST_ROWS_SOURCE, /insertAtIndex\?: number;/u);
	assert.match(LIST_ROWS_SOURCE, /cards\.splice\(Math\.min\(Math\.max\(insertAtIndex, 0\), cards\.length\), 0, card\)/u);
	assert.match(LIST_HOOK_SOURCE, /insertAtIndex: input\.insertAtIndex/u);
	assert.match(PAGE_SOURCE, /insertAtIndex\?: number,/u);
	assert.match(PAGE_SOURCE, /createBoardFromAgentSession\(\{[\s\S]*insertAtIndex,/u);
});

test("each cohort member advances the slot so the sessions land in drag order", () => {
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/onBoardGapCreate: onBoardAgentSessionCreate \? handleBoardGapCreate : undefined/u,
	);
	assert.match(ARRIVAL_HOOK_SOURCE, /handleCreate\(session, insertion\.columnTitle, insertion\.insertAtIndex \+ index\)/u);
});

test("a board without the create capability never draws an insertion line", () => {
	// The gap port is undefined without the host callback, and the drag hook only
	// publishes card-gap zones when that port exists.
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onBoardGapCreate: onBoardAgentSessionCreate\s*\?/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /: undefined,/u);
});

test("a gap arrival does not scroll the column away from the pointer", () => {
	// The create well appends, so the column follows the last card's bottom. A
	// gap drop lands mid-column, already under the pointer.
	assert.match(ARRIVAL_HOOK_SOURCE, /readonly appended: boolean;/u);
	assert.match(ARRIVAL_HOOK_SOURCE, /const appended = insertAtIndex === undefined;/u);
	assert.match(ARRIVAL_HOOK_SOURCE, /\|\| !arrival\.appended/u);
});
