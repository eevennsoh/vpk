"use client";

import type { MouseEvent, ReactElement, ReactNode } from "react";

import StatusSuccessIcon from "@atlaskit/icon/core/status-success";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import { selectionGestureFromModifierKeys } from "./agent-session-selection-gesture";
import type { AgentSessionSelectionGesture } from "./agent-session-types";

export function AgentSessionSelectMark({
	identity,
	isCompact = false,
	isMarked,
	label,
	onActivate,
	previewable = false,
}: Readonly<{
	identity: ReactNode;
	isCompact?: boolean;
	isMarked: boolean;
	label: string;
	onActivate: (gesture: AgentSessionSelectionGesture) => void;
	previewable?: boolean;
}>): ReactElement {
	const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
		event.stopPropagation();
		onActivate(selectionGestureFromModifierKeys(event));
	};

	return (
		<span
			className={cn("relative grid shrink-0 place-items-center", isCompact ? "size-6" : "size-8")}
			data-marked={isMarked || undefined}
		>
			<span
				hidden={isMarked && previewable}
				className={cn(
					"col-start-1 row-start-1 transition-none",
					!previewable || isMarked ? "pointer-events-none" : null,
					isMarked
						? "invisible opacity-0"
						: previewable ? "opacity-100" : "opacity-100 group-hover/agent-row:opacity-0 group-has-[:focus-visible]/agent-row:opacity-0 group-data-[hovered]/agent-row:opacity-0",
				)}
			>
				{identity}
			</span>
			<span
				aria-hidden="true"
				className={cn(
					"relative z-10 col-start-1 row-start-1 grid place-items-center rounded-full transition-none",
					isCompact ? "size-6" : "size-8",
					isMarked
						? "pointer-events-auto text-icon-selected opacity-100"
						: previewable ? "pointer-events-none opacity-0" : cn(
							"pointer-events-none text-icon-subtle opacity-0",
							"group-hover/agent-row:pointer-events-auto group-hover/agent-row:opacity-100",
							"group-has-[:focus-visible]/agent-row:pointer-events-auto group-has-[:focus-visible]/agent-row:opacity-100",
							"group-data-[hovered]/agent-row:pointer-events-auto group-data-[hovered]/agent-row:opacity-100",
						),
				)}
				data-session-drag-ignore=""
				onClick={handleClick}
				title={label}
			>
				<Icon render={<StatusSuccessIcon label="" />} />
			</span>
		</span>
	);
}
