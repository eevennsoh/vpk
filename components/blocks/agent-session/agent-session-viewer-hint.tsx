"use client";

import type { ReactElement } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const AGENT_SESSION_VIEWER_HINT =
	"You can see this session, but only its owner can act on it.";

export function agentSessionPrivacyHint(person?: string) {
	return person ? `You can see this session, but only ${person} can act on it.` : AGENT_SESSION_VIEWER_HINT;
}

/** Attach the privacy explanation to the whole viewer row. */
export function AgentSessionViewerTooltip({ children, person, positionerClassName = "z-[600]" }: Readonly<{ children: ReactElement; person?: string; positionerClassName?: string }>) {
	return (
		<Tooltip>
			<TooltipTrigger render={children} />
			<TooltipContent className="w-60 whitespace-normal" collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }} positionerClassName={positionerClassName} side="right">
				{agentSessionPrivacyHint(person)}
			</TooltipContent>
		</Tooltip>
	);
}
