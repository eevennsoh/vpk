const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SELECT_SOURCE = fs.readFileSync(path.join(__dirname, "select.tsx"), "utf8");
const SELECT_DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "../website/demos/ui/select-demo.tsx"),
	"utf8",
);

test("SelectItem renders the selected check mark as a trailing affordance", () => {
	assert.match(
		SELECT_SOURCE,
		/dropdownStyles\.selectableItem,\n\t\t\t\tshowIndicator \? dropdownStyles\.selectableItemIndicatorEnd : "pl-2",/,
	);
	assert.match(
		SELECT_SOURCE,
		/data-slot="select-item-indicator"\n\t\t\t\t\tclassName=\{dropdownStyles\.indicatorEnd\}/,
	);
	assert.match(SELECT_SOURCE, /className="text-icon-subtle"/);
	assert.match(SELECT_SOURCE, /"data-selected:text-text data-selected:data-highlighted:text-text"/u);
	assert.doesNotMatch(SELECT_SOURCE, /data-selected:bg-bg-selected/u);
	assert.doesNotMatch(SELECT_SOURCE, /data-selected:text-text-selected/u);
	assert.doesNotMatch(
		SELECT_SOURCE,
		/<span className=\{dropdownStyles\.indicator\}>[\s\S]*?<SelectPrimitive\.ItemIndicator>/,
	);
	assert.match(
		SELECT_SOURCE,
		/<SelectPrimitive\.ItemText\n\t\t\t\tclassName=\{cn\(\n\t\t\t\t\t"flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap",\n\t\t\t\t\ttextClassName,\n\t\t\t\t\)\}/,
	);
	assert.doesNotMatch(
		SELECT_SOURCE,
		/<SelectPrimitive\.ItemText className="flex flex-1 gap-2 shrink-0 whitespace-nowrap">/,
	);
});

