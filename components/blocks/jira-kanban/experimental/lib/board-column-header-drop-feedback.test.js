const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveBoardColumnHeaderDropFeedbackInset } = require("./board-column-header-drop-feedback.ts");

/** Resolves a px-only `calc()` (or a plain px length) the way the browser would. */
function px(value) {
	if (typeof value === "number") return value;
	const terms = value.replace(/^calc\((.*)\)$/u, "$1").match(/[+-]?\s*\d+(?:\.\d+)?px/gu);
	return terms.reduce((sum, term) => sum + Number.parseFloat(term.replace(/\s+/gu, "")), 0);
}

/** Vertical geometry of the pill inside a header of `paddingTop + row + paddingBottom`. */
function pill({ inset, paddingTop, paddingBottom, row }) {
	const placement = resolveBoardColumnHeaderDropFeedbackInset(inset, paddingTop, paddingBottom);
	const height = px(paddingTop) + row + px(paddingBottom);
	const top = px(placement.top);
	const bottom = height - px(placement.bottom);
	return { placement, top, height: bottom - top, centre: (top + bottom) / 2, rowCentre: px(paddingTop) + row / 2 };
}

test("the default well's header pill stays a centred 32px ghost button around its 24px title row", () => {
	// Default chrome: 8px above the row, 4px below (the card list adds the other 4px), create inset 4px.
	const geometry = pill({ inset: "4px", paddingTop: "8px", paddingBottom: "4px", row: 24 });
	assert.equal(geometry.placement.insetInline, "4px", "the pill matches the create action horizontally");
	assert.equal(geometry.top, 4, "the create inset separates the pill from the well's top edge");
	assert.equal(geometry.height, 32);
	assert.equal(geometry.centre, geometry.rowCentre, "the header copy sits on the pill's centre line");
});

test("symmetric header padding keeps the pill inset evenly inside the header box", () => {
	const geometry = pill({ inset: "4px", paddingTop: "8px", paddingBottom: "8px", row: 24 });
	assert.equal(geometry.top, 4);
	assert.equal(px(geometry.placement.bottom), 4);
	assert.equal(geometry.centre, geometry.rowCentre);
});

test("taller title rows stay centred with the same clearance", () => {
	const geometry = pill({ inset: "4px", paddingTop: "8px", paddingBottom: "4px", row: 32 });
	assert.equal(geometry.height, 40);
	assert.equal(geometry.centre, geometry.rowCentre);
});

test("headers without a create inset keep the full header box", () => {
	assert.deepEqual(resolveBoardColumnHeaderDropFeedbackInset(undefined, undefined, "8px"), { inset: 0 });
	assert.deepEqual(resolveBoardColumnHeaderDropFeedbackInset("4px", undefined, "8px"), { inset: "4px" });
});
