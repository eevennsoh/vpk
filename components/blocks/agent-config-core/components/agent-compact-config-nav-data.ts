import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import AppsIcon from "@atlaskit/icon/core/apps";
import AutomationIcon from "@atlaskit/icon/core/automation";
import AiComputeIcon from "@atlaskit/icon-lab/core/ai-compute";
import AiModelIcon from "@atlaskit/icon-lab/core/ai-model";
import SkillIcon from "@atlaskit/icon-lab/core/skill";

import { DEFAULT_STARTER_ICON, type StarterIconKey } from "@/components/blocks/conversation-starter";
import {
	getAgentAutomationItems,
	getNonEmptyConfigItems,
	type AgentConfigFormValue,
	type AgentConfigListFieldName,
	type AgentConfigReferenceListFieldName,
	type AgentDirectoryKind,
	type AgentHideableConfigField,
} from "@/components/blocks/agent-config-core/lib/agent-config-model";

const AGENT_COMPACT_EMPTY_CONFIG_NAV_ITEMS = [
	{ agentFieldName: "trigger", label: "Automations", Icon: AutomationIcon },
	{ agentFieldName: "apps", label: "Apps", listFieldName: "apps", Icon: AppsIcon },
	{ agentFieldName: "skills", label: "Skills", listFieldName: "skills", Icon: SkillIcon },
	{ agentFieldName: "subagents", label: "Subagents", listFieldName: "subagents", Icon: AiAgentIcon },
	{ agentFieldName: "conversationStarters", label: "Conversation starters", listFieldName: "conversationStarters", Icon: AiChatIcon },
	{ agentFieldName: "memory", label: "Memory", kind: "memory", Icon: AiModelIcon },
	{ agentFieldName: "reasoning", label: "Reasoning", kind: "reasoning", Icon: AiComputeIcon },
] as const;

const AGENT_EMPTY_ROW_ADD_LABELS: Record<AgentConfigListFieldName, string> = {
	conversationStarters: "Add prompts to help people start",
	knowledge: "Add knowledge to ground this agent",
	apps: "Add apps to connect tools and knowledge",
	skills: "Add skills to guide specialized tasks",
	subagents: "Add subagents to handle specific scenarios",
	tools: "Add tools to extend what this agent can do",
	triggers: "Add automations for when this agent runs",
};

export type AgentConfigToolbarFieldName = (typeof AGENT_COMPACT_EMPTY_CONFIG_NAV_ITEMS)[number]["agentFieldName"];
export type AgentInlineSearchField = Extract<AgentConfigReferenceListFieldName, "apps" | "knowledge" | "skills" | "tools">;
export type AgentCompactConfigNavItem = ReturnType<typeof getAgentCompactEmptyConfigNavItems>[number];

function isAgentHideableConfigField(fieldName: AgentConfigToolbarFieldName): fieldName is AgentHideableConfigField {
	return fieldName === "trigger" || fieldName === "subagents" || fieldName === "conversationStarters";
}

export function isAgentConfigToolbarFieldVisible(
	fieldName: AgentConfigToolbarFieldName,
	hiddenConfigFields?: ReadonlySet<AgentHideableConfigField>,
	visibleFieldNames?: ReadonlySet<AgentConfigToolbarFieldName>,
): boolean {
	if (visibleFieldNames && !visibleFieldNames.has(fieldName)) {
		return false;
	}

	return isAgentHideableConfigField(fieldName) ? !hiddenConfigFields?.has(fieldName) : true;
}

export function getAgentFilledSummaryAddLabel(
	field: AgentConfigListFieldName,
	isEmpty: boolean,
	showAddButtons: boolean,
): string | undefined {
	if (!showAddButtons) {
		return undefined;
	}

	return isEmpty ? AGENT_EMPTY_ROW_ADD_LABELS[field] : "Edit";
}

export function openAgentDirectoryOrAppendListItem(
	directory: AgentDirectoryKind,
	field: AgentConfigListFieldName,
	onOpenDirectory?: (directory: AgentDirectoryKind, selectedItem?: string) => void,
	onAppendListItem?: (field: AgentConfigListFieldName) => void,
): void {
	if (onOpenDirectory) {
		onOpenDirectory(directory);
		return;
	}

	onAppendListItem?.(field);
}

export function getAgentCompactEmptyConfigNavItems(config?: AgentConfigFormValue) {
	return AGENT_COMPACT_EMPTY_CONFIG_NAV_ITEMS.map((item) => {
		let count = 0;
		if (config) {
			switch (item.agentFieldName) {
				case "trigger":
					count = getAgentAutomationItems(config).length;
					break;
				case "skills":
					count = getNonEmptyConfigItems(config.skills).length;
					break;
				case "apps":
					count = getNonEmptyConfigItems(config.apps).length;
					break;
				case "subagents":
					count = getNonEmptyConfigItems(config.subagents).length;
					break;
				case "conversationStarters":
					count = getNonEmptyConfigItems(config.conversationStarters).length;
					break;
				case "memory":
				case "reasoning":
					break;
			}
		}
		return { ...item, count };
	});
}

export function getConversationStarterSummaryItems(config: AgentConfigFormValue): ReadonlyArray<{
	icon: StarterIconKey;
	label: string;
}> {
	const icons = config.conversationStarterIcons ?? [];

	return (config.conversationStarters ?? [])
		.map((item, index) => ({
			icon: (icons[index] as StarterIconKey | undefined) ?? DEFAULT_STARTER_ICON,
			label: item.trim(),
		}))
		.filter((item) => item.label.length > 0);
}
