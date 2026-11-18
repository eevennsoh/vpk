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

const waitForTick = () => React.act(() => new Promise((resolve) => setTimeout(resolve, 1100)));

function elapsedSeconds(view) {
	const [minutes, seconds] = view.getByText(ELAPSED).textContent.match(/\d+/gu).map(Number);
	return minutes * 60 + seconds;
}

for (const { entry, label } of CARDS) {
	test(`${label} with no runCreatedAt reads zero at first, then counts up from ~10m 51s across re-renders`, async () => {
		const props = { planTitle: "Default run" };
		const view = await renderComponent({ entry, props });
		// The first render derives elapsed time from the start time alone, so it reads zero
		// whatever the clock says, and prerendered HTML matches it.
		assert.equal(view.queryByText(ELAPSED) === null, true);

		await waitForTick();
		await view.rerender(props);
		const first = elapsedSeconds(view);
		assert.equal(first >= DEFAULT_RUN_AGE_SECONDS && first <= DEFAULT_RUN_AGE_SECONDS + 2, true, `first reading ${first}s`);

		await view.rerender({ ...props, planTitle: "Default run renamed" });
		assert.equal(elapsedSeconds(view) >= first, true, "a re-render does not move the start time");

		await waitForTick();
		const second = elapsedSeconds(view);
		assert.equal(second > first, true, `timer advanced from ${first}s to ${second}s`);
	});
}
