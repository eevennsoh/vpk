// Assertions compare strings and booleans, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// Drives the hook through a probe with the four handlers on buttons and the state in a status line.
const PROBE = `import { useSidebarHoverReveal } from "@/components/projects/rovo-core/hooks/use-sidebar-hover-reveal";
	export default function Probe() {
		const reveal = useSidebarHoverReveal();
		return <div>
			<p role="status">{reveal.hoverRevealActive ? "revealed" : "hidden"}</p>
			<button type="button" onClick={reveal.handleSidebarHoverEnter}>toggle enter</button>
			<button type="button" onClick={reveal.handleSidebarHoverLeave}>toggle leave</button>
			<button type="button" onClick={reveal.handleSidebarContentMouseEnter}>sidebar enter</button>
			<button type="button" onClick={reveal.handleSidebarContentMouseLeave}>sidebar leave</button>
		</div>;
	}`;

const wait = (ms) => React.act(() => new Promise((resolve) => setTimeout(resolve, ms)));

async function renderProbe(durationToken) {
	document.documentElement.style.setProperty("--duration-medium", durationToken);
	const view = await renderComponent({ source: PROBE });
	return {
		press: (name) => view.click(view.getByRole("button", { name })),
		state: () => view.getByText(/^(revealed|hidden)$/u).textContent,
	};
}

test("hovering the toggle reveals the sidebar; leaving hides it after the motion duration", async () => {
	const probe = await renderProbe("400ms");
	assert.equal(probe.state(), "hidden");
	await probe.press("toggle enter");
	assert.equal(probe.state(), "revealed");
	await probe.press("toggle leave");
	await wait(100);
	assert.equal(probe.state(), "revealed", "still revealed while the pointer travels to the sidebar");
	await wait(500);
	assert.equal(probe.state(), "hidden");
});

test("entering the revealed sidebar cancels the close; leaving it schedules the close again", async () => {
	const probe = await renderProbe("150ms");
	await probe.press("toggle enter");
	await probe.press("toggle leave");
	await probe.press("sidebar enter");
	await wait(300);
	assert.equal(probe.state(), "revealed", "the pending close was cancelled");
	await probe.press("sidebar leave");
	await wait(300);
	assert.equal(probe.state(), "hidden");
});

test("the close delay follows the duration token, in seconds too", async () => {
	// 1.5 s is far from both the 200 ms fallback and a 1.5 ms misread, so either would show here.
	const probe = await renderProbe("1.5s");
	await probe.press("toggle enter");
	await probe.press("toggle leave");
	await wait(400);
	assert.equal(probe.state(), "revealed", "1.5s is 1,500 ms, not 1.5 ms or the 200 ms fallback");
	await wait(1400);
	assert.equal(probe.state(), "hidden");
});
