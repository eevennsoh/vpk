const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const DIALOG_SOURCE = readFileSync(join(__dirname, "agent-triggers-dialog.tsx"), "utf8");
const AGENT_FIELDS_SOURCE = readFileSync(
	join(__dirname, "..", "blocks", "agent", "components", "agent.tsx"),
	"utf8",
);
const AUTOMATION_DIALOGS_HOOK_SOURCE = readFileSync(
	join(__dirname, "..", "blocks", "agent", "hooks", "use-agent-automation-dialogs.ts"),
	"utf8",
);
const COMPACT_CONFIG_NAV_SOURCE = readFileSync(
	join(__dirname, "..", "blocks", "agent", "components", "agent-compact-config-nav.tsx"),
	"utf8",
);
const FILLED_CONFIG_SUMMARY_SOURCE = readFileSync(
	join(__dirname, "..", "blocks", "agent", "components", "agent-filled-config-summary.tsx"),
	"utf8",
);
const TRIGGER_PAGE_SOURCE = readFileSync(
	join(__dirname, "..", "blocks", "trigger", "page.tsx"),
	"utf8",
);
const AGENT_DEMO_SOURCE = readFileSync(
	join(__dirname, "..", "website", "demos", "blocks", "agent-demo.tsx"),
	"utf8",
);

test("AgentTriggersDialog delegates to the trigger-config automation modal", () => {
	// The shared wrapper now hosts the new trigger-config surface inside the modal.
	assert.match(DIALOG_SOURCE, /TriggerConfigAutomationDialog/u);
	assert.match(DIALOG_SOURCE, /type AgentAutomationRule/u);
	assert.match(DIALOG_SOURCE, /automationRule=\{automationRule\}/u);
	assert.match(DIALOG_SOURCE, /onSave=\{onSave\}/u);
});

test("TriggerConfigAutomationDialog hosts AgentConfigFields with Active, Save and Cancel", () => {
	assert.match(TRIGGER_PAGE_SOURCE, /export function TriggerConfigAutomationDialog/u);
	assert.match(TRIGGER_PAGE_SOURCE, /<Switch checked=\{active\}/u);
	assert.match(TRIGGER_PAGE_SOURCE, /<AgentConfigFields/u);
	assert.match(TRIGGER_PAGE_SOURCE, /onAutomationRulesChange=\{handleAutomationRulesChange\}/u);
	assert.match(TRIGGER_PAGE_SOURCE, /onTextChange=\{handleConfigTextChange\}/u);
	assert.match(TRIGGER_PAGE_SOURCE, /Cancel/u);
	assert.match(TRIGGER_PAGE_SOURCE, /\{saveLabel\}/u);
});

test("TriggerConfigAutomationDialog re-seeds draft on open so Cancel discards", () => {
	assert.match(TRIGGER_PAGE_SOURCE, /if \(open && !wasOpen\.current\)/u);
	assert.match(TRIGGER_PAGE_SOURCE, /setDraftRule\(nextSeed\)/u);
});

test("TriggerConfigAutomationDialog Save commits the automation rule and closes; Cancel only closes", () => {
	assert.match(TRIGGER_PAGE_SOURCE, /onSave\(createAgentAutomationRule\(\{/u);
	assert.match(TRIGGER_PAGE_SOURCE, /disabled=\{draftRule\.triggers\.length === 0\}/u);
	assert.match(TRIGGER_PAGE_SOURCE, /onOpenChange\(false\)/u);
	assert.match(TRIGGER_PAGE_SOURCE, /<Button onClick=\{\(\) => onOpenChange\(false\)\} type="button" variant="ghost">/u);
});

test("TriggerPicker is exported and accepts a custom trigger element", () => {
	assert.match(TRIGGER_PAGE_SOURCE, /export function TriggerPicker\(/u);
	assert.match(TRIGGER_PAGE_SOURCE, /trigger\?: ReactElement/u);
	assert.match(TRIGGER_PAGE_SOURCE, /render=\{trigger \?\? <TriggerAddRow label=\{label\} \/>\}/u);
});

test("Trigger summary row routes add-event selections to a new automation draft", () => {
	assert.match(FILLED_CONFIG_SUMMARY_SOURCE, /function AgentTriggerSummaryRow\(/u);
	assert.match(FILLED_CONFIG_SUMMARY_SOURCE, /onClick=\{\(\) => onEditTriggers\?\.\(\)\}/u);
	assert.match(FILLED_CONFIG_SUMMARY_SOURCE, /const next = createAutomationRuleFromEvent\(providerId, eventId, automationRules\);/u);
	assert.match(FILLED_CONFIG_SUMMARY_SOURCE, /onEditTriggers\?\.\(next \?\? undefined\)/u);
	assert.match(FILLED_CONFIG_SUMMARY_SOURCE, /onEditTriggers[\s\S]*\? \(\) => onEditTriggers\(rule\)[\s\S]*: undefined/u);
	assert.doesNotMatch(FILLED_CONFIG_SUMMARY_SOURCE, /onEditTriggers\?\.\(next \? \[\.\.\.existing, next\] : existing\)/u);
});

test("AgentConfigFields hosts a single automation dialog and commits via onAutomationRulesChange", () => {
	assert.match(AGENT_FIELDS_SOURCE, /import \{ AgentTriggersDialog \} from "@\/components\/ui-custom\/agent-triggers-dialog"/u);
	assert.match(AGENT_FIELDS_SOURCE, /from "@\/components\/blocks\/agent\/hooks\/use-agent-automation-dialogs";/u);
	assert.match(AGENT_FIELDS_SOURCE, /<AgentTriggersDialog/u);
	assert.match(AGENT_FIELDS_SOURCE, /automationRule=\{triggersEditor\.seed\}/u);
	assert.match(AGENT_FIELDS_SOURCE, /onSave=\{handleTriggersSave\}/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /const handleEditTriggers = useCallback\(\(seed\?: AgentAutomationRule, fromManage = false, isNew = false\) =>/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /seed: seed \?\? createEmptyAutomationRule\(`automation-\$\{getNextAutomationRuleIndex\(currentAutomationRules\)\}`\)/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /onAutomationRulesChange\?\.\(/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /existingIndex >= 0[\s\S]*current\.map\([\s\S]*: \[\.\.\.current, automationRule\]/u);
});

test("Compact empty nav opens the automation modal", () => {
	assert.match(COMPACT_CONFIG_NAV_SOURCE, /item\.agentFieldName === "trigger"\)\s*\{\s*return \(\) => onEditTriggers\?\.\(\);/u);
});

test("Agent demo round-trips rich automation rules", () => {
	assert.match(AGENT_DEMO_SOURCE, /automationRules: DEFAULT_CONFIGURED_AUTOMATION_RULES/u);
	assert.match(AGENT_DEMO_SOURCE, /function handleAutomationRulesChange\(automationRules: readonly AgentAutomationRule\[\]\)/u);
	assert.match(AGENT_DEMO_SOURCE, /onAutomationRulesChange=\{handleAutomationRulesChange\}/u);
});
