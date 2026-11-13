const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createReasoningPhaseState,
	reasoningPhaseReducer,
	selectReasoningPhase,
} = require("./reasoning-phase-machine.ts");

const NOW = 1_000_000;
const input = (overrides = {}) => ({
	isStreaming: false,
	minPreloadMs: 0,
	persistedDuration: undefined,
	persistedStartMs: null,
	responseKey: "r1",
	...overrides,
});
const sync = (state, overrides, now = NOW) => reasoningPhaseReducer(state, { type: "sync", input: input(overrides), now });
const IDLE = createReasoningPhaseState(input());
const STREAMING = sync(IDLE, { isStreaming: true });
const COMPLETED = sync(STREAMING, {}, NOW + 2_100);

test("initial state: idle, or completed from a persisted window", () => {
	assert.deepEqual(IDLE, { lifecycle: { kind: "idle" }, duration: undefined, preload: { locked: false, generation: 0 }, responseKey: "r1" });
	assert.deepEqual(createReasoningPhaseState(input({ persistedDuration: 5 })).lifecycle, { kind: "completed" });
	assert.equal(createReasoningPhaseState(input({ persistedDuration: 5 })).duration, 5);
	assert.deepEqual(createReasoningPhaseState(input({ isStreaming: true, persistedDuration: 5 })).lifecycle, { kind: "idle" }, "a live stream waits for its first sync");
	assert.equal(createReasoningPhaseState(input({ isStreaming: true, persistedDuration: 5 })).duration, undefined);
});

test("idle → streaming records the start, preferring a persisted start", () => {
	assert.deepEqual(STREAMING.lifecycle, { kind: "streaming", startedAt: NOW });
	assert.deepEqual(sync(IDLE, { isStreaming: true, persistedStartMs: 42 }).lifecycle, { kind: "streaming", startedAt: 42 });
});

test("streaming → completed measures whole seconds rounded up", () => {
	assert.deepEqual(COMPLETED.lifecycle, { kind: "completed" });
	assert.equal(COMPLETED.duration, 3);
	assert.equal(sync(STREAMING, {}, NOW).duration, 0);
});

test("completed → streaming clears the duration; a persisted duration then replaces a measured one", () => {
	const restreamed = sync(COMPLETED, { isStreaming: true }, NOW + 5_000);
	assert.deepEqual(restreamed.lifecycle, { kind: "streaming", startedAt: NOW + 5_000 });
	assert.equal(restreamed.duration, undefined);
	const persisted = sync(COMPLETED, { persistedDuration: 7 });
	assert.equal(persisted.duration, 7);
	assert.deepEqual(persisted.lifecycle, { kind: "completed" });
});

test("auto idle leaves completed for idle and keeps the duration; a persisted sync brings it back", () => {
	const idled = reasoningPhaseReducer(COMPLETED, { type: "auto-idle" });
	assert.deepEqual(idled.lifecycle, { kind: "idle" });
	assert.equal(idled.duration, 3);
	assert.deepEqual(sync(idled, { persistedDuration: 3 }).lifecycle, { kind: "completed" });
});

test("a new response key resets from its own inputs", () => {
	assert.deepEqual(sync(COMPLETED, { responseKey: "r2" }), { ...IDLE, responseKey: "r2" });
	assert.deepEqual(sync(COMPLETED, { persistedDuration: 4, responseKey: "r2" }).lifecycle, { kind: "completed" });
	assert.deepEqual(sync(COMPLETED, { isStreaming: true, responseKey: "r2" }, 9).lifecycle, { kind: "streaming", startedAt: 9 });
	assert.deepEqual(sync(STREAMING, { isStreaming: true, responseKey: "r2" }, 9).lifecycle, { kind: "streaming", startedAt: 9 }, "a new key while streaming restarts the clock");
});

test("the minimum preload arms on stream start, outlasts the stream and releases on its own generation", () => {
	const locked = sync(IDLE, { isStreaming: true, minPreloadMs: 800 });
	assert.deepEqual(locked.preload, { locked: true, generation: 1, holdMs: 800 });
	const stopped = sync(locked, { minPreloadMs: 800 });
	assert.equal(stopped.preload, locked.preload, "stopping the stream keeps the hold");
	const released = reasoningPhaseReducer(stopped, { type: "preload-elapsed", generation: 1 });
	assert.deepEqual(released.preload, { locked: false, generation: 1 });
	const rearmed = sync(sync(released, { isStreaming: true, minPreloadMs: 800 }), { minPreloadMs: 800 });
	assert.equal(rearmed.preload.generation, 2);
	assert.deepEqual(sync(locked, { responseKey: "r2" }).preload, { locked: false, generation: 2 }, "a new idle response drops the hold");
	assert.deepEqual(sync(sync(locked, {}), { isStreaming: true }).preload, { locked: false, generation: 2 }, "a restream without a minimum drops the hold");
});

test("selectReasoningPhase: the hold wins, then the live props, then the lifecycle", () => {
	const locked = sync(IDLE, { isStreaming: true, minPreloadMs: 800 });
	assert.equal(selectReasoningPhase(locked, { hasMessageText: true, isStreaming: true }), "preload");
	assert.equal(selectReasoningPhase(STREAMING, { hasMessageText: false, isStreaming: true }), "preload");
	assert.equal(selectReasoningPhase(STREAMING, { hasMessageText: true, isStreaming: true }), "thinking");
	assert.equal(selectReasoningPhase(COMPLETED, { hasMessageText: true, isStreaming: false }), "completed");
	assert.equal(selectReasoningPhase(IDLE, { hasMessageText: true, isStreaming: false }), "idle");
});

test("cannot happen: no-op events return the same state object", () => {
	assert.equal(sync(IDLE, {}), IDLE, "an unchanged idle sync");
	assert.equal(sync(STREAMING, { isStreaming: true }), STREAMING, "an unchanged streaming sync keeps its start time");
	assert.equal(sync(COMPLETED, {}), COMPLETED, "a completed sync without persisted timestamps");
	assert.equal(sync(createReasoningPhaseState(input({ persistedDuration: 5 })), { persistedDuration: 5 }).duration, 5);
	const persisted = createReasoningPhaseState(input({ persistedDuration: 5 }));
	assert.equal(sync(persisted, { persistedDuration: 5 }), persisted, "a persisted window already shown");
	assert.equal(sync(STREAMING, { isStreaming: true, persistedDuration: 5 }), STREAMING, "a persisted duration during a live stream waits for the stream to end");
	assert.equal(reasoningPhaseReducer(IDLE, { type: "auto-idle" }), IDLE, "auto idle outside completed");
	assert.equal(reasoningPhaseReducer(STREAMING, { type: "auto-idle" }), STREAMING, "auto idle cannot end a live stream");
	assert.equal(reasoningPhaseReducer(IDLE, { type: "preload-elapsed", generation: 0 }), IDLE, "no hold to release");
	const locked = sync(IDLE, { isStreaming: true, minPreloadMs: 800 });
	assert.equal(reasoningPhaseReducer(locked, { type: "preload-elapsed", generation: 0 }), locked, "a stale timer from an earlier hold");
});
