"use client";

import type { ReactElement } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const AGENT_SESSION_VIEWER_HINT =
	"You can see this session, but only its owner can act on it.";

/** Attach the privacy explanation to the whole viewer row. */
export function AgentSessionViewerTooltip({ children, positionerClassName = "z-[600]" }: Readonly<{ children: ReactElement; positionerClassName?: string }>) {
	return (
		<Tooltip>
			<TooltipTrigger render={children} />
			<TooltipContent className="w-60 whitespace-normal" positionerClassName={positionerClassName}>
				{AGENT_SESSION_VIEWER_HINT}
			</TooltipContent>
		</Tooltip>
	);
}
