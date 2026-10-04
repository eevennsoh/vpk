"use client";

import { useCallback } from "react";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban/index";
import { createJiraKanbanSelectionState, type JiraKanbanSelectionState } from "@/components/blocks/jira-kanban/state";
import { autoArrangeCards } from "../lib/board-auto-arrange";

/** Commit the complete plan and settle both selection and drag together. */
export function useBoardAutoArrangeCommit(
	updateColumns: (updater: (columns: readonly JiraKanbanColumnData[]) => readonly JiraKanbanColumnData[]) => void,
	setSelection: (selection: JiraKanbanSelectionState) => void,
	endDrag: (drag: null) => void,
) {
	return useCallback((codes: ReadonlySet<string>) => {
		updateColumns((columns) => autoArrangeCards(columns, codes));
		setSelection(createJiraKanbanSelectionState());
		endDrag(null);
	}, [endDrag, setSelection, updateColumns]);
}
