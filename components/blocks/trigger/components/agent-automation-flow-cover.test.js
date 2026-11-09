const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const COMPONENT_SOURCE = fs.readFileSync(
	path.join(__dirname, "agent-automation-flow-cover.tsx"),
	"utf8",
);

const TEST_PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../agent-test/components/agent-test.tsx"),
	"utf8",
);
const TRIGGER_PAGE_SOURCE = fs.readFileSync(
	path.join(__dirname, "../page.tsx"),
	"utf8",
);

const TRIGGER_CONFIG_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../trigger-config/components/trigger-config.tsx"),
	"utf8",
);
const TRIGGER_INSTRUCTIONS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../trigger-config/components/trigger-instructions-composer.tsx"),
	"utf8",
);
const TRIGGER_CONFIG_PROFILE_COVER_SOURCE =
	TRIGGER_CONFIG_SOURCE.match(/function TriggerConfigProfileCover[\s\S]*?\n\}/u)?.[0] ?? "";

test("AgentAutomationFlowCover owns the automation-to-agent visual treatment", () => {
	assert.match(COMPONENT_SOURCE, /export function AgentAutomationFlowCover\(/u);
	assert.match(COMPONENT_SOURCE, /visibleTriggers = triggers\.slice\(0, 5\)/u);
	assert.match(COMPONENT_SOURCE, /className="rich-text-command-menu-avatar inline-flex size-8 shrink-0 items-center justify-center"/u);
	assert.match(COMPONENT_SOURCE, /<AgentTriggerProviderTileIcon[\s\S]*fallback=\{<AutomationIcon label="" size="small" \/>\}[\s\S]*trigger=\{trigger\}/u);
	assert.match(COMPONENT_SOURCE, /className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-bg-input px-1\.5 text-xs font-medium leading-4 text-text-subtle"/u);
	assert.match(COMPONENT_SOURCE, /className="h-px w-6 shrink-0 bg-border"/u);
	assert.match(COMPONENT_SOURCE, /icon=\{<GenerativeIndicatorIcon label="" size="small" \/>\}[\s\S]*size="small"[\s\S]*variant="gray"/u);
	assert.match(COMPONENT_SOURCE, /function CompactFlowTile\([\s\S]*<Tile aria-hidden=\{true\} className="bg-surface" hasBorder label=\{label\} size="xxsmall" variant="transparent">/u);
	assert.match(TRIGGER_PAGE_SOURCE, /export function AgentTriggerProviderCompactTileIcon/u);
	assert.match(TRIGGER_PAGE_SOURCE, /if \(visual\.kind === "icon"\) \{[\s\S]*<Tile aria-hidden=\{true\} className="bg-surface" hasBorder label=\{provider\.label\} size="xxsmall" variant="transparent">/u);
	assert.match(TRIGGER_PAGE_SOURCE, /return <RichTextMentionVisualMark label=\{provider\.label\} size="pill" visual=\{visual\} \/>;/u);
	assert.match(COMPONENT_SOURCE, /if \(size === "compact"\) \{[\s\S]*className="inline-flex size-4 shrink-0 items-center justify-center"[\s\S]*<AgentTriggerProviderCompactTileIcon/u);
	assert.match(COMPONENT_SOURCE, /if \(size === "compact"\) \{[\s\S]*className="inline-flex h-4 min-w-4 items-center justify-center rounded-full/u);
	assert.match(COMPONENT_SOURCE, /if \(size === "compact"\) \{[\s\S]*<IconTile[\s\S]*icon=\{<GenerativeIndicatorIcon label="" size="small" \/>\}[\s\S]*label="Agent instructions"[\s\S]*size="xxsmall"[\s\S]*variant="gray"/u);
});

test("TriggerConfigProfileCover and AgentTestAutomationFlow use the same shared cover", () => {
	assert.match(TRIGGER_CONFIG_SOURCE, /import \{ AgentAutomationFlowCover \} from "@\/components\/blocks\/trigger\/components\/agent-automation-flow-cover";/u);
	assert.match(TRIGGER_CONFIG_SOURCE, /function TriggerConfigProfileCover\([\s\S]*return <AgentAutomationFlowCover triggers=\{primaryRule\?\.triggers \?\? \[\]\} \/>;/u);
	assert.doesNotMatch(TRIGGER_CONFIG_PROFILE_COVER_SOURCE, /GenerativeIndicatorIcon/u);
	assert.doesNotMatch(TRIGGER_CONFIG_PROFILE_COVER_SOURCE, /visibleTriggers = triggers\.slice/u);

	assert.match(TEST_PANEL_SOURCE, /import \{ AgentAutomationFlowCover \} from "@\/components\/blocks\/trigger\/components\/agent-automation-flow-cover";/u);
	assert.match(TEST_PANEL_SOURCE, /function AgentTestAutomationFlow[\s\S]*<AgentAutomationFlowCover[\s\S]*rootElement="span"[\s\S]*triggers=\{rule\.triggers\}/u);
	assert.doesNotMatch(TEST_PANEL_SOURCE, /function AgentTestAutomationFlow[\s\S]*AiSparkleIcon/u);
	assert.doesNotMatch(TEST_PANEL_SOURCE, /function AgentTestAutomationFlow[\s\S]*rule\.triggers\.slice\(0, 2\)/u);
});

test("TriggerConfig instructions can run with or without a custom prompt", () => {
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /type AgentRunPromptMode = "run-agent" \| "custom-prompt";/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /const AGENT_RUN_PROMPT_CONNECTOR_LEFT = "0px";/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /const AGENT_RUN_PROMPT_CONNECTOR_TOP = `calc\(-1 \* \$\{token\("space\.200"\)\}\)`;/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /const AGENT_RUN_PROMPT_CONNECTOR_WIDTH = token\("space\.200"\);/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /const AGENT_RUN_PROMPT_CONNECTOR_HEIGHT = "33px";/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /const AGENT_RUN_PROMPT_ROW_PADDING_LEFT = token\("space\.300"\);/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /const \[runPromptMode, setRunPromptMode\] = useState<AgentRunPromptMode>/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /const resolvedRunPromptMode = instructions\?\.trim\(\) \? "custom-prompt" : runPromptMode;/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /if \(value === "run-agent"\) \{[\s\S]*stashedCustomPromptRef\.current = instructions \?\? "";[\s\S]*setMentionInventoryResetKey\(\(current\) => current \+ 1\);[\s\S]*onInstructionsChange\?\.\(""\);[\s\S]*\}/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /\}, \[instructions, onInstructionsChange\]\);/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /aria-hidden="true"[\s\S]*className="pointer-events-none absolute border-b border-l border-border"[\s\S]*borderBottomLeftRadius: token\("radius\.large"\)/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /aria-label="Agent run prompt mode"/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /role="radiogroup"/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /role="radio"/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /aria-checked=\{resolvedRunPromptMode === "run-agent"\}/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /aria-checked=\{resolvedRunPromptMode === "custom-prompt"\}/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /onClick=\{\(\) => handleRunPromptModeChange\("run-agent"\)\}[\s\S]*<GenerativeIndicatorIcon label="" size="small" \/>[\s\S]*Run agent/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /onClick=\{\(\) => handleRunPromptModeChange\("custom-prompt"\)\}[\s\S]*Pass a custom prompt/u);
	assert.match(TRIGGER_INSTRUCTIONS_SOURCE, /<AgentInstructionsComposer[\s\S]*onInstructionsChange=\{onInstructionsChange\}[\s\S]*showEditor=\{resolvedRunPromptMode === "custom-prompt"\}/u);
});
