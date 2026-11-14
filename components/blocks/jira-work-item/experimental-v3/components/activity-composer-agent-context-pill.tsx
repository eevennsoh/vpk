"use client";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import { useState } from "react";

import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { WorkItemAgentSelector } from "@/components/blocks/jira-work-item/components/work-item-agent-selector";
import { DEFAULT_PINNED_SPACE_AGENT_IDS } from "@/components/blocks/jira-work-item/experimental-v3/lib/work-item-picker-options";
import { WORK_ITEM_AGENT_SELECTOR_MENU } from "@/components/blocks/jira-work-item/experimental-v3/lib/work-item-agent-selector-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { ContextBarPill } from "@/components/ui-custom/context-bar";

interface ActivityComposerAgentContextPillProps {
	onInvokeAgent: (agent: Pick<AgentSelectorAgent, "id" | "name" | "avatarSrc" | "brandName">) => void;
}

/** Opens the shared agent selector and immediately invokes the chosen agent. */
export function ActivityComposerAgentContextPill({
	onInvokeAgent,
}: Readonly<ActivityComposerAgentContextPillProps>) {
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
		onInvokeAgent(agent);
		setIsOpen(false);
		setQuery("");
	};

	const handleFooterAction = () => {
		setIsOpen(false);
		setQuery("");
	};

	return (
		<DropdownMenu onOpenChange={handleOpenChange} open={isOpen}>
			<DropdownMenuTrigger
				render={
					<ContextBarPill
						className="motion-reduce:transition-none"
						icon={<Icon aria-hidden render={<AiAgentIcon label="" size="small" />} />}
					/>
				}
			>
				Assign agents
			</DropdownMenuTrigger>
			<DropdownMenuContent {...WORK_ITEM_AGENT_SELECTOR_MENU}>
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
