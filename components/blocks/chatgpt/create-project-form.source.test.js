const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SOURCE = fs.readFileSync(
	path.join(__dirname, "components/create-project-form.tsx"),
	"utf8",
);

test("checked categories use a neutral badge with a subtle checkmark", () => {
	assert.match(SOURCE, /variant="neutral"/u);
	assert.match(SOURCE, /data-checked=\{selectedCategory === category\.id\}/u);
	assert.match(SOURCE, /<CircleCheckIcon[^>]*text-icon-subtle!/u);
	assert.doesNotMatch(SOURCE, /selectedCategory === category\.id \? "information"/u);
	assert.doesNotMatch(SOURCE, /bg-bg-selected/u);
});
