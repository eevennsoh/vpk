const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const read = (rel) => readFileSync(join(__dirname, rel), "utf8");
const PAGE_SOURCE = read("page.tsx");
const GALLERY_ITEMS_SOURCE = read("data/gallery-items.ts");
const SCREENS_SOURCE = read("data/session-screens.ts");
const STAGE_SOURCE = read("components/session-stage.tsx");
const FOR_YOU_STAGE_SOURCE = read("components/for-you-stage.tsx");
const JIRA_DESIGN_VIEW_TABS_SOURCE = read("components/jira-design-view-tabs.tsx");
const JIRA_DESIGN_WORK_ITEMS_SOURCE = read("data/jira-design-work-items.ts");
const SHARED_FOR_YOU_STAGE_SOURCE = read("../shared/components/for-you-stage-layout.tsx");
const ASX_PAGE_SOURCE = read("../jira-golden-journey-v0/page.tsx");
const TERMINAL_BEAT_SCREEN_SOURCE = read("components/terminal-beat-screen.tsx");
const TERMINAL_LIVE_SCREEN_SOURCE = read("components/terminal-live-screen.tsx");
const TERMINAL_STAGE_SOURCE = read("components/terminal-stage.tsx");
const TERMINAL_CHROME_SOURCE = read("components/terminal-stage-chrome.tsx");
const TERMINAL_CLAUDE_PANE_SOURCE = read("components/terminal-stage-claude-pane.tsx");
const TERMINAL_JIRA_PANE_SOURCE = read("components/terminal-stage-jira-pane.tsx");
const TERMINAL_HOOK_SOURCE = read("hooks/use-terminal-demo.ts");
const NAV_HOOK_SOURCE = read("hooks/use-screen-navigator.ts");

test("Gallery exposes exactly Carl's local and Sarah's global session cards", () => {
	const ids = [...GALLERY_ITEMS_SOURCE.matchAll(/id:\s*"([^"]+)"/gu)].map((match) => match[1]);
	assert.deepEqual(ids, ["local-session", "global-session"]);
	assert.match(GALLERY_ITEMS_SOURCE, /title:\s*"Carl's local session"/u);
	assert.match(GALLERY_ITEMS_SOURCE, /title:\s*"Sarah's global session"/u);
	assert.match(GALLERY_ITEMS_SOURCE, /titleLines:\s*\["Carl's", "local session"\]/u);
	assert.match(GALLERY_ITEMS_SOURCE, /titleLines:\s*\["Sarah's", "global session"\]/u);
});

test("Each card defines its own ordered set of screens to navigate", () => {
	assert.match(SCREENS_SOURCE, /export const LOCAL_SESSION_SCREENS: readonly SessionScreen\[\]/u);
	assert.match(SCREENS_SOURCE, /export const GLOBAL_SESSION_SCREENS: readonly SessionScreen\[\]/u);
	for (const [id, design, scenario] of [
		["global-1", "kanban", "global-assignment"],
		["global-2", "rovo", "blocked-question"],
		["global-3", "for-you", "human-review"],
	]) {
		assert.match(
			SCREENS_SOURCE,
			new RegExp(`id: "${id}"[\\s\\S]*?design: "${design}"[\\s\\S]*?scenario: "${scenario}"`, "u"),
		);
	}
	for (const [id, section, design] of [
		["global-4", "Kanban & List", "jira-kanban"],
	]) {
		assert.match(
			SCREENS_SOURCE,
			new RegExp(`id: "${id}"[\\s\\S]*?section: "${section}"[\\s\\S]*?design: "${design}"`, "u"),
		);
	}
	assert.match(
		SCREENS_SOURCE,
		/export type SessionScreenDesign = "for-you" \| "jira-kanban" \| "kanban" \| "rovo";/u,
	);
	assert.match(STAGE_SOURCE, /screen\?\.design === "rovo"/u);
	assert.match(STAGE_SOURCE, /<RovoStage key=\{screen\.id\} \/>/u);
	assert.doesNotMatch(SCREENS_SOURCE, /scenario: "pr-review"/u);
	assert.doesNotMatch(STAGE_SOURCE, /QueueStage|design === "queue"/u);
	assert.match(STAGE_SOURCE, /screen\?\.design === "for-you"/u);
	assert.match(
		STAGE_SOURCE,
		/<ForYouStage key=\{screen\.id\} \/>/u,
	);
	assert.match(STAGE_SOURCE, /screen\?\.design === "jira-kanban"/u);
	assert.match(STAGE_SOURCE, /<JiraDesignStage key=\{screen\.id\} \/>/u);
	assert.doesNotMatch(SCREENS_SOURCE, /global-5|section: "List"|design: "jira-list"/u);
	assert.match(
		FOR_YOU_STAGE_SOURCE,
		/function JiraShellStage[\s\S]*relative left-1\/2 h-full min-h-0 w-\[100cqw\] -translate-x-1\/2 overflow-hidden/u,
	);
	assert.doesNotMatch(SCREENS_SOURCE, /design: "work-item"|completed-timeline/u);
	assert.doesNotMatch(STAGE_SOURCE, /WorkItemStage|workItemController|design === "work-item"/u);
});

