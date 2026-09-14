import type { JiraKanbanColumnData } from "../../index";

export function getCommonSelectedCardStatus(
	columns: readonly JiraKanbanColumnData[],
	selectedCardCodes: ReadonlySet<string>,
): string | null {
	let commonStatus: string | null = null;
	let foundSelectedCard = false;

	for (const column of columns) {
		for (const card of column.cards) {
			if (!selectedCardCodes.has(card.code)) continue;
			if (!foundSelectedCard) {
				commonStatus = card.status ?? column.title;
				foundSelectedCard = true;
				continue;
			}
			if (commonStatus !== (card.status ?? column.title)) return null;
		}
	}

	return foundSelectedCard ? commonStatus : null;
}
