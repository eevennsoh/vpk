const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const COMPACT_CARD_SOURCE = readFileSync(
	join(__dirname, "agent-session-compact-card.tsx"),
	"utf8",
);
const ACTIVITY_SOURCE = readFileSync(
	join(__dirname, "../jira-issue/agent-activity.tsx"),
	"utf8",
);
const ACTIVITY_PRESENTATION_SOURCE = readFileSync(
	join(__dirname, "../jira-issue/agent-activity-row-presentation.tsx"),
	"utf8",
);
const DATA_SOURCE = readFileSync(join(__dirname, "data.ts"), "utf8");
const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "agent-session-types.ts"), "utf8");
const WORK_ITEM_SOURCE = readFileSync(join(__dirname, "agent-session-work-item.ts"), "utf8");

test("medium attached reuses the Jira issue agent activity row", () => {
	assert.match(
		COMPACT_CARD_SOURCE,
		/import \{ JiraIssueAgentActivityRows, type JiraIssueAgentAssignment \} from "@\/components\/blocks\/jira-issue\/agent-activity";/u,
	);
	assert.match(COMPACT_CARD_SOURCE, /variant === "medium-attached"/u);
	assert.match(COMPACT_CARD_SOURCE, /<JiraIssueAgentActivityRows/u);
	assert.match(COMPACT_CARD_SOURCE, /activities=\{activities\}/u);
	assert.match(COMPACT_CARD_SOURCE, /avatarLayout="animated"/u);
	assert.match(COMPACT_CARD_SOURCE, /usesStrokeChrome/u);
	assert.match(WORK_ITEM_SOURCE, /item\.state === "needs-input" \|\| item\.state === "attention"/u);
	assert.match(COMPACT_CARD_SOURCE, /items\.map\(toJiraIssueAgentActivityFromSession\)/u);
	assert.match(COMPACT_CARD_SOURCE, /const shouldPlayArrival = isArriving && !shouldReduceMotion;/u);
	assert.match(COMPACT_CARD_SOURCE, /data-new=\{isNew \|\| undefined\}/u);
	assert.match(COMPACT_CARD_SOURCE, /isNew \? "ring-1 ring-border-discovery" : null/u);
	assert.match(COMPACT_CARD_SOURCE, /relative w-\[276px\] rounded-\[10px\] bg-bg-neutral/u);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /relative w-\[276px\][^"]*hover:bg-bg-neutral-hovered/u);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /relative w-\[276px\][^"]*bg-bg-neutral-subtle/u);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /bg-bg-accent-gray-subtlest/u);
	assert.match(COMPACT_CARD_SOURCE, /Newly synced, not yet reviewed/u);
	assert.match(COMPACT_CARD_SOURCE, /absolute left-1 top-1\/2 size-1 -translate-y-1\/2 rounded-full bg-icon-information/u);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /absolute left-1 top-1 /u);
	assert.match(COMPACT_CARD_SOURCE, /initial=\{shouldPlayArrival \? \{ opacity: 0, y: AGENT_SESSION_ARRIVAL_OFFSET_PX \} : false\}/u);
	assert.match(INDEX_SOURCE, /const isAttached = variant === "medium-attached";/u);
	assert.match(INDEX_SOURCE, /\{isAttached \? \(\s*<li data-testid="agent-session-attached-group">[\s\S]*<AgentSessionAttachedCard/u);
	assert.match(INDEX_SOURCE, /\{showUntrackedWorkFlyout \? \(\s*<JiraSessionFlyoutSurface/u);
	assert.doesNotMatch(INDEX_SOURCE, /content=\{isAttached \? "details" : "untracked-work"\}/u);
	assert.match(COMPACT_CARD_SOURCE, /inheritChinSurface/u);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /showAssignmentFlyout=\{false\}/u);
	assert.match(TYPES_SOURCE, /assignment\?: JiraIssueAgentAssignment;/u);
	assert.match(INDEX_SOURCE, /assignment=\{isAttached \? assignment : undefined\}/u);
	assert.match(COMPACT_CARD_SOURCE, /assignment=\{\{/u);
	assert.match(COMPACT_CARD_SOURCE, /\.\.\.assignment,/u);
	// Footer lives on AssignedAgentsMenu via AgentAssignment — attached chrome
	// must not invent a parallel Assign agent control.
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /AssignedAgentsMenu/u);
	assert.doesNotMatch(INDEX_SOURCE, /AssignedAgentsMenu/u);
	assert.match(
		PAGE_SOURCE,
		/onAssignedAgentIdsChange: setAssignedAgentIds/u,
	);
	assert.match(
		PAGE_SOURCE,
		/from "@\/components\/blocks\/agent-assignment\/demo-assigned-agents"/u,
	);
	assert.match(PAGE_SOURCE, /getAgentAssignmentDemoAssignedAgents/u);
	assert.match(
		PAGE_SOURCE,
		/\.\.\.\(item\.invokedBy \? \{ invokedBy: item\.invokedBy \} : \{\}\)/u,
	);
	assert.match(PAGE_SOURCE, /\.\.\.\(item\.host !== undefined \? \{ host: item\.host \} : \{\}\)/u);
	assert.match(PAGE_SOURCE, /\.\.\.\(item\.role !== undefined \? \{ role: item\.role \} : \{\}\)/u);
	assert.match(PAGE_SOURCE, /variant === "medium-attached"/u);
	assert.doesNotMatch(
		COMPACT_CARD_SOURCE,
		/from "@\/components\/blocks\/agent-assignment\/demo-assigned-agents"/u,
	);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /getAgentAssignmentDemoAssignedAgents|INITIAL_ASSIGNED_AGENT_IDS|DEMO_USED_AGENT_IDS/u);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /onAssignedAgentIdsChange/u);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /useState<readonly string\[\]>\(\[item\.id\]\)/u);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /assignedAgents,/u);
});

