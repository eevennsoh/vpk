const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ICON_TILE_SOURCE = fs.readFileSync(path.join(__dirname, "icon-tile.tsx"), "utf8");
const ICON_TILE_DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "website", "demos", "ui", "icon-tile-demo.tsx"),
	"utf8",
);

const SIZE_CLASS_EXPECTATIONS = [
	["xxsmall", "size-4", "[font-size:10px]", "[&_img]:size-2.5!", "[&_span]:size-2.5!", "[&_svg]:size-2.5!"],
	["xsmall", "size-5", "[font-size:12px]", "[&_img]:size-3!", "[&_span]:size-3!", "[&_svg]:size-3!"],
	["small", "size-6", "[font-size:14px]", "[&_img]:size-3.5!", "[&_span]:size-3.5!", "[&_svg]:size-3.5!"],
	["medium", "size-8", "[font-size:16px]", "[&_img]:size-4!", "[&_span]:size-4!", "[&_svg]:size-4!"],
	["large", "size-10", "[font-size:20px]", "[&_img]:size-5!", "[&_span]:size-5!", "[&_svg]:size-5!"],
	["xlarge", "size-12", "[font-size:24px]", "[&_img]:size-6!", "[&_span]:size-6!", "[&_svg]:size-6!"],
];

test("IconTile size variants keep ADS tile and icon scaling aligned", () => {
	for (const [size, ...expectedClasses] of SIZE_CLASS_EXPECTATIONS) {
		const match = ICON_TILE_SOURCE.match(new RegExp(`\\n\\t\\t\\t\\t${size}: "([^"]*)"`, "u"));

		assert.ok(match, `${size} size variant should exist`);
		assert.deepEqual(match[1].split(" "), expectedClasses);
	}
});

test("IconTile exposes a transparent, backgroundless tile variant", () => {
	assert.match(ICON_TILE_SOURCE, /\| "transparent"/u);
	assert.match(ICON_TILE_SOURCE, /transparent:\s*"bg-transparent text-icon/u);
	assert.match(ICON_TILE_SOURCE, /type IconTileIconSize = "small" \| "medium"/u);
	assert.match(ICON_TILE_SOURCE, /type IconTileRootElement = "div" \| "span"/u);
	assert.match(ICON_TILE_SOURCE, /as\?: IconTileRootElement/u);
	assert.match(ICON_TILE_SOURCE, /as = "div"/u);
	assert.match(ICON_TILE_SOURCE, /iconSize\?: IconTileIconSize/u);
	assert.match(ICON_TILE_SOURCE, /data-\[transparent-icon-size=small\]:\[font-size:12px\]/u);
	assert.match(ICON_TILE_SOURCE, /data-\[transparent-icon-size=small\]:\[&_span\]:size-3!/u);
	assert.match(ICON_TILE_SOURCE, /data-\[transparent-icon-size=medium\]:\[font-size:16px\]/u);
	assert.match(ICON_TILE_SOURCE, /data-\[transparent-icon-size=medium\]:\[&_span\]:size-4!/u);
	assert.match(ICON_TILE_SOURCE, /"data-size": size/u);
	assert.match(ICON_TILE_SOURCE, /"data-transparent-icon-size":/u);
	assert.match(ICON_TILE_SOURCE, /"data-variant": variant/u);
	assert.match(ICON_TILE_SOURCE, /return as === "span" \? \(\s*<span \{\.\.\.sharedProps\}>/u);
	assert.match(ICON_TILE_SOURCE, /square: "rounded-tile"/u);
});

test("IconTile gives labelled div and span roots valid image semantics", () => {
	assert.match(ICON_TILE_SOURCE, /"aria-label": isDecorative \? undefined : label/u);
	assert.match(ICON_TILE_SOURCE, /role: isDecorative \? props\.role : props\.role \?\? "img"/u);
});

test("IconTile transparent variant supports 24px and 32px tiles with 12px or 16px icons", () => {
	assert.match(ICON_TILE_SOURCE, /small: "size-6/u);
	assert.match(ICON_TILE_SOURCE, /medium: "size-8/u);
	assert.match(ICON_TILE_SOURCE, /iconSize \?\? \(size === "xxsmall" \? "small" : "medium"\)/u);
	assert.match(ICON_TILE_SOURCE, /variant === "transparent" \? transparentIconSize : undefined/u);
});

test("IconTile demos reserve the 16px size for transparent tiles only", () => {
	const sizesDemoMatch = ICON_TILE_DEMO_SOURCE.match(/export function IconTileDemoSizes\(\) \{[\s\S]*?\n\}/u);
	const transparentDemoMatch = ICON_TILE_DEMO_SOURCE.match(/export function IconTileDemoTransparent\(\) \{[\s\S]*?\n\}/u);

	assert.ok(sizesDemoMatch, "colored sizes demo should exist");
	assert.ok(transparentDemoMatch, "transparent demo should exist");

	assert.doesNotMatch(sizesDemoMatch[0], /variant="blue" size="xxsmall"/u);
	assert.match(sizesDemoMatch[0], /variant="blue" size="xsmall"/u);
	assert.match(sizesDemoMatch[0], /variant="blue" size="xlarge"/u);

	assert.match(ICON_TILE_DEMO_SOURCE, /\{ label: "16", size: "xxsmall", logoSize: "xxsmall" \}/u);
	assert.match(ICON_TILE_DEMO_SOURCE, /\{ label: "24", size: "small", logoSize: "small" \}/u);
	assert.match(ICON_TILE_DEMO_SOURCE, /\{ label: "32", size: "medium", logoSize: "small" \}/u);
	assert.match(transparentDemoMatch[0], /variant="transparent" size=\{size\}/u);
	assert.doesNotMatch(ICON_TILE_DEMO_SOURCE, /label: "(?:20|40|48)"/u);
});
