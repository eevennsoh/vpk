const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function scrollHarness(pointerY = 288.5) {
	const frames = new Map();
	let nextId = 0;
	let cleanup;
	let scrollTop = 0;
	const list = {
		clientHeight: 432,
		scrollHeight: 1200,
		get scrollTop() { return scrollTop; },
		set scrollTop(value) { scrollTop = Math.round(value); },
		getBoundingClientRect: () => ({ left: 0, right: 274, top: 0, bottom: 432, height: 432 }),
	};
	const root = {
		querySelector: () => null,
		querySelectorAll: () => [list],
		addEventListener() {},
		removeEventListener() {},
	};
	const module = { exports: {} };
	const source = fs.readFileSync(path.join(__dirname, "use-board-session-drag-scroll.ts"), "utf8");
	const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	vm.runInNewContext(compiled, {
		module,
		exports: module.exports,
		require(name) {
			assert.equal(name, "react");
			return { useEffect: (effect) => { cleanup = effect(); } };
		},
		requestAnimationFrame: (callback) => { frames.set(++nextId, callback); return nextId; },
		cancelAnimationFrame: (id) => frames.delete(id),
		ResizeObserver: class { observe() {} disconnect() {} },
		document: { addEventListener() {}, removeEventListener() {} },
		window: { addEventListener() {}, removeEventListener() {} },
	});
	module.exports.useBoardSessionDragScroll({
		active: true,
		rootRef: { current: root },
		transactionRef: { current: { pointer: { x: 100, y: pointerY }, target: { kind: "attach" } } },
		onGeometryChange() {},
	});
	return {
		list,
		frames,
		cleanup: () => cleanup(),
		tick(time) {
			assert.equal(frames.size, 1, "the scrolling frame remains scheduled");
			const [id, callback] = frames.entries().next().value;
			frames.delete(id);
			callback(time);
		},
	};
}

test("120 Hz and subpixel frames keep edge scrolling active", () => {
	const h = scrollHarness();
	h.tick(100);
	h.tick(108.3); // A valid 120 Hz frame requests 0.996px of movement.
	h.tick(109.3); // Integer scroll containers round this frame's movement away.
	h.tick(116.6);
	assert.ok(h.list.scrollTop > 2);
	assert.equal(h.frames.size, 1);
	h.cleanup();
	assert.equal(h.frames.size, 0);
});

test("neutral pointer positions and reached boundaries stop the scroll loop", () => {
	const neutral = scrollHarness(216);
	neutral.tick(100);
	assert.equal(neutral.frames.size, 0);
	neutral.cleanup();
	const bounded = scrollHarness();
	bounded.list.scrollTop = bounded.list.scrollHeight - bounded.list.clientHeight;
	bounded.tick(100);
	assert.equal(bounded.frames.size, 0);
	bounded.cleanup();
});
