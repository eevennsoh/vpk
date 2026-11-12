const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const SOURCE = `import React from "react";
	import { FloatingComposer } from "@/components/projects/shared/components/floating-composer";
	import { PromptInputButton, PromptInputTextarea } from "@/components/ui-custom/prompt-input";
	export default function Probe({ allowOverflow }) {
		return <FloatingComposer actions={<button type="submit">Send</button>} addButton={<PromptInputButton aria-label="Add" size="icon-xs" variant="ghost">+</PromptInputButton>} allowOverflow={allowOverflow} onSubmit={() => {}}>
			<PromptInputTextarea placeholder="Comment" rows={1} />
		</FloatingComposer>;
	}`;

const groupClasses = () => document.querySelector('[data-slot="input-group"]').className.split(/\s+/u);

test("the floating composer leaves the flush + button's focus ring unclipped", async () => {
	const view = await renderComponent({ source: SOURCE });
	await view.focus(view.getByRole("button", { name: "Add" }));
	assert.equal(view.isFocused(view.getByRole("button", { name: "Add" })), true);
	assert.equal(groupClasses().includes("overflow-visible"), true, "the input group must not clip the leading button's outward ring");
	assert.equal(groupClasses().includes("overflow-hidden"), false);
	await view.rerender({ allowOverflow: false });
	assert.equal(groupClasses().includes("overflow-hidden"), true, "callers can still opt back into clipping");
});
