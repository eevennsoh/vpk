"use client";

import { useMemo } from "react";

import type { JiraKanbanColumnData } from "../../index";
import { filterJiraKanbanColumnsByAssignee } from "../../state";
import {
	shownSessionStateIdsForAgentFilter,
	type BoardAgentFilterId,
	type BoardAgentSessionStateId,
} from "../data/board-view-options";
import {
	displayedAgentSessionColumnCollapsedForAgentFilter,
	displayedCollapsedColumnsForAgentFilter,
	filterJiraKanbanColumnsByAgentFilter,
} from "../lib/board-agent-filter";
import { filterJiraKanbanColumnsByAgentSessionState } from "../lib/board-agent-session-visibility";
import type { CollapsedBoardColumns } from "../lib/board-column-collapse";

/**
 * Overlay View → Agents onto viewer collapse and session visibility so a
 * temporary control-row unmount cannot drop the focus or its restore path.
 */
export function useAgentFilterDisplay({
	agentFilterId,
	boardColumns,
	focusedCollapsedColumns,
	selectedAssigneeIds,
	viewerAgentSessionColumnCollapsed,
	viewerCollapsedColumns,
	viewerShowUntracked,
	viewerShownSessionStateIds,
}: {
	agentFilterId: BoardAgentFilterId | null;
	boardColumns: readonly JiraKanbanColumnData[];
	focusedCollapsedColumns: CollapsedBoardColumns | null;
	selectedAssigneeIds: ReadonlySet<string>;
	viewerAgentSessionColumnCollapsed: boolean;
	viewerCollapsedColumns: CollapsedBoardColumns;
	viewerShowUntracked: boolean;
	viewerShownSessionStateIds: ReadonlySet<BoardAgentSessionStateId>;
}) {
	const assigneeScopedColumns = useMemo(
		() => filterJiraKanbanColumnsByAssignee(boardColumns, selectedAssigneeIds),
		[boardColumns, selectedAssigneeIds],
	);
	const displayedCollapsedColumns = useMemo(
		() => displayedCollapsedColumnsForAgentFilter({
			columns: assigneeScopedColumns,
			filterId: agentFilterId,
			focusedOverride: focusedCollapsedColumns,
			viewerCollapsed: viewerCollapsedColumns,
		}),
		[agentFilterId, assigneeScopedColumns, focusedCollapsedColumns, viewerCollapsedColumns],
	);
	const displayedShownSessionStateIds = useMemo(
		() => agentFilterId === null
			? viewerShownSessionStateIds
			: shownSessionStateIdsForAgentFilter(agentFilterId),
		[agentFilterId, viewerShownSessionStateIds],
	);
	const displayedShowUntracked = agentFilterId === null
		? viewerShowUntracked
		: agentFilterId === "untracked";
	// Scope first, then strip chrome. The focus row answers "which work is
	// waiting on me", so a card that only shares a column with a waiting
	// session leaves the board; unlink sessions use the same focus in
	// `filterAgentSessionsByAgentFilter`. The visibility pass then trims the
	// rows the viewer is not focused on inside the cards that stayed.
	const agentFocusedColumns = useMemo(
		() => filterJiraKanbanColumnsByAgentFilter(assigneeScopedColumns, agentFilterId),
		[agentFilterId, assigneeScopedColumns],
	);
	const filteredBoardColumns = useMemo(
		() => filterJiraKanbanColumnsByAgentSessionState(
			agentFocusedColumns,
			displayedShownSessionStateIds,
		),
		[agentFocusedColumns, displayedShownSessionStateIds],
	);

	return {
		displayedAgentSessionColumnCollapsed: displayedAgentSessionColumnCollapsedForAgentFilter(
			agentFilterId,
			viewerAgentSessionColumnCollapsed,
		),
		displayedCollapsedColumns,
		displayedShowUntracked,
		filteredBoardColumns,
	};
}
