"use client";

import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";

import type { AgentLanyardAgent } from "./data";

export interface AgentLanyardMenuActions {
	onViewProfile?: (agent: AgentLanyardAgent) => void;
	onToggleStar?: (agent: AgentLanyardAgent) => void;
	onCopyLink?: (agent: AgentLanyardAgent) => void | Promise<void>;
	onDuplicate?: (agent: AgentLanyardAgent) => void;
}

interface AgentLanyardMenuProps {
	agent: AgentLanyardAgent;
	actions?: AgentLanyardMenuActions;
	starred?: boolean;
	onMoreActions?: (agent: AgentLanyardAgent) => void;
}

export function AgentLanyardMenu({ agent, actions, starred = false, onMoreActions }: Readonly<AgentLanyardMenuProps>) {
	const hasActions = actions
		? Boolean(actions.onViewProfile || actions.onToggleStar || actions.onCopyLink || actions.onDuplicate)
		: Boolean(onMoreActions);
	const trigger = (
		<Button variant="outline" size="icon-compact" aria-label={`More actions for ${agent.name}`} disabled={!hasActions} onClick={!actions && onMoreActions ? () => onMoreActions(agent) : undefined}>
			<Icon render={<ShowMoreHorizontalIcon label="" size="small" />} />
		</Button>
	);

	if (!actions) return trigger;

	const { onViewProfile, onToggleStar, onCopyLink, onDuplicate } = actions;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger disabled={!hasActions} render={trigger} />
			<DropdownMenuContent align="start" className="w-48 min-w-48" aria-label={`Actions for ${agent.name}`}>
				<DropdownMenuItem disabled={!onViewProfile} onSelect={onViewProfile ? () => onViewProfile(agent) : undefined}>
					View profile
				</DropdownMenuItem>
				<DropdownMenuItem disabled={!onToggleStar} onSelect={onToggleStar ? () => onToggleStar(agent) : undefined}>
					{starred ? "Unstar" : "Star"}
				</DropdownMenuItem>
				<DropdownMenuItem disabled={!onCopyLink} onSelect={onCopyLink ? () => { void onCopyLink(agent); } : undefined}>
					Copy link
				</DropdownMenuItem>
				<DropdownMenuItem disabled={!onDuplicate} onSelect={onDuplicate ? () => onDuplicate(agent) : undefined}>
					Duplicate
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
