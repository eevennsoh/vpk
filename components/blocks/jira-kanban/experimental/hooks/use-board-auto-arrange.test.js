const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const esbuild = require("esbuild");
const ts = require("typescript");
const { loadCjsModuleFromText } = require("../../../../../scripts/lib/esbuild-cjs-loader.js");
const model = loadCjsModuleFromText(esbuild.buildSync({ entryPoints: ["components/blocks/jira-kanban/experimental/lib/board-auto-arrange.ts"], bundle: true, format: "cjs", platform: "node", write: false }).outputFiles[0].text);

function harness(status = "Done", filtered = false, { dragged = "A" } = {}) {
	let prepared, timer, api, timerId = 0;
	let selected = new Set(["A"]);
	const actions = [], listeners = new Map(), effects = [];
	const latestPlan = { current: undefined };
	let effectIndex = 0;
	class Node {}
	class Element extends Node {
		constructor(control = "surface", inside = true) { super(); this.control = control; this.inside = inside; }
		closest(selector) {
			if (selector === "[data-jira-auto-arrange-scope]") return this.inside ? { getAttribute: () => "board-1" } : null;
			if (selector === '[data-slot="jira-toolbar"]') return this.control === "toolbar-button" ? this : null;
			if (selector.includes("data-jira-issue-activation-control") || selector.includes("data-jira-issue-selection-control")) {
				return ["activation", "selection"].includes(this.control) ? this : null;
			}
			const button = ["activation", "selection", "button", "toolbar-button"].includes(this.control);
			return selector.startsWith("button,") ? button ? this : null
				: selector.startsWith("a,") && !button && this.control !== "surface" ? this : null;
		}
	}
	const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, "use-board-auto-arrange.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	const loaded = { exports: {} };
	vm.runInNewContext(compiled, {
		module: loaded, exports: loaded.exports, Node, Element,
		setTimeout: (callback) => { timer = callback; return ++timerId; },
		clearTimeout(id) { if (id === timerId) timer = undefined; },
		window: { addEventListener: (type, handler) => listeners.set(type, handler), removeEventListener: (type) => listeners.delete(type) },
		require(name) {
			if (name.includes("board-auto-arrange")) return model;
			if (name.includes("use-latest-ref")) return { useLatestRef: value => { latestPlan.current = value; return latestPlan; } };
			return {
				useMemo: (factory) => factory(), useCallback: (callback) => callback,
				useState: (initial) => [prepared ?? initial, (next) => { prepared = next; }],
				useEffect(effect, deps) {
					const i = effectIndex++, previous = effects[i];
					if (previous && deps.every((dep, index) => Object.is(dep, previous.deps[index]))) return;
					previous?.cleanup?.(); effects[i] = { deps, cleanup: effect() };
				},
			};
		},
	});
	function render() {
		effectIndex = 0;
		api = loaded.exports.useBoardAutoArrange({ columns: [{ title: "To do", count: 3, cards: filtered ? [] : [
			{ code: "A", status: "To do", autoArrangeStatus: status },
			{ code: "B", status: "To do", autoArrangeStatus: "Done" },
			{ code: "C", status: "To do", autoArrangeStatus: "In progress" },
		] }, { title: "Done", count: 0, cards: [] }, { title: "In progress", count: 0, cards: [] }], selected, dragged, onArrange: () => actions.push("arrange"), beforeArrange: () => actions.push("end-pickup"), scopeId: "board-1" });
		return api;
	}
	render();
	return { actions, listeners, api: () => api, prepare: () => { timer?.(); render(); },
		select(codes) { selected = new Set(codes); render(); },
		press(control = "surface", overrides = {}, inside = true) {
			const event = { key: "a", target: new Element(control, inside), defaultPrevented: false,
				preventDefault() { this.defaultPrevented = true; }, ...overrides };
			listeners.get("keydown")?.(event);
			return event.defaultPrevented;
		},
	};
}

