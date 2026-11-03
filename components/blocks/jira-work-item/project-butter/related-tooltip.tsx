"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Hover/focus label for an icon-only related-work control (wraps triggers that own their own popup). */
export function RelatedTooltip({ children, label, side = "top" }: Readonly<{ children: ReactNode; label: string; side?: "top" | "bottom" }>) {
	return (
		<Tooltip>
			<TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger>
			<TooltipContent positionerClassName="z-[650]" side={side}>{label}</TooltipContent>
		</Tooltip>
	);
}
