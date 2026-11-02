const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const source = `
import { TooltipIndicator } from "@/components/ui-charts/tooltip/tooltip-indicator";
export default function Example(props) {
 return <svg><TooltipIndicator animate={false} colorEdge="red" colorMid="blue" height={100} visible x={20} {...props} /></svg>;
}`;
const stops = (view) => [...view.container.querySelectorAll("stop")].map((stop) => ({
	offset: stop.getAttribute("offset"),
	color: stop.style.stopColor,
	opacity: stop.style.stopOpacity,
}));

for (const fadeEdges of [true, false]) {
	test(`tooltip indicators retain edge and midpoint colors with fading ${fadeEdges ? "enabled" : "disabled"}`, async () => {
		const view = await renderComponent({ source, props: { fadeEdges } });
		assert.deepEqual(stops(view), [
			{ offset: "0%", color: "red", opacity: fadeEdges ? "0" : "1" },
			{ offset: "10%", color: "red", opacity: "1" },
			{ offset: "50%", color: "blue", opacity: "1" },
			{ offset: "90%", color: "red", opacity: "1" },
			{ offset: "100%", color: "red", opacity: fadeEdges ? "0" : "1" },
		]);
	});
}

test("an explicit bottom color retains the new one-way ramp", async () => {
	const view = await renderComponent({ source, props: { colorEnd: "green", fadeEdges: false } });
	const rendered = stops(view);
	assert.equal(rendered[0].color, "blue");
	assert.equal(rendered.at(-1).color, "green");
});
