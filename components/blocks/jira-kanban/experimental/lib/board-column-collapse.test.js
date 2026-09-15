const assert = require("node:assert/strict");
const test = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const BOARD_SOURCE = readFileSync(
	join(__dirname, "../experimental-jira-kanban.tsx"),
	"utf8",
);
const IN_FLOW_SOURCE = readFileSync(
	join(__dirname, "../components/in-flow-agent-session-column.tsx"),
	"utf8",
);
const COLLAPSED_COLUMN_SOURCE = readFileSync(
	join(__dirname, "../components/collapsed-board-column.tsx"),
	"utf8",
) + readFileSync(
	join(__dirname, "../../../agent-session-column/collapsed-column-label.tsx"),
	"utf8",
);
const SESSION_COLUMN_PLACEMENT_SOURCE = readFileSync(
	join(__dirname, "../components/session-column-placement.tsx"),
	"utf8",
);
const V2_BOARD_SOURCE = readFileSync(
	join(__dirname, "../../experimental-v2/experimental-v2-jira-kanban.tsx"),
	"utf8",
);
const PAGE_SOURCE = readFileSync(join(__dirname, "../page.tsx"), "utf8");

const {
	BOARD_FIRST_COLLAPSED_COLUMN_INSET_PX,
	BOARD_COLUMN_COLLAPSED_WIDTH_PX,
	BOARD_COLUMN_WIDTH_PX,
	EMPTY_COLLAPSED_BOARD_COLUMNS,
	getBoardColumnOuterWidthPx,
	isBoardColumnCollapsed,
	resolveBoardColumnRowPaddingInlineStart,
	toggleCollapsedBoardColumn,
} = require("./board-column-collapse.ts");
const {
	resolveInFlowAgentSessionColumnGapPx,
	resolveInFlowAgentSessionColumnSlotWidthPx,
	resolveInFlowResizeHandleOffsetPx,
	resolveStatusColumnVisualGutterPx,
} = require("./in-flow-agent-session-column-geometry.ts");

test("toggling an expanded column collapses it without mutating the previous set", () => {
	const collapsed = toggleCollapsedBoardColumn(EMPTY_COLLAPSED_BOARD_COLUMNS, "In progress");

	assert.equal(isBoardColumnCollapsed(collapsed, "In progress"), true);
	assert.equal(EMPTY_COLLAPSED_BOARD_COLUMNS.size, 0);
});

test("toggling a collapsed column expands it again", () => {
	const collapsed = toggleCollapsedBoardColumn(EMPTY_COLLAPSED_BOARD_COLUMNS, "In progress");
	const expanded = toggleCollapsedBoardColumn(collapsed, "In progress");

	assert.equal(isBoardColumnCollapsed(expanded, "In progress"), false);
	assert.equal(isBoardColumnCollapsed(collapsed, "In progress"), true);
});

test("collapse state is per column", () => {
	let collapsed = toggleCollapsedBoardColumn(EMPTY_COLLAPSED_BOARD_COLUMNS, "In progress");
	collapsed = toggleCollapsedBoardColumn(collapsed, "Done");
	collapsed = toggleCollapsedBoardColumn(collapsed, "In progress");

	assert.equal(isBoardColumnCollapsed(collapsed, "In progress"), false);
	assert.equal(isBoardColumnCollapsed(collapsed, "Done"), true);
	assert.equal(isBoardColumnCollapsed(collapsed, "To do"), false);
});

test("outer width reserves the transparent drop-target border on both edges", () => {
	assert.equal(getBoardColumnOuterWidthPx(false), BOARD_COLUMN_WIDTH_PX + 4);
	assert.equal(getBoardColumnOuterWidthPx(true), BOARD_COLUMN_COLLAPSED_WIDTH_PX + 4);
	assert.equal(getBoardColumnOuterWidthPx(false), 280);
	assert.equal(getBoardColumnOuterWidthPx(true), 36);
});

