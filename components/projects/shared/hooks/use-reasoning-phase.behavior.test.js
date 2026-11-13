const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const PROBE = `import { useReasoningPhase } from "@/components/projects/shared/hooks/use-reasoning-phase";
	export default function ReasoningProbe(props) {
		const { phase, duration } = useReasoningPhase(props);
		return <p>{phase}|{duration === undefined ? "-" : duration}</p>;
	}`;

const BASE = { hasMessageText: false, isStreaming: false, responseKey: "r1" };
const START = "2026-03-20T00:00:00.000Z";
const END = "2026-03-20T00:00:04.200Z";

async function renderReasoning(context, props = {}) {
	context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.parse("2026-03-20T00:01:00.000Z") });
	let current = { ...BASE, ...props };
	const view = await renderComponent({ source: PROBE, props: current });
	return {
		read: () => view.container.textContent,
		update: async (next) => {
			current = { ...current, ...next };
			await view.rerender(current);
			await advance(context, 0);
		},
		view,
	};
}

// Each slice ends in a render, as in a browser, so timers scheduled by that render can fire next.
async function advance(context, ms) {
	let elapsed = 0;
	do {
		const slice = Math.min(100, ms - elapsed);
		await React.act(async () => {
			context.mock.timers.tick(slice);
		});
		elapsed += slice;
	} while (elapsed < ms);
}

test("reasoning starts idle with no duration", async (context) => {
	const { read } = await renderReasoning(context);
	await advance(context, 0);
	assert.equal(read(), "idle|-");
});

test("a persisted reasoning window mounts as completed with its rounded-up duration", async (context) => {
	const { read } = await renderReasoning(context, { persistedEndTime: END, persistedStartTime: START });
	await advance(context, 0);
	assert.equal(read(), "completed|5");
});

test("a live stream moves preload → thinking → completed and measures its duration", async (context) => {
	const reasoning = await renderReasoning(context, { isStreaming: true });
	await advance(context, 0);
	assert.equal(reasoning.read(), "preload|-");
	await reasoning.update({ hasMessageText: true });
	assert.equal(reasoning.read(), "thinking|-");
	await advance(context, 2_500);
	await reasoning.update({ isStreaming: false });
	assert.equal(reasoning.read(), "completed|3");
});

test("a stream with a persisted start time measures from that start", async (context) => {
	const reasoning = await renderReasoning(context, { isStreaming: true, persistedStartTime: "2026-03-20T00:00:50.000Z" });
	await advance(context, 0);
	await reasoning.update({ isStreaming: false });
	assert.equal(reasoning.read(), "completed|10");
});

test("auto idle dismisses the completed display after its delay and keeps the duration", async (context) => {
	const reasoning = await renderReasoning(context, { autoIdle: true, autoIdleDelayMs: 3_000, isStreaming: true });
	await advance(context, 1_200);
	await reasoning.update({ isStreaming: false });
	assert.equal(reasoning.read(), "completed|2");
	await advance(context, 2_900);
	assert.equal(reasoning.read(), "completed|2");
	await advance(context, 100);
	assert.equal(reasoning.read(), "idle|2");
	await advance(context, 60_000);
	assert.equal(reasoning.read(), "idle|2");
});

test("without auto idle the completed display stays", async (context) => {
	const reasoning = await renderReasoning(context, { isStreaming: true });
	await advance(context, 0);
	await reasoning.update({ isStreaming: false });
	await advance(context, 60_000);
	assert.equal(reasoning.read(), "completed|0", "a stream that ends within the same instant measures 0 s");
});

test("restreaming the same response clears the completed state and measures again", async (context) => {
	const reasoning = await renderReasoning(context, { hasMessageText: true, isStreaming: true });
	await advance(context, 1_000);
	await reasoning.update({ isStreaming: false });
	assert.equal(reasoning.read(), "completed|1");
	await reasoning.update({ isStreaming: true });
	assert.equal(reasoning.read(), "thinking|-");
	await advance(context, 4_000);
	await reasoning.update({ isStreaming: false });
	assert.equal(reasoning.read(), "completed|4");
});

test("a new response resets to its own persisted state or to idle", async (context) => {
	const reasoning = await renderReasoning(context, { persistedEndTime: END, persistedStartTime: START });
	await advance(context, 0);
	assert.equal(reasoning.read(), "completed|5");
	await reasoning.update({ persistedEndTime: undefined, persistedStartTime: undefined, responseKey: "r2" });
	assert.equal(reasoning.read(), "idle|-");
	await reasoning.update({ isStreaming: true, responseKey: "r3" });
	assert.equal(reasoning.read(), "preload|-");
	await reasoning.update({ persistedEndTime: END, persistedStartTime: START, isStreaming: false, responseKey: "r4" });
	assert.equal(reasoning.read(), "completed|5");
});

test("persisted timestamps that arrive after a live stream replace the measured duration", async (context) => {
	const reasoning = await renderReasoning(context, { isStreaming: true });
	await advance(context, 0);
	await reasoning.update({ isStreaming: false });
	assert.equal(reasoning.read(), "completed|0");
	await reasoning.update({ persistedEndTime: END, persistedStartTime: START });
	assert.equal(reasoning.read(), "completed|5");
});

test("a minimum preload holds the shimmer even after text arrives or the stream ends", async (context) => {
	const reasoning = await renderReasoning(context, { isStreaming: true, minPreloadMs: 1_000 });
	await advance(context, 0);
	await reasoning.update({ hasMessageText: true });
	assert.equal(reasoning.read(), "preload|-");
	await advance(context, 600);
	assert.equal(reasoning.read(), "preload|-");
	await reasoning.update({ isStreaming: false });
	assert.equal(reasoning.read(), "preload|1", "the lock outlasts the stream");
	await advance(context, 400);
	assert.equal(reasoning.read(), "completed|1");
});

test("a minimum preload that expires mid-stream reveals thinking", async (context) => {
	const reasoning = await renderReasoning(context, { hasMessageText: true, isStreaming: true, minPreloadMs: 1_000 });
	await advance(context, 900);
	assert.equal(reasoning.read(), "preload|-");
	await advance(context, 100);
	assert.equal(reasoning.read(), "thinking|-");
});

test("unmounting mid-stream leaves no timer that renders again", async (context) => {
	const reasoning = await renderReasoning(context, { autoIdle: true, isStreaming: true, minPreloadMs: 1_000 });
	await advance(context, 0);
	await reasoning.update({ isStreaming: false });
	await reasoning.view.unmount();
	await advance(context, 60_000);
	assert.equal(reasoning.read(), "");
});
