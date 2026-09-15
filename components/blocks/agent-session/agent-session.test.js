const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const CARD_SOURCE = readFileSync(join(__dirname, "agent-session-card.tsx"), "utf8");
const SELECT_MARK_SOURCE = readFileSync(join(__dirname, "agent-session-select-mark.tsx"), "utf8");
const LIST_CARD_SOURCE = readFileSync(
	join(__dirname, "../agent-list/agent-list-card.tsx"),
	"utf8",
);
const LIST_CARD_ACTIONS_SOURCE = readFileSync(
	join(__dirname, "../agent-list/agent-list-card-actions.tsx"),
	"utf8",
);
const IDENTITY_SOURCE = readFileSync(
	join(__dirname, "../agent-list/agent-list-identity.tsx"),
	"utf8",
);
const LIST_ROW_ACTION_SOURCE = readFileSync(
	join(__dirname, "../agent-list/agent-list-row-action.tsx"),
	"utf8",
);
const COMPACT_CARD_SOURCE = readFileSync(
	join(__dirname, "agent-session-compact-card.tsx"),
	"utf8",
);
const MEDIUM_CARD_SOURCE = readFileSync(
	join(__dirname, "agent-session-medium-card.tsx"),
	"utf8",
);
const MEDIUM_DRAG_SOURCE = readFileSync(
	join(__dirname, "agent-session-medium-drag.tsx"),
	"utf8",
);
const MORE_MENU_SOURCE = readFileSync(
	join(__dirname, "agent-session-medium-more-menu.tsx"),
	"utf8",
);
const NOTCH_SOURCE = readFileSync(join(__dirname, "agent-session-notch.tsx"), "utf8");
const ARRIVAL_MOTION_SOURCE = readFileSync(
	join(__dirname, "agent-session-arrival-motion.ts"),
	"utf8",
);
const DATA_SOURCE = readFileSync(join(__dirname, "data.ts"), "utf8");
const DRAG_INTERACTIVE_SOURCE = readFileSync(
	join(__dirname, "agent-session-drag-interactive.ts"),
	"utf8",
);
const LIFECYCLE_SOURCE = readFileSync(join(__dirname, "agent-session-lifecycle.tsx"), "utf8");
const VIEWER_HINT_SOURCE = readFileSync(join(__dirname, "agent-session-viewer-hint.tsx"), "utf8");
const METADATA_SOURCE = readFileSync(join(__dirname, "agent-session-metadata.tsx"), "utf8");
const MENU_HOOK_SOURCE = readFileSync(join(__dirname, "use-agent-session-menu.ts"), "utf8");
const SESSION_MORE_MENU_SOURCE = readFileSync(join(__dirname, "agent-session-more-menu.tsx"), "utf8");
const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "agent-session-types.ts"), "utf8");
const WORK_ITEM_SOURCE = readFileSync(join(__dirname, "agent-session-work-item.ts"), "utf8");
const IDENTITY_LABEL_SOURCE = readFileSync(
	join(__dirname, "agent-session-identity-label.ts"),
	"utf8",
);
const FLYOUT_SOURCE = readFileSync(
	join(__dirname, "../product-sidebar/variants/jira-session-flyout.tsx"),
	"utf8",
);
const DEMO_SOURCE = readFileSync(
	join(__dirname, "../../website/demos/blocks/agent-session-demo.tsx"),
	"utf8",
);
const REGISTRY_SOURCE = readFileSync(
	join(__dirname, "../../website/registry/blocks.ts"),
	"utf8",
);
const DETAIL_SOURCE = readFileSync(
	join(__dirname, "../../../app/data/details/blocks/agent-session.ts"),
	"utf8",
);
const MANIFEST_SOURCE = readFileSync(
	join(__dirname, "../../../app/data/component-manifest.ts"),
	"utf8",
);
const COLUMN_RAIL_SOURCE = readFileSync(
	join(__dirname, "../agent-session-column/agent-session-column-rail.tsx"),
	"utf8",
);
const VARIANT_REGISTRY_SOURCE = readFileSync(
	join(__dirname, "../../website/registry/blocks-variants.ts"),
	"utf8",
);

test("renders each session as a solid uncaptured-work card around the shared row", () => {
	assert.match(CARD_SOURCE, /data-testid=\{"agent-session-row-" \+ item.id\}/u);
	assert.match(CARD_SOURCE, /rounded-lg text-left text-text/u);
	assert.match(CARD_SOURCE, /padding === "compact" \? "px-3 py-2" : "p-3"/u);
	assert.doesNotMatch(CARD_SOURCE, /border border-solid/u);
	assert.doesNotMatch(CARD_SOURCE, /\[li:not\(:last-child\)_&\]:border-b-0/u);
	assert.doesNotMatch(CARD_SOURCE, /dash-4-2/u);
	assert.doesNotMatch(CARD_SOURCE, /bg-surface-sunken/u);
	assert.doesNotMatch(CARD_SOURCE, /(?<!hover:)bg-surface(?!-sunken|-hovered)/u);
	assert.doesNotMatch(CARD_SOURCE, /bg-bg-accent-gray-subtlest/u);
	assert.doesNotMatch(CARD_SOURCE, /UncapturedWorkChin/u);
	assert.match(
		CARD_SOURCE,
		/import \{[\s\S]*AgentListIdentity,[\s\S]*AgentListRow,[\s\S]*type AgentListRowHoverActions,[\s\S]*\} from "@\/components\/blocks\/agent-list\/agent-list-card";/u,
	);
	assert.match(CARD_SOURCE, /<AgentListRow[\s\S]*hoverActions=\{hoverActions\}/u);
	assert.match(CARD_SOURCE, /<AgentListRow[\s\S]*isCompact=\{false\}/u);
	assert.match(CARD_SOURCE, /<AgentListRow[\s\S]*isSelected=\{showSelectedFill\}/u);
	assert.match(CARD_SOURCE, /<AgentListRow[\s\S]*showHoverActionsWhenSelected/u);
	assert.doesNotMatch(CARD_SOURCE, /isSelected=\{false\}/u);
	assert.match(CARD_SOURCE, /absolute left-1\.5 top-1\/2 size-1\.5 -translate-y-1\/2 rounded-full bg-icon-information/u);
	assert.doesNotMatch(CARD_SOURCE, /top-1\.5/u);
});

