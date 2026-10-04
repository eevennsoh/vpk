const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const AGENT_TEST_PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "agent-test.tsx"),
	"utf8",
);

test("AgentTestPanel isolates the live-draft agent in a nested chat provider", () => {
	assert.match(AGENT_TEST_PANEL_SOURCE, /export interface AgentTestPanelProps \{[\s\S]*entry: StudioSessionAgentEntry;[\s\S]*className\?: string;[\s\S]*\}/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /aria-label="Agent test"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /data-testid="agent-test-panel"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /className=\{cn\("h-full min-h-0 px-4", className\)\}/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /const snapshotKey = `\$\{entry\.profile\.id\}:\$\{selectedOption\.id\}:\$\{JSON\.stringify\(selectedResult\)\}`;/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /<RovoChatProvider[\s\S]*key=\{`\$\{snapshotKey\}:\$\{resetKey\}`\}[\s\S]*agentProfiles=\{\[testAgentProfile\]\}[\s\S]*autoSelectAgentId=\{testAgentProfile\.id\}/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /selectAgent\(testAgentProfile\.id, \{ preserveCurrentThread: true \}\);/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /import RefreshIcon from "@atlaskit\/icon\/core\/refresh";/u);
});

test("AgentTestPanel defaults to chat with a version + reset header (no testing-options landing)", () => {
	// Chat is the only surface now; the start landing and its surface state machine are gone.
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /type AgentTestSurface/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /kind: "start"/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /function AgentTestStartView/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /data-testid="agent-test-start"/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /Back to testing options/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /No automations yet/u);
	// Header keeps the version select + Reset, drops the back button.
	assert.match(AGENT_TEST_PANEL_SOURCE, /function AgentTestHeader\(/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /<AgentTestHeader[\s\S]*onReset=\{\(\) => setResetKey\(\(currentKey\) => currentKey \+ 1\)\}[\s\S]*onSelectVersion=\{setSelectedVersionId\}[\s\S]*selectedVersionId=\{selectedVersionId\}[\s\S]*versionOptions=\{versionOptions\}/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /const \[resetKey, setResetKey\] = useState\(0\);/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /onClick=\{onReset\}[\s\S]*<RefreshIcon label="" size="small" spacing="none" \/>[\s\S]*Reset/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /onClick=\{onBack\}/u);
});

