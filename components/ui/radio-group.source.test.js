const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const RADIO_GROUP_SOURCE = readFileSync(join(__dirname, "radio-group.tsx"), "utf8");
const RADIO_GROUP_DEMO_SOURCE = readFileSync(
	join(__dirname, "../website/demos/ui/radio-group-demo.tsx"),
	"utf8",
);

test("radio group item uses a 1px border", () => {
	assert.match(RADIO_GROUP_SOURCE, /\brounded-full border transition-colors\b/u);
	assert.doesNotMatch(RADIO_GROUP_SOURCE, /\bborder-2\b/u);
});

test("radio group item keeps a 16px visual circle with a 24px hit target", () => {
	assert.match(RADIO_GROUP_SOURCE, /\bflex size-4 rounded-full\b/u);
	assert.match(RADIO_GROUP_SOURCE, /\bafter:absolute after:-inset-\[5px\]/u);
	assert.doesNotMatch(RADIO_GROUP_SOURCE, /after:-inset-1/u);
	assert.doesNotMatch(RADIO_GROUP_SOURCE, /after:-inset-x-3/u);
	assert.doesNotMatch(RADIO_GROUP_SOURCE, /after:-inset-y-2/u);
});

test("radio group keeps 24px option rows with no row gap", () => {
	assert.match(RADIO_GROUP_SOURCE, /className=\{cn\("grid gap-0 w-full", className\)\}/u);
	assert.doesNotMatch(RADIO_GROUP_SOURCE, /"grid gap-2 w-full"/u);
	assert.match(RADIO_GROUP_DEMO_SOURCE, /const radioOptionClassName = "flex h-6 items-center gap-2";/u);
	assert.match(RADIO_GROUP_DEMO_SOURCE, /<div className=\{radioOptionClassName\}>/u);
	assert.doesNotMatch(RADIO_GROUP_DEMO_SOURCE, /<div className="flex items-center gap-2">/u);
});

test("radio description cards center the radio with an 8px content gap", () => {
	const descriptionDemoSource = RADIO_GROUP_DEMO_SOURCE.split("export function RadioGroupDemoWithDescriptions()")[1]
		.split("export function RadioGroupDemoWithFieldset()")[0];

	assert.match(
		RADIO_GROUP_DEMO_SOURCE,
		/const radioDescriptionFieldClassName = "items-center! gap-2 \[&>\[role=radio\]\]:mt-0!";/u,
	);
	assert.match(
		RADIO_GROUP_DEMO_SOURCE,
		/const radioDescriptionControlClassName = "flex size-6 shrink-0 items-center justify-center";/u,
	);
	assert.match(
		descriptionDemoSource,
		/<RadioGroup defaultValue="plus" className="gap-2">/u,
	);
	assert.match(
		descriptionDemoSource,
		/<Field orientation="horizontal" className=\{radioDescriptionFieldClassName\}>/u,
	);
	assert.match(
		descriptionDemoSource,
		/<span className=\{radioDescriptionControlClassName\}>\s*<RadioGroupItem value="plus" id="plus-plan" \/>/u,
	);
	assert.doesNotMatch(
		descriptionDemoSource,
		/<Field orientation="horizontal">/u,
	);
});
