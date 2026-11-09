const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const DIALOG_SOURCE = readFileSync(
	join(__dirname, "components", "manage-triggers-dialog.tsx"),
	"utf8",
);
const AGENT_FIELDS_SOURCE = readFileSync(
	join(__dirname, "..", "agent", "components", "agent.tsx"),
	"utf8",
);
const AUTOMATION_DIALOGS_HOOK_SOURCE = readFileSync(
	join(__dirname, "..", "agent", "hooks", "use-agent-automation-dialogs.ts"),
	"utf8",
);
const DEMO_SOURCE = readFileSync(
	join(__dirname, "..", "..", "website", "demos", "blocks", "trigger-demo.tsx"),
	"utf8",
);

test("ManageTriggersDialog restores the compact drag-list modal", () => {
	assert.match(DIALOG_SOURCE, /Manage flows/u);
	assert.match(DIALOG_SOURCE, /\{open \? \(\s*<TriggerPicker/u);
	assert.match(DIALOG_SOURCE, /<TriggerPicker/u);
	assert.match(DIALOG_SOURCE, /onSelectEvent=\{onAddAutomation\}/u);
	assert.match(DIALOG_SOURCE, /<DialogClose/u);

	assert.match(DIALOG_SOURCE, /<DndContext/u);
	assert.match(DIALOG_SOURCE, /restrictToVerticalAxis/u);
	assert.match(DIALOG_SOURCE, /<SortableContext/u);
	assert.match(DIALOG_SOURCE, /useSortable\(\{ id: automationRule\.id \}\)/u);
	assert.match(DIALOG_SOURCE, /onReorderAutomations\(String\(active\.id\), String\(over\.id\)\)/u);

	assert.match(DIALOG_SOURCE, /No flows yet\./u);
});

test("ManageTriggersDialog rows manage automation rules, not individual event triggers", () => {
	assert.match(DIALOG_SOURCE, /function ManageAutomationFlowVisual/u);
	assert.match(DIALOG_SOURCE, /<AgentTriggerProviderTileIcon[\s\S]*trigger=\{trigger\}/u);
	// Figma reposition: trigger icon tiles stack above the text, with no
	// connector line or trailing agent-instructions tile in the row visual.
	assert.doesNotMatch(DIALOG_SOURCE, /GenerativeIndicatorIcon/u);
	assert.doesNotMatch(DIALOG_SOURCE, /label="Agent instructions"/u);
	assert.doesNotMatch(DIALOG_SOURCE, /className="h-px w-5 bg-border"/u);
	assert.match(DIALOG_SOURCE, /flex min-w-0 flex-1 flex-col items-start/u);
	assert.match(DIALOG_SOURCE, /getAgentTriggerReadableLabel\(automationRule\.triggers\[0\]\)/u);
	assert.match(DIALOG_SOURCE, /function getAutomationRuleSecondary/u);
	assert.match(DIALOG_SOURCE, /getTriggerProvider\(trigger\.providerId\)/u);
	assert.match(DIALOG_SOURCE, /rule\.triggers\.length/u);
	assert.match(DIALOG_SOURCE, /getAgentAutomationRuleLabel\(automationRule, index\)/u);

	assert.doesNotMatch(DIALOG_SOURCE, /trigger\.prompt\?\.trim/u);
	assert.doesNotMatch(DIALOG_SOURCE, /No prompt set/u);

	assert.match(DIALOG_SOURCE, /const enabled = automationRule\.enabled !== false;/u);
	assert.match(DIALOG_SOURCE, /onCheckedChange=\{\(nextEnabled\) => onToggle\(automationRule\.id, nextEnabled\)\}/u);
	assert.match(DIALOG_SOURCE, /hover:bg-bg-danger-hovered hover:text-text-danger/u);
	assert.match(DIALOG_SOURCE, /onClick=\{\(\) => onDelete\(automationRule\.id\)\}/u);
	assert.match(DIALOG_SOURCE, /onClick=\{\(\) => onEdit\(automationRule\)\}/u);
});

test('agent config fallback wires "Manage flows" to ManageTriggersDialog', () => {
	assert.match(AGENT_FIELDS_SOURCE, /import \{ ManageTriggersDialog \}/u);
	assert.match(AGENT_FIELDS_SOURCE, /from "@\/components\/blocks\/agent\/hooks\/use-agent-automation-dialogs";/u);
	assert.match(AGENT_FIELDS_SOURCE, /<ManageTriggersDialog/u);
	assert.match(AGENT_FIELDS_SOURCE, /automationRules=\{currentAutomationRules\}/u);
	assert.match(AGENT_FIELDS_SOURCE, /onEditAutomation=\{handleEditAutomationFromManage\}/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /const \[manageTriggersOpen, setManageTriggersOpen\] = useState\(false\)/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /setManageTriggersOpen\(true\)/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /const handleAddAutomationFromManage = useCallback\(/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /const handleReorderAutomations = useCallback\(/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /const handleToggleAutomation = useCallback\(/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /const handleDeleteAutomation = useCallback\(/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /handleEditTriggers\(automationRule, true\)/u);
	assert.match(AUTOMATION_DIALOGS_HOOK_SOURCE, /const currentAutomationRules = useMemo\([\s\S]*getAgentAutomationRules\(config\)/u);
});

test("manage demo opens the restored dialog and keeps full automation editing available", () => {
	assert.match(DEMO_SOURCE, /export function TriggerDemoManage/u);
	assert.match(DEMO_SOURCE, /<ManageTriggersDialog/u);
	assert.match(DEMO_SOURCE, /<TriggerAutomationDialog/u);
	// The manage dialog stays closed on landing and opens from its button.
	assert.match(DEMO_SOURCE, /const \[manageOpen, setManageOpen\] = useState\(false\)/u);
	assert.match(DEMO_SOURCE, /setManageOpen\(true\)/u);
	assert.match(DEMO_SOURCE, /const \[automationOpen, setAutomationOpen\] = useState\(false\)/u);
	assert.match(DEMO_SOURCE, /setAutomationOpen\(true\)/u);
	assert.match(DEMO_SOURCE, /automationRules=\{automationRules\}/u);
	assert.match(DEMO_SOURCE, /onSave=\{handleSaveAutomation\}/u);
});
