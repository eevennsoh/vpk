"use client";

import type { ReactElement } from "react";

import InformationCircleIcon from "@atlaskit/icon/core/information-circle";

import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const AGENT_SESSION_VIEWER_HINT =
	"Someone is using an agent. Only they can see the work.";

/**
 * Trailing control for a session the viewer does not own.
 *
 * Replaces the owner more-menu. The information icon is decorative; the button
 * name and row tooltip carry the same copy so hover and keyboard both get it.
 */
export function AgentSessionViewerHint() {
	return (
		<TooltipTrigger
			render={
				<Button
					aria-label={AGENT_SESSION_VIEWER_HINT}
					className="[&_svg:not([class*='size-'])]:size-4! [&_svg]:text-icon-subtlest"
					onClick={(event) => event.stopPropagation()}
					onPointerDown={(event) => event.stopPropagation()}
					size="icon-compact"
					type="button"
					variant="ghost"
				/>
			}
		>
			<IconTile
				aria-hidden
				as="span"
				className="text-icon-subtlest"
				icon={<InformationCircleIcon color="currentColor" label="" size="medium" />}
				iconSize="medium"
				label=""
				size="small"
				variant="transparent"
			/>
		</TooltipTrigger>
	);
}

/** Attach the privacy explanation to the whole viewer row. */
export function AgentSessionViewerTooltip({ children }: Readonly<{ children: ReactElement }>) {
	return (
		<Tooltip>
			<TooltipTrigger render={children} />
			<TooltipContent className="w-60 whitespace-normal" positionerClassName="z-[600]">
				{AGENT_SESSION_VIEWER_HINT}
			</TooltipContent>
		</Tooltip>
	);
}
