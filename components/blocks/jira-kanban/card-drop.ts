import type { JiraKanbanColumnData } from "./index";

export interface JiraKanbanCardDropTarget {
	status?: string;
	/** Stable anchor in the destination; null means after its last card. */
	beforeCardCode?: string | null;
}

export function moveJiraKanbanCardsToStatus(
	columns: readonly JiraKanbanColumnData[],
	cardCodes: readonly string[],
	status: string,
): JiraKanbanColumnData[] {
	const column = columns.find((candidate) => (candidate.statuses ?? [candidate.title]).includes(status));
	return column ? moveJiraKanbanCardsToDropTarget(columns, cardCodes, column.title, { status }) : [...columns];
}

export function moveJiraKanbanCardsToDropTarget(
	columns: readonly JiraKanbanColumnData[],
	cardCodes: readonly string[],
	columnTitle: string,
	target: JiraKanbanCardDropTarget,
): JiraKanbanColumnData[] {
	const destination = columns.find((column) => column.title === columnTitle);
	const status = target.status ?? columnTitle;
	if (!destination || !(destination.statuses ?? [columnTitle]).includes(status)) return [...columns];
	const codes = new Set(cardCodes);
	const moving = columns.flatMap((column) => column.cards.filter((card) => codes.has(card.code)));
	const remaining = destination.cards.filter((card) => !codes.has(card.code));
	const index = target.beforeCardCode === null
		? remaining.length
		: target.beforeCardCode === undefined ? 0 : remaining.findIndex((card) => card.code === target.beforeCardCode);
	if (!moving.length || index < 0) return [...columns];
	const cards = [...remaining.slice(0, index), ...moving.map((card) => ({ ...card, status })), ...remaining.slice(index)];
	return columns.map((column) => {
		const next = column === destination ? cards : column.cards.filter((card) => !codes.has(card.code));
		return next.length === column.cards.length && column !== destination ? column : { ...column, cards: next, count: next.length };
	});
}
