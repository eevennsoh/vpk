const assert = require("node:assert/strict");
const test = require("node:test");

const {
	cancelBoardAgentSessionDragTransaction,
	createBoardAgentSessionDragTransaction,
	parseBoardCardGapZones,
	parseBoardEmptyColumnGapZone,
	resolveBoardAgentSessionAttachProximity,
	resolveBoardAgentSessionDropAction,
	resolveBoardAgentSessionDropTarget,
	toChinFreeBoardCardBounds,
	toListSessionDropIntent,
	updateBoardAgentSessionDragTransaction,
} = require("./board-agent-session-drag.ts");
const {
	BOARD_CARD_INSERTION_BAND_PX,
	pickBoardCardInsertionAtPoint,
} = require("./board-card-insertion.ts");

function session(id = "review-agent") {
	return { id, label: "Review Agent", name: "Review Agent", state: "working" };
}

function cohortOf(member = session()) {
	return { key: member.id, members: [member] };
}

// Two stacked cards in one column, separated by the 8px gutter the card list
// puts between flex children, plus the column's footer create well below them.
const GAP_BAND_PX = 12;
const GAP_COLUMN = "In progress";
const CARD_A = {
	bounds: { bottom: 100, left: 0, right: 200, top: 0 },
	cardCode: "PAY-118",
	kind: "issue",
};
const CARD_B = {
	bounds: { bottom: 208, left: 0, right: 200, top: 108 },
	cardCode: "PAY-107",
	kind: "issue",
};
const GAP_CREATE_WELL = {
	bounds: { bottom: 260, left: 0, right: 200, top: 200 },
	columnTitle: GAP_COLUMN,
	kind: "create",
};
const CARD_A_GAPS = parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "0", "2", CARD_A.bounds, GAP_BAND_PX);
const CARD_B_GAPS = parseBoardCardGapZones(GAP_COLUMN, "PAY-107", "1", "2", CARD_B.bounds, GAP_BAND_PX);
const GAP_ZONES = [CARD_A, CARD_B, ...CARD_A_GAPS, ...CARD_B_GAPS];

test("an armed gap survives small pointer jitter but releases to deliberate card movement", () => {
	let drag = createBoardAgentSessionDragTransaction(cohortOf(), { kind: "untracked" }, { x: 100, y: 104 }, GAP_ZONES);
	for (const y of [119, 121, 120, 123, 119, 121]) {
		drag = updateBoardAgentSessionDragTransaction(drag, { x: 100, y }, GAP_ZONES);
		assert.equal(drag.target?.kind, "create-board-gap");
		assert.equal(drag.proximity, null);
	}
	assert.equal(resolveBoardAgentSessionDropAction(drag).kind, "create-board-gap");
	drag = updateBoardAgentSessionDragTransaction(drag, { x: 100, y: 140 }, GAP_ZONES);
	assert.deepEqual(drag.target, { kind: "attach", cardCode: "PAY-107" });
	assert.equal(drag.proximity?.cardCode, "PAY-107");
	// Re-entry still needs the original band; the release margin does not grow it.
	drag = updateBoardAgentSessionDragTransaction(drag, { x: 100, y: 123 }, GAP_ZONES);
	assert.equal(drag.target?.kind, "attach");
});

test("gap retention uses live zones and never overrides a create well or scrollport clip", () => {
	const drag = createBoardAgentSessionDragTransaction(cohortOf(), { kind: "untracked" }, { x: 100, y: 104 }, GAP_ZONES);
	assert.equal(updateBoardAgentSessionDragTransaction(drag, { x: 100, y: 104 }, []).target, null);
	const well = { ...GAP_CREATE_WELL, bounds: { left: 0, right: 200, top: 121, bottom: 260 } };
	assert.equal(updateBoardAgentSessionDragTransaction(drag, { x: 100, y: 123 }, [...GAP_ZONES, well]).target?.kind, "create");
	const clippedZones = GAP_ZONES.map((zone) => zone.kind === "card-gap"
		? { ...zone, clip: { left: 0, right: 200, top: 0, bottom: 120 } }
		: zone);
	assert.equal(updateBoardAgentSessionDragTransaction(drag, { x: 100, y: 123 }, clippedZones).target?.kind, "attach");
	const competingGap = { ...CARD_B_GAPS[0], insertion: { ...CARD_B_GAPS[0].insertion, insertAtIndex: 2 } };
	assert.equal(updateBoardAgentSessionDragTransaction(drag, { x: 100, y: 104 }, [...GAP_ZONES, competingGap]).target, null);
});

