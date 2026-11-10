const assert = require("node:assert/strict");
const test = require("node:test");

const { renderComponent } = require("../../../../scripts/lib/render-component.js");
const { createProjectButterDetailFields, reorderProjectButterDetailFields, projectButterCostPerReach } = require("./details-model.ts");

function renderDetails(props = {}) {
	return renderComponent({
		source: `import React, { useState } from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterDetails } from "@/components/blocks/jira-work-item/project-butter/project-butter-details";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			export default function DetailsTest({ empty = false, workItem, sidePanel = false, showAgents = false }) {
				const filledContent = useProjectButterContent("filled", workItem);
				const emptyContent = useProjectButterContent("empty", workItem);
				const [order, setOrder] = useState(["details", "development", "automation", "apps"]);
				return <ThemeWrapper><ProjectButterDetails agentField={showAgents ? <div aria-label="Agents field" role="group"><button>Agent sessions</button></div> : undefined} code={workItem?.code} content={empty ? emptyContent : filledContent} empty={empty} key={sidePanel ? "side-panel" : "wide"} onPanelOrderChange={setOrder} panelOrder={order} sidePanel={sidePanel} /></ThemeWrapper>;
			}`,
		props,
	});
}

function fieldLabels() {
	return [...document.querySelectorAll("[data-project-butter-detail-fields] [data-field-id]")].map((node) => node.getAttribute("data-field-label"));
}

test("the overdue warning follows the date inside its editable field", async () => {
	const view = await renderDetails();
	await view.click(view.getByRole("button", { name: "Show more details" }));
	const trigger = view.getByRole("button", { name: "Change due date, overdue" });
	const date = [...trigger.querySelectorAll("span")].find((node) => node.textContent === "May 25, 2026");
	assert.ok(date);
	assert.equal(date.nextElementSibling?.getAttribute("aria-hidden"), "true");
	assert.equal(date.nextElementSibling?.querySelector("svg") !== null, true);
	await view.click(trigger);
	assert.equal(view.queryByRole("grid") !== null, true);
});

test("assignee defaults to Unassigned with its avatar and can be reassigned", async () => {
	const view = await renderDetails({ workItem: { code: "PAY-118", title: "Billing" } });
	let assignee = view.getByRole("button", { name: "Change assignee" });
	assert.equal(assignee.textContent, "Unassigned");
	assert.notEqual(assignee.querySelector('[data-unassigned="person"]'), null);
	await view.click(assignee);
	await view.fill(view.getByRole("textbox", { name: "Search people" }), "Annie Cook");
	await view.press(null, "Enter");
	assignee = view.getByRole("button", { name: "Change assignee" });
	assert.equal(assignee.textContent.includes("Annie Cook"), true);
	await view.click(assignee);
	await view.fill(view.getByRole("textbox", { name: "Search people" }), "Unassigned");
	await view.press(null, "Enter");
	assignee = view.getByRole("button", { name: "Change assignee" });
	assert.equal(assignee.textContent, "Unassigned");
	assert.notEqual(assignee.querySelector('[data-unassigned="person"]'), null);
});

test("assignee picker includes the editor palette people and selects them by click", async () => {
	const view = await renderDetails({ workItem: { code: "PAY-118", title: "Billing" } });
	await view.click(view.getByRole("button", { name: "Change assignee" }));
	const unassigned = view.getByRole("option", { name: "Unassigned" });
	assert.notEqual(unassigned.querySelector('[data-unassigned="person"]'), null);
	await view.fill(view.getByRole("textbox", { name: "Search people" }), "Andrea Wilson");
	const person = view.getByRole("option", { name: "Andrea Wilson" });
	await view.click(person);
	assert.equal(view.getByRole("button", { name: "Change assignee" }).textContent.includes("Andrea Wilson"), true);
	await view.click(view.getByRole("button", { name: "Change assignee" }));
	await view.click(view.getByRole("option", { name: "Unassigned" }));
	assert.equal(view.getByRole("button", { name: "Change assignee" }).textContent, "Unassigned");
});

