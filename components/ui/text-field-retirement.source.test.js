const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const TEXT_FIELD_COMPATIBILITY_ALIAS = join(__dirname, "text-field.tsx");
const INPUT_OWNER = join(__dirname, "input.tsx");

test("Input remains the sole text-field UI owner without a compatibility alias", () => {
	assert.equal(existsSync(INPUT_OWNER), true);
	assert.equal(existsSync(TEXT_FIELD_COMPATIBILITY_ALIAS), false);
});
