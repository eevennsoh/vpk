import type {
	BoardAgentSessionDropBounds,
	BoardAgentSessionDragPointer,
	BoardCardInsertion,
} from "./board-agent-session-drag";

/**
 * How far a card-gap insertion band reaches either side of the card edge it
 * straddles. Board cards are separated by a real gutter (4px on the default
 * column chrome, 8px on simple), which belongs to no card's rect, so the band
 * has to reach outward to cover the pixels the pointer actually aims at.
 */
export const BOARD_CARD_INSERTION_BAND_PX = 12;

export type BoardIssueDropSurface = "header" | "column" | "position";

/** Only the visible card stack and its trailing edge offer an ordered slot. */
export function resolveBoardIssueDropSurface(
	y: number,
	headerBottom: number,
	listBounds: Readonly<{ top: number; bottom: number }>,
	lastCardBottom: number | undefined,
): BoardIssueDropSurface {
	if (y <= headerBottom) return "header";
	if (lastCardBottom === undefined || y < listBounds.top || y > listBounds.bottom
		|| y > lastCardBottom + BOARD_CARD_INSERTION_BAND_PX) return "column";
	return "position";
}

/** Centre the 2px rule in the measured gap, rather than against either card. */
export function getBoardIssueInsertionLineTop(previousBottom: number, followingTop: number): number {
	return (previousBottom + followingTop) / 2 - 1;
}

export function pickBoardCardInsertionAtPoint(
	pointer: BoardAgentSessionDragPointer,
	zones: readonly Readonly<{
		bounds: BoardAgentSessionDropBounds;
		insertion: BoardCardInsertion;
	}>[],
): BoardCardInsertion | null {
	for (const zone of zones) {
		if (
			pointer.x >= zone.bounds.left
			&& pointer.x <= zone.bounds.right
			&& pointer.y >= zone.bounds.top
			&& pointer.y <= zone.bounds.bottom
		) {
			return zone.insertion;
		}
	}
	return null;
}

/**
 * Which edge of one board card the active insertion line belongs to, or
 * `undefined` when the insertion names some other card, some other column, or
 * nothing at all.
 *
 * Keyed on `(columnTitle, insertAtIndex)` rather than on the insertion's own
 * `relativeToCardCode` / `position`. A card's after-gap and the next card's
 * before-gap describe the same insertion and therefore share a drop-target key,
 * so which of the two survives the resolver's dedupe depends on DOM iteration
 * order. The index is the stable fact: gap `i` is the leading edge of card `i`.
 *
 * Only interior gaps exist (`parseBoardCardGapZones` drops gap `0` and gap
 * `cardCount`), so every seam a card can own is a `before` seam on a card that
 * has a predecessor. There is no trailing-edge case to resolve.
 */
export function resolveBoardCardInsertionPosition(
	insertion: BoardCardInsertion | null | undefined,
	card: Readonly<{ cardIndex: number; columnTitle: string }>,
): BoardCardInsertion["position"] | undefined {
	if (!insertion || insertion.columnTitle !== card.columnTitle) {
		return undefined;
	}
	return insertion.insertAtIndex === card.cardIndex && card.cardIndex > 0 ? "before" : undefined;
}

/**
 * The board analogue of the list view's `getInsertionLineClassName`
 * (`components/blocks/jira-list/jira-list-dnd.ts`): the 2px accent rule that
 * shows where an untracked agent session will land when it is dropped in the
 * gap between two kanban cards.
 *
 * Two exports rather than one, because the anchor and the paint live on
 * different owners:
 *
 * - `getBoardCardInsertionAnchorClassName` returns `relative` for the card
 *   wrapper. The wrapper is a flex item in the column stack and is NOT
 *   positioned at rest, so an absolutely positioned child would otherwise
 *   escape to some far ancestor. Shipping `relative` only while the line shows
 *   keeps every other card's paint order untouched.
 * - `BoardCardInsertionLine` is the line itself. It is absolutely positioned,
 *   so it adds no flex child, consumes no `gap` track, and changes no card's
 *   size — the gesture must show where the card *will* go without moving
 *   anything that is already on the board.
 *
 * Both are driven by the same `position`, so the wiring agent computes it once
 * per card and passes it to both.
 */
export function getBoardCardInsertionAnchorClassName(
	position: BoardCardInsertion["position"] | undefined,
): string | undefined {
	return position ? "relative" : undefined;
}

/**
 * Where the rule sits relative to the card it rides.
 *
 * - `gap` — an interior seam, with a real `gap` track between two cards. The
 *   rule centres itself in that track so it reads as belonging to the space
 *   between the cards rather than to either one of them. Every seam a card can
 *   own is this one; a column's outer edges get no seam.
 * - `edge` — the stand-in seam of a column that holds no cards, drawn flush at
 *   the top of the empty card list. There is no gap track to centre in, only
 *   the card list's own boundary, and the list stays a real scrollport for the
 *   whole gesture (dropping `overflow-y-auto` would make the browser discard
 *   its scroll offset and jump every scrolled column to its first card). The
 *   "+" marker is `position: fixed` and CSS-anchored so it can straddle the
 *   card list's left edge without being clipped by the scrollport.
 */
export type BoardCardInsertionSeam = "edge" | "gap";
