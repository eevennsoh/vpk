"use client";

import ScreenIcon from "@atlaskit/icon/core/screen";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import { useState } from "react";
import { InlineAgentSelector, type AgentSelectorAgent, type InlineAgentAction } from "@/components/blocks/agent-selector";
import { BUTTER_BOARD_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { ProjectButterLocalAgentMenu } from "@/components/blocks/jira-issue/project-butter-local-agent-menu";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const LOCAL_AGENT_IDS = ["claude-code", "test-agent", "review-agent", "release-agent", "rovo-cli"];

export function InlineLocalAgentPicker({ recentAgentId, onLocalUse, presentation = "inline" }: Readonly<{
	recentAgentId: string | null;
	onLocalUse: (agentId: string) => void;
	presentation?: "inline" | "submenu";
}>) {
	const [displayedRecentAgentId] = useState(recentAgentId);
	const getActions = (agent: AgentSelectorAgent): InlineAgentAction[] => agent.id === "release-agent" || (agent.id === "rovo-cli" && presentation === "inline") ? [] : [{
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
		recentAgentId={presentation === "submenu" ? recentAgentId : displayedRecentAgentId}
		renderAdditionalActions={presentation === "inline" ? (agent) => agent.id === "rovo-cli" ? <ProjectButterLocalAgentMenu inline onUse={() => onLocalUse(agent.id)} /> : null : undefined}
		renderAgentAction={presentation === "submenu" ? (agent) => agent.id === "rovo-cli" ? <Popover>
			<PopoverTrigger render={<Button aria-label="Configure Rovo CLI" className="size-6 shrink-0" size="icon" type="button" variant="ghost" />}><Icon aria-hidden render={<CustomizeIcon label="" size="small" />} /></PopoverTrigger>
			<PopoverContent aria-label="Rovo CLI local options" role="dialog" side="right" align="start" alignOffset={-6} sideOffset={6} initialFocus={false} className="w-70 max-w-[calc(100vw-24px)] gap-0 p-1">
				<ProjectButterLocalAgentMenu directoryOnly />
			</PopoverContent>
		</Popover> : null : undefined}
		showFavorites={false}
		showSearch={false}
		softwareAgentIds={LOCAL_AGENT_IDS}
		softwareHeading="Open in"
	/>;
}
