const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

test("legend progress bars are named by their own item and retain numeric progress semantics", async () => {
	const source = `
		import { Legend } from "@/components/ui-charts/legend/legend";
		import { LegendItem } from "@/components/ui-charts/legend/legend-item";
		import { LegendLabel } from "@/components/ui-charts/legend/legend-label";
		import { LegendProgress } from "@/components/ui-charts/legend/legend-progress";
		export function LegendHarness({ items }) {
			return <Legend items={items}><LegendItem><LegendLabel /><LegendProgress /></LegendItem></Legend>;
		}
	`;
	const items = [
		{ label: "Google Search", value: 70, maxValue: 100, color: "currentColor" },
		{ label: "Newsletter", value: 30, maxValue: 60, color: "currentColor" },
		{ label: "Unbounded", value: 12, color: "currentColor" },
	];
	const view = await renderComponent({ source, exportName: "LegendHarness", props: { items } });
	assert.deepEqual(view.getAllByRole("progressbar").map(accessibleName), ["Google Search", "Newsletter"]);
	const newsletter = view.getByRole("progressbar", { name: "Newsletter" });
	assert.equal(newsletter.getAttribute("aria-valuenow"), "30");
	assert.equal(newsletter.getAttribute("aria-valuemax"), "60");
	await view.rerender({ items: [{ ...items[0], label: "Organic Search" }] });
	assert.deepEqual(view.getAllByRole("progressbar").map(accessibleName), ["Organic Search"]);
});
