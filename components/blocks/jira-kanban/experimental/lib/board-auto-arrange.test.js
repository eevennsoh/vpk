const assert = require("node:assert/strict");
const test = require("node:test");
const esbuild = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadCjsModuleFromText } = require("../../../../../scripts/lib/esbuild-cjs-loader.js");

const { autoArrangeCards, getAutoArrangePlan, withAutoArrangeDestinations } = loadCjsModuleFromText(esbuild.buildSync({
	entryPoints: ["components/blocks/jira-kanban/experimental/lib/board-auto-arrange.ts"],
	bundle: true, format: "cjs", platform: "node", write: false,
}).outputFiles[0].text);

const card = (code, autoArrangeStatus) => ({ code, title: code, tags: [], priority: "medium", autoArrangeStatus });
const board = () => [
	{ title: "To do", count: 3, cards: [card("A", "Working"), card("B", "Done"), card("C", "Paused")] },
	{ title: "In progress", statuses: ["Working", "Paused"], count: 1, cards: [{ ...card("D", "Working"), status: "Working" }] },
	{ title: "Done", count: 1, cards: [card("E", "Missing")] },
];

test("demo destinations are randomized across valid other columns and remain stable after moves", () => {
	const columns = board();
	columns[0].cards = Array.from({ length: 30 }, (_, index) => card(`PAY-${index}`));
	const assigned = withAutoArrangeDestinations(columns);
	const statuses = assigned[0].cards.map((item) => item.autoArrangeStatus);
	assert.deepEqual(withAutoArrangeDestinations(columns), assigned);
	assert.equal(new Set(statuses).size, 3);
	assert.ok(statuses.every((status) => ["Working", "Paused", "Done"].includes(status)));
	const moved = autoArrangeCards(assigned, new Set(assigned[0].cards.map((item) => item.code)));
	assert.deepEqual(withAutoArrangeDestinations(moved), moved);
	assert.equal(columns[0].cards[0].autoArrangeStatus, undefined);
});

test("single-card plan and movement agree, preserving metadata and unrelated cards", () => {
	const columns = board();
	assert.deepEqual(getAutoArrangePlan(columns, new Set(["A"])), [{ code: "A", columnTitle: "In progress", status: "Working" }]);
	const moved = autoArrangeCards(columns, new Set(["A"]));
	assert.deepEqual(moved.map((column) => column.count), [2, 2, 1]);
	assert.equal(moved[1].cards[0].code, "A");
	assert.equal(moved[1].cards[0].status, "Working");
	assert.equal(moved[1].cards[0].autoArrangeStatus, "Working");
	assert.equal(moved[2], columns[2]);
});

test("bulk arrangement splits one cohort across destinations with accurate incoming counts", () => {
	const columns = board();
	const codes = new Set(["A", "B", "C"]);
	const plan = getAutoArrangePlan(columns, codes);
	assert.deepEqual(columns.map((column) => plan.filter((move) => move.columnTitle === column.title).length), [0, 2, 1]);
	const moved = autoArrangeCards(columns, codes);
	assert.deepEqual(moved.map((column) => column.count), [0, 3, 2]);
	assert.deepEqual(moved[1].cards.map((item) => [item.code, item.status]), [["C", "Paused"], ["A", "Working"], ["D", "Working"]]);
	assert.equal(moved.flatMap((column) => column.cards).length, 5);
	assert.deepEqual(autoArrangeCards(moved, codes), moved);
});

test("invalid, missing, unselected and already-arranged cards do not move", () => {
	const columns = board();
	assert.deepEqual(getAutoArrangePlan(columns, new Set(["D", "E", "unknown"])), []);
	assert.deepEqual(autoArrangeCards(columns, new Set(["D", "E", "unknown"])), columns);
	assert.deepEqual(withAutoArrangeDestinations([{ title: "Only", count: 1, cards: [card("F")] }])[0].cards[0], card("F"));
});

function loadAutoArrangeControls() {
	// Atlaskit imports compiled CSS; SSR needs its components, not a CSS loader.
	const previousCssLoader = require.extensions[".css"];
	try {
		require.extensions[".css"] = () => {};
		return loadCjsModuleFromText(esbuild.buildSync({
			entryPoints: ["components/blocks/jira-kanban/experimental/components/board-auto-arrange.tsx"],
			bundle: true, format: "cjs", platform: "node", packages: "external", write: false,
		}).outputFiles[0].text);
	} finally {
		if (previousCssLoader) require.extensions[".css"] = previousCssLoader;
		else delete require.extensions[".css"];
	}
}

test("destination badges render only positive incoming counts", () => {
	const { BoardAutoArrangeBadge } = loadAutoArrangeControls();
	const render = (count) => renderToStaticMarkup(React.createElement(BoardAutoArrangeBadge, { count, title: "Done" }));
	assert.equal(render(undefined), "");
	assert.equal(render(0), "");
	assert.match(render(3), /aria-label="3 cards to arrange in Done"/u);
	assert.match(render(3), />3<\/span>/u);
});

test("auto arrange advertises Command and Control Enter with a Command Return hint", () => {
	const { BoardAutoArrangeAction } = loadAutoArrangeControls();
	const render = (available) => renderToStaticMarkup(React.createElement(BoardAutoArrangeAction, { ready: false, available, onArrange() {} }));
	assert.match(render(true), /aria-keyshortcuts="Meta\+Enter Control\+Enter"/u);
	assert.match(render(true), /aria-label="Command Enter"/u);
	assert.match(render(true), />⌘<\/kbd>/u);
	assert.doesNotMatch(render(false), /aria-keyshortcuts|data-slot="kbd"/u);
});

test("auto arrange action is omitted without available moves and retained while preparing", () => {
	const previousCssLoader = require.extensions[".css"];
	let BoardAutoArrangeAction;
	try {
		require.extensions[".css"] = () => {};
		({ BoardAutoArrangeAction } = loadCjsModuleFromText(esbuild.buildSync({
			entryPoints: ["components/blocks/jira-kanban/experimental/components/board-auto-arrange.tsx"],
			bundle: true, format: "cjs", platform: "node", packages: "external", write: false,
		}).outputFiles[0].text));
	} finally {
		if (previousCssLoader) require.extensions[".css"] = previousCssLoader;
		else delete require.extensions[".css"];
	}
	const render = (ready, available) => renderToStaticMarkup(React.createElement(BoardAutoArrangeAction, { ready, available, onArrange: () => {} }));
	assert.equal(render(false, false), "");
	assert.equal(render(true, false), "");
	assert.match(render(false, true), /aria-label="Preparing auto arrange"/u);
	assert.match(render(true, true), /aria-label="Auto arrange"/u);
});
