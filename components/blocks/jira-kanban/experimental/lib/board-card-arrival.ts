import type { JiraKanbanCreatedCardArrival } from "../hooks/use-created-card-arrival";
import type { JiraKanbanColumnData } from "../../index";

export interface IssueCardDropArrival {
	readonly id: number;
	readonly columnTitle: string;
	readonly before: readonly { code: string; columnTitle: string; index: number; status: string }[];
	readonly animatedCardCodes?: readonly string[];
	readonly pendingCardCodes?: readonly string[];
}

/** One grabbed face represents the entire selection's drop. */
export function resolveVisibleIssueDropCodes(codes: readonly string[], grabbed: string): string[] {
	return codes.includes(grabbed) ? [grabbed] : codes.slice(0, 1);
}

export function captureIssueCardDropArrival(columns: readonly JiraKanbanColumnData[], codes: readonly string[], columnTitle: string, id: number): IssueCardDropArrival {
	const moving = new Set(codes);
	return { id, columnTitle, before: columns.flatMap((column) => column.cards.flatMap((card, index) => moving.has(card.code)
		? [{ code: card.code, columnTitle: column.title, index, status: card.status ?? column.title }]
		: [])) };
}

/** Only animate a committed position/status change, never a rejected or no-op drop. */
export function resolveIssueCardDropArrival(drop: IssueCardDropArrival | null, columns: readonly JiraKanbanColumnData[]): JiraKanbanCreatedCardArrival | undefined {
	if (!drop) return undefined;
	const column = columns.find((candidate) => candidate.title === drop.columnTitle);
	if (!column) return undefined;
	const changed = drop.before.some((before) => {
		const index = column.cards.findIndex((card) => card.code === before.code);
		return index >= 0 && (before.columnTitle !== column.title || before.index !== index || before.status !== (column.cards[index].status ?? column.title));
	});
	if (!changed) return undefined;
	const codes = new Set(drop.before.map((card) => card.code));
	const cardCodes = column.cards.filter((card) => codes.has(card.code)).map((card) => card.code);
	return {
		id: drop.id, columnTitle: column.title, cardCodes, appended: false,
		...(drop.animatedCardCodes ? { animatedCardCodes: drop.animatedCardCodes.filter((code) => cardCodes.includes(code)) } : {}),
		...(drop.pendingCardCodes ? { pendingCardCodes: drop.pendingCardCodes.filter((code) => cardCodes.includes(code)) } : {}),
	};
}

/**
 * How one card should play a live arrival.
 *
 * Animated cards run the same jira-creating entrance. A create-well drop
 * and a mid-column gap drop mint the same work item, so they must land the same
 * way — the seam a gap drop opens is exactly the `height: 0 -> auto` slot the
 * create entrance already animates.
 *
 * `appended` therefore no longer picks an entrance. It stays a scroll concern
 * (a gap drop lands under the pointer and must not yank the column) and it
 * does not affect the card's appearance.
 * One issue-drop flight represents the full cohort; every selected card still moves.
 */
export interface BoardCardArrival {
	/** Live arrival id, published for the column's bottom-reveal observer. */
	readonly arrivalId: number | undefined;
	/** Play the jira-creating entrance for this card. */
	readonly entering: boolean;
	/** A receipt still owns the landing geometry; the card must not open its slot yet. */
	readonly deferred: boolean;
	/** This card closes the arrival and owns the completion callback. */
	readonly final: boolean;
}

const CARD_AT_REST: BoardCardArrival = {
	arrivalId: undefined,
	entering: false,
	deferred: false,
	final: false,
};

export function resolveBoardCardArrival(
	arrival: JiraKanbanCreatedCardArrival | undefined,
	cardCode: string,
): BoardCardArrival {
	if (arrival === undefined || !arrival.cardCodes.includes(cardCode)) {
		return CARD_AT_REST;
	}

	const animated = arrival.animatedCardCodes ?? arrival.cardCodes;
	return {
		arrivalId: arrival.id,
		entering: animated.includes(cardCode),
		deferred: arrival.deferred === true,
		final: animated.at(-1) === cardCode,
	};
}
