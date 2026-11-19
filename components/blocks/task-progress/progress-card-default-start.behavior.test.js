// A progress card rendered without `runCreatedAt` shows a run that started about 10m 51s
// before the card mounted. The start time is fixed at mount, so the header timer keeps
// counting up and a parent re-render does not move it.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const React = require("react");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const CARDS = [
	{ entry: "components/blocks/agent-progress/page.tsx", label: "an agent progress card" },
	{ entry: "components/blocks/task-progress/page.tsx", label: "a task progress card" },
];
const ELAPSED = /^\d+m \d{2}s$/u;
const DEFAULT_RUN_AGE_SECONDS = 651;
const MOUNTED_AT_MS = Date.UTC(2026, 0, 1);

function elapsedSeconds(view) {
	const [minutes, seconds] = view.getByText(ELAPSED).textContent.match(/\d+/gu).map(Number);
	return minutes * 60 + seconds;
}

for (const { entry, label } of CARDS) {
	test(`${label} with no runCreatedAt reads zero at first, then counts up from ~10m 51s across re-renders`, async (t) => {
		// The clock and the card's one-second interval run on fake time, so the readings are exact
		// however slow the machine is.
		t.mock.timers.enable({ apis: ["setInterval", "Date"], now: MOUNTED_AT_MS });
		const secondPasses = () => React.act(async () => t.mock.timers.tick(1000));
		const props = { planTitle: "Default run" };
		const view = await renderComponent({ entry, props });
		// The first render derives elapsed time from the start time alone, so it reads zero
		// whatever the clock says, and prerendered HTML matches it.
		assert.equal(view.queryByText(ELAPSED) === null, true);

		await secondPasses();
		assert.equal(elapsedSeconds(view), DEFAULT_RUN_AGE_SECONDS + 1);

		await view.rerender({ ...props, planTitle: "Default run renamed" });
		assert.equal(elapsedSeconds(view), DEFAULT_RUN_AGE_SECONDS + 1, "a re-render does not move the start time");

		await secondPasses();
		assert.equal(elapsedSeconds(view), DEFAULT_RUN_AGE_SECONDS + 2, "the timer counts up");
	});
}
