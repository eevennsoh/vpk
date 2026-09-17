"use client";

import AddIcon from "@atlaskit/icon/core/add";
import { useRef, useState } from "react";
import type { AgentSessionWorkItemDraft } from "@/components/blocks/agent-session";
import { CreateWorkItemField } from "@/components/blocks/agent-session/agent-session-link-work-item-submenu";

import {
	JiraDropzone,
	type JiraDropzoneDragState,
} from "@/components/blocks/jira-dropzone";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { JIRA_DROPZONE_OPEN_HEIGHT_PX } from "@/components/blocks/jira-dropzone/lib/jira-dropzone-motion";

import { CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX } from "../lib/create-work-item-exclusive-proximity";
import { resolveBoardCreateDropzoneDrag } from "../lib/board-agent-session-drag";
import { useCreateDropzoneHeight } from "../hooks/use-create-dropzone-height";
import type { BoardAgentSessionDrag } from "../use-board-agent-session-drag";
import { useExclusiveCreateWellProximity } from "./create-work-item-exclusive-proximity-context";

export function BoardColumnCreateAction({
	ants = true,
	dropZoneLabel,
	placement = "bottom",
	sessionDragTransaction,
	title,
}: Readonly<{
	ants?: boolean;
	dropZoneLabel?: string;
	placement?: "top" | "bottom";
	sessionDragTransaction: BoardAgentSessionDrag["transaction"];
	title: string;
}>) {
	const targetRef = useRef<HTMLDivElement>(null);
	const proximityRef = useRef<HTMLDivElement>(null);
	const isExclusiveWinner = useExclusiveCreateWellProximity(title, proximityRef);
	const drag: JiraDropzoneDragState = resolveBoardCreateDropzoneDrag(
		sessionDragTransaction,
		title,
	);
	const { anchorRef, minimumHeight } = useCreateDropzoneHeight(Boolean(dropZoneLabel) && drag !== "idle", placement);

	return (
		// A stable bottom footprint keeps the card viewport unchanged during drag.
		<div className="relative h-10 w-full">
			<div ref={anchorRef} className={cn("absolute inset-x-0 z-10", placement === "top" ? "top-1" : "bottom-1")}>
				{dropZoneLabel ? (
					// Detect the future well footprint before its visible chrome grows.
					// This stays anchored when the magnetic surface leans or expands.
					<div
						aria-hidden="true"
						data-create-work-item-proximity=""
						className={cn("pointer-events-none absolute inset-x-0 h-8", placement === "top" ? "top-0" : "bottom-0")}
						ref={proximityRef}
						style={{ minHeight: drag !== "idle" ? Math.max(JIRA_DROPZONE_OPEN_HEIGHT_PX, minimumHeight) : undefined }}
					/>
				) : null}
				{dropZoneLabel ? (
					<JiraDropzone
						ants={ants}
						drag={drag}
						exclusiveWinner={isExclusiveWinner}
						hoverArea={CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX}
						label={dropZoneLabel}
						measuredRef={targetRef}
						openMinHeight={minimumHeight}
						proximityRef={proximityRef}
						renderResting={() => <span aria-hidden className="block h-8 w-full" />}
						title={title}
					/>
				) : (
					<span aria-hidden className="block h-8 w-full" />
				)}
			</div>
		</div>
	);
}

export function BoardColumnAddButton({
	onCreateWorkItem,
	reveal = "column-hover",
	title,
}: Readonly<{
	onCreateWorkItem?: (draft: AgentSessionWorkItemDraft) => void;
	reveal?: "always" | "column-hover";
	title: string;
}>) {
	const [open, setOpen] = useState(false);
	const [summary, setSummary] = useState("");
	const [issueType, setIssueType] = useState<AgentSessionWorkItemDraft["issueType"]>("task");

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (!next) {
			setSummary("");
			setIssueType("task");
		}
	}

	function handleSubmit() {
		const trimmedSummary = summary.trim();
		if (!onCreateWorkItem || trimmedSummary.length === 0) return;
		onCreateWorkItem({ issueType, summary: trimmedSummary });
		handleOpenChange(false);
	}

	return (
		<DropdownMenu onOpenChange={handleOpenChange} open={open}>
			<DropdownMenuTrigger
				aria-haspopup="dialog"
				disabled={onCreateWorkItem === undefined}
				render={
					<Button
						aria-label={`Create in ${title}`}
						disabled={onCreateWorkItem === undefined}
						className={cn(
							"w-full border-dashed hover:border-solid",
							reveal === "column-hover" && !open
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
				}
			/>
			<DropdownMenuContent aria-label={`Create work item in ${title}`} className="w-[22rem] p-2.5" role="dialog">
				<CreateWorkItemField
					issueType={issueType}
					onIssueTypeChange={setIssueType}
					onSummaryChange={setSummary}
					onSubmit={handleSubmit}
					summary={summary}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
