const assert = require("node:assert/strict");
const test = require("node:test");

const {
	getBoardIssueInsertionLineTop,
	resolveBoardIssueDropSurface,
	getBoardCardInsertionAnchorClassName,
	resolveBoardCardInsertionPosition,
} = require("./board-card-insertion.ts");

test("issue drops distinguish the header, card stack and unused column space", () => {
	const clip = { top: 100, bottom: 600 };
	assert.equal(resolveBoardIssueDropSurface(70, 90, clip, 400), "header");
	assert.equal(resolveBoardIssueDropSurface(95, 90, clip, 400), "column");
	assert.equal(resolveBoardIssueDropSurface(150, 90, clip, 400), "position");
	assert.equal(resolveBoardIssueDropSurface(410, 90, clip, 400), "position");
	assert.equal(resolveBoardIssueDropSurface(440, 90, clip, 400), "column");
	assert.equal(resolveBoardIssueDropSurface(650, 90, clip, 800), "column");
	assert.equal(resolveBoardIssueDropSurface(150, 90, clip, undefined), "column");
});

test("the issue rule's centre bisects default, wider and fused card gaps", () => {
	for (const gap of [0, 4, 8, 12]) {
		const previousBottom = 100;
		const followingTop = previousBottom + gap;
		const lineTop = getBoardIssueInsertionLineTop(previousBottom, followingTop);
		assert.equal(lineTop + 1, (previousBottom + followingTop) / 2);
	}
});

const COLUMN = "To do";

function insertion(insertAtIndex, overrides = {}) {
	return {
		columnTitle: COLUMN,
		insertAtIndex,
		position: "before",
		relativeToCardCode: "PAY-118",
		...overrides,
	};
}

test("an interior gap paints on the card that follows it", () => {
	assert.equal(
		resolveBoardCardInsertionPosition(insertion(1), { cardIndex: 1, columnTitle: COLUMN }),
		"before",
	);
	// The same gap described from the other side — the card before it — resolves
	// to the same single owner, so one gap never paints two rules.
	assert.equal(
		resolveBoardCardInsertionPosition(
			insertion(1, { position: "after", relativeToCardCode: "PAY-107" }),
			{ cardIndex: 0, columnTitle: COLUMN },
		),
		undefined,
	);
});

test("the column's first card never owns a seam", () => {
	// A leading-edge insertion is not published any more, but a hover insertion
	// can outlive the card list that produced it for a frame. The first card
	// still refuses to paint a rule against the column's top boundary.
	assert.equal(
		resolveBoardCardInsertionPosition(insertion(0), { cardIndex: 0, columnTitle: COLUMN }),
		undefined,
	);
});

test("a trailing-edge insertion paints on nobody", () => {
	// Gap `cardCount` is the column's bottom boundary, owned by the create well.
	for (const cardIndex of [0, 1, 2]) {
		assert.equal(
			resolveBoardCardInsertionPosition(
				insertion(3, { position: "after", relativeToCardCode: "PAY-127" }),
				{ cardIndex, columnTitle: COLUMN },
			),
			undefined,
		);
	}
});

test("an insertion in another column, or none at all, paints nothing", () => {
	assert.equal(
		resolveBoardCardInsertionPosition(insertion(1, { columnTitle: "In progress" }), {
			cardIndex: 1,
			columnTitle: COLUMN,
		}),
		undefined,
	);
	assert.equal(resolveBoardCardInsertionPosition(null, { cardIndex: 1, columnTitle: COLUMN }), undefined);
	assert.equal(
		resolveBoardCardInsertionPosition(undefined, { cardIndex: 1, columnTitle: COLUMN }),
		undefined,
	);
});

test("the card wrapper is only positioned while it owns a seam", () => {
	assert.equal(getBoardCardInsertionAnchorClassName("before"), "relative");
	assert.equal(getBoardCardInsertionAnchorClassName(undefined), undefined);
});
