// Drives useRovoChatCutShortTurn directly with a recording dispatch, so a test
// can check the events a finish snapshot produces and the short media wait.
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { cleanup, renderComponent } = require("../../scripts/lib/render-component.js");

const PROBE_SOURCE = `
	import { CUT_SHORT_MEDIA_WAIT_MS } from "@/app/contexts/use-rovo-chat-media-generation";
	import { useRovoChatCutShortTurn } from "@/app/contexts/use-rovo-chat-cut-short-turn";
	export default function Probe({ dispatchTurn, queueTick }) {
		window.testCutShort = useRovoChatCutShortTurn(dispatchTurn, queueTick);
		window.testCutShortWaitMs = CUT_SHORT_MEDIA_WAIT_MS;
		return null;
	}
`;

const PROMPT = Object.freeze({ id: "p1", files: [], text: "Draw a cat", createdAt: 0 });
const user = { id: "u1", role: "user", metadata: { promptId: "p1" }, parts: [{ type: "text", text: "Draw a cat" }] };
const reply = (...parts) => ({ id: "a1", role: "assistant", parts: [{ type: "text", text: "Drawing" }, ...parts] });
const loadingImage = { type: "data-widget-loading", data: { type: "image-preview", loading: true } };

function captureTimeouts(t) {
	const scheduled = [];
	const cleared = [];
	const originals = { set: globalThis.setTimeout, clear: globalThis.clearTimeout, windowSet: window.setTimeout, windowClear: window.clearTimeout };
	const capture = (callback, delay) => {
		const handle = { delay, callback };
		scheduled.push(handle);
		return handle;
	};
	const release = (handle) => {
		cleared.push(handle);
	};
	globalThis.setTimeout = capture;
	globalThis.clearTimeout = release;
	window.setTimeout = capture;
	window.clearTimeout = release;
	t.after(() => {
		globalThis.setTimeout = originals.set;
		globalThis.clearTimeout = originals.clear;
		window.setTimeout = originals.windowSet;
		window.clearTimeout = originals.windowClear;
	});
	return { scheduled, cleared };
}

async function mountProbe(t) {
	const events = [];
	let ticks = 0;
	const props = { dispatchTurn: (event) => events.push(event), queueTick: () => { ticks += 1; } };
	await renderComponent({ source: PROBE_SOURCE, props });
	t.after(async () => {
		await cleanup();
		delete window.testCutShort;
		delete window.testCutShortWaitMs;
	});
	const timeouts = captureTimeouts(t);
	return {
		events,
		timeouts,
		ticks: () => ticks,
		finish: (messages, overrides = {}) => window.testCutShort({ messages, isAbort: false, isError: false, activePrompt: PROMPT, ...overrides }),
		waitMs: () => window.testCutShortWaitMs,
	};
}

test("a cut-short finish with a loading widget dispatches its snapshot and ends the short wait for that prompt", async (t) => {
	const probe = await mountProbe(t);
	probe.finish([user, reply(loadingImage)]);
	assert.deepEqual(probe.events, [{ type: "turnCutShort", finish: { anchorMessageId: "a1", mediaLoading: true } }]);
	assert.deepEqual(probe.timeouts.scheduled.map((entry) => entry.delay), [probe.waitMs()]);
	assert.equal(probe.ticks(), 1);

	await React.act(async () => probe.timeouts.scheduled[0].callback());
	assert.deepEqual(probe.events.at(-1), { type: "cutShortMediaWaitElapsed", promptId: "p1" });
	assert.equal(probe.ticks(), 2);
});

test("a cut-short finish without loading media starts no wait, and a finish that is not cut short does nothing", async (t) => {
	const probe = await mountProbe(t);
	probe.finish([user, reply()]);
	assert.deepEqual(probe.events, [{ type: "turnCutShort", finish: { anchorMessageId: "a1", mediaLoading: false } }]);
	assert.deepEqual(probe.timeouts.scheduled, []);

	probe.finish([user, reply(loadingImage)], { isAbort: true });
	probe.finish([user, reply(loadingImage)], { isError: true });
	probe.finish([user, reply(loadingImage)], { activePrompt: null });
	assert.equal(probe.events.length, 1);
	assert.deepEqual(probe.timeouts.scheduled, []);
	assert.equal(probe.ticks(), 1);
});

test("unmounting clears a pending short wait", async (t) => {
	const probe = await mountProbe(t);
	probe.finish([user, reply(loadingImage)]);
	await cleanup();
	assert.deepEqual(probe.timeouts.cleared, probe.timeouts.scheduled);
});
