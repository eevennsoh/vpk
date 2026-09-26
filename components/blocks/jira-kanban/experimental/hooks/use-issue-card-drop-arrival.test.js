const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require("../../../../../scripts/lib/esbuild-cjs-loader.js");
const arrivalModel = require("../lib/board-card-arrival.ts");
const autoModel = loadCjsModuleFromText(esbuild.buildSync({ entryPoints: ["components/blocks/jira-kanban/experimental/lib/board-auto-arrange.ts"], bundle: true, format: "cjs", platform: "node", write: false }).outputFiles[0].text);

function harness({ reduced = false, reject = false } = {}) {
	const states = [], refs = [], effects = [], scheduled = [], captures = [], flights = [];
	let stateIndex = 0, refIndex = 0, effectIndex = 0, preview = {}, api;
	let columns = [
		{ title: "To do", count: 2, cards: [{ code: "A", title: "A", tags: [], priority: "medium", autoArrangeStatus: "Review" }, { code: "B", title: "B", tags: [], priority: "medium", autoArrangeStatus: "Done" }] },
		{ title: "Review", count: 0, cards: [] }, { title: "Done", count: 0, cards: [] },
	];
	const root = { ownerDocument: { addEventListener() {}, removeEventListener() {} } };
	const boardRef = { current: root }, nativePreviewRef = { current: null };
	const getPreview = () => preview;
	const onAutoArrange = (codes) => { if (!reject) columns = autoModel.autoArrangeCards(columns, codes); };
	const onDrop = (title) => { if (!reject) columns = require("../../card-drop.ts").moveJiraKanbanCardsToStatus(columns, ["A", "B"], title); };
	const react = {
		useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], (next) => { states[i] = typeof next === "function" ? next(states[i]) : next; }]; },
		useRef(current) { const i = refIndex++; return refs[i] ??= { current }; },
		useMemo: (factory) => factory(), useCallback: (callback) => callback,
		useLayoutEffect(effect, deps) {
			const i = effectIndex++, previous = effects[i];
			if (previous && deps.every((dep, index) => Object.is(dep, previous.deps[index]))) return;
			scheduled.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: effect() }; });
		},
	};
	const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, "use-issue-card-drop-arrival.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	const loaded = { exports: {} };
	vm.runInNewContext(compiled, {
		module: loaded, exports: loaded.exports,
		require(name) {
			if (name === "react") return react;
			if (name.includes("use-media-query")) return { useMediaQuery: () => reduced };
			if (name.includes("board-auto-arrange")) return autoModel;
			if (name.includes("board-card-arrival")) return arrivalModel;
			if (name.includes("issue-card-drop-flight")) return {
				captureIssueCardDropFlights(options) { captures.push({ preview: options.preview, codes: [...options.codes], allCards: options.allCards }); const codes = options.allCards ? options.codes : arrivalModel.resolveVisibleIssueDropCodes(options.codes, options.grabbed); return codes.map((code) => ({ code, node: {}, from: { x: 100, y: 100 } })); },
				hasIssueDropTarget: () => true,
				startIssueCardDropFlights(root, title, items, landed, finished) { const flight = { title, items, landed, finished, stopped: false }; flights.push(flight); return () => { flight.stopped = true; }; },
			};
			throw new Error(`Unexpected import ${name}`);
		},
	});
	function render() {
		stateIndex = refIndex = effectIndex = 0;
		api = loaded.exports.useIssueCardDropArrival({ boardRef, enabled: true, getPreview, nativePreviewRef, columns, draggedCardCode: "A", selectedCardCodes: new Set(["A", "B"]), onDrop, onAutoArrange });
		while (scheduled.length) scheduled.shift()();
		return api;
	}
	render();
	return { render, captures, flights, arrange() { api.handleAutoArrange(new Set(["A", "B"])); preview = null; }, drop() { api.handleDrop("Review"); preview = null; } };
}

test("Return captures the held preview before commit and launches arrivals for every destination before paint", () => {
	const h = harness();
	h.arrange();
	assert.equal(h.captures.length, 2);
	assert.ok(h.captures.every((capture) => capture.preview !== null && capture.allCards));
	const api = h.render();
	assert.deepEqual(h.flights.map((flight) => flight.title), ["Review", "Done"]);
	assert.equal(api.arrivalForColumn("Review").pendingCardCodes[0], "A");
	assert.equal(api.arrivalForColumn("Done").pendingCardCodes[0], "B");
	for (const flight of h.flights) flight.landed(flight.items[0].code);
	const landed = h.render();
	assert.equal(landed.arrivalForColumn("Review").pendingCardCodes.length, 0);
	assert.equal(landed.arrivalForColumn("Done").pendingCardCodes.length, 0);
	landed.handleComplete(landed.arrivalForColumn("Review").id);
	const remaining = h.render();
	assert.equal(remaining.arrivalForColumn("Review"), undefined);
	assert.ok(remaining.arrivalForColumn("Done"));
	assert.equal(h.flights.length, 2, "finishing one column must not replay flights in another");
	remaining.handleComplete(remaining.arrivalForColumn("Done").id);
	h.render();
	assert.ok(h.flights.every((flight) => flight.stopped));
});

test("manual drops retain their one-cohort-flight contract", () => {
	const h = harness(); h.drop(); const api = h.render();
	assert.equal(h.flights.length, 1);
	assert.equal(h.flights[0].items.length, 1);
	assert.equal(h.captures[0].allCards, undefined);
	assert.equal(api.arrivalForColumn("Review").animatedCardCodes.length, 1);
});

test("reduced motion and rejected arrangements never launch flights", () => {
	for (const options of [{ reduced: true }, { reject: true }]) {
		const h = harness(options); h.arrange(); h.render();
		assert.equal(h.flights.length, 0);
		if (options.reduced) assert.equal(h.captures.length, 0);
	}
});
