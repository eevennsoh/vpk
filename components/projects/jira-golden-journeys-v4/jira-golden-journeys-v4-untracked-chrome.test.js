/**
 * Untracked-column, panel, FAB, and simple-kanban source contracts.
 *
 * Split out of `jira-golden-journeys-v4.test.js` so that suite stays under the
 * 1000-line file-size budget.
 */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readProjectFile(relativePath) {
	return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const PAGE_SOURCE = readProjectFile("components/projects/jira-golden-journeys-v4/page.tsx");
const EXPERIMENTAL_HEADER_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/experimental-board-header.tsx",
);
const EXPERIMENTAL_PAGE_SOURCE = [
	readProjectFile("components/blocks/jira-kanban/experimental/page.tsx"),
	readProjectFile("components/blocks/jira-kanban/experimental/experimental-page-types.ts"),
	readProjectFile("components/blocks/jira-kanban/experimental/hooks/use-page-content-model.ts"),
	readProjectFile("components/blocks/jira-kanban/experimental/hooks/use-agent-session-review.ts"),
].join("\n");
const EXPERIMENTAL_BOARD_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/experimental-jira-kanban.tsx",
);
const EXPERIMENTAL_CARD_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/experimental-jira-kanban-card.tsx",
);
const PANEL_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/components/agent-session-panel.tsx",
);
const PANEL_RESIZE_HOOK_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/hooks/use-agent-session-panel-resize.ts",
);
const FAB_GEOMETRY_SOURCE = readProjectFile(
	"components/projects/shared/components/floating-rovo-button/geometry.ts",
);

