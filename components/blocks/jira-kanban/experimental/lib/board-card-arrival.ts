import type { JiraKanbanCreatedCardArrival } from "../hooks/use-created-card-arrival";

/**
 * How one card should play a live arrival.
 *
 * Every arriving card runs the same jira-creating entrance. A create-well drop
 * and a mid-column gap drop mint the same work item, so they must land the same
 * way — the seam a gap drop opens is exactly the `height: 0 -> auto` slot the
 * create entrance already animates.
 *
 * `appended` therefore no longer picks an entrance. It stays a scroll concern
 * (a gap drop lands under the pointer and must not yank the column) and it
 * does not affect the card's appearance.
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

	return {
		arrivalId: arrival.id,
		entering: true,
		deferred: arrival.deferred === true,
		final: arrival.cardCodes.at(-1) === cardCode,
	};
}
