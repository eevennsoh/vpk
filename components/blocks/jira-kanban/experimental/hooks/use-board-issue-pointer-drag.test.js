const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function harness({ enabled = true, face = true, nestedControl = false } = {}) {
	const frames = new Map();
	const events = [];
	let cleanup;
	let focused = false;
	class Element {
		constructor() { this.listeners = new Map(); this.draggable = true; }
		addEventListener(type, handler) { this.listeners.set(type, handler); }
		removeEventListener(type) { this.listeners.delete(type); }
		dispatchEvent(event) { events.push(event.type); }
	}
	const source = new Element();
	const cardFace = new Element();
	const control = new Element();
	control.hasAttribute = () => false;
	source.closest = () => source;
	const target = new Element();
	target.closest = (selector) => selector === '[draggable="true"]' ? source
		: selector === '[data-slot="jira-issue-card"]' ? face ? cardFace : null
		: selector.startsWith("button,") && nestedControl ? control : null;
	const destination = new Element();
	const doc = new Element();
	doc.elementFromPoint = () => destination;
	const root = new Element();
	root.ownerDocument = doc;
	root.contains = () => true;
	root.focus = () => { focused = true; doc.activeElement = root; };
	root.blur = () => { focused = false; doc.activeElement = null; };
	root.getBoundingClientRect = () => ({ left: 0, right: 1000 });
	const win = new Element();
	const loaded = { exports: {} };
	const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, "use-board-issue-pointer-drag.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	vm.runInNewContext(compiled, {
		module: loaded, exports: loaded.exports, Element, window: win,
		DataTransfer: class {}, DragEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
		requestAnimationFrame: (callback) => { frames.set(1, callback); return 1; },
		cancelAnimationFrame: (id) => frames.delete(id),
		require: () => ({ useRef: (current) => ({ current }), useCallback: (callback) => callback, useEffect: (effect) => { cleanup = effect(); } }),
	});
	const api = loaded.exports.useBoardIssuePointerDrag({ current: root }, enabled);
	const fire = (owner, type, extra = {}) => owner.listeners.get(type)?.({ target, pointerId: 1, isPrimary: true, button: 0, clientX: 100, clientY: 100, preventDefault() {}, stopPropagation() {}, ...extra });
	return { source, root, doc, win, events, frames, api, focused: () => focused, cleanup: () => cleanup?.(),
		down: () => fire(root, "pointerdown"), move: (x) => fire(doc, "pointermove", { clientX: x }), up: () => fire(doc, "pointerup"),
		key: (key) => fire(doc, "keydown", { key }), tick: () => { const callback = frames.get(1); frames.clear(); callback?.(); },
		click: () => { let blocked = false; fire(doc, "click", { preventDefault() { blocked = true; } }); return blocked; },
	};
}

test("the actual issue-card face disables native dragging before pickup so Return remains available", () => {
	const h = harness();
	h.down();
	assert.equal(h.source.draggable, false);
	h.move(104);
	assert.deepEqual(h.events, []);
	h.move(110);
	assert.equal(h.focused(), true);
	assert.deepEqual(h.events, ["dragstart"]);
	h.move(120);
	assert.equal(h.frames.size, 1, "pointer work is coalesced");
	h.tick();
	assert.deepEqual(h.events, ["dragstart", "dragenter", "dragover"]);
	// Return's arrange action ends this transport before committing the plan.
	h.api.stop();
	h.up();
	assert.equal(h.source.draggable, true);
	assert.equal(h.focused(), false, "the pointer-only shortcut focus does not leave a board ring");
	assert.equal(h.events.at(-1), "dragend");
	assert.equal(h.events.includes("drop"), false, "release cannot override an automatic arrangement");
	assert.equal(h.click(), true, "release cannot activate the issue");
	h.cleanup();
	assert.equal(h.doc.listeners.size, 0);
});

test("manual release preserves the existing drop handlers; Escape and short clicks never drop", () => {
	const h = harness();
	h.down(); h.move(120); h.tick(); h.up();
	assert.deepEqual(h.events.slice(-2), ["drop", "dragend"]);
	const cancelled = harness();
	cancelled.down(); cancelled.move(120); cancelled.key("Escape"); cancelled.up();
	assert.deepEqual(cancelled.events, ["dragstart", "dragend"]);
	const clicked = harness();
	clicked.down(); clicked.up();
	assert.deepEqual(clicked.events, []);
	assert.equal(clicked.source.draggable, true);
	assert.equal(clicked.click(), false);
});

test("session chins, nested controls and capability-absent boards keep their original interaction", () => {
	for (const options of [{ face: false }, { nestedControl: true }, { enabled: false }]) {
		const h = harness(options);
		h.down(); h.move(120); h.up();
		assert.equal(h.source.draggable, true);
		assert.deepEqual(h.events, []);
	}
});

test("ending an idle transport preserves genuine keyboard focus", () => {
	const h = harness();
	h.root.focus();
	h.api.stop();
	assert.equal(h.focused(), true);
});