test("only interior seams are published, and a card's two bands clamp apart at its midpoint", () => {
	// The first card of the column owns its trailing seam only: gap 0 is the
	// column's leading edge, not a gutter between two cards.
	assert.deepEqual(CARD_A_GAPS, [
		{
			bounds: { bottom: 112, left: 0, right: 200, top: 88 },
			insertion: {
				columnTitle: GAP_COLUMN,
				insertAtIndex: 1,
				position: "after",
				relativeToCardCode: "PAY-118",
			},
			kind: "card-gap",
		},
	]);
	// The last card owns its leading seam only — the same gap, from the other side.
	assert.deepEqual(CARD_B_GAPS, [
		{
			bounds: { bottom: 120, left: 0, right: 200, top: 96 },
			insertion: {
				columnTitle: GAP_COLUMN,
				insertAtIndex: 1,
				position: "before",
				relativeToCardCode: "PAY-107",
			},
			kind: "card-gap",
		},
	]);

	// A middle card owns both seams. Shorter than two bands, it would otherwise
	// overlap them and arm two competing insertions from a single pointer.
	const [shortBefore, shortAfter] = parseBoardCardGapZones(
		GAP_COLUMN,
		"PAY-140",
		"1",
		"3",
		{ bottom: 10, left: 0, right: 200, top: 0 },
		GAP_BAND_PX,
	);
	assert.equal(shortBefore.insertion.insertAtIndex, 1);
	assert.equal(shortBefore.bounds.bottom, 5);
	assert.equal(shortAfter.insertion.insertAtIndex, 2);
	assert.equal(shortAfter.bounds.top, 5);
});

test("the column's outer edges publish no gap at all", () => {
	const bounds = { bottom: 100, left: 0, right: 200, top: 0 };

	// The only card of a one-card column has no gutter on either side.
	assert.deepEqual(parseBoardCardGapZones(GAP_COLUMN, "PAY-140", "0", "1", bounds, GAP_BAND_PX), []);
	// Gap 0 never appears, however many cards follow it.
	assert.deepEqual(
		parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "0", "3", bounds, GAP_BAND_PX)
			.map((zone) => zone.insertion.insertAtIndex),
		[1],
	);
	// Neither does the tail gap at `cardCount`.
	assert.deepEqual(
		parseBoardCardGapZones(GAP_COLUMN, "PAY-107", "2", "3", bounds, GAP_BAND_PX)
			.map((zone) => zone.insertion.insertAtIndex),
		[2],
	);
});

test("malformed board card attributes yield no gap zones", () => {
	const bounds = { bottom: 100, left: 0, right: 200, top: 0 };
	assert.deepEqual(parseBoardCardGapZones(undefined, "PAY-118", "0", "2", bounds, GAP_BAND_PX), []);
	assert.deepEqual(parseBoardCardGapZones(GAP_COLUMN, undefined, "0", "2", bounds, GAP_BAND_PX), []);
	assert.deepEqual(parseBoardCardGapZones(GAP_COLUMN, "PAY-118", undefined, "2", bounds, GAP_BAND_PX), []);
	assert.deepEqual(parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "", "2", bounds, GAP_BAND_PX), []);
	assert.deepEqual(parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "1.5", "2", bounds, GAP_BAND_PX), []);
	assert.deepEqual(parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "card", "2", bounds, GAP_BAND_PX), []);
	assert.deepEqual(parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "0", undefined, bounds, GAP_BAND_PX), []);
	// An index its own column cannot hold names an unreachable insertion.
	assert.deepEqual(parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "2", "2", bounds, GAP_BAND_PX), []);
	assert.deepEqual(parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "0", "2", bounds, 0), []);
});

