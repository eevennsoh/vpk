const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const esbuild = require("esbuild");
const React = require("react");
const { parseHTML } = require("linkedom");
const { createRoot } = require("react-dom/client");

const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const { getResistedMinimumWidth } = loadRovoCoreModule("hooks/use-sidebar-resize.ts");

function loadUseSidebarResize() {
	const entryPoint = path.join(
		process.cwd(),
		"components/projects/rovo-core/hooks/use-sidebar-resize.ts",
	);
	const result = esbuild.buildSync({
		entryPoints: [entryPoint],
		bundle: true,
		external: ["react"],
		format: "cjs",
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text, "use-sidebar-resize-test-harness.cjs")
		.useSidebarResize;
}

function createPointerEvent(window, type, clientX) {
	const event = new window.Event(type, { bubbles: true });
	Object.defineProperty(event, "clientX", { value: clientX });
	return event;
}

test("minimum-width resistance becomes progressively firmer without crossing the cutoff", () => {
	const minWidth = 440;
	const startWidth = 720;
	const firstWidth = getResistedMinimumWidth(470, startWidth, minWidth);
	const secondWidth = getResistedMinimumWidth(450, startWidth, minWidth);
	const thirdWidth = getResistedMinimumWidth(430, startWidth, minWidth);

	assert.ok(firstWidth > secondWidth);
	assert.ok(secondWidth > thirdWidth);
	assert.ok(thirdWidth > minWidth);
	assert.ok(firstWidth - secondWidth > secondWidth - thirdWidth);
	assert.equal(getResistedMinimumWidth(600, startWidth, minWidth), 600);
	assert.equal(getResistedMinimumWidth(400, minWidth, minWidth), minWidth);
});

test("pointer cancellation restores the committed width and ends the resize", async () => {
	const { window } = parseHTML("<!doctype html><html><body><div id='app'></div></body></html>");
	const originalGlobals = {
		document: globalThis.document,
		Event: globalThis.Event,
		HTMLElement: globalThis.HTMLElement,
		Node: globalThis.Node,
		window: globalThis.window,
		actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
		requestAnimationFrame: globalThis.requestAnimationFrame,
		cancelAnimationFrame: globalThis.cancelAnimationFrame,
	};
	const frames = new Map();
	let frameId = 0;
	const flushFrame = async () => {
		await React.act(async () => {
			const pending = [...frames.values()];
			frames.clear();
			for (const callback of pending) callback();
		});
	};
	Object.assign(globalThis, {
		document: window.document,
		Event: window.Event,
		HTMLElement: window.HTMLElement,
		Node: window.Node,
		window,
		IS_REACT_ACT_ENVIRONMENT: true,
		requestAnimationFrame: (callback) => { frames.set(++frameId, callback); return frameId; },
		cancelAnimationFrame: (id) => frames.delete(id),
	});

	const useSidebarResize = loadUseSidebarResize();
	let resize = null;
	let setMaxWidth = null;
	let setOptions = null;
	function Probe() {
		const [maxWidth, setProbeMaxWidth] = React.useState(720);
		setMaxWidth = setProbeMaxWidth;
		const [options, setProbeOptions] = React.useState({});
		setOptions = setProbeOptions;
		resize = useSidebarResize({ defaultWidth: 440, maxWidth, minWidth: 440, ...options });
		return null;
	}

	const root = createRoot(window.document.getElementById("app"));
	try {
		await React.act(async () => {
			root.render(React.createElement(Probe));
		});
		await React.act(async () => {
			resize.onResizeHandlePointerDown({
				clientX: 500,
				pointerId: 1,
				preventDefault() {},
				target: { setPointerCapture() {} },
			});
		});
		await React.act(async () => {
			window.document.dispatchEvent(createPointerEvent(window, "pointermove", 550));
		});
		assert.equal(resize.sidebarWidth, 440, "continuous input waits for a frame");
		assert.equal(frames.size, 1);
		await React.act(async () => {
			window.document.dispatchEvent(createPointerEvent(window, "pointermove", 560));
			window.document.dispatchEvent(createPointerEvent(window, "pointermove", 550));
		});
		assert.equal(frames.size, 1, "a burst retains one latest frame");
		await flushFrame();
		assert.equal(resize.sidebarWidth, 490);
		assert.equal(resize.isResizing, true);

		await React.act(async () => {
			window.document.dispatchEvent(createPointerEvent(window, "pointermove", 700));
			window.document.dispatchEvent(createPointerEvent(window, "pointercancel", 550));
		});
		assert.equal(resize.sidebarWidth, 440);
		assert.equal(resize.isResizing, false);
		assert.equal(frames.size, 0, "cancel retires a queued move");
		await flushFrame();
		assert.equal(resize.sidebarWidth, 440);

		await React.act(async () => {
			resize.onResizeHandlePointerDown({ clientX: 500, pointerId: 2, preventDefault() {}, target: { setPointerCapture() {} } });
		});
		await React.act(async () => {
			window.document.dispatchEvent(createPointerEvent(window, "pointermove", 700));
			window.document.dispatchEvent(createPointerEvent(window, "pointerup", 580));
		});
		assert.equal(resize.sidebarWidth, 520, "release resolves its own final coordinates");
		assert.equal(frames.size, 0);
		await flushFrame();
		assert.equal(resize.sidebarWidth, 520);

		await React.act(async () => {
			setMaxWidth(1000);
		});
		await React.act(async () => {
			resize.onResizeHandleKeyDown({
				key: "End",
				preventDefault() {},
				stopPropagation() {},
			});
		});
		assert.equal(resize.maxWidth, 1000);
		assert.equal(resize.sidebarWidth, 1000);

		await React.act(async () => {
			setMaxWidth(800);
		});
		assert.equal(resize.sidebarWidth, 800);

		await React.act(async () => { setOptions({ direction: "rtl", minWidthResistance: true }); });
		await React.act(async () => { resize.onResizeHandleKeyDown({ key: "Home", preventDefault() {}, stopPropagation() {} }); });
		await React.act(async () => { resize.onResizeHandlePointerDown({ clientX: 500, pointerId: 3, preventDefault() {}, target: { setPointerCapture() {} } }); });
		await React.act(async () => { window.document.dispatchEvent(createPointerEvent(window, "pointermove", 420)); });
		await flushFrame();
		assert.equal(resize.sidebarWidth, 520, "RTL movement grows toward the left");
		await React.act(async () => { window.document.dispatchEvent(createPointerEvent(window, "pointerup", 420)); });
		assert.equal(resize.sidebarWidth, 520);

		await React.act(async () => { resize.onResizeHandlePointerDown({ clientX: 500, pointerId: 4, preventDefault() {}, target: { setPointerCapture() {} } }); });
		await React.act(async () => {
			window.document.dispatchEvent(createPointerEvent(window, "pointermove", 400));
			window.document.dispatchEvent(createPointerEvent(window, "pointerup", 700));
		});
		assert.equal(resize.sidebarWidth, Math.round(getResistedMinimumWidth(320, 520, 440)), "resistance resolves the final release before a queued frame");
		assert.equal(frames.size, 0);

		let collapses = 0;
		await React.act(async () => { setOptions({ onCollapse: () => { collapses += 1; } }); });
		await React.act(async () => { resize.onResizeHandleKeyDown({ key: "Home", preventDefault() {}, stopPropagation() {} }); });
		await React.act(async () => { resize.onResizeHandlePointerDown({ clientX: 500, pointerId: 5, preventDefault() {}, target: { setPointerCapture() {} } }); });
		await React.act(async () => {
			window.document.dispatchEvent(createPointerEvent(window, "pointermove", 650));
			window.document.dispatchEvent(createPointerEvent(window, "pointerup", 300));
		});
		assert.equal(collapses, 1, "collapse uses release coordinates even before a frame");
		assert.equal(resize.willCollapse, false);
		assert.equal(resize.sidebarWidth, 440);
		assert.equal(frames.size, 0);

		await React.act(async () => { resize.onResizeHandlePointerDown({ clientX: 500, pointerId: 6, preventDefault() {}, target: { setPointerCapture() {} } }); });
		await React.act(async () => { window.document.dispatchEvent(createPointerEvent(window, "pointermove", 650)); });
		assert.equal(frames.size, 1);

	} finally {
		await React.act(async () => {
			root.unmount();
		});
		assert.equal(frames.size, 0, "unmount retires pending input");
		Object.assign(globalThis, originalGlobals);
	}
});
