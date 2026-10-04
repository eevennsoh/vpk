import { DECK_VISIBLE_MAX } from "@/components/blocks/agent-session/session-drag-deck";
import type { JiraKanbanCreatedCardArrival } from "../hooks/use-created-card-arrival";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban/index";

export interface IssueCardDropArrival {
	readonly id: number;
	readonly columnTitle: string;
	readonly before: readonly { code: string; columnTitle: string; index: number; status: string }[];
	readonly animatedCardCodes?: readonly string[];
	readonly pendingCardCodes?: readonly string[];
	/** The issues that fly for this cohort; see `cascadeLeadCardCodes`. */
	readonly leadCardCodes?: readonly string[];
	/** A deck landing holds every card below it until the deck lands. */
	readonly holdBelowLeads?: boolean;
}

/** One grabbed face flies for the entire selection's drop. */
export function resolveVisibleIssueDropCodes(codes: readonly string[], grabbed: string): string[] {
	return codes.includes(grabbed) ? [grabbed] : codes.slice(0, 1);
}

/** duration-xxshort: the gap between neighbouring cards in a landing cascade. */
export const ISSUE_DROP_CASCADE_STAGGER_S = 0.05;
/**
 * Cascade steps before the stagger stops growing. A column shows roughly three
 * to five cards, so cards past the fold join the last step instead of adding
 * time nobody can see. Every step (at most 150ms) starts before the shortest
 * possible flight lands, so a single dropped lead always enters, and finishes, last.
 */
export const ISSUE_DROP_CASCADE_MAX_STEPS = 3;
/**
 * Steps after a landed deck. The deck fills the top three slots, so at most the
 * next card peeks above the fold: it follows the deck by one step and every
 * card past it joins that step, keeping the whole landing inside ~700ms.
 */
export const ISSUE_DROP_AFTER_DECK_MAX_STEPS = 1;

/**
 * Auto arrange and host moves land a deck: the drag deck's visible depth of
 * cards, taken from the top of the destination, so the stack drops into the
 * top of the column exactly like an auto arrange into a sparse column.
 */
export function resolveIssueDropDeck(destinationOrderedCodes: readonly string[]): string[] {
	return destinationOrderedCodes.slice(0, DECK_VISIBLE_MAX);
}

/**
 * A landed cohort cascades top to bottom in slot order.
 * - A dropped traveller (one lead) is off the cascade clock: the other cards
 *   step down from the commit and the lead enters when it lands in its slot.
 * - A deck fills the top slots on landing; the cards below it hold for that
 *   landing and then continue the cascade downward from the deck.
 */
export function getIssueDropCascadeDelayS(arrival: Readonly<Pick<JiraKanbanCreatedCardArrival, "cardCodes" | "cascadeLeadCardCodes" | "cascadeHoldsBelowLeads">>, cardCode: string): number {
	const index = arrival.cardCodes.indexOf(cardCode);
	const leads = arrival.cascadeLeadCardCodes ?? [];
	if (index < 0 || leads.includes(cardCode)) return 0;
	const lowestLead = Math.max(-1, ...leads.map((code) => arrival.cardCodes.indexOf(code)));
	if (arrival.cascadeHoldsBelowLeads && lowestLead >= 0 && index > lowestLead) {
		return Math.min(index - lowestLead, ISSUE_DROP_AFTER_DECK_MAX_STEPS) * ISSUE_DROP_CASCADE_STAGGER_S;
	}
	return Math.min(index, ISSUE_DROP_CASCADE_MAX_STEPS) * ISSUE_DROP_CASCADE_STAGGER_S;
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
	// Entrances follow destination slot order, top to bottom.
	const animated = drop.animatedCardCodes ? cardCodes.filter((code) => drop.animatedCardCodes?.includes(code)) : undefined;
	const leads = drop.leadCardCodes?.filter((code) => cardCodes.includes(code));
	const pending = drop.pendingCardCodes?.filter((code) => cardCodes.includes(code));
	// While any of a deck is in the air, the cards below it hold with it.
	const lowestLead = leads?.length ? Math.max(...leads.map((code) => cardCodes.indexOf(code))) : -1;
	const held = drop.holdBelowLeads && pending && lowestLead >= 0 && leads?.some((code) => pending.includes(code))
		? [...new Set([...pending, ...cardCodes.slice(lowestLead + 1)])] : pending;
	return {
		id: drop.id, columnTitle: column.title, cardCodes, appended: false,
		...(animated ? { animatedCardCodes: animated } : {}),
		...(held ? { pendingCardCodes: held } : {}),
		...(leads?.length ? { cascadeLeadCardCodes: leads, ...(drop.holdBelowLeads ? { cascadeHoldsBelowLeads: true } : {}) } : {}),
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
		// A dropped traveller lands after every cascade step starts, so it finishes
		// last. Behind a deck, the bottom card starts last.
		final: arrival.cascadeLeadCardCodes?.length && !arrival.cascadeHoldsBelowLeads
			? arrival.cascadeLeadCardCodes.at(-1) === cardCode
			: animated.at(-1) === cardCode,
	};
}
