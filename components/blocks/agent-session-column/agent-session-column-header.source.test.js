const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const HEADER_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-header.tsx"),
	"utf8",
);
const SELECT_MARK_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-select-mark.tsx"),
	"utf8",
);
const SELECTION_COPY_SOURCE = readFileSync(
	join(__dirname, "untracked-selection.ts"),
	"utf8",
);
const SELECTION_HOOK_SOURCE = readFileSync(
	join(__dirname, "use-untracked-selection.ts"),
	"utf8",
);

test("selecting a session slides in the shared filled success select-all control", () => {
	assert.match(HEADER_SOURCE, /import StatusSuccessIcon from "@atlaskit\/icon\/core\/status-success";/u);
	assert.match(HEADER_SOURCE, /render=\{<StatusSuccessIcon label="" \/>\}/u);
	assert.match(HEADER_SOURCE, /className="text-icon-selected"/u);
	assert.match(SELECT_MARK_SOURCE, /import StatusSuccessIcon from "@atlaskit\/icon\/core\/status-success";/u);
	assert.match(SELECT_MARK_SOURCE, /<Icon render=\{<StatusSuccessIcon label="" \/>\} \/>/u);
	assert.doesNotMatch(HEADER_SOURCE, /import CheckCircleIcon from "@atlaskit\/icon\/core\/check-circle";/u);
	assert.doesNotMatch(HEADER_SOURCE, /CheckCircleUncheckedIcon/u);
	assert.match(HEADER_SOURCE, /transition-\[width,margin\] duration-normal ease-in-out/u);
	assert.match(HEADER_SOURCE, /motion-reduce:transition-none/u);
	assert.match(HEADER_SOURCE, /inert=\{!expanded\}/u);
	assert.match(HEADER_SOURCE, /aria-hidden=\{expanded \? undefined : true\}/u);
	assert.match(HEADER_SOURCE, /onAction\("select-all"\)/u);
	assert.match(HEADER_SOURCE, /case "enclosed":\s*\n\s*return "ms-2 me-4 w-6 has-\[:focus-visible\]:overflow-visible";/u);
	assert.match(HEADER_SOURCE, /case "caption":\s*\n\s*return "ms-5 me-4 w-6 has-\[:focus-visible\]:overflow-visible";/u);
	assert.match(HEADER_SOURCE, /pointer-events-none ms-0 me-0 w-0/u);
	assert.doesNotMatch(HEADER_SOURCE, /me-1\.5 w-6/u);
	assert.match(HEADER_SOURCE, /\[&>span:last-child\]:pl-4/u);
	assert.match(SELECTION_COPY_SOURCE, /select: "Select all"/u);
	assert.match(SELECTION_COPY_SOURCE, /deselect: "Deselect all"/u);
	assert.doesNotMatch(HEADER_SOURCE, /select-all: CheckCircle/u);
	assert.match(SELECTION_HOOK_SOURCE, /id === "select-all"/u);
	assert.match(SELECTION_HOOK_SOURCE, /type: "select-all"/u);
	assert.match(SELECTION_HOOK_SOURCE, /dispatch\(\{ type: "clear" \}\)/u);
});

