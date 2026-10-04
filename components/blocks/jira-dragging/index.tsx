"use client";

import { ExperimentalJiraKanban } from "@/components/blocks/jira-kanban/experimental/experimental-jira-kanban";
import { JIRA_TEAM_EU26_PAY_BOARD_AGENTS } from "@/components/projects/jira-team-eu26/data/presentation-story";
import { cn } from "@/lib/utils";
import { useJiraDragging } from "./use-jira-dragging";
import { useJiraSelectionDismiss } from "@/components/blocks/jira-kanban/use-jira-selection-dismiss";

export interface JiraDraggingProps {
	className?: string;
	/** Default restores the original move visuals; experimental keeps the uplift. */
	variant?: "default" | "experimental";
}

/** A focused playground using the same issue-drag renderer as Team EU26. */
export function JiraDragging({ className, variant = "default" }: Readonly<JiraDraggingProps>) {
	const { rootRef, ...board } = useJiraDragging();
	useJiraSelectionDismiss({
		rootRef, boardColumns: board.boardColumns, selectedCardCodes: board.selectedCardCodes,
		dragging: board.draggedCardCode !== null, onClearSelection: board.selectionToolbar.onClearSelection,
	});
	return (
		<div ref={rootRef} data-jira-dragging="" data-variant={variant} className={cn("flex h-[720px] min-h-0 w-full max-w-[1200px] flex-col", className)}>
			<ExperimentalJiraKanban
				{...board}
				agents={JIRA_TEAM_EU26_PAY_BOARD_AGENTS}
				ariaLabel="Jira Dragging: drag issues between To do, In progress, In review, and Done"
				issueDropMotion={variant === "experimental" ? "solitaire" : undefined}
				issueDragTransitions
				issueMoveVisual={variant === "experimental"}
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
