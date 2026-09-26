import { getDirectoryMentionItemOrFallback } from "@/components/blocks/editor-palette/data/mention-sources";
import type { RichTextMentionItem, RichTextReferenceCategory } from "@/components/ui-custom/rich-text-editor";

import {
	type AgentConfigFormValue,
	type AgentConfigReferenceListFieldName,
	getAgentConfigListLookupValue,
	getNonEmptyConfigItems,
	getNormalizedAgentReferenceValue,
} from "@/components/blocks/agent/lib/agent-config-model";


export const AGENT_CONFIG_FIELD_BY_REFERENCE_CATEGORY: Record<RichTextReferenceCategory, AgentConfigReferenceListFieldName> = {
	knowledge: "knowledge",
	skill: "skills",
	subagent: "subagents",
	tool: "tools",
	app: "apps",
};

export const AGENT_REFERENCE_CATEGORY_BY_CONFIG_FIELD: Record<AgentConfigReferenceListFieldName, RichTextReferenceCategory> = {
	knowledge: "knowledge",
	skills: "skill",
	subagents: "subagent",
	tools: "tool",
	apps: "app",
};

export function toMentionId(category: RichTextMentionItem["category"], id: string): string {
	return `${category}:${id.trim().replace(/\s+/g, "-")}`;
}

export function getAgentReferenceKey(
	field: AgentConfigReferenceListFieldName,
	value: string,
): string {
	return `${field}:${getAgentConfigListLookupValue(field, value)}`;
}

export function hasAgentReferenceValue(
	config: AgentConfigFormValue,
	field: AgentConfigReferenceListFieldName,
	value: string,
): boolean {
	const normalizedValue = getAgentConfigListLookupValue(field, value);
	return getNonEmptyConfigItems(config[field]).some(
		(item) => getAgentConfigListLookupValue(field, item) === normalizedValue,
	);
}

export function mapConfigValuesToMentionItems(
	category: RichTextReferenceCategory,
	values: readonly string[] | undefined,
): RichTextMentionItem[] {
	return getNonEmptyConfigItems(values).map((value) =>
		getDirectoryMentionItemOrFallback(category, value)
	);
}

export function mapSubagentConfigValuesToMentionItems(
	values: readonly string[] | undefined,
): RichTextMentionItem[] {
	return getNonEmptyConfigItems(values).map((value) => ({
		category: "subagent",
		id: toMentionId("subagent", value),
		label: value,
	}));
}


export function mergeMentionItems(
	...groups: ReadonlyArray<readonly RichTextMentionItem[] | undefined>
): RichTextMentionItem[] {
	const seen = new Set<string>();
	const items: RichTextMentionItem[] = [];

	for (const group of groups) {
		for (const item of group ?? []) {
			const key = `${item.category}:${item.id}:${getNormalizedAgentReferenceValue(item.label)}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			items.push(item);
		}
	}

	return items;
}
