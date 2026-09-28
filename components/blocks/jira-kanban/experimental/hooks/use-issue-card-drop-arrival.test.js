const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require("../../../../../scripts/lib/esbuild-cjs-loader.js");
const arrivalModel = loadCjsModuleFromText(esbuild.buildSync({ entryPoints: ["components/blocks/jira-kanban/experimental/lib/board-card-arrival.ts"], bundle: true, format: "cjs", platform: "node", tsconfig: "tsconfig.json", write: false }).outputFiles[0].text);
const autoModel = loadCjsModuleFromText(esbuild.buildSync({ entryPoints: ["components/blocks/jira-kanban/experimental/lib/board-auto-arrange.ts"], bundle: true, format: "cjs", platform: "node", write: false }).outputFiles[0].text);

const issue = (code, autoArrangeStatus) => ({ code, title: code, tags: [], priority: "medium", ...(autoArrangeStatus ? { autoArrangeStatus } : {}) });

/** `count` issues split across two source columns, like a multi-column keynote selection. */
function cohortBoard(count) {
	const codes = Array.from({ length: count }, (_, index) => `K${index + 1}`);
	const split = Math.ceil(count / 2);
	return {
		codes,
		columns: [
			{ title: "To do", count: split, cards: codes.slice(0, split).map((code) => issue(code)) },
			{ title: "Review", count: count - split, cards: codes.slice(split).map((code) => issue(code)) },
			{ title: "Done", count: 0, cards: [] },
		],
	};
}

function harness({ reduced = false, reject = false, enabled = true, withMove = false, board, dragged = "A", selected = ["A", "B"] } = {}) {
	const states = [], refs = [], effects = [], scheduled = [], captures = [], flights = [], events = [];
	let stateIndex = 0, refIndex = 0, effectIndex = 0, preview = {}, api;
	let columns = board ?? [
		{ title: "To do", count: 2, cards: [issue("A", "Review"), issue("B", "Done")] },
		{ title: "Review", count: 0, cards: [] }, { title: "Done", count: 0, cards: [] },
	];
	const root = { ownerDocument: { addEventListener() {}, removeEventListener() {} } };
	const boardRef = { current: root }, nativePreviewRef = { current: null };
	const getPreview = () => preview;
	const onAutoArrange = (codes) => { if (!reject) columns = autoModel.autoArrangeCards(columns, codes); };
	const onMove = withMove ? (move) => { events.push("commit"); columns = require("../../card-drop.ts").moveJiraKanbanCardsToDropTarget(columns, move.cardCodes, move.columnTitle, move.target); } : undefined;
	const onDrop = (title) => { if (!reject) columns = require("../../card-drop.ts").moveJiraKanbanCardsToStatus(columns, selected, title); };
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
				captureIssueCardDropFlights(options) { events.push("capture"); captures.push({ preview: options.preview, pointer: options.pointer, grabbed: options.grabbed, codes: [...options.codes], allCards: options.allCards }); return options.codes.map((code) => ({ code, node: {}, from: { x: 100, y: 100 } })); },
				hasIssueDropTarget: () => true,
				startIssueCardDropFlights(root, title, items, landed, finished) { const flight = { title, items, landed, finished, stopped: false }; flights.push(flight); return () => { flight.stopped = true; }; },
			};
			throw new Error(`Unexpected import ${name}`);
		},
	});
	function render() {
		stateIndex = refIndex = effectIndex = 0;
		api = loaded.exports.useIssueCardDropArrival({ boardRef, enabled, getPreview, nativePreviewRef, columns, draggedCardCode: dragged, selectedCardCodes: new Set(selected), onDrop, onMove, onAutoArrange });
		while (scheduled.length) scheduled.shift()();
		return api;
	}
	render();
	return { render, captures, flights, events, api: () => api, columns: () => columns, setEnabled(value) { enabled = value; }, arrange() { api.handleAutoArrange(new Set(["A", "B"])); preview = null; }, drop(title = "Review") { api.handleDrop(title); preview = null; } };
}

test("Return captures the held preview before commit and launches arrivals for every destination before paint", () => {
	const h = harness();
	h.arrange();
	assert.equal(h.captures.length, 2);
	assert.ok(h.captures.every((capture) => capture.preview !== null && capture.allCards === undefined));
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
	assertTravellerCascade(api.arrivalForColumn("Review"), "A");
});

