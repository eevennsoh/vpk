const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const CHECKBOX_SOURCE = readFileSync(join(__dirname, "checkbox.tsx"), "utf8");

test("checkbox keeps a 16px visual box with a 24px hit target", () => {
	assert.match(CHECKBOX_SOURCE, /flex size-4 items-center justify-center/u);
	assert.match(CHECKBOX_SOURCE, /after:absolute after:-inset-\[5px\]/u);
	assert.doesNotMatch(CHECKBOX_SOURCE, /after:-inset-1/u);
	assert.doesNotMatch(CHECKBOX_SOURCE, /after:-inset-x-3/u);
	assert.doesNotMatch(CHECKBOX_SOURCE, /after:-inset-y-2/u);
});