test("an untracked pointer in a gap band creates in that column at that index", () => {
	const origin = { kind: "untracked" };

	// Inside the first card's rect but within its trailing band: the seam wins
	// the overlap it always has with the card it is measured against.
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 95 }, GAP_ZONES),
		{
			insertion: {
				columnTitle: GAP_COLUMN,
				insertAtIndex: 1,
				position: "after",
				relativeToCardCode: "PAY-118",
			},
			kind: "create-board-gap",
		},
	);

	// Mid-gutter both neighbouring bands apply. They describe the same insertion
	// and share a key, so which side registered last is not asserted.
	const sharedEdge = resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 104 }, GAP_ZONES);
	assert.equal(sharedEdge?.kind, "create-board-gap");
	assert.equal(sharedEdge?.insertion.insertAtIndex, 1);
	assert.equal(sharedEdge?.insertion.columnTitle, GAP_COLUMN);

	// The column's leading edge is not a gutter: the top of the first card
	// attaches like any other part of it rather than arming an insertion.
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 5 }, GAP_ZONES),
		{ cardCode: "PAY-118", kind: "attach" },
	);

	// The card body itself is untouched: only the seams create.
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 50 }, GAP_ZONES),
		{ cardCode: "PAY-118", kind: "attach" },
	);
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 160 }, GAP_ZONES),
		{ cardCode: "PAY-107", kind: "attach" },
	);
});

test("card-gap create is untracked-only and other origins keep attaching underneath", () => {
	for (const origin of [
		{ kind: "attached", sourceCardCode: "PAY-121" },
		{ kind: "detached", sourceCardCode: "PAY-121" },
	]) {
		// The bare gutter belongs to no card, so an ineligible origin gets nothing.
		assert.equal(resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 104 }, GAP_ZONES), null);
		// Over a band that overlaps a card, that card still resolves normally.
		assert.deepEqual(
			resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 95 }, GAP_ZONES),
			{ cardCode: "PAY-118", kind: "attach" },
		);
		assert.deepEqual(
			resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 50 }, GAP_ZONES),
			{ cardCode: "PAY-118", kind: "attach" },
		);
	}
});

test("the column's tail belongs to the footer create well, not to a gap", () => {
	const zones = [...GAP_ZONES, GAP_CREATE_WELL];
	const origin = { kind: "untracked" };

	// "Append to this column" has one owner now: the explicit well the user sees.
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 210 }, zones),
		{ columnTitle: GAP_COLUMN, kind: "create" },
	);
	// Just above the well, the last card's trailing edge is plain card surface.
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 198 }, zones),
		{ cardCode: "PAY-107", kind: "attach" },
	);
});

test("a gap band is measured from the card's chin-free bottom, so arming one cannot move it", () => {
	// The attach chin is the one part of a card whose height depends on the drag.
	// A gap outranks attach proximity, so standing in one closes the chin; if the
	// band tracked the live bottom edge it would slide out from under the pointer,
	// re-arm proximity, re-open the chin and strobe.
	const chinClosed = { bottom: 100, left: 0, right: 200, top: 0 };
	const chinOpen = { bottom: 132, left: 0, right: 200, top: 0 };

	assert.deepEqual(toChinFreeBoardCardBounds(chinClosed, 0), chinClosed);
	assert.deepEqual(toChinFreeBoardCardBounds(chinOpen, 32), chinClosed);
	// Defensive: a chin taller than the card can never invert the rect.
	assert.deepEqual(toChinFreeBoardCardBounds(chinClosed, 400).bottom, 0);

	// A middle card, so both of its bands are in the comparison.
	const chinOpenZones = parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "1", "3", toChinFreeBoardCardBounds(chinOpen, 32), GAP_BAND_PX);
	assert.equal(chinOpenZones.length, 2);
	assert.deepEqual(
		chinOpenZones,
		parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "1", "3", toChinFreeBoardCardBounds(chinClosed, 0), GAP_BAND_PX),
	);
});

test("browser rectangle accessors preserve horizontal gap bounds with and without preview growth", () => {
	for (const chinHeight of [0, 32]) {
		// DOMRect coordinates are inherited accessors, so spreading the rect loses them.
		const browserRect = Object.create({
			get bottom() { return 100 + chinHeight; },
			get left() { return 0; },
			get right() { return 200; },
			get top() { return 0; },
		});
		assert.deepEqual(Object.keys(browserRect), []);
		const zones = parseBoardCardGapZones(GAP_COLUMN, "PAY-118", "0", "2",
			toChinFreeBoardCardBounds(browserRect, chinHeight), GAP_BAND_PX);
		assert.deepEqual(zones[0].bounds, { bottom: 112, left: 0, right: 200, top: 88 });
		assert.deepEqual(resolveBoardAgentSessionDropTarget({ kind: "untracked" }, { x: 100, y: 104 }, zones), {
			insertion: zones[0].insertion,
			kind: "create-board-gap",
		});
	}
});