test("an empty, invalid or filtered plan never enables the shortcut or clears the current gesture", () => {
	for (const [status, filtered] of [["To do", false], ["Missing", false], ["Done", true]]) {
		const h = harness(status, filtered); h.prepare();
		assert.equal(h.api().available, false);
		assert.equal(h.api().ready, false);
		h.api().arrange();
		assert.deepEqual(h.actions, []);
		assert.equal(h.listeners.size, 0);
	}
});

test("a nonempty prepared plan commits before removing the held preview", () => {
	const h = harness();
	assert.equal(h.api().ready, false);
	h.prepare();
	assert.equal(h.api().available, true);
	assert.equal(h.api().ready, true);
	h.api().arrange();
	assert.deepEqual(h.actions, ["arrange", "end-pickup"]);
});

test("bare A arranges from cards, the board and the focused Select all toolbar button", () => {
	for (const control of ["activation", "selection", "toolbar-button", "surface"]) {
		for (const key of ["a", "A"]) {
			const h = harness("Done", false, { dragged: null });
			h.prepare();
			assert.equal(h.press(control, { key }), true, "claim the shortcut without activating the focused button");
			assert.deepEqual(h.actions, ["arrange", "end-pickup"]);
		}
	}
});

test("Enter and Space keep native activation on cards, the toolbar and the board", () => {
	for (const control of ["activation", "selection", "toolbar-button", "surface"]) {
		for (const key of ["Enter", " "]) {
			const h = harness(); h.prepare();
			assert.equal(h.press(control, { key }), false);
			assert.deepEqual(h.actions, []);
		}
	}
});

test("the shortcut ignores editing, menus, dialogs, unrelated buttons and other boards", () => {
	for (const control of ["button", "link", "input", "textarea", "contenteditable", "dialog", "menuitem", "combobox"]) {
		const h = harness(); h.prepare();
		assert.equal(h.press(control), false);
		assert.deepEqual(h.actions, []);
	}
	const h = harness(); h.prepare();
	assert.equal(h.press("activation", {}, false), false);
	assert.equal(h.press("surface", {}, false), false);
	assert.equal(h.press("toolbar-button", {}, false), false);
	assert.deepEqual(h.actions, []);
});

test("board-surface A commits once; modifiers, old chords, composition and preparation do not arrange", () => {
	const h = harness();
	assert.equal(h.press("activation"), false);
	h.prepare();
	for (const flag of ["repeat", "isComposing", "altKey", "shiftKey", "metaKey", "ctrlKey", "defaultPrevented"]) {
		h.press("activation", { [flag]: true });
		assert.deepEqual(h.actions, []);
	}
	assert.equal(h.press("surface", { metaKey: true, key: " " }), false);
	for (const modifier of ["metaKey", "ctrlKey"]) {
		assert.equal(h.press("surface", { key: "Enter", [modifier]: true }), false);
	}
	assert.equal(h.press("surface"), true);
	assert.deepEqual(h.actions, ["arrange", "end-pickup"]);
});

test("a continuing destination keeps its detected count during additions and reductions", () => {
	const h = harness("Done", false, { dragged: null });
	h.prepare();
	assert.equal(h.api().incoming("Done"), 1);
	h.select(["A", "B"]);
	assert.equal(h.api().ready, false);
	assert.equal(h.api().incoming("Done"), 1);
	h.api().arrange();
	assert.deepEqual(h.actions, [], "retained display must not enable a pending plan");
	h.prepare();
	assert.equal(h.api().incoming("Done"), 2);
	h.select(["B"]);
	assert.equal(h.api().ready, false);
	assert.equal(h.api().incoming("Done"), 2);
	h.prepare();
	assert.equal(h.api().incoming("Done"), 1);
});

test("counts disappear when their destination is removed and new destinations wait for detection", () => {
	const h = harness("Done", false, { dragged: null });
	h.prepare();
	h.select(["C"]);
	assert.equal(h.api().incoming("Done"), undefined);
	assert.equal(h.api().incoming("In progress"), undefined);
	h.prepare();
	assert.equal(h.api().incoming("In progress"), 1);
	h.select([]);
	assert.equal(h.api().incoming("In progress"), undefined);
	assert.equal(h.api().ready, false);
});
