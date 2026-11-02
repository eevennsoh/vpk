const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../scripts/lib/render-component.js");

const source = `
import { ChartProvider, useChartStable } from "@/components/ui-charts/chart-context";
import { useChart } from "@/components/ui-charts/use-chart";
function ReadSquareSettings() {
 const stable = useChartStable();
 const chart = useChart();
 return <output role="status">{JSON.stringify({ stable: stable.squareSnap ?? null, chart: chart.squareSnap ?? null })}</output>;
}
export default function Example({ squareSnap }) {
 return <ChartProvider value={{ squareSnap }}><ReadSquareSettings /></ChartProvider>;
}`;

test("chart providers preserve square bar settings and publish changed group gaps", async () => {
	const initial = { squareGap: 2, groupGap: 24, fit: true };
	const view = await renderComponent({ source, props: { squareSnap: initial } });
	const settings = () => JSON.parse(view.getByRole("status").textContent);
	assert.deepEqual(settings(), { stable: initial, chart: initial });

	const changed = { squareGap: 3, groupGap: 12, fit: false };
	await view.rerender({ squareSnap: changed });
	assert.deepEqual(settings(), { stable: changed, chart: changed });

	await view.rerender({});
	assert.deepEqual(settings(), { stable: null, chart: null });
});
