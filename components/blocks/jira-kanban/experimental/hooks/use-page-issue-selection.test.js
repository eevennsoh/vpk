const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const state = require("../../state.ts");

function harness(selectedCodes, anchorCode) {
	let columns = [{ title: "To do", count: 3, cards: ["A", "B", "C"].map((code) => ({ code })) }];
	let selection = { selectedCardCodes: new Set(selectedCodes), anchor: anchorCode ? { cardCode: anchorCode, columnTitle: "To do" } : null };
	let draggedCard = { card: columns[0].cards[0], sourceColumnTitle: "To do" };
	const loaded = { exports: {} };
	const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, "use-page-issue-selection.ts"), "utf8"), {
		compilerOptions: { module: ts.ModuleKind.CommonJS },
	}).outputText;
	vm.runInNewContext(compiled, {
		module: loaded, exports: loaded.exports,
		require: (name) => {
			if (name === "react") return { useRef: (current) => ({ current }) };
			if (name.endsWith("/state")) return state;
			if (name.endsWith("/card-drop")) return require("../../card-drop.ts");
			if (name.endsWith("/use-jira-issue-selection-keyboard")) return { useJiraIssueSelectionKeyboard() {} };
			if (name.endsWith("/use-jira-selection-dismiss")) return { useJiraSelectionDismiss() {} };
			throw new Error(`Unexpected import: ${name}`);
		},
	});
	const actions = loaded.exports.usePageIssueSelection({
		rootRef: { current: null }, enabled: true, boardColumns: columns, filteredBoardColumns: columns,
		selection, setSelection: (updater) => { selection = typeof updater === "function" ? updater(selection) : updater; },
		draggedCard, setDraggedCard: (next) => { draggedCard = next; },
		updateBoardColumns: (updater) => { columns = updater(columns); },
	});
	return { actions, selection: () => selection, columns: () => columns, draggedCard: () => draggedCard };
}

test("removing the selected range anchor prunes its code and keeps the remaining cohort", () => {
	const h = harness(["A", "B"], "A");
	h.actions.handleCardRemove(h.columns()[0].cards[0]);
	assert.deepEqual([...h.selection().selectedCardCodes], ["B"]);
	assert.equal(h.selection().anchor, null);
	assert.deepEqual(h.columns()[0].cards.map((card) => card.code), ["B", "C"]);
	assert.equal(h.columns()[0].count, 2);
	assert.equal(h.draggedCard(), null);
});

test("removing the only selected issue clears the bulk selection count", () => {
	const h = harness(["A"], "A");
	h.actions.handleCardRemove(h.columns()[0].cards[0]);
	assert.equal(h.selection().selectedCardCodes.size, 0);
	assert.equal(h.selection().anchor, null);
});

test("removing an unselected issue preserves the selected issue and its anchor", () => {
	const h = harness(["B"], "B");
	h.actions.handleCardRemove(h.columns()[0].cards[0]);
	assert.deepEqual([...h.selection().selectedCardCodes], ["B"]);
	assert.equal(h.selection().anchor.cardCode, "B");
});
