// Assertions compare strings, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../scripts/lib/render-component.js");

// Hover reveal flips on every pointer pass over the top-navigation toggle. Visibility-only
// readers (TopNavigation, the Rovo shells) must not re-render for it; hover readers must.
const PROBE = `import { useRef } from "react";
	import { SidebarProvider, useSidebarActions, useSidebarHovered, useSidebarState } from "@/app/contexts/context-sidebar";
	function useRenderCount() {
		const renders = useRef(0);
		renders.current += 1;
		return renders.current;
	}
	function VisibilityReader() {
		const { isVisible } = useSidebarState();
		const renders = useRenderCount();
		return <p data-probe="visibility">{(isVisible ? "visible" : "hidden") + ":" + renders}</p>;
	}
	function HoverReader() {
		const isHovered = useSidebarHovered();
		const renders = useRenderCount();
		return <p data-probe="hover">{(isHovered ? "hovered" : "idle") + ":" + renders}</p>;
	}
	function Controls() {
		const { setHovered, toggleSidebar } = useSidebarActions();
		const renders = useRenderCount();
		return <div>
			<p data-probe="controls">{String(renders)}</p>
			<button type="button" onClick={() => setHovered(true)}>hover in</button>
			<button type="button" onClick={() => setHovered(false)}>hover out</button>
			<button type="button" onClick={toggleSidebar}>toggle</button>
		</div>;
	}
	export default function Probe() {
		return <SidebarProvider><VisibilityReader /><HoverReader /><Controls /></SidebarProvider>;
	}`;

const read = (name) => document.querySelector(`[data-probe="${name}"]`).textContent;

test("hovering re-renders only hover readers, not visibility readers or action holders", async () => {
	const view = await renderComponent({ source: PROBE });
	assert.deepEqual([read("visibility"), read("hover"), read("controls")], ["hidden:1", "idle:1", "1"]);

	await view.click(view.getByRole("button", { name: "hover in" }));
	assert.deepEqual([read("visibility"), read("hover"), read("controls")], ["hidden:1", "hovered:2", "1"]);

	await view.click(view.getByRole("button", { name: "hover out" }));
	assert.deepEqual([read("visibility"), read("hover"), read("controls")], ["hidden:1", "idle:3", "1"]);
});

test("toggling visibility re-renders visibility readers but leaves hover state alone", async () => {
	const view = await renderComponent({ source: PROBE });
	await view.click(view.getByRole("button", { name: "toggle" }));
	assert.deepEqual([read("visibility"), read("hover"), read("controls")], ["visible:2", "idle:1", "1"]);
});

for (const hookName of ["useSidebarState", "useSidebarHovered", "useSidebarActions"]) {
	test(`${hookName} throws outside a SidebarProvider`, async () => {
		const source = `import { ${hookName} } from "@/app/contexts/context-sidebar";
			export default function Orphan() { ${hookName}(); return null; }`;
		await assert.rejects(renderComponent({ source }), new RegExp(`${hookName} must be used within a SidebarProvider`));
	});
}
