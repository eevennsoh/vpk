// A Tag can be a button itself (`onClick`, or a menu/popover trigger's injected props) and carry
// a remove or overlay action. No interactive element may sit inside another, in any of those
// combinations, while mouse and keyboard activation keep working as before.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const INTERACTIVE = "a[href], button, input, select, textarea, [role=button], [role=link], [role=menuitem], [role=checkbox], [tabindex]:not([tabindex='-1'])";

/** Names of interactive elements that contain another interactive element. */
function nestedInteractive(root) {
	return [...root.querySelectorAll(INTERACTIVE)]
		.filter((element) => element.querySelector(INTERACTIVE) !== null)
		.map((element) => `${element.tagName.toLowerCase()}[role=${element.getAttribute("role")}] "${accessibleName(element)}"`);
}

const COMBINATIONS = {
	"onClick with an inline remove": `<Tag onClick={() => calls.push("open")} onRemove={() => calls.push("remove")}>Alpha</Tag>`,
	"onClick with an overlay remove": `<Tag onClick={() => calls.push("open")} onRemove={() => calls.push("remove")} removeVariant="overlay">Alpha</Tag>`,
	"onClick with an overlay action": `<Tag onClick={() => calls.push("open")} overlayAction={{ icon: <span />, label: "Swap Alpha", onClick: () => calls.push("remove") }}>Alpha</Tag>`,
	"a menu trigger with an overlay remove": `<DropdownMenu><DropdownMenuTrigger render={<Tag onRemove={() => calls.push("remove")} removeVariant="overlay">Alpha</Tag>} /><DropdownMenuContent><DropdownMenuItem>Item</DropdownMenuItem></DropdownMenuContent></DropdownMenu>`,
};

async function renderTag(markup) {
	const calls = [];
	const view = await renderComponent({
		source: `import React from "react";
			import { Tag } from "@/components/ui/tag";
			import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
			export default function TagProbe({ calls }) {
				return <div>${markup}</div>;
			}`,
		props: { calls },
	});
	return { calls, view };
}

for (const [combination, markup] of Object.entries(COMBINATIONS)) {
	test(`a Tag ${combination} nests no interactive element inside another`, async () => {
		const { view } = await renderTag(markup);
		assert.deepEqual(nestedInteractive(view.container), []);
	});
}

test("an onClick Tag with a remove button keeps its label as the action name and both controls in Tab order", async () => {
	const { calls, view } = await renderTag(COMBINATIONS["onClick with an inline remove"]);

	assert.deepEqual(view.tabOrder(), ["Alpha", "Remove Alpha"]);
	// happy-dom has no hit-testing: click the element a pointer on the chip reaches.
	const action = view.getByRole("button", { name: "Alpha" });
	await view.click(action);
	await view.click(view.getByRole("button", { name: "Remove Alpha" }));
	await view.focus(action);
	await view.press(action, "Enter");
	await view.press(action, " ");

	assert.deepEqual(calls, ["open", "remove", "open", "open"]);
});

test("Enter on the remove button of an onClick Tag removes without activating the Tag", async () => {
	const { calls, view } = await renderTag(COMBINATIONS["onClick with an overlay remove"]);
	const remove = view.getByRole("button", { name: "Remove Alpha" });

	await view.focus(remove);
	await view.press(remove, "Enter");

	assert.deepEqual(calls, ["remove"]);
});

// Relocated from the source contract: a click-handling Tag without trailing controls is itself
// a keyboard button; a caller's role passes through when the Tag is not interactive.
test("an onClick Tag is a tabbable button that Enter and Space activate, and disabled leaves the Tab order", async () => {
	const { calls, view } = await renderTag(`<><Tag onClick={() => calls.push("open")} onKeyDown={() => calls.push("key")}>Alpha</Tag><Tag disabled onClick={() => calls.push("disabled")}>Beta</Tag><Tag role="status">Gamma</Tag></>`);
	const alpha = view.getByRole("button", { name: "Alpha" });

	assert.deepEqual(view.tabOrder(), ["Alpha"]);
	assert.equal(view.getByRole("button", { name: "Beta" }).getAttribute("aria-disabled"), "true");
	assert.equal(view.getByRole("status", { name: undefined }).textContent, "Gamma");
	await view.focus(alpha);
	await view.press(alpha, "Enter");
	await view.press(alpha, " ");

	assert.deepEqual(calls, ["key", "open", "key", "open"]);
});
