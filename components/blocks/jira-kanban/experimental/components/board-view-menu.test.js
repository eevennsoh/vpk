/**
 * Board View menu source contracts.
 *
 * The menu is intentionally tested at the source boundary because this repo's
 * focused JavaScript unit gate does not mount TSX components. Browser checks
 * cover the rendered trigger and menu interaction separately.
 */

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const EXPERIMENTAL_DIR = join(__dirname, "..");
const VIEW_MENU_SOURCE = readFileSync(
	join(EXPERIMENTAL_DIR, "components", "board-view-menu.tsx"),
	"utf8",
);
const HEADER_SOURCE = readFileSync(
	join(EXPERIMENTAL_DIR, "experimental-board-header.tsx"),
	"utf8",
);

test("Experimental board header mounts the shared View picker", () => {
	assert.match(
		HEADER_SOURCE,
		/<BoardViewMenu\s+compact=\{compact\}[\s\S]*surfaceLabel=\{surfaceLabel\}[\s\S]*\/>/u,
	);
	assert.match(VIEW_MENU_SOURCE, /aria-label=\{`Configure \$\{surfaceLabel\} view`\}/u);
	assert.match(VIEW_MENU_SOURCE, /\{compact \? null : "View"\}/u);
	assert.match(
		HEADER_SOURCE,
		/agentFilterId=\{agentFilterId\}[\s\S]*onAgentFilterIdChange=\{onAgentFilterIdChange\}/u,
	);
});

