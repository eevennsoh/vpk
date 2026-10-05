const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readProjectFile(relativePath) {
	return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const PAGE_SOURCE = readProjectFile("components/projects/jira-team-eu26-end/page.tsx");
const EXPERIMENTAL_HEADER_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/experimental-board-header.tsx",
);
const BOARD_VIEW_MENU_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/components/board-view-menu.tsx",
);
const EXPERIMENTAL_PAGE_SOURCE = [
	readProjectFile("components/blocks/jira-kanban/experimental/page.tsx"),
	readProjectFile("components/blocks/jira-kanban/experimental/experimental-page-types.ts"),
	readProjectFile("components/blocks/jira-kanban/experimental/hooks/use-page-content-model.ts"),
].join("\n");

test("the End board shares Team EU26's opt-in auto arrange setting", () => {
	assert.match(PAGE_SOURCE, /autoArrangeEnabled=\{designVariants\.autoArrange\}/u);
});

test("the board keeps matching 24px gaps above and below the filter controls", () => {
	// The control row's opening tag is multi-line (it carries `controlsInsetEnd`
	// as a style), so match the className string rather than the whole tag —
	// `mt-6` after the tabs must match the header's `pb-6` below the row.
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/\{viewTabs \? <div className="mt-2">\{viewTabs\}<\/div> : null\}[\s\S]*className="mt-6 flex flex-wrap items-center gap-2 px-6"/u,
	);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/className=\{cn\("shrink-0 pt-3", showBoardControls \? "pb-6" : "pb-0"\)\}/u,
	);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/paddingInlineEnd: `calc\(\$\{controlsInsetEnd\}px \+ \$\{token\("space\.300"\)\}\)`/u,
	);
});

test("Team EU26 replaces View with Needs input and a dedicated Group by control", () => {
	assert.match(
		PAGE_SOURCE,
		/needsInputCount=\{needsInputCount\}/u,
		"the Team EU26 route owns the live Needs input count",
	);
	// The count itself is proven against the Needs input focus in
	// components/blocks/jira-kanban/experimental/lib/board-agent-filter-scope.test.js.
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /needsInputCount\?: number;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /needsInputCount=\{needsInputCount\}/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /needsInputCount\?: number;/u);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/<BoardNeedsInputButton[\s\S]*<BoardGroupByMenu/u,
	);
	assert.match(BOARD_VIEW_MENU_SOURCE, /export function BoardNeedsInputButton/u);
	assert.match(BOARD_VIEW_MENU_SOURCE, /Needs input/u);
	assert.doesNotMatch(BOARD_VIEW_MENU_SOURCE, /StatusInformationIcon/u);
	assert.match(BOARD_VIEW_MENU_SOURCE, /export function BoardGroupByMenu/u);
	assert.match(
		BOARD_VIEW_MENU_SOURCE,
		/<DropdownMenuRadioGroup[\s\S]*aria-label="Group by"[\s\S]*BOARD_GROUP_OPTIONS/u,
	);
});
