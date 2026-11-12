const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

test("Agent Add keeps one selected avatar and allows another selection", async () => {
	const view = await renderComponent({ entry: "components/website/demos/ui-custom/agent-add-demo.tsx" });
	const trigger = view.getByRole("button", { name: "Add agent to this work item" });
	await view.click(trigger);
	await view.click(view.getByRole("option", { name: /Rovo/u }));
	assert.equal(trigger.disabled, false);
	assert.equal(Boolean(view.getByRole("img", { name: "Rovo selected" })), true);
	assert.equal(view.container.textContent.includes("Rovo selected"), false);
	await view.click(trigger);
	await view.click(view.getByRole("option", { name: /1P Agent/u }));
	assert.equal(trigger.disabled, false);
	assert.equal(Boolean(view.getByRole("img", { name: "1P Agent selected" })), true);
	assert.equal(view.queryByRole("img", { name: "Rovo selected" }) === null, true);
	assert.equal(view.container.textContent.includes("1P Agent selected"), false);
});
