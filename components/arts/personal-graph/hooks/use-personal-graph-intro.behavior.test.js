const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderIntro(context, { reducedMotion = false } = {}) {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	return renderComponent({
		source: `import { usePersonalGraphIntro } from "@/components/arts/personal-graph/hooks/use-personal-graph-intro";
			export default function IntroProbe({ replayKey = 0 }) {
				const { phase, isReducedMotion } = usePersonalGraphIntro(replayKey);
				return <p>{phase}{isReducedMotion ? " (reduced)" : ""}</p>;
			}`,
		mocks: {
			"motion/react": `export function useReducedMotion() { return ${reducedMotion}; }`,
		},
	});
}

const phaseOf = (view) => view.container.textContent;

// Time passes in slices, each followed by a render, as in a browser; one long tick would skip
// the renders that schedule the following steps.
async function advance(context, ms) {
	for (let elapsed = 0; elapsed < ms; elapsed += 50) {
		await React.act(async () => {
			context.mock.timers.tick(Math.min(50, ms - elapsed));
		});
	}
}

test("Personal Graph intro reveals each phase on its timeline offset", async (context) => {
	const view = await renderIntro(context);
	assert.equal(phaseOf(view), "title");
	await advance(context, 499);
	assert.equal(phaseOf(view), "title");
	for (const [ms, phase] of [[1, "subtext"], [400, "controls"], [800, "settle"], [300, "search"], [400, "graph"]]) {
		await advance(context, ms);
		assert.equal(phaseOf(view), phase);
	}
	await advance(context, 1299);
	assert.equal(phaseOf(view), "graph");
	await advance(context, 1);
	assert.equal(phaseOf(view), "done");
});

test("Personal Graph intro replays from the title when the replay key changes", async (context) => {
	const view = await renderIntro(context);
	await advance(context, 3700);
	assert.equal(phaseOf(view), "done");
	await view.rerender({ replayKey: 1 });
	assert.equal(phaseOf(view), "title");
	await advance(context, 500);
	assert.equal(phaseOf(view), "subtext");
	// A replay mid-sequence restarts the whole timeline, not the remaining steps.
	await view.rerender({ replayKey: 2 });
	assert.equal(phaseOf(view), "title");
	await advance(context, 499);
	assert.equal(phaseOf(view), "title");
	await advance(context, 1);
	assert.equal(phaseOf(view), "subtext");
});

test("Personal Graph intro replays restart the clock even before the first step", async (context) => {
	const view = await renderIntro(context);
	await advance(context, 400);
	await view.rerender({ replayKey: 1 });
	await advance(context, 400);
	assert.equal(phaseOf(view), "title", "the replay restarts the 500 ms title hold");
	await advance(context, 100);
	assert.equal(phaseOf(view), "subtext");
});

test("Personal Graph intro under reduced motion lands on the stable state with no timer running", async (context) => {
	const view = await renderIntro(context, { reducedMotion: true });
	assert.equal(phaseOf(view), "done (reduced)");
	await view.rerender({ replayKey: 1 });
	assert.equal(phaseOf(view), "done (reduced)");
	await advance(context, 10_000);
	assert.equal(phaseOf(view), "done (reduced)");
});

test("Personal Graph intro stops its timers on unmount", async (context) => {
	const view = await renderIntro(context);
	await view.unmount();
	await advance(context, 10_000);
	assert.equal(phaseOf(view), "");
});
