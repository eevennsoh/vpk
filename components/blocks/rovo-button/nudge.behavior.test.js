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

test("a suggestion with autoDismissMs dismisses itself and pauses while the stack is focused", async () => {
	const originalSet = window.setTimeout;
	const originalClear = window.clearTimeout;
	const timers = new Map();
	let nextId = 50000;
	window.setTimeout = (callback, delay, ...args) => {
		if (delay < 1000) return originalSet(callback, delay, ...args);
		const id = nextId++;
		timers.set(id, { callback, delay });
		return id;
	};
	window.clearTimeout = (id) => { if (!timers.delete(id)) originalClear(id); };
	try {
		const dismissed = [];
		const view = await renderComponent({
			entry: "components/blocks/rovo-button/nudge.tsx",
			exportName: "FloatingRovoButtonNudge",
			props: {
				shouldReduceMotion: true,
				suggestions: [
					{ id: "sticky", label: "Sticky", onSelect() {}, onDismiss: () => dismissed.push("sticky") },
					{ id: "added", label: "Codex added", autoDismissMs: 8000, onSelect() {}, onDismiss: () => dismissed.push("added") },
				],
			},
		});
		assert.deepEqual([...timers.values()].map((timer) => timer.delay), [8000]);
		await view.focus(view.container.querySelector('button[aria-label="Codex added"]'));
		assert.equal(timers.size, 0, "focus pauses the countdown");
		await view.focus(view.container);
		assert.equal(timers.size, 1, "leaving the stack resumes it");
		[...timers.values()][0].callback();
		assert.deepEqual(dismissed, ["added"]);
		await view.unmount();
		assert.equal(timers.size, 0);
	} finally {
		window.setTimeout = originalSet;
		window.clearTimeout = originalClear;
	}
});
