const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

test("nudges retain every arrival and route actions to the selected card", async () => {
	const actions = [];
	const suggestions = ["First", "Second", "Third", "Fourth"].map((label) => ({
		id: label,
		label,
		onSelect: () => actions.push(`select ${label}`),
		onDismiss: () => actions.push(`dismiss ${label}`),
	}));
	const view = await renderComponent({
		entry: "components/blocks/rovo-button/nudge.tsx",
		exportName: "FloatingRovoButtonNudge",
		props: { suggestions: suggestions.slice(0, 1), shouldReduceMotion: true },
	});
	assert.equal(view.container.querySelectorAll("button").length, 2);
	await view.rerender({ suggestions, shouldReduceMotion: true });
	assert.deepEqual(Array.from(view.container.querySelectorAll('button[aria-label^="Dismiss"]')).map((button) => button.getAttribute("aria-label")), [
		"Dismiss Fourth", "Dismiss Third", "Dismiss Second", "Dismiss First",
	]);
	const newest = view.container.querySelector('button[aria-label="Fourth"]');
	const older = view.container.querySelector('button[aria-label="Second"]').parentElement;
	assert.equal(older.inert, true);
	await view.focus(newest);
	assert.equal(older.inert, false);
	await view.click(view.container.querySelector('button[aria-label="Dismiss Second"]'));
	await view.click(newest);
	assert.deepEqual(actions, ["dismiss Second", "select Fourth"]);
	await view.rerender({ suggestions: suggestions.filter((item) => item.id !== "Second"), shouldReduceMotion: true });
	assert.equal(view.container.querySelector('button[aria-label="Dismiss Second"]') === null, true);
	await view.unmount();
});