test("reduced motion and rejected arrangements never launch flights", () => {
	for (const options of [{ reduced: true }, { reject: true }]) {
		const h = harness(options); h.arrange(); h.render();
		assert.equal(h.flights.length, 0);
		if (options.reduced) assert.equal(h.captures.length, 0);
	}
});


test("disabled move visuals preserve manual drops without starting an arrival", () => {
	const h = harness({ enabled: false });
	h.drop();
	const api = h.render();
	assert.equal(api.arrivalForColumn("Review"), undefined);
	assert.equal(h.captures.length, 0);
	assert.equal(h.flights.length, 0);
});

test("switching move visuals off cancels flights and clears arrivals before re-enabling", () => {
	const h = harness();
	h.arrange();
	h.render();
	assert.equal(h.flights.length, 2);
	h.setEnabled(false);
	h.render();
	assert.ok(h.flights.every((flight) => flight.stopped));
	h.setEnabled(true);
	const restored = h.render();
	assert.equal(restored.arrivalForColumn("Review"), undefined);
	assert.equal(restored.arrivalForColumn("Done"), undefined);
	assert.equal(h.flights.length, 2);
});

// A pointer drop flies its one held traveller however many issues move; the
// drag deck caps at three faces, but a drop never fans out into one flight per
// issue. Every landed issue still plays the entrance, cascading top to bottom
// in slot order from the commit, one duration-xxshort step per slot, capped
// past the fold. The traveller is off that clock: it enters when it lands,
// after every cascade step has started, so it finishes last.
const FLIGHT_S = 0.26;
const plain = (values) => [...values];
function assertTravellerCascade(arrival, lead) {
	assert.deepEqual(plain(arrival.animatedCardCodes), plain(arrival.cardCodes), "every landed issue plays the entrance, in slot order");
	assert.deepEqual(plain(arrival.cascadeLeadCardCodes), [lead]);
	assert.deepEqual(plain(arrival.pendingCardCodes), [lead], "only the flying traveller waits to land");
	const others = arrival.cardCodes.filter((code) => code !== lead).map((code) => arrivalModel.getIssueDropCascadeDelayS(arrival, code));
	for (let index = 1; index < others.length; index++) assert.ok(others[index] >= others[index - 1], `a lower slot may not start before the slot above it (${others})`);
	assert.ok(others.every((startS) => startS < FLIGHT_S), "the whole cascade starts before the traveller can land");
	for (const code of arrival.cardCodes) assert.equal(arrivalModel.resolveBoardCardArrival(arrival, code).entering, true, `${code} plays the entrance`);
	assert.equal(arrivalModel.resolveBoardCardArrival(arrival, lead).final, true, "the traveller enters last and owns completion");
	assert.equal(arrival.cardCodes.filter((code) => arrivalModel.resolveBoardCardArrival(arrival, code).final).length, 1);
}

// Auto arrange and host moves land a deck instead: the destination's top cards,
// at most the drag deck's three, fly into the top slots; every card below the
// deck holds until it lands and then steps down from it, top to bottom.
function assertDeckCascade(arrival, flights) {
	const deck = arrival.cardCodes.slice(0, Math.min(3, arrival.cardCodes.length));
	assert.deepEqual(plain(flights), deck, "a deck of at most three flies into the destination's top slots");
	assert.deepEqual(plain(arrival.cascadeLeadCardCodes), deck);
	assert.equal(arrival.cascadeHoldsBelowLeads, true);
	assert.deepEqual(plain(arrival.pendingCardCodes), plain(arrival.cardCodes), "the deck and everything below it wait for the landing");
	const starts = arrival.cardCodes.map((code) => arrivalModel.getIssueDropCascadeDelayS(arrival, code));
	assert.deepEqual(starts.slice(0, deck.length), deck.map(() => 0), "the deck enters as one stack on landing");
	for (let index = 1; index < starts.length; index++) assert.ok(starts[index] >= starts[index - 1], `slot ${index} may not start before the slot above it (${starts})`);
	assert.ok(starts.every((startS) => startS <= arrivalModel.ISSUE_DROP_AFTER_DECK_MAX_STEPS * arrivalModel.ISSUE_DROP_CASCADE_STAGGER_S + 1e-9), "past the fold the after-deck cascade adds no time");
	for (const code of arrival.cardCodes) assert.equal(arrivalModel.resolveBoardCardArrival(arrival, code).entering, true, `${code} plays the entrance`);
	assert.equal(arrivalModel.resolveBoardCardArrival(arrival, arrival.cardCodes.at(-1)).final, true, "the bottom card starts last and owns completion");
}

