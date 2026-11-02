const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const PROPS = { code: "PAY-118", parent: "PAY-100 Payments migration", summary: "Carry card artwork into the next wallet epic" };
function renderBreadcrumb(props = PROPS) {
	return renderComponent({ entry: "components/blocks/jira-work-item/project-butter/project-butter-breadcrumb.tsx", exportName: "ProjectButterBreadcrumb", props });
}
function setClipboard(t, value) {
	const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
	Object.defineProperty(navigator, "clipboard", { configurable: true, value });
	t.after(() => { if (original) Object.defineProperty(navigator, "clipboard", original); else delete navigator.clipboard; });
}

test("breadcrumb uses the selected key, parent, and summary without a fallback parent", async () => {
	const view = await renderBreadcrumb();
	assert.equal(view.queryByRole("navigation", { name: "breadcrumb" }) !== null, true);
	assert.equal(view.getByRole("button", { name: "Copy work item key" }).textContent, "PAY-118");
	assert.equal(view.queryByText("PAY-100 Payments migration") !== null, true);
	assert.equal(document.querySelector('[aria-current="page"]').textContent, PROPS.summary);
	assert.equal(view.queryByRole("link") === null, true);
	await view.rerender({ code: "PAY-119", summary: "Write the runbook" });
	assert.equal(view.queryByText("PAY-100 Payments migration") === null, true);
	assert.equal(view.queryByText("Enterprise RFP Response") === null, true);
});

test("copy writes only the issue key and confirms success temporarily", async (t) => {
	const values = [];
	setClipboard(t, { writeText: async (value) => { values.push(value); } });
	const view = await renderBreadcrumb();
	await view.click(view.getByRole("button", { name: "Copy work item key" }));
	assert.deepEqual(values, ["PAY-118"]);
	assert.equal(view.queryByRole("button", { name: "Work item key copied" }) !== null, true);
	assert.equal(view.getByRole("status").textContent, "Work item key copied");
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1900)); });
	assert.equal(view.queryByRole("button", { name: "Copy work item key" }) !== null, true);
	assert.equal(view.getByRole("status").textContent, "");
});

for (const unavailable of [false, true]) {
	test(`copy ${unavailable ? "without a clipboard API" : "with denied clipboard access"} does not claim success`, async (t) => {
		setClipboard(t, unavailable ? undefined : { writeText: async () => { throw new Error("Denied"); } });
		const view = await renderBreadcrumb();
		await view.press(view.getByRole("button", { name: "Copy work item key" }), "Enter");
		assert.equal(view.queryByRole("button", { name: "Work item key copied" }) === null, true);
		assert.equal(view.getByRole("status").textContent, "Could not copy work item key");
	});
}

test("changing work items resets copy feedback and copies the new key", async (t) => {
	const values = [];
	setClipboard(t, { writeText: async (value) => { values.push(value); } });
	const view = await renderBreadcrumb();
	await view.click(view.getByRole("button", { name: "Copy work item key" }));
	await view.rerender({ code: "PAY-119", parent: "PAY-101 Runbooks", summary: "Write the runbook" });
	assert.equal(view.getByRole("button", { name: "Copy work item key" }).textContent, "PAY-119");
	assert.equal(view.getByRole("status").textContent, "");
	await view.press(view.getByRole("button", { name: "Copy work item key" }), " ");
	assert.deepEqual(values, ["PAY-118", "PAY-119"]);
});
