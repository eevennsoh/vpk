const assert = require("node:assert/strict");
const test = require("node:test");
const { createJiraKanbanSelectionState, getSelectableJiraKanbanColumns, reconcileJiraKanbanSelection, selectAllJiraKanbanCardsInSelectedColumns, selectJiraKanbanCard } = require("./state.ts");

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

test("another column extends the fixed anchor across matching card rows", () => {
	let state = click(click(createJiraKanbanSelectionState(), "A"), "D");
	state = click(state, "E");
	assert.deepEqual(codes(state), ["A", "E"]);
	assert.deepEqual(state.anchor, { columnTitle: "First", cardCode: "A" });
	assert.deepEqual(codes(click(state, "F")), ["A", "B", "C", "D", "E", "F"]);
	assert.deepEqual(codes(click(state, "C")), ["A", "B", "C"]);
});

const grid = [
	{ title: "Empty start", cards: [] },
	{ title: "Left", cards: ["A", "B", "C", "D"].map((code) => ({ code })) },
	{ title: "Middle", cards: ["E", "F", "G"].map((code) => ({ code })) },
	{ title: "Right", cards: ["H", "I", "J", "K", "L"].map((code) => ({ code })) },
	{ title: "Empty end", cards: [] },
];

test("grid rectangles grow, shrink and reverse without moving the anchor", () => {
	let state = click(createJiraKanbanSelectionState(), "B", shift, grid);
	state = click(state, "K", shift, grid);
	assert.deepEqual(codes(state), ["B", "C", "D", "F", "G", "I", "J", "K"]);
	state = click(state, "J", shift, grid);
	assert.deepEqual(codes(state), ["B", "C", "F", "G", "I", "J"]);
	state = click(state, "H", shift, grid);
	assert.deepEqual(codes(state), ["A", "B", "E", "F", "H", "I"]);
	assert.equal(state.anchor.cardCode, "B");
	assert.deepEqual(codes(click(state, "B", shift, grid)), ["B"]);
	assert.deepEqual(codes(click(click(createJiraKanbanSelectionState(), "K", shift, grid), "B", shift, grid)), ["B", "C", "D", "F", "G", "I", "J", "K"]);
});

test("either outer diagonal selects every card in either direction on uneven boards", () => {
	const uneven = [{ title: "Left", cards: ["A", "B"].map((code) => ({ code })) }, grid[2], grid[3]];
	for (const [anchor, target] of [["A", "L"], ["L", "A"], ["H", "B"], ["B", "H"]]) {
		const state = click(click(createJiraKanbanSelectionState(), anchor, shift, uneven), target, shift, uneven);
		assert.deepEqual(codes(state), ["A", "B", "E", "F", "G", "H", "I", "J", "K", "L"]);
		assert.equal(state.anchor.cardCode, anchor);
	}
});

test("a first row across columns is a rectangle, not an outer diagonal", () => {
	assert.deepEqual(codes(click(click(createJiraKanbanSelectionState(), "A", shift, grid), "H", shift, grid)), ["A", "E", "H"]);
});

test("cross-column ranges follow current card IDs and column order", () => {
	const state = click(createJiraKanbanSelectionState(), "B", shift, grid);
	const reordered = [grid[3], grid[2], { ...grid[1], cards: ["D", "A", "C", "B"].map((code) => ({ code })) }];
	assert.deepEqual(codes(click(state, "J", shift, reordered, { indexInColumn: 0 })), ["J", "K", "G", "C", "B"]);
});

test("filtered and collapsed columns do not contribute rows or corner selections", () => {
	const filtered = [{ ...grid[1], cards: grid[1].cards.slice(1) }, grid[2], grid[3]];
	const eligible = getSelectableJiraKanbanColumns(filtered, new Set(["Middle"]));
	assert.deepEqual(eligible.map((column) => column.title), ["Left", "Right"]);
	assert.deepEqual(codes(click(click(createJiraKanbanSelectionState(), "B", shift, eligible), "L", shift, eligible)), ["B", "C", "D", "H", "I", "J", "K", "L"]);
	const collapsedAnchor = click(createJiraKanbanSelectionState(), "F", shift, filtered);
	assert.deepEqual(codes(click(collapsedAnchor, "J", shift, eligible)), ["J"]);
});

test("toolbar Select all expands only the columns containing selected cards", () => {
	const single = click(createJiraKanbanSelectionState(), "B", toggle, grid);
	const allLeft = selectAllJiraKanbanCardsInSelectedColumns(single, grid);
	assert.deepEqual(codes(allLeft), ["A", "B", "C", "D"]);
	assert.equal(allLeft.anchor, null);
	const disjoint = click(single, "J", toggle, grid);
	assert.deepEqual(codes(selectAllJiraKanbanCardsInSelectedColumns(disjoint, grid)), ["A", "B", "C", "D", "H", "I", "J", "K", "L"]);
	const deselectedRight = click(disjoint, "J", toggle, grid);
	assert.deepEqual(codes(selectAllJiraKanbanCardsInSelectedColumns(deselectedRight, grid)), ["A", "B", "C", "D"]);
});

test("toolbar Select all ignores hidden selections and never invents a scope", () => {
	const selected = click(click(createJiraKanbanSelectionState(), "B", toggle, grid), "F", toggle, grid);
	const eligible = getSelectableJiraKanbanColumns(grid, new Set(["Middle"]));
	assert.deepEqual(codes(selectAllJiraKanbanCardsInSelectedColumns(selected, eligible)), ["A", "B", "C", "D"]);
	assert.deepEqual(codes(selectAllJiraKanbanCardsInSelectedColumns(createJiraKanbanSelectionState(), grid)), []);
	const filtered = [{ ...grid[1], cards: grid[1].cards.slice(2) }, grid[2], grid[3]];
	assert.deepEqual(codes(selectAllJiraKanbanCardsInSelectedColumns(selected, filtered)), ["E", "F", "G"]);
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
