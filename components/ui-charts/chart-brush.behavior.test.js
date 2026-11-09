const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const chartContext = `
	const xScale = (date) => date.getTime();
	xScale.invert = (value) => new Date(value);
	xScale.domain = () => [new Date(0), new Date(100)];
	export const chartCssVars = { brushBorder: "currentColor" };
	export function useChartStable() {
		return { xScale, innerWidth: 100, innerHeight: 40, isLoaded: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, containerRef: { current: null } };
	}
	export function useChartPortalContainer() { return null; }
`;

const realChartHarness = `
	import { useState } from "react";
	import { ChartBrush } from "@/components/ui-charts/chart-brush";
	import { LineChart } from "@/components/ui-charts/line-chart";
	import { Line } from "@/components/ui-charts/line";
	export function RealBrushHarness({ domainEnd = 100, ...props }) {
		const data = [{ date: new Date(0), value: 10 }, { date: new Date(domainEnd), value: 20 }];
		return <LineChart data={data} animationDuration={0} margin={{ top: 8, right: 0, bottom: 8, left: 0 }}><Line dataKey="value" animate={false} /><ChartBrush {...props} /></LineChart>;
	}
	export function EchoBrushHarness() {
		const [selection, setSelection] = useState({ start: new Date(20), end: new Date(80) });
		return <RealBrushHarness selection={selection} onSelectionChange={setSelection} />;
	}
`;

const measuredSize = {
	"@/components/ui-charts/measured-parent-size": `export function MeasuredParentSize({ children }) { return children({ width: 600, height: 80 }); }`,
};

function range(start, end) {
	return { start: new Date(start), end: new Date(end) };
}

test("brush layout preserves a selected range when equivalent data is replaced", async () => {
	const view = await renderComponent({
		source: `
			import { ChartBrushLayout } from "@/components/ui-charts/chart-brush-layout";
			export default function Fixture({ revision = 0, end = 100 }) {
				const data = [{ date: new Date(0), value: revision }, { date: new Date(end), value: revision }];
				return <ChartBrushLayout data={data} enabled height={60}>
					{({ brushSelection, onBrushSelectionChange }) => <>
						<button onClick={() => onBrushSelectionChange({ start: new Date(20), end: new Date(80) })}>Select range</button>
						<output>{brushSelection ? brushSelection.start.getTime() + ":" + brushSelection.end.getTime() : "none"}</output>
					</>}
				</ChartBrushLayout>;
			}`,
	});
	await view.click(view.getByRole("button", { name: "Select range" }));
	assert.equal(view.container.querySelector("output").textContent, "20:80");
	await view.rerender({ revision: 1 });
	assert.equal(view.container.querySelector("output").textContent, "20:80");
	await view.rerender({ revision: 1, end: 200 });
	assert.equal(view.container.querySelector("output").textContent, "0:200");
	await view.unmount();
});

test("both brush handles are focusable sliders and keyboard changes emit a selected date range", async () => {
	const changes = [];
	const view = await renderComponent({
		source: `import { ChartBrush } from "@/components/ui-charts/chart-brush"; export function BrushHarness(props) { return <svg><ChartBrush {...props} /></svg>; }`,
		exportName: "BrushHarness",
		mocks: { "@/components/ui-charts/chart-context": chartContext },
		props: {
			initialSelection: { start: new Date(20), end: new Date(80) },
			onSelectionChange: (selection) => changes.push(selection),
		},
	});
	const start = view.getByRole("slider", { name: "Selection start" });
	const end = view.getByRole("slider", { name: "Selection end" });
	await view.focus(start);
	assert.equal(view.isFocused(start), true);
	await view.press(start, "ArrowRight");
	assert.equal(start.getAttribute("aria-valuenow"), "21");
	assert.equal(changes.at(-1).start.getTime(), 21);
	assert.equal(changes.at(-1).end.getTime(), 80);
	await view.focus(end);
	await view.press(end, "PageDown");
	assert.equal(end.getAttribute("aria-valuenow"), "70");
	assert.equal(changes.at(-1).end.getTime(), 70);
	await view.press(start, "Home");
	assert.equal(start.getAttribute("aria-valuenow"), "0");
	assert.equal(changes.at(-1).start.getTime(), 0);
});

