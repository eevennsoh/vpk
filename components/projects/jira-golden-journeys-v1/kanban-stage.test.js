const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const STAGE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journeys-v1/components/kanban-stage.tsx"),
	"utf8",
);
const ACTIVITY_DATA_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journeys-v1/data/kanban-activity-data.ts"),
	"utf8",
);
const HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journeys-v1/hooks/use-kanban-lifecycle.ts"),
	"utf8",
);
const JIRA_KANBAN_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/jira-kanban/index.tsx"),
	"utf8",
);
const JIRA_ISSUE_AGENT_ACTIVITY_SOURCE = [
	fs.readFileSync(
		path.join(process.cwd(), "components/blocks/jira-issue/agent-activity.tsx"),
		"utf8",
	),
	fs.readFileSync(
		path.join(process.cwd(), "components/blocks/jira-issue/agent-activity-row-presentation.tsx"),
		"utf8",
	),
].join("\n");
const JIRA_ISSUE_COMPLETED_RUNS_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/jira-issue/completed-agent-runs.tsx"),
	"utf8",
);

test("Kanban stage wires the shared issue lifecycle callbacks", () => {
	assert.match(STAGE_SOURCE, /<JiraKanbanBoardHeader/u);
	assert.match(STAGE_SOURCE, /filterJiraKanbanColumnsByAssignee/u);
	assert.match(STAGE_SOURCE, /boardColumns=\{filteredBoardColumns\}/u);
	assert.match(STAGE_SOURCE, /handleClearSelection\(\);[\s\S]*handleCardDragEnd\(\);/u);
	assert.match(STAGE_SOURCE, /onCardGenerativeActionSubmit=\{handleGenerativeActionSubmit\}/u);
	assert.doesNotMatch(STAGE_SOURCE, /onCardAgentActivityQuestionSubmit/u);
	assert.match(STAGE_SOURCE, /submit: \(\) => handleQuestionSubmit\(/u);
	assert.match(STAGE_SOURCE, /onCardAgentActivityViewChat=\{handleViewChat\}/u);
	assert.match(STAGE_SOURCE, /onCardAgentDoneRunView=\{handleCompletedAgentView\}/u);
	assert.match(STAGE_SOURCE, /onCardAgentDoneRunReview=\{\(_run, card\) =>/u);
	assert.match(STAGE_SOURCE, /if \(card\.code === "JGP-247"\) setCodeReviewOpen\(true\);/u);
	assert.match(STAGE_SOURCE, /files=\{JGP_CODE_REVIEW_FILES\}/u);
	assert.match(STAGE_SOURCE, /explorerRootLabel="jira"/u);
	assert.match(STAGE_SOURCE, /hideComposerSourceAndModelControls/u);
	assert.match(STAGE_SOURCE, /workItem=\{JGP_CODE_REVIEW_WORK_ITEM\}/u);
	assert.match(STAGE_SOURCE, /primaryActionLabel="Merge pull request"/u);
	assert.match(STAGE_SOURCE, /Close pull request/u);
	assert.match(STAGE_SOURCE, /Convert to draft pull request/u);
	assert.doesNotMatch(STAGE_SOURCE, /primaryActionLabel="Close review"/u);
	assert.match(STAGE_SOURCE, /onReviewSubmit=\{handleReviewSubmit\}/u);
	assert.match(STAGE_SOURCE, /selectedCardCodes=\{selectedCardCodes\}/u);
	assert.match(JIRA_KANBAN_SOURCE, /onCardAgentDoneRunView\?: \(/u);
	assert.match(
		JIRA_KANBAN_SOURCE,
		/onAgentDoneRunView=\{[\s\S]*onCardAgentDoneRunView[\s\S]*\(run\) => onCardAgentDoneRunView\(run, card, column\.title\)/u,
	);
});

test("completed Kanban story automatically moves JGP-247 into Done", () => {
	assert.match(STAGE_SOURCE, /const JGP_COMPLETION_STORY_DELAY_MS = 2_000;/u);
	assert.match(STAGE_SOURCE, /const JGP_COMPLETION_SCALE_OUT_MS = 400;/u);
	assert.match(STAGE_SOURCE, /createJgpKanbanCompletionStoryColumns/u);
	assert.match(STAGE_SOURCE, /scenario === "local-completed" \? "in-progress" : "done"/u);
	assert.match(
		STAGE_SOURCE,
		/setCompletionStoryPhase\("departing"\);[\s\S]*departureFrame = window\.requestAnimationFrame\(\(\) => \{[\s\S]*moveTimer = window\.setTimeout\(\(\) => \{[\s\S]*setCompletionStoryPhase\("arriving"\);[\s\S]*\}, JGP_COMPLETION_SCALE_OUT_MS\)/u,
	);
	assert.match(STAGE_SOURCE, /window\.requestAnimationFrame\(\(\) => setCompletionStoryPhase\("done"\)\)/u);
	assert.match(STAGE_SOURCE, /animateCardMoves=\{scenario === "local-completed"\}/u);
	assert.match(STAGE_SOURCE, /if \(phase !== "departing" && phase !== "arriving"\) return undefined;/u);
	assert.match(STAGE_SOURCE, /phase,/u);
	assert.match(STAGE_SOURCE, /cardMoveAnimation=\{completionCardMoveAnimation\}/u);
	assert.match(JIRA_KANBAN_SOURCE, /const JIRA_KANBAN_CARD_MOVE: Transition = \{ duration: 0\.6,/u);
	assert.match(JIRA_KANBAN_SOURCE, /const JIRA_KANBAN_CARD_DEPART: Transition = \{ duration: 0\.4,/u);
	assert.match(JIRA_KANBAN_SOURCE, /if \(phase === "arriving"\) return 0\.9;/u);
	assert.match(JIRA_KANBAN_SOURCE, /if \(phase === "departing"\) return 0\.96;/u);
	assert.match(JIRA_KANBAN_SOURCE, /return 1;/u);
	assert.match(JIRA_KANBAN_SOURCE, /initial=\{false\}/u);
	assert.doesNotMatch(JIRA_KANBAN_SOURCE, /JIRA_KANBAN_CARD_(?:MOVE|DEPART)[^;]*duration: 0\.8/u);
	assert.match(
		JIRA_KANBAN_SOURCE,
		/\? \{ scale: getJiraKanbanCardScale\(cardMovePhase\) \}[\s\S]*: undefined/u,
	);
});

test("custom completed agents open a hard-coded floating chat playback", () => {
	assert.match(STAGE_SOURCE, /if \(run\.actionLabel !== "View"\) return;/u);
	assert.match(STAGE_SOURCE, /agentId: run\.agentName\.toLowerCase\(\)\.replaceAll\(" ", "-"\)/u);
	assert.match(STAGE_SOURCE, /request: `Show me what you completed for \$\{card\.code\}\.`/u);
	assert.match(STAGE_SOURCE, /result: \[[\s\S]*run\.description \?\? artifactSummary[\s\S]*artifactSummary/u);
});

test("Kanban stage selects ranges against the filtered columns", () => {
	assert.match(STAGE_SOURCE, /const handleFilteredCardSelect = useCallback/u);
	assert.match(STAGE_SOURCE, /handleCardSelect\(cardCode, columnTitle, indexInColumn, modifiers, filteredBoardColumns\);/u);
	assert.match(STAGE_SOURCE, /onCardSelect=\{handleFilteredCardSelect\}/u);
});

test("JGP Kanban reuses the Jira Issue aggregate row for working agents", () => {
	assert.match(STAGE_SOURCE, /<JiraKanban/u);
	assert.match(JIRA_KANBAN_SOURCE, /agentActivities=\{card\.agentActivities\}/u);
	assert.match(JIRA_KANBAN_SOURCE, /agentActivityMode=\{card\.agentActivityMode\}/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /import \{ Spinner \} from "@\/components\/ui\/spinner";/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /import \{ AgentAvatarVisual \} from "@\/components\/ui-custom\/agent-avatar-visual";/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /agentBrandName\?: ThirdPartyLogoName;/u);
	// Dragged-out uses the shared drag pill (avatar lives inside it). The chin
	// row keeps one AgentAvatarVisual for a featured agent. Multiple agents share
	// the Agent Loading ferris instead of mapping a visual per agent.
	//
	// The second visual belongs to the `horizontal-group` avatar layout, which no
	// caller selects: both callsites and the default pass `animated`, so these
	// surfaces still reach the featured avatar and the shared ferris. Wiring a
	// caller up to `horizontal-group` must re-prove that contract here.
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /<AgentSessionDragPill/u);
	assert.equal(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE.match(/<AgentAvatarVisual/g)?.length, 2);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /avatarLayout = "animated"/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /<AgentLoading[\s\S]*agents=\{activities\.map\(toAgentLoadingAgent\)\}[\s\S]*className="shrink-0"/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /<Spinner label="" \/>/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /isCompletedRow\s*\? featuredActivity\?\.label \?\? "Finished"\s*: summary\.label;/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /if \(isAwaitingInput\) \{[\s\S]*\{rowLabel\}[\s\S]*<AnimatedDots/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /className="block min-w-0 flex-1 truncate text-sm leading-5 text-text"[\s\S]*\{rowLabel\}/u);
	assert.doesNotMatch(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /JiraIssueCyclingAgentLabel|JIRA_ISSUE_AGENT_SHIMMER/u);
	assert.doesNotMatch(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /variant="rainbow"/u);
	assert.doesNotMatch(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /phaseOffsetMs=/u);
	assert.doesNotMatch(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /PixelLoader/u);
});

test("completed Jira agent rows aggregate finished and failed states without hiding hover artifacts", () => {
	assert.match(JIRA_ISSUE_COMPLETED_RUNS_SOURCE, /const finishedLabel = "Finished";/u);
	assert.match(JIRA_ISSUE_COMPLETED_RUNS_SOURCE, /const hasFailedRun = runs\.some\(\(run\) => run\.state === "failed"\);/u);
	assert.match(JIRA_ISSUE_COMPLETED_RUNS_SOURCE, /<StatusErrorIcon color="currentColor" label="" size="small" \/>/u);
	assert.match(JIRA_ISSUE_COMPLETED_RUNS_SOURCE, /<AgentList[\s\S]*flyout="session"[\s\S]*items=\{completedItems\}/u);
	assert.match(JIRA_ISSUE_COMPLETED_RUNS_SOURCE, /<JiraSessionFlyoutTrigger[\s\S]*session=\{\{ \.\.\.session,/u);
});

test("Kanban lifecycle uses deterministic generation and completion delays", () => {
	assert.match(HOOK_SOURCE, /const GENERATING_DELAY_MS = 1_200;/u);
	assert.match(HOOK_SOURCE, /const COMPLETION_DELAY_MS = 5_500;/u);
	assert.doesNotMatch(HOOK_SOURCE, /RFP-/u);
});

test("Kanban starts skill and custom-agent sparkle actions without opening chat", () => {
	assert.match(HOOK_SOURCE, /if \(request\.kind === "ask-rovo"\) \{[\s\S]*onNonAgentAction\?\.\(request, card\);[\s\S]*return;[\s\S]*\}/u);
	assert.match(HOOK_SOURCE, /startCards\(\[card\.code\], getJgpGenerativeAgentSelection\(request\)\);/u);
});

test("Kanban stage shows the Jira selection toolbar when cards are selected", () => {
	// The shared JiraKanban only renders <JiraToolbar> when a selectionToolbar
	// config is passed; without it, selecting cards shows no toolbar.
	assert.match(STAGE_SOURCE, /selectionToolbar=\{\{/u);
	assert.match(STAGE_SOURCE, /onStatusChange:\s*handleStatusChange/u);
	assert.match(STAGE_SOURCE, /onAgentAssignmentChange:\s*handleAgentAssignmentChange/u);
	assert.match(STAGE_SOURCE, /onClearSelection:\s*handleClearSelection/u);
	assert.match(STAGE_SOURCE, /selectedAgentIds/u);
	assert.match(STAGE_SOURCE, /scenario === "global-assignment"\s*\?\s*JGP_GLOBAL_KANBAN_SELECTION_AGENTS\s*:\s*JGP_KANBAN_SELECTION_AGENTS/u);
	assert.match(STAGE_SOURCE, /defaultPinnedAgentIds: \["claude-code", "cursor"\]/u);
	// A plain click selects a single card (and thus reveals the toolbar).
	assert.match(STAGE_SOURCE, /onCardClick=\{handleCardClick\}/u);
});

test("global-session Kanban adds the custom-agent directory while retaining coding defaults", () => {
	assert.match(ACTIVITY_DATA_SOURCE, /import directoryAgentsData from "@\/app\/data\/directory\/agents\.json";/u);
	assert.match(
		ACTIVITY_DATA_SOURCE,
		/export const JGP_GLOBAL_KANBAN_SELECTION_AGENTS[^=]*=\s*\[\s*\.\.\.JGP_KANBAN_AGENTS,\s*\.\.\.JGP_DIRECTORY_AGENTS\.filter\(\(agent\) => agent\.id !== "rovo-dev"\),\s*\]/u,
	);
	assert.match(STAGE_SOURCE, /JGP_GLOBAL_KANBAN_SELECTION_AGENTS/u);
});

test("global-session Kanban reuses the exact ASX work-item skill picker configuration", () => {
	assert.match(
		STAGE_SOURCE,
		/import \{\s*DEFAULT_PINNED_WORK_ITEM_SKILL_IDS,\s*WORK_ITEM_PINNED_ITEMS_LABEL,\s*WORK_ITEM_SKILLS,\s*\} from "@\/components\/blocks\/jira-work-item\/lib\/work-item-picker-options";/u,
	);
	assert.match(STAGE_SOURCE, /defaultPinnedSkillIds: DEFAULT_PINNED_WORK_ITEM_SKILL_IDS/u);
	assert.match(STAGE_SOURCE, /pinnedItemsLabel: WORK_ITEM_PINNED_ITEMS_LABEL/u);
	assert.match(STAGE_SOURCE, /skills: WORK_ITEM_SKILLS/u);
	assert.match(STAGE_SOURCE, /scenario === "global-assignment"/u);
});

test("Bulk agent assignment starts work and moves selected To do cards into In progress", () => {
	// Assigning an agent from the toolbar must run the same lifecycle as a drag /
	// generative action (startCards): move into Drafting + thinking→generating→
	// complete — not merely record the agent id. It should only start cards that
	// are still in Intake, and clear the selection afterwards.
	assert.match(HOOK_SOURCE, /const handleAgentAssignmentChange = useCallback\(\(agentId: string, assigned: boolean\) => \{/u);
	assert.match(HOOK_SOURCE, /JGP_KANBAN_TODO_COLUMN/u);
	assert.match(HOOK_SOURCE, /startCards\(startableCodes, \{ id: agentId \}\)/u);
	assert.match(HOOK_SOURCE, /dispatch\(\{ type: "clear-selection" \}\)/u);
});

test("Kanban stage forwards chat thinking state to the JGP overlay", () => {
	assert.match(STAGE_SOURCE, /useJgpAgentChatDemo\(\)/u);
	assert.match(STAGE_SOURCE, /<JgpRovoOverlay[\s\S]*chatContextBar=\{chatContextBar\}[\s\S]*externalThinkingMessageId=\{externalThinkingMessageId\}/u);
	assert.match(STAGE_SOURCE, /question: activity\.question/u);
	assert.match(STAGE_SOURCE, /intro: activity\.message/u);
	assert.match(STAGE_SOURCE, /onQuestionAnswer=\{pendingChatQuestion \? handleChatQuestionAnswer : undefined\}/u);
});

test("Carl's Code Review canvas opens the Claude Code session profile", () => {
	assert.match(STAGE_SOURCE, /agentProfile=\{JGP_CLAUDE_CODE_AGENT_PROFILE\}/u);
});