for (const count of [2, 3, 5, 13]) {
	test(`a ${count}-issue pointer drop flies only the grabbed traveller while every issue cascades in`, () => {
		const { codes, columns } = cohortBoard(count);
		const grabbed = codes[Math.floor(count / 2)];
		const h = harness({ board: columns, dragged: grabbed, selected: codes });
		h.drop("Done");
		const api = h.render();
		assert.deepEqual(h.columns().find((column) => column.title === "Done").cards.map((card) => card.code), codes);
		assert.equal(h.flights.length, 1);
		assert.deepEqual(h.flights[0].items.map((item) => item.code), [grabbed]);
		assertTravellerCascade(api.arrivalForColumn("Done"), grabbed);
	});

	test(`a ${count}-issue host move drops a deck into the top of the column like auto arrange`, () => {
		const { codes, columns } = cohortBoard(count);
		const h = harness({ board: columns, withMove: true, dragged: null, selected: [] });
		h.api().handleMove({ cardCodes: codes, columnTitle: "Done", target: { beforeCardCode: null } });
		assert.deepEqual(h.events, ["capture", "commit"]);
		assert.equal(h.captures[0].preview, null, "no held traveller exists for a host move");
		assert.equal(h.captures[0].pointer, null, "each deck card flies from its own slot");
		const api = h.render();
		assert.deepEqual(h.columns().find((column) => column.title === "Done").cards.map((card) => card.code), codes);
		assert.equal(h.flights.length, 1);
		const arrival = api.arrivalForColumn("Done");
		assertDeckCascade(arrival, h.flights[0].items.map((item) => item.code));
		for (const item of h.flights[0].items) h.flights[0].landed(item.code);
		const landed = h.render();
		assert.deepEqual(plain(landed.arrivalForColumn("Done").pendingCardCodes), [], "the landing releases the cards below the deck");
		landed.handleComplete(landed.arrivalForColumn("Done").id);
		assert.equal(h.render().arrivalForColumn("Done"), undefined);
	});
}

// The toolbar's Auto arrange and Return during a drag share one path: each
// destination drops a deck of its top cards into its top slots.
for (const dragging of [false, true]) {
	test(`${dragging ? "Return mid-drag" : "the toolbar"} auto-arranges 13 issues as a three-card deck into the top of Done`, () => {
		const { codes, columns } = cohortBoard(13);
		const board = columns.map((column) => ({ ...column, cards: column.cards.map((card) => ({ ...card, autoArrangeStatus: "Done" })) }));
		const grabbed = dragging ? codes[7] : null;
		const h = harness({ board, dragged: grabbed, selected: codes });
		h.api().handleAutoArrange(new Set(codes));
		assert.equal(h.captures.length, 1);
		assert.deepEqual(h.captures[0].codes, codes.slice(0, 3), "the deck is the destination's top three, never all thirteen");
		const api = h.render();
		const done = h.columns().find((column) => column.title === "Done").cards.map((card) => card.code);
		assert.deepEqual(done.slice(0, 3), codes.slice(0, 3), "the deck's cards occupy the top slots");
		assert.equal(h.flights.length, 1);
		assertDeckCascade(api.arrivalForColumn("Done"), h.flights[0].items.map((item) => item.code));
	});
}

test("auto arrange across destinations drops one deck into the top of each", () => {
	const { codes, columns } = cohortBoard(12);
	const board = columns.map((column) => ({ ...column, cards: column.cards.map((card, index) => ({ ...card, autoArrangeStatus: index % 2 ? "Done" : "Review" })) }));
	const h = harness({ board, dragged: null, selected: codes });
	h.api().handleAutoArrange(new Set(codes));
	const api = h.render();
	assert.deepEqual(h.flights.map((flight) => flight.title).sort(), ["Done", "Review"]);
	assert.equal(api.arrivalForColumn("Done").cardCodes.length, 6, "Done lands more than its deck");
	for (const flight of h.flights) {
		const arrival = api.arrivalForColumn(flight.title);
		assertDeckCascade(arrival, flight.items.map((item) => item.code));
	}
});