test("Local session drives the TwG setup live and resumes review beats after Kanban", () => {
	// Screens 0–6 share the live presenter: initial terminal, split, command,
	// backlog, issue inspection, work-context handoff, and line-by-line delivery.
	// Post-review work uses frozen snapshots.
	const liveBeats = [...SCREENS_SOURCE.matchAll(/liveBeat:\s*(\d+)/gu)].map((match) => Number(match[1]));
	assert.deepEqual(liveBeats, [0, 1, 2, 3, 4, 5, 6]);
	const frozenBeats = [...SCREENS_SOURCE.matchAll(/terminalBeat:\s*(\d+)/gu)].map((match) => Number(match[1]));
	assert.deepEqual(frozenBeats, [7, 8, 9, 10]);
	assert.match(
		SCREENS_SOURCE,
		/id: "local-7"[\s\S]*?scenario: "local-review"[\s\S]*?id: "local-8"[^\n]+terminalBeat: 7/u,
	);
	assert.match(
		SCREENS_SOURCE,
		/local-11[^\n]+terminalBeat: 10[\s\S]*?id: "local-12"[\s\S]*?scenario: "local-completed"/u,
	);

	// The stage routes live screens to the shared presenter and frozen screens to
	// the static snapshot.
	assert.match(STAGE_SOURCE, /screen\?\.liveBeat != null/u);
	assert.match(STAGE_SOURCE, /<TerminalLiveScreen targetBeat=\{screen\.liveBeat\} \/>/u);
	assert.match(STAGE_SOURCE, /screen\?\.terminalBeat != null/u);
	assert.match(STAGE_SOURCE, /<TerminalBeatScreen key=\{screen\.id\} beat=\{screen\.terminalBeat\} \/>/u);

	// The first post-review screen is stable; later screens start from the
	// preceding settled beat and animate only their destination beat.
	assert.match(
		TERMINAL_BEAT_SCREEN_SOURCE,
		/const initialSettledBeat = shouldReduceMotion \|\| beat === FIRST_POST_REVIEW_BEAT \? beat : beat - 1;/u,
	);
	assert.match(TERMINAL_BEAT_SCREEN_SOURCE, /useTerminalDemo\(true, \{ initialSettledBeat, keyboard: false \}\)/u);
	assert.match(TERMINAL_BEAT_SCREEN_SOURCE, /if \(state\.settled && settledBeat < beat\) advance\(\);/u);
	assert.match(TERMINAL_BEAT_SCREEN_SOURCE, /<TerminalStage controller=\{controller\} \/>/u);

	// The live run reuses the real presenter animation, with the card owning the
	// arrow keys (keyboard off) and driving advance/stepBack to the target beat.
	assert.match(TERMINAL_LIVE_SCREEN_SOURCE, /useTerminalDemo\(true, \{ keyboard: false \}\)/u);
	assert.match(TERMINAL_LIVE_SCREEN_SOURCE, /<TerminalStage controller=\{controller\} \/>/u);
	assert.match(
		TERMINAL_CLAUDE_PANE_SOURCE,
		/<StateGlyph status="working" className="shrink-0 text-\[#D97757\]" \/>/u,
	);
	assert.match(TERMINAL_CLAUDE_PANE_SOURCE, /<span>Working…<\/span>/u);
	assert.match(TERMINAL_CLAUDE_PANE_SOURCE, /const visibleLines = \[\.\.\.pane\.transcript, \.\.\.inFlightLines\]/u);
	assert.doesNotMatch(TERMINAL_CLAUDE_PANE_SOURCE, /key=\{`in-flight-\$\{index\}`\}/u);
	assert.match(TERMINAL_CLAUDE_PANE_SOURCE, /<AnimatePresence initial=\{false\}>/u);
	assert.match(TERMINAL_CLAUDE_PANE_SOURCE, /layout=\{shouldReduceMotion \? false : "position"\}/u);
	assert.match(TERMINAL_CLAUDE_PANE_SOURCE, /key="working"/u);
});

