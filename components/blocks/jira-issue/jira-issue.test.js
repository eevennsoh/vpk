const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const AGENT_ACTIVITY_SOURCE = [
	readFileSync(join(__dirname, "agent-activity.tsx"), "utf8"),
	readFileSync(join(__dirname, "agent-activity-row-presentation.tsx"), "utf8"),
].join("\n");
const STARTUP_SOURCE = readFileSync(join(__dirname, "agent-activity-startup.tsx"), "utf8");
const SUMMARY_SOURCE = readFileSync(join(__dirname, "summary.tsx"), "utf8");
const PULL_REQUEST_CLUSTER_SOURCE = readFileSync(join(__dirname, "pull-request-cluster.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "types.ts"), "utf8");
const MODEL_SOURCE = readFileSync(join(__dirname, "agent-activity-model.ts"), "utf8");
const COMPLETED_RUNS_SOURCE = readFileSync(join(__dirname, "completed-agent-runs.tsx"), "utf8");
const CHANGED_FILES_SOURCE = readFileSync(join(__dirname, "../jira-activity/jira-activity-changed-files.tsx"), "utf8");
const COUNT_BADGE_SOURCE = readFileSync(join(__dirname, "count-badge.tsx"), "utf8");
const LIB_SOURCE = readFileSync(join(__dirname, "lib.ts"), "utf8");
const SUBTASKS_SOURCE = readFileSync(join(__dirname, "subtasks.tsx"), "utf8");
const GENERATIVE_SOURCE = readFileSync(join(__dirname, "generative-action-menu.tsx"), "utf8");
const MORE_MENU_SOURCE = readFileSync(join(__dirname, "more-menu.tsx"), "utf8");
const UNCAPTURED_WORK_SOURCE = readFileSync(join(__dirname, "uncaptured-work.tsx"), "utf8");
const UNCAPTURED_WORK_CHIN_SOURCE = readFileSync(join(__dirname, "uncaptured-work-chin.tsx"), "utf8");
const ROVO_SPARKLE_SOURCE = readFileSync(join(__dirname, "../../ui-custom/rovo-sparkle/rovo-sparkle.tsx"), "utf8");
const ROVO_SPARKLE_BUTTON_SOURCE = readFileSync(join(__dirname, "../../ui-custom/rovo-sparkle/button.tsx"), "utf8");
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const DEMO_SOURCE = readFileSync(join(__dirname, "../../website/demos/blocks/jira-issue-demo.tsx"), "utf8");
const DETAILS_SOURCE = readFileSync(join(__dirname, "../../../app/data/details/blocks/jira-issue.ts"), "utf8");
const VARIANT_REGISTRY_SOURCE = readFileSync(join(__dirname, "../../website/registry/blocks-variants.ts"), "utf8");
const RICH_TEXT_EDITOR_CSS_SOURCE = readFileSync(join(__dirname, "../../ui-custom/rich-text-editor/rich-text-editor.css"), "utf8");
const ROOT_CLASS_BLOCK = SOURCE.slice(
	SOURCE.indexOf("const rootClassName = cn("),
	SOURCE.indexOf("function handleSubtasksToggle"),
);
const SUBTASKS_BLOCK = SUBTASKS_SOURCE.slice(SUBTASKS_SOURCE.indexOf("export function JiraIssueSubtasks"));
const SUMMARY_BLOCK = SUMMARY_SOURCE.slice(SUMMARY_SOURCE.indexOf("export function JiraIssueSummary"));
const RICH_ISSUE_CONTENT_BLOCK = SOURCE.slice(
	SOURCE.indexOf("const richIssueContent ="),
	SOURCE.indexOf("const generativeActionMenu ="),
);

test("Jira issue focus border stays inside the card and uses the focused border token", () => {
	assert.match(SOURCE, /"group\/jira-issue relative w-full min-w-0 border outline-none focus-visible:border-ring"/);
	assert.doesNotMatch(SOURCE, /border: "none"/);
});

test("Jira issue default width can be overridden by a kanban-column demo width class", () => {
	assert.doesNotMatch(SOURCE, /width: "100%"/);
	assert.match(SOURCE, /className,\n\t\)/);
});

test("Jira issue exposes selected and dragging states on the root button", () => {
	assert.match(SOURCE, /active\?: boolean;/);
	assert.match(SOURCE, /data-active=\{active \|\| undefined\}/);
	assert.match(SOURCE, /aria-pressed=\{ariaPressed \?\? selected\}/);
	assert.match(SOURCE, /data-selected=\{selected \|\| undefined\}/);
	assert.match(SOURCE, /data-dragging=\{dragging \|\| undefined\}/);
});

test("Jira issue hover keeps the default cursor instead of a drag-handle cursor", () => {
	assert.match(SOURCE, /cursor: dragging \? "grabbing" : "default"/);
	assert.doesNotMatch(SOURCE, /draggable \? "grab"/);
	assert.doesNotMatch(SOURCE, /cursor-grab/);
	assert.doesNotMatch(SOURCE, /cursor:\s*"move"/);
});

test("Jira issue stroke chrome drops the raised shadow and uses the disabled border token", () => {
	assert.match(TYPES_SOURCE, /export type JiraIssueChrome = "raised" \| "stroke";/u);
	assert.match(SOURCE, /chrome\?: JiraIssueChrome;/u);
	assert.match(SOURCE, /compact\?: boolean;/u);
	assert.match(SOURCE, /chrome = "raised",/u);
	assert.match(SOURCE, /compact = false,/u);
	assert.match(SOURCE, /import \{ resolveJiraIssueChrome \} from "\.\/chrome";/u);
	assert.match(SOURCE, /const chromeStyles = resolveJiraIssueChrome\(chrome\);/u);
	assert.match(SOURCE, /const usesStrokeChrome = chrome === "stroke";/u);
	assert.match(SOURCE, /const usesCompactVisual = compact \|\| usesStrokeChrome;/u);
	assert.match(SOURCE, /boxShadow: chromeStyles\.boxShadow,/u);
	assert.doesNotMatch(SOURCE, /export \{[\s\S]*resolveJiraIssueChrome/u);
	assert.match(SUMMARY_SOURCE, /usesStrokeChrome: boolean;/u);
	assert.match(SOURCE, /usesStrokeChrome=\{usesCompactVisual\}/u);
	assert.match(
		SUMMARY_SOURCE,
		/className=\{cn\("min-w-0 flex-1", usesStrokeChrome \? "line-clamp-2 text-sm leading-5" : "text-sm"\)\}/u,
	);
	assert.match(SUMMARY_SOURCE, /<div className="flex min-w-0 flex-col gap-2">/u);
	assert.match(SUMMARY_SOURCE, /<TagGroup className="min-w-0 gap-1 overflow-hidden">/u);
});

test("Jira issue label tags rest as default gray and reveal color on card hover", () => {
	assert.match(
		SUMMARY_SOURCE,
		/const ISSUE_TAG_IDLE_BORDER_CLASS =\s*\n\t"duration-fast ease-out-practical motion-reduce:transition-none \[@media\(hover:hover\)\]:group-\[:not\(:hover\):not\(:focus-within\)\]\/jira-issue:border-border-accent-gray-subtle";/u,
	);
	assert.match(
		SUMMARY_SOURCE,
		/<Tag\s+key=\{`\$\{tag\.text\}-\$\{index\}`\}\s+className=\{ISSUE_TAG_IDLE_BORDER_CLASS\}\s+color=\{tag\.color\}/u,
	);
});

test("Jira issue compact visual keeps stroke internals when chrome is raised", () => {
	assert.match(SOURCE, /compact\?: boolean;/u);
	assert.match(SOURCE, /const usesCompactVisual = compact \|\| usesStrokeChrome;/u);
	assert.match(SOURCE, /<div className=\{usesCompactVisual \? "px-3 pt-3 pb-2" : "p-3"\}>/u);
	assert.match(SOURCE, /usesStrokeChrome=\{usesCompactVisual\}/u);
	assert.match(SOURCE, /compact=\{usesCompactVisual\}/u);
	assert.match(SOURCE, /const agentActivityRestBorderClassName = !hasActiveAgentActivityShell\s*\n\t\t\? agentSurfaceChromeClassName\s*\n\t\t: usesStrokeChrome\s*\n\t\t\t\? cn\("border-surface", chromeStyles\.agentSurfaceHoverClassName\)\s*\n\t\t\t: agentSurfaceChromeClassName;/u);
	assert.match(PAGE_SOURCE, /compact[\s\S]*onChromeChange=\{setChrome\}/);
	assert.match(PAGE_SOURCE, /compact=\{compact\}/);
});

test("Jira issue stroke chrome keeps its rest border everywhere except the agent shell's white surface", () => {
	assert.match(SOURCE, /const issueChromeClassName = cn\(chromeStyles\.restClassName, chromeStyles\.hoverClassName\);/u);
	assert.match(SOURCE, /const agentSurfaceChromeClassName = cn\(\s*\n\t\tchromeStyles\.restClassName,\s*\n\t\tchromeStyles\.agentSurfaceHoverClassName,\s*\n\t\);/u);
	assert.match(SOURCE, /usesAgentActivityShell\s*\n\t\t\t\? "group\/jira-issue-card border-transparent bg-transparent"/u);
	assert.doesNotMatch(
		SOURCE,
		/hasActiveAgentActivityShell\s*\n\t\t\? "border-border-disabled/u,
	);
	assert.match(
		ROOT_CLASS_BLOCK,
		/const agentActivitySurfaceClassName = cn\([\s\S]*"pointer-events-none absolute border"[\s\S]*selected[\s\S]*\? "border-border-selected bg-bg-selected"[\s\S]*: active[\s\S]*\? cn\([\s\S]*chromeStyles\.restClassName[\s\S]*chromeStyles\.agentSurfaceHoverClassName[\s\S]*"bg-bg-selected"[\s\S]*: cn\(agentActivityRestBorderClassName, "bg-surface"\)/u,
	);
	assert.match(SOURCE, /const agentActivityRestBorderClassName = !hasActiveAgentActivityShell\s*\n\t\t\? agentSurfaceChromeClassName\s*\n\t\t: usesStrokeChrome\s*\n\t\t\t\? cn\("border-surface", chromeStyles\.agentSurfaceHoverClassName\)\s*\n\t\t\t: agentSurfaceChromeClassName;/u);
});

test("Jira issue exposes the experimental stroke visual as a catalog example", () => {
	assert.match(PAGE_SOURCE, /variant\?: "default" \| "experimental" \|/u);
	assert.match(PAGE_SOURCE, /const isExperimentalVariant = variant === "experimental";/u);
	assert.match(PAGE_SOURCE, /chrome=\{isExperimentalVariant \? "stroke" : undefined\}/u);
	assert.match(DEMO_SOURCE, /export function JiraIssueDemoExperimental\(\)/u);
	assert.match(DEMO_SOURCE, /<JiraIssuePage variant="experimental" \/>/u);
	assert.match(DETAILS_SOURCE, /title: "Experimental"[\s\S]*demoSlug: "jira-issue-demo-experimental"/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"jira-issue-demo-experimental": dynamic\(/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /default: mod\.JiraIssueDemoExperimental/u);
});

test("Jira issue owns an uncaptured-work variant with a suggested-link chin", () => {
	assert.match(TYPES_SOURCE, /export type JiraIssueVariant = "default" \| "uncaptured-work";/u);
	assert.match(SOURCE, /export interface JiraIssueUncapturedWorkProps/u);
	assert.match(SOURCE, /variant: "uncaptured-work";/u);
	assert.match(SOURCE, /participants: readonly JiraIssueParticipant\[\];/u);
	assert.match(SOURCE, /sourceLink: SmartLinkItem;/u);
	assert.match(SOURCE, /suggestedWorkItemKey\?: string;/u);
	assert.match(SOURCE, /onCreateWorkItem\?: \(\) => void;/u);
	assert.match(SOURCE, /onLinkWorkItem\?: \(workItemKey\?: string\) => void;/u);
	assert.match(SOURCE, /suggestedWorkItemKeys\?: readonly string\[\];/u);
	assert.match(SOURCE, /onSubtasks\?: \(\) => void;/u);
	assert.match(SOURCE, /export type JiraIssueProps = JiraIssueDefaultProps \| JiraIssueUncapturedWorkProps;/u);
	assert.match(SOURCE, /if \(props\.variant === "uncaptured-work"\) \{[\s\S]*<JiraIssueUncapturedWork \{\.\.\.props\} \/>/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /data-variant=\{variant\}/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /flex w-full flex-col overflow-hidden rounded-lg border border-dashed border-border-disabled bg-surface text-left/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /className="flex flex-col gap-2 bg-surface-sunken p-3"/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /<p className="line-clamp-2 text-sm leading-5">\{summary\}<\/p>/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /line-clamp-2 min-h-10/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /<p className="truncate[^"]*">\{summary\}<\/p>/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /import \{ SmartLink, type SmartLinkItem \} from "@\/components\/blocks\/smart-link";/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /renderVisual\(sourceLink\.provider\.logo, "footer"\)/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /renderVisual\(sourceLink\.icon/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /\{sourceLink\.provider\.name\}/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /flex h-5 min-w-0 items-center gap-1\.5/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /inline-flex size-4 shrink-0 items-center justify-center/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /\[&>span:first-child>\*\]:text-icon-accent-lime/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /\[&>span:first-child>\*\]:text-icon-accent-purple/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /\[&>span:first-child>\*\]:text-icon-danger/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /\[&>span:first-child>\*\]:text-icon-subtle/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /\[&>span:first-child\]:hidden/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /self-center/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /<span aria-hidden="true">·<\/span>/u);
	assert.match(
		UNCAPTURED_WORK_SOURCE,
		/<SmartLink[\s\S]*className=\{cn\(SOURCE_LINK_CLASS_NAME, uncapturedSourceIconClassName\(sourceLink\)\)\}[\s\S]*item=\{sourceLink\}/u,
	);
	assert.match(UNCAPTURED_WORK_SOURCE, /hover:text-text-subtle hover:underline/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /hover:text-link/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /sourceFacts/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /onResumeAgentSession/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /\{source\} · \{detail\}/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /pt-0\.5/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /className="flex items-center justify-between gap-2"/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /size="xs"/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /<UncapturedWorkChin/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /data-slot="uncaptured-work-chin"/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /border-t border-dashed border-border-disabled bg-surface p-2"/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /size="compact"/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /size="icon-compact"/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /uncapturedWorkLinkLabel/u);
	assert.match(LIB_SOURCE, /Link to \$\{suggestedWorkItemKey\}/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /aria-disabled=\{linkUnavailable\}/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /disabled=\{createUnavailable\}/u);
	assert.doesNotMatch(UNCAPTURED_WORK_CHIN_SOURCE, /ButtonGroup|DropdownMenu/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /import WorkItemAddIcon from "@atlaskit\/icon-lab\/core\/work-item-add";/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /import SubtasksIcon from "@atlaskit\/icon\/core\/subtasks";/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /label="Create work item"/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /label="Subtasks"/u);
	assert.match(
		UNCAPTURED_WORK_CHIN_SOURCE,
		/hover:bg-bg-neutral-subtle-hovered has-\[:focus-visible\]:bg-bg-neutral-subtle-hovered motion-reduce:transition-none/u,
	);
	assert.doesNotMatch(UNCAPTURED_WORK_CHIN_SOURCE, /group-hover\/uncaptured-chin/u);
	assert.match(LIB_SOURCE, /export function uncapturedWorkSuggestionKeys\(/u);
	assert.doesNotMatch(UNCAPTURED_WORK_CHIN_SOURCE, /export (?!function UncapturedWorkChin)/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /suggestionKeys\.map\(\(key\) => \(/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /<ChinRow actions=\{trailingActions\} key=/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /onLinkWorkItem\?\.\(key\)/u);
	assert.doesNotMatch(UNCAPTURED_WORK_CHIN_SOURCE, /onCopyResume|onDismiss/u);
	assert.doesNotMatch(UNCAPTURED_WORK_CHIN_SOURCE, /CopyIcon|DeleteIcon|Resume|Dismiss/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /onCopyResume|onDismiss/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, /aria-label=\{`Resume agent session for \$\{summary\}`\}/u);
	assert.doesNotMatch(UNCAPTURED_WORK_SOURCE, />\s*Resume\s*<\/Button>/u);
	assert.match(UNCAPTURED_WORK_CHIN_SOURCE, /Captured/u);
	assert.match(UNCAPTURED_WORK_SOURCE, /aria-live="polite"/u);
	assert.match(PAGE_SOURCE, /variant\?: "default" \| "experimental" \| "uncaptured-work" \|/u);
	assert.match(PAGE_SOURCE, /id="uncaptured-work"/u);
	assert.match(PAGE_SOURCE, /title: "PR #1840"/u);
	assert.match(PAGE_SOURCE, /status: "Open"/u);
	assert.match(PAGE_SOURCE, /title: "PR #1862"/u);
	assert.match(PAGE_SOURCE, /status: "Merged"/u);
	assert.match(PAGE_SOURCE, /title: "PR #1890"/u);
	assert.match(PAGE_SOURCE, /status: "Failed"/u);
	assert.match(PAGE_SOURCE, /title: "spike\/delete-legacy-adapter"/u);
	assert.match(PAGE_SOURCE, /title: "b4c19e8"/u);
	assert.match(PAGE_SOURCE, /provider: \{ name: "GitHub", logo: JIRA_ISSUE_UNCAPTURED_GITHUB_VISUAL \}/u);
	assert.match(PAGE_SOURCE, /icon: GITHUB_BRANCH_SMART_LINK_ICON/u);
	assert.match(PAGE_SOURCE, /icon: GITHUB_COMMIT_SMART_LINK_ICON/u);
	assert.match(PAGE_SOURCE, /toPullRequestSmartLink/u);
	assert.match(PAGE_SOURCE, /onCreateWorkItem=\{\(\) => \{/u);
	assert.match(PAGE_SOURCE, /suggestedWorkItemKey=\{example\.suggestedWorkItemKey\}/u);
	assert.match(PAGE_SOURCE, /suggestedWorkItemKey: "PAY-101"/u);
	assert.doesNotMatch(PAGE_SOURCE, /sourceFacts/u);
	assert.doesNotMatch(PAGE_SOURCE, /provider: \{ name: "Claude"/u);
	assert.match(DEMO_SOURCE, /export function JiraIssueDemoUncapturedWork\(\)/u);
	assert.match(DETAILS_SOURCE, /title: "Uncaptured work"[\s\S]*demoSlug: "jira-issue-demo-uncaptured-work"/u);
	assert.match(DETAILS_SOURCE, /name: "onLinkWorkItem"/u);
	assert.match(DETAILS_SOURCE, /name: "suggestedWorkItemKey"/u);
	assert.match(DETAILS_SOURCE, /name: "onSubtasks"/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /default: mod\.JiraIssueDemoUncapturedWork/u);
});

test("Jira issue distinguishes an active card background from bulk selection", () => {
	assert.match(ROOT_CLASS_BLOCK, /selected[\s\S]*\? "border-border-selected bg-bg-selected"[\s\S]*: active[\s\S]*\? cn\([\s\S]*chromeStyles\.restClassName[\s\S]*"bg-bg-selected"[\s\S]*: cn\(issueChromeClassName, "bg-surface"\)/u);
	assert.match(ROOT_CLASS_BLOCK, /const agentActivitySurfaceClassName = cn\([\s\S]*selected[\s\S]*\? "border-border-selected bg-bg-selected"[\s\S]*: active[\s\S]*\? cn\([\s\S]*chromeStyles\.restClassName[\s\S]*"bg-bg-selected"/u);
	assert.doesNotMatch(SOURCE, /aria-pressed=\{ariaPressed \?\? active\}/u);
});

test("Jira issue reserves a stable title action slot and opens the built-in actions menu", () => {
	assert.match(SOURCE, /import \{ JiraIssueMoreMenu, type JiraIssueMoreAction \} from "@\/components\/blocks\/jira-issue\/more-menu";/u);
	assert.match(SOURCE, /showMoreAction\?: boolean;/u);
	assert.match(SOURCE, /onMoreActionSelect\?: \(action: JiraIssueMoreAction\) => void;/u);
	assert.match(SUMMARY_SOURCE, /<div className="size-6 shrink-0" data-slot="jira-issue-more-action" \/>/u);
	assert.match(SOURCE, /<JiraIssueMoreMenu[\s\S]*issueKey=\{issueKey\}[\s\S]*onActionSelect=\{onMoreActionSelect\}[\s\S]*onOpenChange=\{setMoreActionMenuOpen\}/u);
	assert.match(MORE_MENU_SOURCE, /import ShowMoreHorizontalIcon from "@atlaskit\/icon\/core\/show-more-horizontal";/u);
	assert.match(MORE_MENU_SOURCE, /<DropdownMenu open=\{open\} onOpenChange=\{handleOpenChange\}>/u);
	assert.match(MORE_MENU_SOURCE, /aria-label=\{`More actions for \$\{issueKey\}`\}/u);
	assert.match(
		MORE_MENU_SOURCE,
		/group-\[&:hover:not\(:has\(\[data-slot=jira-issue-subtask-card\]:hover\)\)\]\/jira-issue:pointer-events-auto group-\[&:hover:not\(:has\(\[data-slot=jira-issue-subtask-card\]:hover\)\)\]\/jira-issue:opacity-100/u,
	);
	assert.match(MORE_MENU_SOURCE, /group-has-\[:focus-visible\]\/jira-issue:pointer-events-auto group-has-\[:focus-visible\]\/jira-issue:opacity-100/u);
	assert.match(MORE_MENU_SOURCE, /data-popup-open:pointer-events-auto data-popup-open:opacity-100/u);
	assert.match(MORE_MENU_SOURCE, /motion-reduce:transition-none/u);
	assert.match(MORE_MENU_SOURCE, /<DropdownMenuContent align="start" className="max-h-none w-\[280px\]" side="right" sideOffset=\{8\}>/u);
	for (const label of ["Move work item", "Change status", "Copy link", "Copy key", "Add agent", "Link Confluence item", "Link work item", "Change parent", "Select cover", "Edit labels", "Add flag"]) {
		assert.match(MORE_MENU_SOURCE, new RegExp(`>\\s*${label}\\s*</DropdownMenuItem>`));
	}
	assert.doesNotMatch(MORE_MENU_SOURCE, /Lozenge|>New</u);
});

test("Jira issue exposes separate Work Item agent and skill pickers in the More actions menu", () => {
	assert.match(SOURCE, /export type JiraIssueGenerativeActionPresentation = "sparkle" \| "more-actions";/u);
	assert.match(SOURCE, /generativeActionPresentation\?: JiraIssueGenerativeActionPresentation;/u);
	assert.match(SOURCE, /generativeActionPresentation = "sparkle",/u);
	assert.match(SOURCE, /const generativeActionMenu = generativeAction && \(generativeActionPresentation === "sparkle" \|\| !showMoreAction\) \?/u);
	assert.match(SOURCE, /<JiraIssueMoreMenu[\s\S]*generativeAction=\{generativeActionPresentation === "more-actions" \? generativeAction : undefined\}[\s\S]*generativeActionIssue=\{\{ issueKey, summary \}\}/u);
	assert.match(MORE_MENU_SOURCE, /<JiraIssueAgentAndSkillSubmenus[\s\S]*action=\{generativeAction\}[\s\S]*issue=\{generativeActionIssue\}/u);
	assert.match(MORE_MENU_SOURCE, /<JiraIssueAgentAndSkillSubmenus[\s\S]*action=\{generativeAction\}[\s\S]*issue=\{generativeActionIssue\}[\s\S]*onRequestClose=\{\(\) => handleOpenChange\(false\)\}[\s\S]*<DropdownMenuSeparator \/>[\s\S]*Move work item/u);
	assert.match(MORE_MENU_SOURCE, /generativeAction \? null : <DropdownMenuItem[\s\S]*Add agent/u);
	assert.match(GENERATIVE_SOURCE, /export function JiraIssueAgentAndSkillSubmenus/u);
	assert.match(GENERATIVE_SOURCE, /<DropdownMenuSubTrigger>Assign agents<\/DropdownMenuSubTrigger>/u);
	assert.match(GENERATIVE_SOURCE, /<DropdownMenuSubTrigger>Use skills<\/DropdownMenuSubTrigger>/u);
	assert.doesNotMatch(GENERATIVE_SOURCE, /<DropdownMenuSubTrigger>Assign agent and use skill<\/DropdownMenuSubTrigger>/u);
	assert.match(GENERATIVE_SOURCE, /<AgentSelector[\s\S]*agents=\{agents\}[\s\S]*pinnedItemsLabel=\{WORK_ITEM_PINNED_ITEMS_LABEL\}[\s\S]*selectionMode="single"/u);
	assert.match(GENERATIVE_SOURCE, /<SkillSelector[\s\S]*pinnedItemsLabel=\{WORK_ITEM_PINNED_ITEMS_LABEL\}[\s\S]*selectionMode="single"[\s\S]*skills=\{skills\}/u);
	assert.match(GENERATIVE_SOURCE, /<AgentSelector[\s\S]*searchVariant="palette"[\s\S]*selectionMode="single"/u);
	assert.match(GENERATIVE_SOURCE, /<SkillSelector[\s\S]*searchVariant="palette"[\s\S]*selectionMode="single"/u);
	assert.match(GENERATIVE_SOURCE, /className="max-h-none w-\[360px\] overflow-hidden p-0"/u);
	assert.match(MORE_MENU_SOURCE, /<DropdownMenu open=\{open\} onOpenChange=\{handleOpenChange\}>/u);
	assert.match(MORE_MENU_SOURCE, /onRequestClose=\{\(\) => handleOpenChange\(false\)\}/u);
});

test("Jira issue only renders picker footer actions when real capabilities are supplied", () => {
	for (const capability of ["onBrowseAgents", "onCreateAgent", "onBrowseSkills", "onCreateSkill"]) {
		assert.match(GENERATIVE_SOURCE, new RegExp(`${capability}\\?: \\(\\) => void;`, "u"));
	}
	assert.match(GENERATIVE_SOURCE, /onBrowseAgents=\{browseAgents \? \(\) => closeThenRun\(browseAgents\) : undefined\}/u);
	assert.match(GENERATIVE_SOURCE, /onCreateAgent=\{createAgent \? \(\) => closeThenRun\(createAgent\) : undefined\}/u);
	assert.match(GENERATIVE_SOURCE, /onBrowseSkills=\{browseSkills \? \(\) => closeThenRun\(browseSkills\) : undefined\}/u);
	assert.match(GENERATIVE_SOURCE, /onCreateSkill=\{createSkill \? \(\) => closeThenRun\(createSkill\) : undefined\}/u);
	assert.doesNotMatch(GENERATIVE_SOURCE, /on(?:BrowseAgents|CreateAgent|BrowseSkills|CreateSkill)=\{onRequestClose\}/u);
});

test("Jira issue renders the more-actions button as a sibling of the card button", () => {
	assert.doesNotMatch(SUMMARY_BLOCK, /<JiraIssueMoreMenu/u);
	assert.match(
		SOURCE,
		/const moreActionMenu = showMoreAction \? \([\s\S]*<div className="absolute right-3 top-3 z-20 size-6">[\s\S]*<JiraIssueMoreMenu/u,
	);
	assert.ok(
		RICH_ISSUE_CONTENT_BLOCK.indexOf("{moreActionMenu}") > RICH_ISSUE_CONTENT_BLOCK.indexOf("</button>"),
		"the menu trigger must render after the card button closes",
	);
});

test("Jira issue suppresses the Rovo sparkle while the more actions menu is open", () => {
	assert.match(SOURCE, /const \[moreActionMenuOpen, setMoreActionMenuOpen\] = useState\(false\);/u);
	assert.match(SOURCE, /const generativeActionRevealActive = !agentActivityHoverOpen[\s\S]*&& !moreActionMenuOpen[\s\S]*&& !generativeActionRevealSuppressed/u);
	assert.match(SOURCE, /onOpenChange=\{setMoreActionMenuOpen\}/u);
});

test("Jira issue exposes agent activity state props", () => {
	assert.match(AGENT_ACTIVITY_SOURCE, /export type JiraIssueAgentActivityMode = "none" \| "working" \| "awaiting-input" \| "completed";/);
	assert.match(AGENT_ACTIVITY_SOURCE, /export type JiraIssueAgentActivityState = "working" \| "awaiting-input" \| "completed";/);
	assert.match(AGENT_ACTIVITY_SOURCE, /export interface JiraIssueAgentActivity \{[\s\S]*id: string;[\s\S]*name: string;[\s\S]*avatarSrc\?: string;[\s\S]*label: string;[\s\S]*labels\?: readonly string\[\];[\s\S]*message\?: string;[\s\S]*cycleIntervalJitterMs\?: number;[\s\S]*cycleIntervalMs\?: number;[\s\S]*question\?: QuestionCardQuestion;[\s\S]*state: JiraIssueAgentActivityState;/);
	assert.match(SOURCE, /export type \{[\s\S]*JiraIssueAgentActivity,[\s\S]*JiraIssueAgentActivityMode,[\s\S]*JiraIssueAgentActivityState,[\s\S]*\} from "@\/components\/blocks\/jira-issue\/agent-activity";/);
	assert.match(SOURCE, /agentActivities\?: readonly JiraIssueAgentActivity\[\];/);
	assert.match(SOURCE, /agentDoneRuns\?: readonly JiraIssueCompletedAgentRun\[\];/);
	assert.match(SOURCE, /export type \{[\s\S]*JiraIssueCompletedAgentRun,[\s\S]*JiraIssueCompletedAgentRunState,[\s\S]*\} from "@\/components\/blocks\/jira-issue\/completed-agent-runs";/);
	assert.match(SOURCE, /agentActivityMode\?: JiraIssueAgentActivityMode;/);
	assert.doesNotMatch(SOURCE, /onAgentActivityQuestionSubmit/);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /onQuestionSubmit/);
	assert.match(SOURCE, /onAgentActivityViewChat\?: \(activity: JiraIssueAgentActivity\) => void;/);
	assert.match(SOURCE, /generativeAction\?: JiraIssueGenerativeActionConfig;/);
	assert.match(SOURCE, /export type \{[\s\S]*JiraIssueGenerativeActionConfig,[\s\S]*JiraIssueGenerativeActionRequest,[\s\S]*\} from "@\/components\/blocks\/jira-issue\/generative-action-menu";/);
});

test("Jira issue keeps activity rows composer-free and uses one shared assignment flyout", () => {
	assert.match(AGENT_ACTIVITY_SOURCE, /summarizeJiraIssueAgentActivities\(activities\)/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /import \{ AgentLoading, type AgentLoadingAgent \} from "@\/components\/ui-custom\/agent-loading";/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /<AgentLoading[\s\S]*agents=\{activities\.map\(toAgentLoadingAgent\)\}[\s\S]*announce=\{false\}[\s\S]*className="shrink-0"/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /<AvatarFallback[\s\S]*\{summary\.activityCount\}/u);
	// At rest the row shell is the full-width chin row; dragged out it collapses
	// to the at-mention chip, so the width/shape classes live on the two branches.
	// `relative` is load-bearing: the link-flash overlay is absolutely positioned
	// against this row, and without it the sweep escapes to a further ancestor.
	assert.match(AGENT_ACTIVITY_SOURCE, /"group\/agent-chin-row relative flex min-w-0 items-center"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /"h-8 w-full justify-between rounded-md py-1 hover:bg-bg-neutral-subtle-hovered has-\[\[aria-expanded=true\]\]:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /iconScale === "comfortable" \? "pr-2 pl-1" : "px-2"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /inheritChinSurface \? "bg-transparent" : "bg-bg-neutral"/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /className="flex h-6 w-full[^"]*rounded-b-\[6px\] rounded-t-sm[^"]*"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const isSingleAgent = summary\.activityCount === 1;/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /handleOpenChat|createOpenChatHandler|canOpenChat/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /\{\.\.\.\(sessionDragBind \?\? \{\}\)\}/u);
	// A click on a linked session can open the assignment flyout. Publishing on
	// pointerdown would arm the adjacent unlink well before an actual drag.
	assert.match(AGENT_ACTIVITY_SOURCE, /JIRA_ISSUE_SESSION_DRAG_PUBLISH_THRESHOLD_PX = 2/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /pointerOriginRef\.current = \{ x: event\.clientX, y: event\.clientY \}/u);
	assert.doesNotMatch(
		AGENT_ACTIVITY_SOURCE,
		/onPointerDown: \(event: ReactPointerEvent<HTMLElement>\) => \{[\s\S]*?publishSessionDrag\(true, event\);[\s\S]*?\},\s*\n\s*onPointerMove:/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /if \(moved\) \{\s*\n\s*publishSessionDrag\(true, event\);/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /from "@\/components\/blocks\/agent-assignment"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /openMode="click"/u);
	// The drag wrapper is applied around the row shell. AgentAssignment still
	// clones only the drag handle so the hover card keeps `aria-expanded`.
	assert.match(AGENT_ACTIVITY_SOURCE, /if \(!showAssignmentFlyout\) \{\s*return rowHandle;[\s\S]*<AgentAssignment/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /onAssignedAgentIdsChange=\{assignment\?\.onAssignedAgentIdsChange\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /onContinueExistingSession=\{assignment\?\.onContinueExistingSession\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /onRenameAssignedAgent=\{assignment\?\.onRenameAssignedAgent\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /assignedAgents = assignment\?\.assignedAgents \?\? activities\.map\(toAgentAssignmentAgent\)/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /statusKind: toAssignedAgentStatusKind\(activity\.state\)/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/\.\.\.\(activity\.invokedBy \? \{ invokedBy: activity\.invokedBy \} : \{\}\)/u,
	);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/\.\.\.\(activity\.host !== undefined \? \{ host: activity\.host \} : \{\}\)/u,
	);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/\.\.\.\(activity\.role !== undefined \? \{ role: activity\.role \} : \{\}\)/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /case "awaiting-input":\s*return "needs-input";/u);
	assert.match(SOURCE, /assignment\?: JiraIssueAgentAssignment;/u);
	assert.match(SOURCE, /assignment=\{assignment\}/u);
	assert.doesNotMatch(SOURCE, /onAssignedAgentIdsChange=/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /assignedIdDraft|toActivityFromAssignedAgent/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /trigger=\{rowHandle\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /<JiraIssueAgentDragWrapper/u);
	// Every attached-session chin opens the same assignment flyout, whether the
	// merged group contains one agent or many.
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const isSingleAgentRow = rowGroup\.activities\.length === 1;/u,
	);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const rowSessionDrag = replaceLastRowWithAttach \? undefined : isSingleAgentRow \? sessionDrag : undefined;/u,
	);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /rowSessionFlyout|JiraSessionFlyoutTrigger|JiraSessionFlyoutSurface/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /<AgentList/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /<AgentStates/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /className="w-full shadow-overlay"/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /activities\.map\(\(activity, index\)/u);
});

test("Jira issue split completed rows preserve per-agent presentation", () => {
	assert.match(COMPLETED_RUNS_SOURCE, /onView\?: \(run: JiraIssueCompletedAgentRun\) => void;/u);
	assert.match(
		COMPLETED_RUNS_SOURCE,
		/<JiraSessionFlyoutTrigger[\s\S]*onClick=\{\(\) => onView\?\.\(run\)\}[\s\S]*render=/u,
	);
	assert.match(
		COMPLETED_RUNS_SOURCE,
		/<JiraIssueCompletedRunRow[\s\S]*onView=\{props\.onView\}[\s\S]*run=\{run\}/u,
	);
});

test("Jira issue shows PR metadata with the specified summary-row spacing", () => {
	assert.match(SOURCE, /pullRequestNumber\?: number;[\s\S]*pullRequestPreview\?: JiraIssuePullRequestPreview;[\s\S]*pullRequestStatus\?: JiraIssuePullRequestStatus;/u);
	assert.match(SOURCE, /const inferredPullRequestNumber = agentDoneRuns\.find\(\(run\) => run\.pullRequestNumber\)\?\.pullRequestNumber;/u);
	assert.match(SOURCE, /const resolvedPullRequestNumber = pullRequestNumber \?\? inferredPullRequestNumber;/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /export function JiraIssuePullRequestCluster\(/u);
	assert.match(SUMMARY_SOURCE, /const compactIconClassName = iconMetrics\.compactIconClassName;/u);
	assert.match(SUMMARY_SOURCE, /const pullRequestCluster = pullRequestNumber \? \([\s\S]*<JiraIssuePullRequestCluster[\s\S]*iconScale=\{iconScale\}[\s\S]*pullRequestPreview=\{pullRequestPreview\}[\s\S]*pullRequestTitle=\{pullRequestTitle \?\? summary\}[\s\S]*usesStrokeChrome=\{usesStrokeChrome\}/u);
	// Default chrome keeps the PR cluster beside the issue key; stroke chrome
	// moves it next to the priority/assignee (metadata) cluster instead.
	assert.match(SUMMARY_BLOCK, /\{usesStrokeChrome \? null : pullRequestCluster\}/u);
	assert.match(SUMMARY_BLOCK, /\{usesStrokeChrome && pullRequestCluster \? \([\s\S]*<div className="flex shrink-0 items-center gap-0">[\s\S]*\{pullRequestCluster\}[\s\S]*\{metadataCluster\}/u);
	assert.match(SUMMARY_SOURCE, /usesStrokeChrome \? \(comfortableIcons \? "gap-1" : "gap-0"\) : "gap-1\.5"/u);
	assert.doesNotMatch(SUMMARY_SOURCE, /comfortableIcons && "size-4!"/u);
	assert.match(TYPES_SOURCE, /export type JiraIssuePullRequestStatus = "open" \| "failed" \| "merged";/u);
	assert.match(TYPES_SOURCE, /export interface JiraIssuePullRequestPreview \{[\s\S]*additions: number;[\s\S]*deletions: number;[\s\S]*filesChanged\?: number;[\s\S]*relativeTime\?: string;/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /function getJiraIssuePullRequestPresentation\(/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /case "failed":[\s\S]*MergeFailureIcon[\s\S]*text-icon-danger[\s\S]*case "merged":[\s\S]*MergeSuccessIcon[\s\S]*text-icon-accent-purple[\s\S]*case "open":[\s\S]*PullRequestIcon[\s\S]*text-icon-accent-lime/u);
	assert.doesNotMatch(PULL_REQUEST_CLUSTER_SOURCE, /StatusSuccessIcon/u);
	assert.match(SOURCE, /pullRequestNumber=\{resolvedPullRequestNumber\}/u);
	assert.match(SOURCE, /pullRequestPreview=\{pullRequestPreview\}/u);
	assert.match(SOURCE, /pullRequestStatus=\{pullRequestStatus\}/u);
	assert.match(SOURCE, /pullRequestTitle=\{pullRequestTitle\}/u);
	// Raised chrome still shows the PR number beside the icon. Stroke chrome
	// drops the visible #N label and reveals the flyout Pull Request card.
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /if \(!usesStrokeChrome\) \{[\s\S]*#\{pullRequestNumber\}/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /iconScale = "compact",/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /const iconMetrics = resolveJiraIssueIconMetrics\(iconScale\);/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /className=\{cn\(colorClass, "\[&_svg\]:text-current", iconMetrics\.compactIconClassName\)\}/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /<HoverCard>[\s\S]*render=\{\(\s*<Button[\s\S]*aria-label=\{accessibleName\}[\s\S]*onClick=\{stopNestedActivation\}[\s\S]*onPointerDown=\{stopNestedActivation\}[\s\S]*size="icon-compact"[\s\S]*type="button"[\s\S]*variant="ghost"/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /<Button[\s\S]*size="icon-compact"[\s\S]*variant="ghost"/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /<PullRequest[\s\S]*relativeTime=\{pullRequestPreview\?\.relativeTime\}[\s\S]*variant="flyout"/u);
	assert.doesNotMatch(PULL_REQUEST_CLUSTER_SOURCE, /onActivate=/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /className="w-\[320px\] max-w-\[calc\(100vw-48px\)\] overflow-hidden rounded-xl border-none bg-surface-overlay p-0 text-text shadow-none"/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /boxShadow: token\("elevation\.shadow\.overlay"\)/u);
	assert.match(PULL_REQUEST_CLUSTER_SOURCE, /className="border-none bg-transparent shadow-none"/u);
	assert.match(SUMMARY_BLOCK, /usesStrokeChrome \? "flex min-w-0 items-center" : "flex min-w-0 items-center gap-2"/u);
});

test("Jira issue stroke chrome matches the work-item key type on the issue-key cluster", () => {
	assert.match(SUMMARY_SOURCE, /import \{ IconTile \} from "@\/components\/ui\/icon-tile";/);
	assert.match(SUMMARY_BLOCK, /usesStrokeChrome\s*\n\s*\? "flex shrink-0 items-center gap-1\.5"\s*\n\s*: "flex shrink-0 items-center gap-1"/);
	assert.match(SUMMARY_BLOCK, /usesStrokeChrome\s*\n\s*\? iconMetrics\.issueKeyClassName\s*\n\s*: "text-xs font-semibold text-text-subtlest"/);
	assert.match(SUMMARY_BLOCK, /usesStrokeChrome \? \(\s*<IconTile[\s\S]*icon=\{<TaskIcon label="" color=\{token\("color\.icon\.brand"\)\} size="small" \/>\}[\s\S]*iconSize=\{iconMetrics\.iconTileIconSize\}[\s\S]*label=\{issueTypeLabel\}[\s\S]*size=\{iconMetrics\.iconTileSize\}[\s\S]*variant="transparent"/);
	assert.match(SUMMARY_BLOCK, /<TaskIcon[\s\S]*label=\{issueTypeLabel\}[\s\S]*color=\{token\("color\.icon\.brand"\)\}/);
	assert.match(SUBTASKS_BLOCK, /usesStrokeChrome\s*\n\s*\? "flex items-center gap-1\.5 text-xs font-medium leading-4 text-text-subtle"/);
});

test("Jira issue uses the 8px large radius token", () => {
	assert.match(SOURCE, /borderRadius: token\("radius\.large"\)/);
	assert.doesNotMatch(SOURCE, /borderRadius: token\("radius\.small"\)/);
});

test("Jira issue switches rich variants to an article with internal controls", () => {
	assert.match(SOURCE, /const hasAgentActivityPresentation = agentActivityMode !== undefined \|\| Boolean\(agentActivities\?\.length\) \|\| hasCompletedAgentChin;/);
	assert.match(SOURCE, /const hasInteractiveContent = showMoreAction \|\| hasSubtasks \|\| Boolean\(parentEpicControl\) \|\| hasAgentActivityPresentation \|\| agentActivityShellMounted \|\| Boolean\(generativeAction\) \|\| Boolean\(agentSessionTransfer\) \|\| usesCompactVisual \|\| Boolean\(agentSessionTargetPreview\);/);
	assert.match(SOURCE, /const shouldRenderIssueClickButton = Boolean\(props\.onClick && !parentEpicControl\);/);
	assert.match(SOURCE, /<article[\s\S]*data-selected=\{selected \|\| undefined\}/);
	assert.match(SOURCE, /draggable=\{draggable\}/);
	assert.match(SOURCE, /shouldRenderIssueClickButton \? \([\s\S]*usesCompactVisual \? \([\s\S]*<button[\s\S]*className="sr-only"[\s\S]*\{issueKey\}: \{summary\}[\s\S]*: \([\s\S]*<button[\s\S]*aria-pressed=\{ariaPressed \?\? selected\}/);
	assert.match(SOURCE, /parentEpicControl\?: ReactNode;/);
	assert.match(SOURCE, /parentEpicControl=\{parentEpicControl\}/);
	assert.match(SUMMARY_SOURCE, /<p className="text-sm font-semibold leading-5 text-text-subtle">Parent<\/p>/);
	assert.match(SOURCE, /showPriorityIndicator\?: boolean;/);
	assert.match(SUMMARY_SOURCE, /\{showPriorityIndicator \? \([\s\S]*usesStrokeChrome \? \([\s\S]*<span[\s\S]*aria-label=\{`\$\{priority\} priority`\}[\s\S]*buttonVariants\(\{ size: "icon-compact", variant: "ghost" \}\)/);
	assert.match(SOURCE, /className="relative w-full px-3 pt-3 pb-2 text-left outline-none/);
	assert.match(SOURCE, /className="w-full p-3 text-left outline-none/);
	assert.match(SOURCE, /<div className=\{usesCompactVisual \? "px-3 pt-3 pb-2" : "p-3"\}>\{summaryContent\}<\/div>/);
	assert.match(SUBTASKS_SOURCE, /import \{ JiraIssueCountBadge \} from "@\/components\/blocks\/jira-issue\/count-badge";/);
	assert.match(SUBTASKS_SOURCE, /import \{ Separator \} from "@\/components\/ui\/separator";/);
	assert.doesNotMatch(SOURCE, /parentEpicControl \? <JiraIssueSeparator \/> : null/);
	assert.doesNotMatch(SOURCE, /overflow: "hidden"/);
	assert.doesNotMatch(ROOT_CLASS_BLOCK, /hover:bg-bg-neutral-subtle-hovered/);
	assert.doesNotMatch(SOURCE, /<p className="mb-1 text-xs font-semibold leading-4 text-text-subtlest">Parent<\/p>/);
	assert.doesNotMatch(SOURCE, /border-b border-border px-4 py-3/);
	assert.doesNotMatch(SOURCE, /className="w-full p-4 text-left outline-none/);
	assert.doesNotMatch(SOURCE, /<div className="p-4">\{summaryContent\}<\/div>/);
});

test("Jira issue keeps its agent shell mounted throughout a session-target preview", () => {
	assert.match(
		SOURCE,
		/agentSessionTargetPreview\?: Readonly<\{ highlighted: boolean \}>;/u,
	);
	assert.match(
		SOURCE,
		/const agentSessionTargetHighlighted = agentSessionTargetPreview\?\.highlighted \?\? false;/u,
	);
	assert.match(
		SOURCE,
		/const usesAgentActivityShell = hasAgentActivityPresentation\s*\n\t\t\|\| agentActivityShellMounted\s*\n\t\t\|\| Boolean\(agentSessionTransfer\)\s*\n\t\t\|\| agentSessionDragControl !== undefined\s*\n\t\t\|\| Boolean\(agentSessionTargetPreview\);/u,
	);
	assert.match(
		SOURCE,
		/const hasInteractiveContent = [^;]*\|\| Boolean\(agentSessionTargetPreview\);/u,
	);
});

test("Jira issue renders a reusable generative action command menu", () => {
	assert.match(SOURCE, /import \{[\s\S]*JiraIssueGenerativeActionMenu,[\s\S]*type JiraIssueGenerativeActionConfig,[\s\S]*\} from "@\/components\/blocks\/jira-issue\/generative-action-menu";/);
	assert.match(SOURCE, /generativeAction,/);
	assert.doesNotMatch(SOURCE, /DEFAULT_JIRA_ISSUE_GENERATIVE_ACTION|onSubmit: \(\) => undefined/u);
	assert.match(SOURCE, /const generativeActionMenu = generativeAction && \(generativeActionPresentation === "sparkle" \|\| !showMoreAction\) \? \([\s\S]*<JiraIssueGenerativeActionMenu[\s\S]*action=\{generativeAction\}[\s\S]*issue=\{\{ issueKey, summary \}\}[\s\S]*revealActive=\{generativeActionRevealActive\}[\s\S]*\/>[\s\S]*\) : null;/);
	assert.match(SOURCE, /const hasInteractiveContent = showMoreAction \|\| hasSubtasks \|\| Boolean\(parentEpicControl\) \|\| hasAgentActivityPresentation \|\| agentActivityShellMounted \|\| Boolean\(generativeAction\) \|\| Boolean\(agentSessionTransfer\) \|\| usesCompactVisual \|\| Boolean\(agentSessionTargetPreview\);/);
	assert.match(SOURCE, /\{generativeActionMenu\}/);
	assert.match(SOURCE, /"group\/jira-issue relative w-full min-w-0 overflow-visible outline-none"/);

	assert.match(GENERATIVE_SOURCE, /RovoSparkle,[\s\S]*RovoSparkleButton,[\s\S]*type RovoSparkleActionRequest,/);
	assert.match(GENERATIVE_SOURCE, /import \{ EDITOR_PALETTE_MENTION_SOURCES \} from "@\/components\/blocks\/editor-palette\/data\/mention-sources";/);
	assert.match(GENERATIVE_SOURCE, /import \{ getMentionChildItems \} from "@\/components\/ui-custom\/rich-text-editor";/);
	assert.match(GENERATIVE_SOURCE, /export interface JiraIssueGenerativeActionConfig \{[\s\S]*agents\?: readonly RovoSparkleItem\[\];[\s\S]*ariaLabel\?: string;[\s\S]*onSubmit: \(request: JiraIssueGenerativeActionRequest\) => void \| Promise<void>;[\s\S]*skills\?: readonly RovoSparkleItem\[\];/);
	assert.match(GENERATIVE_SOURCE, /export interface JiraIssueGenerativeActionRequest \{[\s\S]*kind: JiraIssueGenerativeActionKind;[\s\S]*prompt: string;[\s\S]*issue: JiraIssueGenerativeActionIssue;[\s\S]*selectedItem\?: JiraIssueGenerativeActionSelectedItem;/);
	assert.match(GENERATIVE_SOURCE, /export type JiraIssueGenerativeActionSelectedItem = RovoSparkleSelectedItem;/);
	assert.match(GENERATIVE_SOURCE, /agents=\{action\.agents \?\? JIRA_ISSUE_GENERATIVE_AGENTS\}/u);
	assert.match(GENERATIVE_SOURCE, /skills=\{action\.skills \?\? JIRA_ISSUE_GENERATIVE_SKILLS\}/u);
	assert.match(SOURCE, /const \[generativeActionPointerActive, setGenerativeActionPointerActive\] = useState\(false\);/);
	assert.match(SOURCE, /const \[generativeActionFocusActive, setGenerativeActionFocusActive\] = useState\(false\);/);
	assert.match(SOURCE, /const \[generativeActionRevealSuppressed, setGenerativeActionRevealSuppressed\] = useState\(false\);/);
	assert.match(SOURCE, /const \[agentActivityHoverOpen, setAgentActivityHoverOpen\] = useState\(false\);/u);
	assert.match(SOURCE, /const generativeActionRevealActive = !agentActivityHoverOpen[\s\S]*&& !generativeActionRevealSuppressed[\s\S]*&& \(generativeActionPointerActive \|\| generativeActionFocusActive\);/);
	assert.match(SOURCE, /function handleAgentActivityOpenChange\(open: boolean\) \{[\s\S]*setAgentActivityHoverOpen\(open\);[\s\S]*onAgentActivityOpenChange\?\.\(open\);/u);
	assert.match(SOURCE, /const \[generativeActionAnchor, setGenerativeActionAnchor\] = useState<HTMLElement \| null>\(null\);/);
	assert.match(SOURCE, /<JiraIssueGenerativeActionMenu[\s\S]*anchor=\{generativeActionAnchor\}[\s\S]*revealActive=\{generativeActionRevealActive\}/);
	assert.match(SOURCE, /<article[\s\S]*ref=\{setGenerativeActionAnchor\}/);
	assert.match(SOURCE, /onPointerOver=\{handleGenerativeActionPointerOver\}/);
	assert.match(SOURCE, /onPointerOut=\{handleGenerativeActionPointerOut\}/);
	assert.match(
		SOURCE,
		/function handleGenerativeActionPointerOver\(event: PointerEvent<HTMLElement>\) \{[\s\S]*event\.target instanceof Element[\s\S]*event\.target\.closest\("\[data-slot='jira-issue-agent-row'\], \[data-slot='jira-issue-session-transfer'\]"\)[\s\S]*setGenerativeActionRevealSuppressed\(true\);[\s\S]*setGenerativeActionPointerActive\(false\);[\s\S]*return;/,
		"agent rows and the transfer region should suppress the portaled sparkle before their own surfaces open",
	);
	assert.match(SOURCE, /onFocusCapture=\{handleGenerativeActionFocusCapture\}/);
	assert.match(SOURCE, /onBlurCapture=\{handleGenerativeActionBlurCapture\}/);
	assert.match(
		SOURCE,
		/function handleGenerativeActionFocusCapture\(event: FocusEvent<HTMLElement>\) \{[\s\S]*event\.target instanceof Element[\s\S]*event\.currentTarget\.contains\(event\.target\)[\s\S]*setGenerativeActionFocusActive\(event\.target\.matches\(":focus-visible"\)\);/,
		"pointer-acquired focus should not pin the sparkle after an agent-row click",
	);
	assert.match(
		SOURCE,
		/function handleGenerativeActionBlurCapture\(event: FocusEvent<HTMLElement>\) \{[\s\S]*event\.target instanceof Node[\s\S]*event\.currentTarget\.contains\(event\.target\)[\s\S]*setGenerativeActionFocusActive\(false\);/,
		"portaled focus events should not masquerade as card focus",
	);
	assert.match(
		SOURCE,
		/function handleGenerativeActionPointerOut\(event: PointerEvent<HTMLElement>\) \{[\s\S]*!event\.currentTarget\.contains\(event\.target as Node\)[\s\S]*const nextTarget = event\.relatedTarget as Node \| null;[\s\S]*event\.currentTarget\.contains\(nextTarget\)[\s\S]*setGenerativeActionPointerActive\(false\);/,
		"the real DOM pointer boundary should win over portaled React descendants",
	);
	assert.match(SOURCE, /<JiraIssueAgentActivityRows[\s\S]*onOpenChange=\{handleAgentActivityOpenChange\}/);
	assert.match(GENERATIVE_SOURCE, /triggerElement\?: ReactElement;/);
	assert.match(GENERATIVE_SOURCE, /const generatedTrigger = triggerPosition \? \([\s\S]*<RovoSparkleButton[\s\S]*hideWhenSelected/);
	assert.match(GENERATIVE_SOURCE, /const resolvedTrigger = triggerElement \?\? generatedTrigger;/);
	assert.match(
		GENERATIVE_SOURCE,
		/className="fixed z-\[150\] overflow-visible before:pointer-events-auto before:absolute/,
		"the portaled sparkle and its hover bridge should stay below z-200 modal blankets",
	);
	assert.doesNotMatch(GENERATIVE_SOURCE, /z-\[550\]/);
	assert.doesNotMatch(GENERATIVE_SOURCE, /mt-2/);
	assert.match(GENERATIVE_SOURCE, /function handleOpenChange\(nextOpen: boolean\) \{[\s\S]*setOpen\(nextOpen\);[\s\S]*onOpenChange\?\.\(nextOpen\);/);
	assert.match(SOURCE, /onOpenChange=\{\(nextOpen\) => setGenerativeActionRevealSuppressed\(!nextOpen\)\}/);
	assert.match(SOURCE, /onTriggerPointerEnter=\{\(\) => setGenerativeActionPointerActive\(true\)\}/);
	assert.match(SOURCE, /onTriggerPointerLeave=\{\(\) => setGenerativeActionPointerActive\(false\)\}/);
	assert.match(GENERATIVE_SOURCE, /window\.addEventListener\("scroll", updateTriggerPosition, true\);/);
	assert.match(GENERATIVE_SOURCE, /if \(!anchor \|\| \(!revealActive && !open\)\) \{[\s\S]*window\.requestAnimationFrame\(trackTriggerPosition\)[\s\S]*window\.cancelAnimationFrame\(animationFrameId\)/);
	assert.match(GENERATIVE_SOURCE, /currentPosition\?\.bridgeHeight === nextPosition\.bridgeHeight[\s\S]*currentPosition\.left === nextPosition\.left[\s\S]*currentPosition\.top === nextPosition\.top/u);
	assert.match(GENERATIVE_SOURCE, /function getJiraIssueGenerativeTriggerPosition\(anchor: HTMLElement\)[\s\S]*anchor\.querySelector<HTMLElement>\("\[data-slot='jira-issue-surface'\]"\)[\s\S]*const top = issueSurface\?\.getBoundingClientRect\(\)\.top \?\? rect\.top;[\s\S]*bridgeHeight: Math\.max\(JIRA_ISSUE_GENERATIVE_TRIGGER_SIZE, rect\.bottom - top\),[\s\S]*left: rect\.right \+ 7,[\s\S]*top,/);
	assert.doesNotMatch(GENERATIVE_SOURCE, /top: rect\.top \+ 1/);
	assert.doesNotMatch(GENERATIVE_SOURCE, /group-hover\/jira-issue|group-focus-within\/jira-issue/);
	assert.match(
		GENERATIVE_SOURCE,
		/overflow-visible before:pointer-events-auto before:absolute before:-left-2 before:top-0 before:h-\[var\(--jira-issue-generative-bridge-height\)\] before:w-2 before:content-\[''\] \[&>span\]:rounded-\[inherit\]/u,
		"the sparkle trigger should bridge its 8px visual gap across the card's full height without clipping the bridge",
	);
	assert.match(GENERATIVE_SOURCE, /"--jira-issue-generative-bridge-height": `\$\{triggerPosition\.bridgeHeight\}px`/u);
	assert.doesNotMatch(GENERATIVE_SOURCE, /delay-200|translate-x/);
	assert.match(GENERATIVE_SOURCE, /size="compact"[\s\S]*visible=\{sparkleVisible\}/);
	assert.match(GENERATIVE_SOURCE, /<RovoSparkle[\s\S]*agents=\{action\.agents \?\? JIRA_ISSUE_GENERATIVE_AGENTS\}[\s\S]*menuTitle="Jira issue actions"[\s\S]*popoverTitle="Jira issue generative actions"[\s\S]*sideOffset=\{hasTriggerElement \? 4 : -24\}[\s\S]*skills=\{action\.skills \?\? JIRA_ISSUE_GENERATIVE_SKILLS\}/);
	assert.match(GENERATIVE_SOURCE, /triggerPortalContainer=\{hasTriggerElement \? null : portalContainer\}/);
	assert.match(ROVO_SPARKLE_BUTTON_SOURCE, /import \{ motion, useReducedMotion, type Transition \} from "motion\/react";/);
	assert.match(ROVO_SPARKLE_BUTTON_SOURCE, /rotate: shouldReduceMotion \|\| !active \? 0 : 180,[\s\S]*scale: shouldReduceMotion \|\| !active \? 1 : hoverScale/);
	assert.match(ROVO_SPARKLE_BUTTON_SOURCE, /<motion\.g[\s\S]*animate=\{\{ opacity: colorActive \? 1 : 0 \}\}/);
	assert.match(ROVO_SPARKLE_BUTTON_SOURCE, /animate=\{\{ opacity: selected \? 1 : 0 \}\}[\s\S]*className="text-icon-selected!"/);
	assert.match(ROVO_SPARKLE_BUTTON_SOURCE, /if \(selected !== previousSelected\) \{[\s\S]*setInteractionSuppressed\(true\)/);
	assert.match(ROVO_SPARKLE_BUTTON_SOURCE, /const SPARKLE_COLOR_ENTER: Transition = \{ duration: 0\.15, ease: \[0\.4, 1, 0\.6, 1\] \}/);
	assert.match(ROVO_SPARKLE_BUTTON_SOURCE, /const SPARKLE_COLOR_EXIT: Transition = \{ duration: 0\.25, ease: \[0\.6, 0, 0\.8, 0\.6\] \}/);
	assert.match(ROVO_SPARKLE_BUTTON_SOURCE, /const SPARKLE_TRANSFORM_ENTER: Transition = \{ duration: 0\.4, ease: \[0\.4, 0, 0, 1\] \}/);
	assert.match(ROVO_SPARKLE_BUTTON_SOURCE, /const SPARKLE_TRANSFORM_EXIT: Transition = \{ duration: 0\.25, ease: \[0\.6, 0, 0\.8, 0\.6\] \}/);
	assert.match(ROVO_SPARKLE_BUTTON_SOURCE, /const colorTransition = shouldReduceMotion[\s\S]*\? SPARKLE_REDUCED/);
	assert.match(ROVO_SPARKLE_SOURCE, /className="rich-text-command-menu-borderless rich-text-command-menu-search-selects"/);
	assert.match(RICH_TEXT_EDITOR_CSS_SOURCE, /\.rich-text-command-menu-search-selects:focus-within \.rich-text-command-menu-item-selected,[\s\S]*\.rich-text-command-menu-search-selects:focus-within \.rich-text-command-menu-item-selected:hover,[\s\S]*background-color: var\(--ds-background-neutral-subtle-hovered, #f1f2f4\);/);
	assert.match(RICH_TEXT_EDITOR_CSS_SOURCE, /\.rich-text-command-menu-search-selects:focus-within \.rich-text-command-menu-item-selected:not\(\[data-has-actions="true"\]\):hover \.rich-text-command-menu-copy \{\s*padding-right: 28px;/);
	assert.match(RICH_TEXT_EDITOR_CSS_SOURCE, /\.rich-text-command-menu-search-selects:focus-within \.rich-text-command-menu-return-shortcut \{\s*display: inline-flex;/);
	assert.match(ROVO_SPARKLE_SOURCE, /emptyState=\{false\}/);
	assert.match(ROVO_SPARKLE_SOURCE, /<RichTextCommandMenuSearchField[\s\S]*icon=\{<RovoColorIcon size="xxsmall" \/>\}[\s\S]*label="Ask Rovo"/);
	assert.match(ROVO_SPARKLE_SOURCE, /const \[selectedIndex, setSelectedIndex\] = useState\(-1\);/);
	assert.match(ROVO_SPARKLE_SOURCE, /function getNextSelectedIndex\(items: readonly RovoSparkleItem\[\], currentIndex: number, direction: -1 \| 1\)/);
	assert.match(ROVO_SPARKLE_SOURCE, /function handleMenuKeyDown\(event: KeyboardEvent<HTMLInputElement>\)[\s\S]*event\.key === "ArrowDown" \|\| event\.key === "ArrowUp"[\s\S]*getNextSelectedIndex\(rows, currentIndex, event\.key === "ArrowDown" \? 1 : -1\)[\s\S]*event\.key === "Enter"[\s\S]*handleSelectItem\(rows\[selectedIndex\]\)/);
	assert.match(ROVO_SPARKLE_SOURCE, /<RichTextSuggestionMenu[\s\S]*onHover=\{setSelectedIndex\}[\s\S]*selectedIndex=\{selectedIndex\}/);
	assert.match(GENERATIVE_SOURCE, /getMentionChildItems\(EDITOR_PALETTE_MENTION_SOURCES, "skill"\)/);
	assert.match(ROVO_SPARKLE_SOURCE, /headingLabel: "Skills"/);
	assert.match(GENERATIVE_SOURCE, /getMentionChildItems\(EDITOR_PALETTE_MENTION_SOURCES, "subagent"\)/);
	assert.match(ROVO_SPARKLE_SOURCE, /headingLabel: "Agents"/);
	assert.match(ROVO_SPARKLE_SOURCE, /function filterItems\(items: readonly RovoSparkleItem\[\], query: string\)/);
	assert.match(ROVO_SPARKLE_SOURCE, /const isFiltering = query\.trim\(\)\.length > 0;/);
	assert.match(ROVO_SPARKLE_SOURCE, /const SECTION_LIMIT = 3;/);
	assert.match(ROVO_SPARKLE_SOURCE, /getSuggestionOverflowFooterItem\(id, "browse-all"\)/);
	assert.ok(
		ROVO_SPARKLE_SOURCE.indexOf("id: AGENTS_HEADING_ID")
			< ROVO_SPARKLE_SOURCE.indexOf("id: SKILLS_HEADING_ID"),
		"agents should appear before skills in the Jira issue palette",
	);
	assert.match(GENERATIVE_SOURCE, /function handleRovoSparkleSubmit\(request: RovoSparkleActionRequest\)/);
	assert.match(GENERATIVE_SOURCE, /return `\$\{prompt\.trim\(\)\}\\n\\nJira issue \$\{issue\.issueKey\}: \$\{issue\.summary\}`;/);
	assert.match(GENERATIVE_SOURCE, /return `Use the "\$\{item\.label\}" skill for Jira issue \$\{issue\.issueKey\}: \$\{issue\.summary\}\.`;/);
	assert.match(GENERATIVE_SOURCE, /return `Ask "\$\{item\.label\}" to help with Jira issue \$\{issue\.issueKey\}: \$\{issue\.summary\}\.`;/);
	assert.match(DETAILS_SOURCE, /name: "generativeAction"/);
});

test("Jira issue uses the VPK Badge primitive for row counts", () => {
	assert.match(COUNT_BADGE_SOURCE, /import \{ Badge \} from "@\/components\/ui\/badge";/);
	assert.match(COUNT_BADGE_SOURCE, /<Badge className="h-5 min-w-0 rounded-sm px-1\.5 font-semibold text-text-subtle" max=\{false\} variant="neutral">/);
	assert.match(SUBTASKS_SOURCE, /<JiraIssueCountBadge compact=\{usesStrokeChrome\}>\{completedCount\}\/\{totalCount\}<\/JiraIssueCountBadge>/);
	assert.doesNotMatch(COMPLETED_RUNS_SOURCE, /JiraIssueCountBadge|Agent done/u);
	assert.doesNotMatch(COUNT_BADGE_SOURCE, /rounded-sm bg-bg-neutral px-1\.5 py-0\.5 text-xs font-semibold leading-4 text-text-subtle/);
});

test("Jira issue stroke chrome uses compact inline subtask counts", () => {
	assert.match(COUNT_BADGE_SOURCE, /compact = false/);
	assert.match(COUNT_BADGE_SOURCE, /return compact \? \(/);
	assert.match(COUNT_BADGE_SOURCE, /<span className="shrink-0 text-xs font-normal leading-4 text-text-subtlest">/);
	assert.match(SUBTASKS_BLOCK, /chrome: JiraIssueChrome;/);
	assert.match(SUBTASKS_BLOCK, /const usesStrokeChrome = compact \|\| chrome === "stroke";/);
	assert.match(SUBTASKS_BLOCK, /usesStrokeChrome\s*\n\s*\? "flex items-center gap-1\.5 text-xs font-medium leading-4 text-text-subtle"\s*\n\s*: "flex items-center gap-2 text-sm font-medium leading-5 text-text-subtle"/);
	assert.match(SOURCE, /<JiraIssueSubtasks[\s\S]*chrome=\{chrome\}[\s\S]*compact=\{usesCompactVisual\}/);
});

test("Jira issue renders one aggregate Figma-sized agent row and always exposes the shared flyout", () => {
	assert.match(AGENT_ACTIVITY_SOURCE, /import \{ AgentAvatarVisual \} from "@\/components\/ui-custom\/agent-avatar-visual";/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /import \{ Avatar, AvatarFallback \} from "@\/components\/ui\/avatar";/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const summary = summarizeJiraIssueAgentActivities\(activities\);/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const isSingleAgent = summary\.activityCount === 1;/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const featuredActivity = summary\.featuredActivityIndex !== null[\s\S]*\? activities\[summary\.featuredActivityIndex\][\s\S]*: undefined;/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /if \(featuredActivity !== undefined\) \{[\s\S]*<AgentAvatarVisual[\s\S]*animate=\{false\}[\s\S]*avatarClassName="shrink-0"[\s\S]*avatarSrc=\{featuredActivity\.avatarSrc\}[\s\S]*label=\{featuredActivity\.name\}[\s\S]*sizePx=\{24\}[\s\S]*else if \(avatarLayout === "horizontal-group"\) \{[\s\S]*<AvatarGroup[\s\S]*else \{[\s\S]*<AgentLoading[\s\S]*agents=\{activities\.map\(toAgentLoadingAgent\)\}[\s\S]*className="shrink-0"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const isAwaitingInput = !isCompletedRow && summary\.priorityState === "awaiting-input";/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /shouldCycleSingleAgentLabel|JiraIssueCyclingAgentLabel/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /status: activity\.label,[\s\S]*statusSequence: activity\.state === "working" \? getJiraIssueAgentWorkingLabels\(activity\) : undefined,[\s\S]*statusCycleIntervalMs: activity\.cycleIntervalMs[\s\S]*statusCycleJitterMs: activity\.cycleIntervalJitterMs/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /\{rowLabel\}[\s\S]*<AnimatedDots/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/if \(isAwaitingInput\) \{[\s\S]*className="flex min-w-0 flex-1 items-baseline overflow-hidden text-sm leading-5 text-text"/u,
	);
	assert.doesNotMatch(
		AGENT_ACTIVITY_SOURCE,
		/if \(isAwaitingInput\) \{[\s\S]*text-text-subtlest/u,
	);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/if \(isWorking\) \{[\s\S]*<Shimmer[\s\S]*as="span"[\s\S]*className="block min-w-0 flex-1 truncate text-sm leading-5 text-text"[\s\S]*duration=\{1\.4\}[\s\S]*spread=\{2\}[\s\S]*\{rowLabel\}/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /className="block min-w-0 flex-1 truncate text-sm leading-5 text-text"[\s\S]*\{rowLabel\}/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/if \(isAwaitingInput\) \{[\s\S]*?<span className="block min-w-0 truncate text-sm leading-5">\{rowLabel\}<\/span>[\s\S]*?<AnimatedDots \/>/u,
	);
	assert.match(STARTUP_SOURCE, /baseColor="var\(--color-text\)"/u);
	assert.match(STARTUP_SOURCE, /className="block min-w-0 truncate text-sm leading-5"/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /PixelLoader/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /className="flex min-w-0 flex-1 items-center gap-2"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /className="grid size-6 shrink-0 place-items-center text-icon"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /import \{ IconTile \} from "@\/components\/ui\/icon-tile";/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/function JiraIssueAgentStatusIconTile[\s\S]*<IconTile[\s\S]*iconSize="medium"[\s\S]*size="small"[\s\S]*variant="transparent"/u,
	);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/icon=\{<QuestionCircleFilledIcon color="currentColor" label="" size="small" \/>\}/u,
	);
	assert.doesNotMatch(
		AGENT_ACTIVITY_SOURCE,
		/<StatusInformationIcon label="" size="medium"/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /import \{ Spinner \} from "@\/components\/ui\/spinner";/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/<span[\s\S]*className="grid size-6 shrink-0 place-items-center text-icon"[\s\S]*<Spinner[\s\S]*pulse[\s\S]*size="xl"[\s\S]*variant="experimental-avatar"/u,
	);
	assert.match(SOURCE, /<JiraIssueAgentActivityRows[\s\S]*iconScale=\{iconScale\}/);
	assert.match(SOURCE, /<JiraIssueAgentActivityRows[\s\S]*inheritChinSurface/);
	assert.match(AGENT_ACTIVITY_SOURCE, /if \(!showAssignmentFlyout\) \{\s*return rowHandle;[\s\S]*<AgentAssignment[\s\S]*openMode="click"[\s\S]*trigger=\{rowHandle\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /inheritChinSurface \? "bg-transparent" : "bg-bg-neutral"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /renderAgentActivityIndicator\?: JiraIssueAgentActivityIndicatorRenderer;/u);
	assert.match(SOURCE, /renderAgentActivityIndicator\?: JiraIssueAgentActivityIndicatorRenderer;/u);
	assert.match(SOURCE, /<JiraIssueAgentActivityRows[\s\S]*renderAgentActivityIndicator=\{renderAgentActivityIndicator\}/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /<HoverCard/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /<AgentList/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /<AgentStates/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /<JiraIssueAgentActivityRow[\s\S]*onOpenChange=\{\(open\) => \{[\s\S]*setAssignmentHoverOpen\(open\);[\s\S]*onOpenChange\?\.\(open\);[\s\S]*onViewChat=\{onViewChat\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /usesStrokeChrome: boolean;/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/className=\{cn\(\s*"flex w-full min-w-0 flex-col",[\s\S]*sessionDragging \? "overflow-visible" : "overflow-hidden has-\[:focus-visible\]:overflow-visible",[\s\S]*\(hasActivities \|\| hasAttachPreview\) && cn\([\s\S]*?flushContent \? "px-0" : "px-1",[\s\S]*?"py-1 has-\[\[data-session-chip-out\]\]:py-0",[\s\S]*?\),\s*\)\}/u,
	);
	assert.match(SOURCE, /"relative w-full min-w-0 overflow-visible rounded-\[10px\] outline-none"/);
	assert.match(SOURCE, /"group\/jira-issue relative w-full min-w-0 overflow-visible outline-none"/);
	assert.match(SOURCE, /const hasCompletedAgentChin = resolvedAgentActivityMode === "completed" && agentDoneRuns\.length > 0;/);
	assert.match(SOURCE, /const hasAgentDoneNotification = iconScale !== "comfortable" && hasCompletedAgentChin;/);
	assert.match(SOURCE, /const hasActiveAgentActivityShell = resolvedAgentActivityMode === "working"[\s\S]*\|\| resolvedAgentActivityMode === "awaiting-input"[\s\S]*\|\| hasCompletedAgentChin;/);
	assert.match(SOURCE, /const agentActivitySurfaceInset = hasActiveAgentActivityShell \? 4 : 0;/);
	assert.match(
		SOURCE,
		/const hasAgentActivityChin = activeAgentActivities.length > 0\s*\n\s*\|\| hasCompletedAgentChin\s*\n\s*\|\| isAttachingSession;/u,
	);
	assert.match(
		SOURCE,
		/const insetsAgentActivitySurfaceBottom = hasActiveAgentActivityShell && !hasAgentActivityChin;/u,
	);
	// The well is carved out of the card on every edge. A spacer row under the card
	// would grow the shell on hover and push the rest of the column down.
	assert.doesNotMatch(SOURCE, /data-slot="jira-issue-agent-shell-gutter"/u);
	assert.doesNotMatch(SOURCE, /className="h-1"/u);
	assert.match(SOURCE, /data-slot="jira-issue-agent-backdrop"/u);
	assert.match(
		SOURCE,
		/has-\[\[data-session-chip-out\]\]:not-has-\[\[data-slot=jira-issue-agent-row-wrap\]:not\(\[data-session-chip-out\]\)\]:pb-1/u,
	);
	assert.doesNotMatch(SOURCE, /\[&_\[data-slot=jira-issue-agent-backdrop\]\]:opacity-0/u);
	assert.doesNotMatch(SOURCE, /\[&_\[data-slot=jira-issue-surface\]\]:-inset-px/u);
	assert.match(SOURCE, /const agentActivitySurfaceClassName = cn\([\s\S]*"pointer-events-none absolute border"[\s\S]*cn\(agentActivityRestBorderClassName, "bg-surface"\)/);
	assert.doesNotMatch(SOURCE, /agentActivityShellPadding/);
	assert.doesNotMatch(SOURCE, /agentActivityBackdropOutset/);
	assert.match(SOURCE, /data-agent-activity-mode=\{resolvedAgentActivityMode\}/);
});

test("Jira issue completed agent flyouts retain hover through their visible shadow edge", () => {
	assert.match(
		COMPLETED_RUNS_SOURCE,
		/<HoverCardContent[\s\S]*positionerClassName="z-\[575\] after:pointer-events-auto after:absolute after:-inset-2 after:-z-10 after:content-\[''\]"/u,
	);
});

test("Jira issue aggregates completed agents into a Finished row with failure priority", () => {
	assert.match(COMPLETED_RUNS_SOURCE, /export interface JiraIssueCompletedAgentRun \{[\s\S]*summary: string;[\s\S]*agentName: string;[\s\S]*agentAvatarSrc\?: string;[\s\S]*agentBrandName\?: ThirdPartyLogoName;[\s\S]*issueKey: string;[\s\S]*issueSummary: string;[\s\S]*relativeTime\?: string;[\s\S]*completedAtMs\?: number;[\s\S]*completedSecondsAgo\?: number;[\s\S]*state: JiraIssueCompletedAgentRunState;/);
	assert.match(COMPLETED_RUNS_SOURCE, /completedAtMs: run\.completedAtMs,[\s\S]*completedSecondsAgo: run\.completedSecondsAgo,/u);
	assert.equal((COMPLETED_RUNS_SOURCE.match(/brandName: run\.agentBrandName,/gu) ?? []).length, 1);
	assert.match(COMPLETED_RUNS_SOURCE, /import \{[\s\S]*AgentList,[\s\S]*type AgentListItem,[\s\S]*toAgentSessionFlyoutItem,[\s\S]*\} from "@\/components\/blocks\/agent-list";/u);
	assert.match(COMPLETED_RUNS_SOURCE, /import AiAgentIcon from "@atlaskit\/icon\/core\/ai-agent";/u);
	assert.match(COMPLETED_RUNS_SOURCE, /function toCompletedAgentListItem\(run: JiraIssueCompletedAgentRun\): AgentListItem \{[\s\S]*state: "complete",[\s\S]*title: run\.summary,/u);
	assert.match(COMPLETED_RUNS_SOURCE, /const finishedLabel = "Finished";/u);
	assert.match(COMPLETED_RUNS_SOURCE, /if \(props\.runs\.length === 1\) \{[\s\S]*label=\{run\.state === "failed" \? "Failed" : "Finished"\}[\s\S]*showFlyout=\{false\}/u);
	assert.match(COMPLETED_RUNS_SOURCE, /const hasFailedRun = runs\.some\(\(run\) => run\.state === "failed"\);/u);
	assert.match(COMPLETED_RUNS_SOURCE, /<section aria-label="Agent review" className="flex w-full min-w-0 flex-col overflow-hidden px-1 py-1">/u);
	// One finished agent reuses the split chin (avatar + "Finished") and
	// skips the aggregate flyout. Two or more stay on the Team EU "Finished"
	// chin: generic agent mark, host-owned trailing glyph, HoverCard list.
	// Failed aggregates keep the trailing error so success never paints over
	// a failure.
	assert.match(
		COMPLETED_RUNS_SOURCE,
		/<JiraIssueAgentDoneMerged[\s\S]*renderAgentActivityIndicator=\{props\.renderAgentActivityIndicator\}/u,
	);
	assert.match(
		COMPLETED_RUNS_SOURCE,
		/const finishedIndicator = !hasFailedRun && renderAgentActivityIndicator\s*\n\s*\? renderAgentActivityIndicator\("finished"\)\s*\n\s*: null;/u,
	);
	assert.match(COMPLETED_RUNS_SOURCE, /<HoverCard open=\{aggregateOpen\} onOpenChange=\{handleAggregateOpenChange\}>[\s\S]*aria-label=\{hasFailedRun \? `\$\{finishedLabel\}, includes errors` : finishedLabel\}[\s\S]*data-slot="jira-issue-agent-row"[\s\S]*usesStrokeChrome \? \(\s*<IconTile[\s\S]*icon=\{<AiAgentIcon label="" size="small" \/>\}[\s\S]*: \([\s\S]*<AiAgentIcon label="" \/>[\s\S]*\{finishedLabel\}[\s\S]*hasFailedRun \? \([\s\S]*<StatusErrorIcon[\s\S]*: finishedIndicator \? \(\s*<span[\s\S]*\{finishedIndicator\}/u);
	assert.match(COMPLETED_RUNS_SOURCE, /className="flex h-8 w-full[^"]*rounded-b-\[6px\] rounded-t-sm[^"]*px-2 py-1[^"]*"/u);
	assert.match(COMPLETED_RUNS_SOURCE, /<IconTile[\s\S]*iconSize="medium"[\s\S]*size="small"[\s\S]*variant="transparent"/u);
	assert.match(COMPLETED_RUNS_SOURCE, /className="truncate text-sm leading-5 text-text"/u);
	assert.match(COMPLETED_RUNS_SOURCE, /className="grid size-6 shrink-0 place-items-center text-icon-subtle"/u);
	assert.equal(
		(COMPLETED_RUNS_SOURCE.match(/transition-colors duration-fast ease-out[\s\S]*?motion-reduce:transition-none/gu) ?? []).length,
		2,
		"completed-run row and aggregate trigger should drop the pressed color transition under reduced motion",
	);
	assert.match(COMPLETED_RUNS_SOURCE, /<AgentList[\s\S]*className="w-full border-0 bg-surface-overlay shadow-2xl"[\s\S]*flyout="session"[\s\S]*items=\{completedItems\}[\s\S]*variant="compact"/u);
	assert.match(SOURCE, /onAgentDoneRunReview\?: \(run: JiraIssueCompletedAgentRun\) => void;/u);
	assert.match(SOURCE, /<JiraIssueAgentDone[\s\S]*onReview=\{onAgentDoneRunReview\}[\s\S]*usesStrokeChrome=\{usesCompactVisual\}/u);
	assert.match(CHANGED_FILES_SOURCE, /const statusPresentation = status === "failed"[\s\S]*<StatusErrorIcon[\s\S]*: null/u);
	assert.match(COMPLETED_RUNS_SOURCE, /import \{[\s\S]*toAgentSessionFlyoutItem,[\s\S]*\} from "@\/components\/blocks\/agent-list"/u);
	assert.match(COMPLETED_RUNS_SOURCE, /<JiraSessionFlyoutTrigger[\s\S]*session=\{\{ \.\.\.session, status: run\.state === "failed" \? "stopped" : session\.status \}\}/u);
	assert.match(COMPLETED_RUNS_SOURCE, /<JiraSessionFlyoutSurface handle=\{flyoutHandle\} \/>/u);
	assert.match(COMPLETED_RUNS_SOURCE, /flyout="session"/u);
	assert.doesNotMatch(COMPLETED_RUNS_SOURCE, /AgentStatesComposer/u);
	assert.doesNotMatch(SOURCE, /showSeparator/);
	assert.match(SOURCE, /<JiraIssueAgentActivityRows[\s\S]*onOpenChange=\{handleAgentActivityOpenChange\}[\s\S]*<AnimatePresence initial=\{false\} mode="popLayout">[\s\S]*key="agent-review"[\s\S]*<JiraIssueAgentDone[\s\S]*onOpenChange=\{handleAgentActivityOpenChange\}[\s\S]*runs=\{agentDoneRuns\}/u);
});

test("Jira issue animates agent state transitions with Motion", () => {
	assert.match(SOURCE, /import \{ AnimatePresence, LayoutGroup, motion, useReducedMotion \} from "motion\/react";/);
	assert.match(LIB_SOURCE, /import type \{ Transition \} from "motion\/react";/);
	assert.doesNotMatch(SOURCE, /framer-motion/);
	assert.match(LIB_SOURCE, /export const JIRA_ISSUE_MOTION_ENTER: Transition = \{ duration: 0\.15, ease: \[0\.4, 1, 0\.6, 1\] \}; \/\/ duration-normal \+ ease-out-practical/);
	assert.match(LIB_SOURCE, /export const JIRA_ISSUE_MOTION_EXIT: Transition = \{ duration: 0\.1, ease: \[0\.6, 0, 0\.8, 0\.6\] \}; \/\/ duration-fast \+ ease-in/);
	assert.match(LIB_SOURCE, /export const JIRA_ISSUE_MOTION_LAYOUT: Transition = \{ duration: 0\.2, ease: \[0\.4, 0, 0, 1\] \}; \/\/ duration-medium \+ ease-in-out/);
	assert.match(LIB_SOURCE, /export const JIRA_ISSUE_MOTION_REDUCED: Transition = \{ duration: 0 \};/);
	assert.match(SOURCE, /const shouldReduceMotion = useReducedMotion\(\);/);
	assert.match(LIB_SOURCE, /export function getJiraIssuePresenceMotion\(shouldReduceMotion: boolean \| null\)[\s\S]*initial: false/);
	assert.match(AGENT_ACTIVITY_SOURCE, /<AnimatePresence key=\{rowPresenceKey\} initial=\{false\} mode="popLayout">[\s\S]*\{rowGroups\.map\(\(rowGroup, index\) => \{[\s\S]*<motion\.div[\s\S]*key=\{rowGroup\.key\}[\s\S]*exit=\{presenceMotion\.exit\}[\s\S]*initial=\{presenceMotion\.initial\}/u);
	assert.match(SOURCE, /const hasIssueRows = hasSubtasks;/);
	assert.match(SOURCE, /const issueRowsClassName = cn\("pt-1", !\(hasSubtasks && resolvedSubtasksExpanded\) && "pb-1"\);/);
	assert.match(SOURCE, /<JiraIssueAgentActivityRows[\s\S]*<AnimatePresence initial=\{false\} mode="popLayout">[\s\S]*key="agent-review"[\s\S]*<JiraIssueAgentDone[\s\S]*runs=\{agentDoneRuns\}/u);
	assert.match(SOURCE, /const usesAgentActivityShell = hasAgentActivityPresentation\s*\n\t\t\|\| agentActivityShellMounted\s*\n\t\t\|\| Boolean\(agentSessionTransfer\)\s*\n\t\t\|\| agentSessionDragControl !== undefined\s*\n\t\t\|\| Boolean\(agentSessionTargetPreview\);/);
	assert.match(SOURCE, /const agentActivityBackdropAnimation = \{[\s\S]*left: 0,[\s\S]*opacity: hasActiveAgentActivityShell \? 1 : attachNearness,[\s\S]*right: 0,[\s\S]*top: 0/);
	assert.match(SOURCE, /an inset of 4\s*\n\t\/\/ puts them 4px from the article edge, flush with the `px-1` gutter the chin/);
	assert.match(SOURCE, /const agentActivitySurfacePosition = agentActivitySurfaceInset - 1;/);
	assert.match(
		SOURCE,
		/const agentActivitySurfaceAnimation = getJiraIssueAgentSurfaceOffsets\(\s*\n\s*agentActivitySurfacePosition,\s*\n\s*insetsAgentActivitySurfaceBottom,\s*\n\s*\);/u,
	);
	assert.match(SOURCE, /<article[\s\S]*className=\{agentActivityArticleClassName\}[\s\S]*data-agent-activity-mode=\{resolvedAgentActivityMode\}/);
	assert.match(SOURCE, /<motion\.div[\s\S]*className=\{agentActivityShellClassName\}[\s\S]*initial=\{false\}[\s\S]*layout=\{!\(shouldReduceMotion \|\| agentActivityHoverOpen \|\| parentOwnsLayout\)\}[\s\S]*layoutRoot=\{!parentOwnsLayout\}/);
	assert.match(
		SOURCE,
		/className=\{cn\(\s*"pointer-events-none absolute transition-colors duration-xxshort ease-out-practical motion-reduce:transition-none",\s*agentSessionTargetHighlighted \? "bg-bg-neutral-hovered" : "bg-bg-neutral",\s*\)\}/u,
	);
	assert.match(SOURCE, /<motion\.div[\s\S]*animate=\{shouldReduceMotion \? undefined : agentActivitySurfaceAnimation\}[\s\S]*className=\{agentActivitySurfaceClassName\}[\s\S]*data-slot="jira-issue-surface"/);
	assert.doesNotMatch(SOURCE, /padding: shouldReduceMotion/);
	assert.match(SOURCE, /<JiraIssueAgentActivityRows[\s\S]*usesStrokeChrome=\{usesCompactVisual\}/);
	assert.match(SOURCE, /transformOrigin: "top center"/);
	assert.match(SOURCE, /const AGENT_ACTIVITY_INNER_STYLE: CSSProperties = \{[\s\S]*transformOrigin: "top center"/);
	assert.doesNotMatch(SOURCE, /layout=\{!shouldReduceMotion\}/);
	assert.match(SOURCE, /layout=\{shouldReduceMotion \|\| parentOwnsLayout \? false : "position"\}/);
	assert.match(SOURCE, /layout=\{shouldReduceMotion \|\| agentActivityHoverOpen \|\| parentOwnsLayout \? false : "position"\}/);
	assert.match(AGENT_ACTIVITY_SOURCE, /const rowLayout = shouldReduceMotion \|\| sessionDragging \|\| assignmentHoverOpen\s*\n\s*\? false\s*\n\s*: "position";/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /<AgentAvatarVisual[\s\S]*animate=\{false\}/u);
	assert.match(SUBTASKS_SOURCE, /style=\{shouldReduceMotion \? undefined : JIRA_ISSUE_MOTION_STYLE\}/);
});

test("Jira issue compensates expanded subtask spacing for the active surface inset", () => {
	assert.match(SUBTASKS_SOURCE, /hasInsetSurface: boolean;/);
	assert.match(SUBTASKS_SOURCE, /className=\{cn\("flex flex-col gap-2 px-3 pt-1", hasInsetSurface \? "pb-2" : "pb-3"\)\}/);
	assert.match(SUBTASKS_SOURCE, /const showSubtaskProgress = totalCount > 0;/);
	// Content-side compensation only applies when the surface bottom is flush with
	// the card. Once the well insets that edge itself, trimming the padding too
	// would double-count and leave the last subtask 4px from the white edge.
	assert.match(
		SOURCE,
		/<JiraIssueSubtasks[\s\S]*hasInsetSurface=\{hasActiveAgentActivityShell && !insetsAgentActivitySurfaceBottom\}/,
	);
});

test("Jira issue parent epic demo includes issue context and a collapsed subtasks row", () => {
	assert.match(PAGE_SOURCE, /const hasCompactIssueContext = isSubtasksVariant \|\| isParentEpicVariant;/);
	assert.match(PAGE_SOURCE, /const issueKey = isParentEpicVariant \? "JDSN-157" : isSubtasksVariant \? "JDSN-229" : "RFP-101";/);
	assert.match(PAGE_SOURCE, /const summary = isParentEpicVariant[\s\S]*\? "Next best action"[\s\S]*: isSubtasksVariant[\s\S]*\? "Venn's test"/);
	assert.match(PAGE_SOURCE, /issueKey=\{issueKey\}/);
	assert.match(PAGE_SOURCE, /assigneeUnassignedKind=\{hasCompactIssueContext \? "person" : undefined\}/);
	assert.match(PAGE_SOURCE, /showPriorityIndicator=\{!isParentEpicVariant\}/);
	assert.match(PAGE_SOURCE, /subtasks=\{hasCompactIssueContext \? JIRA_ISSUE_DEMO_SUBTASKS : undefined\}/);
	assert.match(PAGE_SOURCE, /summary=\{summary\}/);
});

test("Jira issue agent activity demo is registered in docs and variant registry", () => {
	assert.match(PAGE_SOURCE, /variant\?: "default" \| "experimental" \| "uncaptured-work" \| "subtasks-collapsed" \| "subtasks-expanded" \| "parent-epic" \| "agent-activity-states" \| "agent-activity-states-experimental" \| "agent-activity-states-experimental-v2";/);
	assert.match(PAGE_SOURCE, /const JIRA_ISSUE_AGENT_ACTIVITY_DEMO_STATES = \[/);
	assert.match(PAGE_SOURCE, /const SERVICE_IMPACT_AGENT_LABELS = \[[\s\S]*"Reading linked design notes"[\s\S]*"Mapping customer-facing impact"/);
	assert.match(PAGE_SOURCE, /const DEPENDENCY_MAPPER_LABELS = \[[\s\S]*"Following linked work items"[\s\S]*"Finding blocked handoffs"/);
	assert.match(PAGE_SOURCE, /id: "service-impact-agent"[\s\S]*labels: SERVICE_IMPACT_AGENT_LABELS,[\s\S]*cycleIntervalMs: 5200,[\s\S]*cycleIntervalJitterMs: 1600/);
	assert.match(PAGE_SOURCE, /id: "dependency-mapper"[\s\S]*labels: DEPENDENCY_MAPPER_LABELS,[\s\S]*cycleIntervalMs: 6800,[\s\S]*cycleIntervalJitterMs: 2200/);
	assert.match(PAGE_SOURCE, /const JIRA_ISSUE_AWAITING_INPUT_ACTIVITIES = \[[\s\S]*\.\.\.JIRA_ISSUE_AGENT_ACTIVITIES\[0\],[\s\S]*label: "Needs input"[\s\S]*state: "awaiting-input"[\s\S]*JIRA_ISSUE_AGENT_ACTIVITIES\[1\]/);
	assert.match(PAGE_SOURCE, /import \{ RovoChatProvider \} from "@\/app\/contexts";/);
	assert.match(PAGE_SOURCE, /import \{ ASX_CHAT_AGENT_PROFILES \} from "@\/components\/projects\/jira-golden-journeys-v0\/data\/agent-chat-data";/);
	assert.match(PAGE_SOURCE, /import \{ AsxRovoOverlay \} from "@\/components\/projects\/jira-golden-journeys-v0\/components\/jira-golden-journeys-v0-rovo-overlay";/);
	assert.match(PAGE_SOURCE, /import \{ useAsxAgentChatDemo \} from "@\/components\/projects\/jira-golden-journeys-v0\/hooks\/use-jira-golden-journeys-v0-agent-chat-demo";/);
	assert.match(PAGE_SOURCE, /import \{[\s\S]*JiraIssue,[\s\S]*type JiraIssueAgentActivity,[\s\S]*type JiraIssueCompletedAgentRun,[\s\S]*type JiraIssueGenerativeActionRequest,[\s\S]*\} from "@\/components\/blocks\/jira-issue";/);
	// The demo drops into the floating chat with the activity's agent already
	// selected (matching ASX), not a blank vanilla Rovo chat.
	assert.doesNotMatch(PAGE_SOURCE, /openChat\("floating"\)/);
	assert.match(PAGE_SOURCE, /const \{ chatContextBar, externalThinkingMessageId, openAgentChat \} = useAsxAgentChatDemo\(\);/);
	assert.match(PAGE_SOURCE, /const openActivityChat = useCallback\(\(activity: JiraIssueAgentActivity\) => \{[\s\S]*openAgentChat\(\{[\s\S]*agentId: activity\.id,[\s\S]*agentName: activity\.name,[\s\S]*question: activity\.question,[\s\S]*\}\);[\s\S]*\}, \[openAgentChat\]\);/);
	assert.match(PAGE_SOURCE, /const handleAgentActivityViewChat = openActivityChat;/);
	assert.match(PAGE_SOURCE, /const handleGenerativeActionSubmit = useCallback\(\(request: JiraIssueGenerativeActionRequest\) => \{[\s\S]*openAgentChat\(\{[\s\S]*request: request\.prompt,[\s\S]*\}\);[\s\S]*\}, \[openAgentChat\]\);/);
	assert.match(PAGE_SOURCE, /<RovoChatProvider agentProfiles=\{ASX_CHAT_AGENT_PROFILES\}>[\s\S]*<JiraIssueAgentActivityStatesDemo[\s\S]*agentActivityLayout="merged"[\s\S]*chrome="raised"[\s\S]*\/>[\s\S]*<\/RovoChatProvider>/);
	assert.doesNotMatch(PAGE_SOURCE, /request-review-agent/);
	assert.match(PAGE_SOURCE, /\{ value: "default", label: "Default" \}/);
	assert.match(PAGE_SOURCE, /\{ value: "single-agent-working", label: "1 agent" \}/);
	assert.match(PAGE_SOURCE, /\{ value: "multiple-agents-working", label: "1-n agents" \}/);
	assert.match(PAGE_SOURCE, /\{ value: "awaiting-user-input", label: "Needs input" \}/);
	assert.match(PAGE_SOURCE, /\{ value: "agent-completed-work", label: "Review" \}/);
	assert.match(PAGE_SOURCE, /\{ value: "agent-dismissed-work", label: "Done" \}/);
	assert.match(PAGE_SOURCE, /className="relative flex h-full min-h-\[480px\] w-full flex-col bg-surface"/);
	assert.match(PAGE_SOURCE, /className="sticky top-0 z-10 w-full bg-surface pb-4 pt-6"/);
	assert.match(PAGE_SOURCE, /className="flex w-full flex-wrap items-center justify-center gap-2"/);
	assert.match(PAGE_SOURCE, /className="flex flex-1 items-start justify-center overflow-visible px-6 pb-10 pt-6"/);
	assert.doesNotMatch(PAGE_SOURCE, /flex min-h-0 flex-1 items-start justify-center px-6 pb-6 pt-8/);
	assert.doesNotMatch(PAGE_SOURCE, /grid w-full grid-cols-5/);
	assert.doesNotMatch(PAGE_SOURCE, /w-full min-w-0 justify-center overflow-hidden text-ellipsis/);
	assert.doesNotMatch(PAGE_SOURCE, /text-xs/);
	assert.doesNotMatch(PAGE_SOURCE, /\{ value: "single-agent-working", label: "Single agent working" \}/);
	assert.doesNotMatch(PAGE_SOURCE, /\{ value: "multiple-agents-working", label: "Multiple agents working" \}/);
	assert.doesNotMatch(PAGE_SOURCE, /\{ value: "awaiting-user-input", label: "Awaiting user input" \}/);
	assert.doesNotMatch(PAGE_SOURCE, /\{ value: "agent-completed-work", label: "Agent completed work" \}/);
	assert.doesNotMatch(PAGE_SOURCE, /flex w-full flex-nowrap items-center justify-center gap-2/);
	// Activity selection moved out of the JSX into a switch so the transfer
	// phases can decide which rows the chin shows.
	assert.match(PAGE_SOURCE, /function getDemoAgentActivities\(\s*state: JiraIssueAgentActivityDemoState,\s*\): readonly JiraIssueAgentActivity\[\] \| undefined \{/u);
	assert.match(PAGE_SOURCE, /case "awaiting-user-input":\s*\n\s*return JIRA_ISSUE_AWAITING_INPUT_ACTIVITIES;/u);
	assert.match(PAGE_SOURCE, /subtasks=\{JIRA_ISSUE_DEMO_SUBTASKS\}/);
	assert.doesNotMatch(PAGE_SOURCE, /subtasks=\{agentActivityState === "agent-completed-work" \? JIRA_ISSUE_DEMO_SUBTASKS : undefined\}/);
	// Tab clicks are a plain phase switch: the demo carries no timers or moved-
	// session bookkeeping to unwind first.
	assert.match(
		PAGE_SOURCE,
		/onClick=\{\(\) => \{\s*\n\s*setUnlinkedSessionIds\(\[\]\);\s*\n\s*setLinkedDetachedIds\(\[\]\);\s*\n\s*setAssignedDemoActivities\(null\);\s*\n\s*setAgentActivityState\(state\.value\);\s*\n\s*\}\}/u,
	);
	assert.match(PAGE_SOURCE, /function getExperimentalDemoPullRequest\(/);
	assert.match(PAGE_SOURCE, /const experimentalPullRequest = compact\s*\n\t\t\? getExperimentalDemoPullRequest\(agentActivityState\)\s*\n\t\t: \{\};/);
	assert.doesNotMatch(PAGE_SOURCE, /if \(chrome !== "stroke"\)/);
	assert.match(PAGE_SOURCE, /case "awaiting-user-input":[\s\S]*pullRequestNumber: 812[\s\S]*pullRequestStatus: "open"/);
	assert.match(PAGE_SOURCE, /case "agent-completed-work":[\s\S]*pullRequestStatus: "failed"/);
	assert.match(PAGE_SOURCE, /case "agent-dismissed-work":[\s\S]*pullRequestStatus: "merged"/);
	assert.match(PAGE_SOURCE, /pullRequestNumber=\{experimentalPullRequest\.pullRequestNumber\}/);
	assert.match(PAGE_SOURCE, /pullRequestPreview=\{experimentalPullRequest\.pullRequestNumber \? EXPERIMENTAL_DEMO_PULL_REQUEST_PREVIEW : undefined\}/);
	assert.match(PAGE_SOURCE, /pullRequestStatus=\{experimentalPullRequest\.pullRequestStatus\}/);
	assert.match(PAGE_SOURCE, /pullRequestTitle=\{experimentalPullRequest\.pullRequestNumber \? JIRA_ISSUE_CHAT_ISSUE_SUMMARY : undefined\}/);
	assert.match(PAGE_SOURCE, /generativeAction=\{\{[\s\S]*onSubmit: handleGenerativeActionSubmit,[\s\S]*\}\}/);
	assert.match(PAGE_SOURCE, /onAgentActivityViewChat=\{handleAgentActivityViewChat\}/);
	assert.match(PAGE_SOURCE, /<AsxRovoOverlay[\s\S]*chatContextBar=\{chatContextBar\}[\s\S]*externalThinkingMessageId=\{externalThinkingMessageId\}[\s\S]*onQuestionAnswer=\{pendingChatQuestion \? handleChatQuestionAnswer : undefined\}[\s\S]*\/>/);
	assert.doesNotMatch(PAGE_SOURCE, /<FloatingRovoButton/);
	assert.doesNotMatch(PAGE_SOURCE, /<RovoFloatingChat/);
	assert.match(DEMO_SOURCE, /export function JiraIssueDemoAgentActivityStates\(\)/);
	assert.match(DEMO_SOURCE, /<JiraIssuePage variant="agent-activity-states" \/>/);
	assert.match(DETAILS_SOURCE, /demoSlug: "jira-issue-demo-agent-activity-states"/);
	assert.match(DETAILS_SOURCE, /name: "agentActivities"/);
	assert.match(DETAILS_SOURCE, /name: "agentDoneRuns"/);
	assert.match(DETAILS_SOURCE, /name: "onAgentActivityViewChat"/);
	assert.match(DETAILS_SOURCE, /name: "onAgentDoneRunView"/);
	assert.match(DETAILS_SOURCE, /name: "onAgentDoneRunSubmit"/);
	assert.match(VARIANT_REGISTRY_SOURCE, /"jira-issue-demo-agent-activity-states": dynamic\(/);
	assert.match(VARIANT_REGISTRY_SOURCE, /default: mod\.JiraIssueDemoAgentActivityStates/);
});

test("Jira issue agent activity demo has an experimental stroke-chrome duplicate", () => {
	// The experimental duplicate reuses the same demo component. A module-scope
	// page child owns chrome state so Raised/Stroke can toggle without a rename
	// of the demo's existing `chrome` prop. The non-experimental example stays
	// raised with no toggle.
	assert.match(PAGE_SOURCE, /variant === "agent-activity-states-experimental"/);
	assert.match(PAGE_SOURCE, /variant === "agent-activity-states"/);
	assert.match(PAGE_SOURCE, /function JiraIssueExperimentalAgentActivityStatesPage\(\{[\s\S]*iconScale,[\s\S]*\}: Readonly<\{[\s\S]*iconScale\?: JiraIssueIconScale;[\s\S]*\}> = \{\}\): React\.ReactElement \{/);
	assert.match(PAGE_SOURCE, /subtaskChrome="stroke"/);
	assert.match(PAGE_SOURCE, /const \[chrome, setChrome\] = useState<JiraIssueChrome>\("stroke"\);/);
	assert.match(PAGE_SOURCE, /interface JiraIssueAgentActivityStatesDemoProps \{[\s\S]*agentActivityLayout\?: JiraIssueAgentActivityLayout;[\s\S]*chrome\?: JiraIssueChrome;[\s\S]*onChromeChange\?: \(chrome: JiraIssueChrome\) => void;[\s\S]*\}/);
	assert.match(PAGE_SOURCE, /function JiraIssueAgentActivityStatesDemo\(\{[\s\S]*agentActivityLayout = "merged",[\s\S]*chrome = "raised",[\s\S]*onChromeChange,[\s\S]*\}: Readonly<JiraIssueAgentActivityStatesDemoProps> = \{\}\): React\.ReactElement \{/);
	assert.match(PAGE_SOURCE, /<JiraIssue[\s\S]*agentActivityLayout=\{agentActivityLayout\}[\s\S]*chrome=\{chrome\}[\s\S]*compact=\{compact\}/);
	assert.match(PAGE_SOURCE, /<JiraIssueAgentActivityStatesDemo[\s\S]*chrome=\{chrome\}[\s\S]*compact[\s\S]*onChromeChange=\{setChrome\}/);
	assert.match(PAGE_SOURCE, /<JiraIssueAgentActivityStatesDemo[\s\S]*agentActivityLayout="merged"[\s\S]*chrome=\{chrome\}/);
	assert.match(PAGE_SOURCE, /onChromeChange=\{setChrome\}/);
	assert.match(PAGE_SOURCE, /aria-pressed=\{chrome === "raised"\}/);
	assert.match(PAGE_SOURCE, /aria-pressed=\{chrome === "stroke"\}/);
	assert.match(DEMO_SOURCE, /export function JiraIssueDemoAgentActivityStatesExperimental\(\)/);
	assert.match(DEMO_SOURCE, /<JiraIssuePage variant="agent-activity-states-experimental" \/>/);
	assert.match(DETAILS_SOURCE, /id: "agent-activity-states-experimental"[\s\S]*demoSlug: "jira-issue-demo-agent-activity-states-experimental"/);
	assert.match(DETAILS_SOURCE, /description: "Agent activity uses the same merged chin and shared flyout for one or many attached sessions, matching the Jira Team EU26 experience\./u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"jira-issue-demo-agent-activity-states-experimental": dynamic\(/);
	assert.match(VARIANT_REGISTRY_SOURCE, /default: mod\.JiraIssueDemoAgentActivityStatesExperimental/);
});

test("Jira issue agent activity chin splits into one row per agent only when asked", () => {
	// Merged stays the default so every existing consumer keeps the aggregated
	// "Working" row; only an explicit split opt-in fans the agents out.
	assert.match(SOURCE, /agentActivityLayout\?: JiraIssueAgentActivityLayout;/);
	assert.match(SOURCE, /agentActivityLayout = "merged",/);
	assert.match(SOURCE, /<JiraIssueAgentActivityRows[\s\S]*layout=\{agentActivityLayout\}/);
	assert.match(AGENT_ACTIVITY_SOURCE, /layout\?: JiraIssueAgentActivityLayout;/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const rowGroups = groupJiraIssueAgentActivityRows\(activities, layout\);/u);
	// Split rows reuse the single-agent row verbatim, which is what makes each
	// row show its own avatar and cycling status.
	assert.match(AGENT_ACTIVITY_SOURCE, /<JiraIssueAgentActivityRow\s*\n\s*activities=\{rowGroup\.activities\}/u);
	assert.match(MODEL_SOURCE, /export type JiraIssueAgentActivityLayout = "merged" \| "split";/u);
	assert.match(MODEL_SOURCE, /if \(layout === "split"\) \{[\s\S]*activeActivities\.map\(\(activity\) => \(\{ activities: \[activity\], key: activity\.id \}\)\)/u);
});

test("agent session chins never open Rovo chat directly", () => {
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /Open \$\{activities\[0\]\?\.name \?\? "agent"\} in Rovo chat/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /onClick: handleOpenChat|sessionDrag\?\.bounds, handleOpenChat/u);
});
