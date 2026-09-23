import type { SessionCohort } from "@/components/blocks/agent-session/session-cohort";
import type {
	JiraListAgentSessionDropIntent,
	JiraListInsertion,
} from "@/components/blocks/jira-list/jira-list-types";
import {
	getInsertionFromRowZone,
	getRowZone,
} from "../../../jira-list/jira-list-row-zone.js";
import {
	distanceFromPointToRect,
	// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
} from "./create-work-item-exclusive-proximity.ts";
import {
	resolveJiraLinkingNearness,
	// Leaf module, not the package barrel: the barrel pulls in the React
	// component and this file is loaded raw by a node:test suite.
	// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
} from "../../../jira-linking/lifecycle.ts";

export interface BoardAgentSessionDragPointer {
	x: number;
	y: number;
}

export interface BoardAgentSessionDropBounds {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export type BoardAgentSessionDragOrigin =
	| { kind: "attached"; sourceCardCode: string }
	| { kind: "detached"; sourceCardCode: string }
	| { kind: "untracked" };

/**
 * Where a new work item lands in a board column's card stack.
 *
 * The board analogue of `JiraListInsertion`. It carries the column because a
 * board index only means anything within one column, where a list index is
 * global to the single visible ordering.
 */
export interface BoardCardInsertion {
	columnTitle: string;
	insertAtIndex: number;
	position: "before" | "after";
	/** Null for the sole gap of an empty column, which has no neighbour to describe itself against. */
	relativeToCardCode: string | null;
}

/** Create wells accept drops only from the Untracked rail. */
export function isCreateZoneEligible(origin: BoardAgentSessionDragOrigin): boolean {
	switch (origin.kind) {
		case "untracked":
			return true;
		case "attached":
		case "detached":
			return false;
		default: {
			const exhaustive: never = origin;
			return exhaustive;
		}
	}
}

export type BoardCreateDropzoneDrag = "active" | "armed" | "idle";

/**
 * Open labeled create wells on every column only when this drag can actually
 * land in one. Attached and detached origins keep the resting plus button.
 */
export function resolveBoardCreateDropzoneDrag(
	transaction: BoardAgentSessionDragTransaction | null,
	columnTitle: string,
): BoardCreateDropzoneDrag {
	if (!transaction || !isCreateZoneEligible(transaction.origin)) {
		return "idle";
	}
	if (
		transaction.target?.kind === "create"
		&& transaction.target.columnTitle === columnTitle
	) {
		return "armed";
	}
	return "active";
}

export type BoardAgentSessionDropZone =
	| {
		bounds: BoardAgentSessionDropBounds;
		/** Retention must never reach beyond the visible card-list scrollport. */
		clip?: BoardAgentSessionDropBounds;
		insertion: BoardCardInsertion;
		kind: "card-gap";
	}
	| {
		bounds: BoardAgentSessionDropBounds;
		columnTitle: string;
		kind: "create";
		/** Collapsed cell used for approach feedback; the lane retains the drop bounds. */
		surfaceRect?: BoardAgentSessionDropBounds | null;
	}
	| {
		bounds: BoardAgentSessionDropBounds;
		cardCode: string;
		/**
		 * The card's agent shell rect in client coordinates — the surface the
		 * fusion field morphs into. Absent until the coordinator can measure the
		 * shell, so consumers must fall back to `bounds`.
		 */
		dockRect?: BoardAgentSessionDropBounds | null;
		/**
		 * The attach chin or agent-activity row the session actually lands in.
		 * Absent until that slot can be measured, so consumers fall back to the
		 * bottom of the shell.
		 */
		landRect?: BoardAgentSessionDropBounds | null;
		/**
		 * The card's own visible surface, without the agent shell's activity rows
		 * below it. Glow linking collapses its chip into the card body rather than
		 * into a strip at the lip, so it lands here. Absent until the surface can
		 * be measured, so consumers fall back to the shell.
		 */
		surfaceRect?: BoardAgentSessionDropBounds | null;
		kind: "issue";
	}
	| {
		bounds: BoardAgentSessionDropBounds;
		cardCode: string;
		kind: "unlink";
	}
	| {
		bounds: BoardAgentSessionDropBounds;
		issueKey: string;
		kind: "list-row";
		rowIndex: number;
	}
	| {
		bounds: BoardAgentSessionDropBounds;
		kind: "untracked";
	};

export type BoardAgentSessionDropTarget =
	| { cardCode: string; kind: "attach" }
	| { columnTitle: string; kind: "create" }
	| { insertion: BoardCardInsertion; kind: "create-board-gap" }
	| { insertion: JiraListInsertion; kind: "create-list" }
	| { cardCode: string; kind: "unlink" }
	| { kind: "untracked" };

export interface BoardAgentSessionDragTransaction<
	TSession extends Readonly<{ id: string }> = Readonly<{ id: string }>,
> {
	cohort: SessionCohort<TSession>;
	collapsedColumnProximity?: BoardCollapsedColumnProximity | null;
	origin: BoardAgentSessionDragOrigin;
	pointer: BoardAgentSessionDragPointer;
	proximity: BoardAgentSessionAttachProximity | null;
	target: BoardAgentSessionDropTarget | null;
}

/** Pointer-only travel has no board chrome until a target or approach changes. */
export function shouldPublishBoardAgentSessionDrag(
	previous: BoardAgentSessionDragTransaction | null,
	next: BoardAgentSessionDragTransaction,
): boolean {
	if (!previous || previous.cohort.key !== next.cohort.key || previous.origin !== next.origin) return true;
	if (previous.proximity || next.proximity) return true;
	if (previous.collapsedColumnProximity || next.collapsedColumnProximity) return true;
	const idleTarget = (target: BoardAgentSessionDropTarget | null) => target === null || target.kind === "untracked";
	return !idleTarget(previous.target) || !idleTarget(next.target) || previous.target?.kind !== next.target?.kind;
}

export type BoardAgentSessionDropAction =
	| { kind: "none" }
	| { kind: "create"; sessionIds: readonly [string, ...string[]]; columnTitle: string }
	| { kind: "create-board-gap"; insertion: BoardCardInsertion; sessionIds: readonly [string, ...string[]] }
	| { kind: "create-list"; insertion: JiraListInsertion; sessionIds: readonly [string, ...string[]] }
	| { kind: "detach"; sessionIds: readonly [string, ...string[]]; sourceCardCode: string }
	| { kind: "move"; sessionIds: readonly [string, ...string[]]; sourceCardCode: string; targetCardCode: string }
	| { kind: "attach"; sessionIds: readonly [string, ...string[]]; targetCardCode: string };

function dropActionSessionIds<TSession extends Readonly<{ id: string }>>(
	cohort: SessionCohort<TSession>,
): readonly [string, ...string[]] {
	const [first, ...rest] = cohort.members;
	return [first.id, ...rest.map((member) => member.id)];
}

function containsPointer(
	bounds: BoardAgentSessionDropBounds,
	pointer: BoardAgentSessionDragPointer,
): boolean {
	return pointer.x >= bounds.left
		&& pointer.x <= bounds.right
		&& pointer.y >= bounds.top
		&& pointer.y <= bounds.bottom;
}

function dropTargetKey(target: BoardAgentSessionDropTarget): string {
	switch (target.kind) {
		case "create":
			return `create:${target.columnTitle}`;
		// Index-scoped: a column has one key per gap, so the after-gap of card i
		// and the before-gap of card i+1 collapse into the single insertion they
		// both describe instead of competing as two targets.
		case "create-board-gap":
			return `create-board-gap:${target.insertion.columnTitle}:${target.insertion.insertAtIndex}`;
		case "create-list":
			return `create-list:${target.insertion.insertAtIndex}`;
		case "untracked":
			return "untracked";
		case "attach":
		case "unlink":
			return `${target.kind}:${target.cardCode}`;
		default: {
			const exhaustive: never = target;
			return exhaustive;
		}
	}
}

function toEligibleTarget(
	origin: BoardAgentSessionDragOrigin,
	zone: BoardAgentSessionDropZone,
	pointer: BoardAgentSessionDragPointer,
): BoardAgentSessionDropTarget | null {
	switch (zone.kind) {
		case "card-gap":
			// Same rule as the create well and the list-row boundary strips: only a
			// session that belongs to nothing yet can mint a work item.
			return isCreateZoneEligible(origin)
				? { insertion: zone.insertion, kind: "create-board-gap" }
				: null;
		case "create":
			return isCreateZoneEligible(origin)
				? { columnTitle: zone.columnTitle, kind: "create" }
				: null;
		case "untracked":
			return origin.kind === "attached" ? { kind: "untracked" } : null;
		case "unlink":
			return origin.kind === "attached" && zone.cardCode === origin.sourceCardCode
				? { cardCode: zone.cardCode, kind: "unlink" }
				: null;
		case "issue":
			if (origin.kind === "attached" && zone.cardCode === origin.sourceCardCode) {
				return null;
			}
			return { cardCode: zone.cardCode, kind: "attach" };
		case "list-row": {
			const rowHeight = zone.bounds.bottom - zone.bounds.top;
			const rowZone = getRowZone(pointer.y - zone.bounds.top, rowHeight);
			if (rowZone === "drag") {
				if (origin.kind === "attached" && zone.issueKey === origin.sourceCardCode) {
					return null;
				}
				return { cardCode: zone.issueKey, kind: "attach" };
			}
			if (origin.kind !== "untracked") {
				return null;
			}
			const insertion = getInsertionFromRowZone(rowZone, {
				issueKey: zone.issueKey,
				rowIndex: zone.rowIndex,
			});
			return insertion ? { insertion, kind: "create-list" } : null;
		}
		default: {
			const exhaustive: never = zone;
			return exhaustive;
		}
	}
}

export function parseListRowDropZone(
	issueKey: string | undefined,
	rowIndexRaw: string | undefined,
	bounds: BoardAgentSessionDropBounds,
): Extract<BoardAgentSessionDropZone, { kind: "list-row" }> | null {
	if (!issueKey || rowIndexRaw === undefined || rowIndexRaw === "") {
		return null;
	}

	const rowIndex = Number(rowIndexRaw);
	if (!Number.isInteger(rowIndex) || rowIndex < 0) {
		return null;
	}

	return {
		bounds,
		issueKey,
		kind: "list-row",
		rowIndex,
	};
}

function isCardOrdinal(raw: string | undefined): boolean {
	return raw !== undefined && raw !== "" && Number.isInteger(Number(raw)) && Number(raw) >= 0;
}

/**
 * Whether a gap index names a gutter *between* two cards.
 *
 * A column of `n` cards has `n + 1` slots, but only `1 … n - 1` sit between two
 * cards. Slot `0` is the column's leading edge and slot `n` its trailing edge;
 * neither is a gutter, so neither gets a seam.
 */
function isInteriorCardGap(insertAtIndex: number, cardCount: number): boolean {
	return insertAtIndex > 0 && insertAtIndex < cardCount;
}

/**
 * A card's rect with only newly added attach-preview growth subtracted.
 * Occupied slots replace existing rows and must pass zero; an empty activity
 * area contributes its entire new height, including vertical padding.
 *
 * The chin is the one part of a card whose presence depends on the drag itself:
 * it opens when attach proximity arms and closes when proximity reports
 * nothing. A gap band is outranking, so standing in one *nulls* proximity — and
 * if the band were measured off the live bottom edge, closing the chin would
 * move the band out from under the pointer, re-arm proximity, re-open the chin,
 * and move the band back. That two-cycle strobes the chin and jumps every card
 * below it on alternate frames.
 *
 * Subtracting the chin breaks the loop by construction: the band sits at the
 * same client y whether the chin is open or shut, so arming a gap can never
 * change the geometry the gap was resolved from. It also preserves the
 * self-stabilising promise `components/blocks/jira-issue/attach-proximity.ts`
 * documents — the chin still only ever grows the card's bottom edge toward an
 * approaching pointer.
 */
export function toChinFreeBoardCardBounds(
	bounds: BoardAgentSessionDropBounds,
	chinHeight: number,
): BoardAgentSessionDropBounds {
	return {
		// Browser DOMRect coordinates are inherited accessors; copy each value
		// explicitly so downstream gap-band copies retain all four edges.
		bottom: Number.isFinite(chinHeight) && chinHeight > 0
			? Math.max(bounds.bottom - chinHeight, bounds.top)
			: bounds.bottom,
		left: bounds.left,
		right: bounds.right,
		top: bounds.top,
	};
}

/**
 * The sole gap of a column with no cards.
 *
 * Card gaps normally ride the per-card wrappers, so an empty column emits none
 * and a drop there would arm nothing. The column's own card list stands in as
 * that one seam, which is the only producer of a null `relativeToCardCode`:
 * there is no neighbour to describe index 0 against.
 */
export function parseBoardEmptyColumnGapZone(
	columnTitle: string | undefined,
	bounds: BoardAgentSessionDropBounds,
): readonly Extract<BoardAgentSessionDropZone, { kind: "card-gap" }>[] {
	if (!columnTitle) {
		return [];
	}

	return [{
		bounds,
		insertion: {
			columnTitle,
			insertAtIndex: 0,
			position: "before",
			relativeToCardCode: null,
		},
		kind: "card-gap",
	}];
}

/**
 * The one or two insertion bands that belong to a single board card.
 *
 * The board's counterpart to `parseListRowDropZone` + `getInsertionFromRowZone`
 * in one call, because a board card owns both of its seams where a list row
 * tiles its own height into three contiguous strips. Cards are separated by a
 * real gutter, so each band straddles the card edge — it reaches `bandPx`
 * outward to cover the gutter the pointer actually aims at, and `bandPx` inward
 * so there is no dead pixel against the card itself.
 *
 * Only *interior* seams are emitted. A column's leading and trailing edges are
 * not gaps between two cards — they abut the column header and the create well,
 * which already own "add at the top" and "add at the bottom" — so a band there
 * would paint a rule against the column boundary rather than in a gutter. Gap
 * `0` and gap `cardCount` are therefore dropped, which leaves a single-card
 * column with no card seam at all.
 *
 * The two bands are clamped apart at the card's midpoint. A card shorter than
 * `2 * bandPx` would otherwise overlap its own before- and after-bands, and the
 * two distinct insertions under one pointer would resolve as ambiguous.
 *
 * `bounds` must be the card's chin-free rect (see `toChinFreeBoardCardBounds`),
 * never its live rect, or the band moves whenever the attach chin it outranks
 * opens or closes.
 *
 * Attribute-driven and defensive like `parseListRowDropZone` — missing or
 * non-ordinal input yields no zones rather than a half-built insertion. The
 * caller owns clipping the returned bounds to the column's scrollport.
 */
export function parseBoardCardGapZones(
	columnTitle: string | undefined,
	cardCode: string | undefined,
	cardIndexRaw: string | undefined,
	cardCountRaw: string | undefined,
	bounds: BoardAgentSessionDropBounds,
	bandPx: number,
): readonly Extract<BoardAgentSessionDropZone, { kind: "card-gap" }>[] {
	if (!columnTitle || !cardCode || !Number.isFinite(bandPx) || bandPx <= 0) {
		return [];
	}
	if (!isCardOrdinal(cardIndexRaw) || !isCardOrdinal(cardCountRaw)) {
		return [];
	}

	const cardIndex = Number(cardIndexRaw);
	const cardCount = Number(cardCountRaw);
	// `data-board-card-count` is the sanity check on the index: a card that claims
	// a slot its own column does not have would name an unreachable insertion.
	if (cardIndex >= cardCount) {
		return [];
	}

	const midpoint = (bounds.top + bounds.bottom) / 2;

	// Annotated rather than returned inline: an array literal that is the receiver
	// of `.filter` loses the contextual type the return annotation would give it,
	// widening `position` and `kind` to `string`.
	const seams: readonly Extract<BoardAgentSessionDropZone, { kind: "card-gap" }>[] = [
		{
			bounds: {
				...bounds,
				bottom: Math.min(bounds.top + bandPx, midpoint),
				top: bounds.top - bandPx,
			},
			insertion: {
				columnTitle,
				insertAtIndex: cardIndex,
				position: "before",
				relativeToCardCode: cardCode,
			},
			kind: "card-gap",
		},
		{
			bounds: {
				...bounds,
				bottom: bounds.bottom + bandPx,
				top: Math.max(bounds.bottom - bandPx, midpoint),
			},
			insertion: {
				columnTitle,
				insertAtIndex: cardIndex + 1,
				position: "after",
				relativeToCardCode: cardCode,
			},
			kind: "card-gap",
		},
	];

	return seams.filter((zone) => isInteriorCardGap(zone.insertion.insertAtIndex, cardCount));
}

export function toListSessionDropIntent(
	target: BoardAgentSessionDropTarget | null,
): JiraListAgentSessionDropIntent {
	if (!target) {
		return { kind: "none" };
	}

	switch (target.kind) {
		case "attach":
			return { kind: "attach", issueKey: target.cardCode };
		case "create-list":
			return { kind: "create", insertion: target.insertion };
		case "create":
		// A board gap names a column and an index inside it, which the single
		// flat list ordering cannot express. It is never a list intent.
		case "create-board-gap":
		case "unlink":
		case "untracked":
			return { kind: "none" };
		default: {
			const exhaustive: never = target;
			return exhaustive;
		}
	}
}

export function resolveBoardAgentSessionDropTarget(
	origin: BoardAgentSessionDragOrigin,
	pointer: BoardAgentSessionDragPointer,
	zones: readonly BoardAgentSessionDropZone[],
): BoardAgentSessionDropTarget | null {
	const targetsByKey = new Map<string, BoardAgentSessionDropTarget>();

	for (const zone of zones) {
		if (!containsPointer(zone.bounds, pointer)) {
			continue;
		}

		const target = toEligibleTarget(origin, zone, pointer);
		if (target) {
			targetsByKey.set(dropTargetKey(target), target);
		}
	}

	// The footer target can overlap the final issue because the card list reveals
	// overflow during a session drag. The explicit create well wins that overlap;
	// two create wells would still be ambiguous rather than choosing by DOM order.
	const createTargets = [...targetsByKey.values()].filter(
		(target): target is Extract<BoardAgentSessionDropTarget, { kind: "create" }> => (
			target.kind === "create"
		),
	);
	if (createTargets.length > 0) {
		return createTargets.length === 1 ? createTargets[0] : null;
	}

	// The Untracked rail overlays the trailing status columns. When an attached
	// session is over both, the rail wins so "drop to Untracked" is not treated
	// as an ambiguous attach. Untracked origins ignore this zone, so drops from
	// the rail still hit issue cards underneath.
	const untracked = targetsByKey.get("untracked");
	if (untracked) {
		return untracked;
	}

	// A gap band straddles the seam between two cards, so it always overlaps at
	// least one issue rect. The gap wins that overlap: the pointer is aimed
	// between the cards, not at either of them, and letting the issue compete
	// would make every seam ambiguous and resolve to nothing. Two *different*
	// gaps under one pointer stay ambiguous, same as two create wells — the
	// after-gap of one card and the before-gap of the next already share a key
	// because they describe the same insertion.
	const gapTargets = [...targetsByKey.values()].filter(
		(target): target is Extract<BoardAgentSessionDropTarget, { kind: "create-board-gap" }> => (
			target.kind === "create-board-gap"
		),
	);
	if (gapTargets.length > 0) {
		return gapTargets.length === 1 ? gapTargets[0] : null;
	}

	return targetsByKey.size === 1 ? [...targetsByKey.values()][0] : null;
}

/** Distance at which an issue card starts reacting to an approaching session. */
export const SESSION_ATTACH_PROXIMITY_RANGE_PX = 120;

export interface BoardAgentSessionAttachProximity {
	bounds: BoardAgentSessionDropBounds;
	cardCode: string;
	/** Euclidean px from the pointer to the issue rect; exactly 0 when inside. */
	distance: number;
	/** The card's agent shell rect, or null when it is not measured. */
	dockRect: BoardAgentSessionDropBounds | null;
	/** The attach chin or agent-activity row the session lands in. */
	landRect: BoardAgentSessionDropBounds | null;
	/** The card's visible surface, or null when it is not measured. */
	surfaceRect: BoardAgentSessionDropBounds | null;
	/** Smoothstep ramp: 1 at distance 0, 0 at or beyond the range. */
	nearness: number;
}

export interface BoardCollapsedColumnProximity {
	bounds: BoardAgentSessionDropBounds;
	columnTitle: string;
	distance: number;
	nearness: number;
}

function attachNearnessFromDistance(distance: number): number {
	return resolveJiraLinkingNearness(distance, SESSION_ATTACH_PROXIMITY_RANGE_PX);
}

/**
 * Whether a zone that outranks every issue card already owns this pointer.
 *
 * `resolveBoardAgentSessionDropTarget` short-circuits on eligible `create`,
 * `untracked` and `card-gap` zones because all three deliberately overlap issue
 * cards — the create well overlaps the final card in its column, the Untracked
 * rail overlays the trailing status columns, and a gap band straddles the seam
 * between two cards. Proximity has to honour the same precedence or a card that
 * cannot receive the drop still arms its full attach affordance: for a gap the
 * pointer is *inside* the card rect, so the card would read distance 0 and light
 * up completely while the insertion line is showing.
 */
function hasOutrankingDropZone(
	origin: BoardAgentSessionDragOrigin,
	pointer: BoardAgentSessionDragPointer,
	zones: readonly BoardAgentSessionDropZone[],
): boolean {
	for (const zone of zones) {
		if (zone.kind !== "card-gap" && zone.kind !== "create" && zone.kind !== "untracked") {
			continue;
		}
		if (!containsPointer(zone.bounds, pointer)) {
			continue;
		}
		if (toEligibleTarget(origin, zone, pointer)) {
			return true;
		}
	}
	return false;
}

/**
 * Continuous companion to `resolveBoardAgentSessionDropTarget`: the nearest
 * eligible issue card and how close the pointer is to it, so the board can
 * respond before the pointer is actually inside a rect.
 *
 * Advisory only in one direction. It never reports ambiguity — two cards under
 * the pointer resolve to one winner, ties preferring the leftmost card and then
 * the first registered zone, matching how `resolveExclusiveProximityWinner`
 * breaks its own ties. It does honour the discrete resolver's cross-zone
 * precedence, so a card underneath the Untracked rail or a create well never
 * advertises an attach the drop will not perform, and the card a session is
 * being dragged off never lights up.
 */
export function resolveBoardAgentSessionAttachProximity(
	origin: BoardAgentSessionDragOrigin,
	pointer: BoardAgentSessionDragPointer,
	zones: readonly BoardAgentSessionDropZone[],
): BoardAgentSessionAttachProximity | null {
	if (hasOutrankingDropZone(origin, pointer, zones)) {
		return null;
	}

	let winner: BoardAgentSessionAttachProximity | null = null;

	for (const zone of zones) {
		if (zone.kind !== "issue") {
			continue;
		}
		if (origin.kind === "attached" && zone.cardCode === origin.sourceCardCode) {
			continue;
		}

		const distance = distanceFromPointToRect(pointer, zone.bounds);
		if (distance >= SESSION_ATTACH_PROXIMITY_RANGE_PX) {
			continue;
		}

		const isCloser = winner === null || distance < winner.distance;
		const isTiePreferLeft = winner !== null
			&& distance === winner.distance
			&& zone.bounds.left < winner.bounds.left;
		if (isCloser || isTiePreferLeft) {
			winner = {
				bounds: zone.bounds,
				cardCode: zone.cardCode,
				distance,
				dockRect: zone.dockRect ?? null,
				landRect: zone.landRect ?? null,
				nearness: attachNearnessFromDistance(distance),
				surfaceRect: zone.surfaceRect ?? null,
			};
		}
	}

	return winner;
}

/** Cards and collapsed cells share one nearest-surface approach and distance ramp. */
function resolveBoardAgentSessionApproach(
	origin: BoardAgentSessionDragOrigin,
	pointer: BoardAgentSessionDragPointer,
	zones: readonly BoardAgentSessionDropZone[],
	target: BoardAgentSessionDropTarget | null,
): {
	collapsedColumnProximity: BoardCollapsedColumnProximity | null;
	proximity: BoardAgentSessionAttachProximity | null;
} {
	const proximity = target?.kind === "create-board-gap"
		? null
		: resolveBoardAgentSessionAttachProximity(origin, pointer, zones);
	let collapsedColumnProximity: BoardCollapsedColumnProximity | null = null;
	if (isCreateZoneEligible(origin) && (!target || target.kind === "create")) {
		for (const zone of zones) {
			if (zone.kind !== "create" || !zone.surfaceRect || (target && target.columnTitle !== zone.columnTitle)) continue;
			// Empty space below the cell still selects this lane at full strength.
			const distance = target ? 0 : distanceFromPointToRect(pointer, {
				...zone.surfaceRect,
				bottom: Math.max(zone.bounds.bottom, zone.surfaceRect.bottom),
			});
			if (distance >= SESSION_ATTACH_PROXIMITY_RANGE_PX) continue;
			if (collapsedColumnProximity === null
				|| distance < collapsedColumnProximity.distance
				|| (distance === collapsedColumnProximity.distance && zone.surfaceRect.left < collapsedColumnProximity.bounds.left)) {
				collapsedColumnProximity = {
					bounds: zone.surfaceRect,
					columnTitle: zone.columnTitle,
					distance,
					nearness: attachNearnessFromDistance(distance),
				};
			}
		}
	}
	if (collapsedColumnProximity && (!proximity
		|| collapsedColumnProximity.distance < proximity.distance
		|| (collapsedColumnProximity.distance === proximity.distance && collapsedColumnProximity.bounds.left < proximity.bounds.left))) {
		return { collapsedColumnProximity, proximity: null };
	}
	return { collapsedColumnProximity: null, proximity };
}

/**
 * One named card as a link target, with no pointer involved.
 *
 * Assigning an agent from the card's own menu links the same agent to the same
 * card a drag would, but nothing travels the board, so there is no distance to
 * resolve: the card is the winner by construction. Returning the same shape the
 * pointer resolver does is what lets the acknowledgement reuse the drop path
 * instead of growing a second one.
 */
export function toBoardAgentSessionCardProximity(
	zones: readonly BoardAgentSessionDropZone[],
	cardCode: string,
): BoardAgentSessionAttachProximity | null {
	for (const zone of zones) {
		if (zone.kind !== "issue" || zone.cardCode !== cardCode) {
			continue;
		}

		return {
			bounds: zone.bounds,
			cardCode: zone.cardCode,
			distance: 0,
			dockRect: zone.dockRect ?? null,
			landRect: zone.landRect ?? null,
			nearness: 1,
			surfaceRect: zone.surfaceRect ?? null,
		};
	}

	return null;
}

export function createBoardAgentSessionDragTransaction<
	TSession extends Readonly<{ id: string }>,
>(
	cohort: SessionCohort<TSession>,
	origin: BoardAgentSessionDragOrigin,
	pointer: BoardAgentSessionDragPointer,
	zones: readonly BoardAgentSessionDropZone[],
): BoardAgentSessionDragTransaction<TSession> {
	const target = resolveBoardAgentSessionDropTarget(origin, pointer, zones);
	return {
		cohort,
		origin,
		pointer,
		...resolveBoardAgentSessionApproach(origin, pointer, zones, target),
		target,
	};
}

const BOARD_GAP_EXIT_TOLERANCE_PX = 6;

export function updateBoardAgentSessionDragTransaction<
	TSession extends Readonly<{ id: string }>,
>(
	transaction: BoardAgentSessionDragTransaction<TSession>,
	pointer: BoardAgentSessionDragPointer,
	zones: readonly BoardAgentSessionDropZone[],
): BoardAgentSessionDragTransaction<TSession> {
	let target = resolveBoardAgentSessionDropTarget(transaction.origin, pointer, zones);
	const previous = transaction.target;
	// Enter at the exact seam; leave only after moving clearly beyond it.
	// Reuse live geometry so scrolling/removing a target cannot retain stale slots.
	// Explicit create wells and other gaps still take precedence immediately.
	if (
		previous?.kind === "create-board-gap"
		&& previous.insertion.relativeToCardCode !== null
		&& (!target || target.kind === "attach")
		&& !hasOutrankingDropZone(transaction.origin, pointer, zones)
	) {
		const retained = zones.some((zone) => zone.kind === "card-gap"
			&& zone.insertion.columnTitle === previous.insertion.columnTitle
			&& zone.insertion.insertAtIndex === previous.insertion.insertAtIndex
			&& (!zone.clip || containsPointer(zone.clip, pointer))
			&& distanceFromPointToRect(pointer, zone.bounds) <= BOARD_GAP_EXIT_TOLERANCE_PX);
		if (retained) target = previous;
	}
	return {
		...transaction,
		pointer,
		...resolveBoardAgentSessionApproach(transaction.origin, pointer, zones, target),
		target,
	};
}

export function cancelBoardAgentSessionDragTransaction<
	TSession extends Readonly<{ id: string }>,
>(
	transaction: BoardAgentSessionDragTransaction<TSession>,
): BoardAgentSessionDragTransaction<TSession> {
	// Proximity has to clear alongside the target, otherwise cancelling an
	// approach that never armed a target leaves the card's backdrop lit.
	return transaction.target || transaction.proximity || transaction.collapsedColumnProximity
		? { ...transaction, collapsedColumnProximity: null, proximity: null, target: null }
		: transaction;
}

export function resolveBoardAgentSessionDropAction(
	transaction: BoardAgentSessionDragTransaction,
): BoardAgentSessionDropAction {
	const { cohort, origin, target } = transaction;
	if (!target) {
		return { kind: "none" };
	}

	const sessionIds = dropActionSessionIds(cohort);

	switch (target.kind) {
		case "create":
			return isCreateZoneEligible(origin)
				? { columnTitle: target.columnTitle, kind: "create", sessionIds }
				: { kind: "none" };
		case "untracked":
			return origin.kind === "attached"
				? { kind: "detach", sessionIds, sourceCardCode: origin.sourceCardCode }
				: { kind: "none" };
		case "unlink":
			return origin.kind === "attached" && target.cardCode === origin.sourceCardCode
				? { kind: "detach", sessionIds, sourceCardCode: origin.sourceCardCode }
				: { kind: "none" };
		case "attach":
			if (origin.kind === "attached") {
				return target.cardCode !== origin.sourceCardCode
					? {
						kind: "move",
						sessionIds,
						sourceCardCode: origin.sourceCardCode,
						targetCardCode: target.cardCode,
					}
					: { kind: "none" };
			}
			return { kind: "attach", sessionIds, targetCardCode: target.cardCode };
		case "create-list":
			return origin.kind === "untracked"
				? { kind: "create-list", insertion: target.insertion, sessionIds }
				: { kind: "none" };
		case "create-board-gap":
			return origin.kind === "untracked"
				? { kind: "create-board-gap", insertion: target.insertion, sessionIds }
				: { kind: "none" };
		default: {
			const exhaustive: never = target;
			return exhaustive;
		}
	}
}