test("Post-review terminal screens share the line-by-line output reveal timing", () => {
	assert.match(TERMINAL_HOOK_SOURCE, /const OUTPUT_MS_PER_LINE = 250; \/\/ duration-slow/u);
	assert.match(TERMINAL_HOOK_SOURCE, /initialSettledBeat\?: number;/u);
	assert.match(TERMINAL_HOOK_SOURCE, /shouldReduceMotion[\s\S]*dispatch\(\{ type: "finish-beat" \}\);/u);
});

test("Active terminal output reuses the reduced-motion-safe ASCII working glyph", () => {
	assert.match(TERMINAL_CHROME_SOURCE, /active && span\.text === "⏺ "/u);
	assert.match(TERMINAL_CHROME_SOURCE, /<StateGlyph status="working" \/>/u);
	assert.match(TERMINAL_CLAUDE_PANE_SOURCE, /const activeLine = pane\.working \? currentLine : undefined;/u);
	assert.match(TERMINAL_CLAUDE_PANE_SOURCE, /active=\{line === activeLine\}/u);
});

test("Page wires the session stage + top-bar screen navigator per card", () => {
	assert.match(PAGE_SOURCE, /title="Jira Golden Journey v1"/u);
	assert.match(PAGE_SOURCE, /<SessionScreenControls\s+screens=\{activeCard\.screens\}\s+controller=\{activeCard\.controller\}\s+\/>/u);
	assert.match(PAGE_SOURCE, /topBarCenterCompact=\{\([\s\S]*<CompactSessionScreenControls\s+screens=\{activeCard\.screens\}\s+controller=\{activeCard\.controller\}\s+\/>/u);
	assert.match(
		PAGE_SOURCE,
		/<SessionStage[\s\S]*controller=\{card\.controller\}[\s\S]*screens=\{card\.screens\}[\s\S]*\/>/u,
	);
	assert.doesNotMatch(PAGE_SOURCE, /WorkItemControls|workItemController|useWorkItemStageController/u);
	assert.match(PAGE_SOURCE, /open=\{dockOpen\}/u);
	assert.match(PAGE_SOURCE, /onOpenChange=\{setDockOpen\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /onReset=\{handleReset\}|controller\.reset\(\)/u);
});

test("Wide Gallery controls collapse automated screens into connected section-run buttons", () => {
	assert.match(STAGE_SOURCE, /import \{ ButtonGroup \} from "@\/components\/ui\/button-group";/u);
	assert.match(STAGE_SOURCE, /const startsNewRun =\s*i === 0 \|\| !screen\?\.section \|\| screen\.section !== previous\?\.section;/u);
	assert.match(STAGE_SOURCE, /if \(startsNewRun\) \{\s*runs\.push/u);
	assert.match(STAGE_SOURCE, /aria-label="Open a Jira Golden Journey section"/u);
	assert.match(STAGE_SOURCE, /variant="connected"/u);
	assert.match(STAGE_SOURCE, /runs\.map\(\(run, runIndex\) =>/u);
	assert.match(STAGE_SOURCE, /aria-pressed=\{runIndex === activeRun\}/u);
	assert.match(STAGE_SOURCE, /runIndex === activeRun \? sectionLabel\(screens, index\) : run\.label/u);
	assert.match(STAGE_SOURCE, /if \(total === 1\) return section;/u);
	assert.match(STAGE_SOURCE, /return `\$\{section\} \\u00b7 \$\{position\} of \$\{total\}`;/u);
});

test("Compact Gallery controls preserve previous, section menu, and next navigation", () => {
	assert.match(STAGE_SOURCE, /export function CompactSessionScreenControls/u);
	assert.match(STAGE_SOURCE, /aria-label="Previous screen"/u);
	assert.match(STAGE_SOURCE, /aria-label="Jump to section"/u);
	assert.match(STAGE_SOURCE, /aria-label="Next screen"/u);
	assert.match(STAGE_SOURCE, /onSelect=\{\(\) => goTo\(run\.startIndex\)\}/u);
});

test("Jira shell screens show the gallery top-bar divider", () => {
	assert.match(PAGE_SOURCE, /activeScreen\?\.design === "for-you"/u);
	assert.match(PAGE_SOURCE, /activeScreen\?\.design === "jira-kanban"/u);
	assert.doesNotMatch(PAGE_SOURCE, /activeScreen\?\.design === "jira-list"/u);
	assert.match(PAGE_SOURCE, /showTopBarBorder=\{showTopBarBorder\}/u);
});

test("Entering the Global Rovo screen restores the default agent and greeting", () => {
	assert.match(PAGE_SOURCE, /const \{ resetAgentToRovo, resetChat \} = useRovoChat\(\);/u);
	assert.match(
		PAGE_SOURCE,
		/if \(screen\?\.design !== "rovo"\) return;\s*resetAgentToRovo\(\);\s*resetChat\(\);/u,
	);
	assert.match(PAGE_SOURCE, /<ResetRovoChatOnEntry screen=\{activeScreen\} \/>/u);
});

test("Global For you fills the stage with the complete Jira shell", () => {
	assert.match(
		FOR_YOU_STAGE_SOURCE,
		/<JiraForYouShell[\s\S]*shellHeight="parent"[\s\S]*showConversationHeaderBorder=\{false\}\s*>/u,
	);
	assert.match(FOR_YOU_STAGE_SOURCE, /return <JiraShellStage \/>;/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /h-full min-h-0 w-\[100cqw\]/u);
	assert.doesNotMatch(FOR_YOU_STAGE_SOURCE, /dockOpen|pb-56|pb-8/u);
	assert.doesNotMatch(FOR_YOU_STAGE_SOURCE, /JGP_FOR_YOU_SECTIONS|JgpRovoOverlay|JiraForYouPage/u);
	assert.match(ASX_PAGE_SOURCE, /<ForYouStageLayout dockOpen=\{dockOpen\} onItemClick=\{handleItemClick\} \/>/u);
	assert.doesNotMatch(ASX_PAGE_SOURCE, /<JiraForYouPage/u);
	assert.match(
		SHARED_FOR_YOU_STAGE_SOURCE,
		/<JiraForYouPage onItemClick=\{onItemClick\} onView=\{onView\} sections=\{sections\} tabs=\{tabs\} \/>/u,
	);
});

test("Global Kanban cards open the shared chat, work-item, and details workspace", () => {
	assert.match(JIRA_DESIGN_WORK_ITEMS_SOURCE, /JIRA_DESIGN_WORKSPACE_SECTIONS = JIRA_FOR_YOU_SECTIONS/u);
	assert.match(JIRA_DESIGN_WORK_ITEMS_SOURCE, /JIRA_DESIGN_WORK_ITEMS_BY_KEY = new Map<string, JiraForYouItem>/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /<JiraForYouWorkspace[\s\S]*feedResizeLabel="Resize Jira Design view panel"/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /renderFeed=\{\(\{ activeItemId, onItemActivate \}\) => \([\s\S]*<JiraKanbanPage[\s\S]*compactHeader=\{Boolean\(activeItemId\)\}/u);
	assert.equal((FOR_YOU_STAGE_SOURCE.match(/workItemsByKey\.get/gu) ?? []).length, 2);
	assert.equal((FOR_YOU_STAGE_SOURCE.match(/onItemActivate\(item\);/gu) ?? []).length, 2);
	assert.match(FOR_YOU_STAGE_SOURCE, /sections = JIRA_DESIGN_WORKSPACE_SECTIONS/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /sections=\{sections\}/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /showScrollAffordance=\{false\}/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /showConversationHeaderBorder=\{false\}/u);
});

test("Global Jira Design preserves the default chat width across sidebar changes", () => {
	assert.match(FOR_YOU_STAGE_SOURCE, /feedResizeLabel="Resize Jira Design view panel"[\s\S]*preserveChatWidthAcrossSidebar/u);
});

test("Global Jira Design starts with the VITA-142 chat and details open", () => {
	assert.match(
		FOR_YOU_STAGE_SOURCE,
		/defaultOpenItemId = "vitafleet-presentation"[\s\S]*<JiraForYouWorkspace[\s\S]*defaultDetailPanelOpen[\s\S]*defaultOpenItemId=\{defaultOpenItemId\}/u,
	);
	assert.match(JIRA_DESIGN_WORK_ITEMS_SOURCE, /id: "vitafleet-presentation"|JIRA_FOR_YOU_SECTIONS/u);
});

test("Global Jira Design starts with the product sidebar collapsed", () => {
	assert.match(
		FOR_YOU_STAGE_SOURCE,
		/<JiraShellStage[\s\S]*defaultSelectedSidebarItem=\{JIRA_DESIGN_PROJECT\.name\}[\s\S]*defaultSidebarOpen=\{false\}/u,
	);
});

test("Global Kanban marks the open workspace card independently from bulk selection", () => {
	assert.match(JIRA_DESIGN_WORK_ITEMS_SOURCE, /JIRA_DESIGN_WORK_ITEMS_BY_ID = new Map<string, JiraForYouItem>/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /activeCardCode=\{activeItemId[\s\S]*workItemsById\.get\(activeItemId\)\?\.issueKey[\s\S]*: undefined\}/u);
});

test("Board and List derive the same work items from the For you dataset", () => {
	assert.match(JIRA_DESIGN_WORK_ITEMS_SOURCE, /JIRA_DESIGN_WORK_ITEMS = JIRA_DESIGN_WORKSPACE_SECTIONS\.flatMap/u);
	assert.match(JIRA_DESIGN_WORK_ITEMS_SOURCE, /AVATARS\.slice\(0, 6\)/u);
	assert.match(JIRA_DESIGN_WORK_ITEMS_SOURCE, /const assignee = getJiraDesignAssignee\(item\.id\)/u);
	assert.match(JIRA_DESIGN_WORK_ITEMS_SOURCE, /JIRA_DESIGN_KANBAN_COLUMNS:[\s\S]*JIRA_DESIGN_WORK_ITEMS[\s\S]*item\.issueKey[\s\S]*item\.title/u);
	assert.match(JIRA_DESIGN_WORK_ITEMS_SOURCE, /createJiraDesignListRows[\s\S]*workItemsByKey: ReadonlyMap<string, JiraForYouItem> = JIRA_DESIGN_WORK_ITEMS_BY_KEY[\s\S]*workItemsByKey\.get\(card\.code\)[\s\S]*issueKey: item\.issueKey[\s\S]*summary: item\.title/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /boardColumns=\{boardColumns\}/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /onBoardColumnsChange=\{updateBoardColumns\}/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /createJiraDesignListRows\(filteredBoardColumns, workItemsByKey\)/u);
});

test("Global Jira Design cards keep human assignees while active agents use activity rows", () => {
	assert.match(JIRA_DESIGN_WORK_ITEMS_SOURCE, /function getJiraDesignAssignee[\s\S]*needs a human assignee/u);
	assert.match(
		JIRA_DESIGN_WORK_ITEMS_SOURCE,
		/const assignee = getJiraDesignAssignee\(item\.id\);[\s\S]*agentActivities: createJiraDesignAgentActivities\(item\)[\s\S]*assignee,[\s\S]*avatarSrc: assignee\.avatarSrc/u,
	);
	assert.match(
		JIRA_DESIGN_WORK_ITEMS_SOURCE,
		/function createJiraDesignAgentActivities[\s\S]*if \(!item\.agents\?\.length\)[\s\S]*return undefined;[\s\S]*state = hasAwaitingAgent && index === 0 \? "awaiting-input" as const : "working" as const/u,
	);
});

test("Jira Design board tags keep space names and omit agent-state summaries", () => {
	assert.match(
		JIRA_DESIGN_WORK_ITEMS_SOURCE,
		/tags: \[\s*\{ color: "blue" as const, text: item\.spaceName \},\s*\],/u,
	);
	assert.doesNotMatch(JIRA_DESIGN_WORK_ITEMS_SOURCE, /text: item\.status/u);
	assert.match(
		JIRA_DESIGN_WORK_ITEMS_SOURCE,
		/createJiraDesignListRows[\s\S]*labels: \[\{ color: "blue", text: item\.spaceName \}\]/u,
	);
});

test("Global Jira Design screens share functional Board and List line tabs", () => {
	assert.match(JIRA_DESIGN_VIEW_TABS_SOURCE, /<Tabs[\s\S]*value=\{activeView\}/u);
	assert.match(JIRA_DESIGN_VIEW_TABS_SOURCE, /<TabsList className="h-9 w-full justify-start px-2" variant="line">/u);
	assert.match(JIRA_DESIGN_VIEW_TABS_SOURCE, /<TabsTrigger className="flex-none" value="board">[\s\S]*Board[\s\S]*<TabsTrigger className="flex-none" value="list">[\s\S]*List/u);
	assert.match(JIRA_DESIGN_VIEW_TABS_SOURCE, /<BoardIcon label="" \/>/u);
	assert.match(JIRA_DESIGN_VIEW_TABS_SOURCE, /<TableIcon label="" \/>/u);
	assert.doesNotMatch(JIRA_DESIGN_VIEW_TABS_SOURCE, /(?:BoardIcon|TableIcon) label="" size="small"/u);
	assert.match(STAGE_SOURCE, /const \[view, setView\] = useState<JiraDesignView>\("board"\);/u);
	assert.match(STAGE_SOURCE, /return <JiraDesignWorkspaceStage onViewChange=\{setView\} view=\{view\} \/>;/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /viewTabs=\{<JiraDesignViewTabs activeView="board" onViewChange=\{onViewChange\} \/>\}/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /<JiraDesignViewTabs activeView="list" onViewChange=\{onViewChange\} \/>/u);
	assert.match(
		FOR_YOU_STAGE_SOURCE,
		/<JiraShellStage[\s\S]*defaultSelectedSidebarItem=\{JIRA_DESIGN_PROJECT\.name\}[\s\S]*defaultSidebarOpen=\{false\}/u,
	);
	assert.equal((FOR_YOU_STAGE_SOURCE.match(/defaultSelectedSidebarItem=\{JIRA_DESIGN_PROJECT\.name\}/gu) ?? []).length, 1);
	assert.match(FOR_YOU_STAGE_SOURCE, /import \{ JiraKanbanBoardHeader \} from "@\/components\/blocks\/jira-kanban\/board-header";/u);
});

test("Global Jira Design list reuses the board controls with a list search label", () => {
	assert.match(FOR_YOU_STAGE_SOURCE, /<JiraListFeed[\s\S]*compactHeader=\{Boolean\(activeItemId\)\}/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /<JiraKanbanBoardHeader[\s\S]*searchPlaceholder="Search list"[\s\S]*surfaceLabel="list"/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /filterJiraKanbanColumnsByAssignee\(boardColumns, selectedAssigneeIds\)/u);
});

test("Board and List swap only the persistent workspace feed", () => {
	assert.equal((FOR_YOU_STAGE_SOURCE.match(/<JiraForYouWorkspace/gu) ?? []).length, 1);
	assert.match(FOR_YOU_STAGE_SOURCE, /renderFeed=\{\(\{ activeItemId, onItemActivate \}\) => \([\s\S]*view === "board" \? \([\s\S]*<JiraKanbanPage[\s\S]*\) : \([\s\S]*<JiraListFeed[\s\S]*onViewChange=\{onViewChange\}/u);
	assert.match(FOR_YOU_STAGE_SOURCE, /<JiraListFeed[\s\S]*activeIssueKey=\{activeItemId[\s\S]*workItemsById\.get\(activeItemId\)\?\.issueKey/u);
	assert.doesNotMatch(STAGE_SOURCE, /view === "board" \? \([\s\S]*JiraKanbanWorkspaceStage[\s\S]*JiraListWorkspaceStage/u);
});

test("Page gives Jira Golden Journey v1 a shaded Rovo-purple gallery palette", () => {
	assert.match(PAGE_SOURCE, /const ROVO_PURPLE_PALETTE(?:: GalleryPalette)? = \["#5E2C9D", "#7A3BB3", "#9850CC", "#AF59E1"\];/u);
	assert.match(PAGE_SOURCE, /palette=\{ROVO_PURPLE_PALETTE\}/u);
});

test("Page defaults Terminal to a locally controllable dark subtree theme", () => {
	assert.match(PAGE_SOURCE, /activeScreen\?\.section === "Terminal"/u);
	assert.match(PAGE_SOURCE, /useState<"dark" \| "light">\("dark"\)/u);
	assert.match(PAGE_SOURCE, /"data-subtree-theme": ""/u);
	assert.match(PAGE_SOURCE, /"data-color-mode": terminalTheme/u);
	assert.match(
		PAGE_SOURCE,
		/"data-theme": `\$\{terminalTheme\}:\$\{terminalTheme\} spacing:spacing typography:typography shape:shape`/u,
	);
	assert.match(PAGE_SOURCE, /bg-surface" \{\.\.\.subtreeThemeProps\}/u);
	assert.match(PAGE_SOURCE, /theme=\{isTerminalSection \? terminalTheme : undefined\}/u);
	assert.match(
		PAGE_SOURCE,
		/onThemeCycle=\{isTerminalSection \? handleTerminalThemeCycle : undefined\}/u,
	);
	assert.match(PAGE_SOURCE, /current === "dark" \? "light" : "dark"/u);
});

test("Terminal frame and panes follow the route-owned light or dark theme", () => {
	assert.match(TERMINAL_STAGE_SOURCE, /border-border bg-surface-raised[^"]*text-text/u);
	assert.match(
		TERMINAL_STAGE_SOURCE,
		/className=\{cn\("w-px", state\.split \? "bg-border" : "bg-transparent"\)\}/u,
	);
	assert.doesNotMatch(TERMINAL_STAGE_SOURCE, /TERMINAL_FRAME_ZINC_VARS|--ds-/u);

	for (const source of [
		TERMINAL_STAGE_SOURCE,
		TERMINAL_CHROME_SOURCE,
		TERMINAL_CLAUDE_PANE_SOURCE,
		TERMINAL_JIRA_PANE_SOURCE,
	]) {
		assert.doesNotMatch(source, /(?:bg|border|text)-zinc-/u);
	}
});

test("Page adds gated ←/→ keyboard stepping for the active card", () => {
	assert.match(PAGE_SOURCE, /event\.key === "ArrowRight"/u);
	assert.match(PAGE_SOURCE, /event\.key === "ArrowLeft"/u);
	// Must bail on focused interactive controls so the top-bar arrows and dock
	// tiles keep their own key handling.
	assert.match(PAGE_SOURCE, /if \(isInteractiveTarget\(event\.target\)\) return;/u);
});

test("Screen controls provide clickable prev/next that disable at the bounds", () => {
	assert.match(STAGE_SOURCE, /aria-label="Previous screen"/u);
	assert.match(STAGE_SOURCE, /aria-label="Next screen"/u);
	assert.match(STAGE_SOURCE, /onClick=\{prev\}/u);
	assert.match(STAGE_SOURCE, /onClick=\{next\}/u);
	assert.match(STAGE_SOURCE, /disabled=\{!canPrev\}/u);
	assert.match(STAGE_SOURCE, /disabled=\{!canNext\}/u);
	assert.match(STAGE_SOURCE, /\{sectionLabel\(screens, index\)\}/u);
});

test("Section dropdown inherits the active gallery subtree theme", () => {
	// The Terminal section themes the gallery subtree dark. Keep this popup's
	// portal within that subtree instead of mounting it under the light body.
	assert.match(STAGE_SOURCE, /<DropdownMenuContent align="center" portalled=\{false\}>/u);
});

test("Section dropdown opening does not add another flex gap to the centered controls", () => {
	assert.match(STAGE_SOURCE, /<div className="flex items-center text-sm text-text">/u);
	assert.match(STAGE_SOURCE, /size="icon-compact"\s+className="mr-2"\s+aria-label="Previous screen"/u);
	assert.match(
		STAGE_SOURCE,
		/className="mr-2 flex items-center gap-1 rounded-sm px-1 py-0\.5 tabular-nums/u,
	);
});

test("Local session opens the Kanban section with the real board design", () => {
	// The sixth screen is the "Kanban" section rendering the Kanban board design.
	assert.match(SCREENS_SOURCE, /design:\s*"kanban"/u);
	assert.match(SCREENS_SOURCE, /export type SessionScreenDesign = [^;]*"kanban"[^;]*;/u);
	// The stage routes a `design: "kanban"` screen to the real KanbanStage,
	// keyed by screen id so it mounts fresh when navigated to.
	assert.match(STAGE_SOURCE, /screen\?\.design === "kanban"/u);
	assert.match(STAGE_SOURCE, /<KanbanStage key=\{screen\.id\} scenario=\{scenario\} \/>/u);
	assert.match(
		STAGE_SOURCE,
		/screen\.scenario === "local-completed" \|\| screen\.scenario === "global-assignment"/u,
	);

	// The Kanban/Rovo design stages call `useRovoChat`, so the JGP tree must be
	// wrapped in a RovoChatProvider (not reliant on an ancestor route).
	assert.match(PAGE_SOURCE, /import \{ RovoChatProvider \} from "@\/app\/contexts\/context-rovo-chat";/u);
	// The provider receives the JGP agent profiles so local personas (rfp-drafter,
	// service-impact-agent, …) resolve instead of falling back to default Rovo.
	assert.match(PAGE_SOURCE, /<RovoChatProvider agentProfiles=\{JGP_CHAT_AGENT_PROFILES\}>/u);
	assert.match(PAGE_SOURCE, /import \{ JGP_CHAT_AGENT_PROFILES \} from "\.\/data\/agent-chat-data";/u);
});

test("Top-bar label counts position within the current section", () => {
	// Local has seven opening Terminal screens, one Kanban screen, four resumed
	// Terminal screens, then Kanban again. Global adds Kanban, one Rovo screen,
	// For you and the combined Jira Design Board/List screen.
	// The counter resets per run (U+00B7 middle dot), even when a section name is reused later.
	const sections = [...SCREENS_SOURCE.matchAll(/section:\s*"([^"]+)"/gu)].map((match) => match[1]);
	assert.deepEqual(sections, [
		"Terminal",
		"Terminal",
		"Terminal",
		"Terminal",
		"Terminal",
		"Terminal",
		"Terminal",
		"Kanban",
		"Terminal",
		"Terminal",
		"Terminal",
		"Terminal",
		"Kanban",
		"Kanban",
		"Rovo",
		"For you",
		"Kanban & List",
	]);
	// Section-scoped, contiguous-run label with a middle dot; plain fallback when
	// a screen has no section.
	assert.match(STAGE_SOURCE, /if \(total === 1\) return section;/u);
	assert.match(STAGE_SOURCE, /\$\{section\} \\u00b7 \$\{position\} of \$\{total\}/u);
	assert.match(STAGE_SOURCE, /screens\[start - 1\]\?\.section === section/u);
	assert.match(STAGE_SOURCE, /screens\[end \+ 1\]\?\.section === section/u);
	assert.match(STAGE_SOURCE, /Screen \$\{Math\.min\(index \+ 1, screens\.length\)\} of \$\{screens\.length\}/u);
});

test("Screen navigator clamps at both ends (no wrap)", () => {
	assert.match(NAV_HOOK_SOURCE, /Math\.min\(Math\.max\(value, 0\), Math\.max\(count - 1, 0\)\)/u);
	assert.match(NAV_HOOK_SOURCE, /canPrev: index > 0/u);
	assert.match(NAV_HOOK_SOURCE, /canNext: index < count - 1/u);
});
