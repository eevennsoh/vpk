const assert = require("node:assert/strict");
const test = require("node:test");
const { createJiraKanbanSelectionState, reconcileJiraKanbanSelection, selectJiraKanbanCard } = require("./state.ts");

const columns = [
	{ title: "First", cards: ["A", "B", "C", "D"].map((code) => ({ code })) },
	{ title: "Second", cards: ["E", "F"].map((code) => ({ code })) },
];
const shift = { shiftKey: true, metaOrCtrlKey: false };
const toggle = { shiftKey: false, metaOrCtrlKey: true };
function click(state, code, modifiers = shift, visible = columns, extra = {}) {
	const column = visible.find((candidate) => candidate.cards.some((card) => card.code === code));
	return selectJiraKanbanCard(state, visible, {
		cardCode: code, columnTitle: column.title,
		indexInColumn: column.cards.findIndex((card) => card.code === code), modifiers, ...extra,
	});
}
const codes = (state) => [...state.selectedCardCodes];

test("a fixed anchor extends, shrinks, reverses and collapses the exact range", () => {
	let state = click(createJiraKanbanSelectionState(), "B");
	assert.deepEqual(codes(state), ["B"]);
	assert.deepEqual(state.anchor, { columnTitle: "First", cardCode: "B" });
	state = click(state, "D");
	assert.deepEqual(codes(state), ["B", "C", "D"]);
	state = click(state, "C");
	assert.deepEqual(codes(state), ["B", "C"]);
	state = click(state, "A");
	assert.deepEqual(codes(state), ["A", "B"]);
	state = click(state, "B");
	assert.deepEqual(codes(state), ["B"]);
	assert.deepEqual(click(state, "B"), state);
});

test("the requested A to D to B sequence discards the old tail", () => {
	let state = click(createJiraKanbanSelectionState(), "A");
	state = click(state, "D");
	assert.deepEqual(codes(state), ["A", "B", "C", "D"]);
	assert.deepEqual(codes(click(state, "B")), ["A", "B"]);
});

test("another column establishes a fresh anchor and replaces all previous cards", () => {
	let state = click(click(createJiraKanbanSelectionState(), "A"), "D");
	state = click(state, "E");
	assert.deepEqual(codes(state), ["E"]);
	assert.deepEqual(codes(click(state, "F")), ["E", "F"]);
	assert.deepEqual(codes(click(state, "C")), ["C"]);
});

test("individual toggles establish an anchor on add and clear it only on its removal", () => {
	let state = click(createJiraKanbanSelectionState(), "A", toggle);
	state = click(state, "C", toggle);
	assert.deepEqual(codes(state), ["A", "C"]);
	assert.equal(state.anchor.cardCode, "C");
	state = click(state, "A", toggle);
	assert.equal(state.anchor.cardCode, "C");
	state = click(state, "C", toggle);
	assert.equal(state.anchor, null);
	assert.deepEqual(codes(state), []);
});

test("Shift replaces disjoint toggles and takes precedence over the toggle modifier", () => {
	let state = click(click(createJiraKanbanSelectionState(), "A", toggle), "C", toggle);
	state = click(state, "D", { shiftKey: true, metaOrCtrlKey: true });
	assert.deepEqual(codes(state), ["C", "D"]);
	assert.equal(state.anchor.cardCode, "C");
});

test("range positions follow card IDs in the current order, never stale indices", () => {
	const state = click(createJiraKanbanSelectionState(), "B");
	const reordered = [{ ...columns[0], cards: ["D", "B", "A", "C"].map((code) => ({ code })) }];
	assert.deepEqual(codes(click(state, "C", shift, reordered, { indexInColumn: 0 })), ["B", "A", "C"]);
	assert.deepEqual(codes(state), ["B"]);
});

test("hidden, removed, moved and deselected anchors are absent", () => {
	const state = click(createJiraKanbanSelectionState(), "A");
	const hidden = [{ ...columns[0], cards: columns[0].cards.slice(1) }, columns[1]];
	const moved = [hidden[0], { ...columns[1], cards: [...columns[1].cards, { code: "A" }] }];
	for (const visible of [hidden, moved]) {
		assert.equal(reconcileJiraKanbanSelection(state, visible).anchor, null);
		assert.deepEqual(codes(click(state, "C", shift, visible)), ["C"]);
	}
	assert.equal(reconcileJiraKanbanSelection({ ...state, selectedCardCodes: new Set() }, columns).anchor, null);
});

test("a keyboard range can start from the focused card without a prior selection", () => {
	const fresh = createJiraKanbanSelectionState();
	assert.deepEqual(codes(click(fresh, "B", shift, columns, {
		fallbackAnchor: { cardCode: "A", columnTitle: "First" },
	})), ["A", "B"]);
	const anchored = click(fresh, "C");
	assert.deepEqual(codes(click(anchored, "A", shift, columns, {
		fallbackAnchor: { cardCode: "B", columnTitle: "First" },
	})), ["A", "B", "C"]);
});

test("clear and Select all reset the anchor; invalid targets do not select phantom cards", () => {
	const fresh = createJiraKanbanSelectionState();
	assert.equal(fresh.anchor, null);
	const all = { ...fresh, selectedCardCodes: new Set(["A", "B", "C", "D", "E", "F"]) };
	assert.deepEqual(codes(click(all, "C")), ["C"]);
	assert.equal(selectJiraKanbanCard(fresh, columns, {
		cardCode: "missing", columnTitle: "First", indexInColumn: 1, modifiers: shift,
	}), fresh);
});
