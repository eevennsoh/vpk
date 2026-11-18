// Rendered contract for Chain of Thought on Trace: the header line and its
// shimmer state, VPK's step rail (icon, connector, TWG offset), the two-row
// label and cycling byline, the headerRender escape hatch, and the Trace
// content rule turned off in favour of the connector.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const HEADER_SOURCE = `
import { ChainOfThought, ChainOfThoughtHeader } from "@/components/ui/chain-of-thought";

export default function Example({ state, showChevron }: { state: "preload" | "thinking" | "completed"; showChevron: boolean }) {
	return (
		<ChainOfThought>
			<ChainOfThoughtHeader duration={4} showChevron={showChevron} state={state} />
		</ChainOfThought>
	);
}
`;

const STEPS_SOURCE = `
import { useState } from "react";
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader, ChainOfThoughtStep } from "@/components/ui/chain-of-thought";

export default function Example() {
	const [customOpen, setCustomOpen] = useState(false);

	return (
		<ChainOfThought defaultOpen>
			<ChainOfThoughtHeader state="thinking">Working</ChainOfThoughtHeader>
			<ChainOfThoughtContent>
				<ChainOfThoughtStep label="Collecting sources" status="complete" description={null} />
				<ChainOfThoughtStep label="Cross-checking dates" status="active" description="Checking publication dates" collapsible>
					<p>Step detail</p>
				</ChainOfThoughtStep>
				<ChainOfThoughtStep label="Drafting answer" status="pending" />
				<ChainOfThoughtStep
					collapsible
					description={null}
					iconContainerClassName="twg-rail"
					iconContainerStyle={{ marginTop: 6 }}
					label="Connecting work"
					open={customOpen}
					onOpenChange={setCustomOpen}
					headerRender={({ isOpen, toggleOpen }) => (
						<button type="button" onClick={toggleOpen}>
							{isOpen ? "Hide graph" : "Show graph"}
						</button>
					)}
				>
					<p>Graph detail</p>
				</ChainOfThoughtStep>
			</ChainOfThoughtContent>
		</ChainOfThought>
	);
}
`;

const SCENARIO_SOURCE = `
import { ChainOfThoughtScenario } from "@/components/ui/chain-of-thought";

