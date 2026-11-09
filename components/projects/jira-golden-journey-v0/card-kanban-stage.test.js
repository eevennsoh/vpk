const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const STAGE_SOURCE = readFileSync(join(__dirname, "components/card-kanban-stage.tsx"), "utf8");
const HEADER_SOURCE = readFileSync(join(__dirname, "components/gallery-header-controls.tsx"), "utf8");
const AUTO_CYCLE_SOURCE = readFileSync(join(__dirname, "hooks/use-auto-cycle.ts"), "utf8");
const ASX_PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const DATA_SOURCE = readFileSync(join(__dirname, "data/card-kanban-data.ts"), "utf8");
const JIRA_ISSUE_SOURCE = readFileSync(join(__dirname, "../../blocks/jira-issue/index.tsx"), "utf8");
const AGENT_ACTIVITY_SOURCE = readFileSync(join(__dirname, "../../blocks/jira-issue/agent-activity.tsx"), "utf8");
const COMPLETED_RUNS_SOURCE = readFileSync(join(__dirname, "../../blocks/jira-issue/completed-agent-runs.tsx"), "utf8");

test("Card Kanban collapses its automated states into one progress-labelled header section", () => {
	assert.match(HEADER_SOURCE, /selectedId === "card"/u);
	assert.match(HEADER_SOURCE, /label: "Card kanban"/u);
	assert.match(HEADER_SOURCE, /count = ASX_CARD_KANBAN_STATES\.length/u);
	assert.match(HEADER_SOURCE, /isAutomatedSequence \|\| state\.count === 1/u);
	assert.match(HEADER_SOURCE, /progressLabel\(state\.label, state\.position, state\.count\)/u);
	assert.doesNotMatch(STAGE_SOURCE, /export function CardKanbanControls/u);
});

test("Card Kanban keeps auto-cycling paused while a portalled agent flyout is open", () => {
	assert.match(STAGE_SOURCE, /setExternalInteractionActive,/u);
	assert.match(STAGE_SOURCE, /onAgentActivityOpenChange=\{setExternalInteractionActive\}/u);
	assert.match(AUTO_CYCLE_SOURCE, /setExternalInteractionActive: \(active: boolean\) => void;/u);
	assert.match(AUTO_CYCLE_SOURCE, /wrapperInteractingRef\.current \|\| externalInteractingRef\.current/u);
	assert.match(JIRA_ISSUE_SOURCE, /onAgentActivityOpenChange\?: \(open: boolean\) => void;/u);
	assert.match(JIRA_ISSUE_SOURCE, /onOpenChange=\{handleAgentActivityOpenChange\}/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /<HoverCard/u);
	assert.match(COMPLETED_RUNS_SOURCE, /<HoverCard open=\{aggregateOpen\} onOpenChange=\{handleAggregateOpenChange\}>/u);
});

test("Card Kanban restarts its progression when the gallery re-enters it", () => {
	assert.match(AUTO_CYCLE_SOURCE, /restart: \(\) => void;/u);
	assert.match(AUTO_CYCLE_SOURCE, /const restart = useCallback\(\(\) => \{[\s\S]*setActiveIndex\(0\);[\s\S]*setRestartKey/u);
	assert.match(AUTO_CYCLE_SOURCE, /progress, restartKey/u);
	assert.match(ASX_PAGE_SOURCE, /nextSelectedId === "card" && selectedId !== "card"[\s\S]*restartCardKanban\(\)/u);
	assert.match(ASX_PAGE_SOURCE, /onSelectedChange=\{handleSelectedChange\}/u);
});

test("Card Kanban forwards persistent issue context to floating chat", () => {
	assert.match(STAGE_SOURCE, /const \{ chatContextBar, externalThinkingMessageId, openAgentChat \} = useAsxAgentChatDemo\(\);/u);
	assert.match(STAGE_SOURCE, /<AsxRovoOverlay[\s\S]*chatContextBar=\{chatContextBar\}[\s\S]*externalThinkingMessageId=\{externalThinkingMessageId\}/u);
});

test("Card Kanban adds skill and custom-agent selections as working rows", () => {
	assert.match(STAGE_SOURCE, /if \(request\.kind === "ask-rovo"\) \{[\s\S]*openAgentChat\([\s\S]*return;[\s\S]*\}/u);
	assert.match(STAGE_SOURCE, /const selection = getAsxGenerativeAgentSelection\(request\);[\s\S]*const activity = createAsxKanbanActivity\(selection\.id, false, selection\);/u);
	assert.match(STAGE_SOURCE, /setAddedAgentActivities\(\(current\) => current\.some\(\(candidate\) => candidate\.id === activity\.id\)[\s\S]*\[\.\.\.current, activity\]/u);
	assert.match(STAGE_SOURCE, /agentActivities\.length > 0[\s\S]*\? "working"/u);
});

test("Card Kanban limits its presentation question to two options", () => {
	assert.match(DATA_SOURCE, /options: QUESTION_CARD_SINGLE_SELECT_DEMO\[0\]\.options\.slice\(0, 2\)/u);
	assert.match(DATA_SOURCE, /question: ASX_CARD_KANBAN_DEPLOYMENT_QUESTION/u);
});

test("Card Kanban Done state exposes completed-run summaries and metadata", () => {
	assert.match(DATA_SOURCE, /export const ASX_CARD_KANBAN_DONE_RUNS = \[/u);
	assert.match(DATA_SOURCE, /summary: "Mapped the affected services[\s\S]*agentName: SERVICE_IMPACT_AGENT\.name[\s\S]*issueKey: "PD-40"[\s\S]*relativeTime: "Just now"/u);
	assert.match(STAGE_SOURCE, /agentDoneRuns=\{state === "agent-completed-work" \? ASX_CARD_KANBAN_DONE_RUNS : undefined\}/u);
});
