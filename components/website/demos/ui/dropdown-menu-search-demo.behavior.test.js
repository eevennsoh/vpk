const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

test("searchable dropdown filters its menu items and selects with the keyboard", async () => {
	const view = await renderComponent({
		entry: "components/website/demos/ui/dropdown-menu-search-demo.tsx",
		exportName: "DropdownMenuDemoSearch",
	});
	await view.click(view.getByRole("button", { name: "Choose an action" }));
	const search = view.getByRole("textbox", { name: "Search actions" });
	await view.fill(search, "duplicate");
	const item = view.getByRole("menuitem", { name: "Duplicate" });
	assert.equal(item.getAttribute("data-slot"), "dropdown-menu-item");
	assert.equal(view.queryByRole("menuitem", { name: "Edit" }), null);
	await view.press(search, "ArrowDown");
	assert.equal(view.isFocused(item), true);
	await view.press(item, "Enter");
	assert.equal(view.getByRole("button", { name: "Duplicate" }) !== null, true);
});
