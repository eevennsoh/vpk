const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { act } = require("react");
const { loadCjsModuleFromText } = require("../../scripts/lib/esbuild-cjs-loader.js");
const { renderComponent } = require("../../scripts/lib/render-component.js");

const source = `
export { linePathD, areaClosedD } from "./components/ui-charts/line-path";
export { gridLinePositions } from "./components/ui-charts/grid-lines";
export { buildYScalesFromDomains } from "./components/ui-charts/y-axis-scales";
export { localPoint } from "./components/ui-charts/local-point";
`;
const built = esbuild.buildSync({
	stdin: { contents: source, loader: "tsx", resolveDir: process.cwd() },
	bundle: true,
	format: "cjs",
	platform: "node",
	jsx: "automatic",
	external: ["react"],
	write: false,
});
const { linePathD, areaClosedD, gridLinePositions, buildYScalesFromDomains, localPoint } = loadCjsModuleFromText(
	built.outputFiles[0].text,
	path.join(__dirname, "bklit-migration-harness.cjs"),
);

test("D3 migration preserves line gaps and the first y-scale range endpoint as the area baseline", () => {
	const points = [{ x: 0, y: 10 }, { x: 10, y: 20 }, { x: 20, y: null }, { x: 30, y: 15 }];
	const accessors = { x: (point) => point.x, y: (point) => point.y, defined: (point) => point.y !== null };
	assert.equal(linePathD(points, accessors), "M0,10L10,20M30,15Z");
	assert.equal(areaClosedD(points.slice(0, 2), { ...accessors, yScale: { range: () => [100, 0] } }), "M0,10L10,20L10,100L0,100Z");
	assert.equal(linePathD([], accessors), "");
});

test("D3 migration preserves band-centered grid lines and independent y-axis scales", () => {
	const band = Object.assign((value) => ({ a: 0, b: 20 })[value], {
		domain: () => ["a", "b"],
		bandwidth: () => 10,
	});
	assert.deepEqual(gridLinePositions(band, { offset: 2 }), [7, 27]);
	const scales = buildYScalesFromDomains({
		lines: [{ dataKey: "amount", yAxisId: "left" }, { dataKey: "percent", yAxisId: "right" }],
		innerHeight: 200,
		domainsByAxis: { left: [-20, 80], right: [0, 1] },
	});
	assert.equal(scales.left(-20), 200);
	assert.equal(scales.left(80), 0);
	assert.equal(scales.right(0.5), 100);
});

test("pointer conversion respects SVG transforms and touch coordinates", () => {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
	svg.append(group);
	svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform(matrix) { return matrix.apply(this.x, this.y); } });
	svg.getScreenCTM = () => ({ inverse: () => ({ apply: (x, y) => ({ x: (x - 10) / 2, y: (y - 20) / 2 }) }) });
	assert.deepEqual(localPoint(group, { clientX: 70, clientY: 90 }), { x: 30, y: 35 });
	assert.deepEqual(localPoint(group, { changedTouches: [{ clientX: 30, clientY: 40 }] }), { x: 10, y: 10 });
});

test("the migrated LineChart renders its series and updates hover context", async () => {
	const view = await renderComponent({
		source: `
			import { LineChart, Line } from "@/components/ui-charts/line-chart";
			import { useChartHover } from "@/components/ui-charts/chart-context";
			function HoverValue() {
				const { tooltipData } = useChartHover();
				return <text data-hover-value="">{tooltipData ? String(tooltipData.point.value) : "idle"}</text>;
			}
			export default function Fixture() {
				return <LineChart animationDuration={0} data={[
					{ date: new Date("2026-01-01"), value: 10 },
					{ date: new Date("2026-01-02"), value: 20 },
					{ date: new Date("2026-01-03"), value: 30 },
				]}><Line dataKey="value" /><HoverValue /></LineChart>;
			}`,
		mocks: {
			"@/components/ui-charts/measured-parent-size": "export function MeasuredParentSize({ children }) { return children({ width: 640, height: 320 }); }",
		},
	});
	assert.equal(view.container.querySelectorAll("svg path[d]").length > 0, true);
	assert.equal(view.container.querySelector("[data-hover-value]").textContent, "idle");
	const hitArea = view.container.querySelector('g[transform] > rect[fill="transparent"]');
	assert.equal(Boolean(hitArea), true);
	const svg = hitArea.ownerSVGElement;
	svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
	svg.getScreenCTM = () => ({ inverse: () => ({}) });
	const event = new MouseEvent("mousemove", { bubbles: true, clientX: 320, clientY: 100 });
	await act(() => hitArea.dispatchEvent(event));
	await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
	assert.equal(view.container.querySelector("[data-hover-value]").textContent, "20");
});

