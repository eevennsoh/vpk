const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Filled/empty content and shared Open-in/agent menus for Team EU26.
// Split from jira-work-item-team-eu26.test.js to stay under the 1000-line budget.

const BLOCK_DIR = __dirname;

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}

test("Team EU26 filled preset renders the high-confidence sections and details rail", () => {
	const bodyOwner = readBlockFile("team-eu26/components/work-item-body.tsx");
	const bodySource = readBlockFile("team-eu26/components/high-confidence-work-item-body.tsx");
	const agentSessionsSource = readBlockFile("team-eu26/components/high-confidence-agent-sessions.tsx");
	const highConfidenceDataSource = readBlockFile("team-eu26/data/high-confidence-work-item.ts");
	const workItemStateSource = readBlockFile("team-eu26/data/team-eu26-vita-one.ts");
	const activitySource = readBlockFile("team-eu26/components/activity-panel.tsx");
	const layoutSource = readBlockFile("team-eu26/components/experimental-work-item-layout.tsx");
	const railOwner = readBlockFile("team-eu26/components/metadata-rail.tsx");
	const railSource = readBlockFile("team-eu26/components/high-confidence-metadata-rail.tsx");
	const dialogSource = readBlockFile("team-eu26/components/experimental-work-item-dialog.tsx");

	assert.match(bodyOwner, /initialPreset === "filled"[\s\S]*<HighConfidenceWorkItemBody \/>/u);
	for (const copy of ["Description", "Attachments", "Subtasks", "Linked work items", "Show more attachments"]) {
		assert.match(bodySource, new RegExp(copy, "u"));
	}
	assert.doesNotMatch(bodySource, />Subitmes</u);
	assert.match(bodySource, /<CollapsibleWorkItemSection[\s\S]*headingId="team-eu26-subtasks-heading"[\s\S]*label="Subtasks"/u);
	assert.match(bodySource, /<Table[\s\S]*<TableHeader[\s\S]*<TableBody/u);
	assert.match(bodySource, /<WorkItemsTable aria-label="Subitems"/u);
	assert.match(bodySource, /<WorkItemsTable aria-label="Linked work items"/u);
	assert.match(bodySource, /WORK_ITEM_TABLE_CONTAINER_CLASS[\s\S]*WORK_ITEM_TABLE_CLASS/u);
	assert.match(bodySource, /import \{ WorkItemsTable \} from "@\/components\/blocks\/jira-work-item\/team-eu26\/components\/work-items-table"/u);
	const workItemsTableSource = readBlockFile("team-eu26/components/work-items-table.tsx");
	const tableStylesSource = readBlockFile("team-eu26/components/work-item-table-styles.ts");
	assert.match(tableStylesSource, /rounded-md border border-border/u);
	assert.match(tableStylesSource, /w-full table-fixed/u);
	assert.match(tableStylesSource, /h-10 border-b-0 border-t border-border/u);
	assert.match(workItemsTableSource, /WORK_ITEM_TABLE_HEADER_CLASS/u);
	assert.match(workItemsTableSource, /WORK_ITEM_TABLE_HEAD_CLASS/u);
	assert.match(workItemsTableSource, /WORK_ITEM_TABLE_CONTAINER_CLASS/u);
	assert.match(workItemsTableSource, /LozengeDropdownTrigger/u);
	assert.match(workItemsTableSource, /font-medium text-link underline underline-offset-2/u);
	assert.match(workItemsTableSource, /SubtasksIcon/u);
	assert.match(workItemsTableSource, /<Icon color="currentColor" label=\{`\$\{priority\} priority`\} size="small" \/>/u);
	assert.doesNotMatch(workItemsTableSource, /<Icon color="currentColor" label=""/u);
	assert.match(bodySource, /import \{ Tabs, TabsContent, TabsList, TabsTrigger \} from "@\/components\/ui\/tabs"/u);
	assert.doesNotMatch(bodySource, /ButtonGroup/u);
	const sectionSource = readBlockFile("team-eu26/components/collapsible-work-item-section.tsx");
	const railPanelSource = readBlockFile("team-eu26/components/team-eu-rail-panel.tsx");
	const panelMotionSource = readBlockFile("team-eu26/components/panel-content-motion.ts");
	assert.match(bodySource, /import \{ CollapsibleWorkItemSection \}/u);
	assert.match(sectionSource, /aria-controls=\{contentId\}[\s\S]*aria-expanded=\{expanded\}/u);
	assert.match(sectionSource, /id=\{contentId\}/u);
	assert.match(sectionSource, /absolute inset-0 z-0/u);
	assert.match(sectionSource, /pointer-events-none relative z-10/u);
	assert.doesNotMatch(sectionSource, /variant="ghost"/u);
	assert.doesNotMatch(sectionSource, /aria-expanded:hover:bg-bg-neutral-subtle-hovered/u);
	assert.match(sectionSource, /panelContentVariants\(shouldReduceMotion\)/u);
	assert.match(sectionSource, /inert=\{!expanded \? true : undefined\}/u);
	assert.match(sectionSource, /group-hover\/section:opacity-100 group-focus-within\/section:opacity-100/u);
	assert.match(sectionSource, /expanded[\s\S]*opacity-0[\s\S]*: "opacity-100"/u);
	assert.match(sectionSource, /<span className="min-w-0 truncate">\{label\}<\/span>[\s\S]*ChevronDownIcon/u);
	assert.match(sectionSource, /animate=\{\{ rotate: expanded \? 0 : -90 \}\}/u);
	assert.match(sectionSource, /from "motion\/react"/u);
	assert.match(sectionSource, /useReducedMotion/u);
	assert.match(railPanelSource, /absolute inset-0 z-0/u);
	assert.match(railPanelSource, /pointer-events-none relative z-10/u);
	assert.match(railPanelSource, /relative flex min-h-12 items-center px-4/u);
	assert.doesNotMatch(railPanelSource, /variant="ghost"/u);
	assert.doesNotMatch(railPanelSource, /aria-expanded:hover:bg-bg-neutral-subtle-hovered/u);
	assert.match(railPanelSource, /panelContentVariants\(shouldReduceMotion\)/u);
	assert.match(railPanelSource, /inert=\{!open \? true : undefined\}/u);
	assert.match(railPanelSource, /from "motion\/react"/u);
	assert.match(panelMotionSource, /const CONTENT_ENTER =/u);
	assert.match(panelMotionSource, /const CONTENT_EXIT =/u);
	assert.match(panelMotionSource, /height: "auto"/u);
	assert.match(panelMotionSource, /height: 0/u);
	assert.match(panelMotionSource, /duration: 0\.24/u);
	assert.match(bodySource, /<Tabs[\s\S]*onValueChange=\{\(value\) => value \? setAttachmentFilter\(value as AttachmentFilter\) : undefined\}[\s\S]*value=\{attachmentFilter\}/u);
	assert.match(bodySource, /<TabsList aria-label="Filter attachments" size="default" variant="default">[\s\S]*<TabsTrigger/u);
	assert.match(bodySource, /<TabsContent[\s\S]*value=\{filter\.value\}/u);
	assert.match(bodySource, /aria-label="More attachment actions"[\s\S]*size="icon"/u);
	assert.match(
		bodySource,
		/import \{ toWorkItemChildItems \} from "@\/components\/blocks\/jira-work-item\/team-eu26\/lib\/child-items-progress"/u,
	);
	assert.match(
		bodySource,
		/import \{ ChildItemsProgressBar \} from "@\/components\/projects\/jira\/components\/work-item-modal\/child-items-progress-bar"/u,
	);
	assert.match(bodySource, /const childItems = toWorkItemChildItems\(TEAM_EU26_SUBITEMS, statuses\)/u);
	assert.match(bodySource, /<ChildItemsProgressBar items=\{childItems\} \/>/u);
	assert.match(
		fs.readFileSync(
			path.join(process.cwd(), "components/projects/jira/components/work-item-modal/child-items-progress-bar.tsx"),
			"utf8",
		),
		/aria-valuemax=\{100\}[\s\S]*aria-valuemin=\{0\}[\s\S]*aria-valuenow=\{donePercent\}[\s\S]*role="progressbar"/u,
	);
	assert.match(bodySource, /const \[statuses, setStatuses\] = useState<Record<string/u);
	assert.doesNotMatch(bodySource, /useState\(initialStatus\)/u);
	assert.match(bodyOwner, /<HighConfidenceAgentSessions \/>[\s\S]*\{activity\}/u);
	for (const copy of ["Agent sessions", "Uses AI. Verify results."]) {
		assert.match(agentSessionsSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
	}
	for (const copy of ["Generate onboarding software assets", "Scope VITA-1 and draft the next steps"]) {
		assert.match(highConfidenceDataSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
	}
	assert.match(agentSessionsSource, /import \{ TEAM_EU26_AGENT_SESSIONS \} from "@\/components\/blocks\/jira-work-item\/team-eu26\/data\/high-confidence-work-item"/u);
	assert.match(agentSessionsSource, /<span aria-hidden[\s\S]*<StatusIcon label="" size="small" \/>/u);
	assert.match(activitySource, /meta\.initialPreset === "filled" \|\| meta\.initialPreset === "empty" \? "Activity" : "4 days ago"/u);
	assert.match(layoutSource, /showStickyComposer = planner\.status === "inactive" \|\| planner\.status === "applied"/u);
	assert.match(
		layoutSource,
		/@\[860px\]\/agentlayout:static @\[860px\]\/agentlayout:shrink-0 @\[860px\]\/agentlayout:bg-transparent/u,
	);
	assert.match(layoutSource, /data-jira-work-item-composer-dock[\s\S]*\{composer\}/u);
	assert.doesNotMatch(layoutSource, /showInFlowComposer/u);
	assert.doesNotMatch(layoutSource, /@\[860px\]\/agentlayout:absolute/u);
	assert.match(railOwner, /initialPreset === "filled" \|\| initialPreset === "empty"[\s\S]*<EmptyMetadataRail \/>[\s\S]*<HighConfidenceMetadataRail/u);
	assert.match(
		railSource,
		/<CollapsibleWorkItemSection headingId="team-eu26-details-heading" label="Details" variant="rail">/u,
	);
	assert.match(sectionSource, /isRail \? "min-h-12 px-4" : expanded \? "min-h-9" : "min-h-8"/u);
	for (const copy of ["Needs input..", "Development", "Automation", "Apps"]) {
		assert.match(railSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
	}
	assert.match(railSource, /<TeamEuDevelopmentPanel \/>/u);
	assert.match(railSource, /<TeamEuAutomationPanel[\s\S]*rules=\{automationRules\}/u);
	assert.match(railSource, /<TeamEuAutomationPanel[\s\S]*onShowRecentRuns/u);
	assert.match(railSource, /flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto @\[860px\]\/agentlayout:pt-6/u);
	assert.match(railSource, /<TeamEuAppsPanel \/>/u);
	assert.match(railSource, /aria-hidden=\{showRecentAutomationRuns \|\| undefined\}[\s\S]*inert=\{showRecentAutomationRuns \? true : undefined\}/u);
	assert.match(readBlockFile("team-eu26/components/metadata-rail.tsx"), /<HighConfidenceMetadataRail automationRules=\{automationRules\} \/>/u);
	const developmentPanelSource = readBlockFile("team-eu26/components/team-eu-development-panel.tsx");
	for (const copy of ["1,000", "9,999+", "586", "23", "Needs attention", "Ongoing work", "Merge blocked by failing CI", "Unresolved comments need replies", "feat/dev-panel-empty-state-entry-points", "Annie"]) {
		assert.match(developmentPanelSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
	}
	const automationPanelSource = readBlockFile("team-eu26/components/team-eu-automation-panel.tsx");
	const automationDataSource = readBlockFile("team-eu26/data/team-eu-automation-rules.ts");
	for (const copy of ["Send reminder 24 hours before due date", "Notify team when status changes to Done", "Mark as complete when all subtasks done", "Recent run rules", "Create automation", "167 days ago"]) {
		assert.match(`${automationPanelSource}\n${automationDataSource}`, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
	}
	assert.match(automationPanelSource, /rules\.map[\s\S]*<SetToRecurRow \/>/u);
	assert.match(automationPanelSource, /const runs = recentRules\(rules\)/u);
	assert.match(readBlockFile("team-eu26/components/set-to-recur-popover.tsx"), /Set to recur/u);
	assert.match(readBlockFile("team-eu26/team-eu26-jira-work-item.tsx"), /automationRules=\{props\.automationRules \?\? TEAM_EU_REFERENCE_AUTOMATION_RULES\}/u);
	const appsPanelSource = readBlockFile("team-eu26/components/team-eu-apps-panel.tsx");
	for (const copy of ["My Reminders", "Tempo", "PagerDuty", "Sentry", "Checklist", "Invision for Jira", "Trello Assistant"]) {
		assert.match(appsPanelSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
	}
	for (const editor of ["PersonRowField", "AgentsRowField", "PriorityRowField", "DateRowField"]) {
		assert.match(railSource, new RegExp(`<${editor}`, "u"), `${editor} is not wired into the filled Details rail`);
	}
	assert.match(railSource, /actions\.updateMetadata/u);
	assert.match(railSource, /dateValueMode="utc-date"/u);
	assert.match(readBlockFile("team-eu26/components/detail-field-editors.tsx"), /allowArchive=\{false\}/u);
	assert.match(workItemStateSource, /name: "Automatic"/u);
	assert.match(workItemStateSource, /preset === "filled" \? TEAM_EU26_PEOPLE\.automatic/u);
	assert.match(dialogSource, /aria-label="Breadcrumb"[\s\S]*Vitafleet[\s\S]*VITA-22[\s\S]*<WorkItemKeyCopy \/>/u);
	assert.match(dialogSource, /<WorkItemAgentSelectorMenu[\s\S]*aria-label="Open agent"/u);
	assert.match(dialogSource, /<OpenInMenu[\s\S]*aria-label="Open in code"/u);
	assert.doesNotMatch(dialogSource, /openChat|setChatOpen/u);
	assert.match(dialogSource, /import AiAgentIcon from "@atlaskit\/icon\/core\/ai-agent"/u);
	assert.match(dialogSource, /data-jira-work-item-header-actions[\s\S]*<AppsIcon label="" size="medium" \/>[\s\S]*<AddIcon label="" size="medium" \/>[\s\S]*<AiAgentIcon aria-hidden label="" size="medium" \/>[\s\S]*<AngleBracketsIcon label="" size="medium" \/>/u);
	assert.match(
		readBlockFile("team-eu26/components/work-item-header-status.tsx"),
		/className="flex h-10 min-w-0 w-full shrink-0 items-center justify-between rounded-lg bg-bg-selected p-2"/u,
	);
	assert.match(
		readBlockFile("team-eu26/components/work-item-header-status.tsx"),
		/<StatusPill compact onChange=\{\(status\) => actions\.updateMetadata\(\{ status \}\)\}/u,
	);
	assert.match(readBlockFile("team-eu26/data/team-eu26-vita-one.ts"), /Due date changed to May 25, 2026 by/u);
});

test("Team EU26 empty preset uses sparse wiv-v2 body and rail", () => {
	const bodyOwner = readBlockFile("team-eu26/components/work-item-body.tsx");
	const emptyBodySource = readBlockFile("team-eu26/components/empty-work-item-body.tsx");
	const emptyRailSource = readBlockFile("team-eu26/components/empty-metadata-rail.tsx");
	const emptyDataSource = readBlockFile("team-eu26/data/empty-work-item.ts");
	const workItemStateSource = readBlockFile("team-eu26/data/team-eu26-vita-one.ts");
	const developmentSource = readBlockFile("team-eu26/components/team-eu-development-panel.tsx");
	const automationSource = readBlockFile("team-eu26/components/team-eu-automation-panel.tsx");
	const compositionSource = readBlockFile("team-eu26/team-eu26-jira-work-item.tsx");

	assert.match(bodyOwner, /initialPreset === "empty"[\s\S]*<EmptyWorkItemBody \/>/u);
	assert.doesNotMatch(bodyOwner, /initialPreset === "empty"[\s\S]*<HighConfidenceWorkItemBody/u);
	assert.match(emptyBodySource, /Add a description/u);
	assert.match(emptyBodySource, /Add attachment/u);
	assert.match(emptyBodySource, /Add subtask/u);
	assert.match(emptyBodySource, /Add linked work item/u);
	assert.doesNotMatch(emptyBodySource, /The current onboarding experience has a high drop-off rate/u);
	assert.doesNotMatch(emptyBodySource, /TEAM_EU26_ATTACHMENTS|TEAM_EU26_SUBITEMS|TEAM_EU26_LINKED_ITEMS/u);

	assert.match(emptyRailSource, /export function EmptyMetadataRail/u);
	assert.match(emptyRailSource, /flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto @\[860px\]\/agentlayout:pt-6/u);
	assert.match(emptyRailSource, /overflow-hidden rounded-lg border border-border-disabled bg-surface has-\[:focus-visible\]:overflow-visible/u);
	assert.match(emptyRailSource, /headingId="team-eu26-details-heading"[\s\S]*label="Details"[\s\S]*variant="rail"/u);
	assert.match(emptyRailSource, /Add agents/u);
	assert.match(emptyRailSource, /<TeamEuDevelopmentPanel empty \/>/u);
	assert.match(emptyRailSource, /<TeamEuAutomationPanel[\s\S]*empty[\s\S]*rules=\{\[\]\}/u);
	assert.doesNotMatch(emptyRailSource, /TeamEuAppsPanel/u);
	assert.doesNotMatch(emptyRailSource, /Needs input\.\./u);

	assert.match(developmentSource, /Start with agent/u);
	assert.match(developmentSource, /Start local session/u);
	assert.match(automationSource, /<Button className="h-auto px-0" disabled type="button" variant="link">[\s\S]*Add manually triggered automation/u);
	assert.match(automationSource, /See templates/u);
	assert.match(automationSource, /Create an automation to perform tasks with the click of a button/u);
	assert.match(automationSource, /Recent run rules/u);
	assert.match(automationSource, /<SetToRecurRow \/>/u);
	assert.match(automationSource, /Create automation/u);

	assert.match(emptyDataSource, /Dev Rana/u);
	assert.match(emptyDataSource, /created this work item/u);
	assert.match(emptyDataSource, /6 hours ago/u);
	assert.match(workItemStateSource, /preset === "empty"/u);
	assert.match(workItemStateSource, /priority: "Medium"/u);
	assert.match(workItemStateSource, /status: "To do"/u);
	assert.match(workItemStateSource, /dueDate: undefined/u);
	assert.match(workItemStateSource, /TEAM_EU26_EMPTY_ACTIVITY_EVENTS/u);
	assert.match(workItemStateSource, /createAgentPlannerState\("filled"/u);

	assert.match(compositionSource, /statusControl=\{initialPreset === "filled" \|\| initialPreset === "empty"/u);
	assert.match(readBlockFile("team-eu26/components/panel-content-motion.ts"), /const CONTENT_ENTER =/u);
	assert.match(readBlockFile("team-eu26/components/panel-content-motion.ts"), /const CONTENT_EXIT =/u);
	assert.match(readBlockFile("team-eu26/components/team-eu-rail-panel.tsx"), /absolute inset-0 z-0/u);
});

test("Team EU26 header and empty Development share Open in and the board agent selector menu", () => {
	const dialogSource = readBlockFile("team-eu26/components/experimental-work-item-dialog.tsx");
	const developmentSource = readBlockFile("team-eu26/components/team-eu-development-panel.tsx");
	const openInSource = readBlockFile("team-eu26/components/open-in-menu.tsx");
	const agentSelectorSource = readBlockFile("team-eu26/components/work-item-agent-selector.tsx");

	assert.match(dialogSource, /<WorkItemAgentSelectorMenu[\s\S]*aria-label="Open agent"/u);
	assert.match(dialogSource, /<OpenInMenu[\s\S]*aria-label="Open in code"/u);
	assert.match(developmentSource, /<WorkItemAgentSelectorMenu[\s\S]*Start with agent/u);
	assert.match(developmentSource, /<OpenInMenu[\s\S]*Start local session/u);

	assert.match(openInSource, /Copy prompt for/u);
	assert.match(openInSource, /Claude Code/u);
	assert.match(openInSource, /Codex/u);
	assert.match(openInSource, /Cursor/u);
	assert.match(openInSource, /GitHub Copilot/u);
	assert.match(openInSource, /Rovo CLI/u);
	assert.match(openInSource, /VS Code/u);
	assert.match(openInSource, /Copy prompt/u);
	assert.match(
		openInSource,
		/<DropdownMenuGroup>[\s\S]*<DropdownMenuLabel>Copy prompt for<\/DropdownMenuLabel>[\s\S]*<\/DropdownMenuGroup>/u,
	);
	assert.match(openInSource, /<DropdownMenuItem[\s\S]*onSelect=/u);
	assert.doesNotMatch(openInSource, /<DropdownMenuItem[^>]*onClick=/u);

	assert.match(agentSelectorSource, /export function WorkItemAgentSelectorMenu/u);
	assert.match(
		agentSelectorSource,
		/const \[pinnedAgentIds, setPinnedAgentIds\] = useState<readonly string\[\]>\(DEFAULT_PINNED_SPACE_AGENT_IDS\);/u,
	);
	assert.match(agentSelectorSource, /onBrowseAgents=\{handleFooterAction\}/u);
	assert.match(agentSelectorSource, /onCreateAgent=\{handleFooterAction\}/u);
	assert.match(agentSelectorSource, /onPinnedAgentIdsChange=\{setPinnedAgentIds\}/u);
	assert.match(agentSelectorSource, /pinnedAgentIds=\{pinnedAgentIds\}/u);
	assert.doesNotMatch(agentSelectorSource, /heading="Select agent"/u);
	assert.doesNotMatch(agentSelectorSource, /searchVariant="boxed"/u);
	assert.doesNotMatch(agentSelectorSource, /pinningEnabled=\{false\}/u);
	assert.match(agentSelectorSource, /actions\.invokeAgent/u);
});