test("SelectItem can opt out of the trailing check mark via showIndicator", () => {
	assert.match(
		SELECT_SOURCE,
		/showIndicator\?: boolean/,
	);
	assert.match(
		SELECT_SOURCE,
		/showIndicator = true,/,
	);
	assert.match(
		SELECT_SOURCE,
		/\{showIndicator \? \(\n\t\t\t\t<span\n\t\t\t\t\tdata-slot="select-item-indicator"/,
	);
});

test("SelectTrigger keeps single-line value clamp by default", () => {
	assert.match(SELECT_SOURCE, /whitespace-nowrap/);
	assert.match(SELECT_SOURCE, /\*:data-\[slot=select-value\]:line-clamp-1/);
});

test("SelectTrigger radius and text tone match outline button with muted placeholders", () => {
	assert.match(SELECT_SOURCE, /rounded-md bg-transparent/);
	assert.match(SELECT_SOURCE, /text-sm text-text-subtle transition-colors/);
	assert.match(SELECT_SOURCE, /\[&_svg\]:text-icon-subtle"/);
	assert.match(SELECT_SOURCE, /data-placeholder:text-text-subtlest/);
	assert.match(SELECT_SOURCE, /flex w-fit cursor-pointer items-center/);
	assert.match(SELECT_SOURCE, /disabled:cursor-not-allowed/);
	assert.doesNotMatch(SELECT_SOURCE, /rounded-lg bg-transparent/);
	assert.doesNotMatch(SELECT_SOURCE, /text-sm text-text transition-colors/);
	assert.doesNotMatch(SELECT_SOURCE, /\[&_svg\]:text-icon"/);
	assert.match(
		SELECT_SOURCE,
		/className="text-icon-subtle size-4 pointer-events-none"/,
	);
});

test("SelectTrigger default fill matches outline Button neutral-subtle surfaces", () => {
	assert.match(
		SELECT_SOURCE,
		/data-\[variant=default\]:border-border data-\[variant=default\]:border data-\[variant=default\]:bg-bg-neutral-subtle data-\[variant=default\]:hover:bg-bg-neutral-subtle-hovered data-\[variant=default\]:active:bg-bg-neutral-subtle-pressed/,
	);
	assert.match(
		SELECT_SOURCE,
		/data-\[variant=subtle\]:hover:bg-bg-neutral-subtle-hovered data-\[variant=subtle\]:active:bg-bg-neutral-subtle-pressed/,
	);
	assert.doesNotMatch(
		SELECT_SOURCE,
		/data-\[variant=default\]:bg-bg-input/,
	);
	assert.doesNotMatch(
		SELECT_SOURCE,
		/data-\[variant=default\]:border-input/,
	);
});

test("SelectContent accepts positionerClassName to raise stacking above dialogs", () => {
	assert.match(
		SELECT_SOURCE,
		/positionerClassName\?: string/,
	);
	assert.match(
		SELECT_SOURCE,
		/className=\{cn\("isolate z-\[200\]", positionerClassName\)\}/,
	);
});

test("SelectContent applies its accessible name to the listbox", () => {
	assert.match(SELECT_SOURCE, /"aria-label": ariaLabel,/);
	assert.match(
		SELECT_SOURCE,
		/<SelectPrimitive\.List aria-label=\{ariaLabel\}>\{children\}<\/SelectPrimitive\.List>/,
	);
});

test("SelectItem supports textClassName for rich multi-line option content", () => {
	assert.match(
		SELECT_SOURCE,
		/textClassName\?: string/,
	);
	assert.match(
		SELECT_SOURCE,
		/<SelectPrimitive\.ItemText\n\t\t\t\tclassName=\{cn\(\n\t\t\t\t\t"flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap",\n\t\t\t\t\ttextClassName,\n\t\t\t\t\)\}/,
	);
	assert.match(
		SELECT_SOURCE,
		/data-slot="select-item-indicator"/,
	);
});

test("subscription plan demo opts out of value clamp for multi-line Item content", () => {
	assert.match(
		SELECT_DEMO_SOURCE,
		/function SelectDemoSubscriptionPlan\(\) \{[\s\S]*?<SelectTrigger className="h-auto! w-96 whitespace-normal \*:data-\[slot=select-value\]:line-clamp-none">/,
	);
});

test("SelectTrigger tags hosts removable SelectTag without nesting buttons", () => {
	const selectTagsSource = fs.readFileSync(
		path.join(__dirname, "select-tags.tsx"),
		"utf8",
	);

	assert.match(SELECT_SOURCE, /tags\?: boolean/);
	assert.match(SELECT_SOURCE, /nativeButton=\{tags \? false : nativeButton\}/);
	assert.match(SELECT_SOURCE, /render=\{tags \? \(render \?\? <div \/>\) : render\}/);
	assert.match(
		SELECT_SOURCE,
		/tags &&\s*\n\s*"h-auto min-h-8 whitespace-normal \*:data-\[slot=select-value\]:line-clamp-none/,
	);
	assert.match(SELECT_SOURCE, /SelectTag,\n\tSelectTags,/);
	assert.match(selectTagsSource, /function SelectTags/);
	assert.match(selectTagsSource, /function SelectTag/);
	assert.match(selectTagsSource, /function stopSelectToggle/);
	assert.match(selectTagsSource, /onMouseDown=\{stopSelectToggle\}/);
	assert.match(selectTagsSource, /onPointerDown=\{stopSelectToggle\}/);
});

test("select demos cover single- and multi-select removable tags", () => {
	assert.match(
		SELECT_DEMO_SOURCE,
		/function SelectDemoMultipleSelection\(\) \{[\s\S]*?<SelectTrigger className="w-72" tags>[\s\S]*<SelectTags>[\s\S]*<SelectTag[\s\S]*onRemove=\{/,
	);
	assert.match(
		SELECT_DEMO_SOURCE,
		/function SelectDemoSingleSelectionTags\(\) \{[\s\S]*?<SelectTrigger className="w-72" tags>[\s\S]*<SelectTag onRemove=\{/,
	);
});