test("hovered line tooltip refreshes when its data changes without pointer movement", async () => {
	const view = await renderComponent({
		source: `
			import { useMemo } from "react";
			import { LineChart, Line } from "@/components/ui-charts/line-chart";
			import { useChartHover } from "@/components/ui-charts/chart-context";
			function HoverValue() {
				const { tooltipData } = useChartHover();
				return <text data-hover-value="">{tooltipData ? String(tooltipData.point.value) : "idle"}</text>;
			}
			export default function Fixture({ value = 10 }) {
				const data = useMemo(() => [
					{ date: new Date("2026-01-01"), value: 0 },
					{ date: new Date("2026-01-02"), value },
					{ date: new Date("2026-01-03"), value: 200 },
				], [value]);
				return <LineChart animationDuration={0} data={data}><Line dataKey="value" /><HoverValue /></LineChart>;
			}`,
		mocks: {
			"@/components/ui-charts/measured-parent-size": "export function MeasuredParentSize({ children }) { return children({ width: 640, height: 320 }); }",
		},
	});
	const hitArea = view.container.querySelector('g[transform] > rect[fill="transparent"]');
	const svg = hitArea.ownerSVGElement;
	svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
	svg.getScreenCTM = () => ({ inverse: () => ({}) });
	await act(() => hitArea.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 320, clientY: 100 })));
	await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
	assert.equal(view.container.querySelector("[data-hover-value]").textContent, "10");
	await view.rerender({ value: 110 });
	await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
	assert.equal(view.container.querySelector("[data-hover-value]").textContent, "110");
});

test("line data morph finishes while the y-scale changes between animation frames", async () => {
	globalThis.chartPathAnimations = [];
	try {
		const view = await renderComponent({
			source: `
				import { useMemo } from "react";
				import { curveLinear } from "d3-shape";
				import { useAnimatedSeriesPath } from "@/components/ui-charts/use-animated-series-path";
				const xAccessor = (point) => point.date;
				const xScale = Object.assign((date) => date.getTime(), { domain: () => [new Date(0), new Date(100)] });
				const settledScale = Object.assign((value) => value * 2, { domain: () => [0, 200] });
				export default function Fixture({ value = 10, scale = 1 }) {
					const data = useMemo(() => [{ date: new Date(0), value }, { date: new Date(100), value: value + 10 }], [value]);
					const yScale = useMemo(() => (value) => value * scale, [scale]);
					const { pathD, isPathAnimating } = useAnimatedSeriesPath({ renderData: data, xAccessor, xScale, yScale,
						settledYScale: settledScale, dataKey: "value", curve: curveLinear, chartPhase: "ready",
						durationMs: 100, innerWidth: 100, enabled: true });
					return <output data-animating={String(isPathAnimating)}>{pathD}</output>;
				}`,
			mocks: {
				"motion/react": `export function useReducedMotion() { return false; }
					export function animate(_from, _to, options) {
						const animation = { options, stopped: false };
						globalThis.chartPathAnimations.push(animation);
						return { stop() { animation.stopped = true; } };
					}`,
			},
		});
		await view.rerender({ value: 100, scale: 1 });
		const animation = globalThis.chartPathAnimations.at(-1);
		assert.equal(Boolean(animation), true);
		await act(() => animation.options.onUpdate(0.5));
		await view.rerender({ value: 100, scale: 1.5 });
		await view.rerender({ value: 100, scale: 2 });
		assert.equal(animation.stopped, false, "scale ticks must not cancel the data morph");
		await act(() => { animation.options.onUpdate(1); animation.options.onComplete(); });
		assert.equal(view.container.querySelector("output").getAttribute("data-animating"), "false");
		assert.equal(view.container.querySelector("output").textContent, "M0,200L100,220");
		await view.unmount();
	} finally {
		delete globalThis.chartPathAnimations;
	}
});

