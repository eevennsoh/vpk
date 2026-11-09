import type {
	AgentConfigFormValue,
	AgentConfigListFieldName,
} from "@/components/blocks/agent";
import {
	DEFAULT_SUBAGENT_BASE_AGENT,
	SUBAGENT_DEMO_PROMPTS,
	type SubagentPrompt,
	type SubagentBaseAgent,
} from "@/components/blocks/subagent/data/demo-agents";

// Pure, behavior-preserving helpers shared by the standalone subagents demo
// (components/blocks/subagent/page.tsx) and the studio agent config panel.
// Keeping them here is the single source of truth for both consumers.

// A subagent prompt's stable identity is its id. Its trigger name is the
// user-visible label and the serialized base-agent subagents chip value.
// When unset, every surface that shows a subagent (profile header, breadcrumb,
// floating navigator, manage dialog) must fall back to the same label so they
// never drift out of sync.
export const UNTITLED_SUBAGENT_NAME = "Untitled subagent";

export function getSubagentDisplayName(prompt: SubagentPrompt): string {
	return prompt.triggerName.trim() || UNTITLED_SUBAGENT_NAME;
}

export function cloneConfig(config: AgentConfigFormValue): AgentConfigFormValue {
	return {
		...config,
		triggers: config.triggers ? [...config.triggers] : undefined,
		automationRules: config.automationRules ? [...config.automationRules] : undefined,
		skills: config.skills ? [...config.skills] : undefined,
		tools: config.tools ? [...config.tools] : undefined,
		subagents: config.subagents ? [...config.subagents] : undefined,
		knowledge: config.knowledge ? [...config.knowledge] : undefined,
		conversationStarters: config.conversationStarters ? [...config.conversationStarters] : undefined,
		conversationStarterIcons: config.conversationStarterIcons ? [...config.conversationStarterIcons] : undefined,
	};
}

export function cloneBaseAgent(agent: SubagentBaseAgent): SubagentBaseAgent {
	return {
		...agent,
		config: cloneConfig(agent.config),
	};
}

export function cloneSubagentPrompt(prompt: SubagentPrompt): SubagentPrompt {
	return {
		...prompt,
		config: cloneConfig(prompt.config),
	};
}

export function normalizeBaseAgent(agent: SubagentBaseAgent | undefined): SubagentBaseAgent {
	return cloneBaseAgent(agent ?? DEFAULT_SUBAGENT_BASE_AGENT);
}

export function normalizeSubagentPrompts(prompts: ReadonlyArray<SubagentPrompt> | undefined): SubagentPrompt[] {
	return (prompts ?? SUBAGENT_DEMO_PROMPTS).map(cloneSubagentPrompt);
}

// The base agent's subagents chip list mirrors the prompt list 1:1, including
// freshly created drafts that haven't been named yet. Unnamed prompts fall back
// to the shared placeholder (same label the navigator/header use) so the summary
// row, navigator, and breadcrumb never drift out of sync. Filtering unnamed
// prompts out here would also misalign chip indexes from the owning prompts,
// breaking remove/select-by-index from the summary row.
export function getDerivedSubagentNames(prompts: ReadonlyArray<SubagentPrompt>): string[] {
	return prompts.map((prompt) => prompt.triggerName.trim() || UNTITLED_SUBAGENT_NAME);
}

export function getBaseConfigWithSubagents(
	baseConfig: AgentConfigFormValue,
	prompts: ReadonlyArray<SubagentPrompt>,
): AgentConfigFormValue {
	return {
		...baseConfig,
		subagents: getDerivedSubagentNames(prompts),
	};
}

export function getListItems(config: AgentConfigFormValue, field: AgentConfigListFieldName): string[] {
	const items = config[field];
	return Array.isArray(items) ? [...items] : [];
}

export function updateConfigListItem(
	config: AgentConfigFormValue,
	field: AgentConfigListFieldName,
	index: number,
	value: string,
): AgentConfigFormValue {
	const items = getListItems(config, field);
	items[index] = value;
	return { ...config, [field]: items };
}

export function createDraftSubagentPrompt(prompts: ReadonlyArray<SubagentPrompt>): SubagentPrompt {
	const nextIndex = prompts.length + 1;
	let id = `subagent-prompt-${nextIndex}`;
	let suffix = nextIndex;
	const existingIds = new Set(prompts.map((prompt) => prompt.id));
	while (existingIds.has(id)) {
		suffix += 1;
		id = `subagent-prompt-${suffix}`;
	}

	return {
		id,
		triggerName: "",
		condition: "",
		config: {
			instructions: "",
			contextDescription: "",
			triggers: [],
			skills: [],
			tools: [],
			knowledge: [],
			conversationStarters: [],
			action: "draft",
		},
	};
}
