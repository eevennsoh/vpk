const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

test("a toolbar action shows its tooltip to the left on keyboard focus", async () => {
	let clicks = 0;
	const view = await renderComponent({
		entry: "components/blocks/rovo-button/persistent-bar.tsx",
		exportName: "FloatingRovoButtonPersistentBarRail",
		props: {
			bar: { items: [{ id: "live", ariaLabel: "Talk to Rovo", tooltipLabel: "Live chat", onClick() { clicks += 1; } }] },
			side: "top",
			shouldReduceMotion: true,
		},
	});
	await view.focus(view.getByRole("button", { name: "Talk to Rovo" }));
	const tooltip = view.container.ownerDocument.querySelector('[data-slot="tooltip-content"]');
	assert.equal(tooltip?.textContent, "Live chat");
	assert.equal(tooltip?.getAttribute("data-side"), "left");
	await view.click(view.getByRole("button", { name: "Talk to Rovo" }));
	assert.equal(clicks, 1);
	await view.unmount();
});

test("a tooltip closes during the notification transition without changing its state mode", async () => {
	const errors = [];
	const originalError = console.error;
	console.error = (...args) => { errors.push(args.map(String).join(" ")); };
	let view;
	try {
		const props = {
			bar: { items: [{ id: "review", ariaLabel: "Review suggestions", tooltipLabel: "5 suggestions", onClick() {} }] },
			side: "top",
			shouldReduceMotion: true,
		};
		view = await renderComponent({
			entry: "components/blocks/rovo-button/persistent-bar.tsx",
			exportName: "FloatingRovoButtonPersistentBarRail",
			props,
		});
		await view.focus(view.getByRole("button", { name: "Review suggestions" }));
		assert.equal(view.container.ownerDocument.querySelector('[data-slot="tooltip-content"]')?.textContent, "5 suggestions");
		await view.rerender({ ...props, indicatorInFlight: true });
		assert.equal(view.container.ownerDocument.querySelector('[data-slot="tooltip-content"]') === null, true);
		await view.rerender({ ...props, indicatorInFlight: false });
		assert.equal(errors.some((message) => /uncontrolled|controlled/u.test(message)), false, errors.join("\n"));
	} finally {
		await view?.unmount();
		console.error = originalError;
	}
});
