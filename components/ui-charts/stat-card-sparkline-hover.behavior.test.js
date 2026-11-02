const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../scripts/lib/render-component.js");

const source = `
import { formatStatCardMonth, formatStatCardWeekday, useStatCardSparklineHover } from "@/components/ui-charts/stat-card-sparkline-hover";
import { StatCardChart } from "@/components/ui-charts/stat-card-chart";
const data = [
 { date: new Date(2024, 0, 1), value: 20 },
 { date: new Date(2024, 1, 1), value: 30 },
 { date: new Date(2024, 2, 1), value: 0 },
 { date: new Date(2024, 3, 1), value: 12 },
];
export default function Example({ weekday = false }) {
 const { hover, sparklineProps } = useStatCardSparklineHover(data, weekday ? formatStatCardWeekday : formatStatCardMonth);
 return <StatCardChart>
  <output aria-label="Hovered stat" role="status">{JSON.stringify(hover)}</output>
  {data.map((datum, index) => <button key={index} onClick={() => sparklineProps.onHoverChange(index, datum)} type="button">Point {index + 1}</button>)}
  <button onClick={() => sparklineProps.onHoverChange(null, null)} type="button">Leave chart</button>
 </StatCardChart>;
}`;

test("shared stat-card hover derives values and period trends, then clears on leave", async () => {
	const view = await renderComponent({ source });
	const state = () => JSON.parse(view.getByRole("status", { name: "Hovered stat" }).textContent);
	assert.deepEqual(state(), { value: null, label: null, trend: null });
	await view.click(view.getByRole("button", { name: "Point 1" }));
	assert.deepEqual(state(), { value: 20, label: "Jan", trend: null });
	await view.click(view.getByRole("button", { name: "Point 2" }));
	assert.deepEqual(state(), { value: 30, label: "Feb", trend: 50 });
	await view.click(view.getByRole("button", { name: "Point 4" }));
	assert.deepEqual(state(), { value: 12, label: "Apr", trend: null });
	await view.click(view.getByRole("button", { name: "Leave chart" }));
	assert.deepEqual(state(), { value: null, label: null, trend: null });
});

test("the shared hover hook retains weekday formatting for line stat cards", async () => {
	const view = await renderComponent({ source, props: { weekday: true } });
	await view.click(view.getByRole("button", { name: "Point 1" }));
	assert.deepEqual(JSON.parse(view.getByRole("status", { name: "Hovered stat" }).textContent), {
		value: 20,
		label: "Monday",
		trend: null,
	});
});
