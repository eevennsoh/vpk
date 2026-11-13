const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const TOGGLE_GROUP_DEMO_SOURCE = readFileSync(
	join(__dirname, "toggle-group-demo.tsx"),
	"utf8",
);
const TOGGLE_GROUP_DETAIL_SOURCE = readFileSync(
	join(__dirname, "../../../../app/data/details/ui/toggle-group.ts"),
	"utf8",
);

test("outline with icons demos use dense product toolbar icon treatment", () => {
	assert.match(
		TOGGLE_GROUP_DEMO_SOURCE,
		/const denseIconItemClassName = "p-1\.5! text-icon-subtle";/u,
	);
	assert.match(
		TOGGLE_GROUP_DEMO_SOURCE,
		/export function ToggleGroupDemoOutlineWithIcons\(\) \{[\s\S]*<ToggleGroup variant="outline" multiple size="sm">[\s\S]*className=\{denseIconItemClassName\}[\s\S]*<BoldIcon size="small" \/>[\s\S]*<ItalicIcon size="small" \/>[\s\S]*<UnderlineIcon size="small" \/>/u,
	);
	assert.match(
		TOGGLE_GROUP_DEMO_SOURCE,
		/export function ToggleGroupDemoVerticalOutlineWithIcons\(\) \{[\s\S]*<ToggleGroup variant="outline" multiple orientation="vertical" size="sm">[\s\S]*className=\{denseIconItemClassName\}[\s\S]*<BoldIcon size="small" \/>[\s\S]*<ItalicIcon size="small" \/>[\s\S]*<UnderlineIcon size="small" \/>/u,
	);
});

test("with-icons demo uses 12px icons and subtle idle color", () => {
	assert.match(
		TOGGLE_GROUP_DEMO_SOURCE,
		/export function ToggleGroupDemoWithIcons\(\) \{[\s\S]*text-icon-subtle[\s\S]*<StarIcon size="small" \/>[\s\S]*<HeartIcon size="small" \/>[\s\S]*<BookmarkIcon size="small" \/>/u,
	);
});

test("all icon demos use size=\"small\" and text-icon-subtle", () => {
	assert.match(
		TOGGLE_GROUP_DEMO_SOURCE,
		/const iconItemClassName = "text-icon-subtle";/u,
	);

	// No leftover 16px size-4 icon classes in this demo file.
	assert.doesNotMatch(TOGGLE_GROUP_DEMO_SOURCE, /className="size-4"/u);

	// Every icon component usage in demos should pass size="small".
	const iconUsages = [
		...TOGGLE_GROUP_DEMO_SOURCE.matchAll(
			/<(AlignLeftIcon|AlignCenterIcon|AlignRightIcon|BoldIcon|ItalicIcon|UnderlineIcon|ArrowDownIcon|ArrowUpIcon|TrendingUpIcon|StarIcon|HeartIcon|BookmarkIcon|AtlaskitBoldIcon|AtlaskitItalicIcon|AtlaskitUnderlineIcon)\b([^>]*)\/?>/gu,
		),
	];
	assert.ok(iconUsages.length > 0, "expected icon usages in toggle-group demos");
	for (const [, name, attrs] of iconUsages) {
		assert.match(
			attrs,
			/\bsize="small"/u,
			`${name} should use size="small"`,
		);
	}

	// Icon-bearing demos wire subtle color onto items via shared class constants.
	for (const [demoName, classRef] of [
		["ToggleGroupDemo", "iconItemClassName"],
		["ToggleGroupDemoBasic", "iconItemClassName"],
		["ToggleGroupDemoDefault", "iconItemClassName"],
		["ToggleGroupDemoMultiple", "iconItemClassName"],
		["ToggleGroupDemoSort", "iconItemClassName"],
		["ToggleGroupDemoVertical", "iconItemClassName"],
		["ToggleGroupDemoOutlineWithIcons", "denseIconItemClassName"],
		["ToggleGroupDemoVerticalOutlineWithIcons", "denseIconItemClassName"],
		["ToggleGroupDemoWithIcons", "withIconsItemClassName"],
	]) {
		const pattern = new RegExp(
			`export (?:default )?function ${demoName}\\(\\) \\{[\\s\\S]*?className=\\{${classRef}\\}`,
			"u",
		);
		assert.match(
			TOGGLE_GROUP_DEMO_SOURCE,
			pattern,
			`${demoName} should use ${classRef}`,
		);
	}
});

test("outline with icons docs copy describes dense 12px icon treatment", () => {
	assert.match(
		TOGGLE_GROUP_DETAIL_SOURCE,
		/title: "Outline with icons",[\s\S]*description:[\s\S]*12px icons[\s\S]*6px padding[\s\S]*demoSlug: "toggle-group-demo-outline-with-icons"/u,
	);
	assert.match(
		TOGGLE_GROUP_DETAIL_SOURCE,
		/title: "Vertical outline with icons",[\s\S]*description:[\s\S]*12px icons[\s\S]*6px padding[\s\S]*demoSlug: "toggle-group-demo-vertical-outline-with-icons"/u,
	);
});
