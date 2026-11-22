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