test("reduced-motion conceal completes the loading handoff without animating", async () => {
	const view = await renderComponent({
		source: `
			import { useCallback, useState } from "react";
			import { ChartRevealClip } from "@/components/ui-charts/chart-reveal-clip";
			export default function Fixture() {
				const [complete, setComplete] = useState(false);
				const finish = useCallback(() => setComplete(true), []);
				return <svg><ChartRevealClip clipPathId="reveal" height={100} targetWidth={200}
					mode="conceal" revealEpoch={1} onComplete={finish} />
					<text>{complete ? "complete" : "pending"}</text></svg>;
			}`,
		mocks: {
			"motion/react": "export function useReducedMotion() { return true; } export const m = {};",
		},
	});
	assert.equal(view.container.textContent, "complete");
	assert.equal(view.container.querySelector("clipPath rect").getAttribute("width"), "200");
});

test("bands and projections on axes without a line receive independent value scales", async () => {
	const view = await renderComponent({
		source: `
			import { LineChart, Line } from "@/components/ui-charts/line-chart";
			import { Band } from "@/components/ui-charts/band";
			import { ProjectionLine } from "@/components/ui-charts/projection-line";
			import { useChartStable } from "@/components/ui-charts/chart-context";
			function AxisValues() {
				const { yScales, innerHeight } = useChartStable();
				return <text data-axis-values="">{JSON.stringify({
					axes: Object.keys(yScales), innerHeight,
					bandY: yScales.right?.(200), forecastY: yScales.forecast?.(8000),
				})}</text>;
			}
			export default function Fixture() {
				return <LineChart animationDuration={0} data={[
					{ date: new Date(0), value: 10, lower: 100, upper: 200 },
					{ date: new Date(100), value: 20, lower: 200, upper: 300 },
				]}><Line dataKey="value" />
					<Band lowerKey="lower" upperKey="upper" yAxisId="right" />
					<ProjectionLine yAxisId="forecast" data={[{ date: new Date(100), value: 5000 }, { date: new Date(200), value: 8000 }]} />
					<AxisValues />
				</LineChart>;
			}`,
		mocks: {
			"@/components/ui-charts/measured-parent-size": "export function MeasuredParentSize({ children }) { return children({ width: 600, height: 200 }); }",
		},
	});
	const values = JSON.parse(view.container.querySelector("[data-axis-values]").textContent);
	assert.deepEqual(values.axes.sort(), ["forecast", "left", "right"]);
	assert.equal(values.bandY >= 0 && values.bandY <= values.innerHeight, true);
	assert.equal(values.forecastY >= 0 && values.forecastY <= values.innerHeight, true);
});

const overlayRoots = [
	["candlestick", '<CandlestickChart animationDuration={0} data={[{ date: new Date(0), open: 10, close: 20, low: 5, high: 25 }, { date: new Date(100), open: 20, close: 30, low: 15, high: 35 }]}>{content}</CandlestickChart>'],
	["scatter", '<ScatterChart animationDuration={0} data={[{ date: new Date(0), value: 10 }, { date: new Date(100), value: 20 }]}>{content}</ScatterChart>'],
	["live", '<LiveLineChart paused data={[{ time: now / 1000 - 1, value: 10 }, { time: now / 1000, value: 20 }]} value={20}>{content}</LiveLineChart>'],
	["bar", '<BarChart animationDuration={0} data={[{ name: "A", value: 10 }, { name: "B", value: 20 }]}>{content}</BarChart>'],
];

for (const [name, chart] of overlayRoots) {
	test(`${name} charts expose overlay controls while keeping decorative series hidden`, async () => {
		const overlay = name === "bar"
			? '<MarkerGroup x={20} y={20} animate={false} markers={[{ date: new Date(0), icon: "E", title: "Open event", onClick: () => setChanges((count) => count + 1) }]} />'
			: '<ChartBrush onSelectionChange={() => setChanges((count) => count + 1)} />';
		const view = await renderComponent({
			source: `
				import { useState } from "react";
				import { CandlestickChart } from "@/components/ui-charts/candlestick-chart";
				import { ScatterChart } from "@/components/ui-charts/scatter-chart";
				import { LiveLineChart } from "@/components/ui-charts/live-line-chart";
				import { BarChart } from "@/components/ui-charts/bar-chart";
				import { ChartBrush } from "@/components/ui-charts/chart-brush";
				import { MarkerGroup } from "@/components/ui-charts/markers/marker-group";
				const now = Date.now();
				export default function Fixture({ showOverlay = true }) {
					const [changes, setChanges] = useState(0);
					const content = <><text data-decorative="">Series</text>{showOverlay ? ${overlay} : null}</>;
					return <><output>{changes}</output>${chart}</>;
				}`,
			mocks: {
				"@/components/ui-charts/measured-parent-size": "export function MeasuredParentSize({ children }) { return children({ width: 600, height: 200 }); }",
				"@/components/ui-charts/chart-parent-size": "export function useElementSize() { return { width: 600, height: 200 }; }",
			},
		});
		await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
		const control = name === "bar"
			? view.getByRole("button", { name: "Open event" })
			: view.getByRole("slider", { name: "Selection start" });
		assert.equal(control.closest('[aria-hidden="true"]') === null, true);
		assert.equal(control.closest("svg").getAttribute("role"), "group");
		assert.equal(view.container.querySelector("[data-decorative]").closest('[aria-hidden="true"]') !== null, true);
		await view.focus(control);
		await view.press(control, name === "bar" ? "Enter" : "ArrowRight");
		assert.equal(Number(view.container.querySelector("output").textContent) > 0, true);
		await view.rerender({ showOverlay: false });
		assert.equal(view.container.querySelector("svg").getAttribute("aria-hidden"), "true");
	});
}

