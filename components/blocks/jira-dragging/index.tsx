"use client";

import { ExperimentalJiraKanban } from "@/components/blocks/jira-kanban/experimental/experimental-jira-kanban";
import { JIRA_TEAM_EU26_PAY_BOARD_AGENTS } from "@/components/projects/jira-team-eu26/data/presentation-story";
import { cn } from "@/lib/utils";
import { useJiraDragging } from "./use-jira-dragging";
import { useJiraSelectionDismiss } from "./use-jira-selection-dismiss";

export interface JiraDraggingProps {
	className?: string;
}

/** A focused playground using the same issue-drag renderer as Team EU26. */
export function JiraDragging({ className }: Readonly<JiraDraggingProps>) {
	const { rootRef, ...board } = useJiraDragging();
	useJiraSelectionDismiss({
		rootRef, boardColumns: board.boardColumns, selectedCardCodes: board.selectedCardCodes,
		dragging: board.draggedCardCode !== null, onClearSelection: board.selectionToolbar.onClearSelection,
	});
	return (
		<div ref={rootRef} data-jira-dragging="" className={cn("flex h-[720px] min-h-0 w-full max-w-[1200px] flex-col", className)}>
			<ExperimentalJiraKanban
				{...board}
				agents={JIRA_TEAM_EU26_PAY_BOARD_AGENTS}
				ariaLabel="Jira Dragging: drag issues between To do, In progress, In review, and Done"
				issueDragTransitions
				issueSelectionAppearance="fused-backdrop"
				columnChrome="default"
				columnSizing="content"
				iconScale="comfortable"
				subtaskChrome="stroke"
				cardGenerativeActionPresentation="more-actions"
			/>
		</div>
	);
}
