"use client";

import type { ReactElement } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const AGENT_SESSION_EXPIRED_HINT =
	"Agent sessions are only kept for 28 days. This session can't be resumed.";

/** Explain expiry across the whole row, leaving its Delete menu independent. */
export function AgentSessionExpiredHint({
	children,
	disabled = false,
}: Readonly<{ children: ReactElement; disabled?: boolean }>) {
	return (
		<Tooltip disabled={disabled}>
			<TooltipTrigger render={children} />
			<TooltipContent className="w-60 whitespace-normal" positionerClassName="z-[600]" side="right">
				{AGENT_SESSION_EXPIRED_HINT}
			</TooltipContent>
		</Tooltip>
	);
}
