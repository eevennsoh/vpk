const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const TYPES_SOURCE = readFileSync(join(__dirname, "agent-session-column-types.ts"), "utf8");
const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const INTERACTION_HOOK_SOURCE = readFileSync(
	join(__dirname, "use-agent-session-column-interaction.ts"),
	"utf8",
);
const HEADER_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-header.tsx"),
	"utf8",
);
const FILTER_MENU_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-filter-menu.tsx"),
	"utf8",
);
const FILTER_SECTIONS_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-filter-sections.tsx"),
	"utf8",
);
const FILTER_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-filter.ts"),
	"utf8",
);
const TIME_PICKER_SOURCE = readFileSync(join(__dirname, "../../ui/time-picker.tsx"), "utf8");
const DETAIL_SOURCE = readFileSync(
	join(__dirname, "../../../app/data/details/blocks/agent-session-column.ts"),
	"utf8",
);
const IN_FLOW_COLUMN_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental/components/in-flow-agent-session-column.tsx"),
	"utf8",
);
const PANEL_DEMO_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-panel-demo.tsx"),
	"utf8",
);

test("column interaction is reported across collapsed and expanded presentations", () => {
	assert.match(TYPES_SOURCE, /onInteractionChange\?: \(interacting: boolean\) => void;/u);
	assert.match(INDEX_SOURCE, /onFocusCapture=\{handleColumnFocusCapture\}/u);
	assert.match(INDEX_SOURCE, /onBlurCapture=\{handleColumnBlurCapture\}/u);
	assert.match(INDEX_SOURCE, /onPointerEnter=\{handleColumnPointerEnter\}/u);
	assert.match(INDEX_SOURCE, /onPointerLeave=\{handleColumnPointerLeave\}/u);
	assert.match(
		INTERACTION_HOOK_SOURCE,
		/const interacting = interaction\.focused \|\| interaction\.pointer;/u,
	);
	assert.match(INTERACTION_HOOK_SOURCE, /onInteractionChangeRef\.current\?\.\(false\);/u);
});