test("medium attached demonstrates one, many, and finished sessions", () => {
	assert.match(DATA_SOURCE, /AGENT_SESSION_ATTACHED_WORKING_ITEMS:[\s\S]*state: "running"[\s\S]*timeLabel: "8m"/u);
	assert.match(
		DATA_SOURCE,
		/AGENT_SESSION_ATTACHED_MULTI_WORKING_ITEMS:[\s\S]*id: "PAY-112:claude"[\s\S]*id: "PAY-112:cursor"[\s\S]*id: "PAY-112:rovo"/u,
	);
	assert.match(
		DATA_SOURCE,
		/id: "PAY-112:claude",\s*role: "owner"/u,
	);
	assert.match(
		DATA_SOURCE,
		/id: "PAY-112:cursor",\s*invokedBy: \{[\s\S]*name: "Priya Raman"[\s\S]*role: "viewer"/u,
	);
	assert.match(DATA_SOURCE, /host: "local",\s*id: "PAY-112:claude"/u);
	assert.match(DATA_SOURCE, /host: "cloud",\s*id: "PAY-112:cursor"/u);
	assert.match(DATA_SOURCE, /AGENT_SESSION_ATTACHED_FINISHED_ITEMS:[\s\S]*state: "complete"[\s\S]*title: "Finished"/u);
	assert.match(PAGE_SOURCE, /label: "1 agent working"/u);
	assert.match(PAGE_SOURCE, /label: "1–n agents working"/u);
	assert.match(PAGE_SOURCE, /label: "Needs input"/u);
	assert.match(PAGE_SOURCE, /label: "Finished"/u);
	assert.match(DATA_SOURCE, /AGENT_SESSION_ATTACHED_NEEDS_INPUT_ITEMS:[\s\S]*state: "needs-input"/u);
	assert.match(
		PAGE_SOURCE,
		/AGENT_SESSION_ATTACHED_STATES\.map\(\(state\) => \([\s\S]*<AgentSession[\s\S]*items=\{state\.items\}[\s\S]*variant="medium-attached"/u,
	);
});

test("attached multi-agent working rows use Agent Loading, not a horizontal avatar group", () => {
	assert.match(ACTIVITY_SOURCE, /avatarLayout\?: JiraIssueAgentActivityAvatarLayout;/u);
	assert.match(COMPACT_CARD_SOURCE, /avatarLayout="animated"/u);
	assert.doesNotMatch(COMPACT_CARD_SOURCE, /avatarLayout="horizontal-group"/u);
	assert.match(ACTIVITY_PRESENTATION_SOURCE, /<AgentLoading/u);
	assert.match(
		ACTIVITY_PRESENTATION_SOURCE,
		/agents=\{activities\.map\(toAgentLoadingAgent\)\}/u,
	);
});
