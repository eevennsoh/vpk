const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const CARD_SOURCE = readFileSync(
	join(__dirname, "agent-list-card.tsx"),
	"utf8",
);
const CARD_ACTIONS_SOURCE = readFileSync(
	join(__dirname, "agent-list-card-actions.tsx"),
	"utf8",
);
const IDENTITY_SOURCE = readFileSync(
	join(__dirname, "agent-list-identity.tsx"),
	"utf8",
);
const ROW_ACTION_SOURCE = readFileSync(
	join(__dirname, "agent-list-row-action.tsx"),
	"utf8",
);
const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const DEMO_SOURCE = readFileSync(
	join(__dirname, "../../website/demos/blocks/agent-list-demo.tsx"),
	"utf8",
);
const VARIANT_REGISTRY_SOURCE = readFileSync(
	join(__dirname, "../../website/registry/blocks-variants.ts"),
	"utf8",
);
const DATA_SOURCE = readFileSync(join(__dirname, "data.ts"), "utf8");
const DETAIL_SOURCE = readFileSync(
	join(__dirname, "../../../app/data/details/blocks/agent-list.ts"),
	"utf8",
);
const TYPES_SOURCE = readFileSync(
	join(__dirname, "agent-list-types.ts"),
	"utf8",
);
const SESSION_SOURCE = readFileSync(
	join(__dirname, "agent-list-session.ts"),
	"utf8",
);
const ACTOR_SOURCE = readFileSync(
	join(__dirname, "agent-list-actor.ts"),
	"utf8",
);
const INVOKER_SOURCE = readFileSync(
	join(__dirname, "agent-list-invoker.tsx"),
	"utf8",
);
const FOR_YOU_PANEL_SOURCE = readFileSync(
	join(
		__dirname,
		"../../projects/jira-for-you/jira-for-you-detail-panel.tsx",
	),
	"utf8",
);

test("working and awaiting sessions shimmer the title; complete sessions are solid", () => {
	assert.match(CARD_SOURCE, /running:\s*\{[^}]*shimmerTitle:\s*true/);
	assert.match(CARD_SOURCE, /"needs-input":\s*\{[^}]*shimmerTitle:\s*true/);
	assert.match(CARD_SOURCE, /complete:\s*\{[^}]*shimmerTitle:\s*false[^}]*showDots:\s*false/);
	assert.match(CARD_SOURCE, /stateMeta\.shimmerTitle \?\s*\(\s*<Shimmer/);
});

