const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const TILE_SOURCE = fs.readFileSync(path.join(__dirname, "tile.tsx"), "utf8");

const SIZE_CLASS_EXPECTATIONS = [
	["xxsmall", "size-4", "[font-size:10px]"],
	["xsmall", "size-5", "[font-size:12px]"],
	["small", "size-6", "[font-size:14px]"],
	["medium", "size-8", "[font-size:16px]"],
	["large", "size-10", "[font-size:20px]"],
	["xlarge", "size-12", "[font-size:24px]"],
];

const INSET_CHILD_SIZE_EXPECTATIONS = [
	["xxsmall", "[&_span]:size-2.5!", "[&_img]:size-2.5!", "[&_svg]:size-2.5!", "text-[10px]/[10px]"],
	["xsmall", "[&_span]:size-3!", "[&_img]:size-3!", "[&_svg]:size-3!", "text-[12px]/[12px]"],
	["small", "[&_span]:size-3.5!", "[&_img]:size-3.5!", "[&_svg]:size-3.5!", "text-[14px]/[14px]"],
	["medium", "[&_span]:size-4!", "[&_img]:size-4!", "[&_svg]:size-4!", "text-[16px]/[16px]"],
	["large", "[&_span]:size-5!", "[&_img]:size-5!", "[&_svg]:size-5!", "text-[20px]/[20px]"],
	["xlarge", "[&_span]:size-6!", "[&_img]:size-6!", "[&_svg]:size-6!", "text-[24px]/[24px]"],
];

test("Tile size variants keep tile and content scaling aligned", () => {
	for (const [size, tileClass, fontSizeClass] of SIZE_CLASS_EXPECTATIONS) {
		const match = TILE_SOURCE.match(new RegExp(`\\n\\t\\t\\t\\t${size}: "([^"]*)"`, "u"));

		assert.ok(match, `${size} size variant should exist`);
		assert.deepEqual(match[1].split(" "), [tileClass, fontSizeClass]);
	}
});

test("Tile inset child sizes match the tile font-size scale", () => {
	for (const [size, spanClass, imageClass, svgClass, textClass] of INSET_CHILD_SIZE_EXPECTATIONS) {
		const match = TILE_SOURCE.match(new RegExp(`\\n\\t${size}: "([^"]*)"`, "u"));

		assert.ok(match, `${size} inset child size should exist`);
		assert.deepEqual(match[1].split(" "), [spanClass, imageClass, svgClass, textClass]);
	}
});

test("Tile snug inset pads 2px and fills children with !important sizing", () => {
	const snugMatch = TILE_SOURCE.match(/const SNUG_CHILD_CLASSES =\n\t"([^"]*)"/u);

	assert.ok(snugMatch, "SNUG_CHILD_CLASSES constant should exist");
	// ADS marks need `!` to override their unlayered width/height CSS.
	for (const cls of ["[&_span]:size-full!", "[&_img]:size-full!", "[&_svg]:size-full!", "[&_[data-slot=avatar]]:size-full!"]) {
		assert.ok(snugMatch[1].includes(cls), `snug fill should include ${cls}`);
	}

	// isSnug wins over isInset and applies the 2px pad alongside the fill classes.
	assert.match(
		TILE_SOURCE,
		/isSnug\s*\?\s*cn\("p-0\.5", SNUG_CHILD_CLASSES\)\s*:\s*isInset/u,
		"isSnug branch should pad p-0.5 and take precedence over isInset",
	);
});

test("TileAvatar routes agent and project tile images through the Avatar primitive", () => {
	assert.match(TILE_SOURCE, /import \{ Avatar, AvatarImage \} from "@\/components\/ui\/avatar"/u);
	assert.match(TILE_SOURCE, /export interface TileAvatarProps[\s\S]*Omit<React\.ComponentProps<typeof Avatar>, "children" \| "shape" \| "size">[\s\S]*shape: "square" \| "hexagon"[\s\S]*src: string/u);
	assert.match(TILE_SOURCE, /function TileAvatar\(/u);
	assert.match(TILE_SOURCE, /<Avatar[\s\S]*\{\.\.\.props\}[\s\S]*shape=\{shape\}[\s\S]*size="sm"[\s\S]*<AvatarImage alt=\{alt\} src=\{src\} \/>/u);
	assert.match(TILE_SOURCE, /export \{ Tile, TileAvatar, tileVariants \}/u);
});
