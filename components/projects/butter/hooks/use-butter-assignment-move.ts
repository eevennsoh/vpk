import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { JiraKanbanAgentData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { JiraKanbanIssueMoveRequest } from "@/components/blocks/jira-kanban/experimental/hooks/use-issue-move-request";
import { mergeJiraKanbanAgentCatalog } from "@/components/blocks/jira-kanban/lib/agent-catalog";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import { linkJiraKanbanAgentSession } from "@/components/blocks/jira-kanban/state";
import { applyAssignedAgentIdsToColumns, assignedAgentsFromCard, getButterCardMove, progressButterWorkItemOnStart } from "@/components/projects/butter/lib/list-rows";

interface PendingAssignment {
	issueKey: string;
	update: (columns: readonly JiraKanbanColumnData[]) => JiraKanbanColumnData[];
	columnTitle: string;
	onApplied?: () => void;
}

function restoreAssignedCardFocus(issueKey: string) {
	const root = document.querySelector("[data-butter-board-surface]");
	if (!root) return;
	// Native arrival temporarily makes the moved card inert; restore focus once it is usable.
	const observer = new MutationObserver(() => {
		const row = root.querySelector<HTMLElement>(`[data-issue-key="${CSS.escape(issueKey)}"] [data-jira-issue-agent-row-handle]`);
		if (!row || row.closest('[inert], [aria-hidden="true"]')) return;
		observer.disconnect();
		if (document.activeElement === document.body) row.focus({ preventScroll: true });
	});
	observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert", "aria-hidden"] });
	return () => observer.disconnect();
}

/** Board assignment shares move geometry, with its card glow owning the feedback. */
export function useButterAssignmentMove({
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
	const stopFocusRestore = useRef<(() => void) | undefined>(undefined);
	useEffect(() => () => stopFocusRestore.current?.(), []);
	const sequence = useRef(0);
	const [issueMoveRequest, setIssueMoveRequest] = useState<JiraKanbanIssueMoveRequest>();
	const queueUpdate = useCallback((issueKey: string, update: PendingAssignment["update"], onApplied?: () => void, animation?: "flight") => {
		stopFocusRestore.current?.();
		stopFocusRestore.current = undefined;
		const move = getButterCardMove(boardColumns, update(boardColumns), issueKey);
		if (!move) {
			setBoardColumns(update);
			onApplied?.();
			return;
		}
		pending.current = { issueKey, update, columnTitle: move.columnTitle, onApplied };
		setIssueMoveRequest({ ...move, id: ++sequence.current, feedback: "none", animation });
	}, [boardColumns, setBoardColumns]);
	const onBoardAssignedAgentIdsChange = useCallback((issueKey: string, agentIds: readonly string[]) => {
		queueUpdate(issueKey, (columns) => applyAssignedAgentIdsToColumns(columns, issueKey, agentIds, catalog));
	}, [catalog, queueUpdate]);
	const onSelectedCardsAgentAssign = useCallback((issueKeys: readonly string[], agentId: string) => {
		setBoardColumns((columns) => issueKeys.reduce((current, issueKey) => {
			const card = current.flatMap((column) => column.cards).find((candidate) => candidate.code === issueKey);
			if (!card) return current;
			const ids = assignedAgentsFromCard(card, catalog).map((agent) => agent.id);
			return ids.includes(agentId) ? current : applyAssignedAgentIdsToColumns(current, issueKey, [...ids, agentId], catalog);
		}, columns));
	}, [catalog, setBoardColumns]);
	const startAgentSession = useCallback((issueKey: string, activity: JiraIssueAgentActivity) => {
		queueUpdate(issueKey, (columns) => progressButterWorkItemOnStart(linkJiraKanbanAgentSession(columns, issueKey, activity), issueKey));
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
			setBoardColumns((current) => assignment.update(current));
			assignment.onApplied?.();
			if (!assignment.onApplied) stopFocusRestore.current = restoreAssignedCardFocus(assignment.issueKey);
		} else {
			setBoardColumns([...columns]);
		}
	}, [setBoardColumns]);
	return { issueMoveRequest, onBoardAssignedAgentIdsChange, onBoardColumnsChange, onSelectedCardsAgentAssign, queueUpdate, startAgentSession };
}
