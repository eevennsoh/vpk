import { slugifySkillName } from "@/app/data/directory/skills";
import {
	createAgentAutomationRule,
	createAgentTriggerValue,
	getAgentAutomationRuleLabel,
	inferAutomationRules,
	type AgentAutomationRule,
} from "@/components/blocks/trigger/data/trigger-catalog";

export type AgentConfigTextFieldName =
	| "name"
	| "description"
	| "instructions"
	| "contextDescription"
	| "trigger"
	| "guardrail"
	// Mode selectors are single-value (string) config like the text fields, so
	// they reuse the same onTextChange plumbing rather than a bespoke callback.
	| "memoryMode"
	| "reasoningMode"
	| "knowledgeMode";

export type AgentConfigListFieldName =
	| "triggers"
	| "skills"
	| "tools"
	| "subagents"
	| "knowledge"
	| "apps"
	| "conversationStarters";

export type AgentConfigReferenceListFieldName = Extract<
	AgentConfigListFieldName,
	"knowledge" | "skills" | "subagents" | "tools" | "apps"
>;

export type AgentDirectoryKind = "knowledge" | "tools" | "apps" | "skills" | "memory" | "conversationStarters";

// Config rows that can be suppressed by callers (e.g. while editing a subagent,
// where these capabilities can't be configured). Keyed by the canonical row key
// used in `AgentFilledConfigSummary` and the `agentFieldName` used by the
// compact empty-config nav and missing-config actions.
export type AgentHideableConfigField = "trigger" | "subagents" | "conversationStarters";

export interface AgentConfigFormValue {
	name?: string;
	description?: string;
	summary?: string;
	instructions?: string;
	contextDescription?: string;
	trigger?: string;
	triggers?: readonly string[];
	automationRules?: readonly AgentAutomationRule[];
	skills?: readonly string[];
	guardrail?: string;
	tools?: readonly string[];
	subagents?: readonly string[];
	knowledge?: readonly string[];
	apps?: readonly string[];
	conversationStarters?: readonly string[];
	conversationStarterIcons?: readonly string[];
	// Per-field set of disabled list items, keyed by the item's label (not index)
	// so the disabled state survives reordering and removal. A configured item
	// (tool / skill / knowledge / subagent) whose label appears here is shown in a
	// disabled state in both the collapsed-nav dropdown and the filled summary,
	// but stays listed until explicitly removed. Persisted on the agent draft
	// alongside the other config fields (e.g. localStorage).
	disabledItems?: Partial<Record<AgentConfigListFieldName, readonly string[]>>;
	// Mode selectors, persisted on the agent draft. Stored loosely as `string`
	// (matching the agent-result wire type); the option lists below
	// (MEMORY_MODE_OPTIONS / REASONING_MODE_SECTIONS / KNOWLEDGE_MODE_OPTIONS)
	// are the source of valid values, narrowed at the selector boundary.
	memoryMode?: string;
	reasoningMode?: string;
	knowledgeMode?: string;
	agentId?: string;
	action?: string;
}

export function getNormalizedAgentReferenceValue(value: string): string {
	return value.trim().toLowerCase();
}

export function getSkillConfigLabel(value: string): string {
	return slugifySkillName(value);
}

export function getAgentConfigListLookupValue(field: AgentConfigListFieldName, value: string): string {
	return field === "skills" ? getSkillConfigLabel(value) : getNormalizedAgentReferenceValue(value);
}

export function getNonEmptyConfigItems(items: readonly string[] | undefined): readonly string[] {
	return (items ?? [])
		.map((item) => item.trim())
		.filter(Boolean);
}

export function getSkillConfigItems(items: readonly string[] | undefined): readonly string[] {
	return getNonEmptyConfigItems(items)
		.map(getSkillConfigLabel)
		.filter(Boolean);
}

