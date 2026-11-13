const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Metadata-rail / Activity-chrome / Pull requests contracts for experimental-v2.
// Split from jira-work-item-experimental-v2.source.test.js to stay under the 1000-line budget.

const BLOCK_DIR = __dirname;

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}

test("experimental v2 removes the description row and relocates Activity chrome to the rail toggle", () => {
	const activityPanelSource = readBlockFile("experimental-v2/components/activity-panel.tsx");
	const contextDescriptionEditorSource = readBlockFile("experimental-v2/components/context-description-editor.tsx");
	const contextEditableHeaderSource = readBlockFile("experimental-v2/components/context-editable-header.tsx");
	const layoutSource = readBlockFile("experimental-v2/components/experimental-work-item-layout.tsx");
	assert.match(activityPanelSource, /useSetActivityRailChrome/u);
	assert.match(activityPanelSource, /hideHeader=\{hideHeader\}/u);
	// Activity root shrinks in the metadata flex column so long cards don't grow a cross-axis bar.
	assert.match(
		activityPanelSource,
		/<div ref=\{activityRootRef\} className="min-w-0 max-w-full" data-jira-work-item-activity>/u,
	);
	assert.match(activityPanelSource, /className="min-w-0 gap-2"/u);
	assert.match(
		activityPanelSource,
		/headerClassName=\{\s*hideHeader\s*\?\s*undefined\s*:\s*"sticky top-0 z-10 flex min-h-8 items-center bg-surface-overlay \[container-type:scroll-state\]"/u,
	);
	assert.match(activityPanelSource, /headerScrollFade=\{!hideHeader\}/u);
	assert.match(activityPanelSource, /setActivityRailChrome\(\{[\s\S]*count: entries\.length/u);
	assert.match(
		activityPanelSource,
		/mapActivityEventsToJiraEntries\(composedActivityEvents, activityReferenceTimeMs, meta\.activityEvents\)/u,
	);
	assert.match(activityPanelSource, /collectActivityActors\(meta\.activityEvents\)/u);
	assert.match(contextDescriptionEditorSource, /showToolbar=\{false\}/u);
	assert.doesNotMatch(
		contextDescriptionEditorSource,
		/stuckToolbarScrollFade|toolbarRestingSeparator|toolbarRestingSeparatorLabel|toolbarReveal/u,
	);
	assert.match(
		contextEditableHeaderSource,
		/<ContextDescriptionEditor[\s\S]*viewMode=\{viewMode\}/u,
	);
	// Left column no longer hosts Activity — only Context scrolls there.
	assert.doesNotMatch(layoutSource, /activity: ReactNode|useHasActivity|\{activity\}/u);
	// Fixed chrome owns the top seam; body masks stay bottom-only.
	assert.match(
		layoutSource,
		/function useColumnScrollMask\([\s\S]*buildScrollMaskStyle\(\{[\s\S]*fadeTop: false,[\s\S]*fadeBottom: showBottomScrollMask/u,
	);
	assert.doesNotMatch(layoutSource, /data-jira-work-item-header-scroll-mask|buildScrollMaskBlurLayerStyles\("top"\)/u);
	assert.doesNotMatch(layoutSource, /showMetadataTopScrollMask|data-jira-work-item-metadata-scroll-mask|metadataScrollRef/u);
	assert.match(
		layoutSource,
		/ref: leftScrollMaskRef,[\s\S]*showTopScrollMask: showLeftTopScrollMask,[\s\S]*style: leftScrollMaskStyle,[\s\S]*useColumnScrollMask\(\)[\s\S]*leftScrollContainerRef[\s\S]*leftScrollMaskRef\(element\)/u,
	);
	assert.match(
		readBlockFile("experimental-v2/components/metadata-rail.tsx"),
		/buildScrollMaskStyle\(\{[\s\S]*fadeTop: false,[\s\S]*fadeBottom: showBottomScrollMask/u,
	);
});

test("experimental v2 renders filled context resources as conditional metadata sections", () => {
	const metadataRailSource = readBlockFile("experimental-v2/components/metadata-rail.tsx");
	const automationTabSource = readBlockFile("experimental-v2/components/automation-tab.tsx");
	const detailsSectionsSource = readBlockFile("experimental-v2/components/details-sections.tsx");
	const setToRecurSource = readBlockFile("experimental-v2/components/set-to-recur-popover.tsx");

	assert.match(metadataRailSource, /const \{ attachments, linkedItems, subtasks \} = contextResources;/u);
	assert.match(metadataRailSource, /if \(attachments\.length > 0\) \{[\s\S]*id: "attachments",[\s\S]*title: "Attachments"/u);
	assert.match(metadataRailSource, /if \(subtasks\.length > 0\) \{[\s\S]*id: "subtasks",[\s\S]*title: <SubtasksSectionTitle done=\{doneSubtasks\} total=\{subtasks\.length\} \/>/u);
	assert.match(metadataRailSource, /if \(linkedItems\.length > 0\) \{[\s\S]*id: "linked-items",[\s\S]*title: "Linked work items"/u);
	assert.match(metadataRailSource, /attachments\.map\(toAttachmentSmartLink\)[\s\S]*count: attachments\.length/u);
	assert.match(metadataRailSource, /subtasks\.map\(toSubtaskSmartLink\)[\s\S]*count: `\$\{doneSubtasks\}\/\$\{subtasks\.length\}`/u);
	assert.match(metadataRailSource, /const doneSubtasks = subtasks\.filter\(\(subtask\) => subtask\.status === "done"\)\.length;/u);
	assert.match(metadataRailSource, /<ProgressCircle aria-hidden size="xs" value=\{total > 0 \? Math\.round\(\(done \/ total\) \* 100\) : 0\} variant="outline" \/>/u);
	assert.match(metadataRailSource, /linkedItems\.map\(toLinkedItemSmartLink\)[\s\S]*count: linkedItems\.length/u);
	assert.equal((metadataRailSource.match(/kind: "icon-tile", icon: <WorkItemIcon label="" size="medium" \/>, tone: "information"/gu) ?? []).length, 2);
	assert.match(metadataRailSource, /assignee: subtask\.assignee[\s\S]*name: subtask\.assignee, src: subtask\.assigneeAvatarUrl/u);
	assert.doesNotMatch(metadataRailSource, /fallbackAssignee|assignee: toSmartLinkAssignee|metadata: \[\{ label: linkedItem\.relationship \}\]/u);
	assert.match(metadataRailSource, /actions: SMART_LINK_MODAL_ACTIONS/u);
	assert.match(metadataRailSource, /status: toWorkItemStatus\(linkedItem\.status\)/u);
	assert.match(metadataRailSource, /description: subtask\.description \?\?/u);
	assert.match(metadataRailSource, /description: linkedItem\.description \?\?/u);
	assert.match(metadataRailSource, /assignee: linkedItem\.assignee[\s\S]*name: linkedItem\.assignee, src: linkedItem\.assigneeAvatarUrl/u);
	assert.match(metadataRailSource, /priority: linkedItem\.priority/u);
	assert.match(metadataRailSource, /function ResourceSmartLinks[\s\S]*<ul className="space-y-1">[\s\S]*<SmartLink[\s\S]*align="center"[\s\S]*alignOffset=\{0\}[\s\S]*className="min-w-0 max-w-full"[\s\S]*item=\{item\}[\s\S]*onRemove=\{\(\) => onRemove\(item\.id\)\}[\s\S]*positionerClassName="z-\[600\]"[\s\S]*removeButtonLabel=\{`Remove \$\{item\.title\}`\}[\s\S]*removeVariant="overlay"[\s\S]*side="left"/u);
	assert.match(metadataRailSource, /removeVariant="overlay"[\s\S]*showStatus[\s\S]*side="left"/u);
	assert.match(metadataRailSource, /removeContextResource\("attachment", id\)[\s\S]*removeContextResource\("subtask", id\)[\s\S]*removeContextResource\("link", id\)/u);
	assert.doesNotMatch(metadataRailSource, /DeleteIcon|@atlaskit\/icon\/core\/delete|<Tag/u);
	assert.match(metadataRailSource, /attachments\.map\(toAttachmentSmartLink\)[\s\S]*subtasks\.map\(toSubtaskSmartLink\)[\s\S]*linkedItems\.map\(toLinkedItemSmartLink\)/u);
	assert.doesNotMatch(metadataRailSource, /AgentFilledSummaryRow|AgentReferenceChip|agentFieldName=/u);
	assert.match(
		metadataRailSource,
		/id: "details",[\s\S]*\.\.\.resourceSections,[\s\S]*id: "automation"[\s\S]*id: "development"/u,
	);
	assert.doesNotMatch(metadataRailSource, /id: "apps"|title: "Apps"|<AppsSection/u);
	assert.match(metadataRailSource, /<ArtifactPane[\s\S]*borderless=\{borderless\}[\s\S]*showSeparators=\{false\}[\s\S]*sections=\{/u);
	// Borderless ArtifactPane must stay transparent so dark mode matches the modal fill.
	assert.match(
		readBlockFile("../artifact-pane/index.tsx"),
		/borderless \? "overflow-visible bg-transparent"/u,
	);
	assert.match(metadataRailSource, /collapsible: false,[\s\S]*content: <DetailsTab draft=\{draft\} onChange=\{actions\.updateMetadata\} people=\{people\} \/>/u);
	assert.match(metadataRailSource, /content: <AutomationTab rules=\{automationRules\} \/>,[\s\S]*count: automationRules\.length \|\| undefined,[\s\S]*headerAction: \{ label: "Manage automations" \},[\s\S]*id: "automation"/u);
	assert.match(
		metadataRailSource,
		/import \{ CONNECTED_REPOSITORY_COUNT \} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/lib\/development-repositories"/u,
	);
	assert.match(
		metadataRailSource,
		/<DevelopmentSectionContent \/>[\s\S]*count: CONNECTED_REPOSITORY_COUNT \|\| undefined,[\s\S]*headerAction: \{ label: "Manage dev tools" \},[\s\S]*id: "development",[\s\S]*title: "Repositories"/u,
	);
	// Attachments / Automation / Repositories all use numeric counts (`· N`).
	assert.match(metadataRailSource, /count: attachments\.length,/u);
	assert.match(metadataRailSource, /count: automationRules\.length \|\| undefined,/u);
	assert.doesNotMatch(
		metadataRailSource,
		/title: "Development"|formatConnectedRepositoryCountLabel|\b\d+ Repos?\b/u,
	);
	assert.doesNotMatch(metadataRailSource, /content: <DevelopmentSection \/>/u);
	assert.doesNotMatch(automationTabSource, /From Automation/u);
	assert.doesNotMatch(automationTabSource, /AutomationTile|core\/branch/u);
	assert.match(automationTabSource, /rules = \[\][\s\S]*const hasRules = rules\.length > 0/u);
	assert.match(automationTabSource, /hasRules \? \([\s\S]*<AutomationRuleRows rules=\{rules\} \/>[\s\S]*\) : \([\s\S]*Create an automation to perform tasks/u);
	assert.match(automationTabSource, /<IconTile[\s\S]*<AutomationIcon label="" size="small" color="currentColor" \/>[\s\S]*size="small"[\s\S]*variant=\{rule\.iconVariant\}/u);
	assert.match(automationTabSource, /function CreateAutomationRow[\s\S]*<AddIcon label="" size="small" \/>[\s\S]*size="small"[\s\S]*variant="gray"[\s\S]*Create automation/u);
	assert.match(automationTabSource, /<CreateAutomationRow \/>[\s\S]*<AutomationRuleRows rules=\{rules\} \/>/u);
	assert.match(automationTabSource, /className="min-w-0 flex-1 truncate text-sm text-text"/u);
	assert.match(automationTabSource, /<Button variant="outline">\s*Add manually triggered automation\s*<\/Button>/u);
	assert.doesNotMatch(automationTabSource, /<Button[^>]*(?:w-full|disabled)[^>]*>\s*Add manually triggered automation/u);
	assert.match(automationTabSource, /latestRule\?\.lastRunAt[\s\S]*`\$\{latestRule\.title\} · \$\{latestRule\.lastRunAt\}`[\s\S]*View automation history/u);
	assert.match(automationTabSource, /latestRule\?\.lastRunAt \? \([\s\S]*className="size-3 shrink-0 text-icon-success \[&_svg\]:size-3!"[\s\S]*<StatusSuccessIcon label="" size="small" \/>/u);
	assert.match(automationTabSource, /Recent rule runs[\s\S]*\{recentRunByline\}[\s\S]*ChevronRightIcon/u);
	assert.match(automationTabSource, /<SetToRecurRow \/>/u);
	assert.doesNotMatch(automationTabSource, /Manage automations/u);
	assert.doesNotMatch(automationTabSource, /border-t border-border/u);
	assert.match(setToRecurSource, /Set to recur[\s\S]*config\.frequency[\s\S]*config\.day[\s\S]*config\.timing[\s\S]*No schedule set[\s\S]*ChevronRightIcon/u);
	assert.doesNotMatch(setToRecurSource, /RefreshIcon|core\/refresh/u);
	assert.match(detailsSectionsSource, /truncate text-sm font-medium text-text[\s\S]*truncate text-xs text-text-subtlest/u);
	assert.doesNotMatch(detailsSectionsSource, /<CollapsibleSection title="Apps">/u);
});

test("experimental v2 keeps its persistent metadata rail open", () => {
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");

	assert.doesNotMatch(compositionSource, /defaultMetadataCollapsed/u);
	assert.match(compositionSource, /<PanelLayoutProvider>/u);
});

test("experimental v2 shows a read-only title-meta PR Tag and opens PRs from ContextResources", () => {
	const titleMetaSource = readBlockFile("experimental-v2/components/context-title-meta.tsx");
	const contextResourcesSource = readBlockFile("experimental-v2/components/context-resources.tsx");
	const pullRequestsSelectSource = readBlockFile("experimental-v2/components/pull-requests-select.tsx");
	const pullRequestsPanelSource = readBlockFile("experimental-v2/components/pull-requests-panel.tsx");
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");

	// Title meta hosts a read-only multi-metric PR Tag (not a Select trigger).
	assert.match(
		titleMetaSource,
		/summarizePullRequestTagMetrics\(pullRequestEntries\)[\s\S]*data-jira-work-item-title-meta[\s\S]*data-jira-work-item-title-pull-requests[\s\S]*trailingMetric=\{trailingMetric\}/u,
	);
	assert.match(
		titleMetaSource,
		/aria-label=\{pullRequestsAriaLabel\}[\s\S]*data-jira-work-item-title-pull-requests[\s\S]*role="group"/u,
	);
	assert.match(
		titleMetaSource,
		/<StatusPill[\s\S]*metadata\.reporter/u,
	);
	assert.doesNotMatch(
		titleMetaSource,
		/PullRequestsSelect|PullRequestsPopover|PopoverTrigger|onClick=\{|useMetadataRail|pullRequestCount|openPullRequestsPanel|setPanelView/u,
	);

	// Composition wires PR entries into the dialog title Tag and ContextHeader Select.
	assert.match(
		compositionSource,
		/<MetadataRailProvider[\s\S]*revealActivityEntryId=\{props\.revealActivityEntryId\}[\s\S]*revealActivityKey=\{props\.revealActivityKey\}/u,
	);
	assert.doesNotMatch(compositionSource, /MetadataRailProvider pullRequestCount=/u);
	assert.match(
		compositionSource,
		/<ExperimentalWorkItemDialog[\s\S]*?pullRequestEntries=\{pullRequestEntries\}[\s\S]*?>/u,
	);
	assert.doesNotMatch(
		compositionSource,
		/<ExperimentalWorkItemDialog(?:(?!>)[\s\S])*selectedPullRequestIdentity=|<ExperimentalWorkItemDialog(?:(?!>)[\s\S])*onPullRequestSelect=/u,
	);
	assert.match(
		compositionSource,
		/<ContextHeader[\s\S]*pullRequestEntries=\{pullRequestEntries\}[\s\S]*selectedPullRequestIdentity=\{selectedPullRequestIdentity\}[\s\S]*onPullRequestClear=\{handlePullRequestClear\}[\s\S]*onPullRequestSelect=\{handlePullRequestSelect\}/u,
	);
	assert.match(
		contextResourcesSource,
		/<PullRequestsSelect[\s\S]*entries=\{pullRequestEntries\}[\s\S]*selectedIdentity=\{selectedPullRequestIdentity\}[\s\S]*onClearSelection=\{onPullRequestClear\}[\s\S]*onSelectEntry=\{onPullRequestSelect\}/u,
	);

	// Resources Select: placeholder "Review pull request", selected "Review" +
	// SelectTag. Under the resource-row container (< 36rem) the label hides;
	// icon/tag/chevron stay.
	assert.match(
		pullRequestsSelectSource,
		/const TRIGGER_LABEL = "Review pull request"[\s\S]*const SELECTED_TRIGGER_LABEL = "Review"/u,
	);
	assert.match(
		pullRequestsSelectSource,
		/const visibleTriggerLabel = selectedTagLabel[\s\S]*\? SELECTED_TRIGGER_LABEL[\s\S]*: TRIGGER_LABEL/u,
	);
	assert.match(
		pullRequestsSelectSource,
		/<SelectTrigger[\s\S]*aria-label=\{TRIGGER_LABEL\}[\s\S]*className="gap-2 font-medium data-placeholder:text-text-subtle data-placeholder:\[&_svg\]:text-icon-subtle @max-\[36rem\]\/resource-row:gap-1\.5"[\s\S]*data-jira-work-item-resource-pull-requests[\s\S]*tags[\s\S]*<SelectValue[\s\S]*<SelectTags[\s\S]*className="truncate @max-\[36rem\]\/resource-row:hidden"[\s\S]*\{visibleTriggerLabel\}[\s\S]*selectedTagLabel && selectedStatusPresentation && SelectedStatusIcon \? \([\s\S]*<SelectTag[\s\S]*aria-label=\{`\$\{selectedStatusPresentation\.label\} pull request \$\{selectedTagLabel\}`\}[\s\S]*color=\{selectedStatusPresentation\.tagColor\}[\s\S]*data-jira-work-item-resource-pull-request-filter[\s\S]*elemBefore=\{[\s\S]*SelectedStatusIcon[\s\S]*onRemove=\{onClearSelection\}[\s\S]*<\/SelectTrigger>/u,
	);
	assert.match(
		pullRequestsSelectSource,
		/getPullRequestStatusPresentation\(selectedPullRequest\.status\)/u,
	);
	assert.match(
		pullRequestsSelectSource,
		/MergeFailureIcon[\s\S]*MergeSuccessIcon[\s\S]*PullRequestIcon|"pull-request": PullRequestIcon[\s\S]*"merge-success": MergeSuccessIcon[\s\S]*"merge-failure": MergeFailureIcon/u,
	);
	assert.match(
		pullRequestsSelectSource,
		/data-jira-work-item-resource-pull-requests-menu[\s\S]*positionerClassName="z-\[502\]"/u,
	);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/<\/Select>\s*\{selectedTagLabel \?/u,
	);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/stopSelectToggle|nativeButton=\{false\}|from "@\/components\/ui\/tag"/u,
	);
	assert.match(
		pullRequestsSelectSource,
		/<SelectItem[\s\S]*showIndicator=\{false\}[\s\S]*textClassName="w-full min-w-0 whitespace-normal"[\s\S]*<PullRequest[\s\S]*group-data-\[highlighted\]\/pr-option:bg-surface-hovered/u,
	);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/<PullRequest[\s\S]*selected=\{/u,
	);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/<SelectItem[\s\S]*pr-8|select-item-indicator\]:top-3/u,
	);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/1 Pull request|\$\{count\}|PopoverTrigger|#\$\{pullRequest\.number\} \$\{pullRequest\.title\}|data-jira-work-item-title-pull-requests|summarizePullRequestTagMetrics|PullRequestSortControl|Show latest activity|shape="rounded"|variant="rounded"/u,
	);
	assert.match(
		pullRequestsPanelSource,
		/sortPullRequestEntries\(entries, sortMode, currentUserName\)[\s\S]*data-jira-work-item-pull-requests/u,
	);
	assert.doesNotMatch(
		pullRequestsPanelSource,
		/ArtifactPane|groupPullRequestsByPhase|PhaseSectionTitle|data-jira-work-item-pull-request-phase/u,
	);
});

test("experimental v2 metadata rail toggles Details and Activity with Details default", () => {
	const metadataRailSource = readBlockFile("experimental-v2/components/metadata-rail.tsx");
	const metadataRailToggleSource = readBlockFile("experimental-v2/components/metadata-rail-toggle.tsx");
	const metadataRailContextSource = readBlockFile("experimental-v2/context-metadata-rail.tsx");
	const contextResourcesSource = readBlockFile("experimental-v2/components/context-resources.tsx");
	const layoutSource = readBlockFile("experimental-v2/components/experimental-work-item-layout.tsx");
	const pullRequestsPanelSource = readBlockFile("experimental-v2/components/pull-requests-panel.tsx");
	const pullRequestsSelectSource = readBlockFile("experimental-v2/components/pull-requests-select.tsx");
	const pullRequestSortControlSource = readBlockFile(
		"experimental-v2/components/pull-request-sort-control.tsx",
	);
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");

	// Shared view state lives in MetadataRailProvider (not local MetadataRail state).
	assert.match(
		metadataRailContextSource,
		/useState<MetadataRailView>\("details"\)/u,
	);
	assert.match(
		metadataRailContextSource,
		/requestExpandPullRequestSection[\s\S]*pullRequestSectionExpandRequest/u,
	);
	assert.match(
		metadataRailContextSource,
		/requestRevealLatestActivity[\s\S]*activityRevealRequest/u,
	);
	assert.match(
		metadataRailContextSource,
		/const requestRevealLatestActivity = useCallback\(\(entryId\?: string\) => \{[\s\S]*setPanelView\("activity"\)[\s\S]*setActivityRevealRequest/u,
	);
	assert.match(
		metadataRailContextSource,
		/entryId\?: string/u,
	);
	assert.match(
		metadataRailContextSource,
		/revealActivityEntryId(?:\s*=\s*null)?/u,
	);
	// revealActivityKey must not steal Details while a PR is open — consume the
	// key but skip requestRevealLatestActivity when suppress is set.
	assert.match(
		metadataRailContextSource,
		/setSuppressActivityPanelReveal/u,
	);
	assert.match(
		metadataRailContextSource,
		/suppressActivityPanelRevealRef/u,
	);
	// Render-time key sync (no ref.current writes); suppress via state + ref setter.
	assert.match(
		metadataRailContextSource,
		/trackedRevealActivityKey[\s\S]*setTrackedRevealActivityKey\(revealActivityKey\)[\s\S]*!suppressActivityPanelReveal[\s\S]*setPanelView\("activity"\)[\s\S]*revealActivityEntryId/u,
	);
	assert.match(
		metadataRailContextSource,
		/consumeActivityRevealRequest/u,
	);
	assert.match(
		readBlockFile("experimental-v2/lib/metadata-rail-view.ts"),
		/export type MetadataRailView = "details" \| "activity"/u,
	);
	assert.match(
		metadataRailContextSource,
		/import type \{ MetadataRailView \} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/lib\/metadata-rail-view"/u,
	);
	assert.match(
		compositionSource,
		/<MetadataRailProvider[\s\S]*revealActivityEntryId=\{props\.revealActivityEntryId\}[\s\S]*revealActivityKey=\{props\.revealActivityKey\}/u,
	);
	assert.doesNotMatch(compositionSource, /MetadataRailProvider pullRequestCount=/u);
	assert.match(
		metadataRailContextSource,
		/revealActivityKey(?:\s*=\s*null)?/u,
	);
	assert.match(
		metadataRailContextSource,
		/revealActivityEntryId(?:\s*=\s*null)?/u,
	);
	assert.match(
		metadataRailSource,
		/import \{ useMetadataRail \} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/context-metadata-rail"/u,
	);
	assert.doesNotMatch(
		metadataRailSource,
		/PullRequestsPanel|JIRA_WORK_ITEM_CURRENT_USER|pullRequestEntries|selectedPullRequestIdentity|onPullRequestSelect/u,
	);
	// Toggle lives at the top of the metadata rail (not the left-column resources row).
	assert.match(
		metadataRailSource,
		/import \{ MetadataRailToggle \} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/components\/metadata-rail-toggle"/u,
	);
	assert.match(
		metadataRailSource,
		/data-jira-work-item-column-shell[\s\S]*data-jira-work-item-column-chrome[\s\S]*<MetadataRailToggle context=\{pullRequestSelected \? "pull-request" : "work-item"\} \/>[\s\S]*data-jira-work-item-scroll-region[\s\S]*data-jira-work-item-column-body[\s\S]*data-jira-work-item-metadata-rail-body/u,
	);
	// Same fixed-chrome + body-only scroll contract as the left column.
	assert.match(
		metadataRailSource,
		/buildScrollMaskStyle\(\{[\s\S]*fadeTop: false,[\s\S]*fadeBottom: showBottomScrollMask/u,
	);
	assert.match(
		metadataRailSource,
		/relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-none/u,
	);
	// Activity chrome lives in MetadataRailToggle; its soft mask follows body
	// scroll state while the body scrollport keeps its bottom-only mask.
	assert.match(
		metadataRailSource,
		/import \{ StickyRowScrollFade \} from "@\/components\/visual\/scroll-mask"[\s\S]*data-jira-work-item-column-chrome[\s\S]*<MetadataRailToggle[\s\S]*<StickyRowScrollFade[\s\S]*group-data-\[scroll-fade-visible\]:opacity-100[\s\S]*data-slot="jira-work-item-metadata-rail-scroll-fade"/u,
	);
	assert.doesNotMatch(
		metadataRailSource,
		/<JiraActivityViewControl|<PullRequestSortControl/u,
	);
	assert.doesNotMatch(metadataRailSource, /from "@\/components\/ui\/toggle-group"|<ToggleGroup[\s>]/u);
	assert.doesNotMatch(contextResourcesSource, /MetadataRailToggle/u);
	assert.match(
		layoutSource,
		/@container\/agentlayout group\/metadata-rail/u,
	);
	assert.match(
		metadataRailToggleSource,
		/import \{ ButtonGroup \} from "@\/components\/ui\/button-group"/u,
	);
	assert.match(
		metadataRailToggleSource,
		/import \{ Button \} from "@\/components\/ui\/button"/u,
	);
	// Segmented control: equal-width shells; label selects panel; Activity inset ghost chevron opens sort.
	// Pull requests are not a rail segment — interactive list is in ContextResources.
	assert.match(
		metadataRailToggleSource,
		/data-jira-work-item-metadata-rail-toggle[\s\S]*data-jira-work-item-metadata-rail-toggle-content[\s\S]*<ButtonGroup[\s\S]*aria-label=\{context === "pull-request" \? "Pull request panel" : "Work item panel"\}[\s\S]*className="w-full"[\s\S]*MetadataRailPanelSegment[\s\S]*label="Details"[\s\S]*label="Activity"[\s\S]*activityChrome != null \? \([\s\S]*<JiraActivityViewControl[\s\S]*filterMode=\{\s*activityChrome\.filterMode === "work-item"\s*\? "jira"\s*: activityChrome\.filterMode === "pull-request"\s*\? "pull-request"\s*: "sort-only"\s*\}[\s\S]*trigger="chevron"/u,
	);
	assert.doesNotMatch(
		metadataRailToggleSource,
		/label="Pull requests"|PullRequestSortControl|pullRequestCount|selectPanel\("pull-requests"\)/u,
	);
	assert.match(
		metadataRailToggleSource,
		/onOpenChange=\{\(open\) => \{[\s\S]*if \(open\) \{[\s\S]*selectPanel\("activity"\)/u,
	);
	// No trailing standalone "Show by me" / Activity text-link control.
	assert.doesNotMatch(
		metadataRailToggleSource,
		/justify-between|activePanelView === "activity" && activityChrome/u,
	);
	assert.doesNotMatch(metadataRailToggleSource, /from "@\/components\/ui\/toggle-group"|<ToggleGroup[\s>]/u);
	// Toggle is fixed chrome; the sibling scrollport owns only body overflow.
	assert.doesNotMatch(metadataRailToggleSource, /StickyRowScrollFade|sticky top-0|container-type:scroll-state/u);
	assert.match(metadataRailToggleSource, /shrink-0 @\[860px\]\/agentlayout:pb-7/u);
	assert.doesNotMatch(metadataRailToggleSource, /data-jira-work-item-column-chrome-fill/u);
	assert.match(
		metadataRailSource,
		/data-jira-work-item-column-chrome[\s\S]*relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-none[\s\S]*data-jira-work-item-scroll-region/u,
	);
	assert.match(
		metadataRailSource,
		/relative z-0 flex min-w-0 flex-col gap-2"[\s\S]*data-jira-work-item-column-body[\s\S]*data-jira-work-item-metadata-rail-body/u,
	);
	assert.match(
		metadataRailToggleSource,
		/flex w-full items-center px-3[\s\S]*data-jira-work-item-metadata-rail-toggle-content/u,
	);
	assert.doesNotMatch(
		metadataRailToggleSource,
		/px-3 pt-1 pb-3|pt-1 pb-3/u,
	);
	// Chrome→body gap is chrome pb only — outer flex must not stack gap-2 on the toggle.
	assert.match(
		metadataRailSource,
		/data-jira-work-item-column-chrome[\s\S]*<MetadataRailToggle context=\{pullRequestSelected \? "pull-request" : "work-item"\} \/>/u,
	);
	assert.doesNotMatch(
		metadataRailSource,
		/<div className="flex min-w-0 flex-col gap-2">\s*<MetadataRailToggle/u,
	);
	assert.match(
		metadataRailSource,
		/className="\[&>div:first-child\]:pt-0"/u,
	);
	// Hover/focus-visible reveal: rail body hover + self hover/focus-visible
	// (no body focus-within — click-focus in rail fields must not stick opacity).
	assert.match(
		metadataRailToggleSource,
		/@\[860px\]\/agentlayout:opacity-0[\s\S]*@\[860px\]\/agentlayout:hover:opacity-100 @\[860px\]\/agentlayout:has-\[:focus-visible\]:opacity-100 @\[860px\]\/agentlayout:has-\[\[aria-expanded=true\]\]:opacity-100[\s\S]*@\[860px\]\/agentlayout:group-has-\[\[data-jira-work-item-metadata-rail-body\]:hover\]\/metadata-rail:opacity-100[\s\S]*motion-reduce:transition-none/u,
	);
	assert.doesNotMatch(
		metadataRailToggleSource,
		/group-has-\[\[data-jira-work-item-metadata-rail-body\]:focus-within\]/u,
	);
	assert.doesNotMatch(metadataRailToggleSource, /focus-within:opacity-100/u);
	// Toggle is rail-scoped — no full-bleed header width / negative-margin alignment tricks.
	assert.doesNotMatch(
		metadataRailToggleSource,
		/@\[860px\]\/agentlayout:w-\[var\(--metadata-panel-offset\)\]|@\[860px\]\/agentlayout:-mr-6/u,
	);
	assert.match(metadataRailSource, /ActivityRailChromeProvider/u);
	assert.match(
		metadataRailToggleSource,
		/import \{\s*JiraActivityViewControl,\s*\} from "@\/components\/blocks\/jira-activity"/u,
	);
	assert.doesNotMatch(
		metadataRailToggleSource,
		/PullRequestSortControl|pullRequestSortMode/u,
	);
	assert.match(
		metadataRailToggleSource,
		/<JiraActivityViewControl[\s\S]*trigger="chevron"/u,
	);
	// Chevron icon tint comes from the selected shell (not button chrome /
	// aria-pressed — that would mislabel the menu control). Full selected
	// fill/border still applies when the menu is open via aria-expanded.
	assert.doesNotMatch(
		metadataRailToggleSource,
		/<JiraActivityViewControl[\s\S]*pressed=\{activePanelView === "activity"\}/u,
	);
	assert.match(
		metadataRailToggleSource,
		/PANEL_SEGMENT_SELECTED_CHEVRON_CLASS[\s\S]*data-\[selected\]:\[\S*metadata-rail-sort-trigger\S*\]:text-icon-selected/u,
	);
	assert.doesNotMatch(
		metadataRailToggleSource,
		/PANEL_SEGMENT_SELECTED_CHEVRON_CLASS[\s\S]*data-\[selected\]:\[\S*metadata-rail-sort-trigger\S*\]:\[&_svg\]:text-icon-selected/u,
	);
	assert.doesNotMatch(
		metadataRailToggleSource,
		/PANEL_SEGMENT_SELECTED_CHEVRON_CLASS[\s\S]*data-\[selected\]:\[\S*metadata-rail-sort-trigger\S*\]:bg-bg-selected/u,
	);
	// Pull-request sort chrome is gone from the resource dropdown; Activity keeps its view filters.
	assert.doesNotMatch(
		metadataRailContextSource,
		/PullRequestSortMode|DEFAULT_PULL_REQUEST_SORT_MODE|pullRequestCount|pullRequestSortMode/u,
	);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/PullRequestSortControl|useState<PullRequestSortMode>|Show latest activity/u,
	);
	assert.match(
		pullRequestsSelectSource,
		/sortPullRequestEntries\(entries, DEFAULT_PULL_REQUEST_SORT_MODE/u,
	);
	assert.match(pullRequestSortControlSource, /"by-me": "Show by me"/u);
	assert.match(pullRequestSortControlSource, /"latest-activity": "Show latest activity"/u);
	assert.match(pullRequestSortControlSource, /"newest-created": "Show newest created"/u);
	assert.match(pullRequestSortControlSource, /"oldest-created": "Show oldest created"/u);
	assert.match(pullRequestSortControlSource, /"largest-change": "Show largest change"/u);
	assert.match(pullRequestSortControlSource, /"by-me": "By me"/u);
	assert.match(pullRequestSortControlSource, /"latest-activity": "Latest activity"/u);
	assert.match(pullRequestSortControlSource, /"newest-created": "Newest created"/u);
	assert.match(pullRequestSortControlSource, /"oldest-created": "Oldest created"/u);
	assert.match(pullRequestSortControlSource, /"largest-change": "Largest change"/u);
	assert.match(
		pullRequestSortControlSource,
		/SORT_MENU_ORDER: readonly PullRequestSortMode\[\] = \[\s*"by-me",\s*"latest-activity",\s*"newest-created",\s*"oldest-created",\s*"largest-change",\s*\]/u,
	);
	assert.match(pullRequestSortControlSource, /trigger = "label"/u);
	assert.match(pullRequestSortControlSource, /trigger\?: "label" \| "chevron"/u);
	assert.match(
		pullRequestSortControlSource,
		/data-jira-work-item-pull-request-sort-trigger/u,
	);
	assert.match(pullRequestSortControlSource, /event\.stopPropagation\(\)/u);
	// Shell owns segment selected chrome; chevron must not set aria-pressed.
	assert.doesNotMatch(
		pullRequestSortControlSource,
		/isChevron \? \([\s\S]*aria-pressed=\{pressed \|\| undefined\}/u,
	);
	// Joined bordered ButtonGroup shells (equal flex) — not muted-track raised pills / Tabs.
	assert.doesNotMatch(metadataRailToggleSource, /PANEL_VIEW_TOGGLE_CLASS|PANEL_VIEW_TOGGLE_ITEM_CLASS|bg-muted p-0\.5/u);
	assert.doesNotMatch(
		metadataRailToggleSource,
		/from "@\/components\/ui\/tabs"|<Tabs[\s>]|TabsList|TabsTrigger|TabsContent/u,
	);
	assert.match(metadataRailToggleSource, /PANEL_SEGMENT_SHELL_CLASS[\s\S]*flex min-w-0 flex-1 items-center rounded-md[\s\S]*border border-border/u);
	// Shell pressed fill is Details-only — Activity keeps a sort chevron, and
	// CSS `:active` matches ancestors while a descendant is pressed.
	const panelSegmentShellClassMatch = metadataRailToggleSource.match(
		/const PANEL_SEGMENT_SHELL_CLASS =\s*(?:\/\/[^\n]*\n\s*)*"([^"]+)"/u,
	);
	assert.ok(panelSegmentShellClassMatch);
	// Selected label color: shell sets blue; ghost label inherits via
	// aria-pressed:text-inherit (Button’s aria-pressed:text-text-selected is
	// suppressed so fill/border stay on the shell). Chevron keeps its own
	// text-icon-selected tint.
	assert.match(panelSegmentShellClassMatch[1], /data-\[selected\]:text-text-selected/u);
	assert.doesNotMatch(panelSegmentShellClassMatch[1], /data-\[selected\]:text-text(?:\s|$)/u);
	assert.match(
		metadataRailToggleSource,
		/PANEL_SEGMENT_LABEL_CLASS[\s\S]*aria-pressed:text-inherit/u,
	);
	assert.doesNotMatch(panelSegmentShellClassMatch[1], /active:bg-bg-neutral-pressed|data-\[selected\]:active:bg-bg-selected-pressed/u);
	assert.match(
		metadataRailToggleSource,
		/PANEL_SEGMENT_SHELL_ACTIVE_CLASS =\s*"active:bg-bg-neutral-pressed data-\[selected\]:active:bg-bg-selected-pressed"/u,
	);
	assert.match(metadataRailToggleSource, /data-selected=\{pressed \? "" : undefined\}/u);
	assert.doesNotMatch(metadataRailToggleSource, /<div\s+aria-pressed=\{pressed \|\| undefined\}/u);
	// Trailing Activity shell uses `data-selected` (not aria-pressed) so
	// ButtonGroup’s selected seam overlay must include `[data-selected]`.
	assert.match(
		fs.readFileSync(
			path.join(process.cwd(), "components", "ui", "button-group.tsx"),
			"utf8",
		),
		/\[aria-expanded=true\],\[aria-pressed=true\],\[data-selected\]/u,
	);
	// Focus recolors the shell border only (no ring halo); trailing segments
	// restore border-l. Label/chevron suppress Button’s ring-3 halo.
	assert.match(
		metadataRailToggleSource,
		/PANEL_SEGMENT_SHELL_CLASS[\s\S]*has-\[\[data-jira-work-item-metadata-rail-panel-label\]:focus-visible\]:border-ring/u,
	);
	assert.match(
		metadataRailToggleSource,
		/PANEL_SEGMENT_SHELL_CLASS[\s\S]*has-\[\[data-jira-work-item-metadata-rail-sort-trigger\]:focus-visible\]:border-ring/u,
	);
	assert.doesNotMatch(
		metadataRailToggleSource,
		/PANEL_SEGMENT_SHELL_CLASS[\s\S]*has-\[\[data-jira-work-item-metadata-rail-panel-label\]:focus-visible\]:ring-3/u,
	);
	assert.match(
		metadataRailToggleSource,
		/PANEL_SEGMENT_FOCUS_LEFT_BORDER_CLASS[\s\S]*border-l!/u,
	);
	assert.match(
		metadataRailToggleSource,
		/PANEL_SEGMENT_LABEL_CLASS[\s\S]*focus-visible:border-transparent focus-visible:ring-0!/u,
	);
	assert.match(
		metadataRailToggleSource,
		/data-jira-work-item-metadata-rail-panel-label=""/u,
	);
	assert.match(metadataRailToggleSource, /PANEL_SEGMENT_LABEL_CLASS[\s\S]*variant="ghost"/u);
	// Details: fill shell + center label + shell press feedback.
	// Activity: centered packed unit, 6px gap; no shell active (chevron flash).
	assert.match(
		metadataRailToggleSource,
		/hasSortControl\s*\?\s*cn\(\s*"cursor-pointer justify-center",\s*PANEL_SEGMENT_FOCUS_LEFT_BORDER_CLASS,\s*PANEL_SEGMENT_SELECTED_CHEVRON_CLASS,\s*\)\s*:\s*PANEL_SEGMENT_SHELL_ACTIVE_CLASS/u,
	);
	// Activity: shell is the hit target; label stops propagation; chevron already does.
	assert.match(
		metadataRailToggleSource,
		/onClick=\{hasSortControl \? onSelect : undefined\}/u,
	);
	assert.match(
		metadataRailToggleSource,
		/event\.stopPropagation\(\);\s*onSelect\(\);/u,
	);
	assert.match(
		metadataRailToggleSource,
		/hasSortControl \? \([\s\S]*flex min-w-0 items-center gap-1\.5[\s\S]*PANEL_SEGMENT_LABEL_CLASS, "pe-0"[\s\S]*\{sortControl\}[\s\S]*\) : \([\s\S]*PANEL_SEGMENT_LABEL_CLASS, "flex-1"/u,
	);
	// Default h-8 (32px) label height matches left ContextResources chrome; chevron stays inset compact.
	assert.match(
		metadataRailToggleSource,
		/className=\{cn\(PANEL_SEGMENT_LABEL_CLASS,[\s\S]*size="default"[\s\S]*variant="ghost"/u,
	);
	assert.match(
		metadataRailToggleSource,
		/<ButtonGroup[^>]*className="w-full"/u,
	);
	// Shell inset on top/right/bottom (`my-1 me-1`); label→icon gap is segment `gap-1.5`.
	assert.match(
		pullRequestSortControlSource,
		/CHEVRON_TRIGGER_CLASS =\s*"my-1 me-1 shrink-0 border-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0! focus-visible:ring-offset-0!"/u,
	);
	assert.doesNotMatch(
		pullRequestSortControlSource,
		/CHEVRON_TRIGGER_CLASS[\s\S]*aria-expanded:border-transparent/u,
	);
	assert.match(
		pullRequestSortControlSource,
		/isChevron \? \([\s\S]*className=\{CHEVRON_TRIGGER_CLASS\}[\s\S]*size="icon-compact"[\s\S]*variant="ghost"/u,
	);
	// Panels stay mounted (hidden/inert) so Activity local state survives toggles.
	assert.match(
		metadataRailSource,
		/hidden=\{pullRequestSelected \|\| activePanelView !== "details"\}[\s\S]*inert=\{pullRequestSelected \|\| activePanelView !== "details" \? true : undefined\}[\s\S]*<ArtifactPane/u,
	);
	assert.match(
		metadataRailSource,
		/activity != null \? \(\s*<div[\s\S]*?className="min-w-0 max-w-full overflow-visible px-3"[\s\S]*?hidden=\{pullRequestSelected \|\| activePanelView !== "activity"\}[\s\S]*inert=\{pullRequestSelected \|\| activePanelView !== "activity" \? true : undefined\}[\s\S]*\{activity\}/u,
	);
	assert.doesNotMatch(
		metadataRailSource,
		/hidden=\{activePanelView !== "pull-requests"\}|PullRequestsPanel/u,
	);
	// Flat Pull Request block list — no phase accordion / ArtifactPane disclosure chrome.
	assert.match(
		pullRequestsPanelSource,
		/sortPullRequestEntries\(entries, sortMode, currentUserName\)[\s\S]*data-jira-work-item-pull-requests/u,
	);
	assert.match(
		pullRequestsPanelSource,
		/<ul[\s\S]*aria-label="Pull requests"[\s\S]*data-jira-work-item-pull-requests/u,
	);
	assert.match(
		pullRequestsPanelSource,
		/data-jira-work-item-pull-request-empty[\s\S]*No pull requests/u,
	);
	assert.match(
		pullRequestsPanelSource,
		/data-jira-work-item-pull-request-card=\{number\}/u,
	);
	assert.doesNotMatch(
		pullRequestsPanelSource,
		/ArtifactPane|groupPullRequestsByPhase|PhaseSectionTitle|PHASE_ICON|data-jira-work-item-pull-request-phase|\bborderless\b/u,
	);
	// PR rows use the dedicated Pull Request block (not Smart Link cards / modal chrome).
	assert.match(
		pullRequestsPanelSource,
		/import \{\s*PullRequest,\s*type PullRequestAuthor,\s*type PullRequestProps,\s*\} from "@\/components\/blocks\/pull-request"/u,
	);
	assert.match(
		pullRequestsPanelSource,
		/toPanelPullRequestProps\([\s\S]*const author = resolvePullRequestAuthor\(entry\)[\s\S]*\.\.\.\(author \? \{ author \} : \{\}\)/u,
	);
	assert.match(
		pullRequestsPanelSource,
		/\.\.\.\(pullRequest\.targetBranch \? \{ targetBranch: pullRequest\.targetBranch \} : \{\}\)/u,
	);
	assert.match(
		pullRequestsPanelSource,
		/<PullRequest[\s\S]*className="min-w-0 max-w-full"[\s\S]*selected=\{selected\}[\s\S]*onActivate=\{\(\) => onSelectEntry\(entry\)\}/u,
	);
	assert.match(pullRequestsPanelSource, /flex min-w-0 flex-col gap-2/u);
	assert.doesNotMatch(
		pullRequestsPanelSource,
		/SmartLink|toPullRequestSmartLink|appearance="card"|Open preview modal|SMART_LINK_MODAL_ACTIONS/u,
	);
	assert.doesNotMatch(
		pullRequestsPanelSource,
		/PullRequestActorAvatar|PullRequestRepoPill|GithubLogo|AgentAvatarVisual/u,
	);
	// No Accordion/Badge list chrome; no clock glyph for Needs your review.
	assert.doesNotMatch(pullRequestsPanelSource, /Badge|Accordion|ClockIcon|Merged last 30 days|Closed last 30 days/u);
	assert.doesNotMatch(
		metadataRailSource,
		/panelView === "details" \?/u,
	);
	assert.match(
		compositionSource,
		/<MetadataRail[\s\S]*activity=\{\([\s\S]*<ActivityPanel[\s\S]*activitySessionThread=\{activitySessionThread\}[\s\S]*onOpenPullRequest=\{handlePullRequestSelect\}[\s\S]*railChromeEnabled=\{selectedPullRequestEntry === null\}[\s\S]*currentReviewerStatus=\{selectedPullRequestReviewerStatus\}[\s\S]*selectedPullRequestEntry=\{selectedPullRequestEntry\}/u,
	);
	// Activity lives only in the metadata rail Details/Activity toggle — not under description.
	assert.equal(
		(compositionSource.match(/<ActivityPanel[\s\S]*?activitySessionThread=\{activitySessionThread\}[\s\S]*?\/>/gu) ?? []).length,
		1,
	);
	// Layout slots are header/context/composer/metadata — no left-column activity prop.
	assert.match(
		compositionSource,
		/<ExperimentalWorkItemLayout\n\s*metadataPanelResizing=\{metadataPanelResize\.isResizing\}\n\s*metadataPanelWidth=\{metadataPanelResize\.sidebarWidth\}\n\s*header=\{[\s\S]*?\n\s*context=\{[\s\S]*?\n\s*composer=\{[\s\S]*?\n\s*fillContainer=\{[\s\S]*?\n\s*metadata=\{/u,
	);
});

test("experimental v2 keeps pull-request selection transient at the composition layer", () => {
	const adapterSource = readBlockFile("experimental-v2/lib/jira-activity-adapter.ts");
	const activityPanelSource = readBlockFile("experimental-v2/components/activity-panel.tsx");
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");
	const contextPanelSource = readBlockFile("experimental-v2/components/context-panel.tsx");
	const contextResourcesSource = readBlockFile("experimental-v2/components/context-resources.tsx");
	const metadataRailSource = readBlockFile("experimental-v2/components/metadata-rail.tsx");
	const pullRequestsPanelSource = readBlockFile("experimental-v2/components/pull-requests-panel.tsx");
	const pullRequestsSelectSource = readBlockFile("experimental-v2/components/pull-requests-select.tsx");
	const persistedStateSource = readBlockFile("data/session-state.ts");

	// Dedupe and selection use one repository-aware identity contract.
	assert.match(adapterSource, /export function getPullRequestIdentity\(/u);
	assert.match(adapterSource, /const identity = getPullRequestIdentity\(event\.pullRequest\);/u);
	assert.doesNotMatch(adapterSource, /function pullRequestIdentity\(/u);
	assert.match(
		compositionSource,
		/useState<string \| null>\(null\)[\s\S]*selectPullRequestEntries\(activityEvents, SESSION_EPOCH_MS \+ elapsedMs\)[\s\S]*pullRequestEntries\.find\([\s\S]*getPullRequestIdentity\(entry\.pullRequest\) === selectedPullRequestIdentity/u,
	);
	assert.match(
		compositionSource,
		/setSelectedPullRequestIdentity\(identity\);[\s\S]*setPanelView\("details"\);/u,
	);
	assert.match(
		compositionSource,
		/const \{ setPanelView, setSuppressActivityPanelReveal \} = useMetadataRail\(\);/u,
	);
	assert.match(compositionSource, /<JiraWorkItemProvider[\s\S]*initialStateRevision=\{props\.initialStateRevision\}/u);
	assert.match(
		compositionSource,
		/setSelectedPullRequestIdentity\(null\);[\s\S]*\}, \[removeFailingChecks, stageKey\]\);/u,
	);
	assert.match(compositionSource, /<ExperimentalV2JiraWorkItemContent[\s\S]*stageKey=\{props\.stageKey\}/u);
	assert.doesNotMatch(compositionSource, /<ExperimentalV2JiraWorkItemContent[\s\S]*key=\{props\.initialStateRevision\}/u);
	assert.doesNotMatch(persistedStateSource, /selectedPullRequest|pullRequestIdentity/u);

	// Dialog title bar gets PR entries for the read-only Tag; ContextHeader gets
	// entries + selection handlers for the interactive resources dropdown.
	assert.match(
		compositionSource,
		/<ExperimentalWorkItemDialog[\s\S]*?pullRequestEntries=\{pullRequestEntries\}[\s\S]*?>/u,
	);
	assert.doesNotMatch(
		compositionSource,
		/<ExperimentalWorkItemDialog(?:(?!>)[\s\S])*selectedPullRequestIdentity=|<ExperimentalWorkItemDialog(?:(?!>)[\s\S])*onPullRequestSelect=/u,
	);
	assert.match(
		compositionSource,
		/<ContextHeader[\s\S]*pullRequestEntries=\{pullRequestEntries\}[\s\S]*pullRequestSelected=\{selectedPullRequestEntry !== null\}[\s\S]*selectedPullRequestIdentity=\{selectedPullRequestIdentity\}[\s\S]*onPullRequestClear=\{handlePullRequestClear\}[\s\S]*onPullRequestSelect=\{handlePullRequestSelect\}/u,
	);
	assert.match(
		compositionSource,
		/<MetadataRail[\s\S]*activity=\{\([\s\S]*<ActivityPanel[\s\S]*onOpenPullRequest=\{handlePullRequestSelect\}[\s\S]*railChromeEnabled=\{selectedPullRequestEntry === null\}[\s\S]*automationRules=\{automationRules\}[\s\S]*borderless[\s\S]*currentReviewerStatus=\{selectedPullRequestReviewerStatus\}[\s\S]*selectedPullRequestEntry=\{selectedPullRequestEntry\}[\s\S]*\/>/u,
	);
	assert.doesNotMatch(
		compositionSource,
		/<MetadataRail\n[\s\S]*?pullRequestEntries=|<MetadataRail\n[\s\S]*?onPullRequestSelect=/u,
	);
	assert.match(
		metadataRailSource,
		/const PullRequestContextRail = dynamic\([\s\S]*pull-request-context-rail[\s\S]*selectedPullRequestEntry \? \([\s\S]*activePanelView=\{activePanelView\}[\s\S]*currentReviewerStatus=\{currentReviewerStatus\}[\s\S]*entry=\{selectedPullRequestEntry\}[\s\S]*key=\{selectedPullRequestKey\}/u,
	);
	assert.doesNotMatch(
		metadataRailSource,
		/selectPullRequestEntries|setSelectedPullRequestIdentity|PullRequestsPanel|pullRequestEntries|onPullRequestSelect/u,
	);
	assert.match(
		contextResourcesSource,
		/<PullRequestsSelect[\s\S]*entries=\{pullRequestEntries\}[\s\S]*selectedIdentity=\{selectedPullRequestIdentity\}[\s\S]*onClearSelection=\{onPullRequestClear\}[\s\S]*onSelectEntry=\{onPullRequestSelect\}/u,
	);
	// Activity PR title rows reuse the same select handler as Review pull request,
	// and that handler switches the metadata rail to Details (not Activity).
	assert.match(
		activityPanelSource,
		/onOpenPullRequest\?: \(entry: JiraActivityEventEntry\) => void/u,
	);
	assert.match(
		activityPanelSource,
		/<JiraActivity[\s\S]*onOpenPullRequest=\{onOpenPullRequest\}/u,
	);
	assert.match(
		compositionSource,
		/const handlePullRequestSelect = useCallback\(\(entry: JiraActivityEventEntry\) => \{[\s\S]*if \(!guidedReview\) return;[\s\S]*setSelectedPullRequestIdentity\(identity\);[\s\S]*setPanelView\("details"\);[\s\S]*\}, \[pullRequestApprovalStates, setPanelView\]\);/u,
	);
	assert.match(
		compositionSource,
		/autoOpenPullRequestIdentity[\s\S]*autoOpenedForStageRef\.current === stageToken[\s\S]*handlePullRequestSelect\(entry\)/u,
	);
	// Opening a PR suppresses Build/Plan reveal-driven Activity switches so the
	// Details + PR overview surface stays put through subsequent build timers.
	assert.match(
		compositionSource,
		/const \{ setPanelView, setSuppressActivityPanelReveal \} = useMetadataRail\(\);/u,
	);
	assert.match(
		compositionSource,
		/useLayoutEffect\(\(\) => \{[\s\S]*const suppressed = selectedPullRequestIdentity !== null;[\s\S]*setSuppressActivityPanelReveal\(suppressed\);[\s\S]*return \(\) => \{[\s\S]*setSuppressActivityPanelReveal\(false\);[\s\S]*\};[\s\S]*\}, \[selectedPullRequestIdentity, setSuppressActivityPanelReveal\]\);/u,
	);
	assert.match(
		compositionSource,
		/onPullRequestSelect=\{handlePullRequestSelect\}[\s\S]*onOpenPullRequest=\{handlePullRequestSelect\}/u,
	);

	// Select options are Pull Request block cards (display-only; SelectItem activates).
	// No trailing checkmark / no blue selected chrome on the option card — the
	// trigger tag shows the open PR; hover uses surface-hovered only.
	assert.match(
		pullRequestsSelectSource,
		/<SelectContent[\s\S]*className="[^"]*rounded-xl p-1"[\s\S]*data-jira-work-item-resource-pull-requests-menu/u,
	);
	assert.match(
		pullRequestsSelectSource,
		/<SelectItem[\s\S]*group\/pr-option[\s\S]*data-\[highlighted\]:bg-transparent[\s\S]*data-selected:bg-transparent[\s\S]*data-selected:data-highlighted:bg-transparent[\s\S]*data-jira-work-item-pull-request-card=\{pullRequest\.number\}[\s\S]*showIndicator=\{false\}[\s\S]*value=\{identity\}[\s\S]*<PullRequest[\s\S]*border-transparent[\s\S]*group-data-\[highlighted\]\/pr-option:bg-surface-hovered/u,
	);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/<PullRequest[\s\S]*selected=\{/u,
	);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/group-data-\[highlighted\]\/pr-option:bg-bg-selected/u,
	);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/<SelectItem[\s\S]*p-1 data-selected:bg-transparent data-selected:data-highlighted:bg-bg-neutral-subtle-hovered/u,
	);
	assert.doesNotMatch(
		pullRequestsSelectSource,
		/<PullRequest[\s\S]*onActivate=/u,
	);
	assert.match(
		pullRequestsPanelSource,
		/data-jira-work-item-pull-request-card=\{number\}[\s\S]*data-jira-work-item-pull-request-identity=\{identity\}[\s\S]*data-selected=\{selected \? "true" : undefined\}/u,
	);
	assert.match(
		pullRequestsPanelSource,
		/<PullRequest[\s\S]*className="min-w-0 max-w-full"[\s\S]*selected=\{selected\}[\s\S]*onActivate=\{\(\) => onSelectEntry\(entry\)\}/u,
	);

	assert.match(
		compositionSource,
		/<ContextPanel[\s\S]*selectedPullRequestEntry=\{selectedPullRequestEntry\}[\s\S]*onDescriptionViewModeChange=\{setDescriptionViewMode\}/u,
	);
	assert.doesNotMatch(compositionSource, /onPullRequestBack/u);
	assert.match(
		contextPanelSource,
		/const selectedPullRequestKey = selectedPullRequestEntry\?\.pullRequest[\s\S]*getPullRequestIdentity\(selectedPullRequestEntry\.pullRequest\)[\s\S]*<PullRequestDetailView[\s\S]*entry=\{selectedPullRequestEntry\}[\s\S]*key=\{selectedPullRequestKey\}[\s\S]*<AiPlannerScope[\s\S]*<ContextEditableDescription/u,
	);
	assert.doesNotMatch(contextPanelSource, /onBack|onPullRequestBack/u);
	assert.match(
		contextResourcesSource,
		/<AnimatedContextTitleActions primaryAgentId=\{primaryCodingAgentId\} \/>[\s\S]*\{pullRequestSelected \? null : \([\s\S]*aria-label="Copy work item as markdown"[\s\S]*<EditorToolbarModeTabs/u,
	);
});
