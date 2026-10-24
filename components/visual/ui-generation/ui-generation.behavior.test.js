// Behavioral contract for UIGeneration, rendered for real in happy-dom with a driven frame
// clock: what a keyboard user can reach while the UI is still being "generated", that every
// build completes exactly once, and that a build never leaves the real UI hidden or anything
// running once it is cancelled, resized, unmounted or skipped.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const DURATION = 1000;
/** Past `END` in timeline.ts (the overlay is removed at 1.09 of `duration`), with frames to spare. */
const END_MS = DURATION * 1.09 + 100;
/** `PHASES.reveal` starts at 0.74 of `duration`. */
const MID_REVEAL_MS = DURATION * 0.85;

const SOURCE = `
import { UIGeneration } from "@/components/visual/ui-generation";

export default function Harness({ onComplete, playKey, duration }) {
	return (
		<UIGeneration playKey={playKey} duration={duration} onComplete={onComplete}>
			<div>
				<p>Nova</p>
				<button type="button">Follow</button>
			</div>
		</UIGeneration>
	);
}
`;

/**
 * Stands in for the browser's frame loop and ResizeObserver, which happy-dom does not run:
 * `frames(ms)` fires queued animation frames on a 16ms clock that `performance.now()` also
 * reads, and `resize()` notifies observers.
 */
function installClock(t) {
	const saved = {
		requestAnimationFrame: globalThis.requestAnimationFrame,
		cancelAnimationFrame: globalThis.cancelAnimationFrame,
		ResizeObserver: globalThis.ResizeObserver,
		now: performance.now,
	};
	const queue = new Map();
	const observers = new Set();
	let nextId = 0;
	let now = 0;
	globalThis.requestAnimationFrame = (callback) => {
		queue.set(++nextId, callback);
		return nextId;
	};
	globalThis.cancelAnimationFrame = (id) => queue.delete(id);
	performance.now = () => now;
	globalThis.ResizeObserver = class {
		constructor(callback) {
			this.callback = callback;
		}
		observe() {
			observers.add(this);
		}
		disconnect() {
			observers.delete(this);
		}
	};
	t.after(() => {
		const { now: savedNow, ...globals } = saved;
		Object.assign(globalThis, globals);
		performance.now = savedNow;
	});
	return {
		pendingFrames: () => queue.size,
		observing: () => observers.size,
		frames(ms) {
			const until = now + ms;
			while (now < until && queue.size > 0) {
				now += 16;
				const callbacks = [...queue.values()];
				queue.clear();
				for (const callback of callbacks) callback(now);
			}
		},
		resize: () => observers.forEach((observer) => observer.callback([])),
	};
}