test("an existing Automatic assignee is shown as Unassigned with the VPK avatar", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ProjectButterDetailFieldValue } from "@/components/blocks/jira-work-item/project-butter/details-field-values";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			export default function LegacyAssigneeTest() {
				const content = useProjectButterContent("empty");
				return <><button onClick={() => content.setAssignee({ name: "Automatic" })}>Load old assignee</button><ProjectButterDetailFieldValue content={content} id="assignee" /></>;
			}`,
	});
	await view.click(view.getByRole("button", { name: "Load old assignee" }));
	const assignee = view.getByRole("button", { name: "Change assignee" });
	assert.equal(assignee.textContent, "Unassigned");
	assert.notEqual(assignee.querySelector('[data-unassigned="person"]'), null);
});

async function fieldAction(view, field, action) {
	await view.click(view.getByRole("button", { name: `More ${field.toLowerCase()} field actions` }));
	await view.click(view.getByRole("menuitem", { name: action }));
}

test("Details initializes each item independently and calculates cost per reach", () => {
	const fields = createProjectButterDetailFields(false);
	assert.deepEqual(fields.order, ["status", "assignee", "agents", "priority", "dueDate", "parent", "labels", "storyPoints", "reporter"]);
	assert.equal(fields.parent, "VITA-22 User Experience Overhaul");
	assert.deepEqual(fields.labels, ["social-media", "website-traffic"]);
	assert.deepEqual(reorderProjectButterDetailFields(fields.order, "dueDate", "assignee").slice(0, 5), ["status", "dueDate", "assignee", "agents", "priority"]);
	assert.deepEqual(reorderProjectButterDetailFields(fields.order, "unknown", "assignee"), fields.order);
	assert.equal(projectButterCostPerReach({ campaignBudget: "$1,200", estimatedReach: "24,000" }), "$0.05");
	assert.equal(projectButterCostPerReach({ campaignBudget: "20", estimatedReach: "100,000" }), "$0.0002");
	assert.equal(projectButterCostPerReach({ campaignBudget: "120", estimatedReach: "0" }), "");
	assert.equal(createProjectButterDetailFields(true).fixVersion, "");
	const boardItem = createProjectButterDetailFields(false, { code: "PAY-118", title: "Billing", parent: { code: "PAY-100", title: "Payments" }, labels: ["billing"] });
	assert.equal(boardItem.parent, "PAY-100 Payments");
	assert.deepEqual(boardItem.labels, ["billing"]);
	assert.equal(boardItem.fixVersion, "");
});

test("Development keeps repository setup and local agents without a Copy prompt row", async () => {
	const view = await renderDetails();
	assert.equal(view.queryByRole("button", { name: "Copy prompt" }) === null, true);
	assert.equal(view.getByRole("button", { name: "Configure repository" }) !== null, true);
	assert.equal(view.getByRole("button", { name: "Open in", exact: true }) !== null, true);
});

test("the local agent menu copies the current work item prompt", async (t) => {
	const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
	const copied = [];
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value) => copied.push(value) } });
	t.after(() => { if (original) Object.defineProperty(navigator, "clipboard", original); else delete navigator.clipboard; });
	const view = await renderComponent({ entry: "components/blocks/jira-local-agent/index.tsx", exportName: "JiraLocalAgentMenu", props: { workItem: { code: "PAY-118", summary: "Billing", description: "Carry the artwork" } } });
	await view.click(view.getByRole("button", { name: "Copy prompt" }));
	assert.deepEqual(copied, ["PAY-118: Billing\n\nCarry the artwork"]);
	assert.equal(view.getByRole("button", { name: "Prompt copied" }) !== null, true);
	assert.equal(view.getAllByRole("status").some((status) => status.textContent === "Prompt copied"), true);
	await view.rerender({ workItem: { code: "PAY-119", summary: "Runbook", description: "Write it" } });
	await view.click(view.getByRole("button", { name: "Prompt copied" }));
	assert.deepEqual(copied, ["PAY-118: Billing\n\nCarry the artwork", "PAY-119: Runbook\n\nWrite it"]);
});

test("the local agent menu does not claim a rejected clipboard write succeeded", async (t) => {
	const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } });
	t.after(() => { if (original) Object.defineProperty(navigator, "clipboard", original); else delete navigator.clipboard; });
	const view = await renderComponent({ entry: "components/blocks/jira-local-agent/index.tsx", exportName: "JiraLocalAgentMenu", props: { workItem: { code: "PAY-118", summary: "Billing", description: "" } } });
	await view.click(view.getByRole("button", { name: "Copy prompt" }));
	assert.equal(view.getByRole("button", { name: "Could not copy prompt" }) !== null, true);
});

test("Labels hides selected values and supports creating labels", async () => {
	const view = await renderDetails();
	await view.click(view.getByRole("button", { name: "Show more details" }));
	await view.click(view.getByRole("button", { name: "Edit labels" }));
	assert.equal(view.queryByRole("option", { name: "Remove social-media" }), null);
	assert.equal(view.queryByRole("option", { name: "Remove website-traffic" }), null);
	await view.click(view.getByRole("option", { name: "Add marketing-campaign" }));
	assert.equal(view.queryByRole("option", { name: "Remove marketing-campaign" }), null);
	assert.equal(view.queryByRole("option", { name: "Add marketing-campaign" }), null);
	assert.equal(view.queryByRole("button", { name: "Edit labels" }).textContent.includes("marketing-campaign"), true);
	await view.fill(view.getByRole("textbox", { name: "Search labels" }), "new-label");
	await view.click(view.getByRole("option", { name: "Add new-label" }));
	assert.equal(view.getByRole("button", { name: "Edit labels" }).textContent.includes("new-label"), true);
	await view.press(null, "Escape");
	await fieldAction(view, "Labels", "Clear labels");
	await view.click(view.getByRole("button", { name: "Edit labels" }));
	assert.notEqual(view.queryByRole("option", { name: "Add social-media" }), null);
	assert.notEqual(view.queryByRole("option", { name: "Add marketing-campaign" }), null);
});

test("the shared labels picker retains its selected options by default", async () => {
	const view = await renderComponent({
		source: `import React, { useState } from "react";
			import { ArtifactLabelsField } from "@/components/blocks/artifact-pane/artifact-labels-field";
			export default function Picker() {
				const [values, setValues] = useState(["selected"]);
				return <ArtifactLabelsField onChange={setValues} options={["selected", "available"]} value={values} />;
			}`,
	});
	await view.click(view.getByRole("button", { name: "Edit labels" }));
	assert.notEqual(view.queryByRole("option", { name: "Remove selected" }), null);
	await view.click(view.getByRole("option", { name: "Remove selected" }));
	assert.notEqual(view.queryByRole("option", { name: "Add selected" }), null);
});

test("Parent uses the searchable work-item picker and preserves a selected value", async () => {
	const view = await renderDetails({ workItem: { code: "PAY-999", title: "Demo", parent: { code: "PAY-100", title: "Payments SDK v2 migration" } } });
	await view.click(view.getByRole("button", { name: "Show more details" }));
	assert.equal(view.getByRole("button", { name: "Change parent" }).textContent.includes("Payments SDK v2 migration"), true);
	await view.click(view.getByRole("button", { name: "Change parent" }));
	await view.fill(view.getByRole("textbox", { name: "Search work items" }), "VITA-23");
	await view.click(view.getByRole("option", { name: /Improve product experience/u }));
	assert.equal(view.getByRole("button", { name: "Change parent" }).textContent.includes("Improve product experience"), true);
	await view.click(view.getByRole("button", { name: "Change parent" }));
	assert.notEqual(view.queryByRole("option", { name: /Improve product experience/u }), null);
});

test("other multi-value fields keep selected options available for deselection", async () => {
	const view = await renderComponent({
		source: `import React, { useState } from "react";
			import { DetailsOptionField } from "@/components/blocks/jira-work-item/project-butter/details-option-field";
			export default function Picker() {
				const [values, setValues] = useState(["Backend"]);
				return <DetailsOptionField label="Components" multiple onChange={setValues} options={["Backend", "Frontend"]} values={values} />;
			}`,
	});
	await view.click(view.getByRole("button", { name: "Change components" }));
	assert.notEqual(view.queryByRole("option", { name: /Backend/u }), null);
	await view.click(view.getByRole("option", { name: /Backend/u }));
	assert.equal(view.getByRole("button", { name: "Change components" }).textContent.includes("Backend"), false);
});

test("Details expands, clears seeded fields, reorders and restores hidden fields", async () => {
	const view = await renderDetails();
	assert.deepEqual(fieldLabels(), ["Assignee", "Priority"]);
	await view.click(view.getByRole("button", { name: "Show more details" }));
	assert.equal(view.queryByText("User Experience Overhaul") !== null, true);
	assert.equal(view.queryByText("social-media") !== null, true);
	await fieldAction(view, "Story points", "Clear story points");
	assert.equal(view.queryByText("90% of new users complete onboarding in 1 week"), null);
	assert.equal(view.queryByText("Add story points") !== null, true);
	await view.click(view.getByRole("button", { name: "Show less details" }));
	await view.click(view.getByRole("button", { name: "Show more details" }));
	assert.equal(view.queryByText("90% of new users complete onboarding in 1 week"), null);
	await fieldAction(view, "Parent", "Move up");
	assert.equal(fieldLabels().indexOf("Parent") < fieldLabels().indexOf("Due Date"), true);
	await fieldAction(view, "Labels", "Hide field");
	assert.equal(fieldLabels().includes("Labels"), false);
	await view.click(view.getByRole("button", { name: "More details actions" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Labels" }));
	assert.equal(fieldLabels().includes("Labels"), true);
});

test("Details edits and visibility survive presentation remounts, empty mode and item switches", async () => {
	const view = await renderDetails();
	await view.click(view.getByRole("button", { name: "Show more details" }));
	await fieldAction(view, "Story points", "Clear story points");
	await fieldAction(view, "Due Date", "Move up");
	await fieldAction(view, "Labels", "Hide field");
	const savedOrder = fieldLabels();
	await view.rerender({ sidePanel: true });
	await view.click(view.getByRole("button", { name: "Show more details" }));
	assert.deepEqual(fieldLabels(), savedOrder);
	assert.equal(view.queryByText("90% of new users complete onboarding in 1 week"), null);
	assert.equal(view.queryByText("Add story points") !== null, true);
	await view.rerender({ empty: true, sidePanel: true });
	assert.equal(view.queryByText("User Experience Overhaul"), null);
	await view.rerender({ workItem: { code: "PAY-118", title: "Billing", labels: ["billing"] }, sidePanel: true });
	assert.equal(view.queryByText("billing") !== null, true);
	assert.equal(fieldLabels().includes("Labels"), true);
	await fieldAction(view, "Labels", "Clear labels");
	await view.rerender({ sidePanel: true });
	assert.deepEqual(fieldLabels(), savedOrder);
	assert.equal(view.queryByText("90% of new users complete onboarding in 1 week"), null);
	await view.click(view.getByRole("button", { name: "More details actions" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Labels" }));
	await view.press(null, "Escape");
	assert.equal(view.queryByText("social-media") !== null, true);
	await view.rerender({ workItem: { code: "PAY-118", title: "Billing", labels: ["billing"] }, sidePanel: true });
	assert.equal(view.queryByText("billing"), null);
	assert.equal(view.queryByText("Add label") !== null, true);
});

test("expanded Details offers at most eight fields for filled and sparse items", async () => {
	for (const empty of [false, true]) {
		const view = await renderDetails({ empty });
		await view.click(view.getByRole("button", { name: "Show more details" }));
		assert.deepEqual(fieldLabels(), ["Assignee", "Priority", "Due Date", "Parent", "Labels", "Story points", "Reporter"]);
		await view.click(view.getByRole("button", { name: "More details actions" }));
		assert.equal(view.queryByRole("menuitemcheckbox", { name: "Campaign budget" }), null);
		assert.equal(view.queryByRole("menuitemcheckbox", { name: "Fix Version" }), null);
		await view.unmount();
	}
});

test("field actions support keyboard reordering without a drag handle", async () => {
	const view = await renderDetails();
	const actions = view.getByRole("button", { name: "More priority field actions" });
	await view.focus(actions);
	await view.press(actions, "Enter");
	const moveUp = view.getByRole("menuitem", { name: "Move up" });
	await view.focus(moveUp);
	await view.press(moveUp, "Enter");
	assert.deepEqual(fieldLabels(), ["Priority", "Assignee"]);
	assert.equal(view.queryByRole("button", { name: "Drag to reorder Priority field" }), null);
});

test("Agents can be reordered independently and keeps its position when the panel remounts", async () => {
	const view = await renderDetails({ showAgents: true });
	assert.deepEqual(fieldLabels(), ["Assignee", "Agents", "Priority"]);
	await fieldAction(view, "Agents", "Move down");
	assert.deepEqual(fieldLabels(), ["Assignee", "Priority", "Agents"]);
	await fieldAction(view, "Agents", "Move up");
	await fieldAction(view, "Agents", "Move up");
	assert.deepEqual(fieldLabels(), ["Agents", "Assignee", "Priority"]);
	assert.notEqual(view.queryByRole("button", { name: "Agent sessions" }), null);
	await view.rerender({ showAgents: true, sidePanel: true });
	assert.deepEqual(fieldLabels(), ["Agents", "Assignee", "Priority"]);
});