test("the landing cascade starts top to bottom in slot order and stops growing past the fold", () => {
	const cardCodes = Array.from({ length: 13 }, (_, index) => `K${index + 1}`);
	const step = arrivalModel.ISSUE_DROP_CASCADE_STAGGER_S;
	const round = (values) => values.map((value) => +value.toFixed(3));
	const columns = [{ title: "To do", cards: cardCodes.map((code) => ({ code })) }, { title: "Done", cards: [] }];
	const moved = [{ title: "To do", cards: [] }, { title: "Done", cards: cardCodes.map((code) => ({ code, status: "Done" })) }];
	const captured = arrivalModel.captureIssueCardDropArrival(columns, cardCodes, "Done", -9);
	// A traveller mid-column; captured out of order, the cascade still follows slots.
	const traveller = arrivalModel.resolveIssueCardDropArrival({ ...captured, animatedCardCodes: [...cardCodes].reverse(), pendingCardCodes: ["K8"], leadCardCodes: ["K8"] }, moved);
	assert.deepEqual(plain(traveller.animatedCardCodes), cardCodes);
	const starts = cardCodes.map((code) => arrivalModel.getIssueDropCascadeDelayS(traveller, code));
	assert.deepEqual(round(starts.slice(0, 5)), round([0, step, 2 * step, 3 * step, 3 * step]), "top slot first, then each slot below it");
	assert.equal(starts[7], 0, "the traveller's own entrance starts on landing");
	// A deck at the top: it lands first, then the slots below step down from it.
	const deck = arrivalModel.resolveIssueCardDropArrival({ ...captured, animatedCardCodes: cardCodes, pendingCardCodes: ["K1", "K2", "K3"], leadCardCodes: ["K1", "K2", "K3"], holdBelowLeads: true }, moved);
	assert.deepEqual(plain(deck.pendingCardCodes), cardCodes);
	assert.deepEqual(round(cardCodes.slice(0, 6).map((code) => arrivalModel.getIssueDropCascadeDelayS(deck, code))), round([0, 0, 0, step, step, step]), "the deck lands as one stack, then the slots below follow it");
	assert.deepEqual(arrivalModel.resolveIssueDropDeck(cardCodes), ["K1", "K2", "K3"]);
	assert.deepEqual(arrivalModel.resolveIssueDropDeck(["K1", "K2"]), ["K1", "K2"]);
	const released = arrivalModel.resolveIssueCardDropArrival({ ...captured, animatedCardCodes: cardCodes, pendingCardCodes: [], leadCardCodes: ["K1", "K2", "K3"], holdBelowLeads: true }, moved);
	assert.deepEqual(plain(released.pendingCardCodes), [], "once the deck lands nothing is held");
});

test("host moves commit without visuals when move visuals are off, and stay absent without an owner", () => {
	const h = harness({ withMove: true, enabled: false });
	h.api().handleMove({ cardCodes: ["A", "B"], columnTitle: "Done", target: { beforeCardCode: null } });
	assert.deepEqual(h.events, ["commit"]);
	assert.equal(h.render().arrivalForColumn("Done"), undefined);
	assert.equal(harness().api().handleMove, undefined);
});

test("each move request id plays once, and a board without the capability ignores it", () => {
	const refs = [];
	let refIndex = 0;
	const react = {
		useRef(current) { const i = refIndex++; return refs[i] ??= { current }; },
		useEffect(effect) { effect(); },
	};
	const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, "use-issue-move-request.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	const loaded = { exports: {} };
	vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require(name) { if (name === "react") return react; throw new Error(`Unexpected import ${name}`); } });
	const moves = [];
	const render = (request, onMove = (move) => moves.push(move.id)) => { refIndex = 0; loaded.exports.useIssueMoveRequest(request, onMove); };
	const request = { id: 1, cardCodes: ["A"], columnTitle: "Done" };
	render(request);
	render(request);
	render({ ...request });
	assert.deepEqual(moves, [1]);
	render({ ...request, id: 2 });
	assert.deepEqual(moves, [1, 2]);
	render({ ...request, id: 3 }, null);
	assert.deepEqual(moves, [1, 2]);
});
