const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

// The JiraList block is split across focused sibling modules (DnD geometry,
// presentational cells, and interactive rows). Behavior-contract assertions
// below grep the module as a whole, so SOURCE concatenates every file that
// owns part of that contract rather than a single file.
const SOURCE = [
	"index.tsx",
	"jira-list-base-columns.tsx",
	"jira-list-dnd.ts",
	"jira-list-row-zone.js",
	"jira-list-cell-data.ts",
	"jira-list-cells.tsx",
	"jira-list-column-model.tsx",
	"jira-list-rows.tsx",
].map((file) => readFileSync(join(__dirname, file), "utf8")).join("\n");
const CELLS_SOURCE = readFileSync(join(__dirname, "jira-list-cells.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "jira-list-types.ts"), "utf8");
const COLUMN_CONTROLS_SOURCE = readFileSync(
	join(__dirname, "jira-list-column-controls.tsx"),
	"utf8",
);
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const FOR_YOU_STAGE_SOURCE = readFileSync(
	join(
		process.cwd(),
		"components/projects/jira-golden-journeys-v1/components/for-you-stage.tsx",
	),
	"utf8",
);
const DATA_SOURCE = readFileSync(join(__dirname, "data.ts"), "utf8");
const DETAILS_SOURCE = readFileSync(
	join(process.cwd(), "app/data/details/blocks/jira-list.ts"),
	"utf8",
);
const REGISTRY_SOURCE = readFileSync(
	join(process.cwd(), "components/website/registry/blocks.ts"),
	"utf8",
);
const COMPONENTS_SOURCE = readFileSync(
	join(process.cwd(), "app/data/components.ts"),
	"utf8",
);
const MANIFEST_SOURCE = readFileSync(
	join(process.cwd(), "app/data/component-manifest.ts"),
	"utf8",
);
const GLOBALS_SOURCE = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

test("JiraList demo preserves the rounded docs frame without adding another scroll owner", () => {
	assert.match(PAGE_SOURCE, /rounded-lg bg-surface p-4 md:p-5/u);
	assert.doesNotMatch(PAGE_SOURCE, /overflow-x-auto/u);
	assert.doesNotMatch(PAGE_SOURCE, /\bh-full\b|min-h-\[640px\]/u);
});

test("JiraList keeps the footer outside the table scroll coordinate space", () => {
	const tableScrollMarker = SOURCE.indexOf('data-testid="jira-list-table-scroll"');
	const tableScrollStart = SOURCE.lastIndexOf("<div", tableScrollMarker);
	const tableStart = SOURCE.indexOf("<Table", tableScrollStart);
	const tableEnd = SOURCE.indexOf("</Table>", tableStart);
	const tableScrollEnd = SOURCE.indexOf("</div>", tableEnd);
	const footerStart = SOURCE.indexOf('data-testid="jira-list-sticky-footer"');

	assert.ok(tableScrollStart > -1);
	assert.ok(tableStart > tableScrollStart);
	assert.ok(tableEnd > tableStart);
	assert.ok(tableScrollEnd > tableEnd);
	assert.ok(footerStart > tableScrollEnd);
	assert.match(
		SOURCE.slice(tableScrollStart, tableStart),
		/min-h-0 flex-1 overflow-auto/u,
	);
	assert.doesNotMatch(
		SOURCE.slice(footerStart, SOURCE.indexOf("</section>", footerStart)),
		/min-w-\[1594px\]|overflow-(?:x-)?auto/u,
	);
});

test("JiraList restores the rounded table edge before a trailing panel scroll inset", () => {
	const componentStart = SOURCE.indexOf("export function JiraList(");
	const componentSource = SOURCE.slice(
		componentStart,
		SOURCE.indexOf("\n}\n", componentStart),
	);

	assert.match(SOURCE, /function getJiraListTrailingEdgeLayout\(/u);
	assert.match(SOURCE, /if \(scrollEndInset > 0\)/u);
	assert.match(
		SOURCE,
		/rounded-xl border-x border-b border-border[\s\S]*?trailingEdgeLayout\.frameTopBorderClassName/u,
	);
	assert.match(
		SOURCE,
		/headerCellClassName: cn\(HEADER_CELL_CLASS, "border-t"\)/u,
	);
	assert.match(
		SOURCE,
		/trailingEdgeLayout\.headerCellClassName,\s*"sticky left-0 z-30 px-0"/u,
	);
	assert.match(
		SOURCE,
		/lastHeaderCellClassName: "rounded-tr-xl"/u,
	);
	assert.match(
		SOURCE,
		/lastHeaderCellClassName: "border-r-0"/u,
	);
	assert.match(
		SOURCE,
		/isLastColumn:\s*columnIndex === trailingEdgeLayout\.lastBodyColumnIndex/u,
	);
	assert.match(SOURCE, /lastBodyColumnIndex: null/u);
	assert.match(SOURCE, /function getJiraListLastHeaderCellClassName\(/u);
	assert.match(SOURCE, /if \(columnIndex !== columnCount - 1\)/u);
	assert.match(
		SOURCE,
		/getJiraListLastHeaderCellClassName\(\s*trailingEdgeLayout,\s*columnIndex,\s*orderedColumns\.length/u,
	);
	assert.doesNotMatch(componentSource, /if \(scrollEndInset > 0\)/u);
	assert.doesNotMatch(componentSource, /isLastColumn && trailingEdgeLayout/u);
	assert.doesNotMatch(
		SOURCE,
		/rounded-xl border border-border bg-surface/u,
	);
	assert.doesNotMatch(SOURCE, /scrollEndInset > 0 \? "border-l border-border" : null/u);
});

test("JiraList dissolves overflowing rows under the sticky header", () => {
	const tableScrollMarker = SOURCE.indexOf('data-testid="jira-list-table-scroll"');
	const tableScrollStart = SOURCE.lastIndexOf("<div", tableScrollMarker);
	const tableEnd = SOURCE.indexOf("</Table>", SOURCE.indexOf("<Table", tableScrollStart));
	const tableScrollEnd = SOURCE.indexOf("</div>", tableEnd);
	const footerStart = SOURCE.indexOf('data-testid="jira-list-sticky-footer"');
	const overlayBand = SOURCE.slice(tableScrollEnd, footerStart);

	assert.match(
		SOURCE,
		/showBottomScrollMask,\s*showTopScrollMask,\s*\} = useHasVerticalOverflow/u,
	);
	assert.match(
		overlayBand,
		/<ScrollMaskEdgeOverlay[\s\S]*className="top-10 z-20"[\s\S]*data-testid="jira-list-scroll-fade-top"[\s\S]*edge="top"/u,
	);
	assert.match(
		overlayBand,
		/<ScrollMaskEdgeOverlay[\s\S]*data-testid="jira-list-scroll-fade"[\s\S]*edge="bottom"/u,
	);
	assert.doesNotMatch(SOURCE, /StickyRowScrollFade/u);
	assert.doesNotMatch(SOURCE, /buildScrollMaskStyle/u);
});

test("JiraList frame constrains vertical overflow while preserving 40px footer geometry", () => {
	const frameStart = SOURCE.indexOf('data-testid="jira-list"');
	const tableScrollMarker = SOURCE.indexOf('data-testid="jira-list-table-scroll"');
	const tableScrollStart = SOURCE.lastIndexOf("<div", tableScrollMarker);
	const footerMarker = SOURCE.indexOf('data-testid="jira-list-sticky-footer"');
	const footerStart = SOURCE.lastIndexOf("<div", footerMarker);

	assert.match(SOURCE.slice(0, frameStart), /flex max-h-\[640px\] flex-col/u);
	assert.match(
		SOURCE.slice(tableScrollStart, footerStart),
		/min-h-0 flex-1 overflow-auto/u,
	);
	assert.match(
		SOURCE.slice(footerStart, SOURCE.indexOf("</section>", footerStart)),
		/sticky bottom-0[\s\S]*?h-10 min-h-10[\s\S]*?shrink-0/u,
	);
	// Strip line comments first: the frame documents the `h-full` trap it is
	// guarding against, and the guard should police classes, not prose.
	assert.doesNotMatch(
		SOURCE.slice(0, SOURCE.indexOf("</section>", footerStart)).replace(/^\s*\/\/.*$/gmu, ""),
		/\bh-full\b|min-h-\[640px\]/u,
	);
});

test("JiraList sticky footer matches its 8px control gap at both horizontal edges", () => {
	const footerMarker = SOURCE.indexOf('data-testid="jira-list-sticky-footer"');
	const footerStart = SOURCE.lastIndexOf("<div", footerMarker);
	const footerSource = SOURCE.slice(footerStart, footerMarker);

	assert.match(footerSource, /\bpx-2\b/u);
	assert.match(footerSource, /\bpy-1\b/u);
});

test("JiraList draft actions preserve an 8px gap around Create", () => {
	const editorStart = SOURCE.indexOf("const renderDraftWorkItemEditor");
	const editorEnd = SOURCE.indexOf("const renderDraftWorkItemRow", editorStart);
	const editorSource = SOURCE.slice(editorStart, editorEnd);

	assert.match(editorSource, /flex min-w-0 items-center gap-2/u);
	assert.match(editorSource, /ml-auto flex shrink-0 items-center gap-2/u);
});

test("JiraList issue type glyphs retain Jira colors inside dropdown items", () => {
	assert.match(CELLS_SOURCE, /epic: "text-icon-accent-purple \[&_svg\]:text-icon-accent-purple!"/u);
	assert.match(CELLS_SOURCE, /task: "text-icon-accent-blue \[&_svg\]:text-icon-accent-blue!"/u);
	assert.match(CELLS_SOURCE, /story: "text-icon-accent-green \[&_svg\]:text-icon-accent-green!"/u);
	assert.match(CELLS_SOURCE, /subtask: "text-icon-accent-blue \[&_svg\]:text-icon-accent-blue!"/u);
	assert.match(CELLS_SOURCE, /bug: "text-icon-accent-red \[&_svg\]:text-icon-accent-red!"/u);
	assert.match(CELLS_SOURCE, /<IssueTypeIcon color="currentColor" label="" size="small" \/>/u);
});

test("JiraList exposes the expected table headers and sticky footer content", () => {
	assert.match(SOURCE, /Work/u);
	assert.match(SOURCE, /Status/u);
	assert.match(SOURCE, /Assignee/u);
	assert.match(SOURCE, /Agent sessions/u);
	assert.doesNotMatch(SOURCE, /id: "goals"|label: "Goals"/u);
	assert.match(SOURCE, /id: "priority",\s*label: "Priority",\s*widthClassName: "w-\[112px\]"/u);
	assert.match(SOURCE, /Labels/u);
	assert.match(SOURCE, /Due date/u);
	assert.doesNotMatch(SOURCE, /id: "contributors"|label: "Contributors"/u);
	assert.match(SOURCE, /Select all work items/u);
	assert.match(SOURCE, /tabular-nums/u);
	assert.match(SOURCE, /left-1\/2/u);
	assert.match(SOURCE, /Refresh work items/u);
	assert.match(SOURCE, /visibleCount/u);
	assert.match(SOURCE, /sticky top-0 z-20/u);
	assert.match(SOURCE, /sticky bottom-0 z-20/u);
	assert.match(SOURCE, /h-10 min-h-10 items-center/u);
	assert.match(SOURCE, /Copy link/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /Add column/u);
	assert.match(SOURCE, /New work item summary/u);
	assert.match(SOURCE, /What needs to be done\?/u);
	assert.match(SOURCE, /colSpan=\{orderedColumns\.length\}/u);
});

test("JiraList status lozenges can change the owning row status", () => {
	const statusCellSource = SOURCE.match(
		/id: "status",([\s\S]*?)\n\t\t\{\n\t\t\tid: "assignee"/u,
	)?.[1] ?? "";

	assert.match(TYPES_SOURCE, /statusOptions\?: readonly JiraListStatusOption\[\];/u);
	assert.match(TYPES_SOURCE, /onStatusChange\?: \(issueKey: string, status: JiraListStatusOption\) => void;/u);
	assert.match(statusCellSource, /<LozengeDropdownTrigger/u);
	assert.match(statusCellSource, /Change status for \$\{row\.issueKey\}\. Current status: \$\{row\.status\}/u);
	assert.match(statusCellSource, /onSelect=\{\(\) => onStatusChange\(row\.issueKey, option\)\}/u);
	assert.match(statusCellSource, /selected=\{option\.status === row\.status\}/u);
	assert.match(PAGE_SOURCE, /const STATUS_OPTIONS: readonly JiraListStatusOption\[\]/u);
	assert.match(PAGE_SOURCE, /row\.issueKey === issueKey \? \{ \.\.\.row, \.\.\.status \} : row/u);
	assert.match(PAGE_SOURCE, /onStatusChange=\{handleStatusChange\}/u);
	assert.match(PAGE_SOURCE, /statusOptions=\{STATUS_OPTIONS\}/u);
});

test("JiraList contributors use the canonical avatar group count treatment", () => {
	const contributorsSource = SOURCE.match(
		/export function JiraListContributorsCell[\s\S]*?\n\}/u,
	)?.[0] ?? "";

	assert.match(contributorsSource, /<AvatarGroup label=/u);
	assert.match(contributorsSource, /<AvatarGroupCount>\+\{overflowCount\}<\/AvatarGroupCount>/u);
	assert.doesNotMatch(contributorsSource, /bg-bg-neutral-bold|text-text-inverse|ring-0!|-space-x-1\.5/u);
});

test("JiraList does not add a separate open-agent-sessions action", () => {
	const agentSessionsCellSource = SOURCE.match(
		/id: "agentSessions",([\s\S]*?)\n\t\t\{\n\t\t\tid: "priority"/u,
	)?.[1] ?? "";

	assert.match(agentSessionsCellSource, /<JiraListAgentSessionsCell/u);
	assert.match(agentSessionsCellSource, /agentSessions=\{row\.agentSessions\}/u);
	assert.doesNotMatch(SOURCE, /onOpenAgentSessions|Open agent sessions for/u);
	assert.doesNotMatch(PAGE_SOURCE, /inModelRow|onOpenAgentSessions/u);
});

test("JiraList agent sessions reuse AgentAssignment instead of a custom menu", () => {
	const agentSessionsRendererStart = CELLS_SOURCE.indexOf("export function JiraListAgentSessionsCell(");
	const agentSessionsRendererEnd = CELLS_SOURCE.indexOf("export function JiraListGoalsCell", agentSessionsRendererStart);
	const agentSessionsRendererSource = CELLS_SOURCE.slice(
		agentSessionsRendererStart,
		agentSessionsRendererEnd,
	);

	assert.ok(agentSessionsRendererStart > -1);
	assert.ok(agentSessionsRendererEnd > agentSessionsRendererStart);
	assert.match(agentSessionsRendererSource, /<AgentAssignment/u);
	assert.match(CELLS_SOURCE, /const LIST_ASSIGNED_AGENT_MAX_VISIBLE = 3/u);
	assert.match(agentSessionsRendererSource, /maxVisibleAgents=\{LIST_ASSIGNED_AGENT_MAX_VISIBLE\}/u);
	assert.match(agentSessionsRendererSource, /assignedAgents=\{assignedAgents\}/u);
	assert.match(agentSessionsRendererSource, /const canMutateAgents = Boolean\(/u);
	assert.match(agentSessionsRendererSource, /<AgentAvatarVisual/u);
	assert.doesNotMatch(agentSessionsRendererSource, /<ul[\s\S]*Agents/u);
	assert.doesNotMatch(agentSessionsRendererSource, /aria-label="Agent assignment"/u);
	assert.doesNotMatch(agentSessionsRendererSource, />None</u);
	assert.doesNotMatch(agentSessionsRendererSource, /AgentSessionTag|OverflowMenu|MAX_AGENT_AVATARS/u);
	assert.match(
		TYPES_SOURCE,
		/export interface JiraListAssignedAgent extends Pick<AgentAssignmentAgent, "host" \| "invokedBy" \| "role">/u,
	);
	assert.match(TYPES_SOURCE, /agentSessions\?: readonly JiraListAssignedAgent\[\];/u);
	assert.match(CELLS_SOURCE, /\.\.\.\(assigned\.invokedBy \? \{ invokedBy: assigned\.invokedBy \} : \{\}\)/u);
	assert.match(CELLS_SOURCE, /\.\.\.\(assigned\.role \? \{ role: assigned\.role \} : \{\}\)/u);
	assert.match(CELLS_SOURCE, /\.\.\.\(agent\.invokedBy \? \{ invokedBy: agent\.invokedBy \} : \{\}\)/u);
	assert.match(CELLS_SOURCE, /\.\.\.\(agent\.role \? \{ role: agent\.role \} : \{\}\)/u);
	assert.doesNotMatch(TYPES_SOURCE, /agentSessions\?: readonly string\[\];/u);
});

test("JiraList keeps labels on one line with an accessible overflow menu", () => {
	const labelsSource = SOURCE.match(
		/export function JiraListLabelsCell[\s\S]*?\n\}/u,
	)?.[0] ?? "";

	assert.match(SOURCE, /function OverflowMenu/u);
	assert.match(SOURCE, /<PopoverTrigger/u);
	assert.match(SOURCE, /<PopoverContent/u);
	assert.match(SOURCE, /<ul aria-label=\{`More \$\{label\}`\} className="flex flex-col gap-1">\{children\}<\/ul>/u);
	assert.doesNotMatch(CELLS_SOURCE, /DropdownMenuItem|DropdownMenuContent|DropdownMenuTrigger/u);
	assert.match(SOURCE, /render=\{<button type="button" \/>\}/u);
	assert.match(SOURCE, /aria-label=\{`Show \$\{count\} more \$\{label\}`\}/u);
	assert.match(labelsSource, /const overflowLabels = labels\.slice\(visibleLabels\.length\)/u);
	assert.match(labelsSource, /flex-nowrap[^"]*overflow-hidden/u);
	assert.doesNotMatch(labelsSource, /flex-1/u);
	assert.match(labelsSource, /<OverflowMenu count=\{overflowLabels\.length\} label="labels">/u);
	assert.match(labelsSource, /<li className="flex" key=\{`\$\{label\.text\}-\$\{label\.color\}`\}>/u);
	assert.match(labelsSource, /<Tag className="self-center" color=\{label\.color\}>\{label\.text\}<\/Tag>/u);
	assert.match(SOURCE, /id: "labels",\s*label: "Labels",\s*widthClassName: "w-\[180px\]"/u);
	assert.match(DATA_SOURCE, /\{ text: "VULN-1966436", color: "red" \}/u);
	assert.match(DATA_SOURCE, /\{ text: "sales-css", color: "blue" \}/u);
	assert.match(DATA_SOURCE, /\{ text: "user-initiated", color: "teal" \}/u);
});

test("JiraList maps each data column half to one deterministically owned boundary", () => {
	assert.match(SOURCE, /type JiraListColumnBoundaryIndex = number/u);
	assert.match(SOURCE, /function getColumnBoundaryIndex\(/u);
	assert.match(SOURCE, /columnOffset < columnWidth \/ 2/u);
	assert.match(SOURCE, /return columnIndex/u);
	assert.match(SOURCE, /return columnIndex \+ 1/u);
	assert.match(SOURCE, /event\.clientX - columnBounds\.left/u);
	assert.match(SOURCE, /getColumnBoundaryIndex\(\s*columnOffset,\s*columnBounds\.width,\s*columnIndex/u);
	assert.match(SOURCE, /setHoveredColumnBoundaryIndex/u);
	assert.doesNotMatch(COLUMN_CONTROLS_SOURCE, /inset-y-0 z-40 w-4/u);
});

test("JiraList renders one keyboard-accessible overlay control per unique data boundary", () => {
	assert.match(SOURCE, /function getJiraListColumnBoundaries\(/u);
	assert.match(SOURCE, /columns\.flatMap\(\(column, columnIndex\)/u);
	assert.match(
		SOURCE,
		/getJiraListColumnBoundaries\(\s*orderedColumns,\s*insertionAnchorId/u,
	);
	assert.match(SOURCE, /if \(columnIndex !== 0\) \{\s*return \[endBoundary\]/u);
	assert.match(SOURCE, /boundaryIndex: columnIndex/u);
	assert.match(SOURCE, /boundaryIndex: columnIndex \+ 1/u);
	assert.match(SOURCE, /<JiraListColumnBoundary/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /aria-label=\{`Add column/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /onFocus=\{\(\) => setIsFocused\(true\)\}/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /focus-visible:opacity-100/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /<TooltipContent>Add column<\/TooltipContent>/u);
});

test("JiraList column controls use outside-top overlay geometry without reserving space", () => {
	assert.match(SOURCE, /data-testid="jira-list-column-boundary-overlay"/u);
	assert.match(SOURCE, /overflow-visible rounded-xl border-x border-b/u);
	assert.match(SOURCE, /data-testid="jira-list-table-scroll"/u);
	assert.doesNotMatch(SOURCE, /pt-4|pt-\[16px\]|paddingTop/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /absolute top-0 bottom-10 z-40 w-0 overflow-visible/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /size-6 -translate-x-1\/2 -translate-y-1\/2/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /border border-border bg-surface-overlay! text-icon-subtle/u);
	assert.match(
		COLUMN_CONTROLS_SOURCE,
		/left: anchorSide === "left" \? "anchor\(left\)" : "anchor\(right\)"/u,
	);
	assert.match(COLUMN_CONTROLS_SOURCE, /top: 0/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /top: "anchor\(top, -100vh\)"/u);
	assert.doesNotMatch(COLUMN_CONTROLS_SOURCE, /anchor\(center\)/u);
});

test("JiraList column add overlay paints above the sticky checkbox column", () => {
	assert.match(
		SOURCE,
		/relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-\[inherit\]/u,
	);
	assert.match(SOURCE, /data-testid="jira-list-column-boundary-overlay"/u);
	assert.match(
		SOURCE,
		/pointer-events-none contents[\s\S]*?data-testid="jira-list-column-boundary-overlay"/u,
	);
	assert.match(COLUMN_CONTROLS_SOURCE, /fixed z-50 size-6 -translate-x-1\/2 -translate-y-1\/2/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /top: "anchor\(top, -100vh\)"/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /positionVisibility: "anchors-visible"/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /absolute top-0 bottom-10 z-40 w-0 overflow-visible/u);
	assert.match(
		SOURCE,
		/trailingEdgeLayout\.headerCellClassName,\s*"sticky left-0 z-30 px-0"/u,
	);
});

test("JiraList column add controls match the grid border without a second shadow edge", () => {
	const boundaryButtonClass = COLUMN_CONTROLS_SOURCE.match(
		/aria-label=\{`Add column \$\{positionLabel\}`\}[\s\S]*?className=\{cn\(\s*"([^"]+)"/u,
	)?.[1] ?? "";

	assert.match(boundaryButtonClass, /border border-border/u);
	assert.doesNotMatch(boundaryButtonClass, /shadow-/u);
});

test("JiraList shows the exact boundary line only while its add control is hovered or focused", () => {
	assert.match(COLUMN_CONTROLS_SOURCE, /const isLineActive = isHovered \|\| isFocused/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /isLineActive && "opacity-100"/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /data-boundary-line/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /absolute inset-y-0 left-0/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /bg-border-selected/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /onPointerEnter=\{\(\) => setIsHovered\(true\)\}/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /onPointerLeave=\{\(\) => setIsHovered\(false\)\}/u);
});

test("JiraList column add popover filters static options without changing table columns", () => {
	for (const label of [
		"Act size",
		"Actual Story Points",
		"Progress",
		"Remaining Estimate",
		"Original Estimate",
		"Time Spent",
		"Comments",
		"Components",
	]) {
		assert.match(COLUMN_CONTROLS_SOURCE, new RegExp(label, "u"));
	}

	assert.match(COLUMN_CONTROLS_SOURCE, /placeholder="Search columns"/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /COLUMN_OPTIONS\.filter/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /34 of 58/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /setSelectedOptionIds/u);
	assert.doesNotMatch(COLUMN_CONTROLS_SOURCE, /onAddColumn|extraColumns/u);
	assert.doesNotMatch(PAGE_SOURCE, /createExtraColumn|setExtraColumns|onAddColumn=/u);
});

test("JiraList gives every data column an accessible ellipsis action", () => {
	assert.match(SOURCE, /<JiraListColumnActions label=\{column\.label\}/u);
	assert.match(SOURCE, /className="group\/column-header flex min-w-0 items-center gap-2"/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /More actions for \$\{label\}/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /<ShowMoreHorizontalIcon/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /group-hover\/column-header:opacity-100 group-has-\[:focus-visible\]\/column-header:opacity-100/u);
	assert.match(COLUMN_CONTROLS_SOURCE, /<TooltipContent>\{actionLabel\}<\/TooltipContent>/u);
});

test("JiraList places an accessible open action last in each Work cell action group", () => {
	const workCellSource = SOURCE.match(
		/id: "work",([\s\S]*?)\n\t\t\{\n\t\t\tid: "status"/u,
	)?.[1] ?? "";

	assert.match(workCellSource, /group-hover\/row:opacity-100 group-focus-within\/row:opacity-100/u);
	assert.match(workCellSource, /aria-label="Open work item"/u);
	assert.match(workCellSource, /onClick=\{\(\) => onIssueClick\(row\)\}/u);
	assert.match(workCellSource, /size="icon-compact"/u);
	assert.match(workCellSource, /<PanelRightIcon/u);
	assert.match(workCellSource, /<TooltipContent>Open work item<\/TooltipContent>/u);
	assert.ok(workCellSource.lastIndexOf("Open work item") > workCellSource.lastIndexOf("Create"));
});

test("JiraList renders summaries as plain text when no issue action is available", () => {
	const workCellSource = SOURCE.match(
		/id: "work",([\s\S]*?)\n\t\t\{\n\t\t\tid: "status"/u,
	)?.[1] ?? "";

	assert.match(workCellSource, /\{onIssueClick \? \([\s\S]*?<button[\s\S]*?onClick=\{\(\) => onIssueClick\(row\)\}/u);
	assert.match(workCellSource, /\) : \([\s\S]*?<span className="min-w-0 flex-1 truncate text-\[13px\] font-medium text-text">/u);
});

test("JiraList renders issue keys as plain text when no issue-key action is available", () => {
	const workCellSource = SOURCE.match(
		/id: "work",([\s\S]*?)\n\t\t\{\n\t\t\tid: "status"/u,
	)?.[1] ?? "";
	const issueKeyGroupSource = workCellSource.match(
		/<div className="group\/issue-key[\s\S]*?\n\t\t\t\t\t\t\t\{onIssueClick \? \(/u,
	)?.[0] ?? "";

	assert.match(
		issueKeyGroupSource,
		/\{onIssueKeyClick \? \([\s\S]*?<Button[\s\S]*?onClick=\{\(\) => onIssueKeyClick\(row\)\}/u,
	);
	assert.match(
		issueKeyGroupSource,
		/\) : \([\s\S]*?<span className="shrink-0 text-\[13px\] font-medium text-text-subtle">\s*\{row\.issueKey\}/u,
	);
});

test("JiraList reveals copy link only beside the focused or hovered issue key", () => {
	const workCellSource = SOURCE.match(
		/id: "work",([\s\S]*?)\n\t\t\{\n\t\t\tid: "status"/u,
	)?.[1] ?? "";
	const issueKeyGroupSource = workCellSource.match(
		/<div className="group\/issue-key[\s\S]*?\n\t\t\t\t\t\t\t\{onIssueClick \? \(/u,
	)?.[0] ?? "";
	const rowActionGroupSource = workCellSource.match(
		/<div className="flex shrink-0 items-center gap-1 opacity-0[\s\S]*?<\/div>\s*\) : null\}/u,
	)?.[0] ?? "";

	assert.match(issueKeyGroupSource, /group\/issue-key flex shrink-0 items-center/u);
	assert.doesNotMatch(issueKeyGroupSource, /group\/issue-key[^"]*gap-/u);
	assert.match(issueKeyGroupSource, /pointer-events-none max-w-0 overflow-hidden opacity-0/u);
	assert.match(issueKeyGroupSource, /transition-\[max-width,opacity\] duration-normal ease-out-practical/u);
	assert.match(issueKeyGroupSource, /group-hover\/issue-key:max-w-7/u);
	assert.match(issueKeyGroupSource, /group-hover\/issue-key:opacity-100/u);
	assert.match(issueKeyGroupSource, /group-has-\[:focus-visible\]\/issue-key:max-w-7/u);
	assert.match(issueKeyGroupSource, /group-has-\[:focus-visible\]\/issue-key:opacity-100/u);
	assert.doesNotMatch(issueKeyGroupSource, /group-hover\/row:(?:max-w|opacity|pointer-events)/u);
	assert.match(issueKeyGroupSource, /isCopiedRow && "pointer-events-auto max-w-7 opacity-100"/u);
	assert.match(issueKeyGroupSource, /translate-x-1 scale-95 transition-\[translate,scale\]/u);
	assert.match(issueKeyGroupSource, /group-hover\/issue-key:translate-x-0/u);
	assert.match(issueKeyGroupSource, /group-has-\[:focus-visible\]\/issue-key:scale-100/u);
	assert.match(issueKeyGroupSource, /motion-reduce:transition-none/u);
	assert.match(
		issueKeyGroupSource,
		/<Tooltip[\s\S]*?onOpenChange=\{\(open\) => setOpenCopyTooltipIssueKey\(open \? row\.issueKey : null\)\}[\s\S]*?open=\{isCopiedRow \|\| openCopyTooltipIssueKey === row\.issueKey\}/u,
	);
	assert.doesNotMatch(issueKeyGroupSource, /open=\{[^}]*undefined[^}]*\}/u);
	assert.match(issueKeyGroupSource, /aria-label=\{`\$\{isCopiedRow \? "Copied link" : "Copy link"\} for \$\{row\.issueKey\}`\}/u);
	assert.match(issueKeyGroupSource, /<LinkIcon/u);
	assert.doesNotMatch(issueKeyGroupSource, /<CopyIcon/u);
	assert.match(issueKeyGroupSource, /<CheckMarkIcon/u);
	assert.match(issueKeyGroupSource, /<TooltipContent>\{isCopiedRow \? "Copied" : "Copy link"\}<\/TooltipContent>/u);
	assert.doesNotMatch(rowActionGroupSource, /CopyIcon|LinkIcon|Copy link|In Model|Create work item below/u);
	assert.match(rowActionGroupSource, /Open work item/u);
});

test("JiraList left-aligns top-level work items without an empty hierarchy spacer", () => {
	const workCellSource = SOURCE.match(
		/id: "work",([\s\S]*?)\n\t\t\{\n\t\t\tid: "status"/u,
	)?.[1] ?? "";

	assert.match(workCellSource, /row\.hasChildren \? \([\s\S]*?<Button/u);
	assert.match(
		workCellSource,
		/\) : indentLevel > 0 \? \([\s\S]*?aria-hidden="true" className="block size-5 shrink-0"[\s\S]*?\) : null/u,
	);
});

test("JiraList centers an accessible refresh button with the footer count", () => {
	assert.match(TYPES_SOURCE, /onRefresh\?: \(\) => void;/u);
	assert.match(SOURCE, /data-testid="jira-list-footer-count"/u);
	assert.match(SOURCE, /aria-label="Refresh work items"/u);
	assert.match(SOURCE, /title="Refresh work items"/u);
	assert.match(SOURCE, /onClick=\{onRefresh\}/u);
	assert.match(SOURCE, /size="icon"/u);
	assert.match(SOURCE, /variant="ghost"/u);
});

test("JiraList omits footer actions when the consumer supplies no capability", () => {
	assert.match(TYPES_SOURCE, /onCreate\?: \(insertion\?: JiraListInsertion\) => void;/u);
	assert.match(TYPES_SOURCE, /onRefresh\?: \(\) => void;/u);
	assert.match(
		SOURCE,
		/onCreate \? \(\s*<div data-testid="jira-list-footer-controls">[\s\S]*?onClick=\{\(\) => onCreate\(\)\}[\s\S]*?<\/div>\s*\) : null/u,
	);
	assert.match(
		SOURCE,
		/onRefresh \? \([\s\S]*?aria-label="Refresh work items"[\s\S]*?onClick=\{onRefresh\}[\s\S]*?<\/Button>\s*\) : null/u,
	);
	assert.match(FOR_YOU_STAGE_SOURCE, /<JiraList[\s\S]*?rows=\{rows\}/u);
	assert.doesNotMatch(FOR_YOU_STAGE_SOURCE, /<JiraList[\s\S]*?on(?:Create|Refresh)=/u);
	assert.match(
		DETAILS_SOURCE,
		/name: "onCreate"[\s\S]*?Omit it to remove Create controls/u,
	);
	assert.match(
		DETAILS_SOURCE,
		/name: "onRefresh"[\s\S]*?Omit it to remove the footer refresh action/u,
	);
});

test("JiraList sample refresh restores rows and transient demo state", () => {
	const refreshSource = PAGE_SOURCE.match(
		/const handleRefresh = \(\) => \{([\s\S]*?)\n\t\};/u,
	)?.[1] ?? "";

	assert.match(refreshSource, /setDemoRows\(\[\.\.\.JIRA_LIST_SAMPLE_ROWS\]\)/u);
	assert.match(refreshSource, /setSelectedIssueKeys\(new Set\(\)\)/u);
	assert.match(refreshSource, /setCopiedIssueKey\(null\)/u);
	assert.match(refreshSource, /setDraftWorkItem\(null\)/u);
	assert.doesNotMatch(refreshSource, /setExtraColumns/u);
	assert.doesNotMatch(refreshSource, /setInModelRow|inModelRow/u);
	assert.match(PAGE_SOURCE, /onRefresh=\{handleRefresh\}/u);
});

test("JiraList keeps footer drafts out of TableBody and swaps the sticky footer controls", () => {
	const tableBodySource = SOURCE.match(/<TableBody>([\s\S]*?)<\/TableBody>/u)?.[1] ?? "";
	const stickyFooterMarker = SOURCE.indexOf('data-testid="jira-list-sticky-footer"');
	const stickyFooterStart = SOURCE.lastIndexOf("<div", stickyFooterMarker);
	const stickyFooterSource = SOURCE.slice(
		stickyFooterStart,
		SOURCE.indexOf("</section>", stickyFooterStart),
	);

	assert.match(tableBodySource, /renderDraftWorkItemRow\(rowIndex\)/u);
	assert.match(tableBodySource, /renderDraftWorkItemRow\(rows\.length\)/u);
	assert.doesNotMatch(tableBodySource, /renderDraftWorkItemRow\(null\)/u);
	assert.match(SOURCE, /const isFooterDraft = Boolean\(/u);
	assert.match(stickyFooterSource, /isFooterDraft \? \(/u);
	assert.match(stickyFooterSource, /data-testid="jira-list-footer-draft"/u);
	assert.match(stickyFooterSource, /data-testid="jira-list-footer-controls"/u);
	assert.match(stickyFooterSource, /data-footer-state=\{isFooterDraft \? "editing" : "default"\}/u);
	assert.match(stickyFooterSource, /isFooterDraft \? \([\s\S]*?\) : \([\s\S]*?visibleCount/u);
	assert.doesNotMatch(
		stickyFooterSource.match(/isFooterDraft \? \(([\s\S]*?)\) : \(/u)?.[1] ?? "",
		/visibleCount|totalCountLabel/u,
	);
});

test("JiraList exposes keyboard-accessible create controls at both row boundaries", () => {
	assert.match(TYPES_SOURCE, /type JiraListInsertionPosition = "before" \| "after"/u);
	assert.match(SOURCE, /function RowBoundaryCreateControls/u);
	assert.match(SOURCE, /Create work item \$\{position\} \$\{row\.issueKey\}/u);
	assert.match(SOURCE, /<TooltipContent side="right">Create<\/TooltipContent>/u);
	assert.match(SOURCE, /renderControl\(row, rowIndex, "before"\)/u);
	assert.match(SOURCE, /renderControl\(row, rowIndex, "after"\)/u);
	assert.match(SOURCE, /onFocus=/u);
	assert.match(SOURCE, /focus-visible:opacity-100/u);
	assert.match(SOURCE, /data-insertion-line=/u);
	assert.match(SOURCE, /onCreate\s*&&\s*hoveredRowTarget\?\.issueKey === row\.issueKey/u);
	assert.match(SOURCE, /hoverInsertionPosition \?\? dragInsertionPosition/u);
});

test("JiraList uses equal top, drag, and bottom row interaction zones", () => {
	assert.match(SOURCE, /type JiraListRowZone = "before" \| "drag" \| "after"/u);
	assert.match(SOURCE, /function getRowZone\(rowOffset, rowHeight\)/u);
	assert.match(SOURCE, /const rowOffset = event\.clientY - rowBounds\.top/u);
	assert.match(SOURCE, /export const JIRA_LIST_ROW_ZONE_BAND = 1 \/ 3/u);
	assert.match(SOURCE, /const rowThird = rowHeight \* JIRA_LIST_ROW_ZONE_BAND/u);
	assert.match(SOURCE, /rowOffset < rowThird/u);
	assert.match(SOURCE, /rowOffset > rowThird \* 2/u);
	assert.match(SOURCE, /return "before"/u);
	assert.match(SOURCE, /return "after"/u);
	assert.match(SOURCE, /return "drag"/u);
	assert.match(SOURCE, /getRowZone\(rowOffset, rowBounds\.height\)/u);
	assert.match(SOURCE, /\{ issueKey: row\.issueKey, zone \}/u);
	assert.match(SOURCE, /pointer-events-none/u);
	assert.match(SOURCE, /sticky left-0/u);
	assert.match(SOURCE, /after:-top-px after:-inset-x-px after:z-30 after:h-0\.5 after:bg-border-selected/u);
	assert.match(SOURCE, /after:-bottom-px after:-inset-x-px after:z-30 after:h-0\.5 after:bg-border-selected/u);
	assert.doesNotMatch(SOURCE, /border-t-border-selected|border-b-border-selected|shadow-\[inset_0_[^\]]*--ds-border-selected/u);
});

test("JiraList middle zone exposes an anchored accessible drag handle", () => {
	const dragHandleClass = SOURCE.match(
		/aria-label="Drag to reorder"[\s\S]*?className=\{cn\(\s*"([^"]+)"/u,
	)?.[1] ?? "";

	assert.match(SOURCE, /function JiraListSortableRow/u);
	assert.match(SOURCE, /aria-label="Drag to reorder"/u);
	assert.match(SOURCE, /<TooltipContent side="right">Drag to reorder<\/TooltipContent>/u);
	assert.match(SOURCE, /<DragHandleVerticalIcon/u);
	assert.match(dragHandleClass, /cursor-grab touch-none border border-border bg-surface-overlay! text-icon-subtle/u);
	assert.doesNotMatch(dragHandleClass, /shadow-/u);
	assert.match(SOURCE, /fixed z-30 size-6 -translate-x-1\/2 -translate-y-1\/2/u);
	assert.match(SOURCE, /hover:bg-surface-overlay-hovered!/u);
	assert.match(SOURCE, /active:cursor-grabbing active:bg-surface-overlay-pressed!/u);
	assert.match(SOURCE, /top: "anchor\(center\)"/u);
	assert.match(SOURCE, /positionAnchor: getRowAnchorName/u);
	assert.match(SOURCE, /createPortal/u);
	assert.match(SOURCE, /pointer-events-auto opacity-100/u);
	assert.match(SOURCE, /touch-none/u);
});

test("JiraList reorders rows by dnd-kit and direct arrow-key callbacks", () => {
	assert.match(SOURCE, /onMoveRow\?: \(issueKey: string, targetIndex: number\) => void/u);
	assert.match(SOURCE, /<DndContext/u);
	assert.match(SOURCE, /<SortableContext/u);
	assert.match(SOURCE, /restrictToVerticalAxis/u);
	assert.match(SOURCE, /sortableKeyboardCoordinates/u);
	assert.match(SOURCE, /event\.key !== "ArrowUp" && event\.key !== "ArrowDown"/u);
	assert.match(SOURCE, /onMoveRow\?\.\(row\.issueKey, targetIndex\)/u);
	assert.match(SOURCE, /onMoveRow\?\.\(String\(active\.id\), targetIndex\)/u);
	assert.match(PAGE_SOURCE, /const handleMoveRow = \(issueKey: string, targetIndex: number\)/u);
	assert.match(PAGE_SOURCE, /nextRows\.splice\(sourceIndex, 1\)/u);
	assert.match(PAGE_SOURCE, /nextRows\.splice\(boundedTargetIndex, 0, movedRow\)/u);
	assert.match(PAGE_SOURCE, /onMoveRow=\{handleMoveRow\}/u);
});

test("JiraList drag feedback raises the active row and marks its target boundary", () => {
	assert.match(SOURCE, /isDragging &&\s*"z-30 opacity-80 shadow-lg/u);
	assert.match(SOURCE, /dragOverIssueKey/u);
	assert.match(SOURCE, /dragInsertionPosition/u);
	assert.match(SOURCE, /data-dragging=\{isDragging \|\| undefined\}/u);
	assert.match(SOURCE, /data-drop-target=\{isDropTarget \|\| undefined\}/u);
});

test("JiraList row boundary controls reserve no horizontal gutter", () => {
	assert.match(SOURCE, /className="min-w-\[1570px\] table-fixed border-separate border-spacing-0"/u);
	assert.match(SOURCE, /"sticky left-0 isolate overflow-visible bg-surface! px-0/u);
	assert.match(SOURCE, /insertionLinePosition \? "z-30" : "z-10"/u);
	assert.doesNotMatch(SOURCE, /ml-3 min-w-\[1594px\]/u);
	assert.doesNotMatch(SOURCE, /<col className="w-6" \/>/u);
	assert.doesNotMatch(SOURCE, /sticky left-3 z-(?:10|30)/u);
	assert.doesNotMatch(SOURCE, /aria-hidden="true"[\s\S]{0,120}sticky left-/u);
});

test("JiraList sticky selection cells remain opaque while preserving row state tints", () => {
	assert.match(SOURCE, /bg-surface! px-0 before:pointer-events-none before:absolute before:inset-0/u);
	assert.match(SOURCE, /\? "before:bg-bg-selected"/u);
	assert.match(SOURCE, /group-hover\/row:before:bg-bg-neutral-subtle-hovered/u);
	assert.match(SOURCE, /group-focus-within\/row:before:bg-bg-neutral-subtle-hovered/u);
	assert.match(SOURCE, /className="relative z-10 flex items-center justify-center"/u);
});

test("JiraList row boundary controls are fixed opaque overlays", () => {
	const controlsSource = SOURCE.match(
		/function RowBoundaryCreateControls\([\s\S]*?\n\}\n\n(?:export )?function JiraListSortableRow/u,
	)?.[0] ?? "";

	assert.match(controlsSource, /fixed z-30 size-6 -translate-x-1\/2 -translate-y-1\/2/u);
	assert.match(controlsSource, /border border-border bg-surface-overlay! text-icon-subtle/u);
	assert.doesNotMatch(controlsSource, /shadow-/u);
	assert.match(controlsSource, /hover:bg-surface-overlay-hovered!/u);
	assert.match(controlsSource, /active:bg-surface-overlay-pressed!/u);
	assert.match(controlsSource, /focus-visible:bg-surface-overlay!/u);
	assert.doesNotMatch(controlsSource, /bg-surface-raised/u);
});

test("JiraList anchors row controls in an unclipped frame overlay", () => {
	const tableScrollMarker = SOURCE.indexOf('data-testid="jira-list-table-scroll"');
	const tableScrollStart = SOURCE.lastIndexOf("<div", tableScrollMarker);
	const tableScrollEnd = SOURCE.indexOf("</div>", SOURCE.indexOf("</Table>", tableScrollStart));
	const overlayInvocation = SOURCE.lastIndexOf("<RowBoundaryCreateControls");

	assert.match(
		SOURCE,
		/relative flex max-h-\[640px\] flex-col overflow-visible rounded-xl border-x border-b/u,
	);
	assert.match(SOURCE, /flex min-h-0 flex-1 flex-col overflow-hidden rounded-\[inherit\]/u);
	assert.ok(overlayInvocation > tableScrollEnd);
	assert.match(SOURCE, /data-testid="jira-list-row-boundary-overlay"/u);
	assert.match(SOURCE, /style=\{\{ anchorName: getRowAnchorName\(insertionAnchorId, rowIndex\) \}\}/u);
	assert.match(SOURCE, /positionAnchor: getRowAnchorName\(instanceId, rowIndex\)/u);
	assert.match(SOURCE, /left: "anchor\(left\)"/u);
	assert.match(SOURCE, /top: position === "before" \? "anchor\(top\)" : "anchor\(bottom\)"/u);
	assert.match(SOURCE, /size="icon"/u);
	assert.doesNotMatch(SOURCE, /left-3 z-30/u);
});

test("JiraList uses an explicit insertion index for body drafts and submitted rows", () => {
	assert.match(TYPES_SOURCE, /insertAtIndex: number \| null/u);
	assert.match(TYPES_SOURCE, /onCreate\?: \(insertion\?: JiraListInsertion\) => void/u);
	assert.match(SOURCE, /renderDraftWorkItemRow\(rowIndex\)/u);
	assert.match(SOURCE, /renderDraftWorkItemRow\(rows\.length\)/u);
	assert.match(PAGE_SOURCE, /insertAtIndex: number \| null/u);
	assert.match(PAGE_SOURCE, /Math\.min\(Math\.max\(draftWorkItem\.insertAtIndex, 0\), currentRows\.length\)/u);
	assert.match(PAGE_SOURCE, /currentRows\.slice\(0, insertAtIndex\)/u);
	assert.match(PAGE_SOURCE, /currentRows\.slice\(insertAtIndex\)/u);
	assert.doesNotMatch(PAGE_SOURCE, /afterIssueKey/u);
});

test("JiraList footer editor wires issue type, due date, and editor-palette assignee controls", () => {
	assert.match(SOURCE, /ISSUE_TYPE_OPTIONS/u);
	assert.match(
		SOURCE,
		/aria-label=\{`Issue type: \$\{selectedIssueType\}`\}[\s\S]*?className="shrink-0 gap-1 px-2"[\s\S]*?size="compact"[\s\S]*?variant="ghost"/u,
	);
	assert.match(SOURCE, /onDraftWorkItemIssueTypeChange\?\.\(option\.value\)/u);
	assert.match(SOURCE, /<InputGroup className="h-8 min-w-0 flex-1">/u);
	assert.match(SOURCE, /<InputGroupInput/u);
	assert.match(SOURCE, /<InputGroupAddon align="inline-end" className="gap-0\.5">/u);
	assert.match(SOURCE, /<InputGroupButton/u);
	assert.match(SOURCE, /<Calendar/u);
	assert.match(SOURCE, /className=\{isDueDateOpen \? "text-icon-selected" : "text-icon-subtle"\}/u);
	assert.match(SOURCE, /onDraftWorkItemDueDateChange\?\.\(/u);
	assert.match(SOURCE, /<EditorPaletteAssigneePicker/u);
	assert.match(SOURCE, /onDraftWorkItemAssigneeChange\?\.\(/u);
	assert.match(SOURCE, /<AvatarUnassigned aria-hidden="true" size="xs" \/>/u);
	assert.doesNotMatch(SOURCE, /PersonAssigneeIcon/u);
	assert.doesNotMatch(SOURCE, /<input\s/u);
	assert.doesNotMatch(SOURCE, /className="h-7 px-2"/u);
	assert.match(SOURCE, /className="px-2"[\s\S]*?size="compact"/u);
	assert.match(SOURCE, /showFooterControls && "hidden sm:inline"/u);
});

test("JiraList sample page submits all footer draft fields onto the created row", () => {
	assert.match(PAGE_SOURCE, /issueType: draftWorkItem\.issueType/u);
	assert.match(PAGE_SOURCE, /assignee: draftWorkItem\.assignee/u);
	assert.match(PAGE_SOURCE, /dueDate: draftWorkItem\.dueDate/u);
	assert.match(PAGE_SOURCE, /onDraftWorkItemIssueTypeChange=\{\(issueType\)/u);
	assert.match(PAGE_SOURCE, /onDraftWorkItemDueDateChange=\{\(dueDate\)/u);
	assert.match(PAGE_SOURCE, /onDraftWorkItemAssigneeChange=\{\(assignee\)/u);
});

test("JiraList uses shared Jira priority and issue-type icon maps", () => {
	assert.match(TYPES_SOURCE, /export type JiraListPriority = JiraIssuePriority;/u);
	assert.match(
		SOURCE,
		/export type \{[^}]*JiraListProps[^}]*\} from "@\/components\/blocks\/jira-list\/jira-list-types";/u,
	);
	assert.match(SOURCE, /const PRIORITY_ICONS = \{\s*major: PriorityMajorIcon,/u);
	assert.match(SOURCE, /const PRIORITY_LABELS = \{\s*major: "Major",\s*medium: "Medium",\s*minor: "Minor",/u);
	assert.match(SOURCE, /<span className="text-sm text-text">\{PRIORITY_LABELS\[row\.priority\]\}<\/span>/u);
	assert.match(SOURCE, /priority === "minor" && "text-icon-information"/u);
	assert.doesNotMatch(SOURCE, /id: "priority",[\s\S]{0,100}align: "center"/u);
	assert.match(SOURCE, /<span className="text-sm text-text">\{row\.dueDate \?\? "No due date"\}<\/span>/u);
	assert.match(SOURCE, /const ISSUE_TYPE_ICONS = \{\s*epic: EpicIcon,/u);
	assert.match(SOURCE, /subtask: SubtasksIcon,/u);
	assert.match(SOURCE, /bug: BugIcon,/u);
	assert.match(DATA_SOURCE, /dueDate: "Jul 18, 2026"/u);
	assert.doesNotMatch(DATA_SOURCE, /dueDate: "Jul \d{1,2}"[,\n]/u);
});

test("JiraList sample page keeps every demo row top-level", () => {
	assert.doesNotMatch(DATA_SOURCE, /parentIssueKey|indentLevel|hasChildren|isExpanded/u);
	assert.doesNotMatch(PAGE_SOURCE, /expandedIssueKeys|handleToggleExpand|onToggleExpand/u);
	assert.match(PAGE_SOURCE, /rows=\{demoRows\}/u);
	assert.match(PAGE_SOURCE, /totalCountLabel=\{`\$\{demoRows\.length\}`\}/u);
	assert.match(PAGE_SOURCE, /visibleCount=\{demoRows\.length\}/u);
	assert.match(PAGE_SOURCE, /const \[selectedIssueKeys, setSelectedIssueKeys\]/u);
	assert.match(PAGE_SOURCE, /const \[draftWorkItem, setDraftWorkItem\]/u);
	assert.doesNotMatch(PAGE_SOURCE, /const \[extraColumns, setExtraColumns\]/u);
	assert.match(PAGE_SOURCE, /selectedIssueKeys=\{selectedIssueKeys\}/u);
	assert.match(PAGE_SOURCE, /onDraftWorkItemSubmit=\{handleDraftWorkItemSubmit\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /onOpenAgentSessions|inModelRow/u);
	assert.doesNotMatch(PAGE_SOURCE, /overflow-x-auto/u);
});

test("JiraList owns explicit grid separators and selected row cell treatment", () => {
	assert.match(SOURCE, /function getBodyCellClassName/u);
	assert.match(SOURCE, /function HierarchyConnector/u);
	assert.match(SOURCE, /border-b border-r border-border/u);
	assert.match(SOURCE, /bg-bg-selected/u);
	assert.match(SOURCE, /aria-selected=\{isHighlighted \|\| undefined\}/u);
	assert.match(SOURCE, /flex max-h-\[640px\] flex-col/u);
	assert.match(SOURCE, /min-h-0 flex-1 overflow-auto/u);
	assert.match(
		SOURCE,
		/containerClassName="min-w-\[1570px\] shrink-0 overflow-visible"/u,
	);
	assert.match(SOURCE, /group-focus-within\/row:bg-bg-neutral-subtle-hovered/u);
	assert.doesNotMatch(SOURCE, /min-h-\[640px\]/u);
});

test("JiraList highlights an active issue independently from bulk checkbox selection", () => {
	assert.match(TYPES_SOURCE, /activeIssueKey\?: string;/u);
	assert.match(SOURCE, /const isActive = activeIssueKey === row\.issueKey;/u);
	assert.match(SOURCE, /const isHighlighted = isSelected \|\| isActive;/u);
	assert.match(SOURCE, /data-active=\{isActive \|\| undefined\}/u);
	assert.match(SOURCE, /checked=\{isSelected\}/u);
	assert.doesNotMatch(SOURCE, /checked=\{isHighlighted\}/u);
});

test("JiraList stamps list-row session drop metadata only when an intent is passed", () => {
	assert.match(
		TYPES_SOURCE,
		/export type JiraListAgentSessionDropIntent =\s*\| \{ kind: "none" \}\s*\| \{ kind: "attach"; issueKey: string \}\s*\| \{ kind: "create"; insertion: JiraListInsertion \};/u,
	);
	assert.match(TYPES_SOURCE, /agentSessionDropIntent\?: JiraListAgentSessionDropIntent;/u);
	assert.match(SOURCE, /data-board-agent-session-drop-zone=\{agentSessionDropEnabled \? "list-row" : undefined\}/u);
	assert.match(SOURCE, /data-issue-key=\{agentSessionDropEnabled \? row\.issueKey : undefined\}/u);
	assert.match(SOURCE, /data-list-row-index=\{agentSessionDropEnabled \? rowIndex : undefined\}/u);
	assert.match(SOURCE, /agentSessionDropEnabled=\{agentSessionDropIntent !== undefined\}/u);
	assert.match(SOURCE, /function getInsertionFromRowZone/u);
	assert.match(SOURCE, /getAgentSessionInsertionTarget\(agentSessionDropIntent\)/u);
	assert.match(SOURCE, /sessionInsertionTarget \?\? focusedCreateTarget \?\? hoveredCreateTarget/u);
	assert.match(SOURCE, /data-drop-target=\{isDropTarget \|\| undefined\}/u);
	assert.doesNotMatch(SOURCE, /jira-kanban\/experimental/u);
});

test("JiraList lights the whole row an agent session would attach to", () => {
	// The Agent sessions column is often scrolled out of view, so the attach
	// affordance has to reach the sticky checkbox cell and every body cell —
	// never just the cell the session would land in.
	assert.match(SOURCE, /isAgentSessionAttachTarget\(\s*agentSessionDropIntent,\s*row\.issueKey,\s*\)/u);
	assert.match(
		SOURCE,
		/getAgentSessionAttachCellClassName\(isSessionAttachTarget, "sticky"\)/u,
	);
	assert.match(SOURCE, /getAgentSessionAttachCellClassName\(isSessionAttachTarget\)/u);
	assert.doesNotMatch(SOURCE, /column\.id === "agentSessions"\s*\?\s*getAgentSessionAttachCellClassName/u);
	assert.match(SOURCE, /before:bg-bg-selected-hovered!/u);
	assert.match(SOURCE, /return slot === "sticky"[\s\S]*?: "bg-bg-selected-hovered!";/u);
});

test("JiraList acknowledges a session drop with a row flash instead of a checkmark", () => {
	assert.match(TYPES_SOURCE, /export interface JiraListRowFlash \{/u);
	assert.match(TYPES_SOURCE, /rowFlash\?: JiraListRowFlash;/u);
	assert.match(SOURCE, /const flashingIssueKeys = useJiraListRowFlashKeys\(rowFlash\);/u);
	assert.match(SOURCE, /const isFlashing = flashingIssueKeys\.has\(row\.issueKey\);/u);
	assert.match(SOURCE, /getRowFlashCellClassName\(isFlashing, "sticky"\)/u);
	assert.match(SOURCE, /getRowFlashCellClassName\(isFlashing\)/u);
	// The utility, its keyframes, and the reduced-motion fallback have to exist
	// together: the animation is the only signal the drop leaves behind.
	assert.match(GLOBALS_SOURCE, /@keyframes jira-list-row-flash \{/u);
	assert.match(GLOBALS_SOURCE, /@utility jira-list-row-flash \{/u);
	assert.match(
		GLOBALS_SOURCE,
		/animation: jira-list-row-flash var\(--duration-slowest\) var\(--ease-in\);/u,
	);
	assert.match(
		GLOBALS_SOURCE,
		/prefers-reduced-motion: reduce[\s\S]*?\.before\\:jira-list-row-flash::before \{\s*animation: none;/u,
	);
});

test("JiraList is registered in block docs and manifests", () => {
	assert.match(DETAILS_SOURCE, /export const JIRA_LIST_DETAIL/u);
	assert.match(REGISTRY_SOURCE, /"jira-list"[\s\S]*jira-list-demo/u);
	assert.match(COMPONENTS_SOURCE, /blockComponent\("jira-list", "Jira List"\)/u);
	assert.match(MANIFEST_SOURCE, /blockComponent\("jira-list", "Jira List"\)/u);
});
