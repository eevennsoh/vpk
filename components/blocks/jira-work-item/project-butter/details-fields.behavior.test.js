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
			export default function DetailsTest({ empty = false, workItem, sidePanel = false }) {
				const filledContent = useProjectButterContent("filled", workItem);
				const emptyContent = useProjectButterContent("empty", workItem);
				const [order, setOrder] = useState(["details", "development", "automation", "apps"]);
				const [coding, setCoding] = useState(false);
				return <ThemeWrapper><ProjectButterDetails code={workItem?.code} content={empty ? emptyContent : filledContent} empty={empty} key={sidePanel ? "side-panel" : "wide"} onPanelOrderChange={setOrder} onStartCoding={() => setCoding(true)} panelOrder={order} sidePanel={sidePanel} />{coding ? <p>Coding started</p> : null}</ThemeWrapper>;
			}`,
		props,
	});
}

function fieldLabels() {
	return [...document.querySelectorAll("[data-project-butter-detail-fields] [data-field-id]")].map((node) => node.getAttribute("data-field-label"));
}

async function fieldAction(view, field, action) {
	await view.click(view.getByRole("button", { name: `More ${field.toLowerCase()} field actions` }));
	await view.click(view.getByRole("menuitem", { name: action }));
}

test("Details initializes each item independently and calculates cost per reach", () => {
	const fields = createProjectButterDetailFields(false);
	assert.deepEqual(fields.order, ["status", "assignee", "priority", "dueDate", "parent", "labels", "acceptanceCriteria", "reporter"]);
	assert.equal(fields.parent, "VITA-22 User Experience Overhaul");
	assert.deepEqual(fields.labels, ["social-media", "website-traffic"]);
	assert.deepEqual(reorderProjectButterDetailFields(fields.order, "dueDate", "assignee").slice(0, 4), ["status", "dueDate", "assignee", "priority"]);
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

test("Development copies the current work item prompt", async (t) => {
	const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
	const copied = [];
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value) => copied.push(value) } });
	t.after(() => { if (original) Object.defineProperty(navigator, "clipboard", original); else delete navigator.clipboard; });
	const view = await renderDetails({ workItem: { code: "PAY-118", title: "Billing", description: "Carry the artwork" } });
	await view.click(view.getByRole("button", { name: "Copy prompt" }));
	assert.deepEqual(copied, ["PAY-118: Billing\n\nCarry the artwork"]);
	assert.equal(view.getByRole("button", { name: "Prompt copied" }) !== null, true);
	assert.equal(view.getAllByRole("status").some((status) => status.textContent === "Prompt copied"), true);
	await view.rerender({ workItem: { code: "PAY-119", title: "Runbook", description: "Write it" } });
	await view.click(view.getByRole("button", { name: "Copy prompt" }));
	assert.deepEqual(copied, ["PAY-118: Billing\n\nCarry the artwork", "PAY-119: Runbook\n\nWrite it"]);
});

test("Development does not claim a rejected clipboard write succeeded", async (t) => {
	const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } });
	t.after(() => { if (original) Object.defineProperty(navigator, "clipboard", original); else delete navigator.clipboard; });
	const view = await renderDetails();
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
	assert.deepEqual(fieldLabels(), ["Status", "Assignee", "Priority", "Due Date"]);
	await view.click(view.getByRole("button", { name: "Show more details" }));
	assert.equal(view.queryByText("User Experience Overhaul") !== null, true);
	assert.equal(view.queryByText("social-media") !== null, true);
	await fieldAction(view, "Acceptance Criteria", "Clear acceptance criteria");
	assert.equal(view.queryByText("90% of new users complete onboarding in 1 week"), null);
	assert.equal(view.queryByText("Add acceptance criteria") !== null, true);
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
	await fieldAction(view, "Acceptance Criteria", "Clear acceptance criteria");
	await fieldAction(view, "Due Date", "Move up");
	await fieldAction(view, "Labels", "Hide field");
	const savedOrder = fieldLabels();
	await view.rerender({ sidePanel: true });
	await view.click(view.getByRole("button", { name: "Show more details" }));
	assert.deepEqual(fieldLabels(), savedOrder);
	assert.equal(view.queryByText("90% of new users complete onboarding in 1 week"), null);
	assert.equal(view.queryByText("Add acceptance criteria") !== null, true);
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
		assert.deepEqual(fieldLabels(), ["Status", "Assignee", "Priority", "Due Date", "Parent", "Labels", "Acceptance Criteria", "Reporter"]);
		await view.click(view.getByRole("button", { name: "More details actions" }));
		assert.equal(view.queryByRole("menuitemcheckbox", { name: "Campaign budget" }), null);
		assert.equal(view.queryByRole("menuitemcheckbox", { name: "Fix Version" }), null);
		await view.unmount();
	}
});

test("keyboard field drops commit the moved field and preserve its focus", async () => {
	const view = await renderDetails();
	for (const [index, field] of [...document.querySelectorAll("[data-project-butter-detail-fields] [data-field-id]")].entries()) {
		field.getBoundingClientRect = () => new DOMRect(0, index * 64, 320, 48);
	}
	const handle = view.getByRole("button", { name: "Drag to reorder Priority field" });
	await view.focus(handle);
	await view.press(handle, " ", { code: "Space" });
	await new Promise((resolve) => setTimeout(resolve, 0));
	await view.press(handle, "ArrowUp", { code: "ArrowUp" });
	await view.press(handle, " ", { code: "Space" });
	assert.deepEqual(fieldLabels(), ["Status", "Priority", "Assignee", "Due Date"]);
	assert.notEqual(handle.getAttribute("aria-pressed"), "true");
	assert.equal(view.isFocused(handle), true);
});

test("keyboard field dragging receives arrows and Escape cancels without dismissing the work item", async () => {
	let closed = false;
	const view = await renderComponent({
		source: `import React from "react";
			import { SidebarProvider } from "@/app/contexts/context-sidebar";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
			export default function TestWorkItem(props) { return <ThemeWrapper><SidebarProvider><ProjectButterJiraWorkItem {...props} /></SidebarProvider></ThemeWrapper>; }`,
		mocks: {
			"@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} }; export const useRovoChatControls = () => controls; export const useOptionalRovoChatControls = () => controls; export const useOptionalRovoChat = () => null;`,
		},
		props: { initialPreset: "filled", onClose() { closed = true; }, open: true },
	});
	const initialOrder = fieldLabels();
	const handle = view.getByRole("button", { name: "Drag to reorder Priority field" });
	await view.focus(handle);
	await view.press(handle, " ", { code: "Space" });
	assert.equal(handle.getAttribute("aria-pressed"), "true");
	assert.equal(document.querySelector('[data-project-butter-field-dragging="true"]') !== null, true);
	let arrowReceived = false;
	const listen = (event) => { if (event.code === "ArrowUp") arrowReceived = true; };
	document.addEventListener("keydown", listen);
	try {
		await view.press(handle, "ArrowUp", { code: "ArrowUp" });
		assert.equal(arrowReceived, true);
		await view.press(handle, "Escape", { code: "Escape" });
		assert.equal(closed, false);
		assert.notEqual(handle.getAttribute("aria-pressed"), "true");
		assert.deepEqual(fieldLabels(), initialOrder);
		assert.equal(document.querySelector('[data-project-butter-field-dragging="true"]'), null);
		assert.equal(view.isFocused(handle), true);
	} finally {
		document.removeEventListener("keydown", listen);
	}
});
