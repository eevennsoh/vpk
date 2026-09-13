const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Contract tests for the `team-eu26` fork of the Jira Work Item surface.
//
// Team EU26 was created as a full copy of the v2 tree so it could diverge on any pixel
// without risk to v2 (which itself forked v1). These tests protect the two
// properties that make that fork safe rather than merely duplicated:
//
//   1. Isolation — no tree imports another, so an edit in one can never change
//      another's rendered surface.
//   2. A shared model — the session/planner reducer under `data/` stays single-
//      sourced, so behavioral fixes reach every variant.
//
// The original "starts as a structural duplicate of v2" and root byte-parity
// assertions have been retired: Team EU26 has now diverged by design (one scroll-linked
// section nav replacing the rail toggle and the pull-request tab strip), so
// pinning sameness would have meant listing nearly every file as an exception —
// an assertion that asserts nothing. They are replaced below by contracts on
// what Team EU26 actually is. Isolation and the shared model remain the durable ones.

const BLOCK_DIR = __dirname;
const V1_DIR = path.join(BLOCK_DIR, "experimental");
const V2_DIR = path.join(BLOCK_DIR, "experimental-v2");
const TEAM_EU26_DIR = path.join(BLOCK_DIR, "team-eu26");

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}

/** Repo-relative paths of every `.ts`/`.tsx`/`.js` file under `dir`, recursively. */
function listSourceFiles(dir) {
	return fs
		.readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && /\.(?:tsx?|js)$/u.test(entry.name))
		.map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

