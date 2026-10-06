const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

const FINALE_REST_TIME = 8.17;

async function renderOverlay(t, { pauseMegaBento = true, reducedMotion = false } = {}) {
	let nextFrame;
	let time = 0;
	const emitted = [];
	const held = [];
	t.mock.method(globalThis, "requestAnimationFrame", (callback) => {
		nextFrame = callback;
		return 1;
	});
	t.mock.method(globalThis, "cancelAnimationFrame", () => { nextFrame = undefined; });
	const view = await renderComponent({
		entry: "components/projects/jira-team-eu26-end/finale/components/finale-overlay.tsx",
		exportName: "FinaleOverlay",
		mocks: {
			"@/components/projects/jira-team-eu26-end/finale/scenes/scene-board-to-bento": `
import { useFinaleFrame } from "@/components/projects/jira-team-eu26-end/finale/hooks/use-finale-frame";
export function SceneBoardToBento({ onFrame }) {
	useFinaleFrame(onFrame);
	return <p>Record for agent</p>;
}
`,
		},
		props: {
			scene: { features: [], onFrame: (value) => emitted.push(value) },
			clock: {
				time: () => time,
				hold: (value) => { time = value; held.push(value); },
			},
			closing: false,
			pauseMegaBento,
			reducedMotion,
		},
	});
	t.after(() => view.unmount());
	return {
		emitted,
		held,
		tick: (value = time) => { time = value; nextFrame(); },
	};
}

test("Pause mega-bento finishes the last glow and holds every scene on the bento", async (t) => {
	const overlay = await renderOverlay(t);
	overlay.tick(7.9);
	assert.deepEqual(overlay.emitted, [7.9], "the final glow still plays");
	assert.deepEqual(overlay.held, []);
	overlay.tick(8.3);
	assert.deepEqual(overlay.emitted, [7.9, FINALE_REST_TIME], "a late frame cannot enter the wall");
	assert.deepEqual(overlay.held, [FINALE_REST_TIME], "the underlying clock stops too");
	overlay.tick();
	overlay.tick();
	assert.deepEqual(overlay.emitted, [7.9, FINALE_REST_TIME], "held frames do not redraw");
	assert.deepEqual(overlay.held, [FINALE_REST_TIME]);
	overlay.tick(0);
	overlay.tick(9);
	assert.deepEqual(overlay.emitted, [7.9, FINALE_REST_TIME, 0, FINALE_REST_TIME], "replay holds at the same cue");
});

test("turning Pause mega-bento off lets the sequence continue into the scrolling wall", async (t) => {
	const overlay = await renderOverlay(t, { pauseMegaBento: false });
	overlay.tick(7.9);
	overlay.tick(8.3);
	overlay.tick(30);
	assert.deepEqual(overlay.emitted, [7.9, 8.3, 30]);
	assert.deepEqual(overlay.held, []);
});

test("reduced motion keeps its static bento even with Pause mega-bento off", async (t) => {
	const overlay = await renderOverlay(t, { pauseMegaBento: false, reducedMotion: true });
	overlay.tick(0);
	overlay.tick(30);
	assert.deepEqual(overlay.emitted, [FINALE_REST_TIME]);
});