test("large uncaptured-work rows show the agent with its human invoker in a 32px identity", () => {
	assert.match(IDENTITY_SOURCE, /export function AgentListIdentity/u);
	assert.match(CARD_SOURCE, /<AgentListIdentity[\s\S]*agent=\{item\.agent\}[\s\S]*attributedBy=\{item\.invokedBy\}[\s\S]*attributionOrder="agent-first"[\s\S]*sizePx=\{32\}/u);
	assert.match(CARD_SOURCE, /renderIdentity=\{\(\) =>/u);
	assert.match(TYPES_SOURCE, /export function toAgentSessionVisibleIdentity/u);
	assert.match(TYPES_SOURCE, /kind: "person"/u);
	assert.match(TYPES_SOURCE, /avatarSrc: item\.invokedBy\.avatarSrc/u);
	assert.match(TYPES_SOURCE, /return item\.agent;/u);
	assert.doesNotMatch(DATA_SOURCE, /name: "person A"/u);
});

test("short rows keep the owner byline and move settled status to the hover-action slot", () => {
	assert.match(METADATA_SOURCE, /AgentListTime,/u);
	assert.doesNotMatch(METADATA_SOURCE, /AgentSessionProvenanceMetadata/u);
	assert.doesNotMatch(CARD_SOURCE, /AgentSessionProvenanceMetadata/u);
	assert.match(METADATA_SOURCE, /export function AgentSessionShortMetadata/u);
	assert.match(CARD_SOURCE, /<AgentSessionShortMetadata item=\{item\} \/>/u);
	assert.match(LIST_CARD_SOURCE, /\{metadata === undefined \? \(/u);
	assert.doesNotMatch(METADATA_SOURCE, /AgentSessionShortLifecycleIcon|QuestionCircleFilledIcon|StatusSuccessIcon/u);
	assert.match(LIFECYCLE_SOURCE, /export function AgentSessionShortLifecycleIcon[\s\S]*case "needs-input":[\s\S]*aria-label="Needs input"[\s\S]*text-icon-information[\s\S]*case "complete":[\s\S]*aria-label="Finished"[\s\S]*text-icon-success[\s\S]*case "running":[\s\S]*return null;/u);
	assert.equal((LIFECYCLE_SOURCE.match(/className="grid size-6 shrink-0 place-items-center text-icon-(?:information|success)"/gu) ?? []).length, 2);
	assert.match(CARD_SOURCE, /const lifecycleIndicator = isLongDensity[\s\S]*: item\.state === "needs-input" \|\| item\.state === "complete"\s*\? <AgentSessionShortLifecycleIcon state=\{item\.state\} \/>\s*: null;/u);
	assert.match(METADATA_SOURCE, /import ScreenIcon from "@atlaskit\/icon\/core\/screen";/u);
	assert.match(METADATA_SOURCE, /export function AgentSessionHostSegment[\s\S]*isLocal \? \(\s*<ScreenIcon color="currentColor" label="" size="small" \/>\s*\) : \(\s*<CloudIcon color="currentColor" label="" size="small" \/>\s*\)/u);
	assert.match(METADATA_SOURCE, /const label = isLocal \? "Local session" : "Cloud session";/u);
	assert.match(METADATA_SOURCE, /triggerRef\.current\?\.closest<HTMLElement>[\s\S]*scrollport\.scrollBy\([\s\S]*<TooltipContent onWheel=\{handleTooltipWheel\}/u);
	assert.match(
		METADATA_SOURCE,
		/<TooltipTrigger[\s\S]*render=\{\s*<span[\s\S]*aria-label=\{label\}[\s\S]*className="grid size-4 shrink-0 place-items-center text-icon-subtlest"[\s\S]*role="img"[\s\S]*tabIndex=\{0\}/u,
	);
	assert.doesNotMatch(METADATA_SOURCE, /<TooltipTrigger[\s\S]*<button/u);
	assert.doesNotMatch(METADATA_SOURCE, /\{isLocal \? "Local" : "Cloud"\}/u);
	assert.doesNotMatch(METADATA_SOURCE, /case "host"/u);
	assert.match(METADATA_SOURCE, /function toPullRequestNumberLabel[\s\S]*`#\$\{number\}`[\s\S]*export function AgentSessionShortMetadata[\s\S]*toPullRequestNumberLabel\(item\)[\s\S]*<AgentListPrStatusIcon status=\{item\.prStatus \?\? "created"\} \/>[\s\S]*underline-offset-2 hover:underline[\s\S]*\{pullRequestLabel\}/u);
	assert.doesNotMatch(METADATA_SOURCE, /<a[\s\S]*href=\{item\.sessionDetails\?\.pullRequestUrl/u);
	assert.doesNotMatch(CARD_SOURCE, /pullRequest/u);
	assert.doesNotMatch(CARD_SOURCE, /MetadataPathLink/u);
	assert.doesNotMatch(METADATA_SOURCE, /MetadataPathLink/u);
	assert.doesNotMatch(CARD_SOURCE, /machineName/u);
	assert.doesNotMatch(METADATA_SOURCE, /machineName/u);
	assert.match(DATA_SOURCE, /pullRequestNumber: 1306,/u);
	assert.match(DATA_SOURCE, /pullRequestTitle: "Add guest checkout to the storefront",/u);
	assert.match(DATA_SOURCE, /pullRequestUrl: "https:\/\/github\.com\/acme\/storefront\/pull\/1306",/u);
	assert.match(DATA_SOURCE, /repository: GITHUB_REPOSITORY/u);
	assert.match(DATA_SOURCE, /targetBranch: GITHUB_TARGET_BRANCH/u);
	assert.match(DATA_SOURCE, /branch: "feature\/shop-4821-guest-checkout"/u);
	assert.match(DATA_SOURCE, /files: 6,/u);
	assert.match(DATA_SOURCE, /additions: 86,/u);
	assert.match(DATA_SOURCE, /deletions: 21,/u);
	assert.match(DATA_SOURCE, /pullRequestAuthor: GITHUB_PR_AUTHOR/u);
	assert.match(DATA_SOURCE, /pullRequestDescription:/u);
	assert.match(DATA_SOURCE, /prStatus: "created"/u);
	assert.match(DATA_SOURCE, /prStatus: "merged"/u);
	assert.match(DATA_SOURCE, /prStatus: "failed"/u);
	assert.match(DATA_SOURCE, /id: "lw-no-pr-session"[\s\S]*timeLabel: "7m"[\s\S]*sessionDetails:/u);
	assert.doesNotMatch(/id: "lw-no-pr-session"[\s\S]*?\n\t\},/u.exec(DATA_SOURCE)?.[0] ?? "", /pullRequestNumber/u);
});

test("large remains the default while every card receives the selected size variant", () => {
	assert.match(
		TYPES_SOURCE,
		/export type AgentSessionVariant = "large" \| "medium-detached" \| "medium-attached" \| "small";/u,
	);
	assert.match(TYPES_SOURCE, /variant\?: AgentSessionVariant;/u);
	assert.match(INDEX_SOURCE, /variant = "large"/u);
	assert.match(INDEX_SOURCE, /const items = itemsProp \?\? \(isAttached \? AGENT_SESSION_ATTACHED_ITEMS : AGENT_SESSION_ITEMS\);/u);
	assert.match(INDEX_SOURCE, /data-variant=\{variant\}/u);
	assert.match(INDEX_SOURCE, /variant === "large"/u);
	assert.match(INDEX_SOURCE, /<AgentSessionCard/u);
	assert.match(INDEX_SOURCE, /<AgentSessionCompactCard/u);
	assert.match(INDEX_SOURCE, /captured=\{capturedItemIds\?\.has\(item\.id\) \?\? false\}/u);
	assert.match(TYPES_SOURCE, /issueKey\?: string;/u);
	assert.match(TYPES_SOURCE, /assignment\?: JiraIssueAgentAssignment;/u);
	assert.match(INDEX_SOURCE, /issueKey=\{issueKey\}/u);
	assert.match(INDEX_SOURCE, /render=\{<li data-testid=\{"agent-session-row-" \+ item\.id\} \/>\}/u);
});

test("medium detached is a 276px stroked white chip with the 32px combo identity and up-arrow", () => {
	assert.match(
		MEDIUM_CARD_SOURCE,
		/<AgentListIdentity[\s\S]*agent=\{item\.agent\}[\s\S]*attributedBy=\{item\.invokedBy\}[\s\S]*attributionOrder="agent-first"[\s\S]*sizePx=\{32\}/u,
	);
	assert.match(MEDIUM_CARD_SOURCE, /import ArrowUpIcon from "@atlaskit\/icon\/core\/arrow-up"/u);
	assert.match(MEDIUM_CARD_SOURCE, /<IconTile[\s\S]*icon=\{\s*<ArrowUpIcon/u);
	assert.match(MEDIUM_CARD_SOURCE, /iconSize="medium"/u);
	assert.match(MEDIUM_CARD_SOURCE, /variant="transparent"/u);
	assert.match(MEDIUM_CARD_SOURCE, /relative flex h-10 w-\[276px\] max-w-full items-center gap-2 rounded-\[10px\] border border-solid bg-surface px-2 text-left/u);
	assert.match(MEDIUM_CARD_SOURCE, /!captured && isNew \? "border-border-discovery" : "border-border-disabled"/u);
	assert.match(MEDIUM_CARD_SOURCE, /hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring\/50/u);
	assert.match(MEDIUM_CARD_SOURCE, /<button/u);
	assert.match(MEDIUM_CARD_SOURCE, /type="button"/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /JiraIssueAgentActivityRows/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /bg-bg-neutral/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /w-fit max-w-full items-center gap-2 bg-surface px-2/u);
	assert.match(MEDIUM_CARD_SOURCE, /isNew \? "ring-1 ring-border-discovery" : null/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /h-\[33px\]/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /sizePx=\{16\}/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /text-xs font-normal leading-4 text-text-subtlest/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /<AgentSessionMediumMoreMenu/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /LinkIcon/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /bg-bg-accent-gray-subtlest/u);
	assert.match(COMPACT_CARD_SOURCE, /captured=\{captured\}/u);
	assert.match(MEDIUM_CARD_SOURCE, /data-captured=\{captured \|\| undefined\}/u);
	assert.match(
		IDENTITY_LABEL_SOURCE,
		/return attributedBy === undefined[\s\S]*\? agent\.name[\s\S]*: `\$\{agent\.name\} with \$\{attributedBy\.name\}`;/u,
	);
	assert.match(
		IDENTITY_LABEL_SOURCE,
		/export function agentSessionIdentityLabel\(item: AgentSessionItem\): string \{\s*return agentIdentityLabel\(item\.agent, item\.invokedBy\);/u,
	);
	const dashSource = readFileSync(join(__dirname, "../../../app/dash-4-2.css"), "utf8");
	assert.doesNotMatch(dashSource, /@utility dash-4-4/u);
});

test("drag-source ghosts leave the grid accessibility tree while inert", () => {
	assert.match(CARD_SOURCE, /const isTransferSource = Boolean\(draggingIds\?\.has\(item\.id\)\);/u);
	assert.match(CARD_SOURCE, /aria-hidden=\{isTransferSource \|\| undefined\}/u);
	assert.match(CARD_SOURCE, /inert=\{isTransferSource \|\| undefined\}/u);
});

test("medium drag publishes the attach transfer only after the pointer moves", () => {
	// Publishing on pointerdown grows the card chin under the pill and arms
	// onLink, so a click without movement reattaches the session.
	assert.match(MEDIUM_DRAG_SOURCE, /SESSION_DRAG_PUBLISH_THRESHOLD_PX = 2/u);
	assert.match(MEDIUM_DRAG_SOURCE, /pointerOriginRef\.current = \{ x: event\.clientX, y: event\.clientY \}/u);
	assert.doesNotMatch(
		MEDIUM_DRAG_SOURCE,
		/onPointerDown: \(event: ReactPointerEvent<HTMLElement>\) => \{\s*\n\s*drag\.bind\.onPointerDown\(event\);\s*\n\s*publishSessionDrag\(true, event\);/u,
	);
	assert.match(MEDIUM_DRAG_SOURCE, /if \(moved\) \{[\s\S]*publishSessionDrag\(true, event\);/u);
});

test("large untracked-work cards opt into the shared session drag without collapsing their row", () => {
	assert.match(CARD_SOURCE, /sessionDrag\?: JiraIssueAgentSessionDragBinding;/u);
	assert.match(CARD_SOURCE, /<AgentSessionMediumDrag[\s\S]*preserveSourceFootprint[\s\S]*source="untracked"/u);
	assert.match(CARD_SOURCE, /\{\(bind\) => \{\s*const card = \(\s*<article[\s\S]*\{\.\.\.bind\}/u);
	assert.match(INDEX_SOURCE, /<AgentSessionCard[\s\S]*sessionDrag=\{sessionDrag\}/u);
	assert.match(MEDIUM_DRAG_SOURCE, /preserveSourceFootprint \? sourceHeight : undefined/u);
	assert.match(MEDIUM_DRAG_SOURCE, /source: source/u);
	assert.match(MEDIUM_DRAG_SOURCE, /data-session-drag-placeholder=\{preserveSourceFootprint \|\| undefined\}/u);
});

test("session drag ignores nested controls and suppresses the click after a real pointer drag", () => {
	assert.match(CARD_SOURCE, /from "\.\/agent-session-drag-interactive"/u);
	assert.match(MEDIUM_DRAG_SOURCE, /from "\.\/agent-session-drag-interactive"/u);
	assert.doesNotMatch(MEDIUM_DRAG_SOURCE, /export const SESSION_DRAG_INTERACTIVE_SELECTOR/u);
	assert.match(MEDIUM_DRAG_SOURCE, /SESSION_DRAG_INTERACTIVE_SELECTOR/u);
	assert.match(MEDIUM_DRAG_SOURCE, /event\.target\.closest\(SESSION_DRAG_INTERACTIVE_SELECTOR\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /interactiveTarget !== null && interactiveTarget !== event\.currentTarget/u);
	assert.match(MEDIUM_DRAG_SOURCE, /didPublishDragRef\.current = true/u);
	assert.match(MEDIUM_DRAG_SOURCE, /onClickCapture: \(event: ReactMouseEvent<HTMLElement>\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /event\.preventDefault\(\);\s*event\.stopPropagation\(\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /onPointerCancel: cancelSessionDrag/u);
});

test("medium more menu collapses until hover so the label can use the slot", () => {
	assert.match(MORE_MENU_SOURCE, /flex h-6 w-0 shrink-0 overflow-hidden/u);
	assert.match(MORE_MENU_SOURCE, /group-hover\/session-card:w-6/u);
	assert.match(MORE_MENU_SOURCE, /group-has-\[:focus-visible\]\/session-card:w-6/u);
	assert.match(MORE_MENU_SOURCE, /group-has-\[:focus-visible\]\/session-card:overflow-visible/u);
	assert.match(
		MORE_MENU_SOURCE,
		/aria-label=\{`More actions for \$\{label\} session`\}[\s\S]*size="icon-compact"/u,
	);
	assert.match(
		MORE_MENU_SOURCE,
		/<Icon className="text-icon-subtle" render=\{<ShowMoreHorizontalIcon label="" size="small" color="currentColor" \/>\} \/>/u,
	);
	assert.doesNotMatch(MORE_MENU_SOURCE, /size-3|grid-cols-\[0fr\]/u);
	assert.doesNotMatch(MORE_MENU_SOURCE, /(?:^|[\s"'`])hidden(?:[\s"'`]|$)/u);
	assert.match(MORE_MENU_SOURCE, /<DropdownMenuContent align="end" className="min-w-0 w-max">/u);
	assert.match(MORE_MENU_SOURCE, /if \(!hasSubtasks && !hasCreateWorkItem\) \{\s*\n\s*return null;/u);
	assert.match(MORE_MENU_SOURCE, /<DropdownMenuItem disabled=\{!hasSubtasks\} onSelect=\{\(\) => onSubtasks\?\.\(\)\}>\s*\n\s*Add as a subtask/u);
	assert.match(MORE_MENU_SOURCE, /<DropdownMenuItem disabled=\{!hasCreateWorkItem\} onSelect=\{\(\) => onCreateWorkItem\?\.\(\)\}>\s*\n\s*Create new/u);
	assert.match(INDEX_SOURCE, /onCreateWorkItem=\{onCreateWorkItem\}/u);
	assert.match(INDEX_SOURCE, /onSubtasks=\{onSubtasks\}/u);
});

test("medium preserves newly synced state and its one-shot arrival beat", () => {
	assert.match(MEDIUM_CARD_SOURCE, /const shouldPlayArrival = isArriving && !shouldReduceMotion;/u);
	assert.match(MEDIUM_CARD_SOURCE, /data-new=\{isNew \|\| undefined\}/u);
	assert.match(MEDIUM_CARD_SOURCE, /isNew \? "ring-1 ring-border-discovery" : null/u);
	assert.match(MEDIUM_CARD_SOURCE, /!captured && isNew \? "border-border-discovery" : "border-border-disabled"/u);
	assert.match(MEDIUM_CARD_SOURCE, /Newly synced, not yet reviewed/u);
	assert.match(MEDIUM_CARD_SOURCE, /absolute left-1 top-1\/2 size-1 -translate-y-1\/2 rounded-full bg-icon-information/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /absolute left-1 top-1 /u);
	assert.match(MEDIUM_CARD_SOURCE, /initial=\{shouldPlayArrival \? \{ opacity: 0, y: AGENT_SESSION_ARRIVAL_OFFSET_PX \} : false\}/u);
	assert.match(MEDIUM_CARD_SOURCE, /animate=\{shouldPlayArrival \? \{ opacity: 1, y: 0 \} : undefined\}/u);
	assert.match(INDEX_SOURCE, /isArriving=\{beatItemIds\?\.has\(item\.id\) \?\? false\}/u);
	assert.match(INDEX_SOURCE, /isNew=\{newItemIds\?\.has\(item\.id\) \?\? false\}/u);
});

test("small is the collapsed-column notch and stays keyboard operable when view is wired", () => {
	assert.match(COMPACT_CARD_SOURCE, /variant === "small"/u);
	assert.match(COMPACT_CARD_SOURCE, /import \{ AgentSessionNotchMark \} from "\.\/agent-session-notch";/u);
	assert.match(COMPACT_CARD_SOURCE, /flex h-5 w-8 items-center justify-center/u);
	assert.match(COMPACT_CARD_SOURCE, /onView === undefined \? "Preview" : "Open"/u);
	assert.match(COMPACT_CARD_SOURCE, /onClick=\{onView === undefined \? undefined : \(\) => onView\(item\)\}/u);
	assert.match(COMPACT_CARD_SOURCE, /<AgentSessionNotchMark isArriving=\{isArriving\} isNew=\{isNew\} \/>/u);
	// One 1px hairline, the same weight as a Pulse ruler rule. It never shrinks:
	// the magnified path is meant to outgrow its row. Standalone it has no rail
	// behind it, so `w-3` is its resting length and its own row's hover is the
	// only affordance available to it.
	assert.match(NOTCH_SOURCE, /"h-px shrink-0"/u);
	assert.match(NOTCH_SOURCE, /w-3 transition-\[background-color,scale\]/u);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /proximity/u);
	assert.match(NOTCH_SOURCE, /isNew \|\| isHighlighted \? NOTCH_EMPHASIS : NOTCH_AT_REST/u);
	assert.match(NOTCH_SOURCE, /const NOTCH_EMPHASIS = "scale-x-\[1\.6\] bg-icon";/u);
	assert.match(NOTCH_SOURCE, /"bg-icon-disabled",/u);
	assert.match(NOTCH_SOURCE, /group-hover\/notch:bg-icon/u);
	assert.match(NOTCH_SOURCE, /toAgentSessionNotchTone\(/u);
	assert.doesNotMatch(NOTCH_SOURCE, /toAgentSessionNotchOpacity|transition-opacity/u);
	assert.match(ARRIVAL_MOTION_SOURCE, /duration: 0\.25,\s*ease: \[0, 0\.4, 0, 1\]/u);
});

test("the row reveals one … menu where Agent List puts its hover pair", () => {
	// The reveal is the Agent List row's own generic slot, not a fork of its
	// markup — the card only supplies what goes in it.
	assert.match(
		CARD_SOURCE,
		/import \{[\s\S]*AgentListIdentity,[\s\S]*AgentListRow,[\s\S]*type AgentListRowHoverActions,[\s\S]*\} from "@\/components\/blocks\/agent-list\/agent-list-card";/u,
	);
	assert.match(CARD_SOURCE, /const hoverActions: AgentListRowHoverActions = \{/u);
	assert.match(CARD_SOURCE, /showMoreMenu = true/u);
	assert.match(CARD_SOURCE, /if \(!showMoreMenu\) \{\s*return undefined;/u);
	assert.match(CARD_SOURCE, /<AgentSessionMoreMenu[\s\S]*actions=\{menu\.actions\}/u);
	assert.match(CARD_SOURCE, /<AgentSessionMoreMenu[\s\S]*copied=\{menu\.copied\}/u);
	assert.match(CARD_SOURCE, /<AgentSessionMoreMenu[\s\S]*isCloud=\{isCloudSession\}/u);
	// Resume and Archive no longer have their own buttons; both moved into the menu.
	assert.doesNotMatch(CARD_SOURCE, /"Resume"/u);
	assert.doesNotMatch(CARD_SOURCE, /ArchiveBoxIcon|LibraryIcon/u);
	assert.doesNotMatch(CARD_SOURCE, /secondary:/u);
	// Approve is a triage decision the column surfaces inline, not a session
	// action, so it keeps the primary button slot.
	assert.match(CARD_SOURCE, /primary: approve\s*\?\s*\{/u);
	assert.match(CARD_SOURCE, /<CheckMarkIcon label="" size="small" \/>/u);
	assert.match(CARD_SOURCE, /approveActionLabel\(approve\.target\)/u);
	// The archived view reuses the same capability, so the shared row renames
	// itself rather than growing a second control.
	assert.match(CARD_SOURCE, /dismissLabel=\{visibilityLabel === "Archive" \? "Dismiss" : visibilityLabel\}/u);
	assert.match(CARD_SOURCE, /visibilityLabel = "Archive"/u);
	assert.doesNotMatch(CARD_SOURCE, /EyeOpenIcon|EyeOpenStrikethroughIcon|visibilityLabel = "Hide"|visibilityLabel === "Show"/u);
	assert.match(CARD_SOURCE, /group\/agent-row relative flex w-full min-w-0 cursor-default rounded-lg text-left text-text/u);
	assert.match(CARD_SOURCE, /aria-roledescription=\{bind \? "Draggable agent session" : undefined\}/u);
	assert.doesNotMatch(CARD_SOURCE, /hover:border-border(?!-disabled)/u);
	assert.doesNotMatch(CARD_SOURCE, /focus-within:border-border(?!-disabled)/u);
	assert.match(CARD_SOURCE, /hover:bg-surface-hovered/u);
	assert.match(CARD_SOURCE, /transition-\[border-radius\] duration-xxshort ease-out-practical/u);
	assert.doesNotMatch(CARD_SOURCE, /hover:bg-white/u);
	assert.doesNotMatch(CARD_SOURCE, /focus-within:bg-/u);
	assert.doesNotMatch(CARD_SOURCE, /active:bg-/u);
	assert.doesNotMatch(CARD_SOURCE, /group\/agent-row group\/uncaptured-work/u);
	// Dismiss calls the optional handler; the column supplies Archive vs
	// Unarchive so the row's copy matches the action.
	assert.match(MENU_HOOK_SOURCE, /onToggleVisibility\(item\)/u);
	assert.match(INDEX_SOURCE, /onToggleVisibility=\{onToggleVisibility\}/u);
	assert.match(INDEX_SOURCE, /visibilityLabel=\{visibilityLabel\}/u);
	assert.match(TYPES_SOURCE, /onToggleVisibility\?: \(item: AgentSessionItem\) => void;/u);
	assert.match(TYPES_SOURCE, /visibilityLabel\?: string;/u);
	assert.match(TYPES_SOURCE, /onItemHover\?: \(item: AgentSessionItem \| null\) => void;/u);
	assert.match(INDEX_SOURCE, /onItemHover=\{onItemHover\}/u);
	// Hover reporting stays first in each handler, ahead of any decorative
	// work the row also does on enter/leave (the card glow's pointer vars).
	assert.match(CARD_SOURCE, /onPointerEnter=\{\(event\) => \{\s*isHoveredRef\.current = true;\s*onItemHover\?\.\(item\);/u);
	assert.match(CARD_SOURCE, /onPointerLeave=\{\(event\) => \{\s*isHoveredRef\.current = false;\s*onItemHover\?\.\(null\);/u);
	// Regression: unmount cleanup may only clear the hover it owns. Firing it
	// unconditionally let a filtered/captured sibling wipe a highlight the
	// pointer was still resting on, with no pointerenter left to restore it.
	assert.match(
		CARD_SOURCE,
		/if \(isHoveredRef\.current\) \{\s*onItemHoverRef\.current\?\.\(null\);\s*\}/u,
	);
	assert.match(
		CARD_SOURCE,
		/useEffect\(\(\) => \{\s*onItemHoverRef\.current = onItemHover;\s*\}, \[onItemHover\]\)/u,
	);
	// Dismiss clears the hover highlight before removing the row, so a card that
	// disappears cannot leave its board counterpart lit.
	assert.match(MENU_HOOK_SOURCE, /onItemHover\?\.\(null\);\s*onToggleVisibility\(item\);/u);
	// The shared row fades actions in; uncaptured-work snaps them on.
	assert.match(LIST_CARD_ACTIONS_SOURCE, /group-data-\[variant=uncaptured-work\]\/agent-row:transition-none/u);
	assert.match(CARD_SOURCE, /data-variant="uncaptured-work"/u);
});

test("agent session hover keeps the default cursor instead of a drag-handle cursor", () => {
	assert.match(CARD_SOURCE, /group\/agent-row relative flex w-full min-w-0 cursor-default rounded-lg text-left text-text/u);
	assert.doesNotMatch(CARD_SOURCE, /cursor-grab(?!bing)/u);
	assert.doesNotMatch(CARD_SOURCE, /cursor-pointer/u);
});

test("the hover checkbox replaces the avatar instantly, with no opacity transition", () => {
	assert.match(CARD_SOURCE, /<AgentSessionSelectMark/u);
	assert.match(CARD_SOURCE, /selection is not avatar-only/u);
	assert.match(SELECT_MARK_SOURCE, /aria-hidden="true"/u);
	assert.match(SELECT_MARK_SOURCE, /onActivate\(selectionGestureFromModifierKeys\(event\)\)/u);
	assert.match(SELECT_MARK_SOURCE, /group-hover\/agent-row:opacity-100/u);
	assert.match(SELECT_MARK_SOURCE, /group-hover\/agent-row:opacity-0/u);
	assert.match(SELECT_MARK_SOURCE, /col-start-1 row-start-1 transition-none/u);
	assert.match(SELECT_MARK_SOURCE, /place-items-center rounded-full transition-none/u);
	assert.doesNotMatch(SELECT_MARK_SOURCE, /transition-opacity|duration-normal|ease-out-practical/u);
});

test("the untracked-work flyout owns capture, so the card has no footer chin", () => {
	assert.match(
		CARD_SOURCE,
		/import \{\s*JiraSessionFlyoutTrigger,\s*type JiraSessionFlyoutHandle,\s*\} from "@\/components\/blocks\/product-sidebar\/variants\/jira-session-flyout";/u,
	);
	assert.match(CARD_SOURCE, /<JiraSessionFlyoutTrigger/u);
	assert.match(CARD_SOURCE, /closeDelay=\{160\}/u);
	assert.match(FLYOUT_SOURCE, /onPointerDownCapture=\{\(event\) => \{/u);
	assert.match(FLYOUT_SOURCE, /handle\.close\(\);/u);
	assert.match(
		FLYOUT_SOURCE,
		/const suspensionHandle = use\(JiraSessionFlyoutSuspensionContext\);/u,
	);
	assert.match(INDEX_SOURCE, /<JiraSessionFlyoutSurface/u);
	assert.match(INDEX_SOURCE, /capturedSessionIds=\{capturedItemIds\}/u);
	assert.match(INDEX_SOURCE, /content="untracked-work"/u);
	assert.match(INDEX_SOURCE, /const \[flyoutHandle\] = useState\(createJiraSessionFlyoutHandle\);/u);
	assert.match(INDEX_SOURCE, /bindAgentSessionFlyoutActions/u);
	assert.match(INDEX_SOURCE, /capturedItemIds\?\.has\(item\.id\)/u);
	assert.match(
		INDEX_SOURCE,
		/resolveAgentSessionWorkItemKey\(\s*item,\s*getSuggestedWorkItemKey,\s*getSuggestedWorkItemKeys,/u,
	);
	assert.doesNotMatch(CARD_SOURCE, /UncapturedWorkChin/u);
	assert.doesNotMatch(INDEX_SOURCE, /UncapturedWorkChin/u);
});

test("drag suspension keeps the shared flyout consistently uncontrolled", () => {
	// Regression: conditionally spreading `open={false}` only while suspended
	// changed Base UI from uncontrolled to controlled and back after every drag.
	assert.match(
		FLYOUT_SOURCE,
		/<ConeSafezone<JiraSidebarSessionItem> handle=\{handle\} onOpenChange=\{onOpenChange\}>/u,
	);
	assert.doesNotMatch(
		FLYOUT_SOURCE,
		/\.\.\.\(suspended \? \{ open: false \} : \{\}\)/u,
	);
	assert.match(
		FLYOUT_SOURCE,
		/if \(suspended\) \{\s*handle\.close\(\);\s*\}/u,
	);
	assert.match(FLYOUT_SOURCE, /handle=\{suspensionHandle \?\? handle\}/u);
});

test("sessions share one moving untracked-work flyout instead of a popup per row", () => {
	// Same contract as agent-session-flyout / Agent List: one payload handle, one
	// surface, and a stable trigger host so Base UI can slide the popup between
	// rows. Motion layout on the trigger host remounts it, which closes the card.
	assert.equal(INDEX_SOURCE.match(/<JiraSessionFlyoutSurface\b/gu)?.length, 1);
	assert.equal(INDEX_SOURCE.match(/createJiraSessionFlyoutHandle/gu)?.length, 2);
	assert.doesNotMatch(CARD_SOURCE, /createJiraSessionFlyoutHandle|createHoverCardHandle|<HoverCard\b/u);
	assert.match(CARD_SOURCE, /<JiraSessionFlyoutTrigger[\s\S]*handle=\{flyoutHandle\}[\s\S]*render=\{<div className="w-full" \/>\}/u);
	assert.doesNotMatch(CARD_SOURCE, /<JiraSessionFlyoutTrigger[\s\S]*render=\{\s*<motion\.li/u);
	assert.match(CARD_SOURCE, /<motion\.li[\s\S]*<JiraSessionFlyoutTrigger/u);
	assert.match(INDEX_SOURCE, /onAddAsSubtask=\{flyoutActions\.onAddAsSubtask\}/u);
	assert.match(INDEX_SOURCE, /onCreateWorkItem=\{flyoutActions\.onCreateWorkItem\}/u);
	assert.match(INDEX_SOURCE, /onLinkWorkItem=\{flyoutActions\.onLinkWorkItem\}/u);
});

test("detached and large variants open the shared agent-session flyout; medium attached does not", () => {
	// Large connects inside AgentSessionCard; detached compact variants connect
	// at the list-item boundary. Medium attached is already on its work item, so
	// it renders a plain list row and skips the shared session-details surface.
	assert.match(CARD_SOURCE, /<JiraSessionFlyoutTrigger/u);
	assert.match(
		INDEX_SOURCE,
		/<JiraSessionFlyoutTrigger[\s\S]*render=\{<li data-testid=\{"agent-session-row-" \+ item\.id\} \/>\}[\s\S]*session=\{flyoutSession\}/u,
	);
	assert.match(INDEX_SOURCE, /variant === "medium-detached" \? sessionDrag : undefined/u);
	assert.doesNotMatch(
		INDEX_SOURCE,
		/return variant === "medium-detached" \? \([\s\S]*?\)\s*:\s*\(\s*<JiraSessionFlyoutTrigger/u,
	);
	assert.match(
		INDEX_SOURCE,
		/\{isAttached \? \(\s*<li data-testid="agent-session-attached-group">[\s\S]*<AgentSessionAttachedCard/u,
	);
	assert.match(
		INDEX_SOURCE,
		/<JiraSessionFlyoutTrigger[\s\S]*render=\{<li data-testid=\{"agent-session-row-" \+ item\.id\} \/>\}[\s\S]*\{compactCard\}[\s\S]*<\/JiraSessionFlyoutTrigger>/u,
	);
	assert.doesNotMatch(INDEX_SOURCE, /renderMore=/u);
	assert.match(COMPACT_CARD_SOURCE, /onView === undefined && !flyout/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /showAssignmentFlyout/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /JiraIssueAgentActivityRows/u);
	assert.match(
		INDEX_SOURCE,
		/\{showUntrackedWorkFlyout \? \(\s*<JiraSessionFlyoutSurface[\s\S]*content="untracked-work"[\s\S]*handle=\{flyoutHandle\}/u,
	);
	// The list and the collapsed rail are the same hover surface at two widths,
	// so both snap. Dropping `instantPosition` here would animate the shell on
	// every row-to-row hover and diverge from the rail mid-collapse.
	assert.match(
		INDEX_SOURCE,
		/<JiraSessionFlyoutSurface[\s\S]*handle=\{flyoutHandle\}\s*instantPosition\s/u,
	);
	assert.match(COLUMN_RAIL_SOURCE, /<JiraSessionFlyoutSurface[\s\S]*instantPosition/u);
	assert.doesNotMatch(INDEX_SOURCE, /\{variant === "large" \? \(\s*<JiraSessionFlyoutSurface/u);
});

// Fast Refresh can only preserve a component's state when its file exports
// nothing but components, so the flyout's suggestion helper lives on its own.
test("the card file exports only a component", () => {
	assert.doesNotMatch(CARD_SOURCE, /suggestedAgentSessionWorkItemKey/u);
	assert.match(WORK_ITEM_SOURCE, /export function suggestedAgentSessionWorkItemKey/u);
	assert.match(WORK_ITEM_SOURCE, /item.sessionDetails\?\.issueKey/u);
	assert.match(
		INDEX_SOURCE,
		/import \{\s*bindAgentSessionFlyoutActions,\s*resolveAgentSessionWorkItemKey,\s*toAgentSessionUntrackedWorkFlyoutItem,\s*\} from "\.\/agent-session-work-item";/u,
	);
	assert.match(INDEX_SOURCE, /toJiraIssueAgentActivityFromSession,/u);
});

test("the prototype menu keeps host-appropriate actions enabled without callbacks", () => {
	// Copying writes to the clipboard before `onCopyResume` ever runs, so a row
	// the host cannot resume must not execute the copy action.
	assert.match(
		CARD_SOURCE,
		/const canResume = \(isResumable\?\.\(item\) \?\? true\) && resumeCommand\.length > 0;/u,
	);
	assert.match(MENU_HOOK_SOURCE, /onCopyPrompt: canResume && !isCloud \? handleCopyPrompt : undefined,/u);
	assert.match(CARD_SOURCE, /toAgentListResumeCommand\(item\)/u);
	assert.match(CARD_SOURCE, /const isCloudSession = !isLocalAgentListItem\(item\);/u);
	// Continue in is local-only; the record actions are cloud-only. Each is also
	// backed by optional callbacks, so unimplemented prototype actions are no-ops.
	assert.match(MENU_HOOK_SOURCE, /onContinueInAgent: onContinueInAgent === undefined \|\| isCloud/u);
	assert.match(MENU_HOOK_SOURCE, /onDelete: onDeleteSession === undefined \|\| !isCloud/u);
	assert.match(MENU_HOOK_SOURCE, /onRename: onRenameSession === undefined \|\| !isCloud/u);
	assert.match(MENU_HOOK_SOURCE, /onDismiss: onToggleVisibility === undefined/u);
	assert.doesNotMatch(MENU_HOOK_SOURCE, /onUnlink/u);
	assert.doesNotMatch(SESSION_MORE_MENU_SOURCE, /Unlink|LinkBrokenIcon|onUnlink/u);

	assert.match(SESSION_MORE_MENU_SOURCE, /onOpenChange: \(open: boolean\) => void;/u);
	assert.match(CARD_SOURCE, /onOpenChange=\{menu\.setIsOpen\}/u);
	assert.match(CARD_SOURCE, /onMoreMenuOpenChange,/u);
	assert.match(MENU_HOOK_SOURCE, /onMoreMenuOpenChange\?: \(open: boolean\) => void;/u);
	assert.match(MENU_HOOK_SOURCE, /onMoreMenuOpenChange\?\.\(open\);/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /<DropdownMenu onOpenChange=\{onOpenChange\} open=\{open\}>/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /<DropdownMenuLabel>Continue in<\/DropdownMenuLabel>/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /description="Copy prompt"[\s\S]*<TerminalIcon label="" size="small" \/>[\s\S]*Terminal/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /import TerminalIcon from "@atlaskit\/icon-lab\/core\/terminal";/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /<EditIcon label="" size="small" \/>[\s\S]*Rename/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /<DeleteIcon label="" size="small" \/>[\s\S]*variant="destructive"[\s\S]*Delete/u);
	// Order below the separator: work-item picker, then Dismiss. The picker's own contract lives in agent-session-link-work-item.test.js.
	assert.match(SESSION_MORE_MENU_SOURCE, /<DropdownMenuSeparator \/>\s*\{showLinkWorkItemMenuItem && canPickWorkItem \?[\s\S]*<DropdownMenuItem[\s\S]*\{dismissLabel\}/u);
	// Missing callbacks must never dim or disable prototype menu rows.
	assert.doesNotMatch(SESSION_MORE_MENU_SOURCE, /disabled[= >]/u);
	// The trigger must not start a card drag, and the card's click guard already
	// exempts buttons and menu items from activating the row.
	assert.match(SESSION_MORE_MENU_SOURCE, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /data-session-drag-ignore=""/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /className="size-6 shadow-none focus-visible:ring-0"/u);
	assert.doesNotMatch(SESSION_MORE_MENU_SOURCE, /aria-expanded:border-transparent/u);
	assert.doesNotMatch(SESSION_MORE_MENU_SOURCE, /aria-expanded:bg-surface-hovered/u);
	assert.doesNotMatch(SESSION_MORE_MENU_SOURCE, /aria-expanded:text-text-subtle/u);
	// Rest/open icon color comes from Button's ghost + selected contract.
	assert.doesNotMatch(SESSION_MORE_MENU_SOURCE, /className="text-icon-subtle"/u);
	assert.match(DRAG_INTERACTIVE_SOURCE, /"\[role=menuitem\]"/u);
	assert.match(DRAG_INTERACTIVE_SOURCE, /"\[data-slot=dropdown-menu-trigger\]"/u);
});

test("copying the prompt confirms with a green check the reveal cannot swallow", () => {
	// The popup takes the pointer off the row and the confirmation outlives the
	// hover that produced it; both would collapse the reveal without a pin.
	assert.match(
		CARD_SOURCE,
		/pinned: isFlyoutActive \|\| \(showMoreMenu && role === "owner" && \(menu\.isOpen \|\| menu\.copied\)\),/u,
	);
	assert.match(LIST_CARD_SOURCE, /pinned\?: boolean;/u);
	assert.match(LIST_CARD_ACTIONS_SOURCE, /pinned && "grid-cols-\[1fr\]"/u);
	assert.match(LIST_CARD_ACTIONS_SOURCE, /pinned && "pointer-events-auto opacity-100"/u);
	assert.match(LIST_CARD_SOURCE, /overlayHoverActions && hoverActions\?\.pinned && "pointer-events-none invisible"/u);
	assert.match(
		LIST_CARD_SOURCE,
		/const overlayHoverActions = showHoverActions[\s\S]*hoverActions\?\.menu !== undefined/u,
	);
	assert.match(LIST_CARD_ACTIONS_SOURCE, /if \(overlay\) \{/u);
	assert.match(
		LIST_CARD_ACTIONS_SOURCE,
		/"pointer-events-none absolute inset-y-0 right-0 flex w-6 items-center justify-center opacity-0"/u,
	);
	assert.match(LIST_CARD_ACTIONS_SOURCE, /group-has-\[\[aria-expanded=true\]\]\/agent-row:pointer-events-auto/u);
	assert.match(LIST_CARD_ACTIONS_SOURCE, /data-agent-list-card-actions=""/u);
	assert.match(LIST_CARD_ACTIONS_SOURCE, /has-\[:focus-visible\]:pointer-events-auto has-\[:focus-visible\]:opacity-100/u);
	assert.match(
		LIST_CARD_SOURCE,
		/group-has-\[\[data-agent-list-card-actions\]:focus-within\]\/agent-row:pointer-events-none/u,
	);

	assert.match(MENU_HOOK_SOURCE, /export const AGENT_SESSION_COPIED_RESET_MS = 2000;/u);
	assert.match(MENU_HOOK_SOURCE, /setCopied\(true\)/u);
	assert.match(MENU_HOOK_SOURCE, /setCopied\(false\);\s*\}, AGENT_SESSION_COPIED_RESET_MS\)/u);
	// The timeout is cleared on unmount so a removed row cannot set state later.
	assert.match(MENU_HOOK_SOURCE, /useEffect\(\(\) => \(\) => \{\s*window\.clearTimeout\(resetRef\.current\);\s*\}, \[\]\)/u);

	// Confirmation lives on the Terminal row. The trigger stays a more-actions
	// button; selecting Terminal prevents the menu from closing so the row's
	// own selected check is visible.
	assert.match(SESSION_MORE_MENU_SOURCE, /render=\{<ShowMoreHorizontalIcon color="currentColor" label="" size="small" \/>\}/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /aria-label=\{`More actions for \$\{item\.title\}`\}/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /selected=\{copied\}/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /event\.preventDefault\(\);\s*actions\.onCopyPrompt\?\.\(\)/u);
	assert.doesNotMatch(SESSION_MORE_MENU_SOURCE, /CheckMarkIcon|Copied prompt|TooltipContent/u);
	assert.doesNotMatch(SESSION_MORE_MENU_SOURCE, /role="img"/u);
});

test("the long density is title-led, with its own metadata line and lifecycle", () => {
	assert.match(TYPES_SOURCE, /export type AgentSessionDensity = "short" \| "long";/u);
	assert.match(TYPES_SOURCE, /density\?: AgentSessionDensity;/u);
	assert.match(INDEX_SOURCE, /density = "short",/u);
	assert.match(INDEX_SOURCE, /<AgentSessionCard[\s\S]*density=\{density\}/u);
	assert.match(CARD_SOURCE, /const isLongDensity = density === "long";/u);
	// A triage mark lives on the leading avatar, so a markable row keeps its
	// identity column even in the title-led density.
	assert.match(CARD_SOURCE, /const hideIdentity = isLongDensity && mark == null;/u);
	assert.match(CARD_SOURCE, /<AgentListRow[\s\S]*hideIdentity=\{hideIdentity\}/u);
	assert.match(CARD_SOURCE, /lifecycle=\{lifecycleIndicator\}/u);
	assert.match(CARD_SOURCE, /const lifecycleIndicator = isLongDensity\s*\? role === "expired"\s*\? <AgentSessionExpiredHint \/>\s*: <AgentSessionLifecycle showLabel=\{showLifecycleLabel\} state=\{item\.state\} \/>\s*: item\.state === "needs-input" \|\| item\.state === "complete"\s*\? <AgentSessionShortLifecycleIcon state=\{item\.state\} \/>\s*: null;/u);
	assert.match(CARD_SOURCE, /<AgentSessionLongMetadata item=\{item\} \/>/u);
	assert.match(CARD_SOURCE, /"group\/agent-row relative flex w-full min-w-0 cursor-default rounded-lg/u);
	assert.match(
		METADATA_SOURCE,
		/case "agent":\s*return \(\s*<span className="flex min-w-0 items-center gap-1">\s*<LongMetadataIdentity item=\{item\} \/>\s*<span className="min-w-0 truncate text-text-subtle" title=\{segment\.label\}>/u,
	);
	assert.match(
		METADATA_SOURCE,
		/segment\.kind === "artifact" \|\| segment\.kind === "agent"\s*\? "min-w-0 shrink"\s*: "shrink-0"/u,
	);
	assert.match(
		METADATA_SOURCE,
		/<span className="min-w-0 truncate text-text-subtlest" title=\{item\.agent\.name\}>/u,
	);
	assert.match(
		METADATA_SOURCE,
		/case "time":\s*return \(\s*<span className="flex shrink-0 items-center gap-1 text-nowrap">\s*\{segment\.host === undefined \? null : \(\s*<AgentSessionHostSegment isLocal=\{segment\.host === "local"\} \/>/u,
	);
	assert.match(CARD_SOURCE, /<AgentSessionShortMetadata item=\{item\} \/>/u);
	assert.doesNotMatch(METADATA_SOURCE, /case "status"/u);
	assert.match(METADATA_SOURCE, /<CyclingByline[\s\S]*contentKey=\{toolCall\}[\s\S]*<Shimmer[\s\S]*case "tool-call":[\s\S]*<AgentSessionToolCall toolCalls=\{segment\.toolCalls \?\? \[\]\} \/>/u);
	assert.match(
		METADATA_SOURCE,
		/<AgentListAttributionAvatarGroup\s+agent=\{item\.agent\}\s+attributedBy=\{item\.invokedBy\}\s+attributionOrder="human-first"\s+sizePx=\{16\}/u,
	);
	assert.match(
		IDENTITY_SOURCE,
		/export function AgentListAttributionAvatarGroup[\s\S]*<AvatarGroup[\s\S]*className=\{cn\("shrink-0", className\)\}[\s\S]*label=\{`\$\{agent\.name\}, used by \$\{attributedBy\.name\}`\}/u,
	);
	assert.doesNotMatch(IDENTITY_SOURCE, /gap-1 space-x-0/u);
	assert.doesNotMatch(
		/function LongMetadataIdentity[\s\S]*?\n\}/u.exec(METADATA_SOURCE)?.[0] ?? "",
		/<AgentListIdentity/u,
	);
	// The shared row grew symmetric overrides rather than a session-specific fork.
	assert.match(LIST_CARD_SOURCE, /hideIdentity\?: boolean;/u);
	assert.match(LIST_CARD_SOURCE, /lifecycle\?: ReactNode;/u);
	assert.match(LIST_CARD_SOURCE, /stateAwareTitle\?: boolean;/u);
	// `undefined` falls back to the built-in gate; `null` omits the slot.
	assert.match(
		LIST_CARD_SOURCE,
		/const lifecycleNode = lifecycle === undefined\s*\? \(stateMeta\.showLifecycle \? <LifecycleIndicator state=\{item\.state\} \/> : null\)\s*: lifecycle;/u,
	);
	assert.match(LIST_CARD_SOURCE, /\{hideIdentity \? null : \(/u);
	// Agent Session cards always keep the authored work title. Every density keeps
	// lifecycle outside the byline in its trailing control slot.
	assert.match(CARD_SOURCE, /stateAwareTitle=\{false\}/u);
	assert.match(TYPES_SOURCE, /export type AgentSessionRole = "owner" \| "viewer" \| "expired"/u);
	assert.match(CARD_SOURCE, /const viewSession = role === "owner" \? onView : undefined/u);
	assert.match(CARD_SOURCE, /viewSession\?\.\(item\)/u);
	assert.match(CARD_SOURCE, /case "viewer":\s*return <AgentSessionViewerHint \/>;/u);
	// An expired short row has no resting slot, so its hint joins the hover column.
	assert.match(CARD_SOURCE, /case "expired":\s*(?:\/\/[^\n]*\n\s*)*return isLongDensity \? undefined : <AgentSessionExpiredHint \/>;/u);
	assert.match(CARD_SOURCE, /role === "expired"\s*\? <AgentSessionExpiredHint \/>/u);
	assert.match(INDEX_SOURCE, /const isLongDensity = variant === "large" && density === "long";/u);
	assert.match(INDEX_SOURCE, /const showUntrackedWorkFlyout = !isAttached && !isLongDensity;/u);
	assert.match(
		CARD_SOURCE,
		/if \(isLongDensity \|\| flyoutHandle === undefined \|\| flyoutSession === undefined\) \{\s*return card;/u,
	);
	assert.doesNotMatch(LIFECYCLE_SOURCE, /StatusInformationIcon|InformationCircleIcon/u);
});

test("long density large rows have no untracked-work flyout", () => {
	assert.match(INDEX_SOURCE, /flyoutHandle=\{isLongDensity \? undefined : flyoutHandle\}/u);
	assert.match(INDEX_SOURCE, /const flyoutSession = isLongDensity\s*\? undefined/u);
	assert.match(INDEX_SOURCE, /\{showUntrackedWorkFlyout \? \(/u);
	assert.doesNotMatch(INDEX_SOURCE, /\{isAttached \? null : \(\s*<JiraSessionFlyoutSurface/u);
});

test("expired cloud-long rows keep only an X with the 28-day history tooltip", () => {
	const expiredSource = readFileSync(join(__dirname, "agent-session-expired-hint.tsx"), "utf8");
	assert.match(expiredSource, /import CrossIcon from "@atlaskit\/icon\/core\/cross";/u);
	assert.match(
		expiredSource,
		/Agent session history is only kept for 28 days\. This session can no longer be resumed\./u,
	);
	assert.match(expiredSource, /className="text-icon-subtle"/u);
	assert.match(expiredSource, /iconSize="medium"/u);
	assert.match(expiredSource, /size="small"/u);
	assert.match(expiredSource, /variant="transparent"/u);
	assert.doesNotMatch(expiredSource, /Spinner|QuestionCircle|StatusSuccess/u);
	assert.match(PAGE_SOURCE, /withSessionRole\(items\.slice\(-1\), "expired"\)/u);
	assert.doesNotMatch(
		/host === "local"[\s\S]*expired/u.exec(PAGE_SOURCE)?.[0] ?? "host === \"local\" expired",
		/withSessionRole\([\s\S]*expired/u,
	);
});

test("viewer rows use the outline information circle, not the filled status icon", () => {
	assert.match(
		VIEWER_HINT_SOURCE,
		/import InformationCircleIcon from "@atlaskit\/icon\/core\/information-circle";/u,
	);
	assert.doesNotMatch(VIEWER_HINT_SOURCE, /status-information|StatusInformationIcon/u);
	assert.match(VIEWER_HINT_SOURCE, /className="\[&_svg:not\(\[class\*='size-'\]\)\]:size-4! \[&_svg\]:text-icon-subtlest"[\s\S]*className="text-icon-subtlest"/u);
	assert.match(VIEWER_HINT_SOURCE, /const \[open, setOpen\] = useState\(false\);[\s\S]*<Tooltip onOpenChange=\{setOpen\} open=\{open\}>[\s\S]*variant="ghost"/u);
	assert.doesNotMatch(VIEWER_HINT_SOURCE, /aria-expanded/u);
	assert.match(
		VIEWER_HINT_SOURCE,
		/icon=\{<InformationCircleIcon color="currentColor" label="" size="medium" \/>\}/u,
	);
	assert.match(VIEWER_HINT_SOURCE, /iconSize="medium"/u);
	assert.match(VIEWER_HINT_SOURCE, /size="small"/u);
	assert.match(VIEWER_HINT_SOURCE, /variant="transparent"/u);
	assert.match(
		VIEWER_HINT_SOURCE,
		/A team member is collaborating with an agent on this work\. Only they have access\./u,
	);
});

test("a working long row breathes with the experimental spinner, not the pixel loader", () => {
	assert.match(
		LIFECYCLE_SOURCE,
		/<Button[\s\S]*aria-label=\{label\}[\s\S]*aria-pressed=\{pressed\}[\s\S]*size="icon-compact"[\s\S]*variant="ghost"/u,
	);
	assert.match(
		LIFECYCLE_SOURCE,
		/<Spinner[\s\S]*className="group-aria-pressed\/button:text-icon-selected!"[\s\S]*label=""[\s\S]*pulse[\s\S]*size="xl"[\s\S]*variant="experimental"/u,
	);
	assert.match(LIFECYCLE_SOURCE, /QuestionCircleFilledIcon/u);
	assert.doesNotMatch(LIFECYCLE_SOURCE, /PixelLoader/u);
	// Agent List keeps its own indicator; only the session card swapped.
	assert.match(LIST_CARD_SOURCE, /PixelLoader/u);
	// Complete earns a success check, which Agent List has no slot for.
	assert.match(LIFECYCLE_SOURCE, /StatusSuccessIcon[\s\S]*text-icon-success|text-icon-success[\s\S]*StatusSuccessIcon/u);
	// Needs-input / complete stay 16-in-24 IconTiles. Running must not — those
	// `[&_svg]:size-4!` rules shrink the experimental spinner to a speck.
	assert.match(LIFECYCLE_SOURCE, /iconSize="medium"/u);
	assert.match(LIFECYCLE_SOURCE, /\[&_svg:not\(\[class\*='size-'\]\)\]:size-4!/u);
	assert.doesNotMatch(LIFECYCLE_SOURCE, /iconSize="small"/u);
	assert.match(LIFECYCLE_SOURCE, /size="small"/u);
	assert.match(LIFECYCLE_SOURCE, /variant="transparent"/u);
	assert.doesNotMatch(
		LIFECYCLE_SOURCE,
		/case "running":[\s\S]*<IconTile[\s\S]*variant="experimental"/u,
	);
	// Long-form states pair full copy with the icon; only active work shimmers.
	assert.match(LIFECYCLE_SOURCE, /running: "Working"/u);
	assert.match(LIFECYCLE_SOURCE, /"needs-input": "Needs input"/u);
	assert.match(LIFECYCLE_SOURCE, /attention: "Needs attention"/u);
	assert.match(LIFECYCLE_SOURCE, /complete: "Finished"/u);
	assert.match(LIFECYCLE_SOURCE, /showLabel[\s\S]*state === "running"[\s\S]*<Shimmer[\s\S]*\{label\}[\s\S]*<\/Shimmer>[\s\S]*: <span>\{label\}<\/span>[\s\S]*: null/u);
	// Grow in and out on the state swap, with the exit timing on the exit variant
	// so it does not silently run at the enter timing.
	assert.match(LIFECYCLE_SOURCE, /const INDICATOR_ENTER = \{ duration: 0\.15, ease: \[0\.4, 1, 0\.6, 1\] \}/u);
	assert.match(LIFECYCLE_SOURCE, /const INDICATOR_EXIT = \{ duration: 0\.1, ease: \[0\.6, 0, 0\.8, 0\.6\] \}/u);
	assert.match(
		LIFECYCLE_SOURCE,
		/exit=\{shouldReduceMotion[\s\S]*\? undefined[\s\S]*: \{ opacity: 0, scale: 0\.6, transition: INDICATOR_EXIT \}\}/u,
	);
	assert.match(LIFECYCLE_SOURCE, /<AnimatePresence initial=\{false\} mode="popLayout">/u);
	// Shimmer and the presence transition both retain reduced-motion treatments.
	assert.match(LIFECYCLE_SOURCE, /initial=\{shouldReduceMotion \? false : \{ opacity: 0, scale: 0\.6 \}\}/u);
	assert.doesNotMatch(LIFECYCLE_SOURCE, /const glyph = shouldReduceMotion \?/u);
	assert.match(LIFECYCLE_SOURCE, /<div className="flex shrink-0 items-center gap-1 text-xs text-text-subtle">/u);
	assert.match(LIFECYCLE_SOURCE, /<motion\.div/u);
	assert.doesNotMatch(LIFECYCLE_SOURCE, /<motion\.span/u);
	// The shared row consumes the card width while its trailing slot reserves the
	// full label-and-icon width at the far edge.
	assert.match(LIST_CARD_SOURCE, /"flex w-full min-w-0 gap-0"/u);
	assert.match(LIST_CARD_SOURCE, /"relative ml-3 flex min-h-6 min-w-6 shrink-0 items-center justify-end overflow-visible"/u);
});

test("a caller-authored dismiss label survives the Archive-to-Dismiss rename", () => {
	// `visibilityLabel` is documented as arbitrary copy for this row. Only the
	// legacy "Archive" default is translated; anything else passes through, so a
	// consumer that supplies "Restore" does not silently get "Dismiss".
	assert.match(CARD_SOURCE, /dismissLabel=\{visibilityLabel === "Archive" \? "Dismiss" : visibilityLabel\}/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /dismissLabel = "Dismiss",/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /\{dismissLabel\}/u);
	assert.match(TYPES_SOURCE, /visibilityLabel\?: string;/u);
});

test("reuses the Agent List row model instead of forking a parallel one", () => {
	assert.match(
		TYPES_SOURCE,
		/import type \{ AgentListAgent, AgentListItem \} from "@\/components\/blocks\/agent-list";/u,
	);
	assert.match(TYPES_SOURCE, /export type AgentSessionItem = AgentListItem & \{\s*role\?: AgentSessionRole;[\s\S]*toolCalls\?: readonly string\[\];\s*\};/u);
	assert.match(INDEX_SOURCE, /isCodingAgentListItem\(item\)/u);
});

test("a coding session body is read-only when the host omits onView", () => {
	assert.match(
		INDEX_SOURCE,
		/isCodingAgentListItem\(item\)\s*\? onView === undefined\s*\? undefined\s*: handleView/u,
	);
});

test("a card body click toggles a single selected session on the selected token", () => {
	assert.match(TYPES_SOURCE, /selectedItemId\?: string \| null;/u);
	assert.match(TYPES_SOURCE, /onSelectedItemIdChange\?: \(itemId: string \| null\) => void;/u);
	assert.match(TYPES_SOURCE, /export interface AgentSessionSelectionGesture/u);
	assert.match(TYPES_SOURCE, /readonly isLead: boolean;/u);
	assert.match(TYPES_SOURCE, /onActivate: \(gesture: AgentSessionSelectionGesture\) => void;/u);
	assert.match(INDEX_SOURCE, /selectedItemId: selectedItemIdProp,/u);
	assert.match(INDEX_SOURCE, /const isSelectionControlled = selectedItemIdProp !== undefined;/u);
	assert.match(
		INDEX_SOURCE,
		/const nextId = selectedItemId === item\.id \? null : item\.id;/u,
	);
	assert.match(INDEX_SOURCE, /onSelectedItemIdChange\?\.\(nextId\);/u);
	assert.match(
		INDEX_SOURCE,
		/if \(nextId !== null\) \{\s*\n\s*onView\?\.\(item\);\s*\n\s*\}/u,
	);
	assert.match(INDEX_SOURCE, /isSelected=\{item\.id === selectedItemId\}/u);
	assert.match(CARD_SOURCE, /showSelectedFill && "bg-bg-selected"/u);
	assert.match(
		CARD_SOURCE,
		/const showSelectedFill = isMarked \|\| \(isSelected && mark == null\);/u,
	);
	assert.match(
		CARD_SOURCE,
		/!showSelectedFill && !isHighlighted && !isHoverStateActive && "bg-transparent hover:bg-surface-hovered"/u,
	);
	assert.match(CARD_SOURCE, /data-selected=\{isSelected \|\| undefined\}/u);
	assert.match(CARD_SOURCE, /aria-current=\{isSelected \? "true" : undefined\}/u);
	assert.match(CARD_SOURCE, /isSelected=\{showSelectedFill\}/u);
	assert.match(CARD_SOURCE, /showHoverActionsWhenSelected/u);
	assert.match(
		LIST_CARD_SOURCE,
		/const showHoverActions = \(!isSelected \|\| showHoverActionsWhenSelected\) &&/u,
	);
	// The article keeps pointer activation so padding and avatar toggle. Ordinary
	// keyboard activation belongs to RowBody's real button when the row is not
	// draggable. A drag binding makes the article keyboard-operable, so RowBody
	// stays presentational and cannot become a nested interactive control.
	assert.match(CARD_SOURCE, /onClick=\{handleArticleClick\}/u);
	assert.match(CARD_SOURCE, /onKeyDown=\{handleArticleKeyDown\}/u);
	assert.match(CARD_SOURCE, /viewSession === undefined && mark == null/u);
	assert.match(CARD_SOURCE, /mark\.onActivate\(gesture\)/u);
	assert.match(CARD_SOURCE, /selectionGestureFromModifierKeys\(event\)/u);
	assert.match(CARD_SOURCE, /const articleRole = mark == null \? undefined : "gridcell";/u);
	assert.match(CARD_SOURCE, /role=\{articleRole\}/u);
	assert.match(
		CARD_SOURCE,
		/tabIndex=\{articleTabIndex \?\? \(bind !== undefined && activateCard !== undefined \? 0 : undefined\)\}/u,
	);
	assert.doesNotMatch(CARD_SOURCE, /articleRole === "button"|\? "button"/u);
	assert.match(CARD_SOURCE, /aria-selected=\{mark == null \? undefined : isMarked\}/u);
	assert.match(CARD_SOURCE, /role=\{mark == null \? undefined : "row"\}/u);
	assert.match(INDEX_SOURCE, /role=\{isMultiSelectList \? "grid" : undefined\}/u);
	assert.match(INDEX_SOURCE, /aria-multiselectable=\{isMultiSelectList \? true : undefined\}/u);
	assert.match(CARD_SOURCE, /event\.target\.closest\(SESSION_DRAG_INTERACTIVE_SELECTOR\) !== null/u);
	// Nested "..." and the hover-actions cluster must not count as row-activate.
	// The lifecycle button stops the click so a press selects the glyph instead
	// of opening chat. RowBody still receives onView so title/metadata open the row.
	assert.match(LIST_CARD_ACTIONS_SOURCE, /data-session-drag-ignore=""/u);
	assert.match(LIFECYCLE_SOURCE, /event\.stopPropagation\(\)/u);
	assert.match(LIFECYCLE_SOURCE, /aria-pressed=\{pressed\}/u);
	assert.match(SESSION_MORE_MENU_SOURCE, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/u);
	assert.match(
		CARD_SOURCE,
		/<AgentListRow[\s\S]*onView=\{mark == null && bind === undefined \? viewSession : undefined\}/u,
	);
	assert.match(CARD_SOURCE, /onActivate=\{activateCard \?\? mark\.onActivate\}/u);
	assert.match(LIST_ROW_ACTION_SOURCE, /event\.stopPropagation\(\);\s*\n\s*action\.onClick\(\)/u);
	assert.doesNotMatch(CARD_SOURCE, /isSelected=\{false\}/u);
	assert.doesNotMatch(CARD_SOURCE, /bg-bg-accent-blue-subtlest/u);
	assert.doesNotMatch(CARD_SOURCE, /bg-\[var\(--ds-/u);
});

test("ships demo data and catalog entries for every attachment and size variant", () => {
	assert.match(DATA_SOURCE, /export const AGENT_SESSION_ITEMS/u);
	assert.match(DATA_SOURCE, /id: "lw-scope-thread"/u);
	assert.match(DATA_SOURCE, /brandName: "claude"/u);
	assert.match(DATA_SOURCE, /brandName: "cursor"/u);
	assert.match(DATA_SOURCE, /vpkLogo: "rovo"/u);
	assert.doesNotMatch(DATA_SOURCE, /Venn’s MacBook/u);
	assert.match(DATA_SOURCE, /timeLabel: "18m"/u);
	assert.match(DATA_SOURCE, /issueKey: "PAY-101"/u);
	assert.match(PAGE_SOURCE, /<AgentSession/u);
	assert.match(PAGE_SOURCE, /case "expired":\s*return "Expired";/u);
	assert.match(PAGE_SOURCE, /host === "cloud" && isLong/u);
	assert.match(PAGE_SOURCE, /withSessionRole\(items\.slice\(-1\), "expired"\)/u);
	assert.match(PAGE_SOURCE, /label: "Needs input"/u);
	assert.match(PAGE_SOURCE, /onAssignedAgentIdsChange: setAssignedAgentIds/u);
	assert.doesNotMatch(PAGE_SOURCE, /data-slot="agent-session-attached-backdrop"/u);
	assert.doesNotMatch(PAGE_SOURCE, /rounded-lg bg-bg-neutral p-1/u);
	assert.match(DEMO_SOURCE, /@\/components\/blocks\/agent-session\/page/u);
	assert.match(REGISTRY_SOURCE, /"agent-session": dynamic/u);
	assert.match(MANIFEST_SOURCE, /blockComponent\("agent-session", "Agent Session"\)/u);
	assert.match(DETAIL_SOURCE, /export const AGENT_SESSION_DETAIL/u);
	assert.match(DEMO_SOURCE, /export function AgentSessionDemoMediumDetached\(\)/u);
	assert.match(DEMO_SOURCE, /export function AgentSessionDemoMediumAttached\(\)/u);
	assert.match(DEMO_SOURCE, /export function AgentSessionDemoSmall\(\)/u);
	assert.match(DEMO_SOURCE, /export function AgentSessionDemoDrag\(\)/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"agent-session-demo-medium-detached": dynamic\(/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"agent-session-demo-medium-attached": dynamic\(/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"agent-session-demo-small": dynamic\(/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"agent-session-demo-drag": dynamic\(/u);
	assert.match(DETAIL_SOURCE, /title: "Medium detached"/u);
	assert.match(DETAIL_SOURCE, /title: "Medium attached"/u);
	assert.match(DETAIL_SOURCE, /title: "Small"/u);
	assert.match(DETAIL_SOURCE, /title: "Drag"/u);
	assert.match(DETAIL_SOURCE, /name: "variant"/u);
	assert.match(DETAIL_SOURCE, /type: '"large" \| "medium-detached" \| "medium-attached" \| "small"'/u);
	// Local and cloud each ship both densities, so the two menus and the two row
	// shapes are all reachable from the catalog rather than only from code.
	for (const host of ["Local", "Cloud"]) {
		for (const density of ["short", "long"]) {
			const exportName = `AgentSessionDemo${host}${density === "short" ? "Short" : "Long"}`;
			const slug = `agent-session-demo-${host.toLowerCase()}-${density}`;
			assert.match(DEMO_SOURCE, new RegExp(`export function ${exportName}\\(\\)`, "u"));
			assert.match(DEMO_SOURCE, new RegExp(`density="${density}" host="${host.toLowerCase()}"`, "u"));
			assert.match(VARIANT_REGISTRY_SOURCE, new RegExp(`"${slug}": dynamic\\(`, "u"));
			assert.match(VARIANT_REGISTRY_SOURCE, new RegExp(`default: mod\\.${exportName},`, "u"));
			assert.match(DETAIL_SOURCE, new RegExp(`demoSlug: "${slug}"`, "u"));
		}
	}
	assert.match(DETAIL_SOURCE, /name: "density"/u);
	assert.match(DETAIL_SOURCE, /type: '"short" \| "long"'/u);
	// Cloud fixtures stay a separate list: the column and the Pulse rail render
	// AGENT_SESSION_ITEMS, and flipping those to cloud would change what those
	// demos demonstrate.
	assert.match(DATA_SOURCE, /export const AGENT_SESSION_CLOUD_ITEMS/u);
	assert.match(DATA_SOURCE, /id: "cloud-suspension-refactor"[\s\S]*invokedBy: \{[\s\S]*name: "Priya Raman"/u);
	assert.match(DATA_SOURCE, /id: "cloud-suspension-roadmap"[\s\S]*invokedBy: \{[\s\S]*name: "Jordan Okafor"/u);
	assert.match(DATA_SOURCE, /brandName: "canva"/u);
	assert.match(DATA_SOURCE, /brandName: "figma"/u);
	assert.doesNotMatch(
		/export const AGENT_SESSION_ITEMS[\s\S]*?\n\];/u.exec(DATA_SOURCE)?.[0] ?? "",
		/host: "cloud"/u,
	);
	assert.match(
		DETAIL_SOURCE,
		/import \{ AgentSession \} from "@\/components\/blocks\/agent-session";/u,
	);
	assert.doesNotMatch(DEMO_SOURCE, /AgentSessionDemoMultiLink/u);
	assert.doesNotMatch(VARIANT_REGISTRY_SOURCE, /agent-session-demo-multi-link/u);
	assert.doesNotMatch(DETAIL_SOURCE, /agent-session-demo-multi-link/u);
});

test("large uncaptured-work cards are borderless and flush in-flow", () => {
	// The block default is `gap-0`. Column and panel hosts override via
	// `listClassName` (`gap-1 p-1`) so adjacent marked rows can fuse.
	// Cards stay `rounded-lg` with no stroke. The rest of the list does
	// not share edges.
	assert.match(INDEX_SOURCE, /variant === "large"\s*\n\s*\? "gap-0"\s*\n\s*: variant === "medium-detached"/u);
	assert.match(INDEX_SOURCE, /gap: token\("space\.025"\)/u);
	assert.doesNotMatch(INDEX_SOURCE, /data-stack=/u);
	assert.doesNotMatch(INDEX_SOURCE, /gap: token\("space\.100"\)/u);
	assert.match(CARD_SOURCE, /rounded-lg text-left text-text/u);
	assert.match(CARD_SOURCE, /padding === "compact" \? "px-3 py-2" : "p-3"/u);
	assert.match(CARD_SOURCE, /data-marked=\{isMarked \|\| undefined\}/u);
	assert.match(CARD_SOURCE, /isMarked \? "has-\[\+\[data-marked\]\]:\[&_article\]:rounded-b-none" : null/u);
	assert.match(CARD_SOURCE, /\[\[data-marked\]\+&\[data-marked\]\]:\[&_article\]:rounded-t-none/u);
	assert.match(CARD_SOURCE, /\[\[data-marked\]\+&\[data-marked\]\]:in-\[\.gap-1\]:-mt-1/u);
	assert.doesNotMatch(CARD_SOURCE, /\[li:first-child_&\]:rounded-t-lg/u);
	assert.doesNotMatch(CARD_SOURCE, /\[li:last-child_&\]:rounded-b-lg/u);
	assert.doesNotMatch(CARD_SOURCE, /\[li:not\(:last-child\)_&\]:border-b-0/u);
	assert.doesNotMatch(CARD_SOURCE, /border border-solid/u);
	assert.doesNotMatch(CARD_SOURCE, /dash-4-2/u);
	assert.doesNotMatch(CARD_SOURCE, /rounded-none border bg-transparent/u);
	assert.doesNotMatch(INDEX_SOURCE, /flex flex-col gap-2/u);
});
