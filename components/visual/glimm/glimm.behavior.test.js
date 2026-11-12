const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const source = `
import { useRef } from "react";
import { GlimmSweep } from "@/components/visual/glimm";
export default function Example({ onChange, onMidpoint, onComplete }) {
	const ref = useRef(null);
	return <GlimmSweep ref={ref} options={{ onMidpoint, onComplete }}>
		<button onClick={() => ref.current?.play(onChange)}>Play</button>
	</GlimmSweep>;
}`;

const mocks = {
	glimm: `
		export const createShader = () => null;
		export const createMeshShader = () => null;
		export const createNamedropShader = () => null;
		export const resolvePalette = () => ({});
		export const playSweep = () => { throw new Error("Unexpected animated sweep"); };
	`,
};

for (const reducedMotion of [true, false]) {
	test(`${reducedMotion ? "reduced motion" : "unavailable WebGL"} waits for midpoint work before completion`, async () => {
		const originalMatchMedia = window.matchMedia;
		window.matchMedia = () => ({ matches: reducedMotion });
		const events = [];
		let finishMidpoint;
		const midpoint = new Promise((resolve) => { finishMidpoint = resolve; });
		try {
			const view = await renderComponent({
				source,
				mocks,
				props: {
					onChange: () => events.push("change"),
					onMidpoint: () => { events.push("midpoint"); return midpoint; },
					onComplete: () => events.push("complete"),
				},
			});
			await view.click(view.getByRole("button", { name: "Play" }));
			assert.deepEqual(events, ["change", "midpoint"]);
			await React.act(async () => { finishMidpoint(); await midpoint; });
			assert.deepEqual(events, ["change", "midpoint", "complete"]);
			assert.equal(view.container.querySelectorAll("canvas").length, 0);
		} finally {
			window.matchMedia = originalMatchMedia;
		}
	});
}