test("the route pins the shared Agent Session column beside Jira statuses", () => {
	assert.match(PAGE_SOURCE, /showAgentSessionColumn/u);
	assert.match(PAGE_SOURCE, /agentSessionMultiSelect=\{false\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /showAgentSessionFilter=\{false\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /showAgentSessionOverflow=\{false\}/u);
	assert.match(PAGE_SOURCE, /defaultAgentSessionColumnCollapsed/u);
	assert.match(PAGE_SOURCE, /agentSessionAssigneeIdAliases=\{JIRA_GOLDEN_JOURNEYS_V4_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /showAgentSessionColumn\?: boolean;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /agentSessionMultiSelect\?: boolean;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /agentSessionMultiSelect = true,/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /multiSelect: agentSessionMultiSelect,/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /defaultAgentSessionColumnCollapsed\?: boolean;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /function useAgentSessionReview[\s\S]*useState\(defaultCollapsed\)/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /collapsed: displayedAgentSessionColumnCollapsed,/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onCollapsedChange: handleAgentSessionColumnCollapsedChange,/u);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /defaultCollapsed: agentSessionColumnCollapsed/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /capturedItemIds: capturedLooseWorkIds,/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /toPulseSessionHandlers/u);

	const columnIndex = EXPERIMENTAL_BOARD_SOURCE.indexOf("<InFlowAgentSessionColumn");
	const scrollportIndex = EXPERIMENTAL_BOARD_SOURCE.indexOf("<section");
	assert.ok(columnIndex > 0, "expected the board to render the Agent Session column");
	assert.ok(columnIndex < scrollportIndex, "expected untracked work to stay pinned before the status scrollport");
	assert.match(
		EXPERIMENTAL_BOARD_SOURCE,
		/className=\{cn\("flex w-max items-stretch", columnSizing === "fill" \? "min-h-full min-w-full" : "h-full"\)\}\s*style=\{\{ paddingInlineStart: resolvedColumnRowPaddingInlineStart \}\}/u,
	);
	assert.doesNotMatch(
		EXPERIMENTAL_BOARD_SOURCE,
		/"flex min-h-full w-max min-w-full items-stretch ps-6"/u,
	);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /inFlowAgentSessionColumn/u);
});

test("the Panel design variant floats untracked work over the board and the list", () => {
	// The route is the only place the global variant store meets the board, and
	// it must reach the block as a presentation choice — the block itself stays
	// variant-agnostic.
	assert.match(PAGE_SOURCE, /import \{ useDesignVariants \} from "@\/components\/hooks\/use-design-variants";/u);
	assert.match(PAGE_SOURCE, /const \{ designVariants \} = useDesignVariants\(\);/u);
	assert.match(
		PAGE_SOURCE,
		/<ExperimentalJiraKanbanPage[\s\S]*agentSessionPresentation=\{designVariants\.panel \? "panel" : "column"\}/u,
	);
	assert.match(
		PAGE_SOURCE,
		/<ExperimentalJiraKanbanPage[\s\S]*columnChrome=\{designVariants\.simpleKanban \? "simple" : "default"\}/u,
	);
	assert.doesNotMatch(
		EXPERIMENTAL_PAGE_SOURCE,
		/useDesignVariants|design-variants/u,
		"the shared block must take a presentation prop, not read the global variant store",
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /agentSessionPresentation\?: "column" \| "panel";/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /agentSessionPresentation = "column",/u);

	// One config, two mutually exclusive hosts: panel mode must hand the column
	// to the overlay, never render both.
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/const agentSessionColumnConfig: AgentSessionColumnProps \| undefined = showAgentSessionColumn \?/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/\{showInFlowAgentSessionColumn && agentSessionColumnConfig \? \(\s*<InFlowAgentSessionColumn/u,
		"panel mode must not mount the in-flow column; column mode keeps one instance above Board and List",
	);
	assert.doesNotMatch(
		EXPERIMENTAL_PAGE_SOURCE,
		/agentSessionColumn=\{agentSessionPresentation === "panel"/u,
		"the page-owned column must not also mount inside ExperimentalJiraKanban",
	);
	// Insights swaps the whole content region for an article, and a tab with no
	// content renders nothing — neither has a board to float over.
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/const showAgentSessionPanel = agentSessionPresentation === "panel"\s*&& agentSessionColumnConfig !== undefined\s*&& showBoardContent\s*&& !showPulseContent;/u,
	);

	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/const showInFlowAgentSessionColumn = agentSessionPresentation === "column"\s*&& agentSessionColumnConfig !== undefined;/u,
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /<InFlowAgentSessionColumn/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/<InFlowAgentSessionColumn[\s\S]*<RetainedView active=\{isListContent\} retain=\{retainWorkItemViews\}>/u,
	);

	// The rail is persistent: it is its own entry point, so there is deliberately
	// no board-header show/hide control and no closed state. A close action would
	// strand the surface — nothing outside the rail could bring it back.
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /agentSessionPanelOpen/u);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /onToggleAgentSessionPanel/u);
	assert.doesNotMatch(EXPERIMENTAL_HEADER_SOURCE, /agentSessionPanelOpen/u);
	assert.doesNotMatch(EXPERIMENTAL_HEADER_SOURCE, /onToggleAgentSessionPanel/u);
	assert.doesNotMatch(EXPERIMENTAL_HEADER_SOURCE, /Unlink sessions panel/u);
	assert.doesNotMatch(PANEL_SOURCE, /PanelActionClose|onClose/u);
	// Collapse stays on the column-owned header so the rail is not a trap.
	assert.match(PANEL_SOURCE, /headerSurface="panel"/u);
	assert.doesNotMatch(PANEL_SOURCE, /handleCollapse/u);

	// Board and list share one positioning context, which is what lets a single
	// overlay serve both views; Insights stays outside it.
	const contentRegionIndex = EXPERIMENTAL_PAGE_SOURCE.indexOf(
		'className="relative flex min-h-0 min-w-0 flex-1 flex-col',
	);
	const listBranchIndex = EXPERIMENTAL_PAGE_SOURCE.indexOf("<RetainedView active={isListContent}");
	const panelIndex = EXPERIMENTAL_PAGE_SOURCE.indexOf("<AgentSessionPanel");
	assert.ok(contentRegionIndex > 0, "expected a relative content region to anchor the floating panel");
	assert.ok(contentRegionIndex < listBranchIndex, "the board and list branches must live inside that region");
	assert.ok(
		listBranchIndex > 0 && listBranchIndex < panelIndex,
		"the panel must render after the content so it wins the z-40 stacking tie with the list column controls",
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/import \{\s*AGENT_SESSION_PANEL_WIDTH_PX,\s*AgentSessionPanel,\s*\} from "\.\/components\/agent-session-panel";/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/<AgentSessionPanel\s+agentSessionColumn=\{\{\s*\.\.\.agentSessionColumnConfig,\s*draggingIds: boardSessionDrag\.draggingIds,\s*sessionDrag: boardSessionDrag\.untrackedBinding,\s*\}\}/u,
		"the panel is controlled: its collapse state is the same state the in-flow column uses",
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/<JiraSessionFlyoutSuspensionProvider\s+suspended=\{boardSessionDrag\.transaction !== null\}\s*>/u,
		"panel session flyouts suspend during the same board drag transaction as the in-flow column",
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/sessionDragging=\{boardSessionDrag\.transaction !== null\}/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/untrackedDropArmed=\{boardSessionDrag\.transaction\?\.target\?\.kind === "untracked"\}/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/showLeadingScrollFade=\{isListContent && listContentUnderlapsPanel\}/u,
		"the List view only asks for a fade while real content still underlaps the panel",
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/onTrailingContentUnderlapChange: setListContentUnderlapsPanel,\s*scrollEndInset: boardScrollEndInset,\s*trailingOverlayRef: agentSessionPanelRef,/u,
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /ref=\{agentSessionPanelRef\}/u);
	assert.match(PANEL_SOURCE, /showLeadingScrollFade\?: boolean;/u);
	assert.match(
		PANEL_SOURCE,
		/\{showLeadingScrollFade && collapsed \? \(/u,
		"the expanded panel border remains the sole separator",
	);
	assert.match(
		PANEL_SOURCE,
		/<ScrollMaskEdgeOverlay\s+className="right-full"\s+edge="right"\s+fadeSize="3rem"\s*\/>/u,
	);
	assert.match(PANEL_SOURCE, /sessionDragging \? "pointer-events-none" : null/u);
	assert.match(PANEL_SOURCE, /data-board-agent-session-drop-zone="untracked"/u);
	assert.match(
		PANEL_SOURCE,
		/untrackedDropArmed \? "bg-bg-accent-blue-subtlest" : "bg-surface"/u,
	);
	assert.match(PANEL_SOURCE, /<AgentSessionColumn\s+\{\.\.\.agentSessionColumn\}/u);
	// The panel is pinned to the RIGHT edge. That is what lets the list scroll
	// under it like the board does: the list's leading checkbox and summary
	// cells are `sticky left-0`, so a right-pinned panel never covers them and
	// no width needs reserving. Guard both halves — the right pin, and the
	// absence of the inset that a left pin would have required.
	assert.match(PANEL_SOURCE, /"absolute bottom-0 right-0 z-40 rounded-none"/u);
	assert.match(PANEL_SOURCE, /<SidebarResizeHandle/u);
	assert.match(PANEL_SOURCE, /side="left"/u);
	assert.doesNotMatch(PANEL_SOURCE, /border-l border-border/u);
	assert.match(PANEL_SOURCE, /className=\{collapsed \? "pt-1" : "pt-0"\}/u);
	assert.doesNotMatch(PANEL_SOURCE, /AGENT_SESSION_PANEL_CONTENT_INSET/u);
	// Panel list only: 4px side inset and 4px row gap (`space.050`). Do not
	// widen either axis to `gap-2 p-2` (`space.100` / 8px).
	assert.match(PANEL_SOURCE, /listClassName=\{cn\("gap-1 p-1", agentSessionColumn.listClassName\)\}/u);
	assert.doesNotMatch(PANEL_SOURCE, /listClassName=\{cn\("gap-2 p-2"/u);
	assert.match(PANEL_SOURCE, /headerSurface="panel"/u);
	assert.doesNotMatch(PANEL_SOURCE, /chrome="none"/u);
	assert.doesNotMatch(PANEL_SOURCE, /\binset-y-0 left-0\b/u);
	// The rail STOPS at the tab strip: a real `top` offset, never `inset-y-0`
	// plus `paddingTop`. Spanning the board root and padding the content would
	// leave an invisible slab over the tabs that swallows pointer events and
	// reads as a full-height overlay to anything measuring the DOM. Full
	// height from that line to `bottom: 0` wins over lining the header up
	// with the search/filter row — an `mt-6` pin left a hole under the tabs.
	assert.doesNotMatch(PANEL_SOURCE, /\binset-y-0\b/u);
	assert.doesNotMatch(PANEL_SOURCE, /paddingTop:/u);
	assert.match(PANEL_SOURCE, /\btop: topInset,/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/topInset=\{BOARD_HEADER_TAB_STRIP_BOTTOM_PX\}/u,
	);
	assert.match(PANEL_SOURCE, /export \{ AGENT_SESSION_PANEL_WIDTH_PX \}/u);
	assert.match(PANEL_RESIZE_HOOK_SOURCE, /export const AGENT_SESSION_PANEL_WIDTH_PX = 360;/u);
	assert.match(PANEL_RESIZE_HOOK_SOURCE, /direction: "rtl"/u);
	assert.match(
		PANEL_SOURCE,
		/onExpandedWidthChange\?: \(widthPx: number\) => void/u,
	);
	// The column owns the panel header. This host must not restack title,
	// count, or overflow under the column's own Selected N / browse chrome.
	assert.doesNotMatch(PANEL_SOURCE, /<PanelHeader>/u);
	assert.doesNotMatch(PANEL_SOURCE, /<PanelTitle>/u);
	assert.doesNotMatch(PANEL_SOURCE, /untrackedCount/u);
	assert.doesNotMatch(PANEL_SOURCE, /AGENT_SESSION_PANEL_HEADER_CLASS|pt-6 pb-0/u);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /rounded-lg bg-surface/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/displayedAgentSessionColumnCollapsed\s*\?\s*AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX\s*:\s*agentSessionPanelWidthPx/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/onExpandedWidthChange=\{setAgentSessionPanelWidthPx\}/u,
	);
	// The rail stops at the tabs via a real `top`, so the header needs no
	// opaque z-50 band to paint over its head.
	assert.doesNotMatch(EXPERIMENTAL_HEADER_SOURCE, /relative z-50 bg-surface/u);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /listAgentSessionPanelInset/u);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /paddingInline(?:Start|End)/u);
});

