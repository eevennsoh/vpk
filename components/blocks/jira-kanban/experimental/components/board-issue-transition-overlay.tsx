"use client";

import { useRef } from "react";
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
		className={cn(
			"relative flex min-h-0 flex-1 items-center justify-center overflow-hidden text-center text-sm font-medium transition-colors duration-normal ease-out-practical motion-reduce:transition-none",
			JIRA_DROPZONE_WELL_CHROME_CLASS,
			resolveJiraDropzoneWellColors(selected),
			!shouldReduceMotion ? JIRA_DROPZONE_ANTS_CLASS : null,
		)}
	>
		{!shouldReduceMotion ? <JiraDropzoneAntsStroke selected={selected} /> : null}
		<JiraDropzoneMagneticLabel magnet={magnet}>
			<span className="flex flex-col items-center justify-center gap-1">
				<span className="text-xs font-medium leading-4 text-text-subtle">Transition to</span>
				<span aria-hidden className="inline-block rotate-90 text-xs font-medium leading-4 text-text-subtle" data-issue-transition-arrow="">→</span>
				<Lozenge className="mt-1" variant="information">{status}</Lozenge>
			</span>
		</JiraDropzoneMagneticLabel>
	</div>;
}

export function BoardIssueTransitionOverlay({ issueDrop, title }: Readonly<{ issueDrop: ReturnType<typeof useBoardIssueDrop>; title: string }>) {
	return <>
		{issueDrop.offeringChoices || issueDrop.current?.entered ? (
			<div className={cn("absolute inset-0 z-20 flex flex-col p-1", !issueDrop.choosing ? "opacity-0" : null)} style={{ gap: token("space.050") }} aria-hidden={!issueDrop.choosing || undefined} role="group" aria-label={`Choose a status in ${title}`}>
				{issueDrop.choosing ? issueDrop.choices.map((status) => <BoardIssueStatusDropZone key={status} selected={issueDrop.current?.status === status} status={status} />) : null}
			</div>
		) : null}
		{!issueDrop.choosing && issueDrop.current?.lineTop !== undefined ? (
			<div className="pointer-events-none absolute inset-x-1 z-30" style={{ top: issueDrop.current.lineTop }} data-issue-drop-before={issueDrop.current.beforeCardCode ?? "end"}>
				<BoardCardInsertionLine position="before" seam="edge" marker="none" />
			</div>
		) : null}
	</>;
}
