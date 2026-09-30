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

/** Swaps the frame and timer globals the handoff schedules on, for this test only. */
function withClock(t, fake) {
	const previous = Object.fromEntries(Object.keys(fake).map((name) => [name, globalThis[name]]));
	Object.assign(globalThis, fake);
	t.after(() => Object.assign(globalThis, previous));
}

test("a move's commit waits for the next frame, and work that arrives meanwhile queues behind it in order", () => {
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
	withClock(t, {
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
