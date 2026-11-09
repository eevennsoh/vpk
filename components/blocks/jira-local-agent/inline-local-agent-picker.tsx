"use client";

import ScreenIcon from "@atlaskit/icon/core/screen";
import { useState } from "react";
import { InlineAgentSelector, type AgentSelectorAgent, type InlineAgentAction } from "@/components/blocks/agent-selector";
import { BUTTER_BOARD_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { ProjectButterLocalAgentMenu } from "@/components/blocks/jira-issue/project-butter-local-agent-menu";
import { Icon } from "@/components/ui/icon";

const LOCAL_AGENT_IDS = ["claude-code", "test-agent", "review-agent", "release-agent", "rovo-cli"];

export function InlineLocalAgentPicker({ recentAgentId, onLocalUse }: Readonly<{
	recentAgentId: string | null;
	onLocalUse: (agentId: string) => void;
}>) {
	const [displayedRecentAgentId] = useState(recentAgentId);
	const getActions = (agent: AgentSelectorAgent): InlineAgentAction[] => agent.id === "rovo-cli" || agent.id === "release-agent" ? [] : [{
		id: "local",
		label: `Open in ${agent.name}`,
		icon: <Icon render={<ScreenIcon label="" size="small" />} />,
		onSelect: () => onLocalUse(agent.id),
	}];
	return <InlineAgentSelector
		agents={BUTTER_BOARD_AGENTS.filter((agent) => LOCAL_AGENT_IDS.includes(agent.id))}
		compact
		disabledLabel="Not installed"
		getActions={getActions}
		initialSoftwareLimit={LOCAL_AGENT_IDS.length}
		onActiveAgentChange={(agent) => { if (agent?.id === "rovo-cli") onLocalUse(agent.id); }}
		recentAgentId={displayedRecentAgentId}
		renderAdditionalActions={(agent) => agent.id === "rovo-cli" ? <ProjectButterLocalAgentMenu inline onUse={() => onLocalUse(agent.id)} /> : null}
		showFavorites={false}
		showSearch={false}
		softwareAgentIds={LOCAL_AGENT_IDS}
		softwareHeading="Open in"
	/>;
}
