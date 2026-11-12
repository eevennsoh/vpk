const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
	path.join(__dirname, "popover.tsx"),
	"utf8",
);

test("popover content supports overriding the portal positioner layer", () => {
	assert.match(source, /positionerClassName\?: string/u);
	assert.match(
		source,
		/className=\{cn\("isolate z-\[200\]", positionerClassName\)\}/u,
	);
});

test("popover content uses the ADS elevation overlay shadow", () => {
	assert.match(source, /rounded-lg p-2\.5 text-sm shadow-xl/u);
	assert.doesNotMatch(source, /shadow-\[|dark:shadow|data-color-mode=dark.*shadow/u);
	assert.doesNotMatch(source, /ring-1/u);
});
