const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const AGENT_ACTIVITY_SOURCE = [
	readFileSync(join(__dirname, "agent-activity.tsx"), "utf8"),
	readFileSync(join(__dirname, "agent-activity-row-presentation.tsx"), "utf8"),
].join("\n");
const SUMMARY_SOURCE = readFileSync(join(__dirname, "summary.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "types.ts"), "utf8");
const COMPLETED_RUNS_SOURCE = readFileSync(join(__dirname, "completed-agent-runs.tsx"), "utf8");
const COMPLETED_RUNS_MODEL_SOURCE = readFileSync(join(__dirname, "completed-agent-runs-model.ts"), "utf8");
const LIB_SOURCE = readFileSync(join(__dirname, "lib.ts"), "utf8");
const SUBTASKS_SOURCE = readFileSync(join(__dirname, "subtasks.tsx"), "utf8");
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const DEMO_SOURCE = readFileSync(join(__dirname, "../../website/demos/blocks/jira-issue-demo.tsx"), "utf8");
const DETAILS_SOURCE = readFileSync(join(__dirname, "../../../app/data/details/blocks/jira-issue.ts"), "utf8");
const VARIANT_REGISTRY_SOURCE = readFileSync(join(__dirname, "../../website/registry/blocks-variants.ts"), "utf8");
const SUBTASKS_BLOCK = SUBTASKS_SOURCE.slice(SUBTASKS_SOURCE.indexOf("export function JiraIssueSubtasks"));

test("Jira issue agent activity experimental v2 duplicates the playground with larger icons and stroke nested cards", () => {
	assert.match(TYPES_SOURCE, /export type JiraIssueIconScale = "compact" \| "comfortable";/u);
	assert.match(SOURCE, /iconScale\?: JiraIssueIconScale;/u);
	assert.match(SOURCE, /subtaskChrome\?: JiraIssueChrome;/u);
	assert.match(SOURCE, /iconScale = "compact",/u);
	assert.match(SOURCE, /iconScale=\{iconScale\}/u);
	assert.match(SOURCE, /subtaskChrome=\{subtaskChrome\}/u);
	assert.match(LIB_SOURCE, /export function resolveJiraIssueIconMetrics/u);
	assert.match(LIB_SOURCE, /export function resolveJiraIssueSubtaskChrome/u);
	assert.match(LIB_SOURCE, /export const JIRA_ISSUE_COMFORTABLE_ISSUE_KEY_CLASS = "text-xs font-medium leading-4 text-text-subtle";/u);
	assert.match(LIB_SOURCE, /export const JIRA_ISSUE_COMFORTABLE_COMPACT_ICON_CLASS =/u);
	assert.match(SUMMARY_SOURCE, /iconScale = "compact",/u);
	assert.match(SUMMARY_SOURCE, /iconScale=\{iconScale\}/u);
	assert.match(SUMMARY_SOURCE, /iconMetrics\.compactIconClassName/u);
	assert.match(SUMMARY_SOURCE, /iconSize=\{iconMetrics\.iconTileIconSize\}/u);
	assert.match(SUMMARY_SOURCE, /size=\{iconMetrics\.assigneeSize\}/u);
	assert.match(SUMMARY_SOURCE, /iconMetrics\.issueKeyClassName/u);
	assert.match(SUBTASKS_SOURCE, /<span className=\{iconMetrics\.issueKeyClassName\}>/u);
	assert.doesNotMatch(SUBTASKS_SOURCE, /truncate text-xs font-semibold text-text-subtlest/u);
	assert.match(SUBTASKS_SOURCE, /const comfortableIcons = iconScale === "comfortable";/u);
	assert.match(SUBTASKS_SOURCE, /import \{ Progress \} from "@\/components\/ui\/progress";/u);
	assert.match(SUBTASKS_SOURCE, /const completedPercent = totalCount > 0 \? Math\.round\(\(completedCount \/ totalCount\) \* 100\) : 0;/u);
	assert.match(SUBTASKS_SOURCE, /const showSubtaskProgress = totalCount > 0;/u);
	assert.doesNotMatch(SUBTASKS_SOURCE, /showSubtaskProgress = comfortableIcons && totalCount > 0;/u);
	assert.match(
		SUBTASKS_SOURCE,
		/showSubtaskProgress \? \(\s*<Progress[\s\S]*aria-label=\{`\$\{completedCount\} of \$\{totalCount\} \$\{label\.toLowerCase\(\)\} done`\}[\s\S]*value=\{completedPercent\}[\s\S]*variant="success"/u,
	);
	assert.match(SUBTASKS_SOURCE, /usesStrokeChrome && !comfortableIcons \? "size-4" : "size-6"/u);
	assert.match(SUBTASKS_SOURCE, /<ChevronRightIcon label="" size="small" color="currentColor" \/>/u);
	assert.match(SUBTASKS_SOURCE, /<ChevronDownIcon label="" size="small" color="currentColor" \/>/u);
	assert.doesNotMatch(SUBTASKS_SOURCE, /comfortableIcons \? "medium"/u);
	assert.doesNotMatch(SUBTASKS_SOURCE, /\[&_svg\]:size-4!/u);
	assert.doesNotMatch(SUBTASKS_SOURCE, /\[&_svg\]:size-3/u);
	assert.match(SUMMARY_SOURCE, /comfortableIcons \? undefined : "-mr-1"/u);
	assert.match(SUBTASKS_SOURCE, /icon=\{<TaskIcon label="" color=\{token\("color\.icon\.brand"\)\} size="small" \/>\}/u);
	assert.match(SUBTASKS_SOURCE, /iconSize=\{iconMetrics\.iconTileIconSize\}/u);
	assert.match(SUBTASKS_SOURCE, /size=\{iconMetrics\.iconTileSize\}/u);
	assert.doesNotMatch(SUBTASKS_SOURCE, /<TagGroup className="min-w-0 gap-1 overflow-hidden">/u);
	assert.match(SUBTASKS_SOURCE, /<div className="flex shrink-0 items-center gap-1">\s*<Tag>\{subtask\.status \?\? "To Do"\}<\/Tag>/u);
	assert.match(SUBTASKS_SOURCE, /<div className="flex min-w-0 items-center">/u);
	assert.match(SUBTASKS_SOURCE, /<div className="flex shrink-0 items-center gap-1\.5">/u);
	assert.doesNotMatch(SUBTASKS_SOURCE, /comfortableIcons \? "gap-1" : "gap-0"/u);
	assert.match(SUBTASKS_SOURCE, /data-slot="jira-issue-assignee-slot"/u);
	assert.doesNotMatch(SUBTASKS_SOURCE.slice(0, SUBTASKS_SOURCE.indexOf("export function JiraIssueSeparator")), /comfortableIcons \? undefined : "-mr-1"/u);
	assert.match(SUBTASKS_SOURCE, /<AvatarUnassigned kind=\{subtask\.assigneeUnassignedKind\} size=\{iconMetrics\.assigneeSize\} \/>/u);
	assert.match(SUBTASKS_SOURCE, /<Avatar label=\{subtask\.assigneeAvatarLabel \?\? subtask\.issueKey\} size=\{iconMetrics\.assigneeSize\}>/u);
	assert.doesNotMatch(SUBTASKS_SOURCE.slice(0, SUBTASKS_SOURCE.indexOf("export function JiraIssueSeparator")), /size="sm"/u);
	assert.match(SUBTASKS_SOURCE, /const nestedSubtaskChrome = resolveJiraIssueSubtaskChrome\(chrome, subtaskChrome, compact\);/u);
	assert.match(SUBTASKS_SOURCE, /const chromeStyles = resolveJiraIssueChrome\(nestedSubtaskChrome\);/u);
	assert.match(PAGE_SOURCE, /variant === "agent-activity-states-experimental-v2"/);
	assert.match(PAGE_SOURCE, /<JiraIssueExperimentalAgentActivityStatesPage iconScale="comfortable" \/>/);
	assert.match(PAGE_SOURCE, /generativeActionPresentation=\{iconScale === "comfortable" \? "more-actions" : undefined\}/);
	assert.match(PAGE_SOURCE, /showSessionTransferStates=\{iconScale !== "comfortable"\}/);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const showUnlinkControl = iconScale !== "comfortable"\s*\n\s*&& Boolean\(sessionDrag\?\.onUnlink\)\s*\n\s*&& !isDraggedOut;/u,
	);
	assert.match(PAGE_SOURCE, /iconScale=\{iconScale\}[\s\S]*subtaskChrome=\{subtaskChrome\}/);
	assert.match(DEMO_SOURCE, /export function JiraIssueDemoAgentActivityStatesExperimentalV2\(\)/);
	assert.match(DEMO_SOURCE, /<JiraIssuePage variant="agent-activity-states-experimental-v2" \/>/);
	assert.match(DETAILS_SOURCE, /id: "agent-activity-states-experimental-v2"[\s\S]*title: "Agent activity states \(experimental v2\)"[\s\S]*demoSlug: "jira-issue-demo-agent-activity-states-experimental-v2"/);
	assert.match(VARIANT_REGISTRY_SOURCE, /"jira-issue-demo-agent-activity-states-experimental-v2": dynamic\(/);
	assert.match(VARIANT_REGISTRY_SOURCE, /default: mod\.JiraIssueDemoAgentActivityStatesExperimentalV2/);
	assert.match(PAGE_SOURCE, /if \(variant === "agent-activity-states-experimental"\) \{\s*return <JiraIssueExperimentalAgentActivityStatesPage \/>;/);
	assert.match(SOURCE, /toJiraIssueAgentActivityFromCompletedRun/u);
	assert.match(SOURCE, /resolveComfortableCompletedRunViewChat/u);
	assert.match(SOURCE, /onViewChat=\{handleAgentActivityViewChat\}/u);
	assert.match(SOURCE, /iconScale === "comfortable" && resolvedAgentActivityMode === "completed"/u);
	assert.match(SOURCE, /const hasAgentDoneNotification = iconScale !== "comfortable" && hasCompletedAgentChin/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const isCompletedRow = activities\.length > 0\s*&& activities\.every\(\(activity\) => activity\.state === "completed"\)/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /if \(!showAssignmentFlyout\) \{\s*return rowHandle;/u);
	assert.doesNotMatch(SOURCE, /iconScale === "comfortable"[\s\S]*<JiraIssueAgentDoneMerged/u);
	assert.match(SOURCE, /from "@\/components\/blocks\/jira-issue\/completed-agent-runs-model"/u);
	assert.doesNotMatch(COMPLETED_RUNS_SOURCE, /export function toJiraIssueAgentActivityFromCompletedRun/u);
	assert.match(COMPLETED_RUNS_MODEL_SOURCE, /export function toJiraIssueAgentActivityFromCompletedRun/u);
	assert.match(COMPLETED_RUNS_MODEL_SOURCE, /label: run\.state === "failed" \? "Failed" : "Finished"/u);
	assert.match(COMPLETED_RUNS_MODEL_SOURCE, /export function resolveComfortableCompletedRunViewChat/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /Open \$\{activities\[0\]\?\.name \?\? "agent"\} in Rovo chat: \$\{rowLabel\}/u);
});

test("Jira issue renders expandable subtasks with nested subtask cards", () => {
	assert.match(SOURCE, /subtasks\?: readonly JiraIssueSubtask\[\];/);
	assert.match(SUBTASKS_SOURCE, /aria-expanded=\{expanded\}/);
	assert.match(SUBTASKS_SOURCE, /const subtasksToggleLabel = `\$\{expanded \? "Hide" : "Show"\} \$\{label\.toLowerCase\(\)\}`;/);
	assert.match(SUBTASKS_BLOCK, /<Tooltip>/);
	assert.match(SUBTASKS_BLOCK, /aria-label=\{subtasksToggleLabel\}/);
	assert.match(SUBTASKS_BLOCK, /<TooltipContent>\{subtasksToggleLabel\}<\/TooltipContent>/);
	assert.match(SUBTASKS_SOURCE, /export function JiraIssueSeparator\(\{[\s\S]*inset = 0,[\s\S]*usesStrokeChrome,[\s\S]*\}: Readonly<\{ inset\?: number; usesStrokeChrome: boolean \}>\) \{[\s\S]*marginLeft: `\$\{inset - 1\}px`,[\s\S]*marginRight: `\$\{inset - 1\}px`,[\s\S]*width: `calc\(100% \+ \$\{2 - inset \* 2\}px\)`,/);
	assert.match(
		SUBTASKS_SOURCE,
		/group-\[&:hover:not\(:has\(\[data-slot=jira-issue-subtask-card\]:hover\)\)\]\/jira-issue:bg-border group-\[&:hover:not\(:has\(\[data-slot=jira-issue-subtask-card\]:hover\)\)\]\/jira-issue-card:bg-border/,
	);
	assert.doesNotMatch(SUBTASKS_BLOCK, /<JiraIssueSeparator \/>/);
	assert.match(SOURCE, /<JiraIssueSeparator[\s\S]*inset=\{usesAgentActivityShell \? agentActivitySurfaceInset : 0\}[\s\S]*usesStrokeChrome=\{usesCompactVisual\}[\s\S]*\/>[\s\S]*<div className=\{issueRowsClassName\}>/);
	assert.match(SUBTASKS_BLOCK, /const headerRowClassName = cn\(\s*"flex h-8 w-full items-center justify-between px-3 py-2",\s*usesStrokeChrome && "-mx-px w-\[calc\(100%\+2px\)\]",\s*\);/);
	assert.match(SUBTASKS_BLOCK, /<ChevronRightIcon label="" size="small" color="currentColor" \/>/);
	assert.match(SUBTASKS_BLOCK, /"flex items-center gap-2 text-sm font-medium leading-5 text-text-subtle"/);
	assert.match(SUBTASKS_BLOCK, /usesStrokeChrome \? \(\s*<IconTile[\s\S]*icon=\{<SubtasksIcon label="" size="small" spacing="none" color="currentColor" \/>\}[\s\S]*iconSize=\{iconMetrics\.iconTileIconSize\}[\s\S]*size=\{iconMetrics\.iconTileSize\}[\s\S]*variant="transparent"/);
	assert.match(SUBTASKS_BLOCK, /className="grid size-4 shrink-0 place-items-center text-icon-subtle"/);
	assert.match(SUBTASKS_BLOCK, /<SubtasksIcon[\s\S]*label=""[\s\S]*size="medium"[\s\S]*spacing="none"[\s\S]*color="currentColor"/);
	assert.match(SUBTASKS_BLOCK, /usesStrokeChrome && !comfortableIcons \? "size-4" : "size-6"/);
	assert.match(SUBTASKS_BLOCK, /<ChevronRightIcon label="" size="small" color="currentColor" \/>/);
	assert.match(SUBTASKS_BLOCK, /<ChevronDownIcon label="" size="small" color="currentColor" \/>/);
	assert.doesNotMatch(SUBTASKS_BLOCK, /\[&_svg\]:size-4!/);
	assert.doesNotMatch(SUBTASKS_BLOCK, /comfortableIcons \? "medium"/);
	assert.doesNotMatch(SUBTASKS_BLOCK, /\[&_svg\]:size-3/);
	assert.doesNotMatch(SUBTASKS_BLOCK, /className="flex h-12 w-full items-center justify-between px-4"/);
	assert.doesNotMatch(SUBTASKS_BLOCK, /inline-flex size-8 items-center/);
	assert.doesNotMatch(SUBTASKS_BLOCK, /hover:bg-bg-neutral-subtle-hovered focus-visible:border-ring[\s\S]*onClick=\{onToggle\}/);
	assert.doesNotMatch(SOURCE, /role="progressbar"/);
	assert.doesNotMatch(SOURCE, /progressPercent/);
	assert.match(SUBTASKS_SOURCE, /<JiraIssueSubtaskCard[\s\S]*chromeStyles=\{chromeStyles\}[\s\S]*iconScale=\{iconScale\}[\s\S]*key=\{subtask\.issueKey\}[\s\S]*subtask=\{subtask\}[\s\S]*usesStrokeChrome=\{nestedSubtaskChrome === "stroke"\}/);
	assert.match(SUBTASKS_SOURCE, /className=\{cn\(\s*"border bg-surface p-3",\s*usesStrokeChrome \? undefined : "hover:bg-surface-hovered",\s*chromeStyles\.restClassName,\s*chromeStyles\.hoverClassName,\s*\)\}/);
	assert.match(SUBTASKS_SOURCE, /<div className="flex min-w-0 flex-col gap-2">/);
	assert.match(SUBTASKS_SOURCE, /<p className="text-sm leading-5 text-text">\{subtask\.summary\}<\/p>/);
	assert.match(SUBTASKS_SOURCE, /<Tag>\{subtask\.status \?\? "To Do"\}<\/Tag>/);
	assert.doesNotMatch(SUBTASKS_SOURCE.slice(0, SUBTASKS_SOURCE.indexOf("export function JiraIssueSeparator")), /Lozenge/);
	assert.match(SUBTASKS_SOURCE, /boxShadow: chromeStyles\.boxShadow/);
	assert.doesNotMatch(
		SUBTASKS_SOURCE.slice(0, SUBTASKS_SOURCE.indexOf("export function JiraIssueSeparator")),
		/group-hover\/jira-issue/,
	);
	assert.doesNotMatch(SUBTASKS_SOURCE, /className="border border-transparent bg-surface px-4 py-3"/);
	assert.doesNotMatch(SUBTASKS_SOURCE, /rounded-lg border border-border bg-surface px-3 py-3 shadow-sm/);
});
