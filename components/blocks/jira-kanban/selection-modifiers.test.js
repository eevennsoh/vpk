const assert = require("node:assert/strict");
const test = require("node:test");
const { hasJiraSelectionToggleModifier } = require("./selection-modifiers.ts");

test("Apple selection uses Command and leaves Control-click to the context menu", () => {
	assert.equal(hasJiraSelectionToggleModifier({ metaKey: true, ctrlKey: false }, "MacIntel"), true);
	assert.equal(hasJiraSelectionToggleModifier({ metaKey: false, ctrlKey: true }, "MacIntel"), false);
});

test("Windows and Linux selection use Control", () => {
	for (const platform of ["Win32", "Linux x86_64"]) {
		assert.equal(hasJiraSelectionToggleModifier({ metaKey: false, ctrlKey: true }, platform), true);
		assert.equal(hasJiraSelectionToggleModifier({ metaKey: true, ctrlKey: false }, platform), false);
	}
});
