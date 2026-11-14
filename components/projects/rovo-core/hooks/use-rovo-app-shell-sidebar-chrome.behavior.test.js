// Assertions compare strings and booleans, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// The hook inside the global sidebar context, with the shell's chat sidebar state held locally.
// The probe counts renders so the Rovo case can show the Studio-only gate costs it nothing.
const PROBE = `import { useRef, useState } from "react";
	import { SidebarProvider, useSidebar } from "@/app/contexts/context-sidebar";
	import { useRovoAppShellSidebarChrome } from "@/components/projects/rovo-core/hooks/use-rovo-app-shell-sidebar-chrome";
	function Shell({ gate }) {
		const [sidebarOpen, setSidebarOpen] = useState(true);
		const chat = useRef({}).current;
		chat.sidebarOpen = sidebarOpen;
		chat.setSidebarOpen = setSidebarOpen;
		const renders = useRef(0);
		renders.current += 1;
		const chrome = useRovoAppShellSidebarChrome({ chat, gateWidthTransitionUntilMounted: gate, widths: { defaultWidth: 320, maxWidth: 480, minWidth: 240 } });
		const global = useSidebar();
		const firstTransition = useRef(null);
		firstTransition.current ??= chrome.isChromeWidthTransitionEnabled ? "on" : "off";
		return <div>
			<p data-probe="local">{sidebarOpen ? "open" : "closed"}</p>
			<p data-probe="global">{global.isVisible ? "visible" : "hidden"}</p>
			<p data-probe="first-transition">{firstTransition.current}</p>
			<p data-probe="transition">{chrome.isChromeWidthTransitionEnabled ? "on" : "off"}</p>
			<p data-probe="width">{chrome.sidebarStyle["--sidebar-width"]}</p>
			<p data-probe="renders">{String(renders.current)}</p>
			<button type="button" onClick={() => setSidebarOpen((open) => !open)}>local toggle</button>
			<button type="button" onClick={global.toggleSidebar}>global toggle</button>
		</div>;
	}
	export default function Probe({ gate }) {
		return <SidebarProvider defaultVisible><Shell gate={gate} /></SidebarProvider>;
	}`;

const nextFrame = () => React.act(() => new Promise((resolve) => setTimeout(resolve, 50)));
const read = (name) => document.querySelector(`[data-probe="${name}"]`).textContent;

test("the thread sidebar and the global top-navigation toggle stay in sync both ways", async () => {
	const view = await renderComponent({ props: { gate: false }, source: PROBE });
	assert.deepEqual([read("local"), read("global")], ["open", "visible"]);

	await view.click(view.getByRole("button", { name: "global toggle" }));
	assert.deepEqual([read("local"), read("global")], ["closed", "hidden"], "the nav toggle closes the thread sidebar");

	await view.click(view.getByRole("button", { name: "local toggle" }));
	assert.deepEqual([read("local"), read("global")], ["open", "visible"], "opening the thread sidebar updates the nav toggle");
	assert.equal(read("width"), "320px", "the default width drives --sidebar-width");
});

test("Rovo (no gate) transitions the chrome width from the first render and adds no render for the gate", async () => {
	await renderComponent({ props: { gate: false }, source: PROBE });
	assert.equal(read("first-transition"), "on", "on in the first render");
	const rendersAfterMount = read("renders");
	await nextFrame();
	assert.equal(read("transition"), "on");
	assert.equal(read("renders"), rendersAfterMount, "no extra render a frame after mount");
});

test("Studio (gated) keeps the chrome width transition off until a frame after mount", async () => {
	await renderComponent({ props: { gate: true }, source: PROBE });
	assert.equal(read("first-transition"), "off", "off in the first render, so the settle after hydration does not animate");
	await nextFrame();
	assert.equal(read("transition"), "on", "on after the first frame");
});