test("the selecting header omits collapse so Clear and Deselect all can exit", () => {
	const columnChrome = HEADER_SOURCE.slice(
		HEADER_SOURCE.indexOf("function renderColumnChrome"),
		HEADER_SOURCE.indexOf("function renderPanelChrome"),
	);
	assert.equal([...columnChrome.matchAll(/\{filter\}/g)].length, 1);
	assert.match(columnChrome, /hasActiveFilters/u);
	assert.match(columnChrome, /revealHeaderActions/u);
	assert.match(columnChrome, /headerActionsClass/u);
	assert.match(HEADER_SOURCE, /group\/header-actions/u);
	assert.match(HEADER_SOURCE, /w-0/u);
	assert.match(HEADER_SOURCE, /group-has-\[\[data-popup-open\]\]\/header-actions:opacity-100/u);
	assert.match(columnChrome, /<SelectAllSlot/u);
	assert.match(
		columnChrome,
		/isSelecting \? \([\s\S]*<HeaderIconButton[\s\S]*\) : \([\s\S]*<CollapseButton/u,
	);
	const panelSelecting = HEADER_SOURCE.slice(HEADER_SOURCE.indexOf("function renderPanelChrome"));
	const panelSelectingBranch = panelSelecting.slice(panelSelecting.lastIndexOf('case "selecting":'));
	assert.doesNotMatch(panelSelectingBranch, /ShrinkHorizontalIcon/u);
	assert.match(panelSelectingBranch, /<SelectAllButton/u);
	assert.match(panelSelectingBranch, /<PanelAction/u);
});

test("an open or selected filter reveals the whole header action cluster", () => {
	assert.match(HEADER_SOURCE, /hasActiveFilters\?: boolean/u);
	assert.match(HEADER_SOURCE, /const revealHeaderActions = \(hasActiveFilters \|\| pinned\) && !isSelecting/u);
	assert.match(HEADER_SOURCE, /const HEADER_ACTIONS_VISIBLE/u);
	assert.match(HEADER_SOURCE, /const HEADER_ACTIONS_REVEAL/u);
	assert.doesNotMatch(HEADER_SOURCE, /HEADER_ACTIONS_PINNED/u);
	assert.match(HEADER_SOURCE, /group\/header-actions/u);
	assert.match(
		HEADER_SOURCE,
		/const headerActionsClass = revealHeaderActions\s*\n?\s*\? HEADER_ACTIONS_VISIBLE\s*\n?\s*: HEADER_ACTIONS_REVEAL/u,
	);
	assert.match(
		HEADER_SOURCE,
		/filter === undefined \? null : \(\s*<div className=\{headerActionsClass\}>\s*\{filter\}/u,
	);
	assert.match(
		HEADER_SOURCE,
		/className=\{headerActionsClass\}\s*\n?\s*data-session-header-reveal=""/u,
	);
	assert.match(HEADER_SOURCE, /has-\[\[data-popup-open\]\]:opacity-100/u);
	assert.match(HEADER_SOURCE, /group-has-\[\[data-popup-open\]\]\/header-actions:opacity-100/u);
	assert.match(HEADER_SOURCE, /group-hover\/session-column:opacity-100/u);
	assert.doesNotMatch(HEADER_SOURCE, /group-hover\/session-column:w-12/u);
	assert.match(HEADER_SOURCE, /flex-nowrap/u);
	assert.match(HEADER_SOURCE, /motion-reduce:transition-none/u);
});

test("omitting filter or overflow does not leave an empty hover-reveal slot", () => {
	assert.match(HEADER_SOURCE, /filter\?: ReactElement/u);
	assert.match(HEADER_SOURCE, /overflow\?: ReactElement/u);
	assert.match(
		HEADER_SOURCE,
		/filter === undefined \? null : \(\s*<div className=\{headerActionsClass\}>\s*\{filter\}/u,
	);
	assert.match(HEADER_SOURCE, /overflow === undefined \? null : overflow/u);
	assert.match(HEADER_SOURCE, /<CollapseButton label=\{collapseLabel\} onCollapse=\{onCollapse\} \/>/u);
});

test("the pin control renders only when the host supplies onPinToggle", () => {
	assert.match(HEADER_SOURCE, /onPinToggle\?: \(\) => void;/u);
	assert.match(HEADER_SOURCE, /pinLabel\?: string;/u);
	assert.match(
		HEADER_SOURCE,
		/const pinControl = onPinToggle === undefined \|\| pinLabel === undefined\s*\? null/u,
	);
	assert.match(HEADER_SOURCE, /aria-label=\{label\}/u);
	assert.match(HEADER_SOURCE, /data-agent-session-column-pin=""/u);
	assert.match(HEADER_SOURCE, /\{pinned \? "Unpin" : "Pin"\}/u);
	assert.match(HEADER_SOURCE, /const PinGlyph = pinned \? PinFilledIcon : PinIcon;/u);
	assert.match(HEADER_SOURCE, /<PinGlyph label="" size="small" \/>/u);
	const panelChrome = HEADER_SOURCE.slice(HEADER_SOURCE.indexOf("function renderPanelChrome"));
	assert.doesNotMatch(panelChrome, /onPinToggle/u);
	assert.doesNotMatch(panelChrome, /PinButton/u);
});
