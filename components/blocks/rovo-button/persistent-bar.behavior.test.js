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

test("a fresh nudge opens the tooltip unprompted, and a rail that mounts with it already set stays quiet", async () => {
	const item = { id: "review", ariaLabel: "Review suggestions", tooltipLabel: "5 suggestions", onClick() {} };
	const props = { bar: { items: [{ ...item, busy: true, tooltipLabel: "Finding suggestions…" }] }, side: "top", shouldReduceMotion: true };
	const view = await renderComponent({ entry: "components/blocks/rovo-button/persistent-bar.tsx", exportName: "FloatingRovoButtonPersistentBarRail", props });
	const tooltip = () => view.container.ownerDocument.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
	assert.equal(view.getByRole("button", { name: "Review suggestions" }).getAttribute("aria-busy"), "true");
	assert.equal(tooltip(), null);
	await view.rerender({ ...props, bar: { items: [{ ...item, indicator: true, nudge: 1 }] } });
	assert.equal(view.getByRole("button", { name: "Review suggestions" }).hasAttribute("aria-busy"), false);
	assert.equal(tooltip(), "5 suggestions");
	await view.unmount();

	const remounted = await renderComponent({ entry: "components/blocks/rovo-button/persistent-bar.tsx", exportName: "FloatingRovoButtonPersistentBarRail", props: { ...props, bar: { items: [{ ...item, indicator: true, nudge: 1 }] } } });
	assert.equal(remounted.container.ownerDocument.querySelector('[data-slot="tooltip-content"]') === null, true);
	await remounted.unmount();
});
