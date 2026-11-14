// The Confluence page title is an editable field: assistive tech must hear it as a
// single-line text box named "Page title", and Enter still commits by leaving the field.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

test("the page title is a labelled single-line text box that Enter leaves", async () => {
	const view = await renderComponent({
		entry: "components/projects/confluence/components/document-title.tsx",
		// The product logo reads the app theme; it is not what this test is about.
		mocks: { "@/components/ui/logo": "export function ConfluenceIcon() { return null; }" },
		props: { title: "Q3 planning" },
	});
	const title = view.getByRole("textbox", { name: "Page title" });

	assert.equal(title.getAttribute("aria-multiline"), "false");
	assert.equal(title.textContent, "Q3 planning");
	assert.deepEqual(view.tabOrder(), ["Page title"]);

	await view.focus(title);
	assert.ok(view.isFocused(title));
	await view.press(title, "Enter");
	assert.ok(!view.isFocused(title), "Enter commits the title by leaving the field");
});
