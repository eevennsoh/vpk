"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import ArrowDownIcon from "@atlaskit/icon/core/arrow-down";
import { Icon } from "@/components/ui/icon";
import { JiraDropzoneAntsStroke } from "@/components/blocks/jira-dropzone/jira-dropzone-ants-stroke";
import { JiraDropzoneMagneticLabel } from "@/components/blocks/jira-dropzone/jira-dropzone-magnetic-label";
import { JIRA_DROPZONE_ANTS_CLASS } from "@/components/blocks/jira-dropzone/lib/jira-dropzone-ants";
import { JIRA_DROPZONE_WELL_CHROME_CLASS, resolveJiraDropzoneWellColors } from "@/components/blocks/jira-dropzone/lib/jira-dropzone-chrome";
import { useMagneticProximity } from "@/components/ui-custom/hooks/use-magnetic-proximity";
import { Lozenge } from "@/components/ui/lozenge";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import type { useBoardIssueDrop } from "../hooks/use-board-issue-drop";
import { CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX } from "../lib/create-work-item-exclusive-proximity";
import { BoardCardInsertionLine } from "./board-card-insertion-line";

function BoardIssueStatusDropZone({ selected, status }: Readonly<{ selected: boolean; status: string }>) {
	const targetRef = useRef<HTMLDivElement>(null);
	const shouldReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const magnet = useMagneticProximity(targetRef, { distance: 8, hoverArea: CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX, labelRatio: 0.5, trackDrag: true });
	return <div
		ref={targetRef}
		data-issue-status-zone={status}
		className="relative min-h-0 flex-1"
	>
		{/* Keep detection fixed while the painted well follows the create well's 8px lean. */}
		<motion.div
			className={cn(
				"pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden text-center text-sm font-medium transition-colors duration-normal ease-out-practical will-change-transform motion-reduce:transition-none",
				JIRA_DROPZONE_WELL_CHROME_CLASS,
				resolveJiraDropzoneWellColors(selected),
				!shouldReduceMotion ? JIRA_DROPZONE_ANTS_CLASS : null,
			)}
			style={{ x: shouldReduceMotion ? 0 : magnet.x, y: 0 }}
		>
			{!shouldReduceMotion ? <JiraDropzoneAntsStroke selected={selected} /> : null}
			<JiraDropzoneMagneticLabel magnet={magnet}>
				<span className="flex flex-col items-center justify-center gap-1">
					<span className="text-xs font-medium leading-4 text-text-subtle">Transition to</span>
					<span aria-hidden className="inline-block rotate-90 text-xs font-medium leading-4 text-text-subtle" data-issue-transition-arrow="">→</span>
					<Lozenge className="mt-1" variant="information">{status}</Lozenge>
				</span>
			</JiraDropzoneMagneticLabel>
		</motion.div>
	</div>;
}

function DefaultBoardIssueStatusDropZone({ selected, status }: Readonly<{ selected: boolean; status: string }>) {
	return (
		<div data-issue-status-zone={status} className={cn("flex min-h-0 flex-1 flex-col items-center justify-center gap-2 border-border-selected text-sm text-text last:border-t-2", selected ? "bg-bg-selected-hovered" : null)}>
			<span>Transition to</span>
			<Icon aria-hidden className="text-icon-subtle" data-issue-transition-arrow="" render={<ArrowDownIcon color="currentColor" label="" size="small" />} />
			<Lozenge variant="information">{status}</Lozenge>
		</div>
	);
}

type TransitionOverlayProps = Readonly<{ issueDrop: ReturnType<typeof useBoardIssueDrop>; title: string; moveVisual?: boolean }>;

function BoardIssueStatusChoices({ issueDrop, title, moveVisual }: TransitionOverlayProps) {
	const StatusDropZone = moveVisual ? BoardIssueStatusDropZone : DefaultBoardIssueStatusDropZone;
	const choices = issueDrop.choosing ? issueDrop.choices : [];
	return (
		<div
			className={cn("absolute inset-0 z-20 flex flex-col", moveVisual ? "p-1" : "overflow-hidden rounded-lg border-2 border-border-selected bg-bg-selected", !issueDrop.choosing ? "opacity-0" : null)}
			style={{ gap: moveVisual ? token("space.050") : undefined }}
			aria-hidden={!issueDrop.choosing || undefined}
			role="group"
			aria-label={`Choose a status in ${title}`}
		>
			{choices.map((status) => <StatusDropZone key={status} selected={issueDrop.current?.status === status} status={status} />)}
		</div>
	);
}

export function BoardIssueTransitionOverlay({ issueDrop, title, moveVisual = true }: TransitionOverlayProps) {
	const insertion = issueDrop.choosing ? null : issueDrop.current;
	return <>
		{issueDrop.offeringChoices || issueDrop.current?.entered ? <BoardIssueStatusChoices issueDrop={issueDrop} title={title} moveVisual={moveVisual} /> : null}
		{insertion?.lineTop !== undefined ? (
			<div className="pointer-events-none absolute inset-x-1 z-30" style={{ top: insertion.lineTop }} data-issue-drop-before={insertion.beforeCardCode ?? "end"}>
				<BoardCardInsertionLine position="before" seam="edge" marker={moveVisual ? "none" : "circle"} />
			</div>
		) : null}
	</>;
}
