const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../scripts/lib/render-component.js");

// The probe owns its state, as consumers do, and reports every advance it receives.
const PROBE = `import { useState } from "react";
	import { useTimedTransition } from "@/components/hooks/use-timed-transition";
	const TABLE = {
		queued: { next: "running", delayMs: 1200 },
		running: { next: "passed", delayMs: 1500 },
	};
	export default function TimedProbe({ initial = "queued", paused = false, reducedMotion = false, restartKey, onAdvance }) {
		const [state, setState] = useState(initial);
		useTimedTransition(paused ? null : state, TABLE, {
			onAdvance: (next) => { onAdvance?.(next); setState(next); },
			reducedMotion,
			restartKey,
		});
		return <div><p>{state}</p><button type="button" onClick={() => setState("queued")}>Restart</button></div>;
	}`;

async function renderProbe(context, props = {}) {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const advances = [];
	const view = await renderComponent({ source: PROBE, props: { onAdvance: (next) => advances.push(next), ...props } });
	return { advances, view };
}

const stateOf = (view) => view.container.querySelector("p").textContent;

async function advance(context, ms) {
	await React.act(async () => {
		context.mock.timers.tick(ms);
	});
}

test("useTimedTransition advances one step per elapsed delay and rests at the end", async (context) => {
	const { advances, view } = await renderProbe(context);
	await advance(context, 1_199);
	assert.equal(stateOf(view), "queued");
	await advance(context, 1);
	assert.equal(stateOf(view), "running");
	await advance(context, 1_500);
	assert.equal(stateOf(view), "passed");
	await advance(context, 60_000);
	assert.deepEqual(advances, ["running", "passed"], "a resting state schedules nothing more");
});

test("useTimedTransition under reduced motion jumps to the resting state without a timer", async (context) => {
	const { advances, view } = await renderProbe(context, { reducedMotion: true });
	assert.equal(stateOf(view), "passed", "the jump lands before any time passes");
	assert.deepEqual(advances, ["passed"], "intermediate steps are skipped, not replayed quickly");
	await view.click(view.getByRole("button", { name: "Restart" }));
	assert.equal(stateOf(view), "passed");
	await advance(context, 60_000);
	assert.deepEqual(advances, ["passed", "passed"]);
});

test("useTimedTransition switching to reduced motion mid-step clears the pending timer", async (context) => {
	const { advances, view } = await renderProbe(context);
	await advance(context, 1_000);
	await view.rerender({ onAdvance: (next) => advances.push(next), reducedMotion: true });
	assert.equal(stateOf(view), "passed");
	await advance(context, 60_000);
	assert.deepEqual(advances, ["passed"], "the queued → running timer must not fire after the jump");
});

test("useTimedTransition pauses on null and resumes the step from its full delay", async (context) => {
	const { advances, view } = await renderProbe(context);
	await advance(context, 1_000);
	await view.rerender({ onAdvance: (next) => advances.push(next), paused: true });
	await advance(context, 60_000);
	assert.equal(stateOf(view), "queued");
	await view.rerender({ onAdvance: (next) => advances.push(next) });
	await advance(context, 1_199);
	assert.equal(stateOf(view), "queued");
	await advance(context, 1);
	assert.equal(stateOf(view), "running");
});

test("useTimedTransition restarts the current step when the restart key changes", async (context) => {
	const { view } = await renderProbe(context, { restartKey: 0 });
	await advance(context, 1_000);
	await view.rerender({ restartKey: 1 });
	await advance(context, 1_000);
	assert.equal(stateOf(view), "queued", "the restart begins a fresh 1200 ms hold");
	await advance(context, 200);
	assert.equal(stateOf(view), "running");
});

test("useTimedTransition keeps the timer when only the callback identity changes", async (context) => {
	const { view } = await renderProbe(context);
	await advance(context, 1_000);
	await view.rerender({ onAdvance: () => {} });
	await advance(context, 200);
	assert.equal(stateOf(view), "running", "a new onAdvance on each render must not restart the hold");
});

test("useTimedTransition clears its timer on unmount", async (context) => {
	const { advances, view } = await renderProbe(context);
	await advance(context, 1_000);
	await view.unmount();
	await advance(context, 60_000);
	assert.deepEqual(advances, []);
});
