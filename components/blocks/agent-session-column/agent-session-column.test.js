const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const COUNT_SWAP_SOURCE = readFileSync(join(__dirname, "agent-session-column-count-swap.tsx"), "utf8");
const HOOK_SOURCE = readFileSync(join(__dirname, "use-agent-session-column-hidden.ts"), "utf8");
const FOOTER_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-hidden-footer.tsx"),
	"utf8",
);
const RAIL_COLUMN_SOURCE = readFileSync(join(__dirname, "agent-session-column-rail.tsx"), "utf8");
const RAIL_VIEWPORT_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-rail-viewport.ts"),
	"utf8",
);
const NOTCH_MARK_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-notch.tsx"),
	"utf8",
);
const NOTCH_MAGNIFY_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-notch-magnify.ts"),
	"utf8",
);
const TYPES_SOURCE = readFileSync(join(__dirname, "agent-session-column-types.ts"), "utf8");
const HEADER_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-header.tsx"),
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
const PANEL_SOURCE = readFileSync(
	join(__dirname, "../../ui/panel.tsx"),
	"utf8",
);
const OVERFLOW_MENU_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-overflow-menu.tsx"),
	"utf8",
);
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const PANEL_DEMO_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-panel-demo.tsx"),
	"utf8",
);
const CARD_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-card.tsx"),
	"utf8",
);
const SESSION_DRAG_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-medium-drag.tsx"),
	"utf8",
);
const SESSION_INDEX_SOURCE = readFileSync(
	join(__dirname, "../agent-session/index.tsx"),
	"utf8",
);
const SESSION_TYPES_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-types.ts"),
	"utf8",
);
const BOARD_PAGE_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental-v2/page.tsx"),
	"utf8",
);
const IN_FLOW_COLUMN_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental/components/in-flow-agent-session-column.tsx"),
	"utf8",
);
const RAIL_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental/pulse/components/pulse-rail.tsx"),
	"utf8",
);
const SESSIONS_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental/pulse/lib/pulse-sessions.ts"),
	"utf8",
);
const DEMO_SOURCE = readFileSync(
	join(__dirname, "../../website/demos/blocks/agent-session-column-demo.tsx"),
	"utf8",
);
const REGISTRY_SOURCE = readFileSync(
	join(__dirname, "../../website/registry/blocks.ts"),
	"utf8",
);
const DETAIL_SOURCE = readFileSync(
	join(__dirname, "../../../app/data/details/blocks/agent-session-column.ts"),
	"utf8",
);
const MANIFEST_SOURCE = readFileSync(
	join(__dirname, "../../../app/data/component-manifest.ts"),
	"utf8",
);

test("the column plane is the board surface, not a grey well", () => {
	assert.match(INDEX_SOURCE, /bg-surface/u);
	assert.doesNotMatch(INDEX_SOURCE, /bg-bg-accent-gray-subtlest/u);
	assert.doesNotMatch(INDEX_SOURCE, /bg-white\b/u);
	// The fill must not be reachable only through a caller-supplied class.
	assert.doesNotMatch(INDEX_SOURCE, /className=\{cn\(\s*className/u);
	assert.doesNotMatch(INDEX_SOURCE, /borderRadius: token\("radius\.xlarge"\)/u);
});

test("the session list sits flush in the plane with no gutter wrapper", () => {
	// The old `-m-1 p-1` scrollport painted a 4px gap around the cards and
	// clipped the scrollbar against the plane's radius. The list is the
	// scrollport now; the plane stays unpadded so edge fades span it. The
	// 4px inset lives on the `<ul>` via `listClassName`, not a column wrapper.
	assert.match(INDEX_SOURCE, /min-h-0 min-w-0 flex-1 overflow-y-auto/u);
	assert.doesNotMatch(INDEX_SOURCE, /-m-1 min-h-0 min-w-0 flex-1 overflow-y-auto p-1/u);
	assert.match(INDEX_SOURCE, /overflow-y-auto has-\[:focus-visible\]:overflow-visible/u);
	assert.doesNotMatch(INDEX_SOURCE, /const AGENT_SESSION_PLANE =\s*\n?\s*"[^"]*overflow-hidden/u);
	assert.match(INDEX_SOURCE, /const AGENT_SESSION_LIST_SPACING = "gap-1 p-1"/u);
	assert.match(
		INDEX_SOURCE,
		/className=\{cn\(\s*headerSurface === "column" \? AGENT_SESSION_LIST_SPACING : null,\s*listClassName,\s*\)\}/u,
	);
	assert.doesNotMatch(INDEX_SOURCE, /AGENT_SESSION_WELL_LIST/u);
	assert.doesNotMatch(INDEX_SOURCE, /className=\{cn\("gap-0\.5", listClassName\)\}/u);
	assert.doesNotMatch(INDEX_SOURCE, /padding: token\("space\.100"\)/u);
	assert.doesNotMatch(INDEX_SOURCE, /padding: token\("space\.050"\)/u);
});

test("the column does not fuse large session cards into one stroke", () => {
	// The expanded plane owns the outer 1px + radius.xlarge so fades cannot
	// paint over the stroke. Cards keep their own radius and gap; the column
	// must not strip borders into shared dividers.
	assert.match(INDEX_SOURCE, /const AGENT_SESSION_WELL =/u);
	assert.match(INDEX_SOURCE, /overflow-hidden rounded-xl border border-solid border-transparent/u);
	assert.match(INDEX_SOURCE, /case "caption":\s*\n\s*return collapsed \? AGENT_SESSION_PLANE : AGENT_SESSION_WELL;/u);
	assert.match(INDEX_SOURCE, /case "enclosed":\s*\n\s*return isGutterCollapsed \? AGENT_SESSION_PLANE : AGENT_SESSION_WELL_PAINT;/u);
	assert.match(
		INDEX_SOURCE,
		/className=\{cn\(\s*headerSurface === "column" \? AGENT_SESSION_LIST_SPACING : null,\s*listClassName,\s*\)\}/u,
	);
	assert.doesNotMatch(INDEX_SOURCE, /AGENT_SESSION_WELL_LIST/u);
	assert.doesNotMatch(INDEX_SOURCE, /\[&_article\]:rounded-none \[&_article\]:border-x-0/u);
	assert.doesNotMatch(INDEX_SOURCE, /\[&_li:first-child_article\]:border-t-0/u);
	assert.doesNotMatch(INDEX_SOURCE, /\[&_li:last-child_article\]:border-b-0/u);
	assert.doesNotMatch(SESSION_INDEX_SOURCE, /data-stack=/u);
	assert.match(SESSION_INDEX_SOURCE, /variant === "large"\s*\n\s*\? "gap-0"/u);
	assert.doesNotMatch(SESSION_INDEX_SOURCE, /gap: token\("space\.100"\)/u);
	assert.match(CARD_SOURCE, /rounded-lg text-left text-text/u);
	assert.match(CARD_SOURCE, /padding === "compact" \? "px-3 py-2" : "p-3"/u);
	assert.match(CARD_SOURCE, /\[\[data-marked\]\+&\[data-marked\]\]:in-\[\.gap-1\]:-mt-1/u);
	assert.doesNotMatch(CARD_SOURCE, /\[li:first-child_&\]:rounded-t-lg/u);
	assert.doesNotMatch(CARD_SOURCE, /\[li:last-child_&\]:rounded-b-lg/u);
	assert.doesNotMatch(CARD_SOURCE, /\[li:not\(:last-child\)_&\]:border-b-0/u);
	assert.doesNotMatch(CARD_SOURCE, /border border-solid/u);
	assert.doesNotMatch(CARD_SOURCE, /dash-4-2/u);
});

test("the fill starts below the header, so the title shares the status columns' baseline", () => {
	// Caption keeps the header on the board surface at the same inset and
	// baseline as `To do`. Filling the <section> itself would push the title
	// 8px in and 8px down from every other column title. Enclosed puts that
	// same title inside the well, matching status columns that wrap header
	// and cards in one painted object.
	assert.doesNotMatch(INDEX_SOURCE, /<section[\s\S]*?className=\{cn\(\s*"[^"]*bg-surface/u);
	assert.doesNotMatch(INDEX_SOURCE, /"group\/session-column[^"]*bg-surface/u);
	assert.match(INDEX_SOURCE, /bg-surface/u);
	assert.match(INDEX_SOURCE, /const AGENT_SESSION_PLANE =/u);
	// The section carries no padding of its own either — that would inset the
	// header just as surely as the fill would.
	assert.doesNotMatch(INDEX_SOURCE, /padding: collapsed \?/u);
});

test("card rendering is delegated to the Agent Session block, never re-implemented", () => {
	assert.match(INDEX_SOURCE, /import \{ AGENT_SESSION_ITEMS, AgentSession \} from "@\/components\/blocks\/agent-session"/u);
	assert.match(INDEX_SOURCE, /<AgentSession\b/u);
	// No forked card chrome: the solid border and flyout belong to the card.
	assert.doesNotMatch(INDEX_SOURCE, /border-dashed|UncapturedWorkChin|AgentListRow/u);
});

test("the header count defaults to the visible sessions and can be overridden", () => {
	assert.match(INDEX_SOURCE, /title = "Unlink sessions"/u);
	assert.match(INDEX_SOURCE, /untrackedCount = count \?\? visibleItems\.length/u);
	assert.match(INDEX_SOURCE, /hasActiveFilters/u);
	assert.match(INDEX_SOURCE, /displayedItems\.length/u);
	assert.match(INDEX_SOURCE, /view === "hidden" \? hiddenItems\.length : untrackedCount/u);
	assert.match(TYPES_SOURCE, /count\?: number;/u);
});

test("the scrollport sits flush and lifts overflow for a focused card", () => {
	assert.match(INDEX_SOURCE, /min-h-0 min-w-0 flex-1 overflow-y-auto/u);
	assert.doesNotMatch(INDEX_SOURCE, /-m-1 min-h-0 min-w-0 flex-1 overflow-y-auto p-1/u);
	assert.match(INDEX_SOURCE, /overflow-y-auto has-\[:focus-visible\]:overflow-visible/u);
	assert.doesNotMatch(INDEX_SOURCE, /const AGENT_SESSION_PLANE =\s*\n?\s*"[^"]*overflow-hidden/u);
	assert.match(INDEX_SOURCE, /useHasVerticalOverflow/u);
});

