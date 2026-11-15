// VPK differences from upstream shadcn chart.tsx that a future shadcn sync must keep:
// - ChartContainer names recharts' focusable role="application" surface.
// - ChartLegendContent keys legend items by position too, because pie legends repeat
//   the series name as every slice's value (upstream keys by item.value alone).
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

// recharts measures layout that happy-dom does not have; render children directly instead.
const RECHARTS_MOCK = `
export function ResponsiveContainer({ children }) { return children; }
export function Tooltip() { return null; }
export function Legend() { return null; }
`;

const SOURCE = `
import { ChartContainer, ChartLegendContent } from "@/components/ui/chart";

Element.prototype.getBoundingClientRect = () => ({ width: 300, height: 200, top: 0, left: 0, right: 300, bottom: 200, x: 0, y: 0 });

function FakeChart(props) {
	return <svg role="application" tabIndex={0} aria-label={props["aria-label"]}>{props.children}</svg>;
}

const config = { visitors: { label: "Visitors" }, chrome: { label: "Chrome", color: "red" }, safari: { label: "Safari", color: "blue" } };
const payload = [
	{ value: "visitors", dataKey: "visitors", color: "red", payload: { browser: "chrome" } },
	{ value: "visitors", dataKey: "visitors", color: "blue", payload: { browser: "safari" } },
];

export default function Demo({ label, chartLabel }) {
	return (
		<ChartContainer config={config} aria-label={label}>
			<FakeChart aria-label={chartLabel}>
				<foreignObject><ChartLegendContent payload={payload} nameKey="browser" /></foreignObject>
			</FakeChart>
		</ChartContainer>
	);
}
`;

async function renderChart(props = {}) {
	const errors = [];
	const originalError = console.error;
	console.error = (...args) => errors.push(args.map(String).join(" "));
	try {
		const view = await renderComponent({ source: SOURCE, mocks: { recharts: RECHARTS_MOCK }, props });
		return { view, errors };
	} finally {
		console.error = originalError;
	}
}

test("ChartContainer names the recharts application surface from the config labels", async () => {
	const { view } = await renderChart();
	assert.equal(view.container.querySelector("[role=application]").getAttribute("aria-label"), "Chart: Visitors, Chrome, and Safari");
});

test("ChartContainer forwards an explicit aria-label to the surface, not the wrapper", async () => {
	const { view } = await renderChart({ label: "Browser share" });
	assert.equal(view.container.querySelector("[role=application]").getAttribute("aria-label"), "Browser share");
	assert.equal(view.container.querySelector("[data-slot=chart]").hasAttribute("aria-label"), false);
});

test("ChartContainer keeps a name the chart already sets", async () => {
	const { view } = await renderChart({ label: "Ignored", chartLabel: "Set by chart" });
	assert.equal(view.container.querySelector("[role=application]").getAttribute("aria-label"), "Set by chart");
});

test("ChartLegendContent renders pie legends whose items share a value without duplicate keys", async () => {
	const { view, errors } = await renderChart();
	assert.equal(view.container.textContent.includes("Chrome") && view.container.textContent.includes("Safari"), true);
	assert.deepEqual(errors.filter((message) => message.includes("same key")), []);
});