test("the actual LineChart brush demo renders reachable controls in its 64px strip", async () => {
	const view = await renderComponent({
		entry: "components/website/demos/ui-charts/chart-utility-demo.tsx",
		exportName: "BrushDemo",
		mocks: {
			"@/components/ui-charts/measured-parent-size": `export function MeasuredParentSize({ children }) { return children({ width: 600, height: 64 }); }`,
		},
	});
	const start = view.getByRole("slider", { name: "Selection start" });
	assert.equal(start.closest("[aria-hidden=true]") === null, true);
	const strip = start.closest("svg");
	assert.equal(strip.getAttribute("role"), "group");
	const mainPlot = view.container.querySelector("svg");
	assert.equal(mainPlot.getAttribute("aria-hidden"), "true");
	const before = mainPlot.querySelector("path[d]").getAttribute("d");
	await view.focus(start);
	await view.press(start, "PageUp");
	assert.equal(start.getAttribute("aria-valuenow"), "10");
	assert.notEqual(mainPlot.querySelector("path[d]").getAttribute("d"), before);
});

test("controlled selections update real chart handles without losing focus and stay authoritative", async () => {
	const changes = [];
	const props = { selection: range(20, 80), initialSelection: range(5, 95), onSelectionChange: (selection) => changes.push(selection) };
	const view = await renderComponent({ source: realChartHarness, exportName: "RealBrushHarness", mocks: measuredSize, props });
	const start = view.getByRole("slider", { name: "Selection start" });
	assert.equal(start.getAttribute("aria-valuenow"), "20");
	await view.focus(start);
	await view.rerender({ ...props, selection: range(40, 90) });
	assert.equal(view.isFocused(start), true);
	assert.equal(start.getAttribute("aria-valuenow"), "40");
	await view.press(start, "ArrowRight");
	assert.equal(start.getAttribute("aria-valuenow"), "40", "the parent can reject a proposed change");
	assert.equal(changes.at(-1).start.getTime(), 41);
	await view.rerender({ ...props, selection: range(40, 90), domainEnd: 200 });
	assert.equal(start.getAttribute("aria-valuenow"), "20", "scale changes reproject the same selected dates");
	await view.rerender({ ...props, selection: null });
	assert.equal(view.container.querySelectorAll("[role=slider]").length, 0);
});

test("controlled keyboard updates echo exact selected dates without padding drift", async () => {
	const view = await renderComponent({ source: realChartHarness, exportName: "EchoBrushHarness", mocks: measuredSize });
	const start = view.getByRole("slider", { name: "Selection start" });
	await view.focus(start);
	await view.press(start, "ArrowRight");
	assert.equal(start.getAttribute("aria-valuenow"), "21");
	await view.press(start, "ArrowRight");
	assert.equal(start.getAttribute("aria-valuenow"), "22");
	assert.equal(view.getByRole("slider", { name: "Selection end" }).getAttribute("aria-valuenow"), "80");
	assert.equal(view.isFocused(start), true);
});

test("rerendering an uncontrolled initial range synchronizes hit handles and the next keyboard change", async () => {
	const changes = [];
	const props = { initialSelection: range(20, 80), onSelectionChange: (selection) => changes.push(selection) };
	const view = await renderComponent({ source: realChartHarness, exportName: "RealBrushHarness", mocks: measuredSize, props });
	await view.rerender({ ...props, initialSelection: range(40, 90) });
	const start = view.getByRole("slider", { name: "Selection start" });
	assert.equal(start.getAttribute("aria-valuenow"), "40");
	await view.press(start, "ArrowRight");
	assert.equal(start.getAttribute("aria-valuenow"), "41");
	assert.equal(changes.at(-1).start.getTime(), 41);
	await view.rerender({ ...props, initialSelection: range(40, 90) });
	assert.equal(start.getAttribute("aria-valuenow"), "41", "an equivalent Date object does not reset the user's interaction");
});
