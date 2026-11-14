// AgentLoading as a reader and a host see it: the live-region announcement, the visible status
// copy, the size and per-agent hooks the stylesheet keys on, and the reduced-motion switch.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { AgentLoading } from "@/components/ui-custom/agent-loading";

const AGENTS = [
	{ id: "cursor", name: "Cursor", status: "working", avatar: { fallbackText: "C" } },
	{ id: "rovo", name: "Rovo", status: "working", avatar: { fallbackText: "R" } },
	{ id: "claude", name: "Claude", status: "finished", avatar: { fallbackText: "Cl" } },
];

export default function Probe({ count = 2, finished = false, ...props }) {
	const agents = AGENTS.slice(0, count).map((agent) => (finished ? { ...agent, status: "finished" } : agent));
	return <AgentLoading agents={agents} {...props} />;
}
`;

function visual(view) {
	return view.container.querySelector("[data-size]");
}

function stubReducedMotion(matches) {
	const original = window.matchMedia;
	window.matchMedia = (query) => ({
		addEventListener() {},
		addListener() {},
		matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
		media: query,
		removeEventListener() {},
		removeListener() {},
	});
	return () => {
		window.matchMedia = original;
	};
}

test("AgentLoading announces the agents' state in a polite status region", async () => {
	const view = await renderComponent({ source: PROBE });
	const status = view.getByRole("status");
	assert.equal(status.getAttribute("aria-live"), "polite");
	assert.equal(status.querySelector(".sr-only")?.textContent, "2 agents working. Cursor, Rovo. ");

	await view.rerender({ count: 2, finished: true });
	assert.equal(view.getByRole("status").querySelector(".sr-only")?.textContent, "2 agents finished. Cursor, Rovo. ");
	await view.unmount();
});

test("AgentLoading uses a host aria-label instead of the derived announcement, and can stay silent", async () => {
	const view = await renderComponent({ props: { "aria-label": "Agents busy" }, source: PROBE });
	assert.equal(view.getByRole("status").getAttribute("aria-label"), "Agents busy");
	assert.equal(view.container.querySelector(".sr-only") === null, true);

	await view.rerender({ announce: false });
	assert.equal(view.queryByRole("status") === null, true);
	assert.equal(view.container.querySelector(".sr-only") === null, true);
	await view.unmount();
});

test("AgentLoading shows visible status copy beside the agents only when given", async () => {
	const view = await renderComponent({ props: { label: "Agents are drafting" }, source: PROBE });
	assert.equal(view.getByText("Agents are drafting").textContent, "Agents are drafting");
	const labelText = view.getByRole("status").lastElementChild?.textContent;
	assert.equal(labelText, "Agents are drafting");

	await view.rerender({});
	assert.equal(view.queryByText("Agents are drafting") === null, true);
	await view.unmount();
});

test("AgentLoading exposes its size and one hook per slotted agent for the stylesheet", async () => {
	const view = await renderComponent({ props: { count: 3 }, source: PROBE });
	assert.equal(visual(view).getAttribute("data-size"), "default");
	assert.equal(visual(view).getAttribute("aria-hidden"), "true");
	const agentIds = [...view.container.querySelectorAll("[data-agent-id]")].map((node) => node.getAttribute("data-agent-id")).sort();
	assert.deepEqual(agentIds, ["claude", "cursor", "rovo"]);

	await view.rerender({ count: 3, size: "small" });
	assert.equal(visual(view).getAttribute("data-size"), "small");
	await view.unmount();
});

test("AgentLoading marks itself reduced-motion when the user asks for less motion", async (t) => {
	const restore = stubReducedMotion(true);
	t.after(restore);
	const view = await renderComponent({ source: PROBE });
	assert.equal(visual(view).getAttribute("data-reduced-motion"), "true");
	await view.unmount();
});

test("AgentLoading leaves the reduced-motion mark off by default", async (t) => {
	const restore = stubReducedMotion(false);
	t.after(restore);
	const view = await renderComponent({ source: PROBE });
	assert.equal(visual(view).hasAttribute("data-reduced-motion"), false);
	await view.unmount();
});
