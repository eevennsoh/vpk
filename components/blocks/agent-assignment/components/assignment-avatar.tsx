"use client";

import { useState } from "react";

import type {
	AgentAssignmentAgent,
	AgentAssignmentStatusKind,
} from "@/components/blocks/agent-assignment/components/agent-assignment";
import type { AvatarStatus } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";

function getAssignmentAvatarStatus(kind: AgentAssignmentStatusKind): AvatarStatus | undefined {
	switch (kind) {
		case "needs-input":
			return "needs-input";
		case "finished":
			return "finished";
		case "working":
		case "idle":
			return undefined;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

function getAssignmentAvatarTooltipLabel(
	kind: AgentAssignmentStatusKind,
	statusLabel: string,
): string {
	switch (kind) {
		case "needs-input":
			return "Needs input";
		case "finished":
			return "Finished";
		case "working":
		case "idle":
			return statusLabel;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

const ATTENTION_TOOLTIP_COLLISION = {
	align: "none",
	fallbackAxisSide: "none",
	side: "none",
} as const;

const ATTENTION_TOOLTIP_SIDE_OFFSET_PX = 6;

export function AssignmentAvatar({
	agent,
	attentionAcknowledged = false,
	menuOpen = false,
	onOpen,
	positionerClassName,
	stackZIndex = 10,
	statusKind,
}: Readonly<{
	agent: AgentAssignmentAgent;
	attentionAcknowledged?: boolean;
	menuOpen?: boolean;
	onOpen: () => void;
	positionerClassName?: string;
	stackZIndex?: number;
	statusKind: AgentAssignmentStatusKind;
}>) {
	const avatarStatus = attentionAcknowledged ? undefined : getAssignmentAvatarStatus(statusKind);
	const tooltipLabel = getAssignmentAvatarTooltipLabel(statusKind, agent.statusLabel);
	const [hoverOpen, setHoverOpen] = useState(false);
	const tooltipOpen = !menuOpen && hoverOpen;

	const handleTooltipOpenChange = (nextOpen: boolean) => {
		if (menuOpen && nextOpen) {
			return;
		}
		setHoverOpen(nextOpen);
	};

	return (
		<TooltipProvider delay={0}>
			<Tooltip
				onOpenChange={handleTooltipOpenChange}
				open={tooltipOpen}
			>
				<TooltipTrigger
					render={
						<span
							className="pointer-events-auto relative inline-flex size-6 shrink-0 overflow-visible"
							onClick={onOpen}
							style={{ zIndex: stackZIndex }}
							tabIndex={-1}
						/>
					}
				>
					<AgentAvatarVisual
						avatarClassName="shrink-0 overflow-visible"
						avatarSrc={agent.avatarSrc}
						brandName={agent.brandName}
						vpkLogo={agent.vpkLogo}
						fallbackText={agent.name.slice(0, 2).toUpperCase()}
						label={`${agent.name}. ${tooltipLabel}`}
						logoName={agent.logoName}
						sizePx={24}
						status={avatarStatus}
					/>
				</TooltipTrigger>
				<TooltipContent
					align="center"
					collisionAvoidance={ATTENTION_TOOLTIP_COLLISION}
					positionerClassName={positionerClassName}
					side="top"
					sideOffset={ATTENTION_TOOLTIP_SIDE_OFFSET_PX}
				>
					{tooltipLabel}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
