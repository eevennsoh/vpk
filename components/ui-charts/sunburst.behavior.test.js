const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../scripts/lib/render-component.js");

const source = `
import { SunburstChart } from "@/components/ui-charts/sunburst-chart";
import { SunburstCenter } from "@/components/ui-charts/sunburst-center";
import { SunburstSegment } from "@/components/ui-charts/sunburst-segment";
import { SunburstHint } from "@/components/ui-charts/sunburst-hint";
import { buildArcs } from "@/components/ui-charts/sunburst";
const data = { name: "Workspace", children: [
 { name: "Product", children: [{ name: "Design", value: 24 }, { name: "Research", value: 16 }] },
 { name: "Engineering", children: [{ name: "Platform", value: 32 }] },
] };
const { arcs } = buildArcs(data);
export default function Example() {
 return <SunburstChart data={data} size={320}>
  {arcs.map(arc => <SunburstSegment index={arc.arcIndex} key={arc.id} />)}
  <SunburstCenter /><SunburstHint />
 </SunburstChart>;
}`;

for (const key of ["Enter", " "]) {
	test(`sunburst supports ${key === " " ? "Space" : key} drill-down and zoom-out under reduced motion`, async () => {
		const matchMedia = window.matchMedia;
		window.matchMedia = (query) => ({ matches: query.includes("prefers-reduced-motion"), media: query, addEventListener() {}, removeEventListener() {} });
		try {
			const view = await renderComponent({ source });
			const product = view.getByRole("button", { name: "Product: 40, drill down" });
			assert.ok(view.tabOrder().includes("Product: 40, drill down"));
			await view.focus(product);
			await view.press(product, key);
			await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
			const zoomOut = view.getByRole("button", { name: "Zoom out from Product" });
			assert.ok(view.tabOrder().includes("Zoom out from Product"));
			assert.ok(view.isFocused(zoomOut), "keyboard navigation moves focus to the zoom-out control");
			assert.ok(view.queryByRole("button", { name: "Engineering: 32, drill down" }) === null);
			await view.press(zoomOut, key);
			assert.ok(view.queryByRole("button", { name: "Engineering: 32, drill down" }) !== null);
			await view.unmount();
		} finally {
			window.matchMedia = matchMedia;
		}
	});
}

test("multiple sunburst breadcrumbs group chart controls without duplicate navigation landmarks", async () => {
	const view = await renderComponent({
		source: `
			import { SunburstBreadcrumb } from "@/components/ui-charts/sunburst-breadcrumb";
			export default function Example() {
				return <>
					<SunburstBreadcrumb><button type="button">First chart root</button></SunburstBreadcrumb>
					<SunburstBreadcrumb><button type="button">Second chart root</button></SunburstBreadcrumb>
				</>;
			}
		`,
	});
	assert.equal(view.getAllByRole("group", { name: "Drill-down path" }).length, 2);
	assert.ok(view.queryByRole("navigation", { name: "Drill-down path" }) === null);
	assert.deepEqual(view.tabOrder(), ["First chart root", "Second chart root"]);
});

test("playKey replays completed sunburst segments and labels", async () => {
	const clocks = new Set();
	globalThis.sunburstReplayClocks = clocks;
	const replaySource = source
		.replace('import { SunburstHint }', 'import { SunburstLabels } from "@/components/ui-charts/sunburst-labels";\nimport { SunburstHint }')
		.replace('function Example()', 'function Example({ playKey = 0 })')
		.replace('data={data} size={320}', 'data={data} size={320} playKey={playKey}')
		.replace('<SunburstCenter /><SunburstHint />', '<SunburstCenter /><SunburstLabels /><SunburstHint />');
	const mocks = {
		"@/components/ui-charts/use-mount-progress": `
			import { useMotionValue } from "motion/react";
			import { useLayoutEffect } from "react";
			export function useMountProgress(_transition, _delay, replayKey) {
				const progress = useMotionValue(0);
				useLayoutEffect(() => {
					globalThis.sunburstReplayClocks.add(progress);
					progress.jump(0);
					return () => globalThis.sunburstReplayClocks.delete(progress);
				}, [progress, replayKey]);
				return progress;
			}
		`,
	};
	try {
		const view = await renderComponent({ source: replaySource, mocks });
		const segmentPath = () => view.getByRole("button", { name: "Product: 40, drill down" }).querySelector("path").getAttribute("d");
		const labelOpacity = () => view.getByText("Product").style.opacity;
		const initialPath = segmentPath();
		assert.equal(labelOpacity(), "0");
		await act(() => { for (const clock of clocks) { clock.jump(1); } });
		assert.notEqual(segmentPath(), initialPath);
		assert.equal(labelOpacity(), "1");

		await view.rerender({ playKey: 1 });
		assert.equal(segmentPath(), initialPath, "a completed segment starts again from its initial shape");
		assert.equal(labelOpacity(), "0", "completed labels hide for the next reveal");
		await act(() => { for (const clock of clocks) { clock.jump(1); } });
		assert.notEqual(segmentPath(), initialPath);
		assert.equal(labelOpacity(), "1");
		await view.unmount();
	} finally {
		delete globalThis.sunburstReplayClocks;
	}
});

for (const key of ["Enter", " "]) {
	test(`animated ${key === " " ? "Space" : key} drill-down focuses a hub that mounts after navigation starts`, async () => {
		const view = await renderComponent({ source });
		assert.ok(view.queryByRole("button", { name: "Zoom out from Product" }) === null);
		const product = view.getByRole("button", { name: "Product: 40, drill down" });
		await view.focus(product);
		await view.press(product, key);
		await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
		const zoomOut = view.getByRole("button", { name: "Zoom out from Product" });
		assert.ok(view.isFocused(zoomOut), "the newly mounted hub retains keyboard focus after the segment disappears");
	});
}
