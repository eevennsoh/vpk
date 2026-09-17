const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const hookPath = path.join(process.cwd(), "components/hooks/use-has-vertical-overflow.ts");

async function loadOverflowHarness() {
	return import(pathToFileURL(hookPath).href);
}

test("useHasVerticalOverflow does not update state after every render", () => {
	const source = fs.readFileSync(hookPath, "utf8");

	assert.doesNotMatch(
		source,
		/useEffect\(\(\) => \{\s*updateScrollState\(\);\s*\}\);/,
		"an effect without dependencies creates a setState-render loop",
	);
});

// The hook reads `window.getComputedStyle` to spot boxless wrappers. Node has no
// DOM, so stand in a minimal window that reports each stub node's own display.
function withComputedDisplay(run) {
	const originalWindow = globalThis.window;
	globalThis.window = {
		getComputedStyle: (node) => ({ display: node.display ?? "block" }),
	};

	try {
		return run();
	} finally {
		globalThis.window = originalWindow;
	}
}

test("vertical overflow resize tracking stays at the scroll container boundary", async () => {
	const { getVerticalOverflowResizeTargets } = await loadOverflowHarness();
	const nestedDescendant = { children: [] };
	const firstChild = { children: [nestedDescendant] };
	const secondChild = { children: [] };
	const scrollContainer = { children: [firstChild, secondChild] };

	withComputedDisplay(() => {
		assert.deepEqual(
			getVerticalOverflowResizeTargets(scrollContainer),
			[scrollContainer, firstChild, secondChild],
		);
	});
});

test("vertical overflow resize tracking descends through boxless layout wrappers", async () => {
	const { getVerticalOverflowResizeTargets } = await loadOverflowHarness();
	// A ResizeObserver on a `display: contents` wrapper never reports a size
	// change, so the layout owner beneath it has to be observed directly.
	const layoutOwner = { children: [{ children: [] }] };
	const innerBoxlessWrapper = { children: [layoutOwner], display: "contents" };
	const outerBoxlessWrapper = { children: [innerBoxlessWrapper], display: "contents" };
	const boxedSibling = { children: [{ children: [] }] };
	const scrollContainer = { children: [outerBoxlessWrapper, boxedSibling] };

	withComputedDisplay(() => {
		assert.deepEqual(
			getVerticalOverflowResizeTargets(scrollContainer),
			[scrollContainer, layoutOwner, boxedSibling],
			"boxless wrappers resolve to their layout owners without observing deeper descendants",
		);
	});
});

test("VerticalOverflowState does not show masks for one-pixel layout jitter", async () => {
	const { getVerticalOverflowState } = await loadOverflowHarness();

	const state = getVerticalOverflowState({
		clientHeight: 80,
		maxHeight: 80,
		scrollHeight: 81,
		scrollTop: 0,
	});

	assert.equal(state.hasReachedVerticalLimit, true);
	assert.equal(state.hasVerticalOverflow, false);
	assert.equal(state.showTopScrollMask, false);
	assert.equal(state.showBottomScrollMask, false);
});

test("VerticalOverflowState shows the lower mask until the user reaches the bottom", async () => {
	const { getVerticalOverflowState } = await loadOverflowHarness();

	const atTop = getVerticalOverflowState({
		clientHeight: 80,
		maxHeight: 80,
		scrollHeight: 160,
		scrollTop: 0,
	});
	const nearBottom = getVerticalOverflowState({
		clientHeight: 80,
		maxHeight: 80,
		scrollHeight: 160,
		scrollTop: 79,
	});

	assert.equal(atTop.hasVerticalOverflow, true);
	assert.equal(atTop.hasScrolledFromTop, false);
	assert.equal(atTop.hasScrolledToBottom, false);
	assert.equal(atTop.showTopScrollMask, false);
	assert.equal(atTop.showBottomScrollMask, true);
	assert.equal(nearBottom.hasScrolledFromTop, true);
	assert.equal(nearBottom.hasScrolledToBottom, true);
	assert.equal(nearBottom.showTopScrollMask, true);
	assert.equal(nearBottom.showBottomScrollMask, false);
});

test("VerticalOverflowState requires a finite max height before reporting a reached limit", async () => {
	const { getVerticalOverflowState } = await loadOverflowHarness();

	assert.equal(
		getVerticalOverflowState({
			clientHeight: 80,
			maxHeight: Number.NaN,
			scrollHeight: 160,
			scrollTop: 0,
		}).hasReachedVerticalLimit,
		false,
	);
	assert.equal(
		getVerticalOverflowState({
			clientHeight: 80,
			maxHeight: 80,
			scrollHeight: 160,
			scrollTop: 0,
		}).hasReachedVerticalLimit,
		true,
	);
});

test("overflow masks refresh after style-only animation changes and cancel queued measurement on cleanup", async () => {
	const { getVerticalOverflowState, subscribeToVerticalOverflow } = await loadOverflowHarness();
	const originals = {
		window: globalThis.window,
		ResizeObserver: globalThis.ResizeObserver,
		MutationObserver: globalThis.MutationObserver,
	};
	const frames = new Map();
	let nextFrame = 0;
	const mutations = [];
	globalThis.window = {
		getComputedStyle: () => ({ display: "block" }),
		requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
		cancelAnimationFrame(id) { frames.delete(id); },
	};
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
	globalThis.MutationObserver = class {
		constructor(callback) { this.callback = callback; mutations.push(this); }
		observe(_element, options) { this.options = options; }
		disconnect() { this.disconnected = true; }
		emit(attributeName) {
			if (!this.disconnected && this.options.attributes && this.options.attributeFilter.includes(attributeName)) {
				this.callback([{ type: "attributes", attributeName }]);
			}
		}
	};
	const element = {
		children: [{ children: [] }],
		clientHeight: 80,
		scrollHeight: 160,
		scrollTop: 0,
		addEventListener() {},
		removeEventListener() {},
	};
	const read = () => getVerticalOverflowState({ ...element, maxHeight: 80 });
	let state = read();
	let measurements = 0;
	let stop;
	const flush = () => {
		for (const [id, callback] of frames) {
			frames.delete(id);
			callback();
		}
	};
	try {
		stop = subscribeToVerticalOverflow(element, () => { measurements += 1; state = read(); });
		const mutation = mutations[0];
		assert.equal(state.showBottomScrollMask, true);
		// A translated descendant settles without changing either observed layout box.
		element.scrollHeight = 80;
		mutation.emit("style");
		mutation.emit("style");
		mutation.emit("class");
		flush();
		assert.equal(state.showBottomScrollMask, false);
		assert.equal(state.showTopScrollMask, false);
		assert.equal(measurements, 1, "a burst of geometry changes needs one measurement");
		element.scrollHeight = 160;
		mutation.emit("style");
		stop();
		flush();
		assert.equal(measurements, 1, "cleanup cancels queued reads and state updates");
	} finally {
		stop?.();
		Object.assign(globalThis, originals);
	}
});