test("the expanded header filter popover covers owner, agent, date, artifacts, and link suggestions", () => {
	assert.match(HEADER_SOURCE, /filter\?: ReactElement/u);
	assert.match(HEADER_SOURCE, /\{filter\}/u);
	assert.match(INDEX_SOURCE, /<AgentSessionColumnFilterMenu/u);
	assert.match(INDEX_SOURCE, /filter=\{filterMenu\}/u);
	assert.match(FILTER_MENU_SOURCE, /import FilterIcon from "@atlaskit\/icon\/core\/filter"/u);
	assert.match(FILTER_MENU_SOURCE, /data-agent-session-column-filter=""/u);
	assert.match(FILTER_MENU_SOURCE, /<Popover[\s>]/u);
	assert.match(FILTER_MENU_SOURCE, /title="Session owner"/u);
	assert.match(FILTER_MENU_SOURCE, /title="Agents"/u);
	assert.match(FILTER_SECTIONS_SOURCE, /title="Date\/time range"/u);
	assert.match(FILTER_SECTIONS_SOURCE, /"last-7-days": "Last 7d"/u);
	assert.match(FILTER_SECTIONS_SOURCE, /"last-30-days": "Last 30d"/u);
	assert.doesNotMatch(FILTER_SECTIONS_SOURCE, /Last 7 days/u);
	assert.doesNotMatch(FILTER_SECTIONS_SOURCE, /Last 30 days/u);
	assert.match(FILTER_MENU_SOURCE, /label="Contains artifacts"/u);
	assert.match(FILTER_MENU_SOURCE, /label="Link suggestions"/u);
	assert.match(FILTER_SOURCE, /name: "Claude"/u);
	assert.match(FILTER_SOURCE, /name: "Codex"/u);
	assert.match(FILTER_SOURCE, /name: "Cursor"/u);
	assert.match(FILTER_SOURCE, /name: "Copilot"/u);
	assert.match(FILTER_SECTIONS_SOURCE, /<SwitchIndicator/u);
	assert.match(FILTER_SECTIONS_SOURCE, /role="switch"/u);
	assert.match(FILTER_SECTIONS_SOURCE, /className="rich-text-command-menu-heading"/u);
	assert.match(FILTER_SECTIONS_SOURCE, /role="presentation"/u);
	assert.doesNotMatch(FILTER_SECTIONS_SOURCE, /uppercase leading-4/u);
	assert.match(FILTER_MENU_SOURCE, /w-max min-w-\[min\(20rem,calc\(100vw-32px\)\)\] max-w-\[calc\(100vw-32px\)\] gap-0 rounded-xl p-1/u);
	assert.doesNotMatch(FILTER_MENU_SOURCE, /className="w-80 max-w-\[calc\(100vw-32px\)\] p-3"/u);
	assert.doesNotMatch(FILTER_SECTIONS_SOURCE, /label="Yes"/u);
	assert.doesNotMatch(FILTER_SECTIONS_SOURCE, /label="No"/u);
	assert.doesNotMatch(FILTER_SECTIONS_SOURCE, /Clear \$\{title\}/u);
	assert.doesNotMatch(FILTER_MENU_SOURCE, /Clear all/u);
	assert.match(FILTER_MENU_SOURCE, /Clear selection/u);
	assert.match(FILTER_MENU_SOURCE, /dropdownStyles\.separator/u);
	assert.match(
		FILTER_MENU_SOURCE,
		/<div className="flex flex-col">\s*<div aria-hidden="true" className=\{dropdownStyles\.separator\}/u,
	);
	assert.match(FILTER_SECTIONS_SOURCE, /flex h-8 w-full cursor-pointer items-center gap-3 rounded-lg px-2/u);
	assert.match(FILTER_SOURCE, /agentSessionFilterToggleTriState/u);
	assert.match(HEADER_SOURCE, /hasActiveFilters/u);
	assert.match(INDEX_SOURCE, /hasActiveFilters=\{hasActiveFilters\}/u);
	assert.match(FILTER_SECTIONS_SOURCE, /<AvatarGroup/u);
	assert.match(FILTER_SECTIONS_SOURCE, /<TimePicker/u);
	assert.match(TIME_PICKER_SOURCE, /value=\{value \?\? ""\}/u);
	assert.match(FILTER_SECTIONS_SOURCE, /contentPositionerClassName="isolate z-\[220\]"/u);
	assert.match(FILTER_SECTIONS_SOURCE, /numberOfMonths=\{2\}/u);
	assert.match(FILTER_SECTIONS_SOURCE, /mode="range"/u);
	assert.match(FILTER_SECTIONS_SOURCE, /<PopoverTitle className="sr-only">Custom date range/u);
	assert.match(FILTER_MENU_SOURCE, /customCalendarOpen/u);
	assert.match(FILTER_MENU_SOURCE, /shouldKeepAgentSessionFilterMenuOpen/u);
	assert.match(FILTER_MENU_SOURCE, /focusOutStayedInside: didFilterFocusOutStayInside\(eventDetails\.event\)/u);
	assert.match(FILTER_MENU_SOURCE, /eventDetails\.cancel\(\)/u);
	assert.match(FILTER_SECTIONS_SOURCE, /flex flex-wrap gap-1\.5 pb-2 min-\[22rem\]:flex-nowrap/u);
	assert.match(FILTER_SECTIONS_SOURCE, /onCalendarOpenChange/u);
	assert.doesNotMatch(FILTER_MENU_SOURCE, /overflow-y-auto/u);
	assert.doesNotMatch(FILTER_MENU_SOURCE, /max-h-\[min\(36rem/u);
	assert.match(INDEX_SOURCE, /visibleItems: displayedItems/u);
});

test("hosts can omit the filter and overflow header actions", () => {
	assert.match(TYPES_SOURCE, /showFilter\?: boolean;/u);
	assert.match(TYPES_SOURCE, /showOverflow\?: boolean;/u);
	assert.match(INDEX_SOURCE, /showFilter = true,/u);
	assert.match(INDEX_SOURCE, /showOverflow = true,/u);
	// A hidden filter never scopes rows: agent-session-column-view.test.js.
	assert.match(INDEX_SOURCE, /const overflowMenu = showOverflow \? \(/u);
	assert.match(INDEX_SOURCE, /const filterMenu = showFilter \? \(/u);
	assert.match(INDEX_SOURCE, /filter=\{filterMenu\}/u);
	assert.match(INDEX_SOURCE, /overflow=\{overflowMenu\}/u);
	assert.match(HEADER_SOURCE, /filter\?: ReactElement/u);
	assert.match(HEADER_SOURCE, /overflow\?: ReactElement/u);
	assert.match(HEADER_SOURCE, /filter === undefined \? null : \(/u);
	assert.match(HEADER_SOURCE, /overflow === undefined \? null : overflow/u);
	assert.match(HEADER_SOURCE, /<CollapseButton/u);
	assert.match(DETAIL_SOURCE, /name: "showFilter"/u);
	assert.match(DETAIL_SOURCE, /name: "showOverflow"/u);
	assert.match(DETAIL_SOURCE, /default: "true"/u);
});

test("pin and collapsed menu are capabilities the host must supply", () => {
	assert.match(TYPES_SOURCE, /collapsedMenu\?: \(slot: \{ className: string; dragging: boolean \}\) => ReactNode;/u);
	assert.match(TYPES_SOURCE, /onPinnedChange\?: \(pinned: boolean\) => void;/u);
	assert.match(INDEX_SOURCE, /collapsedMenu === undefined/u);
	assert.match(INDEX_SOURCE, /onPinnedChange === undefined/u);
	assert.match(HEADER_SOURCE, /onPinToggle\?: \(\) => void;/u);
	assert.match(HEADER_SOURCE, /import PinIcon from "@atlaskit\/icon\/core\/pin";/u);
	assert.match(HEADER_SOURCE, /import PinFilledIcon from "@atlaskit\/icon\/core\/pin-filled";/u);
	assert.match(HEADER_SOURCE, /<PinGlyph label="" size="small" \/>/u);
	assert.match(HEADER_SOURCE, /data-agent-session-column-pin=""/u);
	assert.match(IN_FLOW_COLUMN_SOURCE, /InFlowAgentSessionColumnCollapsedMenu/u);
	assert.match(IN_FLOW_COLUMN_SOURCE, /onPinnedChange=\{onPinnedChange\}/u);
	assert.doesNotMatch(PANEL_DEMO_SOURCE, /onPinnedChange/u);
	assert.doesNotMatch(PANEL_DEMO_SOURCE, /collapsedMenu/u);
	assert.doesNotMatch(INDEX_SOURCE, /ExpandMoreHorizontalIcon/u);
	assert.doesNotMatch(IN_FLOW_COLUMN_SOURCE, /ExpandMoreHorizontalIcon/u);
	assert.doesNotMatch(IN_FLOW_COLUMN_SOURCE, /expand-more/u);
	assert.doesNotMatch(INDEX_SOURCE, /collapsedExpandAction/u);
	assert.match(DETAIL_SOURCE, /name: "collapsedMenu"/u);
	assert.match(DETAIL_SOURCE, /name: "onPinnedChange"/u);
});
