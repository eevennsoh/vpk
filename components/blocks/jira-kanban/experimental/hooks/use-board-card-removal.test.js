const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function harness(reducedMotion = false, suppliedActions, onCardsRemove) {
	const timers = new Map(), refs = [], effects = [], calls = [];
	let state = new Set(), cursor = 0, timerId = 0, api;
	let actions = suppliedActions ?? { onDelete: card => calls.push(`delete:${card.code}`), onArchive: card => calls.push(`archive:${card.code}`) };
	const latest = { current: actions };
	const loaded = { exports: {} };
	vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "use-board-card-removal.ts"), "utf8"), {
		compilerOptions: { module: ts.ModuleKind.CommonJS },
	}).outputText, {
		module: loaded, exports: loaded.exports,
		setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
		clearTimeout(id) { timers.delete(id); },
		require(name) {
			if (name.includes("jira-creating-motion")) return { JIRA_CREATE_REMOVE_DURATION_S: 0.15 };
			if (name.includes("use-latest-ref")) return { useLatestRef(value) { latest.current = value; return latest; } };
			return {
				useRef(value) { const i = cursor++; return refs[i] ??= { current: value }; },
				useState: () => [state, next => { state = typeof next === "function" ? next(state) : next; }],
				useCallback: callback => callback,
				useEffect(effect) { if (!effects.length) effects.push(effect()); },
			};
		},
	});
	function render() { cursor = 0; api = loaded.exports.useBoardCardRemoval(actions, reducedMotion, onCardsRemove); return api; }
	render();
	return {
		calls, timers, render, api: () => api,
		updateActions(next) { actions = next; render(); },
		updateBulkAction(next) { onCardsRemove = next; render(); },
		finish() { api.complete("A"); render(); },
		unmount() { effects.forEach(cleanup => cleanup()); },
	};
}

test("Archive and Delete wait for the reverse animation and commit exactly once", () => {
	for (const action of ["onArchive", "onDelete"]) {
		const h = harness();
		h.api().actions[action]({ code: "A" });
		h.render();
		assert.equal(h.api().removingCardCodes.has("A"), true);
		assert.deepEqual(h.calls, []);
		h.api().actions.onDelete({ code: "A" });
		h.finish(); h.finish();
		assert.deepEqual(h.calls, [`${action === "onArchive" ? "archive" : "delete"}:A`]);
		assert.equal(h.timers.size, 0);
		assert.equal(h.api().removingCardCodes.size, 0);
	}
});

test("reduced motion commits immediately without scheduling an animation", () => {
	const h = harness(true);
	h.api().actions.onDelete({ code: "A" });
	assert.deepEqual(h.calls, ["delete:A"]);
	assert.equal(h.timers.size, 0);
});

test("a missing animation completes through the fallback using the latest transaction", () => {
	const h = harness();
	h.api().actions.onArchive({ code: "A" });
	h.updateActions({ onArchive: card => h.calls.push(`latest:${card.code}`) });
	[...h.timers.values()][0]();
	h.finish();
	assert.deepEqual(h.calls, ["latest:A"]);
});

test("switching views during removal commits pending work and clears timers", () => {
	const h = harness();
	h.api().actions.onDelete({ code: "A" });
	h.unmount(); h.finish();
	assert.deepEqual(h.calls, ["delete:A"]);
	assert.equal(h.timers.size, 0);
});

test("a rapid second removal finishes the first gesture before starting the next transaction", () => {
	const h = harness();
	h.api().actions.onDelete({ code: "A" });
	h.api().actions.onArchive({ code: "B" });
	h.render();
	assert.deepEqual(h.calls, ["delete:A"]);
	assert.deepEqual([...h.api().removingCardCodes], ["B"]);
	h.updateActions({ onArchive: card => h.calls.push(`latest:${card.code}`) });
	h.api().complete("B");
	assert.deepEqual(h.calls, ["delete:A", "latest:B"]);
	assert.equal(h.timers.size, 0);
});

test("unavailable removal capabilities remain unavailable", () => {
	const h = harness(false, { onDelete: card => h.calls.push(card.code) });
	assert.equal(h.api().actions.onArchive, undefined);
	assert.equal(h.api().deleteCards, undefined);
});

test("toolbar deletion animates every captured card together and commits once after the last slot closes", () => {
	const calls = [];
	const h = harness(false, {}, codes => calls.push([...codes]));
	const selection = ["A", "B"];
	h.api().deleteCards(selection);
	selection.push("C");
	h.render();
	assert.deepEqual([...h.api().removingCardCodes], ["A", "B"]);
	h.api().complete("A");
	assert.deepEqual(calls, []);
	h.api().deleteCards(["A", "B"]);
	h.api().complete("B");
	h.api().complete("B");
	assert.deepEqual(calls, [["A", "B"]]);
	assert.equal(h.timers.size, 0);
	h.render();
	assert.equal(h.api().removingCardCodes.size, 0);
});

test("toolbar deletion captures codes but uses the latest commit callback when selection changes", () => {
	const calls = [];
	const h = harness(false, {}, () => calls.push("stale"));
	h.api().deleteCards(["A", "B"]);
	h.updateBulkAction(codes => calls.push([...codes]));
	[...h.timers.values()][0]();
	assert.deepEqual(calls, [["A", "B"]]);
});

test("reduced motion deletes the toolbar cohort immediately and empty selection is ignored", () => {
	const calls = [];
	const h = harness(true, {}, codes => calls.push([...codes]));
	h.api().deleteCards([]);
	h.api().deleteCards(["A", "B"]);
	assert.deepEqual(calls, [["A", "B"]]);
	assert.equal(h.timers.size, 0);
});
