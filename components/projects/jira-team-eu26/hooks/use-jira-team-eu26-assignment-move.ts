import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { JiraKanbanAgentData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { JiraKanbanIssueMoveRequest } from "@/components/blocks/jira-kanban/experimental/hooks/use-issue-move-request";
import { mergeJiraKanbanAgentCatalog } from "@/components/blocks/jira-kanban/lib/agent-catalog";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import { linkJiraKanbanAgentSession } from "@/components/blocks/jira-kanban/state";
import { applyAssignedAgentIdsToColumns, getJiraTeamEu26CardMove, progressJiraTeamEu26WorkItemOnStart } from "@/components/projects/jira-team-eu26/lib/list-rows";

interface PendingAssignment {
	issueKey: string;
	update: (columns: readonly JiraKanbanColumnData[]) => JiraKanbanColumnData[];
	columnTitle: string;
}

/** Board assignment shares move geometry, with its card glow owning the feedback. */
export function useJiraTeamEu26AssignmentMove({
	agents,
	boardColumns,
	setBoardColumns,
}: Readonly<{
	agents: readonly JiraKanbanAgentData[];
	boardColumns: readonly JiraKanbanColumnData[];
	setBoardColumns: Dispatch<SetStateAction<JiraKanbanColumnData[]>>;
}>) {
	const catalog = useMemo(() => mergeJiraKanbanAgentCatalog(agents), [agents]);
	const pending = useRef<PendingAssignment | undefined>(undefined);
	const sequence = useRef(0);
	const [issueMoveRequest, setIssueMoveRequest] = useState<JiraKanbanIssueMoveRequest>();
	const queueUpdate = useCallback((issueKey: string, update: PendingAssignment["update"]) => {
		const move = getJiraTeamEu26CardMove(boardColumns, update(boardColumns), issueKey);
		if (!move) {
			setBoardColumns(update);
			return;
		}
		pending.current = { issueKey, update, columnTitle: move.columnTitle };
		setIssueMoveRequest({ ...move, id: ++sequence.current, feedback: "none" });
	}, [boardColumns, setBoardColumns]);
	const onBoardAssignedAgentIdsChange = useCallback((issueKey: string, agentIds: readonly string[]) => {
		queueUpdate(issueKey, (columns) => applyAssignedAgentIdsToColumns(columns, issueKey, agentIds, catalog));
	}, [catalog, queueUpdate]);
	const startAgentSession = useCallback((issueKey: string, activity: JiraIssueAgentActivity) => {
		queueUpdate(issueKey, (columns) => progressJiraTeamEu26WorkItemOnStart(linkJiraKanbanAgentSession(columns, issueKey, activity), issueKey));
	}, [queueUpdate]);
	const onBoardColumnsChange = useCallback((columns: readonly JiraKanbanColumnData[]) => {
		const assignment = pending.current;
		const moved = assignment && columns.some((column) => column.title === assignment.columnTitle
			&& column.cards.some((card) => card.code === assignment.issueKey));
		if (assignment && moved) {
			// The drop controller captured the old DOM before producing these columns.
			// Add the session in this same commit, so only the arrival owner projects it.
			pending.current = undefined;
			setIssueMoveRequest(undefined);
			setBoardColumns(assignment.update(columns));
		} else {
			setBoardColumns([...columns]);
		}
	}, [setBoardColumns]);
	return { issueMoveRequest, onBoardAssignedAgentIdsChange, onBoardColumnsChange, startAgentSession };
}