test("AgentTestPanel chat panel wires one greeting list for starters and flows", () => {
	assert.match(AGENT_TEST_PANEL_SOURCE, /<ChatPanel[\s\S]*abortOnUnmount=\{false\}[\s\S]*showAgentTestControls[\s\S]*suppressCustomAgentTabs[\s\S]*hideHeader/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /containerClassName="h-full min-h-0 w-full overflow-visible"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /composerContainerClassName="px-0 \[&_\.chat-composer-surface\]:max-w-\[600px\]"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /conversationContentClassName="px-0 max-w-\[600px\]"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /const shouldShowTestHeader = testAgentProfile\.starters\.length > 0 \|\| automationRules\.length > 0;/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /greeting=\{\{[\s\S]*heading: testAgentProfile\.name,[\s\S]*suggestions: testAgentProfile\.starters,[\s\S]*showStarterGroupLabel: shouldShowTestHeader,[\s\S]*starterGroupLabel: "Test the following",[\s\S]*agentTestSection: \([\s\S]*<AgentTestAutomationGreetingRows/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /greetingSelectedAgent=\{testAgentProfile\}/u);
});

test("AgentTestPanel surfaces automations in the greeting and runs them inline in chat", () => {
	assert.match(AGENT_TEST_PANEL_SOURCE, /function AgentTestAutomationGreetingRows\(/u);
	// Empty automations → no extra flow rows.
	assert.match(AGENT_TEST_PANEL_SOURCE, /if \(automationRules\.length === 0\) \{[\s\S]*return null;/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /illustration-spot\/general\/automation-2/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, />\s*Flows\s*</u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /import \{ AgentAutomationFlowCover \} from "@\/components\/blocks\/triggers\/components\/agent-automation-flow-cover";/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /function AgentTestAutomationFlow[\s\S]*<AgentAutomationFlowCover[\s\S]*rootElement="span"[\s\S]*triggers=\{rule\.triggers\}/u);
	// Clicking a row plays a scripted user + assistant turn that streams in via
	// staged replaceMessages calls (not an instant single dump).
	assert.match(AGENT_TEST_PANEL_SOURCE, /function buildAutomationRunPlan\(/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /const trigger = rule\.triggers\[0\];/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /const result = createAutomationTestResult\(rule, ruleIndex, trigger\);/u);
	// Progressive playback: a stable assistant id, delayed frames, and a run token
	// so a newer run supersedes an in-flight one.
	assert.match(AGENT_TEST_PANEL_SOURCE, /const frames: AutomationRunFrame\[\]/u);
	// Tool calls + streamed reply; the payload/callback ride inside the thought.
	assert.match(AGENT_TEST_PANEL_SOURCE, /toolName: "jira\.search_work_items"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /toolName: "slack\.send_message"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /state: "streaming"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /input: result\.payload/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /output: result\.callback/u);
	// The old standalone automation detail surface is gone.
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /AgentTestAutomationDetailView/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /function AutomationTestCard/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /function AutomationTestEventRow/u);
});

test("AgentTestPanel reveals a hover Edit affordance that opens the trigger editor in situ", () => {
	// The studio trigger dialog wrapper is wired in.
	assert.match(AGENT_TEST_PANEL_SOURCE, /import \{ AgentTriggersDialog \} from "@\/components\/ui-custom\/agent-triggers-dialog";/u);
	// The row hosts the run button + a hover-revealed Edit button, so it can no
	// longer be a single <button> (no nested buttons). It is a group container.
	assert.match(AGENT_TEST_PANEL_SOURCE, /<div className="group\/automation-row /u);
	// Edit is a normal outline button labelled "Edit", collapsed (grid 0fr +
	// opacity-0) at rest and revealed with an 8px gap (ml-2) on row hover or
	// keyboard focus, with a descriptive aria-label.
	assert.match(AGENT_TEST_PANEL_SOURCE, /aria-label=\{`Edit \$\{label\}`\}[\s\S]*size="compact"[\s\S]*variant="outline"[\s\S]*>\s*Edit\s*<\/Button>/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /grid-cols-\[0fr\][\s\S]*group-hover\/automation-row:grid-cols-\[1fr\]/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /group-hover\/automation-row:ml-2/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /group-focus-within\/automation-row:grid-cols-\[1fr\]/u);
	// Clicking Edit opens the in-situ "Edit flow" dialog seeded with that rule;
	// Save commits the edited rule into the editable local flows.
	assert.match(AGENT_TEST_PANEL_SOURCE, /const \[editingRule, setEditingRule\] = useState<AgentAutomationRule \| null>\(null\);/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /function handleEditAutomation\([\s\S]*setEditingRule\(rule\);/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /function handleTriggersSave\([\s\S]*current\.map\(\(rule\) => \(rule\.id === automationRule\.id \? automationRule : rule\)\)/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /<AgentTriggersDialog[\s\S]*automationRule=\{editingRule\}[\s\S]*onSave=\{handleTriggersSave\}[\s\S]*title="Edit flow"/u);
});

test("AgentTestPanel builds test profile data from the live draft", () => {
	assert.match(AGENT_TEST_PANEL_SOURCE, /const id = `agent-test-\$\{entry\.profile\.id\}`;/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /function buildAgentTestProfile\([\s\S]*entry: StudioSessionAgentEntry,[\s\S]*result: RovoDataParts\["agent-result"\],[\s\S]*versionLabel: string,[\s\S]*\): RovoAgentProfile/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /getPayloadString\(payload, \["name", "agentName", "title"\]\) \?\? entry\.profile\.name \?\? "Agent test"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /getConversationStarterLabels\(payload\)\.map\(\(starter, index\) =>[\s\S]*createAgentTestStarter\(id, starter, index, \{/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /contextDescription: createAgentTestContextDescription\(\{[\s\S]*versionLabel,/u);
});

test("AgentTestPanel derives version options and sample automation payloads", () => {
	assert.match(AGENT_TEST_PANEL_SOURCE, /function getAgentTestVersionOptions\(entry: StudioSessionAgentEntry\)/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /id: "latest",\s*\n\s*label: "Draft",\s*\n\s*variant: "neutral",/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /const automationRules = useMemo<readonly AgentAutomationRule\[\]>\([\s\S]*\(\) => selectedResult\.automationRules \?\? \[\]/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /function createAutomationTestResult\([\s\S]*automationName = getAgentAutomationRuleLabel\(rule, ruleIndex\)[\s\S]*getProviderSampleData\(trigger\)/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /case "jira":[\s\S]*issueKey: "PROJ-248"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /case "confluence":[\s\S]*pageId: "983421"/u);
});
