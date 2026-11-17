const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { cleanup, renderComponent } = require("../../scripts/lib/render-component.js");

const PROBE = `
	import { Activity } from "react";
	import { useRovoChatRetry } from "@/app/contexts/use-rovo-chat-retry";
	function Hook({ retry, show, resend, dispatch }) {
		window.scheduleRetry = useRovoChatRetry(retry, show, resend, dispatch);
		return null;
	}
	export default function Probe({ hidden = false, ...props }) {
		return <Activity mode={hidden ? "hidden" : "visible"}><Hook {...props} /></Activity>;
	}
`;

async function mountProbe(t, strictMode = false) {
	const events = [];
	const messages = [];
	const sends = [];
	const props = {
		retry: null, show: (message) => messages.push(message),
		resend: { current: async (retry) => { sends.push(retry); } },
		dispatch: (event) => events.push(event),
	};
	const view = await renderComponent({ source: PROBE, props, strictMode });
	t.after(async () => { await cleanup(); delete window.scheduleRetry; });
	const clock = { wall: 1_000_000, monotonic: 10_000 };
	const timers = [];
	const intervals = [];
	const original = { now: Date.now, monotonic: performance.now, set: globalThis.setTimeout, clear: globalThis.clearTimeout, interval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
	const capture = (entries) => (callback, delay) => {
		const handle = { callback, delay, cleared: false };
		entries.push(handle);
		return handle;
	};
	Date.now = () => clock.wall;
	performance.now = () => clock.monotonic;
	globalThis.setTimeout = capture(timers);
	globalThis.setInterval = capture(intervals);
	globalThis.clearTimeout = globalThis.clearInterval = (handle) => { if (handle) handle.cleared = true; };
	t.after(() => {
		Date.now = original.now;
		performance.now = original.monotonic;
		globalThis.setTimeout = original.set;
		globalThis.clearTimeout = original.clear;
		globalThis.setInterval = original.interval;
		globalThis.clearInterval = original.clearInterval;
	});
	const schedule = () => {
		window.scheduleRetry({ promptId: "p", messageId: "retry", reason: "rate-limit", delayMs: 5_000 });
		return events.at(-1).retry;
	};
	return {
		clock, events, messages, sends, schedule,
		timers: () => timers.filter((timer) => !timer.cleared),
		intervals: () => intervals.filter((timer) => !timer.cleared),
		render: (next) => view.rerender({ ...props, ...next }),
	};
}

test("retry scheduling records deadlines and creates no imperative timers", async (t) => {
	const probe = await mountProbe(t);
	const retry = probe.schedule();
	assert.equal(retry.dueAt, probe.clock.wall + 5_000);
	assert.equal(retry.monotonicDueAt, probe.clock.monotonic + 5_000);
	assert.deepEqual(probe.timers(), []);
	assert.deepEqual(probe.intervals(), []);
});

test("Activity reveal re-arms retry and countdown for the remaining time, then retries once", async (t) => {
	const probe = await mountProbe(t);
	const retry = probe.schedule();
	await probe.render({ retry });
	await probe.render({ retry, hidden: true });
	assert.deepEqual(probe.timers(), []);
	assert.deepEqual(probe.intervals(), []);
	probe.clock.wall += 2_000;
	probe.clock.monotonic += 2_000;
	await probe.render({ retry });
	assert.deepEqual(probe.timers().map((timer) => timer.delay), [3_000]);
	assert.equal(probe.messages.at(-1).parts[0].text.includes("3 seconds"), true);
	probe.clock.monotonic += 1_000;
	await React.act(async () => probe.intervals()[0].callback());
	assert.equal(probe.messages.at(-1).parts[0].text.includes("2 seconds"), true);
	await React.act(async () => probe.timers()[0].callback());
	assert.deepEqual(probe.sends, [retry]);
	assert.deepEqual(probe.intervals(), []);
});

test("an overdue retry re-arms immediately, and a backwards wall clock preserves only the original time remaining", async (t) => {
	const probe = await mountProbe(t);
	const retry = probe.schedule();
	await probe.render({ retry, hidden: true });
	probe.clock.wall -= 3_600_000;
	probe.clock.monotonic += 2_000;
	await probe.render({ retry });
	assert.deepEqual(probe.timers().map((timer) => timer.delay), [3_000]);
	await probe.render({ retry, hidden: true });
	probe.clock.monotonic += 3_001;
	await probe.render({ retry });
	assert.deepEqual(probe.timers().map((timer) => timer.delay), [0]);
});

test("StrictMode leaves one retry and countdown armed and a reset clears both", async (t) => {
	const probe = await mountProbe(t, true);
	await probe.render({ retry: probe.schedule() });
	assert.equal(probe.timers().length, 1);
	assert.equal(probe.intervals().length, 1);
	await probe.render({ retry: null });
	assert.deepEqual(probe.timers(), []);
	assert.deepEqual(probe.intervals(), []);
});
