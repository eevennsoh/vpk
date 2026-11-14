// Pins the public runtime surface of `generative-widget.ts`, which stays the entry
// point for every importer even when its implementation moves into sibling modules.
// Exported type names are checked by `pnpm run typecheck` wherever an importer uses them.
const test = require("node:test");
const assert = require("node:assert/strict");

const generativeWidget = require("./generative-widget.ts");

const { createBodyOnlySpec, parseGenerativeWidget } = generativeWidget;

test("generative-widget exports exactly the six runtime functions", () => {
	assert.deepEqual(Object.keys(generativeWidget).sort(), [
		"buildGenerativeWidgetSubmitPrompt",
		"createBodyOnlySpec",
		"formatGenerativeWidgetCardDescription",
		"parseExcalidrawPreviewScene",
		"parseGenerativeWidget",
		"resolveGenerativeWidgetMetadata",
	]);
	for (const name of Object.keys(generativeWidget)) {
		assert.equal(typeof generativeWidget[name], "function", name);
	}
});

function createHeaderedWidget(title, description) {
	return parseGenerativeWidget("genui-preview", {
		title,
		description,
		spec: {
			root: "root",
			elements: {
				root: { type: "Stack", props: { direction: "vertical" }, children: ["heading", "body"] },
				heading: { type: "Heading", props: { text: "Sprint status", level: "h2" } },
				body: { type: "Text", props: { content: "Four issues are still in review." } },
			},
		},
	});
}

test("createBodyOnlySpec returns the cached object for the same widget", () => {
	const widget = createHeaderedWidget("Sprint status", "Four issues in review");
	const first = createBodyOnlySpec(widget);
	assert.equal(createBodyOnlySpec(widget), first);
});

test("createBodyOnlySpec keys its cache on title and description for one spec", () => {
	const widget = createHeaderedWidget("Sprint status", "Four issues in review");
	const first = createBodyOnlySpec(widget);
	const retitled = createBodyOnlySpec({ ...widget, title: "Different title" });
	const redescribed = createBodyOnlySpec({ ...widget, description: "Different description" });
	assert.notEqual(retitled, first);
	assert.notEqual(redescribed, first);
	assert.equal(createBodyOnlySpec({ ...widget, title: "Different title" }), retitled);
	assert.equal(createBodyOnlySpec({ ...widget, description: "Different description" }), redescribed);
	assert.equal(createBodyOnlySpec({ ...widget }), first);
});