test("View picker exposes unselected filter-action submenus with a selected count and clear action", () => {
	for (const stateType of [
		"BoardPrStateId",
		"BoardSessionTypeId",
		"BoardAgentFilterId",
		"BoardGroupOptionId",
	]) {
		assert.match(
			VIEW_MENU_SOURCE,
			new RegExp(`useState<${stateType} \\| null>\\(null\\)`, "u"),
			`${stateType} should start unfiltered`,
		);
	}
	assert.match(VIEW_MENU_SOURCE, /aria-pressed=\{hasQuickViewSelection\}/u);
	assert.match(VIEW_MENU_SOURCE, /<Badge variant="information">\{selectedQuickViewCount\}<\/Badge>/u);
	assert.match(VIEW_MENU_SOURCE, /<DropdownMenuSeparator \/>[\s\S]*Clear selection/u);
	assert.match(VIEW_MENU_SOURCE, /<DropdownMenuSubTrigger>\{label\}<\/DropdownMenuSubTrigger>/u);
	assert.doesNotMatch(VIEW_MENU_SOURCE, /<DropdownMenuSubTrigger selected=/u);
	assert.match(
		VIEW_MENU_SOURCE,
		/label="Pull request"[\s\S]*onSelect=\{handlePullRequestSelect\}[\s\S]*options=\{BOARD_PR_STATE_OPTIONS\}/u,
	);
	assert.match(
		VIEW_MENU_SOURCE,
		/label="Session type"[\s\S]*onSelect=\{handleSessionTypeSelect\}[\s\S]*options=\{BOARD_SESSION_TYPE_OPTIONS\}/u,
	);
	assert.match(
		VIEW_MENU_SOURCE,
		/label="Agents"[\s\S]*onSelect=\{handleAgentSelect\}[\s\S]*options=\{BOARD_AGENT_STATE_OPTIONS\}/u,
	);
	assert.match(
		VIEW_MENU_SOURCE,
		/label="Group by"[\s\S]*onSelect=\{handleGroupBySelect\}[\s\S]*options=\{BOARD_GROUP_OPTIONS\}/u,
	);
	assert.match(
		VIEW_MENU_SOURCE,
		/label="Pull request"[\s\S]*options=\{BOARD_PR_STATE_OPTIONS\}[\s\S]*label="Agents"[\s\S]*options=\{BOARD_AGENT_STATE_OPTIONS\}[\s\S]*label="Session type"[\s\S]*options=\{BOARD_SESSION_TYPE_OPTIONS\}[\s\S]*label="Group by"[\s\S]*options=\{BOARD_GROUP_OPTIONS\}/u,
	);
	assert.match(
		VIEW_MENU_SOURCE,
		/const BOARD_SESSION_TYPE_OPTIONS[\s\S]*BOARD_AGENT_HOST_OPTIONS\.filter\([\s\S]*option\.id !== "all"/u,
	);
	assert.match(
		VIEW_MENU_SOURCE,
		/<DropdownMenuRadioGroup[\s\S]*aria-label=\{label\}[\s\S]*value=\{selectedId \?\? ""\}/u,
	);
	assert.match(
		VIEW_MENU_SOURCE,
		/<DropdownMenuRadioItem[\s\S]*indicatorPlacement="end"[\s\S]*value=\{option\.id\}/u,
	);
	assert.match(VIEW_MENU_SOURCE, /selectedId=\{pullRequestFilterId\}/u);
	assert.match(VIEW_MENU_SOURCE, /selectedId=\{agentFilterId\}/u);
	assert.match(VIEW_MENU_SOURCE, /selectedId=\{sessionTypeFilterId\}/u);
	assert.match(VIEW_MENU_SOURCE, /selectedId=\{groupByFilterId\}/u);
	assert.match(
		VIEW_MENU_SOURCE,
		/className=\{stateIcon \? "gap-2" : undefined\}/u,
	);
	assert.match(VIEW_MENU_SOURCE, /setSessionTypeFilterId\(id\)/u);
	assert.doesNotMatch(VIEW_MENU_SOURCE, /AiAgentIcon/u);
	assert.match(
		VIEW_MENU_SOURCE,
		/setPullRequestFilterId\(null\);[\s\S]*setAgentFilterId\(null\);[\s\S]*setSessionTypeFilterId\(null\);[\s\S]*setGroupByFilterId\(null\);/u,
	);
	assert.doesNotMatch(
		VIEW_MENU_SOURCE,
		/DropdownMenuCheckboxItem|checked=|defaultChecked|CheckMarkIcon/u,
	);
	assert.doesNotMatch(VIEW_MENU_SOURCE, /<DropdownMenuSubTrigger onClick=/u);
	assert.doesNotMatch(VIEW_MENU_SOURCE, /option\.separatorBefore/u);
	assert.match(
		VIEW_MENU_SOURCE,
		/import PriorityTrivialIcon from "@atlaskit\/icon\/core\/priority-trivial";/u,
	);
	assert.match(
		VIEW_MENU_SOURCE,
		/untracked: \{ glyph: PriorityTrivialIcon, color: token\("color\.icon\.subtlest"\) \}/u,
	);
	assert.doesNotMatch(VIEW_MENU_SOURCE, /TaskToDoIcon|@atlaskit\/icon\/core\/task-to-do/u);
	assert.doesNotMatch(
		VIEW_MENU_SOURCE,
		/TaskInProgressIcon|@atlaskit\/icon\/core\/task-in-progress/u,
	);
	assert.match(VIEW_MENU_SOURCE, /import \{ Spinner \} from "@\/components\/ui\/spinner";/u);
	assert.match(VIEW_MENU_SOURCE, /working: \{ spinner: "experimental" \}/u);
	assert.match(
		VIEW_MENU_SOURCE,
		/className=\{MENU_LEADING_SPINNER_CLASS_NAME\}[\s\S]*label=""[\s\S]*size="xs"[\s\S]*variant="experimental"/u,
	);
	assert.match(VIEW_MENU_SOURCE, /MENU_LEADING_SPINNER_CLASS_NAME = "origin-center scale-\[1\.49\]"/u);
	assert.match(VIEW_MENU_SOURCE, /text-icon-subtlest! \[&_svg\]:text-icon-subtlest!/u);
	assert.doesNotMatch(VIEW_MENU_SOURCE, /pulse/u);
	assert.match(
		VIEW_MENU_SOURCE,
		/onAgentFilterIdChange\?: \(agentFilterId: BoardAgentFilterId \| null\) => void;/u,
	);
	assert.match(
		VIEW_MENU_SOURCE,
		/const isAgentFilterControlled = onAgentFilterIdChange !== undefined;/u,
	);
	assert.match(VIEW_MENU_SOURCE, /setAgentFilterId\(id\)/u);
	assert.doesNotMatch(VIEW_MENU_SOURCE, /collapsedColumnsForAgentFilter/u);
	assert.doesNotMatch(VIEW_MENU_SOURCE, /onCollapsedColumnsChange/u);
	assert.doesNotMatch(VIEW_MENU_SOURCE, /agentFilterBaselineRef/u);
	assert.doesNotMatch(
		VIEW_MENU_SOURCE,
		/onShownSessionStateIdsChange\?\.\(new Set\(BOARD_AGENT_SESSION_STATE_IDS\)\);[\s\S]*onShowUntrackedChange\?\.\(true\);/u,
	);
	assert.match(VIEW_MENU_SOURCE, /import ScreenIcon from "@atlaskit\/icon\/core\/screen";/u);
	assert.match(
		VIEW_MENU_SOURCE,
		/local: \{ glyph: ScreenIcon, color: token\("color\.icon\.subtle"\) \}/u,
	);
	assert.doesNotMatch(VIEW_MENU_SOURCE, /DevicesIcon|@atlaskit\/icon\/core\/devices/u);
});

test("Needs input button leads with the ADS question-circle icon and omits its count badge", () => {
	assert.match(
		VIEW_MENU_SOURCE,
		/import QuestionCircleIcon from "@atlaskit\/icon\/core\/question-circle";/u,
	);
	assert.match(
		VIEW_MENU_SOURCE,
		/<Icon data-icon="inline-start" render=\{<QuestionCircleIcon label="" \/>\} \/>\s*Needs input\s*<\/Button>/u,
	);
});
