const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const BLOCK_DIR = __dirname;

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}

function readRepoFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, "..", "..", "..", relativePath), "utf8");
}

// The Jira sidebar variant owns both the property-free hover surface and the
// richer detail body used by full detail panels. Property names stay on the
// row as accessible labels only — never as a visible label column.
const FLYOUT_BODY_PATH = "components/blocks/product-sidebar/variants/jira-session-flyout.tsx";
const FLYOUT_HANDLE_PATH = "components/blocks/product-sidebar/variants/jira-session-flyout-data.ts";
const FLYOUT_CARD_PATH = "components/blocks/product-sidebar/variants/jira-session-flyout-card.tsx";
const DETAILS_CARD_PATH = "components/blocks/product-sidebar/variants/jira-session-details-card.tsx";
const UNTRACKED_CARD_PATH = "components/blocks/product-sidebar/variants/jira-session-untracked-work-card.tsx";
const PULL_REQUEST_SECTION_PATH = "components/blocks/product-sidebar/variants/jira-session-pull-request-section.tsx";
const STATUS_INDICATOR_PATH = "components/blocks/product-sidebar/variants/jira-session-status-indicator.tsx";
const FLYOUT_DEMO_DATA_PATH = "components/blocks/agent-session-flyout/agent-session-flyout-data.ts";
const QUEUE_SESSION_DATA_PATH = "components/projects/jira-queue/data/queue-sessions.ts";
const HOVER_CARD_PATH = "components/ui/hover-card.tsx";
const HOVER_CARD_HANDLE_PATH = "components/ui/hover-card-handle.ts";
const AVATAR_PATH = "components/ui/avatar.tsx";
const AGENT_AVATAR_VISUAL_PATH = "components/ui-custom/agent-avatar-visual.tsx";
const QUEUE_DETAIL_ARTIFACTS_PATH = "components/projects/jira-queue/components/queue-detail-artifacts.tsx";
const QUEUE_DETAIL_PANEL_PATH = "components/projects/jira-queue/components/queue-detail-panel.tsx";

