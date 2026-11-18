import {
	toJiraIssueAgentActivityFromSession,
	type AgentSessionItem,
	type AgentSessionWorkItemDraft,
} from "@/components/blocks/agent-session";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { linkJiraKanbanAgentSession } from "@/components/blocks/jira-kanban/state";

import { insertBoardCardFromDraft } from "./board-work-item-options";

/**
 * Board mutations behind the session menu's Link work item submenu.
 *
 * Both entry points exist for hosts that wired no link or create capability of
 * their own — the block demo route, for one. Without them the submenu would
 * accept a choice and silently drop it, which reads as a broken control rather
 * than an absent one. Hosts that own these operations keep their own path and
 * never reach here. The pure model lives in `board-work-item-options`; this file
 * is only the composition that needs the board's session-linking helpers.
 */

/** Adds a work item named by the viewer and attaches the session to it. */
export function createBoardCardFromDraft(
	columns: readonly JiraKanbanColumnData[],
	session: AgentSessionItem,
	draft: AgentSessionWorkItemDraft,
): readonly JiraKanbanColumnData[] {
	const { columns: withCard, issueKey } = insertBoardCardFromDraft(columns, draft);
	if (issueKey === undefined) {
		return columns;
	}

	return linkJiraKanbanAgentSession(
		withCard,
		issueKey,
		toJiraIssueAgentActivityFromSession(session),
	);
}

/**
 * Attaches a session to a work item that already exists on the board.
 *
 * Mirrors what the drag-to-link path does through the host, so a session linked
 * from the menu lands in the same shape as one dropped onto a card.
 */
export function linkBoardCardToSession(
	columns: readonly JiraKanbanColumnData[],
	session: AgentSessionItem,
	workItemKey: string,
): readonly JiraKanbanColumnData[] {
	return linkJiraKanbanAgentSession(
		columns,
		workItemKey,
		toJiraIssueAgentActivityFromSession(session),
	);
}
