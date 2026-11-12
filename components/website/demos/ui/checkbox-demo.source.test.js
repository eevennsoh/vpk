const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const CHECKBOX_DEMO_SOURCE = readFileSync(join(__dirname, "checkbox-demo.tsx"), "utf8");

test("checkbox group demo keeps zero gap between checkbox rows", () => {
	assert.match(CHECKBOX_DEMO_SOURCE, /<FieldGroup data-slot="checkbox-group" className="!gap-0">/u);
	assert.match(CHECKBOX_DEMO_SOURCE, /<FieldLabel>Show these items on the desktop:<\/FieldLabel>[\s\S]*<FieldGroup data-slot="checkbox-group" className="!gap-0">/u);
});

test("checkbox description demo uses field content so its title line aligns to the 24px checkbox row", () => {
	assert.match(CHECKBOX_DEMO_SOURCE, /export function CheckboxDemoWithDescription\(\) \{[\s\S]*<Field orientation="horizontal">/u);
	assert.match(CHECKBOX_DEMO_SOURCE, /<Checkbox id="notifications" \/>[\s\S]*<FieldContent>[\s\S]*<FieldLabel htmlFor="notifications" className="leading-6">Enable notifications<\/FieldLabel>[\s\S]*<FieldDescription>/u);
	assert.doesNotMatch(CHECKBOX_DEMO_SOURCE, /<Checkbox id="notifications" className="mt-0\.5" \/>/u);
	assert.doesNotMatch(CHECKBOX_DEMO_SOURCE, /<Label htmlFor="notifications">Enable notifications<\/Label>/u);
});

test("checkbox title demo uses an 8px gap between stacked label cards", () => {
	assert.match(CHECKBOX_DEMO_SOURCE, /export function CheckboxDemoWithTitle\(\) \{[\s\S]*<FieldGroup className="gap-2">/u);
});

test("checkbox title demo places the checkbox on the far right and centers it vertically", () => {
	assert.match(CHECKBOX_DEMO_SOURCE, /const checkboxTitleFieldClassName = "items-center! gap-2";/u);
	assert.match(CHECKBOX_DEMO_SOURCE, /const checkboxTitleControlClassName = "flex size-6 shrink-0 items-center justify-center";/u);
	assert.match(CHECKBOX_DEMO_SOURCE, /<Field orientation="horizontal" className=\{checkboxTitleFieldClassName\}>[\s\S]*<FieldContent>[\s\S]*<\/FieldContent>[\s\S]*<span className=\{checkboxTitleControlClassName\}>[\s\S]*<Checkbox id="toggle-2" defaultChecked \/>/u);
	assert.match(CHECKBOX_DEMO_SOURCE, /<Field orientation="horizontal" data-disabled className=\{checkboxTitleFieldClassName\}>[\s\S]*<FieldContent>[\s\S]*<\/FieldContent>[\s\S]*<span className=\{checkboxTitleControlClassName\}>[\s\S]*<Checkbox id="toggle-4" disabled \/>/u);
	assert.doesNotMatch(CHECKBOX_DEMO_SOURCE, /<Field orientation="horizontal">\s*<Checkbox id="toggle-2"/u);
});