test("heatmap month labels preserve UTC dates across viewer timezones", async () => {
	const previousTimezone = process.env.TZ;
	try {
		for (const timezone of ["America/Los_Angeles", "Asia/Kuala_Lumpur"]) {
			process.env.TZ = timezone;
			const view = await renderComponent({
				source: `
					import { useRef } from "react";
					import { HeatmapXAxis } from "@/components/ui-charts/heatmap/heatmap-x-axis";
					import { Context } from "@/components/ui-charts/heatmap/heatmap-context";
					const data = ["2026-02-01T00:00:00Z", "2026-03-01T00:00:00Z"].map((date, index) => ({
						bin: index, bins: [{ bin: 0, count: 1, date: new Date(date) }],
					}));
					export default function Fixture() {
						const containerRef = useRef(null);
						return <Context value={{ containerRef, data, margin: { left: 0 }, xScale: (index) => index * 50 }}>
							<div ref={containerRef}><HeatmapXAxis /></div>
						</Context>;
					}
					// ${timezone}`,
				mocks: {
					"@/components/ui-charts/heatmap/heatmap-context": 'import { createContext, use } from "react"; export const Context = createContext(null); export function useHeatmap() { return use(Context); }',
				},
			});
			assert.deepEqual(Array.from(view.container.querySelectorAll("span"), (node) => node.textContent), ["Feb", "Mar"], timezone);
			await view.unmount();
		}
	} finally {
		if (previousTimezone === undefined) delete process.env.TZ;
		else process.env.TZ = previousTimezone;
	}
});

test("path metrics follow a replaced path reference with unchanged data dependencies", async () => {
	const view = await renderComponent({
		source: `
			import { useLayoutEffect, useRef } from "react";
			import { usePathStrokeMetrics } from "@/components/ui-charts/path-stroke-utils";
			export default function Fixture({ second = false }) {
				const firstRef = useRef(null);
				const secondRef = useRef(null);
				useLayoutEffect(() => {
					firstRef.current.getTotalLength = () => 10;
					secondRef.current.getTotalLength = () => 20;
				}, []);
				const metrics = usePathStrokeMetrics(second ? secondRef : firstRef, []);
				return <><svg><path ref={firstRef} d="M0,0L10,0" /><path ref={secondRef} d="M0,0L20,0" /></svg>
					<output>{metrics.pathD}:{metrics.pathLength}</output></>;
			}`,
	});
	assert.equal(view.container.querySelector("output").textContent, "M0,0L10,0:10");
	await view.rerender({ second: true });
	assert.equal(view.container.querySelector("output").textContent, "M0,0L20,0:20");
});

test("bar chart phase observers receive loading status and ready completion", async () => {
	const phases = [];
	const onPhaseChange = (phase) => phases.push(phase);
	const view = await renderComponent({
		entry: "components/ui-charts/bar-chart.tsx",
		exportName: "BarChart",
		props: { data: [{ name: "A", value: 10 }], animationDuration: 0, status: "loading", onPhaseChange },
		mocks: {
			"@/components/ui-charts/measured-parent-size": "export function MeasuredParentSize({ children }) { return children({ width: 600, height: 200 }); }",
		},
	});
	assert.deepEqual(phases, ["loading"]);
	await view.rerender({ data: [{ name: "A", value: 10 }], animationDuration: 0, status: "ready", onPhaseChange });
	assert.equal(phases.at(-1), "ready");
});
