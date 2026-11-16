// Drives useRovoChatMediaGeneration directly, so a test can settle the media
// widget after the cut-short wait is scheduled. In the provider that cannot
// happen through the stream: once a turn is cut short its stream is closed.
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { cleanup, renderComponent } = require("../../scripts/lib/render-component.js");

const PROBE_SOURCE = `
	import {
		CUT_SHORT_MEDIA_WAIT_MS,
		MEDIA_GENERATION_TIMEOUT_MS,
		useRovoChatMediaGeneration,
	} from "@/app/contexts/use-rovo-chat-media-generation";
	export default function Probe({ messages, onSettled }) {
		window.testMedia = useRovoChatMediaGeneration(messages, "p1", onSettled);
		window.testMediaWaits = { full: MEDIA_GENERATION_TIMEOUT_MS, cutShort: CUT_SHORT_MEDIA_WAIT_MS };
		return null;
	}
`;

function turn(loading) {
	return [
		{ id: "u1", role: "user", metadata: { promptId: "p1" }, parts: [{ type: "text", text: "Draw a cat" }] },
		{ id: "a1", role: "assistant", parts: [{ type: "data-widget-loading", data: { type: "image-preview", loading } }] },
	];
}

// Records the hook's media timeouts (anything a second or longer) instead of
// scheduling them, so the test fires them by hand.
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
		delete window.testMediaWaits;
	});
	return {
		timeouts,
		settledCount: () => settled,
		settleMedia: () => view.rerender({ messages: turn(false), onSettled }),
		media: () => window.testMedia,
		waits: () => window.testMediaWaits,
	};
}

test("shortening the media wait replaces the full timeout with the cut-short wait, which releases the flag", async (t) => {
	const probe = await mountProbe(t);
	assert.equal(probe.waits().cutShort < probe.waits().full, true);
	assert.deepEqual(probe.timeouts.delays(), [probe.waits().full]);
	assert.equal(probe.media().isMediaGenerating, true);

	probe.media().shortenMediaWait(probe.waits().cutShort);
	assert.deepEqual(probe.timeouts.delays(), [probe.waits().full, probe.waits().cutShort]);
	// A second request (every queue tick asks again) does not restart the wait.
	probe.media().shortenMediaWait(probe.waits().cutShort);
	assert.deepEqual(probe.timeouts.delays(), [probe.waits().full, probe.waits().cutShort]);

	await probe.timeouts.fire(-1);
	assert.equal(probe.media().isMediaGenerating, false);
	assert.equal(probe.settledCount(), 1);
});

test("media that finishes inside the cut-short wait settles once, and the wait then does nothing", async (t) => {
	const probe = await mountProbe(t);
	probe.media().shortenMediaWait(probe.waits().cutShort);

	await probe.settleMedia();
	assert.equal(probe.media().isMediaGenerating, false);
	assert.equal(probe.settledCount(), 1);

	await probe.timeouts.fire(-1);
	assert.equal(probe.settledCount(), 1);
});

test("shortening never lengthens a wait and does nothing once media is not generating", async (t) => {
	const probe = await mountProbe(t);
	probe.media().shortenMediaWait(probe.waits().full * 2);
	assert.deepEqual(probe.timeouts.delays(), [probe.waits().full]);

	await probe.settleMedia();
	probe.media().shortenMediaWait(probe.waits().cutShort);
	assert.deepEqual(probe.timeouts.delays(), [probe.waits().full]);
});
