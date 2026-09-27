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
	let readyKey = "", timer, api;
	const actions = [], listeners = new Map(), effects = [];
	let effectIndex = 0;
	class Node {}
	class Element extends Node {
		constructor(control = "surface", inside = true) { super(); this.control = control; this.inside = inside; }
		closest(selector) {
			if (selector.includes("data-jira-issue-activation-control") || selector.includes("data-jira-issue-selection-control")) {
				return ["activation", "selection"].includes(this.control) ? this : null;
			}
			const button = ["activation", "selection", "button"].includes(this.control);
			return selector.startsWith("button,") ? button ? this : null
				: selector.startsWith("a,") && !button && this.control !== "surface" ? this : null;
		}
	}
	const root = new Element();
	root.contains = (target) => target.inside;
	const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, "use-board-auto-arrange.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	const loaded = { exports: {} };
	vm.runInNewContext(compiled, {
		module: loaded, exports: loaded.exports, Node, Element,
		setTimeout: (callback) => { timer = callback; return 1; }, clearTimeout() {},
		window: { addEventListener: (type, handler) => listeners.set(type, handler), removeEventListener: (type) => listeners.delete(type) },
		require(name) {
			if (name.includes("board-auto-arrange")) return model;
			return {
				useMemo: (factory) => factory(), useCallback: (callback) => callback,
				useState: () => [readyKey, (next) => { readyKey = next; }],
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
		api = loaded.exports.useBoardAutoArrange({ columns: [{ title: "To do", count: 1, cards: filtered ? [] : [{ code: "A", status: "To do", autoArrangeStatus: status }] }, { title: "Done", count: 0, cards: [] }], selected: new Set(["A"]), dragged, onArrange: () => actions.push("arrange"), beforeArrange: () => actions.push("end-pickup"), boardRef: { current: root } });
		return api;
	}
	render();
	return { actions, listeners, api: () => api, prepare: () => { timer?.(); render(); },
		press(control = "surface", overrides = {}, inside = true) {
			const event = { key: "Enter", target: new Element(control, inside), defaultPrevented: false,
				preventDefault() { this.defaultPrevented = true; }, ...overrides };
			listeners.get("keydown")?.(event);
			return event.defaultPrevented;
		},
	};
}

test("an empty, invalid or filtered plan never enables Return or clears the current gesture", () => {
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

test("Enter arranges from focused card activation and selection controls without a held drag", () => {
	for (const control of ["activation", "selection"]) {
		const h = harness("Done", false, { dragged: null });
		h.prepare();
		assert.equal(h.press(control), true, "prevent native card activation or selection toggle");
		assert.deepEqual(h.actions, ["arrange", "end-pickup"]);
	}
});

test("Enter keeps native behavior for other controls and cards outside this board", () => {
	for (const control of ["button", "link", "input", "dialog", "menuitem", "combobox"]) {
		const h = harness(); h.prepare();
		assert.equal(h.press(control), false);
		assert.deepEqual(h.actions, []);
	}
	const h = harness(); h.prepare();
	assert.equal(h.press("activation", {}, false), false);
	assert.equal(h.press("surface", {}, false), false);
	assert.deepEqual(h.actions, []);
});

test("board-surface Enter commits once; modifiers, composition and preparation do not arrange", () => {
	const h = harness();
	assert.equal(h.press("activation"), false);
	h.prepare();
	for (const flag of ["repeat", "isComposing", "altKey", "ctrlKey", "metaKey", "shiftKey", "defaultPrevented"]) {
		h.press("activation", { [flag]: true });
		assert.deepEqual(h.actions, []);
	}
	assert.equal(h.press(), true);
	assert.deepEqual(h.actions, ["arrange", "end-pickup"]);
});