test("the first collapsed column restores the simple chrome content inset", () => {
	assert.equal(BOARD_FIRST_COLLAPSED_COLUMN_INSET_PX, 4);
	assert.equal(
		resolveBoardColumnRowPaddingInlineStart("24px", "To do", true, new Set(["To do"])),
		`calc(24px + ${BOARD_FIRST_COLLAPSED_COLUMN_INSET_PX}px)`,
	);
	assert.equal(
		resolveBoardColumnRowPaddingInlineStart("24px", "To do", true, EMPTY_COLLAPSED_BOARD_COLUMNS),
		"24px",
	);
	assert.equal(
		resolveBoardColumnRowPaddingInlineStart("24px", "To do", false, new Set(["To do"])),
		"24px",
	);
	assert.match(
		BOARD_SOURCE,
		/const resolvedColumnRowPaddingInlineStart = resolveBoardColumnRowPaddingInlineStart\(columnRowPaddingInlineStart, boardColumns\[0\]\?\.title, Boolean\(chrome\.dropContentPadding\), collapsedColumns\);/u,
	);
});

test("collapse survives a switch to the list or Pulse view", () => {
	// The page renders the board in a ternary beside Pulse and the list, so a
	// view switch unmounts it. Collapse is a deliberate viewer choice, so the
	// state lives above that branch and the board accepts it as controlled.
	assert.match(BOARD_SOURCE, /collapsedColumns\?: CollapsedBoardColumns;/u);
	assert.match(BOARD_SOURCE, /onCollapsedColumnsChange\?: \(collapsedColumns: CollapsedBoardColumns\) => void;/u);
	assert.match(BOARD_SOURCE, /const collapsedColumns = controlledCollapsedColumns \?\? uncontrolledCollapsedColumns;/u);
	// A controlled host stays the single source of truth.
	assert.match(BOARD_SOURCE, /if \(controlledCollapsedColumns === undefined\) \{/u);
	// The page that owns the view switch owns the state.
	assert.match(PAGE_SOURCE, /const \[collapsedColumns, setCollapsedColumns\] = useState\(\s*EMPTY_COLLAPSED_BOARD_COLUMNS,?\s*\)/u);
	assert.match(PAGE_SOURCE, /collapsedColumns=\{displayedCollapsedColumns\}/u);
	assert.match(PAGE_SOURCE, /onCollapsedColumnsChange=\{handleCollapsedColumnsChange\}/u);
	assert.match(PAGE_SOURCE, /useAgentFilterDisplay\(/u);
	assert.match(
		PAGE_SOURCE,
		/const \[agentFilterId, setAgentFilterId\] = useState<BoardAgentFilterId \| null>\(null\)/u,
	);
	assert.match(
		PAGE_SOURCE,
		/<ExperimentalJiraKanbanBoardHeader[\s\S]*agentFilterId=\{agentFilterId\}[\s\S]*onAgentFilterIdChange=\{handleAgentFilterChange\}/u,
	);
	// The header writes through a handler, but the state it writes is still the
	// page-owned one that outlives the view branch.
	assert.match(PAGE_SOURCE, /const handleAgentFilterChange = \([\s\S]*?setAgentFilterId\(nextAgentFilterId\)/u);
	assert.match(PAGE_SOURCE, /setFocusedCollapsedColumns\(null\);[\s\S]*?setAgentFilterId\(nextAgentFilterId\)/u);
	assert.match(
		PAGE_SOURCE,
		/const handleCollapsedColumnsChange = \(nextCollapsedColumns: CollapsedBoardColumns\) => \{[\s\S]*?agentFilterId === null[\s\S]*?setCollapsedColumns\(nextCollapsedColumns\)[\s\S]*?setFocusedCollapsedColumns\(nextCollapsedColumns\)/u,
	);
});

test("the resize button swaps its icon without using selected button state", () => {
	const resizeButtonStart = COLLAPSED_COLUMN_SOURCE.indexOf("function BoardColumnResizeButton");
	const resizeButtonEnd = COLLAPSED_COLUMN_SOURCE.indexOf("/**", resizeButtonStart);
	const resizeButtonSource = COLLAPSED_COLUMN_SOURCE.slice(resizeButtonStart, resizeButtonEnd);

	assert.match(resizeButtonSource, /collapsed\s*\?\s*<GrowHorizontalIcon label="" size="small"/u);
	assert.match(resizeButtonSource, /:\s*<ShrinkHorizontalIcon label="" size="small"/u);
	assert.match(
		resizeButtonSource,
		/aria-label=\{collapsed \? `Expand \$\{title\} column` : `Collapse \$\{title\} column`\}/u,
	);
	assert.match(
		resizeButtonSource,
		/<TooltipContent>\{collapsed \? "Expand" : "Collapse"\}<\/TooltipContent>/u,
	);
	assert.doesNotMatch(resizeButtonSource, /"Expand column"|"Collapse column"/u);
	assert.doesNotMatch(resizeButtonSource, /aria-(?:expanded|pressed)=/u);
	assert.doesNotMatch(resizeButtonSource, /pt-\d|pb-\d/u);
});

test("the pinned session column shares the status columns' box model", () => {
	// Status columns carry a 2px transparent drop-target border, so the pinned
	// surface keeps top/left/bottom and drops the right edge. The surface is
	// absolutely positioned so its gutter state does not push board content;
	// the column itself remains the Untracked drop zone and lights when armed.
	assert.match(
		IN_FLOW_SOURCE,
		/className=\{cn\(\s*"group\/in-flow-agent-session-column absolute inset-y-0 start-0 z-40 flex min-h-0 items-start border-2 border-r-0",[\s\S]*?untrackedDropArmed \? "border-ring" : "border-transparent",[\s\S]*?className,\s*\)\}/u,
	);
	assert.match(IN_FLOW_SOURCE, /data-board-agent-session-drop-zone="untracked"/u);
});

test("the expanded pinned session column reuses the accessible sidebar resize contract", () => {
	const resizeClassStart = IN_FLOW_SOURCE.indexOf(
		"const IN_FLOW_AGENT_SESSION_COLUMN_RESIZE_HANDLE_CLASS_NAME",
	);
	const resizeClassEnd = IN_FLOW_SOURCE.indexOf(
		"export interface InFlowAgentSessionColumnProps",
		resizeClassStart,
	);
	const resizeClassSource = IN_FLOW_SOURCE.slice(resizeClassStart, resizeClassEnd);

	assert.match(
		IN_FLOW_SOURCE,
		/import \{ useSidebarResize \} from "@\/components\/projects\/rovo-core\/hooks\/use-sidebar-resize";/u,
	);
	assert.match(
		IN_FLOW_SOURCE,
		/from "\.\.\/lib\/in-flow-agent-session-column-geometry"/u,
	);
	assert.match(IN_FLOW_SOURCE, /const IN_FLOW_AGENT_SESSION_COLUMN_MAX_WIDTH_PX = 560;/u);
	assert.match(resizeClassSource, /right-auto -translate-x-1\/2/u);
	assert.match(
		resizeClassSource,
		/bg-transparent! hover:bg-transparent! data-\[active\]:bg-transparent! focus-visible:bg-transparent!/u,
	);
	assert.match(resizeClassSource, /\[&>div\]:h-16/u);
	assert.match(
		resizeClassSource,
		/group-hover\/in-flow-agent-session-column:\[&>div\]:opacity-100 hover:\[&>div\]:scale-105/u,
	);
	assert.match(resizeClassSource, /data-\[active\]:\[&>div\]:scale-105/u);
	assert.match(resizeClassSource, /focus-visible:\[&>div\]:scale-105/u);
	assert.match(resizeClassSource, /motion-reduce:\[&>div\]:scale-100/u);
	assert.match(
		IN_FLOW_SOURCE,
		/const transition = shouldReduceMotion \|\| isResizing[\s\S]*const expansionTransition = shouldReduceMotion \|\| isResizing/u,
	);
	assert.match(IN_FLOW_SOURCE, /data-agent-session-column-footprint="width"/u);
	assert.match(IN_FLOW_SOURCE, /widthTransitionDisabled=\{resize\.isResizing\}/u);
	assert.match(IN_FLOW_SOURCE, /isResizing=\{resize\.isResizing\}/u);
	assert.match(
		IN_FLOW_SOURCE,
		/useSidebarResize\(\{[\s\S]*defaultWidth: agentSessionColumn\.expandedWidthPx \?\? AGENT_SESSION_COLUMN_WIDTH_PX,[\s\S]*maxWidth: IN_FLOW_AGENT_SESSION_COLUMN_MAX_WIDTH_PX,[\s\S]*minWidth: AGENT_SESSION_COLUMN_WIDTH_PX,[\s\S]*minWidthResistance: true,/u,
	);
	assert.match(
		IN_FLOW_SOURCE,
		/function InFlowAgentSessionColumnResizeHandle[\s\S]*<SidebarResizeHandle[\s\S]*aria-label=\{`Resize \$\{title\} column`\}[\s\S]*aria-valuemax=\{resize\.maxWidth\}[\s\S]*aria-valuemin=\{resize\.minWidth\}[\s\S]*aria-valuenow=\{expandedWidthPx\}[\s\S]*className=\{IN_FLOW_AGENT_SESSION_COLUMN_RESIZE_HANDLE_CLASS_NAME\}[\s\S]*onKeyDown=\{resize\.onResizeHandleKeyDown\}[\s\S]*onPointerDown=\{resize\.onResizeHandlePointerDown\}[\s\S]*role="separator"[\s\S]*side="right"[\s\S]*left: `calc\(100% \+ \$\{resolveInFlowResizeHandleOffsetPx\(columnFrame\)\}px\)`[\s\S]*right: "auto"[\s\S]*tabIndex=\{0\}/u,
	);
});

test("Untracked trailing geometry matches painted status-column gutters", () => {
	assert.equal(resolveStatusColumnVisualGutterPx("caption"), 20);
	assert.equal(resolveInFlowAgentSessionColumnGapPx("caption"), 20);
	assert.equal(resolveInFlowResizeHandleOffsetPx("caption"), 10);
	assert.equal(resolveStatusColumnVisualGutterPx("enclosed"), 12);
	assert.equal(resolveInFlowAgentSessionColumnGapPx("enclosed"), 10);
	assert.equal(resolveInFlowResizeHandleOffsetPx("enclosed"), 6);
});

test("a repositioned session column balances the visual gutter on both sides", () => {
	assert.equal(resolveInFlowAgentSessionColumnSlotWidthPx(32), 42);
	assert.equal(resolveInFlowAgentSessionColumnSlotWidthPx(280), 290);
	assert.match(
		SESSION_COLUMN_PLACEMENT_SOURCE,
		/width: resolveInFlowAgentSessionColumnSlotWidthPx\(placement\.width\)/u,
	);
});

test("a collapsed status pill hugs its label while the shell keeps the drop lane", () => {
	const pillStart = COLLAPSED_COLUMN_SOURCE.indexOf("function CollapsedBoardColumn");
	const pillEnd = COLLAPSED_COLUMN_SOURCE.length;
	assert.ok(pillStart !== -1, "expected to find CollapsedBoardColumn");
	const pillSource = COLLAPSED_COLUMN_SOURCE.slice(pillStart, pillEnd);

	// A status is a label. Stretched down a 700px board it reads as an empty
	// lane with a caption on top, so the pill sizes to its own content. The
	// Agent Session column is the deliberate exception — it collapses into a
	// rail of notches, which is content, and keeps `h-full`.
	assert.doesNotMatch(pillSource, /(?:^|[^-\w])h-full\b/u);
	// The shell around it still stretches, so a collapsed column is as easy to
	// drop onto as an expanded one. `min-h-full` on the row is the shell, not
	// the pill — do not treat that as the pill stretching. The row's resolved
	// inset keeps visible simple-column content on the 24px header line.
	assert.match(
		BOARD_SOURCE,
		/className="flex min-h-full w-max min-w-full items-stretch"\s*style=\{\{ paddingInlineStart: resolvedColumnRowPaddingInlineStart \}\}/u,
	);

	// The expand control's focus ring extends 3px past a 24px button, which is
	// exactly the 30px inside this 32px pill's border. Clipping to the padding
	// box slices the ring flat on both sides, and nothing in the pill can
	// overflow anyway — the title carries its own `truncate`.
	assert.doesNotMatch(pillSource, /overflow-hidden/u);
	assert.match(pillSource, /min-h-0 truncate/u);
	// The shell still clips for the width transition, which is what that
	// `overflow-hidden` was ever needed for.
	assert.match(BOARD_SOURCE, /collapsed \|\| isResizing \? "overflow-hidden" : "overflow-visible"/u);
});

test("caption chrome keeps the collapsed count above the pill border", () => {
	const captionStart = COLLAPSED_COLUMN_SOURCE.indexOf('case "caption":');
	const enclosedStart = COLLAPSED_COLUMN_SOURCE.indexOf('case "enclosed":');
	assert.ok(captionStart !== -1, "expected a caption branch");
	assert.ok(enclosedStart > captionStart, "expected enclosed after caption");
	const captionSource = COLLAPSED_COLUMN_SOURCE.slice(captionStart, enclosedStart);

	assert.match(captionSource, /paddingBottom: chrome\.captionPaddingBottom/u);
	assert.match(COLLAPSED_COLUMN_SOURCE, /relative flex h-6 w-full items-center justify-center/u);
	const countRowIndex = captionSource.indexOf("{countRow}");
	const pillClassIndex = captionSource.indexOf("chrome.pillClassName");
	const writingModeIndex = COLLAPSED_COLUMN_SOURCE.indexOf("[writing-mode:vertical-rl]");
	assert.ok(
		countRowIndex > 0 && pillClassIndex > countRowIndex,
		"expected the count above the pill paint",
	);
	assert.ok(writingModeIndex > 0, "expected the rotated title");
	assert.match(captionSource, /style=\{pillStyle\}/u);
	assert.match(captionSource, /flex-col items-center justify-center/u);
	assert.doesNotMatch(captionSource, /paddingBlockStart: token\("space\.150"\)/u);
	assert.doesNotMatch(captionSource, /paddingBlockEnd: token\("space\.050"\)/u);
});

test("enclosed chrome puts the collapsed count inside the framed box", () => {
	const enclosedStart = COLLAPSED_COLUMN_SOURCE.indexOf('case "enclosed":');
	assert.ok(enclosedStart !== -1, "expected an enclosed branch");
	const enclosedSource = COLLAPSED_COLUMN_SOURCE.slice(enclosedStart);

	const pillClassIndex = enclosedSource.indexOf("chrome.pillClassName");
	const countRowIndex = enclosedSource.indexOf("{countRow}");
	const titleIndex = enclosedSource.indexOf("{titleLabel}");
	assert.ok(pillClassIndex > 0, "expected pill paint on the framed box");
	assert.ok(
		countRowIndex > pillClassIndex,
		"expected the count inside the framed box",
	);
	assert.ok(
		titleIndex > countRowIndex,
		"expected the rotated title after the count, still inside the box",
	);
	assert.match(enclosedSource, /paddingBlock: chrome\.pillPaddingBlock/u);
	assert.match(enclosedSource, /paddingTop: chrome\.countPaddingTop/u);
	assert.ok(
		enclosedSource.indexOf("paddingTop: chrome.countPaddingTop") < countRowIndex,
		"expected the expanded-header inset above the count",
	);
	assert.ok(
		enclosedSource.indexOf("paddingBlock: chrome.pillPaddingBlock") > countRowIndex,
		"expected title padding below the count so the number shares Untracked's 24px slot",
	);
	assert.doesNotMatch(enclosedSource, /captionPaddingBottom/u);
	assert.doesNotMatch(enclosedSource, /overflow-hidden/u);
	assert.match(COLLAPSED_COLUMN_SOURCE, /chrome: KanbanCollapsedChromeStyles/u);
	assert.match(COLLAPSED_COLUMN_SOURCE, /headerFrame: AgentSessionColumnFrame/u);
	assert.match(
		BOARD_SOURCE,
		/chrome=\{chrome\.collapsed\}[\s\S]*headerFrame=\{chrome\.headerFrame\}/u,
	);
	assert.match(BOARD_SOURCE, /data-kanban-column-chrome=\{columnChrome\}/u);
	assert.match(BOARD_SOURCE, /chrome\.dropShellClassName/u);
	assert.match(BOARD_SOURCE, /setKanbanColumnDropArmed/u);
	assert.match(BOARD_SOURCE, /withKanbanDropRingClipGutter\(paddingTop, chrome\)/u);
	assert.match(BOARD_SOURCE, /withKanbanDropContentGutter\(paddingTop, chrome\)/u);
	assert.match(BOARD_SOURCE, /paddingTop: scrollportPaddingTop/u);
	assert.match(BOARD_SOURCE, /paddingTop=\{untrackedPaddingTop\}/u);
	assert.match(readFileSync(join(__dirname, "../components/board-column.tsx"), "utf8"), /\.\.\.chrome\.dropContentPadding,/u);
	assert.match(
		BOARD_SOURCE,
		/collapsed \? \(\s*<div style=\{\{ paddingTop: chrome\.dropContentPadding\?\.paddingTop \}\}>/u,
	);
});

test("experimental-v2 reuses the shared collapsed column and threads chrome", () => {
	assert.match(
		V2_BOARD_SOURCE,
		/from "\.\.\/experimental\/components\/collapsed-board-column"/u,
		"experimental-v2 must reuse the extracted collapsed column, not fork another copy",
	);
	assert.match(
		V2_BOARD_SOURCE,
		/chrome=\{chrome\.collapsed\}[\s\S]*headerFrame=\{chrome\.headerFrame\}/u,
	);
	assert.match(V2_BOARD_SOURCE, /data-kanban-column-chrome=\{columnChrome\}/u);
	assert.match(V2_BOARD_SOURCE, /chrome\.dropShellClassName/u);
	assert.match(V2_BOARD_SOURCE, /setKanbanColumnDropArmed/u);
	assert.match(V2_BOARD_SOURCE, /withKanbanDropRingClipGutter\(paddingTop, chrome\)/u);
	assert.match(V2_BOARD_SOURCE, /withKanbanDropContentGutter\(paddingTop, chrome\)/u);
	assert.match(V2_BOARD_SOURCE, /paddingTop: scrollportPaddingTop/u);
	assert.match(V2_BOARD_SOURCE, /paddingTop=\{untrackedPaddingTop\}/u);
	assert.match(V2_BOARD_SOURCE, /\.\.\.chrome\.dropContentPadding,/u);
	assert.match(
		V2_BOARD_SOURCE,
		/collapsed \? \(\s*<div style=\{\{ paddingTop: chrome\.dropContentPadding\?\.paddingTop \}\}>/u,
	);
	assert.doesNotMatch(V2_BOARD_SOURCE, /function CollapsedBoardColumn/u);
});

test("simple Untracked gutter keeps identical padding in Board and List", () => {
	assert.match(
		PAGE_SOURCE,
		/paddingTop=\{withKanbanDropContentGutter\(0, columnChromeStyles\)\.paddingTop\}/u,
	);
	assert.doesNotMatch(
		PAGE_SOURCE,
		/paddingTop=\{isListContent/u,
	);
});
