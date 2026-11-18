const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

for (const entry of [
	"components/blocks/agent/components/agent-summary-row.tsx",
	"components/blocks/agent-config-core/components/agent-summary-row.tsx",
]) {
	test(`${entry}: a chip announces its name once on removal and keeps independent actions`, async () => {
		const calls = [];
		const view = await renderComponent({
			entry,
			exportName: "AgentReferenceChip",
			props: {
				label: "Jira",
				onClick: () => calls.push("open"),
				onRemove: () => calls.push("remove"),
			},
		});
		const remove = view.getByRole("button", { name: /^Remove /u });
		assert.equal(accessibleName(remove), "Remove Jira");
		assert.deepEqual(view.tabOrder(), ["Jira", "Remove Jira"]);
		assert.equal(remove.parentElement.closest('button, [role="button"]') === null, true);

		await view.press(null, "Tab");
		const open = view.getByRole("button", { name: "Jira" });
		assert.equal(view.isFocused(open), true);
		await view.press(open, "Enter");
		await view.press(open, "Tab");
		assert.equal(view.isFocused(remove), true);
		await view.press(remove, " ");
		assert.deepEqual(calls, ["open", "remove"]);
		await view.click(remove);
		assert.deepEqual(calls, ["open", "remove", "remove"]);
	});
}
