"use client";

import { useMemo } from "react";
import type { JiraFilterCondition } from "@/components/blocks/jira-filter";
import { filterBoardByJiraConditions } from "../lib/board-jira-filter";

import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban/index";
import { filterJiraKanbanColumnsByAssignee } from "@/components/blocks/jira-kanban/state";
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
 * Derive filtered columns and overlay their collapse and session visibility
 * without overwriting the viewer's unfiltered layout.
 */
export function useAgentFilterDisplay({
	agentFilterId,
	boardColumns,
	filterConditions = [],
	focusedCollapsedColumns,
	selectedAssigneeIds,
	untrackedSessionCount,
	viewerAgentSessionColumnCollapsed,
	viewerCollapsedColumns,
	viewerShowUntracked,
	viewerShownSessionStateIds,
}: {
	agentFilterId: BoardAgentFilterId | null;
	boardColumns: readonly JiraKanbanColumnData[];
	filterConditions?: readonly JiraFilterCondition[];
	focusedCollapsedColumns: CollapsedBoardColumns | null;
	selectedAssigneeIds: ReadonlySet<string>;
	untrackedSessionCount: number;
	viewerAgentSessionColumnCollapsed: boolean;
	viewerCollapsedColumns: CollapsedBoardColumns;
	viewerShowUntracked: boolean;
	viewerShownSessionStateIds: ReadonlySet<BoardAgentSessionStateId>;
}) {
	const assigneeScopedColumns = useMemo(
		() => filterBoardByJiraConditions(filterConditions.some((condition) => condition.field === "assignee") ? boardColumns : filterJiraKanbanColumnsByAssignee(boardColumns, selectedAssigneeIds), filterConditions),
		[boardColumns, filterConditions, selectedAssigneeIds],
	);
	const displayedCollapsedColumns = useMemo(
		() => displayedCollapsedColumnsForAgentFilter({
			columns: assigneeScopedColumns,
			filterId: agentFilterId,
			filterActive: filterConditions.some((condition) => condition.values.length > 0),
			focusedOverride: focusedCollapsedColumns,
			viewerCollapsed: viewerCollapsedColumns,
		}),
		[agentFilterId, assigneeScopedColumns, filterConditions, focusedCollapsedColumns, viewerCollapsedColumns],
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
			untrackedSessionCount,
		),
		displayedCollapsedColumns,
		displayedShowUntracked,
		filteredBoardColumns,
	};
}
