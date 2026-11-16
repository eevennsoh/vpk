// Drives useRovoChatCutShortTurn directly with a recording dispatch, so a test
// can check the events a finish snapshot produces and how the short media wait
// is armed from the turn's own record of when it ends.
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { cleanup, renderComponent } = require("../../scripts/lib/render-component.js");

const PROBE_SOURCE = `
	import { Activity } from "react";
	import { CUT_SHORT_MEDIA_WAIT_MS } from "@/app/contexts/use-rovo-chat-media-generation";
	import { useRovoChatCutShortTurn } from "@/app/contexts/use-rovo-chat-cut-short-turn";
	function Hook({ dispatchTurn, queueTick, wait }) {
		window.testCutShort = useRovoChatCutShortTurn(dispatchTurn, queueTick, wait);
		window.testCutShortWaitMs = CUT_SHORT_MEDIA_WAIT_MS;
		return null;
	}
	export default function Probe({ hidden = false, ...props }) {
		return <Activity mode={hidden ? "hidden" : "visible"}><Hook {...props} /></Activity>;
	}
`;

const NOW = 1_000_000;
const PROMPT = Object.freeze({ id: "p1", files: [], text: "Draw a cat", createdAt: 0 });
const user = { id: "u1", role: "user", metadata: { promptId: "p1" }, parts: [{ type: "text", text: "Draw a cat" }] };
const reply = (...parts) => ({ id: "a1", role: "assistant", parts: [{ type: "text", text: "Drawing" }, ...parts] });
const loadingImage = { type: "data-widget-loading", data: { type: "image-preview", loading: true } };

// A fixed clock and captured timeouts, so the delays the hook asks for are exact.
function fakeTimers(t) {
	const clock = { now: NOW };
	const scheduled = [];
	const originals = { now: Date.now, set: globalThis.setTimeout, clear: globalThis.clearTimeout, windowSet: window.setTimeout, windowClear: window.clearTimeout };
	const capture = (callback, delay) => {
		const handle = { delay, callback, cleared: false };
		scheduled.push(handle);
		return handle;
	};
	const release = (handle) => {
		if (handle) handle.cleared = true;
	};
	Date.now = () => clock.now;
	globalThis.setTimeout = capture;
	globalThis.clearTimeout = release;
	window.setTimeout = capture;
	window.clearTimeout = release;
	t.after(() => {
		Date.now = originals.now;
		globalThis.setTimeout = originals.set;
		globalThis.clearTimeout = originals.clear;
		window.setTimeout = originals.windowSet;
		window.clearTimeout = originals.windowClear;
	});
	return { clock, scheduled, live: () => scheduled.filter((handle) => !handle.cleared) };
}

async function mountProbe(t, { strictMode = false } = {}) {
	const events = [];
	let ticks = 0;
	const callbacks = { dispatchTurn: (event) => events.push(event), queueTick: () => { ticks += 1; } };
	const view = await renderComponent({ source: PROBE_SOURCE, props: { ...callbacks, wait: null }, strictMode });
	t.after(async () => {
		await cleanup();
		delete window.testCutShort;
		delete window.testCutShortWaitMs;
	});
	const timers = fakeTimers(t);
	return {
		events,
		timers,
		ticks: () => ticks,
		render: (props) => view.rerender({ ...callbacks, wait: null, ...props }),
		unmount: () => view.unmount(),
		finish: (messages, overrides = {}) => window.testCutShort({ messages, isAbort: false, isError: false, activePrompt: PROMPT, ...overrides }),
		waitMs: () => window.testCutShortWaitMs,
	};
}

test("a cut-short finish with a loading widget records when its short wait ends, and starts no timer itself", async (t) => {
	const probe = await mountProbe(t);
	probe.finish([user, reply(loadingImage)]);
	assert.deepEqual(probe.events, [{
		type: "turnCutShort",
		promptId: "p1",
		finish: { anchorMessageId: "a1", mediaLoading: true },
		mediaWaitEndsAt: NOW + probe.waitMs(),
	}]);
	assert.deepEqual(probe.timers.scheduled, []);
	assert.equal(probe.ticks(), 1);
});

test("a cut-short finish without loading media has no wait, and a finish that is not cut short does nothing", async (t) => {
	const probe = await mountProbe(t);
	probe.finish([user, reply()]);
	assert.deepEqual(probe.events, [{ type: "turnCutShort", promptId: "p1", finish: { anchorMessageId: "a1", mediaLoading: false }, mediaWaitEndsAt: null }]);

	probe.finish([user, reply(loadingImage)], { isAbort: true });
	probe.finish([user, reply(loadingImage)], { isError: true });
	probe.finish([user, reply(loadingImage)], { activePrompt: null });
	assert.equal(probe.events.length, 1);
	assert.equal(probe.ticks(), 1);
});

test("the wait is armed from its deadline for the time left, ends for its prompt, and is cleared when the turn stops waiting", async (t) => {
	const probe = await mountProbe(t);
	const wait = { promptId: "p1", endsAt: NOW + probe.waitMs() };
	probe.timers.clock.now = NOW + 1_000;
	await probe.render({ wait });
	assert.deepEqual(probe.timers.live().map((handle) => handle.delay), [probe.waitMs() - 1_000]);

	// A re-render with the same wait does not restart it.
	await probe.render({ wait: { ...wait } });
	assert.equal(probe.timers.scheduled.length, 1);

	await React.act(async () => probe.timers.live()[0].callback());
	assert.deepEqual(probe.events, [{ type: "cutShortMediaWaitElapsed", promptId: "p1" }]);
	assert.equal(probe.ticks(), 1);

	await probe.render({ wait: null });
	assert.deepEqual(probe.timers.live(), []);
});

// Regression: the timer started in the request callback, so an effect cleanup
// (a provider hidden through <Activity>) cancelled it and nothing armed it again.
test("hidden through Activity the wait is cleared, and shown again it is armed for the time left, or ends at once when that has passed", async (t) => {
	const probe = await mountProbe(t);
	const wait = { promptId: "p1", endsAt: NOW + probe.waitMs() };
	await probe.render({ wait });
	await probe.render({ wait, hidden: true });
	assert.deepEqual(probe.timers.live(), []);

	probe.timers.clock.now = NOW + 2_000;
	await probe.render({ wait, hidden: false });
	assert.deepEqual(probe.timers.live().map((handle) => handle.delay), [probe.waitMs() - 2_000]);

	await probe.render({ wait, hidden: true });
	probe.timers.clock.now = NOW + probe.waitMs() + 1;
	await probe.render({ wait, hidden: false });
	assert.deepEqual(probe.timers.live().map((handle) => handle.delay), [0]);
});

test("under StrictMode one wait stays armed", async (t) => {
	const probe = await mountProbe(t, { strictMode: true });
	await probe.render({ wait: { promptId: "p1", endsAt: NOW + 3_000 } });
	assert.deepEqual(probe.timers.live().map((handle) => handle.delay), [3_000]);
});

test("unmounting clears a pending wait", async (t) => {
	const probe = await mountProbe(t);
	await probe.render({ wait: { promptId: "p1", endsAt: NOW + probe.waitMs() } });
	await probe.unmount();
	assert.deepEqual(probe.timers.live(), []);
});
