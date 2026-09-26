import type { JiraKanbanColumnData } from "../../index";
import { moveJiraKanbanCardsToStatus } from "../../card-drop";

/** Stable demo randomization: rerenders, filters and moves never reroll a card. */
export function withAutoArrangeDestinations(columns: readonly JiraKanbanColumnData[]): JiraKanbanColumnData[] {
	return columns.map((column) => {
		const statuses = columns.filter((candidate) => candidate.title !== column.title).flatMap((candidate) => candidate.statuses ?? [candidate.title]);
		return { ...column, cards: column.cards.map((card) => {
			if (card.autoArrangeStatus || !statuses.length) return card;
			let hash = 2166136261;
			for (const character of card.code) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
			return { ...card, autoArrangeStatus: statuses[(hash >>> 0) % statuses.length] };
		}) };
	});
}

export function getAutoArrangePlan(columns: readonly JiraKanbanColumnData[], codes: ReadonlySet<string>) {
	return columns.flatMap((column) => column.cards.flatMap((card) => {
		const status = card.autoArrangeStatus;
		if (!codes.has(card.code) || !status) return [];
		const destination = columns.find((candidate) => (candidate.statuses ?? [candidate.title]).includes(status));
		if (!destination || (column === destination && (card.status ?? column.title) === status)) return [];
		return [{ code: card.code, columnTitle: destination.title, status }];
	}));
}

export function autoArrangeCards(columns: readonly JiraKanbanColumnData[], codes: ReadonlySet<string>): JiraKanbanColumnData[] {
	const plan = getAutoArrangePlan(columns, codes);
	return [...new Set(plan.map((move) => move.status))].reduce((current, status) => (
		moveJiraKanbanCardsToStatus(current, plan.filter((move) => move.status === status).map((move) => move.code), status)
	), [...columns]);
}
