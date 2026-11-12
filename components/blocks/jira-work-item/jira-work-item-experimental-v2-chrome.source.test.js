const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Title / column-chrome contracts for experimental-v2.
// Split from jira-work-item-experimental-v2.source.test.js to stay under the 1000-line budget.

const BLOCK_DIR = __dirname;

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}

test("experimental v2 places Status and Reported by under the title", () => {
	const detailsTabSource = readBlockFile("experimental-v2/components/details-tab.tsx");
	const titleBarSource = readBlockFile("experimental-v2/components/context-title-bar.tsx");
	const titleMetaSource = readBlockFile("experimental-v2/components/context-title-meta.tsx");
	const contextPanelSource = readBlockFile("experimental-v2/components/context-panel.tsx");

	// Migrated out of the Details rail — no Status / Reporter property rows.
	assert.doesNotMatch(detailsTabSource, /label="Status"|label="Reporter"|StatusPill|PersonReadOnlyValue|ProjectStatusIcon/u);
	assert.match(
		detailsTabSource,
		/label="Assignee"[\s\S]*label="Priority"[\s\S]*label="Project"[\s\S]*label="Start date"[\s\S]*\{showMore \?/u,
	);

	// Header band: status pill → PR Tag → "Reported by {name}" under the title.
	assert.match(
		titleBarSource,
		/import \{ ContextTitleMeta \} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/components\/context-title-meta"/u,
	);
	assert.match(
		titleBarSource,
		/export function ContextTitleBar\([\s\S]*<ContextEditableTitle \/>[\s\S]*<ContextTitleMeta[\s\S]*pullRequestEntries=\{pullRequestEntries\}/u,
	);
	assert.match(titleMetaSource, /data-jira-work-item-title-meta/u);
	assert.match(titleMetaSource, /className="mt-2 flex items-center gap-2"/u);
	assert.doesNotMatch(titleMetaSource, /TitleMetaField|label="Status"|label="Reported by"/u);
	assert.match(titleMetaSource, /<StatusPill[\s\S]*value=\{metadata\.status\}/u);
	assert.match(
		readBlockFile("experimental-v2/components/detail-field-editors.tsx"),
		/const \{ statusPhases \} = useJiraWorkItemMeta\(\);[\s\S]*const phases = statusPhases \?\? STATUS_PHASES;[\s\S]*variant=\{statusVariant\(value, phases\)\}[\s\S]*\{phases\.map\(\(phase\) =>/u,
	);
	// Title-meta PR Tag is read-only display (metrics only); interactive dropdown is in ContextResources.
	assert.match(
		titleMetaSource,
		/summarizePullRequestTagMetrics\(pullRequestEntries\)[\s\S]*data-jira-work-item-title-meta[\s\S]*data-jira-work-item-title-pull-requests[\s\S]*trailingMetric=\{trailingMetric\}[\s\S]*Pull requests/u,
	);
	assert.doesNotMatch(
		titleMetaSource,
		/PullRequestsSelect|PullRequestsPopover|PopoverTrigger|onPullRequestSelect|selectedPullRequestIdentity|useMetadataRail|pullRequestCount|openPullRequestsPanel|setPanelView/u,
	);
	assert.match(
		titleMetaSource,
		/metadata\.reporter \? \([\s\S]*<PersonLabel[\s\S]*person=\{metadata\.reporter\}[\s\S]*prefix="Reported by"[\s\S]*size="xs"/u,
	);
	assert.match(titleMetaSource, /className="text-xs text-text-subtle"/u);
	assert.match(
		titleMetaSource,
		/onChange=\{\(next\) => actions\.updateMetadata\(\{ status: next \}\)\}/u,
	);
	assert.doesNotMatch(contextPanelSource, /ContextTitleMeta|data-jira-work-item-title-meta/u);

	// PersonLabel size drives prefix+name text (xs → text-xs); default call sites stay text-sm.
	const personLabelSource = readBlockFile("experimental-v2/components/detail-field-editors.tsx");
	assert.match(
		personLabelSource,
		/const PERSON_LABEL_TEXT_CLASS = \{[\s\S]*xs: "text-xs",[\s\S]*sm: "text-sm",[\s\S]*\} as const;/u,
	);
	assert.match(
		personLabelSource,
		/className=\{cn\("min-w-0 truncate", PERSON_LABEL_TEXT_CLASS\[size\]\)\}/u,
	);
	assert.match(personLabelSource, /size = "sm"/u);
	// PersonLabel avatar→name gap matches PriorityLabel at 8px (gap-2).
	assert.match(
		personLabelSource,
		/export function PersonLabel\([\s\S]*className="flex min-w-0 items-center gap-2"/u,
	);
	assert.match(
		personLabelSource,
		/export function PriorityLabel\([\s\S]*className="flex min-w-0 items-center gap-2"[\s\S]*<IconTile[\s\S]*size="small"[\s\S]*variant="transparent"/u,
	);
});

test("experimental v2 Details shows Priority as a primary always-visible field", () => {
	const detailsTabSource = readBlockFile("experimental-v2/components/details-tab.tsx");

	// Primary quartet: Assignee → Priority → Project → Start date (outside See more).
	assert.match(
		detailsTabSource,
		/label="Assignee"[\s\S]*label="Priority"[\s\S]*label="Project"[\s\S]*label="Start date"[\s\S]*\{showMore \?/u,
	);
	assert.doesNotMatch(
		detailsTabSource,
		/\{showMore \? \([\s\S]*label="Priority"|\{showMore \? \([\s\S]*label="Project"|\{showMore \? \([\s\S]*label="Start date"/u,
	);
	assert.match(
		detailsTabSource,
		/\{showMore \? \([\s\S]*label="Due date"[\s\S]*label="Parent"[\s\S]*label="Labels"/u,
	);
});

test("experimental v2 keeps the status focus ring visible while its menu is open", () => {
	const detailFieldEditorsSource = readBlockFile("experimental-v2/components/detail-field-editors.tsx");

	// `ring-ring/50` (not full opacity) so the open status pill matches the
	// Input/InputGroup focus recipe used by the rest of the Details panel.
	assert.match(
		detailFieldEditorsSource,
		/className="data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring\/50"/u,
	);
});

test("experimental v2 reveals description mode tabs across the description scope", () => {
	const aiPlannerPanelSource = readBlockFile("experimental-v2/components/ai-planner-panel.tsx");
	const contextResourcesSource = readBlockFile("experimental-v2/components/context-resources.tsx");
	const layoutSource = readBlockFile("experimental-v2/components/experimental-work-item-layout.tsx");
	const richTextEditorStyles = fs.readFileSync(
		path.join(BLOCK_DIR, "../../ui-custom/rich-text-editor/rich-text-editor.css"),
		"utf8",
	);

	assert.match(
		aiPlannerPanelSource,
		/className=\{cn\("group\/description-scope flex flex-col gap-6", hasPlanner \? "px-2 pb-2" : null\)\}/u,
	);
	// Layout hover group wraps header + left column only — not the metadata rail.
	assert.match(
		layoutSource,
		/className="group\/description-scope contents">[\s\S]*<DescriptionColumnShell[\s\S]*chrome=\{header\}[\s\S]*\{context\(leftScrollContainerRef\)\}[\s\S]*<\/div>\s*<\/div>\s*<AnimatePresence[\s\S]*id="experimental-work-item-metadata-panel"/u,
	);
	assert.doesNotMatch(
		layoutSource,
		/className="group\/description-scope[^"]*overflow-y-auto/u,
	);
	assert.doesNotMatch(
		layoutSource,
		/group\/description-scope[\s\S]*id="experimental-work-item-metadata-panel"[\s\S]*group\/description-scope/u,
	);
	assert.match(
		contextResourcesSource,
		/<div className="pointer-events-none ml-auto shrink-0 flex items-center gap-2 opacity-0 transition-opacity duration-normal ease-out group-hover\/description-scope:pointer-events-auto group-hover\/description-scope:opacity-100 group-has-\[:focus-visible\]\/description-scope:pointer-events-auto group-has-\[:focus-visible\]\/description-scope:opacity-100 motion-reduce:transition-none">[\s\S]*aria-label="Copy work item as markdown"[\s\S]*navigator\.clipboard\.writeText\(markdown\)[\s\S]*<CopyIcon label="" size="small" \/>[\s\S]*Copy work item as markdown[\s\S]*<EditorToolbarModeTabs[\s\S]*mode=\{descriptionViewMode\}[\s\S]*onModeChange=\{onDescriptionViewModeChange\}/u,
	);
	assert.match(
		contextResourcesSource,
		/<TooltipTrigger\s+delay=\{0\}[\s\S]*aria-label="Copy work item as markdown"/u,
	);
	// Details/Activities toggle lives in the metadata rail, not the left-column resources row.
	assert.doesNotMatch(contextResourcesSource, /MetadataRailToggle/u);
	assert.doesNotMatch(contextResourcesSource, /size="compact"/u);
	// Column chrome anchor buttons use default 32px control height (not compact 24px).
	assert.match(
		contextResourcesSource,
		/aria-label="Add to work item" size="icon"[\s\S]*aria-label="Copy work item as markdown"[\s\S]*size="icon"/u,
	);
	assert.doesNotMatch(contextResourcesSource, /group-focus-within\/description-scope/u);
	assert.doesNotMatch(contextResourcesSource, /\[&_\[data-slot=tabs-(?:list|trigger)\]\]/u);
	assert.match(
		richTextEditorStyles,
		/\.context-description-tiptap-editor:not\(:focus\):not\(\.context-description-tiptap-stable-trailing-node\) > p:last-child:not\(:first-child\):has\(> br\.ProseMirror-trailingBreak:only-child\) \{\s*display: none;/u,
	);
});

test("experimental v2 scopes ContextResources to the left column and the Details toggle to the rail", () => {
	const globalCss = fs.readFileSync(path.join(BLOCK_DIR, "../../../app/globals.css"), "utf8");
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");
	const contextEditableHeaderSource = readBlockFile("experimental-v2/components/context-editable-header.tsx");
	const contextPanelSource = readBlockFile("experimental-v2/components/context-panel.tsx");
	const contextResourcesSource = readBlockFile("experimental-v2/components/context-resources.tsx");
	const dialogSource = readBlockFile("experimental-v2/components/experimental-work-item-dialog.tsx");
	const layoutSource = readBlockFile("experimental-v2/components/experimental-work-item-layout.tsx");
	const modalHeaderSource = fs.readFileSync(
		path.join(BLOCK_DIR, "../../projects/jira/components/work-item-modal/modal-header.tsx"),
		"utf8",
	);
	const titleActionsSource = readBlockFile("experimental-v2/components/context-title-actions.tsx");
	const titleBarSource = readBlockFile("experimental-v2/components/context-title-bar.tsx");

	assert.match(
		compositionSource,
		/useState<EditorToolbarViewMode>\("rendered"\)[\s\S]*header=\{\([\s\S]*<ContextHeader[\s\S]*primaryCodingAgentId=\{primaryCodingAgentId\}[\s\S]*context=\{\([\s\S]*<ContextPanel/u,
	);
	// Title lives in the dialog header band; ContextHeader owns resources chrome
	// including the interactive PR dropdown (title-meta Tag stays read-only).
	assert.match(
		contextPanelSource,
		/export function ContextHeader\([\s\S]*className="shrink-0" data-jira-work-item-context-header[\s\S]*data-jira-work-item-header-actions[\s\S]*<ContextResources[\s\S]*descriptionViewMode=\{descriptionViewMode\}[\s\S]*outputs=\{outputs\}[\s\S]*primaryCodingAgentId=\{primaryCodingAgentId\}[\s\S]*pullRequestEntries=\{pullRequestEntries\}[\s\S]*pullRequestSelected=\{pullRequestSelected\}[\s\S]*selectedPullRequestIdentity=\{selectedPullRequestIdentity\}[\s\S]*onDescriptionViewModeChange=\{onDescriptionViewModeChange\}[\s\S]*onPullRequestClear=\{onPullRequestClear\}[\s\S]*onPullRequestSelect=\{onPullRequestSelect\}/u,
	);
	assert.doesNotMatch(contextPanelSource, /ContextTitleBar|WorkItemKeyCopy|data-jira-work-item-title-block/u);
	assert.doesNotMatch(
		contextPanelSource,
		/selectLatestPullRequestEntry|data-jira-work-item-header-pull-request/u,
	);
	assert.match(
		contextPanelSource,
		/export function ContextPanel\([\s\S]*<section aria-label="Work item context" className="flex flex-col">[\s\S]*selectedPullRequestEntry \? \([\s\S]*<PullRequestDetailView[\s\S]*\) : \([\s\S]*<AiPlannerScope[\s\S]*<ContextEditableDescription/u,
	);
	assert.doesNotMatch(
		contextPanelSource,
		/Loading pull request details|data-jira-work-item-pull-request-detail-loading/u,
	);
	assert.doesNotMatch(contextPanelSource, /export function ContextPanel\([\s\S]*<ContextTitleBar|export function ContextPanel\([\s\S]*<ContextResources/u);
	// Chrome is outside the scrollport, so the native scrollbar begins below
	// the controls and the first body field keeps its focus-ring clearance.
	assert.match(
		layoutSource,
		/grid-rows-\[minmax\(0,1fr\)\][\s\S]*DescriptionColumnShell[\s\S]*chrome=\{header\}[\s\S]*\{context\(leftScrollContainerRef\)\}[\s\S]*id="experimental-work-item-metadata-panel"[\s\S]*\{metadata\}/u,
	);
	assert.match(
		layoutSource,
		/function DescriptionColumnShell\([\s\S]*data-jira-work-item-column-chrome[\s\S]*data-jira-work-item-scroll-region[\s\S]*data-jira-work-item-column-body/u,
	);
	// Fixed chrome owns the top seam; the scrollport keeps only its bottom mask.
	assert.match(
		layoutSource,
		/function useColumnScrollMask\([\s\S]*fadeTop: false,[\s\S]*fadeBottom: showBottomScrollMask/u,
	);
	// Wide chrome is a fixed sibling above the body-only scrollport, so native
	// scrollbars start below the controls.
	assert.match(
		layoutSource,
		/data-jira-work-item-column-shell[\s\S]*data-jira-work-item-column-chrome[\s\S]*data-scroll-fade-visible=\{showTopScrollMask \? "" : undefined\}[\s\S]*\{chrome\}[\s\S]*@\[860px\]\/agentlayout:overflow-y-auto @\[860px\]\/agentlayout:overscroll-y-none[\s\S]*data-jira-work-item-scroll-region[\s\S]*data-jira-work-item-column-body/u,
	);
	// A collapsing sticky PR header must not let browser scroll anchoring push
	// scrollTop back across its collapse threshold and retrigger the transition.
	assert.match(
		layoutSource,
		/has-\[\[data-jira-work-item-pull-request-detail-header\]\]:\[overflow-anchor:none\]/u,
	);
	assert.match(
		layoutSource,
		/flex h-full min-h-0 min-w-0 flex-col gap-6 overflow-y-auto overscroll-y-none/u,
	);
	assert.doesNotMatch(
		layoutSource,
		/data-jira-work-item-column-chrome[^>]*overflow-y-auto|COLUMN_CHROME_HEIGHT_VAR|container-type:scroll-state/u,
	);
	assert.doesNotMatch(layoutSource, /pinColumnChrome/u);
	// Body is a z-0 stacking context so mermaid/code sticky z-10 cannot cover chrome.
	assert.match(
		layoutSource,
		/order-2 relative z-0 min-w-0[\s\S]*data-jira-work-item-column-body/u,
	);
	assert.match(
		layoutSource,
		/data-jira-work-item-column-chrome[\s\S]*order-2 contents[^"]* @\[860px\]\/agentlayout:relative @\[860px\]\/agentlayout:block[\s\S]*@\[860px\]\/agentlayout:overflow-y-auto @\[860px\]\/agentlayout:overscroll-y-none @\[860px\]\/agentlayout:px-6 @\[860px\]\/agentlayout:pb-6"[\s\S]*data-jira-work-item-scroll-region/u,
	);
	assert.match(
		contextResourcesSource,
		/@\[860px\]\/agentlayout:pt-6[\s\S]*relative z-10 shrink-0 @\[860px\]\/agentlayout:pb-7/u,
	);
	// Both fixed chrome owners must paint above their later z-0 scroll bodies,
	// otherwise the visible top fade is covered and content hard-clips at the seam.
	const metadataRailSource = readBlockFile("experimental-v2/components/metadata-rail.tsx");
	assert.match(
		metadataRailSource,
		/className="group relative z-10 shrink-0"[\s\S]*data-jira-work-item-column-chrome[\s\S]*data-scroll-fade-visible=\{showTopScrollMask \? "" : undefined\}/u,
	);
	assert.match(
		metadataRailSource,
		/className="relative z-0 flex min-w-0 flex-col gap-2"[\s\S]*data-jira-work-item-column-body/u,
	);
	// The resource row owns the top-edge fade driven by its sibling scrollport.
	assert.doesNotMatch(
		contextResourcesSource,
		/sticky top-0|container-type:scroll-state/u,
	);
	assert.match(
		contextResourcesSource,
		/import \{ StickyRowScrollFade \} from "@\/components\/visual\/scroll-mask"[\s\S]*data-jira-work-item-resource-row[\s\S]*pullRequestSelected \? null : \([\s\S]*<StickyRowScrollFade[\s\S]*group-data-\[scroll-fade-visible\]:opacity-100[\s\S]*from-bg-input[\s\S]*data-slot="jira-work-item-resource-row-scroll-fade"/u,
	);
	assert.match(
		contextPanelSource,
		/header className="shrink-0" data-jira-work-item-context-header[\s\S]*data-jira-work-item-header-actions/u,
	);
	assert.match(
		layoutSource,
		/const contentStyle = \{[\s\S]*"--metadata-panel-offset"[\s\S]*\[margin-right:var\(--metadata-panel-offset\)\][\s\S]*style=\{contentStyle\}/u,
	);
	assert.match(
		readBlockFile("experimental-v2/lib/layout-constants.ts"),
		/export const METADATA_PANEL_DEFAULT_WIDTH_PX = 440;[\s\S]*export const METADATA_PANEL_MIN_WIDTH_PX = 440;[\s\S]*export const METADATA_PANEL_FALLBACK_MAX_WIDTH_PX = 720;[\s\S]*export const DESCRIPTION_PANEL_MIN_WIDTH_PX = METADATA_PANEL_MIN_WIDTH_PX;[\s\S]*return Math\.max\(METADATA_PANEL_MIN_WIDTH_PX, dialogWidth - DESCRIPTION_PANEL_MIN_WIDTH_PX\);/u,
	);
	assert.match(
		layoutSource,
		/"--metadata-panel-offset": metadataCollapsed \? "0px" : `\$\{metadataPanelWidth\}px`/u,
	);
	assert.match(
		layoutSource,
		/"--metadata-panel-width": `\$\{metadataPanelWidth\}px`[\s\S]*@\[860px\]\/agentlayout:w-\[var\(--metadata-panel-width\)\][\s\S]*id="experimental-work-item-metadata-panel"/u,
	);
	// The parent grid clips the positioning shell; body scroll lives in MetadataRail.
	assert.match(
		layoutSource,
		/@\[860px\]\/agentlayout:overflow-visible @\[860px\]\/agentlayout:px-6 @\[860px\]\/agentlayout:pt-6 @\[860px\]\/agentlayout:\[grid-area:1\/1\]"[\s\S]*id="experimental-work-item-metadata-panel"/u,
	);
	assert.doesNotMatch(
		layoutSource,
		/id="experimental-work-item-metadata-panel"[\s\S]*@\[860px\]\/agentlayout:pl-2|@\[860px\]\/agentlayout:pl-2[\s\S]*id="experimental-work-item-metadata-panel"/u,
	);
	assert.doesNotMatch(
		layoutSource,
		/id="experimental-work-item-metadata-panel"[\s\S]*data-jira-work-item-scroll-region|ref=\{metadataScrollRef\}/u,
	);
	assert.match(
		layoutSource,
		/data-jira-work-item-metadata-slot[\s\S]*\{metadata\}/u,
	);
	assert.doesNotMatch(layoutSource, /agentlayout:-mt-5">\{metadata\}/u);
	assert.match(
		contextResourcesSource,
		/"relative z-10 shrink-0 @\[860px\]\/agentlayout:pb-7"[\s\S]*data-jira-work-item-resource-row[\s\S]*className="@container\/resource-row flex flex-wrap items-start gap-2[^"]*"[\s\S]*data-jira-work-item-resource-row-content[\s\S]*aria-label="Add to work item"[\s\S]*resources\.map\(\(resource\) =>[\s\S]*resource\.renderPopover[\s\S]*<AnimatedContextTitleActions primaryAgentId=\{primaryCodingAgentId\} \/>[\s\S]*<PullRequestsSelect[\s\S]*entries=\{pullRequestEntries\}[\s\S]*\{pullRequestSelected \? null : \(/u,
	);
	assert.match(
		contextResourcesSource,
		/<PullRequestsSelect[\s\S]*entries=\{pullRequestEntries\}[\s\S]*selectedIdentity=\{selectedPullRequestIdentity\}[\s\S]*onClearSelection=\{onPullRequestClear\}[\s\S]*onSelectEntry=\{onPullRequestSelect\}/u,
	);
	assert.match(
		contextResourcesSource,
		/const hasPlanner = planner\.status !== "inactive" && planner\.status !== "applied";[\s\S]*hasPlanner[\s\S]*\? "bg-bg-input \[&_\[data-slot=button\]\]:bg-bg-input[^"]*"[\s\S]*: null/u,
	);
	assert.doesNotMatch(contextResourcesSource, /\[&_\[data-slot=tabs-list\]\]:bg-bg-input/u);
	assert.doesNotMatch(contextResourcesSource, /\[&_\[data-slot=tabs-trigger\]\[data-active\]\]:bg-bg-input/u);
	assert.match(contextResourcesSource, /StickyRowScrollFade[\s\S]*from-bg-input/u);
	assert.doesNotMatch(contextResourcesSource, /<div className="flex flex-col gap-4">/u);
	assert.doesNotMatch(
		globalCss,
		/data-jira-work-item-column-chrome-fill/u,
	);
	assert.match(
		globalCss,
		/\[data-slot="jira-activity-header"\] > :first-child \{[\s\S]*background: inherit;/u,
	);
	assert.doesNotMatch(contextResourcesSource, /className="flex flex-wrap items-start gap-1/u);
	assert.match(
		contextResourcesSource,
		/<div className="[^"]*ml-auto shrink-0[^"]*">[\s\S]*<EditorToolbarModeTabs[\s\S]*mode=\{descriptionViewMode\}[\s\S]*onModeChange=\{onDescriptionViewModeChange\}/u,
	);
	assert.doesNotMatch(contextResourcesSource, /MetadataRailToggle/u);
	assert.doesNotMatch(
		contextResourcesSource,
		/@\[860px\]\/agentlayout:mr-\[var\(--metadata-panel-offset\)\]/u,
	);
	assert.match(contextResourcesSource, /buttonLabel: "Add attachments",[\s\S]*<AttachmentIcon label="" size="small" \/>/u);
	assert.match(contextResourcesSource, /buttonLabel: "Add subtasks",[\s\S]*<ChildWorkItemsIcon label="" size="small" \/>/u);
	assert.match(contextResourcesSource, /buttonLabel: "Link work items",[\s\S]*<LinkIcon label="" size="small" \/>[\s\S]*<LinkedWorkItemsPopover key="linkedItems" open=\{open\} onOpenChange=\{onOpenChange\} trigger=\{trigger\} \/>/u);
	assert.match(
		contextResourcesSource,
		/<DropdownMenuTrigger[\s\S]*aria-label="Add to work item"[\s\S]*<AddIcon label="" size="small" \/>[\s\S]*resources\.map\(\(resource\) => \([\s\S]*onSelect=\{\(\) => setActiveResourceAction\(resource\.id\)\}[\s\S]*Create commit[\s\S]*Create branch/u,
	);
	assert.match(contextResourcesSource, /<AttachmentsPopover key="attachments" open=\{open\} onOpenChange=\{onOpenChange\} trigger=\{trigger\} \/>/u);
	assert.match(contextResourcesSource, /<SubtasksPopover key="subtasks" open=\{open\} onOpenChange=\{onOpenChange\} trigger=\{trigger\} \/>/u);
	assert.match(contextResourcesSource, /className="pointer-events-none absolute inset-0 opacity-0"[\s\S]*activeResourceAction === resource\.id/u);
	assert.doesNotMatch(contextResourcesSource, /<Button size="compact" type="button" variant="outline">/u);
	assert.doesNotMatch(contextResourcesSource, /const empty =|empty\.map/u);
	assert.doesNotMatch(contextResourcesSource, /agentFieldName="attachments"|agentFieldName="subtasks"|agentFieldName="linkedItems"/u);
	assert.match(titleActionsSource, /metadataTogglePending \|\| metadataLayoutAnimating/u);
	assert.match(titleActionsSource, /inert=\{isInteractive \? undefined : true\}/u);
	// Restriction, watcher, and share moved into the header overflow menu.
	assert.doesNotMatch(titleActionsSource, /ContextHeaderActions|LockUnlockedIcon|EyeOpenIcon|ShareIcon/u);
	assert.match(
		titleActionsSource,
		/export function ContextTitleActions\([\s\S]*useJiraWorkItemMeta\(\)[\s\S]*primaryAgentId \?\? \(initialPreset === "blank" \? null : "claude-code"\)[\s\S]*<ButtonGroup variant="split">[\s\S]*aria-label=\{primaryCodingAgent \? `Open in \$\{primaryCodingAgent\.label\}` : "Open in"\}[\s\S]*className="has-data-\[icon=inline-start\]:pl-2 @max-\[36rem\]\/resource-row:px-2 \[&_\[aria-hidden\]\[data-agent-logo=rovo\]_img\]:size-3! \[&_\[aria-hidden\]\[data-agent-logo=rovo\]_svg\]:size-3! \[&_\[aria-hidden\]\[data-agent-logo=third-party\]_img\]:size-4! \[&_\[aria-hidden\]\[data-agent-logo=third-party\]_svg\]:size-4!"[\s\S]*size="default"[\s\S]*className="inline-flex size-4 shrink-0 items-center justify-center \[&_span\]:flex! \[&_span\]:items-center! \[&_span\]:justify-center!"[\s\S]*data-agent-logo=\{primaryCodingAgent\?\.id === "rovo-cli" \? "rovo" : primaryCodingAgent \? "third-party" : undefined\}[\s\S]*data-icon=\{primaryCodingAgent \? "inline-start" : undefined\}[\s\S]*primaryCodingAgent\.buttonLogo[\s\S]*<CodeIcon aria-hidden size="small" \/>[\s\S]*className="@max-\[36rem\]\/resource-row:hidden"[\s\S]*primaryCodingAgent \? `Open in \$\{primaryCodingAgent\.label\}` : "Open in"[\s\S]*aria-label="More open options" size="icon"/u,
	);
	assert.match(titleActionsSource, /buttonLogo: <RovoColorIcon size="small" \/>/u);
	assert.match(titleActionsSource, /thirdPartyAgentLogo\("claude", "xxsmall"\)/u);
	assert.match(titleActionsSource, /<ChevronDownIcon label="" size="small" \/>/u);
	assert.doesNotMatch(titleActionsSource, /aria-label=\{primaryCodingAgent[\s\S]*className="gap-0\.5"[\s\S]*variant="outline"/u);
	assert.doesNotMatch(titleActionsSource, /AddIcon|aria-label="Add"/u);
	assert.match(titleActionsSource, /<motion\.div[\s\S]*className="flex shrink-0 items-center gap-1"/u);
	assert.doesNotMatch(titleActionsSource, /export function ContextTitleActions\([\s\S]*<div className="flex shrink-0 items-center gap-2">/u);
	assert.match(
		titleActionsSource,
		/const CODING_AGENTS[\s\S]*\{ id: "claude-code", label: "Claude"[\s\S]*\{ id: "claude-cli", label: "Claude CLI"[\s\S]*\{ id: "codex", label: "Codex"[\s\S]*\{ id: "cursor", label: "Cursor"[\s\S]*\{ id: "gemini", label: "Gemini"[\s\S]*\{ id: "github-copilot", label: "GitHub Copilot"[\s\S]*\{ id: "rovo-cli", label: "Rovo CLI"[\s\S]*\{ id: "vs-code", label: "VS Code"/u,
	);
	assert.match(
		titleActionsSource,
		/return <LogoThirdParty name=\{name\} size=\{size\} borderless \/>;/u,
	);
	assert.match(
		titleActionsSource,
		/codingAgents\.map\(\(agent\) => \([\s\S]*<DropdownMenuItem[\s\S]*elemBefore=\{<span aria-hidden className="inline-flex items-center justify-center leading-none">\{agent\.logo\}<\/span>\}[\s\S]*key=\{agent\.id\}[\s\S]*onSelect=\{\(\) => setSelectedAgentId\(agent\.id\)\}[\s\S]*\{agent\.label\}[\s\S]*Copy prompt/u,
	);
	assert.doesNotMatch(titleActionsSource, /byline|menu-row-title|menu-row-byline|className="h-11 py-0"/u);
	assert.match(
		titleActionsSource,
		/<div className="sticky bottom-0 bg-surface-overlay px-1 pb-1">[\s\S]*<DropdownMenuSeparator className="mt-0" \/>[\s\S]*Copy prompt/u,
	);
	assert.doesNotMatch(titleActionsSource, /Configure MCP|Configure Teamwork Graph|\/icons\/mcp\.svg|TeamworkGraphIcon/u);
	assert.doesNotMatch(titleActionsSource, /sticky bottom-0 border-t|<div className="border-t border-border p-1">/u);
	assert.match(
		titleActionsSource,
		/<DropdownMenuContent[\s\S]*className="max-h-\[var\(--available-height\)\] p-0"[\s\S]*<div className="p-1">/u,
	);
	assert.doesNotMatch(titleActionsSource, /max-h-72|overflow-y-auto p-1/u);
	assert.doesNotMatch(titleActionsSource, /DropdownMenuSub|ScreenIcon|CloudIcon/u);
	assert.doesNotMatch(titleActionsSource, /ContextTitleActions\([\s\S]*collapsed = false/u);
	assert.doesNotMatch(titleBarSource, /ContextTitleActions|AnimatedContextTitleActions/u);
	assert.doesNotMatch(titleBarSource, /from "motion\/react"|usePanelLayout/u);
	assert.match(
		titleBarSource,
		/navigator\.clipboard\?\.writeText\(workItem\.code\)[\s\S]*setCopied\(true\)[\s\S]*setTooltipOpen\(true\)/u,
	);
	assert.match(
		titleBarSource,
		/export function WorkItemKeyCopy\(\)[\s\S]*workItemKeyAnchorRef = useRef<HTMLSpanElement>\(null\)[\s\S]*<TooltipTrigger[\s\S]*delay=\{0\}[\s\S]*render=\{\s*<button[\s\S]*ref=\{workItemKeyAnchorRef\} data-jira-work-item-key-label>[\s\S]*\{workItem\.code\}[\s\S]*data-jira-work-item-key-copy-icon[\s\S]*<\/button>\s*\}[\s\S]*\/>[\s\S]*<TooltipContent anchor=\{workItemKeyAnchorRef\} side="top">[\s\S]*\{copyLabel\}[\s\S]*<\/TooltipContent>/u,
	);
	assert.doesNotMatch(titleBarSource, /from "@\/components\/ui\/tag"|<Tag[\s\S]*data-jira-work-item-key/u);
	assert.match(titleBarSource, /from "@\/components\/ui\/icon"/u);
	assert.match(titleBarSource, /import LinkIcon from "@atlaskit\/icon\/core\/link"/u);
	assert.match(titleBarSource, /import StatusSuccessIcon from "@atlaskit\/icon\/core\/status-success"/u);
	assert.match(
		titleBarSource,
		/className="group inline-flex cursor-pointer items-center rounded-sm bg-transparent p-0 font-mono text-text-subtlest"/u,
	);
	assert.doesNotMatch(titleBarSource, /border-border|data-tag-text|color="gray"|bg-bg-neutral-subtle/u);
	assert.match(
		titleBarSource,
		/max-w-0[\s\S]*group-hover:max-w-6[\s\S]*group-focus-visible:max-w-6[\s\S]*copied && "max-w-6[\s\S]*data-jira-work-item-key-copy-icon/u,
	);
	assert.match(titleBarSource, /onClick=\{handleCopyWorkItemKey\}/u);
	assert.match(titleBarSource, /data-jira-work-item-key/u);
	assert.doesNotMatch(titleBarSource, /overlayAction|data-slot=tag-overlay-action-button/u);
	assert.doesNotMatch(titleBarSource, /group\/work-item-key|group\/tag/);
	assert.doesNotMatch(titleBarSource, /role="button"|tabIndex=\{0\}|onKeyDown=\{handleKeyDown\}/u);
	assert.doesNotMatch(titleBarSource, /from "@\/components\/ui\/button"|<Button[\s\S]*data-jira-work-item-key/u);
	assert.match(titleBarSource, /type="button"/u);
	assert.match(
		titleBarSource,
		/export function ContextTitleBar\([\s\S]*className="min-w-0 self-stretch px-6 pb-4"[\s\S]*data-jira-work-item-title-block[\s\S]*data-jira-work-item-title-column[\s\S]*<ContextEditableTitle \/>[\s\S]*<ContextTitleMeta pullRequestEntries=\{pullRequestEntries\}/u,
	);
	assert.doesNotMatch(
		titleBarSource,
		/selectedPullRequestIdentity|onPullRequestSelect/u,
	);
	assert.doesNotMatch(
		titleBarSource,
		/export function ContextTitleBar\([\s\S]*data-jira-work-item-title(?!-)/u,
	);
	assert.doesNotMatch(
		titleBarSource,
		/@\[860px\]\/agentlayout:mr-\[var\(--metadata-panel-offset\)\]/u,
	);
	assert.doesNotMatch(contextPanelSource, /ContextTitleMeta|data-jira-work-item-title-meta/u);
	// Title is a live heading-styled Input (description-style direct edit), not InlineEdit.
	assert.doesNotMatch(
		contextEditableHeaderSource,
		/from "@\/components\/ui\/inline-edit"|editButtonLabel=|onConfirm=\{|readViewFitContainerWidth/u,
	);
	assert.match(
		contextEditableHeaderSource,
		/export function ContextEditableTitle\(\)[\s\S]*<Input[\s\S]*aria-label="Work item title"[\s\S]*className=\{cn\(\s*CONTEXT_TITLE_READ_VIEW_CLASS_NAME,[\s\S]*data-jira-work-item-title[\s\S]*style=\{CONTEXT_TITLE_FONT_STYLE\}[\s\S]*value=\{contextResources\.title\}[\s\S]*variant="none"[\s\S]*onChange=\{\(event\) => actions\.editContextText\("title", event\.currentTarget\.value\)\}/u,
	);
	assert.match(
		readBlockFile("experimental-v2/components/inline-edit-treatment.ts"),
		/lineHeight: "2\.75rem"/u,
	);
	assert.match(
		readBlockFile("experimental-v2/components/inline-edit-treatment.ts"),
		/export const CONTEXT_TITLE_READ_VIEW_CLASS_NAME =\s*"relative h-auto min-h-\[2\.75rem\] border-0 bg-transparent px-0 py-0 text-\[length:unset\] leading-\[unset\] hover:bg-transparent active:bg-transparent focus-visible:border-transparent focus-visible:bg-transparent";/u,
	);
	assert.doesNotMatch(
		readBlockFile("experimental-v2/components/inline-edit-treatment.ts"),
		/export const CONTEXT_TITLE_READ_VIEW_CLASS_NAME =\s*"[^"]*\bpy-[1-9][^"]*"/u,
	);
	assert.doesNotMatch(
		readBlockFile("experimental-v2/components/inline-edit-treatment.ts"),
		/export const CONTEXT_TITLE_READ_VIEW_CLASS_NAME =\s*"[^"]*border-2[^"]*"/u,
	);
	assert.doesNotMatch(titleBarSource, /export function ContextTitleBar\(\)[\s\S]*<WorkItemKeyCopy/u);
	// Dialog chrome band: breadcrumbs (work-item key) + editable title above the 2-col body.
	assert.match(
		dialogSource,
		/import \{\s*ContextTitleBar,\s*WorkItemKeyCopy,\s*\} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/components\/context-title-bar"/u,
	);
	assert.match(
		dialogSource,
		/data-jira-work-item-header-band[\s\S]*breadcrumbLeadingContent=\{<WorkItemKeyCopy \/>\}[\s\S]*breadcrumbRevealOnHover[\s\S]*<ContextTitleBar pullRequestEntries=\{pullRequestEntries\}/u,
	);
	assert.doesNotMatch(
		dialogSource,
		/selectedPullRequestIdentity|onPullRequestSelect/u,
	);
	assert.doesNotMatch(
		dialogSource,
		/data-jira-work-item-header-band[\s\S]*data-jira-work-item-title-block[\s\S]*<ContextTitleBar/u,
	);
	assert.match(
		modalHeaderSource,
		/breadcrumbLeadingContent\?: ReactNode;[\s\S]*breadcrumbRevealOnHover\?: boolean;[\s\S]*<BreadcrumbItem className="mr-2 shrink-0">[\s\S]*\{breadcrumbLeadingContent\}[\s\S]*<BreadcrumbItem[\s\S]*className=\{cn\("min-w-0 max-w-\[240px\] shrink", breadcrumbTrailRevealClassName\)\}[\s\S]*data-breadcrumb-trail=""/u,
	);
	// Parent/current trail hover-reveals; leading work-item key + header actions stay visible.
	assert.match(
		modalHeaderSource,
		/breadcrumbTrailRevealClassName = breadcrumbRevealOnHover[\s\S]*opacity-0 transition-opacity duration-normal ease-out[\s\S]*group-hover\/breadcrumb-reveal:opacity-100[\s\S]*group-has-\[\[data-breadcrumb-trail\]:has\(:focus-visible\)\]\/breadcrumb-reveal:opacity-100[\s\S]*motion-reduce:transition-none[\s\S]*group\/breadcrumb-reveal[\s\S]*data-jira-work-item-breadcrumb=\{\s*breadcrumbRevealOnHover \? "reveal-on-hover" : undefined\s*\}[\s\S]*breadcrumbLeadingContent[\s\S]*data-breadcrumb-trail=""/u,
	);
	assert.match(dialogSource, /gridTemplateRows: "minmax\(0, 1fr\)"/u);
});