test("the board's AI entry point is the floating Rovo button, not the Omnibar", () => {
	// AppLayout hides its own launcher so JgpRovoOverlay owns the single FAB.
	assert.match(PAGE_SOURCE, /<AppLayout[\s\S]*hideFloatingRovo[\s\S]*product="jira"/u);
	assert.match(PAGE_SOURCE, /<JgpRovoOverlay[\s\S]*externalThinkingMessageId=\{externalThinkingMessageId\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /<JgpRovoOverlay[\s\S]*launcher=/u);
	assert.doesNotMatch(PAGE_SOURCE, /<JgpRovoOverlay[\s\S]*chat="hidden"/u);
	assert.doesNotMatch(PAGE_SOURCE, /Omnibar|SCRUBBER_DEMO_ENTRIES|handleOmnibar/u);
	assert.doesNotMatch(PAGE_SOURCE, /useRovoChat|isSidebarChatOpen/u);
	// The overlay does not pass `placement`; the button's default `right` must
	// read `--untracked-panel-width` or a hardcoded 24px parks it on the rail.
	assert.match(
		FAB_GEOMETRY_SOURCE,
		/export const FLOATING_ROVO_BUTTON_END_INSET_VAR = "--untracked-panel-width";/u,
	);
	assert.match(
		FAB_GEOMETRY_SOURCE,
		/const DEFAULT_BUTTON_RIGHT = `calc\(\$\{FLOATING_ROVO_BUTTON_EDGE_GAP\}px \+ var\(\$\{FLOATING_ROVO_BUTTON_END_INSET_VAR\}, 0px\)\)`;/u,
	);
	assert.doesNotMatch(FAB_GEOMETRY_SOURCE, /const DEFAULT_BUTTON_RIGHT = "24px";/u);
});

test("the untracked panel publishes its occupied width for the floating Rovo button", () => {
	// FAB inset is not the scroll inset. Collapsed stays 0 (original corner);
	// only the expanded 360px panel pushes the launcher. Publishing
	// `boardScrollEndInset` would leave a 32px or 360px hole on first paint.
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /const UNTRACKED_PANEL_WIDTH_CSS_VAR = "--untracked-panel-width";/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/const untrackedPanelFabInsetPx = showAgentSessionPanel && !displayedAgentSessionColumnCollapsed\s*\?\s*agentSessionPanelWidthPx\s*:\s*0;/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/root\.style\.setProperty\(UNTRACKED_PANEL_WIDTH_CSS_VAR, `\$\{untrackedPanelFabInsetPx\}px`\)/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/\[UNTRACKED_PANEL_WIDTH_CSS_VAR\]: `\$\{untrackedPanelFabInsetPx\}px`/u,
	);
	assert.doesNotMatch(
		EXPERIMENTAL_PAGE_SOURCE,
		/setProperty\(UNTRACKED_PANEL_WIDTH_CSS_VAR, `\$\{boardScrollEndInset\}px`\)/u,
	);
});

test("the Simple kanban design variant reaches the board as column chrome", () => {
	assert.match(
		PAGE_SOURCE,
		/columnChrome=\{designVariants\.simpleKanban \? "simple" : "default"\}/u,
	);
	assert.doesNotMatch(
		EXPERIMENTAL_PAGE_SOURCE,
		/useDesignVariants|design-variants/u,
		"the shared page must take columnChrome, not read the global variant store",
	);
	assert.doesNotMatch(
		EXPERIMENTAL_BOARD_SOURCE,
		/useDesignVariants|design-variants/u,
		"the shared board must take columnChrome, not read the global variant store",
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /columnChrome\?: JiraKanbanProps\["columnChrome"\];/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/<ExperimentalJiraKanban[\s\S]*columnChrome=\{columnChrome\}/u,
	);
	// Simple kanban only swaps card chrome (stroke hairline vs raised elevation).
	// Experimental internals stay compact in both column recipes.
	assert.match(EXPERIMENTAL_BOARD_SOURCE, /chrome=\{chrome\.cardChrome\}/u);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /<JiraIssue[\s\S]*chrome=\{chrome\}[\s\S]*compact/u);
});