test("edge fades sit on the column plane so they span the full backdrop width", () => {
	// Mask-image on the inset scrollport left a gutter (padding + scrollbar track)
	// where cards stayed sharp. Overlays are positioned to the plane instead.
	assert.match(INDEX_SOURCE, /ScrollMaskEdgeOverlay/u);
	assert.match(INDEX_SOURCE, /AGENT_SESSION_PLANE_FADE_COLOR = "var\(--color-surface\)"/u);
	assert.match(INDEX_SOURCE, /showTopScrollMask \? \(/u);
	assert.match(INDEX_SOURCE, /showBottomScrollMask \? \(/u);
	assert.match(INDEX_SOURCE, /showTopScrollMask \|\| showBottomScrollMask/u);
	// The footer is a sibling under the scrollport, not overflow. At the end
	// of the list the last card is fully revealed and the bottom fade is off.
	assert.doesNotMatch(INDEX_SOURCE, /showBottomFade|showBottomScrollMask \|\| showHiddenFooter/u);
	assert.match(INDEX_SOURCE, /relative flex min-h-0 min-w-0 flex-1 flex-col/u);
	assert.match(INDEX_SOURCE, /pointer-events-none absolute inset-0/u);
	assert.doesNotMatch(INDEX_SOURCE, /pointer-events-none absolute inset-px/u);
	assert.match(INDEX_SOURCE, /edge="top"/u);
	assert.match(INDEX_SOURCE, /edge="bottom"/u);
	assert.doesNotMatch(INDEX_SOURCE, /buildScrollMaskStyle/u);
});

test("an empty column says so rather than rendering an empty list", () => {
	assert.match(INDEX_SOURCE, /displayedItems\.length === 0/u);
	assert.match(INDEX_SOURCE, /emptyLabel = "No sessions to unlink"/u);
	assert.match(INDEX_SOURCE, /from "@\/components\/ui\/empty"/u);
	assert.match(INDEX_SOURCE, /<Empty width="narrow">/u);
	assert.match(INDEX_SOURCE, /<EmptyTitle headingSize="xsmall">No matching sessions<\/EmptyTitle>/u);
	assert.match(INDEX_SOURCE, /<p className="text-xs text-text-subtlest">\{emptyLabel\}<\/p>/u);
	assert.doesNotMatch(INDEX_SOURCE, /hasActiveFilters \? "No matching sessions" : emptyLabel/u);
});

test("the board column and the Insights rail share one loose-work adapter", () => {
	assert.match(SESSIONS_SOURCE, /export function toPulseSessionHandlers\(/u);
	assert.match(RAIL_SOURCE, /toPulseSessionHandlers/u);
	assert.match(BOARD_PAGE_SOURCE, /toPulseSessionHandlers/u);
	// The rail must not keep a hand-rolled copy beside the shared one.
	assert.doesNotMatch(RAIL_SOURCE, /const sessionById = /u);
});

test("the board column commits through the same captured set as Insights", () => {
	assert.match(BOARD_PAGE_SOURCE, /capturedItemIds: capturedLooseWorkIds,/u);
	assert.match(BOARD_PAGE_SOURCE, /onCapture: handleCaptureLooseWork,/u);
	// One fixture list, read through the same day/scope filter the rail reads.
	assert.match(
		BOARD_PAGE_SOURCE,
		/toPulseSessionItems\(\s*filterPulseLooseWorkByMember\(pulseTimeline\.looseWork, agentSessionMemberId\),\s*PULSE_TIMELINE\.members,\s*PULSE_TIMELINE\.workItems,/u,
	);
	// The header's assignee filter narrows the status columns, so it narrows
	// this column too. Golden Journeys aliases board assignees onto session
	// members before the loose-work filter runs.
	assert.match(BOARD_PAGE_SOURCE, /agentSessionAssigneeIdAliases\?: Readonly<Record<string, string>>;/u);
	assert.match(
		BOARD_PAGE_SOURCE,
		/toPulseMemberId\(\s*selectedAssigneeIds,\s*PULSE_MEMBER_IDS,\s*agentSessionAssigneeIdAliases,\s*\)/u,
	);
	assert.match(
		BOARD_PAGE_SOURCE,
		/filterPulseLooseWorkByMember\(pulseTimeline\.looseWork, agentSessionMemberId\)/u,
	);
});

test("the block is registered in the catalog", () => {
	assert.match(MANIFEST_SOURCE, /blockComponent\("agent-session-column", "Agent Session Column"\)/u);
	assert.match(REGISTRY_SOURCE, /"agent-session-column": dynamic\(/u);
	assert.match(DEMO_SOURCE, /@\/components\/blocks\/agent-session-column\/page/u);
	assert.match(DETAIL_SOURCE, /export const AGENT_SESSION_COLUMN_DETAIL/u);
	assert.match(PAGE_SOURCE, /<AgentSessionColumnPanelDemo/u);
	assert.match(PANEL_DEMO_SOURCE, /<AgentSessionColumn/u);
	assert.match(PANEL_DEMO_SOURCE, /onCreateWorkItem=\{handleCapture\}/u);
	assert.match(PANEL_DEMO_SOURCE, /onLinkWorkItem=\{handleCapture\}/u);
	assert.match(PANEL_DEMO_SOURCE, /onSubtasks=\{handleCapture\}/u);
});

test("the catalog page shows a Panel wrap and an in-flow kanban host", () => {
	assert.match(PAGE_SOURCE, /label="Panel"/u);
	assert.match(PAGE_SOURCE, /label="Kanban board"/u);
	assert.match(PANEL_DEMO_SOURCE, /<PanelContainer/u);
	assert.match(PANEL_DEMO_SOURCE, /<PanelContent/u);
	assert.match(PANEL_DEMO_SOURCE, /headerSurface="panel"/u);
	assert.match(PANEL_DEMO_SOURCE, /className="flex-1"/u);
	assert.match(PANEL_DEMO_SOURCE, /listClassName="gap-1 p-1"/u);
	assert.match(PANEL_DEMO_SOURCE, /AGENT_SESSION_PANEL_DEMO_WIDTH_PX = 360/u);
	assert.match(PANEL_DEMO_SOURCE, /triage=\{triage\}/u);
	assert.match(PANEL_DEMO_SOURCE, /locateTarget:/u);
	assert.match(PANEL_DEMO_SOURCE, /attach:/u);
	assert.match(PANEL_DEMO_SOURCE, /createFrom:/u);
	assert.match(PANEL_DEMO_SOURCE, /archive:/u);
	assert.doesNotMatch(PANEL_DEMO_SOURCE, /jira-kanban/u);
	assert.match(PAGE_SOURCE, /<ExperimentalJiraKanbanPage/u);
	assert.match(PAGE_SOURCE, /showAgentSessionColumn/u);
	assert.match(PAGE_SOURCE, /agentSessionPresentation="column"/u);
	assert.match(PAGE_SOURCE, /columnChrome=\{columnChrome\}/u);
	assert.match(PAGE_SOURCE, /aria-label="Kanban column chrome"/u);
	assert.match(PAGE_SOURCE, /<ToggleGroupItem value="default">Default<\/ToggleGroupItem>/u);
	assert.match(PAGE_SOURCE, /<ToggleGroupItem value="simple">Simple<\/ToggleGroupItem>/u);
	assert.match(PAGE_SOURCE, /insightsEnabled=\{false\}/u);
	assert.match(PAGE_SOURCE, /aria-label="Column header actions"/u);
	assert.match(PAGE_SOURCE, /aria-label="Show filter"/u);
	assert.match(PAGE_SOURCE, /aria-label="Show overflow"/u);
	assert.match(PAGE_SOURCE, /showFilter=\{showFilter\}/u);
	assert.match(PAGE_SOURCE, /showOverflow=\{showOverflow\}/u);
	assert.match(PAGE_SOURCE, /showAgentSessionFilter=\{showFilter\}/u);
	assert.match(PAGE_SOURCE, /showAgentSessionOverflow=\{showOverflow\}/u);
	assert.match(PAGE_SOURCE, /useState\(true\)/u);
	assert.match(PANEL_DEMO_SOURCE, /showFilter=\{showFilter\}/u);
	assert.match(PANEL_DEMO_SOURCE, /showOverflow=\{showOverflow\}/u);
	assert.match(DEMO_SOURCE, /AgentSessionColumnHeaderActionToggles/u);
	assert.match(DETAIL_SOURCE, /name: "headerSurface"/u);
	assert.match(DETAIL_SOURCE, /name: "triage"/u);
	assert.match(DETAIL_SOURCE, /headerSurface="panel"/u);
	assert.match(DETAIL_SOURCE, /docked panel/u);
	assert.match(DETAIL_SOURCE, /in-flow kanban board/u);
	assert.doesNotMatch(
		REGISTRY_SOURCE,
		/"agent-session-column":[\s\S]{0,200}?variants/u,
	);
	assert.match(DETAIL_SOURCE, /examples:/u);
	assert.match(DETAIL_SOURCE, /examplesContentWidth: "bleed"/u);
});

test("the collapsed count lives in the header, not on the rail", () => {
	// Same 24px row as expanded. Enclosed in-flow wraps the count with the
	// rail in the well, so the well's 1px stroke is the inset that lines the
	// number up with `To do`. Caption stays flush so it still matches a
	// simple collapsed pill. Panel keeps matching top pad under the docked
	// chrome. The rail is notches only.
	assert.match(INDEX_SOURCE, /paddingBottom: token\("space\.100"\)/u);
	assert.match(
		INDEX_SOURCE,
		/case "panel":\s*\n\s*case "enclosed":\s*\n\s*return \{\s*\n\s*paddingBottom: token\("space\.100"\),\s*\n\s*paddingTop: token\("space\.100"\),\s*\n\s*\};/u,
	);
	assert.match(
		INDEX_SOURCE,
		/case "caption":\s*\n\s*return \{ paddingBottom: token\("space\.100"\) \};/u,
	);
	assert.doesNotMatch(
		INDEX_SOURCE,
		/layout === "enclosed" \? "border border-solid border-transparent" : null/u,
	);
	assert.match(INDEX_SOURCE, /isGutterCollapsed \? AGENT_SESSION_PLANE : AGENT_SESSION_WELL_PAINT/u);
	assert.match(INDEX_SOURCE, /return isGutterCollapsed \? \(/u);
	assert.match(INDEX_SOURCE, /relative flex h-6 w-full min-w-0 items-center justify-center px-1/u);
	assert.match(INDEX_SOURCE, /const collapsedHitSlopPx = wearEnclosedWell && elevatePlane \? 0 : collapsedRailHitSlopPx/u);
	assert.match(INDEX_SOURCE, /toAgentSessionRailHitSlopStyle\(collapsedHitSlopPx\)/u);
	assert.match(INDEX_SOURCE, /hitSlopPx=\{collapsedHitSlopPx\}/u);
	assert.match(INDEX_SOURCE, /absolute inset-x-1 inset-y-0 flex items-center justify-center text-xs/u);
	assert.match(INDEX_SOURCE, /HEADER_COUNT_AT_REST/u);
	assert.match(INDEX_SOURCE, /HEADER_CONTROL_ON_REVEAL/u);
	assert.doesNotMatch(INDEX_SOURCE, /className=\{cn\("absolute shrink-0", HEADER_CONTROL_ON_REVEAL\)\}/u);
	assert.match(INDEX_SOURCE, /<TextMorphing/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /<TextMorphing/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /sessionCount/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /onExpand/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /pt-3/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /group\/session-rail/u);
});

test("collapsing swaps the cards for the notch rail, not for a rotated label", () => {
	// A status column collapses into a `writing-mode: vertical-rl` title. This
	// one must not: its contents are live sessions, so it collapses into the rail.
	assert.doesNotMatch(INDEX_SOURCE, /writing-mode/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /writing-mode/u);
	assert.match(INDEX_SOURCE, /collapsed \?[\s\S]{0,400}?<AgentSessionColumnRail/u);
	assert.match(INDEX_SOURCE, /const AGENT_SESSION_PLANE =\s*\n?\s*"[^"]*bg-surface/u);
	assert.match(
		INDEX_SOURCE,
		/case "enclosed":\s*\n\s*return isGutterCollapsed \? AGENT_SESSION_PLANE : AGENT_SESSION_WELL_PAINT;/u,
	);
	// 32px matches the board's collapsed status pill so the two share a rhythm.
	assert.match(INDEX_SOURCE, /AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX = 32/u);
	// Declared locally: a shared block must not import a kanban variant's lib.
	assert.doesNotMatch(INDEX_SOURCE, /jira-kanban\/experimental/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /jira-kanban\/experimental/u);
	assert.doesNotMatch(NOTCH_MARK_SOURCE, /jira-kanban\/experimental/u);
	assert.doesNotMatch(NOTCH_MAGNIFY_SOURCE, /jira-kanban\/experimental/u);
});

test("column resize buttons swap icons without using selected button state", () => {
	assert.match(INDEX_SOURCE, /collapseLabel=\{headerSurface === "panel"/u);
	assert.match(HEADER_SOURCE, /<ShrinkHorizontalIcon/u);
	assert.match(HEADER_SOURCE, /<TooltipContent>Collapse<\/TooltipContent>/u);
	assert.match(HEADER_SOURCE, /aria-label=\{`Expand \$\{title\} column`\}/u);
	assert.match(HEADER_SOURCE, /<GrowHorizontalIcon/u);
	assert.match(HEADER_SOURCE, /<TooltipContent[^>]*>Expand<\/TooltipContent>/u);
	assert.doesNotMatch(HEADER_SOURCE, /<TooltipContent>Collapse column<\/TooltipContent>/u);
	assert.doesNotMatch(HEADER_SOURCE, /<TooltipContent>Expand column<\/TooltipContent>/u);
	assert.doesNotMatch(HEADER_SOURCE, /\baria-(?:expanded|pressed)(?:\s|=)/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /\baria-(?:expanded|pressed)(?:\s|=)/u);
	assert.match(INDEX_SOURCE, /peer\/expand-control opacity-0/u);
	assert.match(INDEX_SOURCE, /hover:opacity-100 focus-visible:opacity-100/u);
	assert.match(INDEX_SOURCE, /peer-hover\/expand-control:opacity-0/u);
	assert.match(INDEX_SOURCE, /peer-focus-visible\/expand-control:opacity-0/u);
	assert.doesNotMatch(INDEX_SOURCE, /group-hover\/session-column:opacity-100/u);
});

test("notch flyouts use a stable trigger host so the shared popup follows the rail", () => {
	// Same contract as expanded AgentSessionCard: layout on the `li`, a plain
	// `div` as the HoverCard trigger. Putting `layout` on the trigger remounts
	// the host and opens a new flyout per notch.
	assert.match(RAIL_COLUMN_SOURCE, /layout=\{shouldReduceMotion \|\| !animateLayout \|\| isLeaving \|\| isStatusReentering \? false : "position"\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /<JiraSessionFlyoutTrigger[\s\S]{0,200}?render=\{\s*<div\s*className="mx-auto flex h-5 items-center/u);
	assert.match(RAIL_COLUMN_SOURCE, /closeDelay=\{160\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /delay=\{0\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /content="untracked-work"/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /render=\{\s*<motion\.li/u);
});

test("a notch is a drag handle, so a session leaves the collapsed rail too", () => {
	// Parity with the expanded cards: the same binding, reaching the same board
	// transfer machinery, without making the reader expand the column first.
	// The column inherits the binding from AgentSessionProps, so the rail is
	// reached with the prop the expanded cards already take.
	assert.match(SESSION_TYPES_SOURCE, /sessionDrag\?: JiraIssueAgentSessionDragBinding;/u);
	const inheritedSessionProps = TYPES_SOURCE.match(/extends Omit<\s*AgentSessionProps,[\s\S]*?>/u)?.[0] ?? "";
	assert.match(inheritedSessionProps, /"stateChangeVersions"/u);
	assert.doesNotMatch(inheritedSessionProps, /"sessionDrag"/u);
	assert.match(INDEX_SOURCE, /<AgentSessionColumnRail[\s\S]{0,1600}?sessionDrag=\{sessionProps\.sessionDrag\}/u);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/import \{ AgentSessionMediumDrag \} from "@\/components\/blocks\/agent-session\/agent-session-medium-drag";/u,
	);
	assert.match(RAIL_COLUMN_SOURCE, /sessionDrag\?: JiraIssueAgentSessionDragBinding;/u);
	// The drag host must wrap the flyout trigger, not sit inside it:
	// JiraSessionFlyoutTrigger clones its child to add onFocusCapture, and a
	// component child would swallow that prop and cost the rail its
	// keyboard-opens-the-flyout behavior.
	assert.match(
		RAIL_COLUMN_SOURCE,
		/<AgentSessionMediumDrag[\s\S]{0,400}?<JiraSessionFlyoutTrigger/u,
	);
	// The row holds its measured height while the chip travels, so lifting a
	// notch out never reflows the rail under the pointer. Scoped to the JSX tag:
	// the prose above it names the prop too.
	assert.match(RAIL_COLUMN_SOURCE, /<AgentSessionMediumDrag[\s\S]{0,200}?preserveSourceFootprint/u);
	assert.match(RAIL_COLUMN_SOURCE, /<AgentSessionMediumDrag[\s\S]{0,200}?source="untracked"/u);
	// The bind lands on the button itself. On a wrapper the drag host's
	// interactive-target guard would find the inner button and bail.
	assert.match(RAIL_COLUMN_SOURCE, /<button\s*\n\s*\{\.\.\.bind\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /aria-roledescription=\{bind \? "Draggable agent session" : undefined\}/u);
});

test("each notch opens the shared session flyout rather than a forked preview", () => {
	assert.match(
		RAIL_COLUMN_SOURCE,
		/import Image from "next\/image";/u,
	);
	assert.match(RAIL_COLUMN_SOURCE, /<AgentSessionUserNotch/u);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/from "@\/components\/blocks\/product-sidebar\/variants\/jira-session-flyout"/u,
	);
	assert.match(RAIL_COLUMN_SOURCE, /<JiraSessionFlyoutTrigger/u);
	// One payload-aware surface for the whole rail, as Agent List does, so
	// sliding down the notches retargets the shared popup instead of remounting.
	assert.match(RAIL_COLUMN_SOURCE, /const \[flyoutHandle\] = useState\(createJiraSessionFlyoutHandle\);/u);
	assert.equal(RAIL_COLUMN_SOURCE.match(/<JiraSessionFlyoutSurface\b/gu)?.length, 1);
	assert.match(RAIL_COLUMN_SOURCE, /content="untracked-work"/u);
	assert.match(RAIL_COLUMN_SOURCE, /<JiraSessionFlyoutSurface[\s\S]*handle=\{flyoutHandle\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /<JiraSessionFlyoutSurface[\s\S]*instantPosition/u);
	assert.match(RAIL_COLUMN_SOURCE, /flyoutSession=\{toAgentSessionUntrackedWorkFlyoutItem\(/u);
	assert.match(RAIL_COLUMN_SOURCE, /session=\{flyoutSession\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /closeDelay=\{160\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /render=\{\s*<div\s*className="mx-auto flex h-5 items-center/u);
	assert.match(RAIL_COLUMN_SOURCE, /delay=\{0\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /<motion\.li/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /createHoverCardHandle|<HoverCard\b/u);
	assert.match(INDEX_SOURCE, /capturedItemIds=\{sessionProps\.capturedItemIds\}/u);
	assert.match(INDEX_SOURCE, /onLinkWorkItem=\{sessionProps\.onLinkWorkItem\}/u);
});

test("a notch is reachable and legible without a pointer", () => {
	// Keyboard focus opens the flyout through the trigger's focus-visible path,
	// so the notch has to be a real focusable control with a ring and a name.
	assert.match(RAIL_COLUMN_SOURCE, /<button/u);
	assert.match(RAIL_COLUMN_SOURCE, /has-\[:focus-visible\]:ring-2/u);
	assert.match(RAIL_COLUMN_SOURCE, /\$\{item\.title\} — \$\{NOTCH_STATE_LABEL\[item\.state\]\}/u);
	// Colour alone never carries the state.
	assert.match(RAIL_COLUMN_SOURCE, /const NOTCH_STATE_LABEL: Record<AgentListState, string>/u);
	// The expand control stays in the header tab order while faded, and unfades
	// on its own keyboard focus — `hidden` would drop it out of reach entirely.
	assert.doesNotMatch(INDEX_SOURCE, /group-hover\/session-column:block/u);
	assert.match(INDEX_SOURCE, /peer\/expand-control opacity-0/u);
	assert.match(INDEX_SOURCE, /hover:opacity-100 focus-visible:opacity-100/u);
});

test("the in-flow column move handle is a 12px disabled icon, not a 24px button", () => {
	assert.match(IN_FLOW_COLUMN_SOURCE, /data-session-column-move-handle=""/u);
	assert.match(
		IN_FLOW_COLUMN_SOURCE,
		/<button[\s\S]*?className="me-1 inline-flex size-3 shrink-0 cursor-grab[\s\S]*?text-icon-disabled[\s\S]*?\[&_svg\]:text-icon-disabled[\s\S]*?<\/button>/u,
	);
	assert.match(
		IN_FLOW_COLUMN_SOURCE,
		/render=\{<DragHandleVerticalIcon color="currentColor" label="" size="small" \/>\}/u,
	);
	assert.match(
		IN_FLOW_COLUMN_SOURCE,
		/<Icon className="size-3 text-icon-disabled"/u,
	);
	assert.doesNotMatch(
		IN_FLOW_COLUMN_SOURCE,
		/data-session-column-move-handle=""[\s\S]*?text-icon-subtle/u,
	);
	assert.doesNotMatch(
		IN_FLOW_COLUMN_SOURCE,
		/data-session-column-move-handle=""[\s\S]*?text-icon-subtlest/u,
	);
	assert.doesNotMatch(IN_FLOW_COLUMN_SOURCE, /from "@\/components\/ui\/button"/u);
	assert.doesNotMatch(IN_FLOW_COLUMN_SOURCE, /size="icon-compact"/u);
});

test("the resting notch paints icon.disabled, not an alpha of icon", () => {
	// Two named tokens, opaque. An alpha of `color.icon` over the plane used to
	// approximate the resting grey; on `bg-surface` that mix is a third grey.
	assert.match(INDEX_SOURCE, /const AGENT_SESSION_PLANE =\s*\n?\s*"[^"]*bg-surface/u);
	assert.match(NOTCH_MAGNIFY_SOURCE, /rest: "var\(--color-icon-disabled\)"/u);
	assert.match(NOTCH_MAGNIFY_SOURCE, /selected: "var\(--color-icon\)"/u);
	assert.match(NOTCH_MAGNIFY_SOURCE, /unread: "var\(--color-icon-subtle\)"/u);
	assert.match(NOTCH_MAGNIFY_SOURCE, /export function toAgentSessionNotchTone\(/u);
	assert.doesNotMatch(NOTCH_MAGNIFY_SOURCE, /AGENT_SESSION_NOTCH_OPACITY|rest: 0\.6[68]/u);
	assert.doesNotMatch(NOTCH_MARK_SOURCE, /toAgentSessionNotchOpacity|transition-opacity/u);
	// The old grey / sunken planes must not linger in the rationale.
	assert.doesNotMatch(NOTCH_MAGNIFY_SOURCE, /elevation\.surface\.sunken/u);
	assert.doesNotMatch(NOTCH_MAGNIFY_SOURCE, /color\.background\.accent\.gray\.subtlest/u);
});

test("the rail is one dock, so notches swell by distance rather than per row", () => {
	// The whole point of the effect: the notch nearest the cursor is the longest
	// and its neighbours taper off, which only works if one owner holds the
	// pointer position for every mark. A hover handler per notch cannot express
	// a distance.
	assert.match(RAIL_COLUMN_SOURCE, /function useNotchDock\(itemCount: number, enabled: boolean\)/u);
	assert.match(RAIL_COLUMN_SOURCE, /<ul[\s\S]{0,800}?onPointerMove=\{isDocked \? dock\.handlePointerMove : undefined\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /onPointerLeave=\{isDocked \? dock\.handlePointerLeave : undefined\}/u);
	// Motion values, never React state: a rail of marks re-rendering on every
	// mouse pixel would stall the column.
	assert.match(RAIL_COLUMN_SOURCE, /const pointerY = useMotionValue\(AGENT_SESSION_NOTCH_POINTER_AWAY\);/u);
	assert.match(NOTCH_MARK_SOURCE, /useTransform\(\[pointerY, magnify\]/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /useState[^\n]*hoveredNotch/u);
	// Centres are measured in the list's content space, so scrolling moves the
	// pointer through them instead of invalidating them.
	assert.match(RAIL_COLUMN_SOURCE, /rect\.top - listRect\.top \+ list\.scrollTop \+ rect\.height \/ 2/u);
	assert.match(RAIL_COLUMN_SOURCE, /onScroll=\{isDocked \? dock\.handleScroll : undefined\}/u);
	// An arrival changes the geometry the slope is keyed to, so it has to be
	// re-measured rather than left pointing at the old rows.
	assert.match(RAIL_COLUMN_SOURCE, /\}, \[enabled, itemCount, remeasure\]\);/u);
	// Measuring and republishing must stay one operation. Centres live in a ref
	// and a ref write notifies no `useTransform`, so a measure that does not set
	// the pointer's motion value leaves a stationary pointer on stale geometry
	// until the next move or scroll. Behaviour is covered in
	// `agent-session-notch-magnify.test.ts`.
	assert.match(
		RAIL_COLUMN_SOURCE,
		/const remeasure = useCallback\(\(\) => \{[\s\S]*?const clientY = clientYRef\.current;\s*if \(clientY !== null\) \{\s*trackPointer\(clientY\);/u,
	);
	// No second entry point that only writes centres.
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /const measure = useCallback/u);
	// Touch has no hover, and docking under a finger would fight the scroll.
	assert.match(RAIL_COLUMN_SOURCE, /event\.pointerType === "touch"/u);
	// The parked pointer is finite — an Infinity poisons a motion value for good.
	assert.match(NOTCH_MAGNIFY_SOURCE, /AGENT_SESSION_NOTCH_POINTER_AWAY = -1;/u);
	// Peak length is the rail's own 24px channel inside the 32px column.
	assert.match(NOTCH_MAGNIFY_SOURCE, /peak: 24,/u);
});

test("length carries proximity, colour carries selection — one notch, not the slope", () => {
	// Darkening every notch in proportion to its distance turned the swell into
	// one grey gradient and lost the mark actually under the pointer inside it.
	// Length still tapers across neighbours; the darker `color.icon` lands on the
	// selected notch alone and everything else holds `color.icon.subtlest`.
	assert.match(NOTCH_MARK_SOURCE, /const width = useTransform\(falloff,/u);
	assert.match(NOTCH_MARK_SOURCE, /const backgroundColor = useTransform\(\s*\[nearestIndex, magnify\]/u);
	assert.match(NOTCH_MARK_SOURCE, /nearest === index && amount > 0/u);
	assert.match(NOTCH_MARK_SOURCE, /toAgentSessionNotchTone\(/u);
	assert.doesNotMatch(NOTCH_MARK_SOURCE, /const opacity = useTransform\(/u);
	assert.doesNotMatch(NOTCH_MARK_SOURCE, /const backgroundColor = useTransform\(falloff,/u);
	// Selection is the rail's to resolve: a mark cannot know it is the nearest.
	assert.match(RAIL_COLUMN_SOURCE, /const nearestIndex = useMotionValue\(AGENT_SESSION_NOTCH_NO_NEAREST\);/u);
	assert.match(RAIL_COLUMN_SOURCE, /nearestIndex\.set\(toNearestAgentSessionNotchIndex\(centersRef\.current, offset\)\)/u);
	assert.match(RAIL_COLUMN_SOURCE, /nearestIndex: dock\.nearestIndex,/u);
	// Nearest wins outright, so the pointer always belongs to exactly one notch —
	// a half-pitch threshold would leave dead gaps between sliding rows.
	assert.match(NOTCH_MAGNIFY_SOURCE, /export function toNearestAgentSessionNotchIndex\(/u);
	assert.match(NOTCH_MAGNIFY_SOURCE, /AGENT_SESSION_NOTCH_NO_NEAREST = -1;/u);
	// Docked colour is the named token, snapped — a CSS colour transition would
	// mix a third grey between the two. Width stays off any transition so it
	// can track the pointer per frame.
	assert.match(NOTCH_MARK_SOURCE, /isNew \? "bg-icon" : "bg-icon-disabled"/u);
	assert.doesNotMatch(NOTCH_MARK_SOURCE, /bg-icon transition-opacity/u);
	// Colour drains on the same beat as the swell, not a frame ahead of it.
	assert.match(
		RAIL_COLUMN_SOURCE,
		/animate\(magnify, 0, AGENT_SESSION_NOTCH_MAGNIFY_OUT\)\.then\(\(\) => \{[\s\S]{0,200}?nearestIndex\.set\(AGENT_SESSION_NOTCH_NO_NEAREST\)/u,
	);
});

test("the collapsed rail is opt-in state the column owns", () => {
	assert.match(TYPES_SOURCE, /defaultCollapsed\?: boolean;/u);
	assert.match(TYPES_SOURCE, /onCollapsedChange\?: \(collapsed: boolean\) => void;/u);
	// The change callback must not fire from inside a state updater.
	assert.doesNotMatch(INDEX_SOURCE, /setCollapsed\(\(/u);
	assert.doesNotMatch(INDEX_SOURCE, /setUncontrolledCollapsed\(\(/u);
	assert.match(DETAIL_SOURCE, /name: "defaultCollapsed"/u);
});

test("a host can take over the collapse state without the column fighting it", () => {
	// Same shape as the board's `collapsedColumns` and this file's selection
	// contract: prop wins when supplied, internal state otherwise.
	assert.match(TYPES_SOURCE, /collapsed\?: boolean;/u);
	assert.match(INDEX_SOURCE, /collapsed: collapsedProp,/u);
	assert.match(INDEX_SOURCE, /const isCollapsedControlled = collapsedProp !== undefined;/u);
	assert.match(INDEX_SOURCE, /const \[uncontrolledCollapsed, setUncontrolledCollapsed\] = useState\(defaultCollapsed\);/u);
	assert.match(INDEX_SOURCE, /const collapsed = collapsedProp \?\? uncontrolledCollapsed;/u);
	// Controlled: the column defers the write but still reports the toggle, so a
	// host that never echoes the value back simply sees no change.
	assert.match(
		INDEX_SOURCE,
		/if \(!isCollapsedControlled\) \{\s*\n\s*setUncontrolledCollapsed\(nextCollapsed\);\s*\n\s*\}\s*\n\s*onCollapsedChange\?\.\(nextCollapsed\);/u,
	);
	// `useState(defaultCollapsed)` ignores later prop changes, so a host that
	// flips `collapsed` from its own control never runs the column's handler.
	// The committed change has to arm the resize clip and leave the hidden view
	// itself, or the rail spills during the 200ms width transition.
	assert.match(INDEX_SOURCE, /const lastCollapsedRef = useRef\(collapsed\);/u);
	assert.match(
		INDEX_SOURCE,
		/if \(lastCollapsedRef\.current === collapsed\) \{\s*\n\s*return;\s*\n\s*\}/u,
	);
	assert.match(INDEX_SOURCE, /\}, \[closeHiddenView, collapsed, shouldReduceMotion\]\);/u);
});

test("headerSurface panel keeps the column-owned header and drops the nested well", () => {
	assert.match(TYPES_SOURCE, /headerSurface\?: "column" \| "panel";/u);
	assert.match(INDEX_SOURCE, /headerSurface = "column",/u);
	assert.doesNotMatch(TYPES_SOURCE, /chrome\?: "default" \| "none";/u);
	assert.doesNotMatch(INDEX_SOURCE, /\bchrome=/u);
	assert.match(INDEX_SOURCE, /<AgentSessionColumnHeader/u);
	assert.match(INDEX_SOURCE, /case "panel":\s*\n\s*return AGENT_SESSION_PLANE;/u);
	assert.match(INDEX_SOURCE, /<section\s*\n\s*ref=\{setColumnNode\}\s*\n\s*aria-label=\{`\$\{displayTitle\}, \$\{sessionCount\} sessions`\}/u);
	// The section's ref is composed — it also feeds the card glow's proximity
	// plane — but `columnRef` must still be the node, because focus management
	// below reads it.
	assert.match(INDEX_SOURCE, /const setColumnNode = useCallback\(\(node: HTMLElement \| null\) => \{\s*columnRef\.current = node;/u);
	assert.match(INDEX_SOURCE, /tabIndex=\{-1\}/u);
	assert.match(INDEX_SOURCE, /columnRef\.current\?\.focus\(\)/u);
});

test("the gutter rail keeps a keyboard expand control and hides the count", () => {
	assert.match(INDEX_SOURCE, /header: collapsed \? collapsedHeader : expandedHeader/u);
	assert.match(INDEX_SOURCE, /const hideGutterCount = isGutterCollapsed/u);
	assert.match(HEADER_SOURCE, /aria-label=\{`Expand \$\{title\} column`\}/u);
	assert.match(INDEX_SOURCE, /relative flex h-6 w-full min-w-0 items-center justify-center px-1/u);
	// The rail itself still has no header of its own to fall back on.
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /onExpand/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /sessionCount/u);
});

test("both column widths are exported so a host surface can size itself to them", () => {
	assert.match(INDEX_SOURCE, /export const AGENT_SESSION_COLUMN_WIDTH_PX = 280;/u);
	assert.match(INDEX_SOURCE, /export const AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX = 32;/u);
	// Exporting the numbers must not turn into importing a kanban variant's.
	assert.doesNotMatch(INDEX_SOURCE, /jira-kanban/u);
	assert.doesNotMatch(INDEX_SOURCE, /components\/ui\/panel/u);
	assert.doesNotMatch(TYPES_SOURCE, /jira-kanban|components\/ui\/panel/u);
});

test("the collapsed rail preserves session twin hover previews", () => {
	assert.match(INDEX_SOURCE, /<AgentSessionColumnRail[\s\S]{0,800}?highlightedItemId=\{sessionProps\.highlightedItemId\}/u);
	assert.match(INDEX_SOURCE, /<AgentSessionColumnRail[\s\S]{0,800}?onItemHover=\{sessionProps\.onItemHover\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /isHighlighted=\{item\.id === highlightedItemId\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /publishItemHover\(hoveredItem\)/u);
	assert.match(RAIL_COLUMN_SOURCE, /return \(\) => publishItemHover\(null\)/u);
	assert.match(RAIL_COLUMN_SOURCE, /isHovered=\{item\.id === hoverIntent\.activeItemId\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /data-highlighted=\{isHighlighted \|\| undefined\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /isHighlighted=\{isHighlighted\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /showAvatar && !isMorphing\s*\n?\s*\? "opacity-100 scale-100"/u);
	assert.match(RAIL_COLUMN_SOURCE, /const showAvatar = isHighlighted \|\| \(!hasStateGlyph && arrivalReveal\);/u);
});

test("the collapsed header count rolls through the shared Text Morphing slots effect", () => {
	// Reused, never re-implemented: the header must not hand-roll a digit animation.
	assert.match(INDEX_SOURCE, /import TextMorphing from "@\/components\/visual\/text-morphing"/u);
	assert.match(INDEX_SOURCE, /<TextMorphing\s+config=\{HEAD_COUNT_MORPH\}/u);
	assert.match(INDEX_SOURCE, /variant: "slots"/u);
	// `autoSize` eases the slot's width as the total crosses a digit.
	assert.match(INDEX_SOURCE, /autoSize: true/u);
	// A column that mounts already collapsed must not spin its count in.
	assert.match(INDEX_SOURCE, /initial: false/u);
	// The renderer sets its own `aria-label`; the wrapper's `aria-hidden` has to
	// suppress it so the sibling `sr-only` stays the single spoken source.
	assert.match(INDEX_SOURCE, /aria-hidden="true"[\s\S]{0,1500}?<TextMorphing/u);
	assert.match(COUNT_SWAP_SOURCE, /data-agent-session-column-number=""/u);
	assert.match(COUNT_SWAP_SOURCE, /data-agent-session-column-local-icon=""/u);
	assert.match(COUNT_SWAP_SOURCE, /<MonitorIcon label="" size="small" \/>/u);
	// `text` must be a string — `sessionCount` is a number.
	assert.match(INDEX_SOURCE, /String\(sessionCount\)/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /TextMorphing/u);
});

test("the settled monitor identifies only a nonempty local session pool", () => {
	assert.match(INDEX_SOURCE, /displayedItems\.length > 0 && viewItems\.every\(isLocalAgentListItem\)/u);
	assert.match(INDEX_SOURCE, /const showRisingCount = !allLocalSessions \|\| risingCount;/u);
	assert.match(INDEX_SOURCE, /allLocalSessions \? "local " : ""/u);
});

test("the column keeps the selected session id across collapse remounts", () => {
	assert.match(INDEX_SOURCE, /selectedItemId: selectedItemIdProp,/u);
	assert.match(INDEX_SOURCE, /const isSelectionControlled = selectedItemIdProp !== undefined;/u);
	assert.match(INDEX_SOURCE, /const \[uncontrolledSelectedItemId, setUncontrolledSelectedItemId\]/u);
	assert.match(INDEX_SOURCE, /selectedItemId=\{selectedItemId\}/u);
	assert.match(INDEX_SOURCE, /onSelectedItemIdChange=\{multiSelect \? handleSelectedItemIdChange : undefined\}/u);
	assert.match(
		INDEX_SOURCE,
		/onKeyDown=\{multiSelect \? untrackedSelection\.onKeyDown : undefined\}/u,
	);
	assert.match(INDEX_SOURCE, /canActivateItem\(item\)/u);
	assert.match(INDEX_SOURCE, /handleSelectedItemIdChange\(null\)/u);
	assert.match(
		INDEX_SOURCE,
		/if \(!isSelectionControlled\) \{\s*\n\s*setUncontrolledSelectedItemId\(itemId\);\s*\n\s*\}/u,
	);
	assert.match(SESSION_TYPES_SOURCE, /selectedItemId\?: string \| null;/u);
});

test("multiSelect=false removes multi-selection while preserving a singleton drag", () => {
	assert.match(TYPES_SOURCE, /multiSelect\?: boolean;/u);
	assert.match(INDEX_SOURCE, /multiSelect = true,/u);
	assert.match(INDEX_SOURCE, /multiSelect,\s*\n\s*onLeadItem: handleLeadItem,/u);
	assert.match(
		INDEX_SOURCE,
		/onKeyDown=\{multiSelect \? untrackedSelection\.onKeyDown : undefined\}/u,
	);
	assert.match(SELECTION_HOOK_SOURCE, /multiSelect: boolean;/u);
	assert.match(SELECTION_HOOK_SOURCE, /\(\) => input\.multiSelect\s*\?/u);
	assert.match(SELECTION_HOOK_SOURCE, /drag: input\.multiSelect\s*\?/u);
	assert.match(SELECTION_HOOK_SOURCE, /mark: input\.multiSelect\s*\?/u);
	assert.match(SESSION_DRAG_SOURCE, /cohort\?\.\(\) \?\? singletonSessionCohort\(item\)/u);
	assert.match(PANEL_DEMO_SOURCE, /multiSelect=\{multiSelect\}/u);
	assert.match(DETAIL_SOURCE, /name: "multiSelect"/u);
});

test("multiSelect=false also disables single-select row chrome", () => {
	assert.match(
		INDEX_SOURCE,
		/const selectedItemId = multiSelect\s*\?\s*isSelectionControlled \? selectedItemIdProp : uncontrolledSelectedItemId\s*: null;/u,
	);
	assert.match(
		INDEX_SOURCE,
		/onSelectedItemIdChange=\{multiSelect \? handleSelectedItemIdChange : undefined\}/u,
	);
	assert.match(
		TYPES_SOURCE,
		/disables single-select row chrome: article click does not toggle/u,
	);
});

test("the column owns a hidden-id set and filters items before AgentSession", () => {
	assert.match(INDEX_SOURCE, /useAgentSessionColumnHidden\(items\)/u);
	assert.match(HOOK_SOURCE, /hiddenIds: ReadonlySet<string>/u);
	assert.match(HOOK_SOURCE, /view: AgentSessionColumnView/u);
	assert.match(HOOK_SOURCE, /export type AgentSessionColumnView = "active" \| "hidden"/u);
	assert.match(HOOK_SOURCE, /export function pruneHiddenSessionIds\(/u);
	assert.match(HOOK_SOURCE, /export function forgetHiddenSessionIds\(/u);
	assert.match(HOOK_SOURCE, /export function hideSessionId\(/u);
	assert.match(HOOK_SOURCE, /type: "forget"/u);
	assert.match(HOOK_SOURCE, /type: "hide"/u);
	assert.match(HOOK_SOURCE, /forgetHidden,/u);
	assert.match(HOOK_SOURCE, /hideHidden,/u);
	assert.match(HOOK_SOURCE, /export function splitSessionItemsByHidden\(/u);
	assert.doesNotMatch(HOOK_SOURCE, /type: "prune"/u);
	assert.doesNotMatch(HOOK_SOURCE, /dispatch\(\{ items, type: "prune" \}\)/u);
	assert.match(INDEX_SOURCE, /const viewItems = view === "hidden" \? hiddenItems : visibleItems/u);
	assert.match(INDEX_SOURCE, /items=\{displayedItems\}/u);
	assert.match(INDEX_SOURCE, /hideHidden\(session\)/u);
	assert.match(INDEX_SOURCE, /case "hidden":\s*\n\s*toggleHidden\(session\)/u);
	assert.match(INDEX_SOURCE, /case "active":\s*\n\s*hideHidden\(session\)/u);
	assert.match(INDEX_SOURCE, /visibilityLabel: view === "hidden" \? "Unarchive" : "Archive"/u);
	assert.match(INDEX_SOURCE, /onToggleVisibility\?\.\(session\)/u);
	assert.doesNotMatch(INDEX_SOURCE, /triage\.archive\(session\)/u);
	assert.doesNotMatch(INDEX_SOURCE, /forgetHidden\(session\.id\)/u);
	assert.match(INDEX_SOURCE, /triage: selectionTriage,/u);
	assert.match(INDEX_SOURCE, /archive: handleArchiveSession,/u);
	assert.match(INDEX_SOURCE, /toggleHidden\(item\)/u);
	assert.match(INDEX_SOURCE, /onToggleVisibility\?\.\(item\)/u);
	assert.match(INDEX_SOURCE, /onToggleVisibility=\{handleToggleVisibility\}/u);
	assert.match(INDEX_SOURCE, /onArchiveSession=\{handleArchiveSession\}/u);
	assert.match(INDEX_SOURCE, /onArchiveSession: onArchiveSessionProp,/u);
	assert.match(INDEX_SOURCE, /onArchiveSessionProp\?\.\(session\)/u);
	assert.match(INDEX_SOURCE, /visibilityLabel=\{view === "hidden" \? "Unarchive" : "Archive"\}/u);
});

test("the sticky footer reads Archived N in the active view", () => {
	assert.match(FOOTER_SOURCE, /"Archived"/u);
	assert.doesNotMatch(FOOTER_SOURCE, /Work hidden/u);
	assert.match(FOOTER_SOURCE, /\{count\}/u);
	assert.match(FOOTER_SOURCE, /truncate text-xs font-medium leading-4 text-text-subtle/u);
	assert.match(FOOTER_SOURCE, /shrink-0 text-xs font-normal text-text-subtlest/u);
	assert.match(FOOTER_SOURCE, /flex min-w-0 items-center gap-1\.5/u);
	assert.match(FOOTER_SOURCE, /className="text-icon-subtle"/u);
	assert.match(FOOTER_SOURCE, /import ChevronRightIcon from "@atlaskit\/icon\/core\/chevron-right"/u);
	assert.match(FOOTER_SOURCE, /<ChevronRightIcon label="" size="small" \/>/u);
	assert.match(FOOTER_SOURCE, /Show \$\{count\} archived \$\{sessionWord\}/u);
	assert.match(FOOTER_SOURCE, /rounded-none rounded-b-none border-0 border-t border-solid border-border-disabled/u);
	assert.doesNotMatch(FOOTER_SOURCE, /rounded-b-lg/u);
	assert.match(FOOTER_SOURCE, /\bp-3\b/u);
	assert.match(FOOTER_SOURCE, /hover:bg-surface-hovered/u);
	assert.doesNotMatch(FOOTER_SOURCE, /size="compact"|variant="ghost"/u);
	assert.match(INDEX_SOURCE, /showWellFooter = view === "hidden" \|\| hiddenCount > 0/u);
	// An empty visible list still occupies the flex-1 cell so Archived stays
	// the bottom sibling instead of jumping under a short empty message.
	assert.match(
		INDEX_SOURCE,
		/relative flex min-h-0 min-w-0 flex-1 flex-col">\s*\{displayedItems\.length === 0 \?/u,
	);
	assert.match(INDEX_SOURCE, /<AgentSessionColumnHiddenFooter/u);
	assert.match(INDEX_SOURCE, /mode=\{view === "hidden" \? "back" : "hidden"\}/u);
	assert.match(INDEX_SOURCE, /count=\{view === "hidden" \? untrackedCount : hiddenCount\}/u);
	// Flex sibling of the scrollport, never sticky inside it. The bottom fade
	// is pinned to the list wrapper so it sits on the last cards, not the footer.
	assert.match(
		INDEX_SOURCE,
		/flex-1 overflow-y-auto has-\[:focus-visible\]:overflow-visible[^"]*"[\s\S]*?<\/div>\s*\)\}\s*\{showTopScrollMask \|\| showBottomScrollMask \?/u,
	);
	assert.match(
		INDEX_SOURCE,
		/edge="bottom"[\s\S]*?\{showWellFooter \?/u,
	);
	assert.doesNotMatch(FOOTER_SOURCE, /sticky/u);
	assert.doesNotMatch(INDEX_SOURCE, /position:\s*"sticky"|className="[^"]*sticky/u);
});

test("the archived view keeps Archived in the header and a back footer", () => {
	assert.doesNotMatch(INDEX_SOURCE, /ArrowLeftIcon|arrow-left/u);
	assert.doesNotMatch(INDEX_SOURCE, /<TooltipContent>Back<\/TooltipContent>/u);
	assert.doesNotMatch(INDEX_SOURCE, /aria-label=\{`Back to \$\{title\}`\}[\s\S]*size="icon-compact"/u);
	assert.match(INDEX_SOURCE, /displayTitle = view === "hidden" \? "Archived" : title/u);
	assert.match(HEADER_SOURCE, /size="icon-compact"/u);
	assert.match(FOOTER_SOURCE, /title = "Unlink sessions"/u);
	assert.match(FOOTER_SOURCE, /import ChevronLeftIcon from "@atlaskit\/icon\/core\/chevron-left"/u);
	assert.match(FOOTER_SOURCE, /<ChevronLeftIcon label="" size="small" \/>/u);
	assert.match(FOOTER_SOURCE, /Back to \$\{title\}/u);
	assert.match(INDEX_SOURCE, /onClick=\{view === "hidden" \? closeHiddenView : openHiddenView\}/u);
	assert.match(INDEX_SOURCE, /untrackedCount = count \?\? visibleItems\.length/u);
	assert.match(INDEX_SOURCE, /items=\{displayedItems\}/u);
});

test("the collapsed rail keeps a focus-ring gutter on its scrollport", () => {
	// Vertical padding preserves the ring at the capped scroll boundary.
	// The widened rail uses its extra width for horizontal clearance, so its
	// buttons can reach both edges without padding intercepting the pointer.
	assert.match(
		RAIL_COLUMN_SOURCE,
		/overflow-y-auto overscroll-contain py-0\.5/u,
	);
	assert.match(RAIL_COLUMN_SOURCE, /hitSlopPx > 0 \? "px-0" : "px-1"/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /-mx-1/u);
});

test("the collapsed rail fades notches with ScrollMask viewport mask-image", () => {
	// Overlay-on-surface cannot fade 1px marks. The scrollport uses the same
	// `buildScrollMaskStyle` helper `ScrollMask` applies to its viewport.
	assert.match(RAIL_COLUMN_SOURCE, /import \{ buildScrollMaskStyle \} from "@\/components\/visual\/scroll-mask\/lib"/u);
	assert.match(RAIL_COLUMN_SOURCE, /useHasVerticalOverflow<HTMLUListElement>/u);
	assert.match(RAIL_COLUMN_SOURCE, /AGENT_SESSION_RAIL_FADE_SIZE = "6rem"/u);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/buildScrollMaskStyle\(\{\s*fadeBottom: showBottomScrollMask,\s*fadeSize: AGENT_SESSION_RAIL_FADE_SIZE,\s*fadeTop: showTopScrollMask,\s*scrollbarWidth: 0,\s*\}\)/u,
	);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/style=\{\{\s*\.\.\.scrollMaskStyle,[\s\S]{0,150}?maxHeight: railViewportMaxHeight/u,
	);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /<motion\.ul/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /ScrollMaskEdgeOverlay/u);
});

test("the gutter-collapsed rail shows at most ten dots before it scrolls under the mask", () => {
	assert.match(RAIL_VIEWPORT_SOURCE, /AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS = 10/u);
	assert.match(RAIL_COLUMN_SOURCE, /AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS/u);
	assert.match(
		INDEX_SOURCE,
		/maxVisibleItems=\{isGutterCollapsed && collapsedRailHitSlopPx === 0\s*\? AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS\s*: undefined\}/u,
	);
	assert.match(RAIL_COLUMN_SOURCE, /toAgentSessionRailViewportMaxHeight\(/u);
	assert.match(RAIL_COLUMN_SOURCE, /maxHeight: railViewportMaxHeight/u);
	assert.match(RAIL_COLUMN_SOURCE, /w-full flex-1 flex-col/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /w-full flex-none flex-col/u);
	assert.match(RAIL_COLUMN_SOURCE, /const visibleItems = order\.visibleItems;/u);
	assert.match(RAIL_COLUMN_SOURCE, /visibleItems\.map\(/u);
});

test("the embedded column rail does not cap the viewport to ten notches", () => {
	assert.match(
		INDEX_SOURCE,
		/maxVisibleItems=\{isGutterCollapsed && collapsedRailHitSlopPx === 0\s*\? AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS\s*: undefined\}/u,
	);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/style=\{\{\s*\.\.\.scrollMaskStyle,[\s\S]{0,150}?maxHeight: railViewportMaxHeight/u,
	);
	assert.doesNotMatch(
		RAIL_COLUMN_SOURCE,
		/Math\.min\(items\.length, AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS\)/u,
	);
});

test("the collapsed rail receives visible items only and collapse leaves hidden view", () => {
	assert.match(INDEX_SOURCE, /<AgentSessionColumnRail[\s\S]*items=\{displayedItems\}/u);
	assert.match(INDEX_SOURCE, /if \(nextCollapsed\) \{\s*closeHiddenView\(\);/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /Work hidden|Archived|HiddenFooter/u);
});

test("unhiding the last session returns to the active view", () => {
	assert.match(HOOK_SOURCE, /view === "hidden" && hiddenIds\.size === 0 \? "active"/u);
	assert.match(HOOK_SOURCE, /type: "toggle"/u);
	assert.match(HOOK_SOURCE, /type: "close"/u);
});

test("hidden ids survive a temporary items drop so A then B then A stays hidden", () => {
	assert.match(HOOK_SOURCE, /A → B → A does not unhide/u);
	assert.doesNotMatch(HOOK_SOURCE, /dispatch\(\{ items, type: "prune" \}\)/u);
	assert.match(HOOK_SOURCE, /die on remount/u);
});

test("the expanded header sizes its overflow trigger for the host surface", () => {
	assert.match(HEADER_SOURCE, /HEADER_ACTIONS_REVEAL/u);
	assert.match(INDEX_SOURCE, /<AgentSessionColumnOverflowMenu/u);
	assert.match(HEADER_SOURCE, /`Collapse \$\{title\} column`|collapseLabel/u);
	assert.match(OVERFLOW_MENU_SOURCE, /\$\{title\} column actions/u);
	assert.match(OVERFLOW_MENU_SOURCE, /<ShowMoreHorizontalIcon/u);
	assert.match(OVERFLOW_MENU_SOURCE, /size: "icon" \| "icon-compact";/u);
	assert.match(OVERFLOW_MENU_SOURCE, /size=\{size\}/u);
	assert.match(
		INDEX_SOURCE,
		/size=\{headerSurface === "column" \? "icon-compact" : "icon"\}/u,
	);
	assert.doesNotMatch(HEADER_SOURCE, /group-hover\/session-column:block/u);
	assert.match(HEADER_SOURCE, /has-\[\[data-popup-open\]\]:opacity-100/u);
	assert.match(HEADER_SOURCE, /group-has-\[\[data-popup-open\]\]\/header-actions:opacity-100/u);
	assert.match(INDEX_SOURCE, /items=\{displayedItems\}/u);
	assert.match(INDEX_SOURCE, /onLinkWorkItem=\{sessionProps\.onLinkWorkItem\}/u);
});

test("the selecting header Link action uses a CheckMark icon", () => {
	assert.match(HEADER_SOURCE, /import CheckMarkIcon from "@atlaskit\/icon\/core\/check-mark";/u);
	assert.match(HEADER_SOURCE, /approve: CheckMarkIcon,/u);
	assert.doesNotMatch(HEADER_SOURCE, /LinkIcon/u);
});

test("selecting header hover copy comes from the selectedCount table", () => {
	assert.match(SELECTION_COPY_SOURCE, /Link agent sessions/u);
	assert.match(SELECTION_COPY_SOURCE, /Create \$\{selectedCount\} work item/u);
	assert.match(SELECTION_COPY_SOURCE, /Create \$\{selectedCount\} work items/u);
	assert.match(SELECTION_COPY_SOURCE, /\$\{verb\} \$\{selectedCount\} agent session/u);
	assert.match(SELECTION_COPY_SOURCE, /\$\{verb\} \$\{selectedCount\} agent sessions/u);
	assert.match(SELECTION_COPY_SOURCE, /describeVisibilityAction\("Archive", selectedCount\)/u);
	assert.match(SELECTION_COPY_SOURCE, /clear: \(\) => "Clear"/u);
	assert.match(SELECTION_COPY_SOURCE, /No selected sessions have a work item to link/u);
	assert.match(SELECTION_COPY_SOURCE, /No selected sessions can create a work item/u);
	assert.match(
		SELECTION_COPY_SOURCE,
		/SELECTION_ACTION_AVAILABLE_COPY\[id\]\(counts\.selectedCount\)/u,
	);
	assert.doesNotMatch(SELECTION_COPY_SOURCE, /eligibleCount\).*work item/u);
	assert.doesNotMatch(HEADER_SOURCE, /headerActionUnavailableReason/u);
	assert.match(HEADER_SOURCE, /function toHeaderActionAffordance/u);
	assert.match(HEADER_SOURCE, /TooltipTrigger render=\{<span className="inline-flex" \/>\}/u);
	assert.match(HEADER_SOURCE, /disabled=\{affordance\.disabled\}/u);
	assert.doesNotMatch(HEADER_SOURCE, /aria-disabled/u);
	assert.match(HEADER_SOURCE, /tooltip=\{affordance\.text\}/u);
	assert.match(PANEL_SOURCE, /tooltip\?: ReactNode/u);
	assert.match(PANEL_SOURCE, /tooltip === undefined \? action : wrapPanelActionTooltip/u);
});