/** The build starts after a `delay` timeout and the font check; let both settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

function motionMock(reduce) {
	return { "motion/react": `export const useReducedMotion = () => ${reduce};` };
}

async function renderHarness(t, { reduce = false } = {}) {
	const clock = installClock(t);
	const completions = [];
	const props = { onComplete: () => completions.push("done"), playKey: 0, duration: DURATION };
	// A StrictMode root mounts every effect twice, as in development.
	const view = await renderComponent({ source: SOURCE, mocks: motionMock(reduce), props, strictMode: true });
	const content = view.getByText("Nova").parentElement.parentElement;
	const overlay = content.nextElementSibling;
	await settle();
	return { clock, completions, content, overlay, props, view };
}

const isShown = (el, root) => {
	for (let node = el; node && node !== root; node = node.parentElement) {
		if (Number(node.getAttribute("opacity") ?? 1) === 0 || node.style.opacity === "0") return false;
	}
	return true;
};

test("the UI stays hidden from Tab and assistive tech through the reveal, and is reachable once it is fully in", async (t) => {
	const { clock, completions, content, overlay, view } = await renderHarness(t);

	assert.equal(content.style.opacity, "0");
	assert.deepEqual(view.tabOrder(), []);
	// The drawing is decoration only: assistive tech reads the real UI.
	assert.equal(overlay.getAttribute("aria-hidden"), "true");

	clock.frames(MID_REVEAL_MS);
	assert.ok(overlay.querySelector("svg"), "the drawing is still on screen");
	assert.notEqual(content.style.clipPath, "", "the scan line is mid-way");
	assert.deepEqual(view.tabOrder(), [], "nothing is focusable while it is still being revealed");
	assert.equal(content.getAttribute("aria-hidden"), "true");
	assert.deepEqual(completions, []);

	clock.frames(END_MS);
	assert.deepEqual(view.tabOrder(), ["Follow"]);
	assert.equal(content.getAttribute("aria-hidden"), null);
	assert.equal(content.style.opacity, "");
	assert.equal(overlay.childElementCount, 0);
});

test("an animated build completes exactly once, even under StrictMode", async (t) => {
	const { clock, completions } = await renderHarness(t);

	clock.frames(END_MS + 500);
	assert.deepEqual(completions, ["done"]);
});

test("reduced motion skips the drawing: the UI is reachable at once and completes once under StrictMode", async (t) => {
	const { completions, content, view } = await renderHarness(t, { reduce: true });

	assert.deepEqual(view.tabOrder(), ["Follow"]);
	assert.equal(content.style.opacity, "");
	assert.deepEqual(completions, ["done"]);
});

test("the first frame draws the wireframe at progress 0, so it never flashes complete", async (t) => {
	const { clock, overlay } = await renderHarness(t);

	clock.frames(16);
	const paths = [...overlay.querySelectorAll("path")];
	assert.ok(paths.length > 0, "the drawing is built");
	assert.deepEqual(paths.filter((el) => isShown(el, overlay)).length, 0);
});

test("the dot field is capped however large the target is", async (t) => {
	const { clock, content, overlay } = await renderHarness(t);
	const rect = { left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900, x: 0, y: 0 };
	content.getBoundingClientRect = () => rect;

	clock.frames(16);
	const dots = overlay.querySelector("svg > g").childElementCount;
	assert.ok(dots > 100 && dots <= 1200, `${dots} dots`);
});

test("unmounting after drawing has started leaves no overlay, frames or observers behind", async (t) => {
	const { clock, completions, content, overlay, view } = await renderHarness(t);

	clock.frames(DURATION * 0.4);
	assert.ok(overlay.querySelector("svg"), "drawing has started");
	assert.equal(clock.observing(), 1);

	await view.unmount();
	assert.equal(overlay.childElementCount, 0);
	assert.equal(clock.pendingFrames(), 0);
	assert.equal(clock.observing(), 0);
	assert.equal(content.style.opacity, "");
	assert.equal(content.inert, false);
	assert.deepEqual(completions, [], "a cancelled build does not complete");
});

test("a resize mid-build settles it at once instead of tracing stale geometry", async (t) => {
	const { clock, completions, content, overlay, view } = await renderHarness(t);

	clock.frames(DURATION * 0.3);
	Object.defineProperty(content, "offsetWidth", { configurable: true, value: 600 });
	clock.resize();
	clock.frames(16);
	assert.equal(overlay.childElementCount, 0);
	assert.deepEqual(view.tabOrder(), ["Follow"]);
	assert.equal(clock.observing(), 0);
	assert.deepEqual(completions, ["done"]);
});

test("a replay keeps focus off the hidden UI and gives it back once the UI is in", async (t) => {
	const { clock, content, props, view } = await renderHarness(t);
	clock.frames(END_MS);
	const follow = view.getByRole("button", { name: "Follow" });
	await view.focus(follow);

	await view.rerender({ ...props, playKey: 1 });
	assert.equal(content.contains(document.activeElement), false, "focus is not left inside inert content");
	assert.equal(document.activeElement === document.body, false, "focus is not dropped to the page");

	await settle();
	clock.frames(END_MS);
	assert.equal(view.isFocused(follow), true);
	assert.equal(content.parentElement.getAttribute("tabindex"), null, "the wrapper's tabindex is restored");
});

test("cancelling a build mid-flight restores the real UI as it was", async (t) => {
	const { clock, content, props, view } = await renderHarness(t);

	clock.frames(DURATION * 0.5);
	// A new playKey cancels the running build before starting the next one.
	await view.rerender({ ...props, playKey: 1 });
	assert.equal(content.style.opacity, "0", "the replay hides the UI again");
	await view.unmount();
	assert.equal(content.style.opacity, "");
	assert.equal(content.style.clipPath, "");
	assert.equal(content.inert, false);
	assert.equal(content.getAttribute("aria-hidden"), null);
});
