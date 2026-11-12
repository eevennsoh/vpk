const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const STAGE_SOURCE = readFileSync(join(__dirname, "components/card-kanban-stage.tsx"), "utf8");
const AUTO_CYCLE_SOURCE = readFileSync(join(__dirname, "hooks/use-auto-cycle.ts"), "utf8");
const DATA_SOURCE = readFileSync(join(__dirname, "data/card-kanban-data.ts"), "utf8");
const JIRA_ISSUE_SOURCE = readFileSync(join(__dirname, "../../blocks/jira-issue/index.tsx"), "utf8");
const AGENT_ACTIVITY_SOURCE = readFileSync(join(__dirname, "../../blocks/jira-issue/agent-activity.tsx"), "utf8");
const COMPLETED_RUNS_SOURCE = readFileSync(join(__dirname, "../../blocks/jira-issue/completed-agent-runs.tsx"), "utf8");

test("Card Kanban uses shared separators and restores only the selected left border", () => {
	assert.match(STAGE_SOURCE, /<ButtonGroup\s+variant="connected"\s+\{\.\.\.pauseHandlers\}/u);
	assert.doesNotMatch(STAGE_SOURCE, /<ButtonGroup[^>]*className=/u);
	assert.match(STAGE_SOURCE, /className="relative isolate overflow-hidden aria-pressed:-ml-px aria-pressed:border-l! aria-pressed:z-10"/u);
});

test("Card Kanban keeps auto-cycling paused while a portalled agent flyout is open", () => {
	assert.match(STAGE_SOURCE, /setExternalInteractionActive,/u);
	assert.match(STAGE_SOURCE, /onAgentActivityOpenChange=\{setExternalInteractionActive\}/u);
	assert.match(AUTO_CYCLE_SOURCE, /setExternalInteractionActive: \(active: boolean\) => void;/u);
	assert.match(AUTO_CYCLE_SOURCE, /wrapperInteractingRef\.current \|\| externalInteractingRef\.current/u);
	assert.match(JIRA_ISSUE_SOURCE, /onAgentActivityOpenChange\?: \(open: boolean\) => void;/u);
	assert.match(JIRA_ISSUE_SOURCE, /function handleAgentActivityOpenChange\(open: boolean\) \{[\s\S]*onAgentActivityOpenChange\?\.\(open\);[\s\S]*\}/u);
	assert.match(JIRA_ISSUE_SOURCE, /onOpenChange=\{handleAgentActivityOpenChange\}/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /<HoverCard/u);
	assert.match(COMPLETED_RUNS_SOURCE, /<HoverCard open=\{aggregateOpen\} onOpenChange=\{handleAggregateOpenChange\}>/u);
});

test("Card Kanban restarts its progression when the gallery re-enters it", () => {
	assert.match(AUTO_CYCLE_SOURCE, /restart: \(\) => void;/u);
	assert.match(AUTO_CYCLE_SOURCE, /const restart = useCallback\(\(\) => \{[\s\S]*setActiveIndex\(0\);[\s\S]*setRestartKey/u);
	assert.match(AUTO_CYCLE_SOURCE, /progress, restartKey/u);
});

test("Card Kanban forwards persistent issue context to floating chat", () => {
	assert.match(STAGE_SOURCE, /const \{ chatContextBar, externalThinkingMessageId, openAgentChat \} = useJgpAgentChatDemo\(\);/u);
	assert.match(STAGE_SOURCE, /<JgpRovoOverlay[\s\S]*chatContextBar=\{chatContextBar\}[\s\S]*externalThinkingMessageId=\{externalThinkingMessageId\}/u);
});

test("Card Kanban adds skill and custom-agent selections as working rows", () => {
	assert.match(STAGE_SOURCE, /if \(request\.kind === "ask-rovo"\) \{[\s\S]*openAgentChat\([\s\S]*return;[\s\S]*\}/u);
	assert.match(STAGE_SOURCE, /const selection = getJgpGenerativeAgentSelection\(request\);[\s\S]*const activity = createJgpKanbanActivity\(selection\.id, selection\);/u);
	assert.match(STAGE_SOURCE, /setAddedAgentActivities\(\(current\) => current\.some\(\(candidate\) => candidate\.id === activity\.id\)[\s\S]*\[\.\.\.current, activity\]/u);
	assert.match(STAGE_SOURCE, /agentActivities\.length > 0[\s\S]*\? "working"/u);
});

test("Card Kanban limits its presentation question to two options", () => {
	assert.match(DATA_SOURCE, /options: QUESTION_CARD_SINGLE_SELECT_DEMO\[0\]\.options\.slice\(0, 2\)/u);
	assert.match(DATA_SOURCE, /question: JGP_CARD_KANBAN_DEPLOYMENT_QUESTION/u);
});

test("Card Kanban Done state exposes completed-run summaries and metadata", () => {
	assert.match(DATA_SOURCE, /export const JGP_CARD_KANBAN_DONE_RUNS = \[/u);
	assert.match(DATA_SOURCE, /summary: "Mapped the affected services[\s\S]*agentName: SERVICE_IMPACT_AGENT\.name[\s\S]*issueKey: "PD-40"[\s\S]*relativeTime: "Just now"/u);
	assert.match(STAGE_SOURCE, /agentDoneRuns=\{state === "agent-completed-work" \? JGP_CARD_KANBAN_DONE_RUNS : undefined\}/u);
});
