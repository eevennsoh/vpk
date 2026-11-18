// Rendered contract for the shadcn Plan on Trace, and for the ui-custom Plan's
// variant="inline", which delegates its parts to it.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const UI_PLAN_SOURCE = `
import { Plan, PlanContent, PlanDescription, PlanHeader, PlanIcon, PlanStep, PlanSteps, PlanTitle } from "@/components/ui/plan";

export default function Example({ isStreaming }: { isStreaming: boolean }) {
	return (
		<Plan defaultOpen isStreaming={isStreaming}>
			<PlanHeader>
				<PlanIcon />
				<PlanTitle>Plan: migrate to Base UI</PlanTitle>
				<PlanDescription>1 of 3 done</PlanDescription>
			</PlanHeader>
			<PlanContent>
				<PlanSteps>
					<PlanStep status="done">Replace the Radix imports</PlanStep>
					<PlanStep status="running">Rename asChild to render</PlanStep>
					<PlanStep status="pending">Run the type checker</PlanStep>
				</PlanSteps>
			</PlanContent>
		</Plan>
	);
}
`;

const CUSTOM_INLINE_SOURCE = `
import { Plan, PlanAvatar, PlanContent, PlanDescription, PlanHeader, PlanTaskItem, PlanTaskList, PlanTitle, PlanTrigger } from "@/components/ui-custom/plan";

export default function Example() {
	return (
		<Plan defaultOpen isStreaming variant="inline">
			<PlanHeader
				leading={<PlanAvatar />}
				title={<PlanTitle>Plan: launch</PlanTitle>}
				description={<PlanDescription>1 of 2 done</PlanDescription>}
			/>
			<PlanTrigger />
			<PlanContent>
				<PlanTaskList>
					<PlanTaskItem index={1} label="Write the policy" status="done" />
					<PlanTaskItem index={2} label="Record the walkthrough" status="running" />
				</PlanTaskList>
			</PlanContent>
		</Plan>
	);
}
`;

function lineStatuses(view) {
	return [...view.container.querySelectorAll("[data-slot=plan-step]")].map(
		(step) => `${step.getAttribute("data-step-status")}:${step.getAttribute("data-status") ?? ""}`,
	);
}

function headerStatus(view) {
	return view.container.querySelector("[data-slot=plan-header] [data-slot=trace-line]")?.getAttribute("data-status") ?? "";
}

test("the header line and the running step shimmer only while the plan streams", async () => {
	const view = await renderComponent({ source: UI_PLAN_SOURCE, props: { isStreaming: true } });

	assert.equal(headerStatus(view), "running");
	assert.deepEqual(lineStatuses(view), ["done:", "running:running", "pending:pending"]);
	assert.equal(view.getByRole("button").textContent.includes("1 of 3 done"), true);

	await view.rerender({ isStreaming: false });
	assert.equal(headerStatus(view), "");
	assert.deepEqual(lineStatuses(view), ["done:", "running:", "pending:pending"]);
});

test("the whole header line toggles the steps", async () => {
	const view = await renderComponent({ source: UI_PLAN_SOURCE, props: { isStreaming: false } });
	const trigger = view.getByRole("button");

	assert.equal(trigger.getAttribute("aria-expanded"), "true");
	await view.click(trigger);
	assert.equal(trigger.getAttribute("aria-expanded"), "false");
});

test("ui-custom Plan variant=inline renders through the Trace Plan, without card chrome", async () => {
	const view = await renderComponent({ source: CUSTOM_INLINE_SOURCE });

	assert.equal(view.container.querySelector("[data-slot=card]") === null, true);
	assert.equal(view.container.querySelector("[data-slot=plan-avatar]") === null, true);
	assert.equal(view.container.querySelector("[data-slot=plan-icon]") !== null, true);
	assert.equal(headerStatus(view), "running");
	assert.deepEqual(lineStatuses(view), ["done:", "running:running"]);
	assert.deepEqual(view.getAllByRole("button").map((button) => button.textContent.trim()), ["Plan: launch1 of 2 done"]);
});
