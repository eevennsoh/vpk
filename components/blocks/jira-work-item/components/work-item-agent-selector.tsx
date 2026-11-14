"use client";

import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import { AgentSelector, type AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { WORK_ITEM_PINNED_ITEMS_LABEL } from "@/components/blocks/jira-work-item/lib/work-item-picker-options";

interface WorkItemAgentSelectorProps {
	agents?: readonly AgentSelectorAgent[];
	onAgentToggle: (agentId: string) => void;
	onBrowseAgents: () => void;
	onCreateAgent: () => void;
	onPinnedAgentIdsChange: (agentIds: readonly string[]) => void;
	onQueryChange: (query: string) => void;
	pinnedAgentIds: readonly string[];
	query: string;
	selectedAgentIds?: readonly string[];
}

/** Palette AgentSelector used by the Activity composer pill and Details Agents. */
export function WorkItemAgentSelector({
	agents = ROVO_AGENT_SELECTOR_AGENTS,
	onAgentToggle,
	onBrowseAgents,
	onCreateAgent,
	onPinnedAgentIdsChange,
	onQueryChange,
	pinnedAgentIds,
	query,
	selectedAgentIds,
}: Readonly<WorkItemAgentSelectorProps>) {
	return (
		<AgentSelector
			agents={agents}
			onAgentToggle={onAgentToggle}
			onBrowseAgents={onBrowseAgents}
			onCreateAgent={onCreateAgent}
			onPinnedAgentIdsChange={onPinnedAgentIdsChange}
			onQueryChange={onQueryChange}
			pinnedAgentIds={pinnedAgentIds}
			pinnedItemsLabel={WORK_ITEM_PINNED_ITEMS_LABEL}
			query={query}
			searchVariant="palette"
			selectionMode="single"
			selectedAgentIds={selectedAgentIds}
		/>
	);
}
