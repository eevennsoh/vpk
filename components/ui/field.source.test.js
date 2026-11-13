const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const FIELD_SOURCE = readFileSync(join(__dirname, "field.tsx"), "utf8");

test("horizontal field rows reserve a 24px line for checkbox and radio labels", () => {
	assert.match(FIELD_SOURCE, /horizontal:\s*\n\s*"min-h-6 flex-row items-center/u);
	assert.match(FIELD_SOURCE, /\[&>\[data-slot=field-label\]\]:leading-6/u);
	assert.match(FIELD_SOURCE, /@md\/field-group:min-h-6/u);
	assert.match(FIELD_SOURCE, /@md\/field-group:\[&>\[data-slot=field-label\]\]:leading-6/u);
});
