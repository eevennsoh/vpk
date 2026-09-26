const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const esbuild = require("esbuild");
const ts = require("typescript");
const { loadCjsModuleFromText } = require("../../../../../scripts/lib/esbuild-cjs-loader.js");
const model = loadCjsModuleFromText(esbuild.buildSync({ entryPoints: ["components/blocks/jira-kanban/experimental/lib/board-auto-arrange.ts"], bundle: true, format: "cjs", platform: "node", write: false }).outputFiles[0].text);

function harness(status = "Done", filtered = false) {
	let readyKey = "", timer, api;
	const actions = [], listeners = new Map(), effects = [];
	let effectIndex = 0;
	const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, "use-board-auto-arrange.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	const loaded = { exports: {} };
	vm.runInNewContext(compiled, {
		module: loaded, exports: loaded.exports,
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
		api = loaded.exports.useBoardAutoArrange({ columns: [{ title: "To do", count: 1, cards: filtered ? [] : [{ code: "A", status: "To do", autoArrangeStatus: status }] }, { title: "Done", count: 0, cards: [] }], selected: new Set(["A"]), dragged: "A", onArrange: () => actions.push("arrange"), beforeArrange: () => actions.push("end-pickup"), boardRef: { current: {} } });
		return api;
	}
	render();
	return { actions, listeners, api: () => api, prepare: () => { timer?.(); render(); } };
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
