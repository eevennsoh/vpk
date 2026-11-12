const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
	path.join(__dirname, "inline-edit.tsx"),
	"utf8",
);

test("inline edit multiline textarea matches read view text metrics", () => {
	assert.match(source, /multiline \? "min-h-10 items-start py-2" : "h-10 items-center"/u);
	assert.match(source, /"rounded-md px-1\.5 py-2 text-sm leading-5"/u);
	assert.match(source, /readViewClassName/u);
});

test("inline edit confirm action always uses the checkmark icon", () => {
	assert.match(source, /import CheckMarkIcon from "@atlaskit\/icon\/core\/check-mark"/u);
	assert.match(source, /render=\{<CheckMarkIcon label="" size="small" \/>\}/u);
	assert.doesNotMatch(source, /ArrowUpIcon/u);
});
