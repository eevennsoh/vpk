import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { moveJiraKanbanCardsToDropTarget } from "@/components/blocks/jira-kanban/card-drop";
import type { IssueCardMove } from "@/components/blocks/jira-kanban/experimental/hooks/use-issue-card-drop-arrival";

import { JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES } from "../data/keynote-board";
import { isJiraTeamEu26FinaleReady } from "../finale/lib/finale-trigger";

export const JIRA_TEAM_EU26_END_CLOSING_COLUMN_TITLE = "Done";

export type JiraTeamEu26EndClosingAction =
	/** Every keynote card is already Done, so only the finale can replay. */
	| { readonly kind: "replay" }
	/** One cohort drop of every remaining keynote card, after the last Done card. */
	| { readonly kind: "move"; readonly move: IssueCardMove };

/**
 * "Play closing": bulk-drop every keynote announcement that is not yet Done
 * after the last Done card, exactly as one multi-card drag would. Cards already
 * in Done keep their order; the rest follow in board order (column by column,
 * top to bottom). Cards created live during the demo stay where they are.
 */
export function resolveJiraTeamEu26EndClosingAction(
	columns: readonly JiraKanbanColumnData[],
): JiraTeamEu26EndClosingAction {
	if (isJiraTeamEu26FinaleReady(columns, JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES)) return { kind: "replay" };
	const keynoteCodes = new Set(JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES);
	const cardCodes = columns
		.filter((column) => column.title !== JIRA_TEAM_EU26_END_CLOSING_COLUMN_TITLE)
		.flatMap((column) => column.cards)
		.map((card) => card.code)
		.filter((code) => keynoteCodes.has(code));
	return {
		kind: "move",
		move: { cardCodes, columnTitle: JIRA_TEAM_EU26_END_CLOSING_COLUMN_TITLE, target: { beforeCardCode: null } },
	};
}

/** The board commit for a closing move; the kanban applies the same drop transform. */
export function applyJiraTeamEu26EndClosingMove(
	columns: JiraKanbanColumnData[],
	move: IssueCardMove,
): JiraKanbanColumnData[] {
	return moveJiraKanbanCardsToDropTarget(columns, move.cardCodes, move.columnTitle, move.target ?? { beforeCardCode: null });
}
