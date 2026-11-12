const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const read = (filePath) => readFileSync(join(__dirname, filePath), "utf8");
const HEADER_SOURCE = read("board-header.tsx");
const EXPERIMENTAL_HEADER_SOURCE = read("experimental/experimental-board-header.tsx");
const EXPERIMENTAL_V2_HEADER_SOURCE = read("experimental-v2/experimental-v2-board-header.tsx");

test("board facepile human avatars keep the white separator inside clickable wrappers", () => {
	assert.match(
		HEADER_SOURCE,
		/className=\{cn\(\s*showGroupStroke && "ring-2 ring-background",[\s\S]*selected && "ring-2! ring-border-selected!"/u,
	);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/className=\{cn\(\s*showGroupStroke && !isAgent && "ring-2 ring-background",[\s\S]*selected && !isAgent/u,
	);
	assert.match(
		EXPERIMENTAL_V2_HEADER_SOURCE,
		/className=\{cn\(\s*showGroupStroke && !isAgent && "ring-2 ring-background",[\s\S]*selected && !isAgent/u,
	);
});
