"use client";

import RovoChatIcon from "@atlaskit/icon/core/rovo-chat";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AgentLanyardMenu, type AgentLanyardMenuActions } from "../agent-lanyard-menu";
import type { AgentLanyardAgent } from "../data";

interface AgentLanyardActionsProps {
	agent: AgentLanyardAgent;
	onAction?: (agent: AgentLanyardAgent) => void;
	onMoreActions?: (agent: AgentLanyardAgent) => void;
	menuActions?: AgentLanyardMenuActions;
	starred?: boolean;
}

export function AgentLanyardActions({ agent, onAction, ...menu }: Readonly<AgentLanyardActionsProps>) {
	const isChat = agent.action === "chat";
	return (
		<div className="mt-auto flex items-center gap-1.5">
			<Button variant="outline" size={isChat ? "icon-compact" : "compact"} aria-label={`${isChat ? "Chat with" : "Connect"} ${agent.name}`} disabled={!onAction} onClick={onAction ? () => onAction(agent) : undefined}>
				{isChat ? <Icon render={<RovoChatIcon label="" size="small" />} /> : "Connect"}
			</Button>
			<AgentLanyardMenu agent={agent} actions={menu.menuActions} starred={menu.starred} onMoreActions={menu.onMoreActions} />
		</div>
	);
}
