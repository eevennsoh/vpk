"use client";

import ScreenIcon from "@atlaskit/icon/core/screen";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import { useState } from "react";
import { InlineAgentSelector, type AgentSelectorAgent, type InlineAgentAction } from "@/components/blocks/agent-selector";
import { BUTTER_BOARD_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { ProjectButterLocalAgentMenu } from "@/components/blocks/jira-issue/project-butter-local-agent-menu";
import { useRovoCliCommandCopy } from "@/components/blocks/jira-issue/rovo-cli-command";
import { CopyFeedbackIcon } from "@/components/ui-custom/copy-feedback-icon";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { Icon } from "@/components/ui/icon";
import { BrandLogoMark } from "@/components/ui/logo-mark";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LOCAL_AGENT_IDS = ["claude-code", "test-agent", "review-agent", "release-agent", "rovo-cli", "vscode"];
export const LOCAL_APPS: readonly AgentSelectorAgent[] = [
	...BUTTER_BOARD_AGENTS.filter((agent) => LOCAL_AGENT_IDS.includes(agent.id)),
	{ id: "vscode", name: "VS Code", byline: "", brandName: "vs-code" },
];

export function LocalAppTile({ agentId, size = "small" }: Readonly<{ agentId: string; size?: "small" | "xxsmall" }>) {
	const agent = LOCAL_APPS.find((candidate) => candidate.id === agentId);
	return agentId === "vscode" ? <BrandLogoMark label="" name="vs-code" size={size} /> : agent ? <AgentAvatarVisual animate={false} appearance={agent.brandName === "openai-codex" || agent.brandName === "cursor" || agent.brandName === "github-copilot" ? "coding" : undefined} avatarSrc={agentId === "rovo-cli" ? undefined : agent.avatarSrc} brandName={agent.brandName} vpkLogo={agentId === "rovo-cli" ? "rovo" : undefined} label="" shape="square" sizePx={size === "small" ? 24 : 16} /> : null;
}

export function InlineLocalAgentPicker({ recentAgentId, onLocalUse, presentation = "inline" }: Readonly<{
	recentAgentId: string | null;
	onLocalUse: (agentId: string) => void;
	presentation?: "inline" | "submenu";
}>) {
	const [displayedRecentAgentId] = useState(recentAgentId);
	const { copied: commandCopied, copy: copyCommand } = useRovoCliCommandCopy();
	const getActions = (agent: AgentSelectorAgent): InlineAgentAction[] => agent.id === "release-agent" || (agent.id === "rovo-cli" && presentation === "inline") ? [] : [{
		id: "local",
		label: `Open in ${agent.name}`,
		icon: <Icon render={<ScreenIcon label="" size="small" />} />,
		onSelect: () => {
			onLocalUse(agent.id);
			if (agent.id === "rovo-cli") void copyCommand();
		},
	}];
	return <InlineAgentSelector
		agents={LOCAL_APPS}
		className="pb-0"
		compact
		disabledLabel="Not installed"
		getActions={getActions}
		initialSoftwareLimit={LOCAL_AGENT_IDS.length}
		recentAgentId={presentation === "submenu" ? recentAgentId : displayedRecentAgentId}
		renderAdditionalActions={presentation === "inline" ? (agent) => agent.id === "rovo-cli" ? <ProjectButterLocalAgentMenu inline onUse={() => onLocalUse(agent.id)} /> : null : undefined}
		renderAgentFeedback={(agent) => <>
			<span aria-hidden className="grid size-6 shrink-0 place-items-center">{agent.id === "rovo-cli" && presentation === "submenu" ? <CopyFeedbackIcon className="size-6 [&_svg]:size-4!" copied={commandCopied} idleIcon={<LocalAppTile agentId={agent.id} />} /> : <LocalAppTile agentId={agent.id} />}</span>
			<span className="menu-row-title grid min-w-0 flex-1 text-left">
				<span aria-hidden={agent.id === "rovo-cli" && commandCopied} className={cn("col-start-1 row-start-1 truncate", agent.id === "rovo-cli" && presentation === "submenu" && "transition-opacity duration-normal ease-out-practical", agent.id === "rovo-cli" && commandCopied ? "opacity-0" : "opacity-100")}>{agent.name}</span>
				{agent.id === "rovo-cli" && presentation === "submenu" ? <span aria-hidden={!commandCopied} className={cn("col-start-1 row-start-1 truncate transition-opacity duration-normal ease-out-practical", commandCopied ? "opacity-100" : "opacity-0")}>Command copied</span> : null}
			</span>
		</>}
		renderAgentAction={presentation === "submenu" ? (agent) => agent.id === "rovo-cli" ? <Popover>
			<PopoverTrigger render={<Button aria-label="Configure Rovo CLI" className="size-6 shrink-0" size="icon" type="button" variant="ghost" />}><Icon aria-hidden render={<CustomizeIcon label="" size="small" />} /></PopoverTrigger>
			<PopoverContent aria-label="Rovo CLI local options" role="dialog" side="right" align="start" alignOffset={-6} sideOffset={6} initialFocus={false} className={cn("w-70 max-w-[calc(100vw-24px)] gap-0", dropdownStyles.surface, dropdownStyles.padding)}>
				<ProjectButterLocalAgentMenu directoryOnly />
			</PopoverContent>
		</Popover> : null : undefined}
		showFavorites={false}
		showHeadings={false}
		showSearch={false}
		status={commandCopied ? "Command copied" : undefined}
		softwareAgentIds={LOCAL_AGENT_IDS}
		softwareHeading="Open in"
	/>;
}
