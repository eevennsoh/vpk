const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const STAGE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journeys-v0/components/kanban-stage.tsx"),
	"utf8",
);
const HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journeys-v0/hooks/use-kanban-lifecycle.ts"),
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

test("Kanban stage wires the shared issue lifecycle callbacks", () => {
	assert.match(STAGE_SOURCE, /<JiraKanbanBoardHeader/u);
	assert.match(STAGE_SOURCE, /filterJiraKanbanColumnsByAssignee/u);
	assert.match(STAGE_SOURCE, /boardColumns=\{filteredBoardColumns\}/u);
	assert.match(STAGE_SOURCE, /handleClearSelection\(\);[\s\S]*handleCardDragEnd\(\);/u);
	assert.match(STAGE_SOURCE, /onCardGenerativeActionSubmit=\{handleGenerativeActionSubmit\}/u);
	assert.doesNotMatch(STAGE_SOURCE, /onCardAgentActivityQuestionSubmit/u);
	assert.match(STAGE_SOURCE, /submit: \(\) => handleQuestionSubmit\(/u);
	assert.match(STAGE_SOURCE, /onCardAgentActivityViewChat=\{handleViewChat\}/u);
	assert.match(STAGE_SOURCE, /selectedCardCodes=\{selectedCardCodes\}/u);
});

test("Kanban stage selects ranges against the filtered columns", () => {
	assert.match(STAGE_SOURCE, /const handleFilteredCardSelect = useCallback/u);
	assert.match(STAGE_SOURCE, /handleCardSelect\(cardCode, columnTitle, indexInColumn, modifiers, filteredBoardColumns\);/u);
	assert.match(STAGE_SOURCE, /onCardSelect=\{handleFilteredCardSelect\}/u);
});

test("ASX Kanban reuses the Jira Issue aggregate row for working agents", () => {
	assert.match(STAGE_SOURCE, /<JiraKanban/u);
	assert.match(JIRA_KANBAN_SOURCE, /agentActivities=\{card\.agentActivities\}/u);
	assert.match(JIRA_KANBAN_SOURCE, /agentActivityMode=\{card\.agentActivityMode\}/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /import \{ Spinner \} from "@\/components\/ui\/spinner";/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /<AgentLoading[\s\S]*agents=\{activities\.map\(toAgentLoadingAgent\)\}[\s\S]*className="shrink-0"/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /<Spinner label="" \/>/u);
	assert.doesNotMatch(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /PixelLoader/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /isCompletedRow\s*\? featuredActivity\?\.label \?\? "Finished"\s*: summary\.label;/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /if \(isAwaitingInput\) \{[\s\S]*\{rowLabel\}[\s\S]*<AnimatedDots/u);
	assert.match(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /className="block min-w-0 flex-1 truncate text-sm leading-5 text-text"[\s\S]*\{rowLabel\}/u);
	assert.doesNotMatch(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /JiraIssueCyclingAgentLabel|JIRA_ISSUE_AGENT_SHIMMER/u);
	assert.doesNotMatch(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /phaseOffsetMs=/u);
	assert.doesNotMatch(JIRA_ISSUE_AGENT_ACTIVITY_SOURCE, /variant="rainbow"/u);
});

test("Kanban lifecycle uses deterministic generation and completion delays", () => {
	assert.match(HOOK_SOURCE, /const GENERATING_DELAY_MS = 1_200;/u);
	assert.match(HOOK_SOURCE, /const COMPLETION_DELAY_MS = 5_500;/u);
	assert.match(HOOK_SOURCE, /const INPUT_RESUME_COMPLETION_DELAY_MS = 2_500;/u);
	assert.match(HOOK_SOURCE, /const NEEDS_INPUT_CARD_CODE = "RFP-101";/u);
});

test("Kanban starts skill and custom-agent sparkle actions without opening chat", () => {
	assert.match(HOOK_SOURCE, /if \(request\.kind === "ask-rovo"\) \{[\s\S]*onNonAgentAction\?\.\(request, card\);[\s\S]*return;[\s\S]*\}/u);
	assert.match(HOOK_SOURCE, /startCards\(\[card\.code\], getAsxGenerativeAgentSelection\(request\)\);/u);
});

test("Kanban stage shows the Jira selection toolbar when cards are selected", () => {
	// The shared JiraKanban only renders <JiraToolbar> when a selectionToolbar
	// config is passed; without it, selecting cards shows no toolbar.
	assert.match(STAGE_SOURCE, /selectionToolbar=\{\{/u);
	assert.match(STAGE_SOURCE, /onStatusChange:\s*handleStatusChange/u);
	assert.match(STAGE_SOURCE, /onAgentAssignmentChange:\s*handleAgentAssignmentChange/u);
	assert.match(STAGE_SOURCE, /onClearSelection:\s*handleClearSelection/u);
	assert.match(STAGE_SOURCE, /selectedAgentIds/u);
	assert.match(STAGE_SOURCE, /agents: ROVO_AGENT_SELECTOR_AGENTS/u);
	assert.match(STAGE_SOURCE, /defaultPinnedAgentIds: DEFAULT_PINNED_SPACE_AGENT_IDS/u);
	assert.match(STAGE_SOURCE, /defaultPinnedSkillIds: DEFAULT_PINNED_WORK_ITEM_SKILL_IDS/u);
	assert.match(STAGE_SOURCE, /pinnedItemsLabel: WORK_ITEM_PINNED_ITEMS_LABEL/u);
	assert.match(STAGE_SOURCE, /skills: WORK_ITEM_SKILLS/u);
	// A plain click selects a single card (and thus reveals the toolbar).
	assert.match(STAGE_SOURCE, /onCardClick=\{handleCardClick\}/u);
});

test("Bulk agent assignment starts work and moves selected Intake cards into Drafting", () => {
	// Assigning an agent from the toolbar must run the same lifecycle as a drag /
	// generative action (startCards): move into Drafting + thinking→generating→
	// complete — not merely record the agent id. It should only start cards that
	// are still in Intake, and clear the selection afterwards.
	assert.match(HOOK_SOURCE, /const handleAgentAssignmentChange = useCallback\(\(agentId: string, assigned: boolean\) => \{/u);
	assert.match(HOOK_SOURCE, /ASX_KANBAN_INTAKE_COLUMN/u);
	assert.match(HOOK_SOURCE, /startCards\(startableCodes, \{ id: agentId \}\)/u);
	assert.match(HOOK_SOURCE, /dispatch\(\{ type: "clear-selection" \}\)/u);
});

test("Kanban stage forwards chat thinking state to the ASX overlay", () => {
	assert.match(STAGE_SOURCE, /useAsxAgentChatDemo\(\)/u);
	assert.match(STAGE_SOURCE, /<AsxRovoOverlay[\s\S]*chatContextBar=\{chatContextBar\}[\s\S]*externalThinkingMessageId=\{externalThinkingMessageId\}/u);
	assert.match(STAGE_SOURCE, /question: activity\.question/u);
	assert.match(STAGE_SOURCE, /intro: activity\.message/u);
	assert.match(STAGE_SOURCE, /onQuestionAnswer=\{pendingChatQuestion \? handleChatQuestionAnswer : undefined\}/u);
});
