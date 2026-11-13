const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const ROOT = join(__dirname, "..", "..");
const SOURCE = readFileSync(join(__dirname, "tabs.tsx"), "utf8");
const EXPERIMENTAL_SOURCE = readFileSync(join(__dirname, "tabs-experimental.ts"), "utf8");
const DEMO_SOURCE = readFileSync(
	join(ROOT, "components", "website", "demos", "ui", "tabs-demo.tsx"),
	"utf8",
);
const DETAILS_SOURCE = readDetailCategorySource("ui");
const REGISTRY_SOURCE = readWebsiteRegistrySource();

test("TabsList exposes default and compact sizes with inset pill treatment", () => {
	assert.match(SOURCE, /default: "rounded-md bg-muted"/u);
	assert.match(SOURCE, /"gap-1\.5 rounded-sm border border-transparent/u);
	assert.match(SOURCE, /size: \{\s*default: "group-data-horizontal\/tabs:h-8",\s*compact: "group-data-horizontal\/tabs:h-6"/u);
	assert.match(SOURCE, /variant: "default",\s*size: "default",\s*className: "p-\[3px\]"/u);
	assert.match(SOURCE, /variant: "default",\s*size: "compact",\s*className: "p-0\.5"/u);
	assert.match(SOURCE, /data-size=\{size\}/u);
	assert.match(SOURCE, /tabsListVariants\(\{ variant, size, fullWidth \}\)/u);
});

test("Tabs compact size scales trigger padding and un-sized icons", () => {
	assert.match(SOURCE, /group-data-\[size=compact\]\/tabs-list:px-2/u);
	assert.match(SOURCE, /group-data-\[size=compact\]\/tabs-list:\[&_svg:not\(\[class\*='size-'\]\)\]:size-3/u);
});

test("Tabs idle and selected default triggers keep text-subtle and icon-subtle", () => {
	assert.match(SOURCE, /text-text-subtle[\s\S]*\[&_\[data-slot=icon\]\]:text-icon-subtle[\s\S]*\[&_svg\]:text-icon-subtle/u);
	assert.doesNotMatch(
		SOURCE,
		/group-data-\[variant=default\]\/tabs-list:data-active:text-text(?!-)/u,
	);
	assert.match(
		SOURCE,
		/group-data-\[variant=line\]\/tabs-list:data-active:text-text-selected group-data-\[variant=line\]\/tabs-list:data-active:\[&_\[data-slot=icon\]\]:text-icon-selected group-data-\[variant=line\]\/tabs-list:data-active:\[&_svg\]:text-icon-selected/u,
	);
});

test("Tabs exposes the experimental Jira navigation variant", () => {
	assert.match(EXPERIMENTAL_SOURCE, /tabsExperimentalListClass = "gap-4 bg-transparent"/u);
	assert.match(EXPERIMENTAL_SOURCE, /tabsExperimentalTriggerClass = cn\([\s\S]*px-0 text-xs font-medium leading-4/u);
	assert.match(EXPERIMENTAL_SOURCE, /border-x-\[6px\] border-x-transparent px-0/u);
	assert.match(EXPERIMENTAL_SOURCE, /text-text-subtle[\s\S]*\[&_\[data-slot=icon\]\]:text-icon-subtle[\s\S]*\[&_svg\]:text-icon-subtle/u);
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /"hover:rounded-md hover:bg-bg-neutral-subtle-hovered/u);
	assert.match(EXPERIMENTAL_SOURCE, /hover:rounded-md[\s\S]*active:rounded-md/u);
	assert.match(EXPERIMENTAL_SOURCE, /group-data-\[header-variant=compact\]\/work-item-navigation:hover:rounded-b-none/u);
	assert.match(SOURCE, /experimental: tabsExperimentalListClass/u);
	assert.match(SOURCE, /group-data-\[variant=experimental\]\/tabs-list:px-0!/u);
	assert.match(SOURCE, /group-data-\[variant=experimental\]\/tabs-list:border-x-\[6px\]!/u);
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /data-active:text-text/u);
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /aria-\[current=location\]:text-text/u);
	assert.match(EXPERIMENTAL_SOURCE, /after:bg-bg-neutral-bold/u);
	assert.doesNotMatch(SOURCE, /group-data-\[variant=experimental\]\/tabs-list:data-active:text-text/u);
	assert.match(SOURCE, /group-data-\[variant=experimental\]\/tabs-list:after:bg-bg-neutral-bold/u);
	assert.doesNotMatch(
		SOURCE,
		/group-data-\[variant=experimental\]\/tabs-list:hover:rounded-md group-data-\[variant=experimental\]\/tabs-list:hover:bg-bg-neutral-subtle-hovered/u,
	);
	assert.match(SOURCE, /group-data-\[variant=experimental\]\/tabs-list:data-active:after:opacity-100/u);
	assert.match(SOURCE, /group-data-\[variant=line\]\/tabs-list:data-active:text-text-selected/u);
});

test("Tabs docs register the compact variant demo", () => {
	assert.match(DEMO_SOURCE, /export function TabsDemoCompact\(\)[\s\S]*<TabsList size="compact">/u);
	assert.match(REGISTRY_SOURCE, /"tabs-demo-compact"[\s\S]*default: mod\.TabsDemoCompact/u);
	assert.match(DETAILS_SOURCE, /title: "Compact"[\s\S]*demoSlug: "tabs-demo-compact"/u);
});

test("line variant selected after sits on the grey rule", () => {
	assert.match(
		SOURCE,
		/const tabsLineIndicatorClass =\s*"after:inset-x-0 after:-bottom-px after:h-0\.5 after:bg-border-selected"/u,
	);
	assert.match(SOURCE, /tabsLineIndicatorClass/u);
	assert.match(
		SOURCE,
		/line: `gap-0 bg-transparent shadow-\[inset_0_-1px_0_0_var\(--color-border\)\] \$\{tabsLineListOverflowClass\}`/u,
	);
	assert.doesNotMatch(SOURCE, /line: `gap-0 bg-transparent border-b border-border/u);
});

test("fullWidth line list owns the grey rule on a non-w-fit owner", () => {
	assert.match(SOURCE, /fullWidth: \{\s*true: "w-full",\s*false: "w-fit",\s*\}/u);
	assert.match(
		SOURCE,
		/line: `gap-0 bg-transparent shadow-\[inset_0_-1px_0_0_var\(--color-border\)\] \$\{tabsLineListOverflowClass\}`/u,
	);
	assert.doesNotMatch(
		SOURCE,
		/group\/tabs-list text-text-subtle inline-flex w-fit items-center/u,
	);
});

test("line list overflow box does not clip the selected after", () => {
	assert.match(SOURCE, /const tabsLineListOverflowClass = "overflow-x-auto -mb-px pb-px"/u);
	assert.match(
		SOURCE,
		/line: `gap-0 bg-transparent shadow-\[inset_0_-1px_0_0_var\(--color-border\)\] \$\{tabsLineListOverflowClass\}`/u,
	);
	assert.doesNotMatch(SOURCE, /line: `gap-0 bg-transparent border-b border-border/u);
});

test("Tabs docs register the line fullWidth demo", () => {
	assert.match(
		DEMO_SOURCE,
		/export function TabsDemoLineFullWidth\(\)[\s\S]*<TabsList fullWidth variant="line">/u,
	);
	assert.match(REGISTRY_SOURCE, /"tabs-demo-line-full-width"[\s\S]*default: mod\.TabsDemoLineFullWidth/u);
	assert.match(DETAILS_SOURCE, /title: "Line full width"[\s\S]*demoSlug: "tabs-demo-line-full-width"/u);
});
