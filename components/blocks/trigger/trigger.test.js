const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const TRIGGER_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const CATALOG_SOURCE = readFileSync(join(__dirname, "data", "trigger-catalog.ts"), "utf8");
const DEMO_SOURCE = readFileSync(
	join(__dirname, "..", "..", "website", "demos", "blocks", "trigger-demo.tsx"),
	"utf8",
);
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const BLOCK_DETAILS_SOURCE = readDetailCategorySource("blocks");
const TRIGGER_BYLINES = require(
	join(__dirname, "..", "..", "..", "app", "data", "directory", "trigger-bylines.json"),
);

test("trigger catalog defines expected automation providers and events", () => {
	for (const providerId of [
		"scheduled",
		"jira",
		"confluence",
		"github-gitlab",
		"slack",
		"microsoft-teams",
		"sentry",
		"linear",
		"webhook",
		"pagerduty",
	]) {
		assert.match(CATALOG_SOURCE, new RegExp(`id: "${providerId}"`, "u"));
	}

	for (const eventId of [
		"every-hour",
		"incoming-webhook",
		"work-item-created",
		"work-item-updated",
		"comment-added",
		"status-changed",
		"draft-opened",
		"pull-request-opened",
		"push-to-branch",
		"checks-completed",
		"scheduled-page-review",
		"incident-triggered",
	]) {
		assert.match(CATALOG_SOURCE, new RegExp(`id: "${eventId}"`, "u"));
	}

	assert.match(CATALOG_SOURCE, /export function createAgentTriggerValue/u);
	assert.match(CATALOG_SOURCE, /export interface AgentAutomationRule/u);
	assert.match(CATALOG_SOURCE, /export function createAgentAutomationRule/u);
	assert.match(CATALOG_SOURCE, /export function inferAutomationRules/u);
	assert.match(CATALOG_SOURCE, /export function getAgentAutomationRuleLabel/u);
	assert.match(CATALOG_SOURCE, /export function getAgentTriggerReadableLabel/u);
	assert.match(CATALOG_SOURCE, /export function isAgentTriggerEnabled/u);
	assert.match(CATALOG_SOURCE, /enabled\?: boolean;/u);
	assert.match(CATALOG_SOURCE, /export function serializeAgentTriggerLabels/u);
	assert.match(CATALOG_SOURCE, /DEFAULT_CONFIGURED_TRIGGER_VALUES/u);
	assert.match(CATALOG_SOURCE, /DEFAULT_CONFIGURED_AUTOMATION_RULES/u);
	assert.match(CATALOG_SOURCE, /DEFAULT_NEEDS_CONNECTION_TRIGGER_VALUES/u);
});

test("every trigger provider has byline mock copy in the directory data layer", () => {
	for (const providerId of [
		"scheduled",
		"jira",
		"confluence",
		"github-gitlab",
		"slack",
		"microsoft-teams",
		"sentry",
		"linear",
		"webhook",
		"pagerduty",
	]) {
		const byline = TRIGGER_BYLINES[providerId];
		assert.equal(typeof byline, "string", `missing byline for ${providerId}`);
		assert.ok(byline.trim().length > 0, `empty byline for ${providerId}`);
	}
});

test("provider rows render an animated byline matching the command-menu reveal", () => {
	// Byline copy is sourced from the shared directory data layer, not inlined.
	assert.match(
		TRIGGER_SOURCE,
		/import \{ getTriggerByline \} from "@\/app\/data\/directory\/trigger-bylines";/u,
	);
	// Reveal is driven by interaction + submenu-open state.
	assert.match(TRIGGER_SOURCE, /const isActive = isInteractionActive \|\| isSubmenuOpen;/u);
	assert.match(TRIGGER_SOURCE, /<DropdownMenuSub onOpenChange=\{setIsSubmenuOpen\}>/u);
	// Motion variants mirror the editor-palette nested command label/description.
	assert.match(TRIGGER_SOURCE, /triggerProviderLabelVariants/u);
	assert.match(TRIGGER_SOURCE, /triggerProviderBylineVariants/u);
	assert.match(TRIGGER_SOURCE, /animate=\{isActive \? "active" : "idle"\}/u);
	// Reuses the shared command-menu reveal layout classes.
	assert.match(TRIGGER_SOURCE, /rich-text-command-menu-nested-copy-revealable/u);
});

