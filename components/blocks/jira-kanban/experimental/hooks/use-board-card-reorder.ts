"use client";

import { useState } from "react";

import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { JiraIssueMoreMenuActions, JiraIssueReorderActions } from "@/components/blocks/jira-issue/more-menu";
import type { IssueCardMove } from "./use-issue-card-drop-arrival";

/**
 * Keyboard and assistive-technology reorder within a column, the alternative to dragging:
 * Move up / Move down actions for a card's menu, each move announced through a live region.
 */
export function useBoardCardReorder(onCardsMove: ((move: IssueCardMove) => void) | undefined) {
	const [announcement, setAnnouncement] = useState("");

	function getReorderActions(card: JiraKanbanCardData, column: JiraKanbanColumnData): JiraIssueReorderActions | undefined {
		if (!onCardsMove) return undefined;
		const index = column.cards.findIndex((candidate) => candidate.code === card.code);
		const moveBefore = (beforeCardCode: string | null, position: number) => () => {
			onCardsMove({ cardCodes: [card.code], columnTitle: column.title, target: { status: card.status, beforeCardCode } });
			setAnnouncement(`Moved ${card.code} to position ${position} of ${column.cards.length} in ${column.title}.`);
		};
		return {
			onMoveUp: index > 0 ? moveBefore(column.cards[index - 1].code, index) : undefined,
			onMoveDown: index >= 0 && index < column.cards.length - 1 ? moveBefore(column.cards[index + 2]?.code ?? null, index + 2) : undefined,
		};
	}

	/** A card's More actions: the removal set when the board removes cards, plus reorder when it reorders; undefined when neither. */
	function getMoreMenuActions(removal: JiraIssueMoreMenuActions | undefined, card: JiraKanbanCardData, column: JiraKanbanColumnData): JiraIssueMoreMenuActions | undefined {
		const reorder = getReorderActions(card, column);
		if (!reorder) return removal;
		return removal ? { ...removal, reorder } : { reorder };
	}

	return { announcement, getMoreMenuActions };
}
