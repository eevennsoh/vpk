const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveTimedTransition, resolveTimedTransitionEnd } = require("./use-timed-transition.ts");

const CHAIN = {
	queued: { next: "running", delayMs: 1_200 },
	running: { next: "passed", delayMs: 1_500 },
};
const LOOP = {
	a: { next: "b", delayMs: 100 },
	b: { next: "a", delayMs: 100 },
};

test("a state with a row waits for its delay, then advances one step", () => {
	assert.deepEqual(resolveTimedTransition("queued", CHAIN, false), { kind: "wait", next: "running", delayMs: 1_200 });
	assert.deepEqual(resolveTimedTransition("running", CHAIN, false), { kind: "wait", next: "passed", delayMs: 1_500 });
});

test("reduced motion jumps from any step straight to the resting state", () => {
	assert.deepEqual(resolveTimedTransition("queued", CHAIN, true), { kind: "jump", next: "passed" });
	assert.deepEqual(resolveTimedTransition("running", CHAIN, true), { kind: "jump", next: "passed" });
	assert.equal(resolveTimedTransitionEnd("queued", CHAIN), "passed");
});

test("cannot happen: a resting state, a paused sequence or a reduced-motion loop schedules nothing", () => {
	const rest = resolveTimedTransition("passed", CHAIN, false);
	assert.deepEqual(rest, { kind: "rest" });
	assert.equal(resolveTimedTransition("passed", CHAIN, true), rest, "rest is one shared object");
	assert.deepEqual(resolveTimedTransition(null, CHAIN, false), { kind: "rest" });
	assert.deepEqual(resolveTimedTransition(null, CHAIN, true), { kind: "rest" });
	assert.equal(resolveTimedTransitionEnd("a", LOOP), null);
	assert.deepEqual(resolveTimedTransition("a", LOOP, true), { kind: "rest" }, "a loop holds still under reduced motion");
	assert.deepEqual(resolveTimedTransition("a", LOOP, false), { kind: "wait", next: "b", delayMs: 100 }, "a loop still runs with motion");
});
