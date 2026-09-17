"use client";

import AddIcon from "@atlaskit/icon/core/add";
import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { AgentSessionWorkItemDraft } from "@/components/blocks/agent-session";
import { CreateWorkItemField } from "@/components/blocks/agent-session/agent-session-link-work-item-submenu";

import {
	JiraDropzone,
	type JiraDropzoneControlProps,
	type JiraDropzoneDragState,
} from "@/components/blocks/jira-dropzone";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { JIRA_DROPZONE_OPEN_HEIGHT_PX, JIRA_DROPZONE_WELL_ENTER } from "@/components/blocks/jira-dropzone/lib/jira-dropzone-motion";

import { CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX } from "../lib/create-work-item-exclusive-proximity";
import { resolveBoardCreateDropzoneDrag } from "../lib/board-agent-session-drag";
import { useCreateDropzoneBackdrop, useCreateDropzoneHeight } from "../hooks/use-create-dropzone-height";
import type { BoardAgentSessionDrag } from "../use-board-agent-session-drag";
import { useExclusiveCreateWellProximity } from "./create-work-item-exclusive-proximity-context";

export function BoardColumnCreateAction({
	ants = true,
	columnSizing = "fill",
	dropZoneLabel,
	onCreateWorkItem,
	placement = "bottom",
	sessionDragTransaction,
	title,
}: Readonly<{
	ants?: boolean;
	columnSizing?: "fill" | "content";
	dropZoneLabel?: string;
	onCreateWorkItem?: (draft: AgentSessionWorkItemDraft) => void;
	placement?: "top" | "bottom";
	sessionDragTransaction: BoardAgentSessionDrag["transaction"];
	title: string;
}>) {
	const targetRef = useRef<HTMLDivElement>(null);
	const proximityRef = useRef<HTMLDivElement>(null);
	useCreateDropzoneBackdrop(targetRef, columnSizing);
	const isExclusiveWinner = useExclusiveCreateWellProximity(title, proximityRef);
	const drag: JiraDropzoneDragState = resolveBoardCreateDropzoneDrag(
		sessionDragTransaction,
		title,
	);
	const { anchorRef, minimumHeight } = useCreateDropzoneHeight(Boolean(dropZoneLabel) && drag !== "idle", placement, columnSizing);
	const [targetHeight, setTargetHeight] = useState(columnSizing === "content" ? 24 : 32);
	useLayoutEffect(() => {
		const target = targetRef.current;
		if (!target) return;
		const measure = () => setTargetHeight(Math.ceil(target.offsetHeight));
		const resize = new ResizeObserver(measure);
		resize.observe(target);
		measure();
		return () => resize.disconnect();
	}, [dropZoneLabel]);

	return (
		// Content-sized columns keep a stable footer while the well fills the
		// unused shell below it. Fill columns reserve the well's actual height.
		<div data-board-column-create-action={columnSizing} className="relative w-full shrink-0" style={{ height: columnSizing === "content" ? Math.max(32, Math.min(40, targetHeight + 8)) : Math.max(40, targetHeight + 8) }}>
			<div ref={anchorRef} className={cn("absolute inset-x-0 z-10", columnSizing === "content" ? "top-1 h-8" : placement === "top" ? "top-1" : "bottom-1")}>
				{dropZoneLabel ? (
					// Detect the future well footprint before its visible chrome grows.
					// This stays anchored when the magnetic surface leans or expands.
					<div
						aria-hidden="true"
						data-create-work-item-proximity=""
						className={cn("pointer-events-none absolute inset-x-0 h-8", placement === "top" ? "top-0" : "bottom-0")}
						ref={proximityRef}
						style={{
							minHeight: drag !== "idle" ? Math.max(JIRA_DROPZONE_OPEN_HEIGHT_PX, minimumHeight) : undefined,
							top: columnSizing === "content" ? drag !== "idle" ? Math.min(0, minimumHeight - JIRA_DROPZONE_OPEN_HEIGHT_PX) : 0 : undefined,
							bottom: columnSizing === "content" ? "auto" : undefined,
						}}
					/>
				) : null}
				{dropZoneLabel ? (
					<div className="relative w-full" style={{ top: columnSizing === "content" && targetHeight > 32 && minimumHeight > 0 ? Math.min(0, minimumHeight - targetHeight) : undefined }}>
						<JiraDropzone
							ants={ants}
							drag={drag}
							exclusiveWinner={isExclusiveWinner}
							hoverArea={CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX}
							label={dropZoneLabel}
							measuredRef={targetRef}
							openMinHeight={minimumHeight}
							proximityRef={proximityRef}
							renderControl={columnSizing === "content" ? (control) => <BoardColumnAddButton
								control={control}
								onCreateWorkItem={onCreateWorkItem}
								reveal="always"
								size={control.active ? "default" : "compact"}
								title={title}
							/> : undefined}
							renderResting={() => <span aria-hidden className="block h-8 w-full" />}
							title={title}
						/>
					</div>
				) : (
					columnSizing === "content"
						? <BoardColumnAddButton onCreateWorkItem={onCreateWorkItem} reveal="always" size="compact" title={title} />
						: <span aria-hidden className="block h-8 w-full" />
				)}
			</div>
		</div>
	);
}

export function BoardColumnAddButton({
	control,
	onCreateWorkItem,
	reveal = "column-hover",
	size = "compact",
	title,
}: Readonly<{
	control?: JiraDropzoneControlProps;
	onCreateWorkItem?: (draft: AgentSessionWorkItemDraft) => void;
	reveal?: "always" | "column-hover";
	size?: ButtonProps["size"];
	title: string;
}>) {
	const [open, setOpen] = useState(false);
	const [summary, setSummary] = useState("");
	const [issueType, setIssueType] = useState<AgentSessionWorkItemDraft["issueType"]>("task");

	function handleOpenChange(next: boolean) {
		if (control?.active && next) return;
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
				disabled={control?.active || onCreateWorkItem === undefined}
				render={
					<Button
						aria-disabled={control?.active || undefined}
						aria-label={control?.active ? `${control.label} in ${title}${control.selected ? ", selected drop target" : ""}` : `Create in ${title}`}
						data-jira-dropzone-control={control ? title : undefined}
						disabled={control?.active || onCreateWorkItem === undefined}
						className={cn(
							"w-full border-dashed hover:border-solid",
							control?.selected ? null : "text-text-subtlest hover:text-text-subtle [&_svg]:text-icon-subtlest hover:[&_svg]:text-icon-subtle",
							control?.className,
							control?.active ? "hover:border-dashed" : null,
							reveal === "column-hover" && !open
								? cn(
									"pointer-events-none opacity-0 transition-opacity duration-normal ease-out-practical",
									"group-hover/board-column:pointer-events-auto group-hover/board-column:opacity-100",
									"group-has-[:focus-visible]/board-column:pointer-events-auto group-has-[:focus-visible]/board-column:opacity-100",
									"motion-reduce:transition-none",
								)
								: null,
						)}
						onClick={(event) => { if (control?.active) event.preventDefault(); }}
						render={control ? <motion.button
							layout={control.layout}
							transition={{ layout: JIRA_DROPZONE_WELL_ENTER }}
						/> : undefined}
						size={size}
						style={control ? { minHeight: control.minHeight } : undefined}
						variant="outline"
					>
						{control ? control.children : <Icon render={<AddIcon label="" size="small" />} />}
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
