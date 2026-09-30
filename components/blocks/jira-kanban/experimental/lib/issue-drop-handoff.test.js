const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

let loaded;
function load() {
	loaded ??= loadCjsModuleFromText(esbuild.buildSync({
		entryPoints: [path.join(__dirname, "issue-drop-handoff.ts")],
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "issue-drop-handoff-harness.cjs");
	return loaded;
}

function withWindow(t, fake) {
	const previous = globalThis.window;
	globalThis.window = fake;
	t.after(() => {
		if (previous === undefined) delete globalThis.window;
		else globalThis.window = previous;
	});
}

test("a drop's commit waits for the release frame, and the drag's end queues behind it in order", () => {
	const { createIssueDropHandoff } = load();
	let presented = null;
	let cancelled = 0;
	const handoff = createIssueDropHandoff((run) => {
		presented = run;
		return () => { cancelled += 1; };
	});
	const calls = [];
	handoff.defer(() => calls.push("drop"));
	// The source's dragend fires in the same task as the drop.
	handoff.then(() => calls.push("dragend"));
	// Regression: committed inside the drop event, the move held the release
	// frame for its whole remount, so nothing reached the screen for ~80ms.
	assert.deepEqual(calls, [], "nothing commits until the release frame has been presented");
	presented();
	assert.deepEqual(calls, ["drop", "dragend"], "then the owner sees the same updates, in order");
	handoff.then(() => calls.push("cancelled drag"));
	assert.deepEqual(calls.at(-1), "cancelled drag", "with no drop waiting, a drag's end runs at once");
	handoff.defer(() => calls.push("second drop"));
	handoff.flush();
	assert.equal(calls.at(-1), "second drop", "unmount runs a waiting drop rather than losing the move");
	assert.equal(cancelled, 2, "and retires its scheduled frame");
});

test("the handoff runs after the release frame has painted, or after a backstop if frames stall", (t) => {
	const { afterNextPresentedFrame } = load();
	const frames = [];
	const timers = new Map();
	let nextTimer = 0;
	withWindow(t, {
		requestAnimationFrame: (callback) => frames.push(callback),
		cancelAnimationFrame: (id) => { frames[id - 1] = null; },
		setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
		clearTimeout: (id) => { timers.delete(id); },
	});
	const runTimer = (predicate) => {
		const [id, timer] = [...timers].find(([, entry]) => predicate(entry.delay)) ?? [];
		if (id === undefined) return false;
		timers.delete(id);
		timer.callback();
		return true;
	};
	let ran = 0;
	afterNextPresentedFrame(() => { ran += 1; });
	assert.equal(ran, 0);
	frames.shift()();
	assert.equal(ran, 0, "the frame callback only queues it, behind that frame's paint");
	runTimer((delay) => delay === 0);
	assert.equal(ran, 1);
	assert.equal(timers.size, 0, "the backstop is retired");
	// A hidden page never delivers the frame: the backstop still commits the drop.
	afterNextPresentedFrame(() => { ran += 1; });
	runTimer((delay) => delay > 0);
	assert.equal(ran, 2);
	const cancel = afterNextPresentedFrame(() => { ran += 1; });
	cancel();
	assert.equal(timers.size, 0);
	assert.equal(ran, 2, "a cancelled handoff never runs");
});

test("the released traveller fades out and shrinks from where it was let go, then leaves the page", (t) => {
	const { settleIssueCohortPreview } = load();
	const timers = [];
	withWindow(t, {
		setTimeout: (callback) => timers.push(callback),
		clearTimeout: () => {},
	});
	const traveller = () => {
		const listeners = new Map();
		return {
			removed: false,
			style: { transform: "translate3d(412px, 318px, 0)" },
			addEventListener: (name, listener) => listeners.set(name, listener),
			remove() { this.removed = true; },
			fire: (name) => listeners.get(name)?.(),
		};
	};
	const node = traveller();
	settleIssueCohortPreview(node, false);
	assert.equal(node.removed, false, "it stays up to fade while the commit lands its cards");
	assert.equal(node.style.opacity, "0");
	assert.equal(node.style.transform, "translate3d(412px, 318px, 0) scale(0.96)", "in place, where the pointer left it");
	// Opacity and transform only, on the exit tokens: the compositor runs it through the commit.
	assert.equal(node.style.transition, "opacity var(--duration-normal) var(--ease-in), transform var(--duration-normal) var(--ease-in)");
	node.fire("transitionend");
	assert.equal(node.removed, true);
	const stalled = traveller();
	settleIssueCohortPreview(stalled, false);
	timers.at(-1)();
	assert.equal(stalled.removed, true, "a missed transitionend cannot leave it on the page");
	const reduced = traveller();
	settleIssueCohortPreview(reduced, true);
	assert.equal(reduced.removed, true, "reduced motion removes it at once");
	assert.equal(reduced.style.opacity, undefined);
});