test("an empty column publishes its one gap and creates at index 0", () => {
	const bounds = { bottom: 300, left: 0, right: 200, top: 0 };
	const zones = parseBoardEmptyColumnGapZone("Done", bounds);

	assert.deepEqual(zones, [{
		bounds,
		insertion: {
			columnTitle: "Done",
			insertAtIndex: 0,
			position: "before",
			relativeToCardCode: null,
		},
		kind: "card-gap",
	}]);
	assert.deepEqual(parseBoardEmptyColumnGapZone(undefined, bounds), []);

	assert.deepEqual(
		resolveBoardAgentSessionDropTarget({ kind: "untracked" }, { x: 100, y: 150 }, zones),
		{ insertion: zones[0].insertion, kind: "create-board-gap" },
	);
	// Still untracked-only: an attached origin sees nothing over an empty column.
	assert.equal(
		resolveBoardAgentSessionDropTarget(
			{ kind: "attached", sourceCardCode: "PAY-121" },
			{ x: 100, y: 150 },
			zones,
		),
		null,
	);
});

test("card-gap drops carry the insertion and never leak a list intent", () => {
	const transaction = createBoardAgentSessionDragTransaction(
		cohortOf(session()),
		{ kind: "untracked" },
		{ x: 100, y: 95 },
		GAP_ZONES,
	);
	const insertion = {
		columnTitle: GAP_COLUMN,
		insertAtIndex: 1,
		position: "after",
		relativeToCardCode: "PAY-118",
	};

	assert.deepEqual(
		resolveBoardAgentSessionDropAction(transaction),
		{ insertion, kind: "create-board-gap", sessionIds: ["review-agent"] },
	);
	assert.deepEqual(toListSessionDropIntent(transaction.target), { kind: "none" });

	const cancelled = cancelBoardAgentSessionDragTransaction(transaction);
	assert.equal(cancelled.target, null);
	assert.deepEqual(resolveBoardAgentSessionDropAction(cancelled), { kind: "none" });
});

test("attach proximity reports nothing while the pointer sits in a gap band", () => {
	const origin = { kind: "untracked" };

	// The pointer is inside PAY-118's rect, so without the precedence fix the
	// card would read distance 0 and light its attach affordance fully.
	assert.equal(resolveBoardAgentSessionAttachProximity(origin, { x: 100, y: 95 }, GAP_ZONES), null);

	// The column's leading edge is no longer a gap, so the top of the first card
	// arms attach like the rest of its surface.
	const onLeadingEdge = resolveBoardAgentSessionAttachProximity(origin, { x: 100, y: 5 }, GAP_ZONES);
	assert.equal(onLeadingEdge.cardCode, "PAY-118");
	assert.equal(onLeadingEdge.nearness, 1);

	const onCard = resolveBoardAgentSessionAttachProximity(origin, { x: 100, y: 50 }, GAP_ZONES);
	assert.equal(onCard.cardCode, "PAY-118");
	assert.equal(onCard.nearness, 1);

	// Gaps are ineligible for attached origins, so the card underneath still arms.
	const attached = resolveBoardAgentSessionAttachProximity(
		{ kind: "attached", sourceCardCode: "PAY-121" },
		{ x: 100, y: 95 },
		GAP_ZONES,
	);
	assert.equal(attached.cardCode, "PAY-118");
	assert.equal(attached.distance, 0);
});

test("hover picking uses the same gap bands a session drag would arm", () => {
	assert.equal(BOARD_CARD_INSERTION_BAND_PX, GAP_BAND_PX);
	const gapZones = [...CARD_A_GAPS, ...CARD_B_GAPS];

	assert.deepEqual(
		pickBoardCardInsertionAtPoint({ x: 100, y: 95 }, gapZones),
		CARD_A_GAPS[0].insertion,
	);
	assert.equal(pickBoardCardInsertionAtPoint({ x: 100, y: 104 }, gapZones).insertAtIndex, 1);
	// Neither outer edge of the column can be hovered into a line.
	assert.equal(pickBoardCardInsertionAtPoint({ x: 100, y: 5 }, gapZones), null);
	assert.equal(pickBoardCardInsertionAtPoint({ x: 100, y: 205 }, gapZones), null);
	assert.equal(pickBoardCardInsertionAtPoint({ x: 100, y: 50 }, gapZones), null);
});
