// Drives useRovoChatMediaGeneration directly, so a test can settle the media
// widget and run out the media timeout without a stream.
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { cleanup, renderComponent } = require("../../scripts/lib/render-component.js");

const PROBE_SOURCE = `
	import { MEDIA_GENERATION_TIMEOUT_MS, useRovoChatMediaGeneration } from "@/app/contexts/use-rovo-chat-media-generation";
	export default function Probe({ messages, onSettled }) {
		window.testMedia = useRovoChatMediaGeneration(messages, "p1", onSettled);
		window.testMediaTimeoutMs = MEDIA_GENERATION_TIMEOUT_MS;
		return null;
	}
`;

function turn(loading) {
	return [
		{ id: "u1", role: "user", metadata: { promptId: "p1" }, parts: [{ type: "text", text: "Draw a cat" }] },
		{ id: "a1", role: "assistant", parts: [{ type: "data-widget-loading", data: { type: "image-preview", loading } }] },
	];
}

// Records the hook's media timeout (anything a second or longer) instead of
// scheduling it, so the test fires it by hand.
function captureLongTimeouts(t) {
	const scheduled = [];
	const originalSetTimeout = globalThis.setTimeout;
	const originalWindowSetTimeout = window.setTimeout;
	const capture = (schedule) => (callback, delay, ...args) => {
		if (delay >= 1000) {
			scheduled.push({ delay, callback });
			return schedule(() => {}, 0);
		}
		return schedule(callback, delay, ...args);
	};
	globalThis.setTimeout = capture(originalSetTimeout);
	window.setTimeout = capture(originalWindowSetTimeout.bind(window));
	t.after(() => {
		globalThis.setTimeout = originalSetTimeout;
		window.setTimeout = originalWindowSetTimeout;
	});
	return {
		delays: () => scheduled.map((entry) => entry.delay),
		fire: (index) => React.act(async () => scheduled.at(index).callback()),
	};
}

async function mountProbe(t) {
	const timeouts = captureLongTimeouts(t);
	let settled = 0;
	const onSettled = () => {
		settled += 1;
	};
	const view = await renderComponent({ source: PROBE_SOURCE, props: { messages: turn(true), onSettled } });
	t.after(async () => {
		await cleanup();
		delete window.testMedia;
		delete window.testMediaTimeoutMs;
	});
	return {
		timeouts,
		settledCount: () => settled,
		settleMedia: () => view.rerender({ messages: turn(false), onSettled }),
		media: () => window.testMedia,
		timeoutMs: () => window.testMediaTimeoutMs,
	};
}

test("a loading media widget raises the flag until the media timeout releases it", async (t) => {
	const probe = await mountProbe(t);
	assert.deepEqual(probe.timeouts.delays(), [probe.timeoutMs()]);
	assert.equal(probe.media().isMediaGenerating, true);

	await probe.timeouts.fire(-1);
	assert.equal(probe.media().isMediaGenerating, false);
	assert.equal(probe.settledCount(), 1);
});

test("media that finishes settles once, and the media timeout then does nothing", async (t) => {
	const probe = await mountProbe(t);

	await probe.settleMedia();
	assert.equal(probe.media().isMediaGenerating, false);
	assert.equal(probe.settledCount(), 1);

	await probe.timeouts.fire(-1);
	assert.equal(probe.settledCount(), 1);
});