export function getAgentAutomationRules(config: AgentConfigFormValue): readonly AgentAutomationRule[] {
	if (Array.isArray(config.automationRules)) {
		return config.automationRules;
	}
	const triggers = getNonEmptyConfigItems(config.triggers);
	if (triggers.length > 0) {
		return inferAutomationRules(triggers) ?? [];
	}

	const trigger = config.trigger?.trim();
	return trigger ? inferAutomationRules([trigger]) ?? [] : [];
}

export function getAgentAutomationItems(config: AgentConfigFormValue): readonly string[] {
	return serializeAgentAutomationRuleLabels(getAgentAutomationRules(config));
}

export function serializeAgentAutomationRuleLabels(rules: readonly AgentAutomationRule[] | undefined): string[] {
	return (rules ?? [])
		.map((rule, index) => getAgentAutomationRuleLabel(rule, index).trim())
		.filter(Boolean);
}

export function getNextAutomationRuleIndex(rules: readonly AgentAutomationRule[] | undefined): number {
	const usedIndexes = (rules ?? [])
		.map((rule) => /^automation-(\d+)$/u.exec(rule.id)?.[1])
		.map((value) => Number(value))
		.filter((value) => Number.isFinite(value));
	return usedIndexes.length > 0 ? Math.max(...usedIndexes) + 1 : (rules?.length ?? 0) + 1;
}

export function createAutomationRuleFromEvent(
	providerId: Parameters<typeof createAgentTriggerValue>[0],
	eventId: string,
	existingRules: readonly AgentAutomationRule[] | undefined,
): AgentAutomationRule | null {
	const nextIndex = getNextAutomationRuleIndex(existingRules);
	const nextTrigger = createAgentTriggerValue(providerId, eventId, 1);
	return nextTrigger
		? createAgentAutomationRule({
				id: `automation-${nextIndex}`,
				name: "",
				prompt: "",
				triggers: [nextTrigger],
			})
		: null;
}

// Disabled-item lookups are label-keyed so they survive reordering and removal
// of the underlying list. Skills use their kebab-case config key; other rows use
// trimmed labels. A missing field or label means "enabled".
export function getDisabledItemLabels(
	config: AgentConfigFormValue | undefined,
	field: AgentConfigListFieldName,
): readonly string[] {
	return config?.disabledItems?.[field] ?? [];
}

export function isAgentListItemDisabled(
	config: AgentConfigFormValue | undefined,
	field: AgentConfigListFieldName,
	label: string,
): boolean {
	const target = getAgentConfigListLookupValue(field, label);
	return getDisabledItemLabels(config, field).some((entry) => getAgentConfigListLookupValue(field, entry) === target);
}

// Pure reducer: returns a new config with `label` added to / removed from the
// field's disabled set. Used by owners that persist the config (e.g. the studio
// draft saved to localStorage). Prunes empty field arrays and an empty
// `disabledItems` map so the persisted shape stays minimal.
export function toggleAgentConfigDisabledItem(
	config: AgentConfigFormValue,
	field: AgentConfigListFieldName,
	label: string,
	enabled: boolean,
): AgentConfigFormValue {
	const target = getAgentConfigListLookupValue(field, label);
	if (!target) {
		return config;
	}
	const current = getDisabledItemLabels(config, field);
	const isCurrentlyDisabled = current.some((entry) => getAgentConfigListLookupValue(field, entry) === target);
	// No-op fast paths keep referential identity stable (avoids needless writes).
	if (enabled && !isCurrentlyDisabled) {
		return config;
	}
	if (!enabled && isCurrentlyDisabled) {
		return config;
	}
	const nextField = enabled
		? current.filter((entry) => getAgentConfigListLookupValue(field, entry) !== target)
		: [...current, target];
	const nextDisabledItems: Partial<Record<AgentConfigListFieldName, readonly string[]>> = {
		...config.disabledItems,
	};
	if (nextField.length > 0) {
		nextDisabledItems[field] = nextField;
	} else {
		delete nextDisabledItems[field];
	}
	const hasAny = Object.keys(nextDisabledItems).length > 0;
	return { ...config, disabledItems: hasAny ? nextDisabledItems : undefined };
}
