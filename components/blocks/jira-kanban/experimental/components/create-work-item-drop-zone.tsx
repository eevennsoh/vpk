"use client";

import AddIcon from "@atlaskit/icon/core/add";
import { useRef } from "react";

import {
	JiraDropzone,
	type JiraDropzoneDragState,
} from "@/components/blocks/jira-dropzone";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import { resolveBoardCreateDropzoneDrag } from "../lib/board-agent-session-drag";
import { useCreateDropzoneHeight } from "../hooks/use-create-dropzone-height";
import type { BoardAgentSessionDrag } from "../use-board-agent-session-drag";
import { useExclusiveCreateWellProximity } from "./create-work-item-exclusive-proximity-context";

/** Dashed well chrome shared by the create button and the session-drag dropzone. */
const CREATE_WORK_ITEM_WELL_CHROME_CLASS = "rounded-lg border border-dashed";

export function BoardColumnCreateAction({
	ants = true,
	dropZoneLabel,
	placement = "bottom",
	reveal,
	sessionDragTransaction,
	title,
}: Readonly<{
	ants?: boolean;
	dropZoneLabel?: string;
	placement?: "top" | "bottom";
	reveal?: "always" | "column-hover";
	sessionDragTransaction: BoardAgentSessionDrag["transaction"];
	title: string;
}>) {
	const targetRef = useRef<HTMLDivElement>(null);
	const isExclusiveWinner = useExclusiveCreateWellProximity(title, targetRef);
	const drag: JiraDropzoneDragState = resolveBoardCreateDropzoneDrag(
		sessionDragTransaction,
		title,
	);
	const { anchorRef, minimumHeight } = useCreateDropzoneHeight(Boolean(dropZoneLabel) && drag !== "idle", placement);

	return (
		// Reserve only the resting button footprint. The expanded well overlays
		// the card list so arrival scrolling always measures the same viewport.
		<div className="relative h-8 w-full">
			<div ref={anchorRef} className={cn("absolute inset-x-0 z-10", placement === "top" ? "top-1" : "bottom-1")}>
				{dropZoneLabel ? (
					<JiraDropzone
						ants={ants}
						drag={drag}
						exclusiveWinner={isExclusiveWinner}
						label={dropZoneLabel}
						measuredRef={targetRef}
						openMinHeight={minimumHeight}
						renderResting={() => <BoardColumnAddButton reveal={reveal} title={title} />}
						title={title}
					/>
				) : (
					<BoardColumnAddButton reveal={reveal} title={title} />
				)}
			</div>
		</div>
	);
}

export function BoardColumnAddButton({
	reveal = "column-hover",
	title,
}: Readonly<{
	reveal?: "always" | "column-hover";
	title: string;
}>) {
	return (
		<Button
			aria-label={`Create in ${title}`}
			className={cn(
				"w-full",
				CREATE_WORK_ITEM_WELL_CHROME_CLASS,
				"[&_[data-slot=icon]]:text-icon-subtlest [&_svg]:text-icon-subtlest",
				"hover:border-solid hover:[&_[data-slot=icon]]:text-icon-subtle hover:[&_svg]:text-icon-subtle",
				"focus-visible:border-solid focus-visible:[&_[data-slot=icon]]:text-icon-subtle focus-visible:[&_[data-slot=icon]]:text-icon-subtle",
				reveal === "column-hover"
					? cn(
						"pointer-events-none opacity-0 transition-opacity duration-normal ease-out-practical",
						"group-hover/board-column:pointer-events-auto group-hover/board-column:opacity-100",
						"group-has-[:focus-visible]/board-column:pointer-events-auto group-has-[:focus-visible]/board-column:opacity-100",
						"motion-reduce:transition-none",
					)
					: null,
			)}
			size="compact"
			variant="outline"
		>
			<Icon render={<AddIcon label="" size="small" />} />
		</Button>
	);
}
