const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

for (const key of ["Enter", " "]) {
	test(`the agent placeholder's template action is exposed and ${key === " " ? "Space" : key} activates it`, async () => {
		const calls = [];
		const view = await renderComponent({
			entry: "components/blocks/agent/components/agent-instructions-composer.tsx",
			exportName: "AgentInstructionsComposer",
			props: {
				config: {},
				instructions: "",
				onStartWithTemplate: () => calls.push("template"),
			},
		});
		const template = view.getByRole("button", { name: "start with a template", hidden: true });
		assert.equal(template.closest('[aria-hidden="true"], [inert]') === null, true);
		assert.equal(view.getByRole("button", { name: "start with a template" }) === template, true);
		const editor = view.getByRole("textbox", { name: "Agent instructions" });
		const order = view.tabOrder();
		assert.equal(order.indexOf("start with a template"), order.indexOf("Agent instructions") + 1);
		await view.focus(editor);
		await view.press(editor, "Tab");
		assert.equal(view.isFocused(template), true);
		await view.press(template, key);
		assert.deepEqual(calls, ["template"]);
		await view.click(template);
		assert.deepEqual(calls, ["template", "template"]);
	});
}

test("a rich-text placeholder exposes its hint without a focus stop and disappears with content", async () => {
	const view = await renderComponent({
		source: `
import { RichTextEditor } from "@/components/ui-custom/rich-text-editor";
export default function Harness({ value }) {
	return <RichTextEditor
		aria-label="Instructions"
		placeholderSlot={<p>Describe this agent</p>}
		showToolbar={false}
		showBubbleMenu={false}
		value={value}
	/>;
}
`,
		props: { value: "" },
	});
	const placeholder = view.getByText("Describe this agent");
	assert.equal(placeholder.closest('[aria-hidden="true"], [inert]') === null, true, "the visible hint is exposed to assistive technology");
	assert.equal(placeholder.closest('[tabindex], button, [role="button"], [contenteditable="true"]') === null, true);
	assert.deepEqual(view.tabOrder(), ["Instructions"]);
	await view.rerender({ value: "Write a summary" });
	assert.equal(view.queryByText("Describe this agent") === null, true);
	assert.deepEqual(view.tabOrder(), ["Instructions"]);
});
