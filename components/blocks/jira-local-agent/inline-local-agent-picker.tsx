"use client";

import ScreenIcon from "@atlaskit/icon/core/screen";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import { useEffect, useRef, useState } from "react";
import { InlineAgentSelector, type AgentSelectorAgent, type InlineAgentAction } from "@/components/blocks/agent-selector";
import { BUTTER_BOARD_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { ProjectButterLocalAgentMenu } from "@/components/blocks/jira-issue/project-butter-local-agent-menu";
import { CopyFeedbackIcon } from "@/components/ui-custom/copy-feedback-icon";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const LOCAL_AGENT_IDS = ["claude-code", "test-agent", "review-agent", "release-agent", "rovo-cli"];

export function InlineLocalAgentPicker({ recentAgentId, onLocalUse, presentation = "inline" }: Readonly<{
	recentAgentId: string | null;
	onLocalUse: (agentId: string) => void;
	presentation?: "inline" | "submenu";
}>) {
	const [displayedRecentAgentId] = useState(recentAgentId);
	const [commandCopied, setCommandCopied] = useState(false);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => () => { if (copiedTimer.current !== null) clearTimeout(copiedTimer.current); }, []);
	const getActions = (agent: AgentSelectorAgent): InlineAgentAction[] => agent.id === "release-agent" || (agent.id === "rovo-cli" && presentation === "inline") ? [] : [{
		id: "local",
		label: `Open in ${agent.name}`,
		icon: <Icon render={<ScreenIcon label="" size="small" />} />,
		onSelect: () => {
			onLocalUse(agent.id);
			if (agent.id !== "rovo-cli") return;
			setCommandCopied(true);
			if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
			copiedTimer.current = setTimeout(() => setCommandCopied(false), 1800);
		},
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
		renderAgentFeedback={(agent, avatar) => agent.id === "rovo-cli" && presentation === "submenu" ? <>
			<CopyFeedbackIcon className="size-6 [&_svg]:size-4!" copied={commandCopied} idleIcon={avatar} />
			<span className="menu-row-title grid min-w-0 flex-1 text-left">
				<span aria-hidden={commandCopied} className={cn("col-start-1 row-start-1 truncate transition-opacity duration-normal ease-out-practical", commandCopied ? "opacity-0" : "opacity-100")}>{agent.name}</span>
				<span aria-hidden={!commandCopied} className={cn("col-start-1 row-start-1 truncate transition-opacity duration-normal ease-out-practical", commandCopied ? "opacity-100" : "opacity-0")}>Command copied</span>
			</span>
		</> : null}
		renderAgentAction={presentation === "submenu" ? (agent) => agent.id === "rovo-cli" ? <Popover>
			<PopoverTrigger render={<Button aria-label="Configure Rovo CLI" className="size-6 shrink-0" size="icon" type="button" variant="ghost" />}><Icon aria-hidden render={<CustomizeIcon label="" size="small" />} /></PopoverTrigger>
			<PopoverContent aria-label="Rovo CLI local options" role="dialog" side="right" align="start" alignOffset={-6} sideOffset={6} initialFocus={false} className="w-70 max-w-[calc(100vw-24px)] gap-0 p-1">
				<ProjectButterLocalAgentMenu directoryOnly />
			</PopoverContent>
		</Popover> : null : undefined}
		showFavorites={false}
		showSearch={false}
		status={commandCopied ? "Command copied" : undefined}
		softwareAgentIds={LOCAL_AGENT_IDS}
		softwareHeading="Open in"
	/>;
}