export default function Example({ state }: { state: "preload" | "thinking" | "completed" }) {
	return (
		<ChainOfThoughtScenario
			state={state}
			steps={[
				{ id: "search", label: "Searching approved sources", status: "complete" },
				{ id: "rank", label: "Ranking snippets", status: "active" },
			]}
		/>
	);
}
`;

function headerLine(view) {
	return view.container.querySelector("[data-slot=chain-of-thought-header] [data-slot=trace-line]");
}

function stepLines(view) {
	return [...view.container.querySelectorAll("[data-slot=chain-of-thought-step]")].map((step) => {
		const line = step.querySelector("[data-slot=trace-line]");
		return `${step.getAttribute("data-status")}:${line?.getAttribute("data-status") ?? ""}`;
	});
}

test("the header title shimmers while preload or thinking, without trailing dots", async () => {
	const view = await renderComponent({ source: HEADER_SOURCE, props: { state: "thinking", showChevron: true } });

	assert.equal(headerLine(view)?.getAttribute("data-status"), "running");
	assert.equal(headerLine(view)?.querySelector("[data-slot=trace-title]")?.textContent, "Thinking");
	assert.equal(view.container.querySelector("[data-slot=animated-dot]") === null, true);

	await view.rerender({ state: "preload", showChevron: true });
	assert.equal(headerLine(view)?.getAttribute("data-status"), "running");

	await view.rerender({ state: "completed", showChevron: true });
	assert.equal(headerLine(view)?.hasAttribute("data-status"), false);
	assert.equal(headerLine(view)?.querySelector("[data-slot=trace-title]")?.textContent.length > 0, true);
});

test("the header is the collapsible trigger, or a plain line without showChevron", async () => {
	const view = await renderComponent({ source: HEADER_SOURCE, props: { state: "completed", showChevron: true } });
	const trigger = view.getByRole("button");

	assert.equal(trigger.getAttribute("data-slot"), "chain-of-thought-header");
	assert.equal(trigger.getAttribute("aria-expanded"), "false");
	await view.click(trigger);
	assert.equal(trigger.getAttribute("aria-expanded"), "true");

	await view.rerender({ state: "thinking", showChevron: false });
	assert.equal(view.queryByRole("button") === null, true);
	assert.equal(headerLine(view)?.getAttribute("data-status"), "running");
});

test("steps map active to Trace's running status and keep VPK's rail and connector", async () => {
	const view = await renderComponent({ source: STEPS_SOURCE });

	assert.deepEqual(stepLines(view), ["complete:", "active:running", "pending:", "complete:"]);

	const rails = [...view.container.querySelectorAll("[data-slot=chain-of-thought-step-rail]")];
	assert.equal(rails.length, 4);
	assert.equal(rails.every((rail) => rail.className.includes("relative mt-0.5 self-stretch")), true);
	assert.equal(rails.every((rail) => rail.querySelector("[data-slot=trace-icon]") !== null), true);

	const connectors = [...view.container.querySelectorAll("[data-slot=chain-of-thought-step-connector]")];
	assert.equal(connectors.length, 4);
	assert.equal(connectors[0].className.includes("absolute top-5 -bottom-3 left-1/2"), true);
	assert.equal(connectors[0].className.includes("group-last/cot-step:hidden"), true);
});

test("the TWG rail override offsets only the custom step's icon column (inline style wins over mt-0.5)", async () => {
	const view = await renderComponent({ source: STEPS_SOURCE });
	const rails = [...view.container.querySelectorAll("[data-slot=chain-of-thought-step-rail]")];

	assert.deepEqual(
		rails.map((rail) => rail.style.marginTop),
		["", "", "", "6px"],
	);
	assert.equal(rails[3].className.includes("twg-rail"), true);
});

test("the byline shows the description or status default and hides when the step opens", async () => {
	const view = await renderComponent({ source: STEPS_SOURCE });
	const text = () => view.container.querySelector("[data-slot=chain-of-thought-content]")?.textContent ?? "";

	assert.equal(text().includes("Checking publication dates"), true);
	assert.equal(text().includes("Queued"), true);
	assert.equal(text().includes("Complete"), false);

	await view.click(view.getByRole("button", { name: "Cross-checking dates" }));
	assert.equal(view.getByRole("button", { name: "Cross-checking dates" }).getAttribute("aria-expanded"), "true");
	assert.equal(text().includes("Step detail"), true);
});

test("headerRender replaces the step header and drives its collapsible", async () => {
	const view = await renderComponent({ source: STEPS_SOURCE });

	assert.equal(view.queryByRole("button", { name: "Connecting work" }) === null, true);
	await view.click(view.getByRole("button", { name: "Show graph" }));
	assert.equal(view.getByRole("button", { name: "Hide graph" }) !== null, true);
	assert.equal(view.container.textContent.includes("Graph detail"), true);
});

test("Trace's content rule is off and open panels release overflow for focus rings", async () => {
	const view = await renderComponent({ source: STEPS_SOURCE });
	const inners = [...view.container.querySelectorAll("[data-slot=trace-collapsible-content-inner]")];

	assert.equal(inners.length > 0, true);
	assert.equal(inners.every((inner) => inner.className.includes("border-l-0") && inner.className.includes("ml-0") && inner.className.includes("pl-0")), true);
	assert.equal(
		view.container
			.querySelector("[data-slot=chain-of-thought]")
			.className.includes("[&_[data-slot=trace-collapsible-content]:has(:focus-visible)]:overflow-visible"),
		true,
	);
});

test("step chevrons reveal on hover or keyboard focus only", async () => {
	const view = await renderComponent({ source: STEPS_SOURCE });
	const trigger = view.getByRole("button", { name: "Cross-checking dates" });

	assert.equal(trigger.className.includes("[&>[data-slot=trace-icon]]:opacity-0"), true);
	assert.equal(trigger.className.includes("[&:focus-visible>[data-slot=trace-icon]]:opacity-100"), true);
	assert.equal(view.tabOrder().includes("Cross-checking dates"), true);
});

test("ChainOfThoughtScenario opens while thinking and hides the trigger during preload", async () => {
	const view = await renderComponent({ source: SCENARIO_SOURCE, props: { state: "thinking" } });

	assert.equal(view.getByRole("button").getAttribute("aria-expanded"), "true");
	assert.deepEqual(stepLines(view), ["complete:", "active:running"]);

	await view.rerender({ state: "preload" });
	assert.equal(view.queryByRole("button") === null, true);
});