test("shared hover flyout defaults to session details and exposes composer and untracked-work variants", () => {
	const source = readRepoFile(FLYOUT_BODY_PATH);
	const cardShellSource = readRepoFile(FLYOUT_CARD_PATH);
	const cardSource = readRepoFile(UNTRACKED_CARD_PATH);
	const pullRequestSectionSource = readRepoFile(PULL_REQUEST_SECTION_PATH);
	assert.match(source, /export type JiraSessionFlyoutContent = "details" \| "composer" \| "untracked-work";/u);
	assert.match(source, /content = "details"/u);
	assert.match(source, /case "details":/u);
	assert.match(source, /import \{ JiraSessionDetailsCard \} from "\.\/jira-session-details-card";/u);
	assert.match(source, /<JiraSessionDetailsCard[\s\S]*animateAvatars=\{props\.animateAvatars\}[\s\S]*session=\{props\.session\}/u);
	assert.doesNotMatch(source, /<JiraSessionFlyoutBody session=\{session\} \/>/u);
	assert.match(source, /case "composer":/u);
	assert.match(source, /case "untracked-work":/u);
	assert.match(source, /import \{ JiraSessionUntrackedWorkCard \} from "\.\/jira-session-untracked-work-card";/u);
	assert.match(source, /<JiraSessionUntrackedWorkCard[\s\S]*session=\{props\.session\}/u);
	assert.doesNotMatch(source, /variant="untracked-work"/u);
	assert.match(source, /className="w-\[320px\] max-w-\[calc\(100vw-48px\)\] rounded-none shadow-none"/u);
	assert.equal(source.match(/className="w-\[320px\] bg-surface-overlay p-4 text-text"/gu)?.length ?? 0, 0);
	assert.doesNotMatch(source, /w-\[400px\]/u);
	assert.match(source, /showSeparator/u);
	assert.match(source, /flex min-w-0 shrink-0 items-center gap-1\.5 text-xs font-medium leading-4 text-text-subtle/u);
	assert.match(source, /className="shrink-0 text-xs font-normal text-text-subtlest"/u);
	assert.doesNotMatch(source, /<span aria-hidden="true"> · <\/span>/u);
	assert.match(
		cardShellSource,
		/cn\(\s*"flex w-\[320px\] max-w-\[calc\(100vw-48px\)\] flex-col gap-3 pt-3 text-text",\s*hasBodyRegion \|\| footer \? undefined : "pb-3",\s*\)/u,
	);
	assert.match(cardShellSource, /border-t border-border-disabled p-3/u);
	assert.match(cardShellSource, /body\?: ReactNode;/u);
	assert.match(cardShellSource, /artifacts\?: readonly SmartLinkItem\[\];/u);
	assert.match(cardShellSource, /\{hasBodyRegion \|\| footer \? \(/u);
	assert.match(cardShellSource, /\{hasBodyRegion \? \(/u);
	assert.match(cardShellSource, /import \{ SmartLink, type SmartLinkItem \} from "@\/components\/blocks\/smart-link";/u);
	assert.doesNotMatch(cardShellSource, /\bArtifacts\b/u);
	assert.doesNotMatch(cardShellSource, /artifactsId|useId/u);
	assert.match(cardShellSource, /<ul className="flex flex-col gap-1">/u);
	assert.match(
		cardShellSource,
		/<SmartLink[\s\S]*className="max-w-full"[\s\S]*item=\{item\}[\s\S]*showStatus=\{item\.variant === "pull-request"\}[\s\S]*side="right"[\s\S]*\/>/u,
	);
	assert.match(
		cardShellSource,
		/\{footer \? \(\s*<div className=\{cn\("flex flex-col border-t border-border-disabled p-3", footerClassName\)\}/u,
	);
	assert.match(cardSource, /import \{ JiraSessionFlyoutCard \} from "\.\/jira-session-flyout-card";/u);
	assert.match(cardSource, /import \{ JiraSessionPullRequestSection \} from "\.\/jira-session-pull-request-section";/u);
	assert.match(cardSource, /<JiraSessionFlyoutCard/u);
	assert.match(
		cardSource,
		/body=\{\s*hasPullRequest \? \(\s*<JiraSessionPullRequestSection[\s\S]*confidenceLabel=\{hasIssueKey \? rationaleTitle : "Pull request"\}[\s\S]*session=\{session\}[\s\S]*titleId=\{pullRequestTitleId\}/u,
	);
	assert.match(cardSource, /const hasPullRequest = session\.pullRequestNumber !== undefined;/u);
	assert.match(cardSource, /const showRationale = !hasPullRequest \|\| !hasIssueKey;/u);
	assert.match(cardSource, /\{showRationale \? \(/u);
	assert.doesNotMatch(cardSource, /SmartLink|sessionArtifactItems|JiraSessionDetailsBody/u);
	assert.match(cardSource, /High confidence to link/u);
	assert.match(cardSource, /Nothing available to link to/u);
	assert.match(cardSource, /Create a work item to track it\./u);
	assert.doesNotMatch(cardSource, /Create a new work item to start tracking this session\./u);
	assert.match(cardSource, /const archiveUnavailable = onArchiveSession === undefined;/u);
	assert.match(cardSource, /import ArchiveBoxIcon from "@atlaskit\/icon\/core\/archive-box";/u);
	assert.doesNotMatch(cardSource, /Lozenge/u);
	assert.match(cardSource, /This session appears related to \$\{session\.issueKey\}/u);
	assert.match(pullRequestSectionSource, /import MergeSuccessIcon from "@atlaskit\/icon\/core\/merge-success";/u);
	assert.match(pullRequestSectionSource, /className="flex size-4 shrink-0 items-center justify-center text-icon-accent-purple"/u);
	assert.match(pullRequestSectionSource, /<MergeSuccessIcon color="currentColor" label="" size="small" \/>/u);
	assert.match(pullRequestSectionSource, /#\{session\.pullRequestNumber\}/u);
	assert.match(pullRequestSectionSource, /\{pullRequestDescription\(session\)\}/u);
	assert.doesNotMatch(pullRequestSectionSource, /SmartLink/u);
	assert.match(source, /capturedSessionIds\?: ReadonlySet<string>;/u);
	assert.match(cardSource, /const linkLabel = hasIssueKey \? `Link to \$\{issueKey\}` : "Link work item";/u);
	assert.match(
		cardSource,
		/<ButtonGroup[\s\S]*aria-label=\{hasIssueKey \? `Link \$\{issueKey\}` : "Create work item actions"\}[\s\S]*className="w-full gap-2"[\s\S]*variant="separated"/u,
	);
	assert.match(cardSource, /aria-disabled=\{linkUnavailable\}/u);
	assert.match(cardSource, /"w-full flex-1 justify-center text-center"/u);
	assert.match(cardSource, /onClick=\{\(\) => onLinkWorkItem\?\.\(issueKey\)\}/u);
	assert.match(cardSource, /onClick=\{\(\) => onLinkWorkItem\?\.\(issueKey\)\}\s*size="compact"/u);
	assert.match(cardSource, /size="icon-compact"/u);
	assert.doesNotMatch(cardSource, /size="icon"/u);
	assert.match(cardSource, /ShowMoreHorizontalIcon/u);
	assert.doesNotMatch(cardSource, /ChevronDownIcon/u);
	assert.match(
		cardSource,
		/aria-label=\{`More actions for \$\{issueKey\}`\}/u,
	);
	assert.match(
		cardSource,
		/<DropdownMenuItem[\s\S]*disabled=\{createUnavailable\}[\s\S]*onSelect=\{\(\) => onCreateWorkItem\?\.\(\)\}[\s\S]*>\s*Create new work item[\s\S]*?<\/DropdownMenuItem>\s*<DropdownMenuItem[\s\S]*disabled=\{archiveUnavailable\}[\s\S]*>\s*\{archiveActionLabel\}\s*<\/DropdownMenuItem>/u,
	);
	assert.match(
		cardSource,
		/<DropdownMenuItem[\s\S]*disabled=\{archiveUnavailable\}[\s\S]*onSelect=\{\(\) => onArchiveSession\?\.\(\)\}[\s\S]*>\s*\{archiveActionLabel\}\s*<\/DropdownMenuItem>/u,
	);
	assert.match(
		cardSource,
		/const createButton = \([\s\S]*?size="compact"[\s\S]*?type="button"[\s\S]*?variant="outline"[\s\S]*?Create new work item/u,
	);
	assert.match(
		cardSource,
		/\{hasIssueKey \? \([\s\S]*?<DropdownMenu>[\s\S]*?<\/DropdownMenu>[\s\S]*?\) : \([\s\S]*?\{createButton\}[\s\S]*?\{archiveButton\}[\s\S]*?\)\}/u,
	);
	assert.match(cardSource, /const createButton = \([\s\S]*?Create new work item/u);
	assert.match(cardSource, /const archiveButton = \([\s\S]*?aria-label=\{archiveUnavailable \? `\$\{archiveActionLabel\} unavailable` : archiveActionLabel\}/u);
	assert.doesNotMatch(cardSource, /Add new subtask to|onSelect=\{\(\) => onAddAsSubtask/u);
	assert.doesNotMatch(cardSource, /onClick=\{onCreateWorkItem\}/u);
	assert.doesNotMatch(cardSource, /aria-disabled=\{createUnavailable\}/u);
	assert.match(source, /onLinkWorkItem\?: \(session: JiraSidebarSessionItem, workItemKey: string\) => void;/u);
	assert.match(source, /onCreateWorkItem\?: \(session: JiraSidebarSessionItem\) => void;/u);
	assert.match(source, /onArchiveSession\?: \(session: JiraSidebarSessionItem\) => void;/u);
	assert.match(source, /archiveActionLabel\?: string;/u);
	assert.match(source, /archiveActionLabel = "Archive",/u);
	assert.match(cardSource, /archiveActionLabel = "Archive",/u);
	assert.match(source, /onAddAsSubtask\?: \(session: JiraSidebarSessionItem, workItemKey: string\) => void;/u);
	assert.match(
		source,
		/function resolveJiraSessionUntrackedWorkActions[\s\S]*onArchiveSession: onArchiveSession === undefined[\s\S]*\(\) => onArchiveSession\(session\)/u,
	);
	assert.match(
		source,
		/onArchiveSession: onArchiveSession === undefined\s*\n\s*\? undefined\s*\n\s*: \(\) => onArchiveSession\(session\),/u,
	);
	assert.match(
		source,
		/<AgentStates[\s\S]*agent=\{\{[\s\S]*brandName: session\.brandName,[\s\S]*id: session\.id,[\s\S]*name: session\.agentName,[\s\S]*state=\{toAgentStatesState\(session\.status\)\}/u,
	);
	assert.match(source, /function toAgentStatesState\(/u);
	assert.match(source, /status === "awaiting-input"\) return "awaiting-input"/u);
	assert.match(source, /status === "running"\) return "working"/u);
	assert.match(source, /return "completed"/u);
});

test("untracked-work suggestion footer is visible by default and can be hidden through public owners", () => {
	const flyoutSource = readRepoFile(FLYOUT_BODY_PATH);
	const cardSource = readRepoFile(UNTRACKED_CARD_PATH);
	const blockSource = readBlockFile("components/agent-session-flyout.tsx");
	const agentSessionSource = readRepoFile("components/blocks/agent-session/index.tsx");
	const agentSessionTypes = readRepoFile("components/blocks/agent-session/agent-session-types.ts");
	const detailSource = readRepoFile("app/data/details/blocks/agent-session-flyout.ts");

	assert.match(cardSource, /showFooter = true,/u);
	assert.match(cardSource, /showFooter\?: boolean;/u);
	assert.match(
		cardSource,
		/aria-labelledby=\{[\s\S]*hasPullRequest[\s\S]*`\$\{titleId\} \$\{pullRequestTitleId\}`[\s\S]*showFooter[\s\S]*`\$\{titleId\} \$\{rationaleId\}`/u,
	);
	assert.match(cardSource, /footer=\{\s*showFooter \? \(/u);
	assert.match(cardSource, /<JiraSessionUntrackedWorkActions[\s\S]*?\/>\s*<\/>\s*\) : undefined\s*\}/u);
	assert.doesNotMatch(cardSource, /Lozenge/u);

	assert.match(flyoutSource, /showUntrackedWorkFooter\?: boolean;/u);
	assert.match(flyoutSource, /showFooter=\{props\.showUntrackedWorkFooter\}/u);
	assert.match(
		flyoutSource,
		/<JiraSessionFlyoutPayload[\s\S]*showUntrackedWorkFooter=\{showUntrackedWorkFooter\}/u,
	);
	assert.match(blockSource, /"showUntrackedWorkFooter"/u);
	assert.match(blockSource, /showUntrackedWorkFooter=\{showUntrackedWorkFooter\}/u);
	assert.match(agentSessionTypes, /showUntrackedWorkFooter\?: boolean;/u);
	assert.match(agentSessionSource, /showUntrackedWorkFooter=\{showUntrackedWorkFooter\}/u);
	assert.match(detailSource, /name: "showUntrackedWorkFooter"/u);
	assert.match(detailSource, /default: "true"/u);
});

test("untracked work shows lifecycle state in metadata and a matching corner indicator", () => {
	const cardShellSource = readRepoFile(FLYOUT_CARD_PATH);
	const cardSource = readRepoFile(UNTRACKED_CARD_PATH);
	const dataSource = readRepoFile(FLYOUT_HANDLE_PATH);
	const demoSource = readRepoFile("components/website/demos/blocks/agent-session-flyout-demo.tsx");
	const indicatorSource = readRepoFile(STATUS_INDICATOR_PATH);

	assert.match(dataSource, /export type JiraSessionFlyoutState = "needs-input" \| "working" \| "finished";/u);
	assert.match(
		dataSource,
		/JIRA_SESSION_FLYOUT_STATE:[\s\S]*"awaiting-input": "needs-input"[\s\S]*running: "working"[\s\S]*"pr-open": "finished"[\s\S]*merged: "finished"[\s\S]*stopped: "finished"/u,
	);
	assert.match(
		dataSource,
		/JIRA_SESSION_FLYOUT_STATE_LABEL:[\s\S]*"needs-input": "Needs input"[\s\S]*working: "Working"[\s\S]*finished: "Finished"/u,
	);
	assert.match(cardSource, /const lifecycleState = JIRA_SESSION_FLYOUT_STATE\[session\.status\];/u);
	assert.match(
		cardSource,
		/\{session\.agentName\}[\s\S]*>·<\/span>[\s\S]*\{JIRA_SESSION_FLYOUT_STATE_LABEL\[lifecycleState\]\}[\s\S]*>·<\/span>[\s\S]*\{JIRA_SESSION_UPDATED_LABEL\[session\.status\]\}/u,
	);
	assert.match(cardSource, /trailing=\{<JiraSessionStatusIndicator state=\{lifecycleState\} \/>\}/u);
	assert.match(indicatorSource, /case "needs-input":[\s\S]*text-icon-information[\s\S]*QuestionCircleFilledIcon[\s\S]*size="medium"/u);
	assert.match(indicatorSource, /case "working":[\s\S]*text-icon-subtlest[\s\S]*<Spinner label="" size="default" variant="experimental" \/>/u);
	assert.match(indicatorSource, /case "finished":[\s\S]*text-icon-success[\s\S]*StatusSuccessIcon[\s\S]*size="medium"/u);
	assert.equal(indicatorSource.match(/<span aria-hidden="true"/gu)?.length, 3);
	assert.equal(
		indicatorSource.match(/className="mt-0\.5 grid size-4 shrink-0 self-start place-items-center/gu)?.length,
		3,
	);
	assert.match(cardShellSource, /<div className="flex items-start gap-3 px-3">/u);
	assert.match(cardShellSource, /<h2 className="min-w-0 text-sm leading-5 font-normal text-text"/u);
	assert.doesNotMatch(cardShellSource, /<h2 className="[^"]*(?:truncate|whitespace-nowrap|line-clamp)/u);
	assert.match(demoSource, /id: "lw-no-link-demo",[\s\S]*state: "needs-input"/u);
	assert.match(demoSource, /item\.id === "lw-no-pr-session" \? \{ \.\.\.item, state: "running" as const \} : item/u);
});

test("details hover card uses Figma chrome without panel property rows", () => {
	const source = readRepoFile(FLYOUT_BODY_PATH);
	const cardShellSource = readRepoFile(FLYOUT_CARD_PATH);
	const detailsSource = readRepoFile(DETAILS_CARD_PATH);

	assert.match(source, /<JiraSessionDetailsCard[\s\S]*animateAvatars=\{props\.animateAvatars\}[\s\S]*session=\{props\.session\}/u);
	assert.match(cardShellSource, /flex w-\[320px\] max-w-\[calc\(100vw-48px\)\] flex-col gap-3 pt-3 text-text/u);
	assert.match(cardShellSource, /border-t border-border-disabled p-3/u);
	assert.match(detailsSource, /bodyClassName="gap-1"/u);
	assert.match(detailsSource, /import ScreenIcon from "@atlaskit\/icon\/core\/screen"/u);
	assert.match(detailsSource, /<ScreenIcon label="" size="small" \/>/u);
	assert.doesNotMatch(detailsSource, /DevicesIcon/u);
	assert.doesNotMatch(detailsSource, /FlyoutRow/u);
	assert.doesNotMatch(detailsSource, /SmartLink/u);
	assert.doesNotMatch(detailsSource, /AiAgentIcon/u);
	assert.doesNotMatch(detailsSource, /prStateLozenge/u);
	assert.doesNotMatch(detailsSource, /variant=\{prState\.variant\}/u);
	assert.doesNotMatch(detailsSource, /GithubLogo/u);
	assert.doesNotMatch(detailsSource, /IfElseIcon/u);
	assert.doesNotMatch(detailsSource, /session\.repository/u);
	assert.doesNotMatch(detailsSource, /session\.worktreePath/u);
	assert.match(detailsSource, /import BranchIcon from "@atlaskit\/icon\/core\/branch"/u);
	assert.match(detailsSource, /if \(!session\.branch \|\| session\.pullRequestNumber\) \{\s*return null;/u);
	assert.match(
		detailsSource,
		/<Avatar[\s\S]*label=\{session\.invokedBy\.name\}[\s\S]*shape="circle"[\s\S]*size="xs"/u,
	);
	assert.match(detailsSource, /JIRA_SESSION_UPDATED_LABEL\[session\.status\]/u);
	assert.match(
		detailsSource,
		/session\.status === "awaiting-input" \? \(\s*<Lozenge className="shrink-0" variant="information">Needs input<\/Lozenge>/u,
	);
	assert.match(
		detailsSource,
		/<Tag[\s\S]*color="gray"[\s\S]*type="agent"[\s\S]*variant="editor"/u,
	);
	assert.match(detailsSource, /artifacts=\{sessionArtifactItems\(session\)\}/u);
	assert.doesNotMatch(detailsSource, /DetailsPullRequestRow/u);
	assert.doesNotMatch(detailsSource, /PullRequestIcon/u);
	assert.doesNotMatch(detailsSource, /MergeSuccessIcon/u);
	assert.doesNotMatch(detailsSource, /MergeFailureIcon/u);
	assert.doesNotMatch(detailsSource, /text-text-success">\+\{session\.additions\}/u);
	assert.match(
		detailsSource,
		/<MetadataPathLink[\s\S]*className="min-w-0 truncate text-xs leading-5"[\s\S]*segmented title=\{session\.branch\}/u,
	);
	assert.match(detailsSource, /const visibleChecks = session\.status === "merged" && session\.checks\?\.failed === 0/u);
	assert.match(detailsSource, /if \(!visibleChecks\) \{\s*return null;/u);
	assert.match(detailsSource, /formatSessionChecks\(visibleChecks\)/u);
	assert.match(detailsSource, /<span aria-hidden="true" className="shrink-0 text-xs leading-4 text-text-subtlest">/u);
	assert.match(source, /function hostIcon\(/u);
	assert.match(source, /<DevicesIcon label="" size="small" \/>/u);
	assert.doesNotMatch(source, /ScreenIcon/u);
});

test("details render a PR Smart Link while untracked work embeds its PR summary", () => {
	const cardShellSource = readRepoFile(FLYOUT_CARD_PATH);
	const detailsSource = readRepoFile(DETAILS_CARD_PATH);
	const cardSource = readRepoFile(UNTRACKED_CARD_PATH);
	const pullRequestSectionSource = readRepoFile(PULL_REQUEST_SECTION_PATH);
	const dataSource = readRepoFile(FLYOUT_HANDLE_PATH);

	assert.match(dataSource, /toPullRequestSmartLink/u);
	assert.match(dataSource, /export function toSessionPullRequestSmartLinkStatus/u);
	assert.match(dataSource, /case "merged":\s*return "Merged"/u);
	assert.match(dataSource, /case "stopped":\s*return "Failed"/u);
	assert.match(dataSource, /case "pr-open":\s*return "Open"/u);
	assert.match(dataSource, /export function toSessionPullRequestSmartLink/u);
	assert.match(dataSource, /if \(session\.pullRequestNumber === undefined\) \{\s*return null;/u);
	assert.match(dataSource, /id: `\$\{session\.id\}-pull-request`/u);
	assert.match(dataSource, /href: session\.pullRequestUrl/u);
	assert.match(dataSource, /files: session\.files,/u);
	assert.match(dataSource, /targetBranch: session\.targetBranch,/u);
	assert.match(dataSource, /author: session\.pullRequestAuthor \?\? session\.invokedBy,/u);
	assert.match(dataSource, /description: session\.pullRequestDescription,/u);
	assert.match(dataSource, /export function sessionArtifactItems/u);
	assert.match(
		dataSource,
		/const pullRequest = toSessionPullRequestSmartLink\(session\);\s*return pullRequest === null \? \[\] : \[pullRequest\]/u,
	);
	assert.match(detailsSource, /artifacts=\{sessionArtifactItems\(session\)\}/u);
	assert.doesNotMatch(cardSource, /artifacts=|sessionArtifactItems/u);
	assert.doesNotMatch(cardShellSource, />\s*Artifacts\s*</u);
	assert.match(
		cardShellSource,
		/<SmartLink[\s\S]*className="max-w-full"[\s\S]*item=\{item\}[\s\S]*showStatus=\{item\.variant === "pull-request"\}[\s\S]*side="right"[\s\S]*\/>/u,
	);
	assert.doesNotMatch(detailsSource, /MetadataPathLink[\s\S]*#\$\{session\.pullRequestNumber\}/u);
	assert.match(pullRequestSectionSource, /const PULL_REQUEST_SUMMARY_PREFIX = \/\^#\{1,6\}\\s\*summary/u);
	assert.match(pullRequestSectionSource, /description\.replace\(PULL_REQUEST_SUMMARY_PREFIX, ""\)\.trim\(\)/u);
	assert.match(pullRequestSectionSource, /session\.pullRequestTitle\?\.trim\(\) \|\| `Pull request #\$\{session\.pullRequestNumber\}`/u);
	assert.doesNotMatch(cardSource, /<SmartLink |sessionArtifactItems/u);
	assert.doesNotMatch(pullRequestSectionSource, /SmartLink/u);
});

test("shared Agent States flyout forwards submission, timing, and stopped lifecycle data", () => {
	const source = readRepoFile(FLYOUT_BODY_PATH);
	const jiraSource = readRepoFile("components/blocks/product-sidebar/variants/jira.tsx");
	const queueSource = readRepoFile("components/projects/jira-queue/data/queue-sessions.ts");

	assert.match(source, /onSubmitPrompt\?: \(session: JiraSidebarSessionItem, prompt: string\) => void;/u);
	assert.match(source, /onSubmit=\{onSubmitPrompt \? \(prompt\) => onSubmitPrompt\(session, prompt\) : undefined\}/u);
	for (const prop of ["completedAtMs", "completedSecondsAgo", "initialElapsedSeconds", "startedAtMs"]) {
		assert.match(source, new RegExp(`${prop}=\\{session\\.${prop}\\}`, "u"));
		assert.match(jiraSource, new RegExp(`${prop}\\?: number;`, "u"));
	}
	assert.match(source, /function toAgentStatesMessage\(/u);
	assert.match(source, /status !== "stopped"\) return undefined;/u);
	assert.match(source, /This session was stopped before the requested work was completed\./u);
	assert.match(source, /message=\{toAgentStatesMessage\(session\.status\)\}/u);
	assert.match(queueSource, /const QUEUE_SESSION_TIMING:/u);
	assert.match(queueSource, /stopped: \{ completedSecondsAgo:/u);
});

// Detail panels still reuse the shared design-system property components rather
// than re-implementing them inside each panel.
test("shared detail body renders the session invoker beside its timestamp", () => {
	const source = readRepoFile(FLYOUT_BODY_PATH);
	const flyoutHandleSource = readRepoFile(FLYOUT_HANDLE_PATH);
	const jiraSource = readRepoFile("components/blocks/product-sidebar/variants/jira.tsx");
	const queueSessionSource = readRepoFile(QUEUE_SESSION_DATA_PATH);
	assert.match(source, /export function JiraSessionFlyoutBody\b/u);
	assert.match(source, /<div className="flex items-start justify-between gap-3">/u);
	assert.doesNotMatch(source, /<div className="flex items-center justify-between gap-3">/u);
	assert.match(
		source,
		/<p className="min-w-0 text-xs font-medium leading-5 text-text" title=\{session\.title\}>/u,
	);
	assert.doesNotMatch(source, /<p className="min-w-0 truncate[^"]*" title=\{session\.title\}>/u);
	assert.doesNotMatch(source, /<p className="[^"]*text-balance[^"]*" title=\{session\.title\}>/u);
	assert.match(source, /import\s*\{[^}]*Avatar[^}]*AvatarFallback[^}]*AvatarImage[^}]*\}\s*from\s*"@\/components\/ui\/avatar"/u);
	assert.match(
		source,
		/session\.invokedBy && session\.status !== "awaiting-input" \? \(\s*<Avatar[\s\S]*label=\{session\.invokedBy\.name\}[\s\S]*size="xs"[\s\S]*<AvatarImage alt="" src=\{session\.invokedBy\.src\} \/>[\s\S]*<AvatarFallback>\{actorInitials\(session\.invokedBy\.name\)\}<\/AvatarFallback>/u,
	);
	assert.match(
		source,
		/session\.status === "awaiting-input" \? \(\s*<Lozenge variant="information">Needs input<\/Lozenge>\s*\) : \(\s*<span className="text-\[12px\] leading-5 text-text-subtlest">\s*\{JIRA_SESSION_UPDATED_LABEL\[session\.status\]\}\s*<\/span>/u,
	);
	assert.match(queueSessionSource, /invokedBy\?: AsxQueueAssignee;/u);
	assert.match(queueSessionSource, /invokedBy: ASX_QUEUE_INVOKER,/u);
	assert.match(queueSessionSource, /invokedBy: session\.invokedBy,/u);
	assert.doesNotMatch(source, /text-\[12px\] leading-4 text-text-subtlest/u);
	assert.match(source, /import\s*\{[^}]*SmartLink[^}]*\}\s*from\s*"@\/components\/blocks\/smart-link"/u);
	assert.match(source, /import\s*\{[^}]*GithubLogo[^}]*\}\s*from\s*"@\/components\/ui\/logo-third-party"/u);
	assert.match(source, /import\s*\{[^}]*Lozenge[^}]*\}\s*from\s*"@\/components\/ui\/lozenge"/u);
	assert.match(source, /import\s*\{[^}]*Tag[^}]*\}\s*from\s*"@\/components\/ui\/tag"/u);
	assert.match(source, /import\s*\{[^}]*ProgressCircle[^}]*\}\s*from\s*"@\/components\/ui-custom\/progress-circle"/u);
	assert.match(jiraSource, /export interface JiraSidebarSessionChecks \{\s*failed: number;\s*passed: number;\s*\}/u);
	assert.match(jiraSource, /brandName\?: ThirdPartyLogoName;/u);
	assert.match(jiraSource, /vpkLogo\?: "rovo";/u);
	assert.match(jiraSource, /issueStatus\?: string;/u);
	assert.match(jiraSource, /invokedBy\?: JiraSidebarAssignee;/u);
	assert.match(source, /<SmartLink[\s\S]*className="min-w-0 max-w-full"[\s\S]*item=\{toWorkItem\(session\)\}[\s\S]*showStatus/u);
	assert.doesNotMatch(source, /showStatus=\{workItemRelationship === "primary"\}/u);
	assert.match(source, /function toWorkItemStatus\(/u);
	assert.match(source, /session\.issueStatus\?\.trim\(\)/u);
	assert.match(source, /status: \{\s*label: workItemStatus\.label/u);
	assert.match(source, /description: `Primary work item for \$\{session\.title\}\.`/u);
	assert.match(source, /actions: SMART_LINK_MODAL_ACTIONS,/u);
	// Agent renders as the canonical at-mention Tag; PR state renders as a Lozenge.
	assert.match(
		source,
		/<Tag[\s\S]*color="gray"[\s\S]*type="agent"[\s\S]*variant="editor"/u,
	);
	assert.match(
		source,
		/<AgentAvatarVisual[\s\S]*brandName=\{session\.brandName\}[\s\S]*sizePx=\{16\}[\s\S]*vpkLogo=\{session\.vpkLogo\}/u,
	);
	assert.doesNotMatch(source, /TileAvatar/u);
	assert.match(source, /<Lozenge variant=\{prState\.variant\}>/u);
	assert.match(
		source,
		/<ProgressCircle[\s\S]*aria-hidden[\s\S]*animated=\{false\}[\s\S]*size="xs"[\s\S]*value=\{checksTotal > 0 \? Math\.round\(\(session\.checks\.passed \/ checksTotal\) \* 100\) : 0\}[\s\S]*variant="outline"/u,
	);
	assert.match(flyoutHandleSource, /export function formatSessionChecks\(/u);
	assert.match(flyoutHandleSource, /`\$\{checks\.passed\}\/\$\{total\} passed \$\{checks\.failed\} failed`/u);
	assert.match(flyoutHandleSource, /`\$\{checks\.passed\}\/\$\{total\} passed`/u);
	assert.match(source, /formatSessionChecks\(session\.checks\)/u);
	assert.match(source, /className="shrink-0 text-xs font-normal text-text"/u);
	assert.doesNotMatch(source, /CheckCircleIcon/u);
});

test("nested Jira previews open right by default while Queue Details overrides them left", () => {
	const flyoutSource = readRepoFile(FLYOUT_BODY_PATH);
	const panelSource = readRepoFile(QUEUE_DETAIL_PANEL_PATH);
	const artifactsSource = readRepoFile(QUEUE_DETAIL_ARTIFACTS_PATH);

	assert.match(flyoutSource, /previewPosition\?: JiraSessionPreviewPosition/u);
	assert.match(flyoutSource, /const agentBannerSrc = getAgentProfileBannerSrc\(session\.agentAvatarSrc\);\s*preload\(agentBannerSrc, \{ as: "image" \}\);/u);
	assert.match(flyoutSource, /<HoverCardContent[\s\S]*align=\{previewPosition\?\.align \?\? "center"\}[\s\S]*alignOffset=\{previewPosition\?\.alignOffset \?\? 0\}[\s\S]*side=\{previewPosition\?\.side \?\? "right"\}/u);
	assert.match(flyoutSource, /<AgentProfileCard[\s\S]*surface="overlay"/u);
	assert.match(flyoutSource, /<SmartLink[\s\S]*align=\{previewPosition\?\.align \?\? "center"\}[\s\S]*alignOffset=\{previewPosition\?\.alignOffset \?\? 0\}[\s\S]*side=\{previewPosition\?\.side \?\? "right"\}/u);
	assert.match(panelSource, /const DETAIL_PREVIEW_POSITION = \{\s*align: "center",\s*alignOffset: 0,\s*side: "left",\s*\} as const;/u);
	assert.match(panelSource, /<JiraSessionFlyoutBody[\s\S]*previewPosition=\{DETAIL_PREVIEW_POSITION\}/u);
	assert.match(artifactsSource, /<SmartLink align="center" alignOffset=\{0\}[\s\S]*side="left"/u);
});

// The block delegates to the shared surface and reuses the /jira-golden-journeys-v0 seeds rather than
// re-declaring its own flyout card or placeholder lifecycle copy.
test("block delegates to the shared flyout surface and reuses /jira-golden-journeys-v0 data", () => {
	const source = readBlockFile("components/agent-session-flyout.tsx");
	const dataSource = readRepoFile(FLYOUT_DEMO_DATA_PATH);
	assert.match(
		source,
		/import\s*\{[^}]*JiraSessionFlyoutSurface[^}]*JiraSessionFlyoutTrigger[^}]*\}\s*from\s*"@\/components\/blocks\/product-sidebar\/variants\/jira-session-flyout"/u,
	);
	assert.match(source, /<JiraSessionFlyoutSurface[\s\S]*content=\{content\}[\s\S]*handle=\{flyoutHandle\}[\s\S]*onLinkWorkItem=\{onLinkWorkItem\}/u);
	assert.match(source, /<JiraSessionFlyoutTrigger[\s\S]*?session=\{session\}/u);
	assert.match(source, /AGENT_SESSION_FLYOUT_SESSIONS/u);
	assert.match(dataSource, /ASX_QUEUE_SESSION_SEEDS\.map\(createAsxQueueSidebarSessionItem\)/u);
	assert.doesNotMatch(source, /function AgentSessionFlyoutBody\b/u);
	assert.doesNotMatch(source, /STATUS_META|<h3\b|<section\b/u);
	assert.doesNotMatch(source, /paused for input|pull request is open|actively working/u);
});

// The demo and live sidebar use detached triggers connected to one Preview Card
// root. The shell follows the active trigger, immediately matches the incoming
// content size, and crossfades without adding counter-directional movement.
test("demo sessions share one moving shell with a fade-only content viewport", () => {
	const source = readBlockFile("components/agent-session-flyout.tsx");
	const flyoutSource = readRepoFile(FLYOUT_BODY_PATH);
	const flyoutHandleSource = readRepoFile(FLYOUT_HANDLE_PATH);
	const hoverCardSource = readRepoFile(HOVER_CARD_PATH);
	const hoverCardHandleSource = readRepoFile(HOVER_CARD_HANDLE_PATH);

	assert.match(source, /useState\(createJiraSessionFlyoutHandle\)/u);
	assert.equal(source.match(/<JiraSessionFlyoutSurface\b/gu)?.length, 1);
	assert.match(source, /export const AGENT_SESSION_FLYOUT_LIST_CLASSNAME/u);
	assert.match(source, /flex max-w-sm flex-col gap-1 rounded-lg border/u);
	assert.match(source, /cn\(AGENT_SESSION_FLYOUT_LIST_CLASSNAME, className\)/u);
	assert.match(source, /session\.branch && !session\.pullRequestNumber/u);
	assert.match(source, /<BranchIcon color="currentColor" label="Branch created"/u);
	assert.doesNotMatch(source, /<HoverCard\b/u);
	assert.match(flyoutHandleSource, /createHoverCardHandle<JiraSidebarSessionItem>\(\)/u);
	assert.match(flyoutSource, /cloneElement\(childElement, \{[\s\S]*onFocusCapture: \(event\) => \{[\s\S]*handle\.open\(triggerId\);/u);
	assert.match(flyoutSource, /event\.target\.matches\(":focus-visible"\)/u);
	assert.match(flyoutSource, /<HoverCardViewport\b/u);
	assert.match(flyoutSource, /\[&_\[data-current\]\]:transition-opacity/u);
	assert.match(flyoutSource, /\[&_\[data-previous\]\]:transition-opacity/u);
	assert.match(flyoutSource, /\[&_\[data-current\]\[data-starting-style\]\]:opacity-0/u);
	assert.match(flyoutSource, /\[&_\[data-previous\]\[data-ending-style\]\]:opacity-0/u);
	assert.doesNotMatch(flyoutSource, /data-\[activation-direction|translate-y-\[50%\]|will-change:transform/u);
	assert.match(flyoutSource, /transition-\[opacity,scale,translate\] duration-medium ease-in-out/u);
	assert.doesNotMatch(flyoutSource, /transition-\[[^\]]*(?:width|height)/u);
	assert.match(flyoutSource, /instantPosition\?: boolean/u);
	assert.match(flyoutSource, /instantPosition\s*\? "transition-none"\s*: "transition-\[top,left,right,bottom\] duration-medium ease-in-out motion-reduce:transition-none data-instant:transition-none"/u);
	assert.match(
		flyoutSource,
		/instantPosition\s*\?\s*"transition-none data-starting-style:opacity-100 data-starting-style:scale-100 data-ending-style:opacity-100 data-ending-style:scale-100"/u,
	);
	assert.match(
		flyoutSource,
		/instantPosition\s*\?\s*"\[&_\[data-current\]\]:transition-none \[&_\[data-previous\]\]:transition-none \[&_\[data-previous\]\[data-ending-style\]\]:opacity-0"/u,
	);
	assert.doesNotMatch(flyoutSource, /\[&_\[(?:data-current|data-previous)\]\]:h-\(--popup-height\)/u);
	assert.match(flyoutSource, /overflow-clip rounded-\[inherit\]/u);
	assert.match(flyoutSource, /motion-reduce:\[&_\[data-current\]\]:transition-none/u);
	assert.match(hoverCardHandleSource, /const createHoverCardHandle = PreviewCardPrimitive\.createHandle/u);
	assert.match(hoverCardSource, /function HoverCardViewport\b/u);
	assert.match(hoverCardSource, /positionerClassName\?: string/u);
});

test("instant session flyouts disable nested avatar enter motion", () => {
	const flyoutSource = readRepoFile(FLYOUT_BODY_PATH);
	const detailsSource = readRepoFile(DETAILS_CARD_PATH);
	const untrackedSource = readRepoFile(UNTRACKED_CARD_PATH);
	const avatarSource = readRepoFile(AVATAR_PATH);
	const agentAvatarSource = readRepoFile(AGENT_AVATAR_VISUAL_PATH);

	assert.match(flyoutSource, /animateAvatars=\{!instantPosition\}/u);
	assert.match(flyoutSource, /<JiraSessionDetailsCard\s+animateAvatars=\{props\.animateAvatars\}/u);
	assert.match(flyoutSource, /<JiraSessionUntrackedWorkCard[\s\S]*animateAvatars=\{props\.animateAvatars\}/u);
	assert.match(detailsSource, /animateAvatars = true/u);
	assert.match(detailsSource, /<Avatar[\s\S]*animate=\{animateAvatars\}/u);
	assert.match(detailsSource, /<AgentAvatarVisual[\s\S]*animate=\{animateAvatars\}/u);
	assert.match(untrackedSource, /animateAvatars = true/u);
	assert.match(untrackedSource, /<AgentAvatarVisual[\s\S]*animate=\{animateAvatars\}/u);
	assert.match(agentAvatarSource, /animate\?: boolean;/u);
	assert.match(agentAvatarSource, /<Avatar[\s\S]*animate=\{animate\}/u);
	assert.match(avatarSource, /animate\?: boolean/u);
	assert.match(avatarSource, /!animate \|\| reduce \|\| disabled/u);
});

test("board-scoped suspension closes Jira session flyouts and blocks trigger opens", () => {
	const flyoutSource = readRepoFile(FLYOUT_BODY_PATH);

	assert.match(flyoutSource, /export function JiraSessionFlyoutSuspensionProvider/u);
	assert.match(flyoutSource, /<JiraSessionFlyoutSuspensionContext value=\{suspended \? inactiveHandle : null\}>/u);
	assert.match(flyoutSource, /const suspensionHandle = use\(JiraSessionFlyoutSuspensionContext\);/u);
	assert.match(flyoutSource, /if \(suspended\) \{\s*handle\.close\(\);/u);
	assert.match(flyoutSource, /!suspended &&[\s\S]*handle\.open\(triggerId\)/u);
	assert.match(flyoutSource, /handle=\{suspensionHandle \?\? handle\}/u);
});

// SCM fields remain available to full detail panels. Visible rows are icon +
// value only; the property name is screen-reader-only so a label column cannot
// regress back into the flyout.
test("session flyout metadata is compact and property-free", () => {
	const source = readRepoFile(FLYOUT_BODY_PATH);
	assert.doesNotMatch(source, /grid-cols-\[16px_84px_minmax\(0,1fr\)\]/u);
	assert.match(source, /<span className="sr-only">\{label\}<\/span>/u);
	assert.match(source, /className="flex min-w-0 flex-1 items-center text-text"/u);
	assert.doesNotMatch(source, /<span className="text-text-subtlest">\{label\}<\/span>/u);
	assert.doesNotMatch(source, /font-mono/u);
	assert.match(source, /return \(\s*<div className="flex flex-col gap-2">/u);
	assert.doesNotMatch(source, /<Alert\b|<AlertTitle\b|>Development</u);
	for (const label of ["Session", "Agent", "Work item", "Pull request", "Checks", "Repository", "Branch", "Worktree"]) {
		assert.match(source, new RegExp(`label="${label}"`, "u"), `missing accessible property name "${label}"`);
	}
});

// The live Jira sidebar row renders the same property-free shared flyout.
test("the live sidebar row renders the shared flyout surface", () => {
	const jiraSource = readRepoFile("components/blocks/product-sidebar/variants/jira.tsx");
	assert.match(jiraSource, /JiraSessionFlyoutSurface,[\s\S]*JiraSessionFlyoutTrigger,[\s\S]*createJiraSessionFlyoutHandle/u);
	assert.match(jiraSource, /<JiraSessionFlyoutTrigger[\s\S]*?session=\{session\}/u);
	assert.match(jiraSource, /<JiraSessionFlyoutSurface handle=\{sessionFlyoutHandle\} \/>/u);
	assert.doesNotMatch(jiraSource, /JiraSessionHoverDetails/u);
});

test("demo presents the four sessions as one uninterrupted chat-history list", () => {
	const source = readBlockFile("components/agent-session-flyout.tsx");
	assert.match(source, /sessions\.map\(\(session\) => \([\s\S]*<JiraSessionFlyoutTrigger/u);
	assert.doesNotMatch(source, /AgentSessionFlyoutSection/u);
	assert.doesNotMatch(source, /gap-8/u);
});

// The four /jira-golden-journeys-v0 seeds must cover the states shown in the flyout screenshots and
// carry the PR metadata the flyout renders for local sessions.
test("/jira-golden-journeys-v0 seeds provide the four expected states with PR fields", () => {
	const seeds = readRepoFile("components/projects/jira-queue/data/queue-sessions.ts");

	for (const status of ["awaiting-input", "running", "pr-open", "merged"]) {
		assert.match(seeds, new RegExp(`status:\\s*"${status}"`, "u"), `missing seed with status "${status}"`);
	}
	// PR-bearing sessions carry a pull-request number + checks.
	assert.match(seeds, /pullRequestNumber:\s*1847/u);
	assert.match(seeds, /pullRequestNumber:\s*1842/u);
	assert.match(seeds, /checks:\s*\{ passed: 2, failed: 1 \}/u);
	assert.match(seeds, /checks:\s*\{ passed: 6, failed: 0 \}/u);
});

test("coding lifecycle demo seeds cover branch-only through merged PR", () => {
	const dataSource = readRepoFile(FLYOUT_DEMO_DATA_PATH);
	assert.doesNotMatch(dataSource, /AGENT_SESSION_FLYOUT_CODING_BRANCH_SESSIONS/u);
	assert.match(dataSource, /export const AGENT_SESSION_FLYOUT_CODING_LIFECYCLE_SESSIONS/u);
	assert.match(dataSource, /id: "coding-lifecycle-branch"/u);
	assert.match(dataSource, /title: "Branch created"/u);
	assert.match(dataSource, /title: "PR open with checks"/u);
	assert.match(dataSource, /title: "CI checks failed"/u);
	assert.match(dataSource, /title: "PR merged"/u);
	assert.match(dataSource, /title: "PR failed"/u);
	assert.match(
		dataSource,
		/id: "coding-lifecycle-branch",\s*jiraColumn: "In progress",\s*status: "running",\s*title: "Branch created",/u,
	);
	assert.match(dataSource, /checks: \{ passed: 2, failed: 0 \}/u);
	assert.match(dataSource, /checks: \{ passed: 2, failed: 1 \}/u);
	assert.match(dataSource, /checks: \{ passed: 3, failed: 0 \}/u);
	assert.match(dataSource, /checks: \{ passed: 0, failed: 3 \}/u);
	assert.match(dataSource, /status: "merged"/u);
	assert.match(dataSource, /status: "stopped"/u);
	assert.match(dataSource, /agentId: "pipeline-troubleshooter"/u);
	assert.match(dataSource, /name: "Jordan Lee"/u);
});

test("flyout list trailing icons follow the board View PR legend colors", () => {
	const source = readBlockFile("components/agent-session-flyout.tsx");

	assert.match(source, /subtlest: "text-icon-subtlest"/u);
	assert.match(source, /success: "text-icon-success"/u);
	assert.match(source, /discovery: "text-icon-discovery"/u);
	assert.match(source, /danger: "text-icon-danger"/u);
	assert.match(
		source,
		/<BranchIcon color="currentColor" label="Branch created"[\s\S]*"Branch created",\s*"subtlest"/u,
	);
	assert.match(
		source,
		/<PullRequestIcon color="currentColor" label="Pull request open"[\s\S]*"Pull request open",\s*"success"/u,
	);
	assert.match(
		source,
		/<MergeSuccessIcon color="currentColor" label="Pull request merged"[\s\S]*"Pull request merged",\s*"discovery"/u,
	);
	assert.match(source, /information: "text-icon-information"/u);
	assert.match(
		source,
		/<StatusInformationIcon color="currentColor" label="Needs input"[\s\S]*"Needs input",\s*"information"/u,
	);
	assert.match(
		source,
		/session\.pullRequestNumber && session\.status === "stopped"[\s\S]*<MergeFailureIcon color="currentColor" label="Pull request failed"[\s\S]*"Pull request failed",\s*"danger"/u,
	);
	assert.doesNotMatch(source, /text-icon-accent-purple/u);
	assert.doesNotMatch(source, /JiraSessionLifecycle/u);
});

test("block is registered across catalog, manifest, details, and demo registry", () => {
	assert.match(readRepoFile("components/website/registry/blocks.ts"), /"agent-session-flyout":\s*dynamic\(/u);
	assert.match(readRepoFile("app/data/details/blocks.ts"), /"agent-session-flyout":\s*AGENT_SESSION_FLYOUT_DETAIL/u);
	assert.match(readRepoFile("app/data/component-manifest.ts"), /blockComponent\("agent-session-flyout", "Agent Session Flyout"\)/u);
	assert.match(readRepoFile("app/data/components.ts"), /blockComponent\("agent-session-flyout", "Agent Session Flyout"\)/u);
});

test("catalog examples are separate surfaces without content tabs", () => {
	const source = readBlockFile("components/agent-session-flyout.tsx");
	const pageSource = readBlockFile("page.tsx");
	const demoSource = readRepoFile("components/website/demos/blocks/agent-session-flyout-demo.tsx");
	const detailSource = readRepoFile("app/data/details/blocks/agent-session-flyout.ts");
	const variantRegistry = readRepoFile("components/website/registry/blocks-variants.ts");

	assert.match(source, /content = "details"/u);
	assert.match(source, /content\?: JiraSessionFlyoutContent/u);
	assert.match(pageSource, /content = "details"/u);
	assert.doesNotMatch(pageSource, /FLYOUT_CONTENT/u);
	assert.doesNotMatch(pageSource, /label: "Details"/u);
	assert.doesNotMatch(pageSource, /label: "Composer"/u);
	assert.doesNotMatch(pageSource, /label: "Untracked work"/u);
	assert.doesNotMatch(pageSource, /aria-pressed/u);
	assert.doesNotMatch(pageSource, /from "@\/components\/ui\/button"/u);
	assert.match(pageSource, /sessions\?: readonly JiraSidebarSessionItem\[\]/u);
	assert.match(pageSource, /<AgentSessionFlyout[\s\S]*content=\{content\}[\s\S]*sessions=\{sessions\}/u);
	assert.match(pageSource, /onLinkWorkItem=\{/u);
	assert.match(pageSource, /onCreateWorkItem=\{/u);
	assert.match(pageSource, /onArchiveSession=\{/u);
	assert.match(pageSource, /onAddAsSubtask=\{/u);
	assert.match(pageSource, /aria-live="polite"/u);
	assert.match(demoSource, /export default function AgentSessionFlyoutDemo/u);
	assert.match(demoSource, /return <Page \/>;/u);
	assert.match(demoSource, /export function AgentSessionFlyoutDemoDetails/u);
	assert.match(demoSource, /<Page content="details" \/>/u);
	assert.match(demoSource, /export function AgentSessionFlyoutDemoComposer/u);
	assert.match(demoSource, /<Page content="composer" \/>/u);
	assert.match(demoSource, /from "@\/components\/blocks\/agent-session"/u);
	assert.match(demoSource, /export function AgentSessionFlyoutDemoUntrackedWork/u);
	assert.match(demoSource, /id: "lw-no-link-demo"/u);
	assert.match(demoSource, /issueKey: ""/u);
	assert.match(demoSource, /items=\{AGENT_SESSION_FLYOUT_UNTRACKED_WORK_ITEMS\.filter\(/u);
	assert.match(demoSource, /onArchiveSession=\{handleArchive\}/u);
	assert.match(demoSource, /className=\{AGENT_SESSION_FLYOUT_LIST_CLASSNAME\}/u);
	assert.match(
		readRepoFile("components/blocks/agent-session/agent-session-card.tsx"),
		/data-variant="uncaptured-work"/u,
	);
	assert.doesNotMatch(demoSource, /<Page content="untracked-work" \/>/u);
	assert.doesNotMatch(demoSource, /AgentSessionFlyoutDemoCodingBranch/u);
	assert.doesNotMatch(demoSource, /AGENT_SESSION_FLYOUT_CODING_BRANCH_SESSIONS/u);
	assert.match(demoSource, /export function AgentSessionFlyoutDemoCodingLifecycle/u);
	assert.match(demoSource, /<Page sessions=\{AGENT_SESSION_FLYOUT_CODING_LIFECYCLE_SESSIONS\} \/>/u);
	assert.match(detailSource, /name: "content"/u);
	assert.match(detailSource, /type: '"details" \| "composer" \| "untracked-work"'/u);
	assert.match(detailSource, /default: '"details"'/u);
	assert.match(detailSource, /title: "Details"/u);
	assert.match(detailSource, /demoSlug: "agent-session-flyout-demo-details"/u);
	assert.match(detailSource, /title: "Composer flyout"/u);
	assert.match(detailSource, /demoSlug: "agent-session-flyout-demo-composer"/u);
	assert.match(detailSource, /title: "Untracked work"/u);
	assert.match(detailSource, /demoSlug: "agent-session-flyout-demo-untracked-work"/u);
	assert.doesNotMatch(detailSource, /title: "Coding — branch created"/u);
	assert.doesNotMatch(detailSource, /agent-session-flyout-demo-coding-branch/u);
	assert.match(detailSource, /title: "Coding lifecycle"/u);
	assert.match(detailSource, /demoSlug: "agent-session-flyout-demo-coding-lifecycle"/u);
	assert.match(variantRegistry, /"agent-session-flyout-demo-details": dynamic/u);
	assert.match(variantRegistry, /default: mod\.AgentSessionFlyoutDemoDetails/u);
	assert.match(variantRegistry, /"agent-session-flyout-demo-composer": dynamic/u);
	assert.match(variantRegistry, /default: mod\.AgentSessionFlyoutDemoComposer/u);
	assert.match(variantRegistry, /"agent-session-flyout-demo-untracked-work": dynamic/u);
	assert.match(variantRegistry, /default: mod\.AgentSessionFlyoutDemoUntrackedWork/u);
	assert.doesNotMatch(variantRegistry, /agent-session-flyout-demo-coding-branch/u);
	assert.doesNotMatch(variantRegistry, /AgentSessionFlyoutDemoCodingBranch/u);
	assert.match(variantRegistry, /"agent-session-flyout-demo-coding-lifecycle": dynamic/u);
	assert.match(variantRegistry, /default: mod\.AgentSessionFlyoutDemoCodingLifecycle/u);
});
