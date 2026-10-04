const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require("../../../scripts/lib/esbuild-cjs-loader.js");

const keyboardModule = "@/components/blocks/jira-kanban/use-jira-issue-selection-keyboard";
const data = loadCjsModuleFromText(esbuild.buildSync({
	entryPoints: ["components/blocks/jira-dragging/data.ts"],
	bundle: true, format: "cjs", platform: "node", write: false, loader: { ".css": "empty" },
}).outputFiles[0].text);
const compiled = esbuild.buildSync({
	entryPoints: ["components/blocks/jira-dragging/use-jira-dragging.ts"],
	bundle: true, format: "cjs", platform: "node", write: false, packages: "external",
	external: ["react", keyboardModule, "./data"],
}).outputFiles[0].text;

function harness() {
	const slots = [];
	let cursor = 0;
	const loaded = { exports: {} };
	vm.runInNewContext(compiled, {
		module: loaded, exports: loaded.exports,
		require(name) {
			if (name === keyboardModule) return { useJiraIssueSelectionKeyboard() {} };
			if (name === "./data") return data;
			if (name !== "react") return require(name);
			return {
				...require("react"),
				useCallback: (callback) => callback,
				useRef(current) {
					const index = cursor++;
					return slots[index] ??= { current };
				},
				useState(initial) {
					const index = cursor++;
					if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
					return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
				},
			};
		},
	});
	return () => { cursor = 0; return loaded.exports.useJiraDragging(); };
}

function select(api, cards) {
	cards.forEach((card, index) => api.onCardSelect(card.code, "To do", index, {
		shiftKey: false, metaOrCtrlKey: true,
	}));
}

test("toolbar Select all remains column scoped after selecting and moving cards", () => {
	const render = harness();
	let api = render();
	const [first, second] = api.boardColumns[0].cards;
	select(api, [second]);
	api = render();
	api.selectionToolbar.onStatusChange("Done");
	api = render();
	api.selectionToolbar.onClearSelection();
	api.onCardSelect(first.code, "To do", 0, { shiftKey: true, metaOrCtrlKey: false });
	api = render();
	api.selectionToolbar.onSelectAll();
	api = render();
	assert.deepEqual([...api.selectedCardCodes], Array.from(api.boardColumns[0].cards, (card) => card.code));
	assert.equal(api.selectedCardCodes.has(second.code), false);
	api.onCardSelect(second.code, "Done", 0, { shiftKey: false, metaOrCtrlKey: true });
	api = render();
	api.onCardDragStart(first);
	api = render();
	api.selectionToolbar.onSelectAll();
	api = render();
	assert.equal(api.selectedCardCodes.size, 4);
	assert.equal(api.draggedCardCode, null);
	api.onCollapsedColumnsChange(new Set(["Done"]));
	api = render();
	api.selectionToolbar.onSelectAll();
	assert.equal(render().selectedCardCodes.has(second.code), false);
});

for (const [name, bulk, dragging] of [
	["a held single card", false, true],
	["bulk selected cards", true, false],
	["a held bulk selection", true, true],
]) {
	test(`auto arrange commits ${name} and settles selection and pickup`, () => {
		const render = harness();
		let api = render();
		const originalCards = [...api.boardColumns[0].cards];
		const cohort = bulk ? originalCards : originalCards.slice(0, 1);
		assert.ok(cohort.every((card) => card.autoArrangeStatus && card.autoArrangeStatus !== "To do"));
		assert.equal(typeof api.onAutoArrange, "function");
		if (bulk) { select(api, cohort); api = render(); }
		if (dragging) { api.onCardDragStart(cohort[0]); api = render(); }
		api.onAutoArrange(new Set(cohort.map((card) => card.code)));
		api = render();
		assert.equal(api.draggedCardCode, null);
		assert.equal(api.selectedCardCodes.size, 0);
		assert.equal(api.boardColumns.flatMap((column) => column.cards).length, originalCards.length);
		for (const card of cohort) {
			const destination = api.boardColumns.find((column) => column.cards.some((item) => item.code === card.code));
			assert.ok((destination.statuses ?? [destination.title]).includes(card.autoArrangeStatus));
			assert.deepEqual(structuredClone(destination.cards.find((item) => item.code === card.code)), structuredClone({ ...card, status: card.autoArrangeStatus }));
		}
		assert.ok(api.boardColumns.every((column) => column.count === column.cards.length));
		assert.deepEqual(Array.from(api.boardColumns[0].cards, (card) => card.code), originalCards.slice(cohort.length).map((card) => card.code));
		const arranged = api.boardColumns;
		api.onAutoArrange(new Set(cohort.map((card) => card.code)));
		api = render();
		assert.deepEqual(api.boardColumns, arranged);
		// A late drop from the completed pickup must not move the former cohort.
		api.onCardDrop("To do");
		assert.deepEqual(render().boardColumns, arranged);
	});
}
