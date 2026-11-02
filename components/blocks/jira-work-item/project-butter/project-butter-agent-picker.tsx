"use client";

import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { AgentSelector, type AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { DEFAULT_PINNED_SPACE_AGENT_IDS, WORK_ITEM_PINNED_ITEMS_LABEL } from "@/components/blocks/jira-work-item/team-eu26/lib/work-item-picker-options";

const CODING_AGENTS: readonly AgentSelectorAgent[] = [
	{ id: "claude-cli", name: "Claude CLI", byline: "by Anthropic", brandName: "claude" },
	{ id: "codex", name: "Codex", byline: "by OpenAI", brandName: "openai-codex" },
	{ id: "cursor", name: "Cursor", byline: "by Cursor", brandName: "cursor" },
];

export function ProjectButterAgentPicker({ onSelect, sessions }: Readonly<{
	onSelect: (agent: AgentSessionItem["agent"]) => void;
	sessions: readonly AgentSessionItem[];
}>) {
	const agents = [...CODING_AGENTS, ...ROVO_AGENT_SELECTOR_AGENTS];
	for (const { agent } of sessions) {
		const id = agent.id ?? agent.name;
		if (!agents.some((candidate) => candidate.id === id)) agents.push({ ...agent, id, byline: "On this work item" });
	}
	return <AgentSelector agents={agents} defaultPinnedAgentIds={DEFAULT_PINNED_SPACE_AGENT_IDS} listLabel="Agents to add" onAgentToggle={(id) => {
		const agent = agents.find((candidate) => candidate.id === id);
		if (agent) onSelect({ id: agent.id, kind: "agent", name: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo });
	}} pinnedItemsLabel={WORK_ITEM_PINNED_ITEMS_LABEL} pinningEnabled={false} searchVariant="palette" selectionMode="single" />;
}
