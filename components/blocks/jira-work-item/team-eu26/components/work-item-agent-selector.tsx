"use client";

import { useState, type ReactElement } from "react";

import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import { AgentSelector, type AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { useJiraWorkItemActions } from "@/components/blocks/jira-work-item/team-eu26/context-jira-work-item";
import { WORK_ITEM_AGENT_SELECTOR_MENU } from "@/components/blocks/jira-work-item/team-eu26/lib/work-item-agent-selector-menu";
import {
	DEFAULT_PINNED_SPACE_AGENT_IDS,
	WORK_ITEM_PINNED_ITEMS_LABEL,
} from "@/components/blocks/jira-work-item/team-eu26/lib/work-item-picker-options";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WorkItemAgentSelectorProps {
	agents?: readonly AgentSelectorAgent[];
	heading?: string;
	onAgentToggle: (agentId: string) => void;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	onPinnedAgentIdsChange?: (agentIds: readonly string[]) => void;
	onQueryChange: (query: string) => void;
	pinnedAgentIds: readonly string[];
	pinningEnabled?: boolean;
	query: string;
	searchVariant?: "boxed" | "palette";
	selectedAgentIds?: readonly string[];
}

/** Palette AgentSelector used by the Activity composer pill and Details Agents. */
export function WorkItemAgentSelector({
	agents = ROVO_AGENT_SELECTOR_AGENTS,
	heading,
	onAgentToggle,
	onBrowseAgents,
	onCreateAgent,
	onPinnedAgentIdsChange,
	onQueryChange,
	pinnedAgentIds,
	pinningEnabled = true,
	query,
	searchVariant = "palette",
	selectedAgentIds,
}: Readonly<WorkItemAgentSelectorProps>) {
	return (
		<AgentSelector
			agents={agents}
			heading={heading}
			onAgentToggle={onAgentToggle}
			onBrowseAgents={onBrowseAgents}
			onCreateAgent={onCreateAgent}
			onPinnedAgentIdsChange={onPinnedAgentIdsChange}
			onQueryChange={onQueryChange}
			pinnedAgentIds={pinnedAgentIds}
			pinnedItemsLabel={WORK_ITEM_PINNED_ITEMS_LABEL}
			pinningEnabled={pinningEnabled}
			query={query}
			searchVariant={searchVariant}
			selectionMode="single"
			selectedAgentIds={selectedAgentIds}
		/>
	);
}

/**
 * Shared Select-agent dropdown for the header Open-agent button and the empty
 * Development "Start with agent" action. Owns query state; invoking an agent
 * uses the work-item session controller.
 */
export function WorkItemAgentSelectorMenu({
	align = "end",
	trigger,
}: Readonly<{
	align?: "start" | "end";
	trigger: ReactElement;
}>) {
	const actions = useJiraWorkItemActions();
	const [isOpen, setIsOpen] = useState(false);
	const [pinnedAgentIds, setPinnedAgentIds] = useState<readonly string[]>(DEFAULT_PINNED_SPACE_AGENT_IDS);
	const [query, setQuery] = useState("");

	const handleOpenChange = (nextOpen: boolean) => {
		setIsOpen(nextOpen);
		if (!nextOpen) {
			setQuery("");
		}
	};

	const handleAgentToggle = (agentId: string) => {
		const agent = ROVO_AGENT_SELECTOR_AGENTS.find((candidate) => candidate.id === agentId);
		if (!agent) {
			return;
		}
		actions.invokeAgent(agent, "context-pill", `@${agent.name}`);
		setIsOpen(false);
		setQuery("");
	};

	const handleFooterAction = () => {
		setIsOpen(false);
		setQuery("");
	};

	return (
		<DropdownMenu onOpenChange={handleOpenChange} open={isOpen}>
			<DropdownMenuTrigger render={trigger} />
			<DropdownMenuContent {...WORK_ITEM_AGENT_SELECTOR_MENU} align={align}>
				<WorkItemAgentSelector
					onAgentToggle={handleAgentToggle}
					onBrowseAgents={handleFooterAction}
					onCreateAgent={handleFooterAction}
					onPinnedAgentIdsChange={setPinnedAgentIds}
					onQueryChange={setQuery}
					pinnedAgentIds={pinnedAgentIds}
					query={query}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
