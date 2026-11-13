"use client";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import EditIcon from "@atlaskit/icon/core/edit";
import { useState, type ReactElement } from "react";

import { AgentSelector, type AgentSelectorAction } from "@/components/blocks/agent-selector";
import { AGENT_SELECTOR_CUSTOM_AGENT_DEMO_AGENTS, AGENT_SELECTOR_DEMO_AGENTS } from "@/components/blocks/agent-selector/data/demo-agents";
import { DEFAULT_PINNED_SPACE_AGENT_IDS, WORK_ITEM_PINNED_ITEMS_LABEL } from "@/components/blocks/jira-work-item/experimental-v3/lib/work-item-picker-options";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { RovoColorIcon } from "@/components/ui/logo";

interface AgentSelectorPageProps {
	presentation?: "dropdown" | "standalone";
	includeByline?: boolean;
	initialOpen?: boolean;
	variant?: "default" | "selected-agent-actions" | "jira";
}

const AGENT_SELECTOR_STANDALONE_SURFACE_CLASS =
	"w-[360px] overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-2xl";

export default function AgentSelectorPage({
	presentation = "dropdown",
	includeByline,
	initialOpen = true,
	variant = "default",
}: Readonly<AgentSelectorPageProps> = {}): ReactElement {
	const [open, setOpen] = useState(initialOpen);
	const [selectedAgentIds, setSelectedAgentIds] = useState<readonly string[]>(
		variant === "selected-agent-actions"
			? ["ai-insights-agent"]
			: variant === "jira"
				? [
					"github-copilot",
					"release-notes-drafter",
					"code-reviewer",
					"readiness-checker",
				]
				: ["github-copilot"]
	);
	const [pinnedAgentIds, setPinnedAgentIds] = useState<readonly string[]>(
		variant === "jira" ? DEFAULT_PINNED_SPACE_AGENT_IDS : []
	);
	const agents = variant === "selected-agent-actions" ? AGENT_SELECTOR_CUSTOM_AGENT_DEMO_AGENTS : AGENT_SELECTOR_DEMO_AGENTS;
	const selectedAgentActions: readonly AgentSelectorAction[] = variant === "selected-agent-actions"
		? [
			{
				id: "chat-with-rovo",
				icon: <RovoColorIcon aria-hidden className="mx-auto block" size="xxsmall" />,
				label: "Chat with Rovo",
				onSelect: () => setOpen(false),
			},
			{
				id: "edit-agent",
				icon: <Icon className="size-4" render={<EditIcon label="" />} />,
				label: "Edit agent",
				onSelect: () => setOpen(false),
			},
		]
		: [];

	function selectAgent(agentId: string) {
		setSelectedAgentIds([agentId]);
	}

	const selector = (
		<AgentSelector
			agents={agents}
			heading={variant === "selected-agent-actions" ? "Switch to another agent" : undefined}
			onAgentToggle={selectAgent}
			onBrowseAgents={() => undefined}
			onCreateAgent={() => undefined}
			selectionMode="single"
			searchVariant="palette"
			paletteHeadings={variant === "jira"}
			moreItemsLabel={variant === "jira" ? "More agents" : undefined}
			onPinnedAgentIdsChange={setPinnedAgentIds}
			pinnedAgentIds={pinnedAgentIds}
			pinnedItemsLabel={variant === "jira" ? WORK_ITEM_PINNED_ITEMS_LABEL : "Favorites"}
			pinningEnabled
			pinningAppearance={variant === "jira" ? "pin" : "favorite"}
			showByline={includeByline ?? variant !== "default"}
			showSelectedTickInSingleSelect={variant === "default" || variant === "selected-agent-actions"}
			selectedAgentActions={selectedAgentActions}
			selectedAgentIds={selectedAgentIds}
		/>
	);

	if (presentation === "standalone") {
		return (
			<div className={AGENT_SELECTOR_STANDALONE_SURFACE_CLASS} data-agent-selector-demo="standalone">
				{selector}
			</div>
		);
	}

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger
				render={
					<Button aria-label="Select agent" variant="outline" />
				}
			>
				Select agent
				<ChevronDownIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-none w-[360px] overflow-hidden p-0" portalled={false} sideOffset={8}>
				{selector}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { AgentSelector } from "@/components/blocks/agent-selector";
export type { AgentSelectorAction, AgentSelectorAgent, AgentSelectorProps } from "@/components/blocks/agent-selector";