test("Team EU26 exists with a distinctly named composition root", () => {
	assert.ok(fs.existsSync(TEAM_EU26_DIR));

	const compositionSource = readBlockFile("team-eu26/team-eu26-jira-work-item.tsx");
	assert.match(compositionSource, /export function TeamEu26JiraWorkItem\(/u);
	assert.match(compositionSource, /export default TeamEu26JiraWorkItem;/u);
	assert.match(compositionSource, /export type TeamEu26JiraWorkItemProps/u);

	// The older root filenames must not linger in Team EU26 — all three roots are
	// imported side by side by the block index, so their names have to stay
	// distinct.
	assert.equal(fs.existsSync(path.join(TEAM_EU26_DIR, "experimental-jira-work-item.tsx")), false);
	assert.equal(fs.existsSync(path.join(TEAM_EU26_DIR, "experimental-v2-jira-work-item.tsx")), false);
});

test("Team EU26 owns the Team EU VITA-1 reference content and geometry", () => {
	const fixtureSource = readBlockFile("team-eu26/data/team-eu26-vita-one.ts");
	const highConfidenceDataSource = readBlockFile("team-eu26/data/high-confidence-work-item.ts");
	for (const copy of [
		"VITA-1",
		"Redesign onboarding flow for new users",
		"Marcus Kim",
		"Annie Cook",
		"Sarah Lim",
		"Elena Rodriguez",
	]) {
		assert.match(fixtureSource, new RegExp(copy, "u"));
	}
	assert.match(fixtureSource, /The paid media budget allocation looks off/u);
	assert.match(fixtureSource, /Visuals are looking strong/u);
	for (const copy of [
		"The current onboarding experience has a high drop-off rate",
		"Q1 Marketing Strategy & Goals",
		"Social Media Campaign Draft.pdf",
		"Write copy for welcome screen",
		"Customer interview video editing",
	]) {
		assert.match(highConfidenceDataSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
	}

	const layoutSource = readBlockFile("team-eu26/components/experimental-work-item-layout.tsx");
	assert.match(layoutSource, /max-w-\[1920px\]/u);
	assert.match(layoutSource, /@\[860px\]\/agentlayout:px-6/u);
	assert.match(
		layoutSource,
		/@\[860px\]\/agentlayout:static @\[860px\]\/agentlayout:shrink-0 @\[860px\]\/agentlayout:bg-transparent/u,
	);
	assert.match(readBlockFile("team-eu26/lib/layout-constants.ts"), /METADATA_PANEL_DEFAULT_WIDTH_PX = 440/u);

	const composerSource = readBlockFile("team-eu26/components/activity-composer.tsx");
	assert.match(composerSource, /Comment, @mention an agent, or \/ for skills/u);
	assert.doesNotMatch(composerSource, /Needs input|AiAgentIcon/u);
});

test("Team EU26 status control uses the project workflow phases", () => {
	const editorDataSource = readBlockFile("team-eu26/components/detail-field-editor-data.ts");

	assert.doesNotMatch(editorDataSource, /BOARD_COLUMNS/u);
	assert.match(
		editorDataSource,
		/export const STATUS_PHASES = \["To do", "In progress", "In review", "Done"\] as const;/u,
	);
	// The restored `In review` phase has to read the same on the details rail as
	// it does on the board and list, which name it `warning`.
	assert.match(editorDataSource, /"In review": "warning"/u);
});

test("Team EU26 uses the stable-height v5 comment composer without an Improve-description prompt", () => {
	const composerSource = readBlockFile("team-eu26/components/activity-composer.tsx");
	const bodyOwner = readBlockFile("team-eu26/components/work-item-body.tsx");
	const bodySource = readBlockFile("team-eu26/components/high-confidence-work-item-body.tsx");

	assert.match(
		composerSource,
		/<JiraActivityComposer[\s\S]*placeholder="Comment, @mention an agent, or \/ for skills"/u,
	);
	assert.doesNotMatch(composerSource, /<JiraActivityComposer[\s\S]*\bexpandOnFocus\b/u);
	assert.doesNotMatch(composerSource, /Type \/ai to ask Rovo|Improve description/u);

	assert.match(bodyOwner, /initialPreset === "filled"[\s\S]*<HighConfidenceWorkItemBody \/>/u);
	assert.match(
		bodySource,
		/<CollapsibleWorkItemSection headingId="team-eu26-description-heading" label="Description">[\s\S]*<ContextEditableDescription \/>/u,
	);
	assert.match(bodySource, /ContextEditableDescription/u);
	assert.doesNotMatch(bodySource, /Type \/ai to ask Rovo|Improve description/u);
});

test("Team EU26 is isolated from v1 and v2", () => {
	for (const filePath of listSourceFiles(TEAM_EU26_DIR)) {
		const source = fs.readFileSync(filePath, "utf8");
		const relativePath = path.relative(BLOCK_DIR, filePath);

		assert.doesNotMatch(source, /jira-work-item\/experimental\//u, `${relativePath} still imports from the v1 experimental tree`);
		assert.doesNotMatch(source, /experimental-v2/u, `${relativePath} still references the v2 tree`);
		assert.doesNotMatch(source, /ExperimentalV2/u, `${relativePath} still references a v2 identifier`);
	}

	for (const olderDir of [V1_DIR, V2_DIR]) {
		for (const filePath of listSourceFiles(olderDir)) {
			assert.doesNotMatch(
				fs.readFileSync(filePath, "utf8"),
				/team-eu26|TeamEu26/u,
				`${path.relative(BLOCK_DIR, filePath)} leaks a Team EU26 reference into an older tree`,
			);
		}
	}
});

test("the Team EU26 surface has one section nav, not a rail toggle plus a PR tab strip", () => {
	// Team EU26's divergence: Description / Activity / Insights (+ Guide / Files under
	// a guided PR) became a single scroll-linked nav in the left column,
	// replacing both the metadata rail's Details/Activity toggle and the
	// pull-request tab strip.
	assert.equal(fs.existsSync(path.join(TEAM_EU26_DIR, "components/metadata-rail-toggle.tsx")), false);
	assert.equal(fs.existsSync(path.join(TEAM_EU26_DIR, "components/context-title-meta.tsx")), false);
	assert.equal(fs.existsSync(path.join(TEAM_EU26_DIR, "lib/metadata-rail-view.ts")), false);

	for (const filePath of listSourceFiles(TEAM_EU26_DIR)) {
		const relativePath = path.relative(BLOCK_DIR, filePath);
		if (relativePath.endsWith(".test.js")) continue;
		assert.doesNotMatch(
			fs.readFileSync(filePath, "utf8"),
			/data-jira-work-item-metadata-rail-toggle|MetadataRailToggle/u,
			`${relativePath} still references the removed metadata rail toggle`,
		);
	}

	const navSource = readBlockFile("team-eu26/components/work-item-section-nav.tsx");
	// Links + aria-current, never ARIA tabs: on a stacked page every section is
	// on screen at once, so tab semantics would misdescribe the surface.
	assert.match(navSource, /<nav\b/u);
	assert.match(navSource, /href=\{`#\$\{sectionElementId\(section\.id\)\}`\}/u);
	assert.match(navSource, /aria-current=\{section\.id === activeSectionId \? "location" : undefined\}/u);
	assert.doesNotMatch(navSource, /role="tab"|aria-selected=|aria-controls=|<TabsTrigger/u);

	const detailViewSource = readBlockFile(
		"team-eu26/components/pull-request-detail/pull-request-detail-view.tsx",
	);
	assert.doesNotMatch(detailViewSource, /<TabsList|<TabsContent|tabNavigation/u);
});

test("the Team EU26 rail keeps the compact reference field set", () => {
	const detailsTabSource = readBlockFile("team-eu26/components/details-tab.tsx");
	assert.match(
		detailsTabSource,
		/label="Assignee">[\s\S]*label="Status">[\s\S]*label="Priority">[\s\S]*label="Agents">/u,
	);
	assert.match(detailsTabSource, /Needs input/u);
	assert.match(
		detailsTabSource,
		/showMore \? \([\s\S]*label="Reporter"[\s\S]*label="Due date"/u,
	);
	assert.doesNotMatch(detailsTabSource, /label="Project"|label="Start date"/u);
	assert.match(detailsTabSource, /grid-cols-\[6\.5rem_minmax\(0,1fr\)\]/u);
	assert.match(readBlockFile("team-eu26/components/metadata-rail.tsx"), /title: "Development"/u);
	assert.match(
		readBlockFile("team-eu26/components/details-sections.tsx"),
		/aclare\/MOB-142-rate-limiting/u,
	);
});

test("the Team EU26 dialog owns the high-confidence identity and action row", () => {
	const dialogSource = readBlockFile("team-eu26/components/experimental-work-item-dialog.tsx");
	assert.match(dialogSource, /grid-rows-\[auto_minmax\(0,1fr\)\]/u);
	assert.match(
		dialogSource,
		/data-jira-work-item-header-band[\s\S]*data-jira-work-item-header-breadcrumb-row[\s\S]*<WorkItemKeyCopy \/>[\s\S]*data-jira-work-item-header-close[\s\S]*<CollapseWorkItemButton \/>[\s\S]*aria-label="Close work item"[\s\S]*data-jira-work-item-header-title-row[\s\S]*<ContextTitleBar \/>[\s\S]*data-jira-work-item-header-actions[\s\S]*aria-label="Manage work item apps"[\s\S]*aria-label="Open agent"[\s\S]*aria-label="Open in code"[\s\S]*data-jira-work-item-header-status[\s\S]*\{navigation\}/u,
	);
	assert.match(
		dialogSource,
		/data-jira-work-item-header-actions[\s\S]*aria-label="Manage work item apps"[\s\S]*aria-label="Add to work item"[\s\S]*aria-label="Open agent"[\s\S]*aria-label="Open in code"[\s\S]*\{statusControl \?/u,
	);
	assert.match(
		dialogSource,
		/<Dialog\.Root[\s\S]*<Dialog\.Portal keepMounted>[\s\S]*<Dialog\.Backdrop[\s\S]*fixed inset-0[\s\S]*<Dialog\.Popup[\s\S]*fixed inset-4/u,
	);
	assert.match(dialogSource, /borderRadius: isFlushInlineSurface \? 0 : token\("radius\.xlarge"\)/u);
	assert.match(dialogSource, /boxShadow: isFlushInlineSurface \? "none" : token\("elevation\.shadow\.overlay"\)/u);
	assert.doesNotMatch(dialogSource, /position:\s*sticky|sticky top-0/u);

	const navSource = readBlockFile("team-eu26/components/work-item-section-nav.tsx");
	assert.match(navSource, /data-work-item-section-nav/u);
	assert.match(navSource, /data-work-item-header-navigation/u);
	assert.match(navSource, /useWorkItemHeaderVariant/u);
	assert.match(navSource, /data-header-variant=\{variant\}/u);
	assert.match(navSource, /"group\/work-item-navigation @container\/resource-row border-b transition-colors/u);
	assert.match(navSource, /variant === "compact" \? "border-border-disabled" : "border-transparent"/u);
	assert.match(navSource, /className="flex items-center gap-1 px-4\.5"/u);
	assert.doesNotMatch(navSource, /ml-auto/u);
	assert.match(navSource, /from "@\/components\/ui\/tabs-experimental"/u);
	assert.match(navSource, /tabsExperimentalListClass/u);
	assert.match(navSource, /tabsExperimentalTriggerClass/u);
	assert.doesNotMatch(navSource, /tabsLineListOverflowClass/u);
	assert.match(navSource, /FOCUS_RING_CLIP_GUTTER/u);
	assert.match(
		navSource,
		/"box-content min-w-0 overflow-x-auto overflow-y-hidden",\s*FOCUS_RING_CLIP_GUTTER/u,
	);
	assert.match(navSource, /NAV_LINK_CLASS = tabsExperimentalTriggerClass/u);
	assert.doesNotMatch(navSource, /export const NAV_LINK_CLASS/u);
	assert.doesNotMatch(navSource, /font\.heading\.xxsmall/u);
	assert.match(navSource, /NAV_LIST_CLASS = cn\([\s\S]*tabsExperimentalListClass/u);
	assert.doesNotMatch(navSource, /NAV_LIST_CLASS = "[^"]*border-b/u);
	assert.doesNotMatch(navSource, /sticky top-0/u);
	assert.doesNotMatch(navSource, /@\[860px\]\/agentlayout:static/u);
	assert.doesNotMatch(navSource, /-mx-6 -mt-6 px-6 pt-6/u);

	const compositionSource = readBlockFile("team-eu26/team-eu26-jira-work-item.tsx");
	assert.match(
		compositionSource,
		/navigation=\{initialPreset === "filled" \|\| initialPreset === "empty" \? undefined : \([\s\S]*<WorkItemSectionNav[\s\S]*endControl=\{\([\s\S]*<PullRequestsSelect/u,
	);
	assert.doesNotMatch(compositionSource, /header=\{|<ContextHeader/u);

	const layoutSource = readBlockFile("team-eu26/components/experimental-work-item-layout.tsx");
	assert.doesNotMatch(layoutSource, /header: ReactNode|chrome: ReactNode|chrome=\{header\}/u);
	assert.match(layoutSource, /<StickyRowScrollFade/u);
	assert.match(layoutSource, /data-jira-work-item-column-chrome/u);
	assert.match(
		layoutSource,
		/data-jira-work-item-column-chrome[\s\S]*@\[860px\]\/agentlayout:overflow-y-auto @\[860px\]\/agentlayout:overscroll-y-none @\[860px\]\/agentlayout:px-6 @\[860px\]\/agentlayout:pt-6 @\[860px\]\/agentlayout:pb-6[\s\S]*data-jira-work-item-scroll-region/u,
	);
	assert.match(
		layoutSource,
		/@\[860px\]\/agentlayout:overflow-visible @\[860px\]\/agentlayout:pl-4 @\[860px\]\/agentlayout:pr-6[\s\S]*data-jira-work-item-metadata-slot/u,
	);
	assert.match(
		readBlockFile("team-eu26/components/metadata-rail.tsx"),
		/overflow-y-auto overscroll-y-none @\[860px\]\/agentlayout:pt-6 @\[860px\]\/agentlayout:pb-8/u,
	);
	assert.match(layoutSource, /setWideScrollContainer\(element\)/u);
	assert.match(layoutSource, /setNarrowScrollContainer\(element\)/u);

	const contextPanelSource = readBlockFile("team-eu26/components/context-panel.tsx");
	assert.doesNotMatch(contextPanelSource, /ContextHeader|data-jira-work-item-context-header|WorkItemSectionNav/u);

	const spyHookSource = readBlockFile("team-eu26/hooks/use-scroll-spy-sections.ts");
	assert.match(
		spyHookSource,
		/export const SCROLL_SPY_STICKY_HEADER_SELECTOR =\s*"\[data-jira-work-item-pull-request-detail-header\]"/u,
	);
	assert.doesNotMatch(spyHookSource, /data-work-item-section-nav/u);

	// The section scroller still resolves from the applied container style, but
	// the Team EU header itself intentionally remains expanded while scrolling.
	const navigationSource = readBlockFile("team-eu26/context-section-navigation.tsx");
	assert.match(navigationSource, /export function useWorkItemHeaderVariant\(\): WorkItemHeaderVariant \{\s*return "expanded";/u);
	assert.match(
		navigationSource,
		/getComputedStyle\(wideScrollContainer\)\.display !== "contents"/u,
	);
	assert.match(navigationSource, /new ResizeObserver\(syncActiveScroller\)/u);
	assert.match(navigationSource, /if \(!active \|\| !wideScrollContainer \|\| !narrowScrollContainer\)/u);
	assert.match(navigationSource, /\[active, narrowScrollContainer, wideScrollContainer\]/u);
	assert.match(
		readBlockFile("team-eu26/team-eu26-jira-work-item.tsx"),
		/<SectionNavigationProvider active=\{open\}>/u,
	);

	const stickyShellSource = readBlockFile(
		"team-eu26/components/pull-request-detail/pull-request-sticky-header-shell.tsx",
	);
	assert.match(stickyShellSource, /@\[860px\]\/agentlayout:sticky @\[860px\]\/agentlayout:top-0/u);
	assert.doesNotMatch(stickyShellSource, /"sticky top-0/u);

	// Regression: the block's docs page mounts three Team EU26 examples at once, so
	// fixed section ids would make `aria-labelledby` ambiguous and point every
	// anchor at the first demo.
	assert.match(navigationSource, /const instanceId = useId\(\)/u);
	assert.match(
		readBlockFile("team-eu26/lib/work-item-section-tabs.ts"),
		/workItemSectionElementId\(\s*instanceId: string,\s*sectionId: WorkItemSectionId,\s*\): string \{\s*return `work-item-section-\$\{instanceId\}-\$\{sectionId\}`/u,
	);

	assert.match(spyHookSource, /\}, \[sectionIds, stickyHeaderSelector\]\);/u);
	assert.doesNotMatch(spyHookSource, /sectionIdsRef/u);
});

test("Team EU26 header collapse control stays static and does not toggle header mode", () => {
	const navigationSource = readBlockFile("team-eu26/context-section-navigation.tsx");
	const headerActionsSource = readBlockFile(
		"team-eu26/components/experimental-breadcrumb-actions.tsx",
	);

	assert.match(headerActionsSource, /<Button aria-label="Collapse" size="icon" variant="ghost">/u);
	assert.match(headerActionsSource, /<ShrinkDiagonalIcon label="" \/>/u);
	assert.doesNotMatch(
		headerActionsSource,
		/<Button aria-label="Collapse"[\s\S]*onClick=/u,
	);
	assert.doesNotMatch(
		headerActionsSource,
		/<Button aria-label="Collapse"[\s\S]*aria-expanded=/u,
	);
	assert.doesNotMatch(headerActionsSource, /Expand header|Collapse header/u);
	assert.doesNotMatch(headerActionsSource, /toggleHeaderVariant/u);
	assert.doesNotMatch(navigationSource, /toggleHeaderVariant|headerVariantOverride/u);
});

test("open work-item chrome publishes a document flag that hides the JGP launcher", () => {
	const dialogSource = readBlockFile("team-eu26/components/experimental-work-item-dialog.tsx");
	assert.match(dialogSource, /document\.documentElement\.dataset\.jiraWorkItemOpen = "true"/u);
	assert.match(dialogSource, /delete document\.documentElement\.dataset\.jiraWorkItemOpen/u);
	assert.match(dialogSource, /\}, \[open\]\);/u);
});

test("the Team EU26 header stays stable while the body scrolls", () => {
	const dialogSource = readBlockFile("team-eu26/components/experimental-work-item-dialog.tsx");
	const navigationSource = readBlockFile("team-eu26/context-section-navigation.tsx");

	assert.match(dialogSource, /useWorkItemHeaderVariant/u);
	assert.match(navigationSource, /export function useWorkItemHeaderVariant\(\): WorkItemHeaderVariant \{\s*return "expanded";/u);
	assert.match(dialogSource, /"flex min-w-0 items-center gap-2 text-sm text-text-subtle"/u);
	assert.match(dialogSource, /"flex min-w-0 flex-col gap-1"/u);
	assert.match(dialogSource, /aria-label="Manage work item apps"[\s\S]*size="icon"/u);
	assert.doesNotMatch(dialogSource, /aria-label="Manage work item apps"[\s\S]*size=\{compactHeader \? "icon-compact" : "icon"\}/u);
	assert.match(dialogSource, /aria-label="Breadcrumb"[\s\S]*Vitafleet[\s\S]*VITA-22[\s\S]*<WorkItemKeyCopy \/>/u);
	assert.match(dialogSource, /"--metadata-panel-width": `\$\{sidebarWidth\}px`/u);
	assert.match(dialogSource, /className="flex min-w-0 items-center"\s*data-jira-work-item-header-title-row/u);
	assert.match(dialogSource, /className="flex min-w-0 flex-1 items-center gap-4 px-6" data-jira-work-item-header-title-actions/u);
	assert.match(
		dialogSource,
		/@\[860px\]\/workitemdialog:w-\[var\(--metadata-panel-width\)\] @\[860px\]\/workitemdialog:shrink-0[\s\S]*data-jira-work-item-header-status/u,
	);
	assert.doesNotMatch(
		dialogSource,
		/shrink-0 items-center self-center w-\[var\(--metadata-panel-width\)\]/u,
	);
	assert.match(
		readBlockFile("team-eu26/components/experimental-work-item-layout.tsx"),
		/@\[860px\]\/agentlayout:w-\[var\(--metadata-panel-width\)\][\s\S]*@\[860px\]\/agentlayout:pl-4 @\[860px\]\/agentlayout:pr-6/u,
	);
	assert.doesNotMatch(dialogSource, /headerHeight|headerContentRef/u);
});

test("PR select shares the section navigation list without becoming a section", () => {
	const navSource = readBlockFile("team-eu26/components/work-item-section-nav.tsx");
	assert.match(
		navSource,
		/<ul className=\{NAV_LIST_CLASS\}>[\s\S]*\{endControl != null \? \([\s\S]*<li[\s\S]*data-work-item-navigation-end-control[\s\S]*\{endControl\}[\s\S]*<\/li>[\s\S]*<\/ul>/u,
	);
	assert.doesNotMatch(navSource, /<\/nav>\s*\) : null\}\s*\{endControl != null/u);
	assert.match(navSource, /onSectionSelect\?\.\(\);/u);

	const selectSource = readBlockFile("team-eu26/components/pull-requests-select.tsx");
	assert.match(selectSource, /tabsExperimentalTriggerClass/u);
	assert.doesNotMatch(selectSource, /font\.heading\.xxsmall/u);
	assert.match(selectSource, /className="inline-flex h-full min-w-0 items-stretch"/u);
	assert.match(selectSource, /const HOVER_CLOSE_DELAY_MS = 100/u);
	assert.match(selectSource, /<Select[\s\S]*onOpenChange=\{handleOpenChange\}[\s\S]*open=\{open\}/u);
	assert.match(
		selectSource,
		/onMouseEnter=\{handleTriggerMouseEnter\}[\s\S]*onMouseLeave=\{scheduleHoverClose\}/u,
	);
	assert.match(selectSource, /retainHoverOpenOnTriggerPressRef/u);
	assert.match(selectSource, /onPointerDownCapture[\s\S]*hoverOpenedRef\.current/u);
	assert.match(
		selectSource,
		/<SelectContent[\s\S]*onMouseEnter=\{cancelHoverClose\}[\s\S]*onMouseLeave=\{scheduleHoverClose\}/u,
	);
	assert.match(selectSource, /data-popup-open:rounded-md/u);
	assert.match(selectSource, /group-data-\[header-variant=compact\]\/work-item-navigation:data-popup-open:rounded-b-none/u);
	assert.match(selectSource, /data-\[variant=none\]:border-x-\[6px\]! data-\[variant=none\]:border-x-transparent!/u);
	assert.doesNotMatch(selectSource, /data-popup-open:bg-bg-neutral-subtle-hovered!/u);
	assert.match(selectSource, /variant="none"/u);
	assert.match(selectSource, /const TRIGGER_LABEL = "Pull requests"/u);
	assert.match(selectSource, /aria-current=\{selectedIdentity \? "location" : undefined\}/u);
	assert.match(
		selectSource,
		/<span[\s\S]*className="shrink-0 text-xs font-normal text-text-subtlest"[\s\S]*\{pullRequestCount\}/u,
	);
	assert.doesNotMatch(selectSource, /<Badge|pullRequestMetricBadgeVariant|lime: "success"|summarizePullRequestTagMetrics/u);
	assert.doesNotMatch(selectSource, /"1 Open"/u);
	assert.match(
		navSource,
		/<span[\s\S]*className=\{cn\([\s\S]*"shrink-0 text-xs font-normal"[\s\S]*section\.id === activeSectionId \? "text-text" : "text-text-subtlest"[\s\S]*\{count\}/u,
	);
	assert.match(navSource, /function sectionTabCount\(/u);
	assert.match(navSource, /case "insights":\s*return insightsCount/u);
	assert.doesNotMatch(navSource, /<Badge>\{activityCount\}<\/Badge>/u);
	assert.doesNotMatch(navSource, /<Badge>\{count\}<\/Badge>/u);
	assert.doesNotMatch(selectSource, /Review pull request/u);
	assert.doesNotMatch(selectSource, /PullRequestIcon|@atlaskit\/icon\/core\/pull-request/u);
	assert.doesNotMatch(selectSource, /@max-\[36rem\]\/resource-row:hidden/u);
	assert.doesNotMatch(selectSource, /data-variant=default|variant="default"|SelectTag/u);

	const sectionTabsSource = readBlockFile("team-eu26/lib/work-item-section-tabs.ts");
	assert.match(
		sectionTabsSource,
		/export type WorkItemSectionId = "description" \| "activity" \| "insights" \| "guide" \| "files"/u,
	);
	assert.match(
		sectionTabsSource,
		/id: "description", label: "Description"[\s\S]*id: "activity", label: "Activity"[\s\S]*id: "insights", label: "Insights"/u,
	);
	assert.doesNotMatch(
		readBlockFile("team-eu26/components/work-item-body.tsx"),
		/id="insights"/u,
	);
	assert.match(
		readBlockFile("team-eu26/components/context-panel.tsx"),
		/selectedPullRequestEntry \? \([\s\S]*<PullRequestDetailView[\s\S]*insightsSelected && !hasInsights \? \([\s\S]*<InsightsPanel[\s\S]*<InsightsWorkItemSplit[\s\S]*workItem=\{workItem\}/u,
	);
	const sectionNavigationSource = readBlockFile("team-eu26/context-section-navigation.tsx");
	assert.match(
		sectionNavigationSource,
		/export function usePublishActivityCount\(count: number\): void \{\s*const \{ setActivityCount \} = useSectionNavigation\(\);\s*useEffect\(\(\) => \{\s*setActivityCount\(count\);\s*\}, \[count, setActivityCount\]\);/u,
	);
	assert.doesNotMatch(
		sectionNavigationSource,
		/return \(\) => setActivityCount\(null\)/u,
	);
	assert.match(sectionNavigationSource, /pendingSectionId/u);
	assert.match(sectionNavigationSource, /window\.requestAnimationFrame\(\(\) => \{/u);
	assert.match(sectionNavigationSource, /selectSection\(pendingSectionId\)/u);
	assert.match(
		readBlockFile("team-eu26/components/insights-panel.tsx"),
		/hasInsights \? activity : null/u,
	);
	assert.doesNotMatch(
		readBlockFile("team-eu26/components/insights-panel.tsx"),
		/JiraInsightsContent|onSourceSelect|data-work-item-insights-panel|<section/u,
	);
	assert.match(
		readBlockFile("team-eu26/components/context-panel.tsx"),
		/<InsightsPanel activity=\{insightsFeed\} hasInsights=\{hasInsights\} \/>/u,
	);
	const contextPillsSource = readBlockFile("team-eu26/components/activity-composer-context-pills.tsx");
	assert.doesNotMatch(contextPillsSource, /justify-between/u);
	assert.match(
		contextPillsSource,
		/className="flex min-h-10 min-w-0 flex-1 items-center \[&_\[data-context-bar\]\]:mb-0"/u,
	);
	assert.doesNotMatch(contextPillsSource, /ActivityComposerNewInsightsPill|data-jira-work-item-new-insights-pill|newInsightsCount|onNewInsightsSelect|setNewInsightsDismissed|selectSection\("insights"\)/u);
	assert.equal(
		fs.existsSync(path.join(TEAM_EU26_DIR, "components/activity-composer-new-insights-pill.tsx")),
		false,
	);
	assert.doesNotMatch(sectionTabsSource, /pull-request/u);

	const compositionSource = readBlockFile("team-eu26/team-eu26-jira-work-item.tsx");
	assert.match(
		compositionSource,
		/<WorkItemSectionNav[\s\S]*endControl=\{\([\s\S]*<PullRequestsSelect[\s\S]*entries=\{pullRequestEntries\}/u,
	);
	assert.match(
		compositionSource,
		/<WorkItemSectionNav[\s\S]*onSectionSelect=\{selectedPullRequestIdentity \? handlePullRequestClear : undefined\}/u,
	);
	assert.doesNotMatch(compositionSource, /<InsightsAwareComposer[\s\S]*onSectionSelect=/u);
	assert.match(compositionSource, /insightsSnapshot\?: JiraInsightsSnapshot/u);
	assert.match(compositionSource, /const insightsSnapshot = props\.insightsSnapshot \?\? EMPTY_JIRA_INSIGHTS_SNAPSHOT/u);
	assert.match(
		compositionSource,
		/<SectionNavigationProvider active=\{open\}>[\s\S]*<WorkItemInsightsProvider[\s\S]*snapshot=\{insightsSnapshot\}/u,
	);
	assert.match(compositionSource, /<JiraInsightsProvider onSourceSelect=\{handleInsightSourceSelect\} snapshot=\{snapshot\}>/u);
	assert.match(compositionSource, /function InsightsAwareComposer/u);
	assert.match(compositionSource, /insightsSelected && hasInsights/u);
	assert.match(compositionSource, /activityEvents\.flatMap/u);
	assert.match(compositionSource, /<JiraInsightsScrubber activityTimestamps=\{activityTimestamps\} \/>/u);
	assert.match(
		compositionSource,
		/usePublishInsightsCount\(\s*resolveNewInsightsCount\(\s*contextResources,\s*hasInsights \? unreadCheckpointIds\.length : undefined,/u,
	);
	assert.doesNotMatch(compositionSource, /newInsightsCount=|onNewInsightsSelect=|selectLatestUnread/u);
	assert.doesNotMatch(compositionSource, /showDescriptionTools|descriptionViewMode|onDescriptionViewModeChange/u);
});

test("Team EU26 insight sources reuse work-item, session, activity, and pull-request owners", () => {
	const compositionSource = readBlockFile("team-eu26/team-eu26-jira-work-item.tsx");
	const composerSource = readBlockFile("team-eu26/components/activity-composer.tsx");
	const pillsSource = readBlockFile("team-eu26/components/activity-composer-context-pills.tsx");

	assert.match(compositionSource, /source\.kind === "work-item-section"/u);
	assert.match(compositionSource, /source\.kind === "activity-entry"/u);
	assert.match(compositionSource, /requestRevealLatestActivity\(source\.entryId\)/u);
	assert.match(compositionSource, /source\.kind === "agent-session"/u);
	assert.match(compositionSource, /actions\.openSession\(source\.sessionId\)/u);
	assert.match(compositionSource, /source\.kind === "pull-request"/u);
	assert.match(compositionSource, /onOpenPullRequestIdentity\?\.\(source\.identity\)/u);
	assert.match(compositionSource, /const \{ onSourceSelect \} = useJiraInsights\(\)/u);
	assert.match(compositionSource, /<ActivityPanel[\s\S]*\{\.\.\.props\}[\s\S]*onInsightSourceSelect=\{onSourceSelect\}[\s\S]*surface=\{surface\}/u);
	assert.doesNotMatch(
		readBlockFile("team-eu26/components/context-panel.tsx"),
		/JiraInsightSource|handleInsightSourceSelect/u,
	);
	assert.doesNotMatch(composerSource, /newInsightsCount|onNewInsightsSelect|onSectionSelect/u);
	assert.doesNotMatch(composerSource, /ActivityComposerContextPills|contextBar=\{composerContextBar\}/u);
	assert.match(composerSource, /placeholder="Comment, @mention an agent, or \/ for skills"/u);
	assert.match(pillsSource, /contextBar !== undefined \? \([\s\S]*flex-1 items-center \[&_\[data-context-bar\]\]:mb-0">[\s\S]*\{contextBar\}/u);
	assert.doesNotMatch(pillsSource, /onNewInsightsSelect|selectSection\("insights"\)|data-jira-work-item-new-insights-pill/u);
});

test("Team EU26 shares one insight selection between the filtered feed and editorial rail", () => {
	const metadataSource = readBlockFile("team-eu26/components/metadata-rail.tsx");
	const contextSource = readBlockFile("team-eu26/components/context-panel.tsx");

	assert.match(metadataSource, /useSectionNavigation\(\)/u);
	assert.match(metadataSource, /hidden=\{pullRequestSelected \|\| insightsSelected\}/u);
	assert.match(metadataSource, /inert=\{pullRequestSelected \|\| insightsSelected \? true : undefined\}/u);
	assert.match(
		metadataSource,
		/!pullRequestSelected && insightsSelected \? \([\s\S]*<JiraInsightsEditorialPane/u,
	);
	assert.match(
		metadataSource,
		/selectedPullRequestEntry \? \([\s\S]*<PullRequestContextRail/u,
	);
	assert.doesNotMatch(metadataSource, /useState/u);
	assert.match(
		contextSource,
		/selectedPullRequestEntry \? \([\s\S]*<PullRequestDetailView[\s\S]*insightsSelected && !hasInsights \? \([\s\S]*<InsightsPanel[\s\S]*<InsightsWorkItemSplit[\s\S]*insights=\{insightsSelected && hasInsights/u,
	);
	assert.match(
		readBlockFile("team-eu26/components/insights-work-item-split.tsx"),
		/ariaLabel="Resize insights and work item"/u,
	);
	assert.match(
		readBlockFile("team-eu26/components/insights-work-item-split.tsx"),
		/testId="jira-work-item-insights-resize-handle"/u,
	);
	assert.match(
		readBlockFile("team-eu26/components/work-item-side-panel-resize-handle.tsx"),
		/SidebarResizeHandle/u,
	);
});

test("Team EU26 does not render a closed-state floating Rovo launcher", () => {
	const sessionSurfaceSource = readBlockFile("team-eu26/components/floating-session-surface.tsx");
	assert.match(sessionSurfaceSource, /<AsxRovoOverlay[\s\S]*launcher="hidden"/u);
	assert.doesNotMatch(sessionSurfaceSource, /launcherContainer|LAUNCHER_PLACEMENT|onLauncherClick/u);
	assert.doesNotMatch(sessionSurfaceSource, /data-jira-work-item-dialog-body/u);
});

test("Team EU26 shares the session/planner data layer", () => {
	assert.match(
		readBlockFile("team-eu26/team-eu26-jira-work-item.tsx"),
		/@\/components\/blocks\/jira-work-item\/data\/session-state/u,
	);
	assert.match(
		readBlockFile("team-eu26/use-jira-work-item-controller.ts"),
		/@\/components\/blocks\/jira-work-item\/data\/session-state/u,
	);
	// V6 owns presentation fixtures only; the reducer/session engine stays shared.
	assert.equal(fs.existsSync(path.join(TEAM_EU26_DIR, "data", "session-state.ts")), false);
	assert.equal(fs.existsSync(path.join(TEAM_EU26_DIR, "data", "team-eu26-vita-one.ts")), true);

	const fixturesSource = readBlockFile("data/session-fixtures.ts");
	const sessionStateSource = readBlockFile("data/session-state.ts");
	assert.match(fixturesSource, /export const FILLED_ATLASSIAN_PROJECT = STOREFRONT_PLATFORM_PROJECT\.id/u);
	assert.equal(
		(sessionStateSource.match(/atlassianProject: FILLED_ATLASSIAN_PROJECT/gu) ?? []).length,
		2,
	);
});

test("Activity sort hover-reveals from the section group, not a local copy", () => {
	const sectionSource = readBlockFile("team-eu26/components/work-item-section.tsx");
	const activityPanelSource = readBlockFile("team-eu26/components/activity-panel.tsx");
	const headerSource = fs.readFileSync(
		path.join(BLOCK_DIR, "../jira-activity/jira-activity-header.tsx"),
		"utf8",
	);

	assert.match(sectionSource, /id === "activity" \? "group\/activity"/u);
	assert.match(activityPanelSource, /<JiraActivityViewControl/u);
	assert.match(activityPanelSource, /hideHeader/u);
	assert.doesNotMatch(activityPanelSource, /Show oldest|ACTIVITY_SORT_TRIGGER_REVEAL_CLASS/u);
	assert.match(headerSource, /ACTIVITY_SORT_TRIGGER_REVEAL_CLASS/u);
	assert.match(headerSource, /group-hover\/activity:opacity-100/u);
});

test("Team EU26 uses one chronological Activity feed for activity and insights", () => {
	const activityPanelSource = readBlockFile("team-eu26/components/activity-panel.tsx");

	assert.match(activityPanelSource, /useJiraInsights\(\)/u);
	assert.match(activityPanelSource, /mergeJiraActivityEntriesWithInsights/u);
	assert.match(activityPanelSource, /createdAtMs: createdAtByEntryId\.get\(entry\.id\)/u);
	assert.match(activityPanelSource, /const effectiveFilter = surface === "insights" \? "insights-only" : filter/u);
	assert.match(activityPanelSource, /filterMode="jira-insights"/u);
	assert.match(activityPanelSource, /activeEntryId=\{activeCheckpointId \?\? undefined\}/u);
	assert.match(activityPanelSource, /renderEntry=\{renderActivityEntry\}/u);
	assert.match(activityPanelSource, /<JiraInsightsCheckpoint/u);
	assert.match(activityPanelSource, /id=\{surface === "insights" \? "insights" : "activity"\}/u);
});

test("Team EU26 header Actions menu copies the work item as markdown", () => {
	const overflowMenuSource = readBlockFile(
		"team-eu26/components/experimental-header-overflow-menu.tsx",
	);
	const descriptionSource = readBlockFile(
		"team-eu26/components/context-editable-header.tsx",
	);

	assert.match(
		overflowMenuSource,
		/\[\{ label: "Permission" \}, \{ label: "Watch", count: 1 \}, \{ label: "Share" \}\]/u,
	);
	assert.match(
		overflowMenuSource,
		/\{ label: "Copy work item as markdown", action: "copy-markdown" \}/u,
	);
	assert.match(
		overflowMenuSource,
		/\{ label: "Copy work item as markdown", action: "copy-markdown" \},[\s\S]*\{ label: "Print" \},[\s\S]*\{ label: "Export to", submenu: \["Excel", "Word", "XML"\] \}/u,
	);
	assert.match(overflowMenuSource, /aria-label="Actions"/u);
	assert.match(
		overflowMenuSource,
		/const markdown = `# \$\{workItemCode\}: \$\{title\}\$\{description \? `\\n\\n\$\{description\}` : ""\}`;/u,
	);
	assert.match(overflowMenuSource, /navigator\.clipboard\.writeText\(markdown\)/u);
	assert.match(overflowMenuSource, /case "copy-markdown":/u);
	assert.doesNotMatch(
		readBlockFile("team-eu26/components/context-resources.tsx"),
		/Copy work item as markdown|EditorToolbarModeTabs/u,
	);
	assert.match(descriptionSource, /viewMode="rendered"/u);
	assert.doesNotMatch(descriptionSource, /onViewModeChange/u);
});

test("the Team EU26 Agents details row opens the assigned menu first and swaps to the palette in place", () => {
	const detailsEditorsSource = readBlockFile("team-eu26/components/detail-field-editors.tsx");
	const filledRailSource = readBlockFile("team-eu26/components/high-confidence-metadata-rail.tsx");
	const emptyRailSource = readBlockFile("team-eu26/components/empty-metadata-rail.tsx");

	assert.match(
		detailsEditorsSource,
		/import \{ AgentAssignment, type AgentAssignmentAgent \} from "@\/components\/blocks\/agent-assignment";/u,
	);
	assert.match(
		detailsEditorsSource,
		/const assignedRows = resolveAssignedAgentRows\(value, sessions, staticEvents\);/u,
	);
	assert.match(
		detailsEditorsSource,
		/const assignedAgents = assignedRows\.map\(\(row, rowIndex\): AgentAssignmentAgent =>[\s\S]*status: row\.session !== undefined && row\.session\.status !== "completed"[\s\S]*<WorkingSessionActivityByline session=\{row\.session\} sessionIndex=\{rowIndex\} \/>[\s\S]*<WorkingSessionActivityByline fallbackLabel=\{row\.statusLabel\} \/>[\s\S]*statusKind: row\.statusKind,[\s\S]*statusLabel: row\.statusLabel,/u,
	);
	assert.match(
		detailsEditorsSource,
		/<AgentAssignment[\s\S]*agents=\{agents\}[\s\S]*assignedAgents=\{assignedAgents\}[\s\S]*defaultPinnedAgentIds=\{DEFAULT_PINNED_SPACE_AGENT_IDS\}[\s\S]*onAssignedAgentIdsChange=\{handleAssignedAgentIdsChange\}[\s\S]*onAssignedAgentSelect=\{handleOpenAgentSession\}[\s\S]*onContinueExistingSession=\{handleContinueExistingSession\}[\s\S]*onStartNewSession=\{handleAgentAssign\}[\s\S]*usedAgentIds=\{resolveUsedAgentIds\(sessions\)\}/u,
	);
	assert.doesNotMatch(detailsEditorsSource, /trigger\?: ReactElement|trigger=\{trigger\}/u);
	for (const railSource of [filledRailSource, emptyRailSource]) {
		assert.match(
			railSource,
			/label="Agent sessions"[\s\S]*<AgentsRowField[\s\S]*onChange=\{\(crew\) => actions\.updateMetadata\(\{ crew \}\)\}[\s\S]*value=\{metadata\.crew\}/u,
		);
		assert.doesNotMatch(railSource, /AiAgentIcon|aria-label="Edit agent sessions"/u);
	}
	assert.match(
		detailsEditorsSource,
		/const handleAssignedAgentIdsChange = \(agentIds: readonly string\[\]\) =>[\s\S]*const nonAgentCrew = value\.filter\(\(member\) => member\.kind !== "agent"\);[\s\S]*const nextAgents = agentIds\.flatMap[\s\S]*onChange\(\[\.\.\.nonAgentCrew, \.\.\.nextAgents\]\);/u,
	);
	assert.match(
		detailsEditorsSource,
		/const handleAgentAssign = \(agent: AgentSelectorAgent\) => \{\s*actions\.invokeAgent\(agent, "context-pill", `@\$\{agent\.name\}`\);\s*\};/u,
	);
	assert.match(
		detailsEditorsSource,
		/const handleOpenAgentSession = \(agent: AgentAssignmentAgent\) => \{\s*const row = assignedRows\.find\(\(candidate\) => candidate\.agentId === agent\.id\);\s*if \(!row\?\.session\) \{\s*actions\.invokeAgent\(agent, "context-pill", `@\$\{agent\.name\}`\);\s*return;\s*\}\s*actions\.openSession\(row\.session\.id\);/u,
	);
	assert.match(
		detailsEditorsSource,
		/const handleContinueExistingSession = \(agent: AgentSelectorAgent\) => \{\s*const session = resolveLatestAgentSession\(sessions, agent\.id\);\s*if \(!session\) \{\s*actions\.invokeAgent\(agent, "context-pill", `@\$\{agent\.name\}`\);\s*return;\s*\}\s*actions\.openSession\(session\.id\);/u,
	);
	assert.match(detailsEditorsSource, /const actions = useJiraWorkItemActions\(\);/u);
	assert.doesNotMatch(detailsEditorsSource, /launchSession|onOpenAgentChat/u);
});

test("the Team EU26 assigned-agents menu lists live agent state and ends in an Assign agent row", () => {
	const detailsEditorsSource = readBlockFile("team-eu26/components/detail-field-editors.tsx");
	const menuSource = fs.readFileSync(
		path.join(process.cwd(), "components/blocks/agent-assignment/components/assigned-agents-menu.tsx"),
		"utf8",
	);

	assert.match(
		menuSource,
		/<RichTextSuggestionMenu[\s\S]*title="Assigned agents"/u,
	);
	assert.match(
		menuSource,
		/inlineMetadata: getAssignedAgentHoverByline\(row, statusKind, rowIndex\),[\s\S]*hoverActions: onArchiveAgent \? \{[\s\S]*primaryLabel: "View"[\s\S]*secondaryLabel: "Archive"/u,
	);
	assert.match(
		detailsEditorsSource,
		/import \{ WorkingSessionActivityByline \} from "@\/components\/blocks\/jira-work-item\/team-eu26\/components\/agent-session-activity-byline";/u,
	);
	assert.match(
		menuSource,
		/<Button[\s\S]*onClick=\{onAddAgent\}[\s\S]*<AiAgentAddIcon label="" \/>[\s\S]*Assign agent/u,
	);
	assert.doesNotMatch(menuSource, /window\.addEventListener|keepMounted|AnimatePresence/u);
});

test("the Team EU26 working-session byline is one shared module, not a per-surface copy", () => {
	const bylineSource = readBlockFile("team-eu26/components/agent-session-activity-byline.tsx");
	const contextPillsSource = readBlockFile("team-eu26/components/activity-composer-context-pills.tsx");

	// The narration cadence, scripts, and shimmer treatment now live in one
	// place that both the composer's working-agents menu and the Details rail's
	// assigned-agents menu import.
	assert.match(bylineSource, /^"use client";/u);
	assert.match(bylineSource, /export const NEEDS_INPUT_STATUS_LABEL = "Needs input";/u);
	assert.match(bylineSource, /export function WorkingSessionActivityByline\(/u);
	assert.match(bylineSource, /"code-planner": \[[\s\S]*"Plan the guest checkout architecture"/u);
	assert.match(bylineSource, /"claude-code": \[[\s\S]*"Implement and verify guest checkout"/u);
	assert.match(bylineSource, /session\.scriptId === "shop-4821-ci-fix"[\s\S]*CI_REPAIR_ACTIVITY_SCRIPT/u);
	assert.match(bylineSource, /`Waiting for \$\{session\.waitingOn\.agentName\}`/u);
	assert.match(bylineSource, /WORKING_SESSION_ACTIVITY_STAGGER_MS \* \(sessionIndex \+ 1\)/u);
	assert.match(bylineSource, /window\.setTimeout\([\s\S]*window\.setInterval\([\s\S]*setActivityCycleIndex\(\(index\) => index \+ 1\)/u);
	assert.match(bylineSource, /window\.clearTimeout\(timeoutId\);[\s\S]*window\.clearInterval\(intervalId\);/u);
	assert.doesNotMatch(bylineSource, /Math\.random/u);

	// Reduced motion, the skip-while-waiting rule, and the `active` pause all
	// short-circuit the same effect, so no surface can leave a timer running.
	assert.match(bylineSource, /const shouldReduceMotion = Boolean\(useReducedMotion\(\)\);/u);
	assert.match(
		bylineSource,
		/if \(!active \|\| shouldReduceMotion \|\| sessionStatus === undefined \|\| sessionStatus === "waiting"\) \{\s*return;\s*\}/u,
	);
	assert.match(bylineSource, /\}, \[active, cycleDelayMs, sessionStatus, shouldReduceMotion\]\);/u);

	// Both modes share one component and one typography wrapper: a live session
	// cycles, a `fallbackLabel` renders statically with no timer and no shimmer.
	assert.match(bylineSource, /session\?: AgentSession;/u);
	assert.match(bylineSource, /fallbackLabel\?: string;/u);
	assert.match(bylineSource, /const activity: string \| null = session\s*\? getWorkingSessionActivity\(session, activityCycleIndex\)\s*: fallbackLabel \?\? null;/u);
	assert.match(bylineSource, /<CyclingByline className="menu-row-byline">/u);
	assert.match(
		bylineSource,
		/needsUserInput && activity !== null \? \(\s*<span className="inline-flex min-w-0 items-baseline">\s*<Shimmer as="span">\{activity\}<\/Shimmer>\s*<AnimatedDots \/>\s*<\/span>\s*\) : activity/u,
	);

	// The composer imports the byline rather than redefining it, and the
	// now-unused byline-only imports are gone (Shimmer stays: the summary pill
	// still uses it).
	assert.match(
		contextPillsSource,
		/import \{ NEEDS_INPUT_STATUS_LABEL, WorkingSessionActivityByline \} from "@\/components\/blocks\/jira-work-item\/team-eu26\/components\/agent-session-activity-byline";/u,
	);
	assert.doesNotMatch(contextPillsSource, /function WorkingSessionActivityByline|function getWorkingSessionActivity/u);
	assert.doesNotMatch(contextPillsSource, /WORKING_SESSION_ACTIVITY_SCRIPTS|CI_REPAIR_ACTIVITY_SCRIPT|NEEDS_INPUT_STATUS_LABEL = /u);
	assert.doesNotMatch(contextPillsSource, /import \{ AnimatedDots \}|import \{ CyclingByline \}/u);
	assert.match(contextPillsSource, /import \{ Shimmer \} from "@\/components\/ui-custom\/shimmer";/u);

	// The composer menu still drives the byline the same way it always did.
	assert.match(
		contextPillsSource,
		/inlineMetadata: \([\s\S]*<WorkingSessionActivityByline[\s\S]*sessionIndex=\{sessionIndex\}/u,
	);
	assert.match(
		contextPillsSource,
		/trailing: session\.status === "waiting"[\s\S]*\{session\.waitingOn\?\.kind === "user" \? NEEDS_INPUT_STATUS_LABEL : "Waiting"\}[\s\S]*: null/u,
	);
});

test("Team EU26 scroll navigation releases pending listeners and timers on unmount", () => {
	const source = readBlockFile("team-eu26/hooks/use-scroll-spy-sections.ts");

	assert.match(source, /clearTimeout\(unlockTimeoutRef\.current\)/u);
	assert.match(source, /removeEventListener\("scrollend", pendingScrollEnd\.handler\)/u);
	assert.match(
		source,
		/useEffect\(\(\) => \{\s*return \(\) => \{\s*clearPendingUnlock\(\);\s*\};\s*\}, \[clearPendingUnlock\]\);/u,
	);
});

test("the Team EU26 lib test suite is registered so it actually runs in CI", () => {
	// Tests under `components/**` are inert unless they are explicitly listed in
	// the unit-test manifest, so a forked test file is worthless until it is
	// classified. Every v2 lib test that runs must have a running Team EU26 twin.
	const manifestSource = fs.readFileSync(path.join(BLOCK_DIR, "../../../scripts/js-unit-test-manifest.mjs"), "utf8");
	const registeredV2Tests = [...manifestSource.matchAll(/"components\/blocks\/jira-work-item\/experimental-v2\/lib\/([\w-]+\.test\.js)"/gu)].map(
		(match) => match[1],
	);

	assert.ok(registeredV2Tests.length > 0, "expected the v2 lib tests to be registered in the unit-test manifest");

	for (const testFile of registeredV2Tests) {
		assert.match(
			manifestSource,
			new RegExp(`"components/blocks/jira-work-item/team-eu26/lib/${testFile}"`, "u"),
			`${testFile} runs for v2 but its Team EU26 twin is not registered in the unit-test manifest`,
		);
		assert.ok(
			fs.existsSync(path.join(TEAM_EU26_DIR, "lib", testFile)),
			`${testFile} is registered for Team EU26 but the file does not exist`,
		);
	}

	// `assigned-agent-rows` is Team EU26-only (it has no v2 twin to inherit
	// registration from), so the loop above cannot reach it. It is the row
	// model behind the Details rail's assigned-agents menu, so it has to run.
	assert.ok(
		fs.existsSync(path.join(TEAM_EU26_DIR, "lib", "assigned-agent-rows.test.js")),
		"expected the assigned-agent-rows row-model test to exist",
	);
	assert.match(
		manifestSource,
		/"components\/blocks\/jira-work-item\/team-eu26\/lib\/assigned-agent-rows\.test\.js"/u,
	);
	assert.match(
		manifestSource,
		/"components\/blocks\/jira-work-item\/jira-work-item-team-eu26-content\.test\.js"/u,
	);
});