test("TriggerPicker closes before selection can open the next dialog", () => {
	const closeIndex = TRIGGER_SOURCE.indexOf("setOpen(false);");
	const selectIndex = TRIGGER_SOURCE.indexOf("onSelectEvent(providerId, eventId);");
	assert.ok(closeIndex >= 0, "TriggerPicker should explicitly close its menu");
	assert.ok(selectIndex > closeIndex, "TriggerPicker should close before invoking selection side effects");
});

test("Trigger supports empty, picker, configured, remove, params, and connection states", () => {
	assert.match(TRIGGER_SOURCE, /automationRules\?: readonly AgentAutomationRule\[\];/u);
	assert.match(TRIGGER_SOURCE, /defaultAutomationRules\?: readonly AgentAutomationRule\[\];/u);
	assert.match(TRIGGER_SOURCE, /onAutomationRulesChange\?: \(automationRules: readonly AgentAutomationRule\[\]\) => void;/u);
	assert.match(TRIGGER_SOURCE, /triggers\?: readonly AgentTriggerValue\[\];/u);
	assert.match(TRIGGER_SOURCE, /defaultTriggers\?: readonly AgentTriggerValue\[\];/u);
	assert.match(TRIGGER_SOURCE, /defaultPickerOpen\?: boolean;/u);
	assert.match(TRIGGER_SOURCE, /onTriggersChange\?: \(triggers: readonly AgentTriggerValue\[\]\) => void;/u);
	assert.match(TRIGGER_SOURCE, /onConnectTrigger\?: \(trigger: AgentTriggerValue\) => void;/u);
	assert.match(TRIGGER_SOURCE, /<DropdownMenuSub onOpenChange=\{setIsSubmenuOpen\}>/u);
	assert.match(TRIGGER_SOURCE, /placeholder="Search triggers"/u);
	assert.match(TRIGGER_SOURCE, /No triggers found/u);
	assert.match(TRIGGER_SOURCE, /aria-label="Delete trigger"/u);
	assert.match(TRIGGER_SOURCE, /Requires connection/u);
	assert.match(TRIGGER_SOURCE, /Connection failed/u);
	assert.match(TRIGGER_SOURCE, /disabled=\{disabled\}/u);
	assert.match(TRIGGER_SOURCE, /onSelectEvent\(provider\.id, event\.id\)/u);
	assert.match(TRIGGER_SOURCE, /<TriggerAutomationDialog/u);
	assert.match(TRIGGER_SOURCE, /automationRule=\{draftAutomationRule\}/u);
	assert.match(TRIGGER_SOURCE, /commitAutomationRules\(nextAutomationRules\)/u);
	assert.match(TRIGGER_SOURCE, /getAgentTriggerReadableLabel\(nextTrigger\)/u);
	assert.match(TRIGGER_SOURCE, /const openNewAutomationRuleFromEvent = useCallback\(\(providerId: AgentTriggerProviderId, eventId: string\) => \{[\s\S]*createAgentTriggerValue\(providerId, eventId, 1\)[\s\S]*triggers: \[nextTrigger\],[\s\S]*setAutomationDialogOpen\(true\);/u);
	assert.match(TRIGGER_SOURCE, /<TriggerPicker[\s\S]*label=\{addTriggerLabel\}[\s\S]*onSelectEvent=\{openNewAutomationRuleFromEvent\}/u);
});

test("trigger automation modal uses one shared prompt, name, and active state", () => {
	// Prompt/name/active state live on the automation rule, while event triggers
	// stay nested inside the rule.
	assert.match(CATALOG_SOURCE, /export interface AgentAutomationRule \{[\s\S]*name\?: string;[\s\S]*prompt\?: string;[\s\S]*enabled\?: boolean;[\s\S]*triggers: readonly AgentTriggerValue\[\];/u);
	assert.match(TRIGGER_SOURCE, /automationRule: AgentAutomationRule;/u);
	assert.match(TRIGGER_SOURCE, /const \[draftTriggers, setDraftTriggers\] = useState<readonly AgentTriggerValue\[\]>\(automationRule\.triggers\);/u);
	// The modal owns one shared Agent Instructions rich editor, not per-trigger textareas.
	assert.match(
		TRIGGER_SOURCE,
		/import \{ RichTextCommandMenuSearchField, RichTextEditor \} from "@\/components\/ui-custom\/rich-text-editor";/u,
	);
	assert.match(TRIGGER_SOURCE, /aria-label="Agent Instructions"/u);
	assert.match(TRIGGER_SOURCE, /value=\{sharedPrompt\}/u);
	assert.match(TRIGGER_SOURCE, /onMarkdownChange=\{setSharedPrompt\}/u);
	// The manage-automation editor intentionally omits the data flow diagram tab,
	// so no dataFlowConfig is passed into the Agent Instructions editor here.
	assert.doesNotMatch(TRIGGER_SOURCE, /dataFlowConfig=\{dataFlowConfig\}/u);
	assert.doesNotMatch(TRIGGER_SOURCE, /from "@\/components\/ui\/textarea"/u);
	assert.doesNotMatch(TRIGGER_SOURCE, /aria-label="Trigger prompt"/u);
	assert.doesNotMatch(TRIGGER_SOURCE, /const handlePromptChange = useCallback\(/u);
	// Save commits one automation rule and is disabled until at least one event exists.
	assert.doesNotMatch(TRIGGER_SOURCE, /function applySharedAutomationFields/u);
	assert.match(TRIGGER_SOURCE, /onSave\(createAgentAutomationRule\(\{/u);
	assert.match(TRIGGER_SOURCE, /name: automationName\.trim\(\)/u);
	assert.match(TRIGGER_SOURCE, /enabled: active,/u);
	assert.match(TRIGGER_SOURCE, /prompt: sharedPrompt,/u);
	assert.match(TRIGGER_SOURCE, /triggers: draftTriggers,/u);
	assert.match(TRIGGER_SOURCE, /disabled=\{draftTriggers\.length === 0\}/u);
	assert.match(TRIGGER_SOURCE, /<Switch checked=\{active\}/u);
	assert.match(TRIGGER_SOURCE, /GenerativeIndicatorIcon/u);
	assert.match(TRIGGER_SOURCE, /function TriggerAutomationFlowPreview/u);
	assert.match(TRIGGER_SOURCE, /const visibleTriggers = triggers\.slice\(0, 5\);/u);
	assert.match(TRIGGER_SOURCE, /className="h-px w-8 shrink-0 bg-border"/u);
	assert.match(TRIGGER_SOURCE, /label="Agent instructions"/u);
});

test("Trigger demos and block docs export the required state variations", () => {
	for (const exportName of [
		"TriggerDemoEmpty",
		"TriggerDemoPicker",
		"TriggerDemoConfigured",
		"TriggerDemoMultiple",
		"TriggerDemoNeedsConnection",
		"TriggerDemoManage",
	]) {
		assert.match(DEMO_SOURCE, new RegExp(`export function ${exportName}`, "u"));
	}

	for (const demoSlug of [
		"trigger-demo-empty",
		"trigger-demo-picker",
		"trigger-demo-configured",
		"trigger-demo-multiple",
		"trigger-demo-needs-connection",
		"trigger-demo-manage",
	]) {
		assert.match(REGISTRY_SOURCE, new RegExp(`"${demoSlug}"`, "u"));
		assert.match(BLOCK_DETAILS_SOURCE, new RegExp(`demoSlug: "${demoSlug}"`, "u"));
	}

	assert.doesNotMatch(DEMO_SOURCE, /<Trigger defaultPickerOpen \/>/u);
});