test("running drops the redundant label; awaiting swaps the title to the Needs input copy with dots", () => {
	// The shimmering title alone communicates a running session.
	assert.doesNotMatch(CARD_SOURCE, /Working on it/);
	assert.match(CARD_SOURCE, /"needs-input":\s*\{[^}]*showDots:\s*true/);
	assert.doesNotMatch(CARD_SOURCE, /titleOverride/u);
	// Awaiting sessions name the blocked state instead of the task title, matching
	// the Jira queue card's JiraSessionLabel.
	assert.match(CARD_SOURCE, /const AWAITING_INPUT_TITLE = "Needs input";/u);
	assert.match(DETAIL_SOURCE, /an awaiting session replaces the title with "Needs input" plus animated dots/u);
	assert.doesNotMatch(DETAIL_SOURCE, /Awaiting user response/u);
	assert.match(
		CARD_SOURCE,
		/return item\.state === "needs-input" \? AWAITING_INPUT_TITLE : item\.title;/u,
	);
	// The helper drives both native card title slots and remains the default for
	// the shared header when a consumer does not lead with the agent identity.
	assert.equal((CARD_SOURCE.match(/getSessionTitle\(item\)/gu) ?? []).length, 3);
	// A row whose caller-owned metadata already states the lifecycle can opt out,
	// so the state is not said twice with the work name nowhere on the card.
	assert.match(CARD_SOURCE, /stateAwareTitle = true,/u);
	assert.match(CARD_SOURCE, /\{stateAwareTitle \? getSessionTitle\(item\) : item\.title\}/u);
	assert.match(CARD_SOURCE, /\{stateAwareTitle && stateMeta\.showDots \? <AnimatedDots/u);
	assert.match(
		CARD_SOURCE,
		/const title = leadWithAgentName \? item\.agent\.name : getSessionTitle\(item\);/u,
	);
	assert.match(CARD_SOURCE, /stateMeta\.showDots \? <AnimatedDots/);
});

test("the awaiting lifecycle glyph is centered inside its tile", () => {
	assert.match(
		CARD_SOURCE,
		/<span className="grid place-items-center leading-none text-icon-information">[\s\S]*?<StatusInformationIcon/u,
	);
});

test("running sessions use the spinner-sized diagonal dot pixel loader", () => {
	assert.match(
		CARD_SOURCE,
		/<PixelLoader[\s\S]*className="size-3 justify-center"[\s\S]*pattern="diagonal-top-left"[\s\S]*shape="dot"[\s\S]*size="small"/u,
	);
	assert.doesNotMatch(CARD_SOURCE, /<Spinner/u);
});

test("session rows expose View, Resume, or Reply without advertising a Stop action", () => {
	assert.doesNotMatch(CARD_SOURCE, /Stop agent|VideoStopOverlayIcon|onStop|showStop/u);
	assert.doesNotMatch(INDEX_SOURCE, /onStop/u);
	assert.doesNotMatch(TYPES_SOURCE, /onStop\?:/u);
	assert.match(
		CARD_SOURCE,
		/primary: \{\s*label: rowPrimaryActionLabel\(item\),\s*onClick: \(\) => onView\(item\),\s*\},/u,
	);
	assert.match(TYPES_SOURCE, /actionLabel\?: string;/u);
	assert.match(
		CARD_SOURCE,
		/if \(item\.actionLabel !== undefined\) \{\s*return item\.actionLabel;\s*\}\s*if \(item\.agent\.kind === "person"\) \{\s*return "Reply";\s*\}\s*return isLocalAgentListItem\(item\) \? "Resume" : "View";/u,
	);
});

test("coding agent rows keep hover Resume even when canViewItem would hide them", () => {
	assert.match(
		SESSION_SOURCE,
		/export function isCodingAgentListItem\(item: AgentListItem\): boolean \{\s*return \(item\.agent\.kind \?\? "agent"\) !== "person";/u,
	);
	assert.match(INDEX_SOURCE, /isCodingAgentListItem,/u);
	assert.match(
		INDEX_SOURCE,
		/isCodingAgentListItem\(item\)\s*\?\s*handleCodingView/u,
	);
	assert.match(TYPES_SOURCE, /Coding agent rows always keep View \/ Resume/u);
});

test("View and Resume open the Rovo floating chat in the demo", () => {
	assert.match(
		CARD_SOURCE,
		/primary: \{\s*label: rowPrimaryActionLabel\(item\),\s*onClick: \(\) => onView\(item\),\s*\},/u,
	);
	assert.match(PAGE_SOURCE, /const handleView = useCallback\(\(\) => \{\s*openChat\("floating"\);/);
	assert.match(PAGE_SOURCE, /composerChatSurface="floating"/);
	assert.match(PAGE_SOURCE, /onView=\{handleView\}/);
	assert.match(PAGE_SOURCE, /onArchive=\{handleArchive\}/);
	assert.match(PAGE_SOURCE, /chatSurface === "floating" \? <RovoFloatingChat/);
});

test("the leading tile renders the agent or VPK identity at the selected density", () => {
	assert.match(
		IDENTITY_SOURCE,
		/<AgentAvatarVisual[\s\S]*avatarSrc=\{agent\.avatarSrc\}[\s\S]*sizePx=\{sizePx\}/,
	);
	assert.match(IDENTITY_SOURCE, /vpkLogo=\{agent\.vpkLogo\}/u);
	assert.match(CARD_SOURCE, /<AgentListIdentity[\s\S]*sizePx=\{isCompact \? 24 : 32\}/u);
	assert.doesNotMatch(CARD_SOURCE, /CATALOG_VPK_LOGO_SIZE_PX|agentVisualSizePx/u);
});

test("people render a circular photo beside the hexagon agents in the same list", () => {
	assert.match(TYPES_SOURCE, /export type AgentListActorKind = "agent" \| "person";/u);
	assert.match(TYPES_SOURCE, /kind\?: AgentListActorKind;/u);
	// The person branch is the one that must not reach for hexagon agent art.
	assert.match(
		IDENTITY_SOURCE,
		/if \(agent\.kind === "person"\) \{[\s\S]*<Avatar[\s\S]*label=\{agent\.name\}[\s\S]*<AvatarImage alt="" src=\{agent\.avatarSrc\} \/>[\s\S]*<AvatarFallback>\{actorInitials\(agent\.name\)\}<\/AvatarFallback>/u,
	);
	// One identity component, so the list row and the activity header cannot
	// disagree about what an agent or a person looks like.
	assert.equal((CARD_SOURCE.match(/<AgentListIdentity\b/gu) ?? []).length, 2);
	assert.match(IDENTITY_SOURCE, /PX_TO_PERSON_AVATAR_SIZE: Record<number, NonNullable<AvatarProps\["size"\]>> = \{\s*16: "xs",\s*24: "sm",\s*32: "default",/u);
});

test("agent identities default to human-first and expose an explicit agent-first attribution order", () => {
	assert.match(IDENTITY_SOURCE, /attributedBy\?: AgentListInvoker;/u);
	assert.match(IDENTITY_SOURCE, /export type AgentListAttributionOrder = "agent-first" \| "human-first";/u);
	assert.match(IDENTITY_SOURCE, /attributionOrder\?: AgentListAttributionOrder;/u);
	assert.match(IDENTITY_SOURCE, /attributionOrder = "human-first"/u);
	assert.match(IDENTITY_SOURCE, /aria-label=\{`\$\{agent\.name\}, used by \$\{attributedBy\.name\}`\}/u);
	assert.match(IDENTITY_SOURCE, /PX_TO_ATTRIBUTED_AGENT_SIZE: Record<number, number> = \{[\s\S]*32: 24,/u);
	assert.match(IDENTITY_SOURCE, /PX_TO_ATTRIBUTED_PERSON_AVATAR_SIZE:[\s\S]*32: "xs",/u);
	assert.match(IDENTITY_SOURCE, /const agentFirst = attributionOrder === "agent-first";/u);
	assert.match(IDENTITY_SOURCE, /const personPositionClassName = agentFirst\s*\? "absolute bottom-0 right-0 ring-2 ring-background"\s*: "absolute left-0 top-0 ring-2 ring-background";/u);
	assert.match(IDENTITY_SOURCE, /const agentPositionClassName = agentFirst\s*\? "absolute left-0 top-0"\s*: "absolute bottom-0 right-0";/u);
});

test("agent attribution groups share the same explicit order contract", () => {
	assert.match(
		IDENTITY_SOURCE,
		/export function AgentListAttributionAvatarGroup[\s\S]*<AvatarGroup[\s\S]*className=\{cn\("shrink-0", className\)\}[\s\S]*label=\{`\$\{agent\.name\}, used by \$\{attributedBy\.name\}`\}/u,
	);
	assert.doesNotMatch(IDENTITY_SOURCE, /gap-1 space-x-0/u);
	assert.match(IDENTITY_SOURCE, /orderAttributionAvatars\(attributionOrder, agentAvatar, personAvatar\)/u);
});

test("the attention state keeps the row's own title and warns instead of shimmering", () => {
	// `needs-input` swaps a task title for the blocked state; an attention row's
	// title already is the news, so swapping it would erase the row's content.
	assert.match(TYPES_SOURCE, /export type AgentListState = "running" \| "complete" \| "needs-input" \| "attention";/u);
	assert.match(CARD_SOURCE, /attention:\s*\{\s*shimmerTitle: false,\s*showDots: false,\s*showLifecycle: true,/u);
	assert.match(
		CARD_SOURCE,
		/return item\.state === "needs-input" \? AWAITING_INPUT_TITLE : item\.title;/u,
	);
	assert.match(
		CARD_SOURCE,
		/case "attention":[\s\S]*text-icon-warning[\s\S]*<StatusWarningIcon color="currentColor" label="" size="small" \/>[\s\S]*label="Needs attention"/u,
	);
	assert.match(CARD_SOURCE, /case "needs-input":\s*case "attention":\s*return "awaiting-input";/u);
	assert.match(SESSION_SOURCE, /case "needs-input":\s*case "attention":\s*return "awaiting-input";/u);
});

test("rows carry an optional summary below metadata, leading metadata, and a static time", () => {
	assert.match(TYPES_SOURCE, /summary\?: string;/u);
	assert.match(TYPES_SOURCE, /metadataPrefix\?: string;/u);
	assert.match(TYPES_SOURCE, /timeLabel\?: string;/u);
	// The summary wraps below the metadata row and keeps the title in natural
	// wrapping mode instead of inheriting the one-line hover treatment.
	assert.match(CARD_SOURCE, /const hasSummary = Boolean\(item\.summary\);/u);
	assert.match(CARD_SOURCE, /hasSummary \? "text-pretty" : "truncate"/u);
	assert.match(
		CARD_SOURCE,
		/<AgentListMetadataIdentity item=\{item\} \/>[\s\S]*\{item\.summary \? \(\s*<span\s*className=\{cn\(\s*"mt-2 w-full min-w-0 text-pretty text-text",/u,
	);
	assert.doesNotMatch(
		CARD_SOURCE,
		/"mt-2 w-full min-w-0 text-pretty text-text truncate"/u,
	);
	assert.doesNotMatch(
		CARD_SOURCE,
		/"mt-0\.5 w-full min-w-0 text-pretty text-text-subtle"/u,
	);
	// A taller row hangs its identity off the title; metadata stays one line
	// so the wrapping summary owns the extra height. Hover actions share a
	// row with title/metadata only, so expanding View/Archive cannot reflow
	// the summary sitting in its own column underneath.
	assert.match(CARD_SOURCE, /hasSummary \? "items-start" : "items-center"/u);
	assert.match(
		CARD_SOURCE,
		/<div\s*className=\{cn\(\s*"flex min-w-0 flex-1 flex-col"[\s\S]*<AgentListCardActions[\s\S]*\{item\.summary \?/u,
	);
	assert.match(
		CARD_SOURCE,
		/"flex w-full min-w-0 items-center gap-1 text-xs text-text-subtlest"/u,
	);
	assert.match(
		CARD_SOURCE,
		/\{item\.metadataPrefix \? \(\s*<>\s*<span className="shrink-0">\{item\.metadataPrefix\}<\/span>\s*<MetadataDot \/>/u,
	);
	// A pre-formatted stamp wins outright, so a historical list runs no per-row
	// one-second interval to age a fact that cannot change.
	assert.match(
		CARD_SOURCE,
		/if \(item\.timeLabel !== undefined\) \{\s*return <span>\{item\.timeLabel\}<\/span>;/u,
	);
	assert.match(DATA_SOURCE, /summary:\s*"Extracted shared helpers from the checkout path/u);
	assert.match(DETAIL_SOURCE, /Optional `summary` copy wraps below that metadata/u);
	assert.match(DETAIL_SOURCE, /Optional `summary` adds wrapping body copy below the metadata row/u);
});

test("the metadata line uses elapsed runtime, agent name, and asx PR-status colors", () => {
	// Only genuinely live cloud states count up; local, settled, and attention
	// rows read as a relative timestamp rather than a ticking runtime.
	assert.match(
		CARD_SOURCE,
		/const isLive = !isLocalAgentListItem\(item\)\s*&& \(item\.state === "running" \|\| item\.state === "needs-input"\);/u,
	);
	assert.match(
		CARD_SOURCE,
		/return isLive \? \(\s*<ElapsedTime startedAtMs=\{item\.startedAtMs \?\? seededStartedAtMs\}[\s\S]*\) : \(\s*<RelativeTime/u,
	);
	assert.equal((CARD_SOURCE.match(/<AgentListTime\b/gu) ?? []).length, 2);
	assert.match(CARD_SOURCE, /<AgentListMetadataIdentity item=\{item\} \/>/u);
	assert.match(CARD_SOURCE, /<span className="min-w-0 truncate">\{item\.agent\.name\}<\/span>/u);
	assert.doesNotMatch(CARD_SOURCE, /<span className="truncate">\{item\.agent\.name\}<\/span>/u);
	assert.doesNotMatch(CARD_SOURCE, /<span className="truncate">\{item\.branch\}<\/span>/u);
	assert.match(CARD_SOURCE, /created:\s*\{[\s\S]*?text-icon-success/);
	assert.match(CARD_SOURCE, /merged:\s*\{[\s\S]*?text-icon-accent-purple/);
	// The PR segment only renders when a PR exists (awaiting rows show no PR).
	assert.match(CARD_SOURCE, /prMeta && PrIcon \?/);
	assert.doesNotMatch(CARD_SOURCE, /item\.issueKey|item\.spaceName|ISSUE_TYPE/);
});

test("the metadata line always renders the timestamp last", () => {
	const rowSource = /export function AgentListRow[\s\S]*?(?=\nexport function AgentListCard)/u.exec(
		CARD_SOURCE,
	)?.[0];

	assert.ok(rowSource);
	assert.match(
		rowSource,
		/<AgentListMetadataIdentity item=\{item\} \/>[\s\S]*\{prMeta && PrIcon \? \([\s\S]*<MetadataDot \/>\s*<span className="shrink-0" title=\{timeSlotTitle\(item\)\}>\s*<AgentListTime item=\{item\} \/>/u,
	);
});

test("sample data: PRs on created/merged rows, none on the awaiting row", () => {
	assert.match(DATA_SOURCE, /prStatus: "created"/);
	assert.match(DATA_SOURCE, /prStatus: "merged"/);
	assert.doesNotMatch(DATA_SOURCE, /awaiting-input/);
	assert.match(DATA_SOURCE, /branch: "rovo\//);
});

test("sample data covers one card per state", () => {
	assert.match(DATA_SOURCE, /state: "running"/);
	assert.match(DATA_SOURCE, /state: "needs-input"/);
	assert.match(DATA_SOURCE, /state: "complete"/);
});

test("the list exposes generic selected-item state to its native card", () => {
	assert.match(TYPES_SOURCE, /selectedItemId\?: string;/u);
	assert.match(INDEX_SOURCE, /selectedItemId/u);
	assert.match(
		INDEX_SOURCE,
		/isSelected=\{item\.id === selectedItemId\}/u,
	);
	assert.match(CARD_SOURCE, /isSelected\?: boolean;/u);
	assert.match(CARD_SOURCE, /aria-current=\{isSelected \? "true" : undefined\}/u);
	assert.match(CARD_SOURCE, /aria-pressed=\{isSelected\}/u);
	assert.match(CARD_SOURCE, /isSelected && "bg-bg-selected hover:bg-bg-selected-hovered"/u);
});

test("session rows default to the shared Jira agent-session flyout", () => {
	// The default variant reuses the exact flyout the live Jira sidebar renders,
	// via one payload handle for the whole list rather than a popup per row.
	assert.match(TYPES_SOURCE, /export type AgentListFlyout = "session" \| "composer" \| "none";/u);
	assert.match(INDEX_SOURCE, /flyout = "session"/u);
	assert.match(
		INDEX_SOURCE,
		/const \[flyoutHandle\] = useState\(createJiraSessionFlyoutHandle\);/u,
	);
	assert.match(
		INDEX_SOURCE,
		/\{flyout === "session" \? \(\s*<JiraSessionFlyoutSurface handle=\{flyoutHandle\} \/>/u,
	);
	assert.doesNotMatch(
		INDEX_SOURCE,
		/<JiraSessionFlyoutSurface[\s\S]*onSubmitPrompt=/u,
	);
	assert.match(CARD_SOURCE, /<JiraSessionFlyoutTrigger[\s\S]*handle=\{flyoutHandle\}/u);
	assert.match(CARD_SOURCE, /session=\{toAgentSessionFlyoutItem\(item\)\}/u);
	// One element child, so JiraSessionFlyoutTrigger's focus-capture clone lands
	// on the row and keyboard focus can open the flyout.
	assert.match(CARD_SOURCE, /session=\{toAgentSessionFlyoutItem\(item\)\}\s*>\s*\{row\}\s*<\/JiraSessionFlyoutTrigger>/u);
});

test("the session adapter derives flyout payloads the row model does not carry", () => {
	assert.match(
		SESSION_SOURCE,
		/export function deriveIssueKeyFromBranch\(branch: string \| undefined\): string \{[\s\S]*rovo\\\/\(\[a-z\]\+\)-\(\\d\+\)-/u,
	);
	assert.match(
		SESSION_SOURCE,
		/export function toAgentListResumeCommand\(item: AgentListItem\): string \{[\s\S]*item\.sessionDetails\?\.resumeSessionId \?\? item\.id\);[\s\S]*cd \$\{quoteShellArgument\(worktree\)\} && claude --resume \$\{resumeId\}/u,
	);
	assert.match(INDEX_SOURCE, /toAgentListResumeCommand,/u);
	// Rows that are not agent sessions carry no branch, and never open the flyout.
	assert.match(SESSION_SOURCE, /if \(branch === undefined\) \{\s*return "";/u);
	assert.match(TYPES_SOURCE, /branch\?: string;/u);
	// Lifecycle mapping: the row model has no "PR open" state, so a finished
	// session borrows it from prStatus.
	assert.match(SESSION_SOURCE, /case "needs-input":\s*case "attention":\s*return "awaiting-input";/u);
	assert.match(SESSION_SOURCE, /case "running":\s*return "running";/u);
	assert.match(TYPES_SOURCE, /export type AgentListPrStatus = "created" \| "merged" \| "failed";/u);
	assert.match(CARD_SOURCE, /failed:[\s\S]*MergeFailureIcon[\s\S]*PR failed[\s\S]*text-icon-danger/u);
	assert.match(
		SESSION_SOURCE,
		/case "complete":[\s\S]*case "created":[\s\S]*return "pr-open";[\s\S]*case "failed":[\s\S]*return "stopped";[\s\S]*return "merged";/u,
	);
	// Explicit sessionDetails win for flyout-only fields; host prefers the row.
	assert.match(SESSION_SOURCE, /branch: details\?\.branch \?\? item\.branch,/u);
	assert.match(SESSION_SOURCE, /host: getAgentListHost\(item\),/u);
	assert.match(
		SESSION_SOURCE,
		/export function getAgentListHost\(item: AgentListItem\): AgentListHost \{\s*return item\.host \?\? item\.sessionDetails\?\.host \?\? "cloud";/u,
	);
	assert.match(
		SESSION_SOURCE,
		/issueKey: details\?\.issueKey \?\? deriveIssueKeyFromBranch\(item\.branch\),/u,
	);
	assert.match(SESSION_SOURCE, /issueSummary: details\?\.issueSummary \?\? item\.title,/u);
	assert.match(SESSION_SOURCE, /\.\.\.\(item\.agent\.brandName === undefined \? \{\} : \{ brandName: item\.agent\.brandName \}\),/u);
	assert.match(SESSION_SOURCE, /\.\.\.\(item\.agent\.vpkLogo === undefined \? \{\} : \{ vpkLogo: item\.agent\.vpkLogo \}\),/u);
	assert.match(SESSION_SOURCE, /completedAtMs: item\.completedAtMs,/u);
	assert.match(SESSION_SOURCE, /completedSecondsAgo: item\.completedSecondsAgo,/u);
	assert.match(SESSION_SOURCE, /initialElapsedSeconds: item\.elapsedSeconds,/u);
	assert.match(SESSION_SOURCE, /startedAtMs: item\.startedAtMs,/u);
	// Identity and lifecycle stay row-owned and are not overridable.
	for (const rowOwnedField of [
		"agentAvatarSrc",
		"agentName",
		"brandName",
		"completedAtMs",
		"completedSecondsAgo",
		"id",
		"initialElapsedSeconds",
		"invokedBy",
		"startedAtMs",
		"status",
		"title",
		"vpkLogo",
	]) {
		assert.match(TYPES_SOURCE, new RegExp(`\\| "${rowOwnedField}"`, "u"));
	}
	assert.match(DATA_SOURCE, /sessionDetails: \{/u);
	assert.match(DATA_SOURCE, /pullRequestNumber: 284,/u);
});

test("the composer variant keeps the per-row Agent States flyout on the left", () => {
	assert.match(TYPES_SOURCE, /id\?: string;[\s\S]*name: string;/u);
	assert.match(CARD_SOURCE, /if \(flyout === "composer"\) \{/u);
	assert.match(CARD_SOURCE, /<HoverCard[\s\S]*<HoverCardTrigger/u);
	assert.match(CARD_SOURCE, /<AgentStates/u);
	assert.match(CARD_SOURCE, /side="left"/u);
	assert.match(CARD_SOURCE, /positionerClassName="z-\[575\]/u);
	assert.match(CARD_SOURCE, /state=\{getAgentStatesState\(item\.state\)\}/u);
	assert.match(CARD_SOURCE, /onSubmit=\{onFlyoutSubmit\}/u);
	assert.match(CARD_SOURCE, /name: item\.agent\.name/u);
	assert.match(CARD_SOURCE, /avatarSrc: item\.agent\.avatarSrc/u);
	assert.match(CARD_SOURCE, /closeDelay=\{80\}/u);
	assert.doesNotMatch(CARD_SOURCE, /AgentProfileCard|agentProfile/u);
	// All four flyout variants wrap the identical row body, so density, states,
	// and hover actions cannot drift between them.
	assert.equal((CARD_SOURCE.match(/\{row\}/gu) ?? []).length, 4);
	assert.match(CARD_SOURCE, /function AgentListRow\(/u);
	// jira-for-you relies on the composer to reply to an agent inline.
	assert.match(FOR_YOU_PANEL_SOURCE, /flyout="composer"/u);
});

test("flyout=\"none\" renders the row alone for entries that are not agent sessions", () => {
	assert.match(
		CARD_SOURCE,
		/if \(flyout === "none"\) \{[\s\S]*<li\s*aria-current=\{isSelected \? "true" : undefined\}\s*className=\{rowClassName\(isCompact, isSelected\)\}\s*data-testid=\{"agent-list-row-" \+ item\.id\}\s*>\s*\{row\}\s*<\/li>/u,
	);
	// The shared session flyout surface only mounts for the variant that uses it.
	assert.match(
		INDEX_SOURCE,
		/\{flyout === "session" \? \(\s*<JiraSessionFlyoutSurface handle=\{flyoutHandle\} \/>/u,
	);
});

test("Agent States composer submissions open the configured chat surface with sidebar fallback", () => {
	assert.match(TYPES_SOURCE, /composerChatSurface\?: ChatSurface;/u);
	assert.match(TYPES_SOURCE, /onSubmitPrompt\?: \(item: AgentListItem, prompt: string\) => Promise<void> \| void;/u);
	assert.match(INDEX_SOURCE, /composerChatSurface = "sidebar"/u);
	assert.match(INDEX_SOURCE, /if \(onSubmitPrompt\) \{[\s\S]*void onSubmitPrompt\(item, prompt\);[\s\S]*return;/u);
	// The chat runtime is optional: the composer is the only branch that needs
	// it, so a comment/@mention list on a route with no RovoChatProvider renders
	// instead of throwing on a capability it never uses.
	assert.match(INDEX_SOURCE, /const chat = useOptionalRovoChat\(\);/u);
	assert.match(INDEX_SOURCE, /chat\?\.openChat\(composerChatSurface\);/u);
	assert.match(INDEX_SOURCE, /void chat\?\.sendPrompt\(prompt\);/u);
	assert.match(INDEX_SOURCE, /onFlyoutSubmit=\{\(prompt\) => handleFlyoutSubmit\(item, prompt\)\}/u);
	assert.match(DETAIL_SOURCE, /name: "composerChatSurface"/u);
	assert.match(DETAIL_SOURCE, /default: '"sidebar"'/u);
	assert.match(DETAIL_SOURCE, /name: "onSubmitPrompt"/u);
});

test("the composer refuses to render without a chat destination", () => {
	// The optional read exists for read-only lists, not to make the composer
	// silently lossy: AgentStatesComposer clears the reply right after calling
	// back, so a swallowed prompt looks exactly like a successful send. Failing
	// at render beats failing after the viewer has typed one.
	assert.match(
		INDEX_SOURCE,
		/if \(flyout === "composer" && onSubmitPrompt === undefined && chat === null\) \{\s*throw new Error\(/u,
	);
	assert.match(
		INDEX_SOURCE,
		/'AgentList flyout="composer" needs a chat destination: render it inside a RovoChatProvider or pass onSubmitPrompt.'/u,
	);
});

test("in-flow View controls immediately replace lifecycle indicators without collisions", () => {
	assert.doesNotMatch(CARD_SOURCE, /absolute inset-y-0 right-0/u);
	assert.match(
		CARD_SOURCE,
		/className="flex min-w-0 flex-1 flex-col items-start justify-center/u,
	);
	// The body is a button only when the consumer gave it somewhere to go; a
	// read-only list must not add one focusable no-op to the tab order per row.
	assert.match(
		CARD_SOURCE,
		/if \(onView === undefined\) \{\s*return <div className=\{className\}>\{children\}<\/div>;/u,
	);
	assert.match(
		CARD_SOURCE,
		/const viewItem = onView === undefined \? undefined : \(\) => onView\(item\);/u,
	);
	assert.match(CARD_SOURCE, /onView=\{viewItem\}/u);
	// A caller-owned `menu` counts as a revealed control too — a row whose only
	// action is a dropdown must still reveal it and still hide the lifecycle slot.
	assert.match(
		CARD_SOURCE,
		/const showHoverActions = \(!isSelected \|\| showHoverActionsWhenSelected\) &&\s*\(hoverActions\?\.primary !== undefined\s*\|\| hoverActions\?\.secondary !== undefined\s*\|\| hoverActions\?\.menu !== undefined\);/u,
	);
	assert.match(CARD_SOURCE, /\{showHoverActions && !overlayHoverActions \? \(\s*<AgentListCardActions/u);
	assert.match(
		CARD_SOURCE,
		/\{overlayHoverActions && !lifecycleNode \? \(\s*<div className="pointer-events-none absolute inset-y-0 right-3/u,
	);
	assert.match(CARD_ACTIONS_SOURCE, /<AgentListRowActionButton action=\{primary\}/u);
	assert.match(ROW_ACTION_SOURCE, /event\.stopPropagation\(\);\s*\n\s*action\.onClick\(\)/u);
	assert.match(
		CARD_SOURCE,
		/"flex w-full min-w-0 items-center gap-0",\s*hasSummary \? null : "overflow-hidden",/u,
	);
	assert.match(
		CARD_SOURCE,
		/"flex w-full min-w-0 items-center gap-1 text-xs text-text-subtlest"/u,
	);
	// Menu-only actions are absolute: the title owns all resting width and keeps
	// its overflow ellipsis, then gets the action gutter only during reveal.
	assert.match(
		CARD_SOURCE,
		/className=\{cn\(titleClassName, "text-text"\)\}\s*data-agent-list-title=""/u,
	);
	assert.match(CARD_SOURCE, /hasSummary \? "text-pretty" : "truncate"/u);
	assert.match(
		CARD_SOURCE,
		/"flex min-w-0 flex-1 flex-col",[\s\S]*overlayHoverActions && !lifecycleNode[\s\S]*"group-hover\/agent-row:pr-9 group-has-\[:focus-visible\]\/agent-row:pr-9"/u,
	);
	assert.match(
		CARD_SOURCE,
		/overlayHoverActions && !lifecycleNode \? \([\s\S]*"pointer-events-none absolute inset-y-0 right-3 flex w-6 items-center justify-center"[\s\S]*<AgentListCardActions/u,
	);
	assert.match(
		CARD_ACTIONS_SOURCE,
		/"pointer-events-none absolute inset-y-0 right-0 flex w-6 items-center justify-center opacity-0/u,
	);
	// The lifecycle control is itself inline-flex. Its wrapper must establish a
	// flex formatting context so an inline baseline line box cannot lift the
	// spinner above the centered ellipsis occupying the same trailing slot.
	assert.match(
		CARD_SOURCE,
		/"flex items-center leading-none",[\s\S]*overlayHoverActions/u,
	);
	assert.doesNotMatch(CARD_SOURCE, /data-agent-list-title-(?:layout|hover)/u);
	assert.match(CARD_SOURCE, /className="min-w-0 truncate">\{item\.agent\.name\}<\/span>/u);
	assert.match(
		CARD_ACTIONS_SOURCE,
		/grid-cols-\[0fr\][\s\S]*group-hover\/agent-row:grid-cols-\[1fr\][\s\S]*group-has-\[:focus-visible\]\/agent-row:grid-cols-\[1fr\]/u,
	);
	assert.match(
		CARD_ACTIONS_SOURCE,
		/"pointer-events-none flex shrink-0 items-center gap-1 pl-3 opacity-0/u,
	);
	assert.match(CARD_ACTIONS_SOURCE, /transition-opacity duration-normal ease-out-practical/u);
	assert.match(
		CARD_ACTIONS_SOURCE,
		/group-data-\[variant=uncaptured-work\]\/agent-row:transition-none/u,
	);
	assert.doesNotMatch(CARD_SOURCE, /className="ml-3 hidden shrink-0 items-center gap-1/u);
	assert.doesNotMatch(CARD_SOURCE, /isVisible/u);
	assert.match(
		CARD_SOURCE,
		/showHoverActions &&\s*"group-hover\/agent-row:hidden group-has-\[:focus-visible\]\/agent-row:hidden"/u,
	);
	assert.doesNotMatch(CARD_SOURCE, /transition-\[width,margin,opacity\]/u);
});

test("row hover reveal is scoped to a named group so ancestor `group` wrappers cannot trigger it", () => {
	// Doc example wrappers (`ExampleItem` in
	// components/website/component-doc/components/doc-examples.tsx) carry a bare
	// `className="group"`. Tailwind's unnamed `group-hover:` compiles to
	// `.group:hover &`, which matches ANY ancestor with that class — so hovering
	// anywhere in the demo shell used to reveal every row's View button at once.
	assert.doesNotMatch(CARD_SOURCE, /"group relative/u);
	assert.match(CARD_SOURCE, /"group\/agent-row relative/u);
	// Named variants read `group-hover/agent-row:`, so a bare `group-hover:`
	// anywhere in this file is an unscoped leak.
	assert.doesNotMatch(CARD_SOURCE, /group-hover:/u);
	assert.doesNotMatch(CARD_SOURCE, /group-focus-within:/u);
});

test("in-flow activity actions expose their button-owned focus indicators", () => {
	assert.match(
		CARD_SOURCE,
		/className="min-w-0 overflow-hidden has-\[:focus-visible\]:overflow-visible"[\s\S]*<Button onClick=\{\(\) => onView\(item\)\}[\s\S]*View/u,
	);
});

test("supports default and compact session rows", () => {
	assert.match(TYPES_SOURCE, /export type AgentListVariant = "default" \| "compact";/u);
	assert.match(TYPES_SOURCE, /variant\?: AgentListVariant/u);
	assert.match(INDEX_SOURCE, /variant = "default"/u);
	assert.match(TYPES_SOURCE, /canViewItem\?: \(item: AgentListItem\) => boolean;/u);
	assert.match(INDEX_SOURCE, /canViewItem !== undefined && !canViewItem\(item\)/u);
	assert.match(INDEX_SOURCE, /<AgentListCard[\s\S]*variant=\{variant\}/u);
	assert.match(CARD_SOURCE, /variant === "compact"/u);
	assert.match(CARD_SOURCE, /sizePx=\{isCompact \? 24 : 32\}/u);
	assert.match(CARD_SOURCE, /isCompact \? "text-xs" : "text-sm"/u);
	assert.match(CARD_SOURCE, /isCompact \? "px-3 py-1\.5" : "p-3"/u);
	assert.match(DETAIL_SOURCE, /name: "variant"/u);
	assert.match(DETAIL_SOURCE, /type: '"default" \| "compact"'/u);
	assert.match(DETAIL_SOURCE, /default: '"default"'/u);
});

// The uncaptured coding-session card moved to the Agent Session block. Agent
// List keeps only the list surface, so nothing here may reintroduce the chin,
// its callbacks, or the dashed card chrome.
test("no longer owns the uncaptured coding-session card", () => {
	assert.doesNotMatch(TYPES_SOURCE, /uncaptured/iu);
	assert.doesNotMatch(TYPES_SOURCE, /capturedItemIds|onCreateWorkItem|onLinkWorkItem|onCopyResume|isResumable|getResumeCommand|getSuggestedWorkItemKey|onDismiss/u);
	assert.doesNotMatch(INDEX_SOURCE, /uncaptured/iu);
	assert.doesNotMatch(INDEX_SOURCE, /UncapturedWorkChin|capturedItemIds/u);
	assert.doesNotMatch(PAGE_SOURCE, /uncaptured/iu);
	assert.doesNotMatch(DATA_SOURCE, /AGENT_LIST_UNCAPTURED_ITEMS/u);
	assert.doesNotMatch(DEMO_SOURCE, /Uncaptured/u);
	assert.doesNotMatch(DETAIL_SOURCE, /uncaptured/iu);
	assert.doesNotMatch(VARIANT_REGISTRY_SOURCE, /agent-list-demo-uncaptured/u);
	assert.equal(existsSync(join(__dirname, "agent-list-uncaptured.tsx")), false);
	// AgentListRow stays shared: the Agent Session card renders it in its sunken
	// body. Its hover slot is generic, so each owner supplies its own pair rather
	// than the row hardcoding a second block's actions.
	assert.match(CARD_SOURCE, /hoverActions\?: AgentListRowHoverActions;/u);
	assert.match(CARD_SOURCE, /export type AgentListRowHoverActions = Readonly<\{/u);
	assert.match(CARD_SOURCE, /export function AgentListRow/u);
});

test("raised chrome uses elevation and drops the outer border", () => {
	assert.match(TYPES_SOURCE, /export type AgentListChrome = "stroke" \| "raised";/u);
	assert.match(TYPES_SOURCE, /chrome\?: AgentListChrome;/u);
	assert.match(INDEX_SOURCE, /chrome = "stroke"/u);
	assert.match(
		INDEX_SOURCE,
		/chrome === "raised"\s*\? "bg-surface-raised"\s*: "border border-border bg-surface"/u,
	);
	assert.match(
		INDEX_SOURCE,
		/chrome === "raised"\s*\? \{ boxShadow: token\("elevation\.shadow\.raised"\) \}\s*: undefined/u,
	);
	assert.match(DETAIL_SOURCE, /name: "chrome"/u);
	assert.match(DETAIL_SOURCE, /type: '"stroke" \| "raised"'/u);
});

test("shows the compact variant in the component documentation", () => {
	assert.match(PAGE_SOURCE, /variant = "default"/u);
	assert.match(PAGE_SOURCE, /<AgentListDemo flyout=\{flyout\} variant=\{variant\} \/>/u);
	assert.match(PAGE_SOURCE, /<AgentList[^>]*variant=\{variant\}/u);
	assert.match(DEMO_SOURCE, /export function AgentListDemoCompact/u);
	assert.match(DEMO_SOURCE, /<Page variant="compact" \/>/u);
	assert.match(DETAIL_SOURCE, /title: "Compact"/u);
	assert.match(DETAIL_SOURCE, /demoSlug: "agent-list-demo-compact"/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"agent-list-demo-compact": dynamic/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /default: mod\.AgentListDemoCompact/u);
});

test("shows both flyout variants in the component documentation", () => {
	assert.match(PAGE_SOURCE, /flyout = "session"/u);
	assert.match(PAGE_SOURCE, /<AgentList[^>]*flyout=\{flyout\}/u);
	assert.match(DEMO_SOURCE, /export function AgentListDemoComposer/u);
	assert.match(DEMO_SOURCE, /<Page flyout="composer" \/>/u);
	assert.match(DETAIL_SOURCE, /title: "Composer flyout"/u);
	assert.match(DETAIL_SOURCE, /demoSlug: "agent-list-demo-composer"/u);
	assert.match(DETAIL_SOURCE, /name: "flyout"/u);
	assert.match(DETAIL_SOURCE, /type: '"session" \| "composer" \| "none"'/u);
	assert.match(DETAIL_SOURCE, /default: '"session"'/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"agent-list-demo-composer": dynamic/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /default: mod\.AgentListDemoComposer/u);
});

test("exports a session activity header whose optional View action requires a handler", () => {
	assert.match(
		INDEX_SOURCE,
		/export \{ AgentListActivityHeader \} from "\.\/agent-list-card"/u,
	);
	assert.match(CARD_SOURCE, /title=\{timeSlotTitle\(item\)\}/u);
	assert.match(
		CARD_SOURCE,
		/function timeSlotTitle\(item: AgentListItem\): string \{\s*if \(isLocalAgentListItem\(item\)\) \{\s*return "Last update";\s*\}\s*return item\.state === "running" \|\| item\.state === "needs-input"\s*\? "Agent runtime"\s*: "Last update";/u,
	);
	assert.match(
		CARD_SOURCE,
		/"pointer-events-none flex shrink-0 items-center gap-1 pl-2 opacity-0[\s\S]*actionVisibilityClass[\s\S]*\{onView \? \(\s*<Button onClick=\{\(\) => onView\(item\)\}[\s\S]*View[\s\S]*<\/Button>/u,
	);
	assert.doesNotMatch(DETAIL_SOURCE, /Activity card/u);
});

test("activity-header lifecycle indicators sit flush right until hover actions expand", () => {
	// Trailing cluster is right-aligned; actions collapse to 0fr so the loader
	// (or awaiting glyph) owns the far edge at rest and only shifts inward when
	// View / collapse controls expand on hover or keyboard focus.
	assert.match(
		CARD_SOURCE,
		/stateMeta\.showLifecycle \|\| hasTrailingActions \? \([\s\S]*className="relative z-10 ml-auto flex shrink-0 items-center"/u,
	);
	assert.match(
		CARD_SOURCE,
		/actionWidthClass[\s\S]*grid-cols-\[0fr\] group-hover\/activity-card:grid-cols-\[1fr\] group-has-\[:focus-visible\]\/activity-card:grid-cols-\[1fr\]/u,
	);
	assert.match(
		CARD_SOURCE,
		/\{stateMeta\.showLifecycle \? <LifecycleIndicator state=\{item\.state\} \/> : null\}[\s\S]*\{hasTrailingActions \?/u,
	);
});

test("activity-header actions stay focusable while hidden so keyboard users can reach View", () => {
	assert.match(
		CARD_SOURCE,
		/\{hasTrailingActions \? \([\s\S]*\{action\}[\s\S]*\) : null\}/u,
	);
	// `display: none` would drop the controls from the tab order, and a hidden
	// descendant can never satisfy the `:focus-visible` reveal condition itself.
	assert.doesNotMatch(CARD_SOURCE, /"hidden -ml-1 shrink-0 items-center gap-1/u);
	assert.doesNotMatch(CARD_SOURCE, /"hidden flex shrink-0 items-center gap-1 pl-2/u);
	assert.match(CARD_SOURCE, /actionVisibilityClass[\s\S]*group-has-\[:focus-visible\]\/activity-card:opacity-100/u);
	assert.match(CARD_SOURCE, /actionVisibilityClass[\s\S]*group-has-\[:focus-visible\]\/activity-card:pointer-events-auto/u);
});

test("the session activity header accepts leading metadata without changing its shared geometry", () => {
	assert.match(CARD_SOURCE, /metadataPrefix\?: ReactNode;/u);
	assert.match(
		CARD_SOURCE,
		/\{metadataPrefix \? \([\s\S]*\{metadataPrefix\}[\s\S]*<MetadataDot \/>[\s\S]*\) : null\}/u,
	);
});

test("the session activity header can lead with the agent identity without repeating it in metadata", () => {
	assert.match(CARD_SOURCE, /leadWithAgentName\?: boolean;/u);
	assert.match(
		CARD_SOURCE,
		/const title = leadWithAgentName \? item\.agent\.name : getSessionTitle\(item\);/u,
	);
	assert.match(
		CARD_SOURCE,
		/\{leadWithAgentName \? null : \([\s\S]*<MetadataDot \/>[\s\S]*\{item\.agent\.name\}[\s\S]*\)\}/u,
	);
});

test("the session activity header separates message time from active runtime", () => {
	assert.match(CARD_SOURCE, /messageTimestamp\?: string;/u);
	assert.match(
		CARD_SOURCE,
		/<span className="shrink-0" title="Message sent">\s*\{messageTimestamp\}\s*<\/span>/u,
	);
	assert.match(
		CARD_SOURCE,
		/\{messageTimestamp && item\.state !== "complete" \? <MetadataDot \/> : null\}/u,
	);
	assert.match(
		CARD_SOURCE,
		/\{messageTimestamp \? "Working for " : null\}\s*<AgentListTime fallback=\{timeFallback\} item=\{item\} \/>/u,
	);
});

test("activity-header Working for truncates when hover actions expand", () => {
	// Title/meta live in a shrinking overflow-hidden column; actions stay shrink-0
	// with a stacking context so overflowing meta cannot steal their clicks.
	assert.match(CARD_SOURCE, /className="min-w-0 flex-1 overflow-hidden"/u);
	assert.match(
		CARD_SOURCE,
		/className="flex min-w-0 items-center gap-1 overflow-hidden text-xs leading-4 text-text-subtle"/u,
	);
	assert.match(
		CARD_SOURCE,
		/className="min-w-0 truncate"\s*title=\{activityTimeTitle\}/u,
	);
	assert.doesNotMatch(
		CARD_SOURCE,
		/className="shrink-0"\s*title=\{activityTimeTitle\}/u,
	);
	assert.match(
		CARD_SOURCE,
		/className="relative z-10 ml-auto flex shrink-0 items-center"/u,
	);
	assert.match(
		CARD_SOURCE,
		/"pointer-events-none flex shrink-0 items-center gap-1 pl-2 opacity-0/u,
	);
});

test("needs-input activity headers shimmer Needs input with trailing Rovo dots instead of Working for", () => {
	assert.match(CARD_SOURCE, /const NEEDS_INPUT_STATUS_LABEL = "Needs input";/u);
	assert.match(CARD_SOURCE, /const needsInput = item\.state === "needs-input";/u);
	assert.match(
		CARD_SOURCE,
		/const showTitleDots = stateMeta\.showDots && !leadWithAgentName;/u,
	);
	assert.match(CARD_SOURCE, /\{showTitleDots \? <AnimatedDots \/> : null\}/u);
	assert.match(
		CARD_SOURCE,
		/needsInput \? \(\s*<span[\s\S]*title=\{NEEDS_INPUT_STATUS_LABEL\}[\s\S]*<Shimmer as="span" duration=\{1\.4\} spread=\{2\}>[\s\S]*\{NEEDS_INPUT_STATUS_LABEL\}[\s\S]*<\/Shimmer>\s*<AnimatedDots \/>/u,
	);
	// Running sessions still surface the Working for duration; needs-input does not.
	assert.match(
		CARD_SOURCE,
		/needsInput \? \([\s\S]*\) : !messageTimestamp \|\| item\.state !== "complete" \? \([\s\S]*\{messageTimestamp \? "Working for " : null\}/u,
	);
});

test("the session activity header shows who invoked the agent after the timestamp", () => {
	assert.match(TYPES_SOURCE, /export interface AgentListInvoker/u);
	assert.match(TYPES_SOURCE, /invokedBy\?: AgentListInvoker;/u);
	assert.match(INVOKER_SOURCE, /export function InvokerBy/u);
	assert.match(
		CARD_SOURCE,
		/\{messageTimestamp && item\.invokedBy \? \(\s*<InvokerBy invoker=\{item\.invokedBy\} \/>\s*\) : null\}/u,
	);
	assert.match(
		CARD_SOURCE,
		/\{!messageTimestamp && item\.invokedBy \? \(\s*<InvokerBy invoker=\{item\.invokedBy\} \/>\s*\) : null\}/u,
	);
	assert.match(
		INVOKER_SOURCE,
		/<Avatar className="shrink-0" label=\{invoker\.name\} size="xs" title=\{invoker\.name\}>/u,
	);
	assert.match(INVOKER_SOURCE, /<TooltipContent>\{invoker\.name\}<\/TooltipContent>/u);
	assert.match(DATA_SOURCE, /invokedBy: DEMO_INVOKER/u);
	assert.match(DATA_SOURCE, /name: "Jordan Lee"/u);
});

test("the session activity header can preserve a consumer-provided completed timestamp", () => {
	assert.match(CARD_SOURCE, /fallback = "Just now"/u);
	assert.match(CARD_SOURCE, /timeFallback\?: string;/u);
	assert.match(CARD_SOURCE, /<AgentListTime fallback=\{timeFallback\} item=\{item\} \/>/u);
});

test("local sessions show a static timestamp, devices icon, and machine name", () => {
	assert.match(TYPES_SOURCE, /export type AgentListHost = "cloud" \| "local";/u);
	assert.match(TYPES_SOURCE, /host\?: AgentListHost;/u);
	assert.match(TYPES_SOURCE, /machineName\?: string;/u);
	assert.match(
		SESSION_SOURCE,
		/export function isLocalAgentListItem\(item: AgentListItem\): boolean \{\s*return getAgentListHost\(item\) === "local";/u,
	);
	assert.match(INDEX_SOURCE, /isLocalAgentListItem,/u);
	assert.match(INVOKER_SOURCE, /export function InvokerAvatar/u);
	assert.match(
		INVOKER_SOURCE,
		/<Avatar className="shrink-0" label=\{invoker\.name\} size="xs" title=\{invoker\.name\}>/u,
	);
	assert.match(ACTOR_SOURCE, /export function actorInitials/u);
	assert.match(INVOKER_SOURCE, /import \{ actorInitials \} from "\.\/agent-list-actor";/u);
	assert.doesNotMatch(INVOKER_SOURCE, /export function actorInitials/u);
	assert.match(IDENTITY_SOURCE, /import \{ actorInitials \} from "\.\/agent-list-actor";/u);
	assert.match(
		CARD_SOURCE,
		/import \{ InvokerBy \} from "\.\/agent-list-invoker";/u,
	);
	assert.doesNotMatch(
		CARD_SOURCE,
		/import \{ InvokerAvatar, InvokerBy \} from "\.\/agent-list-invoker";/u,
	);
	assert.match(
		CARD_SOURCE,
		/if \(isLocalAgentListItem\(item\) && item\.machineName\) \{[\s\S]*<DevicesIcon color="currentColor" label="" size="small" \/>[\s\S]*\{item\.machineName\}/u,
	);
	const metadataIdentitySource = /function AgentListMetadataIdentity[\s\S]*?(?=\nexport function AgentListActivityHeader)/u.exec(
		CARD_SOURCE,
	)?.[0];
	assert.ok(metadataIdentitySource);
	assert.match(metadataIdentitySource, /<DevicesIcon color="currentColor" label="" size="small" \/>/u);
	assert.doesNotMatch(metadataIdentitySource, /InvokerAvatar/u);
	assert.doesNotMatch(metadataIdentitySource, /item\.invokedBy \?/u);
	const invokerAvatarSource = /export function InvokerAvatar[\s\S]*?(?=\nexport function InvokerBy)/u.exec(
		INVOKER_SOURCE,
	)?.[0];
	assert.ok(invokerAvatarSource);
	assert.doesNotMatch(invokerAvatarSource, /Tooltip/u);
	assert.match(DATA_SOURCE, /host: "local"/u);
	assert.match(DATA_SOURCE, /machineName: "Geoff’s MacBook"/u);
	assert.match(DATA_SOURCE, /timeLabel: "3m ago"/u);
	assert.match(DETAIL_SOURCE, /Local sessions swap the live runtime and agent name/u);
	assert.match(DETAIL_SOURCE, /a devices icon, and the machine name/u);
	assert.doesNotMatch(DETAIL_SOURCE, /16px invoker avatar, and the machine name/u);
});

test("hover actions add an Archive icon beside View or Resume", () => {
	assert.match(TYPES_SOURCE, /onArchive\?: \(item: AgentListItem\) => void;/u);
	assert.match(INDEX_SOURCE, /onArchive=\{onArchive\}/u);
	assert.match(CARD_SOURCE, /import ArchiveBoxIcon from "@atlaskit\/icon\/core\/archive-box";/u);
	assert.match(
		CARD_SOURCE,
		/secondary: onArchive === undefined\s*\?\s*undefined\s*:\s*\{\s*icon: <ArchiveBoxIcon label="" size="small" \/>,\s*label: "Archive",\s*onClick: \(\) => onArchive\(item\),\s*\},/u,
	);
	// An action with an icon renders icon-only, with its label as both the
	// tooltip and the accessible name.
	assert.match(
		ROW_ACTION_SOURCE,
		/<Button\s*aria-label=\{action\.label\}[\s\S]*size="icon-compact"[\s\S]*\{action\.icon\}/u,
	);
	assert.match(ROW_ACTION_SOURCE, /<TooltipContent>\{action\.label\}<\/TooltipContent>/u);
	assert.match(PAGE_SOURCE, /onArchive=\{handleArchive\}/u);
	assert.match(DETAIL_SOURCE, /name: "onArchive"/u);
	assert.match(DETAIL_SOURCE, /Resume on local sessions/u);
});

test("AgentList supports consumer-owned detail flyouts without changing row presentation", () => {
	assert.match(TYPES_SOURCE, /export interface AgentListCustomFlyoutActions \{[\s\S]*close: \(\) => void;[\s\S]*\}/u);
	assert.match(TYPES_SOURCE, /renderFlyout\?: \(item: AgentListItem, actions: AgentListCustomFlyoutActions\) => ReactNode;/u);
	assert.match(INDEX_SOURCE, /renderFlyout,[\s\S]*<AgentListCard[\s\S]*renderFlyout=\{renderFlyout\}/u);
	assert.match(CARD_SOURCE, /const \[customFlyoutHandle\] = useState\(createHoverCardHandle\);/u);
	assert.match(CARD_SOURCE, /if \(renderFlyout\) \{[\s\S]*<HoverCard handle=\{customFlyoutHandle\}>[\s\S]*<HoverCardTrigger[\s\S]*\{row\}[\s\S]*renderFlyout\(item, \{ close: \(\) => customFlyoutHandle\.close\(\) \}\)/u);
});
